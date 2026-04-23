"""
Email Routes for testing and administration
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from models import User
from routes.auth_routes import get_current_user
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class TestEmailRequest(BaseModel):
    recipient_email: EmailStr
    email_type: str  # welcome, notarization_complete, application_submitted, application_approved, application_rejected


class CustomEmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    html_content: str


@router.post("/test")
async def send_test_email(
    request: TestEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Send a test email of a specific type.
    Admin only endpoint for testing email templates.
    """
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    email_type = request.email_type
    recipient = request.recipient_email
    full_name = "Test User"
    
    result = None
    
    if email_type == "welcome":
        result = await email_service.send_welcome_email(recipient, full_name)
    
    elif email_type == "notarization_complete":
        result = await email_service.send_notarization_complete_email(
            email=recipient,
            full_name=full_name,
            request_id="test-request-12345678",
            document_type="Power of Attorney",
            seal_hash="abc123def456789...",
            hcs_topic_id="0.0.123456"
        )
    
    elif email_type == "application_submitted":
        result = await email_service.send_application_submitted_email(recipient, full_name)
    
    elif email_type == "application_approved":
        result = await email_service.send_application_approved_email(
            email=recipient,
            full_name=full_name,
            commission_number="NC-2024-12345"
        )
    
    elif email_type == "application_rejected":
        result = await email_service.send_application_rejected_email(
            email=recipient,
            full_name=full_name,
            reason="Incomplete documentation. Please resubmit with valid commission certificate."
        )
    
    elif email_type == "request_assigned":
        result = await email_service.send_request_assigned_email(
            email=recipient,
            full_name=full_name,
            request_id="test-request-12345678",
            notary_name="John Smith, Notary Public",
            document_type="Real Estate Contract"
        )
    
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Unknown email type: {email_type}. Valid types: welcome, notarization_complete, application_submitted, application_approved, application_rejected, request_assigned"
        )
    
    return {
        "message": f"Test email '{email_type}' sent",
        "result": result
    }


@router.post("/send-custom")
async def send_custom_email(
    request: CustomEmailRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send a custom email. Admin only.
    """
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await email_service.send_email(
        to_email=request.recipient_email,
        subject=request.subject,
        html_content=request.html_content
    )
    
    return {
        "message": "Custom email sent",
        "result": result
    }


@router.get("/status")
async def get_email_service_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get email service configuration status.
    """
    import os
    from services.email_service import EMAIL_MODE, SENDER_EMAIL

    default_key = os.environ.get("RESEND_API_KEY", "")
    custom_key = os.environ.get("RESEND_API_KEY_CUSTOM", "")
    custom_sender = os.environ.get("CUSTOM_SENDER_EMAIL", "")
    custom_domain = os.environ.get("CUSTOM_EMAIL_DOMAIN", "")

    return {
        "configured": bool(default_key or custom_key),
        "mode": EMAIL_MODE,
        "active_sender": SENDER_EMAIL,
        "default_key_set": bool(default_key),
        "custom_key_set": bool(custom_key),
        "custom_sender": custom_sender or None,
        "custom_domain": custom_domain or None,
        "note": (
            "Custom domain ACTIVE — using email.notarychain.app"
            if EMAIL_MODE == "custom_domain"
            else "Sandbox mode — add RESEND_API_KEY_CUSTOM to activate email.notarychain.app"
        ),
    }


@router.get("/domain-status")
async def get_custom_domain_status(
    current_user: User = Depends(get_current_user)
):
    """
    Query Resend's domains API for verification status of the custom NotaryChain domain.
    Admin only. Requires RESEND_API_KEY (or custom key) to be set.
    """
    import os
    import httpx

    # Admin gate
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    custom_domain = os.environ.get("CUSTOM_EMAIL_DOMAIN", "email.notarychain.app")
    # Prefer custom key if set, otherwise use the default key to query domains
    api_key = os.environ.get("RESEND_API_KEY_CUSTOM") or os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="No Resend API key configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if resp.status_code != 200:
            return {
                "domain": custom_domain,
                "verified": False,
                "status": "unknown",
                "error": f"Resend API returned {resp.status_code}",
                "raw": resp.text[:500],
            }
        data = resp.json()
        domains = data.get("data", []) if isinstance(data, dict) else []
        match = next((d for d in domains if d.get("name") == custom_domain), None)
        if not match:
            return {
                "domain": custom_domain,
                "verified": False,
                "status": "not_found",
                "setup_url": "https://resend.com/domains",
                "instructions": (
                    f"Go to resend.com/domains and add '{custom_domain}'. "
                    "Then configure the DNS records shown in the Resend dashboard (MX, SPF/TXT, DKIM, DMARC) "
                    "on your DNS provider for notarychain.app. Verification usually completes within minutes."
                ),
                "all_domains": [d.get("name") for d in domains],
            }
        status_val = match.get("status", "unknown")
        return {
            "domain": custom_domain,
            "verified": status_val == "verified",
            "status": status_val,
            "region": match.get("region"),
            "created_at": match.get("created_at"),
            "records": match.get("records", []),
        }
    except Exception as e:
        logger.error(f"Failed to query Resend domain status: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to query Resend: {str(e)}")
