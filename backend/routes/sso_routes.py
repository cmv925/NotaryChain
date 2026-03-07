"""
SSO (Single Sign-On) Authentication Routes
Simulated SAML/OIDC authentication flows for enterprise organizations.
Provides a mock Identity Provider for testing SSO configurations.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from auth import create_access_token
import uuid
import secrets
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["sso"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class SSODiscoverRequest(BaseModel):
    email: str

class SSOInitiateRequest(BaseModel):
    org_id: str
    email: str

class SSOCallbackRequest(BaseModel):
    session_id: str
    email: str
    full_name: Optional[str] = None

class SSOTestRequest(BaseModel):
    org_id: str


# --- Routes ---

@router.post("/discover")
async def discover_sso(body: SSODiscoverRequest):
    """Check if SSO is configured for a given email domain."""
    domain = body.email.split("@")[-1].lower() if "@" in body.email else ""
    if not domain:
        return {"sso_available": False, "message": "Invalid email format"}

    # Find orgs with SSO enabled and matching domain
    orgs = await db.organizations.find(
        {"sso_enabled": True},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "sso_config": 1}
    ).to_list(100)

    matching = []
    for org in orgs:
        allowed = org.get("sso_config", {}).get("sso_allowed_domains", [])
        if domain in [d.lower() for d in allowed]:
            matching.append({
                "org_id": org["id"],
                "org_name": org["name"],
                "org_slug": org.get("slug", ""),
                "provider": org.get("sso_config", {}).get("sso_provider", "oidc"),
            })

    if matching:
        return {"sso_available": True, "organizations": matching}
    return {"sso_available": False, "message": "No SSO configuration found for this domain"}


@router.post("/initiate")
async def initiate_sso(body: SSOInitiateRequest):
    """Start an SSO authentication flow (simulated)."""
    org = await db.organizations.find_one({"id": body.org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.get("sso_enabled"):
        raise HTTPException(status_code=400, detail="SSO is not enabled for this organization")

    sso_config = org.get("sso_config", {})
    allowed_domains = [d.lower() for d in sso_config.get("sso_allowed_domains", [])]
    email_domain = body.email.split("@")[-1].lower() if "@" in body.email else ""

    if allowed_domains and email_domain not in allowed_domains:
        raise HTTPException(status_code=403, detail=f"Email domain '{email_domain}' is not allowed for SSO with this organization")

    # Create SSO session in MongoDB
    session_id = secrets.token_urlsafe(32)
    await db.sso_sessions.insert_one({
        "session_id": session_id,
        "org_id": body.org_id,
        "org_name": org["name"],
        "email": body.email,
        "provider": sso_config.get("sso_provider", "oidc"),
        "issuer_url": sso_config.get("sso_issuer_url", ""),
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
    })

    # In a real implementation, this would redirect to the IdP
    # For simulation, we return the session info for the mock IdP page
    return {
        "session_id": session_id,
        "provider": sso_config.get("sso_provider", "oidc"),
        "org_name": org["name"],
        "issuer_url": sso_config.get("sso_issuer_url", ""),
        "redirect_url": f"/sso/authorize?session={session_id}",
        "message": "SSO flow initiated. Redirecting to identity provider...",
    }


@router.get("/session/{session_id}")
async def get_sso_session(session_id: str):
    """Get SSO session details (for mock IdP page)."""
    session = await db.sso_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="SSO session not found or expired")
    return {
        "session_id": session_id,
        "org_name": session["org_name"],
        "email": session["email"],
        "provider": session["provider"],
        "status": session["status"],
    }


@router.post("/callback")
async def sso_callback(body: SSOCallbackRequest):
    """
    Handle SSO callback (simulated IdP response).
    This simulates the IdP verifying the user and returning an assertion.
    In production, this would validate SAML assertions or OIDC tokens.
    """
    session = await db.sso_sessions.find_one({"session_id": body.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired SSO session")

    if session["status"] != "pending":
        raise HTTPException(status_code=400, detail="SSO session already processed")

    org_id = session["org_id"]
    email = body.email.lower().strip()

    # Verify email domain matches
    sso_config = {}
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if org:
        sso_config = org.get("sso_config", {})

    allowed_domains = [d.lower() for d in sso_config.get("sso_allowed_domains", [])]
    email_domain = email.split("@")[-1] if "@" in email else ""
    if allowed_domains and email_domain not in allowed_domains:
        await db.sso_sessions.update_one({"session_id": body.session_id}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    # Check if user exists
    user = await db.users.find_one({"email": email})

    if not user:
        # Auto-provision user via SSO (JIT provisioning)
        from auth import get_password_hash
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        random_pw = secrets.token_urlsafe(32)
        full_name = body.full_name or email.split("@")[0].replace(".", " ").title()

        user_doc = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "hashed_password": get_password_hash(random_pw),
            "is_active": True,
            "created_at": now,
            "sso_provisioned": True,
            "sso_org_id": org_id,
            "organizations": [{"org_id": org_id, "role": "member"}],
        }
        await db.users.insert_one(user_doc)

        # Auto-add as org member
        member = {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "role": "member",
            "status": "active",
            "joined_at": now,
            "joined_via": "sso",
        }
        await db.org_members.insert_one(member)
        await db.organizations.update_one({"id": org_id}, {"$inc": {"member_count": 1}})
        logger.info(f"SSO JIT provisioned user: {email} for org: {org_id}")
    else:
        # Check if user is already a member
        membership = await db.org_members.find_one(
            {"org_id": org_id, "user_id": user["id"], "status": "active"}
        )
        if not membership:
            # Auto-join org
            now = datetime.now(timezone.utc).isoformat()
            member = {
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "user_id": user["id"],
                "email": email,
                "full_name": user.get("full_name", email),
                "role": "member",
                "status": "active",
                "joined_at": now,
                "joined_via": "sso",
            }
            await db.org_members.insert_one(member)
            await db.organizations.update_one({"id": org_id}, {"$inc": {"member_count": 1}})
            await db.users.update_one(
                {"email": email},
                {"$addToSet": {"organizations": {"org_id": org_id, "role": "member"}}}
            )

    # Mark session complete
    await db.sso_sessions.update_one({"session_id": body.session_id}, {"$set": {"status": "completed"}})

    # Issue access token
    access_token = create_access_token(data={"sub": email})

    # Log SSO event
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"] if user else user_doc["id"],
        "action": "sso_login",
        "details": {
            "org_id": org_id,
            "org_name": session["org_name"],
            "provider": session["provider"],
            "email": email,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_email": email,
        "org_id": org_id,
        "org_name": session["org_name"],
        "provisioned": user is None,
        "message": "SSO authentication successful",
    }


@router.post("/test")
async def test_sso_config(body: SSOTestRequest, current_user: dict = Depends(get_current_user)):
    """Test SSO configuration for an organization (admin only)."""
    # Verify admin access
    membership = await db.org_members.find_one(
        {"org_id": body.org_id, "user_id": current_user.id, "status": "active"},
        {"_id": 0}
    )
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    org = await db.organizations.find_one({"id": body.org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.get("sso_enabled"):
        return {"success": False, "message": "SSO is not enabled for this organization"}

    config = org.get("sso_config", {})
    issues = []

    if not config.get("sso_provider"):
        issues.append("No SSO provider configured (OIDC or SAML)")
    if not config.get("sso_issuer_url"):
        issues.append("Issuer URL is not set")
    if not config.get("sso_client_id"):
        issues.append("Client ID is missing")
    if not config.get("sso_allowed_domains"):
        issues.append("No allowed email domains configured")

    if issues:
        return {
            "success": False,
            "message": "SSO configuration has issues",
            "issues": issues,
        }

    # Simulate connectivity test
    return {
        "success": True,
        "message": "SSO configuration is valid and ready",
        "provider": config.get("sso_provider"),
        "issuer_url": config.get("sso_issuer_url"),
        "allowed_domains": config.get("sso_allowed_domains", []),
        "test_timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Cleanup old sessions periodically (called from startup or scheduler)
async def cleanup_sso_sessions():
    """Remove expired SSO sessions (older than 10 minutes)."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    result = await db.sso_sessions.delete_many({"created_at": {"$lt": cutoff}})
    if result.deleted_count > 0:
        logger.info(f"Cleaned up {result.deleted_count} expired SSO sessions")
