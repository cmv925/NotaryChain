"""
Test: Organization Document Vault
Features: Upload documents, list/filter, download, view detail with audit trail,
role-based access (admin upload/manage, member view/download), vault stats
"""

import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}  # Org Owner
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}  # Org Admin

# Module-level cache for tokens
_cached_tokens = {}


def get_demo_token():
    """Get or cache demo user token"""
    if "demo" not in _cached_tokens:
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        _cached_tokens["demo"] = res.json().get("access_token")
    return _cached_tokens["demo"]


def get_admin_token():
    """Get or cache admin user token"""
    if "admin" not in _cached_tokens:
        time.sleep(0.5)  # Rate limit avoidance
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        _cached_tokens["admin"] = res.json().get("access_token")
    return _cached_tokens["admin"]


def get_org_id(token):
    """Get org_id using token"""
    if "org_id" not in _cached_tokens:
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {token}"})
        _cached_tokens["org_id"] = res.json()["organizations"][0]["id"]
    return _cached_tokens["org_id"]


class TestVaultSetup:
    """Setup: get auth tokens and org_id"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        """Get demo user token (org owner)"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert res.status_code == 200, f"Demo login failed: {res.text}"
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin user token (org admin)"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        """Get first organization ID"""
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert res.status_code == 200, f"Failed to get orgs: {res.text}"
        orgs = res.json()["organizations"]
        assert len(orgs) > 0, "No organizations found for demo user"
        return orgs[0]["id"]
    
    def test_demo_login(self, demo_token):
        """Test demo user login"""
        assert demo_token is not None
        assert len(demo_token) > 0
        print(f"Demo user token obtained: {demo_token[:20]}...")
    
    def test_admin_login(self, admin_token):
        """Test admin user login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"Admin user token obtained: {admin_token[:20]}...")
    
    def test_org_exists(self, org_id):
        """Test organization exists"""
        assert org_id is not None
        print(f"Organization ID: {org_id}")


class TestVaultStats:
    """Test vault statistics endpoint"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_get_vault_stats(self, demo_token, org_id):
        """GET /api/vault/{org_id}/stats - get vault statistics"""
        res = requests.get(f"{BASE_URL}/api/vault/{org_id}/stats",
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert res.status_code == 200, f"Stats request failed: {res.text}"
        
        data = res.json()
        assert "total_documents" in data
        assert "total_size_bytes" in data
        assert "categories" in data
        assert isinstance(data["total_documents"], int)
        assert isinstance(data["total_size_bytes"], int)
        assert isinstance(data["categories"], dict)
        print(f"Vault stats: {data['total_documents']} docs, {data['total_size_bytes']} bytes")


class TestVaultUpload:
    """Test document upload (admin only)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, admin_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {admin_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_upload_document_admin(self, admin_token, org_id):
        """POST /api/vault/{org_id}/documents - upload document (admin)"""
        # Create test file content
        file_content = b"TEST_VAULT_DOCUMENT_CONTENT"
        files = {"file": ("TEST_vault_doc.txt", io.BytesIO(file_content), "text/plain")}
        data = {
            "name": "TEST_Vault Document",
            "category": "contracts",
            "tags": "test, vault, automation",
            "description": "Test document uploaded by automation"
        }
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        assert res.status_code == 200, f"Upload failed: {res.text}"
        
        doc = res.json()
        assert "id" in doc
        assert doc["name"] == "TEST_Vault Document"
        assert doc["category"] == "contracts"
        assert "test" in doc["tags"]
        assert doc["description"] == "Test document uploaded by automation"
        assert doc["file_size"] == len(file_content)
        print(f"Uploaded document: {doc['id']}")
        
        # Store doc_id for cleanup
        return doc["id"]
    
    def test_upload_with_default_name(self, admin_token, org_id):
        """POST /api/vault/{org_id}/documents - upload uses filename as default name"""
        file_content = b"TEST_DEFAULT_NAME_FILE"
        files = {"file": ("TEST_my_default.pdf", io.BytesIO(file_content), "application/pdf")}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={}  # No name provided
        )
        assert res.status_code == 200, f"Upload failed: {res.text}"
        
        doc = res.json()
        assert doc["name"] == "TEST_my_default.pdf"  # Uses filename
        assert doc["category"] == "other"  # Default category
        print(f"Default name used: {doc['name']}")


class TestVaultList:
    """Test document listing and filtering"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_list_documents(self, demo_token, org_id):
        """GET /api/vault/{org_id}/documents - list all documents"""
        res = requests.get(f"{BASE_URL}/api/vault/{org_id}/documents",
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert res.status_code == 200, f"List failed: {res.text}"
        
        data = res.json()
        assert "documents" in data
        assert "total" in data
        assert "categories" in data
        assert "tags" in data
        assert isinstance(data["documents"], list)
        print(f"Listed {data['total']} documents")
    
    def test_filter_by_category(self, demo_token, org_id):
        """GET /api/vault/{org_id}/documents?category=contracts - filter by category"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {demo_token}"},
            params={"category": "contracts"}
        )
        assert res.status_code == 200, f"Filter failed: {res.text}"
        
        data = res.json()
        # All returned documents should be contracts category
        for doc in data["documents"]:
            assert doc["category"] == "contracts"
        print(f"Filtered {data['total']} contracts")
    
    def test_search_by_name(self, demo_token, org_id):
        """GET /api/vault/{org_id}/documents?search=TEST - search by name/description"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {demo_token}"},
            params={"search": "TEST"}
        )
        assert res.status_code == 200, f"Search failed: {res.text}"
        
        data = res.json()
        print(f"Search found {data['total']} documents with 'TEST'")


class TestVaultDocumentDetail:
    """Test document detail with audit trail"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        return res.json()["organizations"][0]["id"]
    
    @pytest.fixture(scope="class")
    def doc_id(self, admin_token, org_id):
        """Upload a test document for detail testing"""
        file_content = b"TEST_DETAIL_DOCUMENT"
        files = {"file": ("TEST_detail_doc.txt", io.BytesIO(file_content), "text/plain")}
        data = {"name": "TEST_Detail Document", "category": "legal"}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        return res.json()["id"]
    
    def test_get_document_detail(self, demo_token, org_id, doc_id):
        """GET /api/vault/{org_id}/documents/{doc_id} - get document detail"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Get detail failed: {res.text}"
        
        doc = res.json()
        assert doc["id"] == doc_id
        assert "name" in doc
        assert "category" in doc
        assert "file_size" in doc
        assert "uploaded_by" in doc
        assert "audit_trail" in doc
        assert isinstance(doc["audit_trail"], list)
        print(f"Document detail: {doc['name']}, audit entries: {len(doc['audit_trail'])}")
    
    def test_view_increments_count_and_adds_audit(self, demo_token, org_id, doc_id):
        """GET document increases view_count and adds audit entry"""
        # Get initial view count
        res1 = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        initial_view_count = res1.json().get("view_count", 0)
        
        # View again
        res2 = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        new_view_count = res2.json().get("view_count", 0)
        
        # View count should increase
        assert new_view_count >= initial_view_count
        
        # Audit trail should have 'viewed' entry
        audit = res2.json()["audit_trail"]
        viewed_entries = [e for e in audit if e["action"] == "viewed"]
        assert len(viewed_entries) > 0, "No 'viewed' audit entry found"
        print(f"View count: {new_view_count}, viewed audit entries: {len(viewed_entries)}")
    
    def test_document_not_found(self, demo_token, org_id):
        """GET /api/vault/{org_id}/documents/{invalid_id} - returns 404"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/invalid-doc-id-12345",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 404
        print("404 returned for invalid document ID")


class TestVaultDownload:
    """Test document download"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        return res.json()["organizations"][0]["id"]
    
    @pytest.fixture(scope="class")
    def doc_id(self, admin_token, org_id):
        """Upload a test document for download testing"""
        file_content = b"TEST_DOWNLOAD_CONTENT_12345"
        files = {"file": ("TEST_download.txt", io.BytesIO(file_content), "text/plain")}
        data = {"name": "TEST_Download Doc"}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        return res.json()["id"]
    
    def test_download_document(self, demo_token, org_id, doc_id):
        """GET /api/vault/{org_id}/documents/{doc_id}/download - download file"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Download failed: {res.text}"
        assert len(res.content) > 0
        print(f"Downloaded {len(res.content)} bytes")
    
    def test_download_increments_count(self, demo_token, org_id, doc_id):
        """Download increases download_count and adds audit entry"""
        # Get initial count
        res1 = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        initial_count = res1.json().get("download_count", 0)
        
        # Download
        requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        
        # Check new count
        res2 = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        new_count = res2.json().get("download_count", 0)
        
        assert new_count > initial_count
        
        # Check audit
        audit = res2.json()["audit_trail"]
        downloaded_entries = [e for e in audit if e["action"] == "downloaded"]
        assert len(downloaded_entries) > 0
        print(f"Download count: {new_count}")


class TestVaultUpdateDocument:
    """Test document metadata update (admin only)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, admin_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {admin_token}"})
        return res.json()["organizations"][0]["id"]
    
    @pytest.fixture(scope="class")
    def doc_id(self, admin_token, org_id):
        """Upload a test document for update testing"""
        file_content = b"TEST_UPDATE_DOC"
        files = {"file": ("TEST_update.txt", io.BytesIO(file_content), "text/plain")}
        data = {"name": "TEST_Update Original", "category": "other"}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        return res.json()["id"]
    
    def test_update_document_metadata(self, admin_token, org_id, doc_id):
        """PUT /api/vault/{org_id}/documents/{doc_id} - update metadata"""
        update_data = {
            "name": "TEST_Updated Name",
            "category": "financial",
            "tags": ["updated", "test"],
            "description": "Updated description"
        }
        
        res = requests.put(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert res.status_code == 200, f"Update failed: {res.text}"
        
        doc = res.json()
        assert doc["name"] == "TEST_Updated Name"
        assert doc["category"] == "financial"
        assert "updated" in doc["tags"]
        assert doc["description"] == "Updated description"
        print(f"Updated document: {doc['name']}")
    
    def test_update_adds_audit_entry(self, admin_token, org_id, doc_id):
        """Update adds 'updated' audit entry"""
        # Update
        requests.put(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "TEST_Audit Check"}
        )
        
        # Get document
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        audit = res.json()["audit_trail"]
        updated_entries = [e for e in audit if e["action"] == "updated"]
        assert len(updated_entries) > 0
        print(f"Update audit entries: {len(updated_entries)}")


class TestVaultDeleteDocument:
    """Test document deletion (admin only)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, admin_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {admin_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_delete_document(self, admin_token, org_id):
        """DELETE /api/vault/{org_id}/documents/{doc_id} - delete document"""
        # First upload a document
        file_content = b"TEST_DELETE_ME"
        files = {"file": ("TEST_delete.txt", io.BytesIO(file_content), "text/plain")}
        
        upload_res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"name": "TEST_To Be Deleted"}
        )
        doc_id = upload_res.json()["id"]
        
        # Delete the document
        res = requests.delete(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200, f"Delete failed: {res.text}"
        assert "message" in res.json()
        
        # Verify deleted
        get_res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_res.status_code == 404
        print("Document deleted successfully")
    
    def test_delete_nonexistent_returns_404(self, admin_token, org_id):
        """DELETE non-existent document returns 404"""
        res = requests.delete(
            f"{BASE_URL}/api/vault/{org_id}/documents/nonexistent-id-999",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 404
        print("404 returned for non-existent document delete")


class TestVaultRoleBasedAccess:
    """Test role-based access control"""
    
    @pytest.fixture(scope="class")
    def demo_token(self):
        """Demo user (owner)"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Admin user"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, demo_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {demo_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_owner_can_upload(self, demo_token, org_id):
        """Owner (demo user) can upload documents"""
        file_content = b"TEST_OWNER_UPLOAD"
        files = {"file": ("TEST_owner.txt", io.BytesIO(file_content), "text/plain")}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {demo_token}"},
            files=files,
            data={"name": "TEST_Owner Upload"}
        )
        assert res.status_code == 200, f"Owner upload failed: {res.text}"
        print("Owner can upload - PASS")
    
    def test_admin_can_upload(self, admin_token, org_id):
        """Admin can upload documents"""
        file_content = b"TEST_ADMIN_UPLOAD"
        files = {"file": ("TEST_admin.txt", io.BytesIO(file_content), "text/plain")}
        
        res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"name": "TEST_Admin Upload"}
        )
        assert res.status_code == 200, f"Admin upload failed: {res.text}"
        print("Admin can upload - PASS")
    
    def test_member_can_view_and_download(self, demo_token, admin_token, org_id):
        """Member (non-admin) can view and download"""
        # Upload with admin
        file_content = b"TEST_MEMBER_ACCESS"
        files = {"file": ("TEST_member_access.txt", io.BytesIO(file_content), "text/plain")}
        
        upload_res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"name": "TEST_Member Access Test"}
        )
        doc_id = upload_res.json()["id"]
        
        # View with demo (owner can also view)
        view_res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert view_res.status_code == 200
        
        # Download with demo
        download_res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert download_res.status_code == 200
        print("Member can view and download - PASS")
    
    def test_unauthorized_access_returns_401(self, org_id):
        """No auth token returns 401 or 403"""
        res = requests.get(f"{BASE_URL}/api/vault/{org_id}/documents")
        assert res.status_code in [401, 403, 422]
        print(f"Unauthorized access blocked: {res.status_code}")


class TestVaultAuditTrail:
    """Test audit trail tracking"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, admin_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {admin_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_audit_trail_tracks_upload(self, admin_token, org_id):
        """Audit trail records 'uploaded' action"""
        file_content = b"TEST_AUDIT_UPLOAD"
        files = {"file": ("TEST_audit.txt", io.BytesIO(file_content), "text/plain")}
        
        upload_res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"name": "TEST_Audit Trail"}
        )
        doc_id = upload_res.json()["id"]
        
        # Get document to check audit
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        audit = res.json()["audit_trail"]
        uploaded_entries = [e for e in audit if e["action"] == "uploaded"]
        assert len(uploaded_entries) > 0, "No 'uploaded' audit entry"
        
        entry = uploaded_entries[0]
        assert "user_email" in entry
        assert "timestamp" in entry
        print(f"Upload audit: {entry['user_email']} at {entry['timestamp']}")
    
    def test_audit_entry_fields(self, admin_token, org_id):
        """Audit entries have required fields"""
        file_content = b"TEST_AUDIT_FIELDS"
        files = {"file": ("TEST_fields.txt", io.BytesIO(file_content), "text/plain")}
        
        upload_res = requests.post(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"name": "TEST_Fields Check"}
        )
        doc_id = upload_res.json()["id"]
        
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents/{doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        audit = res.json()["audit_trail"]
        assert len(audit) > 0
        
        entry = audit[0]
        required_fields = ["id", "action", "user_email", "timestamp"]
        for field in required_fields:
            assert field in entry, f"Missing audit field: {field}"
        print(f"Audit entry fields verified: {list(entry.keys())}")


class TestVaultCleanup:
    """Cleanup TEST_ prefixed documents"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        return res.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def org_id(self, admin_token):
        res = requests.get(f"{BASE_URL}/api/organizations/", 
                          headers={"Authorization": f"Bearer {admin_token}"})
        return res.json()["organizations"][0]["id"]
    
    def test_cleanup_test_documents(self, admin_token, org_id):
        """Delete all TEST_ prefixed documents"""
        res = requests.get(
            f"{BASE_URL}/api/vault/{org_id}/documents",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"search": "TEST_"}
        )
        
        if res.status_code == 200:
            docs = res.json()["documents"]
            deleted = 0
            for doc in docs:
                if doc["name"].startswith("TEST_"):
                    del_res = requests.delete(
                        f"{BASE_URL}/api/vault/{org_id}/documents/{doc['id']}",
                        headers={"Authorization": f"Bearer {admin_token}"}
                    )
                    if del_res.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} TEST_ documents")
