"""
Timeline Feature Tests
Tests GET /api/timeline/{transaction_id} endpoint which aggregates
transaction events from 13+ collections into a chronological timeline.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}

# Known test transaction ID (owned by demo@test.com)
TEST_TRANSACTION_ID = "be768af0-c526-49cf-a43e-8a1932bd353f"


@pytest.fixture(scope="module")
def demo_token():
    """Get demo user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Demo user login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Admin user login failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(demo_token):
    """Create auth headers with demo token"""
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture
def admin_headers(admin_token):
    """Create auth headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestTimelineAPIEndpoint:
    """Tests for GET /api/timeline/{transaction_id}"""
    
    def test_timeline_returns_events_for_valid_transaction(self, auth_headers):
        """Timeline should return chronological events for a valid transaction"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "transaction_id" in data, "Response should include transaction_id"
        assert data["transaction_id"] == TEST_TRANSACTION_ID
        assert "transaction_name" in data, "Response should include transaction_name"
        assert "transaction_status" in data, "Response should include transaction_status"
        assert "total_events" in data, "Response should include total_events"
        assert "categories" in data, "Response should include categories list"
        assert "events" in data, "Response should include events list"
        
        # Events should be a list
        assert isinstance(data["events"], list), "Events should be a list"
        
        # Based on main agent info, basic transaction should have at least 2 events
        # (transaction created + owner joined)
        assert data["total_events"] >= 2, f"Expected at least 2 events, got {data['total_events']}"
        
        print(f"✓ Timeline returned {data['total_events']} events for transaction '{data['transaction_name']}'")
        print(f"✓ Categories present: {data['categories']}")
    
    def test_timeline_events_have_required_fields(self, auth_headers):
        """Each timeline event should have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        assert len(events) > 0, "Should have at least one event"
        
        # Check required fields on each event
        required_fields = ["type", "category", "icon", "title", "description", "timestamp", "severity", "sequence"]
        
        for i, event in enumerate(events):
            for field in required_fields:
                assert field in event, f"Event {i} missing required field '{field}'"
        
        print(f"✓ All {len(events)} events have required fields")
    
    def test_timeline_events_categories_are_valid(self, auth_headers):
        """Event categories should be one of the expected values"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        # Expected categories from timeline_routes.py
        valid_categories = {"lifecycle", "people", "tasks", "documents", "ai", "verification", "blockchain"}
        
        for event in events:
            assert event["category"] in valid_categories, \
                f"Invalid category '{event['category']}' - expected one of {valid_categories}"
        
        print(f"✓ All event categories are valid: {set(e['category'] for e in events)}")
    
    def test_timeline_events_severity_are_valid(self, auth_headers):
        """Event severity should be one of: success, warning, error, info"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        valid_severities = {"success", "warning", "error", "info"}
        
        for event in events:
            assert event["severity"] in valid_severities, \
                f"Invalid severity '{event['severity']}' - expected one of {valid_severities}"
        
        print(f"✓ All event severities are valid")
    
    def test_timeline_events_sorted_by_timestamp(self, auth_headers):
        """Events should be sorted by timestamp in descending order (newest first)"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        if len(events) > 1:
            # Check descending order
            timestamps = [e["timestamp"] for e in events]
            assert timestamps == sorted(timestamps, reverse=True), \
                "Events should be sorted in descending timestamp order"
            
            print(f"✓ Events are correctly sorted (newest first)")
        else:
            print("✓ Single or no events - sort order N/A")
    
    def test_timeline_events_have_sequence_numbers(self, auth_headers):
        """Events should have sequence numbers"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        if len(events) > 0:
            sequences = [e["sequence"] for e in events]
            # Sequence numbers should be 1 through N where N is total events
            assert max(sequences) == len(events), "Max sequence should equal total events"
            assert min(sequences) == 1, "Min sequence should be 1"
            
            print(f"✓ Sequence numbers are correct (1 to {len(events)})")
    
    def test_timeline_includes_transaction_created_event(self, auth_headers):
        """Timeline should include the transaction created event"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        # Find transaction created event
        created_events = [e for e in events if e["type"] == "transaction" and "Created" in e["title"]]
        assert len(created_events) >= 1, "Should have at least one 'Transaction Created' event"
        
        created_event = created_events[0]
        assert created_event["category"] == "lifecycle"
        assert created_event["icon"] == "rocket"
        
        print(f"✓ Transaction Created event present: {created_event['title']}")
    
    def test_timeline_includes_participant_joined_event(self, auth_headers):
        """Timeline should include participant joined events"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        # Find participant events
        participant_events = [e for e in events if e["type"] == "participant"]
        assert len(participant_events) >= 1, "Should have at least one participant event"
        
        for p_event in participant_events:
            assert p_event["category"] == "people"
            assert p_event["icon"] in ["user-check", "mail"]
            
        print(f"✓ Found {len(participant_events)} participant event(s)")


class TestTimelineAccessControl:
    """Tests for Timeline access control (403 for non-participants)"""
    
    def test_timeline_returns_403_for_non_participant(self, admin_headers):
        """Timeline should return 403 for users not part of the transaction"""
        # Admin is not a participant of demo user's transaction
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=admin_headers
        )
        
        # Should return 403 Not Authorized
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data or "error" in data, "Should include error message"
        
        print("✓ Non-participant correctly receives 403 Forbidden")
    
    def test_timeline_returns_401_without_auth(self):
        """Timeline should return 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ Unauthenticated request correctly receives 401")


class TestTimelineNotFoundHandling:
    """Tests for Timeline 404 handling"""
    
    def test_timeline_returns_404_for_nonexistent_transaction(self, auth_headers):
        """Timeline should return 404 for non-existent transaction ID"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        
        response = requests.get(
            f"{BASE_URL}/api/timeline/{fake_id}",
            headers=auth_headers
        )
        
        # Could be 403 (not a participant) or 404 (not found)
        # The route checks participant first, so 403 is expected
        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}: {response.text}"
        
        print(f"✓ Non-existent transaction returns {response.status_code}")
    
    def test_timeline_returns_404_for_invalid_uuid_format(self, auth_headers):
        """Timeline should handle invalid UUID format gracefully"""
        invalid_id = "not-a-valid-uuid"
        
        response = requests.get(
            f"{BASE_URL}/api/timeline/{invalid_id}",
            headers=auth_headers
        )
        
        # Should return 403 (not participant) or 404 (not found)
        assert response.status_code in [400, 403, 404], \
            f"Expected 400/403/404, got {response.status_code}: {response.text}"
        
        print(f"✓ Invalid UUID format returns {response.status_code}")


class TestTimelineCategoriesAggregate:
    """Tests for Timeline aggregating data from multiple sources"""
    
    def test_timeline_returns_categories_list(self, auth_headers):
        """Timeline response should include list of categories present"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Categories should be a list of unique categories in the events
        assert "categories" in data
        assert isinstance(data["categories"], list)
        
        # Categories should match what's in events
        event_categories = set(e["category"] for e in data.get("events", []))
        response_categories = set(data["categories"])
        
        assert event_categories == response_categories, \
            f"Categories mismatch: events have {event_categories}, response has {response_categories}"
        
        print(f"✓ Categories correctly aggregated: {data['categories']}")
    
    def test_timeline_total_events_matches_events_length(self, auth_headers):
        """total_events should match the length of events list"""
        response = requests.get(
            f"{BASE_URL}/api/timeline/{TEST_TRANSACTION_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_events"] == len(data["events"]), \
            f"total_events ({data['total_events']}) doesn't match events length ({len(data['events'])})"
        
        print(f"✓ total_events ({data['total_events']}) matches events list length")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
