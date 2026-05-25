"""Tests for Embeddable SDK Phase 1 (M1-M5)."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://acn-oracle-live.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
FREE = {"email": "demo@test.com", "password": "Demo123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def free_token():
    return _login(FREE)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def free_h(free_token):
    return {"Authorization": f"Bearer {free_token}"}


# M1 — SDK loader JS
def test_sdk_loader_js_served():
    r = requests.get(f"{BASE_URL}/api/sdk/v1/notarychain.js", timeout=30)
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "javascript" in ct.lower(), f"bad content-type: {ct}"
    body = r.text
    assert "NotaryChain" in body
    assert "startCeremony" in body
    assert "publishableKey" in body


# M5 — Demo key endpoint, idempotent
def test_demo_key_idempotent():
    r1 = requests.get(f"{BASE_URL}/api/sdk/demo-key", timeout=30)
    assert r1.status_code == 200
    k1 = r1.json()["publishable_key"]
    assert k1.startswith("pk_test_DEMO")
    r2 = requests.get(f"{BASE_URL}/api/sdk/demo-key", timeout=30)
    assert r2.status_code == 200
    assert r2.json()["publishable_key"] == k1, "Demo key should be idempotent"


# M3 — Subscription gate: free user blocked
def test_create_key_free_user_blocked(free_h):
    r = requests.post(
        f"{BASE_URL}/api/sdk/keys",
        headers=free_h,
        json={"name": "TEST_free_key", "mode": "test"},
        timeout=30,
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", body)
    # upgrade_required marker should appear somewhere
    text = str(detail).lower()
    assert "upgrade" in text or "pro" in text or "gate" in text or "subscription" in text


# M3 — Admin can create key
@pytest.fixture(scope="module")
def admin_key(admin_h):
    r = requests.post(
        f"{BASE_URL}/api/sdk/keys",
        headers=admin_h,
        json={"name": "TEST_admin_key", "mode": "test", "allowed_origins": []},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin key create failed: {r.text}"
    d = r.json()
    assert d["publishable_key"].startswith("pk_test_")
    assert d["active"] is True
    return d


def test_admin_create_key(admin_key):
    assert admin_key["mode"] == "test"
    assert "id" in admin_key


def test_list_keys(admin_h, admin_key):
    r = requests.get(f"{BASE_URL}/api/sdk/keys", headers=admin_h, timeout=30)
    assert r.status_code == 200
    keys = r.json()["keys"]
    assert any(k["id"] == admin_key["id"] for k in keys)


# M2 — Session creation
def test_session_missing_pk():
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions",
        json={"document_name": "TEST"},
        timeout=30,
    )
    assert r.status_code == 401


def test_session_invalid_pk():
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions",
        headers={"X-Publishable-Key": "pk_test_INVALID_xxx"},
        json={"document_name": "TEST"},
        timeout=30,
    )
    assert r.status_code == 401


@pytest.fixture(scope="module")
def session_token(admin_key):
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions",
        headers={"X-Publishable-Key": admin_key["publishable_key"]},
        json={"document_name": "TEST_Doc", "document_type": "general"},
        timeout=30,
    )
    assert r.status_code == 200, f"Session create failed: {r.text}"
    return r.json()["session_token"]


def test_create_session(session_token):
    assert session_token and len(session_token) > 20


# Origin allowlist enforcement
def test_origin_allowlist_blocks_disallowed(admin_h):
    # create a key with restricted origin
    r = requests.post(
        f"{BASE_URL}/api/sdk/keys",
        headers=admin_h,
        json={"name": "TEST_restricted", "mode": "test", "allowed_origins": ["allowed.com"]},
        timeout=30,
    )
    assert r.status_code == 200
    pk = r.json()["publishable_key"]
    key_id = r.json()["id"]

    # try with disallowed origin
    r2 = requests.post(
        f"{BASE_URL}/api/sdk/sessions",
        headers={"X-Publishable-Key": pk, "Origin": "https://evil.com"},
        json={"document_name": "TEST"},
        timeout=30,
    )
    assert r2.status_code == 403, f"Expected 403, got {r2.status_code}: {r2.text}"

    # allowed origin: kube ingress rewrites the Origin header to the cluster URL,
    # so we cannot reliably test the positive allowed-origin path through the proxy.
    # The negative (block) path above is the meaningful assertion.

    # revoke
    requests.delete(f"{BASE_URL}/api/sdk/keys/{key_id}", headers=admin_h, timeout=30)


def test_get_session_public(session_token):
    r = requests.get(f"{BASE_URL}/api/sdk/sessions/{session_token}", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] in ("created", "in_progress", "completed", "sealed")
    assert d["document_name"] == "TEST_Doc"
    assert d["mode"] == "test"


def test_event_transitions(session_token):
    # start
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions/{session_token}/event",
        json={"type": "ceremony.started", "payload": {"ceremony_id": "cer_TEST"}},
        timeout=30,
    )
    assert r.status_code == 200

    # completed
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions/{session_token}/event",
        json={"type": "ceremony.completed", "payload": {"seal_hash": "0xabc"}},
        timeout=30,
    )
    assert r.status_code == 200

    # sealed
    r = requests.post(
        f"{BASE_URL}/api/sdk/sessions/{session_token}/event",
        json={"type": "ceremony.sealed", "payload": {"seal_hash": "0xabc", "hcs_tx": "0.0.123@1.2"}},
        timeout=30,
    )
    assert r.status_code == 200

    # verify status sealed
    r2 = requests.get(f"{BASE_URL}/api/sdk/sessions/{session_token}", timeout=30)
    assert r2.json()["status"] == "sealed"
    assert r2.json()["seal_hash"] == "0xabc"


# M4 — Webhooks
def test_webhook_free_user_blocked(free_h):
    r = requests.post(
        f"{BASE_URL}/api/sdk/webhooks",
        headers=free_h,
        json={"url": "https://httpbin.org/post", "events": ["ceremony.sealed"]},
        timeout=30,
    )
    assert r.status_code == 403


@pytest.fixture(scope="module")
def webhook(admin_h):
    r = requests.post(
        f"{BASE_URL}/api/sdk/webhooks",
        headers=admin_h,
        json={"url": "https://httpbin.org/post", "events": ["ceremony.completed", "ceremony.sealed"]},
        timeout=30,
    )
    assert r.status_code == 200
    return r.json()


def test_webhook_create(webhook):
    assert webhook["active"] is True
    assert "secret" in webhook


def test_webhook_list(admin_h, webhook):
    r = requests.get(f"{BASE_URL}/api/sdk/webhooks", headers=admin_h, timeout=30)
    assert r.status_code == 200
    assert any(w["id"] == webhook["id"] for w in r.json()["webhooks"])


def test_webhook_delete(admin_h, webhook):
    r = requests.delete(f"{BASE_URL}/api/sdk/webhooks/{webhook['id']}", headers=admin_h, timeout=30)
    assert r.status_code == 200


def test_webhook_bad_url(admin_h):
    r = requests.post(
        f"{BASE_URL}/api/sdk/webhooks",
        headers=admin_h,
        json={"url": "not-a-url", "events": ["ceremony.sealed"]},
        timeout=30,
    )
    assert r.status_code == 400


# Usage endpoint
def test_usage(admin_h):
    r = requests.get(f"{BASE_URL}/api/sdk/usage", headers=admin_h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "sessions_30d" in d
    assert "sealed_30d" in d
    assert "keys" in d
    assert isinstance(d["keys"], list)


# Revoke key
def test_revoke_key(admin_h, admin_key):
    r = requests.delete(f"{BASE_URL}/api/sdk/keys/{admin_key['id']}", headers=admin_h, timeout=30)
    assert r.status_code == 200
    # try to use revoked key
    r2 = requests.post(
        f"{BASE_URL}/api/sdk/sessions",
        headers={"X-Publishable-Key": admin_key["publishable_key"]},
        json={"document_name": "TEST"},
        timeout=30,
    )
    assert r2.status_code == 401
