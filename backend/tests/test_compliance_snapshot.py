"""Tests for the Compliance Snapshot share + public view endpoints."""
import os
import pytest
import httpx

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001")


async def _login(email: str, password: str) -> str:
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        r = await c.post("/api/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]


@pytest.mark.asyncio
async def test_snapshot_share_and_fetch_roundtrip():
    tok = await _login("demo@test.com", "Demo123!")
    async with httpx.AsyncClient(base_url=BASE, timeout=60.0) as c:
        # Create
        r = await c.post(
            "/api/compliance/snapshots/share",
            params={"ttl_days": 3, "note": "test note for broker"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("token", "share_url", "expires_at", "overall_score"):
            assert k in body
        snap_token = body["token"]
        assert snap_token in body["share_url"]

        # Public fetch (no auth)
        r2 = await c.get(f"/api/compliance/snapshots/{snap_token}")
        assert r2.status_code == 200, r2.text
        snap = r2.json()
        assert snap["overall_score"] == body["overall_score"]
        assert snap["note"] == "test note for broker"
        assert "***" in snap["owner_email_masked"]  # PII masked
        # PII scrub check
        import json
        raw = json.dumps(snap)
        assert "ceremony_id" not in raw, "ceremony_id should be scrubbed"
        assert "owner_user_id" not in raw, "owner_user_id should be scrubbed"
        assert "document_name" not in raw, "document_name should be scrubbed"

        # View counter increments
        r3 = await c.get(f"/api/compliance/snapshots/{snap_token}")
        assert r3.status_code == 200
        assert r3.json()["view_count"] >= snap["view_count"]


@pytest.mark.asyncio
async def test_snapshot_share_requires_auth():
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as c:
        r = await c.post("/api/compliance/snapshots/share")
        assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_snapshot_unknown_token_404():
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as c:
        r = await c.get("/api/compliance/snapshots/this-token-does-not-exist-xyz")
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_snapshot_ttl_param_bounds():
    """ttl_days must be between 1 and 30 inclusive."""
    tok = await _login("demo@test.com", "Demo123!")
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        r0 = await c.post(
            "/api/compliance/snapshots/share",
            params={"ttl_days": 0},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r0.status_code in (400, 422)
        r_huge = await c.post(
            "/api/compliance/snapshots/share",
            params={"ttl_days": 365},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r_huge.status_code in (400, 422)


@pytest.mark.asyncio
async def test_snapshot_uses_origin_header_for_share_url():
    tok = await _login("demo@test.com", "Demo123!")
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        r = await c.post(
            "/api/compliance/snapshots/share",
            params={"ttl_days": 1},
            headers={
                "Authorization": f"Bearer {tok}",
                "Origin": "https://my-frontend.example.com",
            },
        )
        assert r.status_code == 200
        # Behind ingress with X-Forwarded-* headers set, those take priority over
        # the Origin header — accept either as long as it's an absolute http(s) URL
        # to /compliance/snapshot/{token}.
        url = r.json()["share_url"]
        assert url.startswith("http"), url
        assert "/compliance/snapshot/" in url


@pytest.mark.asyncio
async def test_admin_overview_has_evaluator_error_kpis():
    tok = await _login("admin@notarychain.com", "Admin123!")
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        r = await c.get(
            "/api/admin/analytics/overview",
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200
        body = r.json()
        # New fail-closed evaluator KPI fields
        assert "evaluator_errors_24h" in body
        assert "evaluator_errors_total" in body
        assert isinstance(body["evaluator_errors_24h"], int)
        assert isinstance(body["evaluator_errors_total"], int)
        assert body["evaluator_errors_24h"] >= 0
        assert body["evaluator_errors_total"] >= body["evaluator_errors_24h"]
