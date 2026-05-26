"""
Idempotent admin user seed — runs on backend startup.

Guarantees that production deployments always have a known admin account.
Safe to call repeatedly: never overwrites an existing admin's password.

Env vars:
- ADMIN_SEED_EMAIL    (default: "admin@notarychain.com")
- ADMIN_SEED_PASSWORD (default: "Admin123!")  — only used on first create
- ADMIN_SEED_NAME     (default: "Platform Admin")
- ADMIN_SEED_DISABLED ("true" to skip seeding entirely)
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone

from passlib.context import CryptContext

logger = logging.getLogger(__name__)
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin_user(db) -> dict:
    """Ensure a known admin user exists. Idempotent.

    Behaviour:
      - If user does NOT exist  → CREATE with bcrypt-hashed seed password.
      - If user exists & role=admin → no-op (we never overwrite a real admin's password).
      - If user exists & role!=admin → PROMOTE to role=admin (password untouched).

    Returns a dict describing what happened (for startup logs).
    """
    if os.environ.get("ADMIN_SEED_DISABLED", "").lower() == "true":
        logger.info("[admin_seed] disabled via ADMIN_SEED_DISABLED env var")
        return {"action": "skipped", "reason": "disabled"}

    email = os.environ.get("ADMIN_SEED_EMAIL", "admin@notarychain.com").strip().lower()
    initial_password = os.environ.get("ADMIN_SEED_PASSWORD", "Admin123!")
    full_name = os.environ.get("ADMIN_SEED_NAME", "Platform Admin")

    existing = await db.users.find_one({"email": email})

    if existing is None:
        # First-time create
        admin_doc = {
            "id": f"admin_{uuid.uuid4().hex[:12]}",
            "email": email,
            "full_name": full_name,
            "hashed_password": _pwd_context.hash(initial_password),
            "role": "admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        }
        try:
            await db.users.insert_one(admin_doc)
            logger.info(f"[admin_seed] created admin user · email={email}")
            return {"action": "created", "email": email}
        except Exception as e:
            # Race condition on parallel workers — another worker beat us; treat as no-op.
            logger.info(f"[admin_seed] insert race resolved · {e}")
            return {"action": "race-noop", "email": email}

    if existing.get("role") == "admin":
        logger.info(f"[admin_seed] admin already exists · email={email} (no changes)")
        return {"action": "exists", "email": email}

    # User exists but is NOT admin — promote them, leave password alone.
    await db.users.update_one(
        {"email": email},
        {"$set": {"role": "admin", "status": "active", "updated_at": datetime.now(timezone.utc)}},
    )
    logger.warning(
        f"[admin_seed] PROMOTED existing user to admin · email={email} · prior_role={existing.get('role')}"
    )
    return {"action": "promoted", "email": email, "prior_role": existing.get("role")}
