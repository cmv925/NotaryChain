"""
Tests for Signature Detection in AI Analysis and Enhanced Notary Dashboard Features
Tests: signature_analysis field in AI response, Notary Dashboard endpoints, and workflow
"""

import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "demo@test.com"
TEST_PASSWORD = "Demo123!"
TEST_NAME = "Demo User"

# Notary test credentials
NOTARY_EMAIL = "notary_test@example.com"
NOTARY_PASSWORD = "NotaryTest123!"
NOTARY_NAME = "Test Notary"


@pytest.fixture(scope="module")
def user_token():
    """Get authentication token for regular user"""
    session = requests.Session()
    
    # Try login first
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if login_response.status_code == 200:
        return login_response.json()["access_token"]
    
    # User doesn't exist, try signup
    signup_response = session.post(
        f"{BASE_URL}/api/auth/signup",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "full_name": TEST_NAME}
    )
    
    if signup_response.status_code == 200:
        return signup_response.json()["access_token"]
    
    pytest.skip(f"Could not authenticate user: {login_response.text}")


@pytest.fixture(scope="module")
def notary_token():
    """Get authentication token for notary user"""
    session = requests.Session()
    
    # Try login first
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": NOTARY_EMAIL, "password": NOTARY_PASSWORD}
    )
    
    if login_response.status_code == 200:
        return login_response.json()["access_token"]
    
    # User doesn't exist, try signup
    signup_response = session.post(
        f"{BASE_URL}/api/auth/signup",
        json={"email": NOTARY_EMAIL, "password": NOTARY_PASSWORD, "full_name": NOTARY_NAME}
    )
    
    if signup_response.status_code == 200:
        return signup_response.json()["access_token"]
    
    pytest.skip(f"Could not authenticate notary: {login_response.text}")


@pytest.fixture(scope="module")
def user_session(user_token):
    """Create authenticated session for regular user"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {user_token}",
        "Accept": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def notary_session(notary_token):
    """Create authenticated session for notary user"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {notary_token}",
        "Accept": "application/json"
    })
    return session


class TestSignatureDetection:
    """Test AI Document Analysis with Signature Detection"""
    
    def test_signature_analysis_field_in_response(self, user_session):
        """Test that signature_analysis field is returned in AI analysis response"""
        # Create a document with signature section
        test_content = """
        POWER OF ATTORNEY
        
        I, John Smith, residing at 123 Main Street, New York, NY 10001,
        hereby appoint Jane Doe as my attorney-in-fact.
        
        Date: January 15, 2026
        
        Principal Signature: John Smith [handwritten signature present]
        
        Agent Signature: ___________________
        
        Witness 1: ___________________
        
        Witness 2: ___________________
        
        Notary Acknowledgment: ___________________
        """
        
        files = {
            'file': ('signed_poa.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'power_of_attorney',
            'session_id': f'test_sig_analysis_{datetime.now().timestamp()}'
        }
        
        response = user_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}...")
        
        assert response.status_code == 200, f"Document analysis failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Analysis not successful: {result}"
        assert "analysis" in result, "No analysis data returned"
        
        analysis = result["analysis"]
        
        # Verify signature_analysis field exists
        assert "signature_analysis" in analysis, "signature_analysis field not found in response"
        
        sig_analysis = analysis["signature_analysis"]
        print(f"\n✓ Signature Analysis Found:")
        print(f"  - signatures_found: {sig_analysis.get('signatures_found')}")
        print(f"  - signature_quality: {sig_analysis.get('signature_quality')}")
        print(f"  - signature_locations: {sig_analysis.get('signature_locations')}")
        print(f"  - signature_types: {sig_analysis.get('signature_types')}")
        print(f"  - all_required_signatures_present: {sig_analysis.get('all_required_signatures_present')}")
        print(f"  - missing_signatures: {sig_analysis.get('missing_signatures')}")
        print(f"  - signature_concerns: {sig_analysis.get('signature_concerns')}")
        
        # Verify signature_analysis has expected structure
        expected_fields = [
            'signatures_found',
            'signature_quality',
            'all_required_signatures_present'
        ]
        
        for field in expected_fields:
            assert field in sig_analysis, f"Expected field '{field}' not found in signature_analysis"
        
        return result
    
    def test_signature_detection_in_contract(self, user_session):
        """Test signature detection in contract document type"""
        test_content = """
        SERVICE AGREEMENT
        
        This agreement is entered into between:
        Party A: ABC Corporation (John Williams, CEO)
        Party B: XYZ Services Inc. (Mary Brown, Director)
        
        Terms: 12 months service contract starting March 1, 2026
        Amount: $50,000 annually
        
        Signatures:
        
        Party A: John Williams [signature present]
        Date: January 20, 2026
        
        Party B: _______________
        Date: _______________
        """
        
        files = {
            'file': ('contract.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'contract',
            'session_id': f'test_contract_sig_{datetime.now().timestamp()}'
        }
        
        response = user_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result.get("success") == True
        
        sig_analysis = result["analysis"].get("signature_analysis", {})
        print(f"\n✓ Contract Signature Analysis:")
        print(f"  - signatures_found: {sig_analysis.get('signatures_found')}")
        print(f"  - missing_signatures: {sig_analysis.get('missing_signatures')}")
        
        # Verify key information also includes signatures_present
        key_info = result["analysis"].get("key_information", {})
        print(f"  - key_information.signatures_present: {key_info.get('signatures_present')}")
    
    def test_signature_detection_in_will(self, user_session):
        """Test signature detection in Last Will document"""
        test_content = """
        LAST WILL AND TESTAMENT
        
        I, Elizabeth Taylor, residing at 456 Oak Avenue, Los Angeles, CA 90210,
        being of sound mind, declare this my last will and testament.
        
        Executor: Robert Taylor (son)
        
        Bequests:
        1. 50% of estate to Robert Taylor
        2. 50% of estate to Sarah Taylor
        
        Testator Signature: Elizabeth Taylor [handwritten signature]
        Date: January 15, 2026
        
        Witness 1: Michael Brown [handwritten signature]
        Address: 789 Pine St, Los Angeles, CA
        Date: January 15, 2026
        
        Witness 2: Jennifer White [handwritten signature]
        Address: 101 Maple Ave, Los Angeles, CA
        Date: January 15, 2026
        
        Notary: _______________
        Commission Expiration: _______________
        """
        
        files = {
            'file': ('will.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'will',
            'session_id': f'test_will_sig_{datetime.now().timestamp()}'
        }
        
        response = user_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result.get("success") == True
        assert "signature_analysis" in result["analysis"]
        
        sig_analysis = result["analysis"]["signature_analysis"]
        print(f"\n✓ Will Signature Analysis:")
        print(f"  - signatures_found: {sig_analysis.get('signatures_found')}")
        print(f"  - signature_types: {sig_analysis.get('signature_types')}")


class TestNotaryDashboardEndpoints:
    """Test Notary Dashboard API Endpoints"""
    
    @pytest.fixture(scope="class")
    def notary_profile_setup(self, notary_session):
        """Set up notary profile for testing"""
        # Check if profile already exists
        profile_response = notary_session.get(f"{BASE_URL}/api/notary/profile")
        
        if profile_response.status_code == 200:
            print("✓ Notary profile already exists")
            return profile_response.json()
        
        # Create notary profile
        profile_data = {
            "commission_id": "NY-2026-001234",
            "license_state": "NY",
            "expiration_date": "2028-12-31",
            "ron_certified": True,
            "specializations": ["real_estate", "power_of_attorney", "wills"]
        }
        
        create_response = notary_session.post(
            f"{BASE_URL}/api/notary/profile",
            json=profile_data
        )
        
        if create_response.status_code == 200:
            print("✓ Notary profile created successfully")
            return create_response.json()
        elif create_response.status_code == 400 and "already exists" in create_response.text:
            print("✓ Notary profile already exists (checked again)")
            return notary_session.get(f"{BASE_URL}/api/notary/profile").json()
        else:
            print(f"Warning: Could not create notary profile: {create_response.text}")
            return None
    
    def test_get_notary_stats(self, notary_session, notary_profile_setup):
        """Test GET /api/notary/stats endpoint"""
        response = notary_session.get(f"{BASE_URL}/api/notary/stats")
        
        print(f"Stats response: {response.status_code}")
        print(f"Stats body: {response.text}")
        
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        
        # Verify required fields for enhanced dashboard
        assert "is_notary" in data, "is_notary field missing"
        
        if data["is_notary"]:
            assert "total_completed" in data, "total_completed field missing"
            assert "pending_count" in data, "pending_count field missing"
            print(f"✓ Notary stats retrieved: completed={data.get('total_completed')}, pending={data.get('pending_count')}")
        else:
            print("✓ Stats retrieved but user is not a notary")
    
    def test_get_pending_requests(self, notary_session, notary_profile_setup):
        """Test GET /api/notary/requests/pending endpoint"""
        response = notary_session.get(f"{BASE_URL}/api/notary/requests/pending")
        
        print(f"Pending requests response: {response.status_code}")
        
        if response.status_code == 403:
            print("Note: User is not a certified notary - expected if profile not approved")
            return
        
        assert response.status_code == 200, f"Failed to get pending requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Retrieved {len(data)} pending requests")
        
        # Verify request structure if any exist
        if data:
            request = data[0]
            expected_fields = ['id', 'document_name', 'document_type', 'status', 'created_at']
            for field in expected_fields:
                assert field in request, f"Expected field '{field}' not in request"
    
    def test_get_assigned_requests(self, notary_session, notary_profile_setup):
        """Test GET /api/notary/requests/assigned endpoint"""
        response = notary_session.get(f"{BASE_URL}/api/notary/requests/assigned")
        
        print(f"Assigned requests response: {response.status_code}")
        
        if response.status_code == 403:
            print("Note: User is not a certified notary")
            return
        
        assert response.status_code == 200, f"Failed to get assigned requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Retrieved {len(data)} assigned requests")


class TestNotarizationWorkflow:
    """Test the complete notarization workflow from user to notary"""
    
    def test_create_notarization_request(self, user_session):
        """Test creating a notarization request as a user"""
        session_id = f'workflow_test_{datetime.now().timestamp()}'
        
        # Step 1: Analyze document
        test_content = """
        REAL ESTATE PURCHASE AGREEMENT
        
        Property: 123 Main Street, Brooklyn, NY 11201
        Buyer: John Smith
        Seller: Jane Doe
        Purchase Price: $750,000
        Closing Date: February 15, 2026
        
        Buyer Signature: John Smith [signed]
        Date: January 20, 2026
        
        Seller Signature: Jane Doe [signed]
        Date: January 20, 2026
        
        Escrow Agent: _______________
        Notary: _______________
        """
        
        files = {
            'file': ('real_estate.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'real_estate',
            'session_id': session_id
        }
        
        analysis_response = user_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        assert analysis_response.status_code == 200
        analysis_id = analysis_response.json().get("analysis_id")
        print(f"✓ Step 1: Document analyzed, ID: {analysis_id}")
        
        # Step 2: Create notarization request
        request_data = {
            "document_name": "Real Estate Purchase Agreement - 123 Main St",
            "document_type": "real_estate",
            "notarization_type": "ron",
            "scheduled_time": "2026-02-01T14:00:00",
            "signers": [
                {"name": "John Smith", "email": "john@example.com"},
                {"name": "Jane Doe", "email": "jane@example.com"}
            ],
            "notes": "Urgent closing required",
            "session_id": session_id,
            "analysis_id": analysis_id,
            "biometric_verified": True
        }
        
        request_response = user_session.post(
            f"{BASE_URL}/api/notary/requests",
            json=request_data
        )
        
        print(f"Create request response: {request_response.status_code}")
        print(f"Response body: {request_response.text}")
        
        assert request_response.status_code == 200, f"Failed to create request: {request_response.text}"
        
        result = request_response.json()
        assert "id" in result
        print(f"✓ Step 2: Notarization request created, ID: {result.get('id')}")
        
        return result.get('id')
    
    def test_get_user_requests(self, user_session):
        """Test user can see their own requests"""
        response = user_session.get(f"{BASE_URL}/api/notary/requests/my")
        
        assert response.status_code == 200, f"Failed to get requests: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User has {len(data)} notarization requests")
        
        if data:
            # Verify request structure
            request = data[0]
            print(f"  Latest request: {request.get('document_name')} - Status: {request.get('status')}")


class TestNotaryActions:
    """Test notary-specific actions (assign, start session, complete)"""
    
    def test_assign_request_endpoint_structure(self, notary_session):
        """Test the assign request endpoint exists and responds correctly"""
        # Use a dummy request ID to test endpoint structure
        response = notary_session.post(
            f"{BASE_URL}/api/notary/requests/dummy-id/assign"
        )
        
        # Expect 400 (request not available) or 403 (not notary) or 404 (not found)
        # but NOT 500 (server error)
        assert response.status_code != 500, f"Server error on assign endpoint: {response.text}"
        print(f"✓ Assign endpoint responds correctly: {response.status_code}")
    
    def test_start_session_endpoint_structure(self, notary_session):
        """Test the start session endpoint exists and responds correctly"""
        response = notary_session.post(
            f"{BASE_URL}/api/notary/requests/dummy-id/start-session"
        )
        
        # Expect 404 (request not found) but NOT 500
        assert response.status_code != 500, f"Server error on start-session endpoint: {response.text}"
        print(f"✓ Start-session endpoint responds correctly: {response.status_code}")
    
    def test_complete_notarization_endpoint_structure(self, notary_session):
        """Test the complete notarization endpoint exists and responds correctly"""
        response = notary_session.post(
            f"{BASE_URL}/api/notary/requests/dummy-id/complete",
            json={"notes": "Test completion"}
        )
        
        # Expect 404 (request not found) but NOT 500
        assert response.status_code != 500, f"Server error on complete endpoint: {response.text}"
        print(f"✓ Complete endpoint responds correctly: {response.status_code}")


class TestVideoRoomEndpoint:
    """Test video room creation for notary sessions"""
    
    def test_video_rooms_endpoint_exists(self, notary_session):
        """Test that video rooms endpoint exists"""
        response = notary_session.post(
            f"{BASE_URL}/api/video/rooms",
            json={"request_id": "test-request-id"}
        )
        
        # Should not return 404 (endpoint not found) or 500 (server error)
        print(f"Video rooms endpoint response: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        # Accept various responses - the important thing is the endpoint exists
        assert response.status_code != 404, "Video rooms endpoint not found"
        print(f"✓ Video rooms endpoint exists and responds: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
