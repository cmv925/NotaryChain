"""Iter 92 — Public notary directory & profile endpoints (no auth)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-vault-dev.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


# ---------- /api/verify/notaries (public list) ----------

class TestNotaryDirectoryList:
    def test_list_default(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notaries", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "limit", "offset", "notaries"):
            assert k in d, f"missing {k}"
        assert isinstance(d["notaries"], list)
        assert d["limit"] == 50
        assert d["offset"] == 0
        assert d["total"] >= 0
        if d["notaries"]:
            n = d["notaries"][0]
            for k in ("notary_id", "name", "license_number", "license_state",
                     "license_expiration", "bond_amount_usd", "bond_active",
                     "total_seals", "joined_at"):
                assert k in n, f"missing notary field {k}"

    def test_list_no_auth_required(self, session):
        # Explicitly no auth header — should still return 200
        r = requests.get(f"{BASE_URL}/api/verify/notaries", timeout=20)
        assert r.status_code == 200

    def test_limit_capped_at_200(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"limit": 9999}, timeout=20)
        assert r.status_code == 200
        assert r.json()["limit"] == 200

    def test_limit_min_1(self, session):
        # FastAPI accepts limit=0 as int but server caps to >=1
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"limit": 0}, timeout=20)
        assert r.status_code == 200
        assert r.json()["limit"] == 1

    def test_offset_negative_clamped(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"offset": -10}, timeout=20)
        assert r.status_code == 200
        assert r.json()["offset"] == 0

    def test_state_filter_uppercase(self, session):
        # Lowercase state should still be matched (server uppercases)
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"state": "ca"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for n in d["notaries"]:
            if n.get("license_state"):
                assert n["license_state"] == "CA"

    def test_state_filter_no_match(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"state": "ZZ"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["total"] == 0
        assert r.json()["notaries"] == []

    def test_q_search_empty_match(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notaries", params={"q": "ZZZ_XYZ_NEVER_EXISTS_QQQ"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_q_case_insensitive_name(self, session):
        # First, get all notaries to find a name to search for
        r = session.get(f"{BASE_URL}/api/verify/notaries", timeout=20)
        assert r.status_code == 200
        notaries = r.json()["notaries"]
        if not notaries:
            pytest.skip("No notaries seeded")
        first_name = (notaries[0]["name"] or "").split()[0] if notaries[0].get("name") else None
        if not first_name or first_name == "—":
            pytest.skip("No usable name fragment")
        # Search lowercase
        r2 = session.get(f"{BASE_URL}/api/verify/notaries", params={"q": first_name.lower()}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1

    def test_pagination_offset(self, session):
        r1 = session.get(f"{BASE_URL}/api/verify/notaries", params={"limit": 1, "offset": 0}, timeout=20)
        assert r1.status_code == 200
        d1 = r1.json()
        if d1["total"] < 2:
            pytest.skip("Need >=2 notaries for pagination test")
        r2 = session.get(f"{BASE_URL}/api/verify/notaries", params={"limit": 1, "offset": 1}, timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d1["notaries"][0]["notary_id"] != d2["notaries"][0]["notary_id"]


# ---------- /api/verify/notary/{id} (public profile) ----------

class TestNotaryPublicProfile:
    def test_get_known_notary(self, session):
        # Find a notary id from the directory
        r = session.get(f"{BASE_URL}/api/verify/notaries", timeout=20)
        assert r.status_code == 200
        notaries = r.json()["notaries"]
        if not notaries:
            pytest.skip("No notaries seeded")
        nid = notaries[0]["notary_id"]
        r2 = session.get(f"{BASE_URL}/api/verify/notary/{nid}", timeout=20)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["verified"] is True
        assert d["notary_id"] == nid
        for k in ("name", "role", "license_number", "license_state", "stats", "active"):
            assert k in d
        for k in ("total_seals", "total_ceremonies", "active_fraud_flags"):
            assert k in d["stats"]

    def test_get_unknown_notary_404(self, session):
        r = session.get(f"{BASE_URL}/api/verify/notary/does-not-exist-xyz-123", timeout=20)
        assert r.status_code == 404

    def test_no_auth_required(self):
        r = requests.get(f"{BASE_URL}/api/verify/notaries", timeout=20)
        assert r.status_code == 200
        notaries = r.json()["notaries"]
        if not notaries:
            pytest.skip("No notaries seeded")
        nid = notaries[0]["notary_id"]
        r2 = requests.get(f"{BASE_URL}/api/verify/notary/{nid}", timeout=20)
        assert r2.status_code == 200


# ---------- regression on existing public routes ----------

class TestPublicRouteRegression:
    def test_widget_js(self, session):
        r = session.get(f"{BASE_URL}/api/verify/widget.js", timeout=20)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "")

    def test_invalid_doc_hash(self, session):
        r = session.get(f"{BASE_URL}/api/verify/document/invalid", timeout=20)
        assert r.status_code == 400
