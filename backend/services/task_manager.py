"""
Background Task Manager
Track and manage async background jobs with status reporting
"""

import logging
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional, Callable, Any
from enum import Enum

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundTaskManager:
    """Manages background jobs with status tracking"""

    def __init__(self):
        self.jobs: Dict[str, dict] = {}
        self._max_history = 200  # Keep last N completed jobs

    def create_job(self, job_type: str, description: str = "", metadata: dict = None) -> str:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "id": job_id,
            "type": job_type,
            "description": description,
            "status": JobStatus.PENDING,
            "progress": 0,
            "result": None,
            "error": None,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
        }
        self._cleanup_old_jobs()
        return job_id

    def start_job(self, job_id: str):
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = JobStatus.RUNNING
            self.jobs[job_id]["started_at"] = datetime.now(timezone.utc).isoformat()

    def update_progress(self, job_id: str, progress: int, message: str = None):
        if job_id in self.jobs:
            self.jobs[job_id]["progress"] = min(100, max(0, progress))
            if message:
                self.jobs[job_id]["description"] = message

    def complete_job(self, job_id: str, result: Any = None):
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = JobStatus.COMPLETED
            self.jobs[job_id]["progress"] = 100
            self.jobs[job_id]["result"] = result
            self.jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    def fail_job(self, job_id: str, error: str):
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = JobStatus.FAILED
            self.jobs[job_id]["error"] = error
            self.jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    def get_job(self, job_id: str) -> Optional[dict]:
        return self.jobs.get(job_id)

    def get_user_jobs(self, job_type: str = None) -> list:
        jobs = list(self.jobs.values())
        if job_type:
            jobs = [j for j in jobs if j["type"] == job_type]
        return sorted(jobs, key=lambda j: j["created_at"], reverse=True)[:50]

    def _cleanup_old_jobs(self):
        if len(self.jobs) > self._max_history:
            completed = sorted(
                [(jid, j) for jid, j in self.jobs.items() if j["status"] in (JobStatus.COMPLETED, JobStatus.FAILED)],
                key=lambda x: x[1]["created_at"]
            )
            to_remove = len(self.jobs) - self._max_history
            for jid, _ in completed[:to_remove]:
                del self.jobs[jid]

    async def run_async(self, job_id: str, coro: Callable):
        """Run an async coroutine as a tracked background job"""
        self.start_job(job_id)
        try:
            result = await coro
            self.complete_job(job_id, result)
            return result
        except Exception as e:
            self.fail_job(job_id, str(e))
            logger.error(f"Background job {job_id} failed: {e}")
            raise


# Singleton
task_manager = BackgroundTaskManager()
