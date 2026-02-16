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
    
    api_key = os.environ.get("RESEND_API_KEY", "")
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    
    return {
        "configured": bool(api_key),
        "api_key_set": api_key[:10] + "..." if api_key else None,
        "sender_email": sender_email,
        "note": "In test mode, emails only go to verified addresses. Configure a domain at resend.com/domains for production use."
    }
