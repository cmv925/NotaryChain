"""
Organization Activity Audit Log Routes
Provides org-scoped audit trails for organization admins.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["org-activity"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# All org-relevant action types for filtering
ORG_ACTION_TYPES = [
    {"key": "member.joined", "label": "Member Joined", "category": "Members"},
    {"key": "member.removed", "label": "Member Removed", "category": "Members"},
    {"key": "member.role_changed", "label": "Role Changed", "category": "Members"},
    {"key": "member.invited", "label": "Member Invited", "category": "Members"},
    {"key": "role.created", "label": "Role Created", "category": "RBAC"},
    {"key": "role.updated", "label": "Role Updated", "category": "RBAC"},
    {"key": "role.deleted", "label": "Role Deleted", "category": "RBAC"},
    {"key": "role.assigned", "label": "Role Assigned", "category": "RBAC"},
    {"key": "sso_login", "label": "SSO Login", "category": "Authentication"},
    {"key": "sso.configured", "label": "SSO Configured", "category": "Authentication"},
    {"key": "vault.uploaded", "label": "Document Uploaded", "category": "Vault"},
    {"key": "vault.deleted", "label": "Document Deleted", "category": "Vault"},
    {"key": "branding.updated", "label": "Branding Updated", "category": "Settings"},
    {"key": "org.settings_updated", "label": "Settings Updated", "category": "Settings"},
    {"key": "approval.created", "label": "Approval Created", "category": "Workflows"},
    {"key": "approval.decided", "label": "Approval Decided", "category": "Workflows"},
]


async def log_org_activity(
    org_id: str,
    action: str,
    actor_id: str,
    actor_email: str,
    description: str,
    target_type: str = None,
    target_id: str = None,
    target_name: str = None,
    metadata: dict = None,
):
    """Log an org-scoped activity event."""
    entry = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "action": action,
        "actor_id": actor_id,
        "actor_email": actor_email,
        "description": description,
        "target_type": target_type,
        "target_id": target_id,
        "target_name": target_name,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.org_activity_logs.insert_one(entry)
    return entry["id"]


@router.get("/{org_id}/activity")
async def get_org_activity(
    org_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Get activity log for an organization (admin or users with org permissions)."""
    # Verify membership
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user.id, "status": "active"},
        {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    # Only admins/owners or users with org:settings can view audit logs
    if membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required to view activity logs")

    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = {"org_id": org_id, "timestamp": {"$gte": start_date}}
    if action:
        query["action"] = action
    if actor_id:
        query["actor_id"] = actor_id

    total = await db.org_activity_logs.count_documents(query)
    skip = (page - 1) * page_size
    logs = await db.org_activity_logs.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": logs,
    }


@router.get("/{org_id}/activity/stats")
async def get_org_activity_stats(
    org_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Get activity statistics for an organization."""
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user.id, "status": "active"},
        {"_id": 0}
    )
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    base_query = {"org_id": org_id, "timestamp": {"$gte": start_date}}

    total = await db.org_activity_logs.count_documents(base_query)

    # By action
    action_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    action_stats = await db.org_activity_logs.aggregate(action_pipeline).to_list(50)

    # By actor
    actor_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$actor_email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    actor_stats = await db.org_activity_logs.aggregate(actor_pipeline).to_list(10)

    # Daily trend
    daily_pipeline = [
        {"$match": base_query},
        {"$addFields": {"date_str": {"$substr": ["$timestamp", 0, 10]}}},
        {"$group": {"_id": "$date_str", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_stats = await db.org_activity_logs.aggregate(daily_pipeline).to_list(days)

    return {
        "period_days": days,
        "total_events": total,
        "by_action": {item["_id"]: item["count"] for item in action_stats},
        "by_actor": {item["_id"]: item["count"] for item in actor_stats},
        "daily_trend": [{"date": item["_id"], "count": item["count"]} for item in daily_stats],
        "action_types": ORG_ACTION_TYPES,
    }


@router.get("/{org_id}/activity/export")
async def export_org_activity(
    org_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Export org activity logs as JSON."""
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user.id, "status": "active"},
        {"_id": 0}
    )
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    logs = await db.org_activity_logs.find(
        {"org_id": org_id, "timestamp": {"$gte": start_date}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(5000)

    return {
        "org_id": org_id,
        "period_days": days,
        "record_count": len(logs),
        "logs": logs,
    }
