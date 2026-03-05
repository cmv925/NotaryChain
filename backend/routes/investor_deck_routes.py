"""
Investor Deck Routes - Password-protected investor presentation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import logging

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
async def verify_password(req: PasswordVerifyRequest):
    correct = os.environ.get("INVESTOR_DECK_PASSWORD", "NotaryChain2026!")
    if req.password != correct:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"verified": True}


@router.post("/contact")
async def submit_contact(req: ContactFormRequest):
    try:
        from services.email_service import email_service

        html = f"""
        <h2>New Investor Inquiry - NotaryChain</h2>
        <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">{req.name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">{req.email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Company</td><td style="padding:8px">{req.company}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Message</td><td style="padding:8px">{req.message}</td></tr>
        </table>
        """

        sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        await email_service.send_email(
            to_email=sender_email,
            subject=f"Investor Inquiry from {req.name} ({req.company})",
            html_content=html,
        )

        # Store in DB for record keeping
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
