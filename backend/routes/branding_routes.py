"""
Custom Branding Routes
Organization-level branding: logo, colors, display name.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user
from services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/branding", tags=["branding"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class BrandingUpdate(BaseModel):
    display_name: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    tagline: Optional[str] = None


@router.get("/")
async def get_branding(current_user: User = Depends(get_current_user)):
    """Get the branding settings for the user's organization."""
    org = await db.organizations.find_one(
        {"members.user_id": current_user.id}, {"_id": 0}
    )
    org_id = org["id"] if org else current_user.id

    branding = await db.branding_configs.find_one(
        {"owner_id": org_id}, {"_id": 0}
    )
    return branding or {
        "owner_id": org_id,
        "display_name": "",
        "primary_color": "#00d4aa",
        "accent_color": "#0ea5e9",
        "tagline": "",
        "logo_url": None,
    }


@router.put("/")
async def update_branding(
    body: BrandingUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update branding settings."""
    org = await db.organizations.find_one(
        {"members.user_id": current_user.id}, {"_id": 0}
    )
    org_id = org["id"] if org else current_user.id

    update = {k: v for k, v in body.dict().items() if v is not None}
    update["owner_id"] = org_id
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.branding_configs.update_one(
        {"owner_id": org_id},
        {"$set": update},
        upsert=True,
    )
    return {"success": True}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a custom logo."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    org = await db.organizations.find_one(
        {"members.user_id": current_user.id}, {"_id": 0}
    )
    org_id = org["id"] if org else current_user.id

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"logo_{org_id}.{ext}"

    content = await file.read()
    storage_meta = await storage_service.upload(content, filename, folder="branding")

    logo_url = f"/api/branding/logo/{filename}"
    await db.branding_configs.update_one(
        {"owner_id": org_id},
        {"$set": {
            "logo_url": logo_url,
            "logo_storage_path": storage_meta["path"],
            "logo_storage_backend": storage_meta["storage_backend"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"logo_url": logo_url}


@router.get("/logo/{filename}")
async def serve_logo(filename: str):
    """Serve a logo file."""
    # Look up storage metadata
    branding = await db.branding_configs.find_one(
        {"logo_url": f"/api/branding/logo/{filename}"},
        {"_id": 0, "logo_storage_path": 1, "logo_storage_backend": 1}
    )

    backend = branding.get("logo_storage_backend", "local") if branding else "local"
    stored_path = branding.get("logo_storage_path", filename) if branding else filename

    if backend == "s3":
        url = storage_service.get_presigned_url(stored_path)
        if url:
            return RedirectResponse(url=url, status_code=307)

    local_path = await storage_service.get_file_path(stored_path, backend)
    if not local_path:
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(local_path, headers={"Content-Disposition": f"attachment; filename={filename}"})
