"""
ACN Regulatory Oracle — Live Rule-Change Feed
==============================================
A lightweight background poller that watches curated regulatory sources for
notary-statute amendments. When a change matches a seeded jurisdiction (and
hasn't been recorded yet), it automatically calls
`acn_service.record_rule_update`, flags affected packets, and stores the
event so the ACN dashboard can render a real-time "rule-change watchlist".

Mode toggled via `ACN_ORACLE_MODE`:
  • `mock` (default) — generates deterministic synthetic events from a curated
    feed table for demos.
  • `real` — pulls live RSS / JSON endpoints from `ACN_ORACLE_FEEDS` (comma-
    separated URLs). Parsing is best-effort; failed feeds degrade silently.

Configurable:
  • ACN_ORACLE_INTERVAL_HOURS — default 24 (daily)
  • ACN_ORACLE_INITIAL_DELAY_SECS — default 600 (10 min after boot)
"""
from __future__ import annotations
import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_db = None
_started = False


def set_db(database):
    global _db
    _db = database


# Curated mock feed — used when ACN_ORACLE_MODE=mock (default).  Each entry is
# treated as a "discovered" regulatory amendment; the oracle dedupes by
# (jurisdiction_code, signature_hash).
_MOCK_FEED: list[dict] = [
    {
        "jurisdiction_code": "US-FL",
        "title": "Florida Senate Bill 750 — RON Identity-Proofing Update",
        "summary": "Amends F.S. § 117.295 to require multi-factor credential analysis "
                   "for all online notarizations executed for Florida residents, "
                   "effective March 1, 2026.",
        "source": "Florida Legislature OPPAGA",
        "effective_date": "2026-03-01",
        "severity": "medium",
    },
    {
        "jurisdiction_code": "EU",
        "title": "eIDAS 2.0 — Qualified Electronic Signature Refresh",
        "summary": "Regulation (EU) 2024/1183 introduces the European Digital Identity "
                   "Wallet requirement for cross-border notarial acts.",
        "source": "EU Official Journal",
        "effective_date": "2026-05-21",
        "severity": "high",
    },
    {
        "jurisdiction_code": "US-TX",
        "title": "Texas HB 2706 — Audit-Log Retention Extension",
        "summary": "Extends mandatory recording retention from 5 to 7 years for all "
                   "Texas online notarizations.",
        "source": "Texas SOS Bulletin",
        "effective_date": "2026-02-15",
        "severity": "low",
    },
    {
        "jurisdiction_code": "SG",
        "title": "Singapore Academy of Law — Updated Notaries Public Rules 2026",
        "summary": "New jurat formatting requirements and digital seal verification "
                   "procedures for foreign-bound notarial acts.",
        "source": "Singapore Academy of Law",
        "effective_date": "2026-04-01",
        "severity": "medium",
    },
    {
        "jurisdiction_code": "DE-de",
        "title": "Bundesnotarkammer Mitteilung 03/2026",
        "summary": "Aktualisierung der Anforderungen an die qualifizierte elektronische "
                   "Signatur bei Online-Beurkundungen.",
        "source": "Bundesnotarkammer",
        "effective_date": "2026-03-15",
        "severity": "medium",
    },
]


def _signature_hash(event: dict) -> str:
    """Stable id for de-duplication."""
    blob = f"{event['jurisdiction_code']}::{event['title']}::{event['effective_date']}"
    return hashlib.sha256(blob.encode()).hexdigest()


def _mode() -> str:
    return (os.environ.get("ACN_ORACLE_MODE") or "mock").strip().lower()


async def _fetch_mock_events() -> list[dict]:
    """Returns the curated demo feed."""
    return list(_MOCK_FEED)


async def _fetch_real_events() -> list[dict]:
    """Pulls one or more public RSS/JSON feeds. Best-effort — failed feeds
    return [] so the oracle keeps ticking. This is intentionally tiny — no
    HTML scraping, just a few well-known regulatory bulletin endpoints.

    Configure via `ACN_ORACLE_FEEDS=https://feed-a.org/rss,https://feed-b.gov/json`.
    """
    raw = os.environ.get("ACN_ORACLE_FEEDS", "").strip()
    if not raw:
        return []
    urls = [u.strip() for u in raw.split(",") if u.strip()]
    if not urls:
        return []
    try:
        import httpx  # already a transitive dep
    except ImportError:
        logger.warning("[ACN.oracle] httpx unavailable — real feeds skipped")
        return []

    events: list[dict] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in urls[:5]:  # cap to 5 feeds to stay polite
            try:
                resp = await client.get(url)
                if resp.status_code >= 400:
                    continue
                # Very lightweight parsing — assumes a JSON array of events
                # in this minimal shape. Real RSS parsing would use feedparser.
                if resp.headers.get("content-type", "").startswith("application/json"):
                    data = resp.json()
                    if isinstance(data, list):
                        for entry in data[:50]:
                            if isinstance(entry, dict) and entry.get("jurisdiction_code"):
                                events.append({
                                    "jurisdiction_code": entry["jurisdiction_code"],
                                    "title": entry.get("title", "Untitled change"),
                                    "summary": entry.get("summary", ""),
                                    "source": entry.get("source", url),
                                    "effective_date": entry.get("effective_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                                    "severity": entry.get("severity", "medium"),
                                })
            except Exception as e:
                logger.warning("[ACN.oracle] feed %s failed: %s", url, e)
    return events


async def run_once() -> dict:
    """One pass: fetch events, store new ones, auto-trigger rule_update for each.
    Returns a summary {events_found, new_events, packets_flagged}."""
    if _db is None:
        return {"events_found": 0, "new_events": 0, "packets_flagged": 0}

    events = await (_fetch_real_events() if _mode() == "real" else _fetch_mock_events())
    new_events: list[dict] = []
    packets_flagged = 0

    from services import acn_service

    for ev in events:
        code = ev.get("jurisdiction_code")
        if not code or code not in acn_service.JURISDICTION_RULES:
            continue
        sig = _signature_hash(ev)
        existing = await _db.acn_oracle_events.find_one({"signature": sig}, {"_id": 0, "signature": 1})
        if existing:
            continue
        # Record the oracle event for the watchlist UI
        oracle_doc = {
            "id": uuid.uuid4().hex,
            "signature": sig,
            "jurisdiction_code": code,
            "jurisdiction_name": acn_service.JURISDICTION_RULES[code]["name"],
            "title": ev["title"],
            "summary": ev["summary"],
            "source": ev["source"],
            "effective_date": ev["effective_date"],
            "severity": ev["severity"],
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "mode": _mode(),
            "auto_applied": False,
            "rule_update_id": None,
            "affected_packets": 0,
        }
        # Auto-call record_rule_update so affected packets get flagged immediately
        try:
            update = await acn_service.record_rule_update(
                code=code,
                change_summary=f"[Oracle] {ev['title']}: {ev['summary']}",
                effective_date=ev["effective_date"],
                actor=f"oracle:{ev['source']}",
            )
            oracle_doc["auto_applied"] = True
            oracle_doc["rule_update_id"] = update.get("id")
            oracle_doc["affected_packets"] = len(update.get("affected_packet_ids", []))
            packets_flagged += oracle_doc["affected_packets"]
        except Exception as e:
            logger.warning("[ACN.oracle] record_rule_update failed for %s: %s", code, e)
        await _db.acn_oracle_events.insert_one(oracle_doc)
        oracle_doc.pop("_id", None)
        new_events.append(oracle_doc)

        # Fan-out per-jurisdiction watchlist alerts (email + Slack).
        # Never raises — failures are swallowed inside the service.
        try:
            from services import oracle_watchlist_service
            dispatch = await oracle_watchlist_service.dispatch_alerts(oracle_doc)
            if dispatch.get("watchlists_matched", 0) > 0:
                logger.info("[ACN.oracle] dispatched alerts: %s", dispatch)
        except Exception as e:
            logger.warning("[ACN.oracle] watchlist dispatch failed: %s", e)

    return {
        "events_found": len(events),
        "new_events": len(new_events),
        "packets_flagged": packets_flagged,
        "mode": _mode(),
    }


async def run_scheduler():
    """Background poll loop."""
    global _started
    if _started:
        return
    _started = True
    initial = int(os.environ.get("ACN_ORACLE_INITIAL_DELAY_SECS") or 600)
    interval = int(os.environ.get("ACN_ORACLE_INTERVAL_HOURS") or 24) * 3600
    logger.info("[ACN.oracle] Scheduler started · mode=%s · initial=%ss · interval=%sh",
                _mode(), initial, interval // 3600)
    await asyncio.sleep(initial)
    while True:
        try:
            res = await run_once()
            if res.get("new_events"):
                logger.info("[ACN.oracle] tick: %s", res)
        except Exception as e:
            logger.error("[ACN.oracle] tick failed: %s", e)
        await asyncio.sleep(interval)


# Route module so it can be imported & registered like other services
from fastapi import APIRouter, Depends, HTTPException
from models import User
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/acn/oracle", tags=["acn-oracle"])


async def _is_admin(current_user: User) -> bool:
    if _db is None:
        return False
    u = await _db.users.find_one({"email": current_user.email}, {"role": 1})
    return bool(u) and u.get("role") == "admin"


@router.get("/events")
async def list_oracle_events(limit: int = 50, current_user: User = Depends(get_current_user)):
    """Returns the most recent oracle-discovered rule changes — used by the
    ACN dashboard 'watchlist' badge + the Rule Updates tab feed."""
    items = []
    async for ev in _db.acn_oracle_events.find({}, {"_id": 0}).sort("discovered_at", -1).limit(limit):
        items.append(ev)
    return {"events": items, "total": len(items), "mode": _mode()}


@router.post("/run-now")
async def trigger_oracle(current_user: User = Depends(get_current_user)):
    """Admin convenience — fires one oracle poll immediately."""
    if not await _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    return await run_once()
