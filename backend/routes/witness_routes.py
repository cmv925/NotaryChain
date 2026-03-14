"""
Video Witness Recording Routes
Asynchronous identity verification via recorded video evidence.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from services.notification_service import create_notification
from services.storage_service import storage_service
from datetime import datetime, timezone
import os
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video-witness", tags=["video-witness"])

db: AsyncIOMotorDatabase = None

MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB


def set_db(database):
    global db
    db = database


VERIFICATION_INSTRUCTIONS = [
    {
        "id": "standard",
        "title": "Standard Identity Verification",
        "steps": [
            "Hold your government-issued photo ID next to your face",
            "Slowly turn the ID so both front and back are visible",
            "State your full legal name clearly",
            "State today's date",
            "State the purpose of your notarization",
        ],
        "duration_seconds": 30,
    },
    {
        "id": "enhanced",
        "title": "Enhanced Identity Verification",
        "steps": [
            "Hold your primary government-issued photo ID next to your face",
            "Slowly turn the ID to show both sides",
            "Hold a secondary form of ID (utility bill, bank statement, etc.)",
            "State your full legal name and date of birth",
            "State your current address",
            "State today's date and the document you are notarizing",
        ],
        "duration_seconds": 60,
    },
]


@router.get("/instructions")
async def get_instructions():
    """Get available verification instruction sets."""
    return {"instructions": VERIFICATION_INSTRUCTIONS}


@router.post("/upload")
async def upload_witness_video(
    file: UploadFile = File(...),
    request_id: str = Form(...),
    instruction_type: str = Form("standard"),
    current_user: User = Depends(get_current_user),
):
    """Upload a witness recording for identity verification."""
    # Validate file type
    allowed_ext = ['.mp4', '.webm', '.mov', '.avi']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported video format. Use: {', '.join(allowed_ext)}")

    # Validate request exists
    req = await db.notarization_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Read and upload video via storage service
    video_id = str(uuid.uuid4())
    filename = f"witness_{video_id}{file_ext}"

    content = await file.read()
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=413, detail="Video too large (max 100MB)")

    storage_meta = await storage_service.upload(content, filename, folder="witness_videos")

    record = {
        "id": video_id,
        "user_id": current_user.id,
        "request_id": request_id,
        "instruction_type": instruction_type,
        "file_name": filename,
        "stored_path": storage_meta["path"],
        "storage_backend": storage_meta["storage_backend"],
        "file_size": len(content),
        "file_ext": file_ext,
        "status": "uploaded",
        "reviewed_by": None,
        "review_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.witness_recordings.insert_one(record)
    record.pop("_id", None)
    record.pop("stored_path", None)  # Don't expose storage path

    # Notify assigned notary
    notary_id = req.get("notary_id")
    if notary_id:
        try:
            await create_notification(
                user_id=notary_id,
                title="Witness Video Submitted",
                message=f'A witness recording for "{req.get("document_name", "")}" has been uploaded for review.',
                notif_type="info",
                link="/notary/dashboard",
                metadata={"video_id": video_id, "request_id": request_id},
            )
        except Exception:
            pass

    return {"video_id": video_id, "status": "uploaded", "message": "Witness video uploaded for review"}


@router.get("/my")
async def get_my_recordings(
    current_user: User = Depends(get_current_user),
):
    """Get user's witness recordings."""
    recs = await db.witness_recordings.find(
        {"user_id": current_user.id},
        {"_id": 0, "file_path": 0},
    ).sort("created_at", -1).to_list(20)
    return {"recordings": recs}


@router.get("/request/{request_id}")
async def get_request_recordings(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get witness recordings for a specific request (notary or owner)."""
    req = await db.notarization_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("user_id") != current_user.id and req.get("notary_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    recs = await db.witness_recordings.find(
        {"request_id": request_id},
        {"_id": 0, "file_path": 0},
    ).sort("created_at", -1).to_list(10)
    return {"recordings": recs}


@router.get("/review/pending")
async def get_pending_reviews(
    current_user: User = Depends(get_current_user),
):
    """Get witness recordings pending notary review."""
    # Find requests assigned to this notary
    requests = await db.notarization_requests.find(
        {"notary_id": current_user.id}, {"_id": 0, "id": 1}
    ).to_list(100)
    req_ids = [r["id"] for r in requests]

    recs = await db.witness_recordings.find(
        {"request_id": {"$in": req_ids}, "status": "uploaded"},
        {"_id": 0, "file_path": 0},
    ).sort("created_at", -1).to_list(20)

    # Enrich with request info
    for r in recs:
        req = await db.notarization_requests.find_one(
            {"id": r["request_id"]}, {"_id": 0, "document_name": 1, "document_type": 1}
        )
        if req:
            r["document_name"] = req.get("document_name")
            r["document_type"] = req.get("document_type")

    return {"recordings": recs}


@router.put("/review/{video_id}")
async def review_recording(
    video_id: str,
    action: str,
    notes: str = "",
    current_user: User = Depends(get_current_user),
):
    """Notary reviews a witness recording (approve/reject)."""
    rec = await db.witness_recordings.find_one({"id": video_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Verify notary is assigned
    req = await db.notarization_requests.find_one({"id": rec["request_id"]})
    if not req or req.get("notary_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this request")

    if action not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    await db.witness_recordings.update_one(
        {"id": video_id},
        {"$set": {
            "status": action,
            "reviewed_by": current_user.id,
            "review_notes": notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Notify the user
    try:
        status_text = "approved" if action == "approved" else "rejected and needs to be re-recorded"
        await create_notification(
            user_id=rec["user_id"],
            title=f"Witness Recording {'Approved' if action == 'approved' else 'Rejected'}",
            message=f'Your witness recording has been {status_text}.',
            notif_type="info" if action == "approved" else "warning",
            link="/dashboard",
            metadata={"video_id": video_id},
        )
    except Exception:
        pass

    return {"message": f"Recording {action}", "video_id": video_id}
