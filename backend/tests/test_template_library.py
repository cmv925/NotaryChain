"""
Template Library API Tests
Tests for document template browsing, filtering, preview, and use flows
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"


class TestTemplateLibraryAuth:
    """Get auth token for template API tests"""
    token = None
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token before tests"""
        if not TestTemplateLibraryAuth.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestTemplateLibraryAuth.token = data.get("access_token")
            assert TestTemplateLibraryAuth.token, "No access_token in login response"
        self.token = TestTemplateLibraryAuth.token


class TestTemplateList(TestTemplateLibraryAuth):
    """Test GET /api/templates/ - list all templates"""
    
    def test_list_all_templates(self):
        """Should return all 8 seeded templates"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Failed to list templates: {response.text}"
        
        data = response.json()
        assert "templates" in data
        assert "categories" in data
        assert "total" in data
        
        # Should have 8 seeded templates
        assert len(data["templates"]) == 8, f"Expected 8 templates, got {len(data['templates'])}"
        assert data["total"] == 8
        
        # Check categories returned
        categories = data["categories"]
        assert "legal" in categories
        assert "real_estate" in categories
        assert "business" in categories
        assert "estate" in categories
        
        print(f"PASS: Listed {data['total']} templates with {len(categories)} categories")
    
    def test_template_structure(self):
        """Templates should have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        
        templates = response.json()["templates"]
        assert len(templates) > 0
        
        # Check first template has all required fields
        template = templates[0]
        required_fields = ["id", "name", "category", "document_type", "description", 
                          "fields", "icon", "estimated_time", "notarization_required", 
                          "signers_needed"]
        for field in required_fields:
            assert field in template, f"Template missing field: {field}"
        
        print(f"PASS: Template structure valid with all required fields")


class TestTemplateFiltering(TestTemplateLibraryAuth):
    """Test template filtering by category and search"""
    
    def test_filter_by_business_category(self):
        """GET /api/templates/?category=business should return 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"category": "business"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["total"] == 2, f"Expected 2 business templates, got {data['total']}"
        
        # Verify all returned templates are business category
        for template in data["templates"]:
            assert template["category"] == "business", f"Template {template['name']} is not business category"
        
        # Should include NDA and General Service Contract
        template_names = [t["name"] for t in data["templates"]]
        assert "Non-Disclosure Agreement (NDA)" in template_names
        assert "General Service Contract" in template_names
        
        print(f"PASS: Business filter returned {data['total']} templates")
    
    def test_filter_by_real_estate_category(self):
        """Filter by real_estate category should return 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"category": "real_estate"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 2, f"Expected 2 real_estate templates, got {data['total']}"
        
        print(f"PASS: Real estate filter returned {data['total']} templates")
    
    def test_filter_by_legal_category(self):
        """Filter by legal category should return 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"category": "legal"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 2, f"Expected 2 legal templates, got {data['total']}"
        
        print(f"PASS: Legal filter returned {data['total']} templates")
    
    def test_filter_by_estate_category(self):
        """Filter by estate category should return 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"category": "estate"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 2, f"Expected 2 estate templates, got {data['total']}"
        
        print(f"PASS: Estate filter returned {data['total']} templates")
    
    def test_search_by_lease(self):
        """GET /api/templates/?search=lease should find 1 result"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"search": "lease"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["total"] == 1, f"Expected 1 search result for 'lease', got {data['total']}"
        
        # Should find the Residential Lease Agreement
        assert data["templates"][0]["name"] == "Residential Lease Agreement"
        
        print(f"PASS: Search 'lease' returned {data['total']} result")
    
    def test_search_by_nda(self):
        """Search for 'nda' should find NDA template"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"search": "nda"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] >= 1, f"Expected at least 1 result for 'nda'"
        
        template_names = [t["name"].lower() for t in data["templates"]]
        assert any("nda" in name for name in template_names), "NDA template not found in search"
        
        print(f"PASS: Search 'nda' found the NDA template")
    
    def test_search_no_results(self):
        """Search for non-existent term should return empty"""
        response = requests.get(
            f"{BASE_URL}/api/templates/",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"search": "xyznonexistent123"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 0, f"Expected 0 results, got {data['total']}"
        
        print(f"PASS: Search for non-existent term returned 0 results")


class TestTemplateById(TestTemplateLibraryAuth):
    """Test GET /api/templates/{template_id}"""
    
    def test_get_nda_template(self):
        """GET /api/templates/tpl_nda should return NDA template"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_nda",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        template = response.json()
        assert template["id"] == "tpl_nda"
        assert template["name"] == "Non-Disclosure Agreement (NDA)"
        assert template["category"] == "business"
        assert template["document_type"] == "contract"
        assert template["signers_needed"] == 2
        assert template["notarization_required"] == False
        
        # Verify fields structure
        assert "fields" in template
        assert len(template["fields"]) == 6
        
        field_names = [f["name"] for f in template["fields"]]
        assert "disclosing_party" in field_names
        assert "receiving_party" in field_names
        
        print(f"PASS: Got NDA template with {len(template['fields'])} fields")
    
    def test_get_power_of_attorney_template(self):
        """GET /api/templates/tpl_power_of_attorney should work"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_power_of_attorney",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        
        template = response.json()
        assert template["id"] == "tpl_power_of_attorney"
        assert template["name"] == "General Power of Attorney"
        assert template["notarization_required"] == True
        assert template["signers_needed"] == 2
        
        print(f"PASS: Got Power of Attorney template")
    
    def test_get_nonexistent_template(self):
        """GET /api/templates/nonexistent should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/templates/nonexistent_template_id",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"PASS: Non-existent template returns 404")


class TestTemplatePreview(TestTemplateLibraryAuth):
    """Test GET /api/templates/{template_id}/preview"""
    
    def test_preview_nda_template(self):
        """GET /api/templates/tpl_nda/preview should return preview data"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_nda/preview",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        preview = response.json()
        
        # Check preview fields
        assert preview["id"] == "tpl_nda"
        assert preview["name"] == "Non-Disclosure Agreement (NDA)"
        assert "description" in preview
        assert "fields" in preview
        assert "signers_needed" in preview
        assert "estimated_time" in preview
        assert "notarization_required" in preview
        
        # Verify fields include required info
        assert preview["signers_needed"] == 2
        assert preview["estimated_time"] == "10-15 min"
        assert preview["notarization_required"] == False
        
        print(f"PASS: Preview endpoint returns correct data with {len(preview['fields'])} fields")
    
    def test_preview_affidavit_template(self):
        """Preview affidavit template to verify notarization_required is True"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_affidavit/preview",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        
        preview = response.json()
        assert preview["notarization_required"] == True
        assert preview["signers_needed"] == 1
        
        print(f"PASS: Affidavit preview shows notarization required")
    
    def test_preview_nonexistent_template(self):
        """Preview of non-existent template should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/templates/nonexistent/preview",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404
        
        print(f"PASS: Preview of non-existent template returns 404")


class TestTemplateAuthRequired(TestTemplateLibraryAuth):
    """Test that template endpoints require authentication"""
    
    def test_list_templates_no_auth(self):
        """Templates list should require auth"""
        response = requests.get(f"{BASE_URL}/api/templates/")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"PASS: List templates requires authentication")
    
    def test_get_template_no_auth(self):
        """Get single template should require auth"""
        response = requests.get(f"{BASE_URL}/api/templates/tpl_nda")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"PASS: Get template requires authentication")
    
    def test_preview_template_no_auth(self):
        """Preview template should require auth"""
        response = requests.get(f"{BASE_URL}/api/templates/tpl_nda/preview")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"PASS: Preview template requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
