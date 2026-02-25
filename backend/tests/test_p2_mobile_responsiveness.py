"""
Backend API tests for P2 Mobile Responsiveness iteration
Tests: Auth endpoints, Notification endpoints, Health check
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint returns healthy")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_admin_user(self):
        """Test admin login returns access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print(f"✓ Admin login successful, token length: {len(data['access_token'])}")
        return data["access_token"]
    
    def test_login_demo_user(self):
        """Test demo user login returns access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print("✓ Demo user login successful")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected with 401")
    
    def test_me_endpoint_authenticated(self):
        """Test /me endpoint with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json().get("access_token")
        
        # Then get me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == ADMIN_EMAIL
        print(f"✓ /me endpoint returns user: {data.get('email')}")
    
    def test_me_endpoint_unauthenticated(self):
        """Test /me endpoint without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print(f"✓ /me endpoint correctly rejects unauthenticated requests ({response.status_code})")


class TestNotificationEndpoints:
    """Notification endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token fixture"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token")
    
    def test_get_notifications_authenticated(self, admin_token):
        """Test notifications list with valid token"""
        response = requests.get(f"{BASE_URL}/api/notifications/", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        print(f"✓ Notifications endpoint returns {len(data.get('notifications', []))} notifications")
    
    def test_get_notifications_unauthenticated(self):
        """Test notifications without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/notifications/")
        assert response.status_code in [401, 403]
        print(f"✓ Notifications correctly rejects unauthenticated requests ({response.status_code})")
    
    def test_unread_count_authenticated(self, admin_token):
        """Test unread count with valid token"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Unread count endpoint returns count: {data.get('count')}")
    
    def test_unread_count_unauthenticated(self):
        """Test unread count without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code in [401, 403]
        print(f"✓ Unread count correctly rejects unauthenticated requests ({response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
