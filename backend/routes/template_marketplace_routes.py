"""
Template Marketplace — publish, browse, and purchase document templates created
in the Smart Document Studio, with creator royalties recorded on a ledger and the
sale receipt anchored on Hedera HCS.

Payment is SIMULATED (no real card charge) — purchases are recorded and the buyer
receives an editable copy in their Studio. Royalty splits are tracked per sale.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import hashlib
import uuid
import re
import logging

from models import User
from routes.auth_routes import get_current_user
from middleware.security import limiter
from services.hedera_service import hedera_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/template-marketplace", tags=["template-marketplace"])
db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


MARKET_CATEGORIES = [
    "Real Estate", "Business", "Employment", "Family", "Finance", "Intellectual Property", "Other",
]


class PublishRequest(BaseModel):
    generation_id: str
    title: str
    description: str = ""
    category: str = "Other"
    price_usd: float = 0.0
    royalty_pct: int = 10  # creator royalty on each resale/derivative


def _public_listing(t: dict) -> dict:
    """Strip the full document body from list/detail responses for non-owners."""
    return {
        "id": t["id"],
        "title": t["title"],
        "description": t.get("description", ""),
        "category": t.get("category", "Other"),
        "price_usd": t.get("price_usd", 0.0),
        "royalty_pct": t.get("royalty_pct", 10),
        "creator_name": t.get("creator_name", "NotaryChain Creator"),
        "creator_id": t.get("creator_id"),
        "sales_count": t.get("sales_count", 0),
        "preview": (t.get("preview") or ""),
        "section_count": t.get("section_count", 0),
        "created_at": t.get("created_at"),
    }


@router.get("/categories")
async def categories():
    return {"categories": MARKET_CATEGORIES}


@router.get("")
@router.get("/")
async def list_templates(category: Optional[str] = None, q: Optional[str] = None):
    """Browse published templates (public)."""
    query = {"status": "published"}
    if category:
        query["category"] = category
    if q:
        safe = re.escape(q)
        query["$or"] = [
            {"title": {"$regex": safe, "$options": "i"}},
            {"description": {"$regex": safe, "$options": "i"}},
        ]
    cursor = db.marketplace_templates.find(query).sort("sales_count", -1)
    items = [_public_listing(t) async for t in cursor]
    return {"templates": items, "total": len(items)}


@router.post("/publish")
@limiter.limit("10/minute")
async def publish_template(request: Request, body: PublishRequest, current_user: User = Depends(get_current_user)):
    """Publish a generated document as a marketplace template."""
    gen = await db.ai_generated_docs.find_one({"id": body.generation_id, "user_id": current_user.id}, {"_id": 0})
    if not gen:
        raise HTTPException(status_code=404, detail="Source document not found")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if body.royalty_pct < 0 or body.royalty_pct > 50:
        raise HTTPException(status_code=400, detail="Royalty must be between 0 and 50%")

    result = gen.get("result", {})
    sections = result.get("sections", []) or []
    preview = ""
    if sections:
        preview = (sections[0].get("content", "") or "")[:280]

    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": tid,
        "status": "published",
        "creator_id": current_user.id,
        "creator_name": current_user.full_name or current_user.email,
        "creator_email": current_user.email,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "category": body.category if body.category in MARKET_CATEGORIES else "Other",
        "price_usd": max(0.0, round(body.price_usd, 2)),
        "royalty_pct": body.royalty_pct,
        "document": result,            # full snapshot (only returned to owner/buyers)
        "section_count": len(sections),
        "preview": preview,
        "sales_count": 0,
        "source_generation_id": body.generation_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.marketplace_templates.insert_one(doc)
    return {"id": tid, "status": "published", "listing": _public_listing(doc)}


@router.get("/my/listings")
async def my_listings(current_user: User = Depends(get_current_user)):
    cursor = db.marketplace_templates.find({"creator_id": current_user.id}).sort("created_at", -1)
    items = [{**_public_listing(t), "status": t.get("status")} async for t in cursor]
    # earnings summary from the royalty/sales ledger
    earnings = 0.0
    async for s in db.marketplace_sales.find({"creator_id": current_user.id}, {"_id": 0, "creator_earnings": 1}):
        earnings += s.get("creator_earnings", 0.0)
    return {"listings": items, "total_earnings": round(earnings, 2)}


@router.get("/my/purchases")
async def my_purchases(current_user: User = Depends(get_current_user)):
    cursor = db.marketplace_sales.find({"buyer_id": current_user.id}, {"_id": 0}).sort("purchased_at", -1)
    return {"purchases": [s async for s in cursor]}


@router.get("/{template_id}")
async def get_template(template_id: str, current_user: User = Depends(get_current_user)):
    t = await db.marketplace_templates.find_one({"id": template_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    listing = _public_listing(t)
    # Only the owner or someone who purchased it gets the full document body.
    owned = t["creator_id"] == current_user.id
    purchased = await db.marketplace_sales.find_one({"template_id": template_id, "buyer_id": current_user.id})
    if owned or purchased:
        listing["document"] = t.get("document")
        listing["owned"] = owned
        listing["purchased"] = bool(purchased)
    else:
        listing["owned"] = False
        listing["purchased"] = False
    return listing


@router.post("/{template_id}/purchase")
@limiter.limit("10/minute")
async def purchase_template(template_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Purchase a template (SIMULATED payment). Records the royalty split, anchors a
    receipt on Hedera, and clones the document into the buyer's Studio."""
    t = await db.marketplace_templates.find_one({"id": template_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["creator_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="You already own this template")
    existing = await db.marketplace_sales.find_one({"template_id": template_id, "buyer_id": current_user.id})
    if existing:
        raise HTTPException(status_code=400, detail="You have already purchased this template")

    now = datetime.now(timezone.utc).isoformat()
    price = float(t.get("price_usd", 0.0))
    royalty_pct = int(t.get("royalty_pct", 10))
    creator_earnings = round(price * royalty_pct / 100.0, 2)
    platform_fee = round(price - creator_earnings, 2)

    # Clone the template into the buyer's Studio as an editable generated doc.
    new_gen_id = str(uuid.uuid4())
    await db.ai_generated_docs.insert_one({
        "id": new_gen_id,
        "user_id": current_user.id,
        "description": f"Purchased from marketplace: {t['title']}",
        "document_type": t.get("category"),
        "result": t.get("document", {}),
        "status": "generated",
        "marketplace_template_id": template_id,
        "created_at": now,
    })

    # Anchor a sale receipt on Hedera HCS (tamper-evident royalty record).
    receipt = f"{template_id}|{current_user.id}|{t['creator_id']}|{price}|{royalty_pct}|{now}"
    receipt_hash = hashlib.sha256(receipt.encode()).hexdigest()
    seal = await hedera_service.seal_document(
        document_hash=receipt_hash,
        document_name=f"Template Sale Receipt — {t['title']}",
        user_id=current_user.id,
        metadata={"kind": "template_sale", "template_id": template_id, "royalty_pct": royalty_pct},
    )

    sale_id = str(uuid.uuid4())
    sale = {
        "id": sale_id,
        "template_id": template_id,
        "template_title": t["title"],
        "buyer_id": current_user.id,
        "buyer_email": current_user.email,
        "creator_id": t["creator_id"],
        "creator_email": t.get("creator_email"),
        "price_usd": price,
        "royalty_pct": royalty_pct,
        "creator_earnings": creator_earnings,
        "platform_fee": platform_fee,
        "cloned_generation_id": new_gen_id,
        "receipt_hash": receipt_hash,
        "transaction_id": seal.get("transaction_id"),
        "explorer_url": seal.get("explorer_url"),
        "payment_status": "simulated",
        "purchased_at": now,
    }
    await db.marketplace_sales.insert_one(sale)
    await db.marketplace_templates.update_one({"id": template_id}, {"$inc": {"sales_count": 1}})

    sale.pop("_id", None)
    return {
        "success": True,
        "sale_id": sale_id,
        "generation_id": new_gen_id,
        "creator_earnings": creator_earnings,
        "receipt_hash": receipt_hash,
        "transaction_id": sale["transaction_id"],
        "explorer_url": sale["explorer_url"],
        "message": "Template purchased. An editable copy is now in your Studio.",
    }


@router.delete("/{template_id}")
async def unpublish_template(template_id: str, current_user: User = Depends(get_current_user)):
    t = await db.marketplace_templates.find_one({"id": template_id}, {"_id": 0, "creator_id": 1})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["creator_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    await db.marketplace_templates.update_one({"id": template_id}, {"$set": {"status": "unpublished"}})
    return {"success": True}
