"""
Phase B & C Testing: Notary Professional Features and GDPR/Compliance Tools
Tests: Journal, Seals, Commission, GDPR Privacy, Export, Deletion
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trust-seal-staging.preview.emergentagent.com').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
NOTARY_USER = {"email": "notarytest@test.com", "password": "Test123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


class TestAuthentication:
    """Verify authentication endpoints work for all test users"""
    
    def test_health_check(self):
        """Test API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"Health check passed: {response.json()}")
    
    def test_login_demo_user(self):
        """Test demo user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"Demo user login success: token received")
        return data["access_token"]
    
    def test_login_notary_user(self):
        """Test notary user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NOTARY_USER)
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"Notary user login success: token received")
            return data["access_token"]
        else:
            pytest.skip(f"Notary user login failed with {response.status_code}: may not exist")
    
    def test_login_admin_user(self):
        """Test admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"Admin user login success: token received")
        return data["access_token"]


class TestGDPRPrivacy:
    """GDPR Privacy Settings Tests - Work for any authenticated user"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_privacy_settings(self, auth_headers):
        """GET /api/gdpr/privacy - Get privacy settings"""
        response = requests.get(f"{BASE_URL}/api/gdpr/privacy", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "privacy_settings" in data
        settings = data["privacy_settings"]
        # Verify expected keys
        expected_keys = ["analytics_tracking", "marketing_emails", "data_sharing", "activity_visible"]
        for key in expected_keys:
            assert key in settings, f"Missing key: {key}"
        print(f"Privacy settings: {settings}")
    
    def test_update_privacy_settings(self, auth_headers):
        """PUT /api/gdpr/privacy - Update privacy settings"""
        new_settings = {
            "analytics_tracking": False,
            "marketing_emails": True,
            "data_sharing": False,
            "activity_visible": True
        }
        response = requests.put(f"{BASE_URL}/api/gdpr/privacy", json=new_settings, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "privacy_settings" in data
        # Verify settings were updated
        for key, val in new_settings.items():
            assert data["privacy_settings"].get(key) == val, f"Setting {key} not updated"
        print(f"Privacy settings updated successfully")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/gdpr/privacy", headers=auth_headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        for key, val in new_settings.items():
            assert get_data["privacy_settings"].get(key) == val
        print("Verified: GET returns updated settings")
    
    def test_privacy_requires_auth(self):
        """Privacy endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gdpr/privacy")
        assert response.status_code in [401, 403]
        print("Privacy endpoint correctly requires authentication")


class TestGDPRDataExport:
    """GDPR Data Export Tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_data_export(self, auth_headers):
        """POST /api/gdpr/export - Export user data"""
        response = requests.post(f"{BASE_URL}/api/gdpr/export", json={}, headers=auth_headers)
        assert response.status_code == 200
        
        # Check Content-Type is JSON
        assert "application/json" in response.headers.get("Content-Type", "")
        
        # Check Content-Disposition header for filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp
        assert "notarychain_export" in content_disp
        print(f"Content-Disposition: {content_disp}")
        
        # Parse JSON data
        data = response.json()
        assert "export_info" in data
        assert "profile" in data
        assert data["export_info"]["format"] == "JSON"
        assert "Article 20" in data["export_info"]["gdpr_article"]
        print(f"Export contains: {list(data.keys())}")
    
    def test_export_requires_auth(self):
        """Export endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/gdpr/export", json={})
        assert response.status_code in [401, 403]
        print("Export endpoint correctly requires authentication")


class TestGDPRDeletionRequest:
    """GDPR Account Deletion Request Tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_deletion_status(self, auth_headers):
        """GET /api/gdpr/deletion-request/status - Check deletion status"""
        response = requests.get(f"{BASE_URL}/api/gdpr/deletion-request/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "has_pending_request" in data
        print(f"Deletion status: {data}")
    
    def test_deletion_request_wrong_password(self, auth_headers):
        """POST /api/gdpr/deletion-request - Wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/gdpr/deletion-request", 
            json={"password": "WrongPassword!", "reason": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 401
        print("Deletion with wrong password correctly rejected")
    
    def test_deletion_request_and_cancel(self, auth_headers):
        """Test deletion request then cancel flow"""
        # First check if there's an existing pending request
        status_response = requests.get(f"{BASE_URL}/api/gdpr/deletion-request/status", headers=auth_headers)
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        if status_data.get("has_pending_request"):
            # Cancel existing request first
            cancel_response = requests.post(f"{BASE_URL}/api/gdpr/deletion-request/cancel", 
                json={}, headers=auth_headers)
            assert cancel_response.status_code == 200
            print("Cancelled existing deletion request")
        
        # Create new deletion request
        response = requests.post(f"{BASE_URL}/api/gdpr/deletion-request", 
            json={"password": DEMO_USER["password"], "reason": "Testing deletion flow"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "scheduled_deletion_at" in data
        assert data["grace_period_days"] == 30
        print(f"Deletion scheduled for: {data['scheduled_deletion_at']}")
        
        # Verify status shows pending
        status_response = requests.get(f"{BASE_URL}/api/gdpr/deletion-request/status", headers=auth_headers)
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data["has_pending_request"] == True
        print("Verified: deletion status shows pending")
        
        # Cancel the request
        cancel_response = requests.post(f"{BASE_URL}/api/gdpr/deletion-request/cancel", 
            json={}, headers=auth_headers)
        assert cancel_response.status_code == 200
        print("Deletion request cancelled successfully")
        
        # Verify status shows no pending request
        final_status = requests.get(f"{BASE_URL}/api/gdpr/deletion-request/status", headers=auth_headers)
        assert final_status.status_code == 200
        final_data = final_status.json()
        assert final_data["has_pending_request"] == False
        print("Verified: deletion cancelled, no pending request")
    
    def test_cancel_without_request(self, auth_headers):
        """POST /api/gdpr/deletion-request/cancel - No request to cancel"""
        # First ensure no pending request
        status = requests.get(f"{BASE_URL}/api/gdpr/deletion-request/status", headers=auth_headers)
        if status.json().get("has_pending_request"):
            requests.post(f"{BASE_URL}/api/gdpr/deletion-request/cancel", json={}, headers=auth_headers)
        
        # Try to cancel when no request exists
        response = requests.post(f"{BASE_URL}/api/gdpr/deletion-request/cancel", 
            json={}, headers=auth_headers)
        assert response.status_code == 404
        print("Correctly returns 404 when no deletion request to cancel")


class TestNotaryJournal:
    """Notary Journal API Tests - Requires notary user"""
    
    @pytest.fixture
    def notary_headers(self):
        """Get auth token for notary user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NOTARY_USER)
        if response.status_code != 200:
            pytest.skip(f"Notary user login failed: {response.status_code}")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def admin_headers(self):
        """Get auth token for admin user (may have notary privileges)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_journal_get_entries(self, admin_headers):
        """GET /api/notary/professional/journal - List entries"""
        response = requests.get(f"{BASE_URL}/api/notary/professional/journal", headers=admin_headers)
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert "page" in data
        print(f"Journal: {data['total']} entries, page {data['page']}")
    
    def test_journal_get_stats(self, admin_headers):
        """GET /api/notary/professional/journal/stats - Get statistics"""
        response = requests.get(f"{BASE_URL}/api/notary/professional/journal/stats", headers=admin_headers)
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        assert "total_entries" in data
        assert "this_month" in data
        assert "total_fees" in data
        assert "by_document_type" in data
        print(f"Journal stats: {data['total_entries']} entries, ${data['total_fees']} fees")
    
    def test_journal_create_entry(self, admin_headers):
        """POST /api/notary/professional/journal - Create new entry"""
        entry_data = {
            "document_type": "affidavit",
            "document_name": f"TEST_Journal_Entry_{datetime.now().strftime('%H%M%S')}",
            "signer_name": "TEST_Signer Name",
            "signer_address": "123 Test St",
            "identification_type": "drivers_license",
            "identification_number": "DL123456",
            "notarization_type": "acknowledgment",
            "fee_charged": 25.00,
            "notes": "Test entry for automated testing"
        }
        response = requests.post(f"{BASE_URL}/api/notary/professional/journal", 
            json=entry_data, headers=admin_headers)
        
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["document_name"] == entry_data["document_name"]
        assert data["signer_name"] == entry_data["signer_name"]
        assert data["fee_charged"] == entry_data["fee_charged"]
        assert "entry_number" in data
        print(f"Created journal entry #{data['entry_number']}: {data['id']}")
    
    def test_journal_search(self, admin_headers):
        """GET /api/notary/professional/journal - Search functionality"""
        response = requests.get(
            f"{BASE_URL}/api/notary/professional/journal?search=TEST",
            headers=admin_headers
        )
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        print(f"Search 'TEST' found {data['total']} entries")
    
    def test_journal_pagination(self, admin_headers):
        """GET /api/notary/professional/journal - Pagination"""
        response = requests.get(
            f"{BASE_URL}/api/notary/professional/journal?page=1&page_size=5",
            headers=admin_headers
        )
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["entries"]) <= 5
        print(f"Pagination: page {data['page']}, {len(data['entries'])} entries returned")


class TestDigitalSeals:
    """Digital Seal Management Tests - Requires notary user"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_seals(self, admin_headers):
        """GET /api/notary/professional/seals - List seals"""
        response = requests.get(f"{BASE_URL}/api/notary/professional/seals", headers=admin_headers)
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        assert "seals" in data
        print(f"Found {len(data['seals'])} seals")
        return data["seals"]
    
    def test_upload_seal(self, admin_headers):
        """POST /api/notary/professional/seals/upload - Upload seal image"""
        # Create a simple PNG file (1x1 pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {"file": ("test_seal.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/upload",
            files=files,
            headers={"Authorization": admin_headers["Authorization"]}
        )
        
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["is_active"] == True
        print(f"Uploaded seal: {data['id']}, active={data['is_active']}")
        return data["id"]
    
    def test_upload_invalid_file_type(self, admin_headers):
        """POST /api/notary/professional/seals/upload - Invalid file type"""
        files = {"file": ("test.pdf", b"fake pdf content", "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/upload",
            files=files,
            headers={"Authorization": admin_headers["Authorization"]}
        )
        
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        
        assert response.status_code == 400
        print("Invalid file type correctly rejected")
    
    def test_seal_lifecycle(self, admin_headers):
        """Full seal lifecycle: upload, activate another, delete"""
        # Upload two seals
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        # Upload first seal
        files1 = {"file": ("seal1.png", png_data, "image/png")}
        response1 = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/upload",
            files=files1,
            headers={"Authorization": admin_headers["Authorization"]}
        )
        if response1.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response1.status_code == 200
        seal1_id = response1.json()["id"]
        print(f"Uploaded seal1: {seal1_id}")
        
        # Upload second seal (should become active)
        files2 = {"file": ("seal2.png", png_data, "image/png")}
        response2 = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/upload",
            files=files2,
            headers={"Authorization": admin_headers["Authorization"]}
        )
        assert response2.status_code == 200
        seal2_id = response2.json()["id"]
        print(f"Uploaded seal2: {seal2_id}")
        
        # Verify seal2 is active
        seals_response = requests.get(f"{BASE_URL}/api/notary/professional/seals", headers=admin_headers)
        seals = seals_response.json()["seals"]
        active_seal = next((s for s in seals if s["is_active"]), None)
        assert active_seal is not None
        assert active_seal["id"] == seal2_id
        print(f"Verified: seal2 is active")
        
        # Activate seal1
        activate_response = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/{seal1_id}/activate",
            json={},
            headers=admin_headers
        )
        assert activate_response.status_code == 200
        print(f"Activated seal1")
        
        # Verify seal1 is now active
        seals_response2 = requests.get(f"{BASE_URL}/api/notary/professional/seals", headers=admin_headers)
        seals2 = seals_response2.json()["seals"]
        active_seal2 = next((s for s in seals2 if s["is_active"]), None)
        assert active_seal2["id"] == seal1_id
        print(f"Verified: seal1 is now active")
        
        # Delete seal2
        delete_response = requests.delete(
            f"{BASE_URL}/api/notary/professional/seals/{seal2_id}",
            headers=admin_headers
        )
        assert delete_response.status_code == 200
        print(f"Deleted seal2")
        
        # Delete seal1 (cleanup)
        requests.delete(f"{BASE_URL}/api/notary/professional/seals/{seal1_id}", headers=admin_headers)
        print("Cleaned up seal1")
    
    def test_seal_file_access(self, admin_headers):
        """GET /api/notary/professional/seals/{id}/file - Access seal file"""
        # First get existing seals or upload one
        seals_response = requests.get(f"{BASE_URL}/api/notary/professional/seals", headers=admin_headers)
        if seals_response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        
        seals = seals_response.json()["seals"]
        if not seals:
            # Upload a seal first
            png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
            files = {"file": ("test_seal.png", png_data, "image/png")}
            upload_response = requests.post(
                f"{BASE_URL}/api/notary/professional/seals/upload",
                files=files,
                headers={"Authorization": admin_headers["Authorization"]}
            )
            seal_id = upload_response.json()["id"]
        else:
            seal_id = seals[0]["id"]
        
        # Access the seal file
        file_response = requests.get(
            f"{BASE_URL}/api/notary/professional/seals/{seal_id}/file",
            headers=admin_headers
        )
        assert file_response.status_code == 200
        assert "image" in file_response.headers.get("Content-Type", "")
        print(f"Seal file accessed: {file_response.headers.get('Content-Type')}")
    
    def test_seal_not_found(self, admin_headers):
        """GET /api/notary/professional/seals/{id}/file - Non-existent seal"""
        response = requests.get(
            f"{BASE_URL}/api/notary/professional/seals/nonexistent-id/file",
            headers=admin_headers
        )
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 404
        print("Non-existent seal correctly returns 404")


class TestNotaryCommission:
    """Notary Commission Tracking Tests"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_commission_info(self, admin_headers):
        """GET /api/notary/professional/commission - Get commission info"""
        response = requests.get(f"{BASE_URL}/api/notary/professional/commission", headers=admin_headers)
        # May return 404 if no notary profile
        if response.status_code == 404:
            print("No notary profile found (expected if user is not a notary)")
            return
        if response.status_code == 403:
            pytest.skip("User does not have notary permissions")
        assert response.status_code == 200
        data = response.json()
        print(f"Commission info: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
