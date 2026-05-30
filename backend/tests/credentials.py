"""
Centralized, env-overridable test credentials.

Single source of truth so individual test files don't hardcode secrets. All values
fall back to the known shared preview/demo accounts, but can be overridden via env
vars in CI (e.g. TEST_ADMIN_PASSWORD) without touching any test file.
"""
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@notarychain.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
DEMO_EMAIL = os.environ.get("TEST_DEMO_EMAIL", "demo@test.com")
DEMO_PASSWORD = os.environ.get("TEST_DEMO_PASSWORD", "Demo123!")
NOTARY_EMAIL = os.environ.get("TEST_NOTARY_EMAIL", "notarytest@test.com")
NOTARY_PASSWORD = os.environ.get("TEST_NOTARY_PASSWORD", "Test123!")

# The preview ingress (Cloudflare) bot-challenges default request UAs, causing
# read timeouts. Tests should send a browser-like User-Agent.
UA_HEADERS = {
    "User-Agent": os.environ.get(
        "TEST_USER_AGENT",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ),
}
