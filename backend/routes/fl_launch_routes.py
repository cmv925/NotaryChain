"""
Florida RON Compliance — M5: Public launch polish, FL notary recruitment portal,
and RONSP filing tracker.

Endpoints:
  Public:
    GET  /api/fl/launch/public-stats         — live counters for /florida landing
    GET  /api/fl/ronsp/filings/current       — active RONSP filing summary (banner)
    POST /api/fl/recruitment/lead            — prospective notary lead capture

  Admin:
    GET  /api/fl/recruitment/leads           — recruitment pipeline list
    GET  /api/fl/recruitment/leads/{id}      — single lead w/ audit_log
    PATCH /api/fl/recruitment/leads/{id}     — status / notes / assignee
    GET  /api/fl/recruitment/stats           — pipeline counts by status

    POST /api/fl/ronsp/filings               — create a new RONSP filing record
    GET  /api/fl/ronsp/filings               — list all filings (history)
    PATCH /api/fl/ronsp/filings/{id}         — status / dates / docs / notes
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr

router = APIRouter(prefix="/api/fl", tags=["florida-launch"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ─── helpers ───
async def _get_user(request: Request):
    from auth import decode_access_token, extract_request_token
    token = extract_request_token(request)
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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ═════════════════════════════════════════════════════════
#  PUBLIC STATS — for /florida launch polish
# ═════════════════════════════════════════════════════════

@router.get("/launch/public-stats")
async def public_launch_stats():
    """Aggregated counters safe to expose on the public /florida page."""
    fl_notaries = await db.fl_notary_credentials.count_documents({})
    ceremonies = await db.fl_jurisdiction_qualifications.count_documents({})
    journal_entries = await db.fl_journal_entries.count_documents({})

    kba_total = await db.kba_attempts.count_documents({})
    kba_pass = await db.kba_attempts.count_documents({"passed": True})
    av_total = await db.fl_av_quality_reports.count_documents({})
    av_pass = await db.fl_av_quality_reports.count_documents({"passed": True})

    # 30-day deltas for momentum
    cutoff = _iso(_now() - timedelta(days=30))
    journal_30d = await db.fl_journal_entries.count_documents({"recorded_at": {"$gte": cutoff}})

    return {
        "fl_notaries": fl_notaries,
        "ceremonies": ceremonies,
        "journal_entries": journal_entries,
        "journal_30d": journal_30d,
        "kba_pass_rate": round((kba_pass / kba_total) * 100, 1) if kba_total else 0,
        "av_pass_rate": round((av_pass / av_total) * 100, 1) if av_total else 0,
        "generated_at": _iso(_now()),
    }


# ═════════════════════════════════════════════════════════
#  RONSP FILING TRACKER
# ═════════════════════════════════════════════════════════

RONSP_STATUSES = ("draft", "submitted", "approved", "renewing", "expired", "denied")


class RonspFilingCreate(BaseModel):
    filing_label: str = Field(min_length=1, max_length=120, description="Internal label, e.g., '2026 initial filing'")
    filing_id: Optional[str] = Field(default=None, description="FL DoS-issued reference number once known")
    status: str = "draft"
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    expires_at: Optional[str] = None
    registered_agent: Optional[str] = None
    document_url: Optional[str] = None
    document_sha256: Optional[str] = None
    notes: Optional[str] = None


@router.post("/ronsp/filings")
async def create_ronsp_filing(body: RonspFilingCreate, request: Request):
    user = await _require_admin(request)
    if body.status not in RONSP_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {RONSP_STATUSES}")
    rec = {
        "filing_record_id": uuid.uuid4().hex[:16],
        "filing_label": body.filing_label,
        "filing_id": body.filing_id,
        "status": body.status,
        "submitted_at": body.submitted_at,
        "approved_at": body.approved_at,
        "expires_at": body.expires_at,
        "registered_agent": body.registered_agent,
        "document_url": body.document_url,
        "document_sha256": body.document_sha256,
        "notes": body.notes,
        "created_at": _iso(_now()),
        "created_by": user["email"],
        "audit_log": [{
            "at": _iso(_now()), "actor": user["email"],
            "action": "created", "detail": f"status={body.status}"
        }],
    }
    await db.fl_ronsp_filings.insert_one(rec)
    rec.pop("_id", None)

    # If created/promoted to approved, also flip the legacy state-profile flag
    if body.status == "approved":
        await db.state_compliance_profiles.update_one(
            {"state_code": "FL"},
            {"$set": {
                "state_code": "FL", "live_in_state": True,
                "ronsp_registration": {
                    "filing_id": body.filing_id,
                    "registered_at": body.approved_at or _iso(_now()),
                    "expires_at": body.expires_at,
                    "registered_agent": body.registered_agent,
                    "live_in_state": True,
                },
                "updated_at": _iso(_now()),
            }},
            upsert=True,
        )

    return rec


@router.get("/ronsp/filings")
async def list_ronsp_filings(request: Request):
    await _require_admin(request)
    out = []
    async for f in db.fl_ronsp_filings.find({}, {"_id": 0}).sort("created_at", -1):
        out.append(f)
    return {"total": len(out), "filings": out}


@router.get("/ronsp/filings/current")
async def current_ronsp_filing():
    """Public: returns the active filing (approved + not expired) or null."""
    now_iso = _iso(_now())
    f = await db.fl_ronsp_filings.find_one(
        {"status": {"$in": ("approved", "renewing")},
         "$or": [{"expires_at": None}, {"expires_at": {"$gte": now_iso}}]},
        {"_id": 0, "notes": 0, "audit_log": 0, "document_sha256": 0},
        sort=[("approved_at", -1)],
    )
    if not f:
        return {"active": False, "filing": None}
    # Compute days_until_renewal if present
    days = None
    if f.get("expires_at"):
        try:
            exp = datetime.fromisoformat(f["expires_at"].replace("Z", "+00:00"))
            days = max(0, (exp - _now()).days)
        except Exception:
            days = None
    return {"active": True, "filing": f, "days_until_renewal": days}


class RonspFilingPatch(BaseModel):
    status: Optional[str] = None
    filing_id: Optional[str] = None
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    expires_at: Optional[str] = None
    registered_agent: Optional[str] = None
    document_url: Optional[str] = None
    document_sha256: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/ronsp/filings/{filing_record_id}")
async def patch_ronsp_filing(filing_record_id: str, body: RonspFilingPatch, request: Request):
    user = await _require_admin(request)
    existing = await db.fl_ronsp_filings.find_one({"filing_record_id": filing_record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Filing not found")
    if body.status and body.status not in RONSP_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {RONSP_STATUSES}")

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        return existing
    updates["updated_at"] = _iso(_now())

    audit_entry = {
        "at": _iso(_now()), "actor": user["email"],
        "action": "updated", "detail": ", ".join(f"{k}={v}" for k, v in updates.items() if k != "updated_at"),
    }
    if body.status and body.status != existing.get("status"):
        audit_entry["action"] = "status_change"
        audit_entry["detail"] = f"{existing.get('status')} → {body.status}"

    await db.fl_ronsp_filings.update_one(
        {"filing_record_id": filing_record_id},
        {"$set": updates, "$push": {"audit_log": audit_entry}},
    )

    # Mirror approved status into state_compliance_profiles
    if body.status == "approved":
        merged = {**existing, **updates}
        await db.state_compliance_profiles.update_one(
            {"state_code": "FL"},
            {"$set": {
                "state_code": "FL", "live_in_state": True,
                "ronsp_registration": {
                    "filing_id": merged.get("filing_id"),
                    "registered_at": merged.get("approved_at") or _iso(_now()),
                    "expires_at": merged.get("expires_at"),
                    "registered_agent": merged.get("registered_agent"),
                    "live_in_state": True,
                },
                "updated_at": _iso(_now()),
            }},
            upsert=True,
        )

    updated = await db.fl_ronsp_filings.find_one({"filing_record_id": filing_record_id}, {"_id": 0})
    return updated


# ═════════════════════════════════════════════════════════
#  NOTARY RECRUITMENT PIPELINE
# ═════════════════════════════════════════════════════════

LEAD_STATUSES = ("new", "contacted", "qualified", "onboarded", "declined")
VOLUME_BUCKETS = ("<10", "10-50", "50-200", "200+")


class RecruitmentLead(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    fl_commission_number: Optional[str] = None
    county: Optional[str] = None
    monthly_volume_estimate: Optional[str] = None
    years_experience: Optional[int] = None
    referral_source: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=2000)


@router.post("/recruitment/lead")
async def create_recruitment_lead(body: RecruitmentLead, request: Request):
    """Public: prospective FL notary submits an interest form."""
    if body.monthly_volume_estimate and body.monthly_volume_estimate not in VOLUME_BUCKETS:
        raise HTTPException(status_code=400, detail=f"monthly_volume_estimate must be one of {VOLUME_BUCKETS}")

    # De-dupe within 30 days by email
    cutoff = _iso(_now() - timedelta(days=30))
    duplicate = await db.fl_recruitment_leads.find_one(
        {"email": body.email.lower(), "created_at": {"$gte": cutoff}},
        {"_id": 0, "lead_id": 1},
    )
    if duplicate:
        return {"lead_id": duplicate["lead_id"], "status": "already_received",
                "message": "Thanks — we already have your interest on file. We'll reach out shortly."}

    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (request.client.host if request.client else "unknown"))

    lead = {
        "lead_id": uuid.uuid4().hex[:16],
        "full_name": body.full_name.strip(),
        "email": body.email.lower(),
        "phone": body.phone,
        "fl_commission_number": body.fl_commission_number,
        "county": body.county,
        "monthly_volume_estimate": body.monthly_volume_estimate,
        "years_experience": body.years_experience,
        "referral_source": body.referral_source,
        "message": body.message,
        "status": "new",
        "assigned_to": None,
        "internal_notes": None,
        "source_ip": ip,
        "created_at": _iso(_now()),
        "audit_log": [{
            "at": _iso(_now()), "actor": body.email.lower(),
            "action": "submitted", "detail": "Public lead form"
        }],
    }
    await db.fl_recruitment_leads.insert_one(lead)

    # Best-effort admin notification
    try:
        from services import email_service
        admins = []
        async for u in db.users.find({"role": "admin"}, {"_id": 0, "email": 1}):
            admins.append(u["email"])
        if admins:
            html = f"""<p>A new Florida notary has expressed interest:</p>
            <ul>
              <li><strong>{lead['full_name']}</strong> · {lead['email']} {('· ' + lead['phone']) if lead['phone'] else ''}</li>
              <li>Commission: {lead['fl_commission_number'] or '—'} · County: {lead['county'] or '—'}</li>
              <li>Volume: {lead['monthly_volume_estimate'] or '—'} · Years: {lead['years_experience'] or '—'}</li>
              <li>Source: {lead['referral_source'] or '—'}</li>
            </ul>
            <p>{lead['message'] or ''}</p>"""
            for a in admins:
                await email_service.EmailService.send_email(
                    to_email=a,
                    subject=f"New FL notary lead — {lead['full_name']}",
                    html_content=html,
                )
    except Exception as e:
        logger.warning(f"FL recruitment lead email failed: {e}")

    return {"lead_id": lead["lead_id"], "status": "received",
            "message": "Thanks for your interest — we'll be in touch within 2 business days."}


@router.get("/recruitment/leads")
async def list_recruitment_leads(request: Request, status: Optional[str] = None):
    await _require_admin(request)
    q = {"status": status} if status else {}
    out = []
    async for lead in db.fl_recruitment_leads.find(q, {"_id": 0}).sort("created_at", -1):
        out.append(lead)
    return {"total": len(out), "leads": out}


@router.get("/recruitment/leads/{lead_id}")
async def get_recruitment_lead(lead_id: str, request: Request):
    await _require_admin(request)
    lead = await db.fl_recruitment_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.get("/recruitment/stats")
async def recruitment_stats(request: Request):
    await _require_admin(request)
    counts = {s: await db.fl_recruitment_leads.count_documents({"status": s}) for s in LEAD_STATUSES}
    total = sum(counts.values())
    last30 = await db.fl_recruitment_leads.count_documents(
        {"created_at": {"$gte": _iso(_now() - timedelta(days=30))}}
    )
    onboarded = counts.get("onboarded", 0)
    return {
        "total": total,
        "by_status": counts,
        "last_30d": last30,
        "conversion_rate": round((onboarded / total) * 100, 1) if total else 0,
    }


class LeadPatch(BaseModel):
    status: Optional[str] = None
    internal_notes: Optional[str] = None
    assigned_to: Optional[str] = None


@router.patch("/recruitment/leads/{lead_id}")
async def patch_recruitment_lead(lead_id: str, body: LeadPatch, request: Request):
    user = await _require_admin(request)
    existing = await db.fl_recruitment_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.status and body.status not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {LEAD_STATUSES}")

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        return existing
    updates["updated_at"] = _iso(_now())

    detail_parts = []
    if body.status and body.status != existing.get("status"):
        detail_parts.append(f"status: {existing.get('status')} → {body.status}")
    if body.internal_notes is not None:
        detail_parts.append("notes updated")
    if body.assigned_to is not None:
        detail_parts.append(f"assigned to {body.assigned_to}")
    audit_entry = {
        "at": _iso(_now()), "actor": user["email"],
        "action": "updated", "detail": " · ".join(detail_parts) or "minor update",
    }

    await db.fl_recruitment_leads.update_one(
        {"lead_id": lead_id},
        {"$set": updates, "$push": {"audit_log": audit_entry}},
    )
    updated = await db.fl_recruitment_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return updated
