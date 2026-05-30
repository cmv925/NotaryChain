"""
Backend tests for Enhanced KBA identity verification + notarization gate.

Covers:
- POST /api/kba/enhanced/start
- POST /api/kba/enhanced/{session_id}/document
- POST /api/kba/enhanced/{session_id}/selfie
- POST /api/kba/enhanced/answer-quiz (PASS path with correct answers)
- /api/auth/me identity_verified flip
- POST /api/notary/requests gate (403 identity_verification_required when not verified -> 200/201 after pass)
"""
import io
import os
import struct
import zlib
import pytest
import requests
import asyncio

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


def _png_bytes(width: int = 32, height: int = 32, color=(180, 180, 180)) -> bytes:
    """Build a minimal valid PNG image (no external deps)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def demo_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture(scope="module")
def reset_demo_identity():
    """Reset demo@test.com identity_verified=False before running gate tests."""
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")

    async def _reset():
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        res = await db.users.update_one(
            {"email": DEMO_EMAIL},
            {"$set": {"identity_verified": False},
             "$unset": {
                 "identity_verification_provider": "",
                 "identity_verification_score": "",
                 "identity_verified_at": "",
             }},
        )
        client.close()
        return res.modified_count

    modified = asyncio.get_event_loop().run_until_complete(_reset())
    print(f"[reset] demo user modified_count={modified}")
    return modified


# ─────────────────────────────────────────────────────────────
class TestEnhancedKBAGateAndFlow:
    """Order matters: gate must be checked BEFORE we flip identity_verified."""

    def test_01_reset_and_login(self, reset_demo_identity, auth_headers, api):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me.get("email") == DEMO_EMAIL
        # /api/auth/me may not always include role; only check it if present
        if me.get("role") is not None:
            assert me.get("role") == "user"
        assert me.get("identity_verified") in (False, None), (
            f"Expected identity_verified False after reset, got {me.get('identity_verified')}"
        )

    def test_02_notary_create_blocked_when_unverified(self, auth_headers, api):
        r = api.post(
            f"{BASE_URL}/api/notary/requests",
            json={
                "document_name": "TEST_doc.pdf",
                "document_type": "Affidavit",
                "notarization_type": "acknowledgment",
                "state_code": "FL",
            },
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail") if isinstance(body, dict) else None
        assert detail == "identity_verification_required", body

    def test_03_start_enhanced_kba(self, auth_headers, api):
        r = api.post(
            f"{BASE_URL}/api/kba/enhanced/start",
            json={"full_name": "Demo User", "dob": "1990-01-15", "state": "FL"},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data and data["session_id"]
        assert data.get("quiz_preview_count") == 3
        pytest.session_id = data["session_id"]

    def test_04_upload_document(self, auth_headers, api):
        sid = pytest.session_id
        files = {"file": ("doc.png", io.BytesIO(_png_bytes()), "image/png")}
        r = api.post(
            f"{BASE_URL}/api/kba/enhanced/{sid}/document",
            files=files,
            headers=auth_headers,
            timeout=90,  # GPT-5.2 Vision can be slow; deterministic fallback should still respond
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ocr" in data, data
        assert data.get("next_step") == "upload_selfie"
        ocr = data["ocr"]
        assert "confidence" in ocr

    def test_05_upload_selfie(self, auth_headers, api):
        sid = pytest.session_id
        files = {"file": ("selfie.png", io.BytesIO(_png_bytes(color=(200, 160, 140))), "image/png")}
        r = api.post(
            f"{BASE_URL}/api/kba/enhanced/{sid}/selfie",
            files=files,
            headers=auth_headers,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "face_match" in data, data
        assert "questions" in data and len(data["questions"]) == 3
        pytest.kba_questions = data["questions"]

    def test_06_answer_quiz_pass(self, auth_headers, api):
        """
        Note: GPT-5.2 Vision correctly rejects our synthetic blank PNGs (no face,
        not an ID document). That's correct AI behavior — not a bug. To exercise
        the PASS path of the answer-quiz scoring + identity-flip + gate-removal
        logic without real photo IDs, we directly seed high doc_ocr.confidence
        and face_match.similarity into the in-flight session in MongoDB, then
        call answer-quiz with the canonically correct quiz answers.
        """
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")

        async def _seed_high_confidence():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            res = await db.kba_enhanced_sessions.update_one(
                {"id": pytest.session_id},
                {"$set": {
                    "document_ocr.confidence": 90,
                    "document_ocr.name_match": True,
                    "face_match.similarity": 88,
                    "face_match.passed": True,
                    "face_match.liveness_passed": True,
                    "status": "pending_quiz",
                }},
            )
            client.close()
            return res.modified_count

        modified = asyncio.get_event_loop().run_until_complete(_seed_high_confidence())
        assert modified == 1, "Failed to seed high-confidence values into session"

        sid = pytest.session_id
        qs = pytest.kba_questions
        answers = [q["choices"][q["correct"]] for q in qs]
        assert answers[:3] == ["FL", "None of these", "None of these"], answers
        r = api.post(
            f"{BASE_URL}/api/kba/enhanced/answer-quiz",
            json={"session_id": sid, "answers": answers},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("decision") == "passed", data
        assert isinstance(data.get("weighted_score"), int)
        assert data["weighted_score"] >= 70
        env = data.get("audit_envelope") or {}
        assert env.get("verification_provider") == "nc_enhanced_v1"
        assert env["components"]["quiz"]["score"] == 100

    def test_07_auth_me_reflects_verified(self, auth_headers, api):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me.get("identity_verified") is True, me

    def test_08_notary_create_succeeds_after_verify(self, auth_headers, api):
        r = api.post(
            f"{BASE_URL}/api/notary/requests",
            json={
                "document_name": "TEST_doc_after_verify.pdf",
                "document_type": "Affidavit",
                "notarization_type": "acknowledgment",
                "state_code": "FL",
            },
            headers=auth_headers,
            timeout=120,
        )
        assert r.status_code in (200, 201), f"Expected 200/201, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("user_id") and body.get("id"), body
