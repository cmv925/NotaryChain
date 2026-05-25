"""
ACN — Autonomous Cross-Border Notarization Network — Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional
import base64
import logging
import uuid

from models import User
from routes.auth_routes import get_current_user
from services import acn_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/acn", tags=["autonomous-cross-border-notarization"])
db = None


def set_db(database):
    global db
    db = database
    acn_service.set_dependencies(database, hedera_svc=_lazy_hedera())


def _lazy_hedera():
    try:
        from services.hedera_service import hedera_service
        return hedera_service
    except Exception:
        return None


# ────────────────────────────────────────────────────────────────────────────
# DETECTION + ANALYSIS
# ────────────────────────────────────────────────────────────────────────────

@router.get("/jurisdictions")
async def list_supported_jurisdictions(current_user: User = Depends(get_current_user)):
    """Public to logged-in users — returns the seeded jurisdiction rule database."""
    return {"jurisdictions": acn_service.list_jurisdictions()}


@router.post("/analyze")
async def analyze_document(request: Request, current_user: User = Depends(get_current_user)):
    """
    Analyse a document for cross-border jurisdiction relevance.
    Body: {ceremony_id?, doc_text?, source_jurisdiction?, hint_codes?:[]}.
    Creates a new acn_packet in 'analyzed' state — does NOT seal yet.
    """
    body = await request.json()
    doc_text = (body.get("doc_text") or "").strip()
    ceremony_id = body.get("ceremony_id")
    if ceremony_id and not doc_text:
        cer = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
        if cer:
            doc_text = (
                (cer.get("document_name") or "") + "\n\n" +
                (cer.get("document_summary") or cer.get("ai_summary", "")) + "\n\n" +
                (cer.get("document_text") or "")
            ).strip()
    if not doc_text:
        raise HTTPException(status_code=400, detail="doc_text or ceremony_id (with ingested text) is required")

    hint_codes = body.get("hint_codes") or []
    detection = await acn_service.detect_jurisdictions(doc_text, hint_codes=hint_codes)
    risk = acn_service.score_risk(detection["detected"], doc_text)

    packet = {
        "id": uuid.uuid4().hex,
        "owner_email": current_user.email,
        "ceremony_id": ceremony_id,
        "source_jurisdiction": body.get("source_jurisdiction") or "US-FL",
        "source_text_hash": detection["source_text_hash"],
        "source_text_preview": doc_text[:480],
        "detected_jurisdictions": detection["detected"],
        "detection_method": detection["method"],
        "risk_scores": risk,
        "status": "analyzed",
        "needs_reseal": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.acn_packets.insert_one(packet)
    packet.pop("_id", None)
    return packet

@router.post("/packets/{packet_id}/seal")
async def seal_packet(packet_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """
    Build per-jurisdiction proofs (PDF + HCS message) for the given packet.
    Body: {jurisdictions?:[], jurat_ctx?:{...}}.
    If `jurisdictions` is omitted, seals every detected jurisdiction in the packet.
    """
    body = await request.json() if (await request.body()) else {}
    packet = await db.acn_packets.find_one({"id": packet_id}, {"_id": 0})
    if not packet:
        raise HTTPException(status_code=404, detail="Packet not found")
    if packet.get("owner_email") != current_user.email and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    codes = body.get("jurisdictions") or packet.get("detected_jurisdictions") or []
    if not codes:
        raise HTTPException(status_code=400, detail="No jurisdictions detected or supplied")

    # Default jurat ctx — caller can override
    jurat_ctx = {
        "signer_name": body.get("signer_name") or "Signer (on file)",
        "notary_name": body.get("notary_name") or "NotaryChain Online Notary",
        "county": body.get("county") or "—",
        "commission_id": body.get("commission_id") or "NC-" + uuid.uuid4().hex[:8].upper(),
        "commission_expiry": body.get("commission_expiry") or "(on file)",
        "id_form": body.get("id_form") or "government-issued ID",
        "witness_name": body.get("witness_name") or "(remote witness on file)",
        "date": datetime.now(timezone.utc).strftime("%B %d, %Y"),
    }

    result = await acn_service.seal_packet(packet, codes, jurat_ctx)

    await db.acn_packets.update_one(
        {"id": packet_id},
        {"$set": {
            "status": "sealed" if result["all_sealed"] else "partially_sealed",
            "sealed_at": result["sealed_at"],
            "needs_reseal": False,
            "needs_reseal_for_jurisdictions": [],
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "jurat_ctx": jurat_ctx,
        }},
    )
    return {
        "packet_id": packet_id,
        "sealed_jurisdictions": [p["jurisdiction_code"] for p in result["proofs"]],
        "proofs": result["proofs"],
        "all_sealed_on_chain": result["all_sealed"],
        "sealed_at": result["sealed_at"],
    }


# ────────────────────────────────────────────────────────────────────────────
# LIST / DETAIL / CERT DOWNLOAD
# ────────────────────────────────────────────────────────────────────────────

@router.get("/packets")
async def list_packets(current_user: User = Depends(get_current_user),
                       only_mine: bool = True, status: Optional[str] = None):
    query: dict = {}
    if only_mine and getattr(current_user, "role", "user") != "admin":
        query["owner_email"] = current_user.email
    if status:
        query["status"] = status
    items = []
    async for p in db.acn_packets.find(query, {"_id": 0}).sort("created_at", -1).limit(200):
        items.append(p)
    return {"packets": items, "total": len(items)}


@router.get("/packets/{packet_id}")
async def get_packet(packet_id: str, current_user: User = Depends(get_current_user)):
    packet = await db.acn_packets.find_one({"id": packet_id}, {"_id": 0})
    if not packet:
        raise HTTPException(status_code=404, detail="Packet not found")
    if packet.get("owner_email") != current_user.email and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    proofs = []
    async for proof in db.acn_proofs.find({"packet_id": packet_id}, {"_id": 0, "certificate_pdf_b64": 0}):
        proofs.append(proof)
    packet["proofs"] = proofs
    return packet


@router.get("/packets/{packet_id}/proofs/{jurisdiction}/certificate")
async def download_certificate(packet_id: str, jurisdiction: str,
                               current_user: User = Depends(get_current_user)):
    packet = await db.acn_packets.find_one({"id": packet_id}, {"_id": 0})
    if not packet:
        raise HTTPException(status_code=404, detail="Packet not found")
    if packet.get("owner_email") != current_user.email and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    proof = await db.acn_proofs.find_one(
        {"packet_id": packet_id, "jurisdiction_code": jurisdiction}, {"_id": 0}
    )
    if not proof or not proof.get("certificate_pdf_b64"):
        raise HTTPException(status_code=404, detail="Certificate not found")
    pdf = base64.b64decode(proof["certificate_pdf_b64"])
    safe = jurisdiction.replace("/", "_")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ACN_{packet_id[:8]}_{safe}.pdf"'},
    )


# ────────────────────────────────────────────────────────────────────────────
# PUBLIC VERIFICATION PASSPORT (no-auth)
# ────────────────────────────────────────────────────────────────────────────

public_router = APIRouter(prefix="/api/acn/public", tags=["acn-public"])


@public_router.get("/verify/{packet_id}")
async def public_verify(packet_id: str):
    """Cross-Border Verification Passport — public view of every sealed proof."""
    packet = await db.acn_packets.find_one(
        {"id": packet_id},
        {"_id": 0, "owner_email": 0, "jurat_ctx": 0, "source_text_preview": 0},
    )
    if not packet:
        raise HTTPException(status_code=404, detail="Packet not found")
    proofs = []
    async for proof in db.acn_proofs.find(
        {"packet_id": packet_id},
        {"_id": 0, "certificate_pdf_b64": 0, "jurat_text": 0},  # public view trims sensitive fields
    ):
        proofs.append(proof)
    return {
        "packet_id": packet_id,
        "status": packet.get("status"),
        "source_jurisdiction": packet.get("source_jurisdiction"),
        "detected_jurisdictions": packet.get("detected_jurisdictions", []),
        "sealed_at": packet.get("sealed_at"),
        "needs_reseal": packet.get("needs_reseal", False),
        "proofs": proofs,
        "verification_url": f"/acn/verify/{packet_id}",
    }


# ────────────────────────────────────────────────────────────────────────────
# RULE UPDATES + RE-SEAL
# ────────────────────────────────────────────────────────────────────────────

@router.get("/rule-updates")
async def list_rule_updates(current_user: User = Depends(get_current_user), limit: int = 50):
    items = []
    async for u in db.acn_rule_updates.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(u)
    return {"updates": items, "total": len(items)}


@router.post("/rule-updates")
async def post_rule_update(request: Request, current_user: User = Depends(get_current_user)):
    """Admin records a jurisdiction rule change. Affected packets get `needs_reseal=true`."""
    if getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    code = body.get("jurisdiction_code")
    if not code or code not in acn_service.JURISDICTION_RULES:
        raise HTTPException(status_code=400, detail="Unknown jurisdiction_code")
    summary = body.get("change_summary") or "Rule version refresh"
    effective_date = body.get("effective_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    update = await acn_service.record_rule_update(code, summary, effective_date, current_user.email)
    return update


@router.post("/packets/{packet_id}/reseal")
async def reseal_packet(packet_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Re-seal a packet after a jurisdiction rule update (one-click)."""
    packet = await db.acn_packets.find_one({"id": packet_id}, {"_id": 0})
    if not packet:
        raise HTTPException(status_code=404, detail="Packet not found")
    if packet.get("owner_email") != current_user.email and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    body = await request.json() if (await request.body()) else {}
    codes = body.get("jurisdictions") or packet.get("needs_reseal_for_jurisdictions") or packet.get("detected_jurisdictions") or []
    if not codes:
        raise HTTPException(status_code=400, detail="No jurisdictions to reseal")
    # Wipe previous proofs for these jurisdictions so reseal is idempotent
    await db.acn_proofs.delete_many({"packet_id": packet_id, "jurisdiction_code": {"$in": codes}})
    jurat_ctx = packet.get("jurat_ctx") or {
        "signer_name": "Signer (on file)", "notary_name": "NotaryChain Online Notary",
        "county": "—", "commission_id": "NC-" + uuid.uuid4().hex[:8].upper(),
        "id_form": "government-issued ID",
        "date": datetime.now(timezone.utc).strftime("%B %d, %Y"),
    }
    result = await acn_service.seal_packet(packet, codes, jurat_ctx)
    await db.acn_packets.update_one(
        {"id": packet_id},
        {"$set": {
            "status": "sealed" if result["all_sealed"] else "partially_sealed",
            "needs_reseal": False,
            "needs_reseal_for_jurisdictions": [],
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "sealed_at": result["sealed_at"],
        }},
    )
    return {"packet_id": packet_id, "resealed_jurisdictions": codes,
            "all_sealed_on_chain": result["all_sealed"], "sealed_at": result["sealed_at"]}
