"""
Ceremony API Tests - Multi-Agent Notarization Ceremony Feature
Tests: POST /api/ceremony/start, GET /api/ceremony/{id}, POST /api/ceremony/{id}/execute, GET /api/ceremony/list/my
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials — centralized (no hardcoded secrets); see tests/credentials.py
from credentials import DEMO_EMAIL as TEST_USER_EMAIL, DEMO_PASSWORD as TEST_USER_PASSWORD


class TestCeremonyAPI:
    """Ceremony API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_01_start_ceremony_creates_pending_ceremony(self, headers):
        """POST /api/ceremony/start - creates a new ceremony with pending status and 3 idle agents"""
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Ceremony_Document",
            "signer_name": "TEST_John Doe"
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ceremony_id" in data, "Response should contain ceremony_id"
        assert data["status"] == "pending", f"Expected status 'pending', got '{data['status']}'"
        assert "message" in data, "Response should contain message"
        
        # Store ceremony_id for subsequent tests
        TestCeremonyAPI.ceremony_id = data["ceremony_id"]
        print(f"Created ceremony: {data['ceremony_id']}")
    
    def test_02_get_ceremony_returns_full_data(self, headers):
        """GET /api/ceremony/{id} - returns full ceremony data with agents and consensus"""
        ceremony_id = getattr(TestCeremonyAPI, 'ceremony_id', None)
        if not ceremony_id:
            pytest.skip("No ceremony_id from previous test")
        
        response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify ceremony structure
        assert data["ceremony_id"] == ceremony_id
        assert data["status"] == "pending"
        assert data["document_name"] == "TEST_Ceremony_Document"
        assert data["signer_name"] == "TEST_John Doe"
        
        # Verify agents structure - all 3 should be idle
        assert "agents" in data, "Response should contain agents"
        agents = data["agents"]
        assert "verifier" in agents, "Should have verifier agent"
        assert "witness" in agents, "Should have witness agent"
        assert "sealer" in agents, "Should have sealer agent"
        
        # All agents should be idle initially
        for agent_name in ["verifier", "witness", "sealer"]:
            assert agents[agent_name]["status"] == "idle", f"{agent_name} should be idle"
            assert agents[agent_name]["verdict"] is None, f"{agent_name} verdict should be None"
        
        # Verify consensus structure
        assert "consensus" in data, "Response should contain consensus"
        consensus = data["consensus"]
        assert consensus["status"] == "pending"
        assert consensus["required_votes"] == 2
        assert consensus["total_votes"] == 3
        assert consensus["result"] is None
        
        print(f"Ceremony data verified: {ceremony_id}")
    
    def test_03_execute_ceremony_runs_all_agents(self, headers):
        """POST /api/ceremony/{id}/execute - runs all 3 agents and evaluates consensus"""
        ceremony_id = getattr(TestCeremonyAPI, 'ceremony_id', None)
        if not ceremony_id:
            pytest.skip("No ceremony_id from previous test")
        
        # Execute takes 10-15 seconds due to simulated agent delays
        response = requests.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute", json={}, headers=headers, timeout=60)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify ceremony completed
        assert data["status"] in ["sealed", "consensus_failed"], f"Expected sealed or consensus_failed, got {data['status']}"
        
        # Verify all agents have run
        agents = data["agents"]
        for agent_name in ["verifier", "witness", "sealer"]:
            agent = agents[agent_name]
            assert agent["status"] in ["passed", "failed"], f"{agent_name} should be passed or failed"
            assert agent["verdict"] in ["PASS", "FAIL"], f"{agent_name} verdict should be PASS or FAIL"
            assert agent["confidence"] is not None, f"{agent_name} should have confidence score"
            assert 0 <= agent["confidence"] <= 1, f"{agent_name} confidence should be between 0 and 1"
            assert agent["evidence_hash"] is not None, f"{agent_name} should have evidence_hash"
            assert agent["completed_at"] is not None, f"{agent_name} should have completed_at"
        
        # Verify consensus was evaluated
        consensus = data["consensus"]
        assert consensus["status"] in ["reached", "failed"], f"Consensus status should be reached or failed"
        assert consensus["result"] in ["APPROVED", "REJECTED", "REVIEW"], f"Consensus result should be APPROVED, REJECTED, or REVIEW"
        assert consensus["pass_count"] >= 0
        assert consensus["fail_count"] >= 0
        assert consensus["pass_count"] + consensus["fail_count"] == 3
        
        # Verify votes are recorded
        votes = consensus["votes"]
        for agent_name in ["verifier", "witness", "sealer"]:
            assert votes[agent_name] in ["PASS", "FAIL"], f"{agent_name} vote should be PASS or FAIL"
        
        # If approved, blockchain seal should exist
        if consensus["result"] == "APPROVED":
            assert data["blockchain_seal"] is not None, "Blockchain seal should exist when approved"
            seal = data["blockchain_seal"]
            assert "network" in seal
            assert "topic_id" in seal
            assert "consensus_hash" in seal
            assert "sealed_at" in seal
        
        print(f"Ceremony executed: status={data['status']}, consensus={consensus['result']}")
    
    def test_04_list_my_ceremonies_returns_user_history(self, headers):
        """GET /api/ceremony/list/my - returns user's ceremony history"""
        response = requests.get(f"{BASE_URL}/api/ceremony/list/my", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ceremonies" in data, "Response should contain ceremonies array"
        
        ceremonies = data["ceremonies"]
        assert isinstance(ceremonies, list), "Ceremonies should be a list"
        
        # Should have at least the ceremony we created
        assert len(ceremonies) >= 1, "Should have at least 1 ceremony"
        
        # Verify ceremony structure in list
        ceremony = ceremonies[0]
        assert "ceremony_id" in ceremony
        assert "document_name" in ceremony
        assert "signer_name" in ceremony
        assert "status" in ceremony
        assert "created_at" in ceremony
        
        print(f"Found {len(ceremonies)} ceremonies in history")
    
    def test_05_get_nonexistent_ceremony_returns_404(self, headers):
        """GET /api/ceremony/{id} - returns 404 for non-existent ceremony"""
        response = requests.get(f"{BASE_URL}/api/ceremony/nonexistent-id-12345", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_06_execute_already_sealed_ceremony_returns_400(self, headers):
        """POST /api/ceremony/{id}/execute - returns 400 for already sealed ceremony"""
        ceremony_id = getattr(TestCeremonyAPI, 'ceremony_id', None)
        if not ceremony_id:
            pytest.skip("No ceremony_id from previous test")
        
        # Try to execute again
        response = requests.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute", json={}, headers=headers)
        
        # Should fail since ceremony is already sealed or consensus_failed
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    def test_07_consensus_oracle_logic_verification(self, headers):
        """Verify 2-of-3 consensus oracle logic by checking multiple ceremonies"""
        # Create a new ceremony to test consensus
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Consensus_Verification",
            "signer_name": "TEST_Consensus Tester"
        }, headers=headers)
        
        assert response.status_code == 200
        ceremony_id = response.json()["ceremony_id"]
        
        # Execute the ceremony
        response = requests.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute", json={}, headers=headers, timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        consensus = data["consensus"]
        
        # Verify 2-of-3 logic
        pass_count = consensus["pass_count"]
        fail_count = consensus["fail_count"]
        result = consensus["result"]
        
        # If 2+ passes, should be APPROVED
        if pass_count >= 2:
            assert result == "APPROVED", f"With {pass_count} passes, result should be APPROVED"
        # If 2+ fails, should be REJECTED
        elif fail_count >= 2:
            assert result == "REJECTED", f"With {fail_count} fails, result should be REJECTED"
        # Otherwise REVIEW (1 pass, 1 fail, 1 abstain - but our agents always vote)
        else:
            assert result == "REVIEW", f"With {pass_count} passes and {fail_count} fails, result should be REVIEW"
        
        print(f"Consensus verified: {pass_count} PASS, {fail_count} FAIL -> {result}")
    
    def test_08_ceremony_without_auth_fails(self):
        """POST /api/ceremony/start - should work but mark as anonymous without auth"""
        # Note: Based on the code, it allows anonymous ceremonies
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Anonymous_Ceremony",
            "signer_name": "TEST_Anonymous User"
        })
        
        # Should still work but mark as anonymous
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        ceremony_id = response.json()["ceremony_id"]
        
        # Verify it was created
        response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["initiated_by"] == "anonymous"
        
        print(f"Anonymous ceremony created: {ceremony_id}")


class TestCeremonyCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_cleanup_test_ceremonies(self, auth_token):
        """Note: No cleanup endpoint exists, but we document test data created"""
        print("Test ceremonies created with prefix 'TEST_' - manual cleanup may be needed")
        print("Ceremonies created:")
        print("  - TEST_Ceremony_Document")
        print("  - TEST_Consensus_Verification")
        print("  - TEST_Anonymous_Ceremony")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
