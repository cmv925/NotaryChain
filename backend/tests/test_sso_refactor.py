"""
Test SSO Routes Refactor - Iteration 56
Tests the refactored SSO routes: Auth0, Okta, and Enterprise SSO endpoints.
sso_routes.py was split into: sso_common.py, auth0_routes.py, okta_routes.py, sso_routes.py
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuth0Routes:
    """Auth0 SSO endpoint tests (auth0_routes.py)"""

    def test_auth0_status_returns_configured(self):
        """GET /api/sso/auth0/status - should return configured true with domain"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] == True
        assert "domain" in data
        assert data["domain"] is not None
        assert "auth0" in data["domain"].lower() or "." in data["domain"]
        print(f"Auth0 status: configured={data['configured']}, domain={data['domain']}")

    def test_auth0_login_returns_auth_url(self):
        """GET /api/sso/auth0/login - should return valid auth_url"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/login")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "state" in data
        assert data["auth_url"].startswith("https://")
        assert "authorize" in data["auth_url"]
        assert "client_id=" in data["auth_url"]
        assert "redirect_uri=" in data["auth_url"]
        print(f"Auth0 login auth_url starts with: {data['auth_url'][:80]}...")


class TestOktaRoutes:
    """Okta SSO endpoint tests (okta_routes.py)"""

    def test_okta_status_returns_configured(self):
        """GET /api/sso/okta/status - should return configured true with domain"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] == True
        assert "domain" in data
        assert data["domain"] is not None
        assert "okta" in data["domain"].lower()
        print(f"Okta status: configured={data['configured']}, domain={data['domain']}")

    def test_okta_login_returns_auth_url_http_200(self):
        """GET /api/sso/okta/login - should return HTTP 200 (not 400) with valid auth_url"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/login")
        # Critical: Okta should return 200, not 400
        assert response.status_code == 200, f"Okta login returned {response.status_code}, expected 200"
        data = response.json()
        assert "auth_url" in data
        assert "state" in data
        assert data["auth_url"].startswith("https://")
        assert "oauth2/default/v1/authorize" in data["auth_url"]
        assert "client_id=" in data["auth_url"]
        assert "redirect_uri=" in data["auth_url"]
        print(f"Okta login auth_url starts with: {data['auth_url'][:80]}...")


class TestSSOProviders:
    """SSO providers endpoint tests (sso_routes.py)"""

    def test_providers_returns_both_auth0_and_okta(self):
        """GET /api/sso/providers - should return both Auth0 and Okta"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        providers = data["providers"]
        assert len(providers) >= 2
        
        provider_types = [p["type"] for p in providers]
        assert "auth0" in provider_types, "Auth0 provider missing"
        assert "okta" in provider_types, "Okta provider missing"
        
        for provider in providers:
            assert provider["configured"] == True
            assert "name" in provider
        print(f"Providers: {[p['name'] for p in providers]}")


class TestSSODiscover:
    """SSO discover endpoint tests (sso_routes.py)"""

    def test_discover_with_email_parameter(self):
        """POST /api/sso/discover - should work with email parameter"""
        response = requests.post(
            f"{BASE_URL}/api/sso/discover",
            json={"email": "test@example.com"}
        )
        assert response.status_code == 200
        data = response.json()
        # Either sso_available is true with organizations, or false with message
        assert "sso_available" in data
        if data["sso_available"]:
            assert "organizations" in data
        else:
            assert "message" in data
        print(f"SSO discover result: sso_available={data['sso_available']}")

    def test_discover_with_invalid_email(self):
        """POST /api/sso/discover - should handle invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/sso/discover",
            json={"email": "invalid-email"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sso_available"] == False
        print(f"Invalid email discover result: {data}")


class TestRegularAuthAfterRefactor:
    """Verify regular auth still works after SSO refactor"""

    def test_regular_login_still_works(self):
        """POST /api/auth/login - regular login should still work after refactor"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@notarychain.com", "password": "Admin123!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        print("Regular login working correctly after SSO refactor")

    def test_demo_user_login(self):
        """POST /api/auth/login - demo user login should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@test.com", "password": "Demo123!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print("Demo user login working correctly")


class TestMarketplaceAPI:
    """Marketplace API tests for notary profile and reviews"""

    def test_marketplace_notaries_list(self):
        """GET /api/marketplace/notaries - should return notary list"""
        response = requests.get(f"{BASE_URL}/api/marketplace/notaries")
        assert response.status_code == 200
        data = response.json()
        assert "notaries" in data
        print(f"Marketplace has {len(data['notaries'])} notaries")

    def test_marketplace_notary_profile(self):
        """GET /api/marketplace/notaries/:id - should return notary profile with reviews"""
        # First get list to find a notary ID
        list_response = requests.get(f"{BASE_URL}/api/marketplace/notaries")
        assert list_response.status_code == 200
        notaries = list_response.json().get("notaries", [])
        
        if notaries:
            notary_id = notaries[0]["notary_id"]
            profile_response = requests.get(f"{BASE_URL}/api/marketplace/notaries/{notary_id}")
            assert profile_response.status_code == 200
            profile = profile_response.json()
            assert "name" in profile
            assert "reviews" in profile or "review_count" in profile
            print(f"Notary profile loaded: {profile.get('name')}")
        else:
            pytest.skip("No notaries in marketplace to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
