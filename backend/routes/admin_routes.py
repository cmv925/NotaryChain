"""
Admin Dashboard Routes for Notary Platform
Provides platform management capabilities
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user
from routes.audit_routes import log_action, AuditAction, AuditSeverity
from services.email_service import email_service
from services.notification_service import create_notification
from services.cache_service import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    status: str
    is_notary: bool
    created_at: str
    last_login: Optional[str]


class NotaryApplicationResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    full_name: str
    commission_number: Optional[str]
    state: Optional[str]
    status: str
    applied_at: str


class PlatformStats(BaseModel):
    total_users: int
    active_users_30d: int
    total_notaries: int
    pending_notary_applications: int
    total_notarizations: int
    completed_notarizations: int
    total_revenue_usd: float
    crypto_payments_count: int
    documents_sealed: int


async def check_admin(current_user: User) -> dict:
    """Check if user is admin and return user doc"""
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_doc


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    current_user: User = Depends(get_current_user)
):
    """Get platform-wide statistics"""
    await check_admin(current_user)
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    # User stats
    total_users = await db.users.count_documents({})
    active_users = await db.audit_logs.distinct("user_id", {
        "timestamp": {"$gte": thirty_days_ago}
    })
    
    # Notary stats
    total_notaries = await db.notary_profiles.count_documents({"status": "approved"})
    pending_applications = await db.notary_profiles.count_documents({"status": "pending"})
    
    # Notarization stats
    total_notarizations = await db.notarization_requests.count_documents({})
    completed_notarizations = await db.notarization_requests.count_documents({"status": "completed"})
    
    # Payment stats
    stripe_payments = await db.payments.find({"status": "paid"}).to_list(10000)
    crypto_payments = await db.crypto_payments.find({"status": "confirmed"}).to_list(10000)
    
    total_revenue = sum(p.get("amount", 0) / 100 for p in stripe_payments)  # Stripe is in cents
    total_revenue += sum(p.get("usd_amount", 0) for p in crypto_payments)
    
    # Document stats
    documents_sealed = await db.blockchain_seals.count_documents({})
    
    return PlatformStats(
        total_users=total_users,
        active_users_30d=len(active_users),
        total_notaries=total_notaries,
        pending_notary_applications=pending_applications,
        total_notarizations=total_notarizations,
        completed_notarizations=completed_notarizations,
        total_revenue_usd=round(total_revenue, 2),
        crypto_payments_count=len(crypto_payments),
        documents_sealed=documents_sealed
    )


@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all users with pagination and filtering"""
    await check_admin(current_user)
    
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    total = await db.users.count_documents(query)
    skip = (page - 1) * page_size
    
    users = await db.users.find(
        query,
        {"_id": 0, "hashed_password": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # Check notary status for each user
    for user in users:
        notary = await db.notary_profiles.find_one({"user_id": user.get("id")})
        user["is_notary"] = notary is not None and notary.get("status") == "approved"
        user["status"] = user.get("status", "active")
        if isinstance(user.get("created_at"), datetime):
            user["created_at"] = user["created_at"].isoformat()
        if isinstance(user.get("last_login"), datetime):
            user["last_login"] = user["last_login"].isoformat()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": users
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed user information"""
    await check_admin(current_user)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get notary profile if exists
    notary_profile = await db.notary_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get recent activity
    recent_activity = await db.audit_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    # Get payment history
    stripe_payments = await db.payments.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    crypto_payments = await db.crypto_payments.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    
    # Get notarization requests
    notarizations = await db.notarization_requests.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    
    # Format dates
    for item in recent_activity + stripe_payments + crypto_payments + notarizations:
        for field in ["timestamp", "created_at", "updated_at", "expires_at", "confirmed_at"]:
            if field in item and isinstance(item[field], datetime):
                item[field] = item[field].isoformat()
    
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = user["created_at"].isoformat()
    
    return {
        "user": user,
        "notary_profile": notary_profile,
        "recent_activity": recent_activity,
        "payments": {
            "stripe": stripe_payments,
            "crypto": crypto_payments
        },
        "notarizations": notarizations
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status: str = Query(..., enum=["active", "disabled", "suspended"]),
    current_user: User = Depends(get_current_user)
):
    """Enable or disable a user account"""
    await check_admin(current_user)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-disable
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")
    
    old_status = user.get("status", "active")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Log the action
    action = AuditAction.ADMIN_USER_DISABLED if status == "disabled" else AuditAction.ADMIN_USER_ENABLED
    await log_action(
        action=action,
        resource_type="user",
        resource_id=user_id,
        description=f"User status changed from {old_status} to {status}",
        user=current_user,
        metadata={"old_status": old_status, "new_status": status},
        severity=AuditSeverity.WARNING
    )
    
    return {"message": f"User status updated to {status}", "user_id": user_id}


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(..., enum=["user", "notary", "admin"]),
    current_user: User = Depends(get_current_user)
):
    """Change user role"""
    await check_admin(current_user)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self role change
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own role")
    
    old_role = user.get("role", "user")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role, "updated_at": datetime.now(timezone.utc)}}
    )
    
    await log_action(
        action=AuditAction.ADMIN_ROLE_CHANGED,
        resource_type="user",
        resource_id=user_id,
        description=f"User role changed from {old_role} to {role}",
        user=current_user,
        metadata={"old_role": old_role, "new_role": role},
        severity=AuditSeverity.CRITICAL
    )
    
    return {"message": f"User role updated to {role}", "user_id": user_id}


@router.get("/notaries")
async def get_notaries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all notary profiles/applications"""
    await check_admin(current_user)
    
    query = {}
    if status:
        query["status"] = status
    
    total = await db.notary_profiles.count_documents(query)
    skip = (page - 1) * page_size
    
    notaries = await db.notary_profiles.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # Enrich with user data
    for notary in notaries:
        user = await db.users.find_one({"id": notary.get("user_id")}, {"_id": 0, "hashed_password": 0})
        if user:
            notary["user_email"] = user.get("email")
            notary["user_full_name"] = user.get("full_name")
        
        for field in ["created_at", "updated_at", "approved_at"]:
            if field in notary and isinstance(notary[field], datetime):
                notary[field] = notary[field].isoformat()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "notaries": notaries
    }


@router.get("/notaries/pending")
async def get_pending_applications(
    current_user: User = Depends(get_current_user)
):
    """Get pending notary applications"""
    await check_admin(current_user)
    
    applications = await db.notary_profiles.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    for app in applications:
        user = await db.users.find_one({"id": app.get("user_id")}, {"_id": 0, "hashed_password": 0})
        if user:
            app["user_email"] = user.get("email")
            app["user_full_name"] = user.get("full_name")
        
        if isinstance(app.get("created_at"), datetime):
            app["created_at"] = app["created_at"].isoformat()
    
    return {
        "count": len(applications),
        "applications": applications
    }


@router.post("/notaries/{notary_id}/approve")
async def approve_notary_application(
    notary_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Approve a notary application"""
    await check_admin(current_user)
    
    notary = await db.notary_profiles.find_one({"id": notary_id})
    if not notary:
        raise HTTPException(status_code=404, detail="Notary application not found")
    
    if notary.get("status") not in ["pending", "under_review"]:
        raise HTTPException(status_code=400, detail="Application is not pending or under review")
    
    await db.notary_profiles.update_one(
        {"id": notary_id},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc),
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update user role
    await db.users.update_one(
        {"id": notary["user_id"]},
        {"$set": {"role": "notary", "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Get user email for notification
    user = await db.users.find_one({"id": notary["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        background_tasks.add_task(
            email_service.send_application_approved_email,
            email=user.get("email"),
            full_name=user.get("full_name", "Notary"),
            commission_number=notary.get("commission_number")
        )
        logger.info(f"Approval email queued for {user.get('email')}")
    
    await log_action(
        action=AuditAction.NOTARY_APPLICATION_APPROVED,
        resource_type="notary",
        resource_id=notary_id,
        description=f"Notary application approved for user {notary.get('user_id')}",
        user=current_user,
        severity=AuditSeverity.INFO
    )

    # Send in-app notification
    background_tasks.add_task(
        create_notification,
        user_id=notary.get("user_id"),
        title="Application Approved",
        message="Your notary application has been approved! You can now accept notarization requests.",
        notif_type="success",
        link="/notary/dashboard"
    )
    
    return {"message": "Notary application approved", "notary_id": notary_id}


@router.post("/notaries/{notary_id}/reject")
async def reject_notary_application(
    notary_id: str,
    background_tasks: BackgroundTasks,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Reject a notary application"""
    await check_admin(current_user)
    
    notary = await db.notary_profiles.find_one({"id": notary_id})
    if not notary:
        raise HTTPException(status_code=404, detail="Notary application not found")
    
    if notary.get("status") not in ["pending", "under_review"]:
        raise HTTPException(status_code=400, detail="Application is not pending or under review")
    
    await db.notary_profiles.update_one(
        {"id": notary_id},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Get user email for notification
    user = await db.users.find_one({"id": notary["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        background_tasks.add_task(
            email_service.send_application_rejected_email,
            email=user.get("email"),
            full_name=user.get("full_name", "Applicant"),
            reason=reason
        )
        logger.info(f"Rejection email queued for {user.get('email')}")
    
    await log_action(
        action=AuditAction.NOTARY_APPLICATION_REJECTED,
        resource_type="notary",
        resource_id=notary_id,
        description=f"Notary application rejected: {reason or 'No reason provided'}",
        user=current_user,
        metadata={"reason": reason},
        severity=AuditSeverity.WARNING
    )

    # Send in-app notification
    background_tasks.add_task(
        create_notification,
        user_id=notary.get("user_id"),
        title="Application Update",
        message=f"Your notary application has been reviewed. {reason or 'Please contact support for details.'}",
        notif_type="warning",
        link="/notary/onboarding"
    )
    
    return {"message": "Notary application rejected", "notary_id": notary_id}


@router.post("/notaries/{notary_id}/review")
async def start_notary_review(
    notary_id: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Mark a notary application as under review"""
    await check_admin(current_user)
    
    notary = await db.notary_profiles.find_one({"id": notary_id})
    if not notary:
        raise HTTPException(status_code=404, detail="Notary application not found")
    
    if notary.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Application is not pending")
    
    await db.notary_profiles.update_one(
        {"id": notary_id},
        {
            "$set": {
                "status": "under_review",
                "review_notes": notes,
                "reviewed_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Application marked as under review", "notary_id": notary_id}


@router.get("/notaries/{notary_id}/credentials")
async def get_notary_credentials(
    notary_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get uploaded credentials for a notary application"""
    await check_admin(current_user)
    
    notary = await db.notary_profiles.find_one({"id": notary_id})
    if not notary:
        raise HTTPException(status_code=404, detail="Notary profile not found")
    
    # Get credentials (excluding binary data for listing)
    credentials = await db.notary_credentials.find(
        {"notary_profile_id": notary_id},
        {"_id": 0, "data": 0}
    ).to_list(20)
    
    # Get user info
    user = await db.users.find_one({"id": notary.get("user_id")}, {"_id": 0, "hashed_password": 0})
    
    # Format dates
    for cred in credentials:
        if isinstance(cred.get("uploaded_at"), datetime):
            cred["uploaded_at"] = cred["uploaded_at"].isoformat()
    
    for field in ["created_at", "updated_at", "reviewed_at", "approved_at"]:
        if field in notary and isinstance(notary[field], datetime):
            notary[field] = notary[field].isoformat()
    
    return {
        "notary": {k: v for k, v in notary.items() if k != "_id"},
        "user": user,
        "credentials": credentials
    }


@router.get("/analytics/revenue")
async def get_revenue_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get revenue analytics"""
    await check_admin(current_user)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Daily stripe revenue
    stripe_pipeline = [
        {"$match": {"status": "paid", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    stripe_daily = await db.payments.aggregate(stripe_pipeline).to_list(days)
    
    # Daily crypto revenue
    crypto_pipeline = [
        {"$match": {"status": "confirmed", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": "$usd_amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    crypto_daily = await db.crypto_payments.aggregate(crypto_pipeline).to_list(days)
    
    # Package breakdown
    package_pipeline = [
        {"$match": {"status": "paid", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$package_id",
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    package_stats = await db.payments.aggregate(package_pipeline).to_list(20)
    
    return {
        "period_days": days,
        "stripe_daily": [{"date": s["_id"], "amount": s["amount"] / 100, "count": s["count"]} for s in stripe_daily],
        "crypto_daily": [{"date": c["_id"], "amount": c["amount"], "count": c["count"]} for c in crypto_daily],
        "by_package": {p["_id"]: {"revenue": p["revenue"] / 100, "count": p["count"]} for p in package_stats if p["_id"]}
    }


@router.get("/analytics/notarizations")
async def get_notarization_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get notarization analytics"""
    await check_admin(current_user)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Daily notarizations
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_stats = await db.notarization_requests.aggregate(daily_pipeline).to_list(days)
    
    # By status
    status_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_stats = await db.notarization_requests.aggregate(status_pipeline).to_list(20)
    
    # By document type
    type_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$document_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    type_stats = await db.notarization_requests.aggregate(type_pipeline).to_list(20)
    
    return {
        "period_days": days,
        "daily": [{"date": d["_id"], "count": d["count"]} for d in daily_stats],
        "by_status": {s["_id"]: s["count"] for s in status_stats if s["_id"]},
        "by_document_type": {t["_id"]: t["count"] for t in type_stats if t["_id"]}
    }


@router.post("/seed-admin")
async def seed_admin_user():
    """Create initial admin user (only works if no admin exists)"""
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin user already exists")
    
    # Create admin user
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    admin_user = {
        "id": f"admin_{uuid.uuid4().hex[:12]}",
        "email": "admin@notarychain.com",
        "full_name": "Platform Admin",
        "hashed_password": pwd_context.hash("Admin123!"),
        "role": "admin",
        "status": "active",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(admin_user)
    
    return {
        "message": "Admin user created",
        "email": admin_user["email"],
        "password": "Admin123!",
        "note": "Please change the password immediately after first login"
    }


@router.get("/analytics/comprehensive")
async def get_comprehensive_analytics(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive analytics data for charts (cached 1min)"""
    await check_admin(current_user)

    cache_key = f"comprehensive_{days}"
    cached = cache_service.get("stats", cache_key)
    if cached:
        return cached
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Generate date range
    date_range = []
    for i in range(days):
        d = now - timedelta(days=days - 1 - i)
        date_range.append(d.strftime("%Y-%m-%d"))
    
    # === User Growth Over Time ===
    user_growth_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "new_users": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    user_growth_raw = await db.users.aggregate(user_growth_pipeline).to_list(365)
    user_growth_map = {d["_id"]: d["new_users"] for d in user_growth_raw}
    
    # Total users count up to each date
    total_users_before = await db.users.count_documents({"created_at": {"$lt": start_date}})
    user_growth = []
    cumulative = total_users_before
    for date in date_range:
        new_count = user_growth_map.get(date, 0)
        cumulative += new_count
        user_growth.append({"date": date, "new_users": new_count, "total_users": cumulative})
    
    # === Revenue Trends ===
    # Stripe revenue
    stripe_pipeline = [
        {"$match": {"status": "paid", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": "$amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    stripe_raw = await db.payments.aggregate(stripe_pipeline).to_list(365)
    stripe_map = {d["_id"]: d["amount"] / 100 for d in stripe_raw}  # Convert cents to dollars
    
    # Crypto revenue
    crypto_pipeline = [
        {"$match": {"status": "confirmed", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": "$usd_amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    crypto_raw = await db.crypto_payments.aggregate(crypto_pipeline).to_list(365)
    crypto_map = {d["_id"]: d["amount"] for d in crypto_raw}
    
    revenue_trends = []
    total_stripe = 0
    total_crypto = 0
    for date in date_range:
        stripe_amt = stripe_map.get(date, 0)
        crypto_amt = crypto_map.get(date, 0)
        total_stripe += stripe_amt
        total_crypto += crypto_amt
        revenue_trends.append({
            "date": date,
            "stripe": round(stripe_amt, 2),
            "crypto": round(crypto_amt, 2),
            "total": round(stripe_amt + crypto_amt, 2)
        })
    
    # === Notarization Volume ===
    notarization_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    notarization_raw = await db.notarization_requests.aggregate(notarization_pipeline).to_list(365)
    notarization_map = {d["_id"]: {"count": d["count"], "completed": d["completed"]} for d in notarization_raw}
    
    notarization_volume = []
    for date in date_range:
        data = notarization_map.get(date, {"count": 0, "completed": 0})
        notarization_volume.append({
            "date": date,
            "total": data["count"],
            "completed": data["completed"],
            "pending": data["count"] - data["completed"]
        })
    
    # === Transaction Activity (Transaction Orchestrator) ===
    transaction_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    transaction_raw = await db.transactions.aggregate(transaction_pipeline).to_list(365)
    transaction_map = {d["_id"]: d["count"] for d in transaction_raw}
    
    transaction_activity = []
    for date in date_range:
        transaction_activity.append({
            "date": date,
            "transactions": transaction_map.get(date, 0)
        })
    
    # === Payment Distribution (Pie Chart) ===
    total_stripe_revenue = sum(r["stripe"] for r in revenue_trends)
    total_crypto_revenue = sum(r["crypto"] for r in revenue_trends)
    
    # Get crypto by type
    crypto_by_type = await db.crypto_payments.aggregate([
        {"$match": {"status": "confirmed", "created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$crypto_type", "amount": {"$sum": "$usd_amount"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    
    payment_distribution = [
        {"name": "Stripe (Card)", "value": round(total_stripe_revenue, 2), "color": "#635BFF"}
    ]
    for ct in crypto_by_type:
        payment_distribution.append({
            "name": ct["_id"].upper() if ct["_id"] else "Other Crypto",
            "value": round(ct["amount"], 2),
            "color": "#F7931A" if ct["_id"] == "btc" else "#627EEA" if ct["_id"] == "eth" else "#2775CA"
        })
    
    # === Notary Activity (Top Notaries) ===
    notary_activity_pipeline = [
        {"$match": {"status": "completed", "notary_id": {"$ne": None}}},
        {"$group": {"_id": "$notary_id", "completed_count": {"$sum": 1}}},
        {"$sort": {"completed_count": -1}},
        {"$limit": 10}
    ]
    top_notaries_raw = await db.notarization_requests.aggregate(notary_activity_pipeline).to_list(10)
    
    top_notaries = []
    for n in top_notaries_raw:
        notary_profile = await db.notary_profiles.find_one({"user_id": n["_id"]})
        user = await db.users.find_one({"id": n["_id"]})
        if notary_profile or user:
            top_notaries.append({
                "notary_id": n["_id"],
                "name": notary_profile.get("full_name") if notary_profile else (user.get("full_name") if user else "Unknown"),
                "email": user.get("email") if user else "N/A",
                "completed_notarizations": n["completed_count"]
            })
    
    # === Document Types Distribution ===
    doc_type_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$document_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    doc_types_raw = await db.notarization_requests.aggregate(doc_type_pipeline).to_list(10)
    document_types = [{"name": d["_id"] or "Unspecified", "count": d["count"]} for d in doc_types_raw]
    
    # === Transaction Types Distribution ===
    tx_type_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$transaction_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    tx_types_raw = await db.transactions.aggregate(tx_type_pipeline).to_list(10)
    transaction_types = [{"name": (t["_id"] or "custom").replace("_", " ").title(), "count": t["count"]} for t in tx_types_raw]
    
    # === Summary Stats ===
    summary = {
        "period_days": days,
        "total_revenue": round(total_stripe_revenue + total_crypto_revenue, 2),
        "stripe_revenue": round(total_stripe_revenue, 2),
        "crypto_revenue": round(total_crypto_revenue, 2),
        "new_users": sum(u["new_users"] for u in user_growth),
        "total_notarizations": sum(n["total"] for n in notarization_volume),
        "completed_notarizations": sum(n["completed"] for n in notarization_volume),
        "total_transactions": sum(t["transactions"] for t in transaction_activity)
    }
    
    result = {
        "summary": summary,
        "user_growth": user_growth,
        "revenue_trends": revenue_trends,
        "notarization_volume": notarization_volume,
        "transaction_activity": transaction_activity,
        "payment_distribution": payment_distribution,
        "top_notaries": top_notaries,
        "document_types": document_types,
        "transaction_types": transaction_types
    }
    cache_service.set("stats", cache_key, result)
    return result
