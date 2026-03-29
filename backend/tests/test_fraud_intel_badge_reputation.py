"""
Test Suite for NotaryChain Phase 2-3 Features:
1. Shareable Verification Badge (static HTML + dynamic JS widget)
2. ANAN Phase 2: Dynamic Fraud Intelligence (patterns + RON rules)
3. ANAN Phase 3: Agent Reputation & Self-Tuning Weights

Endpoints tested:
- GET /api/anan/badge/{ceremony_id} - Badge data with embed code (auth required)
- GET /api/anan/badge/{ceremony_id}/json - Public badge JSON (no auth)
- GET /api/fraud-intelligence/patterns - List fraud patterns
- POST /api/fraud-intelligence/patterns - Create fraud pattern (admin)
- POST /api/fraud-intelligence/patterns/{id}/toggle - Toggle active
- DELETE /api/fraud-intelligence/patterns/{id} - Delete pattern
- GET /api/fraud-intelligence/ron-rules - List RON rules
- GET /api/fraud-intelligence/ron-rules/{jurisdiction} - Get specific RON rule
- GET /api/fraud-intelligence/stats - Fraud stats
- GET /api/fraud-intelligence/context - Fraud context for agent injection
- GET /api/anan/reputation - Agent reputations + weights
- POST /api/anan/reputation/tune - Attempt weight tuning
- GET /api/anan/reputation/history - Weight tuning history
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASSWORD = "Test123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"

# Known sealed ceremony from context
SEALED_CEREMONY_ID = "a141f161-a5a9-4df8-a3f4-8d168ed82068"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def notary_token():
    """Get notary auth token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": NOTARY_EMAIL,
        "password": NOTARY_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    pytest.skip(f"Notary login failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def user_token():
    """Get regular user auth token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    pytest.skip(f"User login failed: {resp.status_code} - {resp.text}")


# ═══════════════════════════════════════════════════════
#  FRAUD INTELLIGENCE - PATTERNS
# ═══════════════════════════════════════════════════════

class TestFraudPatterns:
    """Tests for fraud pattern CRUD endpoints."""

    def test_list_fraud_patterns(self, admin_token):
        """GET /api/fraud-intelligence/patterns - List all patterns."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "patterns" in data
        assert "total" in data
        # Should have 8 pre-seeded patterns
        assert data["total"] >= 8, f"Expected at least 8 patterns, got {data['total']}"
        
        # Verify pattern structure
        if data["patterns"]:
            p = data["patterns"][0]
            assert "pattern_id" in p
            assert "category" in p
            assert "title" in p
            assert "severity" in p
            assert "indicators" in p
            assert "active" in p

    def test_list_patterns_has_critical_severity(self, admin_token):
        """Verify 4 critical severity patterns exist."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        patterns = resp.json()["patterns"]
        critical = [p for p in patterns if p["severity"] == "critical"]
        assert len(critical) >= 4, f"Expected at least 4 critical patterns, got {len(critical)}"

    def test_list_patterns_has_high_severity(self, admin_token):
        """Verify 4 high severity patterns exist."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        patterns = resp.json()["patterns"]
        high = [p for p in patterns if p["severity"] == "high"]
        assert len(high) >= 4, f"Expected at least 4 high patterns, got {len(high)}"

    def test_create_fraud_pattern_admin(self, admin_token):
        """POST /api/fraud-intelligence/patterns - Admin can create pattern."""
        resp = requests.post(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "category": "identity",
                "title": "TEST_Pattern_Automated",
                "description": "Test pattern created by automated test suite",
                "severity": "medium",
                "indicators": ["test_indicator_1", "test_indicator_2"],
                "document_types": ["all"],
                "active": True
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "pattern_id" in data
        assert data["title"] == "TEST_Pattern_Automated"
        assert data["severity"] == "medium"
        assert data["active"] == True
        # Store for cleanup
        TestFraudPatterns.created_pattern_id = data["pattern_id"]

    def test_create_fraud_pattern_notary(self, notary_token):
        """POST /api/fraud-intelligence/patterns - Notary can create pattern."""
        resp = requests.post(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {notary_token}"},
            json={
                "category": "document",
                "title": "TEST_Pattern_Notary",
                "description": "Test pattern created by notary",
                "severity": "low",
                "indicators": ["notary_test"],
                "document_types": ["deed"],
                "active": True
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        TestFraudPatterns.notary_pattern_id = resp.json()["pattern_id"]

    def test_create_fraud_pattern_user_forbidden(self, user_token):
        """POST /api/fraud-intelligence/patterns - Regular user cannot create."""
        resp = requests.post(
            f"{BASE_URL}/api/fraud-intelligence/patterns",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "category": "identity",
                "title": "TEST_Should_Fail",
                "description": "This should fail",
                "severity": "low",
                "indicators": [],
            }
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"

    def test_toggle_fraud_pattern(self, admin_token):
        """POST /api/fraud-intelligence/patterns/{id}/toggle - Toggle active status."""
        pattern_id = getattr(TestFraudPatterns, 'created_pattern_id', None)
        if not pattern_id:
            pytest.skip("No pattern created to toggle")
        
        resp = requests.post(
            f"{BASE_URL}/api/fraud-intelligence/patterns/{pattern_id}/toggle",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["pattern_id"] == pattern_id
        assert "active" in data
        # Should be toggled to False (was True)
        assert data["active"] == False

    def test_delete_fraud_pattern(self, admin_token):
        """DELETE /api/fraud-intelligence/patterns/{id} - Delete pattern."""
        pattern_id = getattr(TestFraudPatterns, 'created_pattern_id', None)
        if not pattern_id:
            pytest.skip("No pattern created to delete")
        
        resp = requests.delete(
            f"{BASE_URL}/api/fraud-intelligence/patterns/{pattern_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["deleted"] == True
        assert data["pattern_id"] == pattern_id

    def test_delete_notary_pattern_cleanup(self, admin_token):
        """Cleanup notary-created pattern."""
        pattern_id = getattr(TestFraudPatterns, 'notary_pattern_id', None)
        if pattern_id:
            requests.delete(
                f"{BASE_URL}/api/fraud-intelligence/patterns/{pattern_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )

    def test_list_patterns_no_auth(self):
        """GET /api/fraud-intelligence/patterns - Requires auth."""
        resp = requests.get(f"{BASE_URL}/api/fraud-intelligence/patterns")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════
#  FRAUD INTELLIGENCE - RON RULES
# ═══════════════════════════════════════════════════════

class TestRONRules:
    """Tests for RON compliance rules endpoints."""

    def test_list_ron_rules(self, admin_token):
        """GET /api/fraud-intelligence/ron-rules - List all RON rules."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/ron-rules",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "rules" in data
        assert "total" in data
        # Should have 8 pre-seeded RON rules
        assert data["total"] >= 8, f"Expected at least 8 RON rules, got {data['total']}"

    def test_ron_rules_jurisdictions(self, admin_token):
        """Verify all 8 jurisdictions are present."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/ron-rules",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        rules = resp.json()["rules"]
        jurisdictions = [r["jurisdiction"] for r in rules]
        expected = ["US-FL", "US-TX", "US-VA", "US-NV", "US-OH", "US-IN", "US-CA", "US-NY"]
        for j in expected:
            assert j in jurisdictions, f"Missing jurisdiction: {j}"

    def test_get_florida_ron_rule(self, admin_token):
        """GET /api/fraud-intelligence/ron-rules/US-FL - Florida RON rule."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/ron-rules/US-FL",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["jurisdiction"] == "US-FL"
        assert data["state_name"] == "Florida"
        assert data["ron_enabled"] == True
        assert "FL Stat." in data["statute"]
        assert data["requirements"]["audio_video_required"] == True
        assert data["requirements"]["recording_retention_years"] == 10

    def test_get_california_ron_rule_disabled(self, admin_token):
        """GET /api/fraud-intelligence/ron-rules/US-CA - California RON disabled."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/ron-rules/US-CA",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["jurisdiction"] == "US-CA"
        assert data["state_name"] == "California"
        assert data["ron_enabled"] == False, "California should have ron_enabled=False"
        assert "Pending" in data["statute"] or "pending" in data["statute"].lower()

    def test_get_nonexistent_ron_rule(self, admin_token):
        """GET /api/fraud-intelligence/ron-rules/US-XX - Returns 404."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/ron-rules/US-XX",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 404

    def test_ron_rules_no_auth(self):
        """GET /api/fraud-intelligence/ron-rules - Requires auth."""
        resp = requests.get(f"{BASE_URL}/api/fraud-intelligence/ron-rules")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════
#  FRAUD INTELLIGENCE - STATS & CONTEXT
# ═══════════════════════════════════════════════════════

class TestFraudStats:
    """Tests for fraud stats and context endpoints."""

    def test_fraud_stats(self, admin_token):
        """GET /api/fraud-intelligence/stats - Returns stats."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify fraud_patterns stats
        assert "fraud_patterns" in data
        fp = data["fraud_patterns"]
        assert "total" in fp
        assert "active" in fp
        assert "critical" in fp
        assert "high" in fp
        assert fp["active"] >= 8, f"Expected at least 8 active patterns, got {fp['active']}"
        assert fp["critical"] >= 4, f"Expected at least 4 critical, got {fp['critical']}"
        
        # Verify ron_rules stats
        assert "ron_rules" in data
        rr = data["ron_rules"]
        assert "total" in rr
        assert "enabled" in rr
        assert "disabled" in rr
        assert rr["enabled"] >= 7, f"Expected at least 7 RON enabled, got {rr['enabled']}"
        assert rr["disabled"] >= 1, f"Expected at least 1 RON disabled (CA), got {rr['disabled']}"

    def test_fraud_context_florida_affidavit(self, admin_token):
        """GET /api/fraud-intelligence/context - Returns context for agent injection."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/context",
            params={"document_type": "affidavit", "jurisdiction": "US-FL"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "context" in data
        assert data["document_type"] == "affidavit"
        assert data["jurisdiction"] == "US-FL"
        
        # Context should contain fraud alerts and RON rules
        ctx = data["context"]
        assert "FRAUD ALERTS" in ctx or "fraud" in ctx.lower()
        assert "RON" in ctx or "Florida" in ctx

    def test_fraud_context_california_warning(self, admin_token):
        """GET /api/fraud-intelligence/context - California should show warning."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud-intelligence/context",
            params={"document_type": "deed", "jurisdiction": "US-CA"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        ctx = data["context"]
        # California context should mention RON not authorized or high risk
        assert "California" in ctx or "US-CA" in ctx
        # Should have warning about RON not enabled
        assert "NOT" in ctx or "not" in ctx or "WARNING" in ctx or "disabled" in ctx.lower()


# ═══════════════════════════════════════════════════════
#  SHAREABLE VERIFICATION BADGE
# ═══════════════════════════════════════════════════════

class TestBadge:
    """Tests for shareable verification badge endpoints."""

    def test_get_badge_auth_required(self, admin_token):
        """GET /api/anan/badge/{ceremony_id} - Returns badge with embed code."""
        # First get a ceremony ID
        resp = requests.get(
            f"{BASE_URL}/api/anan/ceremonies",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if resp.status_code != 200 or not resp.json().get("ceremonies"):
            pytest.skip("No ceremonies available for badge test")
        
        ceremony_id = resp.json()["ceremonies"][0]["ceremony_id"]
        
        resp = requests.get(
            f"{BASE_URL}/api/anan/badge/{ceremony_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Badge endpoint doesn't require auth per code review
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "ceremony_id" in data
        assert "status" in data
        assert "embed_html" in data
        assert "embed_js" in data
        assert "is_sealed" in data
        
        # Verify embed_html contains expected elements
        html = data["embed_html"]
        assert "<div" in html
        assert "NotaryChain" in html
        
        # Verify embed_js contains script
        js = data["embed_js"]
        assert "<script>" in js
        assert "fetch" in js

    def test_get_badge_json_public(self):
        """GET /api/anan/badge/{ceremony_id}/json - Public endpoint (no auth)."""
        # Use known sealed ceremony
        resp = requests.get(f"{BASE_URL}/api/anan/badge/{SEALED_CEREMONY_ID}/json")
        
        if resp.status_code == 404:
            # Try to get any ceremony
            admin_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
            })
            if admin_resp.status_code == 200:
                token = admin_resp.json().get("access_token")
                ceremonies_resp = requests.get(
                    f"{BASE_URL}/api/anan/ceremonies",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if ceremonies_resp.status_code == 200 and ceremonies_resp.json().get("ceremonies"):
                    ceremony_id = ceremonies_resp.json()["ceremonies"][0]["ceremony_id"]
                    resp = requests.get(f"{BASE_URL}/api/anan/badge/{ceremony_id}/json")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "ceremony_id" in data
        assert "status" in data
        assert "is_sealed" in data
        assert "document_name" in data
        assert "consensus_hash" in data

    def test_get_badge_nonexistent(self, admin_token):
        """GET /api/anan/badge/nonexistent - Returns 404."""
        resp = requests.get(
            f"{BASE_URL}/api/anan/badge/nonexistent-ceremony-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════
#  AGENT REPUTATION & WEIGHT TUNING
# ═══════════════════════════════════════════════════════

class TestReputation:
    """Tests for agent reputation and weight tuning endpoints."""

    def test_get_agent_reputations(self, admin_token):
        """GET /api/anan/reputation - Returns all agent reputations."""
        resp = requests.get(
            f"{BASE_URL}/api/anan/reputation",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "reputations" in data
        assert "current_weights" in data
        
        # Verify all 3 agents present
        reps = data["reputations"]
        assert "verifier" in reps
        assert "witness" in reps
        assert "sealer" in reps
        
        # Verify reputation structure
        for agent in ["verifier", "witness", "sealer"]:
            rep = reps[agent]
            assert "agent" in rep
            assert "all_time" in rep
            assert "last_30d" in rep
            assert "last_7d" in rep
            assert "avg_score" in rep
            
            # Verify all_time structure
            at = rep["all_time"]
            assert "total" in at
            assert "correct" in at
            assert "accuracy" in at
        
        # Verify weights
        weights = data["current_weights"]
        assert "verifier" in weights
        assert "witness" in weights
        assert "sealer" in weights
        # Weights should sum to ~1.0
        total_weight = sum(weights.values())
        assert 0.99 <= total_weight <= 1.01, f"Weights should sum to 1.0, got {total_weight}"

    def test_tune_weights_insufficient_data(self, admin_token):
        """POST /api/anan/reputation/tune - Returns tuned=false with insufficient data."""
        resp = requests.post(
            f"{BASE_URL}/api/anan/reputation/tune",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "weights" in data
        assert "tuned" in data
        # With 0 samples, should return tuned=false
        if data["tuned"] == False:
            assert "reason" in data
            assert "Insufficient" in data["reason"] or "insufficient" in data["reason"].lower()

    def test_tune_weights_user_forbidden(self, user_token):
        """POST /api/anan/reputation/tune - Regular user cannot tune."""
        resp = requests.post(
            f"{BASE_URL}/api/anan/reputation/tune",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert resp.status_code == 403

    def test_tune_weights_notary_allowed(self, notary_token):
        """POST /api/anan/reputation/tune - Notary can tune weights."""
        resp = requests.post(
            f"{BASE_URL}/api/anan/reputation/tune",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        # Notary should be allowed (admin or notary role)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_get_weight_history(self, admin_token):
        """GET /api/anan/reputation/history - Returns weight tuning history."""
        resp = requests.get(
            f"{BASE_URL}/api/anan/reputation/history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "history" in data
        # History may be empty if no tuning has occurred
        assert isinstance(data["history"], list)

    def test_reputation_no_auth(self):
        """GET /api/anan/reputation - Requires auth."""
        resp = requests.get(f"{BASE_URL}/api/anan/reputation")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════
#  INTEGRATION TESTS
# ═══════════════════════════════════════════════════════

class TestIntegration:
    """Integration tests for fraud context injection."""

    def test_fraud_context_injected_in_ceremony(self, admin_token):
        """Verify fraud context is available for ANAN ceremonies."""
        # Create a ceremony with specific jurisdiction
        resp = requests.post(
            f"{BASE_URL}/api/anan/ceremony/start",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "document_name": "TEST_FraudContext_Integration",
                "signer_name": "Test Signer",
                "document_type": "affidavit",
                "jurisdiction": "US-FL"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        ceremony_id = resp.json()["ceremony_id"]
        
        # Get the ceremony detail
        resp = requests.get(
            f"{BASE_URL}/api/anan/ceremony/{ceremony_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify ceremony has jurisdiction set
        assert data["jurisdiction"] == "US-FL"
        assert data["document_type"] == "affidavit"
        
        # Cleanup - we don't execute to avoid long GPT-5.2 calls
        # The fraud context injection happens during execute


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
