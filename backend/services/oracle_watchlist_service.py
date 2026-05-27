"""
oracle_watchlist_service — per-admin subscriptions to Regulatory Oracle events.

Lets compliance officers subscribe to per-jurisdiction watchlist alerts via
email and/or Slack webhook so they get an instant ping the moment a rule
change in their watched states auto-flags packets.

Collection: `oracle_watchlists`
Document shape:
    {
      id: str (uuid hex),
      admin_email: str (lowercased),
      label: str,                              # human-readable subscription name
      jurisdictions: list[str],                # e.g. ["US-FL","US-TX","SG"]; ["*"] for any
      severity_floor: "low"|"medium"|"high",   # lowest severity that triggers
      auto_applied_only: bool,                 # only fire when oracle auto-flagged ≥1 packet
      channels: {
        email: bool,
        slack_webhook_url: str|None,           # full incoming-webhook URL
      },
      enabled: bool,
      created_at: ISO,
      updated_at: ISO,
      last_dispatched_at: ISO|None,
      dispatch_count: int,
    }

Failure-mode for `dispatch_alerts`:
    NEVER raises. All per-subscription errors are logged and skipped.
    Oracle polling must never fail because an alert dispatch failed.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3}

_db = None


def set_db(database):
    global _db
    _db = database


# ─── CRUD ────────────────────────────────────────────────────────────────────

async def list_watchlists(admin_email: str) -> list[dict]:
    if _db is None:
        return []
    cursor = _db.oracle_watchlists.find(
        {"admin_email": admin_email.lower()}, {"_id": 0}
    ).sort("created_at", -1)
    return [d async for d in cursor]


async def create_watchlist(
    admin_email: str,
    label: str,
    jurisdictions: list[str],
    severity_floor: str = "low",
    auto_applied_only: bool = False,
    email_enabled: bool = True,
    slack_webhook_url: Optional[str] = None,
) -> dict:
    if _db is None:
        raise RuntimeError("oracle_watchlist_service: DB not initialised")
    if severity_floor not in SEVERITY_RANK:
        raise ValueError(f"severity_floor must be one of {list(SEVERITY_RANK)}")
    if not jurisdictions:
        jurisdictions = ["*"]
    if slack_webhook_url and not (
        slack_webhook_url.startswith("https://hooks.slack.com/")
        or slack_webhook_url.startswith("https://discord.com/api/webhooks/")
    ):
        # We accept generic Slack-compatible webhooks; warn but allow.
        logger.info("[oracle.watchlist] non-Slack webhook accepted: %s",
                    slack_webhook_url.split("?")[0][:60])

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": uuid.uuid4().hex,
        "admin_email": admin_email.lower(),
        "label": label.strip() or "Untitled watchlist",
        "jurisdictions": [j.strip() for j in jurisdictions if j.strip()],
        "severity_floor": severity_floor,
        "auto_applied_only": bool(auto_applied_only),
        "channels": {
            "email": bool(email_enabled),
            "slack_webhook_url": slack_webhook_url or None,
        },
        "enabled": True,
        "created_at": now,
        "updated_at": now,
        "last_dispatched_at": None,
        "dispatch_count": 0,
    }
    await _db.oracle_watchlists.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_watchlist(watchlist_id: str, admin_email: str, fields: dict) -> Optional[dict]:
    if _db is None:
        return None
    allowed = {"label", "jurisdictions", "severity_floor", "auto_applied_only",
               "enabled", "channels"}
    update = {k: v for k, v in fields.items() if k in allowed}
    if not update:
        return await _db.oracle_watchlists.find_one(
            {"id": watchlist_id, "admin_email": admin_email.lower()}, {"_id": 0}
        )
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await _db.oracle_watchlists.update_one(
        {"id": watchlist_id, "admin_email": admin_email.lower()},
        {"$set": update},
    )
    if res.matched_count == 0:
        return None
    return await _db.oracle_watchlists.find_one(
        {"id": watchlist_id}, {"_id": 0}
    )


async def delete_watchlist(watchlist_id: str, admin_email: str) -> bool:
    if _db is None:
        return False
    res = await _db.oracle_watchlists.delete_one(
        {"id": watchlist_id, "admin_email": admin_email.lower()}
    )
    return res.deleted_count > 0


# ─── Dispatch ────────────────────────────────────────────────────────────────

def _event_matches(watchlist: dict, event: dict) -> bool:
    """Decide whether a given oracle event should fire a given watchlist."""
    if not watchlist.get("enabled", True):
        return False
    if watchlist.get("auto_applied_only") and not event.get("auto_applied"):
        return False
    # Severity floor
    floor = SEVERITY_RANK.get(watchlist.get("severity_floor", "low"), 1)
    ev_rank = SEVERITY_RANK.get((event.get("severity") or "low").lower(), 1)
    if ev_rank < floor:
        return False
    # Jurisdictions: ["*"] matches anything
    juris = watchlist.get("jurisdictions") or []
    if "*" in juris:
        return True
    return event.get("jurisdiction_code") in juris


def _format_slack_payload(event: dict, watchlist_label: str) -> dict:
    """Build a Slack-compatible incoming-webhook payload (also works for Discord)."""
    sev = (event.get("severity") or "low").upper()
    color = {"HIGH": "#E15A46", "MEDIUM": "#D4AF37", "LOW": "#0A192F"}.get(sev, "#0A192F")
    fields = [
        {"title": "Jurisdiction",
         "value": f"{event.get('jurisdiction_name','')} ({event.get('jurisdiction_code','')})",
         "short": True},
        {"title": "Severity", "value": sev, "short": True},
        {"title": "Effective", "value": str(event.get("effective_date", "—")), "short": True},
        {"title": "Auto-flagged packets",
         "value": str(event.get("affected_packets", 0)),
         "short": True},
        {"title": "Source", "value": str(event.get("source", "—")), "short": False},
    ]
    return {
        "text": f"📡 *NotaryChain Regulatory Oracle* — {event.get('title','(no title)')}",
        "attachments": [
            {
                "fallback": event.get("title", ""),
                "color": color,
                "title": event.get("title", "Rule change detected"),
                "text": event.get("summary", ""),
                "fields": fields,
                "footer": f"Watchlist · {watchlist_label}",
                "ts": int(datetime.now(timezone.utc).timestamp()),
            }
        ],
    }


def _format_email_html(event: dict, watchlist_label: str) -> str:
    sev = (event.get("severity") or "low").upper()
    sev_color = {"HIGH": "#E15A46", "MEDIUM": "#D4AF37", "LOW": "#0A192F"}.get(sev, "#0A192F")
    return f"""
<div style="font-family:'Inter',system-ui,sans-serif;background:#FDFCF8;padding:32px;color:#0A192F;">
  <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="background:#0A192F;color:#FDFCF8;padding:18px 22px;">
      <span style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#E15A46;font-weight:700">
        Regulatory Oracle · Watchlist · {watchlist_label}
      </span>
      <h2 style="margin:8px 0 0;font-family:Georgia,serif;font-size:22px;line-height:1.25">
        {event.get('title','Rule change detected')}
      </h2>
    </div>
    <div style="padding:22px;">
      <p style="margin:0 0 12px;color:#475569;line-height:1.55">{event.get('summary','')}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748b">Jurisdiction</td>
            <td style="padding:6px 0"><b>{event.get('jurisdiction_name','')}</b>
            ({event.get('jurisdiction_code','')})</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Severity</td>
            <td style="padding:6px 0"><b style="color:{sev_color}">{sev}</b></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Effective</td>
            <td style="padding:6px 0">{event.get('effective_date','—')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Auto-flagged packets</td>
            <td style="padding:6px 0"><b>{event.get('affected_packets',0)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Source</td>
            <td style="padding:6px 0">{event.get('source','—')}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">
        You're receiving this because you subscribed to an Oracle watchlist on NotaryChain.
        Manage your watchlists in the ACN Dashboard.
      </p>
    </div>
  </div>
</div>
""".strip()


async def _post_slack(url: str, payload: dict) -> bool:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
        return True
    except Exception as e:
        logger.warning("[oracle.watchlist] slack post failed: %s", e)
        return False


async def _send_email_alert(to_email: str, event: dict, watchlist_label: str) -> bool:
    try:
        from services.email_service import EmailService
        sev = (event.get("severity") or "low").upper()
        subject = f"[NotaryChain Oracle · {sev}] {event.get('title','Rule change detected')}"
        html = _format_email_html(event, watchlist_label)
        return await EmailService.send_email(
            to_email=to_email, subject=subject, html_content=html
        )
    except Exception as e:
        logger.warning("[oracle.watchlist] email send failed for %s: %s", to_email, e)
        return False


async def dispatch_alerts(event: dict) -> dict:
    """Fan out alerts to every matching watchlist. Returns {watchlists_matched,
    emails_sent, slacks_sent}. NEVER raises."""
    if _db is None:
        return {"watchlists_matched": 0, "emails_sent": 0, "slacks_sent": 0}
    matched = emails_sent = slacks_sent = 0
    try:
        cursor = _db.oracle_watchlists.find({"enabled": True}, {"_id": 0})
        async for w in cursor:
            try:
                if not _event_matches(w, event):
                    continue
                matched += 1
                channels = w.get("channels") or {}
                label = w.get("label") or "Oracle watchlist"
                if channels.get("email") and w.get("admin_email"):
                    if await _send_email_alert(w["admin_email"], event, label):
                        emails_sent += 1
                if channels.get("slack_webhook_url"):
                    if await _post_slack(
                        channels["slack_webhook_url"],
                        _format_slack_payload(event, label),
                    ):
                        slacks_sent += 1
                await _db.oracle_watchlists.update_one(
                    {"id": w["id"]},
                    {"$set": {"last_dispatched_at": datetime.now(timezone.utc).isoformat()},
                     "$inc": {"dispatch_count": 1}},
                )
            except Exception as inner:
                logger.warning("[oracle.watchlist] per-watchlist dispatch failed (id=%s): %s",
                               w.get("id"), inner)
    except Exception as outer:
        logger.exception("[oracle.watchlist] dispatch_alerts top-level failure: %s", outer)
    return {"watchlists_matched": matched, "emails_sent": emails_sent, "slacks_sent": slacks_sent}


async def send_test_alert(watchlist_id: str, admin_email: str) -> dict:
    """Send a one-off synthetic alert to a watchlist, regardless of jurisdiction match.
    Useful for `Test send` UI buttons."""
    if _db is None:
        return {"ok": False, "reason": "db_not_ready"}
    w = await _db.oracle_watchlists.find_one(
        {"id": watchlist_id, "admin_email": admin_email.lower()}, {"_id": 0}
    )
    if not w:
        return {"ok": False, "reason": "not_found"}

    synthetic = {
        "title": "Test alert · NotaryChain Oracle",
        "summary": "This is a test alert dispatched from your watchlist editor. "
                   "If you see this in your inbox or Slack channel, your subscription "
                   "is correctly configured.",
        "jurisdiction_code": (w.get("jurisdictions") or ["US-FL"])[0],
        "jurisdiction_name": "Test Jurisdiction",
        "severity": "medium",
        "effective_date": datetime.now(timezone.utc).date().isoformat(),
        "source": "test:send_test_alert",
        "auto_applied": False,
        "affected_packets": 0,
    }
    label = w.get("label") or "Oracle watchlist"
    sent_email = False
    sent_slack = False
    ch = w.get("channels") or {}
    if ch.get("email"):
        sent_email = await _send_email_alert(w["admin_email"], synthetic, label)
    if ch.get("slack_webhook_url"):
        sent_slack = await _post_slack(
            ch["slack_webhook_url"], _format_slack_payload(synthetic, label)
        )
    return {"ok": True, "email_sent": sent_email, "slack_sent": sent_slack}
