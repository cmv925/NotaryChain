"""
Test P1 Production Infrastructure: Cache, Storage, Task Manager, Infrastructure APIs
Tests TTL cache service, S3/local storage, enhanced task manager, and infra routes
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="session")
def user_token(api_client):
    """Get regular user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("User authentication failed")


class TestHealthEndpoint:
    """Health check includes cache, storage, sentry status"""

    def test_health_includes_cache(self, api_client):
        """GET /api/health should include cache status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        
        assert "checks" in data
        assert "cache" in data["checks"]
        assert data["checks"]["cache"]["status"] == "healthy"
        assert data["checks"]["cache"]["backend"] == "in-memory"

    def test_health_includes_storage(self, api_client):
        """GET /api/health should include storage status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        
        assert "storage" in data["checks"]
        assert data["checks"]["storage"]["status"] == "healthy"
        # Storage backend is 'local' when S3 is not configured
        assert data["checks"]["storage"]["backend"] in ["local", "s3"]

    def test_health_includes_sentry(self, api_client):
        """GET /api/health should include sentry status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        
        assert "sentry" in data["checks"]
        # Sentry is not configured in test environment
        assert data["checks"]["sentry"]["status"] in ["configured", "not_configured"]


class TestInfraStatusEndpoint:
    """GET /api/infra/status - Infrastructure status overview"""

    def test_infra_status_requires_auth(self, api_client):
        """Infra status requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/infra/status")
        assert response.status_code == 401

    def test_infra_status_admin_access(self, api_client, admin_token):
        """Admin can access infra status"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected keys
        assert "cache" in data
        assert "storage" in data
        assert "jobs" in data
        assert "sentry" in data
        assert "infrastructure_version" in data

    def test_infra_status_regular_user_access(self, api_client, user_token):
        """Regular user can also access infra status (read-only)"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200

    def test_infra_status_cache_details(self, api_client, admin_token):
        """Verify cache stats structure"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        cache = data["cache"]
        assert "hit_count" in cache
        assert "miss_count" in cache
        assert "hit_rate" in cache
        assert "namespaces" in cache
        
        # Verify namespace structure
        namespaces = cache["namespaces"]
        assert "plans" in namespaces
        assert "stats" in namespaces
        assert "user" in namespaces
        
        # Verify namespace details
        plans_ns = namespaces["plans"]
        assert "size" in plans_ns
        assert "maxsize" in plans_ns
        assert "ttl" in plans_ns

    def test_infra_status_storage_details(self, api_client, admin_token):
        """Verify storage status structure"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        storage = data["storage"]
        assert "backend" in storage
        assert "s3_configured" in storage
        assert "local_dir" in storage
        
        # S3 not configured in test env
        assert storage["backend"] == "local"
        assert storage["s3_configured"] is False

    def test_infra_status_jobs_details(self, api_client, admin_token):
        """Verify job manager stats structure"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        jobs = data["jobs"]
        assert "total_jobs" in jobs
        assert "by_status" in jobs
        assert "max_history" in jobs

    def test_infra_status_sentry_details(self, api_client, admin_token):
        """Verify Sentry status structure"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        sentry = data["sentry"]
        assert "configured" in sentry
        assert "dsn_set" in sentry
        assert "environment" in sentry


class TestCacheClearEndpoints:
    """POST /api/infra/cache/clear and /api/infra/cache/clear/{namespace}"""

    def test_cache_clear_requires_admin(self, api_client, user_token):
        """Non-admin users should get 403 on cache clear"""
        response = api_client.post(
            f"{BASE_URL}/api/infra/cache/clear",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]

    def test_cache_clear_all_admin(self, api_client, admin_token):
        """Admin can clear all caches"""
        response = api_client.post(
            f"{BASE_URL}/api/infra/cache/clear",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "All caches cleared" in data["message"]

    def test_cache_clear_namespace_requires_admin(self, api_client, user_token):
        """Non-admin users should get 403 on namespace cache clear"""
        response = api_client.post(
            f"{BASE_URL}/api/infra/cache/clear/plans",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403

    def test_cache_clear_namespace_admin(self, api_client, admin_token):
        """Admin can clear specific cache namespace"""
        response = api_client.post(
            f"{BASE_URL}/api/infra/cache/clear/plans",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "plans" in data["message"]


class TestCacheIntegration:
    """Cache integration on subscription plans and analytics endpoints"""

    def test_subscription_plans_caching(self, api_client, admin_token):
        """GET /api/subscriptions/plans - first call miss, second call hit"""
        # Clear plans cache first
        api_client.post(
            f"{BASE_URL}/api/infra/cache/clear/plans",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Get initial cache stats
        status1 = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        initial_hit = status1["cache"]["hit_count"]
        initial_miss = status1["cache"]["miss_count"]
        
        # First call - should be cache miss
        response1 = api_client.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response1.status_code == 200
        plans = response1.json()
        assert "plans" in plans
        assert len(plans["plans"]) >= 3  # free, pro, enterprise
        
        # Get cache stats after first call
        status2 = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        
        # Second call - should be cache hit
        response2 = api_client.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response2.status_code == 200
        
        # Get cache stats after second call
        status3 = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        
        # Verify cache stats increased
        # Hit count should be higher after second call
        assert status3["cache"]["hit_count"] > status2["cache"]["hit_count"]

    def test_comprehensive_analytics_caching(self, api_client, admin_token):
        """GET /api/admin/analytics/comprehensive - cached 1 min"""
        # Clear stats cache first
        api_client.post(
            f"{BASE_URL}/api/infra/cache/clear/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # First call
        response1 = api_client.get(
            f"{BASE_URL}/api/admin/analytics/comprehensive",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response1.status_code == 200
        data = response1.json()
        assert "summary" in data
        
        # Check stats namespace has data now
        status = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        assert status["cache"]["namespaces"]["stats"]["size"] >= 1


class TestStorageService:
    """Storage service reports local backend when S3 not configured"""

    def test_storage_backend_local(self, api_client, admin_token):
        """Storage service uses local backend when S3 not configured"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        storage = data["storage"]
        assert storage["backend"] == "local"
        assert storage["s3_configured"] is False
        assert storage["bucket"] is None
        assert "/tmp/notary_uploads" in storage["local_dir"]


class TestSentryIntegration:
    """Sentry init handles missing DSN gracefully"""

    def test_sentry_not_configured(self, api_client, admin_token):
        """Sentry should report not_configured when DSN not set"""
        response = api_client.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        sentry = data["sentry"]
        assert sentry["configured"] is False
        assert sentry["dsn_set"] is False


class TestBackendStartup:
    """Backend starts cleanly with all new services (no import errors)"""

    def test_backend_health(self, api_client):
        """Backend responds to health check"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]

    def test_backend_root(self, api_client):
        """Backend root endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "NotaryChain API" in data.get("message", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
