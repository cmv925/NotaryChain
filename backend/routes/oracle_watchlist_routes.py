"""
Routes for admin-managed Oracle watchlists.
"""
from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import User
from routes.auth_routes import get_current_user
from services import oracle_watchlist_service

router = APIRouter(prefix="/api/admin/oracle-watchlists", tags=["admin", "oracle"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _require_admin(user: User) -> User:
    """Verify user is admin by re-checking their DB record (JWT role claim is not authoritative)."""
    user_doc = await db.users.find_one({"email": user.email}, {"role": 1, "_id": 0})
    if not user_doc or (user_doc.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class WatchlistCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    jurisdictions: List[str] = Field(default_factory=lambda: ["*"])
    severity_floor: str = Field(default="low")
    auto_applied_only: bool = False
    email_enabled: bool = True
    slack_webhook_url: Optional[str] = None


class WatchlistUpdate(BaseModel):
    label: Optional[str] = None
    jurisdictions: Optional[List[str]] = None
    severity_floor: Optional[str] = None
    auto_applied_only: Optional[bool] = None
    enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    slack_webhook_url: Optional[str] = None


@router.get("")
async def list_my_watchlists(current_user: User = Depends(get_current_user)):
    await _require_admin(current_user)
    return await oracle_watchlist_service.list_watchlists(current_user.email)


@router.post("")
async def create(body: WatchlistCreate, current_user: User = Depends(get_current_user)):
    await _require_admin(current_user)
    try:
        return await oracle_watchlist_service.create_watchlist(
            admin_email=current_user.email,
            label=body.label,
            jurisdictions=body.jurisdictions,
            severity_floor=body.severity_floor,
            auto_applied_only=body.auto_applied_only,
            email_enabled=body.email_enabled,
            slack_webhook_url=body.slack_webhook_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{watchlist_id}")
async def update(watchlist_id: str, body: WatchlistUpdate,
                 current_user: User = Depends(get_current_user)):
    await _require_admin(current_user)
    fields: dict = {}
    if body.label is not None:
        fields["label"] = body.label
    if body.jurisdictions is not None:
        fields["jurisdictions"] = body.jurisdictions
    if body.severity_floor is not None:
        fields["severity_floor"] = body.severity_floor
    if body.auto_applied_only is not None:
        fields["auto_applied_only"] = body.auto_applied_only
    if body.enabled is not None:
        fields["enabled"] = body.enabled
    # channels are nested; load existing → merge → save
    if body.email_enabled is not None or body.slack_webhook_url is not None:
        existing_list = await oracle_watchlist_service.list_watchlists(current_user.email)
        existing = next((w for w in existing_list if w["id"] == watchlist_id), None)
        if not existing:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        ch = existing.get("channels") or {}
        if body.email_enabled is not None:
            ch["email"] = bool(body.email_enabled)
        if body.slack_webhook_url is not None:
            ch["slack_webhook_url"] = body.slack_webhook_url or None
        fields["channels"] = ch
    result = await oracle_watchlist_service.update_watchlist(
        watchlist_id, current_user.email, fields
    )
    if not result:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return result


@router.delete("/{watchlist_id}")
async def delete(watchlist_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin(current_user)
    ok = await oracle_watchlist_service.delete_watchlist(watchlist_id, current_user.email)
    if not ok:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return {"deleted": True, "id": watchlist_id}


@router.post("/{watchlist_id}/test")
async def test_send(watchlist_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin(current_user)
    return await oracle_watchlist_service.send_test_alert(watchlist_id, current_user.email)
