"""
ANAN (Autonomous Notary Agent Network) Backend Tests
Tests blind 2-of-3 GPT-5.2 consensus, HITL escalation, SAN bond tracking.
Note: Execute endpoint takes 10-20 seconds due to 3 concurrent GPT-5.2 calls.
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASSWORD = "Test123!"


class TestANANAuth:
    """Authentication for ANAN tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Admin auth failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def notary_token(self):
        """Get notary auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": NOTARY_EMAIL,
            "password": NOTARY_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Notary auth failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def notary_headers(self, notary_token):
        return {"Authorization": f"Bearer {notary_token}", "Content-Type": "application/json"}


class TestANANDashboardStats(TestANANAuth):
    """Test ANAN dashboard stats endpoint"""
    
    def test_dashboard_stats(self, admin_headers):
        """GET /api/anan/dashboard/stats - Returns ANAN swarm statistics"""
        response = requests.get(f"{BASE_URL}/api/anan/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "total_ceremonies" in data
        assert "sealed" in data
        assert "rejected" in data
        assert "escalated" in data
        assert "pending" in data
        assert "avg_weighted_score" in data
        assert "agent_averages" in data
        assert "bond_balance" in data
        assert "bond_health_pct" in data
        
        # Verify agent averages structure
        agent_avgs = data["agent_averages"]
        assert "verifier" in agent_avgs
        assert "witness" in agent_avgs
        assert "sealer" in agent_avgs
        
        print(f"PASS: Dashboard stats - Total: {data['total_ceremonies']}, Sealed: {data['sealed']}, Escalated: {data['escalated']}")


class TestANANBondStatus(TestANANAuth):
    """Test SAN bond status endpoint"""
    
    def test_bond_status(self, admin_headers):
        """GET /api/anan/bond/status - Returns SAN E&O insurance bond status"""
        response = requests.get(f"{BASE_URL}/api/anan/bond/status", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "balance" in data
        assert "total_slashed" in data
        assert "total_restocked" in data
        assert "total_ceremonies" in data
        assert "health" in data
        assert "health_pct" in data
        assert "initial_balance" in data
        assert "min_threshold" in data
        
        # Verify health is one of expected values
        assert data["health"] in ["healthy", "warning", "depleted"]
        
        print(f"PASS: Bond status - Balance: ${data['balance']:,}, Health: {data['health']} ({data['health_pct']}%)")


class TestANANCeremonyLifecycle(TestANANAuth):
    """Test ANAN ceremony creation and listing"""
    
    @pytest.fixture(scope="class")
    def created_ceremony_id(self, admin_headers):
        """Create a test ANAN ceremony"""
        payload = {
            "document_name": f"TEST_ANAN_Affidavit_{uuid.uuid4().hex[:6]}",
            "signer_name": "Test Signer ANAN",
            "document_type": "affidavit",
            "jurisdiction": "US-FL"
        }
        response = requests.post(f"{BASE_URL}/api/anan/ceremony/start", json=payload, headers=admin_headers)
        if response.status_code == 200:
            return response.json().get("ceremony_id")
        pytest.skip(f"Failed to create ceremony: {response.status_code}")
    
    def test_create_anan_ceremony(self, admin_headers):
        """POST /api/anan/ceremony/start - Create new ANAN ceremony"""
        payload = {
            "document_name": f"TEST_ANAN_POA_{uuid.uuid4().hex[:6]}",
            "signer_name": "John Smith Test",
            "document_type": "power_of_attorney",
            "jurisdiction": "US-TX"
        }
        response = requests.post(f"{BASE_URL}/api/anan/ceremony/start", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ceremony_id" in data
        assert data["protocol"] == "BLIND_2OF3"
        assert data["status"] == "pending"
        
        print(f"PASS: Created ANAN ceremony {data['ceremony_id']} with protocol {data['protocol']}")
    
    def test_list_anan_ceremonies(self, admin_headers):
        """GET /api/anan/ceremonies - List ANAN ceremonies"""
        response = requests.get(f"{BASE_URL}/api/anan/ceremonies", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ceremonies" in data
        assert "total" in data
        assert isinstance(data["ceremonies"], list)
        
        # Verify ceremony structure if any exist
        if data["ceremonies"]:
            c = data["ceremonies"][0]
            assert "ceremony_id" in c
            assert "document_name" in c
            assert "status" in c
            assert "protocol" in c
        
        print(f"PASS: Listed {data['total']} ANAN ceremonies")
    
    def test_get_anan_ceremony_detail(self, admin_headers, created_ceremony_id):
        """GET /api/anan/ceremony/{id} - Get ANAN ceremony details"""
        response = requests.get(f"{BASE_URL}/api/anan/ceremony/{created_ceremony_id}", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["ceremony_id"] == created_ceremony_id
        assert data["anan_mode"] == True
        assert data["protocol"] == "BLIND_2OF3"
        assert "agents" in data
        assert "verifier" in data["agents"]
        assert "witness" in data["agents"]
        assert "sealer" in data["agents"]
        assert "consensus" in data
        
        print(f"PASS: Got ceremony detail for {created_ceremony_id}, status: {data['status']}")


class TestANANExecuteBlindScoring(TestANANAuth):
    """Test ANAN blind scoring execution (GPT-5.2 agents)"""
    
    def test_execute_anan_ceremony(self, admin_headers):
        """POST /api/anan/ceremony/{id}/execute - Execute blind scoring with 3 GPT-5.2 agents"""
        # First create a ceremony
        payload = {
            "document_name": f"TEST_ANAN_Execute_{uuid.uuid4().hex[:6]}",
            "signer_name": "Execute Test Signer",
            "document_type": "deed",
            "jurisdiction": "US-VA"
        }
        create_response = requests.post(f"{BASE_URL}/api/anan/ceremony/start", json=payload, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Execute blind scoring (takes 10-20 seconds due to 3 concurrent GPT-5.2 calls)
        print(f"Executing blind scoring for {ceremony_id} (this takes 10-20 seconds)...")
        response = requests.post(
            f"{BASE_URL}/api/anan/ceremony/{ceremony_id}/execute",
            json={},
            headers=admin_headers,
            timeout=60  # Extended timeout for GPT-5.2 calls
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify ceremony was executed
        assert data["status"] in ["sealed", "rejected", "escalated"]
        
        # Verify agents have scores
        agents = data["agents"]
        for agent_name in ["verifier", "witness", "sealer"]:
            agent = agents[agent_name]
            assert agent["score"] is not None, f"{agent_name} should have a score"
            assert agent["verdict"] in ["PASS", "FAIL"]
            assert agent["ai_powered"] == True, f"{agent_name} should be AI-powered"
            assert agent["model"] == "gpt-5.2", f"{agent_name} should use gpt-5.2"
        
        # Verify consensus
        consensus = data["consensus"]
        assert consensus["status"] == "reached"
        assert consensus["result"] in ["APPROVED", "REJECTED", "ESCALATE"]
        assert consensus["weighted_average"] is not None
        assert "scores" in consensus
        assert "pass_count" in consensus
        assert "score_spread" in consensus
        
        print(f"PASS: Executed ceremony {ceremony_id}")
        print(f"  Result: {consensus['result']}, Weighted Avg: {consensus['weighted_average']}")
        print(f"  Scores: V={consensus['scores']['verifier']}, W={consensus['scores']['witness']}, S={consensus['scores']['sealer']}")
        print(f"  Final Status: {data['status']}")


class TestANANEscalations(TestANANAuth):
    """Test HITL escalation queue"""
    
    def test_list_escalations(self, admin_headers):
        """GET /api/anan/escalations - List pending HITL escalations (admin/notary only)"""
        response = requests.get(f"{BASE_URL}/api/anan/escalations", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "escalations" in data
        assert "total" in data
        assert isinstance(data["escalations"], list)
        
        # Verify escalation structure if any exist
        if data["escalations"]:
            esc = data["escalations"][0]
            assert "escalation_id" in esc
            assert "ceremony_id" in esc
            assert "reason" in esc
            assert "status" in esc
            assert "weighted_average" in esc
            assert "ceremony_context" in esc
        
        print(f"PASS: Listed {data['total']} pending escalations")
    
    def test_list_escalations_notary(self, notary_headers):
        """GET /api/anan/escalations - Notary can also access escalations"""
        response = requests.get(f"{BASE_URL}/api/anan/escalations", headers=notary_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "escalations" in data
        print(f"PASS: Notary can access escalations ({data['total']} pending)")


class TestANANEscalationResolve(TestANANAuth):
    """Test escalation resolution flow"""
    
    def test_resolve_escalation_flow(self, admin_headers):
        """Full flow: Create ceremony → Execute → If escalated, resolve"""
        # Create ceremony
        payload = {
            "document_name": f"TEST_ANAN_Escalation_{uuid.uuid4().hex[:6]}",
            "signer_name": "Escalation Test Signer",
            "document_type": "will",
            "jurisdiction": "US-NV"
        }
        create_response = requests.post(f"{BASE_URL}/api/anan/ceremony/start", json=payload, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Execute
        print(f"Executing ceremony {ceremony_id} for escalation test...")
        exec_response = requests.post(
            f"{BASE_URL}/api/anan/ceremony/{ceremony_id}/execute",
            json={},
            headers=admin_headers,
            timeout=60
        )
        assert exec_response.status_code == 200
        
        result = exec_response.json()
        status = result["status"]
        consensus_result = result["consensus"]["result"]
        
        print(f"  Ceremony result: {consensus_result}, status: {status}")
        
        if status == "escalated":
            # Get escalation ID
            escalation = result.get("escalation")
            if escalation:
                escalation_id = escalation["escalation_id"]
                
                # Resolve the escalation
                resolve_response = requests.post(
                    f"{BASE_URL}/api/anan/escalation/{escalation_id}/resolve",
                    json={"decision": "approve", "notes": "Test approval by admin"},
                    headers=admin_headers
                )
                assert resolve_response.status_code == 200, f"Expected 200, got {resolve_response.status_code}: {resolve_response.text}"
                
                resolve_data = resolve_response.json()
                assert resolve_data["decision"] == "approve"
                assert resolve_data["new_status"] == "sealed"
                
                print(f"PASS: Resolved escalation {escalation_id} → sealed")
            else:
                print("SKIP: Escalation data not in response")
        else:
            print(f"SKIP: Ceremony was {status}, not escalated (this is expected behavior)")


class TestANANUnauthorized:
    """Test unauthorized access to ANAN endpoints"""
    
    def test_dashboard_stats_no_auth(self):
        """Dashboard stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/dashboard/stats")
        assert response.status_code == 401
        print("PASS: Dashboard stats requires auth")
    
    def test_bond_status_no_auth(self):
        """Bond status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/bond/status")
        assert response.status_code == 401
        print("PASS: Bond status requires auth")
    
    def test_ceremonies_no_auth(self):
        """Ceremonies list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/ceremonies")
        assert response.status_code == 401
        print("PASS: Ceremonies list requires auth")


class TestANANNotFound:
    """Test 404 responses for non-existent resources"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        pytest.skip("Admin auth failed")
    
    def test_get_nonexistent_ceremony(self, admin_headers):
        """GET /api/anan/ceremony/{id} - Returns 404 for non-existent ceremony"""
        response = requests.get(f"{BASE_URL}/api/anan/ceremony/nonexistent-id-12345", headers=admin_headers)
        assert response.status_code == 404
        print("PASS: Non-existent ceremony returns 404")
    
    def test_execute_nonexistent_ceremony(self, admin_headers):
        """POST /api/anan/ceremony/{id}/execute - Returns 404 for non-existent ceremony"""
        response = requests.post(f"{BASE_URL}/api/anan/ceremony/nonexistent-id-12345/execute", json={}, headers=admin_headers)
        assert response.status_code == 404
        print("PASS: Execute non-existent ceremony returns 404")
    
    def test_resolve_nonexistent_escalation(self, admin_headers):
        """POST /api/anan/escalation/{id}/resolve - Returns 404 for non-existent escalation"""
        response = requests.post(
            f"{BASE_URL}/api/anan/escalation/nonexistent-esc-id/resolve",
            json={"decision": "approve"},
            headers=admin_headers
        )
        assert response.status_code == 404
        print("PASS: Resolve non-existent escalation returns 404")
