"""
AI & Video Witness Features - Comprehensive Test Suite
Tests: AI Document Generator, AI Document Summarizer, Video Witness, AI Co-pilot
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-docs-7.preview.emergentagent.com').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}
NOTARY_USER = {"email": "notarytest@test.com", "password": "Test123!"}


class TestSetup:
    """Shared fixtures and utilities"""
    
    @staticmethod
    def login(email: str, password: str) -> dict:
        """Login and return access_token and user info."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user_id": data.get("user_id"),
                "requires_2fa": data.get("requires_2fa", False),
            }
        return None


@pytest.fixture(scope="module")
def demo_auth():
    """Get demo user auth token."""
    auth = TestSetup.login(DEMO_USER["email"], DEMO_USER["password"])
    if not auth or not auth.get("token"):
        pytest.skip("Demo user login failed")
    return auth


@pytest.fixture(scope="module")
def admin_auth():
    """Get admin/notary user auth token."""
    auth = TestSetup.login(ADMIN_USER["email"], ADMIN_USER["password"])
    if not auth or not auth.get("token"):
        pytest.skip("Admin user login failed")
    return auth


@pytest.fixture(scope="module")
def notary_auth():
    """Get notary user auth token."""
    auth = TestSetup.login(NOTARY_USER["email"], NOTARY_USER["password"])
    if not auth or not auth.get("token"):
        pytest.skip("Notary user login failed")
    return auth


# ==================== AI Document Generator Tests ====================

class TestAIDocumentGenerator:
    """Test /api/ai-generator/* endpoints"""
    
    def test_get_document_types(self, demo_auth):
        """GET /api/ai-generator/types - Should return available document types."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/ai-generator/types", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "types" in data, "Response should have 'types' key"
        assert len(data["types"]) > 0, "Should have at least one document type"
        
        # Verify expected types
        type_ids = [t["id"] for t in data["types"]]
        assert "nda" in type_ids, "Should have NDA type"
        assert "bill_of_sale" in type_ids, "Should have Bill of Sale type"
        print(f"PASS: Got {len(data['types'])} document types: {type_ids}")
    
    def test_generate_document_success(self, demo_auth):
        """POST /api/ai-generator/generate - Create document from description."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        payload = {
            "description": "I need a basic NDA between Company A and Company B for a software development project.",
            "document_type": "nda"
        }
        response = requests.post(f"{BASE_URL}/api/ai-generator/generate", json=payload, headers=headers, timeout=45)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "generation_id" in data, "Response should have generation_id"
        assert "document" in data, "Response should have document"
        
        doc = data["document"]
        assert "title" in doc, "Document should have title"
        assert "sections" in doc, "Document should have sections"
        print(f"PASS: Generated document '{doc['title']}' with {len(doc.get('sections', []))} sections")
        
        # Store for later tests
        pytest.generated_doc_id = data["generation_id"]
    
    def test_generate_document_empty_description(self, demo_auth):
        """POST /api/ai-generator/generate - Should fail with empty description."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        payload = {"description": ""}
        response = requests.post(f"{BASE_URL}/api/ai-generator/generate", json=payload, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Empty description correctly rejected")
    
    def test_get_my_documents(self, demo_auth):
        """GET /api/ai-generator/my-documents - Get user's generated documents."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/ai-generator/my-documents", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "documents" in data, "Response should have 'documents' key"
        print(f"PASS: Got {len(data['documents'])} user documents")
    
    def test_get_document_by_id(self, demo_auth):
        """GET /api/ai-generator/documents/{gen_id} - Get specific document."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        # First generate a document to get an ID
        gen_payload = {
            "description": "Simple promissory note for $5000 loan",
            "document_type": "promissory_note"
        }
        gen_response = requests.post(f"{BASE_URL}/api/ai-generator/generate", json=gen_payload, headers=headers, timeout=45)
        if gen_response.status_code != 200:
            pytest.skip("Could not generate document for ID test")
        
        gen_id = gen_response.json()["generation_id"]
        
        # Now fetch it
        response = requests.get(f"{BASE_URL}/api/ai-generator/documents/{gen_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["id"] == gen_id, "Should return the correct document"
        print(f"PASS: Retrieved document {gen_id}")
    
    def test_get_document_not_found(self, demo_auth):
        """GET /api/ai-generator/documents/{gen_id} - Should 404 for invalid ID."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/ai-generator/documents/invalid-uuid", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid document ID returns 404")
    
    def test_refine_document(self, demo_auth):
        """POST /api/ai-generator/refine - Refine an existing document."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        # First generate a document
        gen_payload = {"description": "Basic lease agreement for apartment", "document_type": "lease_agreement"}
        gen_response = requests.post(f"{BASE_URL}/api/ai-generator/generate", json=gen_payload, headers=headers, timeout=45)
        if gen_response.status_code != 200:
            pytest.skip("Could not generate document for refine test")
        
        gen_id = gen_response.json()["generation_id"]
        
        # Now refine it
        refine_payload = {
            "generation_id": gen_id,
            "feedback": "Add a section about pet policy - no pets allowed"
        }
        response = requests.post(f"{BASE_URL}/api/ai-generator/refine", json=refine_payload, headers=headers, timeout=45)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["generation_id"] == gen_id, "Should return same generation_id"
        assert "document" in data, "Should have updated document"
        print("PASS: Document refined successfully")


# ==================== AI Document Summarizer Tests ====================

class TestAIDocumentSummarizer:
    """Test /api/ai-summarizer/* endpoints"""
    
    def test_get_summary_history_initially(self, demo_auth):
        """GET /api/ai-summarizer/history - Get user's summary history."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/ai-summarizer/history", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "summaries" in data, "Response should have 'summaries' key"
        print(f"PASS: Got {len(data['summaries'])} summaries in history")
    
    def test_summarize_document_with_text_file(self, demo_auth):
        """POST /api/ai-summarizer/summarize - Upload and summarize a text file."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        # Create a simple text file for testing
        test_content = """
        MUTUAL NON-DISCLOSURE AGREEMENT
        
        This Agreement is made between Party A ("Disclosing Party") and Party B ("Receiving Party").
        
        1. CONFIDENTIAL INFORMATION: All business, technical, and financial information.
        
        2. OBLIGATIONS: The Receiving Party agrees to:
           - Keep all information confidential
           - Not disclose to third parties
           - Return all materials upon request
        
        3. TERM: This agreement shall remain in effect for 2 years from the date of signing.
        
        4. GOVERNING LAW: This Agreement shall be governed by the laws of California.
        
        Signed on January 15, 2026.
        """
        
        files = {
            'file': ('test_nda.txt', test_content.encode('utf-8'), 'text/plain'),
        }
        data = {'detail_level': 'standard'}
        
        response = requests.post(f"{BASE_URL}/api/ai-summarizer/summarize", headers=headers, files=files, data=data, timeout=45)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        
        assert "id" in result, "Should have summary ID"
        assert "result" in result, "Should have result object"
        assert "summary" in result["result"], "Result should have summary"
        print(f"PASS: Summary created - type detected: {result['result'].get('document_type_detected', 'N/A')}")
    
    def test_summarize_unsupported_file_type(self, demo_auth):
        """POST /api/ai-summarizer/summarize - Should reject unsupported file types."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        files = {
            'file': ('test.xyz', b'some content', 'application/octet-stream'),
        }
        data = {'detail_level': 'standard'}
        
        response = requests.post(f"{BASE_URL}/api/ai-summarizer/summarize", headers=headers, files=files, data=data)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Unsupported file type correctly rejected")
    
    def test_get_specific_summary(self, demo_auth):
        """GET /api/ai-summarizer/history/{summary_id} - Get specific summary."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        # First get history to find an ID
        history_response = requests.get(f"{BASE_URL}/api/ai-summarizer/history", headers=headers)
        if history_response.status_code != 200:
            pytest.skip("Could not get history")
        
        summaries = history_response.json().get("summaries", [])
        if not summaries:
            pytest.skip("No summaries in history to test")
        
        summary_id = summaries[0]["id"]
        response = requests.get(f"{BASE_URL}/api/ai-summarizer/history/{summary_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["id"] == summary_id, "Should return correct summary"
        print(f"PASS: Retrieved specific summary {summary_id}")


# ==================== Video Witness Tests ====================

class TestVideoWitness:
    """Test /api/video-witness/* endpoints"""
    
    def test_get_verification_instructions(self, demo_auth):
        """GET /api/video-witness/instructions - Get verification instruction types."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/video-witness/instructions", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "instructions" in data, "Response should have 'instructions' key"
        assert len(data["instructions"]) == 2, "Should have 2 instruction types"
        
        instr_ids = [i["id"] for i in data["instructions"]]
        assert "standard" in instr_ids, "Should have standard type"
        assert "enhanced" in instr_ids, "Should have enhanced type"
        print(f"PASS: Got {len(data['instructions'])} instruction types: {instr_ids}")
    
    def test_get_my_recordings_initially(self, demo_auth):
        """GET /api/video-witness/my - Get user's recordings."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/video-witness/my", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "recordings" in data, "Response should have 'recordings' key"
        print(f"PASS: Got {len(data['recordings'])} user recordings")
    
    def test_upload_video_invalid_request(self, demo_auth):
        """POST /api/video-witness/upload - Should fail with invalid request_id."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        # Create a small fake video file
        fake_video = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42mp41' + b'\x00' * 100
        
        files = {'file': ('test.webm', fake_video, 'video/webm')}
        data = {'request_id': 'invalid-uuid', 'instruction_type': 'standard'}
        
        response = requests.post(f"{BASE_URL}/api/video-witness/upload", headers=headers, files=files, data=data)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid request_id correctly rejected")
    
    def test_upload_unsupported_video_format(self, demo_auth):
        """POST /api/video-witness/upload - Should reject unsupported video formats."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        
        files = {'file': ('test.xyz', b'fake video content', 'video/x-unknown')}
        data = {'request_id': str(uuid.uuid4()), 'instruction_type': 'standard'}
        
        response = requests.post(f"{BASE_URL}/api/video-witness/upload", headers=headers, files=files, data=data)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Unsupported video format correctly rejected")


# ==================== AI Co-pilot Tests ====================

class TestAICopilot:
    """Test /api/ai-copilot/* endpoints"""
    
    def test_analyze_request_not_found(self, notary_auth):
        """POST /api/ai-copilot/analyze - Should 404 for invalid request."""
        headers = {"Authorization": f"Bearer {notary_auth['token']}"}
        payload = {"request_id": "invalid-uuid-12345"}
        
        response = requests.post(f"{BASE_URL}/api/ai-copilot/analyze", json=payload, headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid request_id returns 404")
    
    def test_prefill_journal_not_found(self, notary_auth):
        """POST /api/ai-copilot/prefill-journal - Should 404 for invalid request."""
        headers = {"Authorization": f"Bearer {notary_auth['token']}"}
        payload = {"request_id": "invalid-uuid-12345"}
        
        response = requests.post(f"{BASE_URL}/api/ai-copilot/prefill-journal", json=payload, headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid request_id returns 404 for prefill-journal")
    
    def test_analyze_with_valid_request(self, notary_auth):
        """POST /api/ai-copilot/analyze - Test with a real notarization request."""
        headers = {"Authorization": f"Bearer {notary_auth['token']}"}
        
        # First get any pending or assigned request
        pending_response = requests.get(f"{BASE_URL}/api/notary/requests/pending", headers=headers)
        assigned_response = requests.get(f"{BASE_URL}/api/notary/requests/assigned", headers=headers)
        
        request_id = None
        if pending_response.status_code == 200 and pending_response.json():
            request_id = pending_response.json()[0]["id"]
        elif assigned_response.status_code == 200 and assigned_response.json():
            request_id = assigned_response.json()[0]["id"]
        
        if not request_id:
            # Create a notarization request for testing
            demo_auth = TestSetup.login(DEMO_USER["email"], DEMO_USER["password"])
            if demo_auth:
                demo_headers = {"Authorization": f"Bearer {demo_auth['token']}"}
                create_payload = {
                    "document_name": f"TEST_Copilot_Doc_{uuid.uuid4().hex[:8]}",
                    "document_type": "affidavit",
                    "notarization_type": "acknowledgment",
                    "signers": [{"name": "Test Signer", "email": "test@example.com"}],
                }
                create_response = requests.post(f"{BASE_URL}/api/notary/requests", json=create_payload, headers=demo_headers, timeout=30)
                if create_response.status_code == 201:
                    request_id = create_response.json()["id"]
        
        if not request_id:
            pytest.skip("No notarization requests available for copilot test")
        
        payload = {"request_id": request_id}
        response = requests.post(f"{BASE_URL}/api/ai-copilot/analyze", json=payload, headers=headers, timeout=45)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "summary" in data, "Response should have summary"
        assert "risk_level" in data, "Response should have risk_level"
        assert "readiness_score" in data, "Response should have readiness_score"
        print(f"PASS: AI Copilot analysis - Risk: {data['risk_level']}, Readiness: {data['readiness_score']}/100")
        
        pytest.copilot_request_id = request_id
    
    def test_prefill_journal_with_valid_request(self, notary_auth):
        """POST /api/ai-copilot/prefill-journal - Test journal prefill."""
        headers = {"Authorization": f"Bearer {notary_auth['token']}"}
        
        request_id = getattr(pytest, 'copilot_request_id', None)
        if not request_id:
            pytest.skip("No request_id from previous copilot test")
        
        payload = {"request_id": request_id}
        response = requests.post(f"{BASE_URL}/api/ai-copilot/prefill-journal", json=payload, headers=headers, timeout=45)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify expected fields
        expected_fields = ["document_type", "document_name", "signer_name", "notarization_type"]
        for field in expected_fields:
            assert field in data, f"Response should have {field}"
        
        print(f"PASS: Journal prefill - Document: {data.get('document_name')}, Type: {data.get('notarization_type')}")


# ==================== Integration Tests ====================

class TestDashboardIntegration:
    """Test Dashboard quick action buttons lead to correct pages."""
    
    def test_verify_dashboard_loads(self, demo_auth):
        """Basic check that authenticated user can access dashboard data."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/documents/stats", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Dashboard stats accessible")
    
    def test_verify_notary_requests_endpoint(self, demo_auth):
        """GET /api/notary/requests/my - User's notarization requests."""
        headers = {"Authorization": f"Bearer {demo_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/notary/requests/my", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: User has {len(response.json())} notarization requests")


# ==================== Cleanup ====================

class TestCleanup:
    """Cleanup test data after all tests."""
    
    def test_cleanup_message(self):
        """Final message - test data may need cleanup."""
        print("NOTE: Test documents created with 'TEST_' prefix should be cleaned manually if needed")
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
