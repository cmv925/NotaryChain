"""
Document Expiry Routes
Manage expiry dates on notarization requests and documents.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from models import User
from routes.auth_routes import get_current_user
from models_notary import NotarizationRequest
from services.hedera_service import hedera_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/expiry", tags=["expiry"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class SetExpiryRequest(BaseModel):
    expires_at: str  # ISO format date string


class ExpirySettingsRequest(BaseModel):
    auto_notify: bool = True
    notify_days: list = [30, 7, 1]


@router.put("/requests/{request_id}")
async def set_request_expiry(
    request_id: str,
    body: SetExpiryRequest,
    current_user: User = Depends(get_current_user),
):
    """Set or update the expiry date on a notarization request."""
    req = await db.notarization_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Reset notification flags when expiry changes
    update = {
        "$set": {
            "expires_at": body.expires_at,
            "expiry_notified_30_days": False,
            "expiry_notified_7_days": False,
            "expiry_notified_1_day": False,
            "expiry_notified_expired": False,
        }
    }
    await db.notarization_requests.update_one({"id": request_id}, update)
    return {"message": "Expiry date set", "expires_at": body.expires_at}


@router.delete("/requests/{request_id}")
async def remove_request_expiry(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove the expiry date from a notarization request."""
    req = await db.notarization_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.notarization_requests.update_one(
        {"id": request_id},
        {"$unset": {
            "expires_at": "",
            "expiry_notified_30_days": "",
            "expiry_notified_7_days": "",
            "expiry_notified_1_day": "",
            "expiry_notified_expired": "",
        }},
    )
    return {"message": "Expiry date removed"}


@router.get("/requests/{request_id}")
async def get_request_expiry(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the expiry status of a notarization request."""
    req = await db.notarization_requests.find_one(
        {"id": request_id}, {"_id": 0, "id": 1, "expires_at": 1, "document_name": 1, "user_id": 1}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    expires_at = req.get("expires_at")
    status = "no_expiry"
    days_remaining = None

    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            delta = exp_dt - now
            days_remaining = delta.days
            if days_remaining < 0:
                status = "expired"
            elif days_remaining <= 1:
                status = "critical"
            elif days_remaining <= 7:
                status = "warning"
            elif days_remaining <= 30:
                status = "approaching"
            else:
                status = "active"
        except Exception:
            status = "no_expiry"

    return {
        "request_id": req["id"],
        "document_name": req.get("document_name"),
        "expires_at": expires_at,
        "status": status,
        "days_remaining": days_remaining,
    }


@router.get("/dashboard")
async def get_expiry_dashboard(
    current_user: User = Depends(get_current_user),
):
    """Get all documents with expiry dates for the current user, sorted by urgency."""
    docs = await db.notarization_requests.find(
        {"user_id": current_user.id, "expires_at": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "document_name": 1, "document_type": 1, "status": 1, "expires_at": 1, "created_at": 1},
    ).to_list(100)

    now = datetime.now(timezone.utc)
    results = []
    for doc in docs:
        expires_at = doc.get("expires_at")
        days_remaining = None
        expiry_status = "active"
        try:
            exp_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            delta = exp_dt - now
            days_remaining = delta.days
            if days_remaining < 0:
                expiry_status = "expired"
            elif days_remaining <= 1:
                expiry_status = "critical"
            elif days_remaining <= 7:
                expiry_status = "warning"
            elif days_remaining <= 30:
                expiry_status = "approaching"
        except Exception:
            pass

        results.append({
            "id": doc["id"],
            "document_name": doc.get("document_name"),
            "document_type": doc.get("document_type"),
            "status": doc.get("status"),
            "expires_at": expires_at,
            "days_remaining": days_remaining,
            "expiry_status": expiry_status,
        })

    # Sort: expired first, then by days_remaining ascending
    results.sort(key=lambda x: (
        0 if x["expiry_status"] == "expired" else
        1 if x["expiry_status"] == "critical" else
        2 if x["expiry_status"] == "warning" else
        3 if x["expiry_status"] == "approaching" else 4,
        x.get("days_remaining") or 9999,
    ))

    summary = {
        "total": len(results),
        "expired": sum(1 for r in results if r["expiry_status"] == "expired"),
        "critical": sum(1 for r in results if r["expiry_status"] == "critical"),
        "warning": sum(1 for r in results if r["expiry_status"] == "warning"),
        "approaching": sum(1 for r in results if r["expiry_status"] == "approaching"),
    }

    return {"documents": results, "summary": summary}



@router.post("/requests/{request_id}/renew")
async def renew_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Create a new notarization request pre-filled from an existing (expired/expiring) request."""
    original = await db.notarization_requests.find_one(
        {"id": request_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not original:
        raise HTTPException(status_code=404, detail="Request not found")

    # Create a new request with same details
    new_req = NotarizationRequest(
        user_id=current_user.id,
        document_name=original.get("document_name", "Renewed Document"),
        document_type=original.get("document_type", "other"),
        notarization_type=original.get("notarization_type", "ron"),
        signers=original.get("signers", []),
        notes=f"Renewed from request {request_id[:8]}... | {original.get('notes', '')}",
    )

    # Create HCS topic
    hcs_topic_id = None
    hcs_explorer = None
    try:
        result = await hedera_service.create_topic(
            memo=f"Notarization: {new_req.document_type}"
        )
        if result.get("success"):
            hcs_topic_id = result["topic_id"]
            hcs_explorer = result.get("explorer_url")
    except Exception as e:
        logger.warning(f"HCS topic creation failed for renewal: {e}")

    req_dict = new_req.dict()
    req_dict["hcs_topic_id"] = hcs_topic_id
    req_dict["hcs_topic_explorer"] = hcs_explorer

    await db.notarization_requests.insert_one(req_dict)
    req_dict.pop("_id", None)

    return {
        "message": "Request renewed successfully",
        "new_request": req_dict,
        "original_request_id": request_id,
    }