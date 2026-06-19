"""
Sovereign ID routes — mint/view the holder's identity credential + public verify.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

from models import User
from routes.auth_routes import get_current_user
from services import sovereign_id_service as svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sovereign", tags=["sovereign-id"])
public_router = APIRouter(prefix="/api/sovereign", tags=["sovereign-id-public"])

db = None


def set_db(database):
    global db
    db = database


async def _identity_ok(user: User) -> tuple[bool, bool]:
    """Returns (allowed_to_mint, identity_verified). Notaries/admins are
    inherently verified; regular users must have completed identity proofing."""
    doc = await db.users.find_one({"id": user.id}, {"role": 1, "identity_verified": 1}) or {}
    role = doc.get("role", "user")
    verified = bool(doc.get("identity_verified"))
    if role in ("admin", "notary"):
        return True, True
    return verified, verified


@router.get("/me")
async def my_sovereign_id(current_user: User = Depends(get_current_user)):
    card = await svc.get_my_sovereign_id(db, current_user.id)
    _, verified = await _identity_ok(current_user)
    return {"minted": card is not None, "identity_verified": verified, "card": card}


class MintRequest(BaseModel):
    pass


@router.post("/mint")
async def mint(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    allowed, _ = await _identity_ok(current_user)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Complete identity verification to claim your Sovereign ID.",
        )
    card = await svc.mint_sovereign_id(db, current_user.id, current_user.full_name, True)
    # Anchor on Hedera HCS out-of-band so the request returns instantly.
    if card and card.get("anchor_status") == "pending":
        background_tasks.add_task(svc.anchor_sovereign_id, db, card["sovereign_id"])
    return {"minted": True, "card": card}


@public_router.get("/verify/{sovereign_id}")
async def verify(sovereign_id: str):
    return await svc.verify_sovereign_id(db, sovereign_id)
