"""
Backend tests for Admin Dashboard and Audit Logging features
Tests: Admin routes, Audit routes, Role-based access control
"""

import pytest
import requests
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


class TestAuthentication:
    """Test authentication for admin/demo users"""
    
    def test_admin_login(self):
        """Test admin user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_demo_user_login(self):
        """Test demo user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin login failed")


@pytest.fixture
def demo_token():
    """Get demo user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Demo user login failed")


class TestAdminStats:
    """Tests for GET /api/admin/stats endpoint"""
    
    def test_admin_stats_success(self, admin_token):
        """Admin can get platform stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data
        assert "active_users_30d" in data
        assert "total_notaries" in data
        assert "pending_notary_applications" in data
        assert "total_notarizations" in data
        assert "completed_notarizations" in data
        assert "total_revenue_usd" in data
        assert "crypto_payments_count" in data
        assert "documents_sealed" in data
        
        # Verify data types
        assert isinstance(data["total_users"], int)
        assert isinstance(data["total_revenue_usd"], (int, float))
    
    def test_admin_stats_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot access admin stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json().get("detail", "")
    
    def test_admin_stats_requires_auth(self):
        """Unauthenticated request returns error"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [401, 403]


class TestAdminUsers:
    """Tests for GET /api/admin/users endpoint"""
    
    def test_get_users_list(self, admin_token):
        """Admin can get list of users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?page_size=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "users" in data
        assert isinstance(data["users"], list)
        
        # Verify user data
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user
            assert "email" in user
    
    def test_get_users_with_pagination(self, admin_token):
        """Test pagination works correctly"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?page=1&page_size=2",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["users"]) <= 2
    
    def test_get_users_with_search(self, admin_token):
        """Test search functionality"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?search=demo",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should find demo user
        for user in data["users"]:
            assert "demo" in user.get("email", "").lower() or "demo" in user.get("full_name", "").lower()
    
    def test_get_users_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot access users list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAdminUserDetails:
    """Tests for GET /api/admin/users/{id} endpoint"""
    
    def test_get_user_details(self, admin_token):
        """Admin can get user details"""
        # First get a user ID
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users?page_size=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert users_response.status_code == 200
        users = users_response.json()["users"]
        
        if len(users) > 0:
            user_id = users[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/admin/users/{user_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert "user" in data
            assert "notary_profile" in data
            assert "recent_activity" in data
            assert "payments" in data
            assert "notarizations" in data
    
    def test_get_user_details_not_found(self, admin_token):
        """Non-existent user returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/nonexistent-user-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404


class TestAdminUserStatus:
    """Tests for PATCH /api/admin/users/{id}/status endpoint"""
    
    def test_update_user_status_structure(self, admin_token):
        """Test endpoint accepts proper parameters"""
        # First get a non-admin user
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users?page_size=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()["users"]
        
        test_user = None
        for user in users:
            if user.get("role") != "admin":
                test_user = user
                break
        
        if test_user:
            # Test that the endpoint exists and responds correctly
            response = requests.patch(
                f"{BASE_URL}/api/admin/users/{test_user['id']}/status?status=active",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
    
    def test_update_user_status_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot update user status"""
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/some-user-id/status?status=disabled",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAdminNotaries:
    """Tests for GET /api/admin/notaries endpoint"""
    
    def test_get_notaries_list(self, admin_token):
        """Admin can get list of notaries"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "notaries" in data
    
    def test_get_pending_notary_applications(self, admin_token):
        """Admin can get pending notary applications"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notaries/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "count" in data
        assert "applications" in data
        assert isinstance(data["applications"], list)
        
        # Check application structure if any exist
        if len(data["applications"]) > 0:
            app = data["applications"][0]
            assert "id" in app
            assert "user_id" in app
            assert "status" in app
            assert app["status"] == "pending"


class TestAdminNotaryApproval:
    """Tests for POST /api/admin/notaries/{id}/approve and reject endpoints"""
    
    def test_approve_notary_structure(self, admin_token):
        """Test approve endpoint exists and responds"""
        # First get a pending application
        pending_response = requests.get(
            f"{BASE_URL}/api/admin/notaries/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        applications = pending_response.json().get("applications", [])
        
        # Test with non-existent ID (to verify endpoint structure)
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should be 404 for non-existent, not 500
        assert response.status_code == 404
    
    def test_reject_notary_structure(self, admin_token):
        """Test reject endpoint exists and responds"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/nonexistent-id/reject",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
    
    def test_approve_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot approve notaries"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notaries/some-id/approve",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAdminAnalytics:
    """Tests for /api/admin/analytics endpoints"""
    
    def test_get_revenue_analytics(self, admin_token):
        """Admin can get revenue analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/revenue?days=30",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "stripe_daily" in data
        assert "crypto_daily" in data
        assert "by_package" in data
        
        assert data["period_days"] == 30
    
    def test_get_notarization_analytics(self, admin_token):
        """Admin can get notarization analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/notarizations?days=30",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "daily" in data
        assert "by_status" in data
        assert "by_document_type" in data
    
    def test_analytics_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot access analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/revenue",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAuditLogs:
    """Tests for GET /api/audit/logs endpoint"""
    
    def test_get_audit_logs(self, admin_token):
        """Admin can get audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit/logs?page_size=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "logs" in data
        assert isinstance(data["logs"], list)
    
    def test_get_audit_logs_pagination(self, admin_token):
        """Test audit logs pagination"""
        response = requests.get(
            f"{BASE_URL}/api/audit/logs?page=1&page_size=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
    
    def test_audit_logs_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot access audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit/logs",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAuditStats:
    """Tests for GET /api/audit/stats endpoint"""
    
    def test_get_audit_stats(self, admin_token):
        """Admin can get audit statistics"""
        response = requests.get(
            f"{BASE_URL}/api/audit/stats?days=30",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "total_logs" in data
        assert "by_action" in data
        assert "by_severity" in data
        assert "by_resource" in data
        assert "daily_activity" in data
    
    def test_audit_stats_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot access audit stats"""
        response = requests.get(
            f"{BASE_URL}/api/audit/stats",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestAuditExport:
    """Tests for GET /api/audit/export endpoint"""
    
    def test_export_audit_logs_json(self, admin_token):
        """Admin can export audit logs as JSON"""
        response = requests.get(
            f"{BASE_URL}/api/audit/export?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z&format=json",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "format" in data
        assert data["format"] == "json"
        assert "logs" in data
        assert "record_count" in data
    
    def test_export_audit_logs_csv(self, admin_token):
        """Admin can export audit logs as CSV"""
        response = requests.get(
            f"{BASE_URL}/api/audit/export?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z&format=csv",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "format" in data
        assert data["format"] == "csv"
    
    def test_export_forbidden_for_regular_user(self, demo_token):
        """Regular user cannot export audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit/export?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 403


class TestSeedAdmin:
    """Tests for POST /api/admin/seed-admin endpoint"""
    
    def test_seed_admin_already_exists(self):
        """Seed admin returns error if admin already exists"""
        response = requests.post(f"{BASE_URL}/api/admin/seed-admin")
        assert response.status_code == 400
        assert "Admin user already exists" in response.json().get("detail", "")
