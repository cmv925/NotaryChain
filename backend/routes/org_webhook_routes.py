"""
Organization Webhooks Routes
Manages webhook configurations, delivery, and logging for organizations.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import hmac
import hashlib
import secrets
import httpx
import asyncio
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["webhooks"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


SUPPORTED_EVENTS = [
    {"key": "document.notarized", "label": "Document Notarized", "category": "Documents"},
    {"key": "document.uploaded", "label": "Document Uploaded", "category": "Documents"},
    {"key": "member.joined", "label": "Member Joined", "category": "Members"},
    {"key": "member.removed", "label": "Member Removed", "category": "Members"},
    {"key": "member.invited", "label": "Member Invited", "category": "Members"},
    {"key": "role.assigned", "label": "Role Assigned", "category": "RBAC"},
    {"key": "role.created", "label": "Role Created", "category": "RBAC"},
    {"key": "approval.created", "label": "Approval Created", "category": "Workflows"},
    {"key": "approval.decided", "label": "Approval Decided", "category": "Workflows"},
    {"key": "vault.uploaded", "label": "Vault Upload", "category": "Vault"},
    {"key": "sso.login", "label": "SSO Login", "category": "Authentication"},
]

EVENT_KEYS = [e["key"] for e in SUPPORTED_EVENTS]


# --- Models ---

class CreateWebhookRequest(BaseModel):
    url: str
    events: List[str]
    description: Optional[str] = ""
    is_active: bool = True

class UpdateWebhookRequest(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# --- Helpers ---

def _sign_payload(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


async def _require_webhook_admin(org_id: str, user_id: str):
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership


async def deliver_webhook(webhook_id: str, org_id: str, event: str, payload: dict):
    """Deliver a webhook with retry logic (3 attempts, exponential backoff)."""
    webhook = await db.org_webhooks.find_one({"id": webhook_id, "org_id": org_id}, {"_id": 0})
    if not webhook or not webhook.get("is_active"):
        return

    body = {
        "event": event,
        "org_id": org_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }

    import json
    body_str = json.dumps(body, default=str)
    signature = _sign_payload(body_str, webhook.get("secret", ""))

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Event": event,
        "X-Webhook-ID": webhook_id,
        "User-Agent": "NotaryChain-Webhook/1.0",
    }

    delivery_id = str(uuid.uuid4())
    delivery = {
        "id": delivery_id,
        "webhook_id": webhook_id,
        "org_id": org_id,
        "event": event,
        "url": webhook["url"],
        "request_body": body,
        "attempts": 0,
        "max_attempts": 3,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    max_attempts = 3
    for attempt in range(max_attempts):
        delivery["attempts"] = attempt + 1
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook["url"], content=body_str, headers=headers)

            delivery["response_status"] = resp.status_code
            delivery["response_body"] = resp.text[:500]

            if 200 <= resp.status_code < 300:
                delivery["status"] = "delivered"
                delivery["delivered_at"] = datetime.now(timezone.utc).isoformat()
                break
            else:
                delivery["status"] = "failed"
                delivery["error"] = f"HTTP {resp.status_code}"
        except Exception as e:
            delivery["status"] = "failed"
            delivery["error"] = str(e)[:300]

        if attempt < max_attempts - 1:
            await asyncio.sleep(2 ** attempt)

    await db.webhook_deliveries.insert_one(delivery)
    # Update webhook last delivery info
    await db.org_webhooks.update_one(
        {"id": webhook_id},
        {"$set": {
            "last_delivery_at": datetime.now(timezone.utc).isoformat(),
            "last_delivery_status": delivery["status"],
        }}
    )


async def fire_org_webhooks(org_id: str, event: str, payload: dict):
    """Fire all active webhooks for an org that subscribe to this event."""
    webhooks = await db.org_webhooks.find(
        {"org_id": org_id, "is_active": True, "events": event},
        {"_id": 0, "id": 1}
    ).to_list(50)

    for wh in webhooks:
        asyncio.create_task(deliver_webhook(wh["id"], org_id, event, payload))


# --- Routes ---

@router.get("/{org_id}/webhooks/events")
async def list_webhook_events(org_id: str, current_user: dict = Depends(get_current_user)):
    """List all supported webhook event types."""
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user.id, "status": "active"}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
    return {"events": SUPPORTED_EVENTS}


@router.get("/{org_id}/webhooks")
async def list_webhooks(org_id: str, current_user: dict = Depends(get_current_user)):
    """List all webhooks for an organization."""
    await _require_webhook_admin(org_id, current_user.id)
    webhooks = await db.org_webhooks.find({"org_id": org_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # Mask secrets
    for wh in webhooks:
        if wh.get("secret"):
            wh["secret"] = wh["secret"][:6] + "..." + wh["secret"][-4:]
    return {"webhooks": webhooks}


@router.post("/{org_id}/webhooks")
async def create_webhook(org_id: str, body: CreateWebhookRequest, current_user: dict = Depends(get_current_user)):
    """Create a new webhook endpoint."""
    await _require_webhook_admin(org_id, current_user.id)

    if not body.url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    invalid = [e for e in body.events if e not in EVENT_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid events: {', '.join(invalid)}")

    if not body.events:
        raise HTTPException(status_code=400, detail="At least one event is required")

    # Limit webhooks per org
    count = await db.org_webhooks.count_documents({"org_id": org_id})
    if count >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 webhooks per organization")

    now = datetime.now(timezone.utc).isoformat()
    webhook = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "url": body.url.strip(),
        "secret": secrets.token_urlsafe(32),
        "events": body.events,
        "description": body.description or "",
        "is_active": body.is_active,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
        "last_delivery_at": None,
        "last_delivery_status": None,
    }
    await db.org_webhooks.insert_one(webhook)
    webhook.pop("_id", None)
    return webhook


@router.put("/{org_id}/webhooks/{webhook_id}")
async def update_webhook(org_id: str, webhook_id: str, body: UpdateWebhookRequest, current_user: dict = Depends(get_current_user)):
    """Update a webhook."""
    await _require_webhook_admin(org_id, current_user.id)

    webhook = await db.org_webhooks.find_one({"id": webhook_id, "org_id": org_id})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.url is not None:
        if not body.url.startswith("http"):
            raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
        update["url"] = body.url.strip()
    if body.events is not None:
        invalid = [e for e in body.events if e not in EVENT_KEYS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid events: {', '.join(invalid)}")
        update["events"] = body.events
    if body.description is not None:
        update["description"] = body.description
    if body.is_active is not None:
        update["is_active"] = body.is_active

    await db.org_webhooks.update_one({"id": webhook_id}, {"$set": update})
    updated = await db.org_webhooks.find_one({"id": webhook_id}, {"_id": 0})
    if updated.get("secret"):
        updated["secret"] = updated["secret"][:6] + "..." + updated["secret"][-4:]
    return updated


@router.delete("/{org_id}/webhooks/{webhook_id}")
async def delete_webhook(org_id: str, webhook_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a webhook."""
    await _require_webhook_admin(org_id, current_user.id)

    webhook = await db.org_webhooks.find_one({"id": webhook_id, "org_id": org_id})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await db.org_webhooks.delete_one({"id": webhook_id})
    await db.webhook_deliveries.delete_many({"webhook_id": webhook_id})
    return {"message": "Webhook deleted"}


@router.post("/{org_id}/webhooks/{webhook_id}/test")
async def test_webhook(org_id: str, webhook_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Send a test payload to a webhook endpoint."""
    await _require_webhook_admin(org_id, current_user.id)

    webhook = await db.org_webhooks.find_one({"id": webhook_id, "org_id": org_id}, {"_id": 0})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_payload = {
        "test": True,
        "message": "This is a test webhook delivery from NotaryChain",
        "webhook_id": webhook_id,
        "org_id": org_id,
        "triggered_by": current_user.email,
    }

    background_tasks.add_task(deliver_webhook, webhook_id, org_id, "test.ping", test_payload)
    return {"message": "Test webhook queued for delivery", "event": "test.ping"}


@router.post("/{org_id}/webhooks/{webhook_id}/rotate-secret")
async def rotate_webhook_secret(org_id: str, webhook_id: str, current_user: dict = Depends(get_current_user)):
    """Rotate the signing secret for a webhook."""
    await _require_webhook_admin(org_id, current_user.id)

    webhook = await db.org_webhooks.find_one({"id": webhook_id, "org_id": org_id})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    new_secret = secrets.token_urlsafe(32)
    await db.org_webhooks.update_one(
        {"id": webhook_id},
        {"$set": {"secret": new_secret, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Secret rotated", "new_secret": new_secret}


@router.get("/{org_id}/webhooks/{webhook_id}/deliveries")
async def list_deliveries(
    org_id: str, webhook_id: str,
    page: int = 1, page_size: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get delivery log for a webhook."""
    await _require_webhook_admin(org_id, current_user.id)

    query = {"webhook_id": webhook_id, "org_id": org_id}
    total = await db.webhook_deliveries.count_documents(query)
    skip = (page - 1) * page_size
    deliveries = await db.webhook_deliveries.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)

    return {"total": total, "page": page, "deliveries": deliveries}
