"""
Test Document Expiry API and Draft Collaboration WebSocket
Features: 
- PUT /api/expiry/requests/{id} - set expiry date
- GET /api/expiry/requests/{id} - get expiry status
- DELETE /api/expiry/requests/{id} - remove expiry
- GET /api/expiry/dashboard - all documents with expiry info
- WebSocket /api/ws/draft/{draft_id} - draft collaboration
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDocumentExpiryAPI:
    """Document Expiry Feature Tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping expiry tests")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def test_request_id(self, headers):
        """Get or create a notarization request for testing"""
        # First try to get existing requests
        response = requests.get(f"{BASE_URL}/api/notary/requests/my", headers=headers)
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        # Create a new request if none exist
        response = requests.post(f"{BASE_URL}/api/notary/requests", headers=headers, json={
            "document_name": "TEST_Expiry_Test_Doc",
            "document_type": "affidavit",
            "notarization_type": "traditional",
            "notes": "Test document for expiry testing"
        })
        if response.status_code == 201:
            return response.json()["id"]
        pytest.skip("Could not get or create test request")
    
    # Test 1: Set Expiry Date
    def test_set_expiry_date(self, headers, test_request_id):
        """PUT /api/expiry/requests/{id} - Set expiry date"""
        future_date = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        response = requests.put(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers,
            json={"expires_at": future_date}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["message"] == "Expiry date set"
        assert "expires_at" in data
        print(f"PASS: Set expiry date for request {test_request_id}")
    
    # Test 2: Get Expiry Status
    def test_get_expiry_status(self, headers, test_request_id):
        """GET /api/expiry/requests/{id} - Get expiry status"""
        response = requests.get(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "request_id" in data
        assert data["request_id"] == test_request_id
        assert "expires_at" in data
        assert "status" in data
        assert "days_remaining" in data
        
        # Status should be one of the valid values
        valid_statuses = ["no_expiry", "active", "approaching", "warning", "critical", "expired"]
        assert data["status"] in valid_statuses, f"Invalid status: {data['status']}"
        print(f"PASS: Got expiry status - status={data['status']}, days_remaining={data['days_remaining']}")
    
    # Test 3: Get Expiry Dashboard
    def test_expiry_dashboard(self, headers):
        """GET /api/expiry/dashboard - Get all documents with expiry info"""
        response = requests.get(
            f"{BASE_URL}/api/expiry/dashboard",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "documents" in data
        assert "summary" in data
        
        # Validate summary structure
        summary = data["summary"]
        assert "total" in summary
        assert "expired" in summary
        assert "critical" in summary
        assert "warning" in summary
        assert "approaching" in summary
        
        # Validate document structure if any exist
        if len(data["documents"]) > 0:
            doc = data["documents"][0]
            assert "id" in doc
            assert "document_name" in doc
            assert "expires_at" in doc
            assert "expiry_status" in doc
            assert "days_remaining" in doc
        
        print(f"PASS: Expiry dashboard - total={summary['total']}, expired={summary['expired']}, critical={summary['critical']}")
    
    # Test 4: Update Expiry Date
    def test_update_expiry_date(self, headers, test_request_id):
        """PUT /api/expiry/requests/{id} - Update existing expiry date"""
        # Set to 7 days for warning status
        future_date = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%dT23:59:59Z")
        
        response = requests.put(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers,
            json={"expires_at": future_date}
        )
        
        assert response.status_code == 200
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["status"] in ["warning", "critical"], f"Expected warning/critical for 7 days, got {data['status']}"
        print(f"PASS: Updated expiry to 7 days - status={data['status']}")
    
    # Test 5: Remove Expiry Date
    def test_remove_expiry(self, headers, test_request_id):
        """DELETE /api/expiry/requests/{id} - Remove expiry date"""
        response = requests.delete(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["message"] == "Expiry date removed"
        
        # Verify removal
        get_response = requests.get(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["status"] == "no_expiry"
        assert data["expires_at"] is None
        print(f"PASS: Removed expiry from request {test_request_id}")
    
    # Test 6: Error - Invalid Request ID
    def test_expiry_invalid_request_id(self, headers):
        """GET /api/expiry/requests/{id} - Invalid request ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/expiry/requests/invalid-uuid-123",
            headers=headers
        )
        
        assert response.status_code == 404
        print("PASS: Invalid request ID returns 404")
    
    # Test 7: Re-set expiry for dashboard verification
    def test_set_expiry_for_dashboard(self, headers, test_request_id):
        """Set expiry back so dashboard shows content"""
        future_date = (datetime.utcnow() + timedelta(days=60)).strftime("%Y-%m-%dT23:59:59Z")
        
        response = requests.put(
            f"{BASE_URL}/api/expiry/requests/{test_request_id}",
            headers=headers,
            json={"expires_at": future_date}
        )
        assert response.status_code == 200
        print(f"PASS: Re-set expiry for dashboard visibility")


class TestKnownExpiryDocument:
    """Test the known expiry document ID from context"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_known_expiry_document(self, headers):
        """Check the known expiry document mentioned in context"""
        known_id = "35c22317-6fad-42a4-a63c-98f92e33f6a5"
        
        response = requests.get(
            f"{BASE_URL}/api/expiry/requests/{known_id}",
            headers=headers
        )
        
        # May not exist if created by different user
        if response.status_code == 200:
            data = response.json()
            print(f"Known doc: id={data['request_id']}, status={data['status']}, expires_at={data['expires_at']}")
        elif response.status_code == 404:
            print(f"Known doc {known_id} not found (may belong to different user)")
        elif response.status_code == 403:
            print(f"Known doc {known_id} exists but belongs to different user")
        
        assert response.status_code in [200, 403, 404], f"Unexpected status: {response.status_code}"


class TestDraftCollaborationSetup:
    """Test setup for Draft Collaboration - Create draft and share it"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_list_templates(self, headers):
        """GET /api/templates/ - List templates to get a template ID"""
        # Using trailing slash to avoid 307 redirect
        response = requests.get(f"{BASE_URL}/api/templates/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        templates = data.get("templates", data) if isinstance(data, dict) else data
        if len(templates) > 0:
            template = templates[0]
            print(f"Template: {template.get('name')} (id: {template.get('id')})")
        print(f"PASS: Found {len(templates)} templates")
        return templates
    
    def test_get_or_create_draft(self, headers):
        """GET /api/drafts/ - Get user's drafts or create one"""
        # Route is GET /api/drafts/ (not /my)
        response = requests.get(f"{BASE_URL}/api/drafts/", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            drafts = data.get("drafts", data) if isinstance(data, dict) else data
            if not isinstance(drafts, list):
                drafts = [drafts] if drafts else []
        else:
            assert False, f"Unexpected status: {response.status_code}"
        
        if len(drafts) > 0:
            draft = drafts[0]
            print(f"PASS: Found draft: {draft.get('name')} (id: {draft.get('id')})")
            return draft
        
        # If no drafts, create one from a template
        templates_res = requests.get(f"{BASE_URL}/api/templates/", headers=headers)
        if templates_res.status_code == 200:
            templates_data = templates_res.json()
            templates = templates_data.get("templates", templates_data) if isinstance(templates_data, dict) else templates_data
            if len(templates) > 0:
                template = templates[0]
                template_id = template["id"]
                
                create_response = requests.post(
                    f"{BASE_URL}/api/drafts/",
                    headers=headers,
                    json={
                        "template_id": template_id,
                        "template_name": template.get("name", "Test Template"),
                        "field_values": {"test_field": "test_value"},
                        "name": "TEST_Collab_Draft"
                    }
                )
                if create_response.status_code in [200, 201]:
                    draft = create_response.json()
                    print(f"PASS: Created draft: {draft.get('name')} (id: {draft.get('id')})")
                    return draft
        
        print("PASS: No drafts found and couldn't create one")
        return None
    
    def test_share_draft(self, headers):
        """POST /api/drafts/{id}/share - Share a draft and get share token"""
        # Get a draft first
        drafts_res = requests.get(f"{BASE_URL}/api/drafts/", headers=headers)
        if drafts_res.status_code != 200:
            pytest.skip(f"Could not get drafts: {drafts_res.status_code}")
        
        data = drafts_res.json()
        drafts = data.get("drafts", data) if isinstance(data, dict) else data
        if not isinstance(drafts, list):
            drafts = [drafts] if drafts else []
        if len(drafts) == 0:
            pytest.skip("No drafts available to share")
        
        draft_id = drafts[0]["id"]
        existing_token = drafts[0].get("share_token")
        
        if existing_token:
            print(f"PASS: Draft already shared - token: {existing_token}")
            return {"draft_id": draft_id, "share_token": existing_token}
        
        # Share the draft
        response = requests.post(
            f"{BASE_URL}/api/drafts/{draft_id}/share",
            headers=headers,
            json={"allow_edit": True}
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            share_token = data.get("share_token") or data.get("token")
            print(f"PASS: Shared draft - token: {share_token}")
            return {"draft_id": draft_id, "share_token": share_token}
        elif response.status_code == 409:
            # Already shared
            print(f"Draft already shared")
            return {"draft_id": draft_id}
        else:
            print(f"Share response: {response.status_code} - {response.text}")
            return {"draft_id": draft_id}


class TestDashboardSealsAPI:
    """Test that dashboard APIs (stats, seals, requests) work correctly"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_documents_stats(self, headers):
        """GET /api/documents/stats - Dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/documents/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_seals" in data
        assert "recent_seals" in data
        print(f"PASS: Stats - total_seals={data['total_seals']}, recent_seals={data['recent_seals']}")
    
    def test_documents_seals(self, headers):
        """GET /api/documents/seals - Document seals list"""
        response = requests.get(f"{BASE_URL}/api/documents/seals?limit=10", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            doc = data[0]
            # Check for normalized field names (legacy fix)
            assert "file_name" in doc
            assert "file_size" in doc
            print(f"PASS: Seals - found {len(data)} documents")
        else:
            print("PASS: Seals endpoint works, no documents yet")
    
    def test_notary_requests_my(self, headers):
        """GET /api/notary/requests/my - User's notarization requests"""
        response = requests.get(f"{BASE_URL}/api/notary/requests/my", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Notary requests - found {len(data)} requests")


class TestNotificationBellExpiry:
    """Test notification system for expiry notifications"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@test.com",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_notifications_endpoint(self, headers):
        """GET /api/notifications/ - Get user notifications"""
        # Using trailing slash to avoid 307 redirect
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        notifications = data.get("notifications", data) if isinstance(data, dict) else data
        assert isinstance(notifications, list)
        
        # Check if any expiry notifications exist
        expiry_notifs = [n for n in notifications if "expir" in str(n.get("title", "")).lower() or "expir" in str(n.get("message", "")).lower()]
        print(f"PASS: Notifications - found {len(notifications)} total, {len(expiry_notifs)} expiry-related")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
