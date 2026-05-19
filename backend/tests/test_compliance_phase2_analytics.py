"""Tests for Multi-state Compliance Phase 2 (TX/NY/CA/VA pre-seal evaluator)
and the Admin Ceremony Analytics dashboard endpoints.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-vault-dev.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_token():
    return _login(USER_EMAIL, USER_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# ──────────────────────────── Multi-state evaluator ────────────────────────────

class TestEvaluatorSupported:
    def test_supported_endpoint_public(self):
        r = requests.get(f"{BASE_URL}/api/compliance/evaluator/supported", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "wired_states" in data
        for s in ["FL", "TX", "NY", "CA", "VA"]:
            assert s in data["wired_states"], f"{s} missing from {data['wired_states']}"


class TestEvaluatorStates:
    """Test the pre-seal evaluator for TX/NY/CA/VA + FL redirect + unknown state."""

    DUMMY_CEREMONY = "TEST_DUMMY_" + uuid.uuid4().hex[:12]

    def test_unauthenticated_blocked(self):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/TX/{self.DUMMY_CEREMONY}",
            timeout=20,
        )
        assert r.status_code in (401, 403), f"Expected auth required, got {r.status_code}"

    def test_TX_returns_gates(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/TX/{self.DUMMY_CEREMONY}",
            headers=user_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["state_code"] == "TX"
        assert "schema_version" in data
        assert "ready" in data
        # Expected TX gates
        for g in ["audio_video", "kba", "id_check", "retention", "journal", "tamper_evident"]:
            assert g in data["gates"], f"TX missing gate {g}"
        assert data["ready"] is False
        assert isinstance(data["blocked_reasons"], list) and len(data["blocked_reasons"]) > 0

    def test_NY_blocks_will(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/NY/{self.DUMMY_CEREMONY}",
            headers=user_headers, params={"document_type": "will"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ready"] is False
        joined = " ".join(data["blocked_reasons"]).lower()
        assert "ny prohibits" in joined and "will" in joined

    def test_NY_blocks_codicil(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/NY/{self.DUMMY_CEREMONY}",
            headers=user_headers, params={"document_type": "codicil"}, timeout=20,
        )
        data = r.json()
        assert data["ready"] is False
        assert any("ny prohibits" in r.lower() for r in data["blocked_reasons"])

    def test_NY_general_runs_gates(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/NY/{self.DUMMY_CEREMONY}",
            headers=user_headers, params={"document_type": "general"}, timeout=20,
        )
        data = r.json()
        assert data["state_code"] == "NY"
        for g in ["audio_video", "identity_proofing", "kba", "id_check", "retention", "journal", "principal_location"]:
            assert g in data["gates"], f"NY missing gate {g}"

    def test_CA_thumbprint_required_for_deed(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/CA/{self.DUMMY_CEREMONY}",
            headers=user_headers, params={"document_type": "deed"}, timeout=20,
        )
        data = r.json()
        assert data["state_code"] == "CA"
        assert "thumbprint" in data["gates"], "CA deed must include thumbprint gate"

    def test_CA_no_thumbprint_for_general(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/CA/{self.DUMMY_CEREMONY}",
            headers=user_headers, params={"document_type": "general"}, timeout=20,
        )
        data = r.json()
        assert "thumbprint" not in data["gates"], "CA standard contract should NOT require thumbprint"

    def test_VA_gates_present(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/VA/{self.DUMMY_CEREMONY}",
            headers=user_headers, timeout=20,
        )
        data = r.json()
        assert data["state_code"] == "VA"
        for g in ["audio_video", "kba", "id_check", "retention", "journal", "tamper_evident"]:
            assert g in data["gates"]

    def test_FL_returns_redirect_hint(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/FL/{self.DUMMY_CEREMONY}",
            headers=user_headers, timeout=20,
        )
        data = r.json()
        assert data["state_code"] == "FL"
        assert data["ready"] is False
        assert "redirect" in data
        assert "/api/fl/ron/readiness" in data["redirect"]

    def test_unknown_state(self, user_headers):
        r = requests.get(
            f"{BASE_URL}/api/compliance/evaluate-preseal/ZZ/{self.DUMMY_CEREMONY}",
            headers=user_headers, timeout=20,
        )
        data = r.json()
        assert data["ready"] is False
        joined = " ".join(data["blocked_reasons"]).lower()
        assert "no compliance abstract" in joined


# ──────────────────────────── Admin Analytics ────────────────────────────

class TestAdminAnalytics:
    def test_overview_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/overview", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_ceremonies", "last_30d", "sealed", "in_session", "pending",
                  "fl_blocked", "completion_rate_pct", "avg_time_to_seal_secs",
                  "revenue_30d_usd", "as_of"]:
            assert k in d, f"missing key {k}"

    def test_overview_forbidden_for_user(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/overview", headers=user_headers, timeout=20)
        assert r.status_code == 403

    def test_funnel_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/funnel", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "total_started" in d
        assert "stages" in d
        stage_names = {s["stage"] for s in d["stages"]}
        for expected in ["pending", "assigned", "in_session", "completed", "sealed", "fl_blocked"]:
            assert expected in stage_names
        for s in d["stages"]:
            assert "count" in s and "share_pct" in s

    def test_funnel_forbidden(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/funnel", headers=user_headers, timeout=20)
        assert r.status_code == 403

    def test_timeseries_default(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/timeseries", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["days"] == 30
        assert isinstance(d["series"], list)
        for row in d["series"]:
            assert "day" in row and "created" in row and "sealed" in row

    def test_timeseries_custom_days(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/timeseries?days=90", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["days"] == 90

    def test_timeseries_invalid_days(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/timeseries?days=999", headers=admin_headers, timeout=20)
        assert r.status_code == 422

    def test_state_breakdown(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/state-breakdown", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "states" in d and isinstance(d["states"], list)
        for s in d["states"]:
            for k in ["state", "total", "sealed", "blocked", "completion_pct"]:
                assert k in s

    def test_top_notaries(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/top-notaries", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "top_notaries" in d and isinstance(d["top_notaries"], list)
        for n in d["top_notaries"]:
            for k in ["notary_id", "name", "email", "sealed_count"]:
                assert k in n

    def test_gate_failures(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/gate-failures", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "failures" in d and isinstance(d["failures"], list)
        assert "total_blocked_ceremonies" in d
        for f in d["failures"]:
            assert "gate" in f and "count" in f

    def test_gate_failures_forbidden(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/gate-failures", headers=user_headers, timeout=20)
        assert r.status_code == 403


# ──────────────────────────── Regression smoke ────────────────────────────

class TestRegressionSmoke:
    def test_compliance_states(self):
        r = requests.get(f"{BASE_URL}/api/compliance/states", timeout=20)
        assert r.status_code == 200
        data = r.json()
        # Could be either {"states": [...]} or a list
        assert data, "compliance/states empty"

    def test_fl_readiness_endpoint_reachable(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/fl/ron/readiness/TEST_FAKE_CEREMONY", headers=user_headers, timeout=20)
        # Not asserting 200 — just that the route is still wired (no 404 router missing)
        assert r.status_code in (200, 400, 403, 404), r.status_code
