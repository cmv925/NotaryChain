"""
GDPR & Compliance Routes
Data export, account deletion, and privacy management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import json
import logging

from models import User
from routes.auth_routes import get_current_user
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gdpr", tags=["gdpr-compliance"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# ============ DATA EXPORT ============

@router.post("/export")
async def request_data_export(
    current_user: User = Depends(get_current_user)
):
    """Export all user data (GDPR Article 20 - Data Portability)"""
    user_id = current_user.id
    email = current_user.email

    # Collect all user data across collections
    user_doc = await db.users.find_one({"email": email}, {
        "_id": 0, "hashed_password": 0, "two_factor_secret": 0,
        "two_factor_secret_pending": 0, "two_factor_backup_codes": 0,
        "two_factor_backup_codes_pending": 0,
    })

    notarization_requests = await db.notarization_requests.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(1000)

    document_seals = await db.document_seals.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(1000)

    notifications = await db.notifications.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(500)

    subscriptions = await db.subscriptions.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(50)

    transactions = await db.transactions.find(
        {"ownerId": user_id}, {"_id": 0}
    ).to_list(500)

    notary_profile = await db.notary_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )

    journal_entries = await db.notary_journal.find(
        {"notary_id": user_id}, {"_id": 0}
    ).to_list(1000)

    audit_logs = await db.audit_logs.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(500)

    # Serialize datetimes
    def serialize(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, dict):
            return {k: serialize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize(v) for v in obj]
        return obj

    export_data = serialize({
        "export_info": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "user_email": email,
            "format": "JSON",
            "gdpr_article": "Article 20 - Right to Data Portability",
        },
        "profile": user_doc,
        "notary_profile": notary_profile,
        "notarization_requests": notarization_requests,
        "document_seals": document_seals,
        "notifications": notifications,
        "subscriptions": subscriptions,
        "transactions": transactions,
        "journal_entries": journal_entries,
        "audit_activity": audit_logs,
    })

    # Send notification
    await create_notification(
        user_id=user_id,
        title="Data Export Ready",
        message="Your data export has been generated and is ready for download.",
        notif_type="success",
    )

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=notarychain_export_{email}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
            "Content-Type": "application/json",
        }
    )


# ============ ACCOUNT DELETION ============

class DeletionRequest(BaseModel):
    reason: Optional[str] = None
    password: str


@router.post("/deletion-request")
async def request_account_deletion(
    request: DeletionRequest,
    current_user: User = Depends(get_current_user)
):
    """Request account deletion (GDPR Article 17 - Right to Erasure)
    Sets a 30-day grace period before permanent deletion."""
    from auth import verify_password

    # Verify password
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or not verify_password(request.password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid password")

    # Check for existing request
    existing = await db.deletion_requests.find_one({
        "user_id": current_user.id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Deletion request already pending")

    now = datetime.now(timezone.utc)
    scheduled_deletion = now + timedelta(days=30)

    deletion_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "user_email": current_user.email,
        "reason": request.reason,
        "status": "pending",
        "requested_at": now,
        "scheduled_deletion_at": scheduled_deletion,
        "cancelled_at": None,
    }

    await db.deletion_requests.insert_one({**deletion_doc, "_id": deletion_doc["id"]})

    # Mark user as pending deletion
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"deletion_requested": True, "deletion_scheduled_at": scheduled_deletion}}
    )

    await create_notification(
        user_id=current_user.id,
        title="Account Deletion Scheduled",
        message=f"Your account is scheduled for deletion on {scheduled_deletion.strftime('%B %d, %Y')}. You can cancel this request within 30 days.",
        notif_type="warning",
    )

    return {
        "message": "Account deletion scheduled",
        "scheduled_deletion_at": scheduled_deletion.isoformat(),
        "grace_period_days": 30,
        "can_cancel_until": scheduled_deletion.isoformat(),
    }


@router.post("/deletion-request/cancel")
async def cancel_deletion_request(
    current_user: User = Depends(get_current_user)
):
    """Cancel a pending deletion request"""
    result = await db.deletion_requests.update_one(
        {"user_id": current_user.id, "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No pending deletion request found")

    await db.users.update_one(
        {"id": current_user.id},
        {"$unset": {"deletion_requested": "", "deletion_scheduled_at": ""}}
    )

    await create_notification(
        user_id=current_user.id,
        title="Deletion Cancelled",
        message="Your account deletion request has been cancelled. Your data is safe.",
        notif_type="success",
    )

    return {"message": "Deletion request cancelled"}


@router.get("/deletion-request/status")
async def get_deletion_status(
    current_user: User = Depends(get_current_user)
):
    """Check if there's a pending deletion request"""
    request = await db.deletion_requests.find_one(
        {"user_id": current_user.id, "status": "pending"},
        {"_id": 0}
    )
    if request:
        for key in ["requested_at", "scheduled_deletion_at", "cancelled_at"]:
            if isinstance(request.get(key), datetime):
                request[key] = request[key].isoformat()
        return {"has_pending_request": True, "request": request}
    return {"has_pending_request": False}


# ============ PRIVACY SETTINGS ============

@router.get("/privacy")
async def get_privacy_settings(
    current_user: User = Depends(get_current_user)
):
    """Get user privacy settings"""
    user_doc = await db.users.find_one(
        {"email": current_user.email},
        {"_id": 0, "privacy_settings": 1}
    )
    defaults = {
        "analytics_tracking": True,
        "marketing_emails": False,
        "data_sharing": False,
        "activity_visible": False,
    }
    settings = user_doc.get("privacy_settings", defaults) if user_doc else defaults
    return {"privacy_settings": settings}


@router.put("/privacy")
async def update_privacy_settings(
    settings: dict,
    current_user: User = Depends(get_current_user)
):
    """Update user privacy settings"""
    allowed_keys = {"analytics_tracking", "marketing_emails", "data_sharing", "activity_visible"}
    clean = {k: bool(v) for k, v in settings.items() if k in allowed_keys}

    await db.users.update_one(
        {"email": current_user.email},
        {"$set": {"privacy_settings": clean}}
    )
    return {"success": True, "privacy_settings": clean}
