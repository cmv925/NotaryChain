"""
White-Label / Embed Routes
Configuration and management of embeddable notarization widgets.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/embed", tags=["embed"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class EmbedConfigCreate(BaseModel):
    name: str
    allowed_origins: list = []
    primary_color: str = "#00d4aa"
    logo_url: Optional[str] = None
    company_name: Optional[str] = None
    document_types: list = ["power_of_attorney", "affidavit", "real_estate", "contract"]
    show_branding: bool = True
    default_notarization_type: str = "ron"


class EmbedConfigUpdate(BaseModel):
    name: Optional[str] = None
    allowed_origins: Optional[list] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    company_name: Optional[str] = None
    document_types: Optional[list] = None
    show_branding: Optional[bool] = None
    default_notarization_type: Optional[str] = None
    active: Optional[bool] = None


@router.post("/configs")
async def create_embed_config(
    body: EmbedConfigCreate,
    current_user: User = Depends(get_current_user),
):
    """Create an embed configuration for white-label integration."""
    # Check if user has API key for embed auth
    api_key = await db.api_keys.find_one({"user_id": current_user.id, "revoked": {"$ne": True}}, {"_id": 0, "key_id": 1})

    config = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "name": body.name,
        "embed_key": f"emb_{uuid.uuid4().hex[:24]}",
        "allowed_origins": body.allowed_origins,
        "primary_color": body.primary_color,
        "logo_url": body.logo_url,
        "company_name": body.company_name or current_user.full_name,
        "document_types": body.document_types,
        "show_branding": body.show_branding,
        "default_notarization_type": body.default_notarization_type,
        "active": True,
        "api_key_linked": api_key["key_id"] if api_key else None,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.embed_configs.insert_one(config)
    config.pop("_id", None)

    # Generate embed snippet
    config["embed_snippet"] = _generate_snippet(config["embed_key"])

    return config


@router.get("/configs")
async def list_embed_configs(
    current_user: User = Depends(get_current_user),
):
    """List all embed configurations for the current user."""
    configs = await db.embed_configs.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    for c in configs:
        c["embed_snippet"] = _generate_snippet(c["embed_key"])

    return {"configs": configs}


@router.get("/configs/{config_id}")
async def get_embed_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific embed configuration."""
    config = await db.embed_configs.find_one(
        {"id": config_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    config["embed_snippet"] = _generate_snippet(config["embed_key"])
    return config


@router.put("/configs/{config_id}")
async def update_embed_config(
    config_id: str,
    body: EmbedConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update an embed configuration."""
    config = await db.embed_configs.find_one(
        {"id": config_id, "user_id": current_user.id}
    )
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.embed_configs.update_one(
        {"id": config_id},
        {"$set": update_data},
    )
    return {"message": "Config updated"}


@router.delete("/configs/{config_id}")
async def delete_embed_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an embed configuration."""
    result = await db.embed_configs.delete_one(
        {"id": config_id, "user_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"message": "Config deleted"}


# Public endpoint for embed widget to fetch config
@router.get("/public/{embed_key}")
async def get_public_embed_config(embed_key: str):
    """Public endpoint for the embeddable widget to fetch its configuration."""
    config = await db.embed_configs.find_one(
        {"embed_key": embed_key, "active": True},
        {"_id": 0, "primary_color": 1, "logo_url": 1, "company_name": 1,
         "document_types": 1, "show_branding": 1, "default_notarization_type": 1,
         "embed_key": 1},
    )
    if not config:
        raise HTTPException(status_code=404, detail="Embed config not found")

    # Increment usage
    await db.embed_configs.update_one(
        {"embed_key": embed_key}, {"$inc": {"usage_count": 1}}
    )

    return config


def _generate_snippet(embed_key):
    """Generate the HTML embed snippet."""
    return f"""<!-- NotaryChain Embed Widget -->
<div id="notarychain-widget" data-key="{embed_key}"></div>
<script src="{'{REACT_APP_BACKEND_URL}'}/embed/widget.js"></script>"""
