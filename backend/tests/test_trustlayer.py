"""TrustLayer Phase 1 MVP — comprehensive endpoint tests"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-fl-m3.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO)


@pytest.fixture(scope="module")
def demo_user_id(demo_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def created_partner(admin_token):
    payload = {"name": f"TEST_Partner_{os.urandom(3).hex()}", "domain": "test-kyc.com",
               "description": "TEST partner for pytest"}
    r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                      json=payload, headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "api_key" in data and data["api_key"].startswith("tl_")
    assert "api_key_hash" not in data
    assert "api_key_preview" in data
    return data


# ── Admin partner CRUD ──
class TestPartnerAdmin:
    def test_create_returns_api_key_once(self, created_partner):
        assert created_partner["status"] == "active"
        assert created_partner["partner_id"]
        assert "api_key_hash" not in created_partner

    def test_list_partners_admin(self, admin_token, created_partner):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        ids = [p["partner_id"] for p in data["partners"]]
        assert created_partner["partner_id"] in ids
        for p in data["partners"]:
            assert "api_key_hash" not in p

    def test_list_partners_unauth(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners", timeout=15)
        assert r.status_code == 401

    def test_list_partners_non_admin(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners",
                         headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        assert r.status_code == 403


# ── Partner attestations ──
class TestAttestations:
    def test_create_without_key_401(self, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id, "claim_type": "kyc_passed"}, timeout=15)
        assert r.status_code == 401

    def test_create_with_wrong_key_401(self, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id, "claim_type": "kyc_passed"},
                          headers={"X-TrustLayer-Key": "tl_invalid_key_xxx"}, timeout=15)
        assert r.status_code == 401

    def test_create_subject_not_found(self, created_partner):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": "no-such-user-xyz", "claim_type": "kyc_passed"},
                          headers={"X-TrustLayer-Key": created_partner["api_key"]}, timeout=15)
        assert r.status_code == 404

    def test_create_attestation_ok(self, created_partner, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id, "claim_type": "kyc_passed",
                                "claim_value": "passport+address"},
                          headers={"X-TrustLayer-Key": created_partner["api_key"]}, timeout=15)
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["partner_id"] == created_partner["partner_id"]
        assert a["claim_type"] == "kyc_passed"
        assert a["revoked"] is False
        pytest.attestation_id = a["attestation_id"]

    def test_trust_graph_public(self, demo_user_id, created_partner):
        r = requests.get(f"{BASE_URL}/api/trustlayer/trust-graph/{demo_user_id}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["subject"]["user_id"] == demo_user_id
        assert isinstance(d["trust_score"], int)
        assert 0 <= d["trust_score"] <= 100
        assert d["attestations_active"] >= 1
        ids = [a["attestation_id"] for a in d["attestations"]]
        assert pytest.attestation_id in ids
        for a in d["attestations"]:
            assert "active" in a

    def test_partner_verify_increments_stat(self, created_partner, demo_user_id, admin_token):
        # baseline
        r0 = requests.get(f"{BASE_URL}/api/trustlayer/partners",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        before = next(p for p in r0.json()["partners"] if p["partner_id"] == created_partner["partner_id"])
        b = before["stats"].get("verifications_served", 0)
        r = requests.post(f"{BASE_URL}/api/trustlayer/verify",
                          json={"subject_user_id": demo_user_id},
                          headers={"X-TrustLayer-Key": created_partner["api_key"]}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["subject"]["user_id"] == demo_user_id
        r1 = requests.get(f"{BASE_URL}/api/trustlayer/partners",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        after = next(p for p in r1.json()["partners"] if p["partner_id"] == created_partner["partner_id"])
        assert after["stats"]["verifications_served"] == b + 1

    def test_revoke_other_partner_403(self, admin_token, demo_user_id):
        # create second partner
        r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                          json={"name": f"TEST_Other_{os.urandom(3).hex()}", "domain": "other.com"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        other = r.json()
        rr = requests.delete(f"{BASE_URL}/api/trustlayer/attestations/{pytest.attestation_id}",
                             headers={"X-TrustLayer-Key": other["api_key"]}, timeout=15)
        assert rr.status_code == 403

    def test_revoke_own_then_inactive(self, created_partner, demo_user_id):
        r = requests.delete(f"{BASE_URL}/api/trustlayer/attestations/{pytest.attestation_id}",
                            headers={"X-TrustLayer-Key": created_partner["api_key"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["revoked"] is True
        g = requests.get(f"{BASE_URL}/api/trustlayer/trust-graph/{demo_user_id}", timeout=15).json()
        match = [a for a in g["attestations"] if a["attestation_id"] == pytest.attestation_id]
        assert match and match[0]["active"] is False


# ── Rotate & status ──
class TestRotateAndStatus:
    def test_rotate_invalidates_old(self, admin_token, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                          json={"name": f"TEST_Rotate_{os.urandom(3).hex()}", "domain": "rot.com"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        old = r.json()["api_key"]
        pid = r.json()["partner_id"]
        rr = requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/rotate-key",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rr.status_code == 200
        new_key = rr.json()["api_key"]
        assert new_key != old
        # old key should now fail
        a = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id, "claim_type": "x"},
                          headers={"X-TrustLayer-Key": old}, timeout=15)
        assert a.status_code == 401
        # new key works
        a2 = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                           json={"subject_user_id": demo_user_id, "claim_type": "test_claim"},
                           headers={"X-TrustLayer-Key": new_key}, timeout=15)
        assert a2.status_code == 200

    def test_disable_blocks_partner(self, admin_token, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                          json={"name": f"TEST_Dis_{os.urandom(3).hex()}", "domain": "dis.com"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        key = r.json()["api_key"]
        pid = r.json()["partner_id"]
        rr = requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/status",
                           json={"status": "disabled"},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rr.status_code == 200
        a = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id, "claim_type": "x"},
                          headers={"X-TrustLayer-Key": key}, timeout=15)
        assert a.status_code == 403
        # disabled should not appear in public list
        pub = requests.get(f"{BASE_URL}/api/trustlayer/partners/public", timeout=15).json()
        assert pid not in [p["partner_id"] for p in pub["partners"]]


# ── Public + SDK ──
class TestPublic:
    def test_partners_public(self, created_partner):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners/public", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for p in d["partners"]:
            assert "api_key_hash" not in p
            assert "api_key_preview" not in p

    def test_badge_for_user(self, demo_user_id):
        r = requests.get(f"{BASE_URL}/api/trustlayer/badge/{demo_user_id}.svg", timeout=15)
        assert r.status_code == 200
        assert "image/svg+xml" in r.headers["content-type"]
        assert "<svg" in r.text

    def test_badge_for_unknown(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/badge/no-such-user-xyz.svg", timeout=15)
        assert r.status_code == 200
        assert "image/svg+xml" in r.headers["content-type"]
        assert "UNVERIFIED" in r.text

    def test_sdk_js(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/sdk.js", timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        assert "/api/trustlayer/badge/" in r.text

    def test_trust_graph_invalid_user(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/trust-graph/no-such-user-xyz", timeout=15)
        assert r.status_code == 404
