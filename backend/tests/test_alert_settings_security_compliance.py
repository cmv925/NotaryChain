"""
Test Alert Settings and Security Compliance Dashboard APIs
Two new P1 features:
1. Configurable HBAR Alert Settings Panel - admin can customize alert thresholds
2. Security Compliance Dashboard - admin panel showing security posture
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
REGULAR_USER_EMAIL = "demo@test.com"
REGULAR_USER_PASSWORD = "Demo123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token once for all tests in module"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def admin_session(admin_token):
    """Create admin session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture(scope="module")
def regular_user_token():
    """Get regular user token for access control tests"""
    time.sleep(1)  # Avoid rate limit
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REGULAR_USER_EMAIL,
        "password": REGULAR_USER_PASSWORD
    })
    if response.status_code != 200:
        return None
    return response.json().get("access_token")


class TestAlertSettingsAPI:
    """Tests for HBAR Alert Settings API - /api/admin/ops/alert-settings"""

    def test_get_alert_settings_returns_default_structure(self, admin_session):
        """GET /api/admin/ops/alert-settings - returns settings with required fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/ops/alert-settings")
        assert response.status_code == 200, f"Failed to get alert settings: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "check_interval_minutes" in data, "Missing check_interval_minutes"
        assert "cooldown_hours" in data, "Missing cooldown_hours"
        assert "email_alerts_enabled" in data, "Missing email_alerts_enabled"
        assert "in_app_alerts_enabled" in data, "Missing in_app_alerts_enabled"
        assert "thresholds" in data, "Missing thresholds"
        
        # Verify types
        assert isinstance(data["check_interval_minutes"], int), "check_interval_minutes should be int"
        assert isinstance(data["cooldown_hours"], int), "cooldown_hours should be int"
        assert isinstance(data["email_alerts_enabled"], bool), "email_alerts_enabled should be bool"
        assert isinstance(data["in_app_alerts_enabled"], bool), "in_app_alerts_enabled should be bool"
        assert isinstance(data["thresholds"], list), "thresholds should be list"
        print(f"✓ GET alert settings successful: interval={data['check_interval_minutes']}m, cooldown={data['cooldown_hours']}h")

    def test_update_check_interval_minutes(self, admin_session):
        """PUT /api/admin/ops/alert-settings - update check_interval_minutes to 20"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "check_interval_minutes": 20
        })
        assert response.status_code == 200, f"Failed to update check_interval: {response.text}"
        
        data = response.json()
        assert data.get("check_interval_minutes") == 20, f"Expected 20, got {data.get('check_interval_minutes')}"
        print("✓ Updated check_interval_minutes to 20")

        # Verify persistence with GET
        verify = admin_session.get(f"{BASE_URL}/api/admin/ops/alert-settings")
        assert verify.status_code == 200
        assert verify.json().get("check_interval_minutes") == 20, "Change not persisted"
        print("✓ Verified change persisted")

    def test_update_cooldown_hours(self, admin_session):
        """PUT /api/admin/ops/alert-settings - update cooldown_hours to 6"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "cooldown_hours": 6
        })
        assert response.status_code == 200, f"Failed to update cooldown: {response.text}"
        
        data = response.json()
        assert data.get("cooldown_hours") == 6, f"Expected 6, got {data.get('cooldown_hours')}"
        print("✓ Updated cooldown_hours to 6")

        # Verify persistence
        verify = admin_session.get(f"{BASE_URL}/api/admin/ops/alert-settings")
        assert verify.json().get("cooldown_hours") == 6, "Change not persisted"
        print("✓ Verified change persisted")

    def test_toggle_email_alerts_disabled(self, admin_session):
        """PUT /api/admin/ops/alert-settings - toggle email_alerts_enabled to false"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "email_alerts_enabled": False
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert response.json().get("email_alerts_enabled") == False
        print("✓ Disabled email alerts")

        # Re-enable for cleanup
        admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "email_alerts_enabled": True
        })

    def test_toggle_inapp_alerts_disabled(self, admin_session):
        """PUT /api/admin/ops/alert-settings - toggle in_app_alerts_enabled to false"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "in_app_alerts_enabled": False
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert response.json().get("in_app_alerts_enabled") == False
        print("✓ Disabled in-app alerts")

        # Re-enable
        admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "in_app_alerts_enabled": True
        })

    def test_update_threshold_values(self, admin_session):
        """PUT /api/admin/ops/alert-settings - update threshold values"""
        new_thresholds = [
            {"hbar": 100, "level": "warning", "label": "getting low", "enabled": True},
            {"hbar": 25, "level": "critical", "label": "critically low", "enabled": True},
            {"hbar": 5, "level": "emergency", "label": "nearly empty", "enabled": True},
        ]
        
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "thresholds": new_thresholds
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "thresholds" in data
        assert len(data["thresholds"]) == 3
        assert data["thresholds"][0]["hbar"] == 100
        assert data["thresholds"][1]["hbar"] == 25
        assert data["thresholds"][2]["hbar"] == 5
        print("✓ Updated threshold values: 100, 25, 5 HBAR")

        # Restore defaults
        admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "thresholds": [
                {"hbar": 50, "level": "warning", "label": "getting low", "enabled": True},
                {"hbar": 10, "level": "critical", "label": "critically low — service interruption risk", "enabled": True},
                {"hbar": 1, "level": "emergency", "label": "nearly empty — immediate action required", "enabled": True},
            ]
        })

    def test_validation_check_interval_too_low(self, admin_session):
        """PUT /api/admin/ops/alert-settings - validation: reject check_interval_minutes < 5"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "check_interval_minutes": 2
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "5 and 1440" in response.text or "interval" in response.text.lower()
        print("✓ Correctly rejected check_interval_minutes=2 (below 5)")

    def test_validation_check_interval_too_high(self, admin_session):
        """PUT /api/admin/ops/alert-settings - validation: reject check_interval_minutes > 1440"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "check_interval_minutes": 2000
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Correctly rejected check_interval_minutes=2000 (above 1440)")

    def test_validation_cooldown_too_low(self, admin_session):
        """PUT /api/admin/ops/alert-settings - validation: reject cooldown_hours < 1"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "cooldown_hours": 0
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Correctly rejected cooldown_hours=0 (below 1)")

    def test_validation_cooldown_too_high(self, admin_session):
        """PUT /api/admin/ops/alert-settings - validation: reject cooldown_hours > 168"""
        response = admin_session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "cooldown_hours": 200
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Correctly rejected cooldown_hours=200 (above 168)")


class TestAlertSettingsAccessControl:
    """Tests for alert settings access control - requires admin role"""

    def test_non_admin_cannot_get_alert_settings(self, regular_user_token):
        """GET /api/admin/ops/alert-settings - requires admin role (403 for non-admin)"""
        if not regular_user_token:
            pytest.skip("Regular user login failed")
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {regular_user_token}"
        })
        
        response = session.get(f"{BASE_URL}/api/admin/ops/alert-settings")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Non-admin correctly rejected from GET alert-settings")

    def test_non_admin_cannot_update_alert_settings(self, regular_user_token):
        """PUT /api/admin/ops/alert-settings - requires admin role (403 for non-admin)"""
        if not regular_user_token:
            pytest.skip("Regular user login failed")
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {regular_user_token}"
        })
        
        response = session.put(f"{BASE_URL}/api/admin/ops/alert-settings", json={
            "check_interval_minutes": 60
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Non-admin correctly rejected from PUT alert-settings")


class TestSecurityComplianceAPI:
    """Tests for Security Compliance Dashboard API - /api/admin/security/compliance"""

    def test_get_security_compliance_returns_score(self, admin_session):
        """GET /api/admin/security/compliance - returns score_pct, active_features, total_features"""
        response = admin_session.get(f"{BASE_URL}/api/admin/security/compliance")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "score_pct" in data, "Missing score_pct"
        assert "active_features" in data, "Missing active_features"
        assert "total_features" in data, "Missing total_features"
        assert "categories" in data, "Missing categories"
        
        assert isinstance(data["score_pct"], int), "score_pct should be int"
        assert data["score_pct"] >= 0 and data["score_pct"] <= 100, "score_pct out of range"
        assert isinstance(data["active_features"], int), "active_features should be int"
        assert isinstance(data["total_features"], int), "total_features should be int"
        
        print(f"✓ Security compliance score: {data['score_pct']}% ({data['active_features']}/{data['total_features']} features active)")

    def test_all_six_categories_present(self, admin_session):
        """GET /api/admin/security/compliance - all 6 categories present"""
        response = admin_session.get(f"{BASE_URL}/api/admin/security/compliance")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get("categories", {})
        
        expected_categories = [
            "authentication",
            "sso",
            "data_protection",
            "network_security",
            "access_control",
            "monitoring"
        ]
        
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
            assert "label" in categories[cat], f"Category {cat} missing label"
            assert "items" in categories[cat], f"Category {cat} missing items"
            assert len(categories[cat]["items"]) > 0, f"Category {cat} has no items"
            print(f"✓ Category '{cat}' present with {len(categories[cat]['items'])} items")

    def test_category_items_structure(self, admin_session):
        """GET /api/admin/security/compliance - category items have correct structure"""
        response = admin_session.get(f"{BASE_URL}/api/admin/security/compliance")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get("categories", {})
        
        for cat_key, cat in categories.items():
            for item in cat["items"]:
                assert "name" in item, f"Item in {cat_key} missing name"
                assert "status" in item, f"Item in {cat_key} missing status"
                assert "detail" in item, f"Item in {cat_key} missing detail"
                # Status should be one of: active, not_configured, missing, local_only, none, defaults
                valid_statuses = ["active", "not_configured", "missing", "local_only", "none", "defaults"]
                assert item["status"] in valid_statuses, f"Invalid status '{item['status']}' in {cat_key}"
        
        print("✓ All category items have correct structure (name, status, detail)")

    def test_generated_at_timestamp(self, admin_session):
        """GET /api/admin/security/compliance - includes generated_at timestamp"""
        response = admin_session.get(f"{BASE_URL}/api/admin/security/compliance")
        assert response.status_code == 200
        
        data = response.json()
        assert "generated_at" in data, "Missing generated_at timestamp"
        assert "T" in data["generated_at"], "generated_at should be ISO format"
        print(f"✓ Generated at: {data['generated_at']}")


class TestSecurityComplianceAccessControl:
    """Tests for security compliance access control - requires admin role"""

    def test_non_admin_cannot_access_security_compliance(self, regular_user_token):
        """GET /api/admin/security/compliance - requires admin role (403 for non-admin)"""
        if not regular_user_token:
            pytest.skip("Regular user login failed")
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {regular_user_token}"
        })
        
        response = session.get(f"{BASE_URL}/api/admin/security/compliance")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Non-admin correctly rejected from security compliance endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
