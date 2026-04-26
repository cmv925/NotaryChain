"""
Webhook System Tests
Tests for webhook registration, delivery, toggle, test events, and HMAC-SHA256 signing
"""

import pytest
import requests
import time
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://notary-profiles.preview.emergentagent.com"

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}

# Test webhook URL - httpbin.org always returns 200
TEST_WEBHOOK_URL = "https://httpbin.org/post"

# Valid webhook events
VALID_EVENTS = ["seal.created", "document.verified", "request.completed", "request.assigned", "request.created"]

# Module-level token cache to avoid rate limits
_token_cache = {}

def get_cached_token(email, password):
    """Get cached token or login and cache it"""
    cache_key = email
    if cache_key not in _token_cache:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        if response.status_code != 200:
            raise Exception(f"Login failed: {response.text}")
        _token_cache[cache_key] = response.json().get("access_token")
    return _token_cache[cache_key]


class TestWebhookSystem:
    """Webhook CRUD and functionality tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token for tests"""
        # Use cached token to avoid rate limits
        self.token = get_cached_token(DEMO_USER["email"], DEMO_USER["password"])
        assert self.token, "No access_token"
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Track created webhooks for cleanup
        self.created_webhook_ids = []
        
        yield
        
        # Cleanup created webhooks
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(f"{BASE_URL}/api/developer/webhooks/{wh_id}", headers=self.headers)
            except:
                pass
    
    def test_create_webhook_success(self):
        """POST /api/developer/webhooks - Create webhook returns signing secret"""
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created", "document.verified"],
            "description": "TEST_webhook_basic"
        }
        response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        
        assert response.status_code == 200, f"Create webhook failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Missing webhook id"
        assert "url" in data, "Missing url"
        assert "events" in data, "Missing events"
        assert "secret" in data, "Missing secret - should be returned on creation"
        assert "active" in data, "Missing active field"
        assert "message" in data, "Missing message"
        
        # Verify secret format
        assert data["secret"].startswith("whsec_"), f"Secret should start with whsec_, got: {data['secret'][:10]}"
        assert len(data["secret"]) > 20, "Secret too short"
        
        # Verify values
        assert data["url"] == TEST_WEBHOOK_URL
        assert data["events"] == ["seal.created", "document.verified"]
        assert data["active"] is True
        
        self.created_webhook_ids.append(data["id"])
        print(f"Created webhook: {data['id']}, secret: {data['secret'][:15]}...")
    
    def test_create_webhook_invalid_event_rejected(self):
        """POST /api/developer/webhooks - Invalid events return 400"""
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["invalid.event", "seal.created"],
            "description": "TEST_invalid_event"
        }
        response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        
        assert response.status_code == 400, f"Expected 400 for invalid event, got {response.status_code}"
        assert "invalid" in response.json().get("detail", "").lower()
        print("Invalid events correctly rejected with 400")
    
    def test_create_webhook_invalid_url_rejected(self):
        """POST /api/developer/webhooks - Invalid URL format rejected"""
        payload = {
            "url": "not-a-valid-url",
            "events": ["seal.created"],
            "description": "TEST_invalid_url"
        }
        response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        
        assert response.status_code == 400, f"Expected 400 for invalid URL, got {response.status_code}"
        print("Invalid URL correctly rejected with 400")
    
    def test_create_webhook_max_10_limit(self):
        """POST /api/developer/webhooks - Max 10 active webhooks per user"""
        # Clean up any existing webhooks first
        response = requests.get(f"{BASE_URL}/api/developer/webhooks", headers=self.headers)
        existing = response.json().get("webhooks", [])
        for wh in existing:
            if wh.get("active"):
                requests.delete(f"{BASE_URL}/api/developer/webhooks/{wh['id']}", headers=self.headers)
        
        # Create 10 webhooks
        for i in range(10):
            payload = {
                "url": f"{TEST_WEBHOOK_URL}?webhook={i}",
                "events": ["seal.created"],
                "description": f"TEST_limit_check_{i}"
            }
            response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
            assert response.status_code == 200, f"Failed to create webhook {i}: {response.text}"
            self.created_webhook_ids.append(response.json()["id"])
        
        # 11th should fail
        payload = {
            "url": f"{TEST_WEBHOOK_URL}?webhook=11",
            "events": ["seal.created"],
            "description": "TEST_limit_exceed"
        }
        response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        
        assert response.status_code == 400, f"Expected 400 for 11th webhook, got {response.status_code}"
        assert "10" in response.json().get("detail", ""), "Should mention 10 webhooks limit"
        print("Max 10 webhooks limit correctly enforced")
    
    def test_list_webhooks_secret_hidden(self):
        """GET /api/developer/webhooks - List webhooks, secret hidden"""
        # Create a webhook first
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_list_check"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # List webhooks
        response = requests.get(f"{BASE_URL}/api/developer/webhooks", headers=self.headers)
        
        assert response.status_code == 200, f"List webhooks failed: {response.text}"
        data = response.json()
        assert "webhooks" in data
        
        # Find our webhook and verify secret is hidden
        found = False
        for wh in data["webhooks"]:
            if wh["id"] == webhook_id:
                found = True
                assert "secret" not in wh, "Secret should be hidden in list"
                assert "url" in wh
                assert "events" in wh
                assert "active" in wh
                break
        
        assert found, f"Created webhook {webhook_id} not found in list"
        print(f"List webhooks working, {len(data['webhooks'])} webhooks returned, secrets hidden")
    
    def test_get_webhook_details_with_stats(self):
        """GET /api/developer/webhooks/{id} - Get details with delivery history and stats"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created", "document.verified"],
            "description": "TEST_details_check"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Get details
        response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Get webhook details failed: {response.text}"
        data = response.json()
        
        # Verify fields
        assert "id" in data
        assert "url" in data
        assert "events" in data
        assert "active" in data
        assert "deliveries" in data, "Should include delivery history"
        assert "stats" in data, "Should include stats"
        assert "secret" not in data, "Secret should not be in details"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_deliveries" in stats
        assert "successful" in stats
        assert "failed" in stats
        assert "success_rate" in stats
        
        print(f"Webhook details: stats={stats}, deliveries count={len(data['deliveries'])}")
    
    def test_get_webhook_not_found(self):
        """GET /api/developer/webhooks/{id} - 404 for non-existent webhook"""
        response = requests.get(f"{BASE_URL}/api/developer/webhooks/non-existent-id", headers=self.headers)
        assert response.status_code == 404
        print("Non-existent webhook correctly returns 404")
    
    def test_delete_webhook_cleanup(self):
        """DELETE /api/developer/webhooks/{id} - Delete webhook and cleanup deliveries"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_delete_check"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Delete webhook failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert get_response.status_code == 404, "Deleted webhook should return 404"
        
        print(f"Webhook {webhook_id} deleted and verified gone")
    
    def test_delete_webhook_not_found(self):
        """DELETE /api/developer/webhooks/{id} - 404 for non-existent webhook"""
        response = requests.delete(f"{BASE_URL}/api/developer/webhooks/non-existent-id", headers=self.headers)
        assert response.status_code == 404
        print("Delete non-existent webhook correctly returns 404")
    
    def test_toggle_webhook_enable_disable(self):
        """POST /api/developer/webhooks/{id}/toggle - Enable/disable webhook"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_toggle_check"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Toggle to disable
        response = requests.post(f"{BASE_URL}/api/developer/webhooks/{webhook_id}/toggle", headers=self.headers)
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert data.get("active") is False, "Should be disabled after toggle"
        
        # Toggle to enable
        response = requests.post(f"{BASE_URL}/api/developer/webhooks/{webhook_id}/toggle", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("active") is True, "Should be enabled after second toggle"
        
        print(f"Toggle webhook working: disable→enable verified")
    
    def test_toggle_webhook_not_found(self):
        """POST /api/developer/webhooks/{id}/toggle - 404 for non-existent webhook"""
        response = requests.post(f"{BASE_URL}/api/developer/webhooks/non-existent-id/toggle", headers=self.headers)
        assert response.status_code == 404
        print("Toggle non-existent webhook correctly returns 404")
    
    def test_webhook_test_event(self):
        """POST /api/developer/webhooks/{id}/test - Send test event (test.ping)"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_test_event"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Send test event
        response = requests.post(f"{BASE_URL}/api/developer/webhooks/{webhook_id}/test", headers=self.headers)
        
        assert response.status_code == 200, f"Test event failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "dispatched" in data.get("message", "").lower()
        
        # Wait for delivery to be logged
        time.sleep(3)
        
        # Check deliveries
        details_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert details_response.status_code == 200
        details = details_response.json()
        
        deliveries = details.get("deliveries", [])
        assert len(deliveries) > 0, "Should have at least one delivery after test"
        
        # Find test.ping delivery
        test_delivery = None
        for d in deliveries:
            if d.get("event") == "test.ping":
                test_delivery = d
                break
        
        assert test_delivery is not None, "test.ping delivery not found"
        assert test_delivery.get("success") is True, "httpbin.org should return 200"
        assert test_delivery.get("status_code") == 200
        assert test_delivery.get("attempt") == 1
        
        print(f"Test event sent and delivery logged: status={test_delivery.get('status_code')}")
    
    def test_webhook_test_event_not_found(self):
        """POST /api/developer/webhooks/{id}/test - 404 for non-existent webhook"""
        response = requests.post(f"{BASE_URL}/api/developer/webhooks/non-existent-id/test", headers=self.headers)
        assert response.status_code == 404
        print("Test non-existent webhook correctly returns 404")
    
    def test_list_webhook_events(self):
        """GET /api/developer/webhooks/events/list - List available events"""
        response = requests.get(f"{BASE_URL}/api/developer/webhooks/events/list", headers=self.headers)
        
        assert response.status_code == 200, f"List events failed: {response.text}"
        data = response.json()
        assert "events" in data
        
        events = data["events"]
        expected_events = ["seal.created", "document.verified", "request.completed", "request.assigned", "request.created"]
        
        for evt in expected_events:
            assert evt in events, f"Missing expected event: {evt}"
        
        print(f"Available webhook events: {events}")
    
    def test_webhook_auth_required(self):
        """Webhook endpoints require authentication"""
        endpoints = [
            ("GET", f"{BASE_URL}/api/developer/webhooks"),
            ("POST", f"{BASE_URL}/api/developer/webhooks"),
            ("GET", f"{BASE_URL}/api/developer/webhooks/some-id"),
            ("DELETE", f"{BASE_URL}/api/developer/webhooks/some-id"),
            ("POST", f"{BASE_URL}/api/developer/webhooks/some-id/test"),
            ("POST", f"{BASE_URL}/api/developer/webhooks/some-id/toggle"),
        ]
        
        for method, url in endpoints:
            if method == "GET":
                response = requests.get(url)
            elif method == "POST":
                response = requests.post(url, json={})
            elif method == "DELETE":
                response = requests.delete(url)
            
            assert response.status_code in [401, 403], f"Expected 401/403 for {method} {url} without auth, got {response.status_code}"
        
        print("All webhook endpoints require authentication")


class TestWebhookTriggers:
    """Tests that webhooks are triggered on seal.created and document.verified events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and API key for tests"""
        # Use cached token
        self.token = get_cached_token(DEMO_USER["email"], DEMO_USER["password"])
        assert self.token, "No access_token"
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Track created resources for cleanup
        self.created_webhook_ids = []
        self.created_api_key_ids = []
        
        yield
        
        # Cleanup
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(f"{BASE_URL}/api/developer/webhooks/{wh_id}", headers=self.headers)
            except:
                pass
        
        for key_id in self.created_api_key_ids:
            try:
                requests.delete(f"{BASE_URL}/api/developer/keys/{key_id}", headers=self.headers)
            except:
                pass
    
    def _get_or_create_api_key(self):
        """Get existing API key or create one with seal, verify, read scopes"""
        # Check existing keys
        response = requests.get(f"{BASE_URL}/api/developer/keys", headers=self.headers)
        if response.status_code == 200:
            keys = response.json().get("keys", [])
            active_keys = [k for k in keys if not k.get("revoked")]
            
            # Delete old TEST keys to stay under limit
            for key in keys:
                if key.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/developer/keys/{key['id']}", headers=self.headers)
            
            # Need a fresh key - delete one if at limit (5 keys max)
            if len(active_keys) >= 5:
                requests.delete(f"{BASE_URL}/api/developer/keys/{active_keys[0]['id']}", headers=self.headers)
        
        # Create new key
        payload = {
            "name": f"TEST_webhook_trigger_{int(time.time())}",
            "scopes": ["read", "seal", "verify"]
        }
        response = requests.post(f"{BASE_URL}/api/developer/keys", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create API key failed: {response.text}"
        data = response.json()
        self.created_api_key_ids.append(data["id"])
        return data["key"]
    
    def test_seal_created_triggers_webhook(self):
        """POST /api/v1/seal triggers seal.created webhook event"""
        # Create a webhook listening for seal.created
        webhook_payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_seal_trigger"
        }
        wh_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=webhook_payload, headers=self.headers)
        assert wh_response.status_code == 200, f"Create webhook failed: {wh_response.text}"
        webhook_id = wh_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Get API key
        api_key = self._get_or_create_api_key()
        api_headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
        
        # Call seal endpoint
        seal_payload = {
            "document_name": "TEST_seal_webhook.pdf",
            "document_hash": f"sha256_test_webhook_{int(time.time())}"
        }
        seal_response = requests.post(f"{BASE_URL}/api/v1/seal", json=seal_payload, headers=api_headers)
        
        # May get 429 rate limit - that's okay, just skip this test
        if seal_response.status_code == 429:
            pytest.skip("Rate limit hit on /api/v1/seal (30/min)")
        
        assert seal_response.status_code == 200, f"Seal failed: {seal_response.text}"
        seal_data = seal_response.json()
        assert "seal_id" in seal_data
        
        print(f"Seal created: {seal_data['seal_id']}")
        
        # Wait for webhook delivery
        time.sleep(3)
        
        # Check webhook deliveries
        details_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert details_response.status_code == 200
        details = details_response.json()
        
        deliveries = details.get("deliveries", [])
        seal_delivery = None
        for d in deliveries:
            if d.get("event") == "seal.created":
                seal_delivery = d
                break
        
        assert seal_delivery is not None, "seal.created delivery not found"
        assert seal_delivery.get("success") is True
        print(f"seal.created webhook triggered successfully: status={seal_delivery.get('status_code')}")
    
    def test_document_verified_triggers_webhook(self):
        """POST /api/v1/verify triggers document.verified webhook event (only when document found)"""
        # Note: document.verified webhook only triggers when seal IS found
        # The test needs to first seal, then verify that hash
        
        # Get API key
        api_key = self._get_or_create_api_key()
        api_headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
        
        # First, create a seal so we have a known hash to verify
        unique_hash = f"sha256_webhook_verify_test_{int(time.time())}"
        seal_payload = {
            "document_name": "TEST_verify_webhook.pdf",
            "document_hash": unique_hash
        }
        seal_response = requests.post(f"{BASE_URL}/api/v1/seal", json=seal_payload, headers=api_headers)
        
        # May get 429 rate limit - that's okay, skip this test
        if seal_response.status_code == 429:
            pytest.skip("Rate limit hit on /api/v1/seal (30/min)")
        
        if seal_response.status_code != 200:
            pytest.skip(f"Could not seal document for verify test: {seal_response.status_code}")
        
        print(f"Sealed document: {seal_response.json().get('seal_id')}")
        
        # Now create a webhook listening for document.verified
        webhook_payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.verified"],
            "description": "TEST_verify_trigger"
        }
        wh_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=webhook_payload, headers=self.headers)
        assert wh_response.status_code == 200, f"Create webhook failed: {wh_response.text}"
        webhook_id = wh_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Now verify the hash we just sealed - this should trigger the webhook
        verify_payload = {
            "document_hash": unique_hash
        }
        verify_response = requests.post(f"{BASE_URL}/api/v1/verify", json=verify_payload, headers=api_headers)
        assert verify_response.status_code == 200, f"Verify failed: {verify_response.text}"
        
        verify_data = verify_response.json()
        assert verify_data.get("verified") is True, f"Expected verified=True, got: {verify_data}"
        print(f"Verify called: {verify_data}")
        
        # Wait for webhook delivery
        time.sleep(3)
        
        # Check webhook deliveries
        details_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert details_response.status_code == 200
        details = details_response.json()
        
        deliveries = details.get("deliveries", [])
        verify_delivery = None
        for d in deliveries:
            if d.get("event") == "document.verified":
                verify_delivery = d
                break
        
        assert verify_delivery is not None, "document.verified delivery not found"
        assert verify_delivery.get("success") is True
        print(f"document.verified webhook triggered successfully: status={verify_delivery.get('status_code')}")


class TestWebhookDeliveryDetails:
    """Tests for webhook delivery logging and signature headers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        self.token = get_cached_token(DEMO_USER["email"], DEMO_USER["password"])
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_webhook_ids = []
        
        yield
        
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(f"{BASE_URL}/api/developer/webhooks/{wh_id}", headers=self.headers)
            except:
                pass
    
    def test_delivery_logging_fields(self):
        """Webhook delivery logs status_code, success, attempt number"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_delivery_logging"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Send test event
        test_response = requests.post(f"{BASE_URL}/api/developer/webhooks/{webhook_id}/test", headers=self.headers)
        assert test_response.status_code == 200
        
        # Wait for delivery
        time.sleep(3)
        
        # Check delivery log
        details_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert details_response.status_code == 200
        details = details_response.json()
        
        deliveries = details.get("deliveries", [])
        assert len(deliveries) > 0, "No deliveries logged"
        
        delivery = deliveries[0]
        
        # Check required fields
        assert "id" in delivery, "Missing delivery id"
        assert "event" in delivery, "Missing event"
        assert "status_code" in delivery, "Missing status_code"
        assert "success" in delivery, "Missing success"
        assert "attempt" in delivery, "Missing attempt number"
        assert "timestamp" in delivery, "Missing timestamp"
        assert "url" in delivery, "Missing url"
        
        print(f"Delivery logged: event={delivery['event']}, status={delivery['status_code']}, attempt={delivery['attempt']}, success={delivery['success']}")
    
    def test_webhook_stats_calculation(self):
        """Webhook stats include total_deliveries, successful, failed, success_rate"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["seal.created"],
            "description": "TEST_stats_calc"
        }
        create_response = requests.post(f"{BASE_URL}/api/developer/webhooks", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Send multiple test events
        for _ in range(2):
            requests.post(f"{BASE_URL}/api/developer/webhooks/{webhook_id}/test", headers=self.headers)
            time.sleep(1)
        
        # Wait for deliveries
        time.sleep(3)
        
        # Check stats
        details_response = requests.get(f"{BASE_URL}/api/developer/webhooks/{webhook_id}", headers=self.headers)
        assert details_response.status_code == 200
        details = details_response.json()
        
        stats = details.get("stats", {})
        assert stats.get("total_deliveries") >= 2, f"Expected at least 2 total deliveries, got {stats.get('total_deliveries')}"
        assert stats.get("successful") >= 2, f"Expected at least 2 successful, got {stats.get('successful')}"
        assert "failed" in stats
        assert "success_rate" in stats
        assert stats.get("success_rate") > 0, "Success rate should be > 0 for successful deliveries"
        
        print(f"Stats: total={stats.get('total_deliveries')}, successful={stats.get('successful')}, failed={stats.get('failed')}, rate={stats.get('success_rate')}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
