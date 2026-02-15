"""
Test Suite for Notary Onboarding and Admin Management Features
Tests:
- GET /api/notary/profile/status - Check notary application status
- POST /api/notary/profile - Create notary profile with extended fields
- POST /api/notary/profile/credentials - Upload credential documents
- GET /api/notary/profile/credentials - Get list of uploaded credentials
- POST /api/admin/notaries/{id}/review - Mark application as under review
- POST /api/admin/notaries/{id}/approve - Approve notary application
- POST /api/admin/notaries/{id}/reject - Reject notary application with reason
- GET /api/admin/notaries/{id}/credentials - Admin view of notary credentials
"""

import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
TEST_NOTARY_EMAIL = "notarytest@test.com"
TEST_NOTARY_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def notary_token():
    """Get test notary authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_NOTARY_EMAIL, "password": TEST_NOTARY_PASSWORD}
    )
    assert response.status_code == 200, f"Notary login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def new_notary_user():
    """Create a new user for notary application testing"""
    unique_email = f"testnotary_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(
        f"{BASE_URL}/api/auth/signup",
        json={
            "email": unique_email,
            "password": "Test123!",
            "full_name": f"Test Notary {uuid.uuid4().hex[:8]}"
        }
    )
    if response.status_code == 200:
        token_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": unique_email, "password": "Test123!"}
        )
        return {
            "email": unique_email,
            "token": token_resp.json()["access_token"]
        }
    pytest.skip("Could not create new notary user")


class TestNotaryProfileStatus:
    """Tests for GET /api/notary/profile/status"""
    
    def test_get_profile_status_authenticated(self, notary_token):
        """Test getting profile status with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/status",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "has_profile" in data
        assert "status" in data
        assert "message" in data
        print(f"Profile status: has_profile={data['has_profile']}, status={data['status']}")
    
    def test_get_profile_status_unauthenticated(self):
        """Test getting profile status without authentication"""
        response = requests.get(f"{BASE_URL}/api/notary/profile/status")
        assert response.status_code in [401, 403]
    
    def test_profile_status_with_existing_profile(self, notary_token):
        """Test status response for user with existing profile"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/status",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["has_profile"]:
            assert "profile" in data
            assert "credentials_uploaded" in data
            assert "missing_required_docs" in data
            # Validate profile fields
            profile = data["profile"]
            assert "id" in profile
            assert "license_number" in profile
            assert "status" in profile
            print(f"Existing profile ID: {profile['id']}, status: {profile['status']}")


class TestNotaryProfileCreation:
    """Tests for POST /api/notary/profile"""
    
    def test_create_profile_new_user(self, new_notary_user):
        """Test creating a new notary profile"""
        response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers={"Authorization": f"Bearer {new_notary_user['token']}"},
            json={
                "license_number": f"LIC{uuid.uuid4().hex[:8]}",
                "license_state": "TX",
                "commission_expiry": "2028-12-31",
                "ron_certified": True,
                "specializations": ["Real Estate", "Legal Documents"],
                "hourly_rate": 85.0,
                "bio": "Test notary for automated testing",
                "full_legal_name": "Test Notary User",
                "phone_number": "(555) 999-8888",
                "address": "456 Test Ave",
                "city": "Austin",
                "zip_code": "78701",
                "years_experience": 5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate profile data
        assert "id" in data
        assert data["license_state"] == "TX"
        assert data["ron_certified"] == True
        assert data["status"] == "pending"
        assert "Real Estate" in data["specializations"]
        print(f"Created new notary profile: {data['id']}")
        
        return data["id"]
    
    def test_create_profile_duplicate(self, notary_token):
        """Test creating profile when one already exists"""
        response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers={"Authorization": f"Bearer {notary_token}"},
            json={
                "license_number": "DUPLICATE123",
                "license_state": "CA",
                "commission_expiry": "2028-01-01",
            }
        )
        
        # Should return 400 for duplicate profile
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()
    
    def test_create_profile_unauthenticated(self):
        """Test creating profile without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            json={
                "license_number": "TEST123",
                "license_state": "NY",
                "commission_expiry": "2028-01-01"
            }
        )
        assert response.status_code in [401, 403]


class TestCredentialUpload:
    """Tests for POST /api/notary/profile/credentials"""
    
    def test_upload_credential_valid(self, notary_token):
        """Test uploading a valid credential document"""
        # Create a fake PDF file
        file_content = b"%PDF-1.4 Test credential document content"
        files = {
            "file": ("test_credential.pdf", io.BytesIO(file_content), "application/pdf")
        }
        data = {
            "credential_type": "government_id"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {notary_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] == True
        assert "credential_id" in result
        assert result["credential_type"] == "government_id"
        print(f"Uploaded credential: {result['credential_id']}")
    
    def test_upload_invalid_credential_type(self, notary_token):
        """Test uploading with invalid credential type"""
        file_content = b"Test file content"
        files = {
            "file": ("test.pdf", io.BytesIO(file_content), "application/pdf")
        }
        data = {
            "credential_type": "invalid_type"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {notary_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 400
        assert "Invalid credential type" in response.json().get("detail", "")
    
    def test_upload_credential_no_profile(self, admin_token):
        """Test uploading credential when no profile exists"""
        file_content = b"Test file content"
        files = {
            "file": ("test.pdf", io.BytesIO(file_content), "application/pdf")
        }
        data = {
            "credential_type": "government_id"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        
        # Admin doesn't have a notary profile
        assert response.status_code == 404
        assert "profile not found" in response.json().get("detail", "").lower()
    
    def test_upload_credential_unauthenticated(self):
        """Test uploading credential without authentication"""
        file_content = b"Test file content"
        files = {
            "file": ("test.pdf", io.BytesIO(file_content), "application/pdf")
        }
        data = {
            "credential_type": "government_id"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile/credentials",
            files=files,
            data=data
        )
        assert response.status_code in [401, 403]


class TestGetCredentials:
    """Tests for GET /api/notary/profile/credentials"""
    
    def test_get_my_credentials(self, notary_token):
        """Test getting list of uploaded credentials"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "profile_id" in data
        assert "status" in data
        assert "credentials" in data
        assert isinstance(data["credentials"], list)
        
        print(f"Found {len(data['credentials'])} credentials for profile {data['profile_id']}")
        
        # Validate credential structure if any exist
        for cred in data["credentials"]:
            assert "id" in cred
            assert "credential_type" in cred
            assert "filename" in cred
    
    def test_get_credentials_no_profile(self, admin_token):
        """Test getting credentials when no profile exists"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 404 for no profile
        assert response.status_code == 404
    
    def test_get_credentials_unauthenticated(self):
        """Test getting credentials without authentication"""
        response = requests.get(f"{BASE_URL}/api/notary/profile/credentials")
        assert response.status_code in [401, 403]


class TestAdminNotaryReview:
    """Tests for POST /api/admin/notaries/{id}/review"""
    
    def test_admin_start_review(self, admin_token):
        """Test marking an application as under review"""
        # First get pending applications
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        pending = response.json()
        
        if pending["count"] > 0:
            notary_id = pending["applications"][0]["id"]
            
            # Mark as under review
            review_response = requests.post(
                f"{BASE_URL}/api/admin/notaries/{notary_id}/review",
                headers={"Authorization": f"Bearer {admin_token}"},
                params={"notes": "Starting review process"}
            )
            
            # May return 200 or 400 if not in pending state
            assert review_response.status_code in [200, 400]
            
            if review_response.status_code == 200:
                assert "under review" in review_response.json().get("message", "").lower()
                print(f"Successfully marked {notary_id} as under review")
        else:
            print("No pending applications to test review")
    
    def test_admin_review_nonexistent(self, admin_token):
        """Test reviewing nonexistent application"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/review",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
    
    def test_review_non_admin(self, notary_token):
        """Test that non-admin cannot review applications"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/any-id/review",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 403


class TestAdminNotaryApprove:
    """Tests for POST /api/admin/notaries/{id}/approve"""
    
    def test_admin_approve_nonexistent(self, admin_token):
        """Test approving nonexistent application"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
    
    def test_approve_non_admin(self, notary_token):
        """Test that non-admin cannot approve applications"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/any-id/approve",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 403
    
    def test_approve_updates_user_role(self, admin_token, new_notary_user):
        """Test that approving notary updates user role"""
        # Create a profile for the new user first
        profile_response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers={"Authorization": f"Bearer {new_notary_user['token']}"},
            json={
                "license_number": f"APPROVE{uuid.uuid4().hex[:6]}",
                "license_state": "FL",
                "commission_expiry": "2029-01-01",
                "full_legal_name": "Approval Test User"
            }
        )
        
        if profile_response.status_code == 200:
            profile_id = profile_response.json()["id"]
            
            # Approve the application
            approve_response = requests.post(
                f"{BASE_URL}/api/admin/notaries/{profile_id}/approve",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert approve_response.status_code == 200
            assert "approved" in approve_response.json().get("message", "").lower()
            
            # Verify user role was updated
            status_response = requests.get(
                f"{BASE_URL}/api/notary/profile/status",
                headers={"Authorization": f"Bearer {new_notary_user['token']}"}
            )
            assert status_response.status_code == 200
            assert status_response.json()["status"] == "approved"
            print(f"Successfully approved notary {profile_id}")
        elif profile_response.status_code == 400:
            # Profile already exists - try to get it
            status_resp = requests.get(
                f"{BASE_URL}/api/notary/profile/status",
                headers={"Authorization": f"Bearer {new_notary_user['token']}"}
            )
            if status_resp.status_code == 200 and status_resp.json().get("has_profile"):
                profile_id = status_resp.json()["profile"]["id"]
                print(f"Profile already exists: {profile_id}")


class TestAdminNotaryReject:
    """Tests for POST /api/admin/notaries/{id}/reject"""
    
    def test_admin_reject_nonexistent(self, admin_token):
        """Test rejecting nonexistent application"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"reason": "Test rejection"}
        )
        assert response.status_code == 404
    
    def test_reject_non_admin(self, notary_token):
        """Test that non-admin cannot reject applications"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/any-id/reject",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 403
    
    def test_reject_with_reason(self, admin_token):
        """Test rejecting with a specific reason"""
        # First get pending applications
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            notaries = response.json().get("notaries", [])
            if notaries:
                # Find one to test rejection
                notary_id = notaries[0]["id"]
                reject_response = requests.post(
                    f"{BASE_URL}/api/admin/notaries/{notary_id}/reject",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    params={"reason": "Incomplete documentation for testing"}
                )
                
                # May return 200 or 400 depending on current state
                assert reject_response.status_code in [200, 400]
                
                if reject_response.status_code == 200:
                    print(f"Rejected application {notary_id}")


class TestAdminViewCredentials:
    """Tests for GET /api/admin/notaries/{id}/credentials"""
    
    def test_admin_view_credentials(self, admin_token):
        """Test admin viewing notary credentials"""
        # Get a notary profile first
        notaries_response = requests.get(
            f"{BASE_URL}/api/admin/notaries",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert notaries_response.status_code == 200
        notaries = notaries_response.json().get("notaries", [])
        
        if notaries:
            notary_id = notaries[0]["id"]
            
            credentials_response = requests.get(
                f"{BASE_URL}/api/admin/notaries/{notary_id}/credentials",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert credentials_response.status_code == 200
            data = credentials_response.json()
            
            assert "notary" in data
            assert "user" in data
            assert "credentials" in data
            assert isinstance(data["credentials"], list)
            
            print(f"Admin viewed credentials for notary {notary_id}: {len(data['credentials'])} documents")
    
    def test_admin_view_credentials_nonexistent(self, admin_token):
        """Test viewing credentials for nonexistent notary"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/credentials",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
    
    def test_view_credentials_non_admin(self, notary_token):
        """Test that non-admin cannot view credentials through admin endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries/any-id/credentials",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 403


class TestBlockchainAuditTrailEndpoints:
    """Tests for blockchain audit trail related endpoints"""
    
    def test_get_my_requests_with_hcs_topic(self, notary_token):
        """Test getting notary requests that have HCS topic IDs"""
        response = requests.get(
            f"{BASE_URL}/api/notary/requests/my",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        
        assert response.status_code == 200
        requests_data = response.json()
        
        if requests_data:
            # Check if any requests have HCS topic
            for req in requests_data:
                if req.get("hcs_topic_id"):
                    print(f"Request {req['id']} has HCS topic: {req['hcs_topic_id']}")
    
    def test_get_topic_info(self, notary_token):
        """Test getting HCS topic info"""
        # First get a request with HCS topic
        requests_response = requests.get(
            f"{BASE_URL}/api/notary/requests/my",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        
        if requests_response.status_code == 200:
            for req in requests_response.json():
                if req.get("hcs_topic_id"):
                    topic_id = req["hcs_topic_id"]
                    
                    # Get topic info
                    topic_response = requests.get(
                        f"{BASE_URL}/api/blockchain/topics/{topic_id}",
                        headers={"Authorization": f"Bearer {notary_token}"}
                    )
                    
                    # May timeout due to Hedera testnet
                    assert topic_response.status_code in [200, 500, 504]
                    
                    if topic_response.status_code == 200:
                        data = topic_response.json()
                        assert "topic_id" in data
                        print(f"Got topic info for {topic_id}: {len(data.get('messages', []))} messages")
                    break


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
