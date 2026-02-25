"""
Background Task Manager (Enhanced)
Track and manage async background jobs with retry, priority, timeout, and structured logging
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
    RETRYING = "retrying"


class JobPriority(int, Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class BackgroundTaskManager:
    """Manages background jobs with status tracking, retry logic, and timeout handling."""

    def __init__(self):
        self.jobs: Dict[str, dict] = {}
        self._max_history = 200
        self._default_max_retries = 3
        self._default_timeout = 300  # 5 min

    def create_job(
        self,
        job_type: str,
        description: str = "",
        metadata: dict = None,
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = None,
        timeout: int = None,
    ) -> str:
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
            "priority": priority,
            "retry_count": 0,
            "max_retries": max_retries if max_retries is not None else self._default_max_retries,
            "timeout": timeout or self._default_timeout,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
        }
        self._cleanup_old_jobs()
        logger.info(f"Job created: {job_id} type={job_type} priority={priority}")
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
            logger.info(f"Job completed: {job_id}")

    def fail_job(self, job_id: str, error: str):
        if job_id in self.jobs:
            job = self.jobs[job_id]
            job["error"] = error

            if job["retry_count"] < job["max_retries"]:
                job["status"] = JobStatus.RETRYING
                job["retry_count"] += 1
                logger.warning(f"Job {job_id} failed (attempt {job['retry_count']}/{job['max_retries']}): {error}")
                return True  # Indicates retry should happen
            else:
                job["status"] = JobStatus.FAILED
                job["completed_at"] = datetime.now(timezone.utc).isoformat()
                logger.error(f"Job {job_id} permanently failed after {job['retry_count']} retries: {error}")
                return False  # No more retries

    def get_job(self, job_id: str) -> Optional[dict]:
        return self.jobs.get(job_id)

    def get_user_jobs(self, job_type: str = None, status: str = None) -> list:
        jobs = list(self.jobs.values())
        if job_type:
            jobs = [j for j in jobs if j["type"] == job_type]
        if status:
            jobs = [j for j in jobs if j["status"] == status]
        return sorted(jobs, key=lambda j: (j.get("priority", 1), j["created_at"]), reverse=True)[:50]

    def _cleanup_old_jobs(self):
        if len(self.jobs) > self._max_history:
            completed = sorted(
                [(jid, j) for jid, j in self.jobs.items() if j["status"] in (JobStatus.COMPLETED, JobStatus.FAILED)],
                key=lambda x: x[1]["created_at"]
            )
            to_remove = len(self.jobs) - self._max_history
            for jid, _ in completed[:to_remove]:
                del self.jobs[jid]

    async def run_async(self, job_id: str, coro_factory: Callable, *args, **kwargs):
        """Run an async callable as a tracked background job with retry and timeout.

        Args:
            job_id: The tracked job ID
            coro_factory: An async function (NOT an awaitable) that will be called on each attempt
        """
        job = self.jobs.get(job_id)
        if not job:
            return

        while True:
            self.start_job(job_id)
            try:
                result = await asyncio.wait_for(
                    coro_factory(*args, **kwargs),
                    timeout=job["timeout"],
                )
                self.complete_job(job_id, result)
                return result
            except asyncio.TimeoutError:
                should_retry = self.fail_job(job_id, f"Timed out after {job['timeout']}s")
                if not should_retry:
                    return None
                await asyncio.sleep(min(2 ** job["retry_count"], 30))  # Exponential backoff
            except Exception as e:
                should_retry = self.fail_job(job_id, str(e))
                if not should_retry:
                    return None
                await asyncio.sleep(min(2 ** job["retry_count"], 30))

    def stats(self) -> dict:
        status_counts = {}
        for j in self.jobs.values():
            s = j["status"]
            status_counts[s] = status_counts.get(s, 0) + 1
        return {
            "total_jobs": len(self.jobs),
            "by_status": status_counts,
            "max_history": self._max_history,
        }


# Singleton
task_manager = BackgroundTaskManager()
