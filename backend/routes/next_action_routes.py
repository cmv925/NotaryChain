"""
Dashboard "Next Action" nudge — surfaces THE single highest-impact next step
for the current user based on three signals:

  1. Expired / soon-expiring documents (from `notarization_requests.expires_at`)
  2. Sessions awaiting their action (identity_pending, signature_pending)
  3. Notary queue (for notary primary role): pending + assigned requests
  4. Empty state → "Seal your first document"
  5. Otherwise → "You're all caught up"

Returns a single record so the UI can render a focused, decisive call-to-action.

GET /api/dashboard/next-action
"""
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from typing import Optional

from routes.auth_routes import get_current_user
from models import User

router = APIRouter(prefix="/api", tags=["dashboard"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


@router.get("/dashboard/next-action")
async def next_action(current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    user_id = current_user.id
    role = (getattr(current_user, "role", "user") or "user").lower()
    is_notary = bool(getattr(current_user, "is_notary", False)) or role == "notary"

    # ── 1. Expired / about-to-expire documents (client side) ───────────────
    expired_count = 0
    soon_expiring: Optional[dict] = None
    cursor = db.notarization_requests.find(
        {"user_id": user_id, "expires_at": {"$ne": None}},
        {"_id": 0, "id": 1, "document_name": 1, "expires_at": 1},
    )
    async for d in cursor:
        exp = _parse_iso(d.get("expires_at"))
        if not exp:
            continue
        if exp < now:
            expired_count += 1
            if soon_expiring is None or _parse_iso(soon_expiring["expires_at"]) > exp:
                soon_expiring = d
        elif (exp - now) <= timedelta(days=7):
            if soon_expiring is None:
                soon_expiring = d

    if expired_count > 0:
        label = f"{expired_count} expired document{'s' if expired_count != 1 else ''}"
        doc_name = (soon_expiring or {}).get("document_name", "your document")
        return {
            "signal_type": "expired_document",
            "priority": "high",
            "tone": "warning",
            "title": f"Renew {label}",
            "description": f"\"{doc_name}\" is overdue. Renew now to keep its chain of custody intact.",
            "cta_label": "Renew now",
            "cta_route": "/reminders",
            "count": expired_count,
        }

    # ── 2. Sessions awaiting THIS user's action ────────────────────────────
    awaiting = await db.notarization_requests.find_one(
        {
            "user_id": user_id,
            "status": {"$in": ["identity_pending", "signature_pending"]},
        },
        {"_id": 0, "id": 1, "document_name": 1, "status": 1},
        sort=[("created_at", 1)],
    )
    if awaiting:
        status_label = {
            "identity_pending": "verify your identity",
            "signature_pending": "sign the document",
        }.get(awaiting["status"], "continue your session")
        return {
            "signal_type": "awaiting_action",
            "priority": "high",
            "tone": "primary",
            "title": "Continue where you left off",
            "description": f"Your notarization \"{awaiting.get('document_name', 'session')}\" is waiting for you to {status_label}.",
            "cta_label": "Resume session",
            "cta_route": f"/session/{awaiting['id']}",
            "request_id": awaiting["id"],
        }

    # ── 3. Notary queue (notary/admin only) ─────────────────────────────────
    if is_notary or role == "admin":
        pending_count = await db.notarization_requests.count_documents({"status": "pending"})
        assigned = await db.notarization_requests.find_one(
            {"assigned_notary_id": user_id, "status": {"$in": ["assigned", "in_session"]}},
            {"_id": 0, "id": 1, "document_name": 1, "status": 1},
            sort=[("created_at", 1)],
        )
        if assigned:
            return {
                "signal_type": "notary_assigned",
                "priority": "high",
                "tone": "primary",
                "title": "Pick up your next session",
                "description": f"\"{assigned.get('document_name', 'A signer')}\" is waiting on you. Step in and run the ceremony.",
                "cta_label": "Open session",
                "cta_route": f"/session/{assigned['id']}",
                "request_id": assigned["id"],
            }
        if pending_count > 0:
            return {
                "signal_type": "notary_queue",
                "priority": "medium",
                "tone": "neutral",
                "title": f"{pending_count} request{'s' if pending_count != 1 else ''} in the queue",
                "description": "Claim one to start earning — average payout is $25 per notarization.",
                "cta_label": "View queue",
                "cta_route": "/notary/dashboard",
                "count": pending_count,
            }

    # ── 4. Soon-expiring (no expired) — gentle nudge ───────────────────────
    if soon_expiring:
        exp_dt = _parse_iso(soon_expiring["expires_at"])
        days = max(0, (exp_dt - now).days) if exp_dt else 0
        return {
            "signal_type": "expiring_soon",
            "priority": "medium",
            "tone": "warning",
            "title": f"Expires in {days} day{'s' if days != 1 else ''}",
            "description": f"\"{soon_expiring.get('document_name', 'A document')}\" will expire soon. Renew or replace it before it lapses.",
            "cta_label": "View document",
            "cta_route": "/reminders",
        }

    # ── 5. Empty-state: never sealed anything ──────────────────────────────
    seal_count = await db.document_seals.count_documents({"user_id": user_id})
    if seal_count == 0:
        return {
            "signal_type": "first_seal",
            "priority": "low",
            "tone": "primary",
            "title": "Seal your first document",
            "description": "Drop any file — we'll hash it, timestamp it on Hedera, and give you a verifiable receipt in seconds.",
            "cta_label": "Try Quick Seal",
            "cta_route": "/demo",
        }

    # ── 6. All caught up ──────────────────────────────────────────────────
    return {
        "signal_type": "all_clear",
        "priority": "info",
        "tone": "success",
        "title": "You're all caught up",
        "description": "Nothing needs your attention right now. Want to vault a new document or invite a beneficiary?",
        "cta_label": "Open Asset Vault",
        "cta_route": "/asset-vault",
    }
