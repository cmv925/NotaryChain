"""
Auto-Learning Threat Detection Routes
Endpoints for threat analytics, learning status, and pattern management.
"""
from fastapi import APIRouter, HTTPException, Request
from middleware.feature_gate import enforce_feature_gate
from datetime import datetime, timezone

router = APIRouter(prefix="/api/threat-learning", tags=["threat-learning"])
db = None


def set_db(database):
    global db
    db = database


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


@router.get("/analytics")
async def get_analytics(request: Request):
    """Get threat detection analytics dashboard data."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    from services.threat_learning_service import get_threat_analytics
    return await get_threat_analytics(db)


@router.get("/patterns")
async def list_auto_learned_patterns(request: Request):
    """List all auto-learned fraud patterns."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    patterns = []
    async for p in db.fraud_patterns.find({"auto_learned": True}, {"_id": 0}).sort("hit_count", -1):
        patterns.append(p)
    return {"patterns": patterns, "total": len(patterns)}


@router.post("/analyze/{ceremony_id}")
async def analyze_ceremony(ceremony_id: str, request: Request):
    """Manually trigger threat analysis on a completed ceremony."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")
    from services.threat_learning_service import analyze_ceremony_response
    result = await analyze_ceremony_response(db, ceremony)
    return result


@router.get("/analyses")
async def list_analyses(request: Request, limit: int = 20):
    """List recent threat analyses."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    analyses = []
    async for a in db.threat_analyses.find({}, {"_id": 0}).sort("analyzed_at", -1).limit(limit):
        analyses.append(a)
    return {"analyses": analyses, "total": len(analyses)}


@router.delete("/patterns/{pattern_id}")
async def delete_auto_pattern(pattern_id: str, request: Request):
    """Delete an auto-learned pattern (admin only)."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    result = await db.fraud_patterns.delete_one({"pattern_id": pattern_id, "auto_learned": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auto-learned pattern not found")
    return {"deleted": True, "pattern_id": pattern_id}


@router.post("/patterns/{pattern_id}/toggle")
async def toggle_auto_pattern(pattern_id: str, request: Request):
    """Toggle an auto-learned pattern active/inactive."""
    await enforce_feature_gate(request, "fraud_intelligence")
    await _get_admin(request)
    pattern = await db.fraud_patterns.find_one({"pattern_id": pattern_id, "auto_learned": True}, {"_id": 0})
    if not pattern:
        raise HTTPException(status_code=404, detail="Auto-learned pattern not found")
    new_active = not pattern.get("active", True)
    await db.fraud_patterns.update_one(
        {"pattern_id": pattern_id},
        {"$set": {"active": new_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"pattern_id": pattern_id, "active": new_active}
