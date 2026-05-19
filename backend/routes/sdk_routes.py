"""
Embeddable Notarize SDK Routes — Phase 1 (M1-M5)

Provides:
- M1: SDK loader JS file served at /api/sdk/v1/notarychain.js
- M2: Embed session creation + iframe ceremony bridge
- M3: Publishable keys (sdk_keys) + origin allowlist + usage metering
- M4: Webhooks for backend ceremony confirmation (HMAC-SHA256 signed)
- M5: (frontend handles dev portal — backend exposes /api/sdk/demo-key for live demos)
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.responses import Response, JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
import os
import uuid
import hmac
import hashlib
import json
import secrets
import logging
import httpx

from models import User
from routes.auth_routes import get_current_user
from middleware.feature_gate import enforce_feature_gate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sdk", tags=["sdk"])

db: AsyncIOMotorDatabase = None

PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL") or ""
SDK_VERSION = "1.0.0"


def set_db(database):
    global db
    db = database


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class SDKKeyCreate(BaseModel):
    name: str
    allowed_origins: List[str] = []
    mode: str = "test"  # "test" | "live"


class SDKSessionCreate(BaseModel):
    document_name: Optional[str] = None
    document_type: Optional[str] = "general"
    signer_email: Optional[str] = None
    signer_name: Optional[str] = None
    template_id: Optional[str] = None
    metadata: Optional[dict] = None
    return_url: Optional[str] = None


class WebhookCreate(BaseModel):
    url: str
    events: List[str] = ["ceremony.completed", "ceremony.sealed"]
    active: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_key(mode: str) -> tuple[str, str]:
    """Returns (public_id, secret_part). Stored value is pk_{mode}_{random}."""
    rand = secrets.token_urlsafe(24).replace("-", "").replace("_", "")[:32]
    public_id = f"pk_{mode}_{rand}"
    return public_id, rand


def _check_origin(allowed_origins: List[str], origin: Optional[str]) -> bool:
    """Permissive check: if no origins configured, allow all (dev mode).
    Otherwise, exact host match against allowed list."""
    if not allowed_origins:
        return True
    if not origin:
        return False
    try:
        host = urlparse(origin).hostname or ""
    except Exception:
        return False
    for allowed in allowed_origins:
        a = allowed.strip().lower()
        if not a:
            continue
        # strip scheme if user pasted full URL
        try:
            ah = urlparse(a).hostname or a
        except Exception:
            ah = a
        if host == ah.lower() or host.endswith("." + ah.lower()):
            return True
    return False


def _sign_payload(secret: str, payload: dict) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


# ─────────────────────────────────────────────────────────────────────────────
# M3 — Publishable Keys (Authenticated CRUD)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/keys")
async def create_sdk_key(
    body: SDKKeyCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Create a new publishable SDK key. Pro+ only."""
    await enforce_feature_gate(request, "sdk_embed")

    if body.mode not in ("test", "live"):
        raise HTTPException(status_code=400, detail="mode must be 'test' or 'live'")

    public_id, _ = _generate_key(body.mode)
    webhook_secret = secrets.token_urlsafe(32)

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "name": body.name,
        "publishable_key": public_id,
        "mode": body.mode,
        "allowed_origins": [o.strip() for o in body.allowed_origins if o.strip()],
        "webhook_secret": webhook_secret,
        "usage_count": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sdk_keys.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/keys")
async def list_sdk_keys(current_user: User = Depends(get_current_user)):
    rows = await db.sdk_keys.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"keys": rows}


@router.delete("/keys/{key_id}")
async def revoke_sdk_key(key_id: str, current_user: User = Depends(get_current_user)):
    res = await db.sdk_keys.update_one(
        {"id": key_id, "user_id": current_user.id},
        {"$set": {"active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"message": "Key revoked"}


# ─────────────────────────────────────────────────────────────────────────────
# M2 — Session creation (PUBLIC, authenticated via pk + Origin)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_sdk_session(
    body: SDKSessionCreate,
    request: Request,
    x_publishable_key: Optional[str] = Header(None, alias="X-Publishable-Key"),
):
    """Create an ephemeral ceremony session from a publishable key.
    
    Public endpoint — uses pk + Origin header for auth. Returns ceremony_token
    that opens the iframe.
    """
    pk = x_publishable_key or request.query_params.get("pk")
    if not pk:
        raise HTTPException(status_code=401, detail="Missing X-Publishable-Key header")

    key = await db.sdk_keys.find_one({"publishable_key": pk, "active": True}, {"_id": 0})
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or revoked publishable key")

    origin = request.headers.get("origin") or request.headers.get("referer")
    if not _check_origin(key.get("allowed_origins", []), origin):
        raise HTTPException(
            status_code=403,
            detail=f"Origin '{origin}' not in allowed_origins for this key",
        )

    token = secrets.token_urlsafe(32)
    session = {
        "session_token": token,
        "publishable_key": pk,
        "owner_user_id": key["user_id"],
        "mode": key["mode"],
        "document_name": body.document_name or "Untitled Document",
        "document_type": body.document_type or "general",
        "signer_email": body.signer_email,
        "signer_name": body.signer_name,
        "template_id": body.template_id,
        "metadata": body.metadata or {},
        "return_url": body.return_url,
        "origin": origin,
        "status": "created",  # created → in_progress → completed → sealed
        "ceremony_id": None,
        "seal_hash": None,
        "hcs_tx": None,
        "events_log": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    }
    await db.sdk_sessions.insert_one(session)
    # Increment usage on key
    await db.sdk_keys.update_one({"publishable_key": pk}, {"$inc": {"usage_count": 1}})

    embed_url = f"{PUBLIC_BACKEND_URL}/embed/ceremony/{token}"
    return {
        "session_token": token,
        "embed_url": embed_url,
        "mode": key["mode"],
        "expires_at": session["expires_at"],
    }


@router.get("/sessions/{token}")
async def get_sdk_session(token: str):
    """Public lookup used by the iframe to bootstrap. Returns minimal info."""
    s = await db.sdk_sessions.find_one(
        {"session_token": token},
        {
            "_id": 0,
            "publishable_key": 1,
            "document_name": 1,
            "document_type": 1,
            "signer_email": 1,
            "signer_name": 1,
            "template_id": 1,
            "status": 1,
            "mode": 1,
            "ceremony_id": 1,
            "seal_hash": 1,
            "hcs_tx": 1,
            "origin": 1,
        },
    )
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


@router.post("/sessions/{token}/event")
async def emit_session_event(token: str, event: dict):
    """Iframe page posts ceremony progress events here. Triggers webhook fan-out."""
    s = await db.sdk_sessions.find_one({"session_token": token})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    ev_type = event.get("type", "unknown")
    update = {
        "$push": {
            "events_log": {
                "type": ev_type,
                "payload": event.get("payload", {}),
                "at": datetime.now(timezone.utc).isoformat(),
            }
        }
    }

    # Status transitions
    if ev_type == "ceremony.started":
        update["$set"] = {"status": "in_progress", "ceremony_id": event.get("payload", {}).get("ceremony_id")}
    elif ev_type == "ceremony.completed":
        update["$set"] = {"status": "completed"}
    elif ev_type == "ceremony.sealed":
        payload = event.get("payload", {})
        update["$set"] = {
            "status": "sealed",
            "seal_hash": payload.get("seal_hash"),
            "hcs_tx": payload.get("hcs_tx"),
        }

    await db.sdk_sessions.update_one({"session_token": token}, update)

    # Webhook fan-out (fire-and-forget)
    if ev_type in ("ceremony.completed", "ceremony.sealed"):
        await _dispatch_webhooks(s["owner_user_id"], s["publishable_key"], ev_type, {
            "session_token": token,
            "publishable_key": s["publishable_key"],
            "document_name": s["document_name"],
            "metadata": s.get("metadata", {}),
            **event.get("payload", {}),
        })

    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# M4 — Webhooks
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/webhooks")
async def create_webhook(
    body: WebhookCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    await enforce_feature_gate(request, "sdk_embed")
    if not body.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Webhook URL must be http/https")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "url": body.url,
        "events": body.events,
        "secret": secrets.token_urlsafe(32),
        "active": body.active,
        "delivery_count": 0,
        "last_status": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sdk_webhooks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/webhooks")
async def list_webhooks(current_user: User = Depends(get_current_user)):
    rows = await db.sdk_webhooks.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"webhooks": rows}


@router.delete("/webhooks/{wid}")
async def delete_webhook(wid: str, current_user: User = Depends(get_current_user)):
    res = await db.sdk_webhooks.delete_one({"id": wid, "user_id": current_user.id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Deleted"}


async def _dispatch_webhooks(user_id: str, pk: str, event_type: str, payload: dict):
    """Fire registered webhooks for this user matching the event type."""
    webhooks = await db.sdk_webhooks.find(
        {"user_id": user_id, "active": True, "events": event_type}, {"_id": 0}
    ).to_list(20)
    if not webhooks:
        return

    body = {
        "id": f"evt_{uuid.uuid4().hex[:24]}",
        "type": event_type,
        "created": int(datetime.now(timezone.utc).timestamp()),
        "data": payload,
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        for wh in webhooks:
            try:
                sig = _sign_payload(wh["secret"], body)
                r = await client.post(
                    wh["url"],
                    json=body,
                    headers={
                        "X-NotaryChain-Signature": sig,
                        "X-NotaryChain-Event": event_type,
                        "User-Agent": f"NotaryChain-SDK/{SDK_VERSION}",
                    },
                )
                await db.sdk_webhooks.update_one(
                    {"id": wh["id"]},
                    {"$inc": {"delivery_count": 1}, "$set": {"last_status": r.status_code, "last_at": datetime.now(timezone.utc).isoformat()}},
                )
            except Exception as e:
                logger.warning(f"webhook dispatch failed url={wh['url']} err={e}")
                await db.sdk_webhooks.update_one(
                    {"id": wh["id"]},
                    {"$set": {"last_status": -1, "last_error": str(e)[:200]}},
                )


# ─────────────────────────────────────────────────────────────────────────────
# M5 — Demo helper (used by /developers/sdk live demo)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/demo-key")
async def get_demo_key():
    """Returns a shared demo publishable key for the docs page live demo.
    Auto-created on first hit. No origin restriction. Test mode only."""
    demo = await db.sdk_keys.find_one({"publishable_key": {"$regex": "^pk_test_DEMO"}}, {"_id": 0})
    if not demo:
        public_id = f"pk_test_DEMO{secrets.token_urlsafe(16).replace('-', '').replace('_', '')[:20]}"
        demo = {
            "id": str(uuid.uuid4()),
            "user_id": "system",
            "name": "Public Demo Key (rate-limited)",
            "publishable_key": public_id,
            "mode": "test",
            "allowed_origins": [],  # any origin (demo only)
            "webhook_secret": secrets.token_urlsafe(32),
            "usage_count": 0,
            "active": True,
            "is_demo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.sdk_keys.insert_one(demo)
        demo.pop("_id", None)
    return {"publishable_key": demo["publishable_key"], "mode": "test"}


# ─────────────────────────────────────────────────────────────────────────────
# M1 — SDK loader JavaScript file
# ─────────────────────────────────────────────────────────────────────────────

SDK_JS_TEMPLATE = """/*! NotaryChain SDK __VERSION__ — https://notarychain.app */
(function(root) {
  'use strict';
  if (root.NotaryChain && root.NotaryChain.__loaded__) return;

  var API_BASE = '__API_BASE__';
  var SDK_VERSION = '__VERSION__';
  var config = { publishableKey: null };
  var listeners = {};
  var activeFrame = null;
  var activeBackdrop = null;

  function emit(evt, data) {
    (listeners[evt] || []).forEach(function(fn) {
      try { fn(data); } catch (e) { console.error('[NotaryChain]', e); }
    });
  }

  function on(evt, fn) {
    listeners[evt] = listeners[evt] || [];
    listeners[evt].push(fn);
    return function() {
      listeners[evt] = (listeners[evt] || []).filter(function(f) { return f !== fn; });
    };
  }

  function close() {
    if (activeFrame && activeFrame.parentNode) activeFrame.parentNode.removeChild(activeFrame);
    if (activeBackdrop && activeBackdrop.parentNode) activeBackdrop.parentNode.removeChild(activeBackdrop);
    activeFrame = null;
    activeBackdrop = null;
    document.body.style.overflow = '';
    emit('close', {});
  }

  function makeBackdrop() {
    var bd = document.createElement('div');
    bd.style.cssText = 'position:fixed;inset:0;background:rgba(13,27,42,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483646;animation:nc-fade 0.18s ease-out;';
    bd.setAttribute('data-notarychain', 'backdrop');
    return bd;
  }

  function makeFrame(url) {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-notarychain', 'frame');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;pointer-events:none;';

    var inner = document.createElement('div');
    inner.style.cssText = 'position:relative;width:min(960px,96vw);height:min(720px,92vh);background:#FDF8F0;border-radius:16px;box-shadow:0 24px 96px rgba(0,0,0,0.42);overflow:hidden;pointer-events:auto;animation:nc-rise 0.22s ease-out;';

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('allow', 'camera; microphone; clipboard-write; fullscreen');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';

    var btn = document.createElement('button');
    btn.innerHTML = '&times;';
    btn.setAttribute('aria-label', 'Close');
    btn.style.cssText = 'position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:999px;border:0;background:rgba(13,27,42,0.85);color:#FDF8F0;font-size:22px;line-height:30px;cursor:pointer;z-index:2;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
    btn.onclick = close;

    inner.appendChild(iframe);
    inner.appendChild(btn);
    wrap.appendChild(inner);
    return wrap;
  }

  function injectStyles() {
    if (document.getElementById('nc-sdk-styles')) return;
    var s = document.createElement('style');
    s.id = 'nc-sdk-styles';
    s.textContent = '@keyframes nc-fade{from{opacity:0}to{opacity:1}}@keyframes nc-rise{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}';
    document.head.appendChild(s);
  }

  function startCeremony(opts) {
    opts = opts || {};
    if (!config.publishableKey) {
      console.error('[NotaryChain] init() must be called with publishableKey before startCeremony()');
      return;
    }
    injectStyles();

    fetch(API_BASE + '/api/sdk/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Publishable-Key': config.publishableKey,
      },
      body: JSON.stringify({
        document_name: opts.documentName,
        document_type: opts.documentType || 'general',
        signer_email: opts.signerEmail,
        signer_name: opts.signerName,
        template_id: opts.templateId,
        metadata: opts.metadata || {},
        return_url: opts.returnUrl,
      }),
    })
      .then(function(r) {
        if (!r.ok) return r.json().then(function(e) { throw e; });
        return r.json();
      })
      .then(function(data) {
        emit('ready', { sessionToken: data.session_token, mode: data.mode });
        activeBackdrop = makeBackdrop();
        activeFrame = makeFrame(data.embed_url);
        document.body.appendChild(activeBackdrop);
        document.body.appendChild(activeFrame);
        document.body.style.overflow = 'hidden';
        activeBackdrop.onclick = close;
      })
      .catch(function(err) {
        console.error('[NotaryChain] Session creation failed', err);
        emit('error', { error: err.detail || err.message || 'session_failed', raw: err });
      });
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object' || e.data.source !== 'notarychain-embed') return;
    var t = e.data.type;
    if (t === 'sealed') {
      emit('sealed', e.data.payload || {});
      setTimeout(close, 1500);
    } else if (t === 'signed') {
      emit('signed', e.data.payload || {});
    } else if (t === 'completed') {
      emit('completed', e.data.payload || {});
    } else if (t === 'error') {
      emit('error', e.data.payload || {});
    } else if (t === 'close') {
      close();
    }
  }, false);

  root.NotaryChain = {
    __loaded__: true,
    version: SDK_VERSION,
    init: function(opts) {
      opts = opts || {};
      if (!opts.publishableKey) {
        console.error('[NotaryChain] init() requires publishableKey');
        return;
      }
      config.publishableKey = opts.publishableKey;
      return root.NotaryChain;
    },
    startCeremony: startCeremony,
    on: on,
    close: close,
  };
})(window);
"""


@router.get("/v1/notarychain.js")
async def serve_sdk_js():
    js = (
        SDK_JS_TEMPLATE
        .replace("__API_BASE__", PUBLIC_BACKEND_URL)
        .replace("__VERSION__", SDK_VERSION)
    )
    return Response(
        content=js,
        media_type="application/javascript; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/usage")
async def get_usage(request: Request, current_user: User = Depends(get_current_user)):
    await enforce_feature_gate(request, "sdk_embed")
    keys = await db.sdk_keys.find(
        {"user_id": current_user.id}, {"_id": 0, "id": 1, "name": 1, "publishable_key": 1, "mode": 1, "usage_count": 1, "active": 1}
    ).to_list(50)
    total = sum(k.get("usage_count", 0) for k in keys)
    # 30-day session count
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sessions_30d = await db.sdk_sessions.count_documents({
        "owner_user_id": current_user.id,
        "created_at": {"$gte": cutoff},
    })
    sealed_30d = await db.sdk_sessions.count_documents({
        "owner_user_id": current_user.id,
        "status": "sealed",
        "created_at": {"$gte": cutoff},
    })
    return {
        "total_sessions": total,
        "sessions_30d": sessions_30d,
        "sealed_30d": sealed_30d,
        "keys": keys,
    }
