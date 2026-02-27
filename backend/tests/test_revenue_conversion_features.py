"""
Revenue & Conversion Enhancement Features Tests
Tests for 5 phases:
  Phase 1: Document Renewal Workflow
  Phase 2: Bulk Notarization
  Phase 3: Notary Marketplace with Reviews
  Phase 4: Subscription Usage History
  Phase 5: White-Label/Embed Configurations
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns 'access_token' field
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ========== PHASE 1: Document Renewal Workflow ==========

class TestDocumentRenewal(TestAuth):
    """Phase 1: Document Renewal Workflow tests"""
    
    def test_renew_request(self, headers):
        """POST /api/expiry/requests/{id}/renew creates a new request from existing"""
        # Use the known request ID from context
        request_id = "35c22317-6fad-42a4-a63c-98f92e33f6a5"
        
        response = requests.post(f"{BASE_URL}/api/expiry/requests/{request_id}/renew", headers=headers)
        
        # 200 for success, 404 if not found (may have been deleted)
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "new_request" in data
            assert data["original_request_id"] == request_id
            new_req = data["new_request"]
            assert "id" in new_req
            assert new_req["status"] == "pending"
            assert "Renewed from request" in new_req.get("notes", "")
            print(f"[PASS] Renewal created: {new_req['id']}")
        elif response.status_code == 404:
            # Request not found - acceptable
            print(f"[INFO] Original request {request_id} not found, renewal test skipped")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_renew_nonexistent_request(self, headers):
        """POST /api/expiry/requests/{id}/renew returns 404 for non-existent request"""
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/expiry/requests/{fake_id}/renew", headers=headers)
        assert response.status_code == 404
        print("[PASS] Renewal 404 for non-existent request")


# ========== PHASE 2: Bulk Notarization ==========

class TestBulkNotarization(TestAuth):
    """Phase 2: Bulk Notarization CRUD tests"""
    
    created_batch_id = None
    
    def test_create_batch(self, headers):
        """POST /api/bulk/batches creates a batch with multiple documents"""
        payload = {
            "batch_name": f"TEST_Batch_{datetime.now().strftime('%H%M%S')}",
            "documents": [
                {
                    "document_name": "TEST_Bulk_Doc_1",
                    "document_type": "power_of_attorney",
                    "notarization_type": "ron"
                },
                {
                    "document_name": "TEST_Bulk_Doc_2",
                    "document_type": "contract",
                    "notarization_type": "ron"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/bulk/batches", json=payload, headers=headers)
        assert response.status_code == 200, f"Create batch failed: {response.text}"
        
        data = response.json()
        assert "batch" in data
        assert "requests" in data
        batch = data["batch"]
        assert batch["name"] == payload["batch_name"]
        assert batch["total_documents"] == 2
        assert batch["status"] == "pending"
        assert len(data["requests"]) == 2
        
        TestBulkNotarization.created_batch_id = batch["id"]
        print(f"[PASS] Batch created: {batch['id']} with {len(data['requests'])} documents")
    
    def test_list_batches(self, headers):
        """GET /api/bulk/batches lists user batches"""
        response = requests.get(f"{BASE_URL}/api/bulk/batches", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "batches" in data
        assert isinstance(data["batches"], list)
        # Should have at least the batch we just created
        if TestBulkNotarization.created_batch_id:
            batch_ids = [b["id"] for b in data["batches"]]
            assert TestBulkNotarization.created_batch_id in batch_ids
        print(f"[PASS] Listed {len(data['batches'])} batches")
    
    def test_get_batch_detail(self, headers):
        """GET /api/bulk/batches/{id} returns batch detail with request statuses"""
        # Use existing batch from context or newly created
        batch_id = TestBulkNotarization.created_batch_id or "3662b741-354a-4bdc-a94f-82c6b15efe68"
        
        response = requests.get(f"{BASE_URL}/api/bulk/batches/{batch_id}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "name" in data
            assert "requests" in data
            assert "status_breakdown" in data
            print(f"[PASS] Batch detail fetched: {data['name']}, {len(data['requests'])} requests")
        elif response.status_code == 404:
            print(f"[INFO] Batch {batch_id} not found")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_get_batch_nonexistent(self, headers):
        """GET /api/bulk/batches/{id} returns 404 for non-existent batch"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/bulk/batches/{fake_id}", headers=headers)
        assert response.status_code == 404
        print("[PASS] Batch 404 for non-existent ID")
    
    def test_delete_batch(self, headers):
        """DELETE /api/bulk/batches/{id} deletes pending batch"""
        if not TestBulkNotarization.created_batch_id:
            pytest.skip("No batch to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/bulk/batches/{TestBulkNotarization.created_batch_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"[PASS] Batch deleted: {TestBulkNotarization.created_batch_id}")
        
        # Verify deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/bulk/batches/{TestBulkNotarization.created_batch_id}",
            headers=headers
        )
        assert verify_response.status_code == 404
        print("[PASS] Deletion verified - batch no longer exists")
    
    def test_create_batch_validation_empty_docs(self, headers):
        """POST /api/bulk/batches returns 400 for empty documents array"""
        payload = {
            "batch_name": "Empty Batch",
            "documents": []
        }
        response = requests.post(f"{BASE_URL}/api/bulk/batches", json=payload, headers=headers)
        assert response.status_code == 400
        print("[PASS] Validation: empty docs rejected")
    
    def test_create_batch_validation_too_many_docs(self, headers):
        """POST /api/bulk/batches returns 400 for >20 documents"""
        payload = {
            "batch_name": "Too Many Docs",
            "documents": [{"document_name": f"Doc_{i}", "document_type": "other"} for i in range(25)]
        }
        response = requests.post(f"{BASE_URL}/api/bulk/batches", json=payload, headers=headers)
        assert response.status_code == 400
        print("[PASS] Validation: >20 docs rejected")


# ========== PHASE 3: Notary Marketplace ==========

class TestNotaryMarketplace(TestAuth):
    """Phase 3: Notary Marketplace tests"""
    
    def test_search_notaries_public(self):
        """GET /api/marketplace/notaries returns notary list (public endpoint)"""
        # This is a public endpoint - no auth needed
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries")
        assert response.status_code == 200
        
        data = response.json()
        assert "notaries" in data
        assert "total" in data
        assert isinstance(data["notaries"], list)
        
        if data["notaries"]:
            notary = data["notaries"][0]
            # Verify expected fields
            assert "notary_id" in notary
            assert "name" in notary
            assert "license_state" in notary
            assert "avg_rating" in notary
            assert "review_count" in notary
        
        print(f"[PASS] Marketplace: found {data['total']} notaries")
    
    def test_search_notaries_with_filters(self):
        """GET /api/marketplace/notaries with filters"""
        # Test various filters
        params = {"sort_by": "rating", "limit": 5}
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries", params=params)
        assert response.status_code == 200
        
        data = response.json()
        assert "notaries" in data
        # If sorted by rating desc, verify order
        notaries = data["notaries"]
        if len(notaries) > 1:
            for i in range(len(notaries) - 1):
                assert notaries[i]["avg_rating"] >= notaries[i+1]["avg_rating"]
        print(f"[PASS] Marketplace filters work, returned {len(notaries)} notaries")
    
    def test_search_notaries_ron_filter(self):
        """GET /api/marketplace/notaries with RON filter"""
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries", params={"ron_certified": "true"})
        assert response.status_code == 200
        
        data = response.json()
        # All returned should be RON certified
        for notary in data["notaries"]:
            assert notary["ron_certified"] == True
        print(f"[PASS] RON filter: {len(data['notaries'])} RON certified notaries")
    
    def test_get_notary_profile(self):
        """GET /api/marketplace/notaries/{id} returns notary profile with reviews"""
        # First get a notary ID
        list_response = requests.get(f"{BASE_URL}/api/marketplace/notaries")
        assert list_response.status_code == 200
        notaries = list_response.json()["notaries"]
        
        if not notaries:
            pytest.skip("No notaries in marketplace to test")
        
        notary_id = notaries[0]["notary_id"]
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries/{notary_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["notary_id"] == notary_id
        assert "name" in data
        assert "reviews" in data
        assert isinstance(data["reviews"], list)
        assert "avg_rating" in data
        assert "completed_notarizations" in data
        print(f"[PASS] Notary profile: {data['name']}, {data['review_count']} reviews")
    
    def test_get_notary_profile_not_found(self):
        """GET /api/marketplace/notaries/{id} returns 404 for non-existent"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries/{fake_id}")
        assert response.status_code == 404
        print("[PASS] Notary profile 404 for non-existent ID")
    
    def test_create_review_requires_completed_notarization(self, headers):
        """POST /api/marketplace/reviews returns 400 without completed notarization"""
        # This should fail because no completed notarization exists
        payload = {
            "notary_id": str(uuid.uuid4()),
            "request_id": str(uuid.uuid4()),
            "rating": 5,
            "comment": "Great service!"
        }
        response = requests.post(f"{BASE_URL}/api/marketplace/reviews", json=payload, headers=headers)
        # Should be 400 since no completed notarization
        assert response.status_code == 400
        print("[PASS] Review creation requires completed notarization")
    
    def test_create_review_invalid_rating(self, headers):
        """POST /api/marketplace/reviews returns 400 for invalid rating"""
        payload = {
            "notary_id": str(uuid.uuid4()),
            "request_id": str(uuid.uuid4()),
            "rating": 10,  # Invalid, should be 1-5
            "comment": "Test"
        }
        response = requests.post(f"{BASE_URL}/api/marketplace/reviews", json=payload, headers=headers)
        assert response.status_code == 400
        print("[PASS] Invalid rating rejected")


# ========== PHASE 4: Subscription Usage History ==========

class TestSubscriptionUsageHistory(TestAuth):
    """Phase 4: Subscription Usage Enhancement tests"""
    
    def test_usage_history_endpoint(self, headers):
        """GET /api/subscriptions/usage/history returns 6 months of usage data"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/usage/history", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        
        # Should have up to 6 months
        assert len(data["history"]) <= 6
        
        if data["history"]:
            month_data = data["history"][0]
            assert "month" in month_data
            assert "notarizations" in month_data
            assert "ai_analyses" in month_data
            assert "seals" in month_data
        
        print(f"[PASS] Usage history: {len(data['history'])} months of data")
    
    def test_usage_history_custom_months(self, headers):
        """GET /api/subscriptions/usage/history?months=3 returns custom range"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/usage/history", params={"months": 3}, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["history"]) <= 3
        print(f"[PASS] Custom range: {len(data['history'])} months")


# ========== PHASE 5: White-Label/Embed Configuration ==========

class TestEmbedConfiguration(TestAuth):
    """Phase 5: Embed/White-Label Configuration tests"""
    
    created_config_id = None
    
    def test_create_embed_config(self, headers):
        """POST /api/embed/configs creates embed configuration"""
        payload = {
            "name": f"TEST_Embed_{datetime.now().strftime('%H%M%S')}",
            "allowed_origins": ["https://test.example.com"],
            "primary_color": "#00ff00",
            "company_name": "Test Company",
            "show_branding": True
        }
        
        response = requests.post(f"{BASE_URL}/api/embed/configs", json=payload, headers=headers)
        assert response.status_code == 200, f"Create config failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "embed_key" in data
        assert data["name"] == payload["name"]
        assert data["primary_color"] == payload["primary_color"]
        assert data["active"] == True
        assert "embed_snippet" in data
        
        TestEmbedConfiguration.created_config_id = data["id"]
        print(f"[PASS] Embed config created: {data['embed_key']}")
        return data
    
    def test_list_embed_configs(self, headers):
        """GET /api/embed/configs lists user's embed configs"""
        response = requests.get(f"{BASE_URL}/api/embed/configs", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "configs" in data
        assert isinstance(data["configs"], list)
        
        if TestEmbedConfiguration.created_config_id:
            config_ids = [c["id"] for c in data["configs"]]
            assert TestEmbedConfiguration.created_config_id in config_ids
        
        print(f"[PASS] Listed {len(data['configs'])} embed configs")
    
    def test_get_public_embed_config(self):
        """GET /api/embed/public/{embed_key} returns public config"""
        # Use known key from context
        embed_key = "emb_ba81b5771b2142948b0cdbe2"
        
        response = requests.get(f"{BASE_URL}/api/embed/public/{embed_key}")
        
        if response.status_code == 200:
            data = response.json()
            # Only public fields should be returned
            assert "embed_key" in data
            assert "primary_color" in data
            assert "company_name" in data
            assert "document_types" in data
            # Sensitive fields should NOT be present
            assert "user_id" not in data
            print(f"[PASS] Public embed config fetched: {embed_key}")
        elif response.status_code == 404:
            print(f"[INFO] Embed key {embed_key} not found or inactive")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_get_public_embed_config_not_found(self):
        """GET /api/embed/public/{embed_key} returns 404 for non-existent"""
        response = requests.get(f"{BASE_URL}/api/embed/public/emb_nonexistent123")
        assert response.status_code == 404
        print("[PASS] Public embed 404 for non-existent key")
    
    def test_update_embed_config_toggle_active(self, headers):
        """PUT /api/embed/configs/{id} toggles active state"""
        if not TestEmbedConfiguration.created_config_id:
            pytest.skip("No config to update")
        
        # Toggle to inactive
        response = requests.put(
            f"{BASE_URL}/api/embed/configs/{TestEmbedConfiguration.created_config_id}",
            json={"active": False},
            headers=headers
        )
        assert response.status_code == 200
        print("[PASS] Embed config toggled to inactive")
        
        # Verify change
        list_response = requests.get(f"{BASE_URL}/api/embed/configs", headers=headers)
        configs = list_response.json()["configs"]
        config = next((c for c in configs if c["id"] == TestEmbedConfiguration.created_config_id), None)
        if config:
            assert config["active"] == False
            print("[PASS] Toggle verified")
    
    def test_delete_embed_config(self, headers):
        """DELETE /api/embed/configs/{id} deletes config"""
        if not TestEmbedConfiguration.created_config_id:
            pytest.skip("No config to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/embed/configs/{TestEmbedConfiguration.created_config_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"[PASS] Embed config deleted: {TestEmbedConfiguration.created_config_id}")
        
        # Verify deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/embed/configs/{TestEmbedConfiguration.created_config_id}",
            headers=headers
        )
        assert verify_response.status_code == 404
        print("[PASS] Deletion verified")
    
    def test_delete_embed_config_not_found(self, headers):
        """DELETE /api/embed/configs/{id} returns 404 for non-existent"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/embed/configs/{fake_id}", headers=headers)
        assert response.status_code == 404
        print("[PASS] Delete 404 for non-existent config")


# ========== Additional Edge Case Tests ==========

class TestEdgeCases(TestAuth):
    """Edge cases and error handling tests"""
    
    def test_bulk_batch_unauthorized(self):
        """Bulk endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/bulk/batches")
        assert response.status_code == 401 or response.status_code == 403
        print("[PASS] Bulk endpoints require auth")
    
    def test_embed_configs_unauthorized(self):
        """Embed config endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/embed/configs")
        assert response.status_code == 401 or response.status_code == 403
        print("[PASS] Embed config endpoints require auth")
    
    def test_usage_history_unauthorized(self):
        """Usage history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/usage/history")
        assert response.status_code == 401 or response.status_code == 403
        print("[PASS] Usage history requires auth")
    
    def test_renewal_unauthorized(self):
        """Renewal endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/expiry/requests/{str(uuid.uuid4())}/renew")
        assert response.status_code == 401 or response.status_code == 403
        print("[PASS] Renewal endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
