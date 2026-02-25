"""
API Key Management Routes
Generate, list, and revoke API keys for public API access
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Security
from fastapi.security import APIKeyHeader
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from models import User
from routes.auth_routes import get_current_user
from datetime import datetime, timezone
import uuid
import hashlib
import secrets
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/developer", tags=["developer"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class CreateKeyRequest(BaseModel):
    name: str
    scopes: list = ["read", "seal", "verify"]

class RevokeKeyRequest(BaseModel):
    key_id: str


# --- API Key Auth Dependency ---

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def get_api_key_user(api_key: str = Security(api_key_header)):
    """Authenticate a request using an API key. Returns (user_doc, key_doc) or raises 401."""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required. Pass X-API-Key header.")

    hashed = _hash_key(api_key)
    key_doc = await db.api_keys.find_one({"key_hash": hashed, "revoked": False})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    # Update last_used
    await db.api_keys.update_one(
        {"_id": key_doc["_id"]},
        {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
         "$inc": {"usage_count": 1}}
    )

    user_doc = await db.users.find_one({"id": key_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="API key owner not found")

    return user_doc, key_doc


# --- Management endpoints (JWT-authenticated) ---

@router.post("/keys")
async def create_api_key(
    body: CreateKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate a new API key"""
    # Limit keys per user
    count = await db.api_keys.count_documents({"user_id": current_user.id, "revoked": False})
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 active API keys allowed")

    raw_key = f"nc_{'live' if True else 'test'}_{secrets.token_hex(24)}"
    key_id = str(uuid.uuid4())

    await db.api_keys.insert_one({
        "id": key_id,
        "user_id": current_user.id,
        "name": body.name[:50],
        "key_hash": _hash_key(raw_key),
        "key_prefix": raw_key[:12],
        "scopes": body.scopes,
        "revoked": False,
        "usage_count": 0,
        "last_used_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info(f"API key created for user {current_user.email}: {key_id}")

    return {
        "id": key_id,
        "name": body.name,
        "key": raw_key,
        "key_prefix": raw_key[:12],
        "scopes": body.scopes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": "Store this key securely. It will not be shown again.",
    }


@router.get("/keys")
async def list_api_keys(current_user: User = Depends(get_current_user)):
    """List all API keys for the current user"""
    keys = await db.api_keys.find(
        {"user_id": current_user.id},
        {"_id": 0, "key_hash": 0}
    ).sort("created_at", -1).to_list(20)
    return {"keys": keys}


@router.delete("/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revoke an API key"""
    result = await db.api_keys.update_one(
        {"id": key_id, "user_id": current_user.id, "revoked": False},
        {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Key not found or already revoked")
    return {"success": True, "message": "API key revoked"}


@router.get("/usage")
async def get_api_usage(current_user: User = Depends(get_current_user)):
    """Get API usage stats for the current user"""
    keys = await db.api_keys.find(
        {"user_id": current_user.id, "revoked": False},
        {"_id": 0, "id": 1, "name": 1, "usage_count": 1, "last_used_at": 1}
    ).to_list(10)

    total_calls = sum(k.get("usage_count", 0) for k in keys)
    api_logs = await db.api_logs.find(
        {"user_id": current_user.id}
    ).sort("timestamp", -1).limit(20).to_list(20)
    clean_logs = [{k: v for k, v in log.items() if k != "_id"} for log in api_logs]

    return {
        "total_calls": total_calls,
        "active_keys": len(keys),
        "keys": keys,
        "recent_activity": clean_logs,
    }
