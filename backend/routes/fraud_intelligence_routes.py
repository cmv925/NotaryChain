"""
Fraud Intelligence & RON Compliance Routes
Admin CRUD for fraud patterns and RON rules + public fraud context API.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import uuid

router = APIRouter(prefix="/api/fraud-intelligence", tags=["fraud-intelligence"])
db = None


def set_db(database):
    global db
    db = database


class FraudPatternCreate(BaseModel):
    category: str  # identity, document, biometric, transaction
    title: str
    description: str
    severity: str  # low, medium, high, critical
    indicators: List[str] = []
    document_types: List[str] = ["all"]
    active: bool = True


class RONRuleUpdate(BaseModel):
    ron_enabled: Optional[bool] = None
    statute: Optional[str] = None
    notes: Optional[str] = None
    prohibited_documents: Optional[List[str]] = None


# ─── Auth ───

async def _get_admin(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")
    return user


async def _get_user(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ═══════════════════════════════════════════════════════
#  FRAUD PATTERNS
# ═══════════════════════════════════════════════════════

@router.get("/patterns")
async def list_fraud_patterns(request: Request):
    """List all fraud patterns."""
    await _get_user(request)
    patterns = []
    async for p in db.fraud_patterns.find({}, {"_id": 0}).sort("severity", -1):
        patterns.append(p)
    return {"patterns": patterns, "total": len(patterns)}


@router.post("/patterns")
async def create_fraud_pattern(req: FraudPatternCreate, request: Request):
    """Create a new fraud pattern (admin/notary only)."""
    await _get_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    pattern = {
        "pattern_id": f"FP-{uuid.uuid4().hex[:6].upper()}",
        **req.dict(),
        "created_at": now,
        "updated_at": now,
    }
    await db.fraud_patterns.insert_one(pattern)
    pattern.pop("_id", None)
    return pattern


@router.put("/patterns/{pattern_id}")
async def update_fraud_pattern(pattern_id: str, req: FraudPatternCreate, request: Request):
    """Update a fraud pattern."""
    await _get_admin(request)
    result = await db.fraud_patterns.update_one(
        {"pattern_id": pattern_id},
        {"$set": {**req.dict(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    updated = await db.fraud_patterns.find_one({"pattern_id": pattern_id}, {"_id": 0})
    return updated


@router.delete("/patterns/{pattern_id}")
async def delete_fraud_pattern(pattern_id: str, request: Request):
    """Delete a fraud pattern."""
    await _get_admin(request)
    result = await db.fraud_patterns.delete_one({"pattern_id": pattern_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    return {"deleted": True, "pattern_id": pattern_id}


@router.post("/patterns/{pattern_id}/toggle")
async def toggle_fraud_pattern(pattern_id: str, request: Request):
    """Toggle active/inactive status."""
    await _get_admin(request)
    pattern = await db.fraud_patterns.find_one({"pattern_id": pattern_id}, {"_id": 0})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")
    new_active = not pattern.get("active", True)
    await db.fraud_patterns.update_one(
        {"pattern_id": pattern_id},
        {"$set": {"active": new_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"pattern_id": pattern_id, "active": new_active}


# ═══════════════════════════════════════════════════════
#  RON RULES
# ═══════════════════════════════════════════════════════

@router.get("/ron-rules")
async def list_ron_rules(request: Request):
    """List all RON compliance rules."""
    await _get_user(request)
    rules = []
    async for r in db.ron_rules.find({}, {"_id": 0}).sort("jurisdiction", 1):
        rules.append(r)
    return {"rules": rules, "total": len(rules)}


@router.get("/ron-rules/{jurisdiction}")
async def get_ron_rule(jurisdiction: str, request: Request):
    """Get RON rule for a specific jurisdiction."""
    await _get_user(request)
    rule = await db.ron_rules.find_one({"jurisdiction": jurisdiction}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="RON rule not found for this jurisdiction")
    return rule


@router.put("/ron-rules/{jurisdiction}")
async def update_ron_rule(jurisdiction: str, req: RONRuleUpdate, request: Request):
    """Update RON rule for a jurisdiction."""
    await _get_admin(request)
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.ron_rules.update_one({"jurisdiction": jurisdiction}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="RON rule not found")
    return await db.ron_rules.find_one({"jurisdiction": jurisdiction}, {"_id": 0})


# ═══════════════════════════════════════════════════════
#  SEED & CONTEXT
# ═══════════════════════════════════════════════════════

@router.post("/seed")
async def seed_data(request: Request):
    """Seed default fraud patterns and RON rules."""
    await _get_admin(request)
    from services.fraud_intelligence_service import seed_fraud_intelligence
    await seed_fraud_intelligence(db)
    patterns = await db.fraud_patterns.count_documents({})
    rules = await db.ron_rules.count_documents({})
    return {"seeded": True, "fraud_patterns": patterns, "ron_rules": rules}


@router.get("/context")
async def get_context(request: Request, document_type: str = "general", jurisdiction: str = "US-General"):
    """Get the fraud context that would be injected into ANAN agents."""
    await _get_user(request)
    from services.fraud_intelligence_service import get_fraud_context
    context = await get_fraud_context(db, document_type, jurisdiction)
    return {"context": context, "document_type": document_type, "jurisdiction": jurisdiction}


# ═══════════════════════════════════════════════════════
#  DASHBOARD STATS
# ═══════════════════════════════════════════════════════

@router.get("/stats")
async def get_fraud_stats(request: Request):
    """Get fraud intelligence overview stats."""
    await _get_user(request)
    total_patterns = await db.fraud_patterns.count_documents({})
    active_patterns = await db.fraud_patterns.count_documents({"active": True})
    critical = await db.fraud_patterns.count_documents({"severity": "critical", "active": True})
    high = await db.fraud_patterns.count_documents({"severity": "high", "active": True})
    total_ron = await db.ron_rules.count_documents({})
    ron_enabled = await db.ron_rules.count_documents({"ron_enabled": True})

    return {
        "fraud_patterns": {"total": total_patterns, "active": active_patterns, "critical": critical, "high": high},
        "ron_rules": {"total": total_ron, "enabled": ron_enabled, "disabled": total_ron - ron_enabled},
    }
