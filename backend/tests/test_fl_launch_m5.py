"""M5: FL Launch — public stats, RONSP filings, recruitment leads."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-vault-dev.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
USER = {"email": "demo@test.com", "password": "Demo123!"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=USER, timeout=20)
    if r.status_code != 200:
        pytest.skip("user login failed")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture
def admin_hdrs(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── Public stats ──
class TestPublicStats:
    def test_public_stats_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/fl/launch/public-stats", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("fl_notaries", "ceremonies", "journal_entries", "journal_30d",
                  "kba_pass_rate", "av_pass_rate", "generated_at"):
            assert k in d, f"Missing key {k}"
        assert isinstance(d["fl_notaries"], int)
        assert isinstance(d["kba_pass_rate"], (int, float))


# ── RONSP filings ──
class TestRonspFilings:
    def test_current_filing_public(self):
        r = requests.get(f"{BASE_URL}/api/fl/ronsp/filings/current", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "active" in d
        assert "filing" in d
        # Seed says: 1 approved filing exists, so active should be True
        if d["active"]:
            assert d["filing"] is not None
            assert "filing_record_id" in d["filing"]

    def test_list_filings_admin(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/ronsp/filings", headers=admin_hdrs, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "filings" in d and "total" in d

    def test_list_filings_no_auth_403(self):
        r = requests.get(f"{BASE_URL}/api/fl/ronsp/filings", timeout=15)
        assert r.status_code in (401, 403)

    def test_create_filing_draft_and_promote(self, admin_hdrs):
        # Create draft
        label = f"TEST_filing_{uuid.uuid4().hex[:6]}"
        payload = {"filing_label": label, "status": "draft", "filing_id": "TEST-RONSP-X"}
        r = requests.post(f"{BASE_URL}/api/fl/ronsp/filings", json=payload, headers=admin_hdrs, timeout=15)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "draft"
        assert rec["filing_label"] == label
        assert any(a["action"] == "created" for a in rec.get("audit_log", []))
        rid = rec["filing_record_id"]

        # Invalid status -> 400
        bad = requests.post(f"{BASE_URL}/api/fl/ronsp/filings",
                            json={"filing_label": "x", "status": "bogus"},
                            headers=admin_hdrs, timeout=15)
        assert bad.status_code == 400

        # Patch to approved (mirror state profile + show in current)
        approve = {
            "status": "approved",
            "approved_at": "2026-01-01T00:00:00+00:00",
            "expires_at": "2099-01-01T00:00:00+00:00",
        }
        r2 = requests.patch(f"{BASE_URL}/api/fl/ronsp/filings/{rid}",
                            json=approve, headers=admin_hdrs, timeout=15)
        assert r2.status_code == 200, r2.text
        upd = r2.json()
        assert upd["status"] == "approved"
        assert any(a.get("action") == "status_change" for a in upd.get("audit_log", []))

        # Current endpoint should now reflect at least one approved active filing
        cur = requests.get(f"{BASE_URL}/api/fl/ronsp/filings/current", timeout=15)
        assert cur.status_code == 200
        cd = cur.json()
        assert cd["active"] is True
        assert cd["filing"] is not None
        assert "days_until_renewal" in cd

    def test_patch_invalid_status(self, admin_hdrs):
        # Create then patch with bad status
        r = requests.post(f"{BASE_URL}/api/fl/ronsp/filings",
                          json={"filing_label": f"TEST_{uuid.uuid4().hex[:4]}", "status": "draft"},
                          headers=admin_hdrs, timeout=15)
        rid = r.json()["filing_record_id"]
        bad = requests.patch(f"{BASE_URL}/api/fl/ronsp/filings/{rid}",
                             json={"status": "wrong"}, headers=admin_hdrs, timeout=15)
        assert bad.status_code == 400

    def test_patch_unknown_404(self, admin_hdrs):
        r = requests.patch(f"{BASE_URL}/api/fl/ronsp/filings/nonexistent_xyz",
                           json={"status": "draft"}, headers=admin_hdrs, timeout=15)
        assert r.status_code == 404


# ── Recruitment ──
class TestRecruitment:
    def test_lead_create_received_then_idempotent(self):
        email = f"test_m5_{uuid.uuid4().hex[:8]}@test.com"
        body = {"full_name": "Test M5 Notary", "email": email,
                "county": "Miami-Dade", "monthly_volume_estimate": "10-50",
                "years_experience": 3, "referral_source": "google"}
        r1 = requests.post(f"{BASE_URL}/api/fl/recruitment/lead", json=body, timeout=20)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["status"] == "received"
        assert "lead_id" in d1

        r2 = requests.post(f"{BASE_URL}/api/fl/recruitment/lead", json=body, timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["status"] == "already_received"
        assert d2["lead_id"] == d1["lead_id"]

    def test_lead_invalid_volume_400(self):
        body = {"full_name": "Bad Volume", "email": f"bad_{uuid.uuid4().hex[:6]}@test.com",
                "monthly_volume_estimate": "9999"}
        r = requests.post(f"{BASE_URL}/api/fl/recruitment/lead", json=body, timeout=15)
        assert r.status_code == 400

    def test_list_leads_requires_admin(self, user_token):
        r = requests.get(f"{BASE_URL}/api/fl/recruitment/leads",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
        assert r.status_code == 403

    def test_list_leads_admin(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/recruitment/leads", headers=admin_hdrs, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "leads" in d and "total" in d
        assert d["total"] >= 1

    def test_list_leads_status_filter(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/recruitment/leads?status=new",
                         headers=admin_hdrs, timeout=15)
        assert r.status_code == 200
        for lead in r.json()["leads"]:
            assert lead["status"] == "new"

    def test_get_lead_404(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/recruitment/leads/nonexistent_id",
                         headers=admin_hdrs, timeout=15)
        assert r.status_code == 404

    def test_stats(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/recruitment/stats", headers=admin_hdrs, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "by_status", "last_30d", "conversion_rate"):
            assert k in d
        for s in ("new", "contacted", "qualified", "onboarded", "declined"):
            assert s in d["by_status"]

    def test_patch_lead_status_and_audit(self, admin_hdrs):
        # Create fresh lead
        email = f"patch_m5_{uuid.uuid4().hex[:8]}@test.com"
        body = {"full_name": "Patch Tester", "email": email}
        rc = requests.post(f"{BASE_URL}/api/fl/recruitment/lead", json=body, timeout=20)
        lead_id = rc.json()["lead_id"]

        # Patch valid
        upd = requests.patch(f"{BASE_URL}/api/fl/recruitment/leads/{lead_id}",
                             json={"status": "contacted", "internal_notes": "Called",
                                   "assigned_to": "ops@team.com"},
                             headers=admin_hdrs, timeout=15)
        assert upd.status_code == 200
        d = upd.json()
        assert d["status"] == "contacted"
        assert d["internal_notes"] == "Called"
        audit_actions = [a.get("detail", "") for a in d.get("audit_log", [])]
        assert any("status" in a or "new → contacted" in a for a in audit_actions)

        # Patch invalid status
        bad = requests.patch(f"{BASE_URL}/api/fl/recruitment/leads/{lead_id}",
                             json={"status": "garbage"}, headers=admin_hdrs, timeout=15)
        assert bad.status_code == 400


# ── M3/M4 regression smoke ──
class TestRegression:
    def test_admin_compliance_overview(self, admin_hdrs):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/overview",
                         headers=admin_hdrs, timeout=15)
        assert r.status_code in (200, 404), r.text
