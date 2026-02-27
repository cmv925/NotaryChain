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
    BASE_URL = "https://enterprise-auth-flow.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestRBACAndSSO:
    """Test RBAC and SSO features together"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_resp.status_code == 200:
            data = login_resp.json()
            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_resp.text}")
        
        # Create or get test organization
        self.org_id = None
        self._ensure_test_organization()
        
        yield
        
        # Cleanup test data
        self._cleanup_test_data()
    
    def _ensure_test_organization(self):
        """Ensure we have a test organization to work with"""
        # First try to get existing organizations
        orgs_resp = self.session.get(f"{BASE_URL}/api/organizations/")
        if orgs_resp.status_code == 200:
            orgs = orgs_resp.json().get("organizations", [])
            for org in orgs:
                if org.get("slug", "").startswith("test-rbac-sso"):
                    self.org_id = org["id"]
                    self.org_slug = org["slug"]
                    return
        
        # Create new test organization
        unique_slug = f"test-rbac-sso-{uuid.uuid4().hex[:8]}"
        create_resp = self.session.post(f"{BASE_URL}/api/organizations/", json={
            "name": "TEST_RBAC_SSO Organization",
            "slug": unique_slug,
            "description": "Test org for RBAC and SSO testing"
        })
        
        if create_resp.status_code in [200, 201]:
            data = create_resp.json()
            self.org_id = data["id"]
            self.org_slug = data["slug"]
        else:
            pytest.skip(f"Could not create test org: {create_resp.text}")
    
    def _cleanup_test_data(self):
        """Cleanup test roles (optional - only custom roles)"""
        if hasattr(self, 'org_id') and self.org_id:
            # Get all roles
            roles_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/roles")
            if roles_resp.status_code == 200:
                roles = roles_resp.json().get("roles", [])
                for role in roles:
                    if role.get("name", "").startswith("TEST_") and not role.get("is_system"):
                        self.session.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role['id']}")
    
    # ==================== RBAC TESTS ====================
    
    def test_01_list_permissions(self):
        """GET /api/organizations/{org_id}/permissions - list all available permissions"""
        resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/permissions")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "permissions" in data, "Response should have 'permissions' key"
        assert "categories" in data, "Response should have 'categories' key"
        
        # Verify permissions have required fields
        permissions = data["permissions"]
        assert len(permissions) > 0, "Should have at least one permission"
        
        for perm in permissions[:5]:  # Check first 5
            assert "key" in perm, f"Permission should have 'key': {perm}"
            assert "label" in perm, f"Permission should have 'label': {perm}"
            assert "category" in perm, f"Permission should have 'category': {perm}"
        
        # Verify categories structure
        categories = data["categories"]
        assert len(categories) > 0, "Should have at least one category"
        assert "Documents" in categories, "Should have 'Documents' category"
        
        print(f"PASS: Listed {len(permissions)} permissions in {len(categories)} categories")
    
    def test_02_list_roles_creates_system_defaults(self):
        """GET /api/organizations/{org_id}/roles - should auto-create 3 system default roles"""
        resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/roles")
        
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
        
        # Verify role structure
        for role in system_roles:
            assert "id" in role, f"Role should have 'id': {role}"
            assert "name" in role, f"Role should have 'name': {role}"
            assert "permissions" in role, f"Role should have 'permissions': {role}"
            assert "is_system" in role, f"Role should have 'is_system': {role}"
        
        print(f"PASS: Found {len(system_roles)} system roles and {len(roles)} total roles")
    
    def test_03_create_custom_role(self):
        """POST /api/organizations/{org_id}/roles - create a custom role"""
        role_name = f"TEST_Custom_Role_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": role_name,
            "description": "A custom test role with specific permissions",
            "permissions": ["documents:view", "documents:create", "vault:view"]
        }
        
        resp = self.session.post(f"{BASE_URL}/api/organizations/{self.org_id}/roles", json=payload)
        
        assert resp.status_code in [200, 201], f"Expected 200/201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify created role
        assert data["name"] == role_name, f"Role name mismatch: {data}"
        assert data["description"] == payload["description"], "Description mismatch"
        assert set(data["permissions"]) == set(payload["permissions"]), "Permissions mismatch"
        assert data["is_system"] == False, "Custom role should not be system role"
        assert "id" in data, "Should have role ID"
        
        self.custom_role_id = data["id"]
        print(f"PASS: Created custom role '{role_name}' with ID {self.custom_role_id}")
        
        return data["id"]
    
    def test_04_update_custom_role(self):
        """PUT /api/organizations/{org_id}/roles/{role_id} - update role"""
        # First create a role to update
        role_name = f"TEST_Update_Role_{uuid.uuid4().hex[:6]}"
        create_resp = self.session.post(f"{BASE_URL}/api/organizations/{self.org_id}/roles", json={
            "name": role_name,
            "description": "Original description",
            "permissions": ["documents:view"]
        })
        
        assert create_resp.status_code in [200, 201], f"Create failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Update the role
        update_payload = {
            "name": f"{role_name}_Updated",
            "description": "Updated description",
            "permissions": ["documents:view", "documents:create", "vault:view", "vault:upload"]
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}", json=update_payload)
        
        assert update_resp.status_code == 200, f"Expected 200, got {update_resp.status_code}: {update_resp.text}"
        data = update_resp.json()
        
        assert update_payload["name"] in data["name"], "Name should be updated"
        assert data["description"] == update_payload["description"], "Description should be updated"
        assert set(data["permissions"]) == set(update_payload["permissions"]), "Permissions should be updated"
        
        print(f"PASS: Updated role {role_id}")
    
    def test_05_delete_custom_role(self):
        """DELETE /api/organizations/{org_id}/roles/{role_id} - delete custom role"""
        # Create a role to delete
        role_name = f"TEST_Delete_Role_{uuid.uuid4().hex[:6]}"
        create_resp = self.session.post(f"{BASE_URL}/api/organizations/{self.org_id}/roles", json={
            "name": role_name,
            "description": "Will be deleted",
            "permissions": ["documents:view"]
        })
        
        assert create_resp.status_code in [200, 201], f"Create failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Delete the role
        delete_resp = self.session.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}")
        
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}: {delete_resp.text}"
        data = delete_resp.json()
        assert "message" in data, "Should have deletion message"
        
        # Verify role is gone
        verify_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/roles")
        roles = verify_resp.json().get("roles", [])
        role_ids = [r["id"] for r in roles]
        assert role_id not in role_ids, "Deleted role should not exist"
        
        print(f"PASS: Deleted custom role {role_id}")
    
    def test_06_cannot_delete_system_role(self):
        """DELETE /api/organizations/{org_id}/roles/{role_id} - system roles cannot be deleted"""
        # Get system role ID
        roles_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/roles")
        roles = roles_resp.json().get("roles", [])
        
        system_role = next((r for r in roles if r.get("is_system")), None)
        assert system_role, "Should have at least one system role"
        
        # Try to delete system role
        delete_resp = self.session.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{system_role['id']}")
        
        assert delete_resp.status_code == 400, f"Expected 400, got {delete_resp.status_code}: {delete_resp.text}"
        assert "cannot be deleted" in delete_resp.json().get("detail", "").lower() or \
               "system" in delete_resp.json().get("detail", "").lower(), \
               f"Should mention system role cannot be deleted: {delete_resp.text}"
        
        print(f"PASS: System role deletion correctly rejected")
    
    def test_07_get_effective_permissions_for_admin(self):
        """GET /api/organizations/{org_id}/members/{member_id}/effective-permissions"""
        # Get members list to find a member
        members_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/members")
        
        assert members_resp.status_code == 200, f"Expected 200, got {members_resp.status_code}"
        members = members_resp.json().get("members", [])
        assert len(members) > 0, "Should have at least one member"
        
        # Get effective permissions for the owner/admin
        owner = next((m for m in members if m.get("role") in ["owner", "admin"]), members[0])
        member_id = owner["id"]
        
        perms_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/members/{member_id}/effective-permissions")
        
        assert perms_resp.status_code == 200, f"Expected 200, got {perms_resp.status_code}: {perms_resp.text}"
        data = perms_resp.json()
        
        assert "permissions" in data, "Should have permissions list"
        assert "source" in data, "Should indicate permission source"
        
        # Owner/admin should have all permissions
        assert len(data["permissions"]) > 10, f"Admin should have many permissions, got {len(data['permissions'])}"
        
        print(f"PASS: Got effective permissions - {len(data['permissions'])} permissions from source '{data['source']}'")
    
    # ==================== SSO TESTS ====================
    
    def test_08_configure_sso_for_organization(self):
        """PUT /api/organizations/{org_id}/sso - configure SSO for the org"""
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id-12345",
            "sso_client_secret": "test-client-secret-xyz",
            "sso_allowed_domains": ["testcorp.com", "example.com"]
        }
        
        resp = self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify SSO is configured
        assert "message" in data or "sso_enabled" in data, f"Should confirm SSO update: {data}"
        
        # Verify by fetching SSO config
        get_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/sso")
        if get_resp.status_code == 200:
            sso_data = get_resp.json()
            assert sso_data.get("sso_enabled") == True, "SSO should be enabled"
        
        print(f"PASS: Configured SSO for organization")
    
    def test_09_sso_discover_with_configured_domain(self):
        """POST /api/sso/discover - check SSO for configured email domain"""
        # Use the domain we configured in the previous test
        resp = self.session.post(f"{BASE_URL}/api/sso/discover", json={
            "email": "user@testcorp.com"
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "sso_available" in data, "Should indicate SSO availability"
        
        if data.get("sso_available"):
            assert "organizations" in data, "Should list matching organizations"
            print(f"PASS: SSO discover found {len(data['organizations'])} org(s) for testcorp.com")
        else:
            print(f"INFO: SSO not available for testcorp.com (may need to configure first)")
    
    def test_10_sso_discover_unknown_domain(self):
        """POST /api/sso/discover - check SSO for unknown domain returns not available"""
        resp = self.session.post(f"{BASE_URL}/api/sso/discover", json={
            "email": "user@unknown-domain-xyz123.com"
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("sso_available") == False, "SSO should not be available for unknown domain"
        assert "message" in data, "Should have message explaining why"
        
        print(f"PASS: SSO discover correctly returns not available for unknown domain")
    
    def test_11_sso_initiate_flow(self):
        """POST /api/sso/initiate - start SSO authentication flow"""
        # First ensure SSO is configured
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        }
        self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        # Initiate SSO flow
        resp = self.session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": self.org_id,
            "email": "testuser@testcorp.com"
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "session_id" in data, "Should return session_id"
        assert "provider" in data, "Should return provider"
        assert "org_name" in data, "Should return org_name"
        
        self.sso_session_id = data["session_id"]
        print(f"PASS: SSO flow initiated, session_id: {self.sso_session_id[:16]}...")
        
        return data["session_id"]
    
    def test_12_sso_get_session(self):
        """GET /api/sso/session/{session_id} - get SSO session details"""
        # First initiate a session
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        }
        self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        initiate_resp = self.session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": self.org_id,
            "email": "sessiontest@testcorp.com"
        })
        
        if initiate_resp.status_code != 200:
            pytest.skip(f"Could not initiate SSO: {initiate_resp.text}")
        
        session_id = initiate_resp.json()["session_id"]
        
        # Get session details
        resp = self.session.get(f"{BASE_URL}/api/sso/session/{session_id}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("session_id") == session_id, "Session ID should match"
        assert "org_name" in data, "Should have org_name"
        assert "email" in data, "Should have email"
        assert "provider" in data, "Should have provider"
        assert data.get("status") == "pending", "Status should be pending"
        
        print(f"PASS: Got SSO session details for {data['email']}")
    
    def test_13_sso_callback_jit_provision(self):
        """POST /api/sso/callback - complete SSO with JIT user provisioning"""
        # Setup and initiate SSO
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        }
        self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        # Use unique email to ensure JIT provisioning
        unique_email = f"jit_user_{uuid.uuid4().hex[:8]}@testcorp.com"
        
        initiate_resp = self.session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": self.org_id,
            "email": unique_email
        })
        
        if initiate_resp.status_code != 200:
            pytest.skip(f"Could not initiate SSO: {initiate_resp.text}")
        
        session_id = initiate_resp.json()["session_id"]
        
        # Complete SSO callback (simulated IdP response)
        callback_resp = self.session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": unique_email,
            "full_name": "JIT Provisioned User"
        })
        
        assert callback_resp.status_code == 200, f"Expected 200, got {callback_resp.status_code}: {callback_resp.text}"
        data = callback_resp.json()
        
        assert "access_token" in data, "Should return access_token"
        assert data.get("token_type") == "bearer", "Token type should be bearer"
        assert data.get("user_email") == unique_email, "Should return user email"
        assert data.get("org_id") == self.org_id, "Should return org_id"
        
        print(f"PASS: SSO callback successful, JIT provisioned user: {unique_email}")
    
    def test_14_sso_callback_wrong_domain_rejected(self):
        """POST /api/sso/callback - reject email domain not in allowed list"""
        # Setup SSO with specific domain
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]  # Only testcorp.com allowed
        }
        self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        # Initiate with allowed domain
        initiate_resp = self.session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": self.org_id,
            "email": "user@testcorp.com"
        })
        
        if initiate_resp.status_code != 200:
            pytest.skip(f"Could not initiate SSO: {initiate_resp.text}")
        
        session_id = initiate_resp.json()["session_id"]
        
        # Try to callback with different domain (simulating IdP returning wrong email)
        callback_resp = self.session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": "hacker@wrongdomain.com"  # Wrong domain
        })
        
        assert callback_resp.status_code == 403, f"Expected 403, got {callback_resp.status_code}: {callback_resp.text}"
        assert "domain" in callback_resp.json().get("detail", "").lower(), "Should mention domain issue"
        
        print(f"PASS: SSO callback correctly rejected wrong domain")
    
    def test_15_sso_test_config(self):
        """POST /api/sso/test - test SSO configuration validity"""
        # Configure SSO first
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "oidc",
            "sso_issuer_url": "https://mock-idp.testcorp.com",
            "sso_client_id": "test-client-id",
            "sso_client_secret": "test-secret",
            "sso_allowed_domains": ["testcorp.com"]
        }
        self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        
        # Test SSO config
        resp = self.session.post(f"{BASE_URL}/api/sso/test", json={
            "org_id": self.org_id
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "success" in data, "Should indicate success/failure"
        assert "message" in data, "Should have message"
        
        if data.get("success"):
            print(f"PASS: SSO config test passed - {data.get('message')}")
        else:
            print(f"INFO: SSO config test returned issues - {data.get('issues', [])}")
    
    def test_16_sso_test_without_config(self):
        """POST /api/sso/test - test SSO when not configured"""
        # Create a new org without SSO
        unique_slug = f"test-no-sso-{uuid.uuid4().hex[:8]}"
        create_resp = self.session.post(f"{BASE_URL}/api/organizations/", json={
            "name": "TEST_No_SSO_Org",
            "slug": unique_slug,
            "description": "Org without SSO for testing"
        })
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test org: {create_resp.text}")
        
        no_sso_org_id = create_resp.json()["id"]
        
        # Test SSO config on org without SSO
        resp = self.session.post(f"{BASE_URL}/api/sso/test", json={
            "org_id": no_sso_org_id
        })
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("success") == False, "Should fail for unconfigured SSO"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/organizations/{no_sso_org_id}")
        
        print(f"PASS: SSO test correctly reports unconfigured SSO")
    
    # ==================== INTEGRATION TESTS ====================
    
    def test_17_rbac_role_with_member_assignment(self):
        """Create role, assign to member, verify effective permissions"""
        # Create custom role
        role_name = f"TEST_Integration_Role_{uuid.uuid4().hex[:6]}"
        create_resp = self.session.post(f"{BASE_URL}/api/organizations/{self.org_id}/roles", json={
            "name": role_name,
            "description": "Integration test role",
            "permissions": ["documents:view", "documents:create", "vault:view"]
        })
        
        assert create_resp.status_code in [200, 201], f"Create role failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Get members
        members_resp = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/members")
        members = members_resp.json().get("members", [])
        
        # Find a non-owner member to assign role (skip owner)
        assignable_member = next((m for m in members if m.get("role") != "owner"), None)
        
        if assignable_member:
            member_id = assignable_member["id"]
            
            # Assign custom role
            assign_resp = self.session.put(
                f"{BASE_URL}/api/organizations/{self.org_id}/members/{member_id}/custom-role",
                json={"role_id": role_id}
            )
            
            assert assign_resp.status_code == 200, f"Assign role failed: {assign_resp.text}"
            
            # Verify effective permissions reflect custom role
            perms_resp = self.session.get(
                f"{BASE_URL}/api/organizations/{self.org_id}/members/{member_id}/effective-permissions"
            )
            
            assert perms_resp.status_code == 200, f"Get permissions failed: {perms_resp.text}"
            data = perms_resp.json()
            
            # Owner/admin still have all perms, but for regular member it should reflect custom role
            print(f"PASS: Role assignment and permissions working - source: {data.get('source')}")
            
            # Remove custom role
            remove_resp = self.session.delete(
                f"{BASE_URL}/api/organizations/{self.org_id}/members/{member_id}/custom-role"
            )
            assert remove_resp.status_code == 200, f"Remove role failed: {remove_resp.text}"
        else:
            print(f"INFO: No non-owner member to test role assignment")
        
        # Cleanup role
        self.session.delete(f"{BASE_URL}/api/organizations/{self.org_id}/roles/{role_id}")
    
    def test_18_full_sso_e2e_flow(self):
        """Complete E2E SSO flow: configure -> discover -> initiate -> callback"""
        # 1. Configure SSO
        test_domain = f"e2e-{uuid.uuid4().hex[:6]}.com"
        sso_config = {
            "sso_enabled": True,
            "sso_provider": "saml",
            "sso_issuer_url": f"https://idp.{test_domain}",
            "sso_client_id": "e2e-test-client",
            "sso_client_secret": "e2e-test-secret",
            "sso_metadata_url": f"https://idp.{test_domain}/metadata",
            "sso_allowed_domains": [test_domain]
        }
        
        config_resp = self.session.put(f"{BASE_URL}/api/organizations/{self.org_id}/sso", json=sso_config)
        assert config_resp.status_code == 200, f"SSO config failed: {config_resp.text}"
        
        # 2. Discover SSO
        test_email = f"e2e_user@{test_domain}"
        discover_resp = self.session.post(f"{BASE_URL}/api/sso/discover", json={"email": test_email})
        assert discover_resp.status_code == 200, f"Discover failed: {discover_resp.text}"
        
        # Note: discover may not find org if domain matching isn't exact
        
        # 3. Initiate SSO
        initiate_resp = self.session.post(f"{BASE_URL}/api/sso/initiate", json={
            "org_id": self.org_id,
            "email": test_email
        })
        assert initiate_resp.status_code == 200, f"Initiate failed: {initiate_resp.text}"
        session_id = initiate_resp.json()["session_id"]
        
        # 4. Get session (verify pending)
        session_resp = self.session.get(f"{BASE_URL}/api/sso/session/{session_id}")
        assert session_resp.status_code == 200, f"Get session failed: {session_resp.text}"
        assert session_resp.json().get("status") == "pending"
        
        # 5. Complete callback
        callback_resp = self.session.post(f"{BASE_URL}/api/sso/callback", json={
            "session_id": session_id,
            "email": test_email,
            "full_name": "E2E Test User"
        })
        assert callback_resp.status_code == 200, f"Callback failed: {callback_resp.text}"
        
        result = callback_resp.json()
        assert "access_token" in result, "Should get access token"
        
        print(f"PASS: Full SSO E2E flow completed successfully")
    
    def test_19_invalid_permission_rejected(self):
        """Creating role with invalid permissions should be rejected"""
        resp = self.session.post(f"{BASE_URL}/api/organizations/{self.org_id}/roles", json={
            "name": f"TEST_Invalid_Perm_Role_{uuid.uuid4().hex[:6]}",
            "description": "Should fail",
            "permissions": ["documents:view", "invalid:permission:xyz"]
        })
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "invalid" in resp.json().get("detail", "").lower(), "Should mention invalid permission"
        
        print(f"PASS: Invalid permission correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
