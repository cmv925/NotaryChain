"""
Florida RON Compliance — Phase 1 M1 backend tests.

Covers:
- State compliance profile (public GET + admin RONSP POST)
- FL notary onboarding (auth, validation, idempotency, duplicates)
- Notary credential status
- Admin pending/verified listing + decision flow
- Public verified directory + eligibility checks
"""
import os
import time
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback to frontend env file at runtime if subprocess didn't inherit it
    try:
        from pathlib import Path
        for line in Path("/app/frontend/.env").read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")

ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
NOTARY = {"email": "notarytest@test.com", "password": "Test123!"}
USER = {"email": "demo@test.com", "password": "Demo123!"}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    user = me.json() if me.status_code == 200 else {}
    return token, user


@pytest.fixture(scope="module")
def admin_token():
    t, _ = _login(**ADMIN)
    return t


@pytest.fixture(scope="module")
def notary_token():
    t, u = _login(**NOTARY)
    return t, u


@pytest.fixture(scope="module")
def user_token():
    t, u = _login(**USER)
    return t, u


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ────────── State compliance profile ──────────

class TestStateProfile:
    def test_get_state_profile_public(self):
        r = requests.get(f"{BASE_URL}/api/fl/state-profile", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["state_code"] == "FL"
        assert d["ron_act"] == "FL Stat. 117.201-117.305"
        assert d["requires_kba"] is True
        assert d["online_wills_allowed"] is True
        assert d["av_retention_years"] == 10
        assert d["online_notary_bond_min_usd"] == 25000
        assert "live_in_state" in d and isinstance(d["live_in_state"], bool)

    def test_admin_set_ronsp(self, admin_token):
        payload = {
            "filing_id": f"TEST-RONSP-{uuid.uuid4().hex[:6]}",
            "expires_at": "2027-01-01T00:00:00Z",
            "registered_agent": "Test Agent",
        }
        r = requests.post(f"{BASE_URL}/api/fl/admin/state-profile/ronsp", headers=_h(admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["state_code"] == "FL"
        assert d["live_in_state"] is True
        assert d["ronsp_registration"]["filing_id"] == payload["filing_id"]
        # GET reflects the flip
        r2 = requests.get(f"{BASE_URL}/api/fl/state-profile", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["live_in_state"] is True

    def test_non_admin_cannot_set_ronsp(self, user_token):
        tok, _ = user_token
        r = requests.post(f"{BASE_URL}/api/fl/admin/state-profile/ronsp", headers=_h(tok), json={}, timeout=15)
        assert r.status_code == 403, r.text


# ────────── FL notary onboarding ──────────

def _iso_future(days=365):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _iso_past(days=10):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


class TestNotaryOnboarding:
    def test_credentials_endpoint_returns_status_for_notary(self, notary_token):
        tok, _ = notary_token
        r = requests.get(f"{BASE_URL}/api/fl/notary/credentials", headers=_h(tok), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "status" in d
        # notary from prev tests may be 'verified' already
        assert d["status"] in ("not_started", "pending_review", "verified", "rejected")

    def test_onboard_validates_min_bond_amount(self, user_token):
        tok, _ = user_token
        body = {
            "fl_commission_number": "GG111111",
            "fl_commission_expires": _iso_future(365),
            "fl_bond_provider": "TestBond",
            "fl_bond_number": "SB-1",
            "fl_bond_amount_usd": 1000,  # below 25000
            "fl_bond_expires_at": _iso_future(365),
            "fl_training_provider": "FloridaNotary.com",
        }
        r = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(tok), json=body, timeout=15)
        assert r.status_code in (400, 422), r.text

    def test_onboard_rejects_expired_bond(self, user_token):
        tok, _ = user_token
        body = {
            "fl_commission_number": f"TT{uuid.uuid4().hex[:6].upper()}",
            "fl_commission_expires": _iso_future(365),
            "fl_bond_provider": "TestBond",
            "fl_bond_number": "SB-EXP",
            "fl_bond_amount_usd": 25000,
            "fl_bond_expires_at": _iso_past(5),
            "fl_training_provider": "FloridaNotary.com",
        }
        r = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(tok), json=body, timeout=15)
        assert r.status_code == 400, r.text
        assert "bond" in r.text.lower()

    def test_onboard_rejects_expired_commission(self, user_token):
        tok, _ = user_token
        body = {
            "fl_commission_number": f"TU{uuid.uuid4().hex[:6].upper()}",
            "fl_commission_expires": _iso_past(5),
            "fl_bond_provider": "TestBond",
            "fl_bond_number": "SB-EXP2",
            "fl_bond_amount_usd": 25000,
            "fl_bond_expires_at": _iso_future(365),
            "fl_training_provider": "FloridaNotary.com",
        }
        r = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(tok), json=body, timeout=15)
        assert r.status_code == 400, r.text
        assert "commission" in r.text.lower()

    def test_onboard_creates_pending_review_for_demo_user(self, user_token):
        tok, _ = user_token
        commission = f"DM{uuid.uuid4().hex[:6].upper()}"
        body = {
            "fl_commission_number": commission.lower(),  # test upper-casing
            "fl_commission_expires": _iso_future(365),
            "fl_bond_provider": "Sun Bonding",
            "fl_bond_number": "SB-DEMO-1",
            "fl_bond_amount_usd": 25000,
            "fl_bond_expires_at": _iso_future(365),
            "fl_training_provider": "FloridaNotary.com",
        }
        r = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(tok), json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending_review"
        assert d["verified"] is False
        # uppercased
        assert d["fl_commission_number"] == commission.upper()

        # idempotent resubmit updates existing record (still pending)
        body["fl_bond_provider"] = "Sun Bonding 2"
        r2 = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(tok), json=body, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["fl_bond_provider"] == "Sun Bonding 2"
        assert r2.json()["status"] == "pending_review"

    def test_onboard_rejects_duplicate_commission_by_different_user(self, notary_token, user_token):
        # demo user submitted commission in previous test. Try to claim the same one from notary.
        ntok, _ = notary_token
        # We don't know the demo commission, so query admin list to get one demo pending commission
        # Simpler: try with a known unique value first then have another user claim it
        utok, _ = user_token
        commission = f"DUP{uuid.uuid4().hex[:5].upper()}"
        body = {
            "fl_commission_number": commission,
            "fl_commission_expires": _iso_future(365),
            "fl_bond_provider": "X",
            "fl_bond_number": "X1",
            "fl_bond_amount_usd": 25000,
            "fl_bond_expires_at": _iso_future(365),
            "fl_training_provider": "FloridaNotary.com",
        }
        # First user (demo) — but demo already has a credential (from prev test).
        # The onboard idempotency rule means demo's record will be updated.
        # So instead claim with user, then try the same commission with notary.
        r1 = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(utok), json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        # Now notary (different user) attempts the same commission number
        r2 = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(ntok), json=body, timeout=15)
        # notary may already be verified — they should get either 400 already verified OR 400 duplicate
        assert r2.status_code == 400, r2.text


# ────────── Admin verification flow ──────────

class TestAdminVerification:
    def test_pending_list_admin_only(self, admin_token, user_token):
        utok, _ = user_token
        r = requests.get(f"{BASE_URL}/api/fl/admin/notaries/pending", headers=_h(utok), timeout=15)
        assert r.status_code == 403, r.text
        r2 = requests.get(f"{BASE_URL}/api/fl/admin/notaries/pending", headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "pending" in d
        for c in d["pending"]:
            assert c["verified"] is False

    def test_verified_list_admin_only(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/admin/notaries/verified", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        for c in r.json()["verified"]:
            assert c["verified"] is True

    def test_decision_404_for_nonexistent_user(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/fl/admin/notaries/{uuid.uuid4()}/decision",
            headers=_h(admin_token),
            json={"approve": True},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_approve_then_reject_workflow(self, admin_token, user_token):
        # demo user has a pending record from earlier tests
        utok, demo_user = user_token
        user_id = demo_user.get("id")
        assert user_id, "demo user id missing in login payload"

        # Approve
        r = requests.post(
            f"{BASE_URL}/api/fl/admin/notaries/{user_id}/decision",
            headers=_h(admin_token),
            json={"approve": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["verified"] is True
        assert d["status"] == "verified"

        # Confirm via the credentials endpoint
        r_self = requests.get(f"{BASE_URL}/api/fl/notary/credentials", headers=_h(utok), timeout=15)
        assert r_self.status_code == 200
        assert r_self.json()["status"] == "verified"

        # Try to re-onboard a verified user — should 400
        body = {
            "fl_commission_number": "RESUB123",
            "fl_commission_expires": _iso_future(365),
            "fl_bond_provider": "X",
            "fl_bond_number": "X",
            "fl_bond_amount_usd": 25000,
            "fl_bond_expires_at": _iso_future(365),
            "fl_training_provider": "FloridaNotary.com",
        }
        r_re = requests.post(f"{BASE_URL}/api/fl/notary/onboard", headers=_h(utok), json=body, timeout=15)
        assert r_re.status_code == 400, r_re.text

        # Reject (flip back for cleanup symmetry)
        r2 = requests.post(
            f"{BASE_URL}/api/fl/admin/notaries/{user_id}/decision",
            headers=_h(admin_token),
            json={"approve": False, "reason": "Test cleanup"},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["status"] == "rejected"
        assert d2["verified"] is False
        assert d2["rejection_reason"] == "Test cleanup"


# ────────── Public directory + eligibility ──────────

class TestPublicDirectoryAndEligibility:
    def test_public_directory_no_sensitive_fields(self):
        r = requests.get(f"{BASE_URL}/api/fl/notaries/public?limit=10", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "notaries" in d and "total" in d
        for n in d["notaries"]:
            # Sensitive fields must not leak
            assert "fl_bond_number" not in n
            assert "fl_training_certificate_url" not in n
            assert "fl_seal_image_url" not in n

    def test_eligibility_verified_user(self, notary_token):
        _, nuser = notary_token
        r = requests.get(f"{BASE_URL}/api/fl/eligibility/{nuser['id']}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # notary may be verified — assert structure
        assert "eligible" in d
        if not d["eligible"]:
            assert d["reason"] in ("no_fl_credentials", "credentials_not_verified", "bond_expired", "commission_expired")

    def test_eligibility_unknown_user(self):
        r = requests.get(f"{BASE_URL}/api/fl/eligibility/{uuid.uuid4()}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["eligible"] is False
        assert d["reason"] == "no_fl_credentials"
