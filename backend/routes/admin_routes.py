"""
Admin Dashboard Routes for Notary Platform
Provides platform management capabilities
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from models import User
from routes.auth_routes import get_current_user
from routes.audit_routes import log_action, AuditAction, AuditSeverity

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
    admin_doc = await check_admin(current_user)
    
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
    admin_doc = await check_admin(current_user)
    
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
    current_user: User = Depends(get_current_user)
):
    """Approve a notary application"""
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
                "status": "approved",
                "approved_at": datetime.now(timezone.utc),
                "approved_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update user role
    await db.users.update_one(
        {"id": notary["user_id"]},
        {"$set": {"role": "notary", "updated_at": datetime.now(timezone.utc)}}
    )
    
    await log_action(
        action=AuditAction.NOTARY_APPLICATION_APPROVED,
        resource_type="notary",
        resource_id=notary_id,
        description=f"Notary application approved for user {notary.get('user_id')}",
        user=current_user,
        severity=AuditSeverity.INFO
    )
    
    return {"message": "Notary application approved", "notary_id": notary_id}


@router.post("/notaries/{notary_id}/reject")
async def reject_notary_application(
    notary_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Reject a notary application"""
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
                "status": "rejected",
                "rejection_reason": reason,
                "rejected_at": datetime.now(timezone.utc),
                "rejected_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    await log_action(
        action=AuditAction.NOTARY_APPLICATION_REJECTED,
        resource_type="notary",
        resource_id=notary_id,
        description=f"Notary application rejected: {reason or 'No reason provided'}",
        user=current_user,
        metadata={"reason": reason},
        severity=AuditSeverity.WARNING
    )
    
    return {"message": "Notary application rejected", "notary_id": notary_id}


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
