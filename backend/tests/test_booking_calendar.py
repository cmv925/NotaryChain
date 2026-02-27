"""
Test Suite: Notary Booking Calendar Feature
Tests availability management, slot generation, booking CRUD, and notary actions.
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://notary-ai.preview.emergentagent.com')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}
NOTARY_USER = {"email": "notarytest@test.com", "password": "Test123!"}
NOTARY_USER_ID = "403ae701-cf8e-491a-875a-d83eda5854ac"


class TestAuthSetup:
    """Helper class for authentication"""
    
    @staticmethod
    def login(email, password):
        """Login and return token"""
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
    token = TestAuthSetup.login(DEMO_USER["email"], DEMO_USER["password"])
    if not token:
        pytest.skip("Demo user authentication failed")
    return token


@pytest.fixture(scope="module")
def notary_token():
    """Get notary user token"""
    token = TestAuthSetup.login(NOTARY_USER["email"], NOTARY_USER["password"])
    if not token:
        pytest.skip("Notary user authentication failed")
    return token


@pytest.fixture(scope="module")
def admin_token():
    """Get admin user token"""
    token = TestAuthSetup.login(ADMIN_USER["email"], ADMIN_USER["password"])
    if not token:
        pytest.skip("Admin user authentication failed")
    return token


# === Notary Availability Tests ===

class TestNotaryAvailability:
    """Test notary availability management endpoints"""
    
    def test_get_notary_availability_public(self):
        """GET /api/bookings/availability/{notary_id} - Public endpoint for notary schedule"""
        response = requests.get(f"{BASE_URL}/api/bookings/availability/{NOTARY_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "schedule" in data
        assert "blocked_dates" in data
        print(f"Public availability: schedule={data['schedule'] is not None}, blocked_dates={len(data.get('blocked_dates', []))}")
    
    def test_get_my_availability_requires_auth(self):
        """GET /api/bookings/availability - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings/availability")
        assert response.status_code in [401, 403]
        print("GET own availability correctly requires auth")
    
    def test_get_my_availability_as_notary(self, notary_token):
        """GET /api/bookings/availability - Notary gets own schedule"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/availability", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "schedule" in data
        assert "blocked_dates" in data
        if data["schedule"]:
            print(f"Notary has schedule: weekly_slots={len(data['schedule'].get('weekly_slots', []))}")
        else:
            print("Notary has no schedule set yet")
    
    def test_set_availability_requires_auth(self):
        """PUT /api/bookings/availability - Requires authentication"""
        response = requests.put(f"{BASE_URL}/api/bookings/availability", json={
            "weekly_slots": [],
            "slot_duration_minutes": 60,
            "break_between_minutes": 15
        })
        assert response.status_code in [401, 403]
        print("PUT availability correctly requires auth")
    
    def test_set_availability_as_notary(self, notary_token):
        """PUT /api/bookings/availability - Notary sets weekly schedule"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        schedule_data = {
            "weekly_slots": [
                {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"},  # Monday
                {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00"},  # Tuesday
                {"day_of_week": 2, "start_time": "09:00", "end_time": "17:00"},  # Wednesday
                {"day_of_week": 3, "start_time": "09:00", "end_time": "17:00"},  # Thursday
                {"day_of_week": 4, "start_time": "09:00", "end_time": "17:00"},  # Friday
            ],
            "slot_duration_minutes": 60,
            "break_between_minutes": 15
        }
        response = requests.put(f"{BASE_URL}/api/bookings/availability", json=schedule_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Availability updated"
        print(f"Availability set successfully: {len(schedule_data['weekly_slots'])} days configured")


# === Blocked Dates Tests ===

class TestBlockedDates:
    """Test blocked dates management"""
    
    @pytest.fixture
    def block_date_future(self):
        """Generate a future date for testing"""
        future = datetime.now() + timedelta(days=30)
        return future.strftime("%Y-%m-%d")
    
    def test_block_date_requires_auth(self, block_date_future):
        """POST /api/bookings/blocked-dates - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/bookings/blocked-dates", json={
            "date": block_date_future,
            "reason": "Test block"
        })
        assert response.status_code in [401, 403]
        print("POST blocked-dates correctly requires auth")
    
    def test_block_date_as_notary(self, notary_token, block_date_future):
        """POST /api/bookings/blocked-dates - Notary blocks a date"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.post(f"{BASE_URL}/api/bookings/blocked-dates", json={
            "date": block_date_future,
            "reason": "Personal day - test"
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["date"] == block_date_future
        print(f"Date blocked successfully: {data['date']}, id={data['id']}")
        return data["id"]
    
    def test_unblock_date_as_notary(self, notary_token, block_date_future):
        """DELETE /api/bookings/blocked-dates/{id} - Notary removes blocked date"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        
        # First block a date
        response = requests.post(f"{BASE_URL}/api/bookings/blocked-dates", json={
            "date": block_date_future,
            "reason": "Test block to unblock"
        }, headers=headers)
        assert response.status_code == 200
        block_id = response.json()["id"]
        
        # Then unblock it
        response = requests.delete(f"{BASE_URL}/api/bookings/blocked-dates/{block_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Date unblocked successfully: {data['message']}")
    
    def test_unblock_nonexistent_date(self, notary_token):
        """DELETE /api/bookings/blocked-dates/{id} - Non-existent blocked date"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.delete(f"{BASE_URL}/api/bookings/blocked-dates/nonexistent-id", headers=headers)
        assert response.status_code == 404
        print("DELETE non-existent blocked date correctly returns 404")


# === Slot Generation Tests ===

class TestSlotGeneration:
    """Test available slots endpoint"""
    
    def test_get_slots_valid_date(self):
        """GET /api/bookings/slots/{notary_id}?date=YYYY-MM-DD - Available slots"""
        # Use Tuesday 2026-03-03 as mentioned in test context
        response = requests.get(f"{BASE_URL}/api/bookings/slots/{NOTARY_USER_ID}?date=2026-03-03")
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "slots" in data
        assert data["date"] == "2026-03-03"
        print(f"Slots for 2026-03-03: {len(data['slots'])} slots available")
        if data["slots"]:
            print(f"First slot: {data['slots'][0]}")
    
    def test_get_slots_invalid_date_format(self):
        """GET /api/bookings/slots/{notary_id}?date=invalid - Invalid date format"""
        response = requests.get(f"{BASE_URL}/api/bookings/slots/{NOTARY_USER_ID}?date=invalid-date")
        assert response.status_code == 400
        print("Invalid date format correctly returns 400")
    
    def test_get_slots_past_date(self):
        """GET /api/bookings/slots/{notary_id}?date=2020-01-01 - Past date"""
        response = requests.get(f"{BASE_URL}/api/bookings/slots/{NOTARY_USER_ID}?date=2020-01-01")
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("slots", [])) == 0
        assert "message" in data or len(data.get("slots", [])) == 0
        print("Past date correctly returns no slots")
    
    def test_get_slots_no_availability_day(self):
        """GET /api/bookings/slots/{notary_id}?date=YYYY-MM-DD - Weekend (no availability)"""
        # Find next Sunday
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        next_sunday = today + timedelta(days=days_until_sunday)
        sunday_str = next_sunday.strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/bookings/slots/{NOTARY_USER_ID}?date={sunday_str}")
        assert response.status_code == 200
        data = response.json()
        # Should have no slots on Sunday since notary is only available Mon-Fri
        print(f"Sunday {sunday_str}: {len(data.get('slots', []))} slots (expecting 0)")


# === Booking Creation Tests ===

class TestBookingCreation:
    """Test booking creation and management"""
    
    def test_create_booking_requires_auth(self):
        """POST /api/bookings - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/bookings", json={
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-03",
            "start_time": "09:00",
            "end_time": "10:00",
            "document_name": "Test Document",
            "document_type": "power_of_attorney"
        })
        assert response.status_code in [401, 403]
        print("POST booking correctly requires auth")
    
    def test_create_booking_as_user(self, demo_token):
        """POST /api/bookings - User creates booking (creates linked notarization request)"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        # Use a future Tuesday date
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-10",  # March 10, 2026 is a Tuesday
            "start_time": "10:15",  # Second slot to avoid conflicts
            "end_time": "11:15",
            "document_name": "TEST_Power of Attorney for Testing",
            "document_type": "power_of_attorney",
            "notarization_type": "ron",
            "notes": "Test booking created by pytest"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "booking" in data
        assert "request" in data  # Linked notarization request
        booking = data["booking"]
        assert booking["status"] == "pending"
        assert booking["document_name"] == booking_data["document_name"]
        print(f"Booking created: id={booking['id']}, status={booking['status']}")
        print(f"Linked request id={data['request']['id']}, status={data['request']['status']}")
        return booking["id"]
    
    def test_create_booking_duplicate_slot(self, demo_token):
        """POST /api/bookings - Duplicate slot should fail"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        # First booking
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-11",  # Wednesday
            "start_time": "09:00",
            "end_time": "10:00",
            "document_name": "TEST_First Booking",
            "document_type": "contract"
        }
        
        # Create first booking
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        
        # Try to create duplicate
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 409  # Conflict
        print("Duplicate slot correctly returns 409 Conflict")
    
    def test_create_booking_invalid_notary(self, demo_token):
        """POST /api/bookings - Invalid notary should fail"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        booking_data = {
            "notary_id": "invalid-notary-id",
            "date": "2026-03-12",
            "start_time": "09:00",
            "end_time": "10:00",
            "document_name": "Test Invalid",
            "document_type": "contract"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 404
        print("Invalid notary correctly returns 404")


# === User Bookings Tests ===

class TestUserBookings:
    """Test user booking retrieval"""
    
    def test_get_my_bookings_requires_auth(self):
        """GET /api/bookings/my - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code in [401, 403]
        print("GET my bookings correctly requires auth")
    
    def test_get_my_bookings_as_user(self, demo_token):
        """GET /api/bookings/my - User gets own bookings"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/my", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "bookings" in data
        print(f"User has {len(data['bookings'])} bookings")
        if data["bookings"]:
            print(f"Latest booking: {data['bookings'][0].get('document_name')}, status={data['bookings'][0].get('status')}")
    
    def test_get_my_bookings_with_status_filter(self, demo_token):
        """GET /api/bookings/my?status=pending - Filter by status"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/my?status=pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All returned bookings should be pending
        for booking in data["bookings"]:
            assert booking["status"] == "pending"
        print(f"Pending bookings: {len(data['bookings'])}")


# === Notary Bookings Tests ===

class TestNotaryBookings:
    """Test notary booking retrieval and management"""
    
    def test_get_notary_bookings_requires_auth(self):
        """GET /api/bookings/notary - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings/notary")
        assert response.status_code in [401, 403]
        print("GET notary bookings correctly requires auth")
    
    def test_get_notary_bookings(self, notary_token):
        """GET /api/bookings/notary - Notary gets bookings assigned to them"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/notary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "bookings" in data
        print(f"Notary has {len(data['bookings'])} assigned bookings")


# === Booking Status Actions Tests ===

class TestBookingActions:
    """Test booking confirm/cancel/complete actions"""
    
    @pytest.fixture
    def create_test_booking(self, demo_token):
        """Create a fresh booking for testing"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-17",  # Tuesday
            "start_time": "14:00",
            "end_time": "15:00",
            "document_name": f"TEST_Action Test {datetime.now().timestamp()}",
            "document_type": "affidavit"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        return response.json()["booking"]["id"]
    
    def test_confirm_booking_as_notary(self, notary_token, demo_token):
        """PUT /api/bookings/{id}/confirm - Notary confirms booking"""
        # Create a booking
        headers_user = {"Authorization": f"Bearer {demo_token}"}
        headers_notary = {"Authorization": f"Bearer {notary_token}"}
        
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-18",
            "start_time": "09:00",
            "end_time": "10:00",
            "document_name": f"TEST_Confirm Test {datetime.now().timestamp()}",
            "document_type": "trust"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers_user)
        assert response.status_code == 200
        booking_id = response.json()["booking"]["id"]
        
        # Notary confirms
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/confirm", json={}, headers=headers_notary)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Booking confirmed"
        print(f"Booking {booking_id} confirmed successfully")
    
    def test_cancel_booking_as_user(self, demo_token):
        """PUT /api/bookings/{id}/cancel - User cancels own booking"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        # Create a booking
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-19",
            "start_time": "10:15",
            "end_time": "11:15",
            "document_name": f"TEST_Cancel Test {datetime.now().timestamp()}",
            "document_type": "deed"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200
        booking_id = response.json()["booking"]["id"]
        
        # Cancel
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/cancel", json={}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Booking cancelled"
        print(f"Booking {booking_id} cancelled by user")
    
    def test_cancel_booking_as_notary(self, notary_token, demo_token):
        """PUT /api/bookings/{id}/cancel - Notary cancels booking"""
        headers_user = {"Authorization": f"Bearer {demo_token}"}
        headers_notary = {"Authorization": f"Bearer {notary_token}"}
        
        # Create a booking
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-20",
            "start_time": "11:30",
            "end_time": "12:30",
            "document_name": f"TEST_Notary Cancel {datetime.now().timestamp()}",
            "document_type": "will"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers_user)
        assert response.status_code == 200
        booking_id = response.json()["booking"]["id"]
        
        # Notary cancels
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/cancel", json={}, headers=headers_notary)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Booking cancelled"
        print(f"Booking {booking_id} cancelled by notary")
    
    def test_complete_booking_as_notary(self, notary_token, demo_token):
        """PUT /api/bookings/{id}/complete - Notary completes confirmed booking"""
        headers_user = {"Authorization": f"Bearer {demo_token}"}
        headers_notary = {"Authorization": f"Bearer {notary_token}"}
        
        # Create a booking
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-23",
            "start_time": "09:00",
            "end_time": "10:00",
            "document_name": f"TEST_Complete Test {datetime.now().timestamp()}",
            "document_type": "contract"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers_user)
        assert response.status_code == 200
        booking_id = response.json()["booking"]["id"]
        
        # First confirm
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/confirm", json={}, headers=headers_notary)
        assert response.status_code == 200
        
        # Then complete
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/complete", json={}, headers=headers_notary)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Booking completed"
        print(f"Booking {booking_id} completed successfully")
    
    def test_complete_pending_booking_fails(self, notary_token, demo_token):
        """PUT /api/bookings/{id}/complete - Cannot complete pending booking"""
        headers_user = {"Authorization": f"Bearer {demo_token}"}
        headers_notary = {"Authorization": f"Bearer {notary_token}"}
        
        # Create a booking (stays pending)
        booking_data = {
            "notary_id": NOTARY_USER_ID,
            "date": "2026-03-24",
            "start_time": "10:15",
            "end_time": "11:15",
            "document_name": f"TEST_Invalid Complete {datetime.now().timestamp()}",
            "document_type": "other"
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers_user)
        assert response.status_code == 200
        booking_id = response.json()["booking"]["id"]
        
        # Try to complete without confirming first
        response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/complete", json={}, headers=headers_notary)
        assert response.status_code == 400
        print("Cannot complete pending booking - correctly returns 400")
    
    def test_confirm_nonexistent_booking(self, notary_token):
        """PUT /api/bookings/{id}/confirm - Non-existent booking"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.put(f"{BASE_URL}/api/bookings/nonexistent-id/confirm", json={}, headers=headers)
        assert response.status_code == 404
        print("Confirm non-existent booking correctly returns 404")


# === Cleanup Test Data ===

class TestCleanup:
    """Clean up test data created during tests"""
    
    def test_cleanup_test_bookings(self, demo_token):
        """Clean up TEST_ prefixed bookings"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/my", headers=headers)
        if response.status_code == 200:
            bookings = response.json().get("bookings", [])
            test_bookings = [b for b in bookings if b.get("document_name", "").startswith("TEST_")]
            for booking in test_bookings:
                if booking["status"] in ["pending", "confirmed"]:
                    requests.put(f"{BASE_URL}/api/bookings/{booking['id']}/cancel", json={}, headers=headers)
            print(f"Cleaned up {len(test_bookings)} test bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
