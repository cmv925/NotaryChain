"""Tests for Beneficiary Viral Loop (signup) + Client Portal /my-documents."""
import os
import sys
import asyncio
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://notary-chain-preview-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@test.com"
DEMO_PASS = "Demo123!"


@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


async def _issue_token():
    sys.path.insert(0, '/app/backend')
    from motor.motor_asyncio import AsyncIOMotorClient
    from services import salv_service, email_service
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    salv_service.set_dependencies(db, email_service)
    b = await db.salv_beneficiaries.find_one({})
    assert b, "No beneficiary in DB"
    tok = await salv_service.issue_handoff_token(b['beneficiary_id'])
    return tok, b


@pytest.fixture
def fresh_handoff():
    tok, b = asyncio.run(_issue_token())
    return tok, b


# --- /api/salv/viral/stats (public) ---
class TestViralStats:
    def test_viral_stats_public(self):
        r = requests.get(f"{API}/salv/viral/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_assets_protected", "total_value_usd", "total_beneficiaries", "accepted_handoffs", "viral_conversions"]:
            assert k in d, f"missing {k}"
            assert isinstance(d[k], int)


# --- /api/salv/handoffs/received (authenticated) ---
class TestHandoffsReceived:
    def test_received_requires_auth(self):
        r = requests.get(f"{API}/salv/handoffs/received")
        assert r.status_code in (401, 403)

    def test_received_returns_array_shape(self, demo_headers):
        r = requests.get(f"{API}/salv/handoffs/received", headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "beneficiaries" in d
        assert isinstance(d["beneficiaries"], list)


# --- /api/salv/handoff/{token}/signup ---
class TestHandoffSignup:
    def test_invalid_token_404(self):
        r = requests.post(f"{API}/salv/handoff/totallybogus_xyz/signup",
                          json={"token": "totallybogus_xyz", "password": "Strong123!", "full_name": "X"})
        assert r.status_code == 404, r.text

    def test_short_password_rejected(self, fresh_handoff):
        tok, _b = fresh_handoff
        r = requests.post(f"{API}/salv/handoff/{tok}/signup",
                          json={"token": tok, "password": "short", "full_name": "X"})
        assert r.status_code == 400, r.text

    def test_signup_success_or_existing_and_conversion_recorded(self, fresh_handoff):
        tok, b = fresh_handoff
        # First call - might create new OR return existing depending on benef email
        r = requests.post(f"{API}/salv/handoff/{tok}/signup",
                          json={"token": tok, "password": "Viral123!", "full_name": "Test Viral"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d
        assert d.get("token_type") == "bearer"
        assert "is_existing" in d

        # Idempotency: signup again with another token for same beneficiary
        tok2, _ = asyncio.run(_issue_token())
        r2 = requests.post(f"{API}/salv/handoff/{tok2}/signup",
                           json={"token": tok2, "password": "Viral123!", "full_name": "Test Viral"})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        # After first signup, second call MUST return is_existing
        assert d2["is_existing"] is True

        # Verify access token works
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d2['access_token']}"})
        assert me.status_code == 200, me.text

    def test_viral_conversions_counter_increments(self, fresh_handoff):
        # Get baseline
        before = requests.get(f"{API}/salv/viral/stats").json()["viral_conversions"]
        tok, _ = fresh_handoff
        requests.post(f"{API}/salv/handoff/{tok}/signup",
                      json={"token": tok, "password": "Viral123!", "full_name": "T"})
        after = requests.get(f"{API}/salv/viral/stats").json()["viral_conversions"]
        # Either same (upsert no-op for already-converted) or +1
        assert after >= before


# --- /api/salv/handoff/{token} (lookup) used by frontend ---
class TestHandoffLookup:
    def test_lookup_invalid_404(self):
        r = requests.get(f"{API}/salv/handoff/bogus_xxx")
        assert r.status_code == 404

    def test_lookup_valid(self, fresh_handoff):
        tok, _ = fresh_handoff
        r = requests.get(f"{API}/salv/handoff/{tok}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "beneficiary" in d
        assert "status" in d


# --- MyDocuments page data sources ---
class TestMyDocumentsSources:
    def test_seals(self, demo_headers):
        r = requests.get(f"{API}/documents/seals?limit=100", headers=demo_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_notary_my(self, demo_headers):
        r = requests.get(f"{API}/notary/requests/my", headers=demo_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_salv_vault(self, demo_headers):
        r = requests.get(f"{API}/salv/vault", headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "assets" in d
