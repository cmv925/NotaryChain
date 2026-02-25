"""
Webhook Service
Delivers webhook events with HMAC-SHA256 signing, retry logic, and delivery logging
"""

import hmac
import hashlib
import json
import uuid
import logging
import asyncio
import httpx
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

db = None

def set_db(database):
    global db
    db = database


WEBHOOK_EVENTS = [
    "seal.created",
    "document.verified",
    "request.completed",
    "request.assigned",
    "request.created",
]

MAX_RETRIES = 5
RETRY_DELAYS = [5, 30, 120, 600, 3600]  # seconds: 5s, 30s, 2m, 10m, 1h


def sign_payload(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload"""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


async def trigger_event(user_id: str, event_type: str, data: dict):
    """Find all active webhooks for a user+event and dispatch deliveries"""
    if db is None:
        return

    webhooks = await db.webhooks.find({
        "user_id": user_id,
        "active": True,
        "events": event_type,
    }).to_list(50)

    for wh in webhooks:
        asyncio.create_task(_deliver(wh, event_type, data))


async def _deliver(webhook: dict, event_type: str, data: dict, attempt: int = 0):
    """Deliver a webhook event to the registered URL"""
    delivery_id = str(uuid.uuid4())
    payload = json.dumps({
        "id": delivery_id,
        "event": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhook_id": webhook["id"],
    }, default=str)

    signature = sign_payload(payload, webhook["secret"])

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Id": webhook["id"],
        "X-Webhook-Event": event_type,
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Delivery": delivery_id,
        "User-Agent": "NotaryChain-Webhook/1.0",
    }

    status_code = None
    response_body = None
    error_msg = None
    success = False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook["url"], content=payload, headers=headers)
            status_code = resp.status_code
            response_body = resp.text[:500]
            success = 200 <= resp.status_code < 300
    except Exception as e:
        error_msg = str(e)[:200]

    # Log delivery
    await db.webhook_deliveries.insert_one({
        "id": delivery_id,
        "webhook_id": webhook["id"],
        "user_id": webhook["user_id"],
        "event": event_type,
        "url": webhook["url"],
        "attempt": attempt + 1,
        "status_code": status_code,
        "response_body": response_body,
        "error": error_msg,
        "success": success,
        "payload_size": len(payload),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Retry on failure
    if not success and attempt < MAX_RETRIES:
        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
        logger.info(f"Webhook delivery failed (attempt {attempt + 1}), retrying in {delay}s: {webhook['url']}")
        await asyncio.sleep(delay)
        await _deliver(webhook, event_type, data, attempt + 1)
    elif not success:
        logger.warning(f"Webhook delivery permanently failed after {MAX_RETRIES} retries: {webhook['url']}")
        # Disable webhook after too many consecutive failures
        await _check_disable(webhook["id"])


async def _check_disable(webhook_id: str):
    """Disable webhook if last 10 deliveries all failed"""
    recent = await db.webhook_deliveries.find(
        {"webhook_id": webhook_id}
    ).sort("timestamp", -1).limit(10).to_list(10)

    if len(recent) >= 10 and all(not d.get("success") for d in recent):
        await db.webhooks.update_one(
            {"id": webhook_id},
            {"$set": {"active": False, "disabled_reason": "10 consecutive failures", "disabled_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.warning(f"Webhook {webhook_id} auto-disabled after 10 consecutive failures")
