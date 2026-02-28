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
            "Basic document analysis",
            "Email support",
            "Standard processing",
            "No per-document discount",
        ],
        "limits": {
            "notarizations_per_month": 3,
            "ai_analyses_per_month": 5,
            "transactions_per_month": 1,
            "document_storage_mb": 100,
            "video_sessions": False,
            "blockchain_sealing": False,
            "priority_support": False,
        },
    },
    "pro": {
        "id": "pro",
        "name": "Professional",
        "price": 29.00,
        "interval": "month",
        "description": "For professionals and small businesses",
        "discount_pct": 15,
        "features": [
            "25 notarizations per month",
            "AI document analysis",
            "Blockchain sealing",
            "Video notarization sessions",
            "Priority support",
            "1 GB document storage",
            "15% per-document discount",
        ],
        "limits": {
            "notarizations_per_month": 25,
            "ai_analyses_per_month": 50,
            "transactions_per_month": 10,
            "document_storage_mb": 1024,
            "video_sessions": True,
            "blockchain_sealing": True,
            "priority_support": False,
        },
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 99.00,
        "interval": "month",
        "description": "For organizations and high-volume users",
        "discount_pct": 35,
        "features": [
            "Unlimited notarizations",
            "Advanced AI analysis",
            "Blockchain sealing",
            "Video notarization sessions",
            "Priority support",
            "10 GB document storage",
            "Transaction orchestrator",
            "Custom blueprints",
            "Dedicated account manager",
            "35% per-document discount",
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
    },
}


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
