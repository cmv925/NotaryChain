"""
Florida RON Compliance — M4: Journal logging, CSV export, admin compliance
dashboard, and subpoena response workflow.

References:
  • FL Stat. 117.245 — notarial journal requirements
  • FL Stat. 117.305 — record retention (10 years)
  • FL Stat. 117.295(4) — audio-video recording reference must accompany journal

Endpoints:
  Journal (notary scope):
    POST /api/fl/journal/entries                — record one notarial act
    GET  /api/fl/journal/entries                — list (paginated, filterable)
    GET  /api/fl/journal/entries/{entry_id}     — fetch one
    GET  /api/fl/journal/export.csv             — CSV export (filtered)

  Admin dashboard:
    GET  /api/fl/admin/compliance/overview      — KPI summary
    GET  /api/fl/admin/compliance/ceremonies    — list FL ceremonies + gate state

  Subpoena workflow:
    POST /api/fl/subpoena/intake                — create subpoena (admin)
    GET  /api/fl/subpoena/list                  — list (admin)
    GET  /api/fl/subpoena/{subpoena_id}         — get (admin)
    POST /api/fl/subpoena/{subpoena_id}/respond — mark responded + record bundle
    GET  /api/fl/subpoena/{subpoena_id}/export.csv — journal slice as CSV
"""
import csv
import io
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/fl", tags=["florida-journal"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ─── helpers ───
async def _get_user(request: Request):
    from auth import decode_access_token
    # Cookie-first (httpOnly), fall back to Authorization: Bearer header — mirrors
    # routes.auth_routes.get_current_user so the journal works under cookie auth.
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            candidate = auth.split(" ", 1)[1]
            if candidate and candidate != "cookie":
                token = candidate
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _require_admin(request: Request):
    user = await _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def _require_notary_or_admin(request: Request):
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Notary or admin only")
    return user


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ═════════════════════════════════════════════════════════
#  JOURNAL — FL Stat. 117.245
# ═════════════════════════════════════════════════════════

NOTARIAL_ACT_TYPES = (
    "acknowledgment", "jurat", "oath_affirmation", "signature_witnessing",
    "copy_certification", "online_will", "other"
)


class JournalEntry(BaseModel):
    ceremony_id: str
    notarial_act_type: str
    document_description: str = Field(min_length=1, max_length=500)
    signer_name: str
    signer_address: Optional[str] = None
    signer_id_type: str = Field(description="DL, PASSPORT, STATE_ID, etc.")
    signer_id_number_last4: Optional[str] = Field(default=None, max_length=4)
    signer_id_issuer: Optional[str] = None
    signer_id_expires: Optional[str] = None
    fee_charged_usd: float = 0.0
    av_recording_ref: Optional[str] = None
    hedera_seal_hash: Optional[str] = None
    hedera_topic_id: Optional[str] = None
    hedera_sequence: Optional[int] = None
    principal_geo: Optional[dict] = None
    notes: Optional[str] = None


@router.post("/journal/entries")
async def create_journal_entry(body: JournalEntry, request: Request):
    user = await _require_notary_or_admin(request)
    if body.notarial_act_type not in NOTARIAL_ACT_TYPES:
        raise HTTPException(status_code=400, detail=f"notarial_act_type must be one of {NOTARIAL_ACT_TYPES}")
    entry = {
        "entry_id": uuid.uuid4().hex[:16],
        "notary_user_id": user["id"],
        "notary_email": user["email"],
        "notary_name": user.get("full_name") or user["email"],
        "ceremony_id": body.ceremony_id,
        "notarial_act_type": body.notarial_act_type,
        "document_description": body.document_description,
        "signer_name": body.signer_name,
        "signer_address": body.signer_address,
        "signer_id_type": body.signer_id_type,
        "signer_id_number_last4": body.signer_id_number_last4,
        "signer_id_issuer": body.signer_id_issuer,
        "signer_id_expires": body.signer_id_expires,
        "fee_charged_usd": float(body.fee_charged_usd or 0),
        "av_recording_ref": body.av_recording_ref,
        "hedera_seal_hash": body.hedera_seal_hash,
        "hedera_topic_id": body.hedera_topic_id,
        "hedera_sequence": body.hedera_sequence,
        "principal_geo": body.principal_geo,
        "notes": body.notes,
        "recorded_at": _iso(_now()),
        "retention_until": _iso(_now() + timedelta(days=365 * 10)),
        "retention_policy": "FL_10YR",
    }
    await db.fl_journal_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.get("/journal/entries")
async def list_journal_entries(
    request: Request,
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    ceremony_id: Optional[str] = None,
    notarial_act_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    user = await _require_notary_or_admin(request)
    q = {} if user.get("role") == "admin" else {"notary_user_id": user["id"]}
    if ceremony_id:
        q["ceremony_id"] = ceremony_id
    if notarial_act_type:
        q["notarial_act_type"] = notarial_act_type
    if start_date or end_date:
        rng = {}
        if start_date:
            rng["$gte"] = start_date
        if end_date:
            rng["$lte"] = end_date
        q["recorded_at"] = rng
    total = await db.fl_journal_entries.count_documents(q)
    entries = []
    async for e in db.fl_journal_entries.find(q, {"_id": 0}).sort("recorded_at", -1).skip(skip).limit(limit):
        entries.append(e)
    return {"total": total, "limit": limit, "skip": skip, "entries": entries}


@router.get("/journal/entries/{entry_id}")
async def get_journal_entry(entry_id: str, request: Request):
    user = await _require_notary_or_admin(request)
    e = await db.fl_journal_entries.find_one({"entry_id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if user.get("role") != "admin" and e["notary_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return e


CSV_COLUMNS = [
    "entry_id", "recorded_at", "ceremony_id", "notarial_act_type",
    "document_description", "signer_name", "signer_address",
    "signer_id_type", "signer_id_number_last4", "signer_id_issuer", "signer_id_expires",
    "fee_charged_usd", "av_recording_ref", "hedera_seal_hash", "hedera_topic_id",
    "hedera_sequence", "notary_name", "notary_email", "retention_until", "notes",
]


def _entries_to_csv(entries: List[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    w.writeheader()
    for e in entries:
        w.writerow({k: (e.get(k) if e.get(k) is not None else "") for k in CSV_COLUMNS})
    return buf.getvalue()


@router.get("/journal/export.csv")
async def export_journal_csv(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    user = await _require_notary_or_admin(request)
    q = {} if user.get("role") == "admin" else {"notary_user_id": user["id"]}
    if start_date or end_date:
        rng = {}
        if start_date:
            rng["$gte"] = start_date
        if end_date:
            rng["$lte"] = end_date
        q["recorded_at"] = rng
    entries = []
    async for e in db.fl_journal_entries.find(q, {"_id": 0}).sort("recorded_at", -1):
        entries.append(e)
    body = _entries_to_csv(entries)
    fn = f"fl_journal_{_now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([body]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )


# ═════════════════════════════════════════════════════════
#  ADMIN COMPLIANCE DASHBOARD
# ═════════════════════════════════════════════════════════

@router.get("/admin/compliance/overview")
async def admin_compliance_overview(request: Request):
    await _require_admin(request)
    now = _now()
    last30 = _iso(now - timedelta(days=30))

    total_journal = await db.fl_journal_entries.count_documents({})
    journal_30d = await db.fl_journal_entries.count_documents({"recorded_at": {"$gte": last30}})

    total_jurisdiction = await db.fl_jurisdiction_qualifications.count_documents({})
    total_kba_attempts = await db.kba_attempts.count_documents({})
    kba_pass = await db.kba_attempts.count_documents({"passed": True})

    av_total = await db.fl_av_quality_reports.count_documents({})
    av_pass = await db.fl_av_quality_reports.count_documents({"passed": True})

    retention_tags = await db.fl_retention_tags.count_documents({})
    object_locks_applied = await db.fl_retention_tags.count_documents({"object_lock_applied": True})

    fl_notaries = await db.fl_notary_credentials.count_documents({}) if hasattr(db, "fl_notary_credentials") else 0
    try:
        fl_notaries = await db.fl_notary_credentials.count_documents({})
    except Exception:
        fl_notaries = 0

    subpoenas_open = await db.fl_subpoenas.count_documents({"status": {"$in": ("intake", "in_progress")}})
    subpoenas_total = await db.fl_subpoenas.count_documents({})

    return {
        "journal": {"total": total_journal, "last_30d": journal_30d},
        "jurisdiction_qualifications": total_jurisdiction,
        "kba": {
            "total_attempts": total_kba_attempts,
            "passed": kba_pass,
            "pass_rate": round((kba_pass / total_kba_attempts) * 100, 1) if total_kba_attempts else 0,
        },
        "av_quality": {
            "total": av_total, "passed": av_pass,
            "pass_rate": round((av_pass / av_total) * 100, 1) if av_total else 0,
        },
        "retention": {
            "tags": retention_tags,
            "object_lock_applied": object_locks_applied,
        },
        "fl_notaries": fl_notaries,
        "subpoenas": {"open": subpoenas_open, "total": subpoenas_total},
        "generated_at": _iso(now),
    }


@router.get("/admin/compliance/ceremonies")
async def admin_compliance_ceremonies(
    request: Request,
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    await _require_admin(request)
    # FL ceremonies = those with a jurisdiction qualifier on record
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$skip": skip}, {"$limit": limit},
    ]
    ceremonies = []
    async for j in db.fl_jurisdiction_qualifications.aggregate(pipeline):
        cer_id = j["ceremony_id"]
        kba_pass = await db.kba_attempts.find_one(
            {"user_id": j["user_id"], "passed": True,
             "$or": [{"ceremony_id": cer_id}, {"completed_at": {"$gte": j["created_at"]}}]},
            {"_id": 0, "attempt_id": 1}
        )
        av = await db.fl_av_quality_reports.find_one({"ceremony_id": cer_id}, {"_id": 0})
        witnesses = await db.fl_will_witnesses.count_documents({"ceremony_id": cer_id, "status": {"$in": ("accepted", "kba_passed", "present", "completed")}})
        journal_count = await db.fl_journal_entries.count_documents({"ceremony_id": cer_id})
        ceremonies.append({
            "ceremony_id": cer_id,
            "user_email": j.get("user_email"),
            "fl_nexus_basis": j.get("fl_nexus_basis"),
            "principal_state": j.get("principal_location", {}).get("state"),
            "created_at": j.get("created_at"),
            "gates": {
                "jurisdiction": True,
                "kba": bool(kba_pass),
                "av_quality": bool(av and av.get("passed")),
                "witnesses": witnesses,
                "journal_logged": journal_count > 0,
            },
        })
    total = await db.fl_jurisdiction_qualifications.count_documents({})
    return {"total": total, "limit": limit, "skip": skip, "ceremonies": ceremonies}


# ═════════════════════════════════════════════════════════
#  SUBPOENA RESPONSE WORKFLOW
# ═════════════════════════════════════════════════════════

class SubpoenaIntake(BaseModel):
    case_number: str = Field(min_length=1, max_length=120)
    issuing_court: str = Field(min_length=1, max_length=200)
    issuing_attorney: Optional[str] = None
    attorney_email: Optional[str] = None
    attorney_phone: Optional[str] = None
    served_date: str
    response_due_date: str
    requested_records: str = Field(min_length=1, max_length=2000)
    scope_ceremony_ids: Optional[List[str]] = None
    scope_signer_name: Optional[str] = None
    scope_start_date: Optional[str] = None
    scope_end_date: Optional[str] = None
    notes: Optional[str] = None


@router.post("/subpoena/intake")
async def subpoena_intake(body: SubpoenaIntake, request: Request):
    user = await _require_admin(request)
    rec = {
        "subpoena_id": uuid.uuid4().hex[:16],
        "case_number": body.case_number,
        "issuing_court": body.issuing_court,
        "issuing_attorney": body.issuing_attorney,
        "attorney_email": body.attorney_email,
        "attorney_phone": body.attorney_phone,
        "served_date": body.served_date,
        "response_due_date": body.response_due_date,
        "requested_records": body.requested_records,
        "scope_ceremony_ids": body.scope_ceremony_ids or [],
        "scope_signer_name": body.scope_signer_name,
        "scope_start_date": body.scope_start_date,
        "scope_end_date": body.scope_end_date,
        "notes": body.notes,
        "status": "intake",
        "created_by": user["email"],
        "created_at": _iso(_now()),
        "audit_log": [{
            "at": _iso(_now()), "actor": user["email"],
            "action": "intake", "detail": "Subpoena recorded"
        }],
    }
    await db.fl_subpoenas.insert_one(rec)
    rec.pop("_id", None)
    return rec


@router.get("/subpoena/list")
async def subpoena_list(request: Request, status: Optional[str] = None):
    await _require_admin(request)
    q = {"status": status} if status else {}
    out = []
    async for s in db.fl_subpoenas.find(q, {"_id": 0}).sort("created_at", -1):
        out.append(s)
    return {"total": len(out), "subpoenas": out}


@router.get("/subpoena/{subpoena_id}")
async def subpoena_get(subpoena_id: str, request: Request):
    await _require_admin(request)
    s = await db.fl_subpoenas.find_one({"subpoena_id": subpoena_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Subpoena not found")
    return s


class SubpoenaRespond(BaseModel):
    response_method: str = Field(description="email, mail, courier, secure_portal")
    delivered_to: Optional[str] = None
    tracking_ref: Optional[str] = None
    bundle_sha256: Optional[str] = None
    entries_exported: int = 0
    notes: Optional[str] = None


@router.post("/subpoena/{subpoena_id}/respond")
async def subpoena_respond(subpoena_id: str, body: SubpoenaRespond, request: Request):
    user = await _require_admin(request)
    s = await db.fl_subpoenas.find_one({"subpoena_id": subpoena_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Subpoena not found")
    response_record = {
        "responded_at": _iso(_now()),
        "responded_by": user["email"],
        "response_method": body.response_method,
        "delivered_to": body.delivered_to,
        "tracking_ref": body.tracking_ref,
        "bundle_sha256": body.bundle_sha256,
        "entries_exported": body.entries_exported,
        "notes": body.notes,
    }
    await db.fl_subpoenas.update_one(
        {"subpoena_id": subpoena_id},
        {
            "$set": {"status": "responded", "response": response_record},
            "$push": {"audit_log": {
                "at": _iso(_now()), "actor": user["email"],
                "action": "responded", "detail": f"via {body.response_method}"
            }},
        },
    )
    updated = await db.fl_subpoenas.find_one({"subpoena_id": subpoena_id}, {"_id": 0})
    return updated


@router.get("/subpoena/{subpoena_id}/export.csv")
async def subpoena_export(subpoena_id: str, request: Request):
    user = await _require_admin(request)
    s = await db.fl_subpoenas.find_one({"subpoena_id": subpoena_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Subpoena not found")

    q = {}
    if s.get("scope_ceremony_ids"):
        q["ceremony_id"] = {"$in": s["scope_ceremony_ids"]}
    if s.get("scope_signer_name"):
        q["signer_name"] = {"$regex": s["scope_signer_name"], "$options": "i"}
    if s.get("scope_start_date") or s.get("scope_end_date"):
        rng = {}
        if s.get("scope_start_date"):
            rng["$gte"] = s["scope_start_date"]
        if s.get("scope_end_date"):
            rng["$lte"] = s["scope_end_date"]
        q["recorded_at"] = rng

    entries = []
    async for e in db.fl_journal_entries.find(q, {"_id": 0}).sort("recorded_at", -1):
        entries.append(e)
    body_csv = _entries_to_csv(entries)

    # Append audit trail
    await db.fl_subpoenas.update_one(
        {"subpoena_id": subpoena_id},
        {"$push": {"audit_log": {
            "at": _iso(_now()), "actor": user["email"],
            "action": "exported", "detail": f"{len(entries)} journal entries exported"
        }}},
    )

    fn = f"subpoena_{s.get('case_number','case').replace('/', '-')}_{_now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([body_csv]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fn}"',
                 "X-Entries-Exported": str(len(entries))},
    )
