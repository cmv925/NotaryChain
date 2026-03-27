"""
Test RBAC (Role-Based Access Control) and SSO (Single Sign-On) Features
- RBAC: Custom roles, permissions, role assignments within organizations
- SSO: Simulated SAML/OIDC authentication flows for enterprise organizations
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get the base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://verify-docs-7.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


# Module-level session to avoid rate limiting from multiple logins
_session = None
_token = None
_org_id = None


def get_authenticated_session():
    """Get or create authenticated session - reused across tests"""
    global _session, _token, _org_id
    
    if _session is None or _token is None:
        _session = requests.Session()
        _session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = _session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_resp.status_code != 200:
            raise Exception(f"Login failed: {login_resp.text}")
        
        _token = login_resp.json().get("access_token")
        _session.headers.update({"Authorization": f"Bearer {_token}"})
        
        # Get or create org
        orgs_resp = _session.get(f"{BASE_URL}/api/organizations/")
        if orgs_resp.status_code == 200:
            orgs = orgs_resp.json().get("organizations", [])
            if orgs:
                _org_id = orgs[0]["id"]
            else:
                # Create test org
                unique_slug = f"test-rbac-sso-{uuid.uuid4().hex[:8]}"
                create_resp = _session.post(f"{BASE_URL}/api/organizations/", json={
                    "name": "TEST_RBAC_SSO Organization",
                    "slug": unique_slug,
                    "description": "Test org for RBAC and SSO testing"
                })
                if create_resp.status_code in [200, 201]:
                    _org_id = create_resp.json()["id"]
    
    return _session, _token, _org_id


# ==================== RBAC TESTS ====================

class TestRBACPermissions:
    """Test RBAC permissions listing"""
    
    def test_list_permissions(self):
        """GET /api/organizations/{org_id}/permissions - list all available permissions"""
        session, token, org_id = get_authenticated_session()
        
        resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/permissions")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "permissions" in data, "Response should have 'permissions' key"
        assert "categories" in data, "Response should have 'categories' key"
        
        permissions = data["permissions"]
        assert len(permissions) > 0, "Should have at least one permission"
        
        # Verify permission structure
        for perm in permissions[:3]:
            assert "key" in perm, f"Permission should have 'key': {perm}"
            assert "label" in perm, f"Permission should have 'label': {perm}"
            assert "category" in perm, f"Permission should have 'category': {perm}"
        
        categories = data["categories"]
        assert "Documents" in categories, "Should have 'Documents' category"
        
        print(f"PASS: Listed {len(permissions)} permissions in {len(categories)} categories")


class TestRBACRoles:
    """Test RBAC roles CRUD operations"""
    
    def test_list_roles_creates_system_defaults(self):
        """GET /api/organizations/{org_id}/roles - auto-creates system roles"""
        session, token, org_id = get_authenticated_session()
        
        resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/roles")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "roles" in data, "Response should have 'roles' key"
        roles = data["roles"]
        
        # Verify system roles exist
        system_roles = [r for r in roles if r.get("is_system")]
        role_names = [r["name"] for r in system_roles]
        
        assert "Organization Admin" in role_names, "Should have 'Organization Admin' system role"
        assert "Editor" in role_names, "Should have 'Editor' system role"
        assert "Viewer" in role_names, "Should have 'Viewer' system role"
        
        print(f"PASS: Found {len(system_roles)} system roles")
    
    def test_create_custom_role(self):
        """POST /api/organizations/{org_id}/roles - create a custom role"""
        session, token, org_id = get_authenticated_session()
        
        role_name = f"TEST_Custom_Role_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": role_name,
            "description": "A custom test role",
            "permissions": ["documents:view", "documents:create", "vault:view"]
        }
        
        resp = session.post(f"{BASE_URL}/api/organizations/{org_id}/roles", json=payload)
        
        assert resp.status_code in [200, 201], f"Expected 200/201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data["name"] == role_name, f"Role name mismatch"
        assert data["is_system"] == False, "Custom role should not be system"
        assert "id" in data, "Should have role ID"
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/organizations/{org_id}/roles/{data['id']}")
        
        print(f"PASS: Created custom role '{role_name}'")
    
    def test_update_custom_role(self):
        """PUT /api/organizations/{org_id}/roles/{role_id} - update role"""
        session, token, org_id = get_authenticated_session()
        
        # Create role
        role_name = f"TEST_Update_Role_{uuid.uuid4().hex[:6]}"
        create_resp = session.post(f"{BASE_URL}/api/organizations/{org_id}/roles", json={
            "name": role_name,
            "description": "Original",
            "permissions": ["documents:view"]
        })
        
        assert create_resp.status_code in [200, 201]
        role_id = create_resp.json()["id"]
        
        # Update
        update_resp = session.put(f"{BASE_URL}/api/organizations/{org_id}/roles/{role_id}", json={
            "name": f"{role_name}_Updated",
            "description": "Updated description",
            "permissions": ["documents:view", "documents:create"]
        })
        
        assert update_resp.status_code == 200, f"Expected 200, got {update_resp.status_code}: {update_resp.text}"
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/organizations/{org_id}/roles/{role_id}")
        
        print(f"PASS: Updated role")
    
    def test_delete_custom_role(self):
        """DELETE /api/organizations/{org_id}/roles/{role_id} - delete custom role"""
        session, token, org_id = get_authenticated_session()
        
        # Create role
        role_name = f"TEST_Delete_Role_{uuid.uuid4().hex[:6]}"
        create_resp = session.post(f"{BASE_URL}/api/organizations/{org_id}/roles", json={
            "name": role_name,
            "permissions": ["documents:view"]
        })
        
        role_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = session.delete(f"{BASE_URL}/api/organizations/{org_id}/roles/{role_id}")
        
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}: {delete_resp.text}"
        
        # Verify gone
        roles_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/roles")
        role_ids = [r["id"] for r in roles_resp.json().get("roles", [])]
        assert role_id not in role_ids, "Deleted role should not exist"
        
        print(f"PASS: Deleted custom role")
    
    def test_cannot_delete_system_role(self):
        """DELETE system roles should fail"""
        session, token, org_id = get_authenticated_session()
        
        roles_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/roles")
        roles = roles_resp.json().get("roles", [])
        
        system_role = next((r for r in roles if r.get("is_system")), None)
        assert system_role, "Should have system role"
        
        delete_resp = session.delete(f"{BASE_URL}/api/organizations/{org_id}/roles/{system_role['id']}")
        
        assert delete_resp.status_code == 400, f"Expected 400, got {delete_resp.status_code}"
        
        print(f"PASS: System role deletion rejected")
    
    def test_invalid_permission_rejected(self):
        """Creating role with invalid permissions fails"""
        session, token, org_id = get_authenticated_session()
        
        resp = session.post(f"{BASE_URL}/api/organizations/{org_id}/roles", json={
            "name": f"TEST_Invalid_{uuid.uuid4().hex[:6]}",
            "permissions": ["invalid:permission:xyz"]
        })
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        
        print(f"PASS: Invalid permission rejected")


class TestRBACMemberPermissions:
    """Test effective permissions for members"""
    
    def test_get_effective_permissions(self):
        """GET /api/organizations/{org_id}/members/{member_id}/effective-permissions"""
        session, token, org_id = get_authenticated_session()
        
        members_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/members")
        
        assert members_resp.status_code == 200
        members = members_resp.json().get("members", [])
        assert len(members) > 0, "Should have members"
        
        member_id = members[0]["id"]
        
        perms_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/members/{member_id}/effective-permissions")
        
        assert perms_resp.status_code == 200, f"Expected 200, got {perms_resp.status_code}: {perms_resp.text}"
        data = perms_resp.json()
        
        assert "permissions" in data, "Should have permissions"
        assert "source" in data, "Should have source"
        
        print(f"PASS: Got effective permissions - source: {data['source']}")


# ==================== SSO TESTS ====================

class TestSSOConfiguration:
    """Test SSO configuration"""
    
    def test_configure_sso(self):
        """PUT /api/organizations/{org_id}/sso - configure SSO"""
        session, token, org_id = get_authenticated_session()
        
        resp = session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        # Verify
        get_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/sso")
        if get_resp.status_code == 200:
            assert get_resp.json().get("sso_enabled") == True
        
        print(f"PASS: SSO configured")


class TestSSODiscovery:
    """Test SSO discovery"""
    
    def test_discover_configured_domain(self):
        """POST /api/sso/discover - find SSO for configured domain"""
        session, token, org_id = get_authenticated_session()
        
        # Ensure SSO is configured
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        resp = session.post(f"{BASE_URL}/api/sso/discover", json={
            "email": "user@testcorp.com"
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "sso_available" in data
        if data.get("sso_available"):
            assert "organizations" in data
            print(f"PASS: SSO discover found {len(data['organizations'])} org(s)")
        else:
            print(f"INFO: SSO not found for testcorp.com")
    
    def test_discover_unknown_domain(self):
        """POST /api/sso/discover - unknown domain returns not available"""
        session, token, org_id = get_authenticated_session()
        
        resp = session.post(f"{BASE_URL}/api/sso/discover", json={
            "email": "user@unknown-domain-xyz.com"
        })
        
        assert resp.status_code == 200
        assert resp.json().get("sso_available") == False
        
        print(f"PASS: Unknown domain correctly returns not available")


class TestSSOFlow:
    """Test SSO authentication flow"""
    
    def test_sso_initiate_flow(self):
        """POST /api/sso/initiate - start SSO flow"""
        session, token, org_id = get_authenticated_session()
        
        # Configure SSO
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        resp = session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": org_id,
            "email": "testuser@testcorp.com"
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "session_id" in data, "Should return session_id"
        assert "provider" in data, "Should return provider"
        
        print(f"PASS: SSO flow initiated")
    
    def test_sso_get_session(self):
        """GET /api/sso/session/{session_id} - get session details"""
        session, token, org_id = get_authenticated_session()
        
        # Configure and initiate
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        initiate_resp = session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": org_id,
            "email": "session@testcorp.com"
        })
        
        session_id = initiate_resp.json()["session_id"]
        
        resp = session.get(f"{BASE_URL}/api/sso/session/{session_id}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("session_id") == session_id
        assert data.get("status") == "pending"
        
        print(f"PASS: Got SSO session details")
    
    def test_sso_callback_jit_provision(self):
        """POST /api/sso/callback - complete SSO with JIT provisioning"""
        session, token, org_id = get_authenticated_session()
        
        # Configure SSO
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        unique_email = f"jit_{uuid.uuid4().hex[:8]}@testcorp.com"
        
        initiate_resp = session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": org_id,
            "email": unique_email
        })
        
        session_id = initiate_resp.json()["session_id"]
        
        callback_resp = session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": unique_email,
            "full_name": "JIT Test User"
        })
        
        assert callback_resp.status_code == 200, f"Expected 200, got {callback_resp.status_code}: {callback_resp.text}"
        data = callback_resp.json()
        
        assert "access_token" in data, "Should return access_token"
        assert data.get("user_email") == unique_email
        
        print(f"PASS: SSO callback with JIT provisioning")
    
    def test_sso_callback_wrong_domain_rejected(self):
        """POST /api/sso/callback - reject wrong domain"""
        session, token, org_id = get_authenticated_session()
        
        # Configure SSO with specific domain
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        # Initiate with allowed domain
        initiate_resp = session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": org_id,
            "email": "user@testcorp.com"
        })
        
        session_id = initiate_resp.json()["session_id"]
        
        # Callback with wrong domain
        callback_resp = session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": "hacker@wrongdomain.com"
        })
        
        assert callback_resp.status_code == 403, f"Expected 403, got {callback_resp.status_code}: {callback_resp.text}"
        
        print(f"PASS: Wrong domain rejected")


class TestSSOTestConfig:
    """Test SSO configuration validation"""
    
    def test_sso_test_valid_config(self):
        """POST /api/sso/test - test valid SSO config"""
        session, token, org_id = get_authenticated_session()
        
        # Configure SSO
        session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        })
        
        resp = session.post(f"{BASE_URL}/api/sso/test", json={"org_id": org_id})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "success" in data
        assert "message" in data
        
        print(f"PASS: SSO test returned success={data['success']}")


class TestRBACRoleAssignment:
    """Test assigning custom roles to members"""
    
    def test_assign_and_remove_custom_role(self):
        """PUT/DELETE /api/organizations/{org_id}/members/{member_id}/custom-role"""
        session, token, org_id = get_authenticated_session()
        
        # Create custom role
        role_name = f"TEST_Assign_Role_{uuid.uuid4().hex[:6]}"
        role_resp = session.post(f"{BASE_URL}/api/organizations/{org_id}/roles", json={
            "name": role_name,
            "description": "For assignment test",
            "permissions": ["documents:view", "vault:view"]
        })
        
        assert role_resp.status_code in [200, 201]
        role_id = role_resp.json()["id"]
        
        # Get members
        members_resp = session.get(f"{BASE_URL}/api/organizations/{org_id}/members")
        members = members_resp.json().get("members", [])
        
        # Find non-owner member
        assignable = next((m for m in members if m.get("role") != "owner"), None)
        
        if assignable:
            member_id = assignable["id"]
            
            # Assign role
            assign_resp = session.put(
                f"{BASE_URL}/api/organizations/{org_id}/members/{member_id}/custom-role",
                json={"role_id": role_id}
            )
            
            assert assign_resp.status_code == 200, f"Assign failed: {assign_resp.text}"
            
            # Remove role
            remove_resp = session.delete(
                f"{BASE_URL}/api/organizations/{org_id}/members/{member_id}/custom-role"
            )
            
            assert remove_resp.status_code == 200, f"Remove failed: {remove_resp.text}"
            
            print(f"PASS: Role assignment and removal working")
        else:
            print(f"INFO: No non-owner member to test assignment")
        
        # Cleanup role
        session.delete(f"{BASE_URL}/api/organizations/{org_id}/roles/{role_id}")


class TestFullSSOE2EFlow:
    """Complete E2E SSO flow test"""
    
    def test_full_e2e_flow(self):
        """Complete SSO E2E: configure -> discover -> initiate -> callback"""
        session, token, org_id = get_authenticated_session()
        
        test_domain = f"e2e-{uuid.uuid4().hex[:6]}.com"
        
        # 1. Configure SSO
        config_resp = session.put(f"{BASE_URL}/api/organizations/{org_id}/sso", json={
            "sso_enabled": True,
            "sso_provider": "saml",
            "sso_issuer_url": f"https://idp.{test_domain}",
            "sso_client_id": "e2e-client",
            "sso_client_secret": "e2e-secret",
            "sso_metadata_url": f"https://idp.{test_domain}/metadata",
            "sso_allowed_domains": [test_domain]
        })
        assert config_resp.status_code == 200, f"Config failed: {config_resp.text}"
        
        # 2. Initiate
        test_email = f"e2e_user@{test_domain}"
        initiate_resp = session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": org_id,
            "email": test_email
        })
        assert initiate_resp.status_code == 200, f"Initiate failed: {initiate_resp.text}"
        session_id = initiate_resp.json()["session_id"]
        
        # 3. Verify session pending
        sess_resp = session.get(f"{BASE_URL}/api/sso/session/{session_id}")
        assert sess_resp.status_code == 200
        assert sess_resp.json().get("status") == "pending"
        
        # 4. Complete callback
        callback_resp = session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": test_email,
            "full_name": "E2E Test User"
        })
        assert callback_resp.status_code == 200, f"Callback failed: {callback_resp.text}"
        assert "access_token" in callback_resp.json()
        
        print(f"PASS: Full SSO E2E flow completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
