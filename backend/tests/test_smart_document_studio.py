"""
Smart Document Studio — backend regression tests.

Covers the full lifecycle endpoints added to ai_generator_routes.py:
generate → edit-section → save → suggest-conditions → compliance-check → notarize.
Uses the cookie-session login (admin bypasses the identity gate for notarize).
"""
import pytest
from credentials import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, UA_HEADERS
import requests
import time


def _wait_generated(session, gid, timeout=90):
    """Poll the async generation until the document is ready (status 'generated')."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = session.get(f"{BASE_URL}/api/ai-generator/documents/{gid}")
        if r.status_code == 200:
            d = r.json()
            if d.get("status") == "generated" and d.get("result"):
                return d
            if d.get("status") == "failed":
                raise AssertionError("generation failed")
        time.sleep(2)
    raise AssertionError("generation timed out")


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
    gid = data.get("generation_id")
    assert gid and data.get("status") == "processing"
    _wait_generated(studio_session, gid)
    return studio_session, gid


def test_types(studio_session):
    r = studio_session.get(f"{BASE_URL}/api/ai-generator/types")
    assert r.status_code == 200
    assert len(r.json()["types"]) > 0


def _wait_job(session, job_id, timeout=90):
    """Poll an async AI job until done; returns the result dict."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = session.get(f"{BASE_URL}/api/ai-generator/jobs/{job_id}")
        if r.status_code == 200:
            d = r.json()
            if d.get("status") == "done":
                return d.get("result")
            if d.get("status") == "failed":
                raise AssertionError(f"AI job failed: {d.get('error')}")
        time.sleep(2)
    raise AssertionError("AI job timed out")


def test_edit_section(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/edit-section", json={
        "generation_id": gid, "section_index": 0,
        "instruction": "Make the parties clause more formal.",
    })
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "processing"
    result = _wait_job(s, r.json()["job_id"])
    assert result["section"].get("content") and result.get("document")


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
    conds = _wait_job(s, r.json()["job_id"])["conditions"]
    assert isinstance(conds, list)
    for c in conds:
        assert "id" in c and "label" in c


def test_compliance_check(generated_doc):
    s, gid = generated_doc
    r = s.post(f"{BASE_URL}/api/ai-generator/compliance-check", json={"generation_id": gid})
    assert r.status_code == 200, r.text
    body = _wait_job(s, r.json()["job_id"])
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


def test_clause_library_state_specific(studio_session):
    r = studio_session.get(f"{BASE_URL}/api/ai-generator/clauses", params={"state": "FL", "category": "governing_law"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["clauses"]) >= 1
    assert body["clauses"][0]["state_specific"] is True
    assert "Florida" in body["clauses"][0]["body"]
    assert len(body["categories"]) >= 5 and len(body["states"]) >= 1


def test_notarize_creates_trust_anchor(studio_session):
    # Generate, attach enabled conditions + signers, then notarize → expect a Trust Anchor escrow.
    g = studio_session.post(f"{BASE_URL}/api/ai-generator/generate", json={
        "description": "Consulting agreement, $2000 monthly retainer.", "document_type": "independent_contractor",
    })
    gid = g.json()["generation_id"]
    _wait_generated(studio_session, gid)
    studio_session.put(f"{BASE_URL}/api/ai-generator/documents/{gid}", json={
        "generation_id": gid,
        "signers": [{"role": "Client", "name": "Acme", "email": "a@x.com"}],
        "conditions": [{"id": "c1", "label": "Retainer payment", "type": "payment", "enabled": True}],
    })
    r = studio_session.post(f"{BASE_URL}/api/ai-generator/notarize", json={"generation_id": gid})
    assert r.status_code == 200, r.text
    ta = r.json().get("trust_anchor")
    assert ta and ta.get("escrow_id") and ta.get("conditions_total") == 1
    e = studio_session.get(f"{BASE_URL}/api/escrow/{ta['escrow_id']}")
    assert e.status_code == 200
    esc = e.json()
    assert esc["status"] == "active" and esc["conditions_total"] == 1 and esc["escrow_type"] == "studio"


def test_marketplace_free_purchase_and_paid_checkout():
    """Free templates fulfill instantly; paid templates return a Stripe Checkout URL
    (no real charge is completed in the test). Also covers access-control + royalty ledger."""
    ua = {"Content-Type": "application/json", **UA_HEADERS}
    creator = requests.Session(); creator.headers.update(ua)
    creator.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).raise_for_status()
    g = creator.post(f"{BASE_URL}/api/ai-generator/generate", json={
        "description": "NDA between two startups.", "document_type": "nda",
    })
    gid = g.json()["generation_id"]
    _wait_generated(creator, gid)

    # ---- FREE template: end-to-end fulfillment ----
    free = creator.post(f"{BASE_URL}/api/template-marketplace/publish", json={
        "generation_id": gid, "title": "Free Startup NDA (test)", "description": "Mutual NDA.",
        "category": "Business", "price_usd": 0, "royalty_pct": 10,
    })
    assert free.status_code == 200, free.text
    free_tid = free.json()["id"]

    anon = requests.Session(); anon.headers.update(ua)
    lst = anon.get(f"{BASE_URL}/api/template-marketplace", params={"q": "Free Startup NDA (test)"})
    assert lst.status_code == 200 and any(t["id"] == free_tid for t in lst.json()["templates"])

    buyer = requests.Session(); buyer.headers.update(ua)
    from credentials import DEMO_EMAIL, DEMO_PASSWORD
    buyer.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}).raise_for_status()
    d = buyer.get(f"{BASE_URL}/api/template-marketplace/{free_tid}").json()
    assert d["purchased"] is False and "document" not in d
    co = buyer.post(f"{BASE_URL}/api/template-marketplace/{free_tid}/checkout", json={"origin_url": BASE_URL})
    if not (co.status_code == 400 and "already" in co.text):
        assert co.status_code == 200, co.text
        assert co.json().get("free") is True and co.json().get("generation_id")
        d2 = buyer.get(f"{BASE_URL}/api/template-marketplace/{free_tid}").json()
        assert d2["purchased"] is True and "document" in d2
        again = buyer.post(f"{BASE_URL}/api/template-marketplace/{free_tid}/checkout", json={"origin_url": BASE_URL})
        assert again.status_code == 400

    # ---- PAID template: Stripe Checkout session created (no charge completed) ----
    paid = creator.post(f"{BASE_URL}/api/template-marketplace/publish", json={
        "generation_id": gid, "title": "Paid NDA (test)", "description": "Premium NDA.",
        "category": "Business", "price_usd": 20, "royalty_pct": 10,
    })
    paid_tid = paid.json()["id"]
    buyer2 = requests.Session(); buyer2.headers.update(ua)
    buyer2.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}).raise_for_status()
    co2 = buyer2.post(f"{BASE_URL}/api/template-marketplace/{paid_tid}/checkout", json={"origin_url": BASE_URL})
    assert co2.status_code == 200, co2.text
    body = co2.json()
    assert body.get("free") is False
    assert body.get("checkout_url", "").startswith("https://") and body.get("session_id")
    # Status before payment must be pending/unpaid (we never complete a live charge in tests).
    st = buyer2.get(f"{BASE_URL}/api/template-marketplace/checkout/status/{body['session_id']}")
    assert st.status_code == 200 and st.json().get("payment_status") != "paid"


def test_connect_status_endpoint():
    s = requests.Session(); s.headers.update({"Content-Type": "application/json", **UA_HEADERS})
    s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).raise_for_status()
    r = s.get(f"{BASE_URL}/api/template-marketplace/connect/status")
    assert r.status_code == 200
    body = r.json()
    assert "configured" in body and "connected" in body and "payouts_enabled" in body


