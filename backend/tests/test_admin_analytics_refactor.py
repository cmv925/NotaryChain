"""
Regression tests for admin analytics refactor (analytics_service.py)
and marketplace quote Pydantic validation.

Covers:
- GET /api/admin/analytics/comprehensive  (response shape, caching, days param)
- GET /api/admin/stats                    (smoke)
- GET /api/admin/users                    (smoke)
- GET /api/admin/notaries                 (smoke)
- GET /api/admin/notaries/pending         (smoke)
- GET /api/admin/analytics/revenue        (smoke)
- POST /api/marketplace/quote             (validation + valid path)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://acn-oracle-live.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


# ─── Fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    assert token, "no access_token in admin login response"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ─── Comprehensive analytics ──────────────────────────────────────────────
EXPECTED_TOP_KEYS = {
    "summary", "user_growth", "revenue_trends", "notarization_volume",
    "transaction_activity", "payment_distribution", "top_notaries",
    "document_types", "transaction_types",
}
EXPECTED_SUMMARY_KEYS = {
    "period_days", "total_revenue", "stripe_revenue", "crypto_revenue",
    "new_users", "total_notarizations", "completed_notarizations", "total_transactions",
}


@pytest.mark.parametrize("days", [7, 30, 90])
def test_comprehensive_analytics_shape(admin_headers, days):
    r = requests.get(
        f"{BASE_URL}/api/admin/analytics/comprehensive",
        params={"days": days},
        headers=admin_headers,
        timeout=60,
    )
    assert r.status_code == 200, f"days={days} -> {r.status_code} {r.text[:300]}"
    data = r.json()

    # Top-level keys
    missing = EXPECTED_TOP_KEYS - set(data.keys())
    assert not missing, f"missing top-level keys for days={days}: {missing}"

    # Summary keys
    summary = data["summary"]
    miss_sum = EXPECTED_SUMMARY_KEYS - set(summary.keys())
    assert not miss_sum, f"missing summary keys for days={days}: {miss_sum}"
    assert summary["period_days"] == days

    # Arrays length == days
    assert len(data["user_growth"]) == days, f"user_growth len {len(data['user_growth'])} != {days}"
    assert len(data["revenue_trends"]) == days, f"revenue_trends len {len(data['revenue_trends'])} != {days}"
    assert len(data["notarization_volume"]) == days
    assert len(data["transaction_activity"]) == days

    # revenue_trends entry shape
    for entry in data["revenue_trends"][:3]:
        assert set(entry.keys()) >= {"date", "stripe", "crypto", "total"}
        # sanity: total ~= stripe + crypto (rounded)
        assert abs(entry["total"] - (entry["stripe"] + entry["crypto"])) < 0.01

    # user_growth entry shape
    for entry in data["user_growth"][:3]:
        assert set(entry.keys()) >= {"date", "new_users", "total_users"}

    # Cross-consistency: summary totals should equal sums in arrays
    assert summary["new_users"] == sum(u["new_users"] for u in data["user_growth"])
    assert summary["total_notarizations"] == sum(n["total"] for n in data["notarization_volume"])
    assert summary["completed_notarizations"] == sum(n["completed"] for n in data["notarization_volume"])
    assert summary["total_transactions"] == sum(t["transactions"] for t in data["transaction_activity"])
    # revenue totals (allow small float drift)
    assert abs(summary["stripe_revenue"] - round(sum(r["stripe"] for r in data["revenue_trends"]), 2)) < 0.05
    assert abs(summary["crypto_revenue"] - round(sum(r["crypto"] for r in data["revenue_trends"]), 2)) < 0.05


def test_comprehensive_analytics_cache(admin_headers):
    """Second identical request should be served from cache and match payload."""
    url = f"{BASE_URL}/api/admin/analytics/comprehensive"
    r1 = requests.get(url, params={"days": 30}, headers=admin_headers, timeout=60)
    assert r1.status_code == 200
    t0 = time.perf_counter()
    r2 = requests.get(url, params={"days": 30}, headers=admin_headers, timeout=60)
    elapsed = time.perf_counter() - t0
    assert r2.status_code == 200
    assert r1.json() == r2.json(), "cached payload differs from initial response"
    # Cache should be fast; allow generous ceiling for network jitter
    assert elapsed < 5.0, f"cached call too slow: {elapsed:.2f}s"


def test_comprehensive_analytics_requires_auth():
    r = requests.get(
        f"{BASE_URL}/api/admin/analytics/comprehensive",
        params={"days": 30},
        timeout=30,
    )
    assert r.status_code in (401, 403), f"unexpected status without auth: {r.status_code}"


def test_comprehensive_analytics_days_validation(admin_headers):
    # days < 7 should be rejected
    r = requests.get(
        f"{BASE_URL}/api/admin/analytics/comprehensive",
        params={"days": 3},
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 422, f"expected 422 for days=3, got {r.status_code}"


# ─── Smoke tests on other admin endpoints ─────────────────────────────────
def test_admin_stats_smoke(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    assert isinstance(r.json(), dict)


def test_admin_users_smoke(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/users",
        params={"page_size": 10},
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    # Accept either a list or paginated dict
    assert isinstance(data, (list, dict))


def test_admin_notaries_smoke(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/notaries",
        params={"page_size": 10},
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text[:300]


def test_admin_notaries_pending_smoke(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/notaries/pending",
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text[:300]


def test_admin_analytics_revenue_smoke(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/analytics/revenue",
        params={"days": 30},
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text[:300]


# ─── Marketplace quote validation ─────────────────────────────────────────
@pytest.fixture(scope="module")
def approved_notary_id():
    r = requests.get(f"{BASE_URL}/api/marketplace/notaries", timeout=30)
    assert r.status_code == 200, f"could not list notaries: {r.status_code}"
    items = r.json().get("notaries") or []
    if not items:
        pytest.skip("no approved notaries available to quote against")
    return items[0]["notary_id"]


def _valid_payload(notary_id):
    return {
        "notary_id": notary_id,
        "state_code": "FL",
        "document_type": "real_estate",
        "urgency": "standard",
    }


def test_marketplace_quote_valid(approved_notary_id):
    r = requests.post(
        f"{BASE_URL}/api/marketplace/quote",
        json=_valid_payload(approved_notary_id),
        timeout=30,
    )
    assert r.status_code == 200, f"valid quote rejected: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert isinstance(data, dict)
    assert "total_usd" in data or any("total" in k for k in data.keys()), f"missing total in response: {data}"


def test_marketplace_quote_empty_state_code(approved_notary_id):
    payload = _valid_payload(approved_notary_id)
    payload["state_code"] = ""
    r = requests.post(f"{BASE_URL}/api/marketplace/quote", json=payload, timeout=30)
    assert r.status_code == 422, f"expected 422 for empty state_code, got {r.status_code} {r.text[:200]}"


def test_marketplace_quote_invalid_urgency(approved_notary_id):
    payload = _valid_payload(approved_notary_id)
    payload["urgency"] = "yesterday"  # not in Literal allowed set
    r = requests.post(f"{BASE_URL}/api/marketplace/quote", json=payload, timeout=30)
    assert r.status_code == 422, f"expected 422 for bad urgency, got {r.status_code} {r.text[:200]}"
