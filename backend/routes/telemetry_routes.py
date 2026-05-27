"""
Dashboard Telemetry — single audit stream for both admin & notary surfaces.

Every fetch / mutation / portal-tour event from the dashboards posts here.
Admins can view a real-time feed and aggregate stats (tour completion rate).

POST /api/telemetry/event              → any authenticated user logs an event
GET  /api/admin/telemetry/recent       → admin only, last 200 events
GET  /api/admin/analytics/tour-completion → admin only, aggregate tour stats
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

from routes.auth_routes import get_current_user
from models import User

router = APIRouter(prefix="/api", tags=["telemetry"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# ─── Models ──────────────────────────────────────────────────
class TelemetryEvent(BaseModel):
    surface: str = Field(..., description="e.g. command_authority, assurance, client_sovereign, tour")
    action: str = Field(..., description="e.g. fetch_stats, approve_notary, tour_started, tour_completed")
    target_id: Optional[str] = None
    outcome: Optional[str] = Field(None, description="success | error | skipped | completed")
    meta: Optional[Dict[str, Any]] = None


# ─── Routes ──────────────────────────────────────────────────
@router.post("/telemetry/event")
async def log_event(payload: TelemetryEvent, current_user: User = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor_id": current_user.id,
        "actor_email": current_user.email,
        "actor_role": getattr(current_user, "role", "user") or "user",
        "surface": payload.surface,
        "action": payload.action,
        "target_id": payload.target_id,
        "outcome": payload.outcome,
        "meta": payload.meta or {},
    }
    await db.dashboard_telemetry.insert_one(doc)
    # Keep the collection bounded so the admin feed stays fast (best-effort).
    try:
        count = await db.dashboard_telemetry.estimated_document_count()
        if count > 5000:
            # Trim oldest 1000 events.
            cursor = db.dashboard_telemetry.find({}, {"id": 1, "ts": 1}).sort("ts", 1).limit(1000)
            to_delete = [d["id"] async for d in cursor]
            if to_delete:
                await db.dashboard_telemetry.delete_many({"id": {"$in": to_delete}})
    except Exception:
        pass
    return {"status": "logged", "id": doc["id"]}


@router.get("/admin/telemetry/recent")
async def recent_events(limit: int = 50, current_user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"email": current_user.email}, {"_id": 0, "role": 1})
    if not user_doc or (user_doc.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    limit = max(1, min(limit, 200))
    cursor = db.dashboard_telemetry.find(
        {},
        {"_id": 0, "id": 1, "ts": 1, "actor_email": 1, "actor_role": 1,
         "surface": 1, "action": 1, "target_id": 1, "outcome": 1, "meta": 1},
    ).sort("ts", -1).limit(limit)
    events = await cursor.to_list(length=limit)
    return {"events": events, "count": len(events)}


@router.get("/admin/analytics/tour-completion")
async def tour_completion(current_user: User = Depends(get_current_user)):
    """
    Aggregate portal-bound onboarding tour stats per portal:
      • started   — count of distinct (actor_id, portal) that fired tour_started
      • completed — count of distinct (actor_id, portal) that fired tour_completed
      • skipped   — count of distinct (actor_id, portal) that fired tour_skipped
      • rate      — completed / max(started, 1)

    Returns a per-portal dict and a totals roll-up.
    """
    user_doc = await db.users.find_one({"email": current_user.email}, {"_id": 0, "role": 1})
    if not user_doc or (user_doc.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pipeline = [
        {"$match": {"surface": "tour", "action": {"$in": ["tour_started", "tour_completed", "tour_skipped"]}}},
        {"$group": {
            "_id": {"portal": "$meta.portal", "action": "$action", "actor": "$actor_id"},
        }},
        {"$group": {
            "_id": {"portal": "$_id.portal", "action": "$_id.action"},
            "users": {"$sum": 1},
        }},
    ]
    raw = await db.dashboard_telemetry.aggregate(pipeline).to_list(length=200)

    portals: Dict[str, Dict[str, int]] = {}
    for row in raw:
        portal = row["_id"].get("portal") or "unknown"
        action = row["_id"]["action"]
        portals.setdefault(portal, {"started": 0, "completed": 0, "skipped": 0})
        key = action.replace("tour_", "")  # started/completed/skipped
        if key in portals[portal]:
            portals[portal][key] = row["users"]

    # Compute rates + global totals.
    result: List[Dict[str, Any]] = []
    totals = {"started": 0, "completed": 0, "skipped": 0}
    for portal, counts in portals.items():
        started = counts["started"]
        completed = counts["completed"]
        skipped = counts["skipped"]
        rate = round(100 * completed / started, 1) if started else 0.0
        result.append({
            "portal": portal,
            "started": started,
            "completed": completed,
            "skipped": skipped,
            "completion_rate": rate,
        })
        totals["started"] += started
        totals["completed"] += completed
        totals["skipped"] += skipped

    global_rate = round(100 * totals["completed"] / totals["started"], 1) if totals["started"] else 0.0
    return {
        "by_portal": sorted(result, key=lambda r: r["started"], reverse=True),
        "totals": {**totals, "completion_rate": global_rate},
    }
