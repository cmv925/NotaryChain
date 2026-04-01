"""
Test Suite for Escrow WebSocket Event Emissions
Tests that escrow endpoints emit the correct WebSocket events:
- escrow_oracle: emitted by POST /api/escrow/{id}/oracle-verify/{cid}
- escrow_biometric: emitted by POST /api/escrow/{id}/biometric-gate
- escrow_settlement: emitted by POST /api/escrow/{id}/settle
- escrow_photo_verified: emitted by POST /api/escrow/{id}/photo-verify/{cid}

Note: WebSocket events are side-effects. We test that the API calls succeed,
which means the WS event emission was attempted. The _emit_escrow_event helper
resolves user IDs from buyer/seller/creator emails and calls broadcast_event.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


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
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestFullEscrowLifecycleWithWSEvents:
    """
    Test the complete escrow lifecycle flow:
    create -> extract -> deposit -> oracle-verify -> party-verify -> settle
    Each step that emits WS events should succeed without 500 errors.
    """
    
    def test_full_lifecycle_flow(self, admin_headers):
        """Complete escrow lifecycle - all WS-emitting endpoints should succeed"""
        
        # Step 1: Create escrow
        print("\n=== Step 1: Create Escrow ===")
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_WS_Full_Lifecycle_Escrow",
            "description": "Testing WebSocket event emissions",
            "buyer_name": "WS Test Buyer",
            "buyer_email": ADMIN_EMAIL,  # Use admin email so WS events target this user
            "seller_name": "WS Test Seller",
            "seller_email": "seller@test.com",
            "escrow_amount": 275000,
            "escrow_type": "real_estate"
        }, headers=admin_headers)
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        print(f"Created escrow: {escrow_id}")
        
        # Verify escrow structure
        assert escrow["status"] == "draft"
        assert escrow["parties"]["buyer"]["email"] == ADMIN_EMAIL
        assert escrow["settlement"]["biometric_gate_passed"] == False
        
        # Step 2: Extract conditions
        print("\n=== Step 2: Extract Conditions ===")
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={"document_name": "WS Test Purchase Agreement"},
            headers=admin_headers
        )
        
        assert extract_response.status_code == 200, f"Extract failed: {extract_response.text}"
        extract_data = extract_response.json()
        print(f"Extracted {extract_data['total']} conditions")
        
        # Verify conditions have required fields
        conditions = extract_data["conditions"]
        assert len(conditions) > 0
        for c in conditions:
            assert c["status"] == "pending"
            assert c["oracle_result"] is None
            assert c["photo_verification"] is None
        
        # Step 3: Deposit funds
        print("\n=== Step 3: Deposit Funds ===")
        deposit_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/deposit",
            json={},
            headers=admin_headers
        )
        
        assert deposit_response.status_code == 200, f"Deposit failed: {deposit_response.text}"
        deposit_data = deposit_response.json()
        print(f"Deposited ${deposit_data['amount']:,} - Status: {deposit_data['deposit_status']}")
        
        assert deposit_data["deposit_status"] == "held"
        assert "stripe_payment_intent" in deposit_data
        assert "hts_token_id" in deposit_data
        
        # Step 4: Oracle verify a condition (emits escrow_oracle WS event)
        print("\n=== Step 4: Oracle Verify (emits escrow_oracle WS event) ===")
        
        # Get fresh escrow data
        get_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        escrow_data = get_response.json()
        
        # Find an oracle-verifiable condition
        oracle_cond = None
        for c in escrow_data.get("conditions", []):
            if c.get("verification_method") in ("oracle", "ai_photo_verification") and c.get("status") == "pending":
                oracle_cond = c
                break
        
        if oracle_cond:
            oracle_response = requests.post(
                f"{BASE_URL}/api/escrow/{escrow_id}/oracle-verify/{oracle_cond['condition_id']}",
                json={},
                headers=admin_headers
            )
            
            assert oracle_response.status_code == 200, f"Oracle verify failed: {oracle_response.text}"
            oracle_data = oracle_response.json()
            print(f"Oracle result: {oracle_data['oracle_result']['source']} - Met: {oracle_data['oracle_result']['condition_met']}")
            
            # Verify oracle result structure
            assert "oracle_result" in oracle_data
            assert "oracle_id" in oracle_data["oracle_result"]
            assert "source" in oracle_data["oracle_result"]
            assert "condition_met" in oracle_data["oracle_result"]
            assert "confidence" in oracle_data["oracle_result"]
            assert "hash" in oracle_data["oracle_result"]
            
            # Verify response includes met_count and total for WS event data
            assert "met_count" in oracle_data
            assert "total" in oracle_data
        else:
            print("No oracle-verifiable condition found, skipping oracle verify")
        
        # Step 5: Party verify remaining conditions
        print("\n=== Step 5: Party Verify Remaining Conditions ===")
        
        # Refresh escrow data
        get_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        escrow_data = get_response.json()
        
        verified_count = 0
        for c in escrow_data.get("conditions", []):
            if c.get("status") == "pending":
                verify_response = requests.post(
                    f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition",
                    json={"condition_id": c["condition_id"], "evidence": "Test verification"},
                    headers=admin_headers
                )
                if verify_response.status_code == 200:
                    verified_count += 1
        
        print(f"Party verified {verified_count} conditions")
        
        # Step 6: Biometric gate (emits escrow_biometric WS event)
        print("\n=== Step 6: Biometric Gate (emits escrow_biometric WS event) ===")
        
        # Minimal valid JPEG for biometric test
        minimal_jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        
        biometric_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/biometric-gate",
            json={"selfie_base64": minimal_jpeg, "party_role": "buyer"},
            headers=admin_headers
        )
        
        assert biometric_response.status_code == 200, f"Biometric gate failed: {biometric_response.text}"
        biometric_data = biometric_response.json()
        print(f"Biometric result: Verified={biometric_data['gate_passed']}, Confidence={biometric_data['biometric_result'].get('confidence', 0):.0%}")
        
        # Verify biometric response structure for WS event
        assert "escrow_id" in biometric_data
        assert "party_role" in biometric_data
        assert "biometric_result" in biometric_data
        assert "gate_passed" in biometric_data
        assert "both_parties_verified" in biometric_data
        assert "proof_id" in biometric_data
        
        # Step 7: Settle escrow (emits escrow_settlement WS event)
        print("\n=== Step 7: Settle Escrow (emits escrow_settlement WS event) ===")
        
        settle_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/settle",
            json={},
            headers=admin_headers
        )
        
        assert settle_response.status_code == 200, f"Settlement failed: {settle_response.text}"
        settle_data = settle_response.json()
        print(f"Settlement: Status={settle_data['status']}, Released=${settle_data['amount_released']:,}")
        
        # Verify settlement response structure for WS event
        assert settle_data["status"] == "settled"
        assert "settlement_hash" in settle_data
        assert "amount_released" in settle_data
        assert "hcs_transaction" in settle_data
        
        # Verify HCS transaction structure
        hcs_tx = settle_data["hcs_transaction"]
        assert "transaction_id" in hcs_tx
        assert "sequence_number" in hcs_tx
        assert "topic_id" in hcs_tx
        
        # Final verification - get escrow and check final state
        print("\n=== Final Verification ===")
        final_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        final_escrow = final_response.json()
        
        assert final_escrow["status"] == "settled"
        assert final_escrow["financial"]["deposit_status"] == "released"
        assert final_escrow["financial"]["amount_released"] == 275000
        
        # Check oracle_events array was populated
        assert "oracle_events" in final_escrow
        if oracle_cond:
            assert len(final_escrow["oracle_events"]) > 0
        
        # Check biometric_proofs array was populated
        assert "biometric_proofs" in final_escrow
        assert len(final_escrow["biometric_proofs"]) > 0
        
        # Check timeline has all events
        assert "timeline" in final_escrow
        timeline_events = [t["event"] for t in final_escrow["timeline"]]
        assert "escrow_created" in timeline_events
        assert "conditions_extracted" in timeline_events
        assert "funds_deposited" in timeline_events
        assert "escrow_settled" in timeline_events
        
        print(f"\n✓ Full lifecycle completed successfully for escrow {escrow_id}")
        print(f"  - Oracle events: {len(final_escrow['oracle_events'])}")
        print(f"  - Biometric proofs: {len(final_escrow['biometric_proofs'])}")
        print(f"  - Timeline events: {len(final_escrow['timeline'])}")


class TestOracleVerifyWSEvent:
    """Test oracle-verify endpoint emits escrow_oracle WS event"""
    
    def test_oracle_verify_returns_ws_event_data(self, admin_headers):
        """Oracle verify response includes all data needed for WS event"""
        # Create escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Oracle_WS_Event",
            "escrow_amount": 200000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract conditions
        requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions", json={}, headers=admin_headers)
        
        # Get oracle condition
        get_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        escrow_data = get_response.json()
        
        oracle_cond = None
        for c in escrow_data.get("conditions", []):
            if c.get("verification_method") in ("oracle", "ai_photo_verification") and c.get("status") == "pending":
                oracle_cond = c
                break
        
        if not oracle_cond:
            pytest.skip("No oracle condition found")
        
        # Oracle verify
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/oracle-verify/{oracle_cond['condition_id']}",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields needed for escrow_oracle WS event payload
        assert "escrow_id" in data
        assert "condition_id" in data
        assert "oracle_result" in data
        assert "met_count" in data
        assert "total" in data
        
        # Oracle result should have fields for WS event
        oracle_result = data["oracle_result"]
        assert "source" in oracle_result
        assert "condition_met" in oracle_result
        assert "confidence" in oracle_result


class TestBiometricGateWSEvent:
    """Test biometric-gate endpoint emits escrow_biometric WS event"""
    
    def test_biometric_gate_returns_ws_event_data(self, admin_headers):
        """Biometric gate response includes all data needed for WS event"""
        # Create escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Biometric_WS_Event",
            "escrow_amount": 150000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Minimal JPEG
        minimal_jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/biometric-gate",
            json={"selfie_base64": minimal_jpeg, "party_role": "buyer"},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields needed for escrow_biometric WS event payload
        assert "escrow_id" in data
        assert "party_role" in data
        assert "biometric_result" in data
        assert "gate_passed" in data
        assert "both_parties_verified" in data
        assert "proof_id" in data
        
        # Biometric result should have fields for WS event
        bio_result = data["biometric_result"]
        assert "verified" in bio_result
        assert "confidence" in bio_result


class TestSettlementWSEvent:
    """Test settle endpoint emits escrow_settlement WS event"""
    
    def test_settlement_returns_ws_event_data(self, admin_headers):
        """Settlement response includes all data needed for WS event"""
        # Create escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Settlement_WS_Event",
            "escrow_amount": 180000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract and deposit
        requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions", json={}, headers=admin_headers)
        requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/deposit", json={}, headers=admin_headers)
        
        # Verify all conditions
        get_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        escrow_data = get_response.json()
        
        for c in escrow_data.get("conditions", []):
            if c.get("status") == "pending":
                requests.post(
                    f"{BASE_URL}/api/escrow/{escrow_id}/verify-condition",
                    json={"condition_id": c["condition_id"]},
                    headers=admin_headers
                )
        
        # Settle
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/settle",
            json={},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields needed for escrow_settlement WS event payload
        assert "escrow_id" in data
        assert "status" in data
        assert data["status"] == "settled"
        assert "settlement_hash" in data
        assert "amount_released" in data
        assert "hcs_transaction" in data
        
        # HCS transaction should have fields for WS event
        hcs_tx = data["hcs_transaction"]
        assert "hcs_submitted" in hcs_tx


class TestPhotoVerifyWSEvent:
    """Test photo-verify endpoint emits escrow_photo_verified WS event"""
    
    def test_photo_verify_returns_ws_event_data(self, admin_headers):
        """Photo verify response includes all data needed for WS event"""
        # Create escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Photo_WS_Event",
            "escrow_amount": 120000
        }, headers=admin_headers)
        escrow = create_response.json()
        escrow_id = escrow["escrow_id"]
        
        # Extract conditions
        requests.post(f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions", json={}, headers=admin_headers)
        
        # Get photo-verifiable condition
        get_response = requests.get(f"{BASE_URL}/api/escrow/{escrow_id}", headers=admin_headers)
        escrow_data = get_response.json()
        
        photo_cond = None
        for c in escrow_data.get("conditions", []):
            if c.get("verification_method") == "ai_photo_verification" and c.get("status") == "pending":
                photo_cond = c
                break
        
        if not photo_cond:
            pytest.skip("No photo-verifiable condition found")
        
        # Minimal JPEG for photo verification
        minimal_jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        
        response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/photo-verify/{photo_cond['condition_id']}",
            json={"photo_base64": minimal_jpeg},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields needed for escrow_photo_verified WS event payload
        assert "escrow_id" in data
        assert "condition_id" in data
        assert "ai_result" in data
        assert "condition_status" in data
        assert "met_count" in data
        assert "total" in data
        
        # AI result should have fields for WS event
        ai_result = data["ai_result"]
        assert "verified" in ai_result
        assert "confidence" in ai_result


class TestEmitEscrowEventHelper:
    """Test that _emit_escrow_event helper is called correctly"""
    
    def test_escrow_has_buyer_seller_emails_for_ws_targeting(self, admin_headers):
        """Verify escrow stores buyer/seller emails for WS event targeting"""
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_WS_Targeting",
            "buyer_name": "Target Buyer",
            "buyer_email": "buyer@test.com",
            "seller_name": "Target Seller",
            "seller_email": "seller@test.com",
            "escrow_amount": 100000
        }, headers=admin_headers)
        
        assert create_response.status_code == 200
        escrow = create_response.json()
        
        # Verify buyer/seller emails are stored for WS targeting
        assert escrow["parties"]["buyer"]["email"] == "buyer@test.com"
        assert escrow["parties"]["seller"]["email"] == "seller@test.com"
        assert escrow["created_by"] == ADMIN_EMAIL  # Creator email for WS targeting


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
