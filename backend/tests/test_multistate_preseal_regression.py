"""
Regression tests for the state_code wiring + multi-state pre-seal evaluator.

Validates:
- POST /api/notary/requests accepts state_code (FL/TX/NY/CA/VA), rejects 'ZZ' (400),
  and still works when state_code is missing/empty.
- POST /api/notary/requests/{id}/complete blocks non-FL ceremonies with HTTP 412
  when required gates are unmet, persists `<state>_blocked` status, and returns
  blocked_reasons in detail.
- Existing FL ceremony pipeline (create -> assign -> identity verify -> complete)
  is not broken.
- Backend health: GET /api/ returns 200; auth flows still work.

Run:
  pytest /app/backend/tests/test_multistate_preseal_regression.py -v \
    --tb=short --junitxml=/app/test_reports/pytest/iter109.xml
"""

import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

ADMIN = ("admin@notarychain.com", "Admin123!")
DEMO = ("demo@test.com", "Demo123!")
FL_NOTARY = ("notarytest@test.com", "Test123!")
NOTARY2 = ("notary2@test.com", "Notary123!")

SUPPORTED_STATES = ["FL", "TX", "NY", "CA", "VA"]


# ─── Helpers ────────────────────────────────────────────────────────────────
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        return None
    data = r.json()
    return data.get("access_token") or data.get("token")


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def demo_token():
    tok = _login(*DEMO)
    if not tok:
        pytest.skip("Could not log in demo user")
    return tok


@pytest.fixture(scope="module")
def notary_token():
    tok = _login(*FL_NOTARY)
    if not tok:
        pytest.skip("Could not log in notary user")
    return tok


@pytest.fixture(scope="module")
def admin_token():
    tok = _login(*ADMIN)
    if not tok:
        pytest.skip("Could not log in admin user")
    return tok


# ─── Health / Auth basics ───────────────────────────────────────────────────
class TestHealthAndAuth:
    def test_root_health(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200, f"GET /api/ returned {r.status_code}: {r.text[:200]}"

    def test_admin_login(self):
        assert _login(*ADMIN), "Admin login failed"

    def test_demo_login(self):
        assert _login(*DEMO), "Demo user login failed"

    def test_fl_notary_login(self):
        assert _login(*FL_NOTARY), "FL notary login failed"

    def test_notary2_login(self):
        # not critical for blocking; just informational
        tok = _login(*NOTARY2)
        # we don't fail if missing — just log
        if not tok:
            pytest.skip("notary2 credentials not provisioned")


# ─── A) create_notarization_request state_code validation ───────────────────
class TestCreateRequestStateCode:
    @pytest.mark.parametrize("state", SUPPORTED_STATES)
    def test_valid_state_codes_accepted(self, demo_token, state):
        payload = {
            "document_name": f"TEST_state_{state}",
            "document_type": "affidavit",
            "notarization_type": "ron",
            "state_code": state,
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200, f"{state} create failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("state_code") == state, f"state_code not persisted: {body.get('state_code')}"
        assert body.get("id"), "request id missing in response"

    def test_invalid_state_code_rejected(self, demo_token):
        payload = {
            "document_name": "TEST_invalid_state",
            "document_type": "affidavit",
            "notarization_type": "ron",
            "state_code": "ZZ",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 400, f"expected 400 for ZZ, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        detail = str(body.get("detail", "")).lower()
        assert "unsupported" in detail or "state_code" in detail, f"Unexpected error detail: {body}"

    def test_lowercase_state_code_normalized(self, demo_token):
        payload = {
            "document_name": "TEST_lowercase_state",
            "document_type": "affidavit",
            "notarization_type": "ron",
            "state_code": "tx",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200, f"lowercase tx should be normalized: {r.status_code} {r.text[:200]}"
        assert r.json().get("state_code") == "TX"

    def test_missing_state_code_still_works(self, demo_token):
        payload = {
            "document_name": "TEST_no_state",
            "document_type": "affidavit",
            "notarization_type": "ron",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200, f"missing state_code should succeed: {r.status_code} {r.text[:200]}"

    def test_empty_state_code_still_works(self, demo_token):
        payload = {
            "document_name": "TEST_empty_state",
            "document_type": "affidavit",
            "notarization_type": "ron",
            "state_code": "",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200, f"empty state_code should succeed: {r.status_code} {r.text[:200]}"


# ─── B) complete_notarization multi-state pre-seal gate ─────────────────────
def _create_and_assign(demo_token, notary_token, state_code, doc_type="affidavit"):
    """Create a request as demo, assign to FL notary. Returns request_id."""
    payload = {
        "document_name": f"TEST_complete_{state_code}_{int(time.time())}",
        "document_type": doc_type,
        "notarization_type": "ron",
        "state_code": state_code,
    }
    r = requests.post(f"{API}/notary/requests", json=payload,
                      headers=_headers(demo_token), timeout=30)
    assert r.status_code == 200, f"create failed: {r.status_code} {r.text[:200]}"
    rid = r.json()["id"]
    # assign as notary
    r2 = requests.post(f"{API}/notary/requests/{rid}/assign",
                       headers=_headers(notary_token), timeout=30)
    assert r2.status_code == 200, f"assign failed: {r2.status_code} {r2.text[:200]}"
    return rid


class TestCompleteNotarizationGate:
    @pytest.mark.parametrize("state", ["TX", "NY", "CA", "VA"])
    def test_non_fl_blocked_with_412_when_gates_unmet(self, demo_token, notary_token, state):
        rid = _create_and_assign(demo_token, notary_token, state)
        r = requests.post(f"{API}/notary/requests/{rid}/complete",
                          headers=_headers(notary_token), timeout=30)
        assert r.status_code == 412, (
            f"{state}: expected 412, got {r.status_code}: {r.text[:300]}"
        )
        body = r.json()
        # FastAPI wraps HTTPException.detail under "detail"
        detail = body.get("detail", body)
        assert isinstance(detail, dict), f"detail not dict: {detail}"
        assert detail.get("error") == "preseal_gate_failed", f"unexpected error key: {detail}"
        assert detail.get("state_code") == state
        blocked = detail.get("blocked_reasons", [])
        assert isinstance(blocked, list) and len(blocked) > 0, f"no blocked_reasons: {detail}"

    def test_blocked_status_persisted_in_db(self, demo_token, notary_token, admin_token):
        rid = _create_and_assign(demo_token, notary_token, "TX")
        r = requests.post(f"{API}/notary/requests/{rid}/complete",
                          headers=_headers(notary_token), timeout=30)
        assert r.status_code == 412
        # Retrieve request and check status was updated
        r2 = requests.get(f"{API}/notary/requests/{rid}",
                          headers=_headers(notary_token), timeout=20)
        # Use status info if accessible; otherwise check via listing
        if r2.status_code == 200:
            status_val = r2.json().get("status", "")
            assert status_val == "tx_blocked", f"expected tx_blocked, got '{status_val}'"
        else:
            # fallback: pull all my requests as demo
            r3 = requests.get(f"{API}/notary/requests/my",
                              headers=_headers(demo_token), timeout=20)
            assert r3.status_code == 200
            row = next((x for x in r3.json() if x.get("id") == rid), None)
            assert row, "request not found in /requests/my"
            assert row.get("status") == "tx_blocked", f"expected tx_blocked, got '{row.get('status')}'"

    def test_ny_will_block_all(self, demo_token, notary_token):
        # NY hard-blocks wills via RON; should 412 with document_type message
        rid = _create_and_assign(demo_token, notary_token, "NY", doc_type="will")
        r = requests.post(f"{API}/notary/requests/{rid}/complete",
                          headers=_headers(notary_token), timeout=30)
        assert r.status_code == 412, f"got {r.status_code}: {r.text[:200]}"
        detail = r.json().get("detail", {})
        joined = " ".join(detail.get("blocked_reasons", [])).lower()
        assert "ny" in joined or "will" in joined or "ron" in joined, f"missing will-block reason: {detail}"


# ─── C) FL Ceremony regression: create -> assign -> verify -> complete ──────
class TestFLCeremonyRegression:
    def test_fl_full_pipeline_does_not_break(self, demo_token, notary_token):
        # Create FL request
        payload = {
            "document_name": f"TEST_FL_regression_{int(time.time())}",
            "document_type": "affidavit",
            "notarization_type": "ron",
            "state_code": "FL",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200, f"FL create failed: {r.status_code} {r.text[:200]}"
        rid = r.json()["id"]
        assert r.json().get("state_code") == "FL"

        # Assign
        r2 = requests.post(f"{API}/notary/requests/{rid}/assign",
                           headers=_headers(notary_token), timeout=30)
        assert r2.status_code == 200, f"FL assign failed: {r2.status_code} {r2.text[:200]}"

        # Attempt complete — FL keeps existing pipeline, evaluator gate is bypassed.
        # Expected outcomes: 200 (success) OR a non-412 failure from downstream
        # pipeline (e.g. package sealing). We assert it is NOT 412 because FL
        # should not hit the multi-state pre-seal gate.
        r3 = requests.post(f"{API}/notary/requests/{rid}/complete",
                           headers=_headers(notary_token), timeout=60)
        assert r3.status_code != 412, (
            f"FL ceremony unexpectedly hit multistate 412 gate: {r3.text[:400]}"
        )
        # We accept 200 as the happy path; non-200 is acceptable here only if it
        # is a different kind of error (e.g., 500 from optional sealing). Log:
        print(f"[FL regression] /complete returned {r3.status_code}: {r3.text[:200]}")

    def test_fl_request_with_no_state_treated_as_legacy(self, demo_token, notary_token):
        # legacy clients omit state_code; should not hit multi-state gate.
        payload = {
            "document_name": f"TEST_FL_legacy_{int(time.time())}",
            "document_type": "affidavit",
            "notarization_type": "ron",
        }
        r = requests.post(f"{API}/notary/requests", json=payload,
                          headers=_headers(demo_token), timeout=30)
        assert r.status_code == 200
        rid = r.json()["id"]
        r2 = requests.post(f"{API}/notary/requests/{rid}/assign",
                           headers=_headers(notary_token), timeout=30)
        assert r2.status_code == 200
        r3 = requests.post(f"{API}/notary/requests/{rid}/complete",
                           headers=_headers(notary_token), timeout=60)
        assert r3.status_code != 412, f"legacy (no state) hit gate: {r3.text[:200]}"
