"""
Infrastructure Status & Management Routes
Exposes cache stats, storage status, job manager stats, and Sentry status
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from services.cache_service import cache_service
from services.storage_service import storage_service
from services.task_manager import task_manager
import os

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/status")
async def get_infrastructure_status(
    current_user: User = Depends(get_current_user)
):
    """Get infrastructure health overview (any authenticated user)"""
    sentry_configured = bool(os.environ.get("SENTRY_DSN"))

    return {
        "cache": cache_service.stats(),
        "storage": storage_service.status(),
        "jobs": task_manager.stats(),
        "sentry": {
            "configured": sentry_configured,
            "dsn_set": sentry_configured,
            "environment": os.environ.get("ENVIRONMENT", "development"),
        },
        "infrastructure_version": "1.1.0",
    }


@router.post("/cache/clear")
async def clear_cache(
    current_user: User = Depends(get_current_user)
):
    """Clear all caches (admin only)"""
    await _check_admin(current_user)
    cache_service.clear_all()
    return {"success": True, "message": "All caches cleared"}


@router.post("/cache/clear/{namespace}")
async def clear_cache_namespace(
    namespace: str,
    current_user: User = Depends(get_current_user)
):
    """Clear a specific cache namespace (admin only)"""
    await _check_admin(current_user)
    cache_service.clear_namespace(namespace)
    return {"success": True, "message": f"Cache namespace '{namespace}' cleared"}
