"""
Okta SSO Integration Tests
Tests for Okta OIDC authentication flow added alongside Auth0 SSO.
Covers: status endpoint, login URL generation, callback validation, providers listing.
"""
import pytest
import requests
import os
from urllib.parse import urlparse, parse_qs

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected Okta configuration
EXPECTED_OKTA_DOMAIN = "trial-1257751.okta.com"
EXPECTED_OKTA_CLIENT_ID = "0oa110btli7AyC2ZB698"


class TestOktaStatus:
    """Test Okta configuration status endpoint"""

    def test_okta_status_returns_configured_true(self):
        """GET /api/sso/okta/status should return configured: true"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "configured" in data, "Response missing 'configured' field"
        assert data["configured"] is True, f"Expected configured=True, got {data['configured']}"
        
    def test_okta_status_returns_correct_domain(self):
        """GET /api/sso/okta/status should return correct Okta domain"""
        response = requests.get(f"{BASE_URL}/api/sso/okta/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "domain" in data, "Response missing 'domain' field"
        assert data["domain"] == EXPECTED_OKTA_DOMAIN, f"Expected domain={EXPECTED_OKTA_DOMAIN}, got {data['domain']}"


class TestOktaLogin:
    """Test Okta login URL generation endpoint"""

    def test_okta_login_returns_auth_url(self):
        """GET /api/sso/okta/login should return auth_url and state"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "auth_url" in data, "Response missing 'auth_url' field"
        assert "state" in data, "Response missing 'state' field"
        assert isinstance(data["state"], str), "State should be a string"
        assert len(data["state"]) > 10, "State should be a non-trivial token"

    def test_okta_auth_url_has_correct_domain(self):
        """Okta auth_url should contain the correct Okta domain"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        
        assert EXPECTED_OKTA_DOMAIN in parsed.netloc, f"Auth URL should contain {EXPECTED_OKTA_DOMAIN}, got {parsed.netloc}"

    def test_okta_auth_url_has_correct_authorize_path(self):
        """Okta auth_url should use /oauth2/default/v1/authorize path"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        
        assert "/oauth2/default/v1/authorize" in parsed.path, f"Auth URL path should contain /oauth2/default/v1/authorize, got {parsed.path}"

    def test_okta_auth_url_has_correct_client_id(self):
        """Okta auth_url should contain the correct client_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        assert "client_id" in params, "Auth URL missing client_id parameter"
        assert params["client_id"][0] == EXPECTED_OKTA_CLIENT_ID, f"Expected client_id={EXPECTED_OKTA_CLIENT_ID}, got {params['client_id'][0]}"

    def test_okta_auth_url_has_response_type_code(self):
        """Okta auth_url should have response_type=code parameter"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        assert "response_type" in params, "Auth URL missing response_type parameter"
        assert params["response_type"][0] == "code", f"Expected response_type=code, got {params['response_type'][0]}"

    def test_okta_auth_url_has_correct_scope(self):
        """Okta auth_url should have scope=openid profile email"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        assert "scope" in params, "Auth URL missing scope parameter"
        scope = params["scope"][0]
        assert "openid" in scope, f"Scope should contain 'openid', got {scope}"
        assert "profile" in scope, f"Scope should contain 'profile', got {scope}"
        assert "email" in scope, f"Scope should contain 'email', got {scope}"

    def test_okta_auth_url_has_redirect_uri(self):
        """Okta auth_url should have redirect_uri pointing to /auth/okta/callback"""
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        assert "redirect_uri" in params, "Auth URL missing redirect_uri parameter"
        redirect_uri = params["redirect_uri"][0]
        assert "/auth/okta/callback" in redirect_uri, f"redirect_uri should contain /auth/okta/callback, got {redirect_uri}"


class TestOktaCallback:
    """Test Okta callback endpoint validation"""

    def test_callback_rejects_missing_code(self):
        """POST /api/sso/okta/callback should return 400 if code is missing"""
        response = requests.post(
            f"{BASE_URL}/api/sso/okta/callback",
            json={"state": "some_state"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "code" in data["detail"].lower() or "missing" in data["detail"].lower(), f"Error should mention missing code: {data['detail']}"

    def test_callback_rejects_missing_state(self):
        """POST /api/sso/okta/callback should return 400 if state is missing"""
        response = requests.post(
            f"{BASE_URL}/api/sso/okta/callback",
            json={"code": "some_code"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "state" in data["detail"].lower() or "missing" in data["detail"].lower(), f"Error should mention missing state: {data['detail']}"

    def test_callback_rejects_invalid_state(self):
        """POST /api/sso/okta/callback should return 400 if state doesn't match pending session"""
        response = requests.post(
            f"{BASE_URL}/api/sso/okta/callback",
            json={"code": "test_code", "state": "invalid_state_that_doesnt_exist"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        # Should mention invalid or expired state
        assert "invalid" in data["detail"].lower() or "expired" in data["detail"].lower(), f"Error should mention invalid state: {data['detail']}"


class TestSSOProviders:
    """Test SSO providers listing endpoint"""

    def test_providers_endpoint_returns_list(self):
        """GET /api/sso/providers should return providers list"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "providers" in data, "Response should have 'providers' field"
        assert isinstance(data["providers"], list), "providers should be a list"

    def test_providers_includes_auth0(self):
        """GET /api/sso/providers should include Auth0"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200
        
        data = response.json()
        providers = data["providers"]
        auth0_providers = [p for p in providers if p.get("type") == "auth0" or p.get("name") == "Auth0"]
        
        assert len(auth0_providers) > 0, "Auth0 should be in providers list"
        assert auth0_providers[0].get("configured") is True, "Auth0 should be marked as configured"

    def test_providers_includes_okta(self):
        """GET /api/sso/providers should include Okta"""
        response = requests.get(f"{BASE_URL}/api/sso/providers")
        assert response.status_code == 200
        
        data = response.json()
        providers = data["providers"]
        okta_providers = [p for p in providers if p.get("type") == "okta" or p.get("name") == "Okta"]
        
        assert len(okta_providers) > 0, "Okta should be in providers list"
        assert okta_providers[0].get("configured") is True, "Okta should be marked as configured"


class TestAuth0StillWorks:
    """Verify Auth0 still works after Okta integration"""

    def test_auth0_status_still_works(self):
        """GET /api/sso/auth0/status should still work"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("configured") is True, "Auth0 should still be configured"

    def test_auth0_login_still_works(self):
        """GET /api/sso/auth0/login should still work"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "auth_url" in data, "Auth0 login should return auth_url"
        assert "state" in data, "Auth0 login should return state"


class TestEmailPasswordLogin:
    """Verify email/password login still works"""

    def test_admin_login_works(self):
        """POST /api/auth/login with admin credentials should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@notarychain.com", "password": "Admin123!"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data, "Login should return access_token"
        assert data.get("token_type") == "bearer", "Token type should be bearer"


class TestOktaSessionCreation:
    """Verify SSO session is created in MongoDB when okta/login is called"""

    def test_okta_login_creates_session(self):
        """GET /api/sso/okta/login should create a pending SSO session"""
        # Call okta/login
        response = requests.get(
            f"{BASE_URL}/api/sso/okta/login",
            headers={"origin": "https://notary-hts-pwa.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        state = data.get("state")
        assert state, "Should return state parameter"
        
        # Verify the session exists by trying to use it with okta/callback
        # If session doesn't exist, we'd get "Invalid or expired state"
        # If session exists but code is invalid, we'd still get a different error
        callback_response = requests.post(
            f"{BASE_URL}/api/sso/okta/callback",
            json={"code": "test_code", "state": state},
            headers={"Content-Type": "application/json"}
        )
        
        # We expect 401 (Okta authentication failed) NOT 400 (Invalid state)
        # because the state is valid but the code won't work with Okta
        # This proves the session was created
        assert callback_response.status_code == 401, f"Expected 401 (Okta auth failed), got {callback_response.status_code}. Session may not have been created."


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
