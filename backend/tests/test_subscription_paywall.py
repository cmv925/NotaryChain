"""
Subscription Paywall/Gating System Tests
Tests for: Plan definitions, feature-map, admin bypass, free user gating
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
FREE_USER_EMAIL = "demo@test.com"
FREE_USER_PASSWORD = "Demo123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def free_user_token():
    """Get free user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": FREE_USER_EMAIL,
        "password": FREE_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Free user login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def notary_token():
    """Get notary auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": NOTARY_EMAIL,
        "password": NOTARY_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Notary login failed: {response.status_code} - {response.text}")


class TestSubscriptionPlans:
    """Test GET /api/subscriptions/plans returns correct plan definitions"""

    def test_plans_endpoint_returns_3_plans(self):
        """Verify plans endpoint returns exactly 3 plans"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "plans" in data
        assert len(data["plans"]) == 3, f"Expected 3 plans, got {len(data['plans'])}"

    def test_free_plan_price_is_zero(self):
        """Verify free/Starter plan has $0 price"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        plans = response.json()["plans"]
        free_plan = next((p for p in plans if p["id"] == "free"), None)
        assert free_plan is not None, "Free plan not found"
        assert free_plan["price"] == 0, f"Free plan price should be 0, got {free_plan['price']}"
        assert free_plan["name"] == "Starter", f"Free plan name should be 'Starter', got {free_plan['name']}"

    def test_pro_plan_price_is_49(self):
        """Verify Professional plan has $49 price"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        plans = response.json()["plans"]
        pro_plan = next((p for p in plans if p["id"] == "pro"), None)
        assert pro_plan is not None, "Pro plan not found"
        assert pro_plan["price"] == 49.0, f"Pro plan price should be 49, got {pro_plan['price']}"
        assert pro_plan["name"] == "Professional", f"Pro plan name should be 'Professional', got {pro_plan['name']}"

    def test_enterprise_plan_price_is_199(self):
        """Verify Enterprise plan has $199 price"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        plans = response.json()["plans"]
        enterprise_plan = next((p for p in plans if p["id"] == "enterprise"), None)
        assert enterprise_plan is not None, "Enterprise plan not found"
        assert enterprise_plan["price"] == 199.0, f"Enterprise plan price should be 199, got {enterprise_plan['price']}"
        assert enterprise_plan["name"] == "Enterprise", f"Enterprise plan name should be 'Enterprise', got {enterprise_plan['name']}"

    def test_plans_have_features_list(self):
        """Verify each plan has a features list"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        plans = response.json()["plans"]
        for plan in plans:
            assert "features" in plan, f"Plan {plan['id']} missing features"
            assert isinstance(plan["features"], list), f"Plan {plan['id']} features should be a list"
            assert len(plan["features"]) > 0, f"Plan {plan['id']} should have at least one feature"


class TestFeatureMap:
    """Test GET /api/subscriptions/feature-map returns correct feature access"""

    def test_feature_map_requires_auth(self):
        """Verify feature-map endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/feature-map")
        # 401 or 403 both indicate auth required
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"

    def test_feature_map_returns_all_features(self, free_user_token):
        """Verify feature-map returns all 21 gated features"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/feature-map",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "features" in data
        assert "user_plan" in data
        # Check we have the expected features
        expected_features = [
            "ai_summarizer", "ai_generator", "doc_compare", "doc_remediation",
            "ceremony_replay", "certificate_expiration", "biometric_passport",
            "video_witness", "document_versioning",
            "ai_intelligence_hub", "anan", "escrow_intelligence", "hts_tokens",
            "multi_signature", "bulk_notarization", "organization", "sso",
            "white_label", "scheduled_reports", "api_access", "fraud_intelligence"
        ]
        for feature in expected_features:
            assert feature in data["features"], f"Feature {feature} not found in feature-map"

    def test_free_user_all_features_denied(self, free_user_token):
        """Verify free user gets allowed=false for all gated features"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/feature-map",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_plan"] == "free", f"Expected free plan, got {data['user_plan']}"
        
        # All features should be denied for free user
        for feature_name, feature_data in data["features"].items():
            assert feature_data["allowed"] == False, f"Feature {feature_name} should be denied for free user"

    def test_admin_all_features_allowed(self, admin_token):
        """Verify admin user gets allowed=true for all features (admin bypass)"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/feature-map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All features should be allowed for admin
        for feature_name, feature_data in data["features"].items():
            assert feature_data["allowed"] == True, f"Feature {feature_name} should be allowed for admin"


class TestFeatureAccessEndpoint:
    """Test GET /api/subscriptions/feature-access/{feature}"""

    def test_feature_access_ai_intelligence_denied_for_free(self, free_user_token):
        """Verify ai_intelligence_hub returns allowed=false for free user"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/feature-access/ai_intelligence_hub",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["allowed"] == False, "ai_intelligence_hub should be denied for free user"
        assert data["required_plan"] == "enterprise", f"Required plan should be enterprise, got {data.get('required_plan')}"


class TestAIIntelligenceGating:
    """Test AI Intelligence Hub endpoints are gated for free users"""

    def test_risk_score_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/ai-intelligence/risk-score returns 403 with upgrade_required for free user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"document_text": "Test document", "document_name": "Test"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("error") == "upgrade_required", f"Expected upgrade_required error, got {detail}"
        assert detail.get("required_plan") == "enterprise", f"Required plan should be enterprise"
        assert detail.get("required_plan_price") == 199, f"Required plan price should be 199"

    def test_risk_score_returns_200_for_admin(self, admin_token):
        """Verify POST /api/ai-intelligence/risk-score returns 200 for admin (bypass)"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"document_text": "This is a test legal document for risk scoring.", "document_name": "Test Contract"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"

    def test_summarize_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/ai-intelligence/summarize returns 403 for free user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/summarize",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"document_text": "Test document", "document_name": "Test"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_match_notary_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/ai-intelligence/match-notary returns 403 for free user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/match-notary",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"document_type": "contract", "jurisdiction": "California"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_voice_auth_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/ai-intelligence/voice-auth returns 403 for free user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/voice-auth",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"party_name": "Test User", "audio_base64": ""}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestEscrowGating:
    """Test Escrow Intelligence endpoints are gated for free users"""

    def test_escrow_create_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/escrow/create returns 403 with upgrade_required for free user"""
        response = requests.post(
            f"{BASE_URL}/api/escrow/create",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"title": "Test Escrow", "escrow_amount": 10000}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("error") == "upgrade_required", f"Expected upgrade_required error"
        assert detail.get("required_plan") == "enterprise", f"Required plan should be enterprise"

    def test_escrow_create_returns_200_for_admin(self, admin_token):
        """Verify POST /api/escrow/create returns 200 for admin (bypass)"""
        response = requests.post(
            f"{BASE_URL}/api/escrow/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": "Admin Test Escrow", "escrow_amount": 5000}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"


class TestANANGating:
    """Test ANAN (Autonomous Notary Agent Network) endpoints are gated"""

    def test_anan_ceremony_start_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/anan/ceremony/start returns 403 for free user"""
        response = requests.post(
            f"{BASE_URL}/api/anan/ceremony/start",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"document_name": "Test Doc", "signer_name": "Test Signer"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("error") == "upgrade_required", f"Expected upgrade_required error"

    def test_anan_ceremony_start_returns_200_for_admin(self, admin_token):
        """Verify POST /api/anan/ceremony/start returns 200 for admin (bypass)"""
        response = requests.post(
            f"{BASE_URL}/api/anan/ceremony/start",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"document_name": "Admin Test Doc", "signer_name": "Admin Signer"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"


class TestHTSGating:
    """Test HTS (Hedera Token Service) endpoints are gated"""

    def test_hts_tokenize_returns_403_for_free_user(self, free_user_token):
        """Verify POST /api/hts/tokenize returns 403 for free user"""
        response = requests.post(
            f"{BASE_URL}/api/hts/tokenize",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"escrow_id": "test-escrow-id", "token_name": "TEST", "token_symbol": "TST", "initial_supply": 100}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("error") == "upgrade_required", f"Expected upgrade_required error"


class TestNotaryUserGating:
    """Test that notary users (non-admin) are also gated on enterprise features"""

    def test_notary_gated_on_ai_intelligence(self, notary_token):
        """Verify notary user is gated on AI Intelligence Hub"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            headers={"Authorization": f"Bearer {notary_token}"},
            json={"document_text": "Test document", "document_name": "Test"}
        )
        assert response.status_code == 403, f"Expected 403 for notary, got {response.status_code}"

    def test_notary_gated_on_escrow(self, notary_token):
        """Verify notary user is gated on Escrow Intelligence"""
        response = requests.post(
            f"{BASE_URL}/api/escrow/create",
            headers={"Authorization": f"Bearer {notary_token}"},
            json={"title": "Notary Test Escrow", "escrow_amount": 1000}
        )
        assert response.status_code == 403, f"Expected 403 for notary, got {response.status_code}"


class TestUpgradeRequiredErrorStructure:
    """Test that 403 responses have correct upgrade_required error structure"""

    def test_upgrade_error_has_all_required_fields(self, free_user_token):
        """Verify upgrade_required error contains all necessary fields"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"document_text": "Test", "document_name": "Test"}
        )
        assert response.status_code == 403
        data = response.json()
        detail = data.get("detail", {})
        
        # Check all required fields are present
        required_fields = ["error", "message", "required_plan", "required_plan_name", "required_plan_price", "current_plan", "feature"]
        for field in required_fields:
            assert field in detail, f"Missing field: {field} in upgrade_required error"
        
        # Verify field values
        assert detail["error"] == "upgrade_required"
        assert detail["required_plan"] == "enterprise"
        assert detail["required_plan_name"] == "Enterprise"
        assert detail["required_plan_price"] == 199
        assert detail["current_plan"] == "free"
        assert detail["feature"] == "ai_intelligence_hub"
