"""Tests for Smart Contract Template Library APIs."""
import os
import pytest
import requests
from credentials import BASE_URL, DEMO_EMAIL, DEMO_PASSWORD, UA_HEADERS
from pymongo import MongoClient


@pytest.fixture(scope="module")
def demo_token():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_client(demo_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS,
                      "Authorization": f"Bearer {demo_token}"})
    return s


@pytest.fixture(scope="module")
def mongo_users():
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    return db.users


# ---- LIST ----
def test_list_returns_17_templates_and_6_categories(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/contract-templates")
    assert r.status_code == 200
    data = r.json()
    assert len(data["categories"]) == 6
    assert len(data["templates"]) == 17
    # sorted by popularity desc
    pops = [t["popularity"] for t in data["templates"]]
    assert pops == sorted(pops, reverse=True)


def test_list_filter_by_category_business(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/contract-templates?category=business")
    assert r.status_code == 200
    items = r.json()["templates"]
    assert len(items) > 0
    assert all(t["category"] == "business" for t in items)


def test_list_search_lease(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/contract-templates?q=lease")
    assert r.status_code == 200
    items = r.json()["templates"]
    assert len(items) >= 2
    assert all("lease" in t["name"].lower() or "lease" in t["description"].lower() for t in items)


# ---- DETAIL ----
def test_detail_nda_field_schema(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/contract-templates/detail/nda")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "nda"
    assert isinstance(data["fields"], list) and len(data["fields"]) > 0
    f0 = data["fields"][0]
    for k in ["key", "label", "type", "required"]:
        assert k in f0


# ---- RENDER deterministic ----
def test_render_nda_full_substitution(auth_client):
    payload = {"values": {
        "disclosing_party": "Acme Inc.",
        "receiving_party": "Jane Doe",
        "effective_date": "2026-01-15",
        "purpose": "Evaluating a partnership",
        "term_years": "3",
        "governing_law": "Florida",
    }}
    r = auth_client.post(f"{BASE_URL}/api/contract-templates/render/nda", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"]
    assert data["missing_fields"] == []
    assert "Acme Inc." in data["content"]
    assert "Jane Doe" in data["content"]
    assert "{{" not in data["content"]
    assert data.get("ai_tailored") is False


def test_render_nda_missing_required_fields(auth_client):
    r = auth_client.post(f"{BASE_URL}/api/contract-templates/render/nda",
                         json={"values": {"disclosing_party": "Acme Inc."}})
    assert r.status_code == 200
    data = r.json()
    assert len(data["missing_fields"]) >= 4
    assert "[__________]" in data["content"]


# ---- RENDER AI ----
def test_render_with_ai_tailor_returns_content(auth_client):
    payload = {
        "values": {
            "disclosing_party": "Acme Inc.",
            "receiving_party": "Jane Doe",
            "effective_date": "2026-01-15",
            "purpose": "Evaluating a partnership",
            "term_years": "3",
            "governing_law": "Florida",
        },
        "ai_tailor": True,
        "instructions": "Add a severability clause.",
    }
    r = auth_client.post(f"{BASE_URL}/api/contract-templates/render/nda",
                         json=payload, timeout=90)
    # Whatever happens upstream, response must be 200 (graceful fallback).
    assert r.status_code == 200, r.text
    data = r.json()
    assert "ai_tailored" in data
    assert "Acme Inc." in data["content"]
    assert "Jane Doe" in data["content"]


# ---- ANCHOR GATE ----
def _ensure_unverified(mongo_users):
    mongo_users.update_one({"email": DEMO_EMAIL}, {"$set": {"identity_verified": False}})


def _ensure_verified(mongo_users):
    mongo_users.update_one({"email": DEMO_EMAIL}, {"$set": {"identity_verified": True}})


def test_anchor_blocked_when_unverified(auth_client, mongo_users):
    _ensure_unverified(mongo_users)
    payload = {
        "template_id": "nda",
        "title": "NDA - test",
        "content": "This NDA is between A and B " * 5,
    }
    r = auth_client.post(f"{BASE_URL}/api/contract-templates/anchor", json=payload)
    assert r.status_code == 403
    detail = r.json().get("detail", "")
    assert "identity_verification_required" in str(detail)


def test_anchor_success_when_verified_and_listed(auth_client, mongo_users):
    _ensure_verified(mongo_users)
    try:
        payload = {
            "template_id": "nda",
            "title": "TEST_NDA Anchor",
            "content": "This NDA is between Acme and Jane Doe. " * 5,
        }
        r = auth_client.post(f"{BASE_URL}/api/contract-templates/anchor", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["anchor_id", "content_hash", "transaction_id", "topic_id",
                  "explorer_url", "anchored_at"]:
            assert k in data and data[k] is not None, f"missing {k}"
        assert len(data["content_hash"]) == 64
        anchor_id = data["anchor_id"]

        # GET my anchors
        r2 = auth_client.get(f"{BASE_URL}/api/contract-templates/anchors/my")
        assert r2.status_code == 200
        anchors = r2.json()["anchors"]
        assert any(a["id"] == anchor_id for a in anchors)

        # GET single anchor (incl content)
        r3 = auth_client.get(f"{BASE_URL}/api/contract-templates/anchors/{anchor_id}")
        assert r3.status_code == 200
        single = r3.json()
        assert single["id"] == anchor_id
        assert "content" in single and len(single["content"]) > 20
    finally:
        # Reset demo back to UNVERIFIED so other gate tests keep working.
        _ensure_unverified(mongo_users)


def test_anchor_content_too_short_400(auth_client, mongo_users):
    _ensure_verified(mongo_users)
    try:
        r = auth_client.post(
            f"{BASE_URL}/api/contract-templates/anchor",
            json={"template_id": "nda", "title": "x", "content": "tiny"},
        )
        assert r.status_code == 400
    finally:
        _ensure_unverified(mongo_users)


def test_unauthenticated_render_blocked():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    r = s.post(f"{BASE_URL}/api/contract-templates/render/nda", json={"values": {}})
    assert r.status_code in (401, 403)
