"""
Test Suite for Template Drafts & Sharing (iteration_28)
Tests all draft CRUD operations, version history, sharing, and revision restoration.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


class TestSetup:
    """Authentication helpers"""
    
    @staticmethod
    def get_token(email, password):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


@pytest.fixture(scope="module")
def demo_token():
    """Get demo user token"""
    token = TestSetup.get_token(DEMO_USER["email"], DEMO_USER["password"])
    if not token:
        pytest.skip("Demo user authentication failed")
    return token


@pytest.fixture(scope="module")
def admin_token():
    """Get admin user token"""
    token = TestSetup.get_token(ADMIN_USER["email"], ADMIN_USER["password"])
    if not token:
        pytest.skip("Admin user authentication failed")
    return token


@pytest.fixture(scope="module")
def headers(demo_token):
    """Headers for demo user"""
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers for admin user"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def template_id(headers):
    """Get a valid template ID for testing"""
    response = requests.get(f"{BASE_URL}/api/templates/", headers=headers)
    if response.status_code == 200 and response.json().get("templates"):
        return response.json()["templates"][0]["id"]
    pytest.skip("No templates available for testing")


# ============================================
# Draft CRUD Tests
# ============================================

class TestDraftCRUD:
    """Draft create, read, update, delete tests"""
    
    created_draft_id = None
    
    def test_save_new_draft(self, headers, template_id):
        """POST /api/drafts/ - Save new draft with template_id and field_values"""
        payload = {
            "template_id": template_id,
            "template_name": "TEST_NDA_Draft",
            "field_values": {
                "party_name_1": "Test Company A",
                "party_name_2": "Test Company B",
                "effective_date": "2026-01-15"
            },
            "name": "TEST_Draft_Iteration28"
        }
        response = requests.post(f"{BASE_URL}/api/drafts/", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Draft ID not returned"
        assert data["template_id"] == template_id, "Template ID mismatch"
        assert data["version"] == 1, "Initial version should be 1"
        assert data["field_values"]["party_name_1"] == "Test Company A"
        assert "revisions" in data, "Revisions array not returned"
        assert len(data["revisions"]) == 1, "Should have 1 revision on create"
        
        # Store for next tests
        TestDraftCRUD.created_draft_id = data["id"]
        print(f"✓ Draft created with ID: {data['id']}")
    
    def test_list_user_drafts(self, headers):
        """GET /api/drafts/ - List current user's drafts"""
        response = requests.get(f"{BASE_URL}/api/drafts/", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "drafts" in data, "Drafts array not returned"
        assert isinstance(data["drafts"], list), "Drafts should be a list"
        
        # Verify drafts don't include revision history in list (performance)
        if len(data["drafts"]) > 0:
            first_draft = data["drafts"][0]
            assert "revisions" not in first_draft, "List should not include revisions"
            assert "id" in first_draft, "Draft should have id"
            assert "name" in first_draft, "Draft should have name"
        
        print(f"✓ Listed {len(data['drafts'])} drafts")
    
    def test_get_draft_with_revisions(self, headers):
        """GET /api/drafts/{draft_id} - Get draft with full revision history"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available from previous test"
        
        response = requests.get(f"{BASE_URL}/api/drafts/{draft_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["id"] == draft_id, "Draft ID mismatch"
        assert "revisions" in data, "Full draft should include revisions"
        assert len(data["revisions"]) >= 1, "Should have at least 1 revision"
        assert "field_values" in data, "Should have field_values"
        
        print(f"✓ Got draft with {len(data['revisions'])} revision(s)")
    
    def test_update_draft_creates_new_version(self, headers):
        """PUT /api/drafts/{draft_id} - Update draft (auto-increment version)"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        payload = {
            "field_values": {
                "party_name_1": "Updated Company A",
                "party_name_2": "Updated Company B",
                "effective_date": "2026-02-01"
            },
            "name": "TEST_Draft_Updated"
        }
        response = requests.put(f"{BASE_URL}/api/drafts/{draft_id}", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["version"] == 2, f"Version should be 2, got {data['version']}"
        assert data["field_values"]["party_name_1"] == "Updated Company A"
        assert len(data["revisions"]) == 2, "Should have 2 revisions after update"
        
        # Verify latest revision has correct data
        latest_revision = data["revisions"][-1]
        assert latest_revision["version"] == 2
        assert "saved_at" in latest_revision
        assert "saved_by" in latest_revision
        
        print(f"✓ Draft updated to version {data['version']}")
    
    def test_get_draft_not_found(self, headers):
        """GET /api/drafts/{invalid_id} - Returns 404 for non-existent draft"""
        response = requests.get(f"{BASE_URL}/api/drafts/nonexistent-draft-id", headers=headers)
        assert response.status_code == 404
        print("✓ 404 returned for non-existent draft")
    
    def test_other_user_cannot_access_draft(self, admin_headers):
        """Access control: Another user cannot view someone else's draft"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.get(f"{BASE_URL}/api/drafts/{draft_id}", headers=admin_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ 403 returned when accessing another user's draft")


# ============================================
# Sharing Tests
# ============================================

class TestDraftSharing:
    """Draft sharing functionality tests"""
    
    share_token = None
    shared_draft_id = None
    
    def test_create_share_link_view_only(self, headers):
        """POST /api/drafts/{draft_id}/share - Create view-only share link"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        payload = {"allow_edit": False}
        response = requests.post(f"{BASE_URL}/api/drafts/{draft_id}/share", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "share_token" in data, "Share token not returned"
        assert data["allow_edit"] == False, "Should be view-only"
        
        TestDraftSharing.share_token = data["share_token"]
        TestDraftSharing.shared_draft_id = draft_id
        print(f"✓ Share link created (view-only)")
    
    def test_access_shared_draft(self, admin_headers):
        """GET /api/drafts/shared/{share_token} - Access shared draft via token"""
        share_token = TestDraftSharing.share_token
        assert share_token, "No share token available"
        
        response = requests.get(f"{BASE_URL}/api/drafts/shared/{share_token}", headers=admin_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "id" in data, "Draft ID not returned"
        assert "field_values" in data, "Field values not returned"
        assert "owner_email" in data, "Owner email not returned"
        assert data["allow_edit"] == False, "Should be view-only"
        assert "revisions" not in data, "Shared view should not include full revisions"
        
        print("✓ Shared draft accessed successfully")
    
    def test_update_shared_draft_denied_view_only(self, admin_headers):
        """PUT /api/drafts/shared/{share_token} - Cannot edit view-only draft"""
        share_token = TestDraftSharing.share_token
        assert share_token, "No share token available"
        
        payload = {"field_values": {"party_name_1": "Hacker Corp"}}
        response = requests.put(f"{BASE_URL}/api/drafts/shared/{share_token}", json=payload, headers=admin_headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ View-only shared draft cannot be edited")
    
    def test_create_share_link_with_edit(self, headers):
        """POST /api/drafts/{draft_id}/share - Create editable share link"""
        draft_id = TestDraftSharing.shared_draft_id
        assert draft_id, "No draft ID available"
        
        payload = {"allow_edit": True}
        response = requests.post(f"{BASE_URL}/api/drafts/{draft_id}/share", json=payload, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["allow_edit"] == True, "Should allow editing"
        TestDraftSharing.share_token = data["share_token"]  # Update token
        print("✓ Share link created (editable)")
    
    def test_update_shared_draft_allowed(self, admin_headers):
        """PUT /api/drafts/shared/{share_token} - Can edit when allow_edit=true"""
        share_token = TestDraftSharing.share_token
        assert share_token, "No share token available"
        
        payload = {"field_values": {"party_name_1": "Collaborator Edit"}}
        response = requests.put(f"{BASE_URL}/api/drafts/shared/{share_token}", json=payload, headers=admin_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "version" in data, "New version should be returned"
        print(f"✓ Shared draft updated, new version: {data['version']}")
    
    def test_revoke_share_link(self, headers):
        """DELETE /api/drafts/{draft_id}/share - Revoke share link"""
        draft_id = TestDraftSharing.shared_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.delete(f"{BASE_URL}/api/drafts/{draft_id}/share", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Share link revoked")
    
    def test_access_revoked_share_link(self, admin_headers):
        """GET /api/drafts/shared/{revoked_token} - Returns 404 after revoke"""
        share_token = TestDraftSharing.share_token
        assert share_token, "No share token available"
        
        response = requests.get(f"{BASE_URL}/api/drafts/shared/{share_token}", headers=admin_headers)
        
        assert response.status_code == 404, f"Expected 404 after revoke, got {response.status_code}"
        print("✓ Revoked share link returns 404")
    
    def test_invalid_share_token(self, headers):
        """GET /api/drafts/shared/{invalid} - Returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/drafts/shared/invalid-token-12345", headers=headers)
        assert response.status_code == 404
        print("✓ Invalid share token returns 404")


# ============================================
# Revision History Tests
# ============================================

class TestRevisionHistory:
    """Revision history and restore functionality tests"""
    
    def test_get_revision_history(self, headers):
        """GET /api/drafts/{draft_id}/revisions - Get revision history"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.get(f"{BASE_URL}/api/drafts/{draft_id}/revisions", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "revisions" in data, "Revisions array not returned"
        assert len(data["revisions"]) >= 2, "Should have at least 2 revisions from previous tests"
        
        # Verify revision structure
        first_rev = data["revisions"][0]
        assert "version" in first_rev
        assert "field_values" in first_rev
        assert "saved_by" in first_rev
        assert "saved_at" in first_rev
        
        print(f"✓ Got {len(data['revisions'])} revisions")
    
    def test_restore_to_version(self, headers):
        """POST /api/drafts/{draft_id}/revisions/{version}/restore - Restore to earlier version"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        # Get current version
        get_resp = requests.get(f"{BASE_URL}/api/drafts/{draft_id}", headers=headers)
        current_version = get_resp.json()["version"]
        
        # Restore to version 1
        response = requests.post(f"{BASE_URL}/api/drafts/{draft_id}/revisions/1/restore", json={}, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "new_version" in data, "New version should be returned"
        assert data["new_version"] > current_version, "Restore should create new version"
        
        # Verify data was restored
        verify_resp = requests.get(f"{BASE_URL}/api/drafts/{draft_id}", headers=headers)
        verify_data = verify_resp.json()
        
        # Original version 1 had "Test Company A"
        assert verify_data["field_values"]["party_name_1"] == "Test Company A", "Field values should be restored"
        
        print(f"✓ Restored to version 1, new version: {data['new_version']}")
    
    def test_restore_nonexistent_version(self, headers):
        """POST /api/drafts/{draft_id}/revisions/999/restore - Returns 404"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.post(f"{BASE_URL}/api/drafts/{draft_id}/revisions/999/restore", json={}, headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for non-existent version")
    
    def test_other_user_cannot_restore(self, admin_headers):
        """Access control: Another user cannot restore someone else's draft"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.post(f"{BASE_URL}/api/drafts/{draft_id}/revisions/1/restore", json={}, headers=admin_headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ 403 returned when restoring another user's draft")


# ============================================
# Delete Tests (run last)
# ============================================

class TestDraftDelete:
    """Draft deletion tests - run last"""
    
    def test_other_user_cannot_delete(self, admin_headers):
        """Access control: Another user cannot delete someone else's draft"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.delete(f"{BASE_URL}/api/drafts/{draft_id}", headers=admin_headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ 403 returned when deleting another user's draft")
    
    def test_delete_draft(self, headers):
        """DELETE /api/drafts/{draft_id} - Delete draft"""
        draft_id = TestDraftCRUD.created_draft_id
        assert draft_id, "No draft ID available"
        
        response = requests.delete(f"{BASE_URL}/api/drafts/{draft_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        verify_resp = requests.get(f"{BASE_URL}/api/drafts/{draft_id}", headers=headers)
        assert verify_resp.status_code == 404, "Deleted draft should return 404"
        
        print("✓ Draft deleted and verified")


# ============================================
# Additional Edge Cases
# ============================================

class TestEdgeCases:
    """Edge case and validation tests"""
    
    def test_save_draft_missing_template_id(self, headers):
        """Validation: template_id is required"""
        payload = {
            "template_name": "Test",
            "field_values": {}
        }
        response = requests.post(f"{BASE_URL}/api/drafts/", json=payload, headers=headers)
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ 422 returned for missing template_id")
    
    def test_save_draft_missing_template_name(self, headers):
        """Validation: template_name is required"""
        payload = {
            "template_id": "some-id",
            "field_values": {}
        }
        response = requests.post(f"{BASE_URL}/api/drafts/", json=payload, headers=headers)
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ 422 returned for missing template_name")
    
    def test_unauthorized_access(self):
        """Access control: No token returns 401"""
        response = requests.get(f"{BASE_URL}/api/drafts/")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized access blocked")
    
    def test_share_requires_authentication(self):
        """Access control: Share endpoint requires auth"""
        response = requests.post(f"{BASE_URL}/api/drafts/some-id/share", json={"allow_edit": False})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Share endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
