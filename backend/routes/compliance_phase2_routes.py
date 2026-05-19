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
import secrets

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

    # Evaluator health: count ceremonies that hit a non-FL evaluator error in the last 24h.
    # This is the fail-closed signal added in iteration 110 — non-zero values indicate
    # an infra/code regression that's blocking sealing.
    last_24h = (now - timedelta(hours=24)).isoformat()
    evaluator_errors_24h = await db.notarization_requests.count_documents({
        "status": {"$regex": "_evaluator_error$"},
        "blocked_at": {"$gte": last_24h},
    })
    evaluator_errors_total = await db.notarization_requests.count_documents({
        "status": {"$regex": "_evaluator_error$"},
    })

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
        "evaluator_errors_24h": evaluator_errors_24h,
        "evaluator_errors_total": evaluator_errors_total,
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



# ─────────────────────────────────────────────────────────────────────────────
# State Pickability Index — per-user actionable readiness nudges
# ─────────────────────────────────────────────────────────────────────────────

# Human-friendly nudge metadata keyed by gate_id returned by the evaluator.
# Kept inline (one place) — these are pure presentation strings.
_NUDGE_LIBRARY = {
    "audio_video": {
        "title": "Capture session A/V quality report",
        "description": "Submit an audio/video quality report (≥30s of clean signal) before sealing.",
        "action_label": "Open ceremony",
    },
    "kba": {
        "title": "Pass Knowledge-Based Authentication",
        "description": "Principal must complete a passing KBA quiz within the last hour.",
        "action_label": "Start KBA",
    },
    "id_check": {
        "title": "Approve government ID verification",
        "description": "Principal's government-issued ID must be analyzed and approved.",
        "action_label": "Verify ID",
    },
    "retention": {
        "title": "Set the retention tag",
        "description": "Tag this ceremony with the state-required retention period (5y for TX/CA/VA, 10y for NY).",
        "action_label": "Set retention",
    },
    "journal": {
        "title": "Add a journal entry",
        "description": "Record a notary journal entry (date, principal, document, fee) for this ceremony.",
        "action_label": "Open journal",
    },
    "tamper_evident": {
        "title": "Complete tamper-evident prerequisites",
        "description": "TX/VA require KBA + ID-check before the PKI-backed tamper-evident seal.",
        "action_label": "Open ceremony",
    },
    "identity_proofing": {
        "title": "Complete NY multi-factor proofing",
        "description": "New York requires BOTH KBA AND credential analysis to pass.",
        "action_label": "Open ceremony",
    },
    "thumbprint": {
        "title": "Capture biometric thumbprint",
        "description": "California requires a thumbprint capture for real-property, POA, mortgage, and lien-release ceremonies.",
        "action_label": "Capture thumbprint",
    },
    "principal_location": {
        "title": "Capture principal GPS location",
        "description": "New York requires the principal's GPS location to be logged at signing.",
        "action_label": "Capture location",
    },
    "document_type_allowed": {
        "title": "Document type not RON-eligible",
        "description": "This document type cannot be notarized online in this state. Use in-person notarization or switch states.",
        "action_label": "Edit request",
    },
}


def _build_nudge(state_code: str, ceremony: dict, gate_id: str, gate: dict) -> dict:
    """Compose a single actionable nudge from a failing gate."""
    meta = _NUDGE_LIBRARY.get(gate_id, {
        "title": f"Resolve {gate_id}",
        "description": gate.get("detail") or "Gate not satisfied",
        "action_label": "Open ceremony",
    })
    return {
        "state_code": state_code,
        "ceremony_id": ceremony.get("id"),
        "document_name": ceremony.get("document_name") or ceremony.get("document_type") or "Ceremony",
        "document_type": ceremony.get("document_type"),
        "gate_id": gate_id,
        "title": meta["title"],
        "description": meta["description"],
        "action_label": meta["action_label"],
        "action_link": f"/session/{ceremony.get('id')}",
        "evaluator_detail": gate.get("detail"),
    }


@router.get("/compliance/pickability/me")
async def my_state_pickability(current_user: User = Depends(get_current_user)):
    """Per-user "State Pickability Index": for each of the caller's OPEN ceremonies
    (status in pending/assigned/in_session and not yet sealed), run the multi-state
    evaluator and return:
      - per-state score (% of open ceremonies that are seal-ready right now)
      - top actionable nudges across all open ceremonies
      - overall index across all states the user operates in

    FL ceremonies are counted but not deeply evaluated (FL has its own dedicated
    readiness route at /api/fl/ron/readiness/{id}). They are surfaced as a generic
    nudge if the ceremony status is `fl_blocked`.
    """
    open_statuses = ["pending", "assigned", "in_session"]
    cursor = db.notarization_requests.find(
        {"user_id": current_user.id, "status": {"$in": open_statuses + ["fl_blocked", "tx_blocked", "ny_blocked", "ca_blocked", "va_blocked"]}},
        {"_id": 0, "id": 1, "document_name": 1, "document_type": 1, "state_code": 1, "status": 1, "fl_blocked_reasons": 1, "blocked_reasons": 1}
    )
    ceremonies = await cursor.to_list(200)

    # Group by state
    by_state: dict = {}
    nudges: list = []
    wired = set(supported_state_codes())

    for c in ceremonies:
        code = (c.get("state_code") or "FL").upper()
        bucket = by_state.setdefault(code, {"state_code": code, "open_count": 0, "ready_count": 0, "ceremonies": []})
        bucket["open_count"] += 1

        if code == "FL":
            # Treat FL legacy as ready unless explicitly fl_blocked
            is_blocked = c.get("status") == "fl_blocked"
            if not is_blocked:
                bucket["ready_count"] += 1
            bucket["ceremonies"].append({
                "ceremony_id": c["id"],
                "document_name": c.get("document_name"),
                "document_type": c.get("document_type"),
                "ready": not is_blocked,
                "failing_gates": [r.split(":")[0].strip() for r in (c.get("fl_blocked_reasons") or [])],
            })
            if is_blocked:
                for r in (c.get("fl_blocked_reasons") or [])[:1]:
                    gate_id = (r or "").split(":")[0].strip() or "unknown"
                    nudges.append(_build_nudge("FL", c, gate_id, {"passed": False, "detail": r}))
            continue

        if code not in wired:
            # Abstract published but evaluator not yet wired — count as not-ready, surface generic nudge
            bucket["ceremonies"].append({
                "ceremony_id": c["id"],
                "document_name": c.get("document_name"),
                "document_type": c.get("document_type"),
                "ready": False,
                "failing_gates": ["evaluator_not_wired"],
            })
            nudges.append({
                "state_code": code,
                "ceremony_id": c["id"],
                "document_name": c.get("document_name"),
                "document_type": c.get("document_type"),
                "gate_id": "evaluator_not_wired",
                "title": f"{code} pre-seal evaluator coming soon",
                "description": f"We have the {code} compliance abstract but the gate evaluator isn't wired yet. Ceremony can't be auto-sealed.",
                "action_label": "Open ceremony",
                "action_link": f"/session/{c['id']}",
            })
            continue

        try:
            ev = await evaluate_preseal(
                state_code=code,
                ceremony_id=c["id"],
                user_id=current_user.id,
                db=db,
                document_type=c.get("document_type", "general"),
            )
        except Exception as e:
            logger.warning(f"pickability evaluator error for {c['id']} ({code}): {e}")
            ev = {"ready": False, "gates": {}, "blocked_reasons": [f"evaluator_error: {e}"]}

        ready = bool(ev.get("ready"))
        failing = []
        for gate_id, gate in (ev.get("gates") or {}).items():
            if not gate.get("passed"):
                failing.append(gate_id)
                nudges.append(_build_nudge(code, c, gate_id, gate))

        if ready:
            bucket["ready_count"] += 1
        bucket["ceremonies"].append({
            "ceremony_id": c["id"],
            "document_name": c.get("document_name"),
            "document_type": c.get("document_type"),
            "ready": ready,
            "failing_gates": failing,
        })

    # Compose per-state scores
    states_out = []
    total_open = 0
    total_ready = 0
    for s in by_state.values():
        s["score"] = round(s["ready_count"] / s["open_count"] * 100) if s["open_count"] else 100
        states_out.append(s)
        total_open += s["open_count"]
        total_ready += s["ready_count"]
    states_out.sort(key=lambda s: (-s["open_count"], s["state_code"]))

    overall_score = round(total_ready / total_open * 100) if total_open else 100

    # Diversify nudges: show at most 1 nudge per ceremony in the first pass so the
    # widget surfaces variety instead of stacking 6 gates of the same ceremony.
    # Order by the state's open-ceremony count (worst-impact states first).
    state_open_counts = {s["state_code"]: s["open_count"] for s in states_out}
    nudges.sort(key=lambda n: (-state_open_counts.get(n["state_code"], 0), n["state_code"], n["ceremony_id"]))
    seen_ceremonies: set = set()
    top_per_ceremony = []
    leftovers = []
    for n in nudges:
        if n["ceremony_id"] not in seen_ceremonies:
            seen_ceremonies.add(n["ceremony_id"])
            top_per_ceremony.append(n)
        else:
            leftovers.append(n)
    nudges_sorted = (top_per_ceremony + leftovers)[:8]

    return {
        "overall_score": overall_score,
        "total_open": total_open,
        "total_ready": total_ready,
        "states": states_out,
        "nudges": nudges_sorted,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }

# ─────────────────────────────────────────────────────────────────────────────
# Compliance Snapshot — shareable public read-only pickability reports
# ─────────────────────────────────────────────────────────────────────────────

SNAPSHOT_DEFAULT_TTL_DAYS = 7
SNAPSHOT_MAX_TTL_DAYS = 30


def _mask_email(email: str) -> str:
    """Mask 'jdoe@firm.com' → 'j***@firm.com' for snapshot attribution."""
    if not email or "@" not in email:
        return "shared"
    local, _, domain = email.partition("@")
    if len(local) <= 1:
        return f"{local}***@{domain}"
    return f"{local[0]}***@{domain}"


@router.post("/compliance/snapshots/share")
async def create_compliance_snapshot(
    request: Request,
    ttl_days: int = Query(SNAPSHOT_DEFAULT_TTL_DAYS, ge=1, le=SNAPSHOT_MAX_TTL_DAYS),
    note: Optional[str] = Query(None, max_length=300),
    current_user: User = Depends(get_current_user),
):
    """Freeze the caller's State Pickability Index as a public, read-only snapshot.
    Useful for sending mortgage brokers / title agents / counterparties a link like
    "your CA deed ceremony is 67% ready, missing thumbprint + journal".

    Snapshots are scrubbed of identifiers (no ceremony_id, no user_id, no document_name)
    — they only carry aggregate scores + gate-level nudges suitable for partner sharing.
    """
    # Reuse the same logic as /pickability/me so the snapshot is byte-for-byte identical
    pickability = await my_state_pickability(current_user=current_user)

    # Scrub PII from the snapshot — partners see compliance gaps, not document names or IDs
    scrubbed_states = []
    for s in pickability["states"]:
        scrubbed_states.append({
            "state_code": s["state_code"],
            "open_count": s["open_count"],
            "ready_count": s["ready_count"],
            "score": s["score"],
            "ceremonies": [
                {
                    "ready": c["ready"],
                    "document_type": c.get("document_type"),
                    "failing_gates": c.get("failing_gates", []),
                }
                for c in s.get("ceremonies", [])
            ],
        })
    scrubbed_nudges = [
        {
            "state_code": n["state_code"],
            "document_type": n.get("document_type"),
            "gate_id": n.get("gate_id"),
            "title": n["title"],
            "description": n["description"],
        }
        for n in pickability["nudges"]
    ]

    token = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=ttl_days)
    doc = {
        "token": token,
        "owner_user_id": current_user.id,
        "owner_email_masked": _mask_email(current_user.email),
        "note": (note or "").strip()[:300] or None,
        "overall_score": pickability["overall_score"],
        "total_open": pickability["total_open"],
        "total_ready": pickability["total_ready"],
        "states": scrubbed_states,
        "nudges": scrubbed_nudges,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "view_count": 0,
    }
    await db.compliance_snapshots.insert_one(doc)

    # Build a share URL that points at the public-facing host. Behind ingress,
    # `request.base_url` resolves to the internal cluster host — prefer the
    # X-Forwarded-* headers or the Origin sent by the calling frontend so the
    # link works when copy-pasted into email/Slack/etc.
    fwd_proto = request.headers.get("x-forwarded-proto")
    fwd_host = request.headers.get("x-forwarded-host")
    origin = request.headers.get("origin")
    if fwd_proto and fwd_host:
        public_base = f"{fwd_proto}://{fwd_host}"
    elif origin:
        public_base = origin.rstrip("/")
    else:
        public_base = str(request.base_url).rstrip("/")
    return {
        "token": token,
        "share_url": f"{public_base}/compliance/snapshot/{token}",
        "expires_at": doc["expires_at"],
        "overall_score": doc["overall_score"],
    }


@router.get("/compliance/snapshots/{token}")
async def get_compliance_snapshot(token: str):
    """Public read-only snapshot fetch. No auth — intended to be shared with
    counterparties. Increments view_count on each fetch."""
    doc = await db.compliance_snapshots.find_one({"token": token}, {"_id": 0, "owner_user_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Expiry check
    try:
        exp = datetime.fromisoformat(doc["expires_at"].replace("Z", "+00:00"))
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Snapshot has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    # Best-effort view counter (don't block response on it)
    try:
        await db.compliance_snapshots.update_one({"token": token}, {"$inc": {"view_count": 1}})
    except Exception as e:
        logger.debug(f"snapshot view increment failed: {e}")

    return doc




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
