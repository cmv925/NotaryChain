"""
SALV — Smart Asset Life-Cycle Vault (Phase 1 MVP)

A digital safe-deposit box for high-value, long-lived assets (deeds, titles, IP,
wills, custody agreements). Each asset has:
  • A document hash + (optional) blockchain seal reference
  • Scheduled re-verification cadence (annual, semi-annual, custom days)
  • Named beneficiaries with share % + trigger conditions
  • Dead-man's-switch at the vault level (owner check-in cadence)

Phase 1 endpoints surface CRUD + re-verification + beneficiary management +
manual handoff trigger. Background scanner is exposed as an admin sweep
endpoint (no cron yet) — Phase 2 will add a scheduler.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr

router = APIRouter(prefix="/api/salv", tags=["salv"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ────────── helpers ──────────

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


async def _emit_event(asset_id: Optional[str], vault_id: str, event_type: str, data: dict):
    await db.salv_events.insert_one({
        "event_id": uuid.uuid4().hex[:16],
        "asset_id": asset_id,
        "vault_id": vault_id,
        "type": event_type,
        "data": data,
        "created_at": _iso(_now()),
    })


# ────────── Models ──────────

ASSET_TYPES = ("deed", "title", "ip", "will", "custody", "financial", "license", "contract", "other")


class VaultCreate(BaseModel):
    name: Optional[str] = "My Asset Vault"
    dead_mans_switch_days: int = Field(default=180, ge=30, le=3650)


class VaultSettingsUpdate(BaseModel):
    name: Optional[str] = None
    dead_mans_switch_days: Optional[int] = Field(default=None, ge=30, le=3650)


class AssetCreate(BaseModel):
    asset_type: str
    title: str
    description: Optional[str] = ""
    document_hash: Optional[str] = None  # SHA256 hex of the document (links to Verify)
    document_name: Optional[str] = None
    value_estimate_usd: Optional[float] = None
    jurisdiction: Optional[str] = None
    verification_interval_days: int = Field(default=365, ge=30, le=3650)


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    document_hash: Optional[str] = None
    document_name: Optional[str] = None
    value_estimate_usd: Optional[float] = None
    jurisdiction: Optional[str] = None
    verification_interval_days: Optional[int] = Field(default=None, ge=30, le=3650)


class BeneficiaryCreate(BaseModel):
    name: str
    email: EmailStr
    relationship: Optional[str] = None
    share_percent: float = Field(ge=0, le=100)
    trigger_conditions: Optional[List[str]] = Field(
        default_factory=lambda: ["dead_mans_switch", "owner_request"]
    )


# ════════════════════════════════════════════════════════
#  VAULTS
# ════════════════════════════════════════════════════════

async def _ensure_default_vault(user) -> dict:
    vault = await db.salv_vaults.find_one({"owner_id": user["id"]}, {"_id": 0})
    if vault:
        return vault
    vault = {
        "vault_id": uuid.uuid4().hex[:16],
        "owner_id": user["id"],
        "owner_email": user["email"],
        "name": "My Asset Vault",
        "settings": {
            "dead_mans_switch_days": 180,
            "last_check_in": _iso(_now()),
        },
        "created_at": _iso(_now()),
    }
    await db.salv_vaults.insert_one(vault)
    vault.pop("_id", None)
    return vault


def _dead_mans_switch_state(vault: dict) -> dict:
    settings = vault.get("settings") or {}
    days = int(settings.get("dead_mans_switch_days", 180))
    last = settings.get("last_check_in") or vault.get("created_at")
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except Exception:
        last_dt = _now()
    expires_at = last_dt + timedelta(days=days)
    days_left = (expires_at - _now()).total_seconds() / 86400
    if days_left <= 0:
        status = "triggered"
    elif days_left <= 14:
        status = "warning"
    else:
        status = "ok"
    return {
        "status": status,
        "interval_days": days,
        "last_check_in": last,
        "expires_at": _iso(expires_at),
        "days_remaining": int(days_left),
    }


@router.get("/vault")
async def get_my_vault(request: Request):
    """Return owner's default vault (auto-created) with assets + beneficiaries summary."""
    user = await _get_user(request)
    vault = await _ensure_default_vault(user)

    assets = []
    async for a in db.salv_assets.find({"vault_id": vault["vault_id"]}, {"_id": 0}).sort("created_at", -1):
        assets.append(a)

    beneficiaries = []
    async for b in db.salv_beneficiaries.find({"vault_id": vault["vault_id"]}, {"_id": 0}).sort("created_at", -1):
        beneficiaries.append(b)

    now = _now()
    due_soon = [a for a in assets if _due_within_days(a, 30)]
    overdue = [a for a in assets if _due_within_days(a, 0)]
    total_value = sum((a.get("value_estimate_usd") or 0) for a in assets)

    return {
        "vault": vault,
        "dead_mans_switch": _dead_mans_switch_state(vault),
        "stats": {
            "assets_count": len(assets),
            "beneficiaries_count": len(beneficiaries),
            "due_soon_count": len(due_soon),
            "overdue_count": len(overdue),
            "total_estimated_value_usd": total_value,
        },
        "assets": assets,
        "beneficiaries": beneficiaries,
        "computed_at": _iso(now),
    }


@router.patch("/vault")
async def update_vault_settings(body: VaultSettingsUpdate, request: Request):
    user = await _get_user(request)
    vault = await _ensure_default_vault(user)
    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.dead_mans_switch_days is not None:
        update["settings.dead_mans_switch_days"] = body.dead_mans_switch_days
    if not update:
        return vault
    await db.salv_vaults.update_one({"vault_id": vault["vault_id"]}, {"$set": update})
    out = await db.salv_vaults.find_one({"vault_id": vault["vault_id"]}, {"_id": 0})
    return out


@router.post("/vault/check-in")
async def vault_check_in(request: Request):
    """Owner check-in resets the dead-man's-switch timer."""
    user = await _get_user(request)
    vault = await _ensure_default_vault(user)
    now_iso = _iso(_now())
    await db.salv_vaults.update_one(
        {"vault_id": vault["vault_id"]},
        {"$set": {"settings.last_check_in": now_iso}}
    )
    await _emit_event(None, vault["vault_id"], "check_in", {"by": user["email"]})
    vault["settings"]["last_check_in"] = now_iso
    return {"vault_id": vault["vault_id"], "checked_in_at": now_iso, "dead_mans_switch": _dead_mans_switch_state(vault)}


# ════════════════════════════════════════════════════════
#  ASSETS
# ════════════════════════════════════════════════════════

def _due_within_days(asset: dict, days: int) -> bool:
    nxt = asset.get("next_verification_at")
    if not nxt:
        return False
    try:
        nxt_dt = datetime.fromisoformat(nxt.replace("Z", "+00:00"))
    except Exception:
        return False
    return (nxt_dt - _now()).total_seconds() <= days * 86400


@router.post("/assets")
async def create_asset(body: AssetCreate, request: Request):
    user = await _get_user(request)
    vault = await _ensure_default_vault(user)

    if body.asset_type not in ASSET_TYPES:
        raise HTTPException(status_code=400, detail=f"asset_type must be one of {ASSET_TYPES}")
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    # Auto-link to NotaryChain seal if document_hash matches
    seal = None
    if body.document_hash:
        if len(body.document_hash) != 64:
            raise HTTPException(status_code=400, detail="document_hash must be 64-char SHA256 hex")
        seal = await db.blockchain_seals.find_one(
            {"document_hash": body.document_hash},
            {"_id": 0, "transaction_id": 1, "explorer_url": 1, "sealed_at": 1, "topic_id": 1}
        )

    now = _now()
    asset = {
        "asset_id": uuid.uuid4().hex[:16],
        "vault_id": vault["vault_id"],
        "owner_id": user["id"],
        "asset_type": body.asset_type,
        "title": title,
        "description": body.description or "",
        "document_hash": body.document_hash,
        "document_name": body.document_name,
        "blockchain_seal": seal,
        "value_estimate_usd": body.value_estimate_usd,
        "jurisdiction": body.jurisdiction,
        "verification_interval_days": body.verification_interval_days,
        "status": "active",
        "created_at": _iso(now),
        "last_verified_at": _iso(now),
        "next_verification_at": _iso(now + timedelta(days=body.verification_interval_days)),
    }
    await db.salv_assets.insert_one(asset)
    await _emit_event(asset["asset_id"], vault["vault_id"], "asset_created", {"title": title, "type": body.asset_type})
    asset.pop("_id", None)
    return asset


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your asset")

    beneficiaries = []
    async for b in db.salv_beneficiaries.find({"asset_id": asset_id}, {"_id": 0}).sort("created_at", -1):
        beneficiaries.append(b)
    events = []
    async for e in db.salv_events.find({"asset_id": asset_id}, {"_id": 0}).sort("created_at", -1).limit(50):
        events.append(e)
    return {"asset": asset, "beneficiaries": beneficiaries, "events": events}


@router.patch("/assets/{asset_id}")
async def update_asset(asset_id: str, body: AssetUpdate, request: Request):
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your asset")

    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if "verification_interval_days" in update:
        # Recompute next_verification_at from last_verified_at
        try:
            last = datetime.fromisoformat(asset["last_verified_at"].replace("Z", "+00:00"))
        except Exception:
            last = _now()
        update["next_verification_at"] = _iso(last + timedelta(days=update["verification_interval_days"]))
    if update:
        await db.salv_assets.update_one({"asset_id": asset_id}, {"$set": update})
    out = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    return out


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your asset")
    await db.salv_assets.delete_one({"asset_id": asset_id})
    await db.salv_beneficiaries.delete_many({"asset_id": asset_id})
    await _emit_event(asset_id, asset["vault_id"], "asset_deleted", {"title": asset.get("title")})
    return {"deleted": True, "asset_id": asset_id}


@router.post("/assets/{asset_id}/verify")
async def mark_asset_verified(asset_id: str, request: Request):
    """Owner attests the asset is still valid → resets re-verification timer."""
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your asset")
    now = _now()
    interval = int(asset.get("verification_interval_days", 365))
    last_verified_at = _iso(now)
    next_at = _iso(now + timedelta(days=interval))
    await db.salv_assets.update_one(
        {"asset_id": asset_id},
        {"$set": {"last_verified_at": last_verified_at, "next_verification_at": next_at}}
    )
    await _emit_event(asset_id, asset["vault_id"], "asset_re_verified", {"by": user["email"]})
    return {"asset_id": asset_id, "last_verified_at": last_verified_at, "next_verification_at": next_at}


@router.get("/due-soon")
async def list_due_soon(request: Request, days: int = 30):
    user = await _get_user(request)
    cutoff = _now() + timedelta(days=days)
    out = []
    async for a in db.salv_assets.find(
        {"owner_id": user["id"], "next_verification_at": {"$lte": _iso(cutoff)}, "status": "active"},
        {"_id": 0}
    ).sort("next_verification_at", 1):
        out.append(a)
    return {"days": days, "total": len(out), "assets": out}


# ════════════════════════════════════════════════════════
#  BENEFICIARIES
# ════════════════════════════════════════════════════════

@router.post("/assets/{asset_id}/beneficiaries")
async def add_beneficiary(asset_id: str, body: BeneficiaryCreate, request: Request):
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your asset")

    # Total share check
    existing_total = 0.0
    async for b in db.salv_beneficiaries.find({"asset_id": asset_id}, {"_id": 0, "share_percent": 1}):
        existing_total += float(b.get("share_percent") or 0)
    if existing_total + body.share_percent > 100:
        raise HTTPException(status_code=400, detail=f"Total share cannot exceed 100% (current {existing_total:.0f}%)")

    benef = {
        "beneficiary_id": uuid.uuid4().hex[:16],
        "asset_id": asset_id,
        "vault_id": asset["vault_id"],
        "owner_id": user["id"],
        "name": body.name.strip(),
        "email": body.email.lower(),
        "relationship": body.relationship,
        "share_percent": float(body.share_percent),
        "trigger_conditions": body.trigger_conditions or [],
        "status": "pending",
        "created_at": _iso(_now()),
    }
    await db.salv_beneficiaries.insert_one(benef)
    await _emit_event(asset_id, asset["vault_id"], "beneficiary_added", {"beneficiary": body.name, "share": body.share_percent})
    benef.pop("_id", None)
    return benef


@router.delete("/beneficiaries/{beneficiary_id}")
async def delete_beneficiary(beneficiary_id: str, request: Request):
    user = await _get_user(request)
    b = await db.salv_beneficiaries.find_one({"beneficiary_id": beneficiary_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    if b["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your beneficiary")
    await db.salv_beneficiaries.delete_one({"beneficiary_id": beneficiary_id})
    await _emit_event(b.get("asset_id"), b["vault_id"], "beneficiary_removed", {"beneficiary": b.get("name")})
    return {"deleted": True, "beneficiary_id": beneficiary_id}


# ════════════════════════════════════════════════════════
#  HANDOFF
# ════════════════════════════════════════════════════════

@router.post("/assets/{asset_id}/trigger-handoff")
async def trigger_handoff(asset_id: str, request: Request):
    """Owner manually triggers handoff (e.g., transferring ownership pre-emptively)."""
    user = await _get_user(request)
    asset = await db.salv_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    beneficiaries = []
    async for b in db.salv_beneficiaries.find({"asset_id": asset_id}, {"_id": 0}):
        beneficiaries.append(b)
    if not beneficiaries:
        raise HTTPException(status_code=400, detail="No beneficiaries configured")

    handoff_id = uuid.uuid4().hex[:16]
    await db.salv_assets.update_one(
        {"asset_id": asset_id},
        {"$set": {"status": "handoff_in_progress", "handoff_id": handoff_id, "handoff_started_at": _iso(_now())}}
    )
    await db.salv_beneficiaries.update_many(
        {"asset_id": asset_id, "status": "pending"},
        {"$set": {"status": "notified", "notified_at": _iso(_now())}}
    )
    await _emit_event(
        asset_id, asset["vault_id"], "handoff_triggered",
        {"handoff_id": handoff_id, "beneficiaries": [b["email"] for b in beneficiaries], "by": user["email"]}
    )
    return {
        "handoff_id": handoff_id,
        "asset_id": asset_id,
        "status": "handoff_in_progress",
        "beneficiaries_notified": len(beneficiaries),
    }


@router.post("/admin/scan")
async def admin_scan(request: Request):
    """Admin sweep: flag overdue assets + warn dead-man's-switch + emit events."""
    user = await _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    now = _now()
    overdue_count = 0
    warned_count = 0
    triggered_count = 0

    async for a in db.salv_assets.find({"status": "active"}, {"_id": 0}):
        if _due_within_days(a, 0):
            overdue_count += 1
            await _emit_event(a["asset_id"], a["vault_id"], "asset_overdue", {"title": a.get("title")})

    async for v in db.salv_vaults.find({}, {"_id": 0}):
        st = _dead_mans_switch_state(v)
        if st["status"] == "warning":
            warned_count += 1
            await _emit_event(None, v["vault_id"], "dead_mans_switch_warning", st)
        elif st["status"] == "triggered":
            triggered_count += 1
            await _emit_event(None, v["vault_id"], "dead_mans_switch_triggered", st)

    return {
        "scanned_at": _iso(now),
        "overdue_assets": overdue_count,
        "dead_mans_warnings": warned_count,
        "dead_mans_triggered": triggered_count,
    }
