"""
Tests for iteration_123:
- Ceremony Video Vault: /by-references, /daily-webhook (PUBLIC), /ingest-daily/{room_id}
- Ceremony Video init relaxed: notary_request_id may be free-form
- Public verify /verify/{hash}
- FL Journal cookie-auth fix: GET/POST /api/fl/journal/entries works with HttpOnly access_token cookie
"""
import os
import uuid
import pytest
import requests

from credentials import BASE_URL, NOTARY_EMAIL, NOTARY_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD, UA_HEADERS


def _bearer_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    return s


def _login_bearer(s, email, password):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return tok


def _cookie_session(email, password):
    """Return session that holds only the HttpOnly access_token cookie (no Bearer header)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    # cookie should now be in jar; remove Authorization to force cookie-only auth
    cookies = {c.name: c.value for c in s.cookies}
    assert "access_token" in cookies, f"expected access_token cookie, got {list(cookies.keys())}"
    return s


# ─── Ceremony Video Vault: by-references ───
class TestByReferences:
    def test_by_references_empty(self):
        s = _bearer_session()
        _login_bearer(s, NOTARY_EMAIL, NOTARY_PASSWORD)
        r = s.post(f"{BASE_URL}/api/ceremony-videos/by-references", json={"reference_ids": []})
        assert r.status_code == 200
        assert r.json() == {"recordings": {}}

    def test_by_references_seeded(self):
        s = _bearer_session()
        _login_bearer(s, NOTARY_EMAIL, NOTARY_PASSWORD)
        # Known seeded ceremony per agent_to_agent_context_note
        seeded = "cer-rec-journal-1780399622"
        r = s.post(f"{BASE_URL}/api/ceremony-videos/by-references",
                   json={"reference_ids": [seeded, "nonexistent-ref"]})
        assert r.status_code == 200
        data = r.json()
        assert "recordings" in data
        # If seed exists for this notary, it should be returned; otherwise dict may be empty
        if seeded in data["recordings"]:
            rec = data["recordings"][seeded]
            assert "content_hash" in rec
            assert rec.get("status") == "anchored"
            assert "transaction_id" in rec
            # public verify with that hash
            h = rec["content_hash"]
            if h:
                vr = requests.get(f"{BASE_URL}/api/ceremony-videos/verify/{h}", headers=UA_HEADERS)
                assert vr.status_code == 200
                assert vr.json().get("verified") is True

    def test_by_references_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/ceremony-videos/by-references",
                          json={"reference_ids": ["x"]}, headers=UA_HEADERS)
        assert r.status_code in (401, 403)

    def test_by_references_other_user_does_not_leak(self):
        # demo user (not the uploader) should not see notary's seeded recording
        s = _bearer_session()
        _login_bearer(s, DEMO_EMAIL, DEMO_PASSWORD)
        r = s.post(f"{BASE_URL}/api/ceremony-videos/by-references",
                   json={"reference_ids": ["cer-rec-journal-1780399622"]})
        assert r.status_code == 200
        # demo user shouldn't be the uploader, so map should not include the ref
        assert "cer-rec-journal-1780399622" not in r.json().get("recordings", {})


# ─── Daily.co webhook (PUBLIC) ───
class TestDailyWebhook:
    def test_webhook_no_auth_required(self):
        r = requests.post(f"{BASE_URL}/api/ceremony-videos/daily-webhook",
                          json={"type": "recording.ready", "payload": {"room_name": "no-such-room"}},
                          headers=UA_HEADERS)
        assert r.status_code == 200
        assert r.json() == {"received": True}

    def test_webhook_handles_bad_json(self):
        r = requests.post(f"{BASE_URL}/api/ceremony-videos/daily-webhook",
                          data="not-json", headers={"Content-Type": "application/json", **UA_HEADERS})
        assert r.status_code == 200
        assert r.json() == {"received": True}

    def test_webhook_ignores_non_recording_event(self):
        r = requests.post(f"{BASE_URL}/api/ceremony-videos/daily-webhook",
                          json={"type": "meeting.started", "payload": {"room_name": "x"}},
                          headers=UA_HEADERS)
        assert r.status_code == 200
        assert r.json() == {"received": True}


# ─── Manual ingest-daily/{room_id} ───
class TestIngestDailyManual:
    def test_ingest_404_for_unknown_room(self):
        s = _bearer_session()
        _login_bearer(s, NOTARY_EMAIL, NOTARY_PASSWORD)
        r = s.post(f"{BASE_URL}/api/ceremony-videos/ingest-daily/{uuid.uuid4().hex}")
        assert r.status_code == 404

    def test_ingest_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/ceremony-videos/ingest-daily/anything",
                          headers=UA_HEADERS)
        assert r.status_code in (401, 403)


# ─── Ceremony video init: free-form notary_request_id should NOT 404 ───
class TestInitRelaxed:
    def test_init_with_freeform_reference(self):
        s = _bearer_session()
        _login_bearer(s, NOTARY_EMAIL, NOTARY_PASSWORD)
        body = {
            "file_name": "TEST_freeform.mp4",
            "content_type": "video/mp4",
            "notary_request_id": f"freeform-{uuid.uuid4().hex[:8]}",
        }
        r = s.post(f"{BASE_URL}/api/ceremony-videos/init", json=body)
        # If S3 not configured we expect 503; otherwise must NOT be 404 and must return video_id
        assert r.status_code in (200, 503), f"unexpected: {r.status_code} {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert "video_id" in data and "upload_id" in data and "s3_key" in data
            # cleanup: abort
            s.post(f"{BASE_URL}/api/ceremony-videos/{data['video_id']}/abort")


# ─── Public verify with malformed hash ───
class TestPublicVerify:
    def test_verify_invalid_format(self):
        r = requests.get(f"{BASE_URL}/api/ceremony-videos/verify/abc", headers=UA_HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body.get("verified") is False
        assert body.get("reason") == "invalid_hash_format"

    def test_verify_unknown_hash(self):
        h = "0" * 64
        r = requests.get(f"{BASE_URL}/api/ceremony-videos/verify/{h}", headers=UA_HEADERS)
        assert r.status_code == 200
        assert r.json().get("verified") is False


# ─── FL Journal cookie-auth fix ───
class TestFLJournalCookieAuth:
    def test_login_sets_access_token_cookie(self):
        s = _cookie_session(NOTARY_EMAIL, NOTARY_PASSWORD)
        cookies = {c.name: c.value for c in s.cookies}
        assert "access_token" in cookies

    def test_list_entries_with_cookie_only(self):
        s = _cookie_session(NOTARY_EMAIL, NOTARY_PASSWORD)
        # Explicitly no Authorization header
        r = s.get(f"{BASE_URL}/api/fl/journal/entries")
        assert r.status_code == 200, f"cookie-auth list failed: {r.status_code} {r.text}"
        data = r.json()
        assert "entries" in data and "total" in data
        assert isinstance(data["entries"], list)

    def test_create_entry_with_cookie_only(self):
        s = _cookie_session(NOTARY_EMAIL, NOTARY_PASSWORD)
        cer_id = f"TEST_cer_{uuid.uuid4().hex[:8]}"
        payload = {
            "ceremony_id": cer_id,
            "notarial_act_type": "acknowledgment",
            "document_description": "TEST cookie-auth journal entry",
            "signer_name": "TEST Signer",
            "signer_id_type": "DL",
            "signer_id_number_last4": "1234",
            "fee_charged_usd": 10.0,
        }
        r = s.post(f"{BASE_URL}/api/fl/journal/entries", json=payload)
        assert r.status_code == 200, f"cookie-auth create failed: {r.status_code} {r.text}"
        created = r.json()
        assert created["ceremony_id"] == cer_id
        assert created["notarial_act_type"] == "acknowledgment"
        assert "entry_id" in created
        # Verify persistence via list filter
        r2 = s.get(f"{BASE_URL}/api/fl/journal/entries", params={"ceremony_id": cer_id})
        assert r2.status_code == 200
        entries = r2.json().get("entries", [])
        assert any(e["entry_id"] == created["entry_id"] for e in entries)

    def test_no_cookie_no_bearer_rejected(self):
        r = requests.get(f"{BASE_URL}/api/fl/journal/entries", headers=UA_HEADERS)
        assert r.status_code == 401

    def test_bearer_fallback_still_works(self):
        # Backward compat: header-only should still work
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": NOTARY_EMAIL, "password": NOTARY_PASSWORD})
        assert r.status_code == 200
        tok = r.json().get("access_token")
        # New session: cookies dropped, only header
        s2 = requests.Session()
        s2.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {tok}",
            **UA_HEADERS,
        })
        r = s2.get(f"{BASE_URL}/api/fl/journal/entries")
        assert r.status_code == 200
