"""
SSO Common Utilities
Shared helpers, models, and user sync logic used by Auth0, Okta, and Enterprise SSO routes.
"""

from fastapi import Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth import create_access_token, get_password_hash
from datetime import datetime, timezone
import uuid
import secrets
import logging
import os

logger = logging.getLogger(__name__)

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


def get_callback_base(request: Request):
    """Extract frontend base URL from request headers, handling K8s ingress."""
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}"

    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin.rstrip("/").split("?")[0].split("#")[0])
        if parsed.netloc and "cluster-" not in parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"

    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if backend_url:
        return backend_url.rstrip("/")

    return os.environ.get("FRONTEND_URL", "http://localhost:3000")


async def sync_sso_user(email: str, full_name: str, picture: str, provider: str, provider_sub: str):
    """
    JIT provision or update a user from an SSO provider.
    Returns (user_id, provisioned: bool).
    """
    user = await db.users.find_one({"email": email})
    now = datetime.now(timezone.utc).isoformat()

    if not user:
        user_id = str(uuid.uuid4())
        random_pw = secrets.token_urlsafe(32)
        user_doc = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "hashed_password": get_password_hash(random_pw),
            "is_active": True,
            "created_at": now,
            f"{provider}_sub": provider_sub,
            "auth_method": provider,
            "profile_picture": picture,
            "sso_provisioned": True,
        }
        await db.users.insert_one(user_doc)
        logger.info(f"{provider.capitalize()} JIT provisioned user: {email} (sub: {provider_sub})")
        return user_id, True
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {
                f"{provider}_sub": provider_sub,
                "profile_picture": picture,
                "last_login": now,
                "last_login_method": provider,
            }}
        )
        return user["id"], False


async def log_sso_audit(user_id: str, action: str, details: dict):
    """Create an audit log entry for an SSO event."""
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def create_sso_session(state: str, sso_type: str, callback_url: str):
    """Store an SSO session for CSRF protection."""
    await db.sso_sessions.insert_one({
        "session_id": state,
        "type": sso_type,
        "callback_url": callback_url,
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
    })


async def validate_sso_session(state: str, sso_type: str):
    """Validate and return an SSO session, or None if invalid."""
    return await db.sso_sessions.find_one(
        {"session_id": state, "type": sso_type, "status": "pending"}
    )


async def complete_sso_session(state: str):
    """Mark an SSO session as completed."""
    await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "completed"}})


async def fail_sso_session(state: str):
    """Mark an SSO session as failed."""
    await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "failed"}})
