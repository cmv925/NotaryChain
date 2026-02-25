"""
Template Wizard API Tests
Tests for AI-assisted form fill wizard: PDF generation and AI suggest endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"


class TestTemplateWizardAuth:
    """Get auth token for template wizard API tests"""
    token = None
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token before tests"""
        if not TestTemplateWizardAuth.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestTemplateWizardAuth.token = data.get("access_token")
            assert TestTemplateWizardAuth.token, "No access_token in login response"
        self.token = TestTemplateWizardAuth.token


class TestPDFGeneration(TestTemplateWizardAuth):
    """Test POST /api/templates/{template_id}/generate - PDF generation"""
    
    def test_generate_nda_pdf_all_fields(self):
        """Generate PDF for NDA template with all required fields"""
        # NDA has 6 fields: disclosing_party, receiving_party, confidential_info, duration, effective_date, governing_state
        field_values = {
            "disclosing_party": "TEST_Acme Corporation",
            "receiving_party": "TEST_Beta Technologies Inc.",
            "confidential_info": "Trade secrets, proprietary technology, and business strategies related to Project Phoenix.",
            "duration": "3",
            "effective_date": "2026-01-15",
            "governing_state": "California"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_nda/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": field_values}
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.status_code} - {response.text}"
        
        # Check Content-Type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        # Check response is not empty and starts with PDF signature
        content = response.content
        assert len(content) > 0, "PDF content is empty"
        assert content[:5] == b"%PDF-", f"Response doesn't start with PDF signature. First bytes: {content[:20]}"
        
        print(f"PASS: Generated NDA PDF, size: {len(content)} bytes")
    
    def test_generate_power_of_attorney_pdf(self):
        """Generate PDF for Power of Attorney template"""
        field_values = {
            "principal_name": "TEST_John Smith",
            "agent_name": "TEST_Jane Doe",
            "powers_granted": "Full authority to manage financial accounts, sign legal documents, and conduct business transactions on behalf of the principal.",
            "effective_date": "2026-01-20",
            "state": "New York"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_power_of_attorney/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": field_values}
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.text}"
        
        # Verify PDF content
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert response.content[:5] == b"%PDF-"
        
        print(f"PASS: Generated Power of Attorney PDF, size: {len(response.content)} bytes")
    
    def test_generate_lease_agreement_pdf(self):
        """Generate PDF for Residential Lease Agreement"""
        field_values = {
            "landlord_name": "TEST_Property Management LLC",
            "tenant_name": "TEST_Robert Johnson",
            "property_address": "123 Main Street, Apt 4B, San Francisco, CA 94102",
            "monthly_rent": "2500",
            "lease_start": "2026-02-01",
            "lease_end": "2027-01-31",
            "security_deposit": "5000",
            "special_terms": "No pets allowed. Quiet hours 10pm-8am."
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_lease_agreement/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": field_values}
        )
        
        assert response.status_code == 200
        assert response.content[:5] == b"%PDF-"
        
        print(f"PASS: Generated Lease Agreement PDF, size: {len(response.content)} bytes")
    
    def test_generate_affidavit_pdf(self):
        """Generate PDF for General Affidavit"""
        field_values = {
            "affiant_name": "TEST_Maria Garcia",
            "affiant_address": "456 Oak Avenue, Los Angeles, CA 90001",
            "statement_of_facts": "I, Maria Garcia, hereby state and affirm that I witnessed the signing of the document referenced in case #2026-001234 on January 10, 2026.",
            "purpose": "Court proceeding - Witness statement"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_affidavit/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": field_values}
        )
        
        assert response.status_code == 200
        assert response.content[:5] == b"%PDF-"
        
        print(f"PASS: Generated Affidavit PDF, size: {len(response.content)} bytes")
    
    def test_generate_pdf_empty_optional_fields(self):
        """Generate PDF with only required fields (optional fields empty)"""
        # NDA: all 6 fields are required except none
        # Use Real Estate Purchase which has optional contingencies field
        field_values = {
            "buyer_name": "TEST_Alice Williams",
            "seller_name": "TEST_Bob Anderson",
            "property_address": "789 Pine Road, Seattle, WA 98101",
            "purchase_price": "450000",
            "earnest_money": "15000",
            "closing_date": "2026-03-15"
            # contingencies is optional - not including it
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_real_estate_purchase/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": field_values}
        )
        
        assert response.status_code == 200
        assert response.content[:5] == b"%PDF-"
        
        print(f"PASS: Generated PDF with optional fields empty")
    
    def test_generate_pdf_nonexistent_template(self):
        """POST /api/templates/nonexistent/generate should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/templates/nonexistent/generate",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"field_values": {"some_field": "some_value"}}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"PASS: Generate PDF for non-existent template returns 404")
    
    def test_generate_pdf_no_auth(self):
        """Generate PDF should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_nda/generate",
            json={"field_values": {"disclosing_party": "Test"}}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"PASS: Generate PDF requires authentication")


class TestAISuggest(TestTemplateWizardAuth):
    """Test POST /api/templates/{template_id}/ai-suggest - AI suggestion for fields"""
    
    def test_ai_suggest_confidential_info_field(self):
        """AI should suggest content for confidential_info textarea field in NDA"""
        request_body = {
            "field_label": "Description of Confidential Information",
            "field_name": "confidential_info",
            "existing_values": {
                "disclosing_party": "TechCorp Inc.",
                "receiving_party": "Innovation Labs"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_nda/ai-suggest",
            headers={"Authorization": f"Bearer {self.token}"},
            json=request_body,
            timeout=30  # AI can take a few seconds
        )
        
        assert response.status_code == 200, f"AI suggest failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "suggestion" in data, f"Response missing 'suggestion' field: {data}"
        
        suggestion = data["suggestion"]
        assert len(suggestion) > 10, f"Suggestion too short: {suggestion}"
        assert isinstance(suggestion, str), f"Suggestion should be string, got {type(suggestion)}"
        
        print(f"PASS: AI suggestion received ({len(suggestion)} chars): {suggestion[:100]}...")
    
    def test_ai_suggest_powers_granted_field(self):
        """AI should suggest content for powers_granted field in Power of Attorney"""
        request_body = {
            "field_label": "Specific Powers Granted",
            "field_name": "powers_granted",
            "existing_values": {
                "principal_name": "John Smith",
                "agent_name": "Jane Doe"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_power_of_attorney/ai-suggest",
            headers={"Authorization": f"Bearer {self.token}"},
            json=request_body,
            timeout=30
        )
        
        assert response.status_code == 200, f"AI suggest failed: {response.text}"
        
        data = response.json()
        assert "suggestion" in data
        assert len(data["suggestion"]) > 10
        
        print(f"PASS: AI suggestion for powers_granted received ({len(data['suggestion'])} chars)")
    
    def test_ai_suggest_statement_of_facts(self):
        """AI should suggest content for statement_of_facts in Affidavit"""
        request_body = {
            "field_label": "Statement of Facts",
            "field_name": "statement_of_facts",
            "existing_values": {
                "affiant_name": "Maria Garcia",
                "purpose": "Insurance claim"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_affidavit/ai-suggest",
            headers={"Authorization": f"Bearer {self.token}"},
            json=request_body,
            timeout=30
        )
        
        assert response.status_code == 200
        assert "suggestion" in response.json()
        
        print(f"PASS: AI suggestion for statement_of_facts received")
    
    def test_ai_suggest_beneficiaries_field(self):
        """AI should suggest content for beneficiaries field in Last Will"""
        request_body = {
            "field_label": "Beneficiaries & Distributions",
            "field_name": "beneficiaries",
            "existing_values": {
                "testator_name": "Robert Johnson",
                "executor_name": "Emily Johnson"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_last_will/ai-suggest",
            headers={"Authorization": f"Bearer {self.token}"},
            json=request_body,
            timeout=30
        )
        
        assert response.status_code == 200
        assert "suggestion" in response.json()
        
        print(f"PASS: AI suggestion for beneficiaries field received")
    
    def test_ai_suggest_nonexistent_template(self):
        """AI suggest for non-existent template should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/templates/nonexistent/ai-suggest",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "field_label": "Some Field",
                "field_name": "some_field",
                "existing_values": {}
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"PASS: AI suggest for non-existent template returns 404")
    
    def test_ai_suggest_no_auth(self):
        """AI suggest should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/templates/tpl_nda/ai-suggest",
            json={
                "field_label": "Description of Confidential Information",
                "field_name": "confidential_info",
                "existing_values": {}
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"PASS: AI suggest requires authentication")


class TestNDATemplateFields(TestTemplateWizardAuth):
    """Test NDA template has correct field structure for wizard"""
    
    def test_nda_has_six_fields(self):
        """NDA template should have exactly 6 fields"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_nda",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        template = response.json()
        
        assert len(template["fields"]) == 6, f"Expected 6 fields, got {len(template['fields'])}"
        
        print(f"PASS: NDA template has 6 fields")
    
    def test_nda_field_types(self):
        """Verify NDA field types: 4 text, 1 textarea, 1 number, 1 date"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_nda",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        fields = response.json()["fields"]
        
        # Count field types
        type_counts = {}
        for f in fields:
            ftype = f["type"]
            type_counts[ftype] = type_counts.get(ftype, 0) + 1
        
        # Based on NDA template definition:
        # disclosing_party: text, receiving_party: text, confidential_info: textarea
        # duration: number, effective_date: date, governing_state: text
        assert type_counts.get("text", 0) == 3, f"Expected 3 text fields, got {type_counts.get('text', 0)}"
        assert type_counts.get("textarea", 0) == 1, f"Expected 1 textarea field, got {type_counts.get('textarea', 0)}"
        assert type_counts.get("number", 0) == 1, f"Expected 1 number field, got {type_counts.get('number', 0)}"
        assert type_counts.get("date", 0) == 1, f"Expected 1 date field, got {type_counts.get('date', 0)}"
        
        print(f"PASS: NDA field types correct - text:3, textarea:1, number:1, date:1")
    
    def test_nda_textarea_field_is_confidential_info(self):
        """The textarea field should be confidential_info (for AI suggest)"""
        response = requests.get(
            f"{BASE_URL}/api/templates/tpl_nda",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        fields = response.json()["fields"]
        
        textarea_fields = [f for f in fields if f["type"] == "textarea"]
        assert len(textarea_fields) == 1
        assert textarea_fields[0]["name"] == "confidential_info"
        
        print(f"PASS: Textarea field is confidential_info")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
