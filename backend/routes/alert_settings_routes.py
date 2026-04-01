"""
Alert Settings Routes
Admin-configurable HBAR alert thresholds, check intervals, and notification preferences.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/ops", tags=["alert-settings"])

db: AsyncIOMotorDatabase = None

DEFAULTS = {
    "check_interval_minutes": 30,
    "cooldown_hours": 24,
    "email_alerts_enabled": True,
    "in_app_alerts_enabled": True,
    "thresholds": [
        {"hbar": 50, "level": "warning", "label": "getting low", "enabled": True},
        {"hbar": 10, "level": "critical", "label": "critically low — service interruption risk", "enabled": True},
        {"hbar": 1, "level": "emergency", "label": "nearly empty — immediate action required", "enabled": True},
    ],
}


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


class ThresholdItem(BaseModel):
    hbar: float
    level: str
    label: str
    enabled: bool = True


class AlertSettingsUpdate(BaseModel):
    check_interval_minutes: Optional[int] = None
    cooldown_hours: Optional[int] = None
    email_alerts_enabled: Optional[bool] = None
    in_app_alerts_enabled: Optional[bool] = None
    thresholds: Optional[List[ThresholdItem]] = None


async def get_settings_from_db():
    """Fetch alert settings from DB, falling back to defaults."""
    doc = await db.system_settings.find_one({"key": "hbar_alert_settings"}, {"_id": 0})
    if doc:
        return {k: doc.get(k, DEFAULTS[k]) for k in DEFAULTS}
    return dict(DEFAULTS)


@router.get("/alert-settings")
async def get_alert_settings(current_user: User = Depends(get_current_user)):
    """Get current HBAR alert settings."""
    await _check_admin(current_user)
    settings = await get_settings_from_db()
    return settings


@router.put("/alert-settings")
async def update_alert_settings(body: AlertSettingsUpdate, current_user: User = Depends(get_current_user)):
    """Update HBAR alert settings."""
    await _check_admin(current_user)

    updates = {}
    if body.check_interval_minutes is not None:
        if body.check_interval_minutes < 5 or body.check_interval_minutes > 1440:
            raise HTTPException(status_code=400, detail="Check interval must be between 5 and 1440 minutes")
        updates["check_interval_minutes"] = body.check_interval_minutes
    if body.cooldown_hours is not None:
        if body.cooldown_hours < 1 or body.cooldown_hours > 168:
            raise HTTPException(status_code=400, detail="Cooldown must be between 1 and 168 hours")
        updates["cooldown_hours"] = body.cooldown_hours
    if body.email_alerts_enabled is not None:
        updates["email_alerts_enabled"] = body.email_alerts_enabled
    if body.in_app_alerts_enabled is not None:
        updates["in_app_alerts_enabled"] = body.in_app_alerts_enabled
    if body.thresholds is not None:
        updates["thresholds"] = [t.dict() for t in body.thresholds]

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = current_user.email

    await db.system_settings.update_one(
        {"key": "hbar_alert_settings"},
        {"$set": {**updates, "key": "hbar_alert_settings"}},
        upsert=True,
    )

    # Notify the alert service to reload settings
    from services import hbar_alert_service
    await hbar_alert_service.reload_settings()

    settings = await get_settings_from_db()
    return {"message": "Alert settings updated", **settings}
