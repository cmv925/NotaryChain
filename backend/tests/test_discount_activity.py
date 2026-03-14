"""
Test suite for:
1. Subscription Discount Endpoints (per-doc discounts)
2. Organization Activity Audit Log Dashboard

Features tested:
- GET /api/subscriptions/plans (discount_pct field)
- GET /api/subscriptions/discount (user's discount rate)
- POST /api/subscriptions/calculate-discount (discounted price calculation)
- GET /api/organizations/{org_id}/activity (activity logs with filtering)
- GET /api/organizations/{org_id}/activity/stats (activity statistics)
- GET /api/organizations/{org_id}/activity/export (export logs as JSON)
- RBAC actions logging (role.created, role.updated, role.deleted, role.assigned)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chain-cloud-storage.preview.emergentagent.com")

# Module-scoped session to avoid rate limiting with multiple logins
_session_cache = {}

def get_auth_session():
    """Get authenticated session, using cache to avoid rate limiting"""
    if "admin_token" not in _session_cache:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@notarychain.com", "password": "Admin123!"}
        )
        if login_response.status_code == 429:
            # Rate limited, wait and retry
            time.sleep(30)
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "admin@notarychain.com", "password": "Admin123!"}
            )
        assert login_response.status_code == 200, f"Login failed: {login_response.status_code}"
        _session_cache["admin_token"] = login_response.json()["access_token"]
    return _session_cache["admin_token"]


def get_org_id(headers):
    """Get org where user is owner"""
    if "org_id" not in _session_cache:
        orgs_response = requests.get(f"{BASE_URL}/api/organizations/", headers=headers)
        assert orgs_response.status_code == 200
        orgs = [o for o in orgs_response.json()["organizations"] if o["my_role"] == "owner"]
        assert len(orgs) > 0, "No organizations found where user is owner"
        _session_cache["org_id"] = orgs[0]["id"]
    return _session_cache["org_id"]


class TestSubscriptionDiscounts:
    """Tests for subscription discount endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        self.token = get_auth_session()
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_plans_include_discount_pct(self):
        """GET /api/subscriptions/plans includes discount_pct for each plan"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        plans = {p["id"]: p for p in data["plans"]}
        
        # Verify discount_pct values for each plan
        assert plans["free"]["discount_pct"] == 0
        assert plans["pro"]["discount_pct"] == 15
        assert plans["enterprise"]["discount_pct"] == 35
        
        # Verify features mention discounts
        assert any("15% per-document discount" in f for f in plans["pro"]["features"])
        assert any("35% per-document discount" in f for f in plans["enterprise"]["features"])
        print("PASS: Plans include correct discount_pct values")
    
    def test_get_user_discount(self):
        """GET /api/subscriptions/discount returns user's discount info"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/discount",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "plan_id" in data
        assert "plan_name" in data
        assert "discount_pct" in data
        assert "total_saved_this_cycle" in data
        assert "docs_discounted_this_cycle" in data
        
        # Admin is on free plan, should have 0% discount
        assert data["plan_id"] == "free"
        assert data["discount_pct"] == 0
        print(f"PASS: User discount info returned correctly - plan: {data['plan_name']}, discount: {data['discount_pct']}%")
    
    def test_calculate_discount_valid_package(self):
        """POST /api/subscriptions/calculate-discount calculates discounted price"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/calculate-discount",
            json={"package_id": "general"},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["package_id"] == "general"
        assert data["package_name"] == "General Document Notarization"
        assert data["original_price"] == 25.0
        assert "discount_pct" in data
        assert "discount_amount" in data
        assert "final_price" in data
        assert data["currency"] == "USD"
        
        # For free plan, final_price should equal original_price
        if data["discount_pct"] == 0:
            assert data["final_price"] == data["original_price"]
        print(f"PASS: Discount calculation - original: ${data['original_price']}, discount: {data['discount_pct']}%, final: ${data['final_price']}")
    
    def test_calculate_discount_all_packages(self):
        """Verify discount calculation works for all packages"""
        packages = ["general", "power_of_attorney", "real_estate", "affidavit", "will", "trust", "contract"]
        
        for pkg in packages:
            response = requests.post(
                f"{BASE_URL}/api/subscriptions/calculate-discount",
                json={"package_id": pkg},
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["package_id"] == pkg
            assert data["original_price"] > 0
        print(f"PASS: Discount calculation works for all {len(packages)} packages")
    
    def test_calculate_discount_invalid_package(self):
        """POST /api/subscriptions/calculate-discount rejects invalid package"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/calculate-discount",
            json={"package_id": "invalid_package"},
            headers=self.headers
        )
        assert response.status_code == 400
        print("PASS: Invalid package correctly rejected with 400")
    
    def test_calculate_discount_missing_package_id(self):
        """POST /api/subscriptions/calculate-discount requires package_id"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/calculate-discount",
            json={},
            headers=self.headers
        )
        assert response.status_code == 400
        print("PASS: Missing package_id correctly rejected with 400")


class TestOrgActivityLog:
    """Tests for organization activity audit log endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication and get org"""
        self.token = get_auth_session()
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org_id = get_org_id(self.headers)
    
    def test_get_activity_logs(self):
        """GET /api/organizations/{org_id}/activity returns activity logs"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "logs" in data
        assert isinstance(data["logs"], list)
        
        print(f"PASS: Activity logs returned - {data['total']} total events")
    
    def test_activity_log_structure(self):
        """Verify activity log entry structure"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity",
            headers=self.headers
        )
        assert response.status_code == 200
        logs = response.json()["logs"]
        
        if len(logs) > 0:
            log = logs[0]
            required_fields = ["id", "org_id", "action", "actor_id", "actor_email", "description", "timestamp"]
            for field in required_fields:
                assert field in log, f"Missing required field: {field}"
            print(f"PASS: Activity log entry has all required fields")
        else:
            print("SKIP: No activity logs to verify structure")
    
    def test_activity_filter_by_action(self):
        """GET /api/organizations/{org_id}/activity with action filter"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity?action=role.created",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should have the filtered action
        for log in data["logs"]:
            assert log["action"] == "role.created"
        print(f"PASS: Action filter works - returned {len(data['logs'])} role.created events")
    
    def test_activity_filter_by_days(self):
        """GET /api/organizations/{org_id}/activity with days filter"""
        for days in [7, 30, 90]:
            response = requests.get(
                f"{BASE_URL}/api/organizations/{self.org_id}/activity?days={days}",
                headers=self.headers
            )
            assert response.status_code == 200
        print("PASS: Days filter accepts 7, 30, 90 days")
    
    def test_activity_pagination(self):
        """GET /api/organizations/{org_id}/activity with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity?page=1&page_size=2",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["logs"]) <= 2
        print(f"PASS: Pagination works - page 1, page_size 2, returned {len(data['logs'])} logs")
    
    def test_activity_stats(self):
        """GET /api/organizations/{org_id}/activity/stats returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "total_events" in data
        assert "by_action" in data
        assert "by_actor" in data
        assert "daily_trend" in data
        assert "action_types" in data
        
        assert isinstance(data["by_action"], dict)
        assert isinstance(data["by_actor"], dict)
        assert isinstance(data["daily_trend"], list)
        
        print(f"PASS: Activity stats returned - {data['total_events']} total events, {len(data['action_types'])} action types")
    
    def test_activity_export(self):
        """GET /api/organizations/{org_id}/activity/export returns exportable data"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity/export?days=30",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify export structure
        assert "org_id" in data
        assert "period_days" in data
        assert "record_count" in data
        assert "logs" in data
        
        assert data["org_id"] == self.org_id
        assert data["period_days"] == 30
        assert len(data["logs"]) == data["record_count"]
        
        print(f"PASS: Activity export returned {data['record_count']} records")


class TestRBACActivityLogging:
    """Tests that RBAC actions generate activity log entries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication and get org"""
        self.token = get_auth_session()
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.org_id = get_org_id(self.headers)
    
    def test_role_create_logs_activity(self):
        """Creating a role generates role.created activity"""
        # Create role
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org_id}/roles",
            json={
                "name": "TEST_ACTIVITY_ROLE",
                "description": "Test role for activity logging",
                "permissions": ["documents:view"]
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Check activity log
        activity_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity?action=role.created&page_size=5",
            headers=self.headers
        )
        assert activity_response.status_code == 200
        logs = activity_response.json()["logs"]
        
        # Find our role creation in the logs
        found = any(log["target_name"] == "TEST_ACTIVITY_ROLE" for log in logs)
        assert found, "Role creation not found in activity logs"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}", headers=self.headers)
        
        print("PASS: Role creation logged in activity")
    
    def test_role_update_logs_activity(self):
        """Updating a role generates role.updated activity"""
        # Create role
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org_id}/roles",
            json={
                "name": "TEST_UPDATE_ROLE",
                "description": "Initial description",
                "permissions": ["documents:view"]
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Update role
        requests.put(
            f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}",
            json={"description": "Updated description"},
            headers=self.headers
        )
        
        # Check activity log
        activity_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity?action=role.updated&page_size=5",
            headers=self.headers
        )
        assert activity_response.status_code == 200
        logs = activity_response.json()["logs"]
        
        # Find our role update in the logs
        found = any(log["target_name"] == "TEST_UPDATE_ROLE" for log in logs)
        assert found, "Role update not found in activity logs"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}", headers=self.headers)
        
        print("PASS: Role update logged in activity")
    
    def test_role_delete_logs_activity(self):
        """Deleting a role generates role.deleted activity"""
        # Create role
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/{self.org_id}/roles",
            json={
                "name": "TEST_DELETE_ROLE",
                "description": "To be deleted",
                "permissions": ["documents:view"]
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Delete role
        requests.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}", headers=self.headers)
        
        # Check activity log
        activity_response = requests.get(
            f"{BASE_URL}/api/organizations/{self.org_id}/activity?action=role.deleted&page_size=5",
            headers=self.headers
        )
        assert activity_response.status_code == 200
        logs = activity_response.json()["logs"]
        
        # Find our role deletion in the logs
        found = any(log["target_name"] == "TEST_DELETE_ROLE" for log in logs)
        assert found, "Role deletion not found in activity logs"
        
        print("PASS: Role deletion logged in activity")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
