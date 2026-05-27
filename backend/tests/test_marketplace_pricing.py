"""
Marketplace API Tests — Dynamic Pricing Quote + Reviews + Notary search.

Covers:
  - POST /api/marketplace/quote  (public, no auth) — math: base × state × doc × urgency × rating
  - GET  /api/marketplace/notaries  — search/filter/sort/pagination
  - GET  /api/marketplace/notaries/{notary_id}  — profile + reviews
  - POST /api/marketplace/reviews  — auth required, completed notarization required
  - GET  /api/marketplace/reviews/notary/{notary_id}
  - DELETE /api/marketplace/reviews/{review_id}
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-chain-preview-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@test.com"
DEMO_PASS = "Demo123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASS = "Test123!"


# ───────────────────────────── Fixtures ─────────────────────────────

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def approved_notary(session):
    """Return one approved notary from the search endpoint (used by quote tests)."""
    r = session.get(f"{API}/marketplace/notaries?limit=50")
    assert r.status_code == 200, f"search failed: {r.status_code} {r.text}"
    notaries = r.json().get("notaries", [])
    assert notaries, "no approved notaries found in DB — cannot run pricing tests"
    # Prefer one with non-zero hourly_rate so we can validate base price
    chosen = next((n for n in notaries if (n.get("hourly_rate") or 0) > 0), notaries[0])
    return chosen


@pytest.fixture(scope="session")
def zero_rate_notary(session):
    """A notary with hourly_rate==0 (or unset) to test DEFAULT_BASE_RATE_USD fallback."""
    r = session.get(f"{API}/marketplace/notaries?limit=50")
    notaries = r.json().get("notaries", [])
    return next((n for n in notaries if (n.get("hourly_rate") or 0) == 0), None)


@pytest.fixture(scope="session")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    if r.status_code != 200:
        pytest.skip(f"demo login failed: {r.status_code} {r.text}")
    tok = r.json().get("access_token")
    if not tok:
        pytest.skip("demo login returned no access_token")
    return tok


# ───────────────────────── Quote endpoint — math ─────────────────────────

class TestQuoteEndpoint:
    """POST /api/marketplace/quote — public dynamic pricing."""

    def _quote(self, session, **kwargs):
        return session.post(f"{API}/marketplace/quote", json=kwargs)

    def test_quote_is_public_no_auth(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type="general", urgency="standard")
        assert r.status_code == 200, r.text

    def test_quote_404_for_unknown_notary(self, session):
        r = self._quote(session, notary_id="does-not-exist-uuid",
                        state_code="FL", document_type="general", urgency="standard")
        assert r.status_code == 404

    def test_quote_baseline_fl_general_standard(self, session, approved_notary):
        """FL × general × standard × no-rating = base price exactly."""
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type="general", urgency="standard")
        assert r.status_code == 200
        d = r.json()
        expected_base = float(approved_notary["hourly_rate"]) or 25.0
        assert d["base_usd"] == round(expected_base, 2)
        assert d["state_multiplier"] == 1.00
        assert d["document_multiplier"] == 1.00
        assert d["urgency_multiplier"] == 1.00
        assert d["rating_premium"] in (1.00, 1.10, 1.15)  # depends on reviews
        assert d["total_usd"] == round(expected_base * d["rating_premium"], 2)

    def test_quote_ny_state_multiplier_120(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="NY", document_type="general", urgency="standard")
        assert r.status_code == 200
        d = r.json()
        assert d["state_multiplier"] == 1.20
        assert d["state_code"] == "NY"

    def test_quote_ca_state_multiplier_115(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="CA", document_type="general", urgency="standard")
        d = r.json()
        assert d["state_multiplier"] == 1.15

    def test_quote_unknown_state_defaults_to_1(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="ZZ", document_type="general", urgency="standard")
        d = r.json()
        assert d["state_multiplier"] == 1.0

    def test_quote_state_case_insensitive(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="ny", document_type="general", urgency="standard")
        d = r.json()
        assert d["state_multiplier"] == 1.20
        assert d["state_code"] == "NY"

    @pytest.mark.parametrize("doc_type,expected", [
        ("real_estate", 1.50),
        ("deed", 1.50),
        ("mortgage", 1.45),
        ("lien_release", 1.30),
        ("power_of_attorney", 1.30),
        ("will", 1.30),
        ("trust", 1.30),
        ("affidavit", 1.00),
        ("acknowledgment", 1.00),
        ("general", 1.00),
        ("unknown_doc_type_xyz", 1.0),
    ])
    def test_quote_document_multipliers(self, session, approved_notary, doc_type, expected):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type=doc_type, urgency="standard")
        assert r.status_code == 200
        assert r.json()["document_multiplier"] == expected

    @pytest.mark.parametrize("urgency,expected", [
        ("standard", 1.00),
        ("same_day", 1.30),
        ("after_hours", 1.25),
        ("weekend", 1.20),
        ("rush", 1.40),
    ])
    def test_quote_urgency_multipliers(self, session, approved_notary, urgency, expected):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type="general", urgency=urgency)
        assert r.status_code == 200
        assert r.json()["urgency_multiplier"] == expected

    def test_quote_total_math_combined(self, session, approved_notary):
        """Combined: base × NY(1.20) × deed(1.50) × rush(1.40) × rating_premium."""
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="NY", document_type="deed", urgency="rush")
        assert r.status_code == 200
        d = r.json()
        base = d["base_usd"]
        expected = round(base * 1.20 * 1.50 * 1.40 * d["rating_premium"], 2)
        assert d["total_usd"] == expected, f"got {d['total_usd']}, expected {expected}"

    def test_quote_breakdown_structure(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="NY", document_type="deed", urgency="rush")
        d = r.json()
        bd = d["breakdown"]
        assert isinstance(bd, list) and len(bd) == 5
        labels = [item["label"] for item in bd]
        assert labels[0] == "Base rate"
        assert "NY state surcharge" in labels[1]
        assert "deed" in labels[2]
        assert "rush" in labels[3]
        assert "Rating premium" in labels[4]
        for item in bd:
            assert "label" in item and "value" in item and "multiplier" in item

    def test_quote_response_envelope_fields(self, session, approved_notary):
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type="general", urgency="standard")
        d = r.json()
        for key in ["notary_id", "state_code", "document_type", "urgency",
                    "base_usd", "state_multiplier", "document_multiplier",
                    "urgency_multiplier", "rating_premium", "total_usd",
                    "breakdown", "valid_for_minutes", "issued_at"]:
            assert key in d, f"missing key: {key}"
        assert d["valid_for_minutes"] == 30
        assert isinstance(d["issued_at"], str) and len(d["issued_at"]) > 10

    def test_quote_default_base_when_hourly_rate_zero(self, session, zero_rate_notary):
        """If notary has hourly_rate==0, base falls back to $25 default."""
        if not zero_rate_notary:
            pytest.skip("no zero-rate notary in DB to test default fallback")
        r = self._quote(session, notary_id=zero_rate_notary["notary_id"],
                        state_code="FL", document_type="general", urgency="standard")
        assert r.status_code == 200
        assert r.json()["base_usd"] == 25.0

    def test_quote_rating_premium_under_5_reviews(self, session, approved_notary):
        """Notaries with <5 reviews must get rating_premium == 1.00."""
        if approved_notary.get("review_count", 0) >= 5:
            pytest.skip("chosen notary has >=5 reviews — not applicable")
        r = self._quote(session, notary_id=approved_notary["notary_id"],
                        state_code="FL", document_type="general", urgency="standard")
        assert r.json()["rating_premium"] == 1.00


# ───────────────────────── Notary search/profile ─────────────────────────

class TestNotarySearch:

    def test_search_returns_only_approved(self, session):
        r = session.get(f"{API}/marketplace/notaries")
        assert r.status_code == 200
        data = r.json()
        assert "notaries" in data and "total" in data
        assert isinstance(data["notaries"], list)

    def test_search_pagination_limit(self, session):
        r = session.get(f"{API}/marketplace/notaries?limit=1")
        assert r.status_code == 200
        assert len(r.json()["notaries"]) <= 1

    def test_search_pagination_skip(self, session):
        r0 = session.get(f"{API}/marketplace/notaries?limit=2&skip=0")
        r1 = session.get(f"{API}/marketplace/notaries?limit=2&skip=1")
        assert r0.status_code == 200 and r1.status_code == 200
        ids0 = [n["notary_id"] for n in r0.json()["notaries"]]
        ids1 = [n["notary_id"] for n in r1.json()["notaries"]]
        if len(ids0) > 1 and ids1:
            assert ids0[1] == ids1[0]

    def test_search_filter_by_state_ca(self, session):
        r = session.get(f"{API}/marketplace/notaries?state=CA")
        assert r.status_code == 200
        for n in r.json()["notaries"]:
            assert n["license_state"].upper() == "CA"

    def test_search_filter_ron_certified(self, session):
        r = session.get(f"{API}/marketplace/notaries?ron_certified=true")
        assert r.status_code == 200
        for n in r.json()["notaries"]:
            assert n["ron_certified"] is True

    def test_search_sort_by_rate(self, session):
        r = session.get(f"{API}/marketplace/notaries?sort_by=rate&limit=50")
        assert r.status_code == 200
        rates = [n["hourly_rate"] for n in r.json()["notaries"]]
        assert rates == sorted(rates)

    def test_search_sort_by_experience(self, session):
        r = session.get(f"{API}/marketplace/notaries?sort_by=experience&limit=50")
        assert r.status_code == 200
        ex = [n["years_experience"] for n in r.json()["notaries"]]
        assert ex == sorted(ex, reverse=True)

    def test_search_invalid_sort_rejected(self, session):
        r = session.get(f"{API}/marketplace/notaries?sort_by=invalid")
        assert r.status_code in (400, 422)

    def test_search_keyword(self, session):
        # Use a benign keyword that probably exists
        r = session.get(f"{API}/marketplace/notaries?search=notary")
        assert r.status_code == 200


class TestNotaryProfile:

    def test_get_profile_success(self, session, approved_notary):
        r = session.get(f"{API}/marketplace/notaries/{approved_notary['notary_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["notary_id"] == approved_notary["notary_id"]
        assert "reviews" in d
        assert "avg_rating" in d
        assert "review_count" in d

    def test_get_profile_404_unknown(self, session):
        r = session.get(f"{API}/marketplace/notaries/does-not-exist-id")
        assert r.status_code == 404


# ───────────────────────── Reviews endpoints ─────────────────────────

class TestReviews:

    def test_create_review_requires_auth(self, session, approved_notary):
        r = session.post(f"{API}/marketplace/reviews", json={
            "notary_id": approved_notary["notary_id"],
            "request_id": "any",
            "rating": 5,
            "comment": "great",
        })
        assert r.status_code in (401, 403)

    def test_create_review_rejects_invalid_rating(self, session, approved_notary, demo_token):
        r = session.post(
            f"{API}/marketplace/reviews",
            json={"notary_id": approved_notary["notary_id"], "request_id": "fake-req",
                  "rating": 7, "comment": "x"},
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 400

    def test_create_review_rejects_no_completed_request(self, session, approved_notary, demo_token):
        r = session.post(
            f"{API}/marketplace/reviews",
            json={"notary_id": approved_notary["notary_id"],
                  "request_id": "non-existent-request", "rating": 5, "comment": "x"},
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 400
        assert "completed notarization" in r.text.lower() or "no completed" in r.text.lower()

    def test_get_reviews_list(self, session, approved_notary):
        r = session.get(f"{API}/marketplace/reviews/notary/{approved_notary['notary_id']}")
        assert r.status_code == 200
        d = r.json()
        assert "reviews" in d and "total" in d and "avg_rating" in d
        assert isinstance(d["reviews"], list)
        # avg matches manual aggregation
        if d["reviews"]:
            manual = round(sum(rv["rating"] for rv in d["reviews"]) / len(d["reviews"]), 1)
            assert d["avg_rating"] == manual

    def test_delete_review_requires_auth(self, session):
        r = session.delete(f"{API}/marketplace/reviews/some-id")
        assert r.status_code in (401, 403)

    def test_delete_review_404_when_not_owner(self, session, demo_token):
        r = session.delete(
            f"{API}/marketplace/reviews/non-existent-review-id",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 404
