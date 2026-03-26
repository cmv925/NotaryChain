"""
Test Suite for Iteration 57 - Three Backlog Features:
1. Automated Incident Reporting (GET /api/admin/incidents, GET /api/admin/incidents/export-pdf)
2. SSO Routes (Auth0/Okta status, providers) - verify still working after refactor
3. Regular login - verify still working
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
REGULAR_EMAIL = "demo@test.com"
REGULAR_PASSWORD = "Demo123!"


class TestAuthentication:
    """Test regular login still works after SSO refactor"""
    
    def test_admin_login_success(self):
        """Admin login should return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert data.get("token_type") == "bearer"
        print(f"✓ Admin login successful, token received")
    
    def test_regular_user_login_success(self):
        """Regular user login should return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD
        })
        assert response.status_code == 200, f"Regular user login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        print(f"✓ Regular user login successful")


class TestSSORoutesAfterRefactor:
    """Verify SSO routes still work after refactor to separate files"""
    
    def test_auth0_status_endpoint(self):
        """GET /api/sso/auth0/status should return configured status"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/status")
        assert response.status_code == 200, f"Auth0 status failed: {response.text}"
        data = response.json()
        assert "configured" in data, "Missing 'configured' field"
        assert data["configured"] == True, "Auth0 should be configured"
        assert "domain" in data, "Missing 'domain' field"
        print(f"✓ Auth0 status: configured={data['configured']}, domain={data.get('domain')}")
    
    def test_okta_status_endpoint(self):
        """GET /api/sso/okta/status should return configured status"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/status")
        assert response.status_code == 200, f"Okta status failed: {response.text}"
        data = response.json()
        assert "configured" in data, "Missing 'configured' field"
        assert data["configured"] == True, "Okta should be configured"
        assert "domain" in data, "Missing 'domain' field"
        print(f"✓ Okta status: configured={data['configured']}, domain={data.get('domain')}")
    
    def test_sso_providers_endpoint(self):
        """GET /api/sso/providers should return both Auth0 and Okta"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200, f"SSO providers failed: {response.text}"
        data = response.json()
        assert "providers" in data, "Missing 'providers' field"
        providers = data["providers"]
        # Providers can be list of objects with 'name' field or list of strings
        provider_names = [p.get("name") if isinstance(p, dict) else p for p in providers]
        assert "Auth0" in provider_names, f"Auth0 should be in providers list, got: {provider_names}"
        assert "Okta" in provider_names, f"Okta should be in providers list, got: {provider_names}"
        print(f"✓ SSO providers: {provider_names}")


class TestIncidentReporting:
    """Test Automated Incident Reporting endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed - cannot test incident endpoints")
        return response.json()["access_token"]
    
    @pytest.fixture
    def regular_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Regular user login failed")
        return response.json()["access_token"]
    
    def test_incidents_endpoint_returns_correct_structure(self, admin_token):
        """GET /api/admin/incidents should return incidents array, summary, period_days"""
        response = requests.get(
            f"{BASE_URL}/api/admin/incidents?days=7",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Incidents endpoint failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "incidents" in data, "Missing 'incidents' array"
        assert "summary" in data, "Missing 'summary' object"
        assert "period_days" in data, "Missing 'period_days' field"
        assert "generated_at" in data, "Missing 'generated_at' field"
        
        # Verify incidents is an array
        assert isinstance(data["incidents"], list), "incidents should be an array"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_incidents" in summary, "Missing total_incidents in summary"
        assert "resolved" in summary, "Missing resolved in summary"
        assert "ongoing" in summary, "Missing ongoing in summary"
        assert "services_affected" in summary, "Missing services_affected in summary"
        
        # Verify period_days matches request
        assert data["period_days"] == 7, f"Expected period_days=7, got {data['period_days']}"
        
        print(f"✓ Incidents endpoint structure correct: {summary['total_incidents']} incidents, {summary['resolved']} resolved, {summary['ongoing']} ongoing")
    
    def test_incidents_endpoint_with_different_days(self, admin_token):
        """GET /api/admin/incidents should accept different days parameter"""
        for days in [7, 14, 30]:
            response = requests.get(
                f"{BASE_URL}/api/admin/incidents?days={days}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Incidents endpoint failed for days={days}: {response.text}"
            data = response.json()
            assert data["period_days"] == days, f"Expected period_days={days}, got {data['period_days']}"
        print(f"✓ Incidents endpoint accepts different days parameters")
    
    def test_incidents_endpoint_requires_admin(self, regular_token):
        """GET /api/admin/incidents should return 403 for non-admin users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/incidents?days=7",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print(f"✓ Incidents endpoint correctly requires admin role (403 for non-admin)")
    
    def test_incidents_endpoint_requires_auth(self):
        """GET /api/admin/incidents should return 401 or 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/incidents?days=7")
        # Can be 401 (not authenticated) or 403 (forbidden) depending on implementation
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Incidents endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_export_pdf_returns_valid_pdf(self, admin_token):
        """GET /api/admin/incidents/export-pdf should return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/admin/incidents/export-pdf?days=30",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"PDF export failed: {response.text}"
        
        # Verify content type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        # Verify content disposition header
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Missing attachment in Content-Disposition"
        assert ".pdf" in content_disp, "Missing .pdf in filename"
        
        # Verify PDF magic bytes (PDF files start with %PDF)
        assert response.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        print(f"✓ PDF export successful: {len(response.content)} bytes, Content-Type: {content_type}")
    
    def test_export_pdf_requires_admin(self, regular_token):
        """GET /api/admin/incidents/export-pdf should return 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/incidents/export-pdf?days=30",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"✓ PDF export correctly requires admin role")


class TestServiceHealthEndpoint:
    """Test service health endpoint used by Operations tab"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_service_health_endpoint(self, admin_token):
        """GET /api/admin/ops/service-health should return service status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/service-health",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Service health failed: {response.text}"
        data = response.json()
        
        # Verify services array exists
        assert "services" in data, "Missing 'services' array"
        assert isinstance(data["services"], list), "services should be an array"
        
        # Verify checked_at timestamp
        assert "checked_at" in data, "Missing 'checked_at' timestamp"
        
        # Check for expected services (MongoDB, AWS S3, etc.)
        service_names = [s.get("service") for s in data["services"]]
        print(f"✓ Service health returned {len(data['services'])} services: {service_names}")


class TestStorageAnalyticsEndpoint:
    """Test storage analytics endpoint used by Operations tab"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_storage_analytics_endpoint(self, admin_token):
        """GET /api/admin/ops/storage-analytics should return storage data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Storage analytics failed: {response.text}"
        data = response.json()
        
        # Verify key fields exist
        assert "total_vault_docs" in data or "total_files" in data, "Missing total files count"
        print(f"✓ Storage analytics endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
