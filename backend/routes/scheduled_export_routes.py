"""
Scheduled Export Configurations — CRUD + Multi-Tenant Cadence
==============================================================
Lets each admin / organization define its own SOC 2 / ISO audit-log export
cadence and recipient list. Configs live in `scheduled_export_configs`;
the soc2_cron_service scheduler reads + dispatches based on each row's
`next_run` timestamp.

Schema (one document per schedule):
  {
    id, owner_email, name, cadence_hours, recipients[], filters{},
    timezone, enabled, last_run, last_export_id, next_run, created_at
  }
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import uuid

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/scheduled-exports", tags=["scheduled-exports"])
db = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _next_run_after(now: datetime, cadence_hours: int) -> datetime:
    return now + timedelta(hours=max(1, cadence_hours))


@router.get("")
async def list_configs(current_user: User = Depends(get_current_user)):
    await _check_admin(current_user)
    items = []
    async for c in db.scheduled_export_configs.find({}, {"_id": 0}).sort("created_at", -1):
        items.append(c)
    return {"configs": items, "total": len(items)}


@router.post("")
async def create_config(request: Request, current_user: User = Depends(get_current_user)):
    """Create a new scheduled export config.
    Body: {name, cadence_hours, recipients:[...emails], filters?:{...}}.
    """
    await _check_admin(current_user)
    body = await request.json()
    name = (body.get("name") or "").strip()
    cadence = int(body.get("cadence_hours") or 168)
    recipients = [r.strip() for r in (body.get("recipients") or []) if r.strip()]
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient email is required")
    if cadence < 1 or cadence > 24 * 90:
        raise HTTPException(status_code=400, detail="cadence_hours must be 1–2160 (≤90d)")

    now = datetime.now(timezone.utc)
    doc = {
        "id": uuid.uuid4().hex,
        "owner_email": current_user.email,
        "name": name,
        "cadence_hours": cadence,
        "recipients": recipients,
        "filters": body.get("filters") or {},
        "enabled": True,
        "last_run": None,
        "last_export_id": None,
        "next_run": now.isoformat(),  # will fire on the next scheduler tick
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.scheduled_export_configs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{config_id}")
async def update_config(config_id: str, request: Request, current_user: User = Depends(get_current_user)):
    await _check_admin(current_user)
    body = await request.json()
    existing = await db.scheduled_export_configs.find_one({"id": config_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "name" in body: updates["name"] = body["name"]
    if "cadence_hours" in body:
        c = int(body["cadence_hours"])
        if c < 1 or c > 24 * 90:
            raise HTTPException(status_code=400, detail="cadence_hours must be 1–2160 (≤90d)")
        updates["cadence_hours"] = c
    if "recipients" in body:
        recs = [r.strip() for r in body["recipients"] if r.strip()]
        if not recs:
            raise HTTPException(status_code=400, detail="At least one recipient required")
        updates["recipients"] = recs
    if "filters" in body: updates["filters"] = body["filters"]
    if "enabled" in body: updates["enabled"] = bool(body["enabled"])
    await db.scheduled_export_configs.update_one({"id": config_id}, {"$set": updates})
    fresh = await db.scheduled_export_configs.find_one({"id": config_id}, {"_id": 0})
    return fresh


@router.delete("/{config_id}")
async def delete_config(config_id: str, current_user: User = Depends(get_current_user)):
    await _check_admin(current_user)
    res = await db.scheduled_export_configs.delete_one({"id": config_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"deleted": config_id}


@router.post("/{config_id}/run-now")
async def run_now(config_id: str, current_user: User = Depends(get_current_user)):
    """Fires the given schedule immediately, regardless of next_run."""
    await _check_admin(current_user)
    cfg = await db.scheduled_export_configs.find_one({"id": config_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    from services import soc2_cron_service
    res = await soc2_cron_service.run_for_config(cfg)
    if not res:
        raise HTTPException(status_code=400, detail="No audit rows matched in the cadence window")
    return res
