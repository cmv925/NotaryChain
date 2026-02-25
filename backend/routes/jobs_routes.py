"""
Background Jobs API Routes
Monitor and manage background task execution
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from models import User
from routes.auth_routes import get_current_user
from services.task_manager import task_manager

router = APIRouter(prefix="/api/jobs", tags=["background-jobs"])


@router.get("/")
async def list_jobs(
    job_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """List recent background jobs"""
    return {"jobs": task_manager.get_user_jobs(job_type)}


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get status of a specific background job"""
    job = task_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
