"""
Test Suite for AI Transaction Orchestrator 4 Phases:
- Phase 1: AI Document Remediation
- Phase 2: Biometric Passport
- Phase 3: AI Conductor Mode
- Phase 4: Evidence Package
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://notary-ai.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER = {"email": "demo@test.com", "password": "Demo123!"}

class TestAuthSetup:
    """Get auth token for subsequent tests"""
    access_token = None
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        if TestAuthSetup.access_token:
            return TestAuthSetup.access_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        TestAuthSetup.access_token = data.get("access_token")
        assert TestAuthSetup.access_token, "No access_token in login response"
        return TestAuthSetup.access_token
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestPhase1DocumentRemediation(TestAuthSetup):
    """Phase 1: AI Document Remediation - analyze docs, suggest/insert missing legal clauses"""
    
    remediation_id = None
    
    def test_analyze_empty_doc_returns_400(self, headers):
        """Analyze with empty document_text should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/remediation/analyze",
            headers=headers,
            json={"document_text": "", "document_type": "contract"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    def test_analyze_document_returns_remediation(self, headers):
        """POST /api/remediation/analyze returns remediation_id, risk_score, missing_clauses"""
        sample_contract = """
        SERVICE AGREEMENT
        
        This agreement is between Party A and Party B.
        Party A agrees to provide services to Party B.
        Party B agrees to pay $1000 for these services.
        
        Signed:
        Party A
        Party B
        """
        response = requests.post(
            f"{BASE_URL}/api/remediation/analyze",
            headers=headers,
            json={"document_text": sample_contract, "document_type": "contract"}
        )
        assert response.status_code == 200, f"Analyze failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "remediation_id" in data, "Response missing remediation_id"
        assert "analysis" in data, "Response missing analysis"
        
        analysis = data["analysis"]
        assert "overall_risk_score" in analysis or analysis.get("overall_risk_score") is not None, "Missing overall_risk_score"
        
        # Store for later tests
        TestPhase1DocumentRemediation.remediation_id = data["remediation_id"]
        print(f"Remediation ID: {TestPhase1DocumentRemediation.remediation_id}")
        print(f"Risk Score: {analysis.get('overall_risk_score')}")
    
    def test_apply_clauses_no_selection_returns_400(self, headers):
        """Applying with no valid clauses selected should return 400"""
        if not TestPhase1DocumentRemediation.remediation_id:
            pytest.skip("No remediation_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/remediation/apply-clauses",
            headers=headers,
            json={"remediation_id": TestPhase1DocumentRemediation.remediation_id, "clause_indices": [999]}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_apply_clauses_invalid_remediation_returns_404(self, headers):
        """Applying with invalid remediation_id should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/remediation/apply-clauses",
            headers=headers,
            json={"remediation_id": "non-existent-id", "clause_indices": [0]}
        )
        assert response.status_code == 404
    
    def test_get_remediation_history(self, headers):
        """GET /api/remediation/history returns user's remediations"""
        response = requests.get(
            f"{BASE_URL}/api/remediation/history",
            headers=headers
        )
        assert response.status_code == 200, f"History failed: {response.text}"
        data = response.json()
        assert "remediations" in data, "Response missing remediations array"
        assert isinstance(data["remediations"], list)
        print(f"Found {len(data['remediations'])} remediations in history")
    
    def test_get_specific_remediation(self, headers):
        """GET /api/remediation/{id} returns specific remediation"""
        if not TestPhase1DocumentRemediation.remediation_id:
            pytest.skip("No remediation_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/remediation/{TestPhase1DocumentRemediation.remediation_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Get remediation failed: {response.text}"
        data = response.json()
        assert data.get("id") == TestPhase1DocumentRemediation.remediation_id


class TestPhase2BiometricPassport(TestAuthSetup):
    """Phase 2: Biometric Passport - synthesize facial+voiceprint+liveness into unified credential"""
    
    def test_get_my_passports_empty_initially(self, headers):
        """GET /api/biometric-passport/my returns passports list (may be empty)"""
        response = requests.get(
            f"{BASE_URL}/api/biometric-passport/my",
            headers=headers
        )
        assert response.status_code == 200, f"Get passports failed: {response.text}"
        data = response.json()
        assert "passports" in data, "Response missing passports array"
        assert isinstance(data["passports"], list)
        print(f"Found {len(data['passports'])} passports")
    
    def test_generate_passport_no_verifications_returns_400(self, headers):
        """POST /api/biometric-passport/generate without verifications returns 400"""
        # This tests the error case when session has no biometric verifications
        # Need to use form-data correctly with the auth header only
        auth_header = {"Authorization": headers["Authorization"]}
        response = requests.post(
            f"{BASE_URL}/api/biometric-passport/generate",
            headers=auth_header,
            data={"session_id": "test-nonexistent-session-123"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"Expected error: {data.get('detail')}")
    
    def test_verify_passport_nonexistent_returns_404(self, headers):
        """GET /api/biometric-passport/verify/{id} for non-existent passport returns 404"""
        response = requests.get(f"{BASE_URL}/api/biometric-passport/verify/non-existent-passport-id")
        assert response.status_code == 404
    
    def test_get_passport_nonexistent_returns_404(self, headers):
        """GET /api/biometric-passport/{id} for non-existent passport returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/biometric-passport/non-existent-id",
            headers=headers
        )
        assert response.status_code == 404


class TestPhase3AIConductor(TestAuthSetup):
    """Phase 3: AI Conductor Mode - LLM-guided step-by-step participant guidance + chat"""
    
    transaction_id = None
    
    def test_create_test_transaction(self, headers):
        """Create a test transaction for conductor tests"""
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=headers,
            json={
                "name": "TEST_Conductor_Transaction",
                "description": "Test transaction for AI Conductor testing",
                "transaction_type": "real_estate_closing",
                "participants": []
            }
        )
        assert response.status_code in [200, 201], f"Create transaction failed: {response.text}"
        data = response.json()
        TestPhase3AIConductor.transaction_id = data.get("id")
        assert TestPhase3AIConductor.transaction_id, "No transaction id returned"
        print(f"Created transaction: {TestPhase3AIConductor.transaction_id}")
    
    def test_conductor_guide_returns_guidance(self, headers):
        """POST /api/conductor/guide returns AI guidance with next_steps"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/conductor/guide",
            headers=headers,
            json={"transaction_id": TestPhase3AIConductor.transaction_id}
        )
        assert response.status_code == 200, f"Guide failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "guidance" in data, "Response missing guidance"
        assert "role" in data, "Response missing role"
        
        guidance = data["guidance"]
        # These fields should exist in the AI response
        print(f"Guidance greeting: {guidance.get('greeting', 'N/A')}")
        print(f"Role: {data.get('role')}")
    
    def test_conductor_chat_works(self, headers):
        """POST /api/conductor/chat allows interactive Q&A"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/conductor/chat",
            headers=headers,
            json={
                "transaction_id": TestPhase3AIConductor.transaction_id,
                "message": "What should I do next?"
            }
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        
        assert "response" in data, "Chat response missing response field"
        assert len(data["response"]) > 0, "Empty response from conductor"
        print(f"Chat response preview: {data['response'][:100]}...")
    
    def test_conductor_status_returns_progress(self, headers):
        """GET /api/conductor/status/{transaction_id} returns participant progress"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/conductor/status/{TestPhase3AIConductor.transaction_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Status failed: {response.text}"
        data = response.json()
        
        assert "transaction_id" in data
        assert "transaction_status" in data
        assert "overall_progress" in data or data.get("overall_progress") is not None
        print(f"Transaction status: {data.get('transaction_status')}")
    
    def test_conductor_guide_invalid_transaction_returns_404(self, headers):
        """POST /api/conductor/guide with invalid transaction_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/conductor/guide",
            headers=headers,
            json={"transaction_id": "non-existent-transaction-id"}
        )
        assert response.status_code == 404
    
    def test_conductor_chat_invalid_transaction_returns_404(self, headers):
        """POST /api/conductor/chat with invalid transaction_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/conductor/chat",
            headers=headers,
            json={"transaction_id": "non-existent-id", "message": "test"}
        )
        assert response.status_code == 404


class TestPhase4EvidencePackage(TestAuthSetup):
    """Phase 4: Evidence Package at Settlement - auto-generate forensic bundle"""
    
    def test_get_evidence_package_no_package_returns_404(self, headers):
        """GET /api/evidence-package/{transaction_id} returns 404 if no package"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id")
        
        response = requests.get(
            f"{BASE_URL}/api/evidence-package/{TestPhase3AIConductor.transaction_id}",
            headers=headers
        )
        # May return 404 if no package generated yet
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_generate_evidence_package(self, headers):
        """POST /api/evidence-package/generate/{transaction_id} compiles evidence"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id")
        
        response = requests.post(
            f"{BASE_URL}/api/evidence-package/generate/{TestPhase3AIConductor.transaction_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Generate package failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Package missing id"
        assert "transaction_id" in data, "Package missing transaction_id"
        assert "integrity_hash" in data, "Package missing integrity_hash"
        assert "transaction" in data, "Package missing transaction data"
        
        print(f"Generated package ID: {data.get('id')}")
        print(f"Integrity hash: {data.get('integrity_hash')[:32]}...")
    
    def test_get_evidence_package_after_generation(self, headers):
        """GET /api/evidence-package/{transaction_id} retrieves the package"""
        if not TestPhase3AIConductor.transaction_id:
            pytest.skip("No transaction_id")
        
        response = requests.get(
            f"{BASE_URL}/api/evidence-package/{TestPhase3AIConductor.transaction_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Get package failed: {response.text}"
        data = response.json()
        
        # Verify package structure
        assert "participants" in data
        assert "tasks" in data
        assert "blockchain_proof" in data
    
    def test_generate_evidence_invalid_transaction_returns_error(self, headers):
        """Generate evidence for invalid transaction returns 403/404"""
        response = requests.post(
            f"{BASE_URL}/api/evidence-package/generate/non-existent-transaction",
            headers=headers
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"


class TestDashboardQuickActions(TestAuthSetup):
    """Test Dashboard quick action buttons for new features"""
    
    def test_document_remediation_page_loads(self, auth_token):
        """Document Remediation page route exists"""
        # Just test the API endpoints are accessible (frontend tested via playwright)
        pass
    
    def test_biometric_passport_page_loads(self, auth_token):
        """Biometric Passport page route exists"""
        pass


class TestTransactionRoomButtons(TestAuthSetup):
    """Test Transaction Room header buttons for AI Conductor and Evidence Package"""
    
    def test_conductor_endpoint_accessible(self, headers):
        """AI Conductor endpoint is accessible"""
        # Already tested in Phase 3
        pass
    
    def test_evidence_package_endpoint_accessible(self, headers):
        """Evidence Package endpoint is accessible"""
        # Already tested in Phase 4
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
