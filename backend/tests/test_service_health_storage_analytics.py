"""
Test Service Health Monitor, Storage Analytics, SOC2 PDF Export, and Audit Logs Fix
Tests for new features implemented in iteration 55:
1. Service Health endpoint - live checks for MongoDB, S3, Stripe, Hedera
2. Storage Analytics - per-user usage, upload trends, cost projections
3. SOC2 PDF Export - downloadable security compliance report
4. Audit Logs 500 Error Fix - AuditLogResponse defaults and timestamp handling
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module-level shared tokens to avoid rate limiting
_admin_token = None
_admin_headers = None
_user_token = None
_user_headers = None


def get_admin_auth():
    """Get or create admin authentication - reused across tests"""
    global _admin_token, _admin_headers
    if _admin_token is None:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@notarychain.com",
            "password": "Admin123!"
        })
        if response.status_code != 200:
            raise Exception(f"Admin login failed: {response.text}")
        _admin_token = response.json().get("access_token")
        _admin_headers = {"Authorization": f"Bearer {_admin_token}"}
    return _admin_headers


def get_user_auth():
    """Get or create regular user authentication - reused across tests"""
    global _user_token, _user_headers
    if _user_token is None:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            _user_token = response.json().get("access_token")
            _user_headers = {"Authorization": f"Bearer {_user_token}"}
        else:
            _user_headers = {}
    return _user_headers


class TestServiceHealthEndpoint:
    """Test GET /api/admin/ops/service-health"""
    
    def test_service_health_returns_200(self):
        """Service health endpoint returns 200 for admin"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_service_health_returns_services_array(self):
        """Response contains services array with 4 services"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        assert "services" in data, "Missing 'services' field"
        assert isinstance(data["services"], list), "services should be an array"
        assert len(data["services"]) == 4, f"Expected 4 services, got {len(data['services'])}"
    
    def test_service_health_mongodb_status(self):
        """MongoDB service has correct structure and status"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        mongodb = next((s for s in data["services"] if s["service"] == "MongoDB"), None)
        assert mongodb is not None, "MongoDB service not found"
        assert "status" in mongodb, "MongoDB missing 'status' field"
        assert "detail" in mongodb, "MongoDB missing 'detail' field"
        assert mongodb["status"] == "healthy", f"MongoDB expected healthy, got {mongodb['status']}"
    
    def test_service_health_aws_s3_status(self):
        """AWS S3 service has correct structure"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        s3 = next((s for s in data["services"] if s["service"] == "AWS S3"), None)
        assert s3 is not None, "AWS S3 service not found"
        assert "status" in s3, "AWS S3 missing 'status' field"
        assert s3["status"] in ["healthy", "degraded", "not_configured"], f"Invalid status: {s3['status']}"
    
    def test_service_health_stripe_status(self):
        """Stripe service has correct structure (expected not_configured)"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        stripe = next((s for s in data["services"] if s["service"] == "Stripe"), None)
        assert stripe is not None, "Stripe service not found"
        assert "status" in stripe, "Stripe missing 'status' field"
        assert stripe["status"] in ["healthy", "degraded", "not_configured"], f"Invalid status: {stripe['status']}"
    
    def test_service_health_hedera_status(self):
        """Hedera service has correct structure"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        hedera = next((s for s in data["services"] if s["service"] == "Hedera"), None)
        assert hedera is not None, "Hedera service not found"
        assert "status" in hedera, "Hedera missing 'status' field"
        assert "detail" in hedera, "Hedera missing 'detail' field"
    
    def test_service_health_returns_recent_alerts(self):
        """Response contains recent_alerts array"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        assert "recent_alerts" in data, "Missing 'recent_alerts' field"
        assert isinstance(data["recent_alerts"], list), "recent_alerts should be an array"
    
    def test_service_health_returns_checked_at(self):
        """Response contains checked_at timestamp"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=headers)
        data = response.json()
        
        assert "checked_at" in data, "Missing 'checked_at' field"
        assert isinstance(data["checked_at"], str), "checked_at should be a string"
    
    def test_service_health_requires_admin_role(self):
        """Non-admin user gets 403 Forbidden"""
        user_headers = get_user_auth()
        if user_headers:
            response = requests.get(f"{BASE_URL}/api/admin/ops/service-health", headers=user_headers)
            assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        else:
            pytest.skip("Regular user token not available")


class TestStorageAnalyticsEndpoint:
    """Test GET /api/admin/ops/storage-analytics"""
    
    def test_storage_analytics_returns_200(self):
        """Storage analytics endpoint returns 200 for admin"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/storage-analytics", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_storage_analytics_returns_per_user(self):
        """Response contains per_user array"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/storage-analytics", headers=headers)
        data = response.json()
        
        assert "per_user" in data, "Missing 'per_user' field"
        assert isinstance(data["per_user"], list), "per_user should be an array"
    
    def test_storage_analytics_returns_activity_trend(self):
        """Response contains activity_trend array"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/storage-analytics", headers=headers)
        data = response.json()
        
        assert "activity_trend" in data, "Missing 'activity_trend' field"
        assert isinstance(data["activity_trend"], list), "activity_trend should be an array"
    
    def test_storage_analytics_returns_totals(self):
        """Response contains total stats"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/storage-analytics", headers=headers)
        data = response.json()
        
        assert "total_vault_docs" in data, "Missing 'total_vault_docs' field"
        assert "total_vault_size_mb" in data, "Missing 'total_vault_size_mb' field"
        assert "total_downloads" in data, "Missing 'total_downloads' field"
    
    def test_storage_analytics_returns_cost_projection(self):
        """Response contains cost_projection object"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/ops/storage-analytics", headers=headers)
        data = response.json()
        
        assert "cost_projection" in data, "Missing 'cost_projection' field"
        projection = data["cost_projection"]
        
        assert "current_gb" in projection, "Missing 'current_gb'"
        assert "monthly_cost_usd" in projection, "Missing 'monthly_cost_usd'"
        assert "projected_12m_cost_usd" in projection, "Missing 'projected_12m_cost_usd'"
        assert "price_per_gb" in projection, "Missing 'price_per_gb'"
        assert "growth_rate_pct" in projection, "Missing 'growth_rate_pct'"


class TestSOC2PDFExport:
    """Test GET /api/admin/security/export-pdf"""
    
    def test_export_pdf_returns_200(self):
        """Export PDF endpoint returns 200 for admin"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/security/export-pdf", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_export_pdf_returns_pdf_content_type(self):
        """Export PDF returns application/pdf content type"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/security/export-pdf", headers=headers)
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got: {content_type}"
    
    def test_export_pdf_returns_valid_pdf(self):
        """Export PDF returns valid PDF content (starts with %PDF)"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/security/export-pdf", headers=headers)
        assert response.content.startswith(b"%PDF"), "PDF content should start with %PDF header"
    
    def test_export_pdf_has_content_disposition(self):
        """Export PDF has Content-Disposition header for download"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/admin/security/export-pdf", headers=headers)
        disposition = response.headers.get("content-disposition", "")
        assert "attachment" in disposition, f"Expected attachment disposition, got: {disposition}"
    
    def test_export_pdf_requires_admin(self):
        """Export PDF requires admin role"""
        user_headers = get_user_auth()
        if user_headers:
            response = requests.get(f"{BASE_URL}/api/admin/security/export-pdf", headers=user_headers)
            assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        else:
            pytest.skip("Regular user token not available")


class TestAuditLogsFix:
    """Test GET /api/audit/logs - previously returned 500 error, now fixed"""
    
    def test_audit_logs_returns_200(self):
        """Audit logs endpoint returns 200 (not 500)"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/audit/logs?page=1&page_size=10", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_audit_logs_returns_pagination(self):
        """Audit logs returns pagination fields"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/audit/logs?page=1&page_size=10", headers=headers)
        data = response.json()
        
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "page_size" in data, "Missing 'page_size' field"
        assert "logs" in data, "Missing 'logs' field"
    
    def test_audit_logs_returns_valid_logs(self):
        """Audit logs returns valid log entries"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/audit/logs?page=1&page_size=5", headers=headers)
        data = response.json()
        
        if data["total"] > 0:
            assert len(data["logs"]) > 0, "Expected logs but got empty array"
            log = data["logs"][0]
            # Verify log structure
            assert "id" in log, "Log missing 'id' field"
            assert "action" in log, "Log missing 'action' field"
            assert "timestamp" in log, "Log missing 'timestamp' field"
    
    def test_audit_logs_timestamp_is_serialized(self):
        """Audit logs timestamp is properly serialized as string"""
        headers = get_admin_auth()
        response = requests.get(f"{BASE_URL}/api/audit/logs?page=1&page_size=5", headers=headers)
        data = response.json()
        
        if data["total"] > 0 and len(data["logs"]) > 0:
            log = data["logs"][0]
            assert isinstance(log["timestamp"], str), f"Timestamp should be string, got: {type(log['timestamp'])}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
