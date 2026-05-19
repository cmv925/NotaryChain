"""
SALV Phase 2 — Encrypted document attachments + partial-release handoffs.

This module extends the existing salv_routes with:
1. POST /api/salv/assets/{asset_id}/documents       — upload + AES-GCM-256 encrypt + S3/local store
2. GET  /api/salv/assets/{asset_id}/documents       — list attachments
3. GET  /api/salv/assets/{asset_id}/documents/{doc_id}/download — owner OR released-beneficiary
4. DELETE /api/salv/assets/{asset_id}/documents/{doc_id}        — owner-only

5. POST /api/salv/beneficiaries/{benef_id}/release-partial — explicit owner-initiated
       partial release of N percent of a beneficiary's share. Releases an immutable
       receipt with Hedera anchor (best-effort).

Encryption:
- Each document gets a fresh random AES-GCM 256-bit data key (DEK).
- DEK is wrapped with the vault's master key (derived from SALV_MASTER_KEY env via HKDF).
- Wrapped DEK + nonce + auth-tag stored alongside object metadata in Mongo.
- File body uploaded ciphertext-only to S3 / local disk (never the cleartext).
"""
import os
import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/salv", tags=["salv-phase2"])
db = None

# Max upload size: 25 MB
MAX_BYTES = 25 * 1024 * 1024
ALLOWED_MIME_PREFIXES = ("application/pdf", "image/", "application/msword",
                        "application/vnd.openxmlformats", "text/",
                        "application/octet-stream")


def set_db(database):
    global db
    db = database


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Encryption helpers (AES-GCM-256 with HKDF-derived per-asset key wrap)
# ─────────────────────────────────────────────────────────────────────────────

def _master_key() -> bytes:
    """Derive the SALV master key. Uses SALV_MASTER_KEY env if set, else falls
    back to a deterministic dev key (logged warning). In production, this MUST
    be backed by a KMS / HSM."""
    env_key = os.environ.get("SALV_MASTER_KEY")
    if env_key:
        # Treat env key as a UTF-8 secret; hash to 32 bytes
        return hashlib.sha256(env_key.encode()).digest()
    logger.warning("SALV_MASTER_KEY not set — using DEV fallback key. DO NOT USE IN PRODUCTION.")
    return hashlib.sha256(b"salv-dev-master-key-do-not-use-in-prod").digest()


def _derive_wrap_key(asset_id: str) -> bytes:
    """Per-asset key wrapping key, HKDF-SHA256 from master key + asset_id salt."""
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=asset_id.encode("utf-8"),
        info=b"salv-doc-key-wrap-v1",
    ).derive(_master_key())


def _encrypt(plaintext: bytes, asset_id: str) -> dict:
    """Encrypt with a fresh DEK, then wrap the DEK with the per-asset wrap key.
    Returns dict with all metadata needed for later decryption."""
    dek = AESGCM.generate_key(bit_length=256)
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(dek).encrypt(nonce, plaintext, associated_data=asset_id.encode())

    wrap_key = _derive_wrap_key(asset_id)
    wrap_nonce = secrets.token_bytes(12)
    wrapped_dek = AESGCM(wrap_key).encrypt(wrap_nonce, dek, associated_data=b"dek-wrap-v1")

    return {
        "ciphertext": ciphertext,
        "nonce_b64": _b64(nonce),
        "wrapped_dek_b64": _b64(wrapped_dek),
        "wrap_nonce_b64": _b64(wrap_nonce),
        "encryption_alg": "AES-GCM-256+HKDF-SHA256-wrap",
        "encryption_version": 1,
    }


def _decrypt(ciphertext: bytes, meta: dict, asset_id: str) -> bytes:
    """Recover plaintext given the meta blob produced by _encrypt."""
    wrap_key = _derive_wrap_key(asset_id)
    wrapped_dek = _b64d(meta["wrapped_dek_b64"])
    wrap_nonce = _b64d(meta["wrap_nonce_b64"])
    dek = AESGCM(wrap_key).decrypt(wrap_nonce, wrapped_dek, associated_data=b"dek-wrap-v1")
    nonce = _b64d(meta["nonce_b64"])
    return AESGCM(dek).decrypt(nonce, ciphertext, associated_data=asset_id.encode())


def _b64(b: bytes) -> str:
    import base64
    return base64.b64encode(b).decode()


def _b64d(s: str) -> bytes:
    import base64
    return base64.b64decode(s)


# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_user(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _get_asset_for_owner(asset_id: str, user_id: str) -> dict:
    asset = await db.salv_assets.find_one({"asset_id": asset_id, "owner_id": user_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found or you're not the owner")
    return asset


# ─────────────────────────────────────────────────────────────────────────────
# Document attachments
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/assets/{asset_id}/documents")
async def upload_asset_document(
    asset_id: str,
    request: Request,
    file: UploadFile = File(...),
    label: Optional[str] = Form(None),
):
    """Owner uploads an encrypted document attachment to a vault asset.
    Body is AES-GCM-256 encrypted before storage; ciphertext-only on disk/S3."""
    user = await _get_user(request)
    await _get_asset_for_owner(asset_id, user["id"])

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_BYTES // 1024 // 1024} MB limit")
    if file.content_type and not file.content_type.startswith(ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail=f"Unsupported content_type: {file.content_type}")

    plaintext_sha256 = hashlib.sha256(content).hexdigest()
    enc = _encrypt(content, asset_id)

    # Upload ciphertext (not plaintext) to storage layer
    upload_meta = await storage_service.upload(
        enc["ciphertext"],
        filename=f"{uuid.uuid4().hex}.enc",
        folder=f"salv/{user['id']}/{asset_id}",
    )

    doc = {
        "doc_id": uuid.uuid4().hex[:16],
        "asset_id": asset_id,
        "owner_id": user["id"],
        "original_filename": file.filename or "document",
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": len(content),
        "plaintext_sha256": plaintext_sha256,
        "label": (label or "").strip()[:120] or None,
        "storage_path": upload_meta["path"],
        "storage_backend": upload_meta["storage_backend"],
        "encryption": {
            "nonce_b64": enc["nonce_b64"],
            "wrapped_dek_b64": enc["wrapped_dek_b64"],
            "wrap_nonce_b64": enc["wrap_nonce_b64"],
            "alg": enc["encryption_alg"],
            "version": enc["encryption_version"],
        },
        "uploaded_at": _iso(_now()),
    }
    await db.salv_documents.insert_one(doc)
    # Bump asset's documents counter
    await db.salv_assets.update_one(
        {"asset_id": asset_id},
        {"$inc": {"document_count": 1}, "$set": {"last_document_uploaded_at": _iso(_now())}}
    )
    doc.pop("_id", None)
    return _public_doc(doc)


@router.get("/assets/{asset_id}/documents")
async def list_asset_documents(asset_id: str, request: Request):
    """List attachments. Owner OR a beneficiary who has had ANY share released."""
    user = await _get_user(request)
    allowed = await _user_allowed_for_asset(user, asset_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized for this asset")
    docs = await db.salv_documents.find({"asset_id": asset_id}, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return {"asset_id": asset_id, "documents": [_public_doc(d) for d in docs]}


@router.get("/assets/{asset_id}/documents/{doc_id}/download")
async def download_asset_document(asset_id: str, doc_id: str, request: Request):
    """Download + decrypt. Authorized: owner OR beneficiary with released share."""
    user = await _get_user(request)
    allowed = await _user_allowed_for_asset(user, asset_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized for this asset")

    doc = await db.salv_documents.find_one({"doc_id": doc_id, "asset_id": asset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = await storage_service.get_file_path(doc["storage_path"], doc.get("storage_backend", "local"))
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Storage object missing")

    with open(filepath, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = _decrypt(ciphertext, doc["encryption"], asset_id)
    except Exception as e:
        logger.error(f"decrypt failed doc={doc_id}: {e}")
        raise HTTPException(status_code=500, detail="Decryption failed (file tampered or wrong key)")

    # Log access for audit trail
    await db.salv_document_access_log.insert_one({
        "doc_id": doc_id,
        "asset_id": asset_id,
        "accessed_by_user_id": user["id"],
        "accessed_by_email": user["email"],
        "is_owner": allowed["role"] == "owner",
        "at": _iso(_now()),
    })

    import io
    return StreamingResponse(
        io.BytesIO(plaintext),
        media_type=doc["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{doc["original_filename"]}"',
            "X-NotaryChain-Sha256": doc["plaintext_sha256"],
        },
    )


@router.delete("/assets/{asset_id}/documents/{doc_id}")
async def delete_asset_document(asset_id: str, doc_id: str, request: Request):
    user = await _get_user(request)
    await _get_asset_for_owner(asset_id, user["id"])
    doc = await db.salv_documents.find_one({"doc_id": doc_id, "asset_id": asset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        await storage_service.delete(doc["storage_path"], doc.get("storage_backend", "local"))
    except Exception as e:
        logger.warning(f"storage delete failed: {e}")
    await db.salv_documents.delete_one({"doc_id": doc_id})
    await db.salv_assets.update_one({"asset_id": asset_id}, {"$inc": {"document_count": -1}})
    return {"deleted": True, "doc_id": doc_id}


def _public_doc(d: dict) -> dict:
    """Strip encryption private fields for API responses."""
    return {
        "doc_id": d["doc_id"],
        "asset_id": d["asset_id"],
        "original_filename": d["original_filename"],
        "content_type": d["content_type"],
        "size_bytes": d["size_bytes"],
        "plaintext_sha256": d["plaintext_sha256"],
        "label": d.get("label"),
        "uploaded_at": d["uploaded_at"],
        "encryption_alg": d.get("encryption", {}).get("alg"),
    }


async def _user_allowed_for_asset(user, asset_id: str) -> Optional[dict]:
    """Returns {'role': 'owner'|'beneficiary'} or None.
    Beneficiary is allowed only when ANY portion of their share has been released."""
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0, "owner_id": 1})
    if not asset:
        return None
    if asset.get("owner_id") == user["id"]:
        return {"role": "owner"}
    benef = await db.salv_beneficiaries.find_one(
        {"asset_id": asset_id, "email": (user.get("email") or "").lower(), "released_percent": {"$gt": 0}},
        {"_id": 0}
    )
    if benef:
        return {"role": "beneficiary", "beneficiary_id": benef["beneficiary_id"]}
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Partial release handoffs
# ─────────────────────────────────────────────────────────────────────────────

class PartialReleaseBody(BaseModel):
    percent: float = Field(gt=0, le=100, description="Percent of the beneficiary's share to release NOW")
    note: Optional[str] = None


@router.post("/beneficiaries/{benef_id}/release-partial")
async def release_partial(benef_id: str, body: PartialReleaseBody, request: Request):
    """Owner-initiated immediate release of N percent of a beneficiary's share.
    
    Idempotent in spirit: each call adds to released_percent (capped at share_percent).
    Emits a Hedera HCS anchor for the release receipt (best-effort).
    Triggers a new handoff token + beneficiary email so they can claim NOW.
    """
    user = await _get_user(request)
    benef = await db.salv_beneficiaries.find_one({"beneficiary_id": benef_id}, {"_id": 0})
    if not benef:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    asset = await _get_asset_for_owner(benef["asset_id"], user["id"])

    share = float(benef.get("share_percent", 0))
    already = float(benef.get("released_percent", 0))
    if already >= share:
        raise HTTPException(status_code=400, detail="Full share already released to this beneficiary")
    new_total = min(share, already + body.percent)
    delta = new_total - already

    release_id = uuid.uuid4().hex[:16]
    release_receipt = {
        "release_id": release_id,
        "beneficiary_id": benef_id,
        "asset_id": asset["asset_id"],
        "owner_id": user["id"],
        "percent_released_now": delta,
        "cumulative_released_percent": new_total,
        "remaining_percent": share - new_total,
        "note": body.note,
        "released_at": _iso(_now()),
    }

    # Hedera anchor (best-effort)
    try:
        from services.hedera_service import hedera_service
        anchor_payload = {
            "kind": "salv_partial_release_v1",
            "release_id": release_id,
            "beneficiary_id": benef_id,
            "asset_id": asset["asset_id"],
            "percent_released_now": delta,
            "cumulative_released_percent": new_total,
            "ts": release_receipt["released_at"],
        }
        topic_id = hedera_service.default_topic_id
        anchor_res = await hedera_service.submit_message(topic_id, anchor_payload)
        if anchor_res.get("success"):
            seq = anchor_res.get("sequence_number")
            release_receipt["hcs_anchor"] = {
                "topic_id": topic_id,
                "sequence_number": seq,
                "tx_id": f"{topic_id}@{seq}" if seq else topic_id,
                "explorer_url": f"https://hashscan.io/mainnet/topic/{topic_id}/message/{seq}" if seq else None,
            }
    except Exception as e:
        logger.warning(f"partial release hedera anchor failed: {e}")

    await db.salv_beneficiaries.update_one(
        {"beneficiary_id": benef_id},
        {
            "$set": {"released_percent": new_total, "last_release_at": release_receipt["released_at"]},
            "$push": {"release_history": release_receipt},
        }
    )
    # Issue handoff token so they can act on the released portion
    try:
        from services import salv_service
        raw_token = await salv_service.issue_handoff_token(benef_id)
        release_receipt["handoff_token"] = raw_token
        # Email is sent inside issue_handoff_token via salv_service; if not, log here
    except Exception as e:
        logger.warning(f"issue_handoff_token failed during partial release: {e}")

    return release_receipt


@router.get("/beneficiaries/{benef_id}/release-history")
async def beneficiary_release_history(benef_id: str, request: Request):
    """Owner views the release history (audit trail) for a beneficiary."""
    user = await _get_user(request)
    benef = await db.salv_beneficiaries.find_one({"beneficiary_id": benef_id}, {"_id": 0})
    if not benef:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    asset = await db.salv_assets.find_one({"asset_id": benef["asset_id"], "owner_id": user["id"]}, {"_id": 0, "asset_id": 1})
    if not asset:
        raise HTTPException(status_code=403, detail="Not your asset")
    return {
        "beneficiary_id": benef_id,
        "share_percent": benef.get("share_percent", 0),
        "released_percent": benef.get("released_percent", 0),
        "remaining_percent": float(benef.get("share_percent", 0)) - float(benef.get("released_percent", 0)),
        "release_history": benef.get("release_history", []),
    }
