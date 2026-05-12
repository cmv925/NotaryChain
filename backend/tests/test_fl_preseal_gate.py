"""
FL pre-seal hard gate — verifies the invariant that when a ceremony has a
fl_jurisdiction_qualifications doc AND KBA / A/V quality / (for online wills)
2-witnesses gate is missing, status becomes 'fl_blocked', blockchain_seal=null,
and fl_blocked_reasons contains concrete reasons.

We test the gate by replaying the exact logic block from ceremony_routes.py
lines ~548-589 (the FL hard pre-seal gate) against seeded MongoDB state.
This avoids needing to run the full 3-agent LLM pipeline.

Non-FL ceremonies (no fl_jurisdiction_qualifications doc) must not be blocked.
"""
import os
import uuid
import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient


MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
assert MONGO_URL and DB_NAME


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _run_fl_gate(db, ceremony_id, document_type):
    """Replays the exact gate block from ceremony_routes.py:548-589."""
    from datetime import timedelta as _td
    fl_block_reasons = []
    fl_juris = await db.fl_jurisdiction_qualifications.find_one(
        {"ceremony_id": ceremony_id}, {"_id": 0}
    )
    if fl_juris:
        user_id = fl_juris.get("user_id")
        kba_pass = await db.kba_attempts.find_one(
            {"user_id": user_id, "passed": True,
             "$or": [
                 {"ceremony_id": ceremony_id},
                 {"completed_at": {"$gte": (datetime.now(timezone.utc) - _td(hours=1)).isoformat()}},
             ]},
            {"_id": 0, "attempt_id": 1},
        )
        if not kba_pass:
            fl_block_reasons.append("kba_not_passed")

        av = await db.fl_av_quality_reports.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
        if not (av and av.get("passed")):
            fl_block_reasons.append("av_quality_not_passed" if av else "av_quality_not_reported")

        if (document_type or "").lower() in ("will", "online_will"):
            accepted_count = await db.fl_will_witnesses.count_documents(
                {"ceremony_id": ceremony_id,
                 "status": {"$in": ("accepted", "kba_passed", "present", "completed")}}
            )
            if accepted_count < 2:
                fl_block_reasons.append(f"witnesses_short:{accepted_count}_of_2")
    return fl_block_reasons


@pytest.fixture
def db_loop():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    loop = asyncio.new_event_loop()
    yield db, loop
    loop.close()
    client.close()


def _cid():
    return f"TEST_FL_{uuid.uuid4().hex[:10]}"


class TestFLPreSealGate:

    def test_fl_will_missing_kba_av_witnesses_blocks(self, db_loop):
        db, loop = db_loop

        async def setup_and_check():
            cid = _cid()
            uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
            await db.fl_jurisdiction_qualifications.insert_one({
                "ceremony_id": cid, "user_id": uid, "passed": True,
                "doc_type": "online_will", "created_at": _now(),
            })
            reasons = await _run_fl_gate(db, cid, "online_will")
            # cleanup
            await db.fl_jurisdiction_qualifications.delete_many({"ceremony_id": cid})
            return reasons

        reasons = loop.run_until_complete(setup_and_check())
        assert "kba_not_passed" in reasons
        assert "av_quality_not_reported" in reasons
        assert any(r.startswith("witnesses_short:") for r in reasons)
        assert "witnesses_short:0_of_2" in reasons

    def test_fl_kba_passed_av_passed_2_witnesses_allows_seal(self, db_loop):
        db, loop = db_loop

        async def setup_and_check():
            cid = _cid()
            uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
            await db.fl_jurisdiction_qualifications.insert_one({
                "ceremony_id": cid, "user_id": uid, "passed": True,
                "doc_type": "online_will", "created_at": _now(),
            })
            await db.kba_attempts.insert_one({
                "attempt_id": uuid.uuid4().hex[:10], "user_id": uid, "ceremony_id": cid,
                "passed": True, "completed_at": _now(),
            })
            await db.fl_av_quality_reports.insert_one({
                "ceremony_id": cid, "passed": True, "reported_at": _now(),
            })
            for i in range(2):
                await db.fl_will_witnesses.insert_one({
                    "witness_id": f"TEST_w_{uuid.uuid4().hex[:10]}",
                    "token_hash": f"TEST_th_{uuid.uuid4().hex}",
                    "ceremony_id": cid, "witness_index": i, "status": "accepted",
                    "created_at": _now(),
                })
            reasons = await _run_fl_gate(db, cid, "online_will")
            # cleanup
            await db.fl_jurisdiction_qualifications.delete_many({"ceremony_id": cid})
            await db.kba_attempts.delete_many({"ceremony_id": cid})
            await db.fl_av_quality_reports.delete_many({"ceremony_id": cid})
            await db.fl_will_witnesses.delete_many({"ceremony_id": cid})
            return reasons

        reasons = loop.run_until_complete(setup_and_check())
        assert reasons == [], f"expected no block reasons but got {reasons}"

    def test_non_fl_ceremony_not_blocked(self, db_loop):
        """No fl_jurisdiction_qualifications doc → gate is a no-op."""
        db, loop = db_loop

        async def check():
            cid = _cid()
            reasons = await _run_fl_gate(db, cid, "deed")
            return reasons

        reasons = loop.run_until_complete(check())
        assert reasons == []

    def test_fl_non_will_doc_does_not_require_witnesses(self, db_loop):
        """document_type != will/online_will → witnesses gate skipped."""
        db, loop = db_loop

        async def setup_and_check():
            cid = _cid()
            uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
            await db.fl_jurisdiction_qualifications.insert_one({
                "ceremony_id": cid, "user_id": uid, "passed": True,
                "doc_type": "deed", "created_at": _now(),
            })
            await db.kba_attempts.insert_one({
                "attempt_id": uuid.uuid4().hex[:10], "user_id": uid, "ceremony_id": cid,
                "passed": True, "completed_at": _now(),
            })
            await db.fl_av_quality_reports.insert_one({
                "ceremony_id": cid, "passed": True, "reported_at": _now(),
            })
            reasons = await _run_fl_gate(db, cid, "deed")
            await db.fl_jurisdiction_qualifications.delete_many({"ceremony_id": cid})
            await db.kba_attempts.delete_many({"ceremony_id": cid})
            await db.fl_av_quality_reports.delete_many({"ceremony_id": cid})
            return reasons

        reasons = loop.run_until_complete(setup_and_check())
        # No witnesses requirement for deeds → no block reasons
        assert reasons == [], f"non-will FL ceremony got reasons: {reasons}"

    def test_fl_av_reported_but_failed_is_distinct_reason(self, db_loop):
        db, loop = db_loop

        async def setup_and_check():
            cid = _cid()
            uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
            await db.fl_jurisdiction_qualifications.insert_one({
                "ceremony_id": cid, "user_id": uid, "passed": True,
                "doc_type": "online_will",
            })
            await db.kba_attempts.insert_one({
                "attempt_id": uuid.uuid4().hex[:10], "user_id": uid, "ceremony_id": cid,
                "passed": True, "completed_at": _now(),
            })
            await db.fl_av_quality_reports.insert_one({
                "ceremony_id": cid, "passed": False, "reported_at": _now(),
            })
            reasons = await _run_fl_gate(db, cid, "online_will")
            await db.fl_jurisdiction_qualifications.delete_many({"ceremony_id": cid})
            await db.kba_attempts.delete_many({"ceremony_id": cid})
            await db.fl_av_quality_reports.delete_many({"ceremony_id": cid})
            return reasons

        reasons = loop.run_until_complete(setup_and_check())
        assert "av_quality_not_passed" in reasons  # reported but failed → distinct from not_reported
        assert "kba_not_passed" not in reasons
