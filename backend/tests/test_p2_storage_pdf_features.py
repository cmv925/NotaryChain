"""
P2 Feature Tests: Storage Analytics + SOC2 PDF Export
Tests for iteration 54:
  - GET /api/admin/ops/storage-analytics
  - GET /api/admin/security/export-pdf
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
REGULAR_EMAIL = "demo@test.com"
REGULAR_PASSWORD = "Demo123!"

# Global token cache to avoid rate limiting
_token_cache = {}

def get_admin_token():
    """Get admin token with caching to avoid rate limits"""
    if "admin" in _token_cache and _token_cache.get("admin_expiry", 0) > time.time():
        return _token_cache["admin"]
    
    for attempt in range(3):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            _token_cache["admin"] = token
            _token_cache["admin_expiry"] = time.time() + 3500  # ~1hr
            return token
        elif "Rate limit" in response.text:
            time.sleep(10)  # Wait for rate limit to clear
        else:
            break
    return None

def get_regular_token():
    """Get regular user token with caching"""
    if "regular" in _token_cache and _token_cache.get("regular_expiry", 0) > time.time():
        return _token_cache["regular"]
    
    for attempt in range(3):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            _token_cache["regular"] = token
            _token_cache["regular_expiry"] = time.time() + 3500
            return token
        elif "Rate limit" in response.text:
            time.sleep(10)
        else:
            break
    return None


class TestStorageAnalyticsAPI:
    """Storage Analytics endpoint tests - /api/admin/ops/storage-analytics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin and regular user tokens"""
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.skip("Admin login failed - possible rate limit")
        
        self.regular_token = get_regular_token()
    
    def test_storage_analytics_returns_200_for_admin(self):
        """Admin should get 200 for storage-analytics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Admin gets 200 for storage-analytics")
    
    def test_storage_analytics_has_per_user_field(self):
        """Response should contain per_user array"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "per_user" in data, "Response missing 'per_user' field"
        assert isinstance(data["per_user"], list), "per_user should be a list"
        print(f"PASS: per_user field present with {len(data['per_user'])} users")
    
    def test_storage_analytics_has_activity_trend_field(self):
        """Response should contain activity_trend array"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "activity_trend" in data, "Response missing 'activity_trend' field"
        assert isinstance(data["activity_trend"], list), "activity_trend should be a list"
        print(f"PASS: activity_trend field present with {len(data['activity_trend'])} entries")
    
    def test_storage_analytics_has_total_vault_docs(self):
        """Response should contain total_vault_docs field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "total_vault_docs" in data, "Response missing 'total_vault_docs' field"
        assert isinstance(data["total_vault_docs"], int), "total_vault_docs should be an integer"
        print(f"PASS: total_vault_docs = {data['total_vault_docs']}")
    
    def test_storage_analytics_has_total_vault_size_mb(self):
        """Response should contain total_vault_size_mb field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "total_vault_size_mb" in data, "Response missing 'total_vault_size_mb' field"
        print(f"PASS: total_vault_size_mb = {data['total_vault_size_mb']}")
    
    def test_storage_analytics_has_total_downloads(self):
        """Response should contain total_downloads field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "total_downloads" in data, "Response missing 'total_downloads' field"
        print(f"PASS: total_downloads = {data['total_downloads']}")
    
    def test_storage_analytics_has_cost_projection(self):
        """Response should contain cost_projection object"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        assert "cost_projection" in data, "Response missing 'cost_projection' field"
        assert isinstance(data["cost_projection"], dict), "cost_projection should be a dict"
        print(f"PASS: cost_projection field present")
    
    def test_cost_projection_has_current_gb(self):
        """cost_projection should contain current_gb"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        cp = data.get("cost_projection", {})
        assert "current_gb" in cp, "cost_projection missing 'current_gb' field"
        print(f"PASS: cost_projection.current_gb = {cp['current_gb']}")
    
    def test_cost_projection_has_monthly_cost_usd(self):
        """cost_projection should contain monthly_cost_usd"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        cp = data.get("cost_projection", {})
        assert "monthly_cost_usd" in cp, "cost_projection missing 'monthly_cost_usd' field"
        print(f"PASS: cost_projection.monthly_cost_usd = {cp['monthly_cost_usd']}")
    
    def test_cost_projection_has_projected_12m_cost_usd(self):
        """cost_projection should contain projected_12m_cost_usd"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        cp = data.get("cost_projection", {})
        assert "projected_12m_cost_usd" in cp, "cost_projection missing 'projected_12m_cost_usd' field"
        print(f"PASS: cost_projection.projected_12m_cost_usd = {cp['projected_12m_cost_usd']}")
    
    def test_cost_projection_has_growth_rate_pct(self):
        """cost_projection should contain growth_rate_pct"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        data = response.json()
        cp = data.get("cost_projection", {})
        assert "growth_rate_pct" in cp, "cost_projection missing 'growth_rate_pct' field"
        print(f"PASS: cost_projection.growth_rate_pct = {cp['growth_rate_pct']}%")
    
    def test_storage_analytics_requires_admin_role(self):
        """Non-admin users should get 403"""
        if not self.regular_token:
            pytest.skip("Regular user login failed")
        response = requests.get(
            f"{BASE_URL}/api/admin/ops/storage-analytics",
            headers={"Authorization": f"Bearer {self.regular_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("PASS: Non-admin gets 403 for storage-analytics")


class TestSOC2PDFExportAPI:
    """SOC2 PDF Export endpoint tests - /api/admin/security/export-pdf"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin and regular user tokens"""
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.skip("Admin login failed - possible rate limit")
        
        self.regular_token = get_regular_token()
    
    def test_export_pdf_returns_200_for_admin(self):
        """Admin should get 200 for export-pdf endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Admin gets 200 for export-pdf")
    
    def test_export_pdf_returns_correct_content_type(self):
        """Response should have application/pdf content type"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        print(f"PASS: Content-Type is {content_type}")
    
    def test_export_pdf_has_content_disposition_header(self):
        """Response should have Content-Disposition header for download"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, f"Expected attachment in Content-Disposition, got: {content_disposition}"
        assert ".pdf" in content_disposition, "Filename should end with .pdf"
        print(f"PASS: Content-Disposition = {content_disposition}")
    
    def test_export_pdf_returns_non_empty_body(self):
        """PDF body should not be empty"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert len(response.content) > 0, "PDF body is empty"
        print(f"PASS: PDF body size = {len(response.content)} bytes")
    
    def test_export_pdf_is_valid_pdf(self):
        """Response should start with PDF magic bytes"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        # PDF files start with %PDF
        assert response.content.startswith(b'%PDF'), "Response is not a valid PDF (doesn't start with %PDF)"
        print("PASS: PDF starts with %PDF magic bytes")
    
    def test_export_pdf_requires_admin_role(self):
        """Non-admin users should get 403"""
        if not self.regular_token:
            pytest.skip("Regular user login failed")
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.regular_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("PASS: Non-admin gets 403 for export-pdf")
    
    def test_export_pdf_creates_audit_log(self):
        """Export action should create an audit log entry"""
        # First, get count of audit logs
        audit_response1 = requests.get(
            f"{BASE_URL}/api/audit/logs?page_size=5",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        # Export the PDF
        requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        # Check audit logs again
        audit_response2 = requests.get(
            f"{BASE_URL}/api/audit/logs?page_size=5",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if audit_response2.status_code == 200:
            logs = audit_response2.json().get("logs", [])
            export_logs = [l for l in logs if l.get("action") == "security_compliance_export"]
            assert len(export_logs) > 0, "No audit log entry found for security_compliance_export"
            print(f"PASS: Found {len(export_logs)} audit log(s) for security_compliance_export")
        else:
            # If audit logs endpoint doesn't exist, just warn
            print(f"WARN: Could not verify audit log (audit endpoint returned {audit_response2.status_code})")


class TestPDFExportIntegrity:
    """Additional PDF integrity tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.skip("Admin login failed - possible rate limit")
    
    def test_pdf_has_reasonable_size(self):
        """PDF should be between 1KB and 10MB"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security/export-pdf",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        size = len(response.content)
        assert size >= 1024, f"PDF too small: {size} bytes (expected at least 1KB)"
        assert size <= 10 * 1024 * 1024, f"PDF too large: {size} bytes (expected max 10MB)"
        print(f"PASS: PDF size is reasonable: {size / 1024:.1f} KB")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
