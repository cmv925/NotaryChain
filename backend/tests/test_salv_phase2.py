"""
SALV Phase 2 — Encrypted document attachments + partial-release handoffs.
Tests:
- Upload/list/download/delete document with AES-GCM-256 + HKDF wrap
- Round-trip plaintext integrity, X-NotaryChain-Sha256 header
- Owner-only access; beneficiary access only AFTER partial release
- Tamper detection on ciphertext and metadata
- Partial release flow (additive, caps, fully-released 400)
- Release history audit trail
- Public response strips encryption.nonce_b64/wrapped_dek_b64/wrap_nonce_b64
"""
import os
import io
import base64
import hashlib
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@test.com"
DEMO_PASS = "Demo123!"
ALICE_EMAIL = "alice@example.com"
ALICE_PASS = "Viral123!"
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASS = "Admin123!"


# ─── helpers ─────────────────────────────────────────────────────────────────

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=90)
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def demo_token():
    t = _login(DEMO_EMAIL, DEMO_PASS)
    if not t:
        pytest.skip(f"demo login failed")
    return t


@pytest.fixture(scope="session")
def alice_token():
    t = _login(ALICE_EMAIL, ALICE_PASS)
    if not t:
        pytest.skip("alice login failed")
    return t


@pytest.fixture(scope="session")
def admin_token():
    t = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not t:
        pytest.skip("admin login failed")
    return t


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _post_retry(url, **kwargs):
    """POST with up to 2 retries on transient 502/503/504 from the preview ingress."""
    import time
    last = None
    for i in range(3):
        try:
            r = requests.post(url, **kwargs)
        except requests.exceptions.RequestException as e:
            last = e
            time.sleep(2 + i * 2)
            continue
        if r.status_code in (502, 503, 504):
            time.sleep(3 + i * 2)
            last = r
            continue
        return r
    if isinstance(last, requests.Response):
        return last
    raise last


@pytest.fixture(scope="session")
def demo_asset_and_benef(demo_token):
    """Find a demo asset + beneficiary (alice if present, else first)."""
    r = requests.get(f"{API}/salv/vault", headers=_h(demo_token), timeout=30)
    assert r.status_code == 200, f"vault: {r.status_code} {r.text[:200]}"
    data = r.json()
    assets = data.get("assets") or []
    benefs = data.get("beneficiaries") or []
    assert assets, "demo has no SALV assets"
    # Prefer asset where alice is a beneficiary
    alice_benef = next((b for b in benefs if (b.get("email") or "").lower() == ALICE_EMAIL), None)
    if alice_benef:
        target_asset = next((a for a in assets if a.get("asset_id") == alice_benef.get("asset_id")), None)
        if target_asset:
            return target_asset, alice_benef
    # Fallback: first asset that has any beneficiary
    for a in assets:
        for b in benefs:
            if b.get("asset_id") == a.get("asset_id"):
                return a, b
    # Last fallback: first asset, no benef
    return assets[0], (benefs[0] if benefs else None)


# ─── document upload + list + download + delete ──────────────────────────────

class TestDocumentLifecycle:
    def test_upload_owner_success(self, demo_token, demo_asset_and_benef):
        asset, _ = demo_asset_and_benef
        plaintext = f"NotaryChain SALV Phase 2 test doc {uuid.uuid4().hex}".encode() * 100
        expected_sha = hashlib.sha256(plaintext).hexdigest()
        files = {"file": (f"test_{uuid.uuid4().hex[:6]}.txt", plaintext, "text/plain")}
        data = {"label": "phase2-test"}
        r = requests.post(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(demo_token), files=files, data=data, timeout=60,
        )
        assert r.status_code == 200, f"upload: {r.status_code} {r.text[:300]}"
        j = r.json()
        assert j["plaintext_sha256"] == expected_sha
        assert j["size_bytes"] == len(plaintext)
        assert j["encryption_alg"] == "AES-GCM-256+HKDF-SHA256-wrap"
        assert j["label"] == "phase2-test"
        assert "doc_id" in j and len(j["doc_id"]) > 0
        # No private encryption fields leaked
        for k in ("nonce_b64", "wrapped_dek_b64", "wrap_nonce_b64"):
            assert k not in j, f"private field {k} leaked in upload response"
        # Stash for downstream tests
        pytest.salv_doc_id = j["doc_id"]
        pytest.salv_asset_id = asset["asset_id"]
        pytest.salv_plaintext = plaintext
        pytest.salv_sha = expected_sha

    def test_upload_oversize_413(self, demo_token, demo_asset_and_benef):
        asset, _ = demo_asset_and_benef
        big = b"x" * (26 * 1024 * 1024)
        files = {"file": ("big.bin", big, "application/octet-stream")}
        r = requests.post(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(demo_token), files=files, timeout=120,
        )
        assert r.status_code == 413, f"expected 413 got {r.status_code} {r.text[:200]}"

    def test_upload_disallowed_mime(self, demo_token, demo_asset_and_benef):
        asset, _ = demo_asset_and_benef
        files = {"file": ("evil.exe", b"MZ\x90\x00", "application/x-msdownload")}
        r = requests.post(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(demo_token), files=files, timeout=30,
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"

    def test_upload_non_owner_404(self, alice_token, demo_asset_and_benef):
        asset, _ = demo_asset_and_benef
        files = {"file": ("hack.txt", b"nope", "text/plain")}
        r = requests.post(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(alice_token), files=files, timeout=30,
        )
        # spec says 404 for non-owner
        assert r.status_code == 404, f"expected 404 got {r.status_code} {r.text[:200]}"

    def test_list_owner_sees_uploaded(self, demo_token):
        r = requests.get(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents",
            headers=_h(demo_token), timeout=30,
        )
        assert r.status_code == 200
        j = r.json()
        ids = [d["doc_id"] for d in j["documents"]]
        assert pytest.salv_doc_id in ids
        # Private encryption fields stripped from list
        for d in j["documents"]:
            for k in ("nonce_b64", "wrapped_dek_b64", "wrap_nonce_b64"):
                assert k not in d
            # encryption_alg should be present
            assert d.get("encryption_alg") == "AES-GCM-256+HKDF-SHA256-wrap"

    def test_download_roundtrip(self, demo_token):
        r = requests.get(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
            headers=_h(demo_token), timeout=60,
        )
        assert r.status_code == 200, f"download: {r.status_code} {r.text[:200]}"
        assert r.content == pytest.salv_plaintext, "round-trip plaintext mismatch"
        assert r.headers.get("X-NotaryChain-Sha256") == pytest.salv_sha


# ─── beneficiary access (before & after partial release) ─────────────────────

class TestBeneficiaryAccess:
    def test_random_other_user_forbidden(self, admin_token, demo_asset_and_benef):
        asset, _ = demo_asset_and_benef
        r = requests.get(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(admin_token), timeout=30,
        )
        assert r.status_code == 403, f"admin (random other user) should be 403, got {r.status_code}"

    def test_beneficiary_zero_released_forbidden(self, demo_token, alice_token, demo_asset_and_benef):
        """If alice has 0 released_percent on the asset, expect 403."""
        asset, benef = demo_asset_and_benef
        if (benef.get("email") or "").lower() != ALICE_EMAIL:
            pytest.skip("alice not a beneficiary on chosen asset")
        # Inspect alice's current released_percent via owner's history
        rh = requests.get(
            f"{API}/salv/beneficiaries/{benef['beneficiary_id']}/release-history",
            headers=_h(demo_token), timeout=30,
        )
        assert rh.status_code == 200
        released = float(rh.json().get("released_percent") or 0)
        r = requests.get(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(alice_token), timeout=30,
        )
        if released > 0:
            # Already partly released — spec says she should HAVE access
            assert r.status_code == 200, f"alice partially-released should get 200, got {r.status_code}"
        else:
            assert r.status_code == 403, f"alice 0-released should be 403, got {r.status_code}"


# ─── partial release flow ────────────────────────────────────────────────────

class TestPartialRelease:
    def test_release_history_owner_only(self, demo_token, alice_token, demo_asset_and_benef):
        _, benef = demo_asset_and_benef
        r_owner = requests.get(
            f"{API}/salv/beneficiaries/{benef['beneficiary_id']}/release-history",
            headers=_h(demo_token), timeout=30,
        )
        assert r_owner.status_code == 200
        j = r_owner.json()
        for k in ("beneficiary_id", "share_percent", "released_percent", "remaining_percent", "release_history"):
            assert k in j
        # Non-owner forbidden
        r_other = requests.get(
            f"{API}/salv/beneficiaries/{benef['beneficiary_id']}/release-history",
            headers=_h(alice_token), timeout=30,
        )
        assert r_other.status_code == 403, f"alice should be 403 on release-history, got {r_other.status_code}"

    def test_release_partial_additive_and_cap(self, demo_token):
        """Create a fresh asset + beneficiary so we can test 25%→cap→400 deterministically."""
        # Fresh asset
        create_a = requests.post(
            f"{API}/salv/assets",
            headers=_h(demo_token),
            json={"asset_type": "other", "title": f"P2 test asset {uuid.uuid4().hex[:6]}",
                  "description": "phase2 release-partial test"},
            timeout=60,
        )
        if create_a.status_code not in (200, 201):
            pytest.skip(f"asset create failed: {create_a.status_code} {create_a.text[:200]}")
        new_asset_id = create_a.json().get("asset_id")
        assert new_asset_id

        share_for_test = 50.0
        new_email = f"phase2bench+{uuid.uuid4().hex[:8]}@example.com"
        create = requests.post(
            f"{API}/salv/assets/{new_asset_id}/beneficiaries",
            headers=_h(demo_token),
            json={"name": "Phase2 Bench", "email": new_email, "share_percent": share_for_test, "relationship": "other"},
            timeout=60,
        )
        assert create.status_code in (200, 201), f"benef create: {create.status_code} {create.text[:200]}"
        bj = create.json()
        new_benef_id = bj.get("beneficiary_id") or bj.get("id") or (bj.get("beneficiary") or {}).get("beneficiary_id")
        assert new_benef_id, f"no beneficiary_id in create response: {bj}"

        half = share_for_test / 2.0  # 25

        # Call 1: release 25 of share 50 -> released=25, remaining=25
        r1 = _post_retry(
            f"{API}/salv/beneficiaries/{new_benef_id}/release-partial",
            headers=_h(demo_token), json={"percent": half, "note": "first"}, timeout=90,
        )
        assert r1.status_code == 200, f"r1: {r1.status_code} {r1.text[:200]}"
        j1 = r1.json()
        assert abs(j1["percent_released_now"] - half) < 1e-6
        assert abs(j1["cumulative_released_percent"] - half) < 1e-6
        assert abs(j1["remaining_percent"] - half) < 1e-6
        assert "release_id" in j1 and "handoff_token" in j1
        if "hcs_anchor" in j1:
            assert j1["hcs_anchor"].get("topic_id")
            assert j1["hcs_anchor"].get("tx_id")

        # Call 2: oversize (within 0<percent<=100 validator) → cap to share_percent
        r2 = _post_retry(
            f"{API}/salv/beneficiaries/{new_benef_id}/release-partial",
            headers=_h(demo_token), json={"percent": 100}, timeout=90,
        )
        assert r2.status_code == 200, f"r2: {r2.status_code} {r2.text[:200]}"
        j2 = r2.json()
        assert abs(j2["cumulative_released_percent"] - share_for_test) < 1e-6
        assert abs(j2["remaining_percent"]) < 1e-6
        assert abs(j2["percent_released_now"] - half) < 1e-6  # delta capped

        # Call 3: fully released → 400
        r3 = requests.post(
            f"{API}/salv/beneficiaries/{new_benef_id}/release-partial",
            headers=_h(demo_token), json={"percent": 10}, timeout=60,
        )
        assert r3.status_code == 400, f"r3 should be 400 got {r3.status_code} {r3.text[:200]}"

        # Audit trail
        rh = requests.get(
            f"{API}/salv/beneficiaries/{new_benef_id}/release-history",
            headers=_h(demo_token), timeout=60,
        )
        assert rh.status_code == 200
        rhj = rh.json()
        assert abs(float(rhj["released_percent"]) - share_for_test) < 1e-6
        assert abs(float(rhj["remaining_percent"])) < 1e-6
        assert len(rhj["release_history"]) >= 2

        # Cleanup: delete benef + asset
        try:
            requests.delete(f"{API}/salv/beneficiaries/{new_benef_id}", headers=_h(demo_token), timeout=30)
            requests.delete(f"{API}/salv/assets/{new_asset_id}", headers=_h(demo_token), timeout=30)
        except Exception:
            pass

    def test_beneficiary_access_after_release(self, demo_token, demo_asset_and_benef):
        """Owner does a tiny partial release to alice, then alice can list+download docs on that asset."""
        asset, benef = demo_asset_and_benef
        if not benef or (benef.get("email") or "").lower() != ALICE_EMAIL:
            pytest.skip("alice not a beneficiary on chosen asset")
        # Trigger a small release so alice's released_percent > 0
        share = float(benef.get("share_percent") or 0)
        already = float(benef.get("released_percent") or 0)
        if already <= 0 and share > 0:
            rp = _post_retry(
                f"{API}/salv/beneficiaries/{benef['beneficiary_id']}/release-partial",
                headers=_h(demo_token), json={"percent": 1, "note": "test-access"}, timeout=90,
            )
            assert rp.status_code == 200, f"release-partial setup: {rp.status_code} {rp.text[:200]}"

        # Upload a fresh doc owned by demo on this asset (so alice has something to see)
        plaintext = b"alice-access-doc " + uuid.uuid4().hex.encode()
        up = requests.post(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(demo_token),
            files={"file": ("alice.txt", plaintext, "text/plain")},
            data={"label": "alice-access"},
            timeout=60,
        )
        assert up.status_code == 200, f"upload: {up.status_code} {up.text[:200]}"
        new_doc_id = up.json()["doc_id"]

        # Alice logs in and lists + downloads
        atok = _login(ALICE_EMAIL, ALICE_PASS)
        assert atok, "alice login failed"
        r = requests.get(
            f"{API}/salv/assets/{asset['asset_id']}/documents",
            headers=_h(atok), timeout=60,
        )
        assert r.status_code == 200, f"alice list expected 200, got {r.status_code} {r.text[:200]}"
        ids = [d["doc_id"] for d in r.json().get("documents", [])]
        assert new_doc_id in ids
        rd = requests.get(
            f"{API}/salv/assets/{asset['asset_id']}/documents/{new_doc_id}/download",
            headers=_h(atok), timeout=60,
        )
        assert rd.status_code == 200, f"alice download expected 200, got {rd.status_code}"
        assert rd.content == plaintext
        # Cleanup uploaded doc
        try:
            requests.delete(
                f"{API}/salv/assets/{asset['asset_id']}/documents/{new_doc_id}",
                headers=_h(demo_token), timeout=30,
            )
        except Exception:
            pass


# ─── tamper detection ────────────────────────────────────────────────────────

class TestTamperDetection:
    """Direct Mongo + filesystem tampering to verify AES-GCM auth failures.
    These tests run against the same DB the backend uses (MONGO_URL)."""

    @pytest.fixture(scope="class")
    def db(self):
        from pymongo import MongoClient
        url = os.environ.get("MONGO_URL")
        name = os.environ.get("DB_NAME")
        if not url or not name:
            pytest.skip("MONGO_URL/DB_NAME not set on test runner")
        return MongoClient(url)[name]

    def test_tamper_ciphertext_500(self, demo_token, db):
        """Modify storage bytes directly → /download returns 500."""
        doc = db.salv_documents.find_one({"doc_id": pytest.salv_doc_id})
        if not doc:
            pytest.skip("doc not in DB")
        if doc.get("storage_backend") != "local":
            pytest.skip("non-local storage; skipping fs tamper")
        # Direct local FS path used by storage_service
        fp = os.path.join("/tmp/notary_uploads", os.path.basename(doc["storage_path"]))
        if not os.path.exists(fp):
            pytest.skip(f"can't locate ciphertext file: {fp}")
        original = open(fp, "rb").read()
        try:
            tampered = bytearray(original)
            tampered[0] ^= 0xFF
            with open(fp, "wb") as f:
                f.write(bytes(tampered))
            r = requests.get(
                f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
                headers=_h(demo_token), timeout=30,
            )
            assert r.status_code == 500, f"tampered ciphertext should 500, got {r.status_code}"
            assert "Decryption failed" in r.text or "decrypt" in r.text.lower()
        finally:
            with open(fp, "wb") as f:
                f.write(original)
        # Sanity restore
        r2 = requests.get(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
            headers=_h(demo_token), timeout=30,
        )
        assert r2.status_code == 200, "post-restore download should work again"

    def test_tamper_nonce_500(self, demo_token, db):
        """Flip a byte in nonce_b64 in Mongo → /download returns 500."""
        doc = db.salv_documents.find_one({"doc_id": pytest.salv_doc_id})
        if not doc:
            pytest.skip("doc not in DB")
        orig_nonce = doc["encryption"]["nonce_b64"]
        raw = bytearray(base64.b64decode(orig_nonce))
        raw[0] ^= 0xFF
        bad = base64.b64encode(bytes(raw)).decode()
        try:
            db.salv_documents.update_one(
                {"doc_id": pytest.salv_doc_id},
                {"$set": {"encryption.nonce_b64": bad}},
            )
            r = requests.get(
                f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
                headers=_h(demo_token), timeout=30,
            )
            assert r.status_code == 500, f"tampered nonce should 500, got {r.status_code}"
        finally:
            db.salv_documents.update_one(
                {"doc_id": pytest.salv_doc_id},
                {"$set": {"encryption.nonce_b64": orig_nonce}},
            )

    def test_tamper_wrapped_dek_500(self, demo_token, db):
        doc = db.salv_documents.find_one({"doc_id": pytest.salv_doc_id})
        if not doc:
            pytest.skip("doc not in DB")
        orig = doc["encryption"]["wrapped_dek_b64"]
        raw = bytearray(base64.b64decode(orig))
        raw[0] ^= 0xFF
        bad = base64.b64encode(bytes(raw)).decode()
        try:
            db.salv_documents.update_one(
                {"doc_id": pytest.salv_doc_id},
                {"$set": {"encryption.wrapped_dek_b64": bad}},
            )
            r = requests.get(
                f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
                headers=_h(demo_token), timeout=30,
            )
            assert r.status_code == 500, f"tampered wrapped_dek should 500, got {r.status_code}"
        finally:
            db.salv_documents.update_one(
                {"doc_id": pytest.salv_doc_id},
                {"$set": {"encryption.wrapped_dek_b64": orig}},
            )


# ─── delete + counter decrement ──────────────────────────────────────────────

class TestDelete:
    def test_delete_owner_only(self, demo_token, alice_token):
        # alice cannot delete demo's docs
        r = requests.delete(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}",
            headers=_h(alice_token), timeout=30,
        )
        assert r.status_code == 404, f"non-owner delete should 404, got {r.status_code}"

    def test_delete_success_and_count(self, demo_token):
        # snapshot count
        r0 = requests.get(f"{API}/salv/assets/{pytest.salv_asset_id}", headers=_h(demo_token), timeout=30)
        before = None
        if r0.status_code == 200:
            asset_obj = r0.json().get("asset") if isinstance(r0.json(), dict) and "asset" in r0.json() else r0.json()
            before = (asset_obj or {}).get("document_count")

        r = requests.delete(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}",
            headers=_h(demo_token), timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # verify gone
        r2 = requests.get(
            f"{API}/salv/assets/{pytest.salv_asset_id}/documents/{pytest.salv_doc_id}/download",
            headers=_h(demo_token), timeout=30,
        )
        assert r2.status_code == 404

        if before is not None:
            r3 = requests.get(f"{API}/salv/assets/{pytest.salv_asset_id}", headers=_h(demo_token), timeout=30)
            after_obj = r3.json().get("asset") if isinstance(r3.json(), dict) and "asset" in r3.json() else r3.json()
            after = (after_obj or {}).get("document_count")
            if after is not None:
                assert after == before - 1, f"document_count not decremented: before={before} after={after}"
