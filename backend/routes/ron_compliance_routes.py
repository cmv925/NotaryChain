"""
RON Compliance Routes
State-by-state Remote Online Notarization rules, validation, and admin management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from models import User
from routes.auth_routes import get_current_user
from services.ron_compliance_service import (
    get_all_states, get_state_rules, get_compliance_stats, validate_ron_request
)
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compliance/ron", tags=["ron-compliance"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class ValidateRequest(BaseModel):
    state_code: str
    document_type: str
    signer_count: int = 1

class AdminUpdateRules(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


# --- Public endpoints ---

@router.get("/states")
async def list_all_states():
    """Get all US states and their RON status"""
    states = get_all_states()
    stats = get_compliance_stats()
    return {"states": states, "stats": stats}


@router.get("/states/{state_code}")
async def get_state(state_code: str):
    """Get RON rules for a specific state"""
    rules = get_state_rules(state_code)
    if not rules:
        raise HTTPException(status_code=404, detail=f"State code '{state_code}' not found")
    return rules


@router.post("/validate")
async def validate_request(
    body: ValidateRequest,
    current_user: User = Depends(get_current_user)
):
    """Validate a notarization request against state RON rules"""
    result = validate_ron_request(body.state_code, body.document_type, body.signer_count)

    # Log the validation
    await db.ron_compliance_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "state_code": body.state_code.upper(),
        "document_type": body.document_type,
        "signer_count": body.signer_count,
        "compliant": result["compliant"],
        "errors": result["errors"],
        "warnings": result["warnings"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return result


@router.get("/stats")
async def compliance_stats():
    """Get compliance coverage statistics"""
    stats = get_compliance_stats()
    return stats


# --- Admin endpoints ---

@router.get("/violations")
async def get_violations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get compliance violation/warning logs (admin only)"""
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    skip = (page - 1) * page_size
    logs = await db.ron_compliance_logs.find(
        {"$or": [{"compliant": False}, {"warnings": {"$ne": []}}]},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)

    total = await db.ron_compliance_logs.count_documents(
        {"$or": [{"compliant": False}, {"warnings": {"$ne": []}}]}
    )

    return {"violations": logs, "total": total, "page": page, "page_size": page_size}


@router.get("/activity")
async def get_compliance_activity(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get all compliance validation activity (admin only)"""
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    skip = (page - 1) * page_size
    logs = await db.ron_compliance_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)

    total = await db.ron_compliance_logs.count_documents({})

    # Aggregated stats
    failed_count = await db.ron_compliance_logs.count_documents({"compliant": False})
    warning_count = await db.ron_compliance_logs.count_documents({"warnings": {"$ne": []}})

    return {
        "activity": logs,
        "total": total,
        "page": page,
        "summary": {
            "total_checks": total,
            "failed": failed_count,
            "with_warnings": warning_count,
            "pass_rate": round((total - failed_count) / total * 100, 1) if total else 0,
        }
    }
