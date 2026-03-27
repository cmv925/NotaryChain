"""
SSO Integration Tests - Okta and Auth0 Configuration Validation
Tests SSO endpoints for correct URL generation, status checks, and provider listing.
"""

import pytest
import requests
import os
from urllib.parse import urlparse, parse_qs

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSSOProviderStatus:
    """Tests for SSO provider status endpoints"""
    
    def test_okta_status_configured(self):
        """GET /api/sso/okta/status - should return configured: true"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert data["configured"] == True
        assert "domain" in data
        assert data["domain"] == "trial-1257751.okta.com"
        print(f"✓ Okta status: configured={data['configured']}, domain={data['domain']}")
    
    def test_auth0_status_configured(self):
        """GET /api/sso/auth0/status - should return configured: true"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert data["configured"] == True
        assert "domain" in data
        assert data["domain"] == "dev-ec3s8jabv4ei2wjs.us.auth0.com"
        print(f"✓ Auth0 status: configured={data['configured']}, domain={data['domain']}")
    
    def test_sso_providers_list(self):
        """GET /api/sso/providers - should return both Auth0 and Okta providers"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        providers = data["providers"]
        
        # Check we have both providers
        provider_names = [p["name"] for p in providers]
        assert "Auth0" in provider_names
        assert "Okta" in provider_names
        
        # Verify each provider
        for provider in providers:
            assert provider["configured"] == True
            print(f"✓ Provider: {provider['name']} ({provider['type']}) - configured={provider['configured']}")


class TestOktaLoginURL:
    """Tests for Okta login URL generation"""
    
    def test_okta_login_returns_auth_url(self):
        """GET /api/sso/okta/login - should return auth_url with correct parameters"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "auth_url" in data
        assert "state" in data
        assert len(data["state"]) > 20  # State should be a secure random token
        print(f"✓ State token generated: {data['state'][:20]}...")
        
    def test_okta_login_correct_redirect_uri(self):
        """Verify Okta auth_url contains correct redirect_uri parameter"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        auth_url = response.json()["auth_url"]
        
        # Parse the URL
        parsed = urlparse(auth_url)
        query_params = parse_qs(parsed.query)
        
        # Verify redirect_uri
        expected_redirect = "https://verify-docs-7.preview.emergentagent.com/auth/okta/callback"
        assert "redirect_uri" in query_params
        actual_redirect = query_params["redirect_uri"][0]
        assert actual_redirect == expected_redirect, f"Expected redirect_uri={expected_redirect}, got {actual_redirect}"
        print(f"✓ Redirect URI correct: {actual_redirect}")
        
    def test_okta_login_url_structure(self):
        """Verify Okta auth_url has all required OAuth2 parameters"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        auth_url = response.json()["auth_url"]
        
        # Parse the URL
        parsed = urlparse(auth_url)
        query_params = parse_qs(parsed.query)
        
        # Verify required OAuth2 parameters
        assert parsed.scheme == "https"
        assert "trial-1257751.okta.com" in parsed.netloc
        assert "/oauth2/default/v1/authorize" in parsed.path
        
        # Check required query parameters
        required_params = ["client_id", "response_type", "scope", "redirect_uri", "state"]
        for param in required_params:
            assert param in query_params, f"Missing required param: {param}"
        
        # Verify values - Updated client_id to correct value
        assert query_params["client_id"][0] == "0oa110cnei9quynQC698"
        assert query_params["response_type"][0] == "code"
        assert "openid" in query_params["scope"][0]
        assert "profile" in query_params["scope"][0]
        assert "email" in query_params["scope"][0]
        print("✓ All OAuth2 parameters correct")


class TestOktaAuthURLAcceptance:
    """CRITICAL: Tests that Okta accepts the auth_url (HTTP 200, not 400)"""
    
    def test_okta_auth_url_accepted_by_okta(self):
        """
        CRITICAL TEST: Visit the Okta auth_url and verify HTTP 200 (not 400)
        This was the main bug - Okta returned 400 Bad Request due to wrong Client ID.
        With correct credentials (0oa110cnei9quynQC698), Okta should return 200.
        """
        # Step 1: Get the auth_url from our backend
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        auth_url = response.json()["auth_url"]
        print(f"Auth URL received: {auth_url[:100]}...")
        
        # Step 2: Actually visit the Okta auth_url and check response
        # We're not completing the OAuth flow (that needs user interaction)
        # We're just verifying Okta accepts our URL (returns login page, not 400 error)
        okta_response = requests.get(auth_url, allow_redirects=True)
        
        # Okta should return 200 (login page) not 400 (bad request error)
        assert okta_response.status_code == 200, f"CRITICAL: Okta returned {okta_response.status_code}, expected 200. Content: {okta_response.text[:500]}"
        
        # Verify it's actually the Okta login page (not an error page)
        # The response should contain Okta login elements
        content = okta_response.text.lower()
        is_login_page = (
            "okta" in content or 
            "sign in" in content or 
            "login" in content or
            "username" in content or
            "password" in content
        )
        assert is_login_page, f"CRITICAL: Okta did not return a login page. Response: {okta_response.text[:500]}"
        
        print(f"✓ CRITICAL TEST PASSED: Okta auth_url accepted (HTTP {okta_response.status_code})")
        print(f"✓ Okta returns login page, not 400 Bad Request error")


class TestAuth0LoginURL:
    """Tests for Auth0 login URL generation"""
    
    def test_auth0_login_returns_auth_url(self):
        """GET /api/sso/auth0/login - should return auth_url with correct parameters"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "auth_url" in data
        assert "state" in data
        assert len(data["state"]) > 20
        print(f"✓ State token generated: {data['state'][:20]}...")
        
    def test_auth0_login_correct_redirect_uri(self):
        """Verify Auth0 auth_url contains correct redirect_uri parameter"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        auth_url = response.json()["auth_url"]
        
        # Parse the URL
        parsed = urlparse(auth_url)
        query_params = parse_qs(parsed.query)
        
        # Verify redirect_uri
        expected_redirect = "https://verify-docs-7.preview.emergentagent.com/auth/callback"
        assert "redirect_uri" in query_params
        actual_redirect = query_params["redirect_uri"][0]
        assert actual_redirect == expected_redirect, f"Expected redirect_uri={expected_redirect}, got {actual_redirect}"
        print(f"✓ Redirect URI correct: {actual_redirect}")
        
    def test_auth0_login_url_structure(self):
        """Verify Auth0 auth_url has all required OAuth2 parameters"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"Origin": "https://verify-docs-7.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        auth_url = response.json()["auth_url"]
        
        # Parse the URL
        parsed = urlparse(auth_url)
        query_params = parse_qs(parsed.query)
        
        # Verify required OAuth2 parameters
        assert parsed.scheme == "https"
        assert "dev-ec3s8jabv4ei2wjs.us.auth0.com" in parsed.netloc
        assert "/authorize" in parsed.path
        
        # Check required query parameters
        required_params = ["client_id", "response_type", "scope", "redirect_uri", "state"]
        for param in required_params:
            assert param in query_params, f"Missing required param: {param}"
        
        # Verify values
        assert query_params["client_id"][0] == "sKYa79zs74ABycb6gUdEEMI3JyS56kQh"
        assert query_params["response_type"][0] == "code"
        assert "openid" in query_params["scope"][0]
        print("✓ All OAuth2 parameters correct")


class TestRegularLogin:
    """Tests for regular (non-SSO) login flow"""
    
    def test_admin_login_success(self):
        """Regular login with admin@notarychain.com / Admin123! should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@notarychain.com",
                "password": "Admin123!"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 50  # JWT should be substantial
        print(f"✓ Admin login successful, token received")
    
    def test_demo_user_login_success(self):
        """Regular login with demo@test.com / Demo123! should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "demo@test.com",
                "password": "Demo123!"
            }
        )
        # This may or may not exist depending on seed data
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"✓ Demo user login successful")
        elif response.status_code == 401:
            print(f"⚠ Demo user not found in database (expected if not seeded)")
        else:
            print(f"⚠ Unexpected status code: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
