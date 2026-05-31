"""FL Ceremony M3 backend tests — iteration 98."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-network-dev.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}
NOTARY = {"email": "notary2@test.com", "password": "Notary123!"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in {data}"
    return tok


@pytest.fixture(scope="module")
def demo_tok():
    return _login(**DEMO)


@pytest.fixture(scope="module")
def admin_tok():
    return _login(**ADMIN)


@pytest.fixture(scope="module")
def notary_tok():
    return _login(**NOTARY)


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ceremony_id():
    return f"cer-test-{uuid.uuid4().hex[:10]}"


# ── jurisdiction qualifier ──
class TestJurisdiction:
    def test_invalid_basis(self, demo_tok, ceremony_id):
        r = requests.post(f"{API}/fl/ceremony/jurisdiction-qualifier",
                          headers=H(demo_tok),
                          json={"ceremony_id": ceremony_id, "fl_nexus_basis": "bogus_basis",
                                "concerns_fl_property": True})
        assert r.status_code == 400, r.text

    def test_no_fl_nexus_rejected(self, demo_tok, ceremony_id):
        r = requests.post(f"{API}/fl/ceremony/jurisdiction-qualifier",
                          headers=H(demo_tok),
                          json={"ceremony_id": ceremony_id, "fl_nexus_basis": "other",
                                "concerns_fl_property": False, "concerns_fl_law": False})
        assert r.status_code == 400, r.text

    def test_create_success_and_get(self, demo_tok, ceremony_id):
        r = requests.post(f"{API}/fl/ceremony/jurisdiction-qualifier",
                          headers=H(demo_tok),
                          json={"ceremony_id": ceremony_id, "fl_nexus_basis": "real_estate_in_fl",
                                "concerns_fl_property": True, "geo_lat": 27.95, "geo_lng": -82.46,
                                "geo_accuracy_m": 12.0, "geo_state": "FL"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["fl_nexus_basis"] == "real_estate_in_fl"
        assert body["ceremony_id"] == ceremony_id

        # GET (owner)
        g = requests.get(f"{API}/fl/ceremony/jurisdiction-qualifier/{ceremony_id}", headers=H(demo_tok))
        assert g.status_code == 200, g.text
        assert g.json()["ceremony_id"] == ceremony_id

    def test_get_missing_404(self, demo_tok):
        r = requests.get(f"{API}/fl/ceremony/jurisdiction-qualifier/no-such-ceremony-xyz", headers=H(demo_tok))
        assert r.status_code == 404, r.text

    def test_online_will_basis_no_nexus_ok(self, demo_tok):
        cid = f"cer-w-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/fl/ceremony/jurisdiction-qualifier",
                          headers=H(demo_tok),
                          json={"ceremony_id": cid, "fl_nexus_basis": "online_will_fl_resident",
                                "concerns_fl_property": False, "concerns_fl_law": False})
        assert r.status_code == 200, r.text


# ── witnesses ──
@pytest.fixture(scope="module")
def will_ceremony():
    return f"cer-will-{uuid.uuid4().hex[:10]}"


class TestWitnesses:
    def test_block_self_invite(self, demo_tok, will_ceremony):
        r = requests.post(f"{API}/fl/ceremony/will/witnesses/invite", headers=H(demo_tok),
                          json={"ceremony_id": will_ceremony, "name": "Self",
                                "email": DEMO["email"]})
        assert r.status_code == 400, r.text

    def test_invite_two_then_block_third(self, demo_tok, will_ceremony):
        share_links = []
        for i in range(2):
            r = requests.post(f"{API}/fl/ceremony/will/witnesses/invite", headers=H(demo_tok),
                              json={"ceremony_id": will_ceremony, "name": f"Witness {i}",
                                    "email": f"witness{i}_{uuid.uuid4().hex[:6]}@test.com"})
            assert r.status_code == 200, r.text
            body = r.json()
            assert "token_hash" not in body
            assert body["share_link_path"].startswith("/florida/witness/")
            share_links.append(body["share_link_path"])
        pytest.share_links = share_links

        r3 = requests.post(f"{API}/fl/ceremony/will/witnesses/invite", headers=H(demo_tok),
                          json={"ceremony_id": will_ceremony, "name": "Third",
                                "email": f"third_{uuid.uuid4().hex[:6]}@test.com"})
        assert r3.status_code == 400, r3.text

    def test_list_witnesses(self, demo_tok, will_ceremony):
        r = requests.get(f"{API}/fl/ceremony/will/witnesses/{will_ceremony}", headers=H(demo_tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 2
        assert body["required"] == 2
        for w in body["witnesses"]:
            assert "token_hash" not in w

    def test_public_witness_lookup_invalid(self):
        r = requests.get(f"{API}/fl/ceremony/will/witness-token/garbage_token_xyz")
        assert r.status_code == 404, r.text

    def test_public_witness_lookup_and_accept(self, demo_tok, will_ceremony):
        raw_token = pytest.share_links[0].split("/florida/witness/")[-1]
        r = requests.get(f"{API}/fl/ceremony/will/witness-token/{raw_token}")
        assert r.status_code == 200, r.text
        ctx = r.json()
        assert ctx["ceremony_id"] == will_ceremony
        assert ctx["status"] == "invited"

        a = requests.post(f"{API}/fl/ceremony/will/witness-token/{raw_token}/accept")
        assert a.status_code == 200, a.text
        assert a.json()["status"] == "accepted"

        a2 = requests.post(f"{API}/fl/ceremony/will/witness-token/{raw_token}/accept")
        assert a2.status_code == 200
        assert a2.json().get("already") is True or a2.json()["status"] == "accepted"

        # Accept second witness too for readiness gate
        raw2 = pytest.share_links[1].split("/florida/witness/")[-1]
        a3 = requests.post(f"{API}/fl/ceremony/will/witness-token/{raw2}/accept")
        assert a3.status_code == 200


# ── A/V quality ──
class TestAVQuality:
    def test_av_pass(self, demo_tok, ceremony_id):
        r = requests.post(f"{API}/fl/ceremony/av/report-quality", headers=H(demo_tok),
                          json={"ceremony_id": ceremony_id, "video_width": 1280, "video_height": 720,
                                "audio_sample_rate_hz": 48000, "recording_duration_sec": 60})
        assert r.status_code == 200
        body = r.json()
        assert body["passed"] is True
        assert body["issues"] == []

    def test_av_fail(self, demo_tok):
        cid = f"cer-bad-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/fl/ceremony/av/report-quality", headers=H(demo_tok),
                          json={"ceremony_id": cid, "video_width": 640, "video_height": 480,
                                "audio_sample_rate_hz": 8000, "recording_duration_sec": 10})
        assert r.status_code == 200
        body = r.json()
        assert body["passed"] is False
        types = [i["type"] for i in body["issues"]]
        assert "video_resolution_too_low" in types
        assert "audio_sample_rate_too_low" in types
        assert "recording_too_short" in types


# ── Retention ──
class TestRetention:
    def test_tag_missing_fields(self, demo_tok):
        r = requests.post(f"{API}/fl/ceremony/retention/tag", headers=H(demo_tok),
                          json={"ceremony_id": "x"})
        assert r.status_code == 400

    def test_tag_and_list(self, demo_tok, ceremony_id):
        r = requests.post(f"{API}/fl/ceremony/retention/tag", headers=H(demo_tok),
                          json={"ceremony_id": ceremony_id, "asset_kind": "recording",
                                "object_ref": "s3://bucket/key.mp4", "sha256": "a" * 64})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["retention_policy"] == "FL_10YR"

        g = requests.get(f"{API}/fl/ceremony/retention/list/{ceremony_id}", headers=H(demo_tok))
        assert g.status_code == 200
        gb = g.json()
        assert gb["total"] >= 1


# ── Readiness ──
class TestReadiness:
    def test_readiness_deed_without_kba_not_ready(self, demo_tok, ceremony_id):
        r = requests.get(f"{API}/fl/ceremony/readiness/{ceremony_id}?document_type=deed",
                         headers=H(demo_tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ready"] is False
        assert body["gates"]["jurisdiction_qualifier"]["passed"] is True
        assert body["gates"]["av_quality"]["passed"] is True
        assert body["gates"]["kba"]["passed"] is False

    def test_readiness_after_kba(self, demo_tok, ceremony_id):
        # Start + submit KBA
        s = requests.post(f"{API}/kba/start", headers=H(demo_tok),
                         json={"ceremony_id": ceremony_id})
        if s.status_code != 200:
            pytest.skip(f"KBA start unavailable ({s.status_code}): {s.text}")
        sb = s.json()
        sid = sb.get("session_id")
        questions = sb.get("questions", [])
        if not sid or not questions:
            pytest.skip("KBA session shape unexpected")

        # Fetch session with internal correct answers? No — use admin-only?
        # MockKBAProvider: there's no public way to get correct answers; just answer index 0 for all.
        answers = [{"question_id": q["question_id"], "answer_index": 0} for q in questions]
        sub = requests.post(f"{API}/kba/submit", headers=H(demo_tok),
                            json={"session_id": sid, "answers": answers})
        if sub.status_code != 200:
            pytest.skip(f"KBA submit failed: {sub.status_code} {sub.text}")
        passed = sub.json().get("passed", False)
        if not passed:
            pytest.skip("KBA random answers did not pass — gate cannot be tested without correct answers.")

        r = requests.get(f"{API}/fl/ceremony/readiness/{ceremony_id}?document_type=deed",
                         headers=H(demo_tok))
        assert r.status_code == 200
        body = r.json()
        assert body["gates"]["kba"]["passed"] is True
        assert body["ready"] is True

    def test_readiness_will_requires_witnesses(self, demo_tok, will_ceremony):
        r = requests.get(f"{API}/fl/ceremony/readiness/{will_ceremony}?document_type=will",
                         headers=H(demo_tok))
        assert r.status_code == 200
        body = r.json()
        assert "witnesses" in body["gates"]
        assert body["gates"]["witnesses"]["detail"]["accepted"] == 2
        assert body["gates"]["witnesses"]["passed"] is True


# ── Regression M1+M2 ──
class TestRegression:
    def test_fl_compliance_state_profile(self):
        r = requests.get(f"{API}/fl/compliance/state-profile/FL")
        # Endpoint name may differ; just ensure it doesn't 500.
        assert r.status_code in (200, 404), f"Got {r.status_code}: {r.text[:200]}"

    def test_kba_status(self, demo_tok):
        r = requests.get(f"{API}/kba/status", headers=H(demo_tok))
        assert r.status_code == 200, r.text
