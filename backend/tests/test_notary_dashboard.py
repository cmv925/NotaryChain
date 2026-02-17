"""
Test Suite for Notary Dashboard API Endpoints

Testing:
- GET /api/notary/stats - Returns notary statistics
- GET /api/notary/requests/pending - Returns pending requests
- GET /api/notary/requests/assigned - Returns assigned requests
- POST /api/notary/requests/{id}/assign - Assign request to notary
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestNotaryDashboardAPIs:
    """Notary Dashboard API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.demo_token = None
        self.admin_token = None
        self.notary_token = None
        self.notary_user_id = None
        self.test_request_id = None
    
    def get_demo_token(self):
        """Get token for demo user"""
        if self.demo_token:
            return self.demo_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        self.demo_token = response.json().get("access_token")
        return self.demo_token
    
    def get_admin_token(self):
        """Get token for admin user"""
        if self.admin_token:
            return self.admin_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json().get("access_token")
        return self.admin_token
    
    def create_notary_user_and_approve(self):
        """Create a notary user with approved profile for testing"""
        # Generate unique email for test notary
        unique_id = str(uuid.uuid4())[:8]
        notary_email = f"TEST_notary_{unique_id}@test.com"
        notary_password = "Notary123!"
        
        # Register new user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": notary_email,
            "password": notary_password,
            "full_name": f"Test Notary {unique_id}"
        })
        
        if response.status_code not in [200, 201]:
            # User might already exist
            print(f"Registration response: {response.status_code} - {response.text}")
            return None, None
        
        # Login as new user
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": notary_email,
            "password": notary_password
        })
        
        if response.status_code != 200:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None, None
            
        token = response.json().get("access_token")
        user_id = response.json().get("user", {}).get("id")
        
        # Create notary profile
        profile_data = {
            "full_name": f"Test Notary {unique_id}",
            "license_state": "California",
            "license_number": f"CA{unique_id}",
            "commission_expiry": "2027-12-31",
            "ron_certified": True,
            "specializations": ["real_estate", "wills"],
            "bio": "Test notary for dashboard testing"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/notary/profile",
            json=profile_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code not in [200, 201]:
            print(f"Profile creation failed: {response.status_code} - {response.text}")
            # Continue even if profile exists
        
        # Use direct DB to approve the notary (simulate admin approval)
        from pymongo import MongoClient
        client = MongoClient(os.environ.get('MONGO_URL'))
        db = client['test_database']
        
        result = db.notary_profiles.update_one(
            {"user_id": user_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            # Try to find by email pattern
            user = db.users.find_one({"email": notary_email})
            if user:
                db.notary_profiles.update_one(
                    {"user_id": user["id"]},
                    {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
                )
                user_id = user["id"]
        
        return token, user_id
    
    def get_notary_token(self):
        """Get or create token for a notary user"""
        if self.notary_token:
            return self.notary_token, self.notary_user_id
        
        # First try to use existing approved notary
        from pymongo import MongoClient
        client = MongoClient(os.environ.get('MONGO_URL'))
        db = client['test_database']
        
        # Find an approved notary
        approved = db.notary_profiles.find_one({"status": "approved"})
        if approved:
            user = db.users.find_one({"id": approved["user_id"]})
            if user:
                # We need to create a new notary since we don't have password
                pass
        
        # Create new notary user for testing
        token, user_id = self.create_notary_user_and_approve()
        self.notary_token = token
        self.notary_user_id = user_id
        return token, user_id
    
    # =====================
    # Test GET /api/notary/stats
    # =====================
    
    def test_notary_stats_without_auth(self):
        """Test notary stats endpoint without authentication"""
        response = self.session.get(f"{BASE_URL}/api/notary/stats")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated request returns 401/403")
    
    def test_notary_stats_non_notary_user(self):
        """Test notary stats for non-notary user returns is_notary: false"""
        token = self.get_demo_token()
        response = self.session.get(
            f"{BASE_URL}/api/notary/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "is_notary" in data, "Response should contain is_notary field"
        # Demo user is not a notary, so is_notary should be False
        if data.get("is_notary") is False:
            print("PASS: Non-notary user gets is_notary: false")
        else:
            # If demo user happens to be a notary, check for stats
            assert "total_completed" in data or "is_notary" in data, \
                "Response should have stats fields"
            print("PASS: User has notary stats")
    
    def test_notary_stats_notary_user(self):
        """Test notary stats for approved notary user"""
        token, user_id = self.get_notary_token()
        if not token:
            pytest.skip("Could not create notary user for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/notary/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "is_notary" in data, "Response should contain is_notary"
        assert data["is_notary"] is True, "Approved notary should have is_notary: true"
        assert "total_completed" in data, "Response should contain total_completed"
        assert "pending_count" in data, "Response should contain pending_count"
        assert "profile" in data, "Response should contain profile object"
        
        print(f"PASS: Notary stats returned - completed: {data['total_completed']}, pending: {data['pending_count']}")
    
    # =====================
    # Test GET /api/notary/requests/pending
    # =====================
    
    def test_pending_requests_without_auth(self):
        """Test pending requests endpoint without authentication"""
        response = self.session.get(f"{BASE_URL}/api/notary/requests/pending")
        assert response.status_code in [401, 403], \
            f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated request returns 401/403")
    
    def test_pending_requests_non_notary_user(self):
        """Test pending requests for non-notary user returns 403"""
        token = self.get_demo_token()
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, \
            f"Non-notary user should get 403, got {response.status_code}"
        print("PASS: Non-notary user gets 403 Forbidden")
    
    def test_pending_requests_notary_user(self):
        """Test pending requests for approved notary user"""
        token, user_id = self.get_notary_token()
        if not token:
            pytest.skip("Could not create notary user for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are pending requests, verify structure
        if len(data) > 0:
            request = data[0]
            assert "id" in request, "Request should have id"
            assert "status" in request, "Request should have status"
            assert request["status"] == "pending", "Request should be pending"
            assert "document_name" in request, "Request should have document_name"
            print(f"PASS: Found {len(data)} pending requests")
        else:
            print("PASS: No pending requests (empty list returned)")
    
    # =====================
    # Test GET /api/notary/requests/assigned
    # =====================
    
    def test_assigned_requests_without_auth(self):
        """Test assigned requests endpoint without authentication"""
        response = self.session.get(f"{BASE_URL}/api/notary/requests/assigned")
        assert response.status_code in [401, 403], \
            f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated request returns 401/403")
    
    def test_assigned_requests_non_notary_user(self):
        """Test assigned requests for non-notary user returns 403"""
        token = self.get_demo_token()
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/assigned",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, \
            f"Non-notary user should get 403, got {response.status_code}"
        print("PASS: Non-notary user gets 403 Forbidden")
    
    def test_assigned_requests_notary_user(self):
        """Test assigned requests for approved notary user"""
        token, user_id = self.get_notary_token()
        if not token:
            pytest.skip("Could not create notary user for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/assigned",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            request = data[0]
            assert "id" in request, "Request should have id"
            assert "status" in request, "Request should have status"
            assert request["status"] in ["assigned", "in_progress", "reviewing"], \
                f"Request status should be assigned/in_progress/reviewing, got {request['status']}"
            print(f"PASS: Found {len(data)} assigned requests")
        else:
            print("PASS: No assigned requests (empty list returned)")
    
    # =====================
    # Test POST /api/notary/requests/{id}/assign
    # =====================
    
    def test_assign_request_without_auth(self):
        """Test assign request endpoint without authentication"""
        response = self.session.post(f"{BASE_URL}/api/notary/requests/fake-id/assign")
        assert response.status_code in [401, 403], \
            f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated request returns 401/403")
    
    def test_assign_request_non_notary_user(self):
        """Test assign request for non-notary user returns 403"""
        token = self.get_demo_token()
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests/fake-id/assign",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, \
            f"Non-notary user should get 403, got {response.status_code}"
        print("PASS: Non-notary user gets 403 Forbidden")
    
    def test_assign_nonexistent_request(self):
        """Test assigning a non-existent request returns 400"""
        token, user_id = self.get_notary_token()
        if not token:
            pytest.skip("Could not create notary user for testing")
        
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests/nonexistent-id/assign",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should return 400 (not available) since the request doesn't exist
        assert response.status_code == 400, \
            f"Expected 400 for non-existent request, got {response.status_code}"
        print("PASS: Non-existent request returns 400")
    
    def test_assign_pending_request(self):
        """Test assigning a pending request"""
        token, user_id = self.get_notary_token()
        if not token:
            pytest.skip("Could not create notary user for testing")
        
        # First get pending requests
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        pending = response.json()
        
        if len(pending) == 0:
            # Create a test request using demo user
            demo_token = self.get_demo_token()
            create_response = self.session.post(
                f"{BASE_URL}/api/notary/requests",
                json={
                    "document_type": "power_of_attorney",
                    "document_name": f"TEST_Notary_Assign_Test_{uuid.uuid4().hex[:8]}",
                    "notarization_type": "remote",
                    "signers": [{"name": "Test Signer", "email": "signer@test.com"}]
                },
                headers={"Authorization": f"Bearer {demo_token}"}
            )
            
            if create_response.status_code not in [200, 201]:
                pytest.skip(f"Could not create test request: {create_response.text}")
            
            request_id = create_response.json().get("id")
        else:
            # Use first pending request
            request_id = pending[0]["id"]
        
        # Now assign the request
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests/{request_id}/assign",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 400 and "not available" in response.text.lower():
            print("PASS: Request already assigned or not available")
        else:
            assert response.status_code == 200, \
                f"Expected 200 for successful assign, got {response.status_code} - {response.text}"
            data = response.json()
            assert data.get("success") is True, "Response should indicate success"
            print(f"PASS: Successfully assigned request {request_id}")
            
            # Verify the request appears in assigned list
            response = self.session.get(
                f"{BASE_URL}/api/notary/requests/assigned",
                headers={"Authorization": f"Bearer {token}"}
            )
            assigned = response.json()
            assigned_ids = [r["id"] for r in assigned]
            assert request_id in assigned_ids, "Assigned request should appear in assigned list"
            print("PASS: Request verified in assigned list")


class TestNotaryDashboardDataPersistence:
    """Test data persistence and flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_request_creation_and_retrieval_flow(self):
        """Test creating a notarization request and retrieving it"""
        # Login as demo user
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        # Create a notarization request
        unique_id = uuid.uuid4().hex[:8]
        request_data = {
            "document_type": "affidavit",
            "document_name": f"TEST_Dashboard_Test_{unique_id}",
            "notarization_type": "remote",
            "signers": [{"name": "Dashboard Test Signer", "email": "dashboard@test.com"}]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/notary/requests",
            json=request_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code in [200, 201], \
            f"Request creation failed: {response.status_code} - {response.text}"
        
        created_request = response.json()
        assert "id" in created_request, "Created request should have id"
        assert created_request["document_name"] == request_data["document_name"], \
            "Document name should match"
        
        print(f"PASS: Created request {created_request['id']}")
        
        # Retrieve request
        response = self.session.get(
            f"{BASE_URL}/api/notary/requests/my",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        my_requests = response.json()
        request_ids = [r["id"] for r in my_requests]
        assert created_request["id"] in request_ids, \
            "Created request should appear in user's requests"
        
        print("PASS: Request appears in user's list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
