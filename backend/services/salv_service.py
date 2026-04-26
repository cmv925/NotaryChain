"""
SALV background service — scheduler + email notifications + cross-feature integrations.

Responsibilities:
  • Periodic sweep: detect overdue assets, dead-man's-switch warnings/triggers, expiring beneficiary tokens.
  • Email notifications (Resend): DMS warnings to owners, asset overdue reminders, beneficiary handoff invitations.
  • Cross-feature: when a high-value SALV asset (>= $100K) is verified, auto-issue a TrustLayer attestation
    on behalf of the system "NotaryChain Living Identity" partner.
  • Idempotency tracking: each notification kind tracked on the asset/vault to avoid spam.
"""
import asyncio
import hashlib
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = int(os.environ.get("SALV_SCAN_INTERVAL", "3600"))  # default hourly
HIGH_VALUE_USD_THRESHOLD = 100_000

_db = None
_email_service = None


def set_dependencies(database, email_service):
    global _db, _email_service
    _db = database
    _email_service = email_service


# ────────── helpers ──────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso(s: str) -> datetime:
    if not s:
        return _now()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return _now()


def _dms_state(vault: dict) -> dict:
    settings = vault.get("settings") or {}
    days = int(settings.get("dead_mans_switch_days", 180))
    last_dt = _parse_iso(settings.get("last_check_in") or vault.get("created_at"))
    expires_at = last_dt + timedelta(days=days)
    days_left = (expires_at - _now()).total_seconds() / 86400
    if days_left <= 0:
        status = "triggered"
    elif days_left <= 14:
        status = "warning"
    else:
        status = "ok"
    return {"status": status, "interval_days": days, "days_remaining": int(days_left), "expires_at": _iso(expires_at)}


# ────────── SYSTEM TRUSTLAYER PARTNER (for auto-attestations) ──────────

SALV_PARTNER_SLUG = "notarychain-salv"


async def _ensure_salv_system_partner() -> dict:
    """Ensure a system TrustLayer partner exists for issuing SALV-driven attestations."""
    partner = await _db.trust_partners.find_one({"slug": SALV_PARTNER_SLUG}, {"_id": 0})
    if partner:
        return partner
    # The hash is computed but the raw key is never returned (system-only)
    raw = f"system_{secrets.token_urlsafe(40)}"
    partner = {
        "partner_id": uuid.uuid4().hex[:16],
        "name": "NotaryChain Asset Vault",
        "slug": SALV_PARTNER_SLUG,
        "domain": "notarychain.app",
        "description": "Auto-issued attestations from the Smart Asset Life-Cycle Vault. Verifies that a user holds high-value, periodically re-verified assets in NotaryChain custody.",
        "scopes": ["attest:create", "attest:revoke"],
        "api_key_hash": hashlib.sha256(raw.encode()).hexdigest(),
        "api_key_preview": "system…" + raw[-4:],
        "status": "active",
        "system": True,
        "created_at": _iso(_now()),
        "stats": {"attestations_issued": 0, "verifications_served": 0},
    }
    await _db.trust_partners.insert_one(partner)
    partner.pop("_id", None)
    logger.info(f"SALV system TrustLayer partner created: {partner['partner_id']}")
    return partner


async def maybe_issue_high_value_attestation(asset: dict):
    """If asset value >= threshold and active, ensure a TrustLayer attestation exists."""
    if not asset or asset.get("status") != "active":
        return
    value = asset.get("value_estimate_usd") or 0
    if value < HIGH_VALUE_USD_THRESHOLD:
        return
    # Idempotency: if attestation already exists for this asset, refresh expiry, do not duplicate
    existing = await _db.trust_attestations.find_one(
        {"subject_user_id": asset["owner_id"], "claim_type": "high_value_asset_under_custody",
         "evidence_url": f"salv://{asset['asset_id']}", "revoked": False},
        {"_id": 0}
    )
    partner = await _ensure_salv_system_partner()
    expires_at = _iso(_parse_iso(asset.get("next_verification_at", _iso(_now()))) + timedelta(days=30))

    if existing:
        # Bump expiry to current next_verification + 30d grace
        await _db.trust_attestations.update_one(
            {"attestation_id": existing["attestation_id"]},
            {"$set": {"expires_at": expires_at, "claim_value": _value_bracket(value)}}
        )
        return existing["attestation_id"]

    attestation = {
        "attestation_id": uuid.uuid4().hex[:16],
        "partner_id": partner["partner_id"],
        "partner_name": partner["name"],
        "partner_slug": partner["slug"],
        "subject_user_id": asset["owner_id"],
        "claim_type": "high_value_asset_under_custody",
        "claim_value": _value_bracket(value),
        "evidence_url": f"salv://{asset['asset_id']}",
        "evidence_hash": hashlib.sha256(asset["asset_id"].encode()).hexdigest(),
        "signed_at": _iso(_now()),
        "expires_at": expires_at,
        "revoked": False,
        "issued_by": "system",
    }
    await _db.trust_attestations.insert_one(attestation)
    await _db.trust_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$inc": {"stats.attestations_issued": 1}}
    )
    logger.info(f"SALV→TrustLayer attestation issued for asset {asset['asset_id']} (${value:,.0f})")
    return attestation["attestation_id"]


async def revoke_high_value_attestation(asset_id: str):
    """Revoke any open SALV attestation tied to this asset."""
    await _db.trust_attestations.update_many(
        {"evidence_url": f"salv://{asset_id}", "revoked": False},
        {"$set": {"revoked": True, "revoked_at": _iso(_now())}}
    )


def _value_bracket(value: float) -> str:
    if value >= 10_000_000:
        return "$10M+"
    if value >= 1_000_000:
        return "$1M+"
    if value >= 500_000:
        return "$500K+"
    if value >= 250_000:
        return "$250K+"
    return "$100K+"


# ────────── BENEFICIARY HANDOFF TOKEN ──────────

async def issue_handoff_token(beneficiary_id: str, ttl_days: int = 30) -> str:
    """Generate a single-use claim token for a beneficiary; returned as opaque string."""
    raw = secrets.token_urlsafe(40)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    await _db.salv_handoff_tokens.insert_one({
        "token_hash": token_hash,
        "beneficiary_id": beneficiary_id,
        "issued_at": _iso(_now()),
        "expires_at": _iso(_now() + timedelta(days=ttl_days)),
        "claimed_at": None,
    })
    return raw


async def lookup_handoff_token(raw_token: str):
    if not raw_token:
        return None
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    rec = await _db.salv_handoff_tokens.find_one({"token_hash": token_hash}, {"_id": 0})
    if not rec:
        return None
    if rec.get("claimed_at"):
        return {**rec, "status": "claimed"}
    if _parse_iso(rec["expires_at"]) < _now():
        return {**rec, "status": "expired"}
    return {**rec, "status": "active"}


async def mark_token_claimed(raw_token: str):
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    await _db.salv_handoff_tokens.update_one(
        {"token_hash": token_hash},
        {"$set": {"claimed_at": _iso(_now())}}
    )


# ────────── EMAILS ──────────

def _safe(s) -> str:
    return (s or "").replace("<", "&lt;").replace(">", "&gt;")


async def _send(to_email: str, subject: str, html: str):
    if not _email_service:
        logger.warning("SALV email skipped — email_service not initialized")
        return
    try:
        await _email_service.EmailService.send_email(to_email=to_email, subject=subject, html_content=html)
    except Exception as e:
        logger.warning(f"SALV email send failed for {to_email}: {e}")


def _envelope(title: str, body_html: str, cta_text: str = None, cta_url: str = None) -> str:
    cta = (
        f'<p style="margin:24px 0 8px"><a href="{cta_url}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">{cta_text}</a></p>'
        if cta_text and cta_url else ""
    )
    return f"""<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#10b981;font-weight:700">NotaryChain · Asset Vault</p>
    <h1 style="margin:0 0 14px;color:#f8fafc;font-size:22px">{_safe(title)}</h1>
    <div style="color:#cbd5e1;font-size:14px;line-height:1.55">{body_html}</div>
    {cta}
    <p style="margin:24px 0 0;font-size:11px;color:#64748b">SALV is part of NotaryChain — your decentralized asset custody network.</p>
  </div></body></html>"""


def _public_url(path: str) -> str:
    base = (os.environ.get("PUBLIC_FRONTEND_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
    return f"{base}{path}"


async def send_dms_warning(vault: dict, owner: dict, days_left: int):
    html = f"""<p>Hello {_safe(owner.get('full_name') or 'there')},</p>
      <p>Your <strong>Smart Asset Vault</strong> dead-man's-switch is set to expire in <strong>{days_left} days</strong>.</p>
      <p>If you don't check in before then, your beneficiaries will be automatically notified
      and able to claim their share of your custody assets.</p>"""
    cta = _public_url("/asset-vault")
    await _send(owner["email"], f"Action needed: Check in to your Asset Vault ({days_left} days left)",
                _envelope("You need to check in soon", html, "Check in now", cta))


async def send_dms_triggered(vault: dict, owner: dict):
    html = f"""<p>Hello {_safe(owner.get('full_name') or 'there')},</p>
      <p>Your dead-man's-switch has <strong>triggered</strong>. Your beneficiaries are now
      receiving claim notifications for the assets in your vault.</p>
      <p>If this was an oversight, sign in immediately to revoke handoffs in progress.</p>"""
    cta = _public_url("/asset-vault")
    await _send(owner["email"], "Your Asset Vault dead-man's-switch has TRIGGERED",
                _envelope("Dead-man's-switch triggered", html, "Open vault", cta))


async def send_asset_overdue(asset: dict, owner: dict):
    html = f"""<p>Hello {_safe(owner.get('full_name') or 'there')},</p>
      <p>The asset <strong>{_safe(asset.get('title'))}</strong> in your vault is past its scheduled re-verification.</p>
      <p>Re-verifying confirms it's still valid and resets the timer for another {asset.get('verification_interval_days', 365)} days.</p>"""
    cta = _public_url("/asset-vault")
    await _send(owner["email"], f"Re-verification overdue: {asset.get('title','asset')}",
                _envelope("An asset is overdue", html, "Re-verify now", cta))


async def send_beneficiary_invitation(beneficiary: dict, asset: dict, owner_name: str, raw_token: str):
    cta = _public_url(f"/handoff/{raw_token}")
    html = f"""<p>Hello {_safe(beneficiary.get('name') or 'there')},</p>
      <p>You have been named as a <strong>{beneficiary.get('share_percent', 0):.0f}% beneficiary</strong>
      of <strong>{_safe(asset.get('title'))}</strong> by {_safe(owner_name)} in their NotaryChain Asset Vault.</p>
      <p>The owner has triggered a handoff. You can review and accept your share via the secure link below.</p>
      <p style="font-size:11px;color:#64748b">This link is single-use and expires in 30 days.</p>"""
    await _send(beneficiary["email"], f"You've been named a beneficiary on {asset.get('title','an asset')}",
                _envelope("Beneficiary handoff", html, "Review handoff", cta))


# ────────── SCAN LOOP ──────────

async def _emit_event(asset_id, vault_id, etype, data):
    await _db.salv_events.insert_one({
        "event_id": uuid.uuid4().hex[:16],
        "asset_id": asset_id,
        "vault_id": vault_id,
        "type": etype,
        "data": data,
        "created_at": _iso(_now()),
    })


async def _check_dms_for_vault(vault: dict):
    state = _dms_state(vault)
    notif = vault.get("dms_notifications") or {}
    owner = await _db.users.find_one({"id": vault["owner_id"]}, {"_id": 0, "email": 1, "full_name": 1, "id": 1})
    if not owner:
        return

    if state["status"] == "warning" and not notif.get("warning_sent"):
        await send_dms_warning(vault, owner, state["days_remaining"])
        await _db.salv_vaults.update_one(
            {"vault_id": vault["vault_id"]},
            {"$set": {"dms_notifications.warning_sent": _iso(_now())}}
        )
        await _emit_event(None, vault["vault_id"], "dead_mans_switch_warning_sent", state)

    if state["status"] == "triggered" and not notif.get("triggered_sent"):
        await send_dms_triggered(vault, owner)
        await _db.salv_vaults.update_one(
            {"vault_id": vault["vault_id"]},
            {"$set": {"dms_notifications.triggered_sent": _iso(_now())}}
        )
        await _emit_event(None, vault["vault_id"], "dead_mans_switch_triggered_sent", state)

    if state["status"] == "ok" and (notif.get("warning_sent") or notif.get("triggered_sent")):
        # Owner checked in; reset notification flags
        await _db.salv_vaults.update_one(
            {"vault_id": vault["vault_id"]},
            {"$unset": {"dms_notifications.warning_sent": "", "dms_notifications.triggered_sent": ""}}
        )


async def _check_overdue_assets():
    cutoff_iso = _iso(_now())
    async for asset in _db.salv_assets.find(
        {"status": "active", "next_verification_at": {"$lte": cutoff_iso}},
        {"_id": 0}
    ):
        notif = asset.get("notifications") or {}
        if notif.get("overdue_sent"):
            continue
        owner = await _db.users.find_one({"id": asset["owner_id"]}, {"_id": 0, "email": 1, "full_name": 1, "id": 1})
        if owner:
            await send_asset_overdue(asset, owner)
        await _db.salv_assets.update_one(
            {"asset_id": asset["asset_id"]},
            {"$set": {"notifications.overdue_sent": _iso(_now())}}
        )
        await _emit_event(asset["asset_id"], asset["vault_id"], "asset_overdue_email_sent", {"title": asset.get("title")})


async def run_salv_scheduler():
    """Background loop — DMS notifications + overdue alerts, hourly by default."""
    logger.info(f"SALV scheduler started · interval={CHECK_INTERVAL_SECONDS}s")
    while True:
        try:
            async for vault in _db.salv_vaults.find({}, {"_id": 0}):
                await _check_dms_for_vault(vault)
            await _check_overdue_assets()
        except Exception as e:
            logger.error(f"SALV scheduler error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
