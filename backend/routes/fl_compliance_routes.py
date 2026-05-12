"""
Florida RON Compliance — Phase 1 (M1: Foundation)

Provides:
  • State compliance profile API (currently Florida; pattern works for all states)
  • Florida Notary credential model & onboarding wizard backend
  • Admin verification of FL notary credentials

This is the foundation layer. KBA integration (M2), FL ceremony pipeline (M3),
journal/admin (M4) and public launch (M5) build on top of this.

References:
  • FL Stat. 117.201–117.305 (Online Notarization)
  • FL Stat. 732.522 (Online Wills)
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator

router = APIRouter(prefix="/api/fl", tags=["florida-compliance"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ────────── auth helpers ──────────

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


async def _require_admin(request: Request):
    user = await _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ────────── State Compliance Profile (canonical Florida config) ──────────

FL_STATE_PROFILE = {
    "state_code": "FL",
    "state_name": "Florida",
    "ron_enabled": True,
    "ron_act": "FL Stat. 117.201-117.305",
    "ron_act_url": "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0117/0117.html",
    "requires_kba": True,
    "kba_provider": "lexisnexis_instantid",
    "kba_questions_count": 5,
    "kba_min_correct": 4,
    "kba_time_limit_seconds": 120,
    "kba_max_attempts_per_24h": 2,
    "av_recording_required": True,
    "av_min_resolution": "720p",
    "av_retention_years": 10,
    "journal_retention_years": 10,
    "online_wills_allowed": True,
    "online_wills_witnesses_required": 2,
    "online_notary_bond_min_usd": 25000,
    "online_notary_training_required": True,
    "approved_training_providers": [
        "FloridaNotary.com",
        "American Society of Notaries",
        "National Notary Association",
    ],
    "allowed_document_types": [
        "acknowledgment", "jurat", "oath", "affirmation",
        "deed", "mortgage", "title_affidavit",
        "will", "power_of_attorney",
        "ucc_filing", "general_affidavit",
    ],
    "restricted_document_types": [
        "marriage_certificate",
        "court_filing_requiring_physical",
    ],
    "jurisdiction_qualifier_required": True,
    "out_of_state_principals_allowed": True,
    "out_of_state_nexus_required": True,
    "notary_journal_format": "fl_dos_standard_csv",
    "ronsp_registration": {
        "required": True,
        "agency": "Florida Department of State, Division of Corporations",
        "renewal_annual": True,
        "platform_must_register": True,
    },
    "live_in_state": False,  # flipped to True when platform RONSP filing is confirmed
}


@router.get("/state-profile")
async def get_florida_state_profile():
    """Public: returns Florida compliance configuration used by the platform."""
    # Allow runtime override of `live_in_state` from db
    override = await db.state_compliance_profiles.find_one({"state_code": "FL"}, {"_id": 0})
    profile = dict(FL_STATE_PROFILE)
    if override:
        profile["live_in_state"] = bool(override.get("live_in_state", False))
        if override.get("ronsp_registration"):
            profile["ronsp_registration"] = {**profile["ronsp_registration"], **override["ronsp_registration"]}
    return profile


@router.post("/admin/state-profile/ronsp")
async def admin_set_ronsp_registration(request: Request):
    """Admin: persist RONSP filing metadata once confirmed by FL DoS."""
    await _require_admin(request)
    body = await request.json()
    ronsp_update = {
        "filing_id": body.get("filing_id"),
        "registered_at": body.get("registered_at") or _now(),
        "expires_at": body.get("expires_at"),
        "registered_agent": body.get("registered_agent"),
        "live_in_state": True,
    }
    await db.state_compliance_profiles.update_one(
        {"state_code": "FL"},
        {"$set": {
            "state_code": "FL",
            "live_in_state": True,
            "ronsp_registration": ronsp_update,
            "updated_at": _now(),
        }},
        upsert=True,
    )
    return {"state_code": "FL", "ronsp_registration": ronsp_update, "live_in_state": True}


# ────────── FL Notary Credential Models ──────────

FL_COMMISSION_RX = r"^[A-Z]{2}\d{6,8}$"  # e.g. GG123456 — loose match


class FLNotaryOnboarding(BaseModel):
    fl_commission_number: str = Field(min_length=4, max_length=20)
    fl_commission_expires: str  # ISO date
    fl_bond_provider: str
    fl_bond_number: str
    fl_bond_amount_usd: float = Field(ge=25000)
    fl_bond_expires_at: str
    fl_training_provider: str
    fl_training_certificate_url: Optional[str] = None
    fl_seal_image_url: Optional[str] = None
    fl_e_signature_id: Optional[str] = None
    notes: Optional[str] = None

    @validator("fl_commission_number")
    def _normalize_commission(cls, v):
        v = (v or "").strip().upper()
        if len(v) < 4:
            raise ValueError("Commission number too short")
        return v

    @validator("fl_commission_expires", "fl_bond_expires_at")
    def _check_iso(cls, v):
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except Exception:
            raise ValueError("Must be ISO 8601 date")
        return v


@router.post("/notary/onboard")
async def fl_notary_onboard(body: FLNotaryOnboarding, request: Request):
    """Notary submits their FL-specific credentials for verification.

    Idempotent: re-submitting updates the in-flight record (status remains 'pending').
    """
    user = await _get_user(request)

    # Anti-replay: commission number unique across users
    dupe = await db.fl_notary_credentials.find_one(
        {"fl_commission_number": body.fl_commission_number, "user_id": {"$ne": user["id"]}},
        {"_id": 0, "user_id": 1}
    )
    if dupe:
        raise HTTPException(status_code=400, detail="This commission number is already claimed by another user")

    # Bond must not be expired
    try:
        bond_exp = datetime.fromisoformat(body.fl_bond_expires_at.replace("Z", "+00:00"))
        if bond_exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Bond has expired; please provide an active bond")
        comm_exp = datetime.fromisoformat(body.fl_commission_expires.replace("Z", "+00:00"))
        if comm_exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Commission has expired; renew before onboarding")
    except HTTPException:
        raise
    except Exception:
        pass

    payload = body.dict()
    payload.update({
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user.get("full_name"),
        "verified": False,
        "verified_at": None,
        "verified_by_id": None,
        "rejection_reason": None,
        "status": "pending_review",
        "updated_at": _now(),
    })
    existing = await db.fl_notary_credentials.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        # Don't allow re-submission if already verified (must use a separate route)
        if existing.get("verified"):
            raise HTTPException(status_code=400, detail="Credentials already verified. Contact support to update.")
        await db.fl_notary_credentials.update_one(
            {"user_id": user["id"]},
            {"$set": payload}
        )
    else:
        payload["created_at"] = _now()
        await db.fl_notary_credentials.insert_one(payload)

    out = await db.fl_notary_credentials.find_one({"user_id": user["id"]}, {"_id": 0})
    return out


@router.get("/notary/credentials")
async def get_my_fl_credentials(request: Request):
    """Notary returns their own FL credential status (or null if none submitted)."""
    user = await _get_user(request)
    cred = await db.fl_notary_credentials.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cred:
        return {"status": "not_started", "credentials": None}
    return {"status": cred.get("status", "pending_review"), "credentials": cred}


@router.get("/admin/notaries/pending")
async def admin_list_pending_fl_notaries(request: Request, limit: int = 50):
    """Admin: list FL notary credential submissions awaiting verification."""
    await _require_admin(request)
    out = []
    async for c in db.fl_notary_credentials.find(
        {"verified": False},
        {"_id": 0}
    ).sort("updated_at", -1).limit(min(limit, 200)):
        out.append(c)
    return {"total": len(out), "pending": out}


@router.get("/admin/notaries/verified")
async def admin_list_verified_fl_notaries(request: Request, limit: int = 100):
    """Admin: list verified FL notaries."""
    await _require_admin(request)
    out = []
    async for c in db.fl_notary_credentials.find(
        {"verified": True},
        {"_id": 0}
    ).sort("verified_at", -1).limit(min(limit, 500)):
        out.append(c)
    return {"total": len(out), "verified": out}


class FLNotaryVerifyDecision(BaseModel):
    approve: bool
    reason: Optional[str] = None


@router.post("/admin/notaries/{user_id}/decision")
async def admin_decide_fl_notary(user_id: str, body: FLNotaryVerifyDecision, request: Request):
    """Admin approves or rejects a pending FL notary credential submission."""
    admin = await _require_admin(request)
    cred = await db.fl_notary_credentials.find_one({"user_id": user_id}, {"_id": 0})
    if not cred:
        raise HTTPException(status_code=404, detail="No FL credential submission found for that user")

    now = _now()
    if body.approve:
        update = {
            "verified": True,
            "verified_at": now,
            "verified_by_id": admin["id"],
            "verified_by_email": admin["email"],
            "status": "verified",
            "rejection_reason": None,
        }
    else:
        update = {
            "verified": False,
            "status": "rejected",
            "rejection_reason": (body.reason or "Verification failed").strip()[:500],
            "rejected_at": now,
            "rejected_by_id": admin["id"],
        }
    await db.fl_notary_credentials.update_one({"user_id": user_id}, {"$set": update})
    out = await db.fl_notary_credentials.find_one({"user_id": user_id}, {"_id": 0})
    return out


# ────────── Public FL notary directory (Florida-filtered) ──────────

@router.get("/notaries/public")
async def public_fl_notary_directory(limit: int = 50, offset: int = 0):
    """Public list of verified FL online notaries — used by /florida landing page."""
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    cursor = db.fl_notary_credentials.find(
        {"verified": True},
        {"_id": 0, "user_id": 1, "user_name": 1, "fl_commission_number": 1,
         "fl_commission_expires": 1, "fl_bond_amount_usd": 1, "verified_at": 1}
    ).sort("verified_at", -1).skip(offset).limit(limit)
    out = []
    async for c in cursor:
        out.append({
            "user_id": c.get("user_id"),
            "name": c.get("user_name"),
            "commission_number": c.get("fl_commission_number"),
            "bond_amount_usd": c.get("fl_bond_amount_usd"),
            "verified_at": c.get("verified_at"),
            "profile_url": f"/notary/{c.get('user_id')}",
        })
    total = await db.fl_notary_credentials.count_documents({"verified": True})
    return {"total": total, "limit": limit, "offset": offset, "notaries": out}


@router.get("/eligibility/{user_id}")
async def fl_notary_eligibility(user_id: str):
    """
    Public lightweight check: is this user eligible to perform FL notarizations right now?
    Used by ceremony flow & marketing pages.
    """
    cred = await db.fl_notary_credentials.find_one({"user_id": user_id}, {"_id": 0})
    if not cred:
        return {"eligible": False, "reason": "no_fl_credentials"}
    if not cred.get("verified"):
        return {"eligible": False, "reason": "credentials_not_verified", "status": cred.get("status")}

    # Check expirations
    try:
        bond_exp = datetime.fromisoformat(cred["fl_bond_expires_at"].replace("Z", "+00:00"))
        if bond_exp < datetime.now(timezone.utc):
            return {"eligible": False, "reason": "bond_expired"}
    except Exception:
        pass
    try:
        comm_exp = datetime.fromisoformat(cred["fl_commission_expires"].replace("Z", "+00:00"))
        if comm_exp < datetime.now(timezone.utc):
            return {"eligible": False, "reason": "commission_expired"}
    except Exception:
        pass
    return {"eligible": True, "commission_number": cred["fl_commission_number"]}
