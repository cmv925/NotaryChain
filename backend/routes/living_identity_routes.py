"""
Living Identity Notarization — Routes
APIs for Genesis Anchor, scheduled refresh, on-demand challenges, partner API,
revocation, and analytics.
"""
import base64
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from services import living_identity_service as li

router = APIRouter(prefix="/api/living-identity", tags=["living-identity"])
logger = logging.getLogger(__name__)
db = None
DEFAULT_REFRESH_CADENCE = 90  # days, adaptive per tier later


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
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ────────── helpers ──────────

def _decode_image(image_b64: str) -> bytes:
    if not image_b64:
        raise HTTPException(status_code=400, detail="biometric_image is required")
    try:
        if image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        return base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")


async def _get_or_create_identity(user) -> Optional[dict]:
    return await db.living_identities.find_one({"user_id": user["id"]}, {"_id": 0})


def _public_view(identity: dict) -> dict:
    """Sanitized view safe to expose to non-owners (or to score lookups)."""
    return {
        "user_id": identity["user_id"],
        "trust_score": identity.get("current_trust_score"),
        "trust_tier": identity.get("trust_tier"),
        "last_refresh_at": identity.get("last_refresh_at"),
        "next_refresh_due": identity.get("next_refresh_due"),
        "drift_events_count": identity.get("drift_events_count", 0),
        "successful_challenges": identity.get("successful_challenges", 0),
        "challenges_count": identity.get("challenges_count", 0),
        "anchor_created_at": identity.get("genesis_anchor", {}).get("created_at"),
        "hcs_topic_id": identity.get("genesis_anchor", {}).get("hcs_topic_id"),
        "consent": identity.get("consent", {}),
    }


# ════════════════════════════════════════════════════════
#  GENESIS ANCHOR — initial identity capture
# ════════════════════════════════════════════════════════

@router.post("/anchor")
async def create_genesis_anchor(request: Request):
    """Create the user's Genesis Anchor — the immutable starting point of their Living Identity."""
    user = await _get_user(request)
    body = await request.json()
    image_b64 = body.get("biometric_image", "")
    image_bytes = _decode_image(image_b64)

    existing = await _get_or_create_identity(user)
    if existing:
        raise HTTPException(status_code=400, detail="Genesis Anchor already exists for this user")

    snapshot_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    bio_hash = li.biometric_hash(image_bytes)

    # Optional behavioral baseline
    behavioral = body.get("behavioral", {}) or {}
    consent = body.get("consent", {}) or {
        "behavioral_signals": False,
        "geo_tracking": False,
        "third_party_challenges": True,
    }

    # Per-user BYOK ARN (Enterprise feature) — read from user record if set
    byok_kms = user.get("byok_kms_arn") if user.get("subscription_plan") == "enterprise" else None

    blob = await li.store_biometric_blob(image_bytes, user["id"], snapshot_id, byok_kms_arn=byok_kms)

    # Seal the genesis event on Hedera
    seal = await li.seal_event({
        "type": "LIVING_IDENTITY_GENESIS",
        "user_id": user["id"],
        "biometric_hash": bio_hash,
        "timestamp": now,
    })

    genesis = {
        "anchor_id": uuid.uuid4().hex,
        "created_at": now,
        "biometric_baseline_hash": bio_hash,
        "device_fingerprint_hash": li.device_fingerprint_hash(behavioral) if behavioral else None,
        "geo_region_baseline": behavioral.get("geo_region"),
        "hedera_seal": seal,
        "hcs_topic_id": (seal or {}).get("topic_id"),
    }

    identity = {
        "user_id": user["id"],
        "email": user["email"],
        "genesis_anchor": genesis,
        "current_trust_score": 100,
        "trust_tier": "verified",
        "last_refresh_at": now,
        "next_refresh_due": (datetime.now(timezone.utc) + timedelta(days=DEFAULT_REFRESH_CADENCE)).isoformat(),
        "refresh_cadence_days": DEFAULT_REFRESH_CADENCE,
        "drift_events_count": 0,
        "drift_penalties": 0,
        "challenges_count": 0,
        "successful_challenges": 0,
        "behavioral_baseline": behavioral if consent.get("behavioral_signals") else {},
        "consent": consent,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    await db.living_identities.insert_one(identity)
    identity.pop("_id", None)

    snapshot = {
        "snapshot_id": snapshot_id,
        "user_id": user["id"],
        "captured_at": now,
        "trigger": "genesis",
        "trigger_context": {},
        "biometric_hash": bio_hash,
        "biometric_blob_ref": blob,
        "match_to_baseline": 1.0,
        "match_to_previous": 1.0,
        "drift_signals": [],
        "ai_analysis": None,
        "behavioral_delta": {},
        "trust_score_after": 100,
        "hedera_seal": seal,
    }
    await db.identity_snapshots.insert_one(snapshot)
    snapshot.pop("_id", None)

    # CRM sync
    try:
        from services.ghl_service import ghl_service, is_configured
        if is_configured():
            contact = await ghl_service.upsert_contact(
                email=user["email"], tags=["living-identity-genesis", "li-tier-verified"],
            )
            if contact and contact.get("id"):
                await ghl_service.add_note(contact["id"],
                    f"[NotaryChain · living_identity_genesis]\nuser_id: {user['id']}\nanchor_id: {genesis['anchor_id']}")
    except Exception:
        pass

    return {
        "success": True,
        "identity": _public_view(identity),
        "anchor": genesis,
        "snapshot_id": snapshot_id,
        "blob_storage": {"backend": blob.get("backend"), "encryption": blob.get("encryption")},
    }


# ════════════════════════════════════════════════════════
#  REFRESH — scheduled re-verification (Pro+)
# ════════════════════════════════════════════════════════

@router.post("/refresh")
async def refresh_identity(request: Request):
    """Refresh the user's Living Identity — captures new biometric, runs drift analysis, updates trust score."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "living_identity_refresh")

    user = await _get_user(request)
    body = await request.json()
    image_b64 = body.get("biometric_image", "")
    image_bytes = _decode_image(image_b64)
    behavioral = body.get("behavioral", {}) or {}

    identity = await _get_or_create_identity(user)
    if not identity:
        raise HTTPException(status_code=404, detail="Genesis Anchor not found — call /anchor first")

    return await _do_refresh(user, identity, image_bytes, behavioral, trigger="scheduled", context={})


async def _do_refresh(user, identity, image_bytes, behavioral, *, trigger, context):
    """Shared refresh pipeline used by /refresh, /challenge, and /public-challenge."""
    snapshot_id = uuid.uuid4().hex
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    bio_hash = li.biometric_hash(image_bytes)

    # Fetch baseline blob (if available) for AI comparison
    last_snap = await db.identity_snapshots.find_one(
        {"user_id": user["id"]}, {"_id": 0},
        sort=[("captured_at", -1)],
    )
    last_captured_str = (last_snap or {}).get("captured_at") or identity.get("last_refresh_at")
    try:
        last_captured = datetime.fromisoformat(last_captured_str) if last_captured_str else now_dt
    except Exception:
        last_captured = now_dt
    days_elapsed = max(0, (now_dt - last_captured).days)

    # Encode current image for AI analysis
    import base64 as _b64
    current_b64 = _b64.b64encode(image_bytes).decode()

    # Try to read baseline image for AI comparison
    baseline_b64 = None
    blob_ref = (last_snap or {}).get("biometric_blob_ref") or {}
    try:
        if blob_ref.get("backend") in ("local", "local-fallback"):
            with open(blob_ref["path"], "rb") as f:
                baseline_b64 = _b64.b64encode(f.read()).decode()
        elif blob_ref.get("backend") == "s3":
            import boto3
            import os as _os
            s3 = boto3.client(
                "s3", region_name=_os.environ.get("AWS_REGION", "us-east-1"),
                aws_access_key_id=_os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=_os.environ.get("AWS_SECRET_ACCESS_KEY"),
            )
            obj = s3.get_object(Bucket=blob_ref["bucket"], Key=blob_ref["key"])
            baseline_b64 = _b64.b64encode(obj["Body"].read()).decode()
    except Exception as e:
        logger.warning(f"Could not load baseline blob for AI drift: {e}")

    # AI drift analysis
    if baseline_b64:
        ai = await li.analyze_drift(baseline_b64, current_b64, days_elapsed)
    else:
        ai = {"match_confidence": 1.0, "aging_normal": True, "alert_required": False,
              "drift_signals": [], "reasoning": "No baseline blob available for comparison",
              "ai_powered": False, "model": None}

    # Behavioral consistency
    base_behavioral = identity.get("behavioral_baseline", {}) or {}
    if base_behavioral and behavioral:
        bhv_score, bhv_signals = li.behavioral_consistency_score(base_behavioral, behavioral)
    else:
        bhv_score, bhv_signals = 1.0, []

    # Compute new trust score
    drift_penalty = identity.get("drift_penalties", 0)
    if ai["alert_required"]:
        # Add penalty by severity
        if ai["match_confidence"] < 0.5:
            drift_penalty += 35  # high
        elif ai["match_confidence"] < 0.75:
            drift_penalty += 15  # medium
        else:
            drift_penalty += 5   # low

    score = li.compute_trust_score(
        biometric_match=ai["match_confidence"],
        behavioral_consistency=bhv_score,
        days_since_last_verification=days_elapsed,
        refresh_cadence_days=identity.get("refresh_cadence_days", DEFAULT_REFRESH_CADENCE),
        anan_reputation=0.85,
        drift_penalties=drift_penalty,
    )
    new_tier = li.trust_tier(score)

    # Store blob
    byok_kms = user.get("byok_kms_arn") if user.get("subscription_plan") == "enterprise" else None
    blob = await li.store_biometric_blob(image_bytes, user["id"], snapshot_id, byok_kms_arn=byok_kms)

    # Seal on Hedera
    seal = await li.seal_event({
        "type": "LIVING_IDENTITY_REFRESH",
        "user_id": user["id"],
        "trigger": trigger,
        "biometric_hash": bio_hash,
        "match_confidence": ai["match_confidence"],
        "trust_score": score,
        "trust_tier": new_tier,
        "timestamp": now,
    })

    snapshot_doc = {
        "snapshot_id": snapshot_id,
        "user_id": user["id"],
        "captured_at": now,
        "trigger": trigger,
        "trigger_context": context,
        "biometric_hash": bio_hash,
        "biometric_blob_ref": blob,
        "match_to_baseline": ai["match_confidence"],
        "match_to_previous": ai["match_confidence"],
        "drift_signals": list(set(ai["drift_signals"] + bhv_signals)),
        "ai_analysis": ai,
        "behavioral_delta": {"score": bhv_score, "signals": bhv_signals},
        "trust_score_after": score,
        "hedera_seal": seal,
    }
    await db.identity_snapshots.insert_one(snapshot_doc)
    snapshot_doc.pop("_id", None)

    # Drift event if alert
    if ai["alert_required"] or bhv_signals:
        severity = (
            "critical" if ai["match_confidence"] < 0.5 else
            "high" if ai["match_confidence"] < 0.75 else
            "medium" if bhv_signals else "low"
        )
        drift_evt = {
            "event_id": uuid.uuid4().hex,
            "user_id": user["id"],
            "snapshot_id": snapshot_id,
            "detected_at": now,
            "severity": severity,
            "category": "biometric" if ai["alert_required"] else "behavioral",
            "signals": list(set(ai["drift_signals"] + bhv_signals)),
            "ai_verdict": "likely_compromise" if ai["match_confidence"] < 0.6 else "uncertain",
            "actions_taken": ["score_decay", "user_notified"],
            "resolved": False,
        }
        await db.identity_drift_events.insert_one(drift_evt)
        drift_evt.pop("_id", None)
        # Real-time WebSocket alert
        try:
            from services.ws_manager import ws_manager
            await ws_manager.push_to_user(user["id"], {
                "type": "living_identity_drift_detected",
                "severity": severity,
                "signals": drift_evt["signals"],
                "trust_score": score,
                "trust_tier": new_tier,
                "detected_at": now,
            })
        except Exception:
            pass
        # Email user (non-blocking)
        try:
            from services.email_service import email_service
            import asyncio as _asyncio
            _asyncio.create_task(email_service.send_email(
                to_email=user["email"],
                subject="NotaryChain: Identity Drift Detected",
                html_content=(
                    f"<h2>Identity drift detected</h2><p>Severity: <b>{severity}</b></p>"
                    f"<p>Signals: {', '.join(drift_evt['signals']) or 'behavioral signals'}</p>"
                    f"<p>Your current trust score is <b>{score}</b> (tier: <b>{new_tier}</b>).</p>"
                    f"<p>If this was you, no action needed. If not, please <a href='https://notarychain.app/identity'>review your identity dashboard</a> immediately.</p>"
                ),
            ))
        except Exception:
            pass

    # Always emit a score-changed event (lighter weight than drift alert)
    try:
        previous_score = identity.get("current_trust_score", 100)
        if previous_score != score:
            from services.ws_manager import ws_manager
            await ws_manager.push_to_user(user["id"], {
                "type": "living_identity_score_changed",
                "previous_score": previous_score,
                "trust_score": score,
                "trust_tier": new_tier,
                "trigger": trigger,
                "at": now,
            })
    except Exception:
        pass

    # Update identity
    update = {
        "current_trust_score": score,
        "trust_tier": new_tier,
        "last_refresh_at": now,
        "next_refresh_due": (now_dt + timedelta(days=identity.get("refresh_cadence_days", DEFAULT_REFRESH_CADENCE))).isoformat(),
        "drift_events_count": identity.get("drift_events_count", 0) + (1 if (ai["alert_required"] or bhv_signals) else 0),
        "drift_penalties": drift_penalty,
        "updated_at": now,
    }
    if behavioral and identity.get("consent", {}).get("behavioral_signals"):
        # Slowly merge new behavioral signals into baseline (EWMA-style)
        base = identity.get("behavioral_baseline", {})
        merged = {**base}
        if behavioral.get("typing_cadence_ms_avg"):
            merged["typing_cadence_ms_avg"] = int(0.7 * base.get("typing_cadence_ms_avg", behavioral["typing_cadence_ms_avg"])
                                                  + 0.3 * behavioral["typing_cadence_ms_avg"])
        if behavioral.get("device_os") and behavioral["device_os"] not in base.get("device_oses", []):
            merged["device_oses"] = list(set(base.get("device_oses", []) + [behavioral["device_os"]]))
        update["behavioral_baseline"] = merged

    await db.living_identities.update_one({"user_id": user["id"]}, {"$set": update})

    return {
        "success": True,
        "trust_score": score,
        "trust_tier": new_tier,
        "drift_detected": ai["alert_required"] or bool(bhv_signals),
        "snapshot": snapshot_doc,
        "ai": ai,
        "behavioral_signals": bhv_signals,
        "hedera_seal": seal,
    }


# ════════════════════════════════════════════════════════
#  CHALLENGE — on-demand re-attestation (Enterprise)
# ════════════════════════════════════════════════════════

@router.post("/challenge")
async def challenge_identity(request: Request):
    """Run an on-demand challenge against the requesting user's identity."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "living_identity_challenge")

    user = await _get_user(request)
    body = await request.json()
    image_bytes = _decode_image(body.get("biometric_image", ""))
    context = {"reason": body.get("reason", "user-initiated"), "ref_id": body.get("ref_id")}

    identity = await _get_or_create_identity(user)
    if not identity:
        raise HTTPException(status_code=404, detail="Genesis Anchor not found — call /anchor first")

    result = await _do_refresh(user, identity, image_bytes, body.get("behavioral", {}), trigger="challenge", context=context)

    # Track challenge
    challenge = {
        "challenge_id": uuid.uuid4().hex,
        "user_id": user["id"],
        "challenger": {"type": "internal", "id": user["id"], "context": context["reason"]},
        "issued_at": result["snapshot"]["captured_at"],
        "responded_at": result["snapshot"]["captured_at"],
        "result": "passed" if result["trust_tier"] in ("verified", "watch") else "failed",
        "match_confidence": result["ai"]["match_confidence"],
        "snapshot_id": result["snapshot"]["snapshot_id"],
        "hedera_seal": result.get("hedera_seal"),
    }
    await db.identity_challenges.insert_one(challenge)
    challenge.pop("_id", None)
    await db.living_identities.update_one(
        {"user_id": user["id"]},
        {"$inc": {"challenges_count": 1, "successful_challenges": 1 if challenge["result"] == "passed" else 0}}
    )
    result["challenge"] = challenge
    return result


# ════════════════════════════════════════════════════════
#  PUBLIC PARTNER API — per-challenge billing (Enterprise add-on)
# ════════════════════════════════════════════════════════

@router.post("/partner-challenge")
async def partner_challenge(request: Request):
    """
    Partner platforms call this with an authorization token issued by the user.
    Charges $0.50 per challenge against the partner's account.
    """
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "living_identity_partner_api")
    partner = await _get_user(request)
    body = await request.json()
    target_user_id = body.get("target_user_id")
    auth_token = body.get("authorization_token")
    challenge_image = body.get("biometric_image")
    if not all([target_user_id, auth_token, challenge_image]):
        raise HTTPException(status_code=400, detail="target_user_id, authorization_token, and biometric_image required")

    # Verify authorization token (user must have pre-issued it; out-of-scope for MVP — using a simple existence check)
    auth = await db.identity_partner_authorizations.find_one(
        {"token": auth_token, "user_id": target_user_id, "status": "active"}, {"_id": 0}
    )
    if not auth:
        raise HTTPException(status_code=403, detail="Invalid or expired authorization token")
    if auth.get("expires_at"):
        try:
            if datetime.fromisoformat(auth["expires_at"]) < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="Authorization token expired")
        except Exception:
            pass

    target = await db.users.find_one({"id": target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    identity = await db.living_identities.find_one({"user_id": target_user_id}, {"_id": 0})
    if not identity:
        raise HTTPException(status_code=404, detail="Target has no Living Identity")

    image_bytes = _decode_image(challenge_image)
    context = {
        "reason": body.get("reason", "partner-challenge"),
        "partner_id": partner["id"],
        "partner_email": partner["email"],
    }
    result = await _do_refresh(target, identity, image_bytes, body.get("behavioral", {}), trigger="partner_challenge", context=context)

    # Bill the partner
    now = datetime.now(timezone.utc).isoformat()
    challenge_id = uuid.uuid4().hex
    challenge_record = {
        "challenge_id": challenge_id,
        "user_id": target_user_id,
        "challenger": {"type": "partner_api", "id": partner["id"], "email": partner["email"], "context": context["reason"]},
        "issued_at": now,
        "responded_at": result["snapshot"]["captured_at"],
        "result": "passed" if result["trust_tier"] in ("verified", "watch") else "failed",
        "match_confidence": result["ai"]["match_confidence"],
        "snapshot_id": result["snapshot"]["snapshot_id"],
        "hedera_seal": result.get("hedera_seal"),
        "billed_to_partner_id": partner["id"],
        "billed_amount_usd": 0.50,
    }
    await db.identity_challenges.insert_one(challenge_record)
    challenge_record.pop("_id", None)

    # Usage record (for monthly billing rollup)
    await db.identity_challenge_usage.insert_one({
        "id": challenge_id,
        "partner_id": partner["id"],
        "partner_email": partner["email"],
        "target_user_id": target_user_id,
        "amount_usd": 0.50,
        "result": challenge_record["result"],
        "created_at": now,
        "billed": False,
    })

    await db.living_identities.update_one(
        {"user_id": target_user_id},
        {"$inc": {"challenges_count": 1, "successful_challenges": 1 if challenge_record["result"] == "passed" else 0}}
    )

    return {
        "success": True,
        "challenge_id": challenge_id,
        "result": challenge_record["result"],
        "match_confidence": result["ai"]["match_confidence"],
        "trust_score": result["trust_score"],
        "trust_tier": result["trust_tier"],
        "billed_amount_usd": 0.50,
        "hedera_seal": result.get("hedera_seal"),
    }


# ────────── Authorization tokens for partner challenges ──────────

@router.post("/authorize-partner")
async def authorize_partner(request: Request):
    """User issues an authorization token a partner can use to challenge their identity."""
    user = await _get_user(request)
    body = await request.json()
    partner_id = body.get("partner_id") or body.get("partner_email")
    duration_days = int(body.get("duration_days", 30))
    if not partner_id:
        raise HTTPException(status_code=400, detail="partner_id or partner_email required")

    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    record = {
        "token": token,
        "user_id": user["id"],
        "partner_id": partner_id,
        "issued_at": now.isoformat(),
        "expires_at": (now + timedelta(days=duration_days)).isoformat(),
        "status": "active",
        "max_uses": int(body.get("max_uses", 10)),
        "uses_count": 0,
    }
    await db.identity_partner_authorizations.insert_one(record)
    record.pop("_id", None)
    return record


@router.post("/public-challenge/{token}")
async def public_challenge(token: str, request: Request):
    """
    Public challenge endpoint — used by the QR code flow. Anyone with a valid
    authorization token can submit a fresh biometric and get a verification result.
    No authentication required (the token IS the auth). Bills nothing — designed
    for self-serve identity proof (e.g., "scan this QR to verify the person at the door").
    """
    body = await request.json()
    image_b64 = body.get("biometric_image", "")
    if not image_b64:
        raise HTTPException(status_code=400, detail="biometric_image is required")
    image_bytes = _decode_image(image_b64)

    auth = await db.identity_partner_authorizations.find_one(
        {"token": token, "status": "active"}, {"_id": 0}
    )
    if not auth:
        raise HTTPException(status_code=403, detail="Invalid or expired authorization token")
    if auth.get("expires_at"):
        try:
            if datetime.fromisoformat(auth["expires_at"]) < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="Authorization token expired")
        except Exception:
            pass
    if auth.get("uses_count", 0) >= auth.get("max_uses", 10):
        raise HTTPException(status_code=403, detail="Authorization token exhausted")

    target = await db.users.find_one({"id": auth["user_id"]}, {"_id": 0})
    identity = await db.living_identities.find_one({"user_id": auth["user_id"]}, {"_id": 0})
    if not target or not identity:
        raise HTTPException(status_code=404, detail="Target user or identity missing")

    context = {
        "reason": body.get("reason", "public-qr-challenge"),
        "challenger_name": body.get("challenger_name", "anonymous"),
        "via": "public_qr",
    }
    result = await _do_refresh(target, identity, image_bytes, body.get("behavioral", {}),
                               trigger="public_challenge", context=context)

    # Track challenge
    challenge = {
        "challenge_id": uuid.uuid4().hex,
        "user_id": auth["user_id"],
        "challenger": {"type": "public", "id": "qr_anonymous", "context": context["reason"]},
        "issued_at": result["snapshot"]["captured_at"],
        "responded_at": result["snapshot"]["captured_at"],
        "result": "passed" if result["trust_tier"] in ("verified", "watch") else "failed",
        "match_confidence": result["ai"]["match_confidence"],
        "snapshot_id": result["snapshot"]["snapshot_id"],
        "hedera_seal": result.get("hedera_seal"),
        "via": "public_qr",
    }
    await db.identity_challenges.insert_one(challenge)
    challenge.pop("_id", None)

    # Increment use counter
    await db.identity_partner_authorizations.update_one(
        {"token": token}, {"$inc": {"uses_count": 1}}
    )
    await db.living_identities.update_one(
        {"user_id": auth["user_id"]},
        {"$inc": {"challenges_count": 1, "successful_challenges": 1 if challenge["result"] == "passed" else 0}}
    )

    return {
        "success": True,
        "result": challenge["result"],
        "match_confidence": result["ai"]["match_confidence"],
        "trust_score": result["trust_score"],
        "trust_tier": result["trust_tier"],
        "subject_email_masked": _mask_email(target["email"]),
        "hedera_seal": result.get("hedera_seal"),
    }


@router.get("/public-challenge/{token}/info")
async def public_challenge_info(token: str):
    """Show metadata for a public challenge token — used when QR is scanned to verify it's still valid."""
    auth = await db.identity_partner_authorizations.find_one(
        {"token": token, "status": "active"}, {"_id": 0}
    )
    if not auth:
        raise HTTPException(status_code=404, detail="Token not found or revoked")
    target = await db.users.find_one({"id": auth["user_id"]}, {"_id": 0})
    valid = True
    if auth.get("expires_at"):
        try:
            valid = datetime.fromisoformat(auth["expires_at"]) > datetime.now(timezone.utc)
        except Exception:
            pass
    return {
        "valid": valid and auth.get("uses_count", 0) < auth.get("max_uses", 10),
        "subject_email_masked": _mask_email(target.get("email", "")) if target else "—",
        "subject_name": (target.get("full_name") or "").split(" ")[0] if target else None,
        "expires_at": auth.get("expires_at"),
        "uses_remaining": max(0, auth.get("max_uses", 10) - auth.get("uses_count", 0)),
    }


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "—"
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        return f"{name[0]}***@{domain}"
    return f"{name[0]}{'*' * (len(name) - 2)}{name[-1]}@{domain}"


# ════════════════════════════════════════════════════════
#  REVOCATION & RECOVERY
# ════════════════════════════════════════════════════════

@router.post("/revoke")
async def revoke_identity(request: Request):
    """Revoke the user's Living Identity. Issues a 'death certificate' sealed on Hedera."""
    user = await _get_user(request)
    body = await request.json()
    reason = body.get("reason", "user-initiated")

    identity = await _get_or_create_identity(user)
    if not identity:
        raise HTTPException(status_code=404, detail="No identity to revoke")

    now = datetime.now(timezone.utc).isoformat()
    death_cert = {
        "user_id": user["id"],
        "anchor_id": identity.get("genesis_anchor", {}).get("anchor_id"),
        "revoked_at": now,
        "reason": reason,
        "final_trust_score": identity.get("current_trust_score"),
        "drift_events_total": identity.get("drift_events_count", 0),
        "challenges_total": identity.get("challenges_count", 0),
    }
    seal = await li.seal_event({"type": "LIVING_IDENTITY_DEATH_CERTIFICATE", **death_cert})
    death_cert["hedera_seal"] = seal

    await db.living_identities.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "status": "revoked", "trust_tier": "revoked",
            "current_trust_score": 0, "revoked_at": now,
            "death_certificate": death_cert, "updated_at": now,
        }}
    )
    return {"success": True, "death_certificate": death_cert}


@router.post("/recover")
async def recover_identity(request: Request):
    """Begin recovery flow — fresh biometric + 24h cooldown to re-anchor."""
    user = await _get_user(request)
    body = await request.json()
    image_bytes = _decode_image(body.get("biometric_image", ""))

    identity = await _get_or_create_identity(user)
    if not identity:
        raise HTTPException(status_code=404, detail="No identity to recover")
    if identity.get("status") != "revoked":
        raise HTTPException(status_code=400, detail="Identity is not in revoked state")

    # For MVP: log the recovery request; full unlock requires admin approval or 24h cooldown
    snapshot_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    bio_hash = li.biometric_hash(image_bytes)
    await li.store_biometric_blob(image_bytes, user["id"], snapshot_id)

    seal = await li.seal_event({
        "type": "LIVING_IDENTITY_RECOVERY_REQUEST",
        "user_id": user["id"], "biometric_hash": bio_hash, "timestamp": now,
    })

    await db.identity_drift_events.insert_one({
        "event_id": uuid.uuid4().hex, "user_id": user["id"], "snapshot_id": snapshot_id,
        "detected_at": now, "severity": "high", "category": "recovery",
        "signals": ["recovery_initiated"], "ai_verdict": "uncertain",
        "actions_taken": ["recovery_pending_admin_approval"], "resolved": False,
    })

    return {
        "success": True,
        "status": "pending_admin_approval",
        "message": "Your recovery request has been logged. An admin will review within 24 hours.",
        "snapshot_id": snapshot_id, "hedera_seal": seal,
    }


# ════════════════════════════════════════════════════════
#  READS — own dashboard + public score lookups
# ════════════════════════════════════════════════════════

@router.get("/me")
async def get_my_identity(request: Request):
    user = await _get_user(request)
    identity = await _get_or_create_identity(user)
    if not identity:
        return {"has_identity": False, "message": "Genesis Anchor not yet created"}
    snapshots = []
    async for s in db.identity_snapshots.find({"user_id": user["id"]}, {"_id": 0, "biometric_blob_ref": 0}).sort("captured_at", -1).limit(20):
        snapshots.append(s)
    drift = []
    async for d in db.identity_drift_events.find({"user_id": user["id"]}, {"_id": 0}).sort("detected_at", -1).limit(10):
        drift.append(d)
    return {
        "has_identity": True,
        "identity": {**identity, "_id": None} if False else _public_view(identity),
        "snapshots": snapshots,
        "drift_events": drift,
        "score_history": [{"at": s["captured_at"], "score": s["trust_score_after"]} for s in snapshots],
    }


@router.get("/score/{user_id}")
async def get_public_score(user_id: str, request: Request):
    """Public score lookup — only returns if user opted in to third-party challenges."""
    identity = await db.living_identities.find_one({"user_id": user_id}, {"_id": 0})
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")
    if not identity.get("consent", {}).get("third_party_challenges", False):
        raise HTTPException(status_code=403, detail="User has not opted in to public score lookups")
    return _public_view(identity)


@router.get("/history")
async def get_my_history(request: Request):
    user = await _get_user(request)
    snapshots = []
    async for s in db.identity_snapshots.find({"user_id": user["id"]}, {"_id": 0, "biometric_blob_ref": 0}).sort("captured_at", -1):
        snapshots.append(s)
    return {"user_id": user["id"], "snapshots": snapshots, "total": len(snapshots)}


# ════════════════════════════════════════════════════════
#  ADMIN
# ════════════════════════════════════════════════════════

@router.get("/admin/drift")
async def admin_drift_overview(request: Request):
    await _require_admin(request)
    total = await db.living_identities.count_documents({})
    by_tier_pipeline = [{"$group": {"_id": "$trust_tier", "count": {"$sum": 1}}}]
    by_tier = {}
    async for doc in db.living_identities.aggregate(by_tier_pipeline):
        by_tier[doc["_id"]] = doc["count"]
    drift_count = await db.identity_drift_events.count_documents({})
    challenge_count = await db.identity_challenges.count_documents({})
    recent_drift = []
    async for d in db.identity_drift_events.find({}, {"_id": 0}).sort("detected_at", -1).limit(20):
        recent_drift.append(d)
    return {
        "total_identities": total,
        "by_tier": by_tier,
        "drift_events_total": drift_count,
        "challenges_total": challenge_count,
        "recent_drift": recent_drift,
    }


@router.get("/admin/billing")
async def admin_partner_billing(request: Request):
    await _require_admin(request)
    summary = []
    pipeline = [
        {"$group": {
            "_id": "$partner_id",
            "partner_email": {"$first": "$partner_email"},
            "challenges_count": {"$sum": 1},
            "amount_usd_total": {"$sum": "$amount_usd"},
            "billed_count": {"$sum": {"$cond": ["$billed", 1, 0]}},
        }},
        {"$sort": {"amount_usd_total": -1}},
    ]
    async for doc in db.identity_challenge_usage.aggregate(pipeline):
        summary.append({
            "partner_id": doc["_id"],
            "partner_email": doc.get("partner_email"),
            "challenges_count": doc["challenges_count"],
            "amount_usd_total": round(doc["amount_usd_total"], 2),
            "unbilled_count": doc["challenges_count"] - doc.get("billed_count", 0),
        })
    return {"summary": summary}
