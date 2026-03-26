"""
Okta OIDC Routes
Handles Okta login, callback, and status.
"""

from fastapi import APIRouter, HTTPException, Request
import secrets
import logging
import os
import httpx

from auth import create_access_token
from routes.sso_common import (
    get_callback_base, sync_sso_user, log_sso_audit,
    create_sso_session, validate_sso_session, complete_sso_session, fail_sso_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso/okta", tags=["sso-okta"])

OKTA_DOMAIN = os.environ.get("OKTA_DOMAIN", "")
OKTA_CLIENT_ID = os.environ.get("OKTA_CLIENT_ID", "")
OKTA_CLIENT_SECRET = os.environ.get("OKTA_CLIENT_SECRET", "")


@router.get("/login")
async def okta_login(request: Request):
    """Initiate Okta login — returns the Okta authorization URL."""
    if not OKTA_DOMAIN or not OKTA_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Okta is not configured")

    callback_base = get_callback_base(request)
    callback_url = f"{callback_base}/auth/okta/callback"
    state = secrets.token_urlsafe(32)

    await create_sso_session(state, "okta", callback_url)

    auth_url = (
        f"https://{OKTA_DOMAIN}/oauth2/default/v1/authorize?"
        f"client_id={OKTA_CLIENT_ID}&"
        f"response_type=code&"
        f"scope=openid%20profile%20email&"
        f"redirect_uri={callback_url}&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "state": state}


@router.post("/callback")
async def okta_callback(request: Request):
    """Exchange Okta authorization code for tokens, sync user, issue JWT."""
    body = await request.json()
    code = body.get("code")
    state = body.get("state")
    redirect_uri = body.get("redirect_uri")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    session = await validate_sso_session(state, "okta")
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
        logger.error("Okta token exchange failed: %s", token_resp.text)
        await fail_sso_session(state)
        raise HTTPException(status_code=401, detail="Okta authentication failed")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    # Fetch user profile
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            f"https://{OKTA_DOMAIN}/oauth2/default/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        logger.error("Okta userinfo failed: %s", userinfo_resp.text)
        raise HTTPException(status_code=401, detail="Failed to retrieve user profile")

    profile = userinfo_resp.json()
    okta_sub = profile.get("sub", "")
    email = profile.get("email", "").lower().strip()
    full_name = profile.get("name") or f"{profile.get('given_name', '')} {profile.get('family_name', '')}".strip() or email.split("@")[0]
    picture = profile.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Okta profile missing email")

    # Sync user
    user_id, provisioned = await sync_sso_user(email, full_name, picture, "okta", okta_sub)
    await complete_sso_session(state)
    await log_sso_audit(user_id, "okta_login", {"email": email, "okta_sub": okta_sub, "provisioned": provisioned})

    jwt_token = create_access_token(data={"sub": email})

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user_email": email,
        "full_name": full_name,
        "provisioned": provisioned,
        "message": "Okta authentication successful",
    }


@router.get("/status")
async def okta_status():
    """Check if Okta is configured."""
    return {
        "configured": bool(OKTA_DOMAIN and OKTA_CLIENT_ID),
        "domain": OKTA_DOMAIN if OKTA_DOMAIN else None,
    }
