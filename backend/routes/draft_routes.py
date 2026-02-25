"""
Template Drafts & Sharing
Save filled templates as drafts, share via link, track revisions.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import secrets
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drafts", tags=["drafts"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class SaveDraftRequest(BaseModel):
    template_id: str
    template_name: str
    field_values: Dict[str, str]
    name: Optional[str] = None

class UpdateDraftRequest(BaseModel):
    field_values: Dict[str, str]
    name: Optional[str] = None

class ShareDraftRequest(BaseModel):
    allow_edit: bool = False


@router.post("/")
async def save_draft(body: SaveDraftRequest, current_user: dict = Depends(get_current_user)):
    """Save a new draft from filled template fields."""
    now = datetime.now(timezone.utc).isoformat()
    draft_id = str(uuid.uuid4())

    draft = {
        "id": draft_id,
        "user_id": current_user.id,
        "user_email": current_user.email,
        "template_id": body.template_id,
        "template_name": body.template_name,
        "name": body.name or f"{body.template_name} - Draft",
        "field_values": body.field_values,
        "version": 1,
        "status": "draft",
        "share_token": None,
        "share_allow_edit": False,
        "created_at": now,
        "updated_at": now,
        "revisions": [{
            "version": 1,
            "field_values": body.field_values,
            "saved_by": current_user.email,
            "saved_at": now,
        }],
    }
    await db.template_drafts.insert_one(draft)
    draft.pop("_id", None)
    return draft


@router.get("/")
async def list_my_drafts(current_user: dict = Depends(get_current_user)):
    """List current user's drafts."""
    drafts = await db.template_drafts.find(
        {"user_id": current_user.id},
        {"_id": 0, "revisions": 0}
    ).sort("updated_at", -1).to_list(100)
    return {"drafts": drafts}


@router.get("/{draft_id}")
async def get_draft(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Get a draft by ID (owner or shared access)."""
    draft = await db.template_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return draft


@router.put("/{draft_id}")
async def update_draft(draft_id: str, body: UpdateDraftRequest, current_user: dict = Depends(get_current_user)):
    """Update a draft (auto-increment version, save revision)."""
    draft = await db.template_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc).isoformat()
    new_version = draft["version"] + 1
    revision = {
        "version": new_version,
        "field_values": body.field_values,
        "saved_by": current_user.email,
        "saved_at": now,
    }

    update = {
        "$set": {
            "field_values": body.field_values,
            "version": new_version,
            "updated_at": now,
        },
        "$push": {"revisions": revision},
    }
    if body.name:
        update["$set"]["name"] = body.name

    await db.template_drafts.update_one({"id": draft_id}, update)

    updated = await db.template_drafts.find_one({"id": draft_id}, {"_id": 0})
    return updated


@router.delete("/{draft_id}")
async def delete_draft(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a draft."""
    draft = await db.template_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.template_drafts.delete_one({"id": draft_id})
    return {"message": "Draft deleted"}


# --- Sharing ---

@router.post("/{draft_id}/share")
async def share_draft(draft_id: str, body: ShareDraftRequest, current_user: dict = Depends(get_current_user)):
    """Generate a share link for a draft."""
    draft = await db.template_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    share_token = secrets.token_urlsafe(24)
    await db.template_drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "share_token": share_token,
            "share_allow_edit": body.allow_edit,
        }}
    )

    return {"share_token": share_token, "allow_edit": body.allow_edit}


@router.delete("/{draft_id}/share")
async def revoke_share(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke share link for a draft."""
    draft = await db.template_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.template_drafts.update_one(
        {"id": draft_id},
        {"$set": {"share_token": None, "share_allow_edit": False}}
    )
    return {"message": "Share link revoked"}


@router.get("/shared/{share_token}")
async def get_shared_draft(share_token: str, current_user: dict = Depends(get_current_user)):
    """Access a shared draft via share token."""
    draft = await db.template_drafts.find_one(
        {"share_token": share_token},
        {"_id": 0}
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Shared draft not found or link expired")

    # Return without full revision history for shared access
    return {
        "id": draft["id"],
        "template_id": draft["template_id"],
        "template_name": draft["template_name"],
        "name": draft["name"],
        "field_values": draft["field_values"],
        "version": draft["version"],
        "owner_email": draft["user_email"],
        "allow_edit": draft["share_allow_edit"],
        "updated_at": draft["updated_at"],
    }


@router.put("/shared/{share_token}")
async def update_shared_draft(share_token: str, body: UpdateDraftRequest, current_user: dict = Depends(get_current_user)):
    """Update a shared draft (if editing is allowed)."""
    draft = await db.template_drafts.find_one({"share_token": share_token})
    if not draft:
        raise HTTPException(status_code=404, detail="Shared draft not found")

    if not draft.get("share_allow_edit"):
        raise HTTPException(status_code=403, detail="Editing not allowed for this shared draft")

    now = datetime.now(timezone.utc).isoformat()
    new_version = draft["version"] + 1
    revision = {
        "version": new_version,
        "field_values": body.field_values,
        "saved_by": current_user.email,
        "saved_at": now,
    }

    await db.template_drafts.update_one(
        {"share_token": share_token},
        {
            "$set": {
                "field_values": body.field_values,
                "version": new_version,
                "updated_at": now,
            },
            "$push": {"revisions": revision},
        }
    )

    return {"message": "Draft updated", "version": new_version}


# --- Revisions ---

@router.get("/{draft_id}/revisions")
async def get_revisions(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Get revision history for a draft."""
    draft = await db.template_drafts.find_one({"id": draft_id}, {"_id": 0, "revisions": 1, "user_id": 1})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {"revisions": draft.get("revisions", [])}


@router.post("/{draft_id}/revisions/{version}/restore")
async def restore_revision(draft_id: str, version: int, current_user: dict = Depends(get_current_user)):
    """Restore a draft to a specific revision."""
    draft = await db.template_drafts.find_one({"id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    revision = next((r for r in draft.get("revisions", []) if r["version"] == version), None)
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")

    now = datetime.now(timezone.utc).isoformat()
    new_version = draft["version"] + 1
    restore_revision = {
        "version": new_version,
        "field_values": revision["field_values"],
        "saved_by": current_user.email,
        "saved_at": now,
    }

    await db.template_drafts.update_one(
        {"id": draft_id},
        {
            "$set": {
                "field_values": revision["field_values"],
                "version": new_version,
                "updated_at": now,
            },
            "$push": {"revisions": restore_revision},
        }
    )

    return {"message": f"Restored to version {version}", "new_version": new_version}
