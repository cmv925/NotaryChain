"""Backend tests for httpOnly cookie auth migration (dual-accept: cookie-first, then Bearer header).

Pace login calls (login is rate-limited 10/min). Use module-level shared tokens/sessions.
"""
import os
import time
import uuid
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL is required"

DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"

TIMEOUT = 30
UA_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) NotaryChainTests/1.0"}


def _post(url, **kw):
    kw.setdefault("timeout", TIMEOUT)
    headers = dict(UA_HEADERS)
    headers.update(kw.pop("headers", {}))
    return requests.post(url, headers=headers, **kw)


def _get(url, **kw):
    kw.setdefault("timeout", TIMEOUT)
    headers = dict(UA_HEADERS)
    headers.update(kw.pop("headers", {}))
    return requests.get(url, headers=headers, **kw)


def _new_session():
    s = requests.Session()
    s.headers.update(UA_HEADERS)
    return s


# ---------- Shared session-scoped fixtures to minimize login rate-limit hits ----------
@pytest.fixture(scope="module")
def demo_login():
    """Single demo login captured via a raw POST so we can inspect Set-Cookie too."""
    time.sleep(1)
    r = _post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    return r


@pytest.fixture(scope="module")
def demo_session(demo_login):
    """Session containing the demo cookie."""
    s = _new_session()
    token = demo_login.json().get("access_token")
    assert token, "demo_login did not return access_token"
    time.sleep(1)
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = _new_session()
    time.sleep(2)
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return s


# -------- AUTH COOKIE --------
class TestAuthCookie:
    def test_login_sets_httponly_secure_cookie(self, demo_login):
        assert demo_login.status_code == 200, demo_login.text
        set_cookie = demo_login.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie.lower(), set_cookie
        low = set_cookie.lower()
        assert "httponly" in low, set_cookie
        assert "secure" in low, set_cookie
        assert "samesite=lax" in low, set_cookie

    def test_me_via_cookie_only(self, demo_session):
        me = demo_session.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert me.status_code == 200, me.text
        assert me.json().get("email") == DEMO_EMAIL


# -------- DUAL READ FALLBACK --------
class TestDualReadFallback:
    def test_me_via_bearer_only_no_cookie(self, demo_login):
        token = demo_login.json()["access_token"]
        me = _get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me.status_code == 200, me.text
        assert me.json().get("email") == DEMO_EMAIL

    def test_me_with_no_creds_returns_401(self):
        me = _get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 401


# -------- SIGNUP --------
class TestSignupCookie:
    def test_signup_sets_cookie_and_me_works(self):
        unique = uuid.uuid4().hex[:10]
        email = f"TEST_cookie_{unique}@example.com"
        s = _new_session()
        time.sleep(2)
        r = s.post(
            f"{BASE_URL}/api/auth/signup",
            json={"email": email, "password": "TestPass123!", "full_name": "Cookie Tester"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        set_cookie = r.headers.get("set-cookie", "").lower()
        assert "access_token=" in set_cookie
        assert "httponly" in set_cookie and "secure" in set_cookie and "samesite=lax" in set_cookie
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert me.status_code == 200
        assert me.json().get("email", "").lower() == email.lower()


# -------- LOGOUT --------
class TestLogout:
    def test_logout_clears_cookie_and_me_401(self):
        s = _new_session()
        time.sleep(2)
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        out = s.post(f"{BASE_URL}/api/auth/logout", timeout=TIMEOUT)
        assert out.status_code == 200
        set_cookie = out.headers.get("set-cookie", "").lower()
        assert "access_token=" in set_cookie
        assert ("max-age=0" in set_cookie) or ("expires=" in set_cookie)
        s.cookies.clear()
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert me.status_code == 401


# -------- SESSION EXCHANGE --------
class TestSessionExchange:
    def test_session_exchanges_bearer_for_cookie(self, demo_login):
        token = demo_login.json()["access_token"]
        s = _new_session()
        out = s.post(
            f"{BASE_URL}/api/auth/session",
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT,
        )
        assert out.status_code == 200, out.text
        set_cookie = out.headers.get("set-cookie", "").lower()
        assert "access_token=" in set_cookie
        assert "httponly" in set_cookie and "secure" in set_cookie
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert me.status_code == 200
        assert me.json().get("email") == DEMO_EMAIL


# -------- PROTECTED ENDPOINTS via cookie --------
class TestProtectedEndpointsViaCookie:
    def test_documents_seals_cookie(self, demo_session):
        r = demo_session.get(f"{BASE_URL}/api/documents/seals", timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"

    def test_dashboard_next_action_cookie(self, demo_session):
        r = demo_session.get(f"{BASE_URL}/api/dashboard/next-action", timeout=TIMEOUT)
        assert r.status_code in (200, 204), f"{r.status_code} {r.text[:200]}"

    def test_notifications_cookie(self, demo_session):
        r = demo_session.get(f"{BASE_URL}/api/notifications", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_admin_endpoint_via_cookie(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats", timeout=TIMEOUT)
        assert r.status_code != 401, f"admin auth via cookie failed: {r.status_code}"


# -------- NOTARIZATION GATE --------
class TestNotarizationGate:
    def test_notary_requests_403_identity_required(self, demo_session):
        payload = {
            "document_name": "Test Doc",
            "document_type": "affidavit",
            "notarization_type": "acknowledgment",
            "state_code": "FL",
            "signers": [],
            "notes": "test",
        }
        out = demo_session.post(f"{BASE_URL}/api/notary/requests", json=payload, timeout=60)
        assert out.status_code == 403, f"expected 403, got {out.status_code}: {out.text[:300]}"
        text = json.dumps(out.json()).lower()
        assert "identity_verification_required" in text or "identity verification" in text


# -------- WEBSOCKET via cookie --------
class TestWebSocketCookie:
    def test_global_ws_authenticates_via_cookie(self, demo_session):
        cookie = demo_session.cookies.get("access_token")
        assert cookie, "No access_token cookie present after login"
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/global"
        headers = [("Cookie", f"access_token={cookie}")]

        async def run():
            async with websockets.connect(ws_url, additional_headers=headers, open_timeout=20) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=10)
                data = json.loads(msg)
                assert data.get("type") == "connected", f"unexpected first message: {data}"
                assert "user_id" in data

        asyncio.run(run())
