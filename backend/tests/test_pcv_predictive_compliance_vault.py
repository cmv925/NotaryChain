"""
Predictive Compliance Vault (PCV) — Backend API Test Suite
Tests all 5 sub-systems: integrity scan, regulatory oracle, remediation,
portfolio graph, evidence packets (incl. public verifier).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://acn-oracle-live.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if not tok:
        pytest.skip(f"No token in login response: {data}")
    return tok


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def shared_state():
    return {}


# ─── Auth gating ─────────────────────────────────────────────────────────────

class TestAuth:
    def test_dashboard_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/pcv/dashboard", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_seed_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/pcv/regulatory/seed", timeout=15)
        assert r.status_code in (401, 403)


# ─── Dashboard ───────────────────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_structure(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/dashboard", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for key in ("portfolio", "integrity", "compliance", "remediation", "evidence"):
            assert key in data, f"Missing dashboard section: {key}"
        assert "document_count" in data["portfolio"]
        assert "integrity_score" in data["portfolio"]
        assert "open_issues" in data["integrity"]
        assert "passing" in data["compliance"]


# ─── Regulatory Oracle ───────────────────────────────────────────────────────

class TestRegulatory:
    def test_seed_rules_idempotent(self, auth_headers):
        # First call (may insert or be no-op if already seeded)
        r1 = requests.post(f"{BASE_URL}/api/pcv/regulatory/seed", headers=auth_headers, timeout=30)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1.get("ok") is True
        assert "inserted_or_updated" in d1

        # Second call should not insert new ones
        r2 = requests.post(f"{BASE_URL}/api/pcv/regulatory/seed", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("inserted_or_updated", 0) == 0, "Seed should be idempotent on second call"

    def test_list_rules_returns_7_baseline(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/regulatory/rules", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "rules" in data and "count" in data
        assert data["count"] >= 7, f"Expected at least 7 baseline rules, got {data['count']}"
        jurisdictions = {rule["jurisdiction"] for rule in data["rules"]}
        assert {"FL", "TX", "NY", "CA", "VA"}.issubset(jurisdictions)

    def test_list_rules_jurisdiction_filter(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/regulatory/rules?jurisdiction=FL", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        for rule in r.json()["rules"]:
            assert rule["jurisdiction"] == "FL"

    def test_record_change_valid(self, auth_headers, shared_state):
        body = {
            "rule_id": "fl-117-245-journal",
            "change_kind": "amended",
            "summary": "TEST_ pytest amended change",
            "diff": "minor text change",
        }
        r = requests.post(f"{BASE_URL}/api/pcv/regulatory/changes", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["change"]["change_kind"] == "amended"
        shared_state["change_id"] = data["change"]["id"]

    def test_record_change_invalid_kind_422(self, auth_headers):
        body = {"rule_id": "x", "change_kind": "BOGUS", "summary": "foo"}
        r = requests.post(f"{BASE_URL}/api/pcv/regulatory/changes", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 422

    def test_record_change_missing_required_field_422(self, auth_headers):
        body = {"rule_id": "x", "summary": "foo"}  # missing change_kind
        r = requests.post(f"{BASE_URL}/api/pcv/regulatory/changes", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 422

    def test_list_changes(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/regulatory/changes", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "changes" in data and "count" in data
        assert data["count"] >= 1

    def test_rescore_portfolio(self, auth_headers, shared_state):
        r = requests.post(f"{BASE_URL}/api/pcv/regulatory/rescore", headers=auth_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "scored" in data and "flagged" in data and "rules" in data
        shared_state["scored"] = data["scored"]
        shared_state["flagged"] = data["flagged"]


# ─── Compliance scores ───────────────────────────────────────────────────────

class TestComplianceScores:
    def test_list_scores(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/compliance/scores", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "scores" in data and "count" in data

    def test_list_scores_status_filter_valid(self, auth_headers):
        for status in ["passing", "warning", "failing"]:
            r = requests.get(
                f"{BASE_URL}/api/pcv/compliance/scores?status={status}",
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, f"status={status} failed: {r.text}"
            for s in r.json()["scores"]:
                assert s["status"] == status

    def test_list_scores_status_filter_invalid_422(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/compliance/scores?status=BAD", headers=auth_headers, timeout=15)
        assert r.status_code == 422


# ─── Integrity scan ──────────────────────────────────────────────────────────

class TestIntegrity:
    def test_trigger_scan(self, auth_headers, shared_state):
        r = requests.post(f"{BASE_URL}/api/pcv/integrity/scan", headers=auth_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        scan = data["scan"]
        assert "id" in scan
        assert "documents_scanned" in scan
        assert "issues_found" in scan
        assert scan["triggered_by"] == "manual"
        shared_state["scan_id"] = scan["id"]

    def test_list_scans(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/integrity/scans", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "scans" in data
        assert len(data["scans"]) >= 1

    def test_list_issues(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/integrity/issues", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "issues" in data and "count" in data

    def test_list_issues_invalid_status_422(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/integrity/issues?status=foo", headers=auth_headers, timeout=15)
        assert r.status_code == 422

    def test_list_issues_invalid_severity_422(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/integrity/issues?severity=urgent", headers=auth_headers, timeout=15)
        assert r.status_code == 422

    def test_acknowledge_nonexistent_issue_404(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/pcv/integrity/issues/does-not-exist/acknowledge",
            json={"note": "TEST_ ack"}, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 404


# ─── Remediation ─────────────────────────────────────────────────────────────

class TestRemediation:
    def test_draft_all(self, auth_headers, shared_state):
        r = requests.post(f"{BASE_URL}/api/pcv/remediation/draft-all", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "tasks_created" in data
        shared_state["draft_first"] = data["tasks_created"]

    def test_draft_all_idempotent(self, auth_headers, shared_state):
        # Second draft should create 0 new tasks (existing pending tasks already in place)
        r = requests.post(f"{BASE_URL}/api/pcv/remediation/draft-all", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        assert r.json().get("tasks_created", -1) == 0, "Second draft-all should skip existing pending tasks"

    def test_list_tasks(self, auth_headers, shared_state):
        r = requests.get(f"{BASE_URL}/api/pcv/remediation/tasks", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "tasks" in data and "count" in data
        if data["count"] > 0:
            shared_state["task_id"] = data["tasks"][0]["id"]

    def test_list_tasks_invalid_status_422(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/remediation/tasks?status=weird", headers=auth_headers, timeout=15)
        assert r.status_code == 422

    def test_get_task_detail(self, auth_headers, shared_state):
        if "task_id" not in shared_state:
            pytest.skip("No task available")
        r = requests.get(
            f"{BASE_URL}/api/pcv/remediation/tasks/{shared_state['task_id']}",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == shared_state["task_id"]
        assert "plan_steps" in data
        assert isinstance(data["plan_steps"], list)
        assert "ai_summary" in data

    def test_get_task_404(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/remediation/tasks/non-existent-id", headers=auth_headers, timeout=15)
        assert r.status_code == 404

    def test_approve_task(self, auth_headers, shared_state):
        if "task_id" not in shared_state:
            pytest.skip("No task available")
        r = requests.post(
            f"{BASE_URL}/api/pcv/remediation/tasks/{shared_state['task_id']}/approve",
            json={"note": "TEST_ approved"}, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # Verify status transitioned
        r2 = requests.get(
            f"{BASE_URL}/api/pcv/remediation/tasks/{shared_state['task_id']}",
            headers=auth_headers, timeout=15,
        )
        assert r2.json()["status"] == "approved"

    def test_complete_task(self, auth_headers, shared_state):
        if "task_id" not in shared_state:
            pytest.skip("No task available")
        r = requests.post(
            f"{BASE_URL}/api/pcv/remediation/tasks/{shared_state['task_id']}/complete",
            json={"note": "TEST_ done"}, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200

        r2 = requests.get(
            f"{BASE_URL}/api/pcv/remediation/tasks/{shared_state['task_id']}",
            headers=auth_headers, timeout=15,
        )
        assert r2.json()["status"] == "completed"

    def test_reject_nonexistent_task_404(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/pcv/remediation/tasks/missing/reject",
            json={"note": "x"}, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 404


# ─── Portfolio Graph ─────────────────────────────────────────────────────────

class TestPortfolioGraph:
    def test_rebuild_graph(self, auth_headers, shared_state):
        r = requests.post(f"{BASE_URL}/api/pcv/portfolio/graph/rebuild", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "root" in data
        assert "node_count" in data
        if data["node_count"] > 0:
            assert data["root"] is not None
            assert len(data["root"]) == 64  # SHA-256 hex
            assert "anchor_id" in data
            shared_state["anchor_id"] = data["anchor_id"]
            shared_state["root"] = data["root"]

    def test_get_graph(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/portfolio/graph", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "anchor" in data
        assert "nodes" in data
        assert "node_count" in data

    def test_get_graph_max_nodes_pagination(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/portfolio/graph?max_nodes=1", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["nodes"]) <= 1

    def test_anchor_to_hedera(self, auth_headers, shared_state):
        if "anchor_id" not in shared_state:
            pytest.skip("No anchor_id available")
        r = requests.post(
            f"{BASE_URL}/api/pcv/portfolio/graph/{shared_state['anchor_id']}/anchor-hedera",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "transaction_id" in data
        tx = data["transaction_id"]
        # Either real Hedera tx OR simulated fallback "0.0.10373605@ts.nonce"
        assert tx is not None and len(tx) > 5

    def test_anchor_nonexistent_returns_error(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/pcv/portfolio/graph/no-such-anchor/anchor-hedera",
            headers=auth_headers, timeout=15,
        )
        # Returns ok=False JSON, not 404
        assert r.status_code == 200
        assert r.json().get("ok") is False


# ─── Evidence Packets ────────────────────────────────────────────────────────

class TestEvidencePacket:
    def test_generate_packet(self, auth_headers, shared_state):
        body = {"title": "TEST_ Pytest Evidence Packet"}
        r = requests.post(
            f"{BASE_URL}/api/pcv/evidence-packet/generate",
            json=body, headers=auth_headers, timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        packet = data["packet"]
        assert "id" in packet
        assert "packet_hash" in packet
        assert len(packet["packet_hash"]) == 64  # SHA-256
        assert "hedera_transaction_id" in packet
        assert "ceremony_count" in packet
        # Body should be stripped from generate response
        assert "body" not in packet
        shared_state["packet_id"] = packet["id"]
        shared_state["packet_hash"] = packet["packet_hash"]

    def test_list_packets(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/evidence-packet", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "packets" in data and "count" in data
        assert data["count"] >= 1

    def test_get_packet_metadata_no_body(self, auth_headers, shared_state):
        if "packet_id" not in shared_state:
            pytest.skip("No packet_id available")
        r = requests.get(
            f"{BASE_URL}/api/pcv/evidence-packet/{shared_state['packet_id']}",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == shared_state["packet_id"]
        assert "body" not in data, "Metadata endpoint should not return packet body"

    def test_download_packet_full_body(self, auth_headers, shared_state):
        if "packet_id" not in shared_state:
            pytest.skip("No packet_id available")
        r = requests.get(
            f"{BASE_URL}/api/pcv/evidence-packet/{shared_state['packet_id']}/download",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        assert "attachment" in r.headers.get("Content-Disposition", "").lower()
        import json as _json
        body = _json.loads(r.content)
        assert "body" in body
        assert "ceremonies" in body["body"]

    def test_get_packet_404(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pcv/evidence-packet/nope", headers=auth_headers, timeout=15)
        assert r.status_code == 404

    # ── CRITICAL: Public verifier must work WITHOUT auth ────────────────────
    def test_verify_packet_public_no_auth_required(self, shared_state):
        if "packet_id" not in shared_state:
            pytest.skip("No packet_id available")
        # IMPORTANT: no auth headers — must succeed
        r = requests.get(
            f"{BASE_URL}/api/pcv/evidence-packet/{shared_state['packet_id']}/verify",
            timeout=30,
        )
        assert r.status_code == 200, f"Public verifier failed without auth: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data["ok"] is True, f"Verifier reported tampered: {data}"
        assert data["stored_hash"] == shared_state["packet_hash"]
        assert data["recomputed_hash"] == data["stored_hash"], (
            f"Hash mismatch! stored={data['stored_hash']} recomputed={data['recomputed_hash']}"
        )
        assert "hedera_transaction_id" in data
        assert data["packet_id"] == shared_state["packet_id"]

    def test_verify_nonexistent_packet_404(self):
        r = requests.get(f"{BASE_URL}/api/pcv/evidence-packet/does-not-exist/verify", timeout=15)
        assert r.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
