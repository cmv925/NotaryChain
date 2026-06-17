"""
MongoDB-backed leader election for cluster-wide singleton background work.

Emergent's deployment guarantees only ONE shared datastore across pods: MongoDB.
When the backend runs as multiple replicas, every pod would otherwise start the
same cron-style schedulers (reminders, PCV, SOC2 export, ACN oracle, …) and run
them N times. This module lets exactly ONE pod ("the leader") own those jobs.

How it works:
  • Each pod has a unique INSTANCE_ID (uuid generated at import time).
  • A single document in `scheduler_locks` (key="schedulers") holds the current
    leader's instance_id + an `expires_at` timestamp.
  • acquire_leadership() succeeds if the lock is free, expired, or already ours.
  • A heartbeat loop renews the lease while we hold it; if the leader pod dies,
    the lease expires and another pod takes over within ~LEASE_TTL seconds.

No Redis/broker required — works in the standard Emergent (single shared Mongo)
deployment and degrades to "this is the only pod, so it's always the leader" in
single-instance/preview environments.
"""
import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Unique identity for THIS process/pod.
INSTANCE_ID = os.environ.get("HOSTNAME") or uuid.uuid4().hex
INSTANCE_ID = f"{INSTANCE_ID}:{uuid.uuid4().hex[:8]}"

LEASE_TTL = int(os.environ.get("SCHEDULER_LEASE_TTL", "60"))      # seconds a lease is valid
HEARTBEAT_INTERVAL = max(5, LEASE_TTL // 3)                       # renew well before expiry
LOCK_KEY = "schedulers"

_db = None
_is_leader = False


def set_db(database):
    global _db
    _db = database


def is_leader() -> bool:
    return _is_leader


def _now():
    return datetime.now(timezone.utc)


async def _try_acquire() -> bool:
    """Atomically claim/renew the leader lock. Returns True if we hold it."""
    now = _now()
    expires_at = now + timedelta(seconds=LEASE_TTL)
    # Claim if: no lock, lock expired, or already ours. Atomic via find_one_and_update
    # with a filter that matches only those conditions.
    result = await _db.scheduler_locks.find_one_and_update(
        {
            "_id": LOCK_KEY,
            "$or": [
                {"holder": INSTANCE_ID},
                {"expires_at": {"$lte": now}},
            ],
        },
        {"$set": {"holder": INSTANCE_ID, "expires_at": expires_at, "updated_at": now}},
        upsert=False,
        return_document=True,
    )
    if result is not None:
        return True
    # Lock doc may not exist yet — try a guarded insert (unique _id prevents races).
    try:
        await _db.scheduler_locks.insert_one(
            {"_id": LOCK_KEY, "holder": INSTANCE_ID, "expires_at": expires_at, "updated_at": now}
        )
        return True
    except Exception:
        # Someone else created/holds it.
        return False


async def acquire_leadership() -> bool:
    """One-shot attempt to become leader. Returns whether we are the leader now."""
    global _is_leader
    if _db is None:
        # No DB wired — assume single instance.
        _is_leader = True
        return True
    try:
        _is_leader = await _try_acquire()
    except Exception as e:
        logger.warning("[leader] acquire failed (assuming non-leader): %s", e)
        _is_leader = False
    if _is_leader:
        logger.info("[leader] this pod (%s) is the scheduler LEADER", INSTANCE_ID)
    else:
        logger.info("[leader] this pod (%s) is a FOLLOWER — schedulers idle", INSTANCE_ID)
    return _is_leader


async def release_leadership():
    """Release our lease on graceful shutdown so another pod (or a restart of this
    one) can take over immediately instead of waiting for the lease to expire."""
    global _is_leader
    if _db is None or not _is_leader:
        return
    try:
        await _db.scheduler_locks.delete_one({"_id": LOCK_KEY, "holder": INSTANCE_ID})
        logger.info("[leader] pod %s released leadership on shutdown", INSTANCE_ID)
    except Exception as e:
        logger.warning("[leader] release failed: %s", e)
    _is_leader = False


async def heartbeat_loop():
    """Renew our lease while we're leader; attempt takeover if we're a follower."""
    global _is_leader
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        if _db is None:
            continue
        try:
            held = await _try_acquire()
            if held and not _is_leader:
                logger.info("[leader] pod %s acquired leadership (prior leader gone)", INSTANCE_ID)
                _is_leader = True
                from services import scheduler_manager
                asyncio.create_task(scheduler_manager.start_all())
            elif not held and _is_leader:
                logger.warning("[leader] pod %s lost leadership", INSTANCE_ID)
                _is_leader = False
        except Exception as e:
            logger.warning("[leader] heartbeat error: %s", e)
