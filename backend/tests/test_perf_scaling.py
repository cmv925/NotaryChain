"""
Regression tests for the P1 scaling batch:
  • cache_service — in-memory backend get/set/delete/namespace TTL behavior
  • leader_election — acquire / renew (re-acquire by same holder) / takeover after
    lease expiry / release, against the real MongoDB.

Run: cd /app/backend && python -m pytest tests/test_perf_scaling.py -v
"""
import os
import asyncio
import importlib
from datetime import datetime, timezone, timedelta

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


def test_cache_memory_set_get_delete():
    from services.cache_service import CacheService
    c = CacheService()
    assert c.backend == "memory"
    assert c.get("plans", "k") is None
    c.set("plans", "k", {"v": 1})
    assert c.get("plans", "k") == {"v": 1}
    c.delete("plans", "k")
    assert c.get("plans", "k") is None


def test_cache_namespace_isolation_and_stats():
    from services.cache_service import CacheService
    c = CacheService()
    c.set("plans", "a", 1)
    c.set("pricing", "a", 2)
    assert c.get("plans", "a") == 1
    assert c.get("pricing", "a") == 2
    c.clear_namespace("plans")
    assert c.get("plans", "a") is None
    assert c.get("pricing", "a") == 2
    assert c.stats()["backend"] == "memory"


@pytest.mark.asyncio
async def test_leader_election_acquire_renew_takeover_release():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    # Use a dedicated lock key so we don't disturb the running server's lock.
    le = importlib.import_module("services.leader_election")
    await db.scheduler_locks.delete_one({"_id": "__test_lock"})

    orig_key, orig_ttl = le.LOCK_KEY, le.LEASE_TTL
    le.LOCK_KEY = "__test_lock"
    le.LEASE_TTL = 2  # short lease for the test
    le.set_db(db)
    try:
        # Pod A acquires.
        le.INSTANCE_ID = "podA"
        le._is_leader = False
        assert await le.acquire_leadership() is True

        # Pod B cannot take over while A's lease is valid.
        le.INSTANCE_ID = "podB"
        le._is_leader = False
        assert await le.acquire_leadership() is False

        # Pod A renews (re-acquire by same holder works).
        le.INSTANCE_ID = "podA"
        assert await le._try_acquire() is True

        # Force lease expiry → Pod B can now take over.
        await db.scheduler_locks.update_one(
            {"_id": "__test_lock"},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
        )
        le.INSTANCE_ID = "podB"
        assert await le._try_acquire() is True
        doc = await db.scheduler_locks.find_one({"_id": "__test_lock"})
        assert doc["holder"] == "podB"

        # Release by current holder removes the lock.
        le._is_leader = True
        await le.release_leadership()
        assert await db.scheduler_locks.find_one({"_id": "__test_lock"}) is None
    finally:
        le.LOCK_KEY, le.LEASE_TTL = orig_key, orig_ttl
        await db.scheduler_locks.delete_one({"_id": "__test_lock"})
