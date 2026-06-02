"""
Ceremony Video Vault — chunked multipart upload of RON recordings to S3 with a
SHA-256 integrity hash anchored on Hedera HCS (tamper-evident notary journal).

Heavy bytes live in S3 (AWS does the heavy lifting); only the 32-byte hash is
anchored on-chain. Blocking boto3 calls run via asyncio.to_thread so the event
loop stays responsive even while streaming multi-GB recordings.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import asyncio
import logging

from models import User
from routes.auth_routes import get_current_user
from services.storage_service import storage_service
from services.hedera_service import hedera_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ceremony-videos", tags=["ceremony-video-vault"])

db: AsyncIOMotorDatabase = None

RETENTION_YEARS = 10  # FL default WORM retention


def set_db(database):
    global db
    db = database


class InitRequest(BaseModel):
    file_name: str
    content_type: str = "video/mp4"
    total_size: Optional[int] = None
    total_parts: Optional[int] = None
    duration_sec: Optional[float] = None
    client_sha256: Optional[str] = None
    notary_request_id: Optional[str] = None


class CompleteRequest(BaseModel):
    parts: Optional[List[dict]] = None  # [{part_number, etag}] — falls back to stored parts


def _require_s3():
    if not storage_service.s3_ready:
        raise HTTPException(status_code=503, detail="Cloud storage (S3) is not configured in this environment")


async def _linked_request(notary_request_id: str):
    if not notary_request_id:
        return None
    return (await db.notarization_requests.find_one({"id": notary_request_id})
            or await db.notary_requests.find_one({"id": notary_request_id}))


def _can_access(video: dict, user: User, linked: Optional[dict]) -> bool:
    if video.get("uploaded_by") == user.id:
        return True
    if getattr(user, "role", "user") == "admin":
        return True
    if linked and user.id in (linked.get("notary_id"), linked.get("user_id")):
        return True
    return False


def _public_view(v: dict) -> dict:
    return {
        "content_hash": v.get("sha256"),
        "file_name": v.get("file_name"),
        "duration_sec": v.get("duration_sec"),
        "byte_size": v.get("byte_size"),
        "transaction_id": v.get("transaction_id"),
        "topic_id": v.get("topic_id"),
        "sequence_number": v.get("sequence_number"),
        "hcs_submitted": v.get("hcs_submitted", False),
        "verification_hash": v.get("verification_hash"),
        "explorer_url": v.get("explorer_url"),
        "network": v.get("network"),
        "anchored_at": v.get("anchored_at"),
        "retention_until": v.get("retention_until"),
        "lock_applied": v.get("lock_applied", False),
    }


# ─── Finalize (background): authoritative re-hash → Hedera anchor → WORM lock ───

async def _finalize_video(video_id: str):
    try:
        v = await db.ceremony_videos.find_one({"id": video_id})
        if not v:
            return
        key = v["s3_key"]

        # 1) Authoritative server-side hash (stream from S3 — never trust the client)
        sha256 = await asyncio.to_thread(storage_service.compute_sha256, key)
        byte_size = await asyncio.to_thread(storage_service.head_size, key)
        hash_match = (v.get("client_sha256") or "").lower() == sha256.lower() if v.get("client_sha256") else None

        await db.ceremony_videos.update_one(
            {"id": video_id},
            {"$set": {"sha256": sha256, "byte_size": byte_size, "client_hash_match": hash_match, "status": "anchoring"}},
        )

        # 2) Anchor the hash on Hedera HCS
        seal = await hedera_service.seal_document(
            document_hash=sha256,
            document_name=v.get("file_name", "ceremony_recording"),
            user_id=v.get("uploaded_by"),
            metadata={
                "type": "CEREMONY_RECORDING",
                "notary_request_id": v.get("notary_request_id"),
                "duration_sec": v.get("duration_sec"),
                "byte_size": byte_size,
            },
        )

        # 3) Apply WORM retention (graceful if bucket lacks Object Lock)
        retain_until = datetime.now(timezone.utc) + timedelta(days=365 * RETENTION_YEARS)
        lock_applied = await asyncio.to_thread(storage_service.apply_object_lock, key, retain_until)

        await db.ceremony_videos.update_one(
            {"id": video_id},
            {"$set": {
                "status": "anchored" if seal.get("success") else "anchor_failed",
                "transaction_id": seal.get("transaction_id"),
                "topic_id": seal.get("topic_id"),
                "sequence_number": seal.get("sequence_number"),
                "hcs_submitted": seal.get("hcs_submitted", False),
                "verification_hash": seal.get("verification_hash"),
                "explorer_url": seal.get("explorer_url"),
                "network": seal.get("network"),
                "anchored_at": datetime.now(timezone.utc).isoformat(),
                "retention_until": retain_until.isoformat(),
                "lock_applied": lock_applied,
            }},
        )
        logger.info(f"Ceremony video {video_id} anchored: {seal.get('transaction_id')}")
    except Exception as e:
        logger.error(f"Finalize failed for ceremony video {video_id}: {e}")
        await db.ceremony_videos.update_one({"id": video_id}, {"$set": {"status": "failed", "error": str(e)}})


# ─── Endpoints ───

@router.post("/init")
async def init_upload(body: InitRequest, current_user: User = Depends(get_current_user)):
    _require_s3()
    linked = await _linked_request(body.notary_request_id)
    if body.notary_request_id and not linked:
        raise HTTPException(status_code=404, detail="Linked notarization request not found")

    ext = os.path.splitext(body.file_name)[1].lower() or ".mp4"
    folder = body.notary_request_id or "unlinked"
    key = f"ceremony-videos/{folder}/{uuid.uuid4().hex}{ext}"

    try:
        upload_id = await asyncio.to_thread(storage_service.create_multipart_upload, key, body.content_type)
    except Exception as e:
        logger.error(f"create_multipart_upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate upload")

    video_id = str(uuid.uuid4())
    await db.ceremony_videos.insert_one({
        "id": video_id,
        "s3_key": key,
        "upload_id": upload_id,
        "status": "uploading",
        "parts": [],
        "file_name": body.file_name,
        "content_type": body.content_type,
        "total_size": body.total_size,
        "total_parts": body.total_parts,
        "duration_sec": body.duration_sec,
        "client_sha256": body.client_sha256,
        "notary_request_id": body.notary_request_id,
        "uploaded_by": current_user.id,
        "uploaded_by_email": current_user.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"video_id": video_id, "upload_id": upload_id, "s3_key": key}


@router.post("/{video_id}/part")
async def upload_part(
    video_id: str,
    part_number: int = Query(..., ge=1, le=10000),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_s3()
    v = await db.ceremony_videos.find_one({"id": video_id})
    if not v:
        raise HTTPException(status_code=404, detail="Upload not found")
    if v["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload")
    if v["status"] != "uploading":
        raise HTTPException(status_code=400, detail="Upload is not in progress")

    try:
        etag = await asyncio.to_thread(
            storage_service.upload_part, v["s3_key"], v["upload_id"], part_number, file.file
        )
    except Exception as e:
        logger.error(f"upload_part failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload part")

    # Replace any existing part with the same number, then record the new one.
    await db.ceremony_videos.update_one({"id": video_id}, {"$pull": {"parts": {"part_number": part_number}}})
    await db.ceremony_videos.update_one(
        {"id": video_id}, {"$push": {"parts": {"part_number": part_number, "etag": etag}}}
    )
    return {"part_number": part_number, "etag": etag}


@router.post("/{video_id}/complete")
async def complete_upload(video_id: str, body: CompleteRequest = CompleteRequest(), current_user: User = Depends(get_current_user)):
    _require_s3()
    v = await db.ceremony_videos.find_one({"id": video_id})
    if not v:
        raise HTTPException(status_code=404, detail="Upload not found")
    if v["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload")
    if v["status"] != "uploading":
        raise HTTPException(status_code=400, detail="Upload is not in progress")

    parts = body.parts or v.get("parts", [])
    if not parts:
        raise HTTPException(status_code=400, detail="No parts uploaded")

    try:
        await asyncio.to_thread(storage_service.complete_multipart_upload, v["s3_key"], v["upload_id"], parts)
    except Exception as e:
        logger.error(f"complete_multipart_upload failed: {e}")
        await asyncio.to_thread(storage_service.abort_multipart_upload, v["s3_key"], v["upload_id"])
        await db.ceremony_videos.update_one({"id": video_id}, {"$set": {"status": "failed", "error": "complete failed"}})
        raise HTTPException(status_code=500, detail="Failed to complete upload")

    await db.ceremony_videos.update_one({"id": video_id}, {"$set": {"status": "assembling"}})
    # Detached finalize: hash from S3 → Hedera anchor → WORM lock (keeps request fast).
    asyncio.create_task(_finalize_video(video_id))
    return {"video_id": video_id, "status": "assembling"}


@router.post("/{video_id}/abort")
async def abort_upload(video_id: str, current_user: User = Depends(get_current_user)):
    v = await db.ceremony_videos.find_one({"id": video_id})
    if not v:
        raise HTTPException(status_code=404, detail="Upload not found")
    if v["uploaded_by"] != current_user.id and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if storage_service.s3_ready and v.get("upload_id"):
        await asyncio.to_thread(storage_service.abort_multipart_upload, v["s3_key"], v["upload_id"])
    await db.ceremony_videos.update_one({"id": video_id}, {"$set": {"status": "aborted"}})
    return {"status": "aborted"}


@router.get("/mine")
async def my_videos(current_user: User = Depends(get_current_user)):
    docs = await db.ceremony_videos.find(
        {"uploaded_by": current_user.id}, {"_id": 0, "upload_id": 0, "parts": 0}
    ).sort("created_at", -1).to_list(200)
    return {"count": len(docs), "videos": docs}


@router.get("/verify/{content_hash}")
async def verify_recording(content_hash: str):
    """PUBLIC: verify a recording's integrity by SHA-256 hash. No auth, no video bytes."""
    content_hash = (content_hash or "").strip().lower()
    if len(content_hash) != 64 or not all(c in "0123456789abcdef" for c in content_hash):
        return {"verified": False, "reason": "invalid_hash_format"}
    v = await db.ceremony_videos.find_one({"sha256": content_hash, "status": "anchored"}, {"_id": 0})
    if not v:
        return {"verified": False}
    return {"verified": True, "recording": _public_view(v)}


@router.get("/{video_id}")
async def get_video(video_id: str, current_user: User = Depends(get_current_user)):
    v = await db.ceremony_videos.find_one({"id": video_id}, {"_id": 0, "upload_id": 0, "parts": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Recording not found")
    linked = await _linked_request(v.get("notary_request_id"))
    if not _can_access(v, current_user, linked):
        raise HTTPException(status_code=403, detail="Not authorized to view this recording")
    return v


@router.get("/{video_id}/playback")
async def playback_url(video_id: str, current_user: User = Depends(get_current_user)):
    _require_s3()
    v = await db.ceremony_videos.find_one({"id": video_id})
    if not v:
        raise HTTPException(status_code=404, detail="Recording not found")
    linked = await _linked_request(v.get("notary_request_id"))
    if not _can_access(v, current_user, linked):
        raise HTTPException(status_code=403, detail="Not authorized")
    if v["status"] not in ("anchored", "anchoring", "assembling", "anchor_failed"):
        raise HTTPException(status_code=400, detail="Recording is not ready for playback")
    url = storage_service.get_presigned_url(v["s3_key"], expires_in=900)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate playback URL")
    return {"url": url, "expires_in": 900}


@router.post("/{video_id}/verify")
async def tamper_check(video_id: str, current_user: User = Depends(get_current_user)):
    """Re-hash the stored object from S3 and compare to the anchored hash (tamper check)."""
    _require_s3()
    v = await db.ceremony_videos.find_one({"id": video_id})
    if not v:
        raise HTTPException(status_code=404, detail="Recording not found")
    linked = await _linked_request(v.get("notary_request_id"))
    if not _can_access(v, current_user, linked):
        raise HTTPException(status_code=403, detail="Not authorized")
    if v.get("status") != "anchored":
        raise HTTPException(status_code=400, detail="Recording is not anchored yet")

    current_hash = await asyncio.to_thread(storage_service.compute_sha256, v["s3_key"])
    intact = current_hash.lower() == (v.get("sha256") or "").lower()
    return {
        "intact": intact,
        "anchored_hash": v.get("sha256"),
        "current_hash": current_hash,
        "transaction_id": v.get("transaction_id"),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
