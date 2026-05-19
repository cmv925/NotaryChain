"""Tests for the State Pickability Index endpoint."""
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
async def test_pickability_endpoint_shape():
    tok = await _login("demo@test.com", "Demo123!")
    async with httpx.AsyncClient(base_url=BASE, timeout=60.0) as c:
        r = await c.get(
            "/api/compliance/pickability/me",
            headers={"Authorization": f"Bearer {tok}"},
        )
        r.raise_for_status()
        body = r.json()

    # Required top-level keys
    for k in ("overall_score", "total_open", "total_ready", "states", "nudges", "as_of"):
        assert k in body, f"missing key: {k}"

    assert isinstance(body["states"], list)
    assert isinstance(body["nudges"], list)
    assert 0 <= body["overall_score"] <= 100
    assert body["total_ready"] <= body["total_open"]

    # If there are open ceremonies, each state row has the expected shape
    for s in body["states"]:
        assert set(s.keys()) >= {"state_code", "open_count", "ready_count", "ceremonies", "score"}
        assert 0 <= s["score"] <= 100
        assert s["ready_count"] <= s["open_count"]

    # Nudges are diversified across ceremonies (no duplicate ceremony_id in the first 8 entries
    # unless we have fewer ceremonies than 8 distinct ones).
    ceremony_ids = [n["ceremony_id"] for n in body["nudges"][:8]]
    # The diversification logic prefers 1 nudge per ceremony first; if it has duplicates,
    # it's only because we ran out of distinct ceremonies — but that means the *unique* count
    # equals the distinct-ceremony cap.
    if len(ceremony_ids) > 1:
        assert len(set(ceremony_ids)) >= min(8, len(ceremony_ids))  # all unique up to cap


@pytest.mark.asyncio
async def test_pickability_requires_auth():
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as c:
        r = await c.get("/api/compliance/pickability/me")
        # FastAPI typically returns 401 or 403 for missing token
        assert r.status_code in (401, 403)
