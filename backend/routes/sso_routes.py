"""
SSO (Single Sign-On) Authentication Routes
Supports real Auth0 OIDC authentication and simulated SAML/OIDC flows for enterprise organizations.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from auth import create_access_token, get_password_hash
import uuid
import secrets
import logging
import os
import httpx

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["sso"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

# Auth0 config
AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN", "")
AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET", "")

# Okta config
OKTA_DOMAIN = os.environ.get("OKTA_DOMAIN", "")
OKTA_CLIENT_ID = os.environ.get("OKTA_CLIENT_ID", "")
OKTA_CLIENT_SECRET = os.environ.get("OKTA_CLIENT_SECRET", "")


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


# --- Auth0 OIDC Routes ---

@router.get("/auth0/login")
async def auth0_login(request: Request):
    """Initiate Auth0 login — returns the Auth0 authorization URL."""
    if not AUTH0_DOMAIN or not AUTH0_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Auth0 is not configured")

    callback_base = _get_callback_base(request)
    callback_url = f"{callback_base}/auth/callback"
    state = secrets.token_urlsafe(32)

    # Store state for CSRF protection
    await db.sso_sessions.insert_one({
        "session_id": state,
        "type": "auth0",
        "callback_url": callback_url,
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
    })

    auth_url = (
        f"https://{AUTH0_DOMAIN}/authorize?"
        f"client_id={AUTH0_CLIENT_ID}&"
        f"response_type=code&"
        f"scope=openid%20profile%20email&"
        f"redirect_uri={callback_url}&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "state": state}


@router.post("/auth0/callback")
async def auth0_callback(request: Request):
    """Exchange Auth0 authorization code for tokens, sync user, issue JWT."""
    body = await request.json()
    code = body.get("code")
    state = body.get("state")
    redirect_uri = body.get("redirect_uri")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    # Verify state (CSRF protection)
    session = await db.sso_sessions.find_one({"session_id": state, "type": "auth0", "status": "pending"})
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    callback_url = redirect_uri or session.get("callback_url", "")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": AUTH0_CLIENT_ID,
                "client_secret": AUTH0_CLIENT_SECRET,
                "code": code,
                "redirect_uri": callback_url,
            },
            headers={"Content-Type": "application/json"},
        )

    if token_resp.status_code != 200:
        logger.error(f"Auth0 token exchange failed: {token_resp.text}")
        await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=401, detail="Auth0 authentication failed")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    # Fetch user profile from Auth0
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            f"https://{AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        logger.error(f"Auth0 userinfo failed: {userinfo_resp.text}")
        raise HTTPException(status_code=401, detail="Failed to retrieve user profile")

    auth0_profile = userinfo_resp.json()
    auth0_sub = auth0_profile.get("sub", "")
    email = auth0_profile.get("email", "").lower().strip()
    full_name = auth0_profile.get("name") or auth0_profile.get("nickname") or email.split("@")[0]
    picture = auth0_profile.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Auth0 profile missing email")

    # Sync user in MongoDB
    user = await db.users.find_one({"email": email})
    now = datetime.now(timezone.utc).isoformat()

    if not user:
        # Create new user (JIT provisioning)
        user_id = str(uuid.uuid4())
        random_pw = secrets.token_urlsafe(32)
        user_doc = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "hashed_password": get_password_hash(random_pw),
            "is_active": True,
            "created_at": now,
            "auth0_sub": auth0_sub,
            "auth_method": "auth0",
            "profile_picture": picture,
            "sso_provisioned": True,
        }
        await db.users.insert_one(user_doc)
        logger.info(f"Auth0 JIT provisioned user: {email} (sub: {auth0_sub})")
        provisioned = True
    else:
        # Update existing user with Auth0 info
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "auth0_sub": auth0_sub,
                "profile_picture": picture,
                "last_login": now,
                "last_login_method": "auth0",
            }}
        )
        user_id = user["id"]
        provisioned = False

    # Mark session completed
    await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "completed"}})

    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": "auth0_login",
        "details": {"email": email, "auth0_sub": auth0_sub, "provisioned": provisioned},
        "timestamp": now,
    })

    # Issue our JWT
    jwt_token = create_access_token(data={"sub": email})

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user_email": email,
        "full_name": full_name,
        "provisioned": provisioned,
        "message": "Auth0 authentication successful",
    }


@router.get("/auth0/status")
async def auth0_status():
    """Check if Auth0 is configured."""
    return {
        "configured": bool(AUTH0_DOMAIN and AUTH0_CLIENT_ID),
        "domain": AUTH0_DOMAIN if AUTH0_DOMAIN else None,
    }


# --- Okta OIDC Routes ---

def _get_callback_base(request: Request):
    """Extract frontend base URL from request headers, handling K8s ingress."""
    # Try X-Forwarded headers first (set by K8s ingress)
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}"

    # Try origin header
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin.rstrip("/").split("?")[0].split("#")[0])
        if parsed.netloc and "cluster-" not in parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"

    # Fallback to REACT_APP_BACKEND_URL (which is the public URL)
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if backend_url:
        return backend_url.rstrip("/")

    return os.environ.get("FRONTEND_URL", "http://localhost:3000")


@router.get("/okta/login")
async def okta_login(request: Request):
    """Initiate Okta login — returns the Okta authorization URL."""
    if not OKTA_DOMAIN or not OKTA_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Okta is not configured")

    callback_base = _get_callback_base(request)
    callback_url = f"{callback_base}/auth/okta/callback"
    state = secrets.token_urlsafe(32)

    await db.sso_sessions.insert_one({
        "session_id": state,
        "type": "okta",
        "callback_url": callback_url,
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
    })

    auth_url = (
        f"https://{OKTA_DOMAIN}/oauth2/default/v1/authorize?"
        f"client_id={OKTA_CLIENT_ID}&"
        f"response_type=code&"
        f"scope=openid%20profile%20email&"
        f"redirect_uri={callback_url}&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "state": state}


@router.post("/okta/callback")
async def okta_callback(request: Request):
    """Exchange Okta authorization code for tokens, sync user, issue JWT."""
    body = await request.json()
    code = body.get("code")
    state = body.get("state")
    redirect_uri = body.get("redirect_uri")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    session = await db.sso_sessions.find_one({"session_id": state, "type": "okta", "status": "pending"})
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    callback_url = redirect_uri or session.get("callback_url", "")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"https://{OKTA_DOMAIN}/oauth2/default/v1/token",
            data={
                "grant_type": "authorization_code",
                "client_id": OKTA_CLIENT_ID,
                "client_secret": OKTA_CLIENT_SECRET,
                "code": code,
                "redirect_uri": callback_url,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if token_resp.status_code != 200:
        logger.error(f"Okta token exchange failed: {token_resp.text}")
        await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=401, detail="Okta authentication failed")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    # Fetch user profile from Okta
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            f"https://{OKTA_DOMAIN}/oauth2/default/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        logger.error(f"Okta userinfo failed: {userinfo_resp.text}")
        raise HTTPException(status_code=401, detail="Failed to retrieve user profile")

    okta_profile = userinfo_resp.json()
    okta_sub = okta_profile.get("sub", "")
    email = okta_profile.get("email", "").lower().strip()
    full_name = okta_profile.get("name") or f"{okta_profile.get('given_name', '')} {okta_profile.get('family_name', '')}".strip() or email.split("@")[0]
    picture = okta_profile.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Okta profile missing email")

    # Sync user in MongoDB
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
            "okta_sub": okta_sub,
            "auth_method": "okta",
            "profile_picture": picture,
            "sso_provisioned": True,
        }
        await db.users.insert_one(user_doc)
        logger.info(f"Okta JIT provisioned user: {email} (sub: {okta_sub})")
        provisioned = True
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "okta_sub": okta_sub,
                "profile_picture": picture,
                "last_login": now,
                "last_login_method": "okta",
            }}
        )
        user_id = user["id"]
        provisioned = False

    await db.sso_sessions.update_one({"session_id": state}, {"$set": {"status": "completed"}})

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": "okta_login",
        "details": {"email": email, "okta_sub": okta_sub, "provisioned": provisioned},
        "timestamp": now,
    })

    jwt_token = create_access_token(data={"sub": email})

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user_email": email,
        "full_name": full_name,
        "provisioned": provisioned,
        "message": "Okta authentication successful",
    }


@router.get("/okta/status")
async def okta_status():
    """Check if Okta is configured."""
    return {
        "configured": bool(OKTA_DOMAIN and OKTA_CLIENT_ID),
        "domain": OKTA_DOMAIN if OKTA_DOMAIN else None,
    }


@router.get("/providers")
async def sso_providers():
    """List all configured SSO providers."""
    providers = []
    if AUTH0_DOMAIN and AUTH0_CLIENT_ID:
        providers.append({"name": "Auth0", "type": "auth0", "configured": True})
    if OKTA_DOMAIN and OKTA_CLIENT_ID:
        providers.append({"name": "Okta", "type": "okta", "configured": True})
    return {"providers": providers}


# Cleanup old sessions periodically (called from startup or scheduler)
async def cleanup_sso_sessions():
    """Remove expired SSO sessions (older than 10 minutes)."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    result = await db.sso_sessions.delete_many({"created_at": {"$lt": cutoff}})
    if result.deleted_count > 0:
        logger.info(f"Cleaned up {result.deleted_count} expired SSO sessions")
