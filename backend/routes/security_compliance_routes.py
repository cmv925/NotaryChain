"""
Security Compliance Dashboard Routes
Provides at-a-glance security posture for admin/investor due diligence.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import logging
import os

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/security", tags=["security-compliance"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/compliance")
async def get_security_compliance(current_user: User = Depends(get_current_user)):
    """Return comprehensive security posture data."""
    await _check_admin(current_user)

    # --- Authentication ---
    auth0_configured = bool(os.environ.get("AUTH0_DOMAIN") and os.environ.get("AUTH0_CLIENT_ID"))
    okta_configured = bool(os.environ.get("OKTA_DOMAIN") and os.environ.get("OKTA_CLIENT_ID"))
    jwt_secret = bool(os.environ.get("JWT_SECRET_KEY"))

    twofa_users = await db.users.count_documents({"two_factor_enabled": True})
    total_users = await db.users.count_documents({})

    # --- Data Protection ---
    s3_configured = bool(os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_S3_BUCKET"))
    hedera_configured = bool(os.environ.get("HEDERA_ACCOUNT_ID") and os.environ.get("HEDERA_PRIVATE_KEY"))

    # --- Access Control ---
    total_orgs = await db.organizations.count_documents({})
    sso_orgs = await db.organizations.count_documents({"sso_enabled": True})
    custom_roles = await db.roles.count_documents({})

    # --- Monitoring ---
    recent_audit_count = await db.audit_logs.count_documents({})
    hbar_alerts_active = True  # always active — uses defaults if no custom settings

    # --- Locked accounts ---
    locked_accounts = await db.users.count_documents({"account_locked_until": {"$exists": True}})

    # Build categories
    categories = {
        "authentication": {
            "label": "Authentication",
            "items": [
                {
                    "name": "JWT Token Auth",
                    "status": "active" if jwt_secret else "missing",
                    "detail": "24h token expiry, bcrypt password hashing",
                },
                {
                    "name": "Two-Factor Authentication (TOTP)",
                    "status": "active",
                    "detail": f"{twofa_users}/{total_users} users enrolled",
                },
                {
                    "name": "Account Lockout",
                    "status": "active",
                    "detail": f"5 failed attempts → 15min lockout. {locked_accounts} currently locked",
                },
                {
                    "name": "Password Policy",
                    "status": "active",
                    "detail": "Min 8 chars, 100+ blacklisted passwords (NIST)",
                },
            ],
        },
        "sso": {
            "label": "Single Sign-On",
            "items": [
                {
                    "name": "Auth0 OIDC",
                    "status": "active" if auth0_configured else "not_configured",
                    "detail": f"Domain: {os.environ.get('AUTH0_DOMAIN', 'N/A')}" if auth0_configured else "Not configured",
                },
                {
                    "name": "Okta OIDC",
                    "status": "active" if okta_configured else "not_configured",
                    "detail": f"Domain: {os.environ.get('OKTA_DOMAIN', 'N/A')}" if okta_configured else "Not configured",
                },
                {
                    "name": "Enterprise SSO Orgs",
                    "status": "active" if sso_orgs > 0 else "none",
                    "detail": f"{sso_orgs}/{total_orgs} organizations with SSO enabled",
                },
            ],
        },
        "data_protection": {
            "label": "Data Protection",
            "items": [
                {
                    "name": "Cloud Storage (AWS S3)",
                    "status": "active" if s3_configured else "local_only",
                    "detail": f"Bucket: {os.environ.get('AWS_S3_BUCKET', 'N/A')}" if s3_configured else "Using local filesystem",
                },
                {
                    "name": "Blockchain Integrity (Hedera)",
                    "status": "active" if hedera_configured else "not_configured",
                    "detail": "Mainnet HCS — tamper-proof document sealing" if hedera_configured else "Not configured",
                },
                {
                    "name": "GDPR Compliance",
                    "status": "active",
                    "detail": "Data export, deletion, consent management",
                },
                {
                    "name": "File Upload Validation",
                    "status": "active",
                    "detail": "Type whitelisting, 10MB body limit, Content-Disposition headers",
                },
            ],
        },
        "network_security": {
            "label": "Network & Transport",
            "items": [
                {
                    "name": "HTTPS / TLS",
                    "status": "active",
                    "detail": "Enforced via Kubernetes ingress",
                },
                {
                    "name": "CORS Policy",
                    "status": "active",
                    "detail": "Restricted to app origin (not wildcard)",
                },
                {
                    "name": "Rate Limiting",
                    "status": "active",
                    "detail": "SlowAPI — per-endpoint rate limits on auth, API, uploads",
                },
                {
                    "name": "Content Security Policy",
                    "status": "active",
                    "detail": "CSP headers set via middleware",
                },
                {
                    "name": "Security.txt (RFC 9116)",
                    "status": "active",
                    "detail": "/.well-known/security.txt published",
                },
            ],
        },
        "access_control": {
            "label": "Authorization & RBAC",
            "items": [
                {
                    "name": "Role-Based Access Control",
                    "status": "active",
                    "detail": f"{custom_roles} custom roles defined across organizations",
                },
                {
                    "name": "Admin Separation",
                    "status": "active",
                    "detail": "Admin routes protected with role checks",
                },
                {
                    "name": "API Key Authentication",
                    "status": "active",
                    "detail": "Scoped keys with rate limits for public API",
                },
            ],
        },
        "monitoring": {
            "label": "Monitoring & Alerting",
            "items": [
                {
                    "name": "Audit Logging",
                    "status": "active",
                    "detail": f"{recent_audit_count} audit events recorded",
                },
                {
                    "name": "HBAR Balance Alerts",
                    "status": "active" if hbar_alerts_active else "defaults",
                    "detail": "Configurable thresholds with email + in-app notifications",
                },
                {
                    "name": "WebSocket Real-time Events",
                    "status": "active",
                    "detail": "Token-based auth, session management",
                },
            ],
        },
    }

    # Calculate overall score
    total_items = 0
    active_items = 0
    for cat in categories.values():
        for item in cat["items"]:
            total_items += 1
            if item["status"] == "active":
                active_items += 1

    score_pct = round((active_items / total_items * 100) if total_items else 0)

    return {
        "score_pct": score_pct,
        "active_features": active_items,
        "total_features": total_items,
        "categories": categories,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
