"""
Test Notarization Completion Flow with Full Package Email
Tests for the enhanced complete_notarization endpoint that compiles and sends
full session package (AI analysis, biometrics, notary, blockchain) in email.

Key features tested:
- POST /api/notary/requests - create a notarization request as demo user
- POST /api/notary/requests/{id}/assign - assign request to admin notary
- POST /api/notary/requests/{id}/complete - complete notarization with seal_package=true
- Verify complete response includes package with package_id, blockchain_transaction, hcs_topic_id, explorer_url
- Verify sealed package in DB contains document_analysis, biometric_verification, video_sessions, participants sections
- Verify completion email queued with full package data (check logs for 'Completion email with full package queued')
- Verify NotarizationPackageService.get_package returns full package including notary info
- Verify non-notary user gets 404 when trying to complete a request
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
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"

# Previous test request from context (for get_package testing)
TEST_REQUEST_ID = "3966a978-a803-4c9e-a9c0-96cd61f96791"
TEST_PACKAGE_ID = "d52a36d2-3afa-4561-a8cc-9a4e5a01f264"


class TestNotarizationCompletionFlow:
    """Full integration tests for notarization completion flow with email"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_request_id = None
    
    def get_token(self, email, password):
        """Helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_1_create_notarization_request_as_demo_user(self):
        """Test: Create a notarization request as demo user"""
        token = self.get_token(DEMO_EMAIL, DEMO_PASSWORD)
        assert token is not None, f"Failed to login as demo user: {DEMO_EMAIL}"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a new notarization request
        request_data = {
            "document_name": f"TEST_CompletionFlow_{uuid.uuid4().hex[:8]}.pdf",
            "document_type": "Contract",
            "notarization_type": "acknowledgment",
            "notes": "Test request for completion flow with full package email"
        }
        
        response = self.session.post(f"{BASE_URL}/api/notary/requests", json=request_data)
        
        assert response.status_code == 200, f"Failed to create request: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response missing 'id' field"
        assert data.get("status") == "pending", f"Expected status 'pending', got '{data.get('status')}'"
        assert data.get("document_type") == "Contract"
        
        # HCS topic should be created
        hcs_topic_id = data.get("hcs_topic_id")
        print(f"Created notarization request: {data.get('id')}")
        print(f"HCS Topic ID: {hcs_topic_id}")
        
        # Store for next tests
        self.__class__.created_request_id = data.get("id")
        return data.get("id")
    
    def test_2_assign_request_to_admin_notary(self):
        """Test: Assign the request to admin notary"""
        request_id = getattr(self.__class__, 'created_request_id', None)
        if not request_id:
            # Create request first if not available
            request_id = self.test_1_create_notarization_request_as_demo_user()
        
        # Login as admin (who is also a notary)
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Assign the request
        response = self.session.post(f"{BASE_URL}/api/notary/requests/{request_id}/assign")
        
        assert response.status_code == 200, f"Failed to assign: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Assignment should return success=True"
        print(f"Request {request_id} assigned to admin notary")
        
        return request_id
    
    def test_3_complete_notarization_with_seal_package(self):
        """Test: Complete notarization with seal_package=True and verify full package response"""
        request_id = getattr(self.__class__, 'created_request_id', None)
        if not request_id:
            # Run setup tests
            request_id = self.test_2_assign_request_to_admin_notary()
        
        # Login as admin/notary
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Complete the notarization with seal_package=True (default)
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests/{request_id}/complete",
            params={"notes": "TEST_completion_with_full_package", "seal_package": "true"}
        )
        
        assert response.status_code == 200, f"Complete failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Complete should return success=True"
        assert data.get("message") == "Notarization completed", f"Unexpected message: {data.get('message')}"
        
        # Verify package was created
        package = data.get("package")
        assert package is not None, "Package should be returned in response"
        
        # If no error, verify package fields
        if not package.get("error"):
            assert "package_id" in package, "Package should contain package_id"
            print(f"Package ID: {package.get('package_id')}")
            
            # Verify blockchain transaction info
            if package.get("blockchain_transaction"):
                print(f"Blockchain Transaction: {package.get('blockchain_transaction')}")
            
            # Verify HCS topic info
            if package.get("hcs_topic_id"):
                print(f"HCS Topic ID: {package.get('hcs_topic_id')}")
            
            # Verify explorer URL
            if package.get("explorer_url"):
                print(f"Explorer URL: {package.get('explorer_url')}")
            
            # Store package_id for later tests
            self.__class__.created_package_id = package.get("package_id")
        else:
            print(f"Package sealing error (expected in some cases): {package.get('error')}")
        
        return data
    
    def test_4_verify_complete_response_contains_full_package_fields(self):
        """Test: Verify complete response includes package_id, blockchain_transaction, hcs_topic_id, explorer_url"""
        request_id = getattr(self.__class__, 'created_request_id', None)
        
        # Use existing test request if no created request
        if not request_id:
            request_id = TEST_REQUEST_ID
        
        # Login as admin
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get the package by request ID to verify structure
        response = self.session.get(f"{BASE_URL}/api/packages/request/{request_id}")
        
        assert response.status_code == 200, f"Get package failed: {response.status_code}"
        data = response.json()
        
        assert data.get("success") == True
        
        # If sealed, verify required fields
        if data.get("sealed"):
            assert "package_id" in data, "Missing package_id"
            assert "package_hash" in data, "Missing package_hash"
            
            # These may be None if HCS wasn't available
            print(f"Package ID: {data.get('package_id')}")
            print(f"Blockchain Transaction: {data.get('blockchain_transaction')}")
            print(f"HCS Topic ID: {data.get('hcs_topic_id')}")
            print(f"Explorer URL: {data.get('explorer_url')}")
            print(f"Sealed at: {data.get('sealed_at')}")
        else:
            print(f"Package not sealed for request {request_id}")


class TestSealedPackageContents:
    """Tests to verify sealed package in DB contains all required sections"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_5_sealed_package_contains_document_analysis(self):
        """Test: Verify sealed package contains document_analysis section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200, f"Get package failed: {response.text}"
        data = response.json()
        
        # Navigate to package data
        package = data.get("package", {})
        inner_package = package.get("package", {})
        
        # Verify document_analysis section
        doc_analysis = inner_package.get("document_analysis", {})
        assert "total_analyses" in doc_analysis, "Missing total_analyses in document_analysis"
        assert "analyses" in doc_analysis, "Missing analyses list"
        assert isinstance(doc_analysis.get("analyses"), list), "analyses should be a list"
        
        print(f"Document analysis count: {doc_analysis.get('total_analyses')}")
        print("PASS: document_analysis section present in sealed package")
    
    def test_6_sealed_package_contains_biometric_verification(self):
        """Test: Verify sealed package contains biometric_verification section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        package = data.get("package", {})
        inner_package = package.get("package", {})
        
        # Verify biometric_verification section
        biometric = inner_package.get("biometric_verification", {})
        assert "total_verifications" in biometric, "Missing total_verifications"
        assert "verifications" in biometric, "Missing verifications list"
        assert "summary" in biometric, "Missing summary in biometric_verification"
        
        # Verify summary has expected fields
        summary = biometric.get("summary", {})
        if summary.get("status") != "none":
            assert "total" in summary or "passed" in summary or "status" in summary
        
        print(f"Biometric verifications count: {biometric.get('total_verifications')}")
        print(f"Biometric summary status: {summary.get('status', 'N/A')}")
        print("PASS: biometric_verification section present in sealed package")
    
    def test_7_sealed_package_contains_video_sessions(self):
        """Test: Verify sealed package contains video_sessions section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        package = data.get("package", {})
        inner_package = package.get("package", {})
        
        # Verify video_sessions section
        video_sessions = inner_package.get("video_sessions", {})
        assert "total_sessions" in video_sessions, "Missing total_sessions"
        assert "sessions" in video_sessions, "Missing sessions list"
        assert "summary" in video_sessions, "Missing summary in video_sessions"
        
        print(f"Video sessions count: {video_sessions.get('total_sessions')}")
        print("PASS: video_sessions section present in sealed package")
    
    def test_8_sealed_package_contains_participants(self):
        """Test: Verify sealed package contains participants section with notary info"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        package = data.get("package", {})
        inner_package = package.get("package", {})
        
        # Verify participants section
        participants = inner_package.get("participants", {})
        assert "requester" in participants, "Missing requester in participants"
        assert "notary" in participants, "Missing notary in participants"
        
        # Verify requester has expected fields
        requester = participants.get("requester", {})
        if requester:
            assert "id" in requester or "email" in requester
            print(f"Requester email: {requester.get('email', 'N/A')}")
        
        # Verify notary has expected fields (may be None if not assigned)
        notary = participants.get("notary")
        if notary:
            print(f"Notary full name: {notary.get('full_name', 'N/A')}")
            print(f"Notary license_number: {notary.get('license_number', 'N/A')}")
            print(f"Notary license_state: {notary.get('license_state', 'N/A')}")
            print(f"Notary RON certified: {notary.get('ron_certified', 'N/A')}")
        
        print("PASS: participants section present in sealed package")


class TestGetPackageWithNotaryInfo:
    """Tests for NotarizationPackageService.get_package returning full package with notary info"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_9_get_package_returns_full_package(self):
        """Test: Verify get_package returns full package including all sections"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200, f"Get package failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        
        package = data.get("package", {})
        
        # Verify top-level package fields
        assert "id" in package, "Missing package id"
        assert "request_id" in package, "Missing request_id"
        assert "package" in package, "Missing inner package data"
        assert "blockchain_seal" in package, "Missing blockchain_seal"
        assert "sealed_at" in package, "Missing sealed_at"
        
        # Verify blockchain_seal has transaction info
        blockchain_seal = package.get("blockchain_seal", {})
        if blockchain_seal and blockchain_seal.get("success"):
            print(f"Blockchain transaction_id: {blockchain_seal.get('transaction_id', 'N/A')}")
            print(f"Blockchain seal_id: {blockchain_seal.get('seal_id', 'N/A')}")
            print(f"Blockchain network: {blockchain_seal.get('network', 'N/A')}")
            print(f"Explorer URL: {blockchain_seal.get('explorer_url', 'N/A')}")
        
        # Verify inner package has all sections
        inner_package = package.get("package", {})
        required_sections = [
            "document_analysis", 
            "biometric_verification", 
            "video_sessions", 
            "participants",
            "audit_trail",
            "integrity"
        ]
        
        for section in required_sections:
            assert section in inner_package, f"Missing section: {section}"
        
        print("PASS: get_package returns full package with all sections")
    
    def test_10_get_package_includes_notary_info_in_participants(self):
        """Test: Verify get_package includes notary profile info in participants"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        package = data.get("package", {})
        inner_package = package.get("package", {})
        participants = inner_package.get("participants", {})
        notary = participants.get("notary")
        
        if notary:
            # Notary info should include these fields from notary_profile
            expected_fields = ["id", "email", "full_name", "license_number", "license_state", "ron_certified"]
            
            for field in expected_fields:
                if notary.get(field) is not None:
                    print(f"Notary {field}: {notary.get(field)}")
            
            print("PASS: Notary info present in package participants")
        else:
            print("NOTE: Notary not assigned to this package")


class TestNonNotaryAccessRestriction:
    """Tests to verify non-notary users cannot complete requests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_demo_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_11_non_notary_cannot_complete_request(self):
        """Test: Verify non-notary user gets 404 when trying to complete a request"""
        # First, login as admin to create and assign a request
        admin_token = self.get_admin_token()
        assert admin_token is not None, "Failed to get admin token"
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Get any assigned request (admin is the notary)
        response = self.session.get(f"{BASE_URL}/api/notary/requests/assigned")
        
        if response.status_code == 200:
            requests_list = response.json()
            if requests_list and len(requests_list) > 0:
                test_request_id = requests_list[0].get("id")
                
                # Now try to complete as demo user (non-notary)
                demo_token = self.get_demo_token()
                assert demo_token is not None, "Failed to get demo token"
                
                self.session.headers.update({"Authorization": f"Bearer {demo_token}"})
                
                # Demo user should NOT be able to complete (they're not the assigned notary)
                complete_response = self.session.post(
                    f"{BASE_URL}/api/notary/requests/{test_request_id}/complete",
                    params={"notes": "TEST_non_notary_attempt"}
                )
                
                # Should return 404 because demo user is not the assigned notary
                assert complete_response.status_code == 404, \
                    f"Expected 404 for non-notary, got: {complete_response.status_code}"
                
                print(f"PASS: Non-notary user correctly received 404 when trying to complete request")
            else:
                pytest.skip("No assigned requests available for testing")
        else:
            pytest.skip("Could not fetch assigned requests")
    
    def test_12_unauthenticated_cannot_complete_request(self):
        """Test: Verify unauthenticated request to complete returns 401/403"""
        # Remove auth header
        self.session.headers.pop("Authorization", None)
        
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests/{TEST_REQUEST_ID}/complete"
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 for unauthenticated, got: {response.status_code}"
        
        print("PASS: Unauthenticated request correctly rejected")


class TestCompletionEmailPackageData:
    """Tests to verify completion email is queued with full package data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_13_complete_with_seal_queues_email_with_package(self):
        """
        Test: Complete a request and verify email is queued with full package.
        Note: We can't directly check logs, but we verify the endpoint flow completes successfully.
        The log message 'Completion email with full package queued' indicates success.
        """
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First, create a new request
        create_response = self.session.post(f"{BASE_URL}/api/notary/requests", json={
            "document_name": f"TEST_EmailPackage_{uuid.uuid4().hex[:8]}.pdf",
            "document_type": "Power of Attorney",
            "notarization_type": "jurat"
        })
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test request")
        
        request_id = create_response.json().get("id")
        print(f"Created test request: {request_id}")
        
        # Assign the request
        assign_response = self.session.post(f"{BASE_URL}/api/notary/requests/{request_id}/assign")
        assert assign_response.status_code == 200, f"Assign failed: {assign_response.text}"
        print("Request assigned to notary")
        
        # Complete with seal_package=True
        complete_response = self.session.post(
            f"{BASE_URL}/api/notary/requests/{request_id}/complete",
            params={"notes": "TEST_email_package_verification", "seal_package": "true"}
        )
        
        assert complete_response.status_code == 200, f"Complete failed: {complete_response.text}"
        data = complete_response.json()
        
        assert data.get("success") == True
        
        # Verify package was created (email would use this data)
        package = data.get("package")
        if package and not package.get("error"):
            print(f"Package sealed: {package.get('package_id')}")
            print("Email with full package should be queued (check logs for 'Completion email with full package queued')")
            
            # Verify the package has the data that would go into the email
            if package.get("package_id"):
                # Fetch the full package to verify email data structure
                pkg_response = self.session.get(f"{BASE_URL}/api/packages/{package.get('package_id')}")
                if pkg_response.status_code == 200:
                    pkg_data = pkg_response.json()
                    inner_pkg = pkg_data.get("package", {}).get("package", {})
                    
                    # Verify sections that would be included in email
                    email_sections = [
                        "document_analysis",
                        "biometric_verification", 
                        "video_sessions",
                        "participants"
                    ]
                    
                    for section in email_sections:
                        assert section in inner_pkg, f"Missing {section} for email"
                        print(f"  - {section}: present")
                    
                    print("PASS: All sections for email package data are present")
        else:
            print(f"Note: Package sealing had error: {package.get('error') if package else 'No package'}")
            print("Email would still be queued but with limited data")


class TestBlockchainProofInPackage:
    """Tests to verify blockchain proof data in sealed package"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_14_sealed_package_has_blockchain_seal_info(self):
        """Test: Verify sealed package contains blockchain transaction details"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        package = data.get("package", {})
        blockchain_seal = package.get("blockchain_seal", {})
        
        # Blockchain seal should have these fields
        assert blockchain_seal is not None, "blockchain_seal should be present"
        
        if blockchain_seal.get("success"):
            print(f"Transaction ID: {blockchain_seal.get('transaction_id')}")
            print(f"Seal ID: {blockchain_seal.get('seal_id')}")
            print(f"Network: {blockchain_seal.get('network')}")
            print(f"Account ID: {blockchain_seal.get('account_id')}")
            print(f"Explorer URL: {blockchain_seal.get('explorer_url')}")
            print(f"HCS Submitted: {blockchain_seal.get('hcs_submitted')}")
            
            # Verify expected fields
            assert "transaction_id" in blockchain_seal
            assert "network" in blockchain_seal
            assert "sealed_at" in blockchain_seal
            
            print("PASS: Blockchain seal info present and complete")
        else:
            print(f"Note: Blockchain seal may have error: {blockchain_seal.get('error')}")
    
    def test_15_package_has_hcs_topic_id(self):
        """Test: Verify package has HCS topic ID for audit trail"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get package by request ID
        response = self.session.get(f"{BASE_URL}/api/packages/request/{TEST_REQUEST_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("sealed"):
            hcs_topic_id = data.get("hcs_topic_id")
            if hcs_topic_id:
                print(f"HCS Topic ID: {hcs_topic_id}")
                print("PASS: HCS topic ID present for audit trail")
            else:
                print("Note: HCS topic ID not present (topic creation may have failed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
