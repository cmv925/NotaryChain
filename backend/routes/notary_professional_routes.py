"""
Notary Professional Features
Digital Journal, Commission Tracking, Seal Management
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import os
import logging

from models import User
from routes.auth_routes import get_current_user
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notary/professional", tags=["notary-professional"])

UPLOAD_DIR = "/tmp/notary_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# ============ NOTARY JOURNAL ============

class JournalEntryCreate(BaseModel):
    request_id: Optional[str] = None
    document_type: str
    document_name: str
    signer_name: str
    signer_address: Optional[str] = None
    identification_type: Optional[str] = None
    identification_number: Optional[str] = None
    notarization_type: str = "acknowledgment"
    fee_charged: float = 0.0
    notes: Optional[str] = None


@router.get("/journal")
async def get_journal(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    doc_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get notary journal entries with filtering"""
    query = {"notary_id": current_user.id}

    if search:
        query["$or"] = [
            {"signer_name": {"$regex": search, "$options": "i"}},
            {"document_name": {"$regex": search, "$options": "i"}},
        ]
    if doc_type:
        query["document_type"] = doc_type
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = datetime.fromisoformat(start_date)
        if end_date:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)

    total = await db.notary_journal.count_documents(query)
    skip = (page - 1) * page_size
    entries = await db.notary_journal.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)

    for e in entries:
        for key in ["created_at", "updated_at"]:
            if isinstance(e.get(key), datetime):
                e[key] = e[key].isoformat()

    return {"total": total, "page": page, "page_size": page_size, "entries": entries}


@router.post("/journal")
async def create_journal_entry(
    entry: JournalEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new journal entry"""
    now = datetime.now(timezone.utc)
    # Auto-generate sequential entry number
    count = await db.notary_journal.count_documents({"notary_id": current_user.id})

    doc = {
        "id": str(uuid.uuid4()),
        "notary_id": current_user.id,
        "entry_number": count + 1,
        "request_id": entry.request_id,
        "document_type": entry.document_type,
        "document_name": entry.document_name,
        "signer_name": entry.signer_name,
        "signer_address": entry.signer_address,
        "identification_type": entry.identification_type,
        "identification_number": entry.identification_number,
        "notarization_type": entry.notarization_type,
        "fee_charged": entry.fee_charged,
        "notes": entry.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db.notary_journal.insert_one({**doc, "_id": doc["id"]})
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@router.get("/journal/stats")
async def get_journal_stats(
    current_user: User = Depends(get_current_user)
):
    """Get journal statistics"""
    total = await db.notary_journal.count_documents({"notary_id": current_user.id})

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = await db.notary_journal.count_documents({
        "notary_id": current_user.id,
        "created_at": {"$gte": month_start}
    })

    # Total fees
    pipeline = [
        {"$match": {"notary_id": current_user.id}},
        {"$group": {"_id": None, "total_fees": {"$sum": "$fee_charged"}}}
    ]
    fee_result = await db.notary_journal.aggregate(pipeline).to_list(1)
    total_fees = fee_result[0]["total_fees"] if fee_result else 0

    # By document type
    type_pipeline = [
        {"$match": {"notary_id": current_user.id}},
        {"$group": {"_id": "$document_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_type = await db.notary_journal.aggregate(type_pipeline).to_list(20)

    return {
        "total_entries": total,
        "this_month": this_month,
        "total_fees": total_fees,
        "by_document_type": {r["_id"]: r["count"] for r in by_type},
    }


# ============ COMMISSION TRACKING ============

@router.get("/commission")
async def get_commission_info(
    current_user: User = Depends(get_current_user)
):
    """Get commission status and expiry info"""
    profile = await db.notary_profiles.find_one(
        {"user_id": current_user.id},
        {"_id": 0, "commission_expiry": 1, "license_state": 1, "license_number": 1, "status": 1, "id": 1}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="No notary profile found")

    expiry_str = profile.get("commission_expiry", "")
    days_remaining = None
    is_expired = False
    renewal_alert = False

    if expiry_str:
        try:
            expiry_date = datetime.fromisoformat(expiry_str) if "T" in expiry_str else datetime.strptime(expiry_str, "%Y-%m-%d")
            days_remaining = (expiry_date - datetime.now()).days
            is_expired = days_remaining < 0
            renewal_alert = 0 < days_remaining <= 90
        except Exception:
            pass

    return {
        "license_number": profile.get("license_number"),
        "license_state": profile.get("license_state"),
        "commission_expiry": expiry_str,
        "days_remaining": days_remaining,
        "is_expired": is_expired,
        "renewal_alert": renewal_alert,
        "status": profile.get("status"),
    }


@router.post("/commission/update-expiry")
async def update_commission_expiry(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update commission expiry date"""
    new_expiry = data.get("commission_expiry")
    if not new_expiry:
        raise HTTPException(status_code=400, detail="commission_expiry required")

    result = await db.notary_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"commission_expiry": new_expiry, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {"success": True, "commission_expiry": new_expiry}


# ============ DIGITAL SEAL MANAGEMENT ============

@router.get("/seals")
async def get_seals(
    current_user: User = Depends(get_current_user)
):
    """Get notary's digital seals"""
    seals = await db.notary_seals.find(
        {"notary_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    for s in seals:
        for key in ["created_at", "updated_at"]:
            if isinstance(s.get(key), datetime):
                s[key] = s[key].isoformat()

    return {"seals": seals}


@router.post("/seals/upload")
async def upload_seal(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a digital seal image"""
    # Validate file type
    allowed = [".png", ".jpg", ".jpeg", ".svg"]
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Use PNG, JPG, or SVG.")

    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")

    # Save file
    seal_id = str(uuid.uuid4())
    filename = f"seal_{seal_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    now = datetime.now(timezone.utc)
    seal_doc = {
        "id": seal_id,
        "notary_id": current_user.id,
        "filename": filename,
        "original_name": file.filename,
        "file_type": ext,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    await db.notary_seals.insert_one({**seal_doc, "_id": seal_id})

    # Deactivate other seals
    await db.notary_seals.update_many(
        {"notary_id": current_user.id, "id": {"$ne": seal_id}},
        {"$set": {"is_active": False}}
    )

    seal_doc["created_at"] = now.isoformat()
    seal_doc["updated_at"] = now.isoformat()
    return seal_doc


@router.post("/seals/{seal_id}/activate")
async def activate_seal(
    seal_id: str,
    current_user: User = Depends(get_current_user)
):
    """Set a seal as the active one"""
    seal = await db.notary_seals.find_one({"id": seal_id, "notary_id": current_user.id})
    if not seal:
        raise HTTPException(status_code=404, detail="Seal not found")

    # Deactivate all, activate this one
    await db.notary_seals.update_many(
        {"notary_id": current_user.id},
        {"$set": {"is_active": False}}
    )
    await db.notary_seals.update_one(
        {"id": seal_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
    )

    return {"success": True}


@router.delete("/seals/{seal_id}")
async def delete_seal(
    seal_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a digital seal"""
    seal = await db.notary_seals.find_one({"id": seal_id, "notary_id": current_user.id})
    if not seal:
        raise HTTPException(status_code=404, detail="Seal not found")

    # Delete file
    filepath = os.path.join(UPLOAD_DIR, seal.get("filename", ""))
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.notary_seals.delete_one({"id": seal_id})
    return {"success": True}
