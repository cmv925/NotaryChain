"""
Auth0 OIDC Routes
Handles Auth0 login, callback, and status.
"""

from fastapi import APIRouter, HTTPException, Request, Response
import secrets
import logging
import os
import httpx

from auth import create_access_token, set_auth_cookie
from routes.sso_common import (
    get_callback_base, sync_sso_user, log_sso_audit,
    create_sso_session, validate_sso_session, complete_sso_session, fail_sso_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso/auth0", tags=["sso-auth0"])

AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN", "")
AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET", "")


@router.get("/login")
async def auth0_login(request: Request):
    """Initiate Auth0 login — returns the Auth0 authorization URL."""
    if not AUTH0_DOMAIN or not AUTH0_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Auth0 is not configured")

    callback_base = get_callback_base(request)
    callback_url = f"{callback_base}/auth/callback"
    state = secrets.token_urlsafe(32)

    await create_sso_session(state, "auth0", callback_url)

    auth_url = (
        f"https://{AUTH0_DOMAIN}/authorize?"
        f"client_id={AUTH0_CLIENT_ID}&"
        f"response_type=code&"
        f"scope=openid%20profile%20email&"
        f"redirect_uri={callback_url}&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "state": state}


@router.post("/callback")
async def auth0_callback(request: Request, response: Response):
    """Exchange Auth0 authorization code for tokens, sync user, issue JWT."""
    body = await request.json()
    code = body.get("code")
    state = body.get("state")
    redirect_uri = body.get("redirect_uri")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    session = await validate_sso_session(state, "auth0")
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
        logger.error("Auth0 token exchange failed: %s", token_resp.text)
        await fail_sso_session(state)
        raise HTTPException(status_code=401, detail="Auth0 authentication failed")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    # Fetch user profile
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            f"https://{AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        logger.error("Auth0 userinfo failed: %s", userinfo_resp.text)
        raise HTTPException(status_code=401, detail="Failed to retrieve user profile")

    profile = userinfo_resp.json()
    auth0_sub = profile.get("sub", "")
    email = profile.get("email", "").lower().strip()
    full_name = profile.get("name") or profile.get("nickname") or email.split("@")[0]
    picture = profile.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Auth0 profile missing email")

    # Sync user
    user_id, provisioned = await sync_sso_user(email, full_name, picture, "auth0", auth0_sub)
    await complete_sso_session(state)
    await log_sso_audit(user_id, "auth0_login", {"email": email, "auth0_sub": auth0_sub, "provisioned": provisioned})

    jwt_token = create_access_token(data={"sub": email})
    set_auth_cookie(response, jwt_token)

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user_email": email,
        "full_name": full_name,
        "provisioned": provisioned,
        "message": "Auth0 authentication successful",
    }


@router.get("/status")
async def auth0_status():
    """Check if Auth0 is configured."""
    return {
        "configured": bool(AUTH0_DOMAIN and AUTH0_CLIENT_ID),
        "domain": AUTH0_DOMAIN if AUTH0_DOMAIN else None,
    }
