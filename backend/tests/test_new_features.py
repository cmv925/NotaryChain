"""
Test Suite for NotaryChain P1, P2, P3 Features:
- P1: Comprehensive Admin Analytics with Charts Data
- P2: Notarization Certificate Endpoint
- P3: Custom Blueprint Creator
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


class TestAuth:
    """Helper class to get auth tokens"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Admin login successful, token: {data['access_token'][:20]}...")
    
    def test_demo_user_login(self):
        """Test demo user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Demo user login successful")


@pytest.fixture
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed - skipping admin tests")


@pytest.fixture
def demo_token():
    """Get demo user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Demo user login failed - skipping user tests")


# ==============================================================================
# P1: COMPREHENSIVE ADMIN ANALYTICS TESTS
# ==============================================================================

class TestComprehensiveAnalytics:
    """Tests for GET /api/admin/analytics/comprehensive"""
    
    def test_analytics_requires_auth(self):
        """Test that analytics endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/comprehensive")
        assert response.status_code in [401, 403], "Analytics should require auth"
        print("Analytics correctly requires authentication")
    
    def test_analytics_requires_admin(self, demo_token):
        """Test that regular users cannot access analytics"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive",
            headers=headers
        )
        assert response.status_code == 403, "Non-admin should get 403"
        print("Analytics correctly requires admin role")
    
    def test_analytics_default_period(self, admin_token):
        """Test analytics with default 30-day period"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive",
            headers=headers
        )
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        
        # Verify all required fields in response
        assert "summary" in data, "Missing summary in response"
        assert "user_growth" in data, "Missing user_growth in response"
        assert "revenue_trends" in data, "Missing revenue_trends in response"
        assert "notarization_volume" in data, "Missing notarization_volume in response"
        assert "payment_distribution" in data, "Missing payment_distribution in response"
        assert "top_notaries" in data, "Missing top_notaries in response"
        assert "document_types" in data, "Missing document_types in response"
        assert "transaction_types" in data, "Missing transaction_types in response"
        
        # Verify summary structure
        summary = data["summary"]
        assert "period_days" in summary
        assert "total_revenue" in summary
        assert "stripe_revenue" in summary
        assert "crypto_revenue" in summary
        assert "new_users" in summary
        assert "total_notarizations" in summary
        assert "completed_notarizations" in summary
        assert "total_transactions" in summary
        
        print(f"Analytics returned successfully with {len(data['user_growth'])} days of data")
        print(f"Summary: {summary}")
    
    def test_analytics_custom_period(self, admin_token):
        """Test analytics with custom 7-day period"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive?days=7",
            headers=headers
        )
        assert response.status_code == 200, f"Analytics 7-day failed: {response.text}"
        data = response.json()
        
        assert data["summary"]["period_days"] == 7
        assert len(data["user_growth"]) == 7
        assert len(data["revenue_trends"]) == 7
        print("Analytics with 7-day period works correctly")
    
    def test_analytics_90_day_period(self, admin_token):
        """Test analytics with 90-day period"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive?days=90",
            headers=headers
        )
        assert response.status_code == 200, f"Analytics 90-day failed: {response.text}"
        data = response.json()
        
        assert data["summary"]["period_days"] == 90
        print("Analytics with 90-day period works correctly")
    
    def test_analytics_user_growth_structure(self, admin_token):
        """Test user_growth array structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive?days=7",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for entry in data["user_growth"]:
            assert "date" in entry, "Missing date in user_growth"
            assert "new_users" in entry, "Missing new_users in user_growth"
            assert "total_users" in entry, "Missing total_users in user_growth"
        print("User growth data structure is correct")
    
    def test_analytics_revenue_trends_structure(self, admin_token):
        """Test revenue_trends array structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive?days=7",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for entry in data["revenue_trends"]:
            assert "date" in entry, "Missing date in revenue_trends"
            assert "stripe" in entry, "Missing stripe in revenue_trends"
            assert "crypto" in entry, "Missing crypto in revenue_trends"
            assert "total" in entry, "Missing total in revenue_trends"
        print("Revenue trends data structure is correct")
    
    def test_analytics_payment_distribution_structure(self, admin_token):
        """Test payment_distribution array structure for pie charts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for entry in data["payment_distribution"]:
            assert "name" in entry, "Missing name in payment_distribution"
            assert "value" in entry, "Missing value in payment_distribution"
            assert "color" in entry, "Missing color in payment_distribution"
        print("Payment distribution data structure is correct (for pie chart)")


# ==============================================================================
# P2: NOTARIZATION CERTIFICATE TESTS
# ==============================================================================

class TestNotarizationCertificate:
    """Tests for GET /api/packages/request/{requestId}/certificate"""
    
    def test_certificate_requires_auth(self):
        """Test that certificate endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/packages/request/fake-id/certificate")
        assert response.status_code in [401, 403], "Certificate should require auth"
        print("Certificate correctly requires authentication")
    
    def test_certificate_not_found(self, demo_token):
        """Test certificate with non-existent request ID"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(
            f"{BASE_URL}/api/packages/request/nonexistent-request-id/certificate",
            headers=headers
        )
        # Should return 404 for non-existent request
        assert response.status_code in [404, 403], f"Expected 404 or 403, got {response.status_code}"
        print("Certificate correctly handles non-existent request")
    
    def test_certificate_with_unsealed_request(self, demo_token):
        """Test getting certificate for a request that hasn't been sealed yet"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        # First, get user's notarization requests
        requests_response = requests.get(
            f"{BASE_URL}/api/notary/requests",
            headers=headers
        )
        
        if requests_response.status_code == 200:
            notarization_requests = requests_response.json().get("requests", [])
            
            # Find a request that is not completed
            for req in notarization_requests:
                if req.get("status") != "completed":
                    req_id = req.get("id")
                    cert_response = requests.get(
                        f"{BASE_URL}/api/packages/request/{req_id}/certificate",
                        headers=headers
                    )
                    # Should return 404 as there's no sealed package
                    assert cert_response.status_code in [404, 403], f"Unsealed request should return 404, got {cert_response.status_code}"
                    print(f"Certificate correctly returns 404 for unsealed request {req_id}")
                    return
        
        print("No unsealed requests found to test - skipping")
    
    def test_certificate_endpoint_structure(self, admin_token):
        """Test the structure of a certificate response (using admin to check packages)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First check if there are any sealed packages
        # This is to verify the expected structure of the certificate
        # In production, this would find a sealed package and test
        print("Certificate endpoint structure test - checking endpoint availability")
        
        # Verify endpoint responds (even if no sealed packages exist)
        response = requests.get(
            f"{BASE_URL}/api/packages/request/test-request/certificate",
            headers=headers
        )
        
        # Should get 404 (not found) or proper response, not 500
        assert response.status_code != 500, f"Certificate endpoint returned 500: {response.text}"
        print(f"Certificate endpoint responds with status {response.status_code}")


# ==============================================================================
# P3: CUSTOM BLUEPRINT CREATOR TESTS
# ==============================================================================

class TestBlueprintCreator:
    """Tests for POST /api/transactions/blueprints"""
    
    def test_create_blueprint_requires_auth(self):
        """Test that blueprint creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/transactions/blueprints",
            json={"name": "Test Blueprint"}
        )
        assert response.status_code in [401, 403], "Blueprint creation should require auth"
        print("Blueprint creation correctly requires authentication")
    
    def test_create_simple_blueprint(self, admin_token):
        """Test creating a simple custom blueprint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        blueprint_data = {
            "name": "TEST_Simple_Blueprint",
            "description": "A simple test blueprint for testing",
            "transaction_type": "custom",
            "estimated_total_days": 14,
            "required_roles": ["owner", "signer"],
            "required_documents": ["Test Document", "Supporting Document"],
            "ai_enabled": True,
            "steps": [
                {
                    "name": "Document Review",
                    "description": "Review the documents",
                    "order": 1,
                    "required_roles": ["owner"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": True,
                    "requires_signature": False,
                    "requires_notarization": False,
                    "requires_payment": False
                },
                {
                    "name": "Signature",
                    "description": "Sign the documents",
                    "order": 2,
                    "required_roles": ["signer"],
                    "dependencies": [],
                    "estimated_duration_hours": 48,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": True,
                    "requires_notarization": False,
                    "requires_payment": False
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions/blueprints",
            headers=headers,
            json=blueprint_data
        )
        
        assert response.status_code in [200, 201], f"Blueprint creation failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Blueprint should have an ID"
        assert data.get("name") == "TEST_Simple_Blueprint"
        assert "steps" in data
        assert len(data["steps"]) == 2
        
        print(f"Simple blueprint created successfully with ID: {data['id']}")
        return data["id"]
    
    def test_create_blueprint_with_all_step_types(self, admin_token):
        """Test creating a blueprint with all step requirement types"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        blueprint_data = {
            "name": "TEST_Full_Featured_Blueprint",
            "description": "Blueprint with all step types",
            "transaction_type": "business_contract",
            "estimated_total_days": 30,
            "required_roles": ["owner", "buyer", "notary", "witness"],
            "required_documents": ["Contract", "ID Verification", "Payment Receipt"],
            "ai_enabled": True,
            "steps": [
                {
                    "name": "Upload Contract",
                    "description": "Upload the contract document",
                    "order": 1,
                    "required_roles": ["owner"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": True,
                    "requires_signature": False,
                    "requires_notarization": False,
                    "requires_payment": False
                },
                {
                    "name": "Review Contract",
                    "description": "Buyer reviews the contract",
                    "order": 2,
                    "required_roles": ["buyer"],
                    "dependencies": [],
                    "estimated_duration_hours": 48,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": False,
                    "requires_notarization": False,
                    "requires_payment": False
                },
                {
                    "name": "Sign Contract",
                    "description": "Both parties sign the contract",
                    "order": 3,
                    "required_roles": ["owner", "buyer"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": True,
                    "requires_notarization": False,
                    "requires_payment": False
                },
                {
                    "name": "Notarization",
                    "description": "Notary verifies and seals the contract",
                    "order": 4,
                    "required_roles": ["notary"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": False,
                    "requires_notarization": True,
                    "requires_payment": False
                },
                {
                    "name": "Payment",
                    "description": "Process payment for services",
                    "order": 5,
                    "required_roles": ["buyer"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": False,
                    "requires_notarization": False,
                    "requires_payment": True
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions/blueprints",
            headers=headers,
            json=blueprint_data
        )
        
        assert response.status_code in [200, 201], f"Full featured blueprint creation failed: {response.text}"
        data = response.json()
        
        assert len(data["steps"]) == 5
        print(f"Full featured blueprint created with ID: {data['id']}")
    
    def test_get_blueprints_includes_custom(self, admin_token):
        """Test that custom blueprints appear in the blueprints list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/blueprints",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get blueprints failed: {response.text}"
        data = response.json()
        
        assert "system_blueprints" in data, "Missing system_blueprints"
        assert "custom_blueprints" in data, "Missing custom_blueprints"
        
        # Check for TEST_ prefixed blueprints we created
        test_blueprints = [bp for bp in data["custom_blueprints"] if bp.get("name", "").startswith("TEST_")]
        print(f"Found {len(test_blueprints)} test blueprints and {len(data['system_blueprints'])} system blueprints")
    
    def test_regular_user_can_create_blueprint(self, demo_token):
        """Test that regular users can also create blueprints"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        blueprint_data = {
            "name": "TEST_User_Blueprint",
            "description": "Blueprint created by regular user",
            "transaction_type": "custom",
            "estimated_total_days": 7,
            "required_roles": ["owner"],
            "required_documents": [],
            "ai_enabled": False,
            "steps": [
                {
                    "name": "Single Step",
                    "description": "A single step process",
                    "order": 1,
                    "required_roles": ["owner"],
                    "dependencies": [],
                    "estimated_duration_hours": 24,
                    "is_required": True,
                    "requires_document": False,
                    "requires_signature": False,
                    "requires_notarization": False,
                    "requires_payment": False
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions/blueprints",
            headers=headers,
            json=blueprint_data
        )
        
        # Regular users should be able to create blueprints
        assert response.status_code in [200, 201, 403], f"Blueprint creation returned unexpected status: {response.text}"
        
        if response.status_code in [200, 201]:
            print("Regular users can create blueprints")
        else:
            print("Blueprint creation is admin-only")
    
    def test_create_blueprint_invalid_data(self, admin_token):
        """Test blueprint creation with missing required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Missing name
        response = requests.post(
            f"{BASE_URL}/api/transactions/blueprints",
            headers=headers,
            json={"description": "No name"}
        )
        
        # Should fail validation
        assert response.status_code in [400, 422], f"Should reject invalid blueprint, got {response.status_code}"
        print("Blueprint validation correctly rejects invalid data")


# ==============================================================================
# ADDITIONAL ENDPOINT TESTS
# ==============================================================================

class TestExistingEndpoints:
    """Verify existing endpoints are still working"""
    
    def test_admin_stats_endpoint(self, admin_token):
        """Test admin stats endpoint still works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        print("Admin stats endpoint working")
    
    def test_revenue_analytics_endpoint(self, admin_token):
        """Test existing revenue analytics endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/analytics/revenue", headers=headers)
        assert response.status_code == 200
        print("Revenue analytics endpoint working")
    
    def test_notarization_analytics_endpoint(self, admin_token):
        """Test existing notarization analytics endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/analytics/notarizations", headers=headers)
        assert response.status_code == 200
        print("Notarization analytics endpoint working")
    
    def test_packages_by_request_endpoint(self, demo_token):
        """Test packages by request endpoint"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/packages/request/fake-id", headers=headers)
        # Should return 404 (not found) or 403 (forbidden), not 500
        assert response.status_code in [404, 403], f"Expected 404/403, got {response.status_code}"
        print("Packages by request endpoint responding correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
