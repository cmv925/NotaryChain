"""
Organization Webhooks Tests
Tests for organization webhook CRUD, delivery, test ping, rotate secret, and RBAC integration
Event types: document.notarized, document.uploaded, member.joined, member.removed, member.invited, 
role.assigned, role.created, approval.created, approval.decided, vault.uploaded, sso.login
"""

import pytest
import requests
import time
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://chain-cloud-storage.preview.emergentagent.com"

# Test credentials  
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}

# Test webhook URL - httpbin.org always returns 200
TEST_WEBHOOK_URL = "https://httpbin.org/post"

# 11 supported event types
SUPPORTED_EVENTS = [
    "document.notarized", "document.uploaded", 
    "member.joined", "member.removed", "member.invited",
    "role.assigned", "role.created",
    "approval.created", "approval.decided",
    "vault.uploaded", "sso.login"
]

# Module-level token and org cache
_token_cache = {}
_org_cache = {}


def get_cached_token(email, password):
    """Get cached token or login and cache it"""
    cache_key = email
    if cache_key not in _token_cache:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        if response.status_code != 200:
            raise Exception(f"Login failed for {email}: {response.text}")
        _token_cache[cache_key] = response.json().get("access_token")
    return _token_cache[cache_key]


def get_first_org(token):
    """Get first organization for the user"""
    if token in _org_cache:
        return _org_cache[token]
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/organizations/", headers=headers)
    if response.status_code != 200:
        raise Exception(f"Failed to get organizations: {response.text}")
    orgs = response.json().get("organizations", [])
    if not orgs:
        raise Exception("No organizations found for user")
    _org_cache[token] = orgs[0]
    return orgs[0]


class TestOrgWebhookEvents:
    """Test supported webhook event types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_cached_token(ADMIN_USER["email"], ADMIN_USER["password"])
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org = get_first_org(self.token)
        yield
    
    def test_list_webhook_events_returns_11_types(self):
        """GET /api/organizations/{org_id}/webhooks/events - Returns 11 supported event types"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/events",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "events" in data
        
        events = data["events"]
        assert len(events) == 11, f"Expected 11 events, got {len(events)}"
        
        # Check structure of each event
        for event in events:
            assert "key" in event, "Missing 'key' field"
            assert "label" in event, "Missing 'label' field"
            assert "category" in event, "Missing 'category' field"
        
        # Check all expected events are present
        event_keys = [e["key"] for e in events]
        for expected in SUPPORTED_EVENTS:
            assert expected in event_keys, f"Missing expected event: {expected}"
        
        print(f"All 11 event types present: {event_keys}")


class TestOrgWebhookCRUD:
    """Test webhook create, read, update, delete"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_cached_token(ADMIN_USER["email"], ADMIN_USER["password"])
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org = get_first_org(self.token)
        self.created_webhook_ids = []
        yield
        # Cleanup webhooks
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{wh_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_create_webhook_success(self):
        """POST /api/organizations/{org_id}/webhooks - Create with URL, events, description"""
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized", "member.joined"],
            "description": "TEST_org_webhook_basic"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "id" in data, "Missing id"
        assert "url" in data, "Missing url"
        assert "events" in data, "Missing events"
        assert "secret" in data, "Missing secret"
        assert "is_active" in data, "Missing is_active"
        assert "created_at" in data, "Missing created_at"
        
        # Verify values
        assert data["url"] == TEST_WEBHOOK_URL
        assert set(data["events"]) == {"document.notarized", "member.joined"}
        assert data["description"] == "TEST_org_webhook_basic"
        assert data["is_active"] is True
        assert len(data["secret"]) > 30, "Secret too short"
        
        self.created_webhook_ids.append(data["id"])
        print(f"Created webhook: {data['id']}, secret length: {len(data['secret'])}")
    
    def test_create_webhook_invalid_url_rejected(self):
        """POST /api/organizations/{org_id}/webhooks - Invalid URL returns 400"""
        payload = {
            "url": "not-a-valid-url",
            "events": ["document.notarized"],
            "description": "TEST_invalid_url"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "url" in response.json().get("detail", "").lower()
        print("Invalid URL correctly rejected")
    
    def test_create_webhook_empty_events_rejected(self):
        """POST /api/organizations/{org_id}/webhooks - Empty events returns 400"""
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": [],
            "description": "TEST_empty_events"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "event" in response.json().get("detail", "").lower()
        print("Empty events correctly rejected")
    
    def test_create_webhook_invalid_events_rejected(self):
        """POST /api/organizations/{org_id}/webhooks - Invalid event types return 400"""
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["invalid.event.type"],
            "description": "TEST_invalid_events"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "invalid" in response.json().get("detail", "").lower()
        print("Invalid events correctly rejected")
    
    def test_create_webhook_max_10_per_org(self):
        """POST /api/organizations/{org_id}/webhooks - Max 10 webhooks per org"""
        # First, list existing webhooks
        list_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            headers=self.headers
        )
        existing = list_response.json().get("webhooks", [])
        existing_count = len(existing)
        
        # Create webhooks up to 10
        webhooks_to_create = 10 - existing_count
        for i in range(webhooks_to_create):
            payload = {
                "url": f"{TEST_WEBHOOK_URL}?num={i}",
                "events": ["document.notarized"],
                "description": f"TEST_limit_{i}"
            }
            response = requests.post(
                f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
                json=payload,
                headers=self.headers
            )
            assert response.status_code == 200, f"Create {i} failed: {response.text}"
            self.created_webhook_ids.append(response.json()["id"])
        
        # Now try to create 11th
        payload = {
            "url": f"{TEST_WEBHOOK_URL}?num=11",
            "events": ["document.notarized"],
            "description": "TEST_limit_exceed"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400 for 11th webhook, got {response.status_code}"
        assert "10" in response.json().get("detail", "")
        print("Max 10 webhooks per org correctly enforced")
    
    def test_list_webhooks_secrets_masked(self):
        """GET /api/organizations/{org_id}/webhooks - Secrets masked (first 6 + last 4)"""
        # Create a webhook first
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_list_masked"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # List webhooks
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert "webhooks" in data
        
        # Find our webhook and check secret is masked
        found = False
        for wh in data["webhooks"]:
            if wh["id"] == webhook_id:
                found = True
                secret = wh.get("secret", "")
                assert "..." in secret, f"Secret not masked: {secret}"
                assert len(secret) < 20, f"Secret doesn't look masked: {secret}"
                print(f"Secret correctly masked: {secret}")
                break
        
        assert found, "Created webhook not found in list"
    
    def test_update_webhook_url_events_status(self):
        """PUT /api/organizations/{org_id}/webhooks/{id} - Update URL, events, active status"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_update_original"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Update the webhook
        update_payload = {
            "url": "https://example.com/webhook",
            "events": ["member.joined", "member.removed"],
            "is_active": False,
            "description": "TEST_update_modified"
        }
        response = requests.put(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}",
            json=update_payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        # Verify updates
        assert data["url"] == "https://example.com/webhook"
        assert set(data["events"]) == {"member.joined", "member.removed"}
        assert data["is_active"] is False
        assert data["description"] == "TEST_update_modified"
        print(f"Updated webhook: url={data['url']}, is_active={data['is_active']}")
    
    def test_delete_webhook_and_deliveries(self):
        """DELETE /api/organizations/{org_id}/webhooks/{id} - Deletes webhook and deliveries"""
        # Create a webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_delete"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        assert "deleted" in response.json().get("message", "").lower()
        
        # Verify it's gone
        list_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            headers=self.headers
        )
        webhooks = list_response.json().get("webhooks", [])
        webhook_ids = [w["id"] for w in webhooks]
        assert webhook_id not in webhook_ids, "Webhook still exists after delete"
        print(f"Webhook {webhook_id} deleted successfully")


class TestOrgWebhookActions:
    """Test webhook test, rotate secret, deliveries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_cached_token(ADMIN_USER["email"], ADMIN_USER["password"])
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org = get_first_org(self.token)
        self.created_webhook_ids = []
        yield
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{wh_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_test_webhook_sends_ping(self):
        """POST /api/organizations/{org_id}/webhooks/{id}/test - Sends test.ping event"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_test_ping"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Send test
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/test",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Test failed: {response.text}"
        data = response.json()
        assert "test.ping" in data.get("event", "")
        print(f"Test webhook response: {data}")
        
        # Wait for delivery
        time.sleep(3)
        
        # Check delivery log
        deliveries_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/deliveries",
            headers=self.headers
        )
        assert deliveries_response.status_code == 200
        deliveries_data = deliveries_response.json()
        
        deliveries = deliveries_data.get("deliveries", [])
        assert len(deliveries) > 0, "No deliveries logged"
        
        # Find test.ping delivery
        test_delivery = next((d for d in deliveries if d.get("event") == "test.ping"), None)
        assert test_delivery is not None, "test.ping delivery not found"
        assert test_delivery.get("status") == "delivered"
        assert test_delivery.get("response_status") == 200
        print(f"Test delivery logged: status={test_delivery['status']}, HTTP {test_delivery['response_status']}")
    
    def test_rotate_secret_returns_new_secret(self):
        """POST /api/organizations/{org_id}/webhooks/{id}/rotate-secret - Returns new secret"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_rotate_secret"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        original_secret = create_response.json()["secret"]
        self.created_webhook_ids.append(webhook_id)
        
        # Rotate secret
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/rotate-secret",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Rotate failed: {response.text}"
        data = response.json()
        assert "new_secret" in data, "Missing new_secret"
        
        new_secret = data["new_secret"]
        assert new_secret != original_secret, "Secret not rotated"
        assert len(new_secret) > 30, "New secret too short"
        print(f"Secret rotated: old={original_secret[:10]}..., new={new_secret[:10]}...")
    
    def test_delivery_log_with_status(self):
        """GET /api/organizations/{org_id}/webhooks/{id}/deliveries - Returns log with status"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_delivery_log"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        webhook_id = create_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Send test to create a delivery
        requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/test",
            headers=self.headers
        )
        time.sleep(3)
        
        # Get deliveries
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/deliveries",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get deliveries failed: {response.text}"
        data = response.json()
        
        assert "deliveries" in data
        assert "total" in data
        
        if data["total"] > 0:
            delivery = data["deliveries"][0]
            # Check delivery structure
            assert "id" in delivery, "Missing id"
            assert "event" in delivery, "Missing event"
            assert "status" in delivery, "Missing status (delivered/failed)"
            assert "attempts" in delivery, "Missing attempts count"
            assert "response_status" in delivery or "error" in delivery, "Missing response info"
            
            print(f"Delivery: event={delivery['event']}, status={delivery['status']}, attempts={delivery['attempts']}")


class TestOrgWebhookRBAC:
    """Test RBAC - only admins/owners can manage webhooks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_token = get_cached_token(ADMIN_USER["email"], ADMIN_USER["password"])
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.org = get_first_org(self.admin_token)
        yield
    
    def test_admin_can_manage_webhooks(self):
        """Admins/owners can create, list, delete webhooks"""
        # Create webhook
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_admin_access"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Admin create failed: {response.text}"
        webhook_id = response.json()["id"]
        
        # List webhooks
        list_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            headers=self.admin_headers
        )
        assert list_response.status_code == 200, "Admin list failed"
        
        # Delete webhook
        delete_response = requests.delete(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}",
            headers=self.admin_headers
        )
        assert delete_response.status_code == 200, "Admin delete failed"
        print("Admin can manage webhooks: create, list, delete all work")
    
    def test_non_admin_cannot_manage_webhooks(self):
        """Non-admin members get 403 on webhook management"""
        # Login as demo user
        demo_token = get_cached_token(DEMO_USER["email"], DEMO_USER["password"])
        demo_headers = {"Authorization": f"Bearer {demo_token}"}
        
        # Try to create webhook - should fail with 403
        payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["document.notarized"],
            "description": "TEST_non_admin"
        }
        response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=payload,
            headers=demo_headers
        )
        
        # Could be 403 (admin required) or 403 (not a member)
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"Non-admin correctly rejected: {response.json().get('detail')}")


class TestWebhookTriggers:
    """Test that RBAC actions fire webhooks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_cached_token(ADMIN_USER["email"], ADMIN_USER["password"])
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org = get_first_org(self.token)
        self.created_webhook_ids = []
        self.created_role_ids = []
        yield
        # Cleanup
        for wh_id in self.created_webhook_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{wh_id}",
                    headers=self.headers
                )
            except:
                pass
        for role_id in self.created_role_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/organizations/{self.org['id']}/roles/{role_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_role_created_fires_webhook(self):
        """Creating a role fires role.created webhook event"""
        # Create webhook listening for role.created
        webhook_payload = {
            "url": TEST_WEBHOOK_URL,
            "events": ["role.created"],
            "description": "TEST_role_created_trigger"
        }
        wh_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks",
            json=webhook_payload,
            headers=self.headers
        )
        assert wh_response.status_code == 200, f"Create webhook failed: {wh_response.text}"
        webhook_id = wh_response.json()["id"]
        self.created_webhook_ids.append(webhook_id)
        
        # Create a role
        role_payload = {
            "name": f"TEST_webhook_role_{int(time.time())}",
            "description": "Test role for webhook trigger",
            "permissions": ["documents:view"]
        }
        role_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org['id']}/roles",
            json=role_payload,
            headers=self.headers
        )
        assert role_response.status_code == 200, f"Create role failed: {role_response.text}"
        role_id = role_response.json()["id"]
        self.created_role_ids.append(role_id)
        
        # Wait for webhook delivery
        time.sleep(3)
        
        # Check delivery log
        deliveries_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org['id']}/webhooks/{webhook_id}/deliveries",
            headers=self.headers
        )
        assert deliveries_response.status_code == 200
        deliveries = deliveries_response.json().get("deliveries", [])
        
        # Find role.created delivery
        role_delivery = next((d for d in deliveries if d.get("event") == "role.created"), None)
        assert role_delivery is not None, "role.created delivery not found"
        assert role_delivery.get("status") == "delivered"
        print(f"role.created webhook fired: status={role_delivery['status']}, HTTP {role_delivery.get('response_status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
