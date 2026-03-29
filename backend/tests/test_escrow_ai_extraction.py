"""
Test suite for Dynamic Escrow Intelligence - GPT-5.2 AI Extraction Feature
Tests: Real AI extraction with file upload vs Demo extraction without file
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@notarychain.com"
TEST_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def auth_headers_no_content_type(auth_token):
    """Headers with auth token but no content-type (for multipart)"""
    return {
        "Authorization": f"Bearer {auth_token}"
    }


class TestAIConditionExtraction:
    """Test GPT-5.2 AI condition extraction with file upload"""
    
    def test_create_escrow_for_ai_test(self, headers):
        """Create a new escrow for AI extraction testing"""
        payload = {
            "title": "TEST_GPT52_AI_Extraction",
            "description": "Testing real GPT-5.2 AI extraction",
            "escrow_amount": 600000,
            "buyer_name": "AI Test Buyer",
            "seller_name": "AI Test Seller"
        }
        response = requests.post(f"{BASE_URL}/api/escrow/create", json=payload, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "draft"
        pytest.ai_test_escrow_id = data["escrow_id"]
        print(f"PASS: Created escrow {data['escrow_id']} for AI testing")
    
    def test_ai_extraction_with_txt_file(self, auth_headers_no_content_type):
        """POST /api/escrow/{id}/extract-conditions with TXT file returns ai_powered=True"""
        escrow_id = getattr(pytest, 'ai_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No escrow created for AI test")
        
        # Create a test contract file
        contract_text = """
REAL ESTATE PURCHASE AGREEMENT

This Purchase Agreement is entered into between John Buyer ("Buyer") and Jane Seller ("Seller").

PURCHASE PRICE: $600,000 USD

CONDITIONS:

1. HOME INSPECTION CONTINGENCY
The Buyer shall have 14 days to conduct a professional home inspection.

2. FINANCING CONTINGENCY  
The Buyer must obtain mortgage approval within 30 days.

3. APPRAISAL CONTINGENCY
The property must appraise at or above the purchase price.

4. TITLE SEARCH
A title search must be completed within 21 days.

5. FINAL WALKTHROUGH
Buyer shall conduct a final walkthrough within 48 hours of closing.

6. CLOSING DATE
Closing shall occur on or before 45 days from contract execution.
"""
        
        # Create temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(contract_text)
            temp_path = f.name
        
        try:
            # Upload file for AI extraction
            with open(temp_path, 'rb') as f:
                files = {'file': ('test_contract.txt', f, 'text/plain')}
                response = requests.post(
                    f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
                    headers=auth_headers_no_content_type,
                    files=files
                )
            
            assert response.status_code == 200, f"AI extraction failed: {response.text}"
            
            data = response.json()
            assert data["ai_powered"] == True, f"Expected ai_powered=True, got {data.get('ai_powered')}"
            assert data["ai_model"] == "gpt-5.2", f"Expected ai_model='gpt-5.2', got {data.get('ai_model')}"
            assert data["total"] > 0, "Expected at least 1 condition extracted"
            assert "conditions" in data
            
            # Verify condition structure
            for cond in data["conditions"]:
                assert "condition_id" in cond
                assert "title" in cond
                assert "description" in cond
                assert "category" in cond
                assert "confidence" in cond
                assert 0 <= cond["confidence"] <= 1
            
            print(f"PASS: AI extracted {data['total']} conditions with GPT-5.2")
            print(f"INFO: Conditions: {[c['title'] for c in data['conditions'][:5]]}...")
            
        finally:
            os.unlink(temp_path)
    
    def test_escrow_updated_with_ai_flag(self, headers):
        """Verify escrow document.ai_powered is True after AI extraction"""
        escrow_id = getattr(pytest, 'ai_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No escrow created for AI test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["document"]["ai_powered"] == True, "Expected document.ai_powered=True"
        assert data["document"]["analysis_complete"] == True
        assert data["status"] == "active"
        
        print("PASS: Escrow document shows ai_powered=True")


class TestDemoConditionExtraction:
    """Test demo condition extraction without file upload"""
    
    def test_create_escrow_for_demo_test(self, headers):
        """Create a new escrow for demo extraction testing"""
        payload = {
            "title": "TEST_Demo_Extraction_Only",
            "description": "Testing demo extraction without file",
            "escrow_amount": 400000
        }
        response = requests.post(f"{BASE_URL}/api/escrow/create", json=payload, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        pytest.demo_test_escrow_id = data["escrow_id"]
        print(f"PASS: Created escrow {data['escrow_id']} for demo testing")
    
    def test_demo_extraction_without_file(self, headers):
        """POST /api/escrow/{id}/extract-conditions with JSON body returns ai_powered=False"""
        escrow_id = getattr(pytest, 'demo_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No escrow created for demo test")
        
        payload = {"document_name": "Demo Purchase Agreement"}
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json=payload,
            headers=headers
        )
        
        assert response.status_code == 200, f"Demo extraction failed: {response.text}"
        
        data = response.json()
        assert data["ai_powered"] == False, f"Expected ai_powered=False, got {data.get('ai_powered')}"
        assert data["ai_model"] is None, f"Expected ai_model=None, got {data.get('ai_model')}"
        assert data["total"] == 6, f"Expected 6 demo conditions, got {data['total']}"
        
        # Verify demo conditions have expected categories
        categories = [c["category"] for c in data["conditions"]]
        expected = ["inspection", "financing", "title", "appraisal", "closing", "walkthrough"]
        for cat in expected:
            assert cat in categories, f"Missing demo category: {cat}"
        
        print(f"PASS: Demo extracted {data['total']} conditions (ai_powered=False)")
    
    def test_escrow_updated_with_demo_flag(self, headers):
        """Verify escrow document.ai_powered is False after demo extraction"""
        escrow_id = getattr(pytest, 'demo_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No escrow created for demo test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["document"]["ai_powered"] == False, "Expected document.ai_powered=False"
        assert data["document"]["analysis_complete"] == True
        assert data["status"] == "active"
        
        print("PASS: Escrow document shows ai_powered=False")


class TestEscrowLifecycleWithAI:
    """Test full escrow lifecycle with AI-extracted conditions"""
    
    def test_deposit_on_ai_escrow(self, headers):
        """Deposit funds on AI-extracted escrow"""
        escrow_id = getattr(pytest, 'ai_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No AI escrow to test")
        
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/deposit", json={}, headers=headers)
        assert response.status_code == 200, f"Deposit failed: {response.text}"
        
        data = response.json()
        assert data["deposit_status"] == "held"
        assert data["mocked"] == True  # Stripe is mocked
        
        print(f"PASS: Deposited ${data['amount']:,} on AI escrow")
    
    def test_verify_ai_condition(self, headers):
        """Verify a condition on AI-extracted escrow"""
        escrow_id = getattr(pytest, 'ai_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No AI escrow to test")
        
        # Get conditions
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        conditions = response.json()["conditions"]
        pending = [c for c in conditions if c["status"] == "pending"]
        
        if not pending:
            pytest.skip("No pending conditions to verify")
        
        condition_id = pending[0]["condition_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition",
            json={"condition_id": condition_id},
            headers=headers
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "met"
        
        print(f"PASS: Verified AI condition {condition_id}")
    
    def test_timeline_shows_ai_extraction(self, headers):
        """Verify timeline shows AI extraction event"""
        escrow_id = getattr(pytest, 'ai_test_escrow_id', None)
        if not escrow_id:
            pytest.skip("No AI escrow to test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}/timeline", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        events = data["timeline"]
        
        # Find AI extraction event
        ai_event = None
        for e in events:
            if "GPT-5.2" in e.get("actor", "") or "AI analyzed" in e.get("details", ""):
                ai_event = e
                break
        
        assert ai_event is not None, "Expected AI extraction event in timeline"
        print(f"PASS: Timeline shows AI extraction: {ai_event['details'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
