"""
Test Suite for Dynamic Escrow Intelligence - Trust Gap Features
Tests all 3 Trust Gaps: Execution, Verification, and Security

Endpoints tested:
- POST /api/escrow/create
- POST /api/escrow/{id}/extract-conditions
- POST /api/escrow/{id}/deposit
- POST /api/escrow/{id}/verify-condition
- POST /api/escrow/{id}/oracle-verify/{condition_id}
- POST /api/escrow/{id}/biometric-gate
- POST /api/escrow/{id}/settle
- GET /api/escrow/list
- GET /api/escrow/{id}
"""
import pytest
import requests
import os
import base64
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def user_token():
    """Get regular user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"User login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_headers(user_token):
    """Headers with user auth"""
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_escrow(admin_headers):
    """Create a test escrow for use in other tests"""
    response = requests.post(f"{BASE_URL}/api/escrow/create", json={
        "title": "TEST_Trust_Gap_Escrow",
        "description": "Test escrow for Trust Gap feature testing",
        "buyer_name": "Test Buyer",
        "seller_name": "Test Seller",
        "seller_email": "seller@test.com",
        "escrow_amount": 350000,
        "escrow_type": "real_estate"
    }, headers=admin_headers)
    
    if response.status_code == 200:
        return response.json()
    pytest.skip(f"Failed to create test escrow: {response.status_code} - {response.text}")


class TestEscrowCreate:
    """Test POST /api/escrow/create"""
    
    def test_create_escrow_success(self, admin_headers):
        """Create escrow with all required fields"""
        response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_New_Escrow_Agreement",
            "description": "Test escrow creation",
            "buyer_name": "John Buyer",
            "seller_name": "Jane Seller",
            "seller_email": "jane@seller.com",
            "escrow_amount": 500000,
            "escrow_type": "real_estate"
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify escrow structure
        assert "escrow_id" in data
        assert data["title"] == "TEST_New_Escrow_Agreement"
        assert data["status"] == "draft"
        
        # Verify parties structure with biometric fields
        assert "parties" in data
        assert "buyer" in data["parties"]
        assert "seller" in data["parties"]
        assert data["parties"]["buyer"]["biometric_verified"] == False
        assert data["parties"]["seller"]["biometric_verified"] == False
        
        # Verify settlement object
        assert "settlement" in data
        assert data["settlement"]["biometric_gate_passed"] == False
        
        # Verify oracle_events array
        assert "oracle_events" in data
        assert isinstance(data["oracle_events"], list)
        
        # Verify financial structure
        assert "financial" in data
        assert data["financial"]["escrow_amount"] == 500000
        assert data["financial"]["deposit_status"] == "pending"
        
    def test_create_escrow_requires_auth(self):
        """Create escrow without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "Unauthorized Escrow"
        })
        assert response.status_code == 401


class TestExtractConditions:
    """Test POST /api/escrow/{id}/extract-conditions - Trust Gap 1: Execution"""
    
    def test_extract_conditions_demo_mode(self, admin_headers, test_escrow):
        """Extract conditions without document (demo mode)"""
        escrow_id = test_escrow["escrow_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={"document_name": "Test Purchase Agreement"},
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify extraction result
        assert "conditions" in data
        assert "total" in data
        assert data["total"] > 0
        
        # Verify condition structure
        conditions = data["conditions"]
        assert len(conditions) > 0
        
        for cond in conditions:
            # Required fields per spec
            assert "condition_id" in cond
            assert "status" in cond
            assert cond["status"] == "pending"
            assert "oracle_result" in cond
            assert cond["oracle_result"] is None
            assert "photo_verification" in cond
            assert cond["photo_verification"] is None
            assert "payment_pct" in cond
            assert "verification_method" in cond
            assert "oracle_type" in cond
            
    def test_extract_conditions_not_found(self, admin_headers):
        """Extract conditions for non-existent escrow"""
        response = requests.post(
            f"{BASE_URL}/api/escrow/nonexistent-id/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert response.status_code == 404


class TestDeposit:
    """Test POST /api/escrow/{id}/deposit"""
    
    def test_deposit_funds(self, admin_headers, test_escrow):
        """Deposit funds into escrow smart vault"""
        escrow_id = test_escrow["escrow_id"]
        
        # First extract conditions to activate escrow
        requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/deposit",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify deposit response
        assert data["deposit_status"] == "held"
        assert data["amount"] == test_escrow["financial"]["escrow_amount"]
        assert "stripe_payment_intent" in data
        assert "hts_token_id" in data
        assert "hts_escrow_account" in data
        assert "creation_hash" in data
        
        # Verify escrow was updated
        get_response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        escrow_data = get_response.json()
        assert escrow_data["financial"]["deposit_status"] == "held"
        assert escrow_data["financial"]["amount_held"] == test_escrow["financial"]["escrow_amount"]


class TestVerifyCondition:
    """Test POST /api/escrow/{id}/verify-condition"""
    
    def test_verify_condition_party_confirmation(self, admin_headers, test_escrow):
        """Verify a condition via party confirmation"""
        escrow_id = test_escrow["escrow_id"]
        
        # Get escrow to find a condition
        get_response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        escrow = get_response.json()
        
        # Find a party_confirmation condition
        party_cond = None
        for c in escrow.get("conditions", []):
            if c.get("verification_method") == "party_confirmation" and c.get("status") == "pending":
                party_cond = c
                break
        
        if not party_cond:
            pytest.skip("No pending party_confirmation condition found")
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition",
            json={
                "condition_id": party_cond["condition_id"],
                "evidence": "Test verification evidence"
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["status"] == "met"
        assert "verification_hash" in data
        assert "met_count" in data
        assert "total" in data


class TestOracleVerify:
    """Test POST /api/escrow/{id}/oracle-verify/{condition_id} - Trust Gap 2: Verification"""
    
    def test_oracle_verify_oracle_condition(self, admin_headers):
        """Oracle verify an oracle-verifiable condition"""
        # Create fresh escrow for this test
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Oracle_Verify_Escrow",
            "escrow_amount": 400000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract conditions
        requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        
        # Get escrow to find oracle condition
        get_response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        escrow_data = get_response.json()
        
        # Find an oracle-verifiable condition
        oracle_cond = None
        for c in escrow_data.get("conditions", []):
            if c.get("verification_method") in ("oracle", "ai_photo_verification") and c.get("status") == "pending":
                oracle_cond = c
                break
        
        if not oracle_cond:
            pytest.skip("No oracle-verifiable condition found")
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/oracle-verify/{oracle_cond['condition_id']}",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify oracle result structure
        assert "oracle_result" in data
        oracle_result = data["oracle_result"]
        assert "oracle_id" in oracle_result
        assert "oracle_type" in oracle_result
        assert "source" in oracle_result
        assert "condition_met" in oracle_result
        assert "confidence" in oracle_result
        assert "hash" in oracle_result
        assert "data" in oracle_result
        
    def test_oracle_verify_party_confirmation_returns_400(self, admin_headers):
        """Oracle verify on party_confirmation condition should return 400"""
        # Create fresh escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Oracle_400_Escrow",
            "escrow_amount": 300000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract conditions
        requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        
        # Get escrow to find party_confirmation condition
        get_response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        escrow_data = get_response.json()
        
        # Find a party_confirmation condition
        party_cond = None
        for c in escrow_data.get("conditions", []):
            if c.get("verification_method") == "party_confirmation" and c.get("status") == "pending":
                party_cond = c
                break
        
        if not party_cond:
            pytest.skip("No party_confirmation condition found")
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/oracle-verify/{party_cond['condition_id']}",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for party_confirmation, got {response.status_code}"
        assert "does not support oracle verification" in response.json().get("detail", "").lower()


class TestBiometricGate:
    """Test POST /api/escrow/{id}/biometric-gate - Trust Gap 3: Security"""
    
    def test_biometric_gate_requires_selfie(self, admin_headers, test_escrow):
        """Biometric gate without selfie should fail"""
        escrow_id = test_escrow["escrow_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/biometric-gate",
            json={"party_role": "buyer"},
            headers=admin_headers
        )
        
        assert response.status_code == 400
        assert "selfie_base64" in response.json().get("detail", "").lower()
        
    def test_biometric_gate_with_selfie(self, admin_headers, test_escrow):
        """Biometric gate with valid selfie"""
        escrow_id = test_escrow["escrow_id"]
        
        # Create a minimal valid JPEG base64 (1x1 pixel red image)
        # This is a valid JPEG that GPT-5.2 can analyze
        minimal_jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/biometric-gate",
            json={
                "selfie_base64": minimal_jpeg,
                "party_role": "buyer"
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "escrow_id" in data
        assert "party_role" in data
        assert data["party_role"] == "buyer"
        assert "biometric_result" in data
        assert "gate_passed" in data
        assert "both_parties_verified" in data
        assert "proof_id" in data
        
        # Verify biometric result structure
        bio_result = data["biometric_result"]
        assert "verified" in bio_result
        assert "confidence" in bio_result


class TestSettle:
    """Test POST /api/escrow/{id}/settle"""
    
    def test_settle_escrow(self, admin_headers):
        """Settle an escrow with all conditions met"""
        # Create fresh escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Settlement_Escrow",
            "escrow_amount": 250000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract conditions
        requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        
        # Deposit funds
        requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/deposit",
            json={},
            headers=admin_headers
        )
        
        # Get escrow and verify all conditions
        get_response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        escrow_data = get_response.json()
        
        # Verify all conditions
        for c in escrow_data.get("conditions", []):
            if c.get("status") == "pending":
                requests.post(
                    f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition",
                    json={"condition_id": c["condition_id"]},
                    headers=admin_headers
                )
        
        # Now settle
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/settle",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify settlement response
        assert data["status"] == "settled"
        assert "settlement_hash" in data
        assert "amount_released" in data
        assert "hcs_transaction" in data
        
        hcs_tx = data["hcs_transaction"]
        assert "transaction_id" in hcs_tx
        assert "sequence_number" in hcs_tx
        assert "topic_id" in hcs_tx


class TestEscrowList:
    """Test GET /api/escrow/list"""
    
    def test_list_escrows(self, admin_headers):
        """List escrows for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/escrow/list",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "escrows" in data
        assert "total" in data
        assert isinstance(data["escrows"], list)
        
    def test_list_escrows_requires_auth(self):
        """List escrows without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/escrow/list")
        assert response.status_code == 401


class TestEscrowGet:
    """Test GET /api/escrow/{id}"""
    
    def test_get_escrow_full_details(self, admin_headers, test_escrow):
        """Get escrow with all Trust Gap fields"""
        escrow_id = test_escrow["escrow_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/escrow/{escrow_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        assert "escrow_id" in data
        assert "oracle_events" in data
        assert isinstance(data["oracle_events"], list)
        assert "biometric_proofs" in data
        assert isinstance(data["biometric_proofs"], list)
        assert "settlement" in data
        assert "biometric_gate_passed" in data["settlement"]
        
        # Verify parties have biometric fields
        assert data["parties"]["buyer"]["biometric_verified"] is not None
        assert data["parties"]["seller"]["biometric_verified"] is not None
        
    def test_get_escrow_not_found(self, admin_headers):
        """Get non-existent escrow"""
        response = requests.get(
            f"{BASE_URL}/api/escrow/nonexistent-id",
            headers=admin_headers
        )
        assert response.status_code == 404


class TestConditionFields:
    """Test that conditions have all required fields per spec"""
    
    def test_condition_structure(self, admin_headers):
        """Verify condition fields match spec"""
        # Create and extract
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Condition_Fields_Escrow",
            "escrow_amount": 100000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        
        assert extract_response.status_code == 200
        data = extract_response.json()
        
        for cond in data["conditions"]:
            # Per spec: conditions have 'status': 'pending', 'oracle_result': null, 'photo_verification': null, 'payment_pct' fields
            assert cond["status"] == "pending", f"Expected status 'pending', got {cond['status']}"
            assert cond["oracle_result"] is None, f"Expected oracle_result null, got {cond['oracle_result']}"
            assert cond["photo_verification"] is None, f"Expected photo_verification null, got {cond['photo_verification']}"
            assert "payment_pct" in cond, "Missing payment_pct field"
            assert "verification_method" in cond, "Missing verification_method field"
            assert "oracle_type" in cond, "Missing oracle_type field"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
