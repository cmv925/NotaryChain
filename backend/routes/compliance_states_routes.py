"""
Multi-State Compliance-as-a-Service routes.

Exposes the state RON abstracts publicly for the comparison landing page
and per-state pages. Admins can use the same data + state_compliance_profiles
collection to track our operational status per state.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import logging

from data.state_compliance_abstracts import (
    STATE_ABSTRACTS, get_state, list_states, comparison_matrix,
)
from routes.auth_routes import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


@router.get("/states")
async def public_list_states():
    """Public list of all supported states with summary fields only."""
    states = []
    for s in list_states():
        states.append({
            "code": s["code"],
            "name": s["name"],
            "statute": s["statute"],
            "statute_url": s.get("statute_url"),
            "ron_status": s["ron_status"],
            "effective_date": s["effective_date"],
            "platform_status": s["platform_status"],
            "registration_required": s["registration"]["required"],
            "key_gates_count": len(s["key_gates"]),
            "highlights": s.get("highlights", [])[:2],
        })
    return {"states": states}


@router.get("/states/comparison")
async def public_state_comparison():
    """Side-by-side gate matrix for the public comparison page."""
    return {
        "states": [{"code": s["code"], "name": s["name"], "ron_status": s["ron_status"], "platform_status": s["platform_status"]} for s in list_states()],
        "matrix": comparison_matrix(),
    }


@router.get("/states/{code}")
async def public_state_detail(code: str):
    """Full abstract for a single state."""
    st = get_state(code)
    if not st:
        raise HTTPException(status_code=404, detail=f"No abstract published for state '{code}'")
    return st


@router.get("/admin/status-matrix")
async def admin_status_matrix(current_user: User = Depends(get_current_user)):
    """Admin: combines static abstracts with live state_compliance_profiles."""
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "role": 1})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    profiles = {}
    async for p in db.state_compliance_profiles.find({}, {"_id": 0}):
        profiles[p.get("state_code")] = p

    rows = []
    for s in list_states():
        live = profiles.get(s["code"], {})
        rows.append({
            "code": s["code"],
            "name": s["name"],
            "ron_status": s["ron_status"],
            "platform_status": s["platform_status"],
            "registration_required": s["registration"]["required"],
            "live_in_state": live.get("live_in_state", False),
            "ronsp_status": (live.get("ronsp_registration") or {}).get("status"),
            "ronsp_filed_at": (live.get("ronsp_registration") or {}).get("filed_at"),
            "highlights": s.get("highlights", []),
        })
    return {"rows": rows}
