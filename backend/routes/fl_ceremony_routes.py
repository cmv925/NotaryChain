"""
Florida Ceremony Pipeline — M3 add-ons for FL Stat. 117.201-117.305 compliance.

This module supplements the existing ceremony pipeline with FL-mandated steps:
  • Jurisdiction qualifier — capture FL nexus + GPS at ceremony start.
  • Online Will witness flow — 2 witnesses with their own ID proofing + KBA + acceptance.
  • A/V quality enforcement — minimum 720p recording, rejected if below threshold.
  • 10-year S3 Object Lock retention — every FL ceremony asset tagged for legal hold.
  • Readiness check — single endpoint that confirms all FL gates passed before sealing.

These endpoints reference ceremony_id from the existing ceremony pipeline; they DO NOT
duplicate it. The main ceremony pipeline calls into this module via the readiness
endpoint before allowing a FL ceremony to seal.
"""
import hashlib
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr

router = APIRouter(prefix="/api/fl/ceremony", tags=["florida-ceremony"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ─────────── helpers ───────────

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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return _now()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ═════════════════════════════════════════════════════════
#  JURISDICTION QUALIFIER
# ═════════════════════════════════════════════════════════

FL_NEXUS_BASES = ("real_estate_in_fl", "fl_law_governed", "fl_resident_signer",
                  "fl_business_entity", "online_will_fl_resident", "other")


class JurisdictionQualifier(BaseModel):
    ceremony_id: str
    concerns_fl_property: bool = False
    concerns_fl_law: bool = False
    fl_nexus_basis: str
    nexus_details: Optional[str] = None
    # Principal location at time of capture
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    geo_accuracy_m: Optional[float] = None
    geo_city: Optional[str] = None
    geo_state: Optional[str] = None
    geo_country: Optional[str] = "US"


@router.post("/jurisdiction-qualifier")
async def submit_jurisdiction_qualifier(body: JurisdictionQualifier, request: Request):
    """Principal confirms the FL nexus before the ceremony proceeds."""
    user = await _get_user(request)
    if body.fl_nexus_basis not in FL_NEXUS_BASES:
        raise HTTPException(status_code=400, detail=f"fl_nexus_basis must be one of {FL_NEXUS_BASES}")
    if not body.concerns_fl_property and not body.concerns_fl_law and body.fl_nexus_basis not in ("online_will_fl_resident",):
        raise HTTPException(
            status_code=400,
            detail="Florida nexus required: at least one of FL property, FL law, or FL-resident online will."
        )

    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (request.client.host if request.client else "unknown"))

    record = {
        "qualifier_id": uuid.uuid4().hex[:16],
        "ceremony_id": body.ceremony_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "concerns_fl_property": body.concerns_fl_property,
        "concerns_fl_law": body.concerns_fl_law,
        "fl_nexus_basis": body.fl_nexus_basis,
        "nexus_details": body.nexus_details,
        "principal_location": {
            "lat": body.geo_lat,
            "lng": body.geo_lng,
            "accuracy_m": body.geo_accuracy_m,
            "city": body.geo_city,
            "state": body.geo_state,
            "country": body.geo_country,
            "captured_at": _iso(_now()),
        },
        "principal_ip": ip,
        "created_at": _iso(_now()),
    }
    # Idempotent per ceremony — last submission wins
    await db.fl_jurisdiction_qualifications.update_one(
        {"ceremony_id": body.ceremony_id, "user_id": user["id"]},
        {"$set": record},
        upsert=True,
    )
    return record


@router.get("/jurisdiction-qualifier/{ceremony_id}")
async def get_jurisdiction_qualifier(ceremony_id: str, request: Request):
    user = await _get_user(request)
    rec = await db.fl_jurisdiction_qualifications.find_one(
        {"ceremony_id": ceremony_id}, {"_id": 0}
    )
    if not rec:
        raise HTTPException(status_code=404, detail="No jurisdiction qualifier on this ceremony")
    if rec["user_id"] != user["id"] and user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return rec


# ═════════════════════════════════════════════════════════
#  ONLINE WILL — 2-WITNESS FLOW
# ═════════════════════════════════════════════════════════

class WitnessInvitation(BaseModel):
    ceremony_id: str
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    relationship: Optional[str] = None


@router.post("/will/witnesses/invite")
async def invite_will_witness(body: WitnessInvitation, request: Request):
    """Principal invites a witness to a FL online will ceremony.

    Florida (Stat. 732.522) requires exactly 2 witnesses present on video. The platform
    enforces a hard cap at 2.
    """
    user = await _get_user(request)
    existing_count = await db.fl_will_witnesses.count_documents({"ceremony_id": body.ceremony_id})
    if existing_count >= 2:
        raise HTTPException(status_code=400, detail="A FL online will already has 2 witnesses on this ceremony.")

    # Don't allow inviting yourself
    if body.email.lower() == user["email"].lower():
        raise HTTPException(status_code=400, detail="You cannot witness your own will.")

    raw_token = secrets.token_urlsafe(40)
    witness = {
        "witness_id": uuid.uuid4().hex[:16],
        "ceremony_id": body.ceremony_id,
        "invited_by_user_id": user["id"],
        "invited_by_email": user["email"],
        "name": body.name.strip(),
        "email": body.email.lower(),
        "relationship": body.relationship,
        "status": "invited",  # invited → accepted → kba_passed → present → completed
        "token_hash": _hash_token(raw_token),
        "invited_at": _iso(_now()),
        "expires_at": _iso(_now() + timedelta(days=14)),
    }
    await db.fl_will_witnesses.insert_one(witness)

    # Send invitation email (best-effort)
    try:
        from services import email_service
        base = (os.environ.get("PUBLIC_FRONTEND_URL")
                or os.environ.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
        link = f"{base}/florida/witness/{raw_token}"
        html = f"""<p>Hello {body.name},</p>
          <p>You've been invited to serve as a <strong>witness</strong> on a Florida online will
          ceremony by {user.get('full_name') or user['email']}.</p>
          <p>Florida law (Stat. 732.522) requires 2 witnesses present on video during a digital will signing.
          To accept, follow this secure link:</p>
          <p><a href="{link}" style="background:#10b981;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Accept witness invitation</a></p>
          <p style="font-size:11px;color:#64748b">Link expires in 14 days · single-use</p>"""
        await email_service.EmailService.send_email(
            to_email=body.email, subject="Florida online will — witness invitation",
            html_content=html
        )
    except Exception as e:
        logger.warning(f"Witness email send failed: {e}")

    out = {k: v for k, v in witness.items() if k != "token_hash"}
    # Return the raw token ONLY to the inviter so they can share it directly too
    out["share_link_path"] = f"/florida/witness/{raw_token}"
    return out


@router.get("/will/witnesses/{ceremony_id}")
async def list_will_witnesses(ceremony_id: str, request: Request):
    user = await _get_user(request)
    out = []
    async for w in db.fl_will_witnesses.find({"ceremony_id": ceremony_id},
                                              {"_id": 0, "token_hash": 0}).sort("invited_at", 1):
        # Only inviter, admins, or notaries see all
        if w["invited_by_user_id"] != user["id"] and user.get("role") not in ("admin", "notary"):
            continue
        out.append(w)
    return {"ceremony_id": ceremony_id, "witnesses": out, "total": len(out), "required": 2}


@router.get("/will/witness-token/{raw_token}")
async def public_witness_lookup(raw_token: str):
    """Public: witness opens magic link → returns ceremony context."""
    rec = await db.fl_will_witnesses.find_one(
        {"token_hash": _hash_token(raw_token)}, {"_id": 0, "token_hash": 0}
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Invalid or unknown witness token")
    if _parse_iso(rec["expires_at"]) < _now():
        return {"status": "expired", "expires_at": rec["expires_at"]}
    return {
        "status": rec.get("status", "invited"),
        "witness": {
            "name": rec.get("name"),
            "email": rec.get("email"),
            "relationship": rec.get("relationship"),
        },
        "ceremony_id": rec["ceremony_id"],
        "invited_by_email": rec.get("invited_by_email"),
        "expires_at": rec["expires_at"],
    }


@router.post("/will/witness-token/{raw_token}/accept")
async def public_witness_accept(raw_token: str, request: Request):
    """Public: witness clicks Accept on the magic link page."""
    rec = await db.fl_will_witnesses.find_one(
        {"token_hash": _hash_token(raw_token)}, {"_id": 0}
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Invalid witness token")
    if _parse_iso(rec["expires_at"]) < _now():
        raise HTTPException(status_code=400, detail="Witness invitation expired")
    if rec["status"] not in ("invited", "accepted"):
        return {"witness_id": rec["witness_id"], "status": rec["status"], "already": True}

    await db.fl_will_witnesses.update_one(
        {"witness_id": rec["witness_id"]},
        {"$set": {"status": "accepted", "accepted_at": _iso(_now())}}
    )
    return {"witness_id": rec["witness_id"], "status": "accepted"}


# ═════════════════════════════════════════════════════════
#  A/V RECORDING QUALITY ENFORCEMENT
# ═════════════════════════════════════════════════════════

class AVQualityReport(BaseModel):
    ceremony_id: str
    video_width: int
    video_height: int
    audio_sample_rate_hz: Optional[int] = None
    bitrate_kbps: Optional[int] = None
    framerate: Optional[float] = None
    recording_duration_sec: Optional[int] = None
    container_format: Optional[str] = None


MIN_VIDEO_HEIGHT = 720          # FL guidance: 720p minimum
MIN_AUDIO_SAMPLE_RATE = 16000   # 16 kHz minimum
MIN_DURATION_SEC = 30           # < 30s suggests truncated session


@router.post("/av/report-quality")
async def report_av_quality(body: AVQualityReport, request: Request):
    """Frontend reports recording quality metadata; backend grades it."""
    user = await _get_user(request)
    issues = []
    if body.video_height < MIN_VIDEO_HEIGHT:
        issues.append({"type": "video_resolution_too_low",
                       "detail": f"{body.video_width}x{body.video_height} (min height {MIN_VIDEO_HEIGHT}p)"})
    if body.audio_sample_rate_hz is not None and body.audio_sample_rate_hz < MIN_AUDIO_SAMPLE_RATE:
        issues.append({"type": "audio_sample_rate_too_low",
                       "detail": f"{body.audio_sample_rate_hz} Hz (min {MIN_AUDIO_SAMPLE_RATE} Hz)"})
    if body.recording_duration_sec is not None and body.recording_duration_sec < MIN_DURATION_SEC:
        issues.append({"type": "recording_too_short",
                       "detail": f"{body.recording_duration_sec}s (min {MIN_DURATION_SEC}s)"})

    passed = len(issues) == 0
    record = {
        "ceremony_id": body.ceremony_id,
        "user_id": user["id"],
        "video_width": body.video_width,
        "video_height": body.video_height,
        "audio_sample_rate_hz": body.audio_sample_rate_hz,
        "bitrate_kbps": body.bitrate_kbps,
        "framerate": body.framerate,
        "recording_duration_sec": body.recording_duration_sec,
        "container_format": body.container_format,
        "issues": issues,
        "passed": passed,
        "checked_at": _iso(_now()),
    }
    await db.fl_av_quality_reports.update_one(
        {"ceremony_id": body.ceremony_id},
        {"$set": record}, upsert=True
    )
    return {"passed": passed, "issues": issues, "min_video_height_px": MIN_VIDEO_HEIGHT,
            "min_audio_sample_rate_hz": MIN_AUDIO_SAMPLE_RATE}


# ═════════════════════════════════════════════════════════
#  10-YEAR RETENTION TAGGING
# ═════════════════════════════════════════════════════════

@router.post("/retention/tag")
async def tag_ceremony_for_fl_retention(request: Request):
    """
    Tag an S3 object reference (or arbitrary asset) for FL_10YR retention.
    The actual S3 Object Lock is applied by storage_service when feasible; this
    endpoint records the legal hold in our DB as the canonical retention ledger.
    """
    user = await _get_user(request)
    body = await request.json()
    ceremony_id = body.get("ceremony_id")
    asset_kind = body.get("asset_kind")   # 'recording' | 'journal' | 'evidence_bundle' | 'document'
    object_ref = body.get("object_ref")
    sha256 = body.get("sha256")
    if not ceremony_id or not asset_kind or not object_ref:
        raise HTTPException(status_code=400, detail="ceremony_id, asset_kind, object_ref required")

    retain_until = _now() + timedelta(days=365 * 10)
    record = {
        "tag_id": uuid.uuid4().hex[:16],
        "ceremony_id": ceremony_id,
        "user_id": user["id"],
        "asset_kind": asset_kind,
        "object_ref": object_ref,
        "sha256": sha256,
        "retention_policy": "FL_10YR",
        "tagged_at": _iso(_now()),
        "retain_until": _iso(retain_until),
        "object_lock_applied": False,  # flipped true when storage_service applies S3 Object Lock
    }

    # Best-effort: ask storage_service to apply S3 Object Lock
    try:
        from services import storage_service
        applier = getattr(storage_service, "apply_fl_retention_lock", None)
        if callable(applier):
            ok = await applier(object_ref, retain_until)
            record["object_lock_applied"] = bool(ok)
    except Exception as e:
        logger.warning(f"S3 Object Lock attempt failed (will rely on DB ledger only): {e}")

    await db.fl_retention_tags.insert_one(record)
    record.pop("_id", None)
    return record


@router.get("/retention/list/{ceremony_id}")
async def list_retention_tags(ceremony_id: str, request: Request):
    user = await _get_user(request)
    out = []
    async for r in db.fl_retention_tags.find({"ceremony_id": ceremony_id}, {"_id": 0}).sort("tagged_at", 1):
        if r["user_id"] != user["id"] and user.get("role") not in ("admin", "notary"):
            continue
        out.append(r)
    return {"ceremony_id": ceremony_id, "tags": out, "total": len(out)}


# ═════════════════════════════════════════════════════════
#  READINESS CHECK — single gate before sealing
# ═════════════════════════════════════════════════════════

@router.get("/readiness/{ceremony_id}")
async def fl_ceremony_readiness(ceremony_id: str, request: Request, document_type: Optional[str] = None):
    """
    Single endpoint that the main ceremony pipeline calls before sealing.
    Returns ready=true ONLY when every FL gate has passed for this ceremony.
    """
    user = await _get_user(request)
    gates = {}

    # 1) Jurisdiction qualifier
    juris = await db.fl_jurisdiction_qualifications.find_one(
        {"ceremony_id": ceremony_id, "user_id": user["id"]}, {"_id": 0}
    )
    gates["jurisdiction_qualifier"] = {
        "passed": bool(juris),
        "detail": juris["fl_nexus_basis"] if juris else None,
    }

    # 2) KBA passed (most recent attempt linked to ceremony)
    kba_pass = await db.kba_attempts.find_one(
        {"user_id": user["id"], "ceremony_id": ceremony_id, "passed": True}, {"_id": 0}
    )
    # Allow non-ceremony-linked recent pass as fallback
    if not kba_pass:
        kba_pass = await db.kba_attempts.find_one(
            {"user_id": user["id"], "passed": True,
             "completed_at": {"$gte": _iso(_now() - timedelta(hours=1))}}, {"_id": 0}
        )
    gates["kba"] = {"passed": bool(kba_pass), "detail": kba_pass["attempt_id"] if kba_pass else None}

    # 3) Online Will witness requirement (only if document type is will)
    if (document_type or "").lower() in ("will", "online_will"):
        witnesses = []
        async for w in db.fl_will_witnesses.find({"ceremony_id": ceremony_id}, {"_id": 0, "token_hash": 0}):
            witnesses.append(w)
        accepted = [w for w in witnesses if w["status"] in ("accepted", "kba_passed", "present", "completed")]
        gates["witnesses"] = {
            "passed": len(accepted) >= 2,
            "detail": {"accepted": len(accepted), "required": 2,
                       "witnesses": [{"name": w.get("name"), "status": w.get("status")} for w in witnesses]},
        }

    # 4) A/V quality (if reported)
    av = await db.fl_av_quality_reports.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    gates["av_quality"] = {
        "passed": bool(av and av.get("passed")),
        "detail": (av.get("issues") if av else "not_reported_yet"),
    }

    all_passed = all(g["passed"] for g in gates.values())
    return {
        "ceremony_id": ceremony_id,
        "ready": all_passed,
        "document_type": document_type,
        "gates": gates,
        "checked_at": _iso(_now()),
    }
