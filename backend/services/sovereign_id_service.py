"""
Sovereign ID — premium "Black Card" identity credential.

Mints a soulbound-style identity NFT for a verified user, backed by three layers
of provenance that reuse existing platform primitives:
  • Ed25519 attestation of the holder's identity claims (trustlayer_crypto),
  • a Hedera HTS NFT (mock-default; real Hedera testnet when SOVEREIGN_NFT_MODE=real,
    using the same hedera_testnet_client.mint_nft path as the ACN passport),
  • a Hedera HCS anchor of the attestation digest for tamper-evident provenance.

The private key is stored server-side (never returned) and is only needed to
re-attest when the holder's trust score changes. Verification needs only the
public key + signature + canonical payload.
"""
import os
import json
import uuid
import base64
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from services import trustlayer_crypto as tc
from services import crypto_vault

logger = logging.getLogger(__name__)

SCHEMA = "notarychain.sovereign.v1"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _trust_tier(score: int) -> str:
    try:
        from services.living_identity_service import trust_tier
        return trust_tier(score)
    except Exception:
        if score >= 90:
            return "Sovereign"
        if score >= 75:
            return "Verified"
        if score >= 50:
            return "Provisional"
        return "Unverified"


def _canonical(att: dict) -> dict:
    """Deterministic fields-to-sign. ORDER + KEYS are frozen — never reorder."""
    return {
        "schema": SCHEMA,
        "sovereign_id": att["sovereign_id"],
        "subject_user_id": att["subject_user_id"],
        "holder_name": att["holder_name"],
        "trust_tier": att["trust_tier"],
        "trust_score": att["trust_score"],
        "identity_verified": att["identity_verified"],
        "issued_at": att["issued_at"],
    }


def _canon_bytes(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def key_fingerprint(pub_b64: str) -> str:
    """Short human-readable Ed25519 public-key fingerprint for the card."""
    raw = base64.b64decode(pub_b64)
    h = hashlib.sha256(raw).hexdigest().upper()
    return ":".join(h[i:i + 4] for i in range(0, 24, 4))


def _verify_sig(pub_b64: str, sig_b64: str, msg: bytes) -> tuple[bool, Optional[str]]:
    try:
        pub = tc.load_public_key(pub_b64)
        pub.verify(base64.b64decode(sig_b64), msg)
        return True, None
    except Exception as e:
        return False, f"{type(e).__name__}"


async def _mint_nft(sovereign_id: str) -> dict:
    """Mint the identity NFT. real → Hedera testnet HTS; else deterministic mock."""
    mode = (os.environ.get("SOVEREIGN_NFT_MODE") or "mock").lower()
    metadata_uri = f"hedera://sovereign/{sovereign_id}"
    if mode == "real":
        try:
            from services.hedera_testnet_client import get_testnet_client
            tcl = get_testnet_client()
            if tcl.ready:
                res = await tcl.mint_nft(metadata=metadata_uri.encode())
                if res and res.get("success"):
                    return {
                        "mode": "real", "minted": True,
                        "token_id": res.get("token_id"),
                        "serial_number": res.get("serial_number"),
                        "metadata_uri": metadata_uri,
                        "transaction_id": res.get("transaction_id"),
                        "explorer_url": res.get("explorer_url"),
                        "network": "Hedera Testnet",
                    }
                logger.info("[sovereign.nft] real mint no serial — mock fallback (%s)", (res or {}).get("reason"))
        except Exception as e:
            logger.warning("[sovereign.nft] real mint failed: %s — mock fallback", e)

    seed = hashlib.sha256(f"sovereign-nft::{sovereign_id}".encode()).hexdigest()
    token_num = int(seed[:10], 16) % 9_000_000 + 1_000_000
    serial = (int(seed[10:14], 16) % 9_000) + 1
    return {
        "mode": "mock", "minted": True,
        "token_id": f"0.0.{token_num}",
        "serial_number": serial,
        "metadata_uri": metadata_uri,
        "transaction_id": "0x" + seed[:40],
        "explorer_url": None,
        "network": "Hedera (simulated)",
    }


async def _anchor(sovereign_id: str, user_id: str, digest: str, sig_b64: str) -> Optional[dict]:
    """Anchor the attestation digest on Hedera HCS (best-effort)."""
    try:
        from services.hedera_service import hedera_service
        topic_id = hedera_service.default_topic_id
        if not topic_id:
            return None
        msg = {
            "kind": SCHEMA, "sovereign_id": sovereign_id, "subject_user_id": user_id,
            "payload_digest": digest, "signature": sig_b64[:88], "ts": _now_iso(),
        }
        result = await hedera_service.submit_message(topic_id, msg)
        if not result.get("success"):
            return None
        seq = result.get("sequence_number")
        return {
            "topic_id": topic_id,
            "sequence_number": seq,
            "explorer_url": f"https://hashscan.io/mainnet/topic/{topic_id}/message/{seq}" if seq else None,
            "anchored_at": _now_iso(),
        }
    except Exception as e:
        logger.warning("[sovereign.anchor] failed: %s", e)
        return None


def _public_view(doc: dict) -> dict:
    """Card view safe to return to clients — no private key, no Mongo _id."""
    return {
        "sovereign_id": doc["sovereign_id"],
        "holder_name": doc["holder_name"],
        "trust_tier": doc["trust_tier"],
        "trust_score": doc["trust_score"],
        "identity_verified": doc["identity_verified"],
        "issued_at": doc["issued_at"],
        "public_key": doc["public_key"],
        "key_fingerprint": doc["key_fingerprint"],
        "signature": doc["signature"],
        "signature_alg": doc["signature_alg"],
        "payload_digest": doc["payload_digest"],
        "nft": doc.get("nft"),
        "anchor": doc.get("anchor"),
        "anchor_status": "anchored" if doc.get("anchor") else doc.get("anchor_status", "pending"),
        "schema": doc["schema"],
    }


async def get_my_sovereign_id(db, user_id: str) -> Optional[dict]:
    doc = await db.sovereign_ids.find_one({"subject_user_id": user_id})
    if not doc:
        return None
    view = _public_view(doc)
    view["notary"] = await _notary_block(db, user_id)
    return view


async def _notary_block(db, user_id: str) -> Optional[dict]:
    """Live notary commission/credential data (kept current rather than baked into
    the signed attestation, since commission expiry & act counts change over time)."""
    u = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "role": 1, "license_number": 1, "license_state": 1,
         "commission_expiry": 1, "license_expiration": 1, "active": 1},
    )
    if not u or u.get("role") not in ("notary", "admin"):
        return None
    try:
        seals = await db.blockchain_seals.count_documents({"sealed_by_id": user_id})
    except Exception:
        seals = 0
    try:
        ceremonies = await db.ceremonies.count_documents({"notary_id": user_id})
    except Exception:
        ceremonies = 0
    return {
        "is_notary": True,
        "notary_id": user_id,
        "license_number": u.get("license_number"),
        "license_state": u.get("license_state"),
        "commission_expiry": u.get("commission_expiry") or u.get("license_expiration"),
        "active": u.get("active", True),
        "total_seals": seals,
        "total_ceremonies": ceremonies,
        "profile_path": f"/notary/{user_id}",
    }


async def mint_sovereign_id(db, user_id: str, holder_name: str, identity_verified: bool) -> dict:
    """Idempotent: returns the existing card if already minted, else mints one."""
    existing = await db.sovereign_ids.find_one({"subject_user_id": user_id})
    if existing:
        return _public_view(existing)

    li = await db.living_identities.find_one({"user_id": user_id})
    trust_score = int((li or {}).get("current_trust_score") or (90 if identity_verified else 40))
    trust_tier = _trust_tier(trust_score)

    sovereign_id = uuid.uuid4().hex
    priv_b64, pub_b64 = tc.generate_keypair()
    issued_at = _now_iso()

    att = {
        "sovereign_id": sovereign_id, "subject_user_id": user_id,
        "holder_name": holder_name, "trust_tier": trust_tier,
        "trust_score": trust_score, "identity_verified": bool(identity_verified),
        "issued_at": issued_at,
    }
    msg = _canon_bytes(_canonical(att))
    priv = tc.load_private_key(priv_b64)
    sig_b64 = base64.b64encode(priv.sign(msg)).decode()
    digest = hashlib.sha256(msg).hexdigest()

    nft = await _mint_nft(sovereign_id)

    doc = {
        **att,
        "public_key": pub_b64,
        "private_key": crypto_vault.encrypt_str(priv_b64),  # encrypted at rest; never returned
        "key_fingerprint": key_fingerprint(pub_b64),
        "signature": sig_b64,
        "signature_alg": "Ed25519",
        "payload_digest": digest,
        "schema": SCHEMA,
        "nft": nft,
        "anchor": None,
        "anchor_status": "pending",
        "created_at": issued_at,
    }
    await db.sovereign_ids.insert_one(dict(doc))
    logger.info("[sovereign] minted %s for user %s (nft=%s)", sovereign_id, user_id, nft.get("mode"))
    return _public_view(doc)


async def anchor_sovereign_id(db, sovereign_id: str):
    """Background task: anchor the attestation digest on Hedera HCS and persist it.
    Runs out-of-band so the mint request returns instantly (avoids proxy timeouts)."""
    doc = await db.sovereign_ids.find_one({"sovereign_id": sovereign_id})
    if not doc or doc.get("anchor"):
        return
    anchor = await _anchor(sovereign_id, doc["subject_user_id"], doc["payload_digest"], doc["signature"])
    await db.sovereign_ids.update_one(
        {"sovereign_id": sovereign_id},
        {"$set": {"anchor": anchor, "anchor_status": "anchored" if anchor else "unavailable"}},
    )


async def get_seal_settings(db, user_id: str) -> dict:
    """Whether the notary's Sovereign Seal is stamped on notarized PDFs.
    Default ON for Pro/Enterprise (opt-out); unavailable on Free."""
    from routes.subscription_routes import get_user_plan
    plan = await get_user_plan(user_id)
    is_pro = plan in ("pro", "enterprise")
    doc = await db.sovereign_ids.find_one({"subject_user_id": user_id}, {"_id": 0, "seal_enabled": 1})
    enabled_pref = doc.get("seal_enabled", True) if doc else True  # opt-out default
    return {
        "plan": plan,
        "is_pro": is_pro,
        "minted": doc is not None,
        "seal_enabled": bool(enabled_pref) and is_pro,
        "seal_preference": bool(enabled_pref),
    }


async def set_seal_enabled(db, user_id: str, enabled: bool) -> dict:
    await db.sovereign_ids.update_one(
        {"subject_user_id": user_id}, {"$set": {"seal_enabled": bool(enabled)}}
    )
    return await get_seal_settings(db, user_id)


async def resolve_seal_for_ceremony(db, ceremony: dict) -> Optional[dict]:
    """Return the conducting notary's Sovereign Seal payload for stamping on a
    certificate, honoring the per-ceremony override + the notary's Pro/opt-out
    settings. Returns None when no seal should be stamped."""
    if ceremony.get("sovereign_seal_disabled"):
        return None  # per-document opt-out
    notary_uid = ceremony.get("notary_user_id")
    if not notary_uid:
        email = ceremony.get("notary_email") or ceremony.get("initiated_by")
        if email:
            u = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "role": 1})
            if u and u.get("role") in ("notary", "admin"):
                notary_uid = u["id"]
    if not notary_uid:
        return None

    settings = await get_seal_settings(db, notary_uid)
    if not settings["seal_enabled"]:
        return None
    sov = await db.sovereign_ids.find_one({"subject_user_id": notary_uid})
    if not sov:
        return None

    site = (os.environ.get("SITE_URL") or "https://notarychain.app").rstrip("/")
    nb = await _notary_block(db, notary_uid)
    nft = sov.get("nft", {})
    return {
        "holder_name": sov["holder_name"],
        "token": f"{nft.get('token_id')} #{nft.get('serial_number')}",
        "fingerprint": sov["key_fingerprint"],
        "verify_url": f"{site}/sovereign/verify/{sov['sovereign_id']}",
        "license_number": (nb or {}).get("license_number"),
        "license_state": (nb or {}).get("license_state"),
    }


async def verify_sovereign_id(db, sovereign_id: str) -> dict:
    """Public verification — recompute canonical bytes and check the Ed25519 sig."""
    doc = await db.sovereign_ids.find_one({"sovereign_id": sovereign_id})
    if not doc:
        return {"found": False, "valid": False, "reason": "not_found"}

    payload = _canonical(doc)
    msg = _canon_bytes(payload)
    computed_digest = hashlib.sha256(msg).hexdigest()
    if doc.get("payload_digest") != computed_digest:
        return {"found": True, "valid": False, "reason": "payload_digest_mismatch", "card": _public_view(doc)}

    valid, err = _verify_sig(doc["public_key"], doc["signature"], msg)
    card = _public_view(doc)
    card["notary"] = await _notary_block(db, doc["subject_user_id"])
    return {
        "found": True,
        "valid": valid,
        "reason": err,
        "verified_at": _now_iso(),
        "card": card,
    }
