"""
GoHighLevel (GHL) CRM Integration Routes
Admin-only status + manual sync + inbound webhook placeholder for future bidirectional sync.
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import logging
import os
import json
import hmac
import hashlib

from middleware.security import limiter
from services import ghl_service as ghl

router = APIRouter(prefix="/api/ghl", tags=["ghl"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


async def _require_admin(request: Request):
    from auth import decode_access_token, extract_request_token
    token = extract_request_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/status")
async def get_ghl_status(request: Request):
    """Return current GHL configuration + connectivity state (admin only)."""
    await _require_admin(request)
    configured = ghl.is_configured()
    out = {
        "configured": configured,
        "location_id": ghl.LOCATION_ID or None,
        "pipeline_id": ghl.PIPELINE_ID or None,
        "stages": {
            "signup": ghl.STAGE_SIGNUP or None,
            "upgraded": ghl.STAGE_UPGRADED or None,
        },
        "api_version": ghl.GHL_API_VERSION,
        "token_prefix": ghl.PIT_TOKEN[:8] + "..." if ghl.PIT_TOKEN else None,
    }
    if not configured:
        out["error"] = "Missing GHL_PIT_TOKEN or GHL_LOCATION_ID"
        return out
    try:
        ping = await ghl.ghl_service.ping()
        out["connected"] = True
        out["location_name"] = ping.get("location_name")
        out["company_id"] = ping.get("company_id")
        out["timezone"] = ping.get("timezone")
    except Exception as e:
        out["connected"] = False
        out["error"] = str(e)
    return out


@router.get("/pipelines")
async def list_pipelines(request: Request):
    """List all GHL pipelines for this location (admin only)."""
    await _require_admin(request)
    try:
        pipelines = await ghl.ghl_service.list_pipelines()
        return {"pipelines": [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "stages": [
                    {"id": s.get("id"), "name": s.get("name"), "position": s.get("position")}
                    for s in p.get("stages", [])
                ],
            } for p in pipelines
        ]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GHL API error: {e}")


@router.post("/test/contact")
async def test_contact_upsert(request: Request):
    """Admin-only: manually upsert a test contact to verify the integration end-to-end."""
    await _require_admin(request)
    body = await request.json()
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    full_name = body.get("full_name", "Test User")
    role = body.get("role", "user")
    tier = body.get("subscription_tier", "starter")
    cid = await ghl.sync_user_signup(email=email, full_name=full_name, role=role, subscription_tier=tier)
    if not cid:
        raise HTTPException(status_code=502, detail="GHL upsert failed — check backend logs")
    return {"success": True, "contact_id": cid, "email": email}


@router.post("/webhook/inbound")
@limiter.limit("60/minute")
async def ghl_inbound_webhook(request: Request):
    """
    Inbound GHL → NotaryChain events (contact updates, opportunity stage changes,
    tag changes, etc.). Persisted to an audit collection for processing.

    SECURITY: this endpoint is unauthenticated (called by GHL), so when a
    GHL_WEBHOOK_SECRET is configured we require a valid HMAC-SHA256 signature and
    reject anything that doesn't match. Without the secret set it still ingests
    (placeholder mode) but is rate-limited to blunt abuse.
    """
    raw = await request.body()

    secret = os.environ.get("GHL_WEBHOOK_SECRET")
    if secret:
        provided = (
            request.headers.get("x-ghl-signature")
            or request.headers.get("x-wh-signature")
            or request.headers.get("x-webhook-signature")
            or ""
        )
        expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not provided or not hmac.compare_digest(provided.strip(), expected):
            logger.warning("GHL inbound webhook rejected: invalid signature")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        body = json.loads(raw or b"{}")
        if not isinstance(body, dict):
            body = {}
    except Exception:
        body = {}
    event_type = body.get("type") or body.get("event") or "unknown"
    logger.info(f"GHL inbound webhook received: {event_type}")

    from datetime import datetime, timezone
    doc = {
        "received_at": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "payload": body,
        "processed": False,
    }
    if db is not None:
        try:
            await db.ghl_inbound_events.insert_one(doc)
            doc.pop("_id", None)
        except Exception as e:
            logger.warning(f"Failed to persist GHL webhook: {e}")

    return {"received": True, "event_type": event_type}
