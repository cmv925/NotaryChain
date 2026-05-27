"""
acn_auto_packet_service — automatically creates and seals an ACN
(Autonomous Cross-Border Notarization) packet whenever a ceremony reaches
"sealed" status. Every notarization in the system becomes instantly multi-
jurisdictional with zero extra clicks.

Wired from:
    /app/backend/routes/ceremony_routes.py  (in the seal hook after PDF gen)

Idempotency:
    If a packet for this ceremony already exists (`acn_packets.ceremony_id`),
    we return the existing one and skip rebuild.

Failure-mode:
    NEVER raises — all errors are swallowed + logged. ACN auto-creation is
    a value-add, not a blocker for the underlying notarization seal.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _public_verifier_url(packet_id: str) -> str:
    """Return the public ACN verifier URL for a given packet.

    Reads PUBLIC_VERIFIER_BASE_URL from env (falls back to REACT_APP_BACKEND_URL
    if not explicitly set), so the URL stays valid across preview/prod.
    """
    base = (os.environ.get("PUBLIC_VERIFIER_BASE_URL")
            or os.environ.get("REACT_APP_BACKEND_URL")
            or "").rstrip("/")
    return f"{base}/acn/verify/{packet_id}"


async def auto_create_acn_packet_for_ceremony(db, ceremony: dict) -> dict | None:
    """Build (and seal) an ACN packet for a freshly-sealed ceremony.

    Returns a dict {packet_id, public_verify_url, jurisdictions, all_sealed}
    on success, or None on any failure (failure is logged but never raised).
    """
    ceremony_id = ceremony.get("ceremony_id") or ceremony.get("id")
    if not ceremony_id:
        logger.warning("[acn_auto] skip — ceremony has no id")
        return None

    # Idempotency: skip if we've already built a packet for this ceremony
    existing = await db.acn_packets.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if existing:
        return {
            "packet_id": existing["id"],
            "public_verify_url": _public_verifier_url(existing["id"]),
            "jurisdictions": existing.get("detected_jurisdictions") or [],
            "all_sealed": existing.get("status") == "sealed",
            "reused": True,
        }

    try:
        from services import acn_service

        # Build the input text the same way the manual flow does.
        doc_text = (
            (ceremony.get("document_name") or "") + "\n\n" +
            (ceremony.get("document_summary") or ceremony.get("ai_summary", "")) + "\n\n" +
            (ceremony.get("document_text") or "")
        ).strip()
        if not doc_text:
            # Fall back to a stub so the packet can still anchor the signer
            doc_text = f"Notarized document for ceremony {ceremony_id}"

        # Detect target jurisdictions
        detection = await acn_service.detect_jurisdictions(doc_text)
        risk = acn_service.score_risk(detection["detected"], doc_text)

        # Build packet
        signer_name = (ceremony.get("signer_name")
                       or ceremony.get("initiated_by")
                       or "Notarization Signer")
        packet = {
            "id": uuid.uuid4().hex,
            "owner_email": ceremony.get("initiated_by") or "",
            "ceremony_id": ceremony_id,
            "source_jurisdiction": ceremony.get("jurisdiction")
                                   or ceremony.get("commission_state")
                                   or "US-FL",
            "source_text_hash": detection["source_text_hash"],
            "source_text_preview": doc_text[:480],
            "detected_jurisdictions": detection["detected"],
            "detection_method": detection["method"],
            "risk_scores": risk,
            "status": "analyzed",
            "needs_reseal": False,
            "auto_created": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.acn_packets.insert_one(packet)
        packet.pop("_id", None)

        # Auto-seal across all detected jurisdictions (concurrent under the hood)
        all_sealed = False
        try:
            jurat_ctx = {
                "signer_name": signer_name,
                "document_name": ceremony.get("document_name") or "Notarized document",
                "ceremony_id": ceremony_id,
                "sealed_at": datetime.now(timezone.utc).isoformat(),
            }
            seal_result = await acn_service.seal_packet(
                packet,
                detection["detected"] or [packet["source_jurisdiction"]],
                jurat_ctx,
            )
            all_sealed = bool(seal_result.get("all_sealed"))
            await db.acn_packets.update_one(
                {"id": packet["id"]},
                {"$set": {
                    "status": "sealed" if all_sealed else "partial",
                    "sealed_at": seal_result.get("sealed_at"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        except Exception as e:
            logger.warning(f"[acn_auto] seal failed for ceremony={ceremony_id}: {e}")

        url = _public_verifier_url(packet["id"])
        # Persist the verifier URL onto the ceremony doc so the certificate
        # generator + frontend cert page can surface it without a join query.
        await db.ceremonies.update_one(
            {"ceremony_id": ceremony_id},
            {"$set": {
                "acn_packet_id": packet["id"],
                "acn_public_verify_url": url,
                "acn_jurisdictions": detection["detected"],
                "acn_all_sealed": all_sealed,
            }},
        )

        logger.info(f"[acn_auto] created packet={packet['id']} "
                    f"jurisdictions={detection['detected']} for ceremony={ceremony_id}")
        return {
            "packet_id": packet["id"],
            "public_verify_url": url,
            "jurisdictions": detection["detected"],
            "all_sealed": all_sealed,
            "reused": False,
        }
    except Exception as e:
        logger.exception(f"[acn_auto] failed for ceremony={ceremony_id}: {e}")
        return None
