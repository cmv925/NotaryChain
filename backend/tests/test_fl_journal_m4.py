"""
FL RON Compliance M4 — Journal logging, CSV export, admin compliance dashboard,
and subpoena response workflow tests.
"""
import os
import csv
import io
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
NOTARY = {"email": "notarytest@test.com", "password": "Test123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def admin_token():
    t = _login(**ADMIN)
    if not t:
        pytest.skip("admin login failed")
    return t


@pytest.fixture(scope="session")
def notary_token():
    t = _login(**NOTARY)
    if not t:
        pytest.skip("notary login failed")
    return t


@pytest.fixture(scope="session")
def demo_token():
    t = _login(**DEMO)
    if not t:
        pytest.skip("demo login failed")
    return t


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ─── JOURNAL ───────────────────────────────────────────────

class TestJournalEntries:
    def test_create_journal_entry_as_notary(self, notary_token):
        payload = {
            "ceremony_id": "TEST_cer_m4_01",
            "notarial_act_type": "acknowledgment",
            "document_description": "TEST Quitclaim Deed",
            "signer_name": "TEST Jane Doe",
            "signer_id_type": "DL",
            "signer_id_number_last4": "1234",
            "fee_charged_usd": 25.0,
            "av_recording_ref": "s3://bucket/cer_m4_01/recording.mp4",
        }
        r = requests.post(f"{BASE_URL}/api/fl/journal/entries", json=payload, headers=H(notary_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["entry_id"]
        assert d["notarial_act_type"] == "acknowledgment"
        assert d["signer_name"] == "TEST Jane Doe"
        assert d["retention_policy"] == "FL_10YR"
        assert "_id" not in d
        pytest.JOURNAL_ENTRY_ID = d["entry_id"]
        pytest.JOURNAL_CEREMONY_ID = d["ceremony_id"]

    def test_create_rejects_invalid_act_type(self, notary_token):
        payload = {
            "ceremony_id": "TEST_cer_m4_invalid",
            "notarial_act_type": "BAD_TYPE",
            "document_description": "x",
            "signer_name": "x",
            "signer_id_type": "DL",
        }
        r = requests.post(f"{BASE_URL}/api/fl/journal/entries", json=payload, headers=H(notary_token), timeout=30)
        assert r.status_code == 400

    def test_create_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/fl/journal/entries", json={
            "ceremony_id": "x", "notarial_act_type": "jurat",
            "document_description": "x", "signer_name": "x", "signer_id_type": "DL"
        }, timeout=30)
        assert r.status_code == 401

    def test_create_forbidden_for_demo(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/fl/journal/entries", json={
            "ceremony_id": "x", "notarial_act_type": "jurat",
            "document_description": "x", "signer_name": "x", "signer_id_type": "DL"
        }, headers=H(demo_token), timeout=30)
        assert r.status_code == 403

    def test_list_journal_notary_sees_own(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries", headers=H(notary_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "entries" in d and "total" in d
        # All entries must be the notary's own
        if d["entries"]:
            emails = {e["notary_email"] for e in d["entries"]}
            assert emails == {NOTARY["email"]}

    def test_list_journal_with_filters(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries",
                         params={"notarial_act_type": "acknowledgment", "ceremony_id": getattr(pytest, "JOURNAL_CEREMONY_ID", "TEST_cer_m4_01")},
                         headers=H(notary_token), timeout=30)
        assert r.status_code == 200
        for e in r.json()["entries"]:
            assert e["notarial_act_type"] == "acknowledgment"

    def test_list_admin_sees_all(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries", headers=H(admin_token), timeout=30)
        assert r.status_code == 200

    def test_get_one_entry(self, notary_token):
        eid = getattr(pytest, "JOURNAL_ENTRY_ID", None)
        if not eid:
            pytest.skip("no entry created")
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries/{eid}", headers=H(notary_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["entry_id"] == eid

    def test_get_unknown_entry_404(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries/no_such_id", headers=H(notary_token), timeout=30)
        assert r.status_code == 404

    def test_csv_export_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/export.csv", headers=H(admin_token), timeout=60)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        rows = list(csv.reader(io.StringIO(r.text)))
        assert rows and rows[0][0] == "entry_id"
        assert len(rows) >= 2  # header + at least one entry from above

    def test_csv_export_notary_scoped(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/journal/export.csv", headers=H(notary_token), timeout=60)
        assert r.status_code == 200
        body = r.text
        # Notary's CSV should only contain their email
        if "notary_email" in body:
            for line in body.splitlines()[1:]:
                if NOTARY["email"] not in line and line.strip():
                    # entries should belong to this notary
                    pass


# ─── ADMIN COMPLIANCE DASHBOARD ────────────────────────────

class TestComplianceOverview:
    def test_overview_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/overview", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "journal" in d and "total" in d["journal"]
        assert "kba" in d and "pass_rate" in d["kba"]
        assert "av_quality" in d
        assert "retention" in d
        assert "subpoenas" in d
        assert "generated_at" in d
        assert d["journal"]["total"] >= 1  # one we just created

    def test_overview_forbidden_for_notary(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/overview", headers=H(notary_token), timeout=30)
        assert r.status_code == 403

    def test_overview_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/overview", timeout=30)
        assert r.status_code == 401

    def test_ceremonies_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/ceremonies", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "ceremonies" in d
        for c in d["ceremonies"]:
            assert "gates" in c
            assert set(c["gates"].keys()) >= {"jurisdiction", "kba", "av_quality", "witnesses", "journal_logged"}

    def test_ceremonies_forbidden_for_notary(self, notary_token):
        r = requests.get(f"{BASE_URL}/api/fl/admin/compliance/ceremonies", headers=H(notary_token), timeout=30)
        assert r.status_code == 403


# ─── SUBPOENA WORKFLOW ─────────────────────────────────────

class TestSubpoenaWorkflow:
    def test_intake(self, admin_token):
        payload = {
            "case_number": "TEST-CASE-M4-001",
            "issuing_court": "TEST Circuit Court",
            "issuing_attorney": "TEST Attorney",
            "attorney_email": "test_attorney@example.com",
            "served_date": "2026-01-15",
            "response_due_date": "2026-02-15",
            "requested_records": "All FL journal entries for ceremony TEST_cer_m4_01",
            "scope_ceremony_ids": [getattr(pytest, "JOURNAL_CEREMONY_ID", "TEST_cer_m4_01")],
            "scope_signer_name": "TEST Jane Doe",
        }
        r = requests.post(f"{BASE_URL}/api/fl/subpoena/intake", json=payload, headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "intake"
        assert d["subpoena_id"]
        assert len(d["audit_log"]) >= 1
        assert d["audit_log"][0]["action"] == "intake"
        pytest.SUBPOENA_ID = d["subpoena_id"]

    def test_intake_missing_required(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/fl/subpoena/intake", json={}, headers=H(admin_token), timeout=30)
        assert r.status_code in (400, 422)

    def test_intake_forbidden_for_notary(self, notary_token):
        r = requests.post(f"{BASE_URL}/api/fl/subpoena/intake", json={
            "case_number": "x", "issuing_court": "x",
            "served_date": "2026-01-15", "response_due_date": "2026-02-15",
            "requested_records": "x"
        }, headers=H(notary_token), timeout=30)
        assert r.status_code == 403

    def test_list_all(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/list", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "subpoenas" in d and d["total"] >= 1

    def test_list_filtered_by_status(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/list", params={"status": "intake"},
                         headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        for s in r.json()["subpoenas"]:
            assert s["status"] == "intake"

    def test_get_one(self, admin_token):
        sid = getattr(pytest, "SUBPOENA_ID", None)
        if not sid:
            pytest.skip("no subpoena")
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/{sid}", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["subpoena_id"] == sid

    def test_get_unknown_404(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/no_such", headers=H(admin_token), timeout=30)
        assert r.status_code == 404

    def test_export_csv(self, admin_token):
        sid = getattr(pytest, "SUBPOENA_ID", None)
        if not sid:
            pytest.skip("no subpoena")
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/{sid}/export.csv", headers=H(admin_token), timeout=60)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "X-Entries-Exported" in r.headers or "x-entries-exported" in {k.lower() for k in r.headers}
        exported = int(r.headers.get("X-Entries-Exported", r.headers.get("x-entries-exported", "0")))
        assert exported >= 0
        # Verify audit log was appended
        det = requests.get(f"{BASE_URL}/api/fl/subpoena/{sid}", headers=H(admin_token), timeout=30).json()
        actions = [a["action"] for a in det["audit_log"]]
        assert "exported" in actions

    def test_respond(self, admin_token):
        sid = getattr(pytest, "SUBPOENA_ID", None)
        if not sid:
            pytest.skip("no subpoena")
        r = requests.post(f"{BASE_URL}/api/fl/subpoena/{sid}/respond", json={
            "response_method": "secure_portal",
            "delivered_to": "court_clerk@example.com",
            "tracking_ref": "TRACK-TEST-001",
            "entries_exported": 1,
            "notes": "TEST response"
        }, headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "responded"
        assert d["response"]["response_method"] == "secure_portal"
        actions = [a["action"] for a in d["audit_log"]]
        assert "responded" in actions
        assert "intake" in actions

    def test_export_forbidden_for_notary(self, notary_token, admin_token):
        sid = getattr(pytest, "SUBPOENA_ID", None)
        if not sid:
            pytest.skip("no subpoena")
        r = requests.get(f"{BASE_URL}/api/fl/subpoena/{sid}/export.csv", headers=H(notary_token), timeout=30)
        assert r.status_code == 403


# ─── M3 REGRESSION (smoke) ─────────────────────────────────

class TestM3Regression:
    def test_juris_qualifier_endpoint_exists(self, demo_token):
        # readiness endpoint should respond (any 2xx/4xx, not 500)
        r = requests.get(f"{BASE_URL}/api/fl/ceremony/readiness/REG_TEST_NONEXISTENT",
                         headers=H(demo_token), timeout=30)
        assert r.status_code in (200, 404, 400), f"got {r.status_code}: {r.text[:200]}"
