"""
Operations Dashboard API Tests
Testing: GET /api/admin/ops/metrics
- Admin authentication required
- Returns all 4 sections: hedera, storage, payments, system
- Non-admin users get 403
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
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    elif response.status_code == 429:
        # Rate limited, wait and retry
        time.sleep(5)
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def regular_user_token():
    """Get regular (non-admin) user authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": REGULAR_USER_EMAIL, "password": REGULAR_USER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    elif response.status_code == 429:
        # Rate limited, wait and retry
        time.sleep(5)
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REGULAR_USER_EMAIL, "password": REGULAR_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
    pytest.skip(f"Regular user login failed: {response.status_code} - {response.text}")


class TestOpsEndpointAuth:
    """Test authentication and authorization for ops endpoint"""

    def test_ops_metrics_requires_auth(self):
        """GET /api/admin/ops/metrics without auth returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"✓ Ops endpoint correctly requires authentication (returns {response.status_code})")

    def test_ops_metrics_rejects_non_admin(self, regular_user_token):
        """GET /api/admin/ops/metrics with non-admin token returns 403"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ Ops endpoint correctly rejects non-admin users with 403")


class TestOpsMetricsResponse:
    """Test the ops metrics response structure and data"""

    def test_ops_metrics_returns_all_sections(self, admin_token):
        """GET /api/admin/ops/metrics returns all 4 required sections"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all 4 main sections exist
        assert "hedera" in data, "Missing 'hedera' section"
        assert "storage" in data, "Missing 'storage' section"
        assert "payments" in data, "Missing 'payments' section"
        assert "system" in data, "Missing 'system' section"
        print("✓ Response contains all 4 sections: hedera, storage, payments, system")

    def test_hedera_section_fields(self, admin_token):
        """Verify Hedera section contains expected fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        hedera = response.json()["hedera"]
        
        # Required Hedera fields
        assert "network" in hedera, "Missing 'network' in hedera"
        assert "account_id" in hedera, "Missing 'account_id' in hedera"
        assert "balance_hbar" in hedera, "Missing 'balance_hbar' in hedera"
        assert "total_seals" in hedera, "Missing 'total_seals' in hedera"
        assert "hcs_submitted" in hedera, "Missing 'hcs_submitted' in hedera"
        assert "seal_trend" in hedera, "Missing 'seal_trend' in hedera"
        
        # Verify network is mainnet as per requirements
        assert hedera["network"] == "mainnet", f"Expected mainnet network, got {hedera['network']}"
        
        # Verify account_id is present
        assert hedera["account_id"] is not None, "account_id should not be None"
        
        print(f"✓ Hedera section verified:")
        print(f"  - network: {hedera['network']}")
        print(f"  - account_id: {hedera['account_id']}")
        print(f"  - balance_hbar: {hedera['balance_hbar']}")
        print(f"  - total_seals: {hedera['total_seals']}")
        print(f"  - hcs_submitted: {hedera['hcs_submitted']}")
        print(f"  - seal_trend count: {len(hedera['seal_trend'])}")

    def test_storage_section_fields(self, admin_token):
        """Verify S3 storage section contains expected fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        storage = response.json()["storage"]
        
        # Required storage fields
        assert "backend" in storage, "Missing 'backend' in storage"
        assert "bucket" in storage, "Missing 'bucket' in storage"
        assert "total_files" in storage, "Missing 'total_files' in storage"
        assert "categories" in storage, "Missing 'categories' in storage"
        
        # Verify backend is S3
        assert storage["backend"] == "s3", f"Expected S3 backend, got {storage['backend']}"
        
        print(f"✓ Storage section verified:")
        print(f"  - backend: {storage['backend']}")
        print(f"  - bucket: {storage['bucket']}")
        print(f"  - total_files: {storage['total_files']}")
        print(f"  - categories: {list(storage['categories'].keys())}")

    def test_payments_section_fields(self, admin_token):
        """Verify Stripe payments section contains expected fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        payments = response.json()["payments"]
        
        # Required payment fields
        assert "total_revenue_usd" in payments, "Missing 'total_revenue_usd' in payments"
        assert "payments_30d" in payments, "Missing 'payments_30d' in payments"
        assert "active_subscriptions" in payments, "Missing 'active_subscriptions' in payments"
        
        # Verify values are numbers
        assert isinstance(payments["total_revenue_usd"], (int, float)), "total_revenue_usd should be numeric"
        assert isinstance(payments["payments_30d"], int), "payments_30d should be integer"
        assert isinstance(payments["active_subscriptions"], int), "active_subscriptions should be integer"
        
        print(f"✓ Payments section verified:")
        print(f"  - total_revenue_usd: ${payments['total_revenue_usd']}")
        print(f"  - payments_30d: {payments['payments_30d']}")
        print(f"  - active_subscriptions: {payments['active_subscriptions']}")

    def test_system_section_fields(self, admin_token):
        """Verify system health section contains status for all services"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        system = response.json()["system"]
        
        # Required system status fields
        assert "hedera" in system, "Missing 'hedera' status in system"
        assert "storage" in system, "Missing 'storage' status in system"
        assert "payments" in system, "Missing 'payments' status in system"
        assert "database" in system, "Missing 'database' status in system"
        
        print(f"✓ System health section verified:")
        print(f"  - hedera: {system['hedera']}")
        print(f"  - storage: {system['storage']}")
        print(f"  - payments: {system['payments']}")
        print(f"  - database: {system['database']}")

    def test_hbar_balance_not_trigger_low_alert(self, admin_token):
        """Verify HBAR balance is above 10 (per requirements, ~171 HBAR expected)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        hedera = response.json()["hedera"]
        balance = hedera.get("balance_hbar")
        
        if balance is not None:
            # According to requirements, balance should be ~171 HBAR, so alert should NOT show
            assert balance >= 10, f"HBAR balance {balance} is below 10, alert should be triggered"
            print(f"✓ HBAR balance ({balance:.2f}) is above 10, low balance alert should NOT show")
        else:
            print("! HBAR balance is None (could not fetch from Hedera)")


class TestOpsTimestamp:
    """Verify response includes timestamp"""

    def test_ops_metrics_has_timestamp(self, admin_token):
        """Verify response includes ISO timestamp"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/ops/metrics", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "timestamp" in data, "Missing 'timestamp' in response"
        # Verify it's an ISO format string
        timestamp = data["timestamp"]
        assert isinstance(timestamp, str), "timestamp should be string"
        assert "T" in timestamp, "timestamp should be ISO format with 'T' separator"
        print(f"✓ Response timestamp: {timestamp}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
