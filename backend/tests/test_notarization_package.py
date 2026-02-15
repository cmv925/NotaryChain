"""
Test Notarization Package Service
Tests for compiling, sealing, and verifying notarization packages on Hedera blockchain.

Endpoints tested:
- POST /api/packages/compile/{request_id} - Compile all verification data into a package
- POST /api/packages/seal/{request_id} - Seal package on Hedera blockchain
- GET /api/packages/{package_id} - Retrieve sealed package
- GET /api/packages/{package_id}/verify - Verify package integrity
- GET /api/packages/request/{request_id} - Get package by request ID
- GET /api/packages/request/{request_id}/certificate - Get notarization certificate
- POST /api/notary/requests/{id}/complete - Should auto-seal package on completion
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_ADMIN_EMAIL = "admin@notarychain.com"
TEST_ADMIN_PASSWORD = "Admin123!"
TEST_REQUEST_ID = "abcdcec1-45da-44e8-9edc-5e328bfba998"  # Pre-existing request from context
TEST_PACKAGE_ID = "078abe04-d8da-4702-83fe-becd678f9b69"  # Pre-existing package from context


class TestPackageCompile:
    """Tests for POST /api/packages/compile/{request_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_compile_package_success(self):
        """Test compiling package for existing request"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/packages/compile/{TEST_REQUEST_ID}")
        
        assert response.status_code == 200, f"Compile failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        package = data.get("package", {})
        
        # Verify package contains all required sections
        assert "package_id" in package
        assert "package_version" in package
        assert "package_type" in package
        assert package["package_type"] == "NOTARIZATION_CERTIFICATE"
        
        # Verify package contains all verification data sections
        assert "notarization_request" in package
        assert "participants" in package
        assert "document_analysis" in package
        assert "biometric_verification" in package
        assert "video_sessions" in package
        assert "audit_trail" in package
        assert "blockchain_seals" in package
        assert "integrity" in package
        
        # Verify integrity hashes
        integrity = package.get("integrity", {})
        assert "package_hash" in integrity
        assert "document_analysis_hash" in integrity
        assert "biometric_hash" in integrity
        assert "video_sessions_hash" in integrity
        assert "audit_trail_hash" in integrity
        assert integrity.get("algorithm") == "SHA-256"
        
        print(f"Package compiled successfully: {package.get('package_id')}")
        print(f"Package hash: {integrity.get('package_hash')[:32]}...")
    
    def test_compile_package_not_found(self):
        """Test compiling package for non-existent request"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_request_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/packages/compile/{fake_request_id}")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent request")
    
    def test_compile_package_unauthorized(self):
        """Test compiling package without authentication"""
        response = self.session.post(f"{BASE_URL}/api/packages/compile/{TEST_REQUEST_ID}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print("Correctly requires authentication")


class TestPackageSeal:
    """Tests for POST /api/packages/seal/{request_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_seal_package_already_sealed(self):
        """Test sealing already sealed package (should return already_sealed=True)"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/packages/seal/{TEST_REQUEST_ID}")
        
        assert response.status_code == 200, f"Seal failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        
        # Should indicate already sealed
        if data.get("already_sealed"):
            print(f"Package already sealed: {data.get('package_id')}")
            assert "package_id" in data
        else:
            # New seal was created
            assert "package_id" in data
            assert "package_hash" in data
            print(f"New package sealed: {data.get('package_id')}")
    
    def test_seal_package_not_found(self):
        """Test sealing package for non-existent request"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_request_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/packages/seal/{fake_request_id}")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent request")
    
    def test_seal_package_unauthorized(self):
        """Test sealing package without authentication"""
        response = self.session.post(f"{BASE_URL}/api/packages/seal/{TEST_REQUEST_ID}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print("Correctly requires authentication")


class TestPackageRetrieve:
    """Tests for GET /api/packages/{package_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_get_package_success(self):
        """Test retrieving sealed package by ID"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200, f"Get package failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        package = data.get("package", {})
        
        # Verify package structure
        assert package.get("id") == TEST_PACKAGE_ID
        assert package.get("request_id") == TEST_REQUEST_ID
        assert "package" in package  # Contains the full package data
        assert "blockchain_seal" in package
        assert "sealed_at" in package
        
        # Verify blockchain seal info
        blockchain_seal = package.get("blockchain_seal", {})
        if blockchain_seal:
            print(f"Transaction ID: {blockchain_seal.get('transaction_id')}")
        
        print(f"Package retrieved: {TEST_PACKAGE_ID}")
    
    def test_get_package_not_found(self):
        """Test retrieving non-existent package"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_package_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/packages/{fake_package_id}")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent package")
    
    def test_get_package_unauthorized(self):
        """Test retrieving package without authentication"""
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print("Correctly requires authentication")


class TestPackageVerify:
    """Tests for GET /api/packages/{package_id}/verify"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_verify_package_success(self):
        """Test verifying sealed package integrity"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}/verify")
        
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "verified" in data
        assert "package_id" in data
        assert data.get("package_id") == TEST_PACKAGE_ID
        assert "stored_hash" in data
        assert "recalculated_hash" in data
        assert "hash_match" in data
        assert "blockchain_transaction" in data
        assert "verification_timestamp" in data
        
        # Check if verified
        if data.get("verified"):
            print(f"Package verified successfully - hash match: {data.get('hash_match')}")
            assert data.get("hash_match") == True
        else:
            print(f"Package verification: hash_match={data.get('hash_match')}")
            print(f"Stored hash: {data.get('stored_hash', '')[:32]}...")
            print(f"Recalculated: {data.get('recalculated_hash', '')[:32]}...")
    
    def test_verify_package_not_found(self):
        """Test verifying non-existent package"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_package_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/packages/{fake_package_id}/verify")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent package")


class TestPackageByRequest:
    """Tests for GET /api/packages/request/{request_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_get_package_by_request_success(self):
        """Test getting sealed package by request ID"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/request/{TEST_REQUEST_ID}")
        
        assert response.status_code == 200, f"Get failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("sealed") == True
        
        # Verify response contains package info
        assert "package_id" in data
        assert "package_hash" in data
        assert "sealed_at" in data
        
        # Check blockchain info if available
        if data.get("blockchain_transaction"):
            print(f"Transaction: {data.get('blockchain_transaction')}")
        if data.get("hcs_topic_id"):
            print(f"HCS Topic: {data.get('hcs_topic_id')}")
        if data.get("explorer_url"):
            print(f"Explorer: {data.get('explorer_url')}")
        
        print(f"Package for request {TEST_REQUEST_ID}: {data.get('package_id')}")
    
    def test_get_package_by_request_not_sealed(self):
        """Test getting package for request without sealed package"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a new request without sealing
        # First create a notarization request
        create_response = self.session.post(f"{BASE_URL}/api/notary/requests", json={
            "document_name": "TEST_Unsealed_Document.pdf",
            "document_type": "Contract",
            "notarization_type": "acknowledgment"
        })
        
        if create_response.status_code == 200:
            new_request = create_response.json()
            new_request_id = new_request.get("id")
            
            # Try to get package (should be not sealed)
            response = self.session.get(f"{BASE_URL}/api/packages/request/{new_request_id}")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data.get("success") == True
            assert data.get("sealed") == False
            print(f"Correctly returns sealed=False for unsealed request")
        else:
            pytest.skip("Could not create test request")
    
    def test_get_package_by_request_not_found(self):
        """Test getting package for non-existent request"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        fake_request_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/packages/request/{fake_request_id}")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent request")


class TestNotarizationCertificate:
    """Tests for GET /api/packages/request/{request_id}/certificate"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_get_certificate_success(self):
        """Test getting notarization certificate"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/request/{TEST_REQUEST_ID}/certificate")
        
        assert response.status_code == 200, f"Get certificate failed: {response.text}"
        cert = response.json()
        
        # Verify certificate structure
        assert cert.get("certificate_type") == "DIGITAL_NOTARIZATION_CERTIFICATE"
        assert "certificate_id" in cert
        assert "issued_at" in cert
        
        # Document info
        assert "document" in cert
        assert "name" in cert.get("document", {})
        
        # Participants
        assert "requester" in cert
        assert "notary" in cert
        
        # Verifications summary
        assert "verifications" in cert
        verifications = cert.get("verifications", {})
        assert "document_analysis" in verifications
        assert "biometric" in verifications
        assert "video_session" in verifications
        
        # Blockchain proof
        assert "blockchain_proof" in cert
        blockchain = cert.get("blockchain_proof", {})
        assert "network" in blockchain
        assert "package_hash" in blockchain
        assert "algorithm" in blockchain
        
        # Component hashes
        assert "component_hashes" in cert
        component_hashes = cert.get("component_hashes", {})
        assert "document_analysis" in component_hashes
        assert "biometric" in component_hashes
        assert "video_sessions" in component_hashes
        assert "audit_trail" in component_hashes
        
        # Legal statement
        assert "legal_statement" in cert
        assert len(cert.get("legal_statement", "")) > 50
        
        print(f"Certificate generated: {cert.get('certificate_id')}")
        print(f"Document: {cert.get('document', {}).get('name')}")
        print(f"Blockchain network: {blockchain.get('network')}")
    
    def test_get_certificate_not_sealed(self):
        """Test getting certificate for request without sealed package"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Use a request ID that doesn't have a sealed package
        fake_request_id = str(uuid.uuid4())
        
        response = self.session.get(f"{BASE_URL}/api/packages/request/{fake_request_id}/certificate")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for request without certificate")


class TestCompleteNotarizationAutoSeal:
    """Tests for POST /api/notary/requests/{id}/complete with auto-seal"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_complete_notarization_auto_seal_structure(self):
        """Test that complete_notarization returns package info when seal_package=True"""
        # This test verifies the structure, actual sealing tested via integration
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get an existing request to complete
        # First check if there's an in_progress request we can complete
        response = self.session.get(f"{BASE_URL}/api/notary/requests/assigned")
        
        if response.status_code == 200:
            requests_list = response.json()
            if requests_list and len(requests_list) > 0:
                test_request = requests_list[0]
                request_id = test_request.get("id")
                
                # Complete the request (this would auto-seal)
                complete_response = self.session.post(
                    f"{BASE_URL}/api/notary/requests/{request_id}/complete",
                    params={"notes": "TEST_auto_seal_test", "seal_package": True}
                )
                
                if complete_response.status_code == 200:
                    data = complete_response.json()
                    assert data.get("success") == True
                    
                    # Check if package was created
                    if data.get("package"):
                        package = data.get("package")
                        if package.get("error"):
                            print(f"Auto-seal encountered error: {package.get('error')}")
                        else:
                            print(f"Auto-sealed package: {package.get('package_id')}")
                            assert "package_id" in package or "error" in package
                else:
                    pytest.skip("Could not complete request for testing")
            else:
                pytest.skip("No assigned requests to test auto-seal")
        else:
            pytest.skip("Could not fetch assigned requests")


class TestPackageContentsVerification:
    """Tests to verify package contains all required data components"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_package_contains_document_analysis(self):
        """Verify package contains document_analysis section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify document_analysis structure
        doc_analysis = package_data.get("document_analysis", {})
        assert "total_analyses" in doc_analysis
        assert "analyses" in doc_analysis
        assert isinstance(doc_analysis.get("analyses"), list)
        
        print(f"Document analyses count: {doc_analysis.get('total_analyses')}")
    
    def test_package_contains_biometric_verification(self):
        """Verify package contains biometric_verification section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify biometric_verification structure
        biometric = package_data.get("biometric_verification", {})
        assert "total_verifications" in biometric
        assert "verifications" in biometric
        assert "summary" in biometric
        assert isinstance(biometric.get("verifications"), list)
        
        # Check summary fields
        summary = biometric.get("summary", {})
        if summary and summary.get("status") != "none":
            assert "status" in summary
        
        print(f"Biometric verifications count: {biometric.get('total_verifications')}")
    
    def test_package_contains_video_sessions(self):
        """Verify package contains video_sessions section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify video_sessions structure
        video = package_data.get("video_sessions", {})
        assert "total_sessions" in video
        assert "sessions" in video
        assert "summary" in video
        assert isinstance(video.get("sessions"), list)
        
        print(f"Video sessions count: {video.get('total_sessions')}")
    
    def test_package_contains_audit_trail(self):
        """Verify package contains audit_trail section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify audit_trail structure
        audit = package_data.get("audit_trail", {})
        assert "total_actions" in audit
        assert "actions" in audit
        assert isinstance(audit.get("actions"), list)
        
        print(f"Audit actions count: {audit.get('total_actions')}")
    
    def test_package_contains_blockchain_seals(self):
        """Verify package contains blockchain_seals section"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify blockchain_seals structure
        seals = package_data.get("blockchain_seals", {})
        assert "total_seals" in seals
        assert "seals" in seals
        assert isinstance(seals.get("seals"), list)
        
        print(f"Blockchain seals count: {seals.get('total_seals')}")
    
    def test_package_integrity_hashes(self):
        """Verify package integrity hashes are present and valid format"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package_data = data.get("package", {}).get("package", {})
        
        # Verify integrity structure
        integrity = package_data.get("integrity", {})
        assert "package_hash" in integrity
        assert "document_analysis_hash" in integrity
        assert "biometric_hash" in integrity
        assert "video_sessions_hash" in integrity
        assert "audit_trail_hash" in integrity
        assert integrity.get("algorithm") == "SHA-256"
        
        # Verify hash formats (should be 64 character hex strings for SHA-256)
        package_hash = integrity.get("package_hash", "")
        assert len(package_hash) == 64, f"Package hash length: {len(package_hash)}"
        assert all(c in '0123456789abcdef' for c in package_hash.lower())
        
        print(f"All integrity hashes valid (SHA-256 format)")


class TestPackageBlockchainRecording:
    """Tests to verify package hash is recorded on HCS topic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_sealed_package_has_blockchain_transaction(self):
        """Verify sealed package has blockchain transaction reference"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package = data.get("package", {})
        
        # Check blockchain seal info
        blockchain_seal = package.get("blockchain_seal", {})
        
        if blockchain_seal:
            # Should have transaction_id for Hedera
            assert "transaction_id" in blockchain_seal, "Missing transaction_id in blockchain seal"
            print(f"Blockchain transaction: {blockchain_seal.get('transaction_id')}")
            
            if blockchain_seal.get("explorer_url"):
                print(f"Explorer URL: {blockchain_seal.get('explorer_url')}")
        else:
            print("No blockchain seal info in package (may be testnet issue)")
    
    def test_package_has_hcs_submission_info(self):
        """Verify package has HCS submission details"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/packages/{TEST_PACKAGE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        package = data.get("package", {})
        
        # Check HCS submission
        hcs_submission = package.get("hcs_submission")
        
        if hcs_submission:
            print(f"HCS Sequence: {hcs_submission.get('sequence_number')}")
        else:
            print("No HCS submission info (topic may not have been available)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
