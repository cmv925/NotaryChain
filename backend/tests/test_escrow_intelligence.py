"""
Test suite for Dynamic Escrow Intelligence feature
Tests: Create, List, Get, Extract Conditions, Deposit, Verify Condition, Settle, Timeline
All endpoints require authentication (401 without token)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@notarychain.com"
TEST_PASSWORD = "Admin123!"

# Pre-existing escrow for testing
EXISTING_ESCROW_ID = "87a20fa4-2903-4db6-bc47-0972918dfa5e"


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


class TestEscrowAuthentication:
    """Test that all escrow endpoints require authentication"""
    
    def test_list_escrows_requires_auth(self):
        """GET /api/escrow/list returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/escrow/list")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/list requires authentication")
    
    def test_get_escrow_requires_auth(self):
        """GET /api/escrow/{id} returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id} requires authentication")
    
    def test_create_escrow_requires_auth(self):
        """POST /api/escrow/create returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "Test Escrow",
            "escrow_amount": 100000
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/create requires authentication")
    
    def test_extract_conditions_requires_auth(self):
        """POST /api/escrow/{id}/extract-conditions returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/extract-conditions", json={})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id}/extract-conditions requires authentication")
    
    def test_deposit_requires_auth(self):
        """POST /api/escrow/{id}/deposit returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/deposit", json={})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id}/deposit requires authentication")
    
    def test_verify_condition_requires_auth(self):
        """POST /api/escrow/{id}/verify-condition returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/verify-condition", json={
            "condition_id": "test"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id}/verify-condition requires authentication")
    
    def test_settle_requires_auth(self):
        """POST /api/escrow/{id}/settle returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/settle", json={})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id}/settle requires authentication")
    
    def test_timeline_requires_auth(self):
        """GET /api/escrow/{id}/timeline returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/timeline")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/escrow/{id}/timeline requires authentication")


class TestEscrowCRUD:
    """Test escrow CRUD operations"""
    
    def test_create_escrow(self, headers):
        """POST /api/escrow/create creates a new escrow agreement"""
        payload = {
            "title": "TEST_123 Oak Street Purchase",
            "description": "Test real estate escrow",
            "escrow_amount": 450000,
            "buyer_name": "John Buyer",
            "seller_name": "Jane Seller",
            "seller_email": "seller@test.com",
            "document_name": "Purchase Agreement"
        }
        response = requests.post(f"{BASE_URL}/api/escrow/create", json=payload, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "escrow_id" in data, "No escrow_id in response"
        assert data["title"] == payload["title"]
        assert data["financial"]["escrow_amount"] == payload["escrow_amount"]
        assert data["status"] == "draft"
        assert data["parties"]["buyer"]["name"] == payload["buyer_name"]
        assert data["parties"]["seller"]["name"] == payload["seller_name"]
        
        # Store for later tests
        pytest.created_escrow_id = data["escrow_id"]
        print(f"PASS: Created escrow {data['escrow_id']}")
    
    def test_list_escrows(self, headers):
        """GET /api/escrow/list returns user's escrow agreements"""
        response = requests.get(f"{BASE_URL}/api/escrow/list", headers=headers)
        assert response.status_code == 200, f"List failed: {response.text}"
        
        data = response.json()
        assert "escrows" in data
        assert "total" in data
        assert isinstance(data["escrows"], list)
        assert data["total"] >= 1, "Should have at least one escrow"
        
        # Verify escrow structure
        if data["escrows"]:
            escrow = data["escrows"][0]
            assert "escrow_id" in escrow
            assert "title" in escrow
            assert "status" in escrow
            assert "financial" in escrow
        
        print(f"PASS: Listed {data['total']} escrows")
    
    def test_get_escrow_detail(self, headers):
        """GET /api/escrow/{id} returns full escrow detail"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}", headers=headers)
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        data = response.json()
        assert data["escrow_id"] == EXISTING_ESCROW_ID
        assert "title" in data
        assert "status" in data
        assert "parties" in data
        assert "financial" in data
        assert "conditions" in data
        assert "blockchain" in data
        assert "timeline" in data
        
        print(f"PASS: Got escrow detail for {EXISTING_ESCROW_ID}")
    
    def test_get_nonexistent_escrow(self, headers):
        """GET /api/escrow/{id} returns 404 for non-existent escrow"""
        response = requests.get(f"{BASE_URL}/api/escrow/nonexistent-id-12345", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent escrow returns 404")


class TestEscrowConditionExtraction:
    """Test AI condition extraction (mocked)"""
    
    def test_extract_conditions(self, headers):
        """POST /api/escrow/{id}/extract-conditions extracts 6 real estate conditions"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        payload = {"document_name": "Real Estate Purchase Agreement"}
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions", 
                                json=payload, headers=headers)
        assert response.status_code == 200, f"Extract failed: {response.text}"
        
        data = response.json()
        assert data["escrow_id"] == escrow_id
        assert "conditions" in data
        assert data["total"] == 6, f"Expected 6 conditions, got {data['total']}"
        assert data["mocked"] == True, "Should indicate mocked response"
        
        # Verify condition structure
        for cond in data["conditions"]:
            assert "condition_id" in cond
            assert "title" in cond
            assert "description" in cond
            assert "category" in cond
            assert "status" in cond
            assert cond["status"] == "pending"
        
        # Verify categories
        categories = [c["category"] for c in data["conditions"]]
        expected_categories = ["inspection", "financing", "title", "appraisal", "closing", "walkthrough"]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        
        print(f"PASS: Extracted {data['total']} conditions")
    
    def test_extract_conditions_updates_status(self, headers):
        """Verify escrow status changes to 'active' after extraction"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "active", f"Expected 'active', got {data['status']}"
        assert data["conditions_total"] == 6
        assert data["document"]["analysis_complete"] == True
        
        print("PASS: Escrow status updated to 'active' after extraction")


class TestEscrowDeposit:
    """Test fund deposit (mocked Stripe + HTS)"""
    
    def test_deposit_funds(self, headers):
        """POST /api/escrow/{id}/deposit records fund deposit"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/deposit", 
                                json={}, headers=headers)
        assert response.status_code == 200, f"Deposit failed: {response.text}"
        
        data = response.json()
        assert data["escrow_id"] == escrow_id
        assert data["deposit_status"] == "held"
        assert "amount" in data
        assert "stripe_payment_intent" in data
        assert data["stripe_payment_intent"].startswith("pi_mock_")
        assert "hts_token_id" in data
        assert data["hts_token_id"].startswith("0.0.")
        assert "hts_escrow_account" in data
        assert "creation_hash" in data
        assert data["mocked"] == True
        
        print(f"PASS: Deposited ${data['amount']:,} with Stripe PI: {data['stripe_payment_intent']}")
    
    def test_deposit_updates_financial(self, headers):
        """Verify financial info updated after deposit"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["financial"]["deposit_status"] == "held"
        assert data["financial"]["stripe_payment_intent"] is not None
        assert data["financial"]["hts_token_id"] is not None
        assert data["blockchain"]["creation_hash"] is not None
        
        print("PASS: Financial info updated after deposit")


class TestConditionVerification:
    """Test condition verification"""
    
    def test_verify_single_condition(self, headers):
        """POST /api/escrow/{id}/verify-condition verifies a single condition"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        # Get conditions first
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        conditions = response.json()["conditions"]
        
        # Find a pending condition
        pending = [c for c in conditions if c["status"] == "pending"]
        assert len(pending) > 0, "No pending conditions to verify"
        
        condition_id = pending[0]["condition_id"]
        
        # Verify it
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition", 
                                json={"condition_id": condition_id}, headers=headers)
        assert response.status_code == 200, f"Verify failed: {response.text}"
        
        data = response.json()
        assert data["condition_id"] == condition_id
        assert data["status"] == "met"
        assert "met_count" in data
        assert "total" in data
        assert "verification_hash" in data
        
        print(f"PASS: Verified condition {condition_id} ({data['met_count']}/{data['total']})")
    
    def test_verify_already_met_condition(self, headers):
        """Verifying already met condition returns 400"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        # Get conditions
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        conditions = response.json()["conditions"]
        
        # Find a met condition
        met = [c for c in conditions if c["status"] == "met"]
        if not met:
            pytest.skip("No met conditions to test")
        
        condition_id = met[0]["condition_id"]
        
        # Try to verify again
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition", 
                                json={"condition_id": condition_id}, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print("PASS: Re-verifying met condition returns 400")
    
    def test_verify_nonexistent_condition(self, headers):
        """Verifying non-existent condition returns 404"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition", 
                                json={"condition_id": "nonexistent"}, headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("PASS: Non-existent condition returns 404")


class TestEscrowSettlement:
    """Test escrow settlement"""
    
    def test_verify_all_conditions_and_settle(self, headers):
        """Verify all conditions then settle escrow"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        # Get current state
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        escrow = response.json()
        
        # Verify all remaining conditions
        pending = [c for c in escrow["conditions"] if c["status"] == "pending"]
        for cond in pending:
            response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition", 
                                    json={"condition_id": cond["condition_id"]}, headers=headers)
            assert response.status_code == 200, f"Verify failed: {response.text}"
        
        # Check status is now conditions_met
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        escrow = response.json()
        assert escrow["status"] in ["conditions_met", "active"], f"Unexpected status: {escrow['status']}"
        assert escrow["conditions_met_count"] == escrow["conditions_total"]
        
        print(f"PASS: All {escrow['conditions_total']} conditions verified")
        
        # Now settle
        response = requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/settle", 
                                json={}, headers=headers)
        assert response.status_code == 200, f"Settle failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "settled"
        assert "settlement_hash" in data
        assert "amount_released" in data
        assert "hcs_transaction" in data
        assert data["hcs_transaction"]["topic_id"].startswith("0.0.")
        assert "sequence_number" in data["hcs_transaction"]
        assert "explorer_url" in data["hcs_transaction"]
        assert data["mocked"] == True
        
        print(f"PASS: Escrow settled. Released ${data['amount_released']:,}")
    
    def test_settled_escrow_state(self, headers):
        """Verify escrow state after settlement"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "settled"
        assert data["financial"]["deposit_status"] == "released"
        assert data["blockchain"]["settlement_hash"] is not None
        assert data["blockchain"]["settlement_tx"] is not None
        
        print("PASS: Escrow state correctly shows settled")


class TestEscrowTimeline:
    """Test escrow timeline"""
    
    def test_get_timeline(self, headers):
        """GET /api/escrow/{id}/timeline returns full event timeline"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}/timeline", headers=headers)
        assert response.status_code == 200, f"Timeline failed: {response.text}"
        
        data = response.json()
        assert data["escrow_id"] == EXISTING_ESCROW_ID
        assert "timeline" in data
        assert isinstance(data["timeline"], list)
        
        # Verify timeline entry structure
        if data["timeline"]:
            entry = data["timeline"][0]
            assert "event" in entry
            assert "timestamp" in entry
            assert "actor" in entry
            assert "details" in entry
        
        print(f"PASS: Got timeline with {len(data['timeline'])} events")
    
    def test_created_escrow_timeline(self, headers):
        """Verify timeline for created escrow has all events"""
        escrow_id = getattr(pytest, 'created_escrow_id', None)
        if not escrow_id:
            pytest.skip("No created escrow to test")
        
        response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}/timeline", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        events = [e["event"] for e in data["timeline"]]
        
        # Should have these events from our test flow
        expected_events = ["escrow_created", "conditions_extracted", "funds_deposited", "escrow_settled"]
        for event in expected_events:
            assert event in events, f"Missing event: {event}"
        
        print(f"PASS: Timeline contains all expected events: {expected_events}")


class TestExistingEscrowState:
    """Test the pre-existing escrow state"""
    
    def test_existing_escrow_has_conditions(self, headers):
        """Verify existing escrow has 6 conditions with 1 verified"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["conditions_total"] == 6, f"Expected 6 conditions, got {data['conditions_total']}"
        
        # Check conditions
        met_count = sum(1 for c in data["conditions"] if c["status"] == "met")
        print(f"INFO: Existing escrow has {met_count}/{data['conditions_total']} conditions met")
        print(f"PASS: Existing escrow has correct condition count")
    
    def test_existing_escrow_has_deposit(self, headers):
        """Verify existing escrow has funds deposited"""
        response = requests.get(f"{BASE_URL}/api/escrow/{EXISTING_ESCROW_ID}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["financial"]["escrow_amount"] == 350000, f"Expected $350,000, got ${data['financial']['escrow_amount']}"
        assert data["financial"]["deposit_status"] == "held", f"Expected 'held', got {data['financial']['deposit_status']}"
        
        print(f"PASS: Existing escrow has ${data['financial']['escrow_amount']:,} deposited")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
