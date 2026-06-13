"""
Smart Document Studio — backend regression tests.

Covers the full lifecycle endpoints added to ai_generator_routes.py:
generate → edit-section → save → suggest-conditions → compliance-check → notarize.
Uses the cookie-session login (admin bypasses the identity gate for notarize).
"""
import pytest
from credentials import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, UA_HEADERS
import requests


@pytest.fixture
def studio_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    r.raise_for_status()
    return s


@pytest.fixture
def generated_doc(studio_session):
    r = studio_session.post(f"{BASE_URL}/api/ai-generator/generate", json={
        "description": "A simple NDA between Acme Corp and Jane Doe in California, 2 year term.",
        "document_type": "nda",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("generation_id")
    assert data["document"].get("sections")
    return studio_session, data["generation_id"]


def test_types(studio_session):
    r = studio_session.get(f"{BASE_URL}/api/ai-generator/types")
    assert r.status_code == 200
    assert len(r.json()["types"]) > 0


def test_edit_section(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/edit-section", json={
        "generation_id": gid, "section_index": 0,
        "instruction": "Make the parties clause more formal.",
    })
    assert r.status_code == 200, r.text
    assert r.json()["section"].get("content")


def test_save_signers_conditions(generated_doc):
    s, gid = generated_doc
    r = s.put(f"{BASE_URL}/api/ai-generator/documents/{gid}", json={
        "generation_id": gid,
        "signers": [{"role": "Disclosing Party", "name": "Acme", "email": "a@x.com"}],
        "conditions": [{"id": "1", "label": "Term end", "enabled": True}],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["signers"]) == 1 and len(body["conditions"]) == 1


def test_suggest_conditions(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/suggest-conditions", json={"generation_id": gid})
    assert r.status_code == 200, r.text
    conds = r.json()["conditions"]
    assert isinstance(conds, list)
    for c in conds:
        assert "id" in c and "label" in c


def test_compliance_check(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/compliance-check", json={"generation_id": gid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "score" in body and "issues" in body and "counts" in body
    assert 0 <= body["score"] <= 100


def test_notarize_anchor(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/notarize", json={"generation_id": gid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("anchor_id") and body.get("content_hash")
    # The anchored doc must now resolve via the public verify-by-hash endpoint.
    v = s.get(f"{BASE_URL}/api/contract-templates/verify/{body['content_hash']}")
    assert v.status_code == 200


def test_notarize_requires_auth():
    anon = requests.Session()
    anon.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    r = anon.post(f"{BASE_URL}/api/ai-generator/notarize", json={"generation_id": "x"})
    assert r.status_code == 401
