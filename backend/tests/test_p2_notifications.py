"""
P2 Polish - Notification API Tests
Tests for notification CRUD endpoints and functionality
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestNotificationAPI:
    """Tests for notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_admin_login_works(self):
        """Test that admin login still works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("email") == ADMIN_EMAIL
        print(f"PASS: Admin login works, got token")
    
    def test_demo_login_works(self):
        """Test that demo user login still works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("email") == DEMO_EMAIL
        print(f"PASS: Demo user login works, got token")
    
    def test_get_notifications_authenticated(self):
        """Test GET /api/notifications/ returns notifications list for authenticated user"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        response = self.session.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' key"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        print(f"PASS: GET /api/notifications/ returned {len(data['notifications'])} notifications")
        
    def test_get_notifications_unauthenticated(self):
        """Test GET /api/notifications/ returns 401/403 for unauthenticated user"""
        response = self.session.get(f"{BASE_URL}/api/notifications/")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"PASS: GET /api/notifications/ correctly returns {response.status_code} for unauthenticated requests")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread-count returns unread count"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        response = self.session.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get unread count: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "count" in data, "Response should contain 'count' key"
        assert isinstance(data["count"], int), "count should be an integer"
        assert data["count"] >= 0, "count should be non-negative"
        print(f"PASS: GET /api/notifications/unread-count returned count={data['count']}")
    
    def test_get_unread_count_unauthenticated(self):
        """Test GET /api/notifications/unread-count returns 401/403 for unauthenticated user"""
        response = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"PASS: GET /api/notifications/unread-count correctly returns {response.status_code} for unauthenticated requests")
    
    def test_mark_notification_as_read(self):
        """Test POST /api/notifications/{id}/read marks notification as read"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        # First get notifications to find one to mark as read
        response = self.session.get(
            f"{BASE_URL}/api/notifications/?limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        notifications = response.json().get("notifications", [])
        
        if len(notifications) == 0:
            pytest.skip("No notifications to test with")
        
        # Find an unread notification or use the first one
        notif_id = notifications[0]["id"]
        
        # Mark as read
        response = self.session.post(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to mark notification as read: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"PASS: POST /api/notifications/{notif_id}/read successfully marked notification as read")
    
    def test_mark_nonexistent_notification_as_read(self):
        """Test POST /api/notifications/{id}/read returns 404 for nonexistent notification"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        fake_id = "nonexistent-notification-12345"
        response = self.session.post(
            f"{BASE_URL}/api/notifications/{fake_id}/read",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}"
        print(f"PASS: POST /api/notifications/{fake_id}/read correctly returns 404")
    
    def test_mark_all_as_read(self):
        """Test POST /api/notifications/read-all marks all as read"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        response = self.session.post(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to mark all as read: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "updated" in data, "Response should contain 'updated' count"
        print(f"PASS: POST /api/notifications/read-all succeeded, updated={data.get('updated')} notifications")
        
        # Verify unread count is now 0
        response = self.session.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json().get("count") == 0, "Unread count should be 0 after marking all as read"
        print(f"PASS: Verified unread count is 0 after mark-all-read")
    
    def test_delete_notification(self):
        """Test DELETE /api/notifications/{id} deletes a notification"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        # Get notifications first
        response = self.session.get(
            f"{BASE_URL}/api/notifications/?limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        notifications = response.json().get("notifications", [])
        
        if len(notifications) == 0:
            pytest.skip("No notifications to delete")
        
        notif_id = notifications[0]["id"]
        
        # Delete the notification
        response = self.session.delete(
            f"{BASE_URL}/api/notifications/{notif_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to delete notification: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"PASS: DELETE /api/notifications/{notif_id} successfully deleted notification")
        
        # Verify it's deleted
        response = self.session.delete(
            f"{BASE_URL}/api/notifications/{notif_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, "Deleted notification should return 404 on second delete"
        print(f"PASS: Verified notification is deleted (returns 404 on re-delete)")
    
    def test_delete_nonexistent_notification(self):
        """Test DELETE /api/notifications/{id} returns 404 for nonexistent notification"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        fake_id = "nonexistent-notification-99999"
        response = self.session.delete(
            f"{BASE_URL}/api/notifications/{fake_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}"
        print(f"PASS: DELETE /api/notifications/{fake_id} correctly returns 404")


class TestHealthAndBasicAPIs:
    """Basic health and API tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print(f"PASS: /api/health returns 200")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.status_code}"
        data = response.json()
        assert "version" in data or "message" in data
        print(f"PASS: /api/ returns 200 with version info")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
