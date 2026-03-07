"""
Investor Deck Routes - Password-protected investor presentation
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from html import escape
import os
import logging

from middleware.security import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investor-deck", tags=["investor-deck"])

db = None

def set_db(database):
    global db
    db = database


class PasswordVerifyRequest(BaseModel):
    password: str


class ContactFormRequest(BaseModel):
    name: str
    email: str
    company: str
    message: str


@router.post("/verify-password")
@limiter.limit("5/minute")
async def verify_password(request: Request, req: PasswordVerifyRequest):
    import hmac
    correct = os.environ.get("INVESTOR_DECK_PASSWORD", "NotaryChain2026!")
    if not hmac.compare_digest(req.password, correct):
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"verified": True}


@router.post("/contact")
@limiter.limit("5/minute")
async def submit_contact(request: Request, req: ContactFormRequest):
    try:
        from services.email_service import email_service

        safe_name = escape(req.name)
        safe_email = escape(req.email)
        safe_company = escape(req.company)
        safe_message = escape(req.message)

        html = f"""
        <h2>New Investor Inquiry - NotaryChain</h2>
        <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">{safe_name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">{safe_email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Company</td><td style="padding:8px">{safe_company}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Message</td><td style="padding:8px">{safe_message}</td></tr>
        </table>
        """

        sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        await email_service.send_email(
            to_email=sender_email,
            subject=f"Investor Inquiry from {safe_name} ({safe_company})",
            html_content=html,
        )

        from datetime import datetime, timezone
        await db.investor_inquiries.insert_one({
            "name": req.name,
            "email": req.email,
            "company": req.company,
            "message": req.message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        return {"success": True, "message": "Thank you for your interest. We'll be in touch shortly."}
    except Exception as e:
        logger.error(f"Contact form error: {e}")
        return {"success": True, "message": "Thank you for your interest. We'll be in touch shortly."}
