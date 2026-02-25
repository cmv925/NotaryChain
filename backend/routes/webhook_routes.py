"""
Webhook Management Routes
Register, list, delete, and test webhooks for the Public API
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from models import User
from routes.auth_routes import get_current_user
from services.webhook_service import WEBHOOK_EVENTS, sign_payload, trigger_event
from datetime import datetime, timezone
import uuid
import secrets
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/developer/webhooks", tags=["webhooks"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class CreateWebhookRequest(BaseModel):
    url: str
    events: List[str]
    description: str = ""

class TestWebhookRequest(BaseModel):
    webhook_id: str


# --- Endpoints ---

@router.post("")
async def create_webhook(
    body: CreateWebhookRequest,
    current_user: User = Depends(get_current_user)
):
    """Register a new webhook endpoint"""
    # Validate events
    invalid = [e for e in body.events if e not in WEBHOOK_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid events: {invalid}. Valid: {WEBHOOK_EVENTS}")

    if not body.url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    # Max 10 webhooks per user
    count = await db.webhooks.count_documents({"user_id": current_user.id, "active": True})
    if count >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 active webhooks allowed")

    webhook_id = str(uuid.uuid4())
    secret = f"whsec_{secrets.token_hex(24)}"

    await db.webhooks.insert_one({
        "id": webhook_id,
        "user_id": current_user.id,
        "url": body.url,
        "events": body.events,
        "description": body.description[:200],
        "secret": secret,
        "active": True,
        "disabled_reason": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "id": webhook_id,
        "url": body.url,
        "events": body.events,
        "secret": secret,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": "Store the signing secret securely. It will not be shown again.",
    }


@router.get("")
async def list_webhooks(current_user: User = Depends(get_current_user)):
    """List all webhooks for the current user"""
    webhooks = await db.webhooks.find(
        {"user_id": current_user.id},
        {"_id": 0, "secret": 0}
    ).sort("created_at", -1).to_list(20)
    return {"webhooks": webhooks}


@router.get("/{webhook_id}")
async def get_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get webhook details including recent deliveries"""
    wh = await db.webhooks.find_one(
        {"id": webhook_id, "user_id": current_user.id},
        {"_id": 0, "secret": 0}
    )
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    deliveries = await db.webhook_deliveries.find(
        {"webhook_id": webhook_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)

    # Stats
    total = await db.webhook_deliveries.count_documents({"webhook_id": webhook_id})
    success = await db.webhook_deliveries.count_documents({"webhook_id": webhook_id, "success": True})

    return {
        **wh,
        "deliveries": deliveries,
        "stats": {
            "total_deliveries": total,
            "successful": success,
            "failed": total - success,
            "success_rate": round(success / total * 100, 1) if total else 0,
        },
    }


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a webhook"""
    result = await db.webhooks.delete_one({"id": webhook_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Clean up deliveries
    await db.webhook_deliveries.delete_many({"webhook_id": webhook_id})
    return {"success": True, "message": "Webhook deleted"}


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """Send a test event to a webhook"""
    wh = await db.webhooks.find_one({"id": webhook_id, "user_id": current_user.id})
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_data = {
        "seal_id": "test_seal_123",
        "document_name": "test_document.pdf",
        "document_hash": "sha256_test_hash",
        "test": True,
    }

    # Trigger delivery (runs in background)
    import asyncio
    from services.webhook_service import _deliver
    asyncio.create_task(_deliver(wh, "test.ping", test_data))

    return {"success": True, "message": "Test event dispatched. Check deliveries for result."}


@router.post("/{webhook_id}/toggle")
async def toggle_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """Enable or disable a webhook"""
    wh = await db.webhooks.find_one({"id": webhook_id, "user_id": current_user.id})
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    new_active = not wh.get("active", True)
    await db.webhooks.update_one(
        {"id": webhook_id},
        {"$set": {"active": new_active, "disabled_reason": None if new_active else "manually_disabled"}}
    )
    return {"success": True, "active": new_active}


@router.get("/events/list")
async def list_events():
    """List all available webhook events"""
    return {"events": WEBHOOK_EVENTS}
