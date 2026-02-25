"""
Document Template Library
Pre-built legal document templates for quick notarization requests.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["templates"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


DEFAULT_TEMPLATES = [
    {
        "id": "tpl_power_of_attorney",
        "name": "General Power of Attorney",
        "category": "legal",
        "document_type": "power_of_attorney",
        "description": "Grants broad authority to an agent to act on behalf of the principal in legal, financial, and business matters.",
        "fields": [
            {"name": "principal_name", "label": "Principal (Grantor) Full Name", "type": "text", "required": True},
            {"name": "agent_name", "label": "Agent (Attorney-in-Fact) Full Name", "type": "text", "required": True},
            {"name": "powers_granted", "label": "Specific Powers Granted", "type": "textarea", "required": True, "placeholder": "e.g., manage financial accounts, sign documents, sell property..."},
            {"name": "effective_date", "label": "Effective Date", "type": "date", "required": True},
            {"name": "expiration_date", "label": "Expiration Date (if any)", "type": "date", "required": False},
            {"name": "state", "label": "State of Execution", "type": "text", "required": True},
        ],
        "icon": "scale",
        "estimated_time": "15-20 min",
        "notarization_required": True,
        "signers_needed": 2,
        "popular": True,
    },
    {
        "id": "tpl_lease_agreement",
        "name": "Residential Lease Agreement",
        "category": "real_estate",
        "document_type": "real_estate",
        "description": "Standard residential lease agreement between landlord and tenant, covering rent, terms, and property rules.",
        "fields": [
            {"name": "landlord_name", "label": "Landlord Full Name", "type": "text", "required": True},
            {"name": "tenant_name", "label": "Tenant Full Name", "type": "text", "required": True},
            {"name": "property_address", "label": "Property Address", "type": "textarea", "required": True},
            {"name": "monthly_rent", "label": "Monthly Rent ($)", "type": "number", "required": True},
            {"name": "lease_start", "label": "Lease Start Date", "type": "date", "required": True},
            {"name": "lease_end", "label": "Lease End Date", "type": "date", "required": True},
            {"name": "security_deposit", "label": "Security Deposit ($)", "type": "number", "required": True},
            {"name": "special_terms", "label": "Special Terms & Conditions", "type": "textarea", "required": False},
        ],
        "icon": "home",
        "estimated_time": "20-30 min",
        "notarization_required": False,
        "signers_needed": 2,
        "popular": True,
    },
    {
        "id": "tpl_affidavit",
        "name": "General Affidavit",
        "category": "legal",
        "document_type": "affidavit",
        "description": "A sworn written statement of facts, confirmed by oath or affirmation, for use as evidence in court or legal proceedings.",
        "fields": [
            {"name": "affiant_name", "label": "Affiant (Person Making Statement) Name", "type": "text", "required": True},
            {"name": "affiant_address", "label": "Affiant Address", "type": "textarea", "required": True},
            {"name": "statement_of_facts", "label": "Statement of Facts", "type": "textarea", "required": True, "placeholder": "State the facts you are swearing to be true..."},
            {"name": "purpose", "label": "Purpose of Affidavit", "type": "text", "required": True, "placeholder": "e.g., court proceeding, immigration, insurance claim..."},
            {"name": "date_of_events", "label": "Date of Events Referenced", "type": "date", "required": False},
        ],
        "icon": "file-check",
        "estimated_time": "10-15 min",
        "notarization_required": True,
        "signers_needed": 1,
        "popular": True,
    },
    {
        "id": "tpl_last_will",
        "name": "Last Will & Testament",
        "category": "estate",
        "document_type": "will",
        "description": "A legal document expressing how a person wishes to distribute their assets and property after death.",
        "fields": [
            {"name": "testator_name", "label": "Testator (Will Maker) Full Name", "type": "text", "required": True},
            {"name": "executor_name", "label": "Executor Full Name", "type": "text", "required": True},
            {"name": "beneficiaries", "label": "Beneficiaries & Distributions", "type": "textarea", "required": True, "placeholder": "List each beneficiary and what they receive..."},
            {"name": "guardian_for_minors", "label": "Guardian for Minor Children (if applicable)", "type": "text", "required": False},
            {"name": "special_instructions", "label": "Special Instructions", "type": "textarea", "required": False},
            {"name": "state", "label": "State of Residence", "type": "text", "required": True},
        ],
        "icon": "scroll",
        "estimated_time": "25-35 min",
        "notarization_required": True,
        "signers_needed": 3,
        "popular": False,
    },
    {
        "id": "tpl_nda",
        "name": "Non-Disclosure Agreement (NDA)",
        "category": "business",
        "document_type": "contract",
        "description": "Protects confidential information shared between parties during business discussions or partnerships.",
        "fields": [
            {"name": "disclosing_party", "label": "Disclosing Party Name", "type": "text", "required": True},
            {"name": "receiving_party", "label": "Receiving Party Name", "type": "text", "required": True},
            {"name": "confidential_info", "label": "Description of Confidential Information", "type": "textarea", "required": True},
            {"name": "duration", "label": "NDA Duration (years)", "type": "number", "required": True},
            {"name": "effective_date", "label": "Effective Date", "type": "date", "required": True},
            {"name": "governing_state", "label": "Governing State/Jurisdiction", "type": "text", "required": True},
        ],
        "icon": "lock",
        "estimated_time": "10-15 min",
        "notarization_required": False,
        "signers_needed": 2,
        "popular": True,
    },
    {
        "id": "tpl_real_estate_purchase",
        "name": "Real Estate Purchase Agreement",
        "category": "real_estate",
        "document_type": "real_estate",
        "description": "Outlines the terms and conditions for the sale and purchase of residential or commercial property.",
        "fields": [
            {"name": "buyer_name", "label": "Buyer Full Name", "type": "text", "required": True},
            {"name": "seller_name", "label": "Seller Full Name", "type": "text", "required": True},
            {"name": "property_address", "label": "Property Address", "type": "textarea", "required": True},
            {"name": "purchase_price", "label": "Purchase Price ($)", "type": "number", "required": True},
            {"name": "earnest_money", "label": "Earnest Money Deposit ($)", "type": "number", "required": True},
            {"name": "closing_date", "label": "Closing Date", "type": "date", "required": True},
            {"name": "contingencies", "label": "Contingencies", "type": "textarea", "required": False, "placeholder": "e.g., financing, inspection, appraisal..."},
        ],
        "icon": "building",
        "estimated_time": "30-45 min",
        "notarization_required": True,
        "signers_needed": 2,
        "popular": True,
    },
    {
        "id": "tpl_trust_document",
        "name": "Revocable Living Trust",
        "category": "estate",
        "document_type": "trust",
        "description": "Establishes a trust that allows the grantor to manage assets during their lifetime and transfer them seamlessly upon death.",
        "fields": [
            {"name": "grantor_name", "label": "Grantor (Trust Creator) Full Name", "type": "text", "required": True},
            {"name": "trustee_name", "label": "Trustee Full Name", "type": "text", "required": True},
            {"name": "successor_trustee", "label": "Successor Trustee Full Name", "type": "text", "required": True},
            {"name": "beneficiaries", "label": "Beneficiaries & Distributions", "type": "textarea", "required": True},
            {"name": "trust_assets", "label": "Assets to be Placed in Trust", "type": "textarea", "required": True, "placeholder": "List properties, accounts, investments..."},
            {"name": "state", "label": "State of Residence", "type": "text", "required": True},
        ],
        "icon": "landmark",
        "estimated_time": "30-40 min",
        "notarization_required": True,
        "signers_needed": 2,
        "popular": False,
    },
    {
        "id": "tpl_general_contract",
        "name": "General Service Contract",
        "category": "business",
        "document_type": "contract",
        "description": "A standard agreement between a service provider and client outlining scope of work, payment, and terms.",
        "fields": [
            {"name": "provider_name", "label": "Service Provider Name", "type": "text", "required": True},
            {"name": "client_name", "label": "Client Name", "type": "text", "required": True},
            {"name": "scope_of_work", "label": "Scope of Work", "type": "textarea", "required": True},
            {"name": "total_fee", "label": "Total Fee ($)", "type": "number", "required": True},
            {"name": "payment_terms", "label": "Payment Terms", "type": "text", "required": True, "placeholder": "e.g., 50% upfront, 50% on completion"},
            {"name": "start_date", "label": "Start Date", "type": "date", "required": True},
            {"name": "end_date", "label": "End Date", "type": "date", "required": False},
        ],
        "icon": "handshake",
        "estimated_time": "15-20 min",
        "notarization_required": False,
        "signers_needed": 2,
        "popular": False,
    },
]


async def seed_templates():
    """Seed default templates if collection is empty."""
    count = await db.templates.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for t in DEFAULT_TEMPLATES:
            t["created_at"] = now
            t["updated_at"] = now
            t["is_default"] = True
            t["usage_count"] = 0
        await db.templates.insert_many(DEFAULT_TEMPLATES)
        logger.info(f"Seeded {len(DEFAULT_TEMPLATES)} default templates")


@router.get("/")
async def list_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List all available templates, optionally filtered by category or search."""
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    templates = await db.templates.find(query, {"_id": 0}).sort("popular", -1).to_list(100)
    
    # Get categories for filters
    categories = await db.templates.distinct("category")
    
    return {"templates": templates, "categories": categories, "total": len(templates)}


@router.get("/{template_id}")
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single template by ID."""
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Increment usage count
    await db.templates.update_one({"id": template_id}, {"$inc": {"usage_count": 1}})
    
    return template


@router.get("/{template_id}/preview")
async def preview_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a preview of the template with field descriptions."""
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": template["id"],
        "name": template["name"],
        "description": template["description"],
        "fields": template["fields"],
        "signers_needed": template["signers_needed"],
        "estimated_time": template["estimated_time"],
        "notarization_required": template["notarization_required"],
    }
