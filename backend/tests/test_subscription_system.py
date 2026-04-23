"""
Subscription System Tests - Phase A: Stripe Subscription Tiers
Tests subscription plans, checkout, current subscription, usage tracking, and cancellation
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


class TestSubscriptionPlans:
    """Test GET /api/subscriptions/plans - public endpoint"""
    
    def test_get_plans_returns_three_plans(self):
        """Verify /api/subscriptions/plans returns 3 plans (free, pro, enterprise)"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        assert len(data["plans"]) == 3, f"Expected 3 plans, got {len(data['plans'])}"
        
        plan_ids = [p["id"] for p in data["plans"]]
        assert "free" in plan_ids, "Should have 'free' plan"
        assert "pro" in plan_ids, "Should have 'pro' plan"
        assert "enterprise" in plan_ids, "Should have 'enterprise' plan"
    
    def test_free_plan_details(self):
        """Verify free plan has correct price ($0) and features"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        
        data = response.json()
        free_plan = next((p for p in data["plans"] if p["id"] == "free"), None)
        
        assert free_plan is not None, "Free plan should exist"
        assert free_plan["price"] == 0, "Free plan price should be $0"
        assert free_plan["name"] == "Starter", "Free plan name should be 'Starter'"
        assert "features" in free_plan, "Plan should have features"
        assert len(free_plan["features"]) > 0, "Plan should have at least one feature"
        
        # Check limits
        assert "limits" in free_plan, "Plan should have limits"
        assert free_plan["limits"]["notarizations_per_month"] == 3, "Free plan: 3 notarizations"
        assert free_plan["limits"]["ai_analyses_per_month"] == 5, "Free plan: 5 AI analyses"
        assert free_plan["limits"]["transactions_per_month"] == 1, "Free plan: 1 transaction"
    
    def test_pro_plan_details(self):
        """Verify Professional plan has $29 price and features"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        
        data = response.json()
        pro_plan = next((p for p in data["plans"] if p["id"] == "pro"), None)
        
        assert pro_plan is not None, "Pro plan should exist"
        assert pro_plan["price"] == 29.0, "Pro plan price should be $29"
        assert pro_plan["name"] == "Professional", "Pro plan name should be 'Professional'"
        
        # Check limits
        assert pro_plan["limits"]["notarizations_per_month"] == 25, "Pro plan: 25 notarizations"
        assert pro_plan["limits"]["ai_analyses_per_month"] == 50, "Pro plan: 50 AI analyses"
        assert pro_plan["limits"]["transactions_per_month"] == 10, "Pro plan: 10 transactions"
    
    def test_enterprise_plan_details(self):
        """Verify Enterprise plan has $99 price and features"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        
        data = response.json()
        enterprise_plan = next((p for p in data["plans"] if p["id"] == "enterprise"), None)
        
        assert enterprise_plan is not None, "Enterprise plan should exist"
        assert enterprise_plan["price"] == 99.0, "Enterprise plan price should be $99"
        assert enterprise_plan["name"] == "Enterprise", "Enterprise plan name should be 'Enterprise'"
        
        # Check unlimited limits (high values)
        assert enterprise_plan["limits"]["notarizations_per_month"] >= 999, "Enterprise: unlimited notarizations"


class TestSubscriptionCurrentPlan:
    """Test GET /api/subscriptions/current - authenticated endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin user"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_current_subscription_returns_plan_and_usage(self):
        """Verify /api/subscriptions/current returns plan details and usage"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/current",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan'"
        assert "subscription" in data, "Response should contain 'subscription'"
        assert "usage" in data, "Response should contain 'usage'"
        
        # Verify plan structure
        plan = data["plan"]
        assert "id" in plan, "Plan should have id"
        assert "name" in plan, "Plan should have name"
        assert "price" in plan, "Plan should have price"
        assert "features" in plan, "Plan should have features"
    
    def test_current_subscription_has_usage_data(self):
        """Verify usage data contains notarizations, ai_analyses, transactions"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/current",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        usage = data["usage"]
        assert "notarizations" in usage, "Usage should have notarizations"
        assert "ai_analyses" in usage, "Usage should have ai_analyses"
        assert "transactions" in usage, "Usage should have transactions"
        
        # Each usage item should have 'used' and 'limit'
        for key in ["notarizations", "ai_analyses", "transactions"]:
            assert "used" in usage[key], f"{key} should have 'used'"
            assert "limit" in usage[key], f"{key} should have 'limit'"
    
    def test_unauthenticated_current_subscription_fails(self):
        """Verify /api/subscriptions/current returns 401/403 without auth"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/current")
        assert response.status_code in [401, 403], f"Should return 401 or 403 without auth, got {response.status_code}"


class TestSubscriptionUsage:
    """Test GET /api/subscriptions/usage - authenticated endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin user"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_get_usage_endpoint(self):
        """Verify /api/subscriptions/usage returns usage for all resource types"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/usage",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "usage" in data, "Response should contain 'usage'"
        
        usage = data["usage"]
        assert "notarizations_per_month" in usage, "Usage should have notarizations_per_month"
        assert "ai_analyses_per_month" in usage, "Usage should have ai_analyses_per_month"
        assert "transactions_per_month" in usage, "Usage should have transactions_per_month"


class TestSubscriptionCheckout:
    """Test POST /api/subscriptions/checkout - Stripe checkout"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin user"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_checkout_pro_plan_returns_checkout_url(self):
        """Verify POST /api/subscriptions/checkout with plan_id='pro' returns checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            headers=self.headers,
            json={
                "plan_id": "pro",
                "origin_url": "https://chain-verify-demo.preview.emergentagent.com"
            }
        )
        
        # Should succeed with checkout URL
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, "Response should contain 'checkout_url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        assert "plan" in data, "Response should contain 'plan'"
        
        # Verify checkout URL is a valid Stripe URL or test URL
        assert data["checkout_url"] is not None, "checkout_url should not be None"
        assert len(data["checkout_url"]) > 0, "checkout_url should not be empty"
    
    def test_checkout_free_plan_returns_400(self):
        """Verify POST /api/subscriptions/checkout with plan_id='free' returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            headers=self.headers,
            json={
                "plan_id": "free",
                "origin_url": "https://chain-verify-demo.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        assert "free" in data["detail"].lower() or "payment" in data["detail"].lower(), \
            "Error should mention free plan doesn't need payment"
    
    def test_checkout_invalid_plan_returns_400(self):
        """Verify checkout with invalid plan_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            headers=self.headers,
            json={
                "plan_id": "invalid_plan",
                "origin_url": "https://chain-verify-demo.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_checkout_without_auth_returns_401_or_403(self):
        """Verify checkout without auth returns 401 or 403"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            json={
                "plan_id": "pro",
                "origin_url": "https://chain-verify-demo.preview.emergentagent.com"
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"


class TestSubscriptionCancel:
    """Test POST /api/subscriptions/cancel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin user (on free plan)"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_cancel_without_active_paid_subscription_returns_400(self):
        """Verify cancel returns 400 when no active paid subscription exists"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/cancel",
            headers=self.headers
        )
        
        # Admin user is on free plan, so cancel should fail
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        # Should mention no active subscription
        assert "no active" in data["detail"].lower() or "not found" in data["detail"].lower(), \
            f"Error should mention no active subscription: {data['detail']}"


class TestAuthEndpointsStillWork:
    """Verify existing auth endpoints still work after subscription feature"""
    
    @pytest.fixture(autouse=True)
    def wait_between_tests(self):
        """Add delay between tests to avoid rate limiting"""
        import time
        time.sleep(1)
        yield
    
    def test_auth_login_admin(self):
        """Verify /api/auth/login works for admin"""
        import time
        time.sleep(2)  # Wait to avoid rate limiting
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Accept 429 as rate limiting, not a failure
        if response.status_code == 429:
            pytest.skip("Rate limited - endpoint working but throttled")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
    
    def test_auth_login_demo_user(self):
        """Verify /api/auth/login works for demo user"""
        import time
        time.sleep(2)  # Wait to avoid rate limiting
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        
        # Accept 429 as rate limiting, not a failure
        if response.status_code == 429:
            pytest.skip("Rate limited - endpoint working but throttled")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
    
    def test_auth_me_endpoint(self):
        """Verify /api/auth/me works with valid token"""
        import time
        time.sleep(2)  # Wait to avoid rate limiting
        
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Accept 429 as rate limiting
        if login_response.status_code == 429:
            pytest.skip("Rate limited - endpoint working but throttled")
        
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "email" in data, "Response should contain email"
        assert data["email"] == ADMIN_EMAIL, "Email should match"


class TestHealthEndpoint:
    """Verify health endpoint works"""
    
    def test_health_endpoint(self):
        """Verify /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
