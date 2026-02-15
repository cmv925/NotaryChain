"""
Compliance & Audit Logging System for Notary Platform
Provides immutable audit trail for all notarization actions
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid

from models import User
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/audit", tags=["audit-logs"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class AuditAction(str, Enum):
    # User actions
    USER_SIGNUP = "user.signup"
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_PROFILE_UPDATE = "user.profile_update"
    
    # Document actions
    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_ANALYSIS = "document.analysis"
    DOCUMENT_DELETE = "document.delete"
    
    # Notarization actions
    NOTARIZATION_REQUEST_CREATED = "notarization.request_created"
    NOTARIZATION_REQUEST_ASSIGNED = "notarization.request_assigned"
    NOTARIZATION_SESSION_STARTED = "notarization.session_started"
    NOTARIZATION_SESSION_ENDED = "notarization.session_ended"
    NOTARIZATION_COMPLETED = "notarization.completed"
    NOTARIZATION_REJECTED = "notarization.rejected"
    
    # Verification actions
    BIOMETRIC_VERIFICATION_STARTED = "verification.biometric_started"
    BIOMETRIC_VERIFICATION_PASSED = "verification.biometric_passed"
    BIOMETRIC_VERIFICATION_FAILED = "verification.biometric_failed"
    IDENTITY_VERIFIED = "verification.identity_verified"
    
    # Blockchain actions
    DOCUMENT_SEALED = "blockchain.document_sealed"
    DOCUMENT_VERIFIED = "blockchain.document_verified"
    
    # Payment actions
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_COMPLETED = "payment.completed"
    PAYMENT_FAILED = "payment.failed"
    CRYPTO_PAYMENT_CREATED = "payment.crypto_created"
    CRYPTO_PAYMENT_CONFIRMED = "payment.crypto_confirmed"
    
    # Notary actions
    NOTARY_APPLICATION_SUBMITTED = "notary.application_submitted"
    NOTARY_APPLICATION_APPROVED = "notary.application_approved"
    NOTARY_APPLICATION_REJECTED = "notary.application_rejected"
    NOTARY_STATUS_CHANGED = "notary.status_changed"
    
    # Admin actions
    ADMIN_USER_DISABLED = "admin.user_disabled"
    ADMIN_USER_ENABLED = "admin.user_enabled"
    ADMIN_ROLE_CHANGED = "admin.role_changed"
    ADMIN_SETTINGS_UPDATED = "admin.settings_updated"


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AuditLogCreate(BaseModel):
    action: AuditAction
    resource_type: str  # user, document, notarization, payment, etc.
    resource_id: Optional[str] = None
    description: str
    metadata: Optional[dict] = None
    severity: AuditSeverity = AuditSeverity.INFO
    ip_address: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    description: str
    user_id: Optional[str]
    user_email: Optional[str]
    severity: str
    ip_address: Optional[str]
    metadata: Optional[dict]
    timestamp: str


class AuditLogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    logs: List[AuditLogResponse]


async def create_audit_log(
    action: AuditAction,
    resource_type: str,
    description: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    severity: AuditSeverity = AuditSeverity.INFO,
    ip_address: Optional[str] = None
):
    """
    Create an audit log entry. This function can be called from any route.
    """
    log_entry = {
        "id": f"audit_{uuid.uuid4().hex[:16]}",
        "action": action.value,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "description": description,
        "user_id": user_id,
        "user_email": user_email,
        "severity": severity.value,
        "ip_address": ip_address,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.audit_logs.insert_one(log_entry)
    return log_entry["id"]


@router.get("/logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get audit logs with filtering and pagination.
    Requires admin role.
    """
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query filter
    query = {}
    
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if user_id:
        query["user_id"] = user_id
    if severity:
        query["severity"] = severity
    
    # Date range filter
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if end_date:
            query["timestamp"]["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    # Get total count
    total = await db.audit_logs.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * page_size
    logs = await db.audit_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # Format timestamps
    formatted_logs = []
    for log in logs:
        log["timestamp"] = log["timestamp"].isoformat() if isinstance(log["timestamp"], datetime) else log["timestamp"]
        formatted_logs.append(AuditLogResponse(**log))
    
    return AuditLogListResponse(
        total=total,
        page=page,
        page_size=page_size,
        logs=formatted_logs
    )


@router.get("/logs/{log_id}")
async def get_audit_log_detail(
    log_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed audit log entry"""
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    log = await db.audit_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    if isinstance(log.get("timestamp"), datetime):
        log["timestamp"] = log["timestamp"].isoformat()
    if isinstance(log.get("created_at"), datetime):
        log["created_at"] = log["created_at"].isoformat()
    
    return log


@router.get("/stats")
async def get_audit_stats(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get audit log statistics"""
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total logs in period
    total_logs = await db.audit_logs.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # Logs by action type
    action_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    action_stats = await db.audit_logs.aggregate(action_pipeline).to_list(20)
    
    # Logs by severity
    severity_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]
    severity_stats = await db.audit_logs.aggregate(severity_pipeline).to_list(10)
    
    # Logs by resource type
    resource_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$resource_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    resource_stats = await db.audit_logs.aggregate(resource_pipeline).to_list(20)
    
    # Daily activity
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_stats = await db.audit_logs.aggregate(daily_pipeline).to_list(days)
    
    return {
        "period_days": days,
        "total_logs": total_logs,
        "by_action": {item["_id"]: item["count"] for item in action_stats},
        "by_severity": {item["_id"]: item["count"] for item in severity_stats},
        "by_resource": {item["_id"]: item["count"] for item in resource_stats},
        "daily_activity": {item["_id"]: item["count"] for item in daily_stats}
    }


@router.get("/export")
async def export_audit_logs(
    start_date: str,
    end_date: str,
    format: str = Query("json", enum=["json", "csv"]),
    current_user: User = Depends(get_current_user)
):
    """Export audit logs for compliance reporting"""
    # Check admin role
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {
        "timestamp": {
            "$gte": datetime.fromisoformat(start_date.replace("Z", "+00:00")),
            "$lte": datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        }
    }
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", 1).to_list(10000)
    
    # Format timestamps
    for log in logs:
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
        if isinstance(log.get("created_at"), datetime):
            log["created_at"] = log["created_at"].isoformat()
    
    if format == "csv":
        # Generate CSV content
        if not logs:
            return {"csv": "No logs found for the specified period"}
        
        headers = ["id", "timestamp", "action", "resource_type", "resource_id", "user_id", "user_email", "severity", "description"]
        csv_lines = [",".join(headers)]
        
        for log in logs:
            row = [
                str(log.get(h, "")) for h in headers
            ]
            # Escape commas and quotes in description
            row[-1] = f'"{row[-1]}"' if "," in row[-1] else row[-1]
            csv_lines.append(",".join(row))
        
        return {
            "format": "csv",
            "content": "\n".join(csv_lines),
            "record_count": len(logs)
        }
    
    return {
        "format": "json",
        "logs": logs,
        "record_count": len(logs)
    }


@router.get("/user/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get activity logs for a specific user"""
    # Check admin role or self
    user_doc = await db.users.find_one({"email": current_user.email})
    is_admin = user_doc and user_doc.get("role") == "admin"
    is_self = current_user.id == user_id
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Access denied")
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    logs = await db.audit_logs.find(
        {
            "user_id": user_id,
            "timestamp": {"$gte": start_date}
        },
        {"_id": 0}
    ).sort("timestamp", -1).limit(500).to_list(500)
    
    for log in logs:
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {
        "user_id": user_id,
        "period_days": days,
        "total_actions": len(logs),
        "logs": logs
    }


# Helper function to be used by other routes
async def log_action(
    action: AuditAction,
    resource_type: str,
    description: str,
    user: Optional[User] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    severity: AuditSeverity = AuditSeverity.INFO,
    ip_address: Optional[str] = None
):
    """Helper function to create audit logs from other routes"""
    return await create_audit_log(
        action=action,
        resource_type=resource_type,
        description=description,
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        resource_id=resource_id,
        metadata=metadata,
        severity=severity,
        ip_address=ip_address
    )
