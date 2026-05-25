"""
Backend tests for the new 3 features in this iteration:
  1. Supply Chain Escrow Template (POST /api/escrow/templates, create, extract-conditions)
  2. Resend Custom Domain (email.notarychain.app) — email/status, domain-status, email/test
  3. Feature gate regression on /api/escrow/create + general regression on auth/escrow/subscriptions/hts
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://acn-oracle-live.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASS = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASS = "Demo123!"


# ─────────────────────────── fixtures ───────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Demo login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───────────────────── 1. Supply Chain Template ─────────────────────
class TestEscrowTemplates:
    def test_templates_endpoint_returns_three_templates(self, admin_token):
        r = requests.get(f"{API}/escrow/templates", headers=h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # could be list or dict{templates:[]}
        templates = data.get("templates", data) if isinstance(data, dict) else data
        ids = [t["id"] for t in templates]
        assert "real_estate" in ids
        assert "freelancer" in ids
        assert "supply_chain" in ids

    def test_supply_chain_template_has_six_milestones_and_parties(self, admin_token):
        r = requests.get(f"{API}/escrow/templates", headers=h(admin_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        templates = data.get("templates", data) if isinstance(data, dict) else data
        sc = next(t for t in templates if t["id"] == "supply_chain")
        # API summarises conditions as milestones count
        milestones_count = sc.get("milestones") or len(sc.get("conditions", []))
        assert milestones_count == 6, f"expected 6 supply_chain milestones, got {milestones_count}"
        dp = sc["default_parties"]
        assert "Buyer" in dp["buyer"] and "Importer" in dp["buyer"]
        assert "Supplier" in dp["seller"] and "Exporter" in dp["seller"]


# ───────────────────── 2. Create Supply-Chain Escrow + extract-conditions ─────────────────────
class TestSupplyChainEscrowFlow:
    escrow_id = None

    def test_create_supply_chain_escrow(self, admin_token):
        payload = {
            "escrow_type": "supply_chain",
            "title": "TEST_SC_Escrow",
            "parties": {
                "buyer": {"name": "Importer Inc", "email": "buyer@test.com"},
                "seller": {"name": "Exporter Ltd", "email": "seller@test.com"},
            },
            "financial": {"escrow_amount": 250000, "currency": "USD"},
            "description": "Test supply chain escrow",
        }
        r = requests.post(f"{API}/escrow/create", headers=h(admin_token), json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        eid = data.get("escrow_id") or (data.get("escrow") or {}).get("escrow_id") or data.get("id")
        assert eid, f"no escrow_id in response: {data}"
        TestSupplyChainEscrowFlow.escrow_id = eid

    def test_extract_conditions_supply_chain_fallback(self, admin_token):
        eid = TestSupplyChainEscrowFlow.escrow_id
        assert eid, "escrow_id not set"
        # POST with no document -> should fall back to _generate_mock_conditions
        r = requests.post(f"{API}/escrow/{eid}/extract-conditions", headers=h(admin_token), json={}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        conditions = data.get("conditions") or (data.get("escrow") or {}).get("conditions") or []
        assert len(conditions) == 6, f"Expected 6 conditions, got {len(conditions)}"
        titles = [c["title"] for c in conditions]
        expected_titles = [
            "Purchase Order Confirmation",
            "Production & Quality Inspection",
            "Shipment Dispatched",
            "Customs Clearance",
            "Delivery & Receipt of Goods",
            "Final Inspection & Acceptance",
        ]
        for exp in expected_titles:
            assert any(exp in t for t in titles), f"Missing '{exp}' in {titles}"


# ───────────────────── 3. Feature gate on /api/escrow/create ─────────────────────
class TestEscrowFeatureGate:
    def test_demo_user_blocked_by_escrow_intelligence_gate(self, demo_token):
        payload = {
            "escrow_type": "supply_chain",
            "title": "TEST_gate",
            "parties": {
                "buyer": {"name": "B", "email": "b@t.com"},
                "seller": {"name": "S", "email": "s@t.com"},
            },
            "financial": {"escrow_amount": 1000, "currency": "USD"},
        }
        r = requests.post(f"{API}/escrow/create", headers=h(demo_token), json=payload, timeout=30)
        # 403 expected from feature_gate for free tier user
        assert r.status_code in (402, 403), f"expected paywall, got {r.status_code}: {r.text}"


# ───────────────────── 4. Custom Domain Email ─────────────────────
class TestEmailCustomDomain:
    def test_email_status_custom_domain(self, admin_token):
        r = requests.get(f"{API}/email/status", headers=h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mode") == "custom_domain", f"mode={data.get('mode')}, full: {data}"
        active = data.get("active_sender") or data.get("sender_email")
        assert active == "noreply@email.notarychain.app", f"active_sender={active}"

    def test_email_domain_status_verified(self, admin_token):
        r = requests.get(f"{API}/email/domain-status", headers=h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("domain") == "email.notarychain.app", data
        assert data.get("verified") is True, f"domain not verified: {data}"

    def test_email_domain_status_admin_only(self, demo_token):
        r = requests.get(f"{API}/email/domain-status", headers=h(demo_token), timeout=30)
        assert r.status_code in (401, 403), f"expected admin-only block, got {r.status_code}"

    def test_email_test_welcome_send(self, admin_token):
        r = requests.post(
            f"{API}/email/test",
            headers=h(admin_token),
            json={"email_type": "welcome", "recipient_email": "admin@notarychain.com"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        result = data.get("result", data)
        assert result.get("success") is True, f"send failed: {data}"
        assert result.get("email_id") or result.get("id"), f"no email_id: {data}"


# ───────────────────── 5. Regression: existing endpoints ─────────────────────
class TestRegression:
    def test_auth_login_still_works(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
        assert r.status_code == 200

    def test_escrow_list(self, admin_token):
        r = requests.get(f"{API}/escrow/list", headers=h(admin_token), timeout=30)
        assert r.status_code == 200, r.text

    def test_subscription_status(self, admin_token):
        r = requests.get(f"{API}/subscriptions/current", headers=h(admin_token), timeout=30)
        assert r.status_code == 200, f"/subscriptions/current => {r.status_code} {r.text}"
        data = r.json()
        assert "subscription" in data or "plan_id" in data

    def test_hts_endpoints_available(self, admin_token):
        # hit a couple of common hts endpoints; at least one should be 200
        results = {}
        for path in ("/hts/tokens", "/hts/status", "/hts/mint-log", "/hts/escrow/tokens"):
            try:
                r = requests.get(f"{API}{path}", headers=h(admin_token), timeout=15)
                results[path] = r.status_code
            except Exception as e:
                results[path] = str(e)
        assert any(v == 200 for v in results.values()), f"No HTS endpoints returned 200: {results}"
