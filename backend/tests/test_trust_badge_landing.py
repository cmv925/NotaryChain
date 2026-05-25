"""
Backend tests for Trust Badge Landing — /api/subscriptions/checkout
Iteration 91: validate Stripe checkout session creation for pro/enterprise plans.
Plus regression on /api/verify/* endpoints (public).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://acn-oracle-live.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO_EMAIL, DEMO_PASSWORD)


# ----- /api/subscriptions/checkout tests -----

class TestSubscriptionCheckout:
    def test_checkout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          json={"plan_id": "pro", "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code in (401, 403), f"Expected auth failure, got {r.status_code}"

    def test_checkout_invalid_plan(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          headers={"Authorization": f"Bearer {demo_token}"},
                          json={"plan_id": "bogus", "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code == 400
        assert "Invalid plan" in r.json().get("detail", "")

    def test_checkout_free_plan_rejected(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          headers={"Authorization": f"Bearer {demo_token}"},
                          json={"plan_id": "free", "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code == 400
        assert "Free plan does not require payment" in r.json().get("detail", "")

    def test_checkout_pro_demo_user(self, demo_token):
        """Demo user is on free; should get a real Stripe checkout session for pro."""
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          headers={"Authorization": f"Bearer {demo_token}"},
                          json={"plan_id": "pro", "origin_url": "https://example.com"}, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        d = r.json()
        assert "checkout_url" in d
        assert d["checkout_url"].startswith("https://checkout.stripe.com"), f"bad URL: {d['checkout_url']}"
        assert d.get("session_id"), "session_id missing"
        assert d.get("plan", {}).get("id") == "pro"
        assert d.get("plan", {}).get("price") == 49.00

    def test_checkout_admin_already_on_enterprise(self, admin_token):
        """Admin already enterprise — expect 400 'already on this plan' for enterprise."""
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json={"plan_id": "enterprise", "origin_url": "https://example.com"}, timeout=30)
        # Either 400 already on plan, or 200 if admin isn't actually subscribed to enterprise.
        assert r.status_code in (200, 400)
        if r.status_code == 400:
            assert "already" in r.json().get("detail", "").lower()
        else:
            d = r.json()
            assert d["checkout_url"].startswith("https://checkout.stripe.com")

    def test_checkout_admin_pro(self, admin_token):
        """Admin on enterprise can still try to checkout for pro plan."""
        r = requests.post(f"{BASE_URL}/api/subscriptions/checkout",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json={"plan_id": "pro", "origin_url": "https://example.com"}, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com")
        assert d.get("session_id")


# ----- Regression: /api/verify/* still works -----

class TestVerifyRegression:
    def test_verify_document_invalid_hash(self):
        r = requests.get(f"{BASE_URL}/api/verify/document/notavalidhash", timeout=20)
        assert r.status_code == 400

    def test_verify_document_unknown_valid_hash(self):
        h = "a" * 64
        r = requests.get(f"{BASE_URL}/api/verify/document/{h}", timeout=20)
        assert r.status_code == 200
        assert r.json().get("verified") is False

    def test_verify_widget_js(self):
        r = requests.get(f"{BASE_URL}/api/verify/widget.js", timeout=20)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "").lower()

    def test_subscription_plans_public(self):
        r = requests.get(f"{BASE_URL}/api/subscriptions/plans", timeout=20)
        assert r.status_code == 200
        plans = r.json().get("plans", [])
        ids = {p["id"] for p in plans}
        assert {"free", "pro", "enterprise"}.issubset(ids)
