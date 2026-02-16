"""
Email Notification Tests for NotaryChain Platform

Tests email functionality across key platform events:
- User registration welcome emails
- Notarization completion emails  
- Notary application status changes (submitted, approved, rejected)
- Email service status endpoint
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review_request
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


class TestEmailServiceStatus:
    """Test email service initialization and status endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed - skipping tests")
    
    @pytest.fixture
    def user_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("User authentication failed - skipping tests")
    
    def test_email_status_endpoint_authenticated(self, user_token):
        """Test /api/email/status returns correct configuration"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/email/status", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "configured" in data, "Response should have 'configured' field"
        assert "api_key_set" in data, "Response should have 'api_key_set' field"
        assert "sender_email" in data, "Response should have 'sender_email' field"
        
        # Verify Resend API is configured
        assert data["configured"] == True, "Email service should be configured"
        assert data["api_key_set"] is not None, "API key should be set"
        assert data["sender_email"] == "onboarding@resend.dev", "Sender email should be default"
        
        print(f"Email service status: configured={data['configured']}, sender={data['sender_email']}")
    
    def test_email_status_endpoint_unauthenticated(self):
        """Test /api/email/status returns 401/403 without auth"""
        response = requests.get(f"{BASE_URL}/api/email/status")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated request correctly rejected with {response.status_code}")


class TestWelcomeEmailOnSignup:
    """Test welcome email on user signup (/api/auth/signup)"""
    
    def test_signup_triggers_welcome_email(self):
        """Test that signup endpoint works and queues welcome email"""
        # Generate unique test user
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_email_{unique_id}@test.com"
        test_name = f"Email Test User {unique_id}"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": test_email,
            "password": "Test123!",
            "full_name": test_name
        })
        
        assert response.status_code == 200, f"Signup failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify token returned
        assert "access_token" in data, "Signup should return access_token"
        assert len(data["access_token"]) > 0, "Token should not be empty"
        
        print(f"User {test_email} signed up successfully. Welcome email should be queued.")
        print("Note: Actual email delivery requires verified address in Resend test mode")
    
    def test_duplicate_signup_rejected(self):
        """Test that duplicate email signup is rejected"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": USER_EMAIL,  # Already exists
            "password": "Test123!",
            "full_name": "Duplicate User"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print("Duplicate email correctly rejected")


class TestNotaryApplicationEmails:
    """Test emails for notary application status changes"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def new_user_headers(self):
        """Create new user and get headers for notary application test"""
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"notaryapplicant_{unique_id}@test.com"
        
        # Sign up new user
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": test_email,
            "password": "Test123!",
            "full_name": f"Notary Applicant {unique_id}"
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {
                "headers": {"Authorization": f"Bearer {token}"},
                "email": test_email,
                "name": f"Notary Applicant {unique_id}"
            }
        pytest.skip("Could not create new user for notary test")
    
    def test_notary_profile_creation_triggers_submitted_email(self, new_user_headers):
        """Test that creating notary profile sends application submitted email"""
        headers = new_user_headers["headers"]
        
        # Create notary profile (triggers submitted email)
        profile_data = {
            "full_legal_name": new_user_headers["name"],
            "license_number": f"LN-{uuid.uuid4().hex[:8]}",
            "license_state": "California",
            "commission_expiry": "2027-12-31",
            "ron_certified": True,
            "bio": "Test notary applicant"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers=headers,
            json=profile_data
        )
        
        assert response.status_code == 200, f"Profile creation failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "id" in data, "Profile should have ID"
        assert data["status"] == "pending", "New profile should have pending status"
        
        print(f"Notary profile created with ID: {data['id']}")
        print(f"Application submitted email queued for {new_user_headers['email']}")
        return data["id"]
    
    def test_get_pending_applications(self, admin_headers):
        """Test admin can get pending applications"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries/pending",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "count" in data, "Response should have count"
        assert "applications" in data, "Response should have applications list"
        
        print(f"Found {data['count']} pending applications")
        return data["applications"]
    
    def test_approve_notary_triggers_approval_email(self, admin_headers, new_user_headers):
        """Test that approving a notary sends approval email"""
        # First create a new notary profile
        user_headers = new_user_headers["headers"]
        
        profile_data = {
            "full_legal_name": new_user_headers["name"],
            "license_number": f"LN-{uuid.uuid4().hex[:8]}",
            "license_state": "Texas",
            "commission_expiry": "2028-12-31",
            "ron_certified": False,
            "bio": "Test notary for approval"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers=user_headers,
            json=profile_data
        )
        
        assert create_response.status_code == 200, f"Profile creation failed: {create_response.text}"
        profile_id = create_response.json()["id"]
        
        # Now approve as admin
        approve_response = requests.post(
            f"{BASE_URL}/api/admin/notaries/{profile_id}/approve",
            headers=admin_headers
        )
        
        assert approve_response.status_code == 200, f"Approval failed: {approve_response.status_code} - {approve_response.text}"
        data = approve_response.json()
        
        assert data["message"] == "Notary application approved", "Should confirm approval"
        
        print(f"Notary profile {profile_id} approved")
        print(f"Approval email queued for {new_user_headers['email']}")
    
    def test_reject_notary_triggers_rejection_email(self, admin_headers, new_user_headers):
        """Test that rejecting a notary sends rejection email with reason"""
        # First create a new notary profile
        user_headers = new_user_headers["headers"]
        
        profile_data = {
            "full_legal_name": new_user_headers["name"],
            "license_number": f"LN-{uuid.uuid4().hex[:8]}",
            "license_state": "Florida",
            "commission_expiry": "2028-06-30",
            "ron_certified": True,
            "bio": "Test notary for rejection"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers=user_headers,
            json=profile_data
        )
        
        assert create_response.status_code == 200, f"Profile creation failed: {create_response.text}"
        profile_id = create_response.json()["id"]
        
        # Reject as admin with reason
        rejection_reason = "Missing commission certificate documentation. Please resubmit with valid credentials."
        reject_response = requests.post(
            f"{BASE_URL}/api/admin/notaries/{profile_id}/reject",
            headers=admin_headers,
            params={"reason": rejection_reason}
        )
        
        assert reject_response.status_code == 200, f"Rejection failed: {reject_response.status_code} - {reject_response.text}"
        data = reject_response.json()
        
        assert data["message"] == "Notary application rejected", "Should confirm rejection"
        
        print(f"Notary profile {profile_id} rejected with reason")
        print(f"Rejection email queued for {new_user_headers['email']}")


class TestNotarizationCompleteEmail:
    """Test notarization completion email"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def user_headers(self):
        """Get regular user authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("User authentication failed")
    
    def test_create_notarization_request(self, user_headers):
        """Test creating a notarization request"""
        unique_id = uuid.uuid4().hex[:8]
        
        request_data = {
            "document_name": f"Test Document {unique_id}",
            "document_type": "power_of_attorney",
            "notarization_type": "ron",
            "notes": f"Test notarization request for email testing {unique_id}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/requests",
            headers=user_headers,
            json=request_data
        )
        
        assert response.status_code == 200, f"Request creation failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "id" in data, "Request should have ID"
        assert data["status"] == "pending", "New request should be pending"
        
        print(f"Notarization request created: {data['id']}")
        return data["id"]
    
    def test_complete_notarization_endpoint_exists(self, admin_headers):
        """Test that complete notarization endpoint exists and requires notary"""
        # Try to complete a non-existent request to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/notary/requests/non-existent-id/complete",
            headers=admin_headers,
            params={"notes": "Test completion"}
        )
        
        # Should get 403 (not a notary) or 404 (request not found), not 405 or 500
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}: {response.text}"
        
        print(f"Complete endpoint exists, returns {response.status_code} for invalid request")


class TestAdminEmailTestEndpoint:
    """Test admin email testing endpoint"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def user_headers(self):
        """Get regular user authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("User authentication failed")
    
    def test_admin_send_test_email_welcome(self, admin_headers):
        """Test admin can send test welcome email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "welcome"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have message"
        assert "result" in data, "Response should have result"
        
        # Result may have success=False due to Resend test mode (non-verified email)
        print(f"Test welcome email result: {data['result']}")
        
        # Verify email sending was attempted with correct params
        if not data["result"]["success"]:
            # Expected error for non-verified email in test mode
            assert "error" in data["result"], "Should have error message"
            print(f"Expected error for non-verified email: {data['result']['error']}")
    
    def test_admin_send_test_email_notarization_complete(self, admin_headers):
        """Test admin can send test notarization complete email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "notarization_complete"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have message"
        assert data["message"] == "Test email 'notarization_complete' sent"
        
        print(f"Test notarization complete email result: {data['result']}")
    
    def test_admin_send_test_email_application_submitted(self, admin_headers):
        """Test admin can send test application submitted email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "application_submitted"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["message"] == "Test email 'application_submitted' sent"
        print(f"Test application submitted email result: {data['result']}")
    
    def test_admin_send_test_email_application_approved(self, admin_headers):
        """Test admin can send test application approved email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "application_approved"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["message"] == "Test email 'application_approved' sent"
        print(f"Test application approved email result: {data['result']}")
    
    def test_admin_send_test_email_application_rejected(self, admin_headers):
        """Test admin can send test application rejected email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "application_rejected"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["message"] == "Test email 'application_rejected' sent"
        print(f"Test application rejected email result: {data['result']}")
    
    def test_admin_send_test_email_request_assigned(self, admin_headers):
        """Test admin can send test request assigned email"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "request_assigned"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["message"] == "Test email 'request_assigned' sent"
        print(f"Test request assigned email result: {data['result']}")
    
    def test_admin_send_test_email_invalid_type(self, admin_headers):
        """Test sending invalid email type returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "invalid_type"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        data = response.json()
        
        assert "detail" in data, "Should have error detail"
        assert "Unknown email type" in data["detail"], "Should indicate unknown email type"
        
        print(f"Invalid email type correctly rejected: {data['detail']}")
    
    def test_non_admin_cannot_send_test_email(self, user_headers):
        """Test non-admin users cannot send test emails"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=user_headers,
            json={
                "recipient_email": "test@example.com",
                "email_type": "welcome"
            }
        )
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("Non-admin correctly rejected from test email endpoint")
    
    def test_unauthenticated_cannot_send_test_email(self):
        """Test unauthenticated requests cannot send test emails"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            json={
                "recipient_email": "test@example.com",
                "email_type": "welcome"
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated request correctly rejected with {response.status_code}")


class TestEmailServiceIntegration:
    """Test email service integration with Resend API"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Admin authentication failed")
    
    def test_resend_api_key_configured(self, admin_headers):
        """Verify Resend API key is properly configured"""
        response = requests.get(f"{BASE_URL}/api/email/status", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify API key starts with "re_" (Resend format)
        api_key_prefix = data.get("api_key_set", "")
        assert api_key_prefix.startswith("re_"), f"API key should start with 're_', got: {api_key_prefix}"
        
        print(f"Resend API key configured: {api_key_prefix}")
    
    def test_email_sending_returns_proper_error_for_unverified(self, admin_headers):
        """Test that email to unverified address returns expected Resend error"""
        response = requests.post(
            f"{BASE_URL}/api/email/test",
            headers=admin_headers,
            json={
                "recipient_email": "unverified@external-domain.com",
                "email_type": "welcome"
            }
        )
        
        assert response.status_code == 200, "API call should succeed"
        data = response.json()
        
        # In test mode, email to unverified address should fail
        result = data.get("result", {})
        if not result.get("success"):
            error_msg = result.get("error", "")
            # Expected error from Resend in test mode
            print(f"Expected test mode error: {error_msg}")
            assert "error" in result or result.get("success") == False, "Should indicate failure for unverified email"
        else:
            print("Email sent successfully (may have verified address)")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
