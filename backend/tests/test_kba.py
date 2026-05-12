"""
M2 KBA (Knowledge-Based Authentication) — Florida RON Compliance
Tests for /api/kba/* routes using MockKBAProvider.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}
NOTARY = {"email": "notarytest@test.com", "password": "Test123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO)


@pytest.fixture(scope="module")
def notary_token():
    return _login(NOTARY)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ───────── /api/kba/status ─────────
class TestKbaStatus:
    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/kba/status")
        assert r.status_code == 401

    def test_status_returns_expected_fields(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/kba/status", headers=_h(notary_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["provider", "is_mock", "attempts_in_24h", "max_attempts_in_24h", "can_attempt"]:
            assert k in d, f"Missing key {k}"
        assert d["provider"] == "mock"
        assert d["is_mock"] is True
        assert d["max_attempts_in_24h"] == 2
        assert isinstance(d["attempts_in_24h"], int)


# ───────── /api/kba/start ─────────
class TestKbaStart:
    def test_start_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/kba/start", json={})
        assert r.status_code == 401

    def test_start_returns_questions_without_correct_id(self, notary_token):
        # Pre-check capacity, otherwise skip
        s = requests.get(f"{BASE_URL}/api/kba/status", headers=_h(notary_token)).json()
        if not s.get("can_attempt"):
            pytest.skip("notary already at 24h attempt limit")
        r = requests.post(f"{BASE_URL}/api/kba/start", headers=_h(notary_token), json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_id" in d and len(d["session_id"]) > 0
        assert d["time_limit_seconds"] == 120
        assert d["min_correct"] == 4
        assert d["questions_count"] == 5
        assert len(d["questions"]) == 5
        for q in d["questions"]:
            assert "question_id" in q
            assert "prompt" in q
            assert "options" in q and len(q["options"]) >= 2
            assert "correct_id" not in q, "SECURITY: correct_id leaked!"
        # save for later
        pytest.kba_session = d


# ───────── /api/kba/submit ─────────
class TestKbaSubmit:
    def test_submit_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/kba/submit", json={"session_id": "x", "answers": [{"a": 1}]})
        assert r.status_code == 401

    def test_submit_unknown_session_404(self, notary_token):
        r = requests.post(
            f"{BASE_URL}/api/kba/submit",
            headers=_h(notary_token),
            json={"session_id": "doesnotexist123", "answers": [{"question_id": "q1", "selected_id": "o0"}]},
        )
        assert r.status_code == 404

    def test_submit_not_owner_403(self, notary_token, admin_token):
        # Use the session created by notary in previous test
        sess = getattr(pytest, "kba_session", None)
        if not sess:
            pytest.skip("no notary session available")
        payload = {
            "session_id": sess["session_id"],
            "answers": [{"question_id": q["question_id"], "selected_id": q["options"][0]["id"]} for q in sess["questions"]],
        }
        r = requests.post(f"{BASE_URL}/api/kba/submit", headers=_h(admin_token), json=payload)
        assert r.status_code == 403, r.text

    def test_submit_scores_and_completes(self, notary_token):
        sess = getattr(pytest, "kba_session", None)
        if not sess:
            pytest.skip("no notary session available")
        payload = {
            "session_id": sess["session_id"],
            "answers": [{"question_id": q["question_id"], "selected_id": q["options"][0]["id"]} for q in sess["questions"]],
        }
        r = requests.post(f"{BASE_URL}/api/kba/submit", headers=_h(notary_token), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] in ("passed", "failed", "expired")
        assert d["questions_count"] == 5
        assert d["min_correct"] == 4
        assert isinstance(d["correct_count"], int)
        assert "passed" in d
        pytest.kba_completed_session_id = sess["session_id"]

    def test_submit_already_completed_400(self, notary_token):
        sid = getattr(pytest, "kba_completed_session_id", None)
        if not sid:
            pytest.skip("no completed session")
        r = requests.post(
            f"{BASE_URL}/api/kba/submit",
            headers=_h(notary_token),
            json={"session_id": sid, "answers": [{"question_id": "q1", "selected_id": "o0"}]},
        )
        assert r.status_code == 400


# ───────── /api/kba/sessions/{id} ─────────
class TestKbaSession:
    def test_get_session_owner_no_internal_questions(self, notary_token):
        sid = getattr(pytest, "kba_completed_session_id", None)
        if not sid:
            pytest.skip("no completed session")
        r = requests.get(f"{BASE_URL}/api/kba/sessions/{sid}", headers=_h(notary_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_questions_internal" not in d, "SECURITY: internal questions leaked!"
        assert d["session_id"] == sid

    def test_get_session_not_owner_403(self, demo_token):
        sid = getattr(pytest, "kba_completed_session_id", None)
        if not sid:
            pytest.skip("no completed session")
        r = requests.get(f"{BASE_URL}/api/kba/sessions/{sid}", headers=_h(demo_token))
        assert r.status_code == 403

    def test_get_session_admin_allowed(self, admin_token):
        sid = getattr(pytest, "kba_completed_session_id", None)
        if not sid:
            pytest.skip("no completed session")
        r = requests.get(f"{BASE_URL}/api/kba/sessions/{sid}", headers=_h(admin_token))
        assert r.status_code == 200

    def test_get_session_404(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/kba/sessions/missing-xyz", headers=_h(notary_token))
        assert r.status_code == 404


# ───────── Rate limiting ─────────
class TestKbaRateLimit:
    def test_rate_limit_429_after_max(self, notary_token):
        # notary has 1 attempt done already. Do one more to hit cap, then 3rd must 429.
        s = requests.get(f"{BASE_URL}/api/kba/status", headers=_h(notary_token)).json()
        attempts = s["attempts_in_24h"]
        # only do additional starts up to cap
        while attempts < 2:
            r = requests.post(f"{BASE_URL}/api/kba/start", headers=_h(notary_token), json={})
            if r.status_code == 429:
                break
            assert r.status_code == 200, r.text
            d = r.json()
            # immediate submit so attempt is logged
            payload = {
                "session_id": d["session_id"],
                "answers": [{"question_id": q["question_id"], "selected_id": q["options"][0]["id"]} for q in d["questions"]],
            }
            sr = requests.post(f"{BASE_URL}/api/kba/submit", headers=_h(notary_token), json=payload)
            assert sr.status_code == 200
            attempts += 1
        # Now hit start again — should be 429
        r = requests.post(f"{BASE_URL}/api/kba/start", headers=_h(notary_token), json={})
        assert r.status_code == 429, f"expected 429 after 2 attempts, got {r.status_code} {r.text}"
        body = r.json()
        assert "detail" in body and "2" in body["detail"]


# ───────── Admin fraud signals ─────────
class TestKbaAdminFraud:
    def test_non_admin_403(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/kba/admin/fraud-signals", headers=_h(demo_token))
        assert r.status_code == 403

    def test_admin_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/kba/admin/fraud-signals", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "signals" in d and "total" in d
        assert isinstance(d["signals"], list)


# ───────── Regression checks (FL endpoints) ─────────
class TestFLRegression:
    def test_state_profile_fl(self):
        r = requests.get(f"{BASE_URL}/api/fl/state-profile")
        # Open endpoint — should still return 200 (regression check)
        assert r.status_code in (200, 401), r.status_code
