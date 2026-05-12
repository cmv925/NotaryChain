"""
Field Document Scanner (Phase 1) — backend tests
Covers: POST /api/scanner/scans (run_ai false fast path, true GPT-5.2 path),
        idempotent canonical hash, GET list/detail, 403/404 access, seal idempotency,
        prior_seal detection from blockchain_seals collection.
"""
import os
import io
import time
import base64
import hashlib
import asyncio
import requests
import pytest
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN = ("admin@notarychain.com", "Admin123!")
USER = ("demo@test.com", "Demo123!")


# ---------- helpers ----------

def make_real_png(seed: int = 1) -> str:
    """Build a small PNG with real visual features (lines, shapes, text-like marks) → base64."""
    img = Image.new("RGB", (320, 200), (245, 245, 240))
    d = ImageDraw.Draw(img)
    # borders / boxes / strokes — gives gradients, edges, textures
    d.rectangle([10, 10, 310, 190], outline=(20, 20, 20), width=2)
    for i in range(0, 320, 20):
        d.line([(i, 0), (i, 200)], fill=(220 - (i % 40), 200, 180), width=1)
    d.rectangle([40, 40, 280, 70], fill=(200, 215, 230), outline=(40, 40, 80))
    d.ellipse([60 + seed, 100, 180 + seed, 160], fill=(120, 60, 60), outline=(0, 0, 0))
    d.line([(20, 180), (300, 30)], fill=(0, 80, 0), width=3)
    # pseudo text bars
    for y in (90, 110, 130):
        d.rectangle([200, y, 270, y + 5], fill=(50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def session():
    return requests.Session()


def _login(s, email, password):
    last = None
    for _ in range(3):
        try:
            r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=60)
            if r.status_code == 200:
                return r.json()["access_token"]
            last = f"{r.status_code} {r.text[:200]}"
        except Exception as e:
            last = str(e)
            time.sleep(2)
    raise AssertionError(f"login failed after retries: {last}")


@pytest.fixture(scope="module")
def user_token(session):
    return _login(session, *USER)


@pytest.fixture(scope="module")
def admin_token(session):
    return _login(session, *ADMIN)


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- canonical hash idempotency ----------

class TestCanonicalHash:
    def test_same_pages_yield_same_hash(self, session, user_token):
        pages = [{"image_base64": make_real_png(1), "page_number": 1},
                 {"image_base64": make_real_png(2), "page_number": 2}]
        body = {"document_label": "TEST_idempotency", "pages": pages, "run_ai": False}
        r1 = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=30)
        r2 = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=30)
        assert r1.status_code == 200, r1.text[:200]
        assert r2.status_code == 200, r2.text[:200]
        h1 = r1.json()["document_hash"]
        h2 = r2.json()["document_hash"]
        assert h1 == h2
        assert len(h1) == 64
        # Page hashes should be in order and length 2
        assert len(r1.json()["page_hashes"]) == 2

    def test_empty_pages_rejected(self, session, user_token):
        body = {"document_label": "TEST_empty", "pages": [], "run_ai": False}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=15)
        assert r.status_code in (400, 422)

    def test_unauth_rejected(self, session):
        body = {"document_label": "TEST_noauth", "pages": [{"image_base64": make_real_png(), "page_number": 1}], "run_ai": False}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, timeout=15)
        assert r.status_code == 401


# ---------- fast path (no AI) ----------

class TestScanFastPath:
    def test_create_no_ai(self, session, user_token):
        b64 = make_real_png(7)
        body = {"document_label": "TEST_fastpath", "pages": [{"image_base64": b64, "page_number": 1}], "run_ai": False}
        t0 = time.time()
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=20)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["ai_analysis"] is None
        assert d["document_hash"] and len(d["document_hash"]) == 64
        assert d["page_count"] == 1
        assert d["sealed"] is False
        assert d["prior_seal"] in (None, False) or d["prior_seal"].get("found") in (True, False)
        # fast: should be well under 5s even with cold start
        assert elapsed < 8, f"fast-path too slow: {elapsed:.2f}s"


# ---------- AI path (GPT-5.2 Vision, real) ----------

class TestScanAIPath:
    def test_create_with_ai(self, session, user_token):
        body = {"document_label": "TEST_ai_path",
                "pages": [{"image_base64": make_real_png(9), "page_number": 1}],
                "run_ai": True}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=90)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        a = d.get("ai_analysis")
        assert a is not None, "ai_analysis should be present when run_ai=True"
        # may be ai_powered=True (live) or False (fallback) — but model should be reported
        assert a.get("overall_risk") in ("low", "medium", "high")
        assert 0.0 <= float(a.get("overall_confidence", 0.5)) <= 1.0
        assert a.get("recommendation") in ("accept", "manual_review", "reject")
        assert "pages" in a
        # When live, ai_powered=true, model='gpt-5.2'
        if a.get("ai_powered"):
            assert a.get("model") == "gpt-5.2"


# ---------- list / detail / scoping ----------

class TestScanAccessControl:
    @pytest.fixture(scope="class")
    def created_scan(self, session, user_token):
        body = {"document_label": "TEST_for_access",
                "pages": [{"image_base64": make_real_png(3), "page_number": 1}], "run_ai": False}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=20)
        assert r.status_code == 200
        return r.json()

    def test_list_user_scoped(self, session, user_token, created_scan):
        r = session.get(f"{BASE_URL}/api/scanner/scans?limit=50", headers=H(user_token), timeout=20)
        assert r.status_code == 200
        scan_ids = [s["scan_id"] for s in r.json().get("scans", [])]
        assert created_scan["scan_id"] in scan_ids

    def test_get_own(self, session, user_token, created_scan):
        r = session.get(f"{BASE_URL}/api/scanner/scans/{created_scan['scan_id']}", headers=H(user_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["scan_id"] == created_scan["scan_id"]

    def test_get_unknown_404(self, session, user_token):
        r = session.get(f"{BASE_URL}/api/scanner/scans/doesnotexist123", headers=H(user_token), timeout=20)
        assert r.status_code == 404

    def test_admin_sees_all(self, session, admin_token, created_scan):
        r = session.get(f"{BASE_URL}/api/scanner/scans?limit=100", headers=H(admin_token), timeout=20)
        assert r.status_code == 200
        # admin should at least see the same scan in their list (unscoped) — may need pagination but limit is 100
        assert r.json()["total"] >= 1


# ---------- seal idempotency ----------

class TestSealing:
    @pytest.fixture(scope="class")
    def scan_for_seal(self, session, user_token):
        body = {"document_label": "TEST_seal_idem",
                "pages": [{"image_base64": make_real_png(11), "page_number": 1}], "run_ai": False}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=20)
        assert r.status_code == 200
        return r.json()

    def test_seal_then_idempotent(self, session, user_token, scan_for_seal):
        sid = scan_for_seal["scan_id"]
        r1 = session.post(f"{BASE_URL}/api/scanner/scans/{sid}/seal", headers=H(user_token), timeout=60)
        if r1.status_code == 502:
            pytest.skip(f"Hedera unavailable in this env: {r1.text[:150]}")
        assert r1.status_code == 200, r1.text[:300]
        assert r1.json().get("already_sealed") is False
        # second call → already_sealed=True
        r2 = session.post(f"{BASE_URL}/api/scanner/scans/{sid}/seal", headers=H(user_token), timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("already_sealed") is True

    def test_seal_unknown_404(self, session, user_token):
        r = session.post(f"{BASE_URL}/api/scanner/scans/doesnotexist123/seal", headers=H(user_token), timeout=15)
        assert r.status_code == 404


# ---------- prior_seal detection (DB seeding) ----------

class TestPriorSealDetection:
    def test_prior_seal_returned_when_hash_already_sealed(self, session, user_token):
        """Seed a fake seal in blockchain_seals matching a known doc_hash and
        verify create_scan response surfaces prior_seal.found=True."""
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        assert mongo_url and db_name

        async def run():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            # Build deterministic doc_hash for a 1-page scan
            b64 = make_real_png(17)
            raw = base64.b64decode(b64)
            page_hash = hashlib.sha256(raw).hexdigest()
            canonical = "\n".join(sorted([page_hash]))
            doc_hash = hashlib.sha256(canonical.encode()).hexdigest()
            # Seed seal
            await db.blockchain_seals.delete_many({"document_hash": doc_hash})
            await db.blockchain_seals.insert_one({
                "document_hash": doc_hash,
                "topic_id": "0.0.TEST_TOPIC",
                "sequence_number": 4242,
                "transaction_id": "0.0.123@1700000000.000000000",
                "sealed_at": "2026-01-01T00:00:00+00:00",
                "explorer_url": "https://hashscan.io/mainnet/topic/0.0.TEST_TOPIC/4242",
                "document_name": "TEST_seeded",
                "network": "Hedera Mainnet",
            })
            client.close()
            return b64, doc_hash

        b64, expected_doc_hash = asyncio.get_event_loop().run_until_complete(run())

        # Now hit the scanner endpoint with the same image → prior_seal.found=True
        body = {"document_label": "TEST_priorseal",
                "pages": [{"image_base64": b64, "page_number": 1}], "run_ai": False}
        r = session.post(f"{BASE_URL}/api/scanner/scans", json=body, headers=H(user_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["document_hash"] == expected_doc_hash
        assert d["prior_seal"] is not None
        assert d["prior_seal"].get("found") is True
        assert d["prior_seal"].get("topic_id") == "0.0.TEST_TOPIC"
        assert d["prior_seal"].get("sequence_number") == 4242
        assert "hashscan" in (d["prior_seal"].get("explorer_url") or "")
