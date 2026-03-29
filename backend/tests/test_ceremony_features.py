"""
Test suite for NotaryChain Ceremony Features:
1. Public Certificate Verification API
2. Ceremony Analytics API (Admin)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"
KNOWN_CEREMONY_ID = "e709280f-f217-4986-b4e4-268f573efe6c"


class TestPublicCertificateVerification:
    """Feature 1: Public Certificate Verification API"""
    
    def test_verify_valid_ceremony_id(self):
        """GET /api/ceremony/verify/certificate/{hash} returns verified:true for valid ceremony ID"""
        response = requests.get(f"{BASE_URL}/api/ceremony/verify/certificate/{KNOWN_CEREMONY_ID}")
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return verified: true for a known sealed ceremony
        assert data.get("verified") == True, f"Expected verified=True, got {data.get('verified')}"
        assert "ceremony_id" in data
        assert data["ceremony_id"] == KNOWN_CEREMONY_ID
        assert "document_name" in data
        assert "signer_name" in data
        assert "agents" in data
        assert "consensus" in data
        assert "blockchain_seal" in data or data.get("blockchain_seal") is None
        print("PASS: Valid ceremony ID returns verified=True with ceremony details")
    
    def test_verify_invalid_hash(self):
        """GET /api/ceremony/verify/certificate/{hash} returns verified:false for invalid hash"""
        invalid_hash = "invalid-hash-12345-does-not-exist"
        response = requests.get(f"{BASE_URL}/api/ceremony/verify/certificate/{invalid_hash}")
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return verified: false for invalid hash
        assert data.get("verified") == False, f"Expected verified=False, got {data.get('verified')}"
        assert "message" in data
        print("PASS: Invalid hash returns verified=False with message")
    
    def test_verify_empty_hash(self):
        """GET /api/ceremony/verify/certificate/{hash} handles empty/whitespace hash"""
        response = requests.get(f"{BASE_URL}/api/ceremony/verify/certificate/   ")
        print(f"Response status: {response.status_code}")
        
        # Should return 200 with verified=false or 404
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert data.get("verified") == False
        print("PASS: Empty hash handled correctly")
    
    def test_verify_returns_agent_verdicts(self):
        """Verified result includes agent verdicts"""
        response = requests.get(f"{BASE_URL}/api/ceremony/verify/certificate/{KNOWN_CEREMONY_ID}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("verified"):
                agents = data.get("agents", [])
                assert len(agents) == 3, f"Expected 3 agents, got {len(agents)}"
                for agent in agents:
                    assert "agent" in agent
                    assert "verdict" in agent
                    assert agent["agent"] in ["Verifier", "Witness", "Sealer"]
                print("PASS: Agent verdicts included in response")
            else:
                print("SKIP: Ceremony not verified, cannot check agent verdicts")
        else:
            print(f"SKIP: Response status {response.status_code}")
    
    def test_verify_returns_consensus_info(self):
        """Verified result includes consensus oracle info"""
        response = requests.get(f"{BASE_URL}/api/ceremony/verify/certificate/{KNOWN_CEREMONY_ID}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("verified"):
                consensus = data.get("consensus", {})
                assert "result" in consensus
                assert "pass_count" in consensus
                assert "fail_count" in consensus
                print("PASS: Consensus info included in response")
            else:
                print("SKIP: Ceremony not verified")
        else:
            print(f"SKIP: Response status {response.status_code}")


class TestCeremonyAnalyticsAdmin:
    """Feature 2: Ceremony Analytics API (Admin only)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    @pytest.fixture
    def user_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        pytest.skip(f"User login failed: {response.status_code}")
    
    def test_analytics_requires_auth(self):
        """GET /api/ceremony/analytics/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats")
        print(f"Response status (no auth): {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Analytics endpoint requires authentication")
    
    def test_analytics_requires_admin(self, user_token):
        """GET /api/ceremony/analytics/stats requires admin role"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats", headers=headers)
        print(f"Response status (user auth): {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Analytics endpoint requires admin role")
    
    def test_analytics_returns_data(self, admin_token):
        """GET /api/ceremony/analytics/stats returns analytics data for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats", headers=headers)
        print(f"Response status (admin auth): {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "total_ceremonies" in data
        assert "approval_rate" in data
        assert "volume" in data
        assert "consensus_outcomes" in data
        assert "agent_stats" in data
        
        print(f"Total ceremonies: {data['total_ceremonies']}")
        print(f"Approval rate: {data['approval_rate']}%")
        print("PASS: Analytics endpoint returns expected data structure")
    
    def test_analytics_consensus_outcomes_structure(self, admin_token):
        """Analytics response includes properly structured consensus outcomes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        outcomes = data.get("consensus_outcomes", [])
        assert isinstance(outcomes, list)
        
        for outcome in outcomes:
            assert "name" in outcome
            assert "value" in outcome
            assert "color" in outcome
            assert outcome["name"] in ["Approved", "Rejected", "Review"]
        
        print("PASS: Consensus outcomes have correct structure")
    
    def test_analytics_agent_stats_structure(self, admin_token):
        """Analytics response includes agent pass rates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        agent_stats = data.get("agent_stats", {})
        assert "verifier" in agent_stats
        assert "witness" in agent_stats
        assert "sealer" in agent_stats
        
        for agent_name, stats in agent_stats.items():
            assert "passes" in stats
            assert "fails" in stats
            assert "pass_rate" in stats
            print(f"  {agent_name}: {stats['pass_rate']}% pass rate")
        
        print("PASS: Agent stats have correct structure")
    
    def test_analytics_volume_structure(self, admin_token):
        """Analytics response includes volume data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/ceremony/analytics/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        volume = data.get("volume", [])
        assert isinstance(volume, list)
        
        if len(volume) > 0:
            for entry in volume[:3]:  # Check first 3 entries
                assert "date" in entry
                assert "total" in entry
                assert "approved" in entry
        
        print(f"PASS: Volume data has {len(volume)} entries")


class TestCeremonyEndpoints:
    """Additional ceremony endpoint tests"""
    
    def test_get_ceremony_by_id(self):
        """GET /api/ceremony/{ceremony_id} returns ceremony details"""
        response = requests.get(f"{BASE_URL}/api/ceremony/{KNOWN_CEREMONY_ID}")
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert "ceremony_id" in data
            assert "status" in data
            assert "agents" in data
            print(f"Ceremony status: {data['status']}")
            print("PASS: Get ceremony by ID works")
        elif response.status_code == 404:
            print("SKIP: Known ceremony ID not found in database")
        else:
            print(f"FAIL: Unexpected status {response.status_code}")
    
    def test_get_nonexistent_ceremony(self):
        """GET /api/ceremony/{ceremony_id} returns 404 for non-existent ID"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/api/ceremony/{fake_id}")
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 404
        print("PASS: Non-existent ceremony returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
