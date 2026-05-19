"""
Multi-state pre-seal gate evaluator (TX / NY / CA / VA + FL).

Single entry point: `evaluate_preseal(state_code, ceremony_id, db, document_type)`
returns {ready, gates, blocked_reasons, state_code, schema_version}.

Each state's gate logic is encoded as a small evaluator function. They share
some helpers (KBA, A/V quality, retention tag, journal) but each may compose
them differently based on the published state abstract.

For FL we delegate to the existing fl_ceremony_routes readiness check (which
also handles online-will witnesses). For TX/NY/CA/VA we run pure functions
defined here.
"""
from datetime import datetime, timezone, timedelta
import logging

from data.state_compliance_abstracts import get_state, list_states

logger = logging.getLogger(__name__)

EVALUATOR_SCHEMA_VERSION = "preseal.evaluator.v1"

# ─────────────────────────────────────────────────────────────────────────────
# Shared gate primitives
# ─────────────────────────────────────────────────────────────────────────────

async def _check_kba(db, ceremony_id: str, user_id: str) -> dict:
    rec = await db.kba_attempts.find_one(
        {"ceremony_id": ceremony_id, "user_id": user_id, "passed": True},
        {"_id": 0}
    )
    if not rec:
        # Fallback: any recent pass within last hour
        recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        rec = await db.kba_attempts.find_one(
            {"user_id": user_id, "passed": True, "completed_at": {"$gte": recent}},
            {"_id": 0}
        )
    return {
        "passed": bool(rec),
        "detail": rec.get("attempt_id") if rec else "no_passing_kba_in_last_hour",
    }


async def _check_av(db, ceremony_id: str, min_duration_s: int = 30) -> dict:
    av = await db.fl_av_quality_reports.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not av:
        return {"passed": False, "detail": "av_not_reported_yet"}
    duration = av.get("duration_seconds", 0)
    if duration < min_duration_s:
        return {"passed": False, "detail": f"av_duration_{duration}s_below_{min_duration_s}s"}
    return {"passed": bool(av.get("passed")), "detail": av.get("issues") or "ok"}


async def _check_id_verification(db, ceremony_id: str, user_id: str) -> dict:
    """Credential-analysis / government-ID gate. Looks for a document analysis
    record with id_check_status='approved'."""
    rec = await db.ai_analyses.find_one(
        {"ceremony_id": ceremony_id, "user_id": user_id, "id_check_status": "approved"},
        {"_id": 0}
    )
    if not rec:
        rec = await db.identity_verifications.find_one(
            {"ceremony_id": ceremony_id, "user_id": user_id, "status": "approved"},
            {"_id": 0}
        )
    return {
        "passed": bool(rec),
        "detail": (rec.get("analysis_id") if rec else "no_approved_id_verification"),
    }


async def _check_retention_tag(db, ceremony_id: str, min_years: int) -> dict:
    rec = await db.fl_retention_tags.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not rec:
        return {"passed": False, "detail": f"no_retention_tag (need ≥{min_years}yr)"}
    yrs = rec.get("retention_years", 0)
    return {
        "passed": yrs >= min_years,
        "detail": f"retention_years={yrs}, required={min_years}",
    }


async def _check_journal_entry(db, ceremony_id: str) -> dict:
    rec = await db.fl_journal_entries.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    return {
        "passed": bool(rec),
        "detail": rec.get("entry_id") if rec else "no_journal_entry",
    }


async def _check_thumbprint(db, ceremony_id: str, user_id: str) -> dict:
    """CA-specific: biometric thumbprint for real-property + POA."""
    rec = await db.biometric_thumbprints.find_one(
        {"ceremony_id": ceremony_id, "user_id": user_id},
        {"_id": 0}
    )
    return {
        "passed": bool(rec),
        "detail": rec.get("capture_id") if rec else "no_thumbprint_captured",
    }


async def _check_principal_location(db, ceremony_id: str) -> dict:
    """Principal GPS / location capture for the signing event."""
    rec = await db.ceremony_locations.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not rec:
        # Many ceremonies log signer GPS to ceremony_events instead
        rec = await db.ceremony_events.find_one(
            {"ceremony_id": ceremony_id, "event": "principal_location_captured"},
            {"_id": 0}
        )
    return {
        "passed": bool(rec),
        "detail": "captured" if rec else "principal_location_missing",
    }


# ─────────────────────────────────────────────────────────────────────────────
# State-specific evaluators
# ─────────────────────────────────────────────────────────────────────────────

async def _evaluate_TX(db, ceremony_id: str, user_id: str, document_type: str) -> dict:
    gates = {}
    gates["audio_video"] = await _check_av(db, ceremony_id)
    gates["kba"] = await _check_kba(db, ceremony_id, user_id)
    gates["id_check"] = await _check_id_verification(db, ceremony_id, user_id)
    gates["retention"] = await _check_retention_tag(db, ceremony_id, min_years=5)
    gates["journal"] = await _check_journal_entry(db, ceremony_id)
    # TX-specific: tamper-evident requires KBA + ID (proxy)
    gates["tamper_evident"] = {
        "passed": gates["kba"]["passed"] and gates["id_check"]["passed"],
        "detail": "kba + id_check both required",
    }
    return gates


async def _evaluate_NY(db, ceremony_id: str, user_id: str, document_type: str) -> dict:
    gates = {}
    # NY blocks wills / codicils / testamentary trusts entirely
    if (document_type or "").lower() in ("will", "online_will", "codicil", "testamentary_trust", "life_estate_deed"):
        return {
            "_block_all": True,
            "_blocked_reason": f"NY prohibits RON for {document_type}",
            "document_type_allowed": {
                "passed": False,
                "detail": f"NY statute disallows {document_type} via RON (Exec. Law §135-c)",
            },
        }
    gates["audio_video"] = await _check_av(db, ceremony_id)
    gates["identity_proofing"] = {
        "passed": False,
        "detail": "multi_factor_required",
    }
    # Multi-factor: KBA AND credential-analysis (proxy via id_check) — both required
    kba = await _check_kba(db, ceremony_id, user_id)
    idc = await _check_id_verification(db, ceremony_id, user_id)
    gates["identity_proofing"]["passed"] = kba["passed"] and idc["passed"]
    gates["identity_proofing"]["detail"] = f"kba={kba['passed']} id_check={idc['passed']}"
    gates["kba"] = kba
    gates["id_check"] = idc
    gates["retention"] = await _check_retention_tag(db, ceremony_id, min_years=10)
    gates["journal"] = await _check_journal_entry(db, ceremony_id)
    gates["principal_location"] = await _check_principal_location(db, ceremony_id)
    return gates


async def _evaluate_CA(db, ceremony_id: str, user_id: str, document_type: str) -> dict:
    gates = {}
    gates["audio_video"] = await _check_av(db, ceremony_id)
    gates["kba"] = await _check_kba(db, ceremony_id, user_id)
    gates["id_check"] = await _check_id_verification(db, ceremony_id, user_id)
    gates["retention"] = await _check_retention_tag(db, ceremony_id, min_years=5)
    gates["journal"] = await _check_journal_entry(db, ceremony_id)
    # CA-specific biometric thumbprint for real-property + POA
    requires_thumbprint = (document_type or "").lower() in (
        "deed", "real_property", "power_of_attorney", "poa",
        "mortgage", "lien_release",
    )
    if requires_thumbprint:
        gates["thumbprint"] = await _check_thumbprint(db, ceremony_id, user_id)
    return gates


async def _evaluate_VA(db, ceremony_id: str, user_id: str, document_type: str) -> dict:
    gates = {}
    gates["audio_video"] = await _check_av(db, ceremony_id)
    gates["kba"] = await _check_kba(db, ceremony_id, user_id)
    gates["id_check"] = await _check_id_verification(db, ceremony_id, user_id)
    gates["retention"] = await _check_retention_tag(db, ceremony_id, min_years=5)
    gates["journal"] = await _check_journal_entry(db, ceremony_id)
    gates["tamper_evident"] = {
        "passed": gates["kba"]["passed"] and gates["id_check"]["passed"],
        "detail": "PKI signature requires both kba + id_check",
    }
    return gates


STATE_EVALUATORS = {
    "TX": _evaluate_TX,
    "NY": _evaluate_NY,
    "CA": _evaluate_CA,
    "VA": _evaluate_VA,
}


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_preseal(state_code: str, ceremony_id: str, user_id: str, db,
                           document_type: str = "general") -> dict:
    """Run the pre-seal gate evaluator for a given state.

    Returns dict:
      ready: bool
      state_code: "TX" | "NY" | ...
      schema_version: str
      gates: {gate_id: {passed, detail}}
      blocked_reasons: [str]  (only when ready=False)
      checked_at: ISO timestamp
    """
    code = state_code.upper()
    st = get_state(code)
    if not st:
        return {
            "ready": False,
            "state_code": code,
            "schema_version": EVALUATOR_SCHEMA_VERSION,
            "gates": {},
            "blocked_reasons": [f"No compliance abstract published for state '{code}'"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    if code == "FL":
        # FL has its own dedicated route /api/fl/ron/readiness — caller should hit that.
        return {
            "ready": False,
            "state_code": "FL",
            "schema_version": EVALUATOR_SCHEMA_VERSION,
            "gates": {},
            "blocked_reasons": ["FL evaluator is at /api/fl/ron/readiness/{ceremony_id}"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "redirect": f"/api/fl/ron/readiness/{ceremony_id}",
        }

    evaluator = STATE_EVALUATORS.get(code)
    if not evaluator:
        # Abstract published but evaluator not wired
        return {
            "ready": False,
            "state_code": code,
            "schema_version": EVALUATOR_SCHEMA_VERSION,
            "gates": {},
            "blocked_reasons": [f"Pre-seal evaluator not yet wired for state '{code}'. Abstract published — pipeline support coming soon."],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    gates = await evaluator(db, ceremony_id, user_id, document_type or "general")
    blocked_all = gates.pop("_block_all", False)
    blocked_reason = gates.pop("_blocked_reason", None)

    if blocked_all:
        return {
            "ready": False,
            "state_code": code,
            "schema_version": EVALUATOR_SCHEMA_VERSION,
            "gates": gates,
            "blocked_reasons": [blocked_reason] if blocked_reason else ["document type not allowed"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    blocked_reasons = []
    for gid, g in gates.items():
        if not g.get("passed"):
            detail = g.get("detail", "no detail")
            blocked_reasons.append(f"{gid}: {detail}")

    return {
        "ready": len(blocked_reasons) == 0,
        "state_code": code,
        "schema_version": EVALUATOR_SCHEMA_VERSION,
        "document_type": document_type,
        "gates": gates,
        "blocked_reasons": blocked_reasons,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def supported_state_codes() -> list:
    """Return codes for which we have a wired evaluator (NOT just an abstract)."""
    return ["FL"] + list(STATE_EVALUATORS.keys())
