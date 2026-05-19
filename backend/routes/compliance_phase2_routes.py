"""
Multi-state evaluator route + Admin Ceremony Analytics.

Endpoints:
  GET  /api/compliance/evaluate-preseal/{state_code}/{ceremony_id}  — public-readiness
  GET  /api/compliance/evaluator/supported                          — list of wired states

  GET  /api/admin/analytics/overview                                — top KPIs
  GET  /api/admin/analytics/funnel                                  — completion funnel
  GET  /api/admin/analytics/timeseries?days=30                      — daily series
  GET  /api/admin/analytics/state-breakdown                         — by jurisdiction
  GET  /api/admin/analytics/top-notaries                            — best performers
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.multistate_evaluator import evaluate_preseal, supported_state_codes
from routes.auth_routes import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["compliance-phase2"])
db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


# ─────────────────────────────────────────────────────────────────────────────
# Multi-state evaluator endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/compliance/evaluator/supported")
async def supported_evaluators():
    return {"wired_states": supported_state_codes()}


@router.get("/compliance/evaluate-preseal/{state_code}/{ceremony_id}")
async def evaluate_preseal_endpoint(
    state_code: str,
    ceremony_id: str,
    document_type: str = "general",
    current_user: User = Depends(get_current_user),
):
    """Run the pre-seal gate evaluator for a state + ceremony.
    The ceremony.seal endpoint will call this internally; this public route lets
    UIs render real-time gate progress."""
    return await evaluate_preseal(
        state_code=state_code,
        ceremony_id=ceremony_id,
        user_id=current_user.id,
        db=db,
        document_type=document_type,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Admin Ceremony Analytics
# ─────────────────────────────────────────────────────────────────────────────

async def _require_admin(current_user: User):
    """Look up role via DB since the User model doesn't carry it directly."""
    rec = await db.users.find_one({"email": current_user.email}, {"_id": 0, "role": 1})
    if not rec or rec.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


@router.get("/admin/analytics/overview")
async def analytics_overview(current_user: User = Depends(get_current_user)):
    """Top-level KPIs: total ceremonies, completion rate, avg time-to-seal, revenue."""
    await _require_admin(current_user)
    now = datetime.now(timezone.utc)
    last_30d = (now - timedelta(days=30)).isoformat()

    total = await db.notarization_requests.count_documents({})
    in_last_30d = await db.notarization_requests.count_documents({"created_at": {"$gte": last_30d}})
    sealed = await db.notarization_requests.count_documents({"status": {"$in": ["completed", "sealed"]}})
    in_session = await db.notarization_requests.count_documents({"status": "in_session"})
    pending = await db.notarization_requests.count_documents({"status": "pending"})
    fl_blocked = await db.notarization_requests.count_documents({"status": "fl_blocked"})

    # Avg time-to-seal: completed_at - created_at for sealed ceremonies
    pipeline_tts = [
        {"$match": {"status": {"$in": ["completed", "sealed"]}, "completed_at": {"$exists": True, "$ne": None}}},
        {"$project": {
            "secs": {"$divide": [
                {"$subtract": [{"$toDate": "$completed_at"}, {"$toDate": "$created_at"}]},
                1000,
            ]},
        }},
        {"$match": {"secs": {"$gt": 0, "$lt": 7 * 24 * 3600}}},  # filter sane range (<7d)
        {"$group": {"_id": None, "avg_secs": {"$avg": "$secs"}, "count": {"$sum": 1}}},
    ]
    tts_doc = await db.notarization_requests.aggregate(pipeline_tts).to_list(1)
    avg_tts_secs = int(tts_doc[0]["avg_secs"]) if tts_doc else None

    # Revenue: sum of completed Stripe payments in last 30d
    rev_pipeline = [
        {"$match": {"status": "succeeded", "created_at": {"$gte": last_30d}}},
        {"$group": {"_id": None, "total_cents": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    rev_doc = await db.payment_intents.aggregate(rev_pipeline).to_list(1) if "payment_intents" in await db.list_collection_names() else []
    revenue_30d = (rev_doc[0]["total_cents"] / 100) if rev_doc else 0

    completion_rate = (sealed / total * 100) if total else 0

    return {
        "total_ceremonies": total,
        "last_30d": in_last_30d,
        "sealed": sealed,
        "in_session": in_session,
        "pending": pending,
        "fl_blocked": fl_blocked,
        "completion_rate_pct": round(completion_rate, 1),
        "avg_time_to_seal_secs": avg_tts_secs,
        "revenue_30d_usd": revenue_30d,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/admin/analytics/funnel")
async def analytics_funnel(current_user: User = Depends(get_current_user)):
    """Ceremony completion funnel: pending → assigned → in_session → completed → sealed."""
    await _require_admin(current_user)
    stages = ["pending", "assigned", "in_session", "completed", "sealed", "fl_blocked"]
    out = []
    total_started = await db.notarization_requests.count_documents({})
    for s in stages:
        # Count current + previously-passed-through (status_history) — fallback to current status only
        count = await db.notarization_requests.count_documents({"status": s})
        out.append({"stage": s, "count": count, "share_pct": round(count / total_started * 100, 1) if total_started else 0})
    return {"total_started": total_started, "stages": out}


@router.get("/admin/analytics/timeseries")
async def analytics_timeseries(
    days: int = Query(30, ge=1, le=180),
    current_user: User = Depends(get_current_user),
):
    """Daily ceremony counts + seal counts for the last N days."""
    await _require_admin(current_user)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    pipeline = [
        {"$match": {"created_at": {"$gte": since_iso}}},
        {"$addFields": {"day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {
            "_id": "$day",
            "created": {"$sum": 1},
            "sealed": {"$sum": {"$cond": [{"$in": ["$status", ["completed", "sealed"]]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = []
    async for r in db.notarization_requests.aggregate(pipeline):
        rows.append({"day": r["_id"], "created": r["created"], "sealed": r["sealed"]})
    return {"days": days, "series": rows}


@router.get("/admin/analytics/state-breakdown")
async def analytics_state_breakdown(current_user: User = Depends(get_current_user)):
    """Ceremony counts grouped by jurisdiction/state code."""
    await _require_admin(current_user)
    pipeline = [
        {"$group": {
            "_id": {"$ifNull": ["$state_code", {"$ifNull": ["$jurisdiction", "UNSPECIFIED"]}]},
            "total": {"$sum": 1},
            "sealed": {"$sum": {"$cond": [{"$in": ["$status", ["completed", "sealed"]]}, 1, 0]}},
            "blocked": {"$sum": {"$cond": [
                {"$or": [
                    {"$eq": ["$status", "fl_blocked"]},
                    {"$eq": ["$status", "tx_blocked"]},
                    {"$eq": ["$status", "ny_blocked"]},
                    {"$eq": ["$status", "ca_blocked"]},
                    {"$eq": ["$status", "va_blocked"]},
                ]},
                1, 0]}},
        }},
        {"$sort": {"total": -1}},
        {"$limit": 25},
    ]
    rows = []
    async for r in db.notarization_requests.aggregate(pipeline):
        rows.append({
            "state": str(r["_id"]).upper()[:20] if r["_id"] else "UNSPECIFIED",
            "total": r["total"],
            "sealed": r["sealed"],
            "blocked": r["blocked"],
            "completion_pct": round(r["sealed"] / r["total"] * 100, 1) if r["total"] else 0,
        })
    return {"states": rows}


@router.get("/admin/analytics/top-notaries")
async def analytics_top_notaries(current_user: User = Depends(get_current_user)):
    """Top 10 notaries by sealed ceremonies."""
    await _require_admin(current_user)
    pipeline = [
        {"$match": {"notary_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "sealed"]}}},
        {"$group": {"_id": "$notary_id", "sealed": {"$sum": 1}}},
        {"$sort": {"sealed": -1}},
        {"$limit": 10},
    ]
    rows = []
    async for r in db.notarization_requests.aggregate(pipeline):
        notary = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "id": 1, "full_name": 1, "email": 1})
        rows.append({
            "notary_id": r["_id"],
            "name": notary.get("full_name") if notary else "Unknown",
            "email": notary.get("email") if notary else None,
            "sealed_count": r["sealed"],
        })
    return {"top_notaries": rows}


@router.get("/admin/analytics/gate-failures")
async def analytics_gate_failures(current_user: User = Depends(get_current_user)):
    """Aggregate which compliance gates fail most often.
    Sources: fl_blocked_reasons on ceremonies + multistate evaluator block log."""
    await _require_admin(current_user)
    failures: dict = {}
    async for c in db.notarization_requests.find(
        {"fl_blocked_reasons": {"$exists": True, "$ne": []}},
        {"_id": 0, "fl_blocked_reasons": 1}
    ):
        for reason in c.get("fl_blocked_reasons", []):
            key = (reason or "").split(":")[0].strip() or "unknown"
            failures[key] = failures.get(key, 0) + 1
    rows = sorted(
        [{"gate": k, "count": v} for k, v in failures.items()],
        key=lambda r: r["count"],
        reverse=True,
    )
    return {"failures": rows, "total_blocked_ceremonies": sum(r["count"] for r in rows)}



@router.post("/admin/compliance/backfill-state-codes")
async def backfill_state_codes(
    default_state: str = Query("FL", description="State code to assign to ceremonies missing one"),
    dry_run: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    """Populate state_code on existing notarization_requests that don't have one.
    Priority: notary's commission_state → default_state (default FL since the live
    pipeline was FL-only until Phase 2)."""
    await _require_admin(current_user)
    code = (default_state or "FL").upper()

    missing = await db.notarization_requests.count_documents({
        "$or": [{"state_code": {"$exists": False}}, {"state_code": None}, {"state_code": ""}],
    })
    if missing == 0:
        return {"missing": 0, "updated": 0, "default_state": code, "dry_run": dry_run}

    updated = 0
    if not dry_run:
        # First pass: copy from notary's commission_state if available
        async for req in db.notarization_requests.find(
            {"$or": [{"state_code": {"$exists": False}}, {"state_code": None}, {"state_code": ""}],
             "notary_id": {"$exists": True, "$ne": None}},
            {"_id": 0, "id": 1, "notary_id": 1}
        ):
            notary = await db.users.find_one(
                {"id": req["notary_id"]},
                {"_id": 0, "commission_state": 1, "notary_state": 1, "state": 1}
            )
            ns = (notary or {}).get("commission_state") or (notary or {}).get("notary_state") or (notary or {}).get("state")
            if ns:
                ns = ns.upper()[:2]
                await db.notarization_requests.update_one(
                    {"id": req["id"]},
                    {"$set": {"state_code": ns, "state_code_source": "notary_commission"}}
                )
                updated += 1
        # Second pass: default for the rest
        bulk_default = await db.notarization_requests.update_many(
            {"$or": [{"state_code": {"$exists": False}}, {"state_code": None}, {"state_code": ""}]},
            {"$set": {"state_code": code, "state_code_source": "backfill_default"}}
        )
        updated += bulk_default.modified_count

    return {"missing": missing, "updated": updated, "default_state": code, "dry_run": dry_run}
