"""
Subscription Plans and Tier Management
Handles Stripe subscription checkout, plan limits, and subscription lifecycle
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse
)
from models import User
from routes.auth_routes import get_current_user
from services.notification_service import create_notification
from services.cache_service import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# ============ PLAN DEFINITIONS ============

PLANS = {
    "free": {
        "id": "free",
        "name": "Starter",
        "price": 0.0,
        "interval": "month",
        "description": "For individuals getting started",
        "discount_pct": 0,
        "features": [
            "3 notarizations per month",
            "Quick Seal (blockchain timestamp)",
            "Public Audit Trail access",
            "Certificate verification (QR)",
            "Basic dashboard",
            "Email support",
        ],
        "limits": {
            "notarizations_per_month": 3,
            "ai_analyses_per_month": 2,
            "transactions_per_month": 1,
            "document_storage_mb": 100,
            "video_sessions": False,
            "blockchain_sealing": False,
            "priority_support": False,
        },
        "gated_features": [],
    },
    "pro": {
        "id": "pro",
        "name": "Professional",
        "price": 49.00,
        "interval": "month",
        "description": "For notaries and power users",
        "discount_pct": 15,
        "features": [
            "Unlimited notarizations",
            "AI Document Summarizer & Generator",
            "AI Doc Compare & Remediation",
            "Ceremony Replay & Versioning",
            "Certificate Expiration & Renewal",
            "Reminders & Bookings",
            "Biometric Passport",
            "Blockchain sealing",
            "Video notarization (RON)",
            "1 GB document storage",
            "15% per-document discount",
            "Priority support",
        ],
        "limits": {
            "notarizations_per_month": 999999,
            "ai_analyses_per_month": 100,
            "transactions_per_month": 50,
            "document_storage_mb": 1024,
            "video_sessions": True,
            "blockchain_sealing": True,
            "priority_support": True,
        },
        "gated_features": [
            "ai_summarizer", "ai_generator", "doc_compare", "doc_remediation",
            "ceremony_replay", "certificate_expiration", "biometric_passport",
            "video_witness", "document_versioning",
        ],
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 199.00,
        "interval": "month",
        "description": "For firms and organizations",
        "discount_pct": 35,
        "features": [
            "Everything in Professional",
            "AI Intelligence Hub (5 AI features)",
            "ANAN (Autonomous Notary Network)",
            "Escrow Intelligence + HTS Tokens",
            "Multi-Signature Ceremonies",
            "Bulk Notarization",
            "Organization Management + RBAC",
            "Auth0/Okta SSO integration",
            "White Label / Branding",
            "Scheduled Reports & Webhooks",
            "API Access (Developer Portal)",
            "Fraud Intelligence Dashboard",
            "10 GB document storage",
            "35% per-document discount",
            "Dedicated account manager",
        ],
        "limits": {
            "notarizations_per_month": 999999,
            "ai_analyses_per_month": 999999,
            "transactions_per_month": 999999,
            "document_storage_mb": 10240,
            "video_sessions": True,
            "blockchain_sealing": True,
            "priority_support": True,
        },
        "gated_features": [
            "ai_summarizer", "ai_generator", "doc_compare", "doc_remediation",
            "ceremony_replay", "certificate_expiration", "biometric_passport",
            "video_witness", "document_versioning",
            "ai_intelligence_hub", "anan", "escrow_intelligence", "hts_tokens",
            "multi_signature", "bulk_notarization", "organization", "sso",
            "white_label", "scheduled_reports", "api_access", "fraud_intelligence",
        ],
    },
}

# Feature → minimum plan required
FEATURE_PLAN_MAP = {
    # Pro features
    "ai_summarizer": "pro",
    "ai_generator": "pro",
    "doc_compare": "pro",
    "doc_remediation": "pro",
    "ceremony_replay": "pro",
    "certificate_expiration": "pro",
    "biometric_passport": "pro",
    "video_witness": "pro",
    "document_versioning": "pro",
    # Enterprise features
    "ai_intelligence_hub": "enterprise",
    "anan": "enterprise",
    "escrow_intelligence": "enterprise",
    "hts_tokens": "enterprise",
    "multi_signature": "enterprise",
    "bulk_notarization": "enterprise",
    "organization": "enterprise",
    "sso": "enterprise",
    "white_label": "enterprise",
    "scheduled_reports": "enterprise",
    "api_access": "enterprise",
    "fraud_intelligence": "enterprise",
}

PLAN_HIERARCHY = {"free": 0, "pro": 1, "enterprise": 2}


class SubscribeRequest(BaseModel):
    plan_id: str
    origin_url: str


class SubscriptionResponse(BaseModel):
    plan: dict
    status: str
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    usage: Optional[dict] = None


# ============ PLAN ENDPOINTS ============

@router.get("/plans")
async def get_plans():
    """Get all available subscription plans (cached 5min)"""
    cached = cache_service.get("plans", "all_plans")
    if cached:
        return cached
    result = {
        "plans": list(PLANS.values()),
        "currency": "USD",
    }
    cache_service.set("plans", "all_plans", result)
    return result


@router.get("/current")
async def get_current_subscription(
    current_user: User = Depends(get_current_user)
):
    """Get current user's subscription details with usage"""
    sub = await db.subscriptions.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )

    if not sub:
        # Default free plan
        sub = {
            "plan_id": "free",
            "status": "active",
            "current_period_start": None,
            "current_period_end": None,
        }

    plan = PLANS.get(sub.get("plan_id", "free"), PLANS["free"])

    # Get usage for current month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    notarization_count = await db.notarization_requests.count_documents({
        "user_id": current_user.id,
        "created_at": {"$gte": month_start}
    })

    ai_analysis_count = await db.ai_analyses.count_documents({
        "user_id": current_user.id,
        "created_at": {"$gte": month_start}
    })

    transaction_count = await db.transactions.count_documents({
        "ownerId": current_user.id,
        "created_at": {"$gte": month_start}
    })

    usage = {
        "notarizations": {"used": notarization_count, "limit": plan["limits"]["notarizations_per_month"]},
        "ai_analyses": {"used": ai_analysis_count, "limit": plan["limits"]["ai_analyses_per_month"]},
        "transactions": {"used": transaction_count, "limit": plan["limits"]["transactions_per_month"]},
    }

    # Serialize datetimes
    for key in ["current_period_start", "current_period_end", "created_at", "updated_at"]:
        if isinstance(sub.get(key), datetime):
            sub[key] = sub[key].isoformat()

    return {
        "subscription": sub,
        "plan": plan,
        "usage": usage,
    }


@router.get("/usage/history")
async def get_usage_history(
    current_user: User = Depends(get_current_user),
    months: int = Query(default=6, le=12),
):
    """Get monthly usage history for charts and analytics."""
    now = datetime.now(timezone.utc)
    history = []

    for i in range(months):
        # Go back i months
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        month_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

        notar_count = await db.notarization_requests.count_documents({
            "user_id": current_user.id,
            "created_at": {"$gte": month_start, "$lt": month_end}
        })
        ai_count = await db.ai_analyses.count_documents({
            "user_id": current_user.id,
            "created_at": {"$gte": month_start, "$lt": month_end}
        })
        seal_count = await db.document_seals.count_documents({
            "user_id": current_user.id,
            "timestamp": {"$gte": month_start, "$lt": month_end}
        })

        history.append({
            "month": month_start.strftime("%b %Y"),
            "month_num": month,
            "year": year,
            "notarizations": notar_count,
            "ai_analyses": ai_count,
            "seals": seal_count,
        })

    history.reverse()
    return {"history": history}


# ============ SUBSCRIBE / UPGRADE ============

@router.post("/checkout")
async def create_subscription_checkout(
    request: SubscribeRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe checkout session for a subscription plan"""
    if request.plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan selected")

    plan = PLANS[request.plan_id]

    if plan["price"] == 0:
        raise HTTPException(status_code=400, detail="Free plan does not require payment")

    # Check if already on this plan
    existing = await db.subscriptions.find_one({
        "user_id": current_user.id,
        "plan_id": request.plan_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You are already on this plan")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")

    origin = request.origin_url.rstrip("/")
    success_url = f"{origin}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": current_user.id,
        "user_email": current_user.email,
        "plan_id": request.plan_id,
        "plan_name": plan["name"],
        "type": "subscription",
    }

    try:
        checkout_request = CheckoutSessionRequest(
            amount=plan["price"],
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )

        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

        # Record pending subscription payment
        await db.subscription_payments.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": current_user.id,
            "plan_id": request.plan_id,
            "amount": plan["price"],
            "currency": "usd",
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        })

        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "plan": plan,
        }

    except Exception as e:
        logger.error(f"Subscription checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.get("/checkout/status/{session_id}")
async def check_subscription_status(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Poll subscription payment status and activate if paid"""
    payment = await db.subscription_payments.find_one({
        "session_id": session_id,
        "user_id": current_user.id,
    })

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Already processed
    if payment.get("status") == "completed":
        return {
            "status": "complete",
            "payment_status": "paid",
            "plan_id": payment["plan_id"],
        }

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")

    try:
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

        if checkout_status.payment_status == "paid" and payment.get("status") != "completed":
            now = datetime.now(timezone.utc)
            period_end = now + timedelta(days=30)

            # Activate subscription
            # Cancel any existing active subscription
            await db.subscriptions.update_many(
                {"user_id": current_user.id, "status": "active"},
                {"$set": {"status": "cancelled", "cancelled_at": now}}
            )

            await db.subscriptions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user.id,
                "plan_id": payment["plan_id"],
                "status": "active",
                "payment_session_id": session_id,
                "current_period_start": now,
                "current_period_end": period_end,
                "created_at": now,
                "updated_at": now,
            })

            # Update user record
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"subscription_plan": payment["plan_id"], "subscription_active": True}}
            )

            # Mark payment as completed
            await db.subscription_payments.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "completed_at": now}}
            )

            # Notify user
            plan = PLANS.get(payment["plan_id"], {})
            await create_notification(
                user_id=current_user.id,
                title="Subscription Activated",
                message=f"Your {plan.get('name', '')} plan is now active. Enjoy your new features!",
                notif_type="success",
                link="/subscription"
            )

            # CRM sync — subscription upgrade → GHL
            try:
                from services.ghl_service import sync_subscription_upgraded
                import asyncio as _asyncio
                _asyncio.create_task(sync_subscription_upgraded(
                    email=current_user.email,
                    new_tier=payment["plan_id"],
                    old_tier="starter",
                    monetary_value=float(plan.get("price", 0)),
                ))
            except Exception:
                pass

            return {
                "status": "complete",
                "payment_status": "paid",
                "plan_id": payment["plan_id"],
            }

        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "plan_id": payment["plan_id"],
        }

    except Exception as e:
        logger.error(f"Subscription status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ CANCEL ============

@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user)
):
    """Cancel the current subscription (remains active until period end)"""
    sub = await db.subscriptions.find_one({
        "user_id": current_user.id,
        "status": "active",
        "plan_id": {"$ne": "free"}
    })

    if not sub:
        raise HTTPException(status_code=400, detail="No active paid subscription found")

    now = datetime.now(timezone.utc)
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {
            "status": "cancelling",
            "cancel_at_period_end": True,
            "cancelled_at": now,
            "updated_at": now,
        }}
    )

    await create_notification(
        user_id=current_user.id,
        title="Subscription Cancelled",
        message=f"Your subscription will remain active until {sub.get('current_period_end', now).strftime('%B %d, %Y') if isinstance(sub.get('current_period_end'), datetime) else 'the end of your billing period'}.",
        notif_type="warning",
        link="/subscription"
    )

    return {"message": "Subscription will be cancelled at the end of the current billing period"}


# ============ USAGE CHECK (for middleware) ============

async def get_user_plan(user_id: str) -> str:
    """Get the current plan ID for a user."""
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0, "plan_id": 1}
    )
    return sub["plan_id"] if sub else "free"


async def check_feature_access(user_id: str, feature: str) -> dict:
    """Check if user's plan grants access to a specific feature."""
    user_plan = await get_user_plan(user_id)
    required_plan = FEATURE_PLAN_MAP.get(feature)

    if not required_plan:
        return {"allowed": True, "user_plan": user_plan}

    user_level = PLAN_HIERARCHY.get(user_plan, 0)
    required_level = PLAN_HIERARCHY.get(required_plan, 0)

    return {
        "allowed": user_level >= required_level,
        "user_plan": user_plan,
        "required_plan": required_plan,
        "feature": feature,
    }


def require_feature(feature: str):
    """FastAPI dependency that gates an endpoint behind a plan feature."""
    async def _check(current_user: User = Depends(get_current_user)):
        result = await check_feature_access(current_user.id, feature)
        if not result["allowed"]:
            plan = PLANS.get(result["required_plan"], {})
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "upgrade_required",
                    "message": f"This feature requires the {plan.get('name', result['required_plan'])} plan or higher.",
                    "required_plan": result["required_plan"],
                    "required_plan_name": plan.get("name", ""),
                    "required_plan_price": plan.get("price", 0),
                    "current_plan": result["user_plan"],
                    "feature": feature,
                }
            )
        return current_user
    return _check


@router.get("/feature-access/{feature}")
async def check_feature(feature: str, current_user: User = Depends(get_current_user)):
    """Check if the current user can access a specific feature."""
    result = await check_feature_access(current_user.id, feature)
    plan_info = PLANS.get(result.get("required_plan", "free"), {})
    return {
        **result,
        "required_plan_name": plan_info.get("name", ""),
        "required_plan_price": plan_info.get("price", 0),
    }


@router.get("/feature-map")
async def get_feature_map(current_user: User = Depends(get_current_user)):
    """Get full feature access map for the current user."""
    user_plan = await get_user_plan(current_user.id)
    user_level = PLAN_HIERARCHY.get(user_plan, 0)
    is_admin = current_user.role == "admin" if hasattr(current_user, 'role') else False
    # Check role from DB
    if not is_admin:
        user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "role": 1})
        is_admin = user_doc.get("role") == "admin" if user_doc else False
    features = {}
    for feature, required_plan in FEATURE_PLAN_MAP.items():
        required_level = PLAN_HIERARCHY.get(required_plan, 0)
        features[feature] = {
            "allowed": is_admin or user_level >= required_level,
            "required_plan": required_plan,
        }
    return {"user_plan": user_plan, "features": features}


async def check_plan_limit(user_id: str, resource: str) -> dict:
    """Check if user has exceeded their plan limit for a resource"""
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )

    plan_id = sub["plan_id"] if sub else "free"
    plan = PLANS.get(plan_id, PLANS["free"])
    limit = plan["limits"].get(resource)

    if limit is None:
        return {"allowed": True, "plan": plan_id}

    if isinstance(limit, bool):
        return {"allowed": limit, "plan": plan_id, "feature": resource}

    # Count usage this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    collection_map = {
        "notarizations_per_month": ("notarization_requests", "user_id"),
        "ai_analyses_per_month": ("ai_analyses", "user_id"),
        "transactions_per_month": ("transactions", "ownerId"),
    }

    if resource in collection_map:
        coll_name, id_field = collection_map[resource]
        count = await db[coll_name].count_documents({
            id_field: user_id,
            "created_at": {"$gte": month_start}
        })
        return {
            "allowed": count < limit,
            "used": count,
            "limit": limit,
            "plan": plan_id,
        }

    return {"allowed": True, "plan": plan_id}


@router.get("/usage")
async def get_usage(
    current_user: User = Depends(get_current_user)
):
    """Get detailed usage for current billing period"""
    results = {}
    for resource in ["notarizations_per_month", "ai_analyses_per_month", "transactions_per_month"]:
        results[resource] = await check_plan_limit(current_user.id, resource)

    return {"usage": results}



# ============ PER-DOC DISCOUNT ENDPOINTS ============

@router.get("/discount")
async def get_my_discount(
    current_user: User = Depends(get_current_user)
):
    """Get the current user's per-document discount based on their subscription tier."""
    sub = await db.subscriptions.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )

    plan_id = sub["plan_id"] if sub else "free"
    plan = PLANS.get(plan_id, PLANS["free"])
    discount_pct = plan.get("discount_pct", 0)

    # Calculate billing-cycle savings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get notarizations this cycle and calculate total saved
    payments_this_cycle = await db.payment_transactions.find(
        {
            "user_id": current_user.id,
            "created_at": {"$gte": month_start},
            "payment_status": "paid",
            "discount_applied": {"$exists": True},
        },
        {"_id": 0, "discount_applied": 1, "original_amount": 1, "amount": 1}
    ).to_list(1000)

    total_saved = sum(p.get("discount_applied", 0) for p in payments_this_cycle)
    docs_discounted = len(payments_this_cycle)

    return {
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "discount_pct": discount_pct,
        "total_saved_this_cycle": round(total_saved, 2),
        "docs_discounted_this_cycle": docs_discounted,
    }


@router.post("/calculate-discount")
async def calculate_discount(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Calculate the discounted price for a document notarization package."""
    package_id = request.get("package_id")
    if not package_id:
        raise HTTPException(status_code=400, detail="package_id is required")

    from routes.payment_routes import NOTARY_PACKAGES
    if package_id not in NOTARY_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    package = NOTARY_PACKAGES[package_id]
    original_price = package["price"]

    sub = await db.subscriptions.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )
    plan_id = sub["plan_id"] if sub else "free"
    plan = PLANS.get(plan_id, PLANS["free"])
    discount_pct = plan.get("discount_pct", 0)

    discount_amount = round(original_price * discount_pct / 100, 2)
    final_price = round(original_price - discount_amount, 2)

    return {
        "package_id": package_id,
        "package_name": package["name"],
        "original_price": original_price,
        "discount_pct": discount_pct,
        "discount_amount": discount_amount,
        "final_price": final_price,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "currency": "USD",
    }
