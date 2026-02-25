"""
P1 Production Infrastructure Features Tests
Testing: Background Jobs API, WebSocket endpoint, File Serving, 2FA flow
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


class TestHealthAndBasicEndpoints:
    """Basic health and API status tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert "status" in data, "Health response missing status field"
        print(f"Health check: {data.get('status')}")
    
    def test_root_api_endpoint(self):
        """GET /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "NotaryChain API"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login works for admin@notarychain.com"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        # Either returns access_token directly or requires_2fa
        assert "access_token" in data or data.get("requires_2fa") == True, \
            f"Unexpected login response: {data}"
        print(f"Admin login response: requires_2fa={data.get('requires_2fa', False)}, has_token={bool(data.get('access_token'))}")
    
    def test_demo_login_success(self):
        """POST /api/auth/login works for demo@test.com"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        )
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or data.get("requires_2fa") == True, \
            f"Unexpected login response: {data}"
        print(f"Demo login response: requires_2fa={data.get('requires_2fa', False)}, has_token={bool(data.get('access_token'))}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login rejects invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestBackgroundJobsAPI:
    """Background Jobs API tests - P1 Feature"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        # Handle 2FA case - skip if 2FA required
        if data.get("requires_2fa"):
            pytest.skip("Admin has 2FA enabled - cannot get direct token")
        return data.get("access_token")
    
    def test_get_jobs_list_authenticated(self, auth_token):
        """GET /api/jobs/ returns jobs list (authenticated)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/jobs/", headers=headers)
        assert response.status_code == 200, f"Jobs list failed: {response.text}"
        data = response.json()
        assert "jobs" in data, "Response missing 'jobs' field"
        assert isinstance(data["jobs"], list), "'jobs' should be a list"
        print(f"Jobs endpoint returned {len(data['jobs'])} jobs")
    
    def test_get_jobs_unauthenticated(self):
        """GET /api/jobs/ requires authentication"""
        response = requests.get(f"{BASE_URL}/api/jobs/")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated, got {response.status_code}"
    
    def test_get_job_by_id_not_found(self, auth_token):
        """GET /api/jobs/{job_id} returns 404 for nonexistent job"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/jobs/nonexistent-job-id", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestFileServingEndpoint:
    """Document file serving tests - P1 Feature"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        if data.get("requires_2fa"):
            pytest.skip("Admin has 2FA enabled - cannot get direct token")
        return data.get("access_token")
    
    def test_get_nonexistent_file_authenticated(self, auth_token):
        """GET /api/documents/files/nonexistent.pdf returns 404 with auth"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/files/nonexistent.pdf", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        print(f"File not found error: {data.get('detail')}")
    
    def test_get_file_unauthenticated(self):
        """GET /api/documents/files/{filename} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents/files/test.pdf")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated, got {response.status_code}"


class TestWebSocketEndpointExists:
    """WebSocket endpoint existence tests - P1 Feature
    Note: We can't test actual WS connections with requests, 
    but we verify the endpoint exists and doesn't crash the server
    """
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        if data.get("requires_2fa"):
            pytest.skip("Admin has 2FA enabled - cannot get direct token")
        return data.get("access_token")
    
    def test_websocket_endpoint_http_request(self, auth_token):
        """Non-WS request to /api/transactions/{id}/ws returns proper error (not 500)"""
        # Making a regular HTTP request to a WebSocket endpoint should fail gracefully
        # FastAPI/Starlette returns 404 or closes connection, not 500
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/transactions/test-transaction-id/ws?token={auth_token}",
            headers=headers
        )
        # WebSocket endpoints typically return 404 or close when accessed via HTTP
        # The key is that the server doesn't crash (500)
        assert response.status_code != 500, \
            f"WebSocket endpoint returned 500 error: {response.text}"
        print(f"WebSocket HTTP request returned: {response.status_code}")


class TestTwoFactorAuthFlow:
    """2FA flow tests - verify 2FA endpoints still work"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        if data.get("requires_2fa"):
            pytest.skip("Demo user has 2FA enabled - need to verify via 2FA first")
        return data.get("access_token")
    
    def test_2fa_status_endpoint(self, auth_token):
        """GET /api/auth/2fa/status works"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/2fa/status", headers=headers)
        assert response.status_code == 200, f"2FA status failed: {response.text}"
        data = response.json()
        assert "enabled" in data, "2FA status should have 'enabled' field"
        print(f"2FA status: enabled={data.get('enabled')}")
    
    def test_2fa_enable_endpoint(self, auth_token):
        """POST /api/auth/2fa/enable returns setup data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/auth/2fa/enable", headers=headers)
        assert response.status_code == 200, f"2FA enable failed: {response.text}"
        data = response.json()
        # Should return secret, qr_code, backup_codes
        assert "secret" in data, "2FA enable should return 'secret'"
        assert "qr_code" in data, "2FA enable should return 'qr_code'"
        assert "backup_codes" in data, "2FA enable should return 'backup_codes'"
        print(f"2FA enable returned secret and {len(data.get('backup_codes', []))} backup codes")


class TestTransactionEndpoints:
    """Transaction API tests to verify WebSocket integration context"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        if data.get("requires_2fa"):
            pytest.skip("Admin has 2FA enabled")
        return data.get("access_token")
    
    def test_get_transactions_list(self, auth_token):
        """GET /api/transactions returns transactions list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        data = response.json()
        assert "transactions" in data, "Response missing 'transactions' field"
        print(f"Transactions list returned {len(data.get('transactions', []))} transactions")
    
    def test_get_blueprints(self, auth_token):
        """GET /api/transactions/blueprints returns blueprints"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions/blueprints", headers=headers)
        assert response.status_code == 200, f"Get blueprints failed: {response.text}"
        data = response.json()
        # Should have system_blueprints and custom_blueprints
        assert "system_blueprints" in data or "custom_blueprints" in data, \
            "Response should have blueprints data"
        print(f"Blueprints returned: system={len(data.get('system_blueprints', []))}, custom={len(data.get('custom_blueprints', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
