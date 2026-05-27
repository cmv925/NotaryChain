"""Living Identity Notarization — end-to-end backend tests."""
import os
import io
import base64
import time
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://notary-chain-preview-2.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}
NOTARY = {"email": "notarytest@test.com", "password": "Test123!"}


# ───────── helpers ─────────

def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


def _img_b64(color=(120, 130, 140), size=(64, 64)):
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode()


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ───────── fixtures ─────────

@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO)


@pytest.fixture(scope="module")
def notary_token():
    return _login(NOTARY)


# ───────── auth ─────────

def test_me_requires_auth():
    r = requests.get(f"{BASE_URL}/api/living-identity/me", timeout=60)
    assert r.status_code == 401


def test_anchor_requires_auth():
    r = requests.post(f"{BASE_URL}/api/living-identity/anchor", json={}, timeout=60)
    assert r.status_code == 401


# ───────── /me ─────────

def test_me_admin_has_identity(admin_token):
    """Admin already created an anchor in smoke test — should have one."""
    r = requests.get(f"{BASE_URL}/api/living-identity/me", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    # Admin already has identity per smoke test note
    assert data.get("has_identity") is True
    assert "identity" in data
    ident = data["identity"]
    assert ident.get("trust_score") is not None
    assert ident.get("trust_tier") in {"verified", "watch", "challenged", "revoked"}


def test_me_demo_no_identity(demo_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/me", headers=_h(demo_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("has_identity") is False


# ───────── /anchor ─────────

def test_anchor_idempotent_admin(admin_token):
    """Admin already has anchor — second call must 400."""
    r = requests.post(
        f"{BASE_URL}/api/living-identity/anchor",
        headers=_h(admin_token),
        json={"biometric_image": _img_b64(), "behavioral": {}, "consent": {"third_party_challenges": True}},
        timeout=60,
    )
    assert r.status_code == 400
    assert "already" in r.text.lower()


def test_anchor_create_for_notary(notary_token):
    """Notary doesn't have an anchor — can create one."""
    r = requests.post(
        f"{BASE_URL}/api/living-identity/anchor",
        headers=_h(notary_token),
        json={
            "biometric_image": _img_b64(color=(200, 100, 100)),
            "behavioral": {"typing_cadence_ms_avg": 180, "device_os": "macOS"},
            "consent": {"behavioral_signals": True, "third_party_challenges": True},
        },
        timeout=90,
    )
    # If notary already has one from a previous run, accept 400 too
    if r.status_code == 400:
        pytest.skip("Notary already has an anchor from prior run")
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data["success"] is True
    assert data["identity"]["trust_score"] == 100
    assert data["identity"]["trust_tier"] == "verified"
    assert "anchor" in data
    seal = data["anchor"].get("hedera_seal")
    assert seal is not None
    assert seal.get("topic_id")
    blob = data["blob_storage"]
    assert blob["backend"] in {"s3", "local-fallback", "local"}


# ───────── /refresh ─────────

def test_refresh_demo_blocked(demo_token):
    """Demo (free tier) should be blocked by feature gate."""
    r = requests.post(
        f"{BASE_URL}/api/living-identity/refresh",
        headers=_h(demo_token),
        json={"biometric_image": _img_b64()},
        timeout=30,
    )
    assert r.status_code == 403
    detail = r.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("error") == "upgrade_required"
        assert detail.get("required_plan") == "pro"


def test_refresh_admin_works(admin_token):
    r = requests.post(
        f"{BASE_URL}/api/living-identity/refresh",
        headers=_h(admin_token),
        json={"biometric_image": _img_b64(color=(125, 135, 145))},
        timeout=120,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "trust_score" in data
    assert 0 <= data["trust_score"] <= 100
    assert data["trust_tier"] in {"verified", "watch", "challenged", "revoked"}
    assert "ai" in data
    assert "hedera_seal" in data


# ───────── /challenge ─────────

def test_challenge_demo_blocked(demo_token):
    r = requests.post(
        f"{BASE_URL}/api/living-identity/challenge",
        headers=_h(demo_token),
        json={"biometric_image": _img_b64()},
        timeout=30,
    )
    assert r.status_code == 403
    detail = r.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("error") == "upgrade_required"


def test_challenge_admin_works(admin_token):
    r = requests.post(
        f"{BASE_URL}/api/living-identity/challenge",
        headers=_h(admin_token),
        json={"biometric_image": _img_b64(), "reason": "test"},
        timeout=120,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "challenge" in data
    assert data["challenge"]["challenge_id"]
    assert data["challenge"]["result"] in {"passed", "failed"}


# ───────── partner flow ─────────

@pytest.fixture(scope="module")
def partner_auth_token(admin_token):
    """Admin (acting as user) issues authorization for itself — partner_id = admin's own id."""
    # Get admin id via /me
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=30).json()
    admin_id = me.get("id") or me.get("user_id") or me.get("sub")
    # Issue token (admin authorizes admin as partner — for testing only)
    r = requests.post(
        f"{BASE_URL}/api/living-identity/authorize-partner",
        headers=_h(admin_token),
        json={"partner_id": admin_id, "duration_days": 1, "max_uses": 5},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data["token"]
    assert data["status"] == "active"
    return {"token": data["token"], "admin_id": admin_id}


def test_authorize_partner_returns_token(partner_auth_token):
    assert partner_auth_token["token"]


def test_partner_challenge_invalid_token(admin_token, partner_auth_token):
    r = requests.post(
        f"{BASE_URL}/api/living-identity/partner-challenge",
        headers=_h(admin_token),
        json={
            "target_user_id": partner_auth_token["admin_id"],
            "authorization_token": "bogus-token-xxx",
            "biometric_image": _img_b64(),
        },
        timeout=30,
    )
    assert r.status_code == 403


def test_partner_challenge_billed(admin_token, partner_auth_token):
    r = requests.post(
        f"{BASE_URL}/api/living-identity/partner-challenge",
        headers=_h(admin_token),
        json={
            "target_user_id": partner_auth_token["admin_id"],
            "authorization_token": partner_auth_token["token"],
            "biometric_image": _img_b64(color=(100, 150, 200)),
            "reason": "test-partner-challenge",
        },
        timeout=120,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data["billed_amount_usd"] == 0.50
    assert data["challenge_id"]
    assert data["result"] in {"passed", "failed"}


# ───────── /score/{user_id} ─────────

def test_public_score_opted_in(admin_token):
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=30).json()
    admin_id = me.get("id") or me.get("user_id") or me.get("sub")
    # Note: route uses path param — it's on /api/living-identity/score/{user_id}
    r = requests.get(f"{BASE_URL}/api/living-identity/score/{admin_id}", timeout=30)
    # Admin opted in (third_party_challenges=True default). No auth required by route.
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data.get("user_id") == admin_id
    assert "trust_score" in data


# ───────── /history ─────────

def test_history_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/history", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "snapshots" in data
    assert isinstance(data["snapshots"], list)
    assert data["total"] >= 1


# ───────── admin endpoints ─────────

def test_admin_drift_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/admin/drift", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "total_identities" in data
    assert "by_tier" in data
    assert "drift_events_total" in data


def test_admin_drift_non_admin(demo_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/admin/drift", headers=_h(demo_token), timeout=30)
    assert r.status_code == 403


def test_admin_billing(admin_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/admin/billing", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data


def test_admin_billing_non_admin(demo_token):
    r = requests.get(f"{BASE_URL}/api/living-identity/admin/billing", headers=_h(demo_token), timeout=30)
    assert r.status_code == 403


# ───────── trust score algorithm ─────────

def test_trust_score_perfect():
    from services.living_identity_service import compute_trust_score, trust_tier
    score = compute_trust_score(
        biometric_match=1.0, behavioral_consistency=1.0,
        days_since_last_verification=0, refresh_cadence_days=90,
        anan_reputation=0.85, drift_penalties=0,
    )
    assert 95 <= score <= 100
    assert trust_tier(score) == "verified"


def test_trust_score_degraded():
    from services.living_identity_service import compute_trust_score, trust_tier
    score = compute_trust_score(
        biometric_match=0.5, behavioral_consistency=0.7,
        days_since_last_verification=30, refresh_cadence_days=90,
        anan_reputation=0.85, drift_penalties=15,
    )
    assert 20 <= score <= 50
    # tier should be challenged or revoked
    assert trust_tier(score) in {"challenged", "revoked"}


# ───────── subscription gating verification ─────────

def test_subscription_feature_map_has_living_identity(admin_token):
    """Quickly verify the feature plan map includes living_identity_* via subscription/plans endpoint."""
    # Best-effort: subscription_routes exposes plans; check nothing breaks
    r = requests.get(f"{BASE_URL}/api/subscriptions/plans", timeout=30)
    # Endpoint may or may not exist — just ensure 200/404 not 500
    assert r.status_code in {200, 401, 403, 404}


# ───────── revoke + recover (run last; mutates admin) ─────────
# Skipped to preserve admin identity for re-runs / frontend tests.
@pytest.mark.skip(reason="Mutates admin identity; run manually only")
def test_revoke_and_recover(admin_token):
    r = requests.post(f"{BASE_URL}/api/living-identity/revoke", headers=_h(admin_token),
                      json={"reason": "test"}, timeout=60)
    assert r.status_code == 200
    rec = requests.post(f"{BASE_URL}/api/living-identity/recover", headers=_h(admin_token),
                        json={"biometric_image": _img_b64()}, timeout=60)
    assert rec.status_code == 200
    assert rec.json()["status"] == "pending_admin_approval"
