"""TrustLayer Phase 2 — Ed25519 signatures, Hedera HCS anchoring, multi-chain verifier SDK.

Tests the new Phase 2 behavior:
- Partners get an Ed25519 keypair on create (public exposed, private NEVER exposed).
- Attestations are signed (Ed25519) + best-effort anchored to Hedera HCS.
- /partners/{id}/public-key returns the partner pubkey (404 unknown, 409 legacy).
- /attestations/{id}/verify recomputes canonical bytes & verifies signature.
- /sdk-v2.js serves window.TrustLayer 2.0.0 with verify/fetchAttestation/...
- /partners/public includes ed25519_public_b64 + key_version.
- Phase 1 still works (sdk.js v1, badge SVG, rotate-key, status, revoke).
- Tamper test: mutate claim_value directly in Mongo → verify returns signature_valid=false.
- Legacy attestation (no signature) → verify returns signature_valid=false with 'legacy/no signature'.
"""
import os
import re
import asyncio
import requests
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

# Load frontend .env to get the public BACKEND URL (same one the React app uses)
def _read_frontend_backend_url():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        return None
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_backend_url() or "").rstrip("/")
assert BASE_URL.startswith("http"), f"REACT_APP_BACKEND_URL missing/invalid: {BASE_URL!r}"
ADMIN = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO = {"email": "demo@test.com", "password": "Demo123!"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


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
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def created_partner(admin_token):
    payload = {"name": f"TEST_P2_{os.urandom(3).hex()}",
               "domain": "test-p2.com",
               "description": "Phase 2 test partner"}
    r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                      json=payload,
                      headers={"Authorization": f"Bearer {admin_token}"},
                      timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup: disable so it doesn't pollute public list
    try:
        requests.post(f"{BASE_URL}/api/trustlayer/partners/{data['partner_id']}/status",
                      json={"status": "disabled"},
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    except Exception:
        pass


# ─────────────────────────── Partner creation & key exposure ───────────────────────────

class TestPartnerKeyProvisioning:
    def test_create_returns_ed25519_public_and_version(self, created_partner):
        p = created_partner
        assert "ed25519_public_b64" in p and p["ed25519_public_b64"], "Missing ed25519_public_b64"
        # Ed25519 public key raw bytes = 32 bytes -> base64 length 44 (with padding)
        assert len(p["ed25519_public_b64"]) in (43, 44)
        assert p.get("key_version") == 1
        assert "api_key" in p and p["api_key"].startswith("tl_")

    def test_create_does_not_expose_private_key(self, created_partner):
        assert "ed25519_private_b64" not in created_partner, (
            "ed25519_private_b64 leaked in partner create response")
        assert "api_key_hash" not in created_partner

    def test_admin_list_excludes_private_key(self, admin_token, created_partner):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        for p in r.json()["partners"]:
            assert "ed25519_private_b64" not in p, f"private key leaked for {p['partner_id']}"
            assert "api_key_hash" not in p
        # And our partner is present with public_b64 visible
        found = [p for p in r.json()["partners"] if p["partner_id"] == created_partner["partner_id"]]
        assert found, "newly-created partner not in admin list"
        assert found[0].get("ed25519_public_b64") == created_partner["ed25519_public_b64"]
        assert found[0].get("key_version") == 1


# ─────────────────────────── Public partner key endpoint ───────────────────────────

class TestPublicKeyEndpoint:
    def test_get_partner_public_key_ok(self, created_partner):
        pid = created_partner["partner_id"]
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners/{pid}/public-key", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["partner_id"] == pid
        assert d["ed25519_public_b64"] == created_partner["ed25519_public_b64"]
        assert d["key_version"] == 1
        assert "name" in d and "slug" in d and "status" in d
        # absolutely must NOT include private key
        assert "ed25519_private_b64" not in d
        assert "api_key_hash" not in d

    def test_get_partner_public_key_unknown_404(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners/no-such-id-xyz/public-key", timeout=15)
        assert r.status_code == 404


# ─────────────────────────── Public partner list includes pubkey ───────────────────────────

class TestPublicPartnerList:
    def test_public_list_has_ed25519_and_version(self, created_partner):
        r = requests.get(f"{BASE_URL}/api/trustlayer/partners/public", timeout=15)
        assert r.status_code == 200
        partners = r.json()["partners"]
        found = [p for p in partners if p["partner_id"] == created_partner["partner_id"]]
        assert found, "our active partner not in /partners/public"
        p = found[0]
        assert "ed25519_public_b64" in p and p["ed25519_public_b64"]
        assert p.get("key_version") == 1
        assert "ed25519_private_b64" not in p
        assert "api_key_hash" not in p


# ─────────────────────────── Attestation signing + anchoring ───────────────────────────

@pytest.fixture(scope="module")
def signed_attestation(created_partner, demo_user_id):
    r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                      json={"subject_user_id": demo_user_id,
                            "claim_type": "kyc_passed",
                            "claim_value": "passport+address"},
                      headers={"X-TrustLayer-Key": created_partner["api_key"]},
                      timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


class TestAttestationSigning:
    def test_attestation_has_signature_fields(self, signed_attestation):
        a = signed_attestation
        assert a.get("signature"), "missing signature"
        assert a.get("signature_alg") == "Ed25519"
        assert a.get("payload_digest"), "missing payload_digest"
        # digest is sha256 hex (64 chars)
        assert re.fullmatch(r"[0-9a-f]{64}", a["payload_digest"]), "digest not sha256 hex"
        assert a.get("partner_key_version") == 1

    def test_attestation_hcs_anchor_shape(self, signed_attestation):
        # Anchor is best-effort. If present, must have required fields.
        anchor = signed_attestation.get("hcs_anchor")
        if anchor is None:
            pytest.skip("hcs_anchor=None (best-effort anchor unavailable in this run)")
        for k in ("topic_id", "sequence_number", "tx_id", "explorer_url"):
            assert k in anchor, f"hcs_anchor missing {k}"
        assert anchor["explorer_url"].startswith("https://hashscan.io/")


# ─────────────────────────── Public verify endpoint ───────────────────────────

class TestVerifyEndpoint:
    def test_verify_returns_valid_for_fresh_attestation(self, signed_attestation):
        aid = signed_attestation["attestation_id"]
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations/{aid}/verify", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["signature_valid"] is True, d
        assert d["payload_digest_match"] is True
        assert d["revoked"] is False
        assert d["errors"] == [] or d["errors"] is None or len(d["errors"]) == 0
        # hcs_anchored mirrors whether anchor exists
        if signed_attestation.get("hcs_anchor"):
            assert d["hcs_anchored"] is True
            assert d["hcs_anchor"] is not None

    def test_verify_unknown_attestation_404(self):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations/no-such-att-xyz/verify", timeout=15)
        assert r.status_code == 404

    def test_verify_legacy_attestation_no_signature(self, created_partner, demo_user_id):
        """Insert a pre-Phase-2 attestation (no signature field) directly into Mongo
        and confirm /verify reports signature_valid=false with legacy/no-signature error."""
        async def _insert():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            legacy_id = "legacy_" + os.urandom(4).hex()
            await db.trust_attestations.insert_one({
                "attestation_id": legacy_id,
                "partner_id": created_partner["partner_id"],
                "partner_name": created_partner["name"],
                "partner_slug": created_partner["slug"],
                "subject_user_id": demo_user_id,
                "claim_type": "legacy_test",
                "claim_value": "phase1_data",
                "evidence_hash": None,
                "signed_at": "2024-01-01T00:00:00+00:00",
                "expires_at": None,
                "revoked": False,
                # NOTE: NO signature, NO payload_digest — pre-Phase-2 record
            })
            client.close()
            return legacy_id

        legacy_id = asyncio.get_event_loop().run_until_complete(_insert())
        try:
            r = requests.post(f"{BASE_URL}/api/trustlayer/attestations/{legacy_id}/verify", timeout=15)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["signature_valid"] is False
            errs = " ".join(d.get("errors") or []).lower()
            assert "legacy" in errs or "no signature" in errs, f"unexpected errors: {d.get('errors')}"
        finally:
            async def _cleanup():
                client = AsyncIOMotorClient(MONGO_URL)
                await client[DB_NAME].trust_attestations.delete_one({"attestation_id": legacy_id})
                client.close()
            asyncio.get_event_loop().run_until_complete(_cleanup())

    def test_verify_tampered_attestation_returns_invalid(self, created_partner, demo_user_id):
        """Create real signed attestation → mutate claim_value in Mongo → /verify must return false."""
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id,
                                "claim_type": "tamper_test",
                                "claim_value": "original"},
                          headers={"X-TrustLayer-Key": created_partner["api_key"]},
                          timeout=60)
        assert r.status_code == 200
        aid = r.json()["attestation_id"]

        # Sanity: verify is valid before tampering
        v0 = requests.post(f"{BASE_URL}/api/trustlayer/attestations/{aid}/verify", timeout=15).json()
        assert v0["signature_valid"] is True, v0

        # Tamper directly in Mongo
        async def _tamper():
            client = AsyncIOMotorClient(MONGO_URL)
            await client[DB_NAME].trust_attestations.update_one(
                {"attestation_id": aid},
                {"$set": {"claim_value": "TAMPERED"}}
            )
            client.close()
        asyncio.get_event_loop().run_until_complete(_tamper())

        v1 = requests.post(f"{BASE_URL}/api/trustlayer/attestations/{aid}/verify", timeout=15).json()
        assert v1["signature_valid"] is False, (
            f"Tampered attestation incorrectly verified as valid: {v1}")
        # Cleanup
        async def _cleanup():
            client = AsyncIOMotorClient(MONGO_URL)
            await client[DB_NAME].trust_attestations.delete_one({"attestation_id": aid})
            client.close()
        asyncio.get_event_loop().run_until_complete(_cleanup())


# ─────────────────────────── SDK v2 endpoint ───────────────────────────

class TestSDKv2:
    def test_sdk_v2_served_as_javascript(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/sdk-v2.js", timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "")

    def test_sdk_v2_has_expected_globals(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/sdk-v2.js", timeout=15)
        body = r.text
        # Must define TrustLayer with version 2.0.0
        assert "TrustLayer" in body
        assert "2.0.0" in body
        for needle in ("verify", "fetchAttestation", "fetchPartnerKey",
                       "canonicalPayload", "canonicalJSON"):
            assert needle in body, f"sdk-v2 missing {needle}"
        # Hedera mirror baked in
        assert "mainnet-public.mirrornode.hedera.com" in body
        # API base must be substituted (no leftover placeholder)
        assert "__API_BASE__" not in body


# ─────────────────────────── Phase 1 backward compat ───────────────────────────

class TestPhase1StillWorks:
    def test_badge_svg_for_demo(self, demo_user_id):
        r = requests.get(f"{BASE_URL}/api/trustlayer/badge/{demo_user_id}.svg", timeout=15)
        assert r.status_code == 200
        assert "image/svg+xml" in r.headers["content-type"]
        assert "<svg" in r.text

    def test_sdk_v1_still_served(self):
        r = requests.get(f"{BASE_URL}/api/trustlayer/sdk.js", timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        # v1 SDK appends a badge img — must reference badge endpoint
        assert "/api/trustlayer/badge/" in r.text

    def test_revoke_attestation_round_trip(self, created_partner, demo_user_id):
        r = requests.post(f"{BASE_URL}/api/trustlayer/attestations",
                          json={"subject_user_id": demo_user_id,
                                "claim_type": "to_revoke",
                                "claim_value": "x"},
                          headers={"X-TrustLayer-Key": created_partner["api_key"]},
                          timeout=60)
        assert r.status_code == 200
        aid = r.json()["attestation_id"]
        rr = requests.delete(f"{BASE_URL}/api/trustlayer/attestations/{aid}",
                             headers={"X-TrustLayer-Key": created_partner["api_key"]}, timeout=15)
        assert rr.status_code == 200
        assert rr.json()["revoked"] is True

    def test_rotate_key_does_not_change_ed25519(self, admin_token, created_partner):
        pid = created_partner["partner_id"]
        rr = requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/rotate-key",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rr.status_code == 200
        # ed25519 key remains the same (rotate-key only rotates the API key)
        pk = requests.get(f"{BASE_URL}/api/trustlayer/partners/{pid}/public-key", timeout=15).json()
        assert pk["ed25519_public_b64"] == created_partner["ed25519_public_b64"]

    def test_partner_status_disable_then_enable(self, admin_token):
        # spin up a temp partner
        r = requests.post(f"{BASE_URL}/api/trustlayer/partners",
                          json={"name": f"TEST_P2_status_{os.urandom(3).hex()}", "domain": "stat.com"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        pid = r.json()["partner_id"]
        rr = requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/status",
                           json={"status": "disabled"},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rr.status_code == 200
        rr2 = requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/status",
                            json={"status": "active"},
                            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rr2.status_code == 200
        # cleanup
        requests.post(f"{BASE_URL}/api/trustlayer/partners/{pid}/status",
                      json={"status": "disabled"},
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
