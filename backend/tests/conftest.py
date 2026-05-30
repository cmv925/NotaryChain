"""
Shared pytest fixtures for the NotaryChain backend test suite.

Provides env-backed credential fixtures and a Cloudflare-safe requests session so
test files never hardcode secrets or repeat boilerplate.
"""
import pytest
import requests

from credentials import (
    BASE_URL,
    ADMIN_EMAIL, ADMIN_PASSWORD,
    DEMO_EMAIL, DEMO_PASSWORD,
    NOTARY_EMAIL, NOTARY_PASSWORD,
    UA_HEADERS,
)


@pytest.fixture
def base_url():
    return BASE_URL


@pytest.fixture
def admin_creds():
    return {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}


@pytest.fixture
def demo_creds():
    return {"email": DEMO_EMAIL, "password": DEMO_PASSWORD}


@pytest.fixture
def notary_creds():
    return {"email": NOTARY_EMAIL, "password": NOTARY_PASSWORD}


@pytest.fixture
def api_client():
    """Requests session with a browser-like UA (preview ingress bot-challenges others)."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    return session


@pytest.fixture
def login(api_client):
    """Return a helper that logs in and yields the access token (Bearer fallback)."""
    def _login(creds=None):
        creds = creds or {"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json=creds)
        resp.raise_for_status()
        return resp.json().get("access_token")
    return _login
