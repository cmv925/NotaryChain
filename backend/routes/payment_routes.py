"""
Stripe Payment Routes for Notary Services
Supports card and crypto payments via Stripe
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
import os
import uuid

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionRequest, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse
)
from models import User
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# Fixed pricing packages - NEVER accept amounts from frontend
NOTARY_PACKAGES = {
    "general": {
        "name": "General Document Notarization",
        "price": 25.00,
        "description": "Standard document notarization"
    },
    "power_of_attorney": {
        "name": "Power of Attorney",
        "price": 35.00,
        "description": "Legal POA document notarization"
    },
    "real_estate": {
        "name": "Real Estate Document",
        "price": 75.00,
        "description": "Property and real estate documents"
    },
    "affidavit": {
        "name": "Affidavit",
        "price": 30.00,
        "description": "Sworn statement notarization"
    },
    "will": {
        "name": "Last Will & Testament",
        "price": 50.00,
        "description": "Estate planning documents"
    },
    "trust": {
        "name": "Trust Document",
        "price": 65.00,
        "description": "Trust and estate documents"
    },
    "contract": {
        "name": "Contract",
        "price": 40.00,
        "description": "Business and personal contracts"
    }
}


class CreateCheckoutRequest(BaseModel):
    package_id: str
    origin_url: str
    notary_request_id: Optional[str] = None
    payment_method: str = "card"  # "card" or "crypto" or "both"


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    package: dict
    amount: float


@router.get("/packages")
async def get_packages():
    """Get available notary service packages and pricing"""
    return {
        "packages": NOTARY_PACKAGES,
        "currency": "USD"
    }


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CreateCheckoutRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Create a Stripe checkout session for notary services.
    Amount is determined server-side based on package_id - never from frontend.
    Subscription discounts are automatically applied.
    """
    # Validate package exists
    if request.package_id not in NOTARY_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    package = NOTARY_PACKAGES[request.package_id]
    original_amount = package["price"]
    
    # Apply subscription discount
    discount_pct = 0
    plan_id = "free"
    sub = await db.subscriptions.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )
    if sub:
        plan_id = sub.get("plan_id", "free")
        from routes.subscription_routes import PLANS
        plan = PLANS.get(plan_id, PLANS.get("free", {}))
        discount_pct = plan.get("discount_pct", 0)
    
    discount_amount = round(original_amount * discount_pct / 100, 2)
    amount = round(original_amount - discount_amount, 2)
    
    # Get Stripe API key
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Build URLs from frontend origin
    origin = request.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel"
    
    # Set up webhook URL
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Initialize Stripe checkout
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Determine payment methods
    if request.payment_method == "crypto":
        payment_methods = ["crypto"]
    elif request.payment_method == "both":
        payment_methods = ["card", "crypto"]
    else:
        payment_methods = ["card"]
    
    # Create metadata for tracking
    metadata = {
        "user_id": current_user.id,
        "user_email": current_user.email,
        "package_id": request.package_id,
        "package_name": package["name"],
        "notary_request_id": request.notary_request_id or "",
        "source": "notarychain_web",
        "discount_pct": str(discount_pct),
        "original_amount": str(original_amount),
        "plan_id": plan_id,
    }
    
    try:
        # Create checkout session request
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
            payment_methods=payment_methods
        )
        
        # Create checkout session
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record BEFORE redirect
        transaction_record = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": current_user.id,
            "user_email": current_user.email,
            "package_id": request.package_id,
            "package_name": package["name"],
            "original_amount": original_amount,
            "discount_pct": discount_pct,
            "discount_applied": discount_amount,
            "amount": amount,
            "currency": "usd",
            "payment_method": request.payment_method,
            "notary_request_id": request.notary_request_id,
            "payment_status": "pending",
            "status": "initiated",
            "plan_id": plan_id,
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.payment_transactions.insert_one(transaction_record)
        
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.session_id,
            package=package,
            amount=amount
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.get("/status/{session_id}")
async def get_payment_status(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Check payment status and update database.
    Used for polling after Stripe redirect.
    """
    # Get Stripe API key
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Find transaction in database
    transaction = await db.payment_transactions.find_one({
        "session_id": session_id,
        "user_id": current_user.id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed successfully, return cached status
    if transaction.get("payment_status") == "paid":
        return {
            "session_id": session_id,
            "status": "complete",
            "payment_status": "paid",
            "amount": transaction["amount"],
            "currency": transaction["currency"],
            "package": NOTARY_PACKAGES.get(transaction["package_id"], {}),
            "processed_at": transaction.get("processed_at")
        }
    
    try:
        # Initialize Stripe and check status
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update database based on status
        update_data = {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Mark as processed if paid (prevent double processing)
        if checkout_status.payment_status == "paid" and transaction.get("payment_status") != "paid":
            update_data["processed_at"] = datetime.now(timezone.utc)
            
            # Update related notary request if exists
            if transaction.get("notary_request_id"):
                await db.notary_requests.update_one(
                    {"id": transaction["notary_request_id"]},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
                )
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return {
            "session_id": session_id,
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount": checkout_status.amount_total / 100,  # Convert from cents
            "currency": checkout_status.currency,
            "package": NOTARY_PACKAGES.get(transaction["package_id"], {}),
            "metadata": checkout_status.metadata
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


@router.get("/history")
async def get_payment_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get user's payment history"""
    transactions = await db.payment_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "count": len(transactions),
        "transactions": transactions
    }


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    Updates payment status in database.
    """
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction based on webhook event
        if webhook_response.session_id:
            update_data = {
                "payment_status": webhook_response.payment_status,
                "webhook_event_id": webhook_response.event_id,
                "webhook_event_type": webhook_response.event_type,
                "updated_at": datetime.now(timezone.utc)
            }
            
            if webhook_response.payment_status == "paid":
                update_data["processed_at"] = datetime.now(timezone.utc)
            
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": update_data}
            )
        
        return {"status": "received"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")
