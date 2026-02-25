"""
Infrastructure Status & Management Routes
Exposes cache stats, storage status, job manager stats, and Sentry status
"""

from fastapi import APIRouter, Depends
from models import User
from routes.auth_routes import get_current_user
from services.cache_service import cache_service
from services.storage_service import storage_service
from services.task_manager import task_manager
import os

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])


@router.get("/status")
async def get_infrastructure_status(
    current_user: User = Depends(get_current_user)
):
    """Get infrastructure health overview (admin or any authenticated user)"""
    sentry_configured = bool(os.environ.get("SENTRY_DSN"))
    s3_configured = bool(os.environ.get("AWS_S3_BUCKET") and os.environ.get("AWS_ACCESS_KEY_ID"))

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
    if current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    cache_service.clear_all()
    return {"success": True, "message": "All caches cleared"}


@router.post("/cache/clear/{namespace}")
async def clear_cache_namespace(
    namespace: str,
    current_user: User = Depends(get_current_user)
):
    """Clear a specific cache namespace (admin only)"""
    if current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    cache_service.clear_namespace(namespace)
    return {"success": True, "message": f"Cache namespace '{namespace}' cleared"}
