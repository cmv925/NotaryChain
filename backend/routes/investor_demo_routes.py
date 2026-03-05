"""
Investor Demo Routes
Password-protected demo access and contact form submission.
"""

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investor", tags=["investor"])

db: AsyncIOMotorDatabase = None

DEMO_PASSWORD = os.environ.get("INVESTOR_DEMO_PASSWORD", "NotaryChain2026")

def set_db(database):
    global db
    db = database


class DemoAccessRequest(BaseModel):
    password: str

class ContactRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = ""
    role: Optional[str] = ""
    message: Optional[str] = ""


@router.post("/verify")
async def verify_demo_access(body: DemoAccessRequest):
    """Verify investor demo password."""
    if body.password == DEMO_PASSWORD:
        return {"access": True, "token": "investor_verified"}
    raise HTTPException(status_code=401, detail="Invalid access code")


@router.post("/contact")
async def submit_contact(body: ContactRequest):
    """Submit investor contact form."""
    if not body.name.strip() or not body.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required")

    entry = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": body.email.strip(),
        "company": body.company or "",
        "role": body.role or "",
        "message": body.message or "",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "new",
    }
    await db.investor_contacts.insert_one(entry)
    entry.pop("_id", None)
    return {"message": "Thank you. We'll be in touch shortly.", "id": entry["id"]}


@router.get("/stats")
async def get_platform_stats():
    """Get live platform stats for the investor demo."""
    users = await db.users.count_documents({})
    documents = await db.documents.count_documents({})
    orgs = await db.organizations.count_documents({})
    templates = await db.templates.count_documents({}) if "templates" in await db.list_collection_names() else 5
    notary_requests = await db.notary_requests.count_documents({})
    transactions = await db.payment_transactions.count_documents({})

    return {
        "total_users": users,
        "total_documents": documents,
        "total_organizations": orgs,
        "total_templates": max(templates, 5),
        "total_notary_requests": notary_requests,
        "total_transactions": transactions,
        "platform_features": 67,
        "api_endpoints": 50,
        "integrations": 7,
        "rbac_permissions": 23,
        "webhook_event_types": 11,
    }
