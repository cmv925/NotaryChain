"""
Template Marketplace — publish, browse, and purchase document templates created
in the Smart Document Studio, with creator royalties paid out via Stripe Connect.

Payment flow (real Stripe Checkout):
  • Free templates  → fulfilled instantly.
  • Paid templates  → buyer pays the platform via Stripe Checkout; on confirmed
    payment the buyer gets an editable copy, the sale receipt is anchored on
    Hedera, and the creator royalty is transferred to their connected Stripe
    account (or recorded as a *pending* payout if they haven't onboarded yet).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import hashlib
import uuid
import re
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)
from models import User
from routes.auth_routes import get_current_user
from middleware.security import limiter
from services.hedera_service import hedera_service
from services import stripe_connect_service as connect

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

    result = gen.get("result") or {}
    sections = result.get("sections", []) or []
    if not sections:
        raise HTTPException(status_code=400, detail="Document is still generating or empty — try again in a moment")
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
    # Royalty summary from the payout ledger.
    total = pending = paid = 0.0
    async for p in db.marketplace_payouts.find({"creator_id": current_user.id}, {"_id": 0, "amount": 1, "status": 1}):
        amt = p.get("amount", 0.0)
        total += amt
        if p.get("status") == "paid":
            paid += amt
        else:
            pending += amt
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "stripe_payouts_enabled": 1, "stripe_connect_account_id": 1})
    return {
        "listings": items,
        "total_earnings": round(total, 2),
        "pending_payout": round(pending, 2),
        "paid_out": round(paid, 2),
        "payouts_connected": bool((user_doc or {}).get("stripe_payouts_enabled")),
        "connect_started": bool((user_doc or {}).get("stripe_connect_account_id")),
    }


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


async def _payout_creator(sale: dict, template: dict):
    """Pay the creator their royalty via Stripe Connect, or record a pending payout
    if they haven't connected an account (sale is never blocked on payout)."""
    amount = sale["creator_earnings"]
    now = datetime.now(timezone.utc).isoformat()
    payout = {
        "id": str(uuid.uuid4()),
        "sale_id": sale["id"],
        "template_id": sale["template_id"],
        "creator_id": sale["creator_id"],
        "creator_email": sale.get("creator_email"),
        "amount": amount,
        "currency": "usd",
        "status": "pending",
        "transfer_id": None,
        "created_at": now,
    }
    if amount <= 0:
        payout["status"] = "not_applicable"
        await db.marketplace_payouts.insert_one(payout)
        return payout

    creator = await db.users.find_one({"id": sale["creator_id"]}, {"_id": 0, "stripe_connect_account_id": 1, "stripe_payouts_enabled": 1})
    acct = (creator or {}).get("stripe_connect_account_id")
    if acct and (creator or {}).get("stripe_payouts_enabled"):
        res = await connect.transfer_to_creator(amount, acct, {"sale_id": sale["id"], "template_id": sale["template_id"]})
        if res.get("status") == "paid":
            payout["status"] = "paid"
            payout["transfer_id"] = res.get("transfer_id")
            payout["paid_at"] = now
        else:
            payout["status"] = "pending"
            payout["last_error"] = res.get("error")
    # else: creator not connected → remains pending for later payout
    await db.marketplace_payouts.insert_one(payout)
    return payout


async def _fulfill_sale(t: dict, buyer: User, payment_status: str = "paid", session_id: Optional[str] = None) -> dict:
    """Idempotently fulfill a marketplace purchase: clone the doc into the buyer's
    Studio, anchor a receipt on Hedera, record the sale, and pay out the creator."""
    existing = await db.marketplace_sales.find_one({"template_id": t["id"], "buyer_id": buyer.id}, {"_id": 0})
    if existing:
        return existing

    now = datetime.now(timezone.utc).isoformat()
    price = float(t.get("price_usd", 0.0))
    royalty_pct = int(t.get("royalty_pct", 10))
    creator_earnings = round(price * royalty_pct / 100.0, 2)
    platform_fee = round(price - creator_earnings, 2)

    new_gen_id = str(uuid.uuid4())
    await db.ai_generated_docs.insert_one({
        "id": new_gen_id,
        "user_id": buyer.id,
        "description": f"Purchased from marketplace: {t['title']}",
        "document_type": t.get("category"),
        "result": t.get("document", {}),
        "status": "generated",
        "marketplace_template_id": t["id"],
        "created_at": now,
    })

    receipt = f"{t['id']}|{buyer.id}|{t['creator_id']}|{price}|{royalty_pct}|{now}"
    receipt_hash = hashlib.sha256(receipt.encode()).hexdigest()
    seal = await hedera_service.seal_document(
        document_hash=receipt_hash,
        document_name=f"Template Sale Receipt — {t['title']}",
        user_id=buyer.id,
        metadata={"kind": "template_sale", "template_id": t["id"], "royalty_pct": royalty_pct},
    )

    sale = {
        "id": str(uuid.uuid4()),
        "template_id": t["id"],
        "template_title": t["title"],
        "buyer_id": buyer.id,
        "buyer_email": buyer.email,
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
        "payment_status": payment_status,
        "checkout_session_id": session_id,
        "purchased_at": now,
    }
    await db.marketplace_sales.insert_one(sale)
    await db.marketplace_templates.update_one({"id": t["id"]}, {"$inc": {"sales_count": 1}})
    payout = await _payout_creator(sale, t)
    sale.pop("_id", None)
    sale["payout_status"] = payout["status"]
    return sale


class CheckoutRequest(BaseModel):
    origin_url: str


@router.post("/{template_id}/checkout")
@limiter.limit("10/minute")
async def checkout_template(template_id: str, body: CheckoutRequest, request: Request, current_user: User = Depends(get_current_user)):
    """Start a purchase. Free templates fulfill instantly; paid templates return a
    Stripe Checkout URL (price is fixed server-side — never trusted from the client)."""
    t = await db.marketplace_templates.find_one({"id": template_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["creator_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="You already own this template")
    if await db.marketplace_sales.find_one({"template_id": template_id, "buyer_id": current_user.id}):
        raise HTTPException(status_code=400, detail="You have already purchased this template")

    price = float(t.get("price_usd", 0.0))  # server-side price
    if price <= 0:
        sale = await _fulfill_sale(t, current_user, payment_status="free")
        return {"free": True, "sale_id": sale["id"], "generation_id": sale["cloned_generation_id"],
                "message": "Template added. An editable copy is now in your Studio."}

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/template-marketplace?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/template-marketplace"
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "type": "marketplace_purchase",
        "template_id": template_id,
        "buyer_id": current_user.id,
        "buyer_email": current_user.email,
        "creator_id": t["creator_id"],
    }
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(
            CheckoutSessionRequest(amount=price, currency="usd", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
        )
    except Exception as e:
        logger.error("Marketplace checkout error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "type": "marketplace_purchase",
        "template_id": template_id,
        "user_id": current_user.id,
        "user_email": current_user.email,
        "amount": price,
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"free": False, "checkout_url": session.url, "session_id": session.session_id}


@router.get("/checkout/status/{session_id}")
async def marketplace_checkout_status(session_id: str, current_user: User = Depends(get_current_user)):
    """Poll a marketplace Checkout session; fulfill the purchase on first confirmed payment."""
    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": current_user.id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment not found")
    if txn.get("status") == "completed":
        sale = await db.marketplace_sales.find_one({"checkout_session_id": session_id}, {"_id": 0})
        return {"status": "complete", "payment_status": "paid",
                "generation_id": (sale or {}).get("cloned_generation_id")}

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    try:
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
        cs: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error("Marketplace status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    if cs.payment_status == "paid" and txn.get("status") != "completed":
        t = await db.marketplace_templates.find_one({"id": txn["template_id"]}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="Template no longer available")
        sale = await _fulfill_sale(t, current_user, payment_status="paid", session_id=session_id)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid", "completed_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"status": "complete", "payment_status": "paid", "generation_id": sale["cloned_generation_id"]}

    return {"status": cs.status, "payment_status": cs.payment_status}


# ── Creator payout onboarding (Stripe Connect Express) ──

class OnboardRequest(BaseModel):
    origin_url: str


@router.get("/connect/status")
async def connect_status(current_user: User = Depends(get_current_user)):
    """Whether the creator can receive royalty payouts."""
    if not connect.is_configured():
        return {"configured": False, "connected": False, "payouts_enabled": False}
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "stripe_connect_account_id": 1, "stripe_payouts_enabled": 1})
    acct = (user_doc or {}).get("stripe_connect_account_id")
    if not acct:
        return {"configured": True, "connected": False, "payouts_enabled": False}
    st = await connect.account_status(acct)
    payouts_enabled = bool(st.get("payouts_enabled"))
    if payouts_enabled != (user_doc or {}).get("stripe_payouts_enabled"):
        await db.users.update_one({"id": current_user.id}, {"$set": {"stripe_payouts_enabled": payouts_enabled}})
    return {"configured": True, "connected": True, "payouts_enabled": payouts_enabled,
            "details_submitted": st.get("details_submitted", False)}


@router.post("/connect/onboard")
@limiter.limit("6/minute")
async def connect_onboard(body: OnboardRequest, request: Request, current_user: User = Depends(get_current_user)):
    """Create/refresh the creator's Stripe Express account and return an onboarding URL."""
    if not connect.is_configured():
        raise HTTPException(status_code=503, detail="Payouts are not configured")
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "stripe_connect_account_id": 1})
    acct = (user_doc or {}).get("stripe_connect_account_id")
    if not acct:
        res = await connect.create_express_account(current_user.email)
        if res.get("error"):
            raise HTTPException(status_code=400, detail=f"Could not start payout onboarding: {res['error']}")
        acct = res["account_id"]
        await db.users.update_one({"id": current_user.id}, {"$set": {"stripe_connect_account_id": acct}})

    origin = body.origin_url.rstrip("/")
    link = await connect.onboarding_link(acct, refresh_url=f"{origin}/template-marketplace", return_url=f"{origin}/template-marketplace")
    if link.get("error"):
        raise HTTPException(status_code=400, detail=f"Could not create onboarding link: {link['error']}")
    return {"onboarding_url": link["url"]}


@router.delete("/{template_id}")
async def unpublish_template(template_id: str, current_user: User = Depends(get_current_user)):
    t = await db.marketplace_templates.find_one({"id": template_id}, {"_id": 0, "creator_id": 1})
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["creator_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    await db.marketplace_templates.update_one({"id": template_id}, {"$set": {"status": "unpublished"}})
    return {"success": True}
