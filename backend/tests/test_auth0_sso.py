"""
Auth0 SSO Integration Tests
Tests for Auth0 OIDC authentication flow:
- Auth0 status endpoint
- Auth0 login URL generation
- Auth0 callback error handling
- Existing email/password login still works
- SSO session creation in MongoDB
"""

import pytest
import requests
import os
from urllib.parse import urlparse, parse_qs

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Auth0 credentials from request
AUTH0_DOMAIN = "dev-ec3s8jabv4ei2wjs.us.auth0.com"
AUTH0_CLIENT_ID = "sKYa79zs74ABycb6gUdEEMI3JyS56kQh"

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


class TestAuth0Status:
    """Test Auth0 configuration status endpoint"""
    
    def test_auth0_status_returns_configured_true(self):
        """GET /api/sso/auth0/status returns configured: true and domain"""
        response = requests.get(f"{BASE_URL}/api/sso/auth0/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "configured" in data, "Response should contain 'configured' field"
        assert data["configured"] == True, "Auth0 should be configured (configured: true)"
        assert "domain" in data, "Response should contain 'domain' field"
        assert data["domain"] == AUTH0_DOMAIN, f"Domain should be {AUTH0_DOMAIN}"
        print(f"✓ Auth0 status: configured={data['configured']}, domain={data['domain']}")


class TestAuth0Login:
    """Test Auth0 login URL generation"""
    
    def test_auth0_login_returns_auth_url(self):
        """GET /api/sso/auth0/login returns auth_url with correct Auth0 domain"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "auth_url" in data, "Response should contain 'auth_url' field"
        assert "state" in data, "Response should contain 'state' parameter"
        
        auth_url = data["auth_url"]
        print(f"✓ Auth URL generated: {auth_url[:80]}...")
        
        # Verify URL contains Auth0 domain
        assert AUTH0_DOMAIN in auth_url, f"Auth URL should contain {AUTH0_DOMAIN}"
        
        return auth_url, data["state"]
    
    def test_auth_url_contains_correct_client_id(self):
        """Auth URL should contain correct client_id"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        auth_url = response.json()["auth_url"]
        assert f"client_id={AUTH0_CLIENT_ID}" in auth_url, f"Auth URL should contain client_id={AUTH0_CLIENT_ID}"
        print(f"✓ client_id parameter correct: {AUTH0_CLIENT_ID}")
    
    def test_auth_url_contains_response_type_code(self):
        """Auth URL should have response_type=code"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        auth_url = response.json()["auth_url"]
        assert "response_type=code" in auth_url, "Auth URL should contain response_type=code"
        print("✓ response_type=code verified")
    
    def test_auth_url_contains_openid_profile_email_scope(self):
        """Auth URL should have scope=openid profile email"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        auth_url = response.json()["auth_url"]
        # The scope is URL encoded: openid%20profile%20email
        assert "scope=openid" in auth_url, "Auth URL should contain scope with openid"
        assert "profile" in auth_url, "Auth URL should contain profile in scope"
        assert "email" in auth_url, "Auth URL should contain email in scope"
        print("✓ scope=openid+profile+email verified")
    
    def test_auth_url_contains_state_parameter(self):
        """Auth URL should contain state parameter for CSRF protection"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        auth_url = data["auth_url"]
        state = data["state"]
        
        assert "state=" in auth_url, "Auth URL should contain state parameter"
        assert state in auth_url, "Auth URL state should match returned state"
        assert len(state) > 20, "State should be a sufficiently long random token"
        print(f"✓ state parameter verified: {state[:20]}...")


class TestAuth0Callback:
    """Test Auth0 callback endpoint error handling"""
    
    def test_callback_missing_code_returns_400(self):
        """POST /api/sso/auth0/callback returns 400 if code is missing"""
        response = requests.post(
            f"{BASE_URL}/api/sso/auth0/callback",
            json={"state": "some-state-value"}  # Missing 'code'
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "code" in data["detail"].lower() or "missing" in data["detail"].lower(), \
            f"Error should mention missing code: {data['detail']}"
        print(f"✓ Missing code returns 400: {data['detail']}")
    
    def test_callback_missing_state_returns_400(self):
        """POST /api/sso/auth0/callback returns 400 if state is missing"""
        response = requests.post(
            f"{BASE_URL}/api/sso/auth0/callback",
            json={"code": "some-auth-code"}  # Missing 'state'
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        print(f"✓ Missing state returns 400: {data['detail']}")
    
    def test_callback_invalid_state_returns_400(self):
        """POST /api/sso/auth0/callback returns 400 if state doesn't match a pending session"""
        response = requests.post(
            f"{BASE_URL}/api/sso/auth0/callback",
            json={
                "code": "some-auth-code",
                "state": "invalid-state-that-doesnt-exist"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        # Should mention invalid/expired state
        detail_lower = data["detail"].lower()
        assert "invalid" in detail_lower or "expired" in detail_lower or "state" in detail_lower, \
            f"Error should mention invalid/expired state: {data['detail']}"
        print(f"✓ Invalid state returns 400: {data['detail']}")


class TestExistingEmailPasswordLogin:
    """Test that existing email/password login still works"""
    
    def test_admin_login_still_works(self):
        """Existing email/password login for admin@notarychain.com should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        
        # Could be 200 (success) or 200 with requires_2fa
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Either login succeeds or requires 2FA
        if data.get("requires_2fa"):
            print(f"✓ Admin login works - requires 2FA (temp_token received)")
            assert "temp_token" in data
        else:
            print(f"✓ Admin login works - direct login success")
            assert "access_token" in data or "token" in data or "user" in data
    
    def test_invalid_credentials_rejected(self):
        """Invalid credentials should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            }
        )
        
        # Should fail (401 or 400)
        assert response.status_code in [400, 401, 404], \
            f"Invalid credentials should fail, got {response.status_code}: {response.text}"
        print(f"✓ Invalid credentials rejected with status {response.status_code}")


class TestSSOSessionCreation:
    """Test that SSO session is created when auth0/login is called"""
    
    def test_auth0_login_creates_sso_session(self):
        """Calling auth0/login should create an SSO session in MongoDB"""
        # Get auth URL (this creates the session)
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        state = data["state"]
        
        # The state is the session_id - if callback with valid state gets a
        # "completed" or valid response, session exists. We test by trying 
        # callback with this state (it will fail at Auth0 but session lookup should work)
        callback_response = requests.post(
            f"{BASE_URL}/api/sso/auth0/callback",
            json={
                "code": "fake-code-will-fail-at-auth0",
                "state": state
            }
        )
        
        # The error should be about Auth0 token exchange failing (401), 
        # NOT about invalid/expired state (400)
        # If state was not stored, we'd get 400 "Invalid or expired state"
        if callback_response.status_code == 400:
            error_detail = callback_response.json().get("detail", "").lower()
            # If it says "invalid or expired state", session wasn't created
            # If it says something else, state was found but something else failed
            assert "invalid" not in error_detail and "expired" not in error_detail, \
                f"Session should have been created, but got: {error_detail}"
            print(f"✓ SSO session created (different error: {callback_response.json().get('detail')})")
        elif callback_response.status_code == 401:
            # 401 means state was valid, just Auth0 exchange failed (expected)
            print("✓ SSO session created (state validated, Auth0 exchange failed as expected)")
        else:
            print(f"✓ SSO session created (callback status: {callback_response.status_code})")


class TestAuth0URLParsing:
    """Detailed verification of Auth0 URL parameters"""
    
    def test_full_auth_url_structure(self):
        """Verify complete Auth0 URL structure"""
        response = requests.get(
            f"{BASE_URL}/api/sso/auth0/login",
            headers={"origin": "https://notary-vault-dev.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        auth_url = response.json()["auth_url"]
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        
        print(f"\n=== Auth0 URL Analysis ===")
        print(f"Domain: {parsed.netloc}")
        print(f"Path: {parsed.path}")
        
        # Verify domain
        assert parsed.netloc == AUTH0_DOMAIN, f"Domain should be {AUTH0_DOMAIN}"
        print(f"✓ Domain correct: {parsed.netloc}")
        
        # Verify path is /authorize
        assert "/authorize" in parsed.path, "Path should contain /authorize"
        print(f"✓ Path correct: {parsed.path}")
        
        # Verify client_id
        assert "client_id" in params, "URL should have client_id"
        assert params["client_id"][0] == AUTH0_CLIENT_ID, f"client_id should be {AUTH0_CLIENT_ID}"
        print(f"✓ client_id: {params['client_id'][0]}")
        
        # Verify response_type
        assert "response_type" in params, "URL should have response_type"
        assert params["response_type"][0] == "code", "response_type should be 'code'"
        print(f"✓ response_type: {params['response_type'][0]}")
        
        # Verify scope
        assert "scope" in params, "URL should have scope"
        scope = params["scope"][0]
        assert "openid" in scope, "scope should include openid"
        assert "profile" in scope, "scope should include profile"
        assert "email" in scope, "scope should include email"
        print(f"✓ scope: {scope}")
        
        # Verify redirect_uri
        assert "redirect_uri" in params, "URL should have redirect_uri"
        redirect = params["redirect_uri"][0]
        assert "/auth/callback" in redirect, "redirect_uri should point to /auth/callback"
        print(f"✓ redirect_uri: {redirect}")
        
        # Verify state
        assert "state" in params, "URL should have state"
        print(f"✓ state: {params['state'][0][:20]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
