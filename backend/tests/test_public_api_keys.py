"""
Public REST API Testing
Tests for API key management (create/list/revoke), public API endpoints (seal, verify, seals, requests)
"""

import pytest
import requests
import os
import uuid
import hashlib
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"

class TestPublicAPISetup:
    """Setup tests - ensure login works and token is obtained"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Login and get authorization headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return {"Authorization": f"Bearer {data['access_token']}"}

    def test_login_success(self, auth_headers):
        """Verify login works"""
        assert auth_headers is not None
        print("✓ Login successful")


class TestPublicAPIStatus:
    """Test /api/v1/status endpoint - no auth required"""
    
    def test_status_no_auth(self):
        """GET /api/v1/status should work without authentication"""
        response = requests.get(f"{BASE_URL}/api/v1/status")
        assert response.status_code == 200, f"Status endpoint failed: {response.text}"
        data = response.json()
        assert data.get("status") == "operational"
        assert "version" in data
        print("✓ Public API status endpoint works without auth")


class TestAPIKeyManagement:
    """Test API key CRUD operations at /api/developer/keys"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Login and get authorization headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Login failed - skipping API key tests")
        data = response.json()
        return {"Authorization": f"Bearer {data['access_token']}"}

    def test_cleanup_existing_keys(self, auth_headers):
        """Cleanup: Revoke all existing API keys to avoid hitting 5-key limit"""
        response = requests.get(f"{BASE_URL}/api/developer/keys", headers=auth_headers)
        if response.status_code == 200:
            keys = response.json().get("keys", [])
            for key in keys:
                if not key.get("revoked"):
                    requests.delete(f"{BASE_URL}/api/developer/keys/{key['id']}", headers=auth_headers)
                    print(f"  Cleaned up key: {key['name']}")
        print("✓ Cleanup complete")

    def test_create_api_key(self, auth_headers):
        """POST /api/developer/keys - Create new API key"""
        # First cleanup
        self.test_cleanup_existing_keys(auth_headers)
        
        key_name = f"TEST_ApiKey_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/developer/keys",
            json={"name": key_name, "scopes": ["read", "seal", "verify"]},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create API key failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Response missing 'id'"
        assert "key" in data, "Response missing 'key' (raw API key)"
        assert "key_prefix" in data, "Response missing 'key_prefix'"
        assert data["key"].startswith("nc_live_"), f"Key format invalid: {data['key'][:20]}"
        assert data["key_prefix"] == data["key"][:12], "Key prefix doesn't match"
        assert data["name"] == key_name, "Key name doesn't match"
        assert "scopes" in data and "seal" in data["scopes"]
        
        print(f"✓ API key created: {data['key_prefix']}...")
        return data

    def test_list_api_keys(self, auth_headers):
        """GET /api/developer/keys - List all user's API keys"""
        response = requests.get(f"{BASE_URL}/api/developer/keys", headers=auth_headers)
        assert response.status_code == 200, f"List API keys failed: {response.text}"
        data = response.json()
        
        assert "keys" in data, "Response missing 'keys' array"
        assert isinstance(data["keys"], list), "'keys' should be an array"
        
        # Verify keys don't expose full key
        for key in data["keys"]:
            assert "key_hash" not in key, "Response should not expose key_hash"
            assert "key" not in key or len(key.get("key", "")) <= 12, "Full key should not be exposed in list"
            assert "key_prefix" in key, "Key should have prefix"
        
        print(f"✓ Listed {len(data['keys'])} API keys")
        return data["keys"]

    def test_create_and_revoke_key(self, auth_headers):
        """DELETE /api/developer/keys/{id} - Revoke an API key"""
        # Create a key first
        key_name = f"TEST_RevokeKey_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/developer/keys",
            json={"name": key_name, "scopes": ["read"]},
            headers=auth_headers
        )
        assert create_response.status_code == 200, f"Create key failed: {create_response.text}"
        key_id = create_response.json()["id"]
        api_key = create_response.json()["key"]
        
        # Revoke the key
        revoke_response = requests.delete(
            f"{BASE_URL}/api/developer/keys/{key_id}",
            headers=auth_headers
        )
        assert revoke_response.status_code == 200, f"Revoke key failed: {revoke_response.text}"
        
        # Verify key is revoked - using it should return 401
        test_response = requests.get(
            f"{BASE_URL}/api/v1/seals",
            headers={"X-API-Key": api_key}
        )
        assert test_response.status_code == 401, f"Revoked key should return 401, got {test_response.status_code}"
        
        print("✓ API key revoked successfully and returns 401")

    def test_max_keys_limit(self, auth_headers):
        """Test max 5 active keys per user limit"""
        # First cleanup all keys
        self.test_cleanup_existing_keys(auth_headers)
        
        created_keys = []
        # Create 5 keys
        for i in range(5):
            response = requests.post(
                f"{BASE_URL}/api/developer/keys",
                json={"name": f"TEST_LimitKey_{i}", "scopes": ["read"]},
                headers=auth_headers
            )
            assert response.status_code == 200, f"Create key {i} failed: {response.text}"
            created_keys.append(response.json()["id"])
        
        # Try to create 6th key - should fail
        response = requests.post(
            f"{BASE_URL}/api/developer/keys",
            json={"name": "TEST_LimitKey_6", "scopes": ["read"]},
            headers=auth_headers
        )
        assert response.status_code == 400, f"6th key should fail with 400, got {response.status_code}"
        assert "Maximum" in response.json().get("detail", "") or "5" in response.json().get("detail", "")
        
        # Cleanup created keys
        for key_id in created_keys:
            requests.delete(f"{BASE_URL}/api/developer/keys/{key_id}", headers=auth_headers)
        
        print("✓ Max 5 keys limit enforced correctly")

    def test_api_usage_stats(self, auth_headers):
        """GET /api/developer/usage - API usage stats"""
        response = requests.get(f"{BASE_URL}/api/developer/usage", headers=auth_headers)
        assert response.status_code == 200, f"Usage stats failed: {response.text}"
        data = response.json()
        
        assert "total_calls" in data, "Missing 'total_calls'"
        assert "active_keys" in data, "Missing 'active_keys'"
        assert "keys" in data, "Missing 'keys' array"
        assert "recent_activity" in data, "Missing 'recent_activity'"
        
        print(f"✓ Usage stats: {data['total_calls']} total calls, {data['active_keys']} active keys")
        return data


class TestPublicAPIEndpoints:
    """Test public API v1 endpoints with API key authentication"""
    
    @pytest.fixture(scope="class")
    def api_key(self):
        """Create API key for testing"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        auth_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
        
        # Cleanup existing keys
        list_response = requests.get(f"{BASE_URL}/api/developer/keys", headers=auth_headers)
        if list_response.status_code == 200:
            for key in list_response.json().get("keys", []):
                if not key.get("revoked"):
                    requests.delete(f"{BASE_URL}/api/developer/keys/{key['id']}", headers=auth_headers)
        
        # Create new key with all scopes
        response = requests.post(
            f"{BASE_URL}/api/developer/keys",
            json={"name": "TEST_PublicAPI_Key", "scopes": ["read", "seal", "verify"]},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create API key failed: {response.text}"
        key_data = response.json()
        return key_data["key"], key_data["id"], auth_headers

    def test_missing_api_key_returns_401(self):
        """Endpoints requiring auth should return 401 without X-API-Key"""
        response = requests.get(f"{BASE_URL}/api/v1/seals")
        assert response.status_code == 401, f"Expected 401 without API key, got {response.status_code}"
        print("✓ Missing API key returns 401")

    def test_invalid_api_key_returns_401(self):
        """Invalid API key should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/v1/seals",
            headers={"X-API-Key": "nc_live_invalid_key_12345"}
        )
        assert response.status_code == 401, f"Expected 401 with invalid key, got {response.status_code}"
        print("✓ Invalid API key returns 401")

    def test_seal_document(self, api_key):
        """POST /api/v1/seal - Seal document hash on blockchain"""
        key, key_id, auth_headers = api_key
        
        doc_hash = hashlib.sha256(f"test_document_{uuid.uuid4()}".encode()).hexdigest()
        response = requests.post(
            f"{BASE_URL}/api/v1/seal",
            json={
                "document_name": "TEST_api_seal.pdf",
                "document_hash": doc_hash,
                "metadata": {"test": True}
            },
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"Seal failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "seal_id" in data, "Response missing 'seal_id'"
        assert data["document_hash"] == doc_hash
        assert "blockchain" in data
        assert data["blockchain"]["network"] == "hedera_testnet"
        assert "sealed_at" in data
        
        print(f"✓ Document sealed: {data['seal_id']}")
        return data["seal_id"], doc_hash

    def test_verify_document_found(self, api_key):
        """POST /api/v1/verify - Verify document hash (found)"""
        key, key_id, auth_headers = api_key
        
        # First seal a document
        seal_id, doc_hash = self.test_seal_document(api_key)
        
        # Now verify it
        response = requests.post(
            f"{BASE_URL}/api/v1/verify",
            json={"document_hash": doc_hash},
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        assert data["verified"] == True, "Document should be verified"
        assert data["seal_id"] == seal_id
        assert "blockchain" in data
        
        print("✓ Document verified successfully")

    def test_verify_document_not_found(self, api_key):
        """POST /api/v1/verify - Verify document hash (not found)"""
        key, key_id, auth_headers = api_key
        
        random_hash = hashlib.sha256(f"nonexistent_{uuid.uuid4()}".encode()).hexdigest()
        response = requests.post(
            f"{BASE_URL}/api/v1/verify",
            json={"document_hash": random_hash},
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        assert data["verified"] == False, "Random hash should not be verified"
        assert "message" in data
        
        print("✓ Verify returns not found for unknown hash")

    def test_list_seals(self, api_key):
        """GET /api/v1/seals - List user's seals with pagination"""
        key, key_id, auth_headers = api_key
        
        response = requests.get(
            f"{BASE_URL}/api/v1/seals?limit=10&skip=0",
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"List seals failed: {response.text}"
        data = response.json()
        
        assert "seals" in data, "Response missing 'seals'"
        assert "total" in data, "Response missing 'total'"
        assert "limit" in data
        assert "skip" in data
        
        print(f"✓ Listed seals: {data['total']} total")
        return data

    def test_get_specific_seal(self, api_key):
        """GET /api/v1/seals/{seal_id} - Get specific seal"""
        key, key_id, auth_headers = api_key
        
        # First seal a document
        seal_id, doc_hash = self.test_seal_document(api_key)
        
        # Get the seal
        response = requests.get(
            f"{BASE_URL}/api/v1/seals/{seal_id}",
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"Get seal failed: {response.text}"
        data = response.json()
        
        assert data["id"] == seal_id
        assert data["sha256_hash"] == doc_hash
        
        print(f"✓ Got specific seal: {seal_id}")

    def test_get_nonexistent_seal(self, api_key):
        """GET /api/v1/seals/{seal_id} - 404 for nonexistent seal"""
        key, key_id, auth_headers = api_key
        
        response = requests.get(
            f"{BASE_URL}/api/v1/seals/{uuid.uuid4()}",
            headers={"X-API-Key": key}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent seal returns 404")

    def test_list_requests(self, api_key):
        """GET /api/v1/requests - List notarization requests"""
        key, key_id, auth_headers = api_key
        
        response = requests.get(
            f"{BASE_URL}/api/v1/requests",
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"List requests failed: {response.text}"
        data = response.json()
        
        assert "requests" in data
        assert "total" in data
        
        print(f"✓ Listed requests: {data['total']} total")

    def test_list_requests_with_status_filter(self, api_key):
        """GET /api/v1/requests?status=pending - Filter by status"""
        key, key_id, auth_headers = api_key
        
        response = requests.get(
            f"{BASE_URL}/api/v1/requests?status=pending",
            headers={"X-API-Key": key}
        )
        assert response.status_code == 200, f"List requests with filter failed: {response.text}"
        data = response.json()
        
        # All returned requests should have pending status
        for req in data["requests"]:
            assert req.get("status") == "pending" or len(data["requests"]) == 0
        
        print("✓ Request status filter works")

    def test_api_call_logging(self, api_key):
        """Verify API calls are logged to api_logs collection and usage_count incremented"""
        key, key_id, auth_headers = api_key
        
        # Get initial usage
        initial_usage = requests.get(f"{BASE_URL}/api/developer/usage", headers=auth_headers).json()
        initial_calls = initial_usage["total_calls"]
        
        # Make a few API calls
        for _ in range(3):
            requests.get(f"{BASE_URL}/api/v1/seals?limit=1", headers={"X-API-Key": key})
            time.sleep(0.5)  # Small delay to avoid rate limiting
        
        # Check usage increased
        updated_usage = requests.get(f"{BASE_URL}/api/developer/usage", headers=auth_headers).json()
        
        assert updated_usage["total_calls"] > initial_calls, "Usage count should increase"
        assert len(updated_usage["recent_activity"]) > 0, "Recent activity should have entries"
        
        # Check recent activity has our calls
        found_call = False
        for log in updated_usage["recent_activity"]:
            if "/v1/seals" in log.get("endpoint", ""):
                found_call = True
                break
        assert found_call, "API call should be logged"
        
        print(f"✓ API calls logged: {initial_calls} -> {updated_usage['total_calls']}")


class TestScopeRestrictions:
    """Test that API key scopes are enforced"""
    
    @pytest.fixture(scope="class")
    def read_only_key(self):
        """Create API key with only 'read' scope"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        auth_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
        
        # Cleanup
        list_response = requests.get(f"{BASE_URL}/api/developer/keys", headers=auth_headers)
        if list_response.status_code == 200:
            for key in list_response.json().get("keys", []):
                if not key.get("revoked"):
                    requests.delete(f"{BASE_URL}/api/developer/keys/{key['id']}", headers=auth_headers)
        
        # Create read-only key
        response = requests.post(
            f"{BASE_URL}/api/developer/keys",
            json={"name": "TEST_ReadOnly_Key", "scopes": ["read"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        return response.json()["key"]

    def test_seal_without_scope_returns_403(self, read_only_key):
        """POST /api/v1/seal without 'seal' scope should return 403"""
        response = requests.post(
            f"{BASE_URL}/api/v1/seal",
            json={"document_name": "test.pdf", "document_hash": "abc123"},
            headers={"X-API-Key": read_only_key}
        )
        assert response.status_code == 403, f"Expected 403 without seal scope, got {response.status_code}"
        assert "scope" in response.json().get("detail", "").lower()
        print("✓ Seal without scope returns 403")

    def test_verify_without_scope_returns_403(self, read_only_key):
        """POST /api/v1/verify without 'verify' scope should return 403"""
        response = requests.post(
            f"{BASE_URL}/api/v1/verify",
            json={"document_hash": "abc123"},
            headers={"X-API-Key": read_only_key}
        )
        assert response.status_code == 403, f"Expected 403 without verify scope, got {response.status_code}"
        print("✓ Verify without scope returns 403")

    def test_read_with_read_scope_works(self, read_only_key):
        """GET /api/v1/seals with 'read' scope should work"""
        response = requests.get(
            f"{BASE_URL}/api/v1/seals",
            headers={"X-API-Key": read_only_key}
        )
        assert response.status_code == 200, f"Read should work with read scope, got {response.status_code}"
        print("✓ Read with read scope works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
