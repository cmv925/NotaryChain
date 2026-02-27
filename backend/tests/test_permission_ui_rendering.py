"""
Test Permission-based UI Rendering for NotaryChain
Tests the GET /api/organizations/{org_id}/my-permissions endpoint
and validates permission-based tab filtering logic.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected permissions for different roles
ALL_PERMISSIONS = [
    "documents:view", "documents:create", "documents:edit", "documents:delete", "documents:seal",
    "vault:view", "vault:upload", "vault:delete",
    "members:view", "members:invite", "members:remove", "members:manage_roles",
    "templates:view", "templates:create", "templates:delete",
    "approvals:view", "approvals:manage",
    "notarization:request", "notarization:review",
    "org:settings", "org:sso", "org:billing", "org:branding"
]

DEFAULT_MEMBER_PERMISSIONS = ["documents:view", "vault:view", "members:view", "templates:view"]


class TestMyPermissionsEndpoint:
    """Tests for GET /api/organizations/{org_id}/my-permissions endpoint"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.demo_email = "demo@test.com"
        self.demo_password = "Demo123!"
        
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get admin's organizations
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        # Find org where admin is owner
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0, "Admin should own at least one organization"
        self.test_org_id = owner_orgs[0]["id"]

    def test_owner_gets_all_permissions(self):
        """Owner should receive all 23 permissions with source='owner'"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Validate response structure
        assert "permissions" in data
        assert "base_role" in data
        assert "custom_role" in data
        assert "source" in data
        
        # Owner should have all permissions
        assert data["base_role"] == "owner"
        assert data["source"] == "owner"
        assert data["custom_role"] is None
        assert len(data["permissions"]) == len(ALL_PERMISSIONS), f"Owner should have all {len(ALL_PERMISSIONS)} permissions"
        
        # Check all expected permissions exist
        for perm in ALL_PERMISSIONS:
            assert perm in data["permissions"], f"Owner missing permission: {perm}"

    def test_permissions_response_structure(self):
        """Validate the structure of my-permissions response"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # All required fields must exist
        required_fields = ["permissions", "base_role", "custom_role", "source"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # permissions must be a list
        assert isinstance(data["permissions"], list)
        
        # base_role must be a valid role
        assert data["base_role"] in ["owner", "admin", "member"]
        
        # source should be a string
        assert isinstance(data["source"], str)
        assert len(data["source"]) > 0

    def test_non_member_cannot_access_permissions(self):
        """User not part of org should get 403 error"""
        # Login as demo user
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.demo_email,
            "password": self.demo_password
        })
        assert login_res.status_code == 200
        demo_token = login_res.json()["access_token"]
        demo_headers = {"Authorization": f"Bearer {demo_token}"}
        
        # First check if demo is NOT a member of admin's org
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=demo_headers)
        demo_org_ids = [o["id"] for o in orgs_res.json()["organizations"]]
        
        if self.test_org_id not in demo_org_ids:
            # Demo is not a member, should get 403
            res = requests.get(
                f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
                headers=demo_headers
            )
            assert res.status_code == 403
            assert "Not a member" in res.json()["detail"]

    def test_invalid_org_id_returns_error(self):
        """Invalid organization ID should return appropriate error"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/invalid-org-id/my-permissions",
            headers=self.admin_headers
        )
        # Should return 403 (not a member) or similar error
        assert res.status_code in [403, 404]


class TestMemberPermissions:
    """Tests for member permissions when added to an organization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Create test org, invite and accept as member"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get existing test org
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0
        self.test_org_id = owner_orgs[0]["id"]

    def test_member_effective_permissions_default(self):
        """Test effective-permissions endpoint for members without custom role"""
        # Get members list
        members_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/members",
            headers=self.admin_headers
        )
        assert members_res.status_code == 200
        members = members_res.json()["members"]
        
        # Find a member that's not owner
        member = next((m for m in members if m["role"] == "member"), None)
        if member:
            # Get effective permissions for this member
            res = requests.get(
                f"{BASE_URL}/api/organizations/{self.test_org_id}/members/{member['id']}/effective-permissions",
                headers=self.admin_headers
            )
            assert res.status_code == 200
            data = res.json()
            
            # Member without custom role should have default permissions
            if not member.get("custom_role_id"):
                assert data["source"] == "default_member"
                assert set(data["permissions"]) == set(DEFAULT_MEMBER_PERMISSIONS)

    def test_owner_effective_permissions(self):
        """Owner should have all permissions via effective-permissions endpoint"""
        # Get members list
        members_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/members",
            headers=self.admin_headers
        )
        assert members_res.status_code == 200
        members = members_res.json()["members"]
        
        # Find owner
        owner = next((m for m in members if m["role"] == "owner"), None)
        assert owner is not None, "Should have an owner in the org"
        
        # Get effective permissions for owner
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/members/{owner['id']}/effective-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        assert data["source"] == "owner"
        assert len(data["permissions"]) == len(ALL_PERMISSIONS)


class TestCustomRolePermissions:
    """Tests for custom role permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get existing test org
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0
        self.test_org_id = owner_orgs[0]["id"]

    def test_create_custom_role_and_verify_permissions(self):
        """Create a custom role with specific permissions and verify via effective-permissions"""
        unique_id = str(uuid.uuid4())[:8]
        role_name = f"TEST_Permission_Role_{unique_id}"
        custom_permissions = ["documents:view", "documents:create", "vault:view", "vault:upload"]
        
        # Create custom role
        create_res = requests.post(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/roles",
            headers=self.admin_headers,
            json={
                "name": role_name,
                "description": "Test role for permission UI testing",
                "permissions": custom_permissions
            }
        )
        assert create_res.status_code == 200
        role = create_res.json()
        role_id = role["id"]
        
        try:
            # Verify role has correct permissions
            assert set(role["permissions"]) == set(custom_permissions)
            
            # Get members to assign role
            members_res = requests.get(
                f"{BASE_URL}/api/organizations/{self.test_org_id}/members",
                headers=self.admin_headers
            )
            members = members_res.json()["members"]
            
            # Find a member (not owner) to assign role
            member = next((m for m in members if m["role"] == "member"), None)
            if member:
                # Assign custom role
                assign_res = requests.put(
                    f"{BASE_URL}/api/organizations/{self.test_org_id}/members/{member['id']}/custom-role",
                    headers=self.admin_headers,
                    json={"role_id": role_id}
                )
                assert assign_res.status_code == 200
                
                # Verify effective permissions
                perm_res = requests.get(
                    f"{BASE_URL}/api/organizations/{self.test_org_id}/members/{member['id']}/effective-permissions",
                    headers=self.admin_headers
                )
                assert perm_res.status_code == 200
                perm_data = perm_res.json()
                
                assert perm_data["source"] == role_name
                assert set(perm_data["permissions"]) == set(custom_permissions)
                
                # Remove custom role to cleanup
                requests.delete(
                    f"{BASE_URL}/api/organizations/{self.test_org_id}/members/{member['id']}/custom-role",
                    headers=self.admin_headers
                )
        finally:
            # Cleanup: delete the test role
            requests.delete(
                f"{BASE_URL}/api/organizations/{self.test_org_id}/roles/{role_id}",
                headers=self.admin_headers
            )

    def test_system_roles_have_correct_permissions(self):
        """Verify system roles (Organization Admin, Editor, Viewer) have correct permissions"""
        # Get all roles
        roles_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/roles",
            headers=self.admin_headers
        )
        assert roles_res.status_code == 200
        roles = roles_res.json()["roles"]
        
        system_roles = [r for r in roles if r.get("is_system")]
        assert len(system_roles) >= 3, "Should have at least 3 system roles"
        
        # Check Organization Admin role has all permissions
        admin_role = next((r for r in system_roles if r.get("system_key") == "org_admin"), None)
        assert admin_role is not None
        assert len(admin_role["permissions"]) == len(ALL_PERMISSIONS)
        
        # Check Viewer role has only view permissions
        viewer_role = next((r for r in system_roles if r.get("system_key") == "viewer"), None)
        assert viewer_role is not None
        assert "documents:view" in viewer_role["permissions"]
        assert "documents:create" not in viewer_role["permissions"]


class TestPermissionBasedTabFiltering:
    """Tests that validate the tab filtering logic based on permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0
        self.test_org_id = owner_orgs[0]["id"]

    def test_owner_should_see_all_tabs(self):
        """Owner should have permissions for all 6 tabs"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        perms = data["permissions"]
        
        # Tab permission mappings from OrganizationPage.jsx
        TAB_PERMISSIONS = {
            "members": "members:view",
            "roles": "members:manage_roles",
            "vault": "vault:view",
            "invites": "members:invite",
            "sso": "org:sso",
            "settings": "org:settings",
        }
        
        # Owner should have all tab permissions
        for tab_name, required_perm in TAB_PERMISSIONS.items():
            assert required_perm in perms, f"Owner missing permission for {tab_name} tab: {required_perm}"

    def test_default_member_tab_visibility(self):
        """Default member (no custom role) should only see limited tabs"""
        # Default member permissions
        default_perms = DEFAULT_MEMBER_PERMISSIONS
        
        # Tab permission mappings
        TAB_PERMISSIONS = {
            "members": "members:view",
            "roles": "members:manage_roles",
            "vault": "vault:view",
            "invites": "members:invite",
            "sso": "org:sso",
            "settings": "org:settings",
        }
        
        # Simulate tab filtering
        visible_tabs = [tab for tab, perm in TAB_PERMISSIONS.items() if perm in default_perms]
        
        # Default member should see: members, vault
        assert "members" in visible_tabs
        assert "vault" in visible_tabs
        # Default member should NOT see: roles, invites, sso, settings
        assert "roles" not in visible_tabs
        assert "invites" not in visible_tabs
        assert "sso" not in visible_tabs
        assert "settings" not in visible_tabs


class TestPermissionGatedActions:
    """Tests for permission-gated action buttons"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0
        self.test_org_id = owner_orgs[0]["id"]

    def test_invite_action_requires_permission(self):
        """Invite button should require members:invite permission"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Owner should have members:invite
        assert "members:invite" in data["permissions"]
        
        # Verify invite endpoint also requires membership
        # Try to invite - should work for owner
        invite_res = requests.post(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/invite",
            headers=self.admin_headers,
            json={"email": f"test_perm_check_{uuid.uuid4().hex[:8]}@test.com", "role": "member"}
        )
        assert invite_res.status_code == 200

    def test_remove_member_requires_permission(self):
        """Remove member action requires members:remove permission"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Owner should have members:remove
        assert "members:remove" in data["permissions"]

    def test_vault_upload_requires_permission(self):
        """Vault upload button requires vault:upload permission"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Owner should have vault:upload
        assert "vault:upload" in data["permissions"]

    def test_delete_org_requires_settings_permission(self):
        """Delete org button requires org:settings permission"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Owner should have org:settings
        assert "org:settings" in data["permissions"]


class TestE2EOwnerFullAccess:
    """E2E: Owner sees all tabs and all actions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_res.status_code == 200
        self.admin_token = login_res.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=self.admin_headers)
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()["organizations"]
        owner_orgs = [o for o in orgs if o["my_role"] == "owner"]
        assert len(owner_orgs) > 0
        self.test_org_id = owner_orgs[0]["id"]

    def test_owner_complete_permissions_check(self):
        """Comprehensive check that owner has full access"""
        res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/my-permissions",
            headers=self.admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        
        # Owner assertions
        assert data["base_role"] == "owner"
        assert data["source"] == "owner"
        assert data["custom_role"] is None
        
        # All 23 permissions
        assert len(data["permissions"]) == 23
        
        # Key permissions for UI gating
        key_perms = [
            "members:invite",
            "members:remove", 
            "members:manage_roles",
            "vault:upload",
            "vault:delete",
            "org:settings",
            "org:sso",
        ]
        for perm in key_perms:
            assert perm in data["permissions"], f"Owner missing key permission: {perm}"

    def test_owner_can_access_all_tabs_data(self):
        """Owner can access data for all tabs"""
        # Members tab
        members_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/members",
            headers=self.admin_headers
        )
        assert members_res.status_code == 200
        
        # Roles tab
        roles_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/roles",
            headers=self.admin_headers
        )
        assert roles_res.status_code == 200
        
        # Invites tab
        invites_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/invites",
            headers=self.admin_headers
        )
        assert invites_res.status_code == 200
        
        # SSO tab
        sso_res = requests.get(
            f"{BASE_URL}/api/organizations/{self.test_org_id}/sso",
            headers=self.admin_headers
        )
        assert sso_res.status_code == 200
        
        # Vault tab
        vault_res = requests.get(
            f"{BASE_URL}/api/vault/{self.test_org_id}/documents",
            headers=self.admin_headers
        )
        assert vault_res.status_code == 200


# Run tests with: pytest test_permission_ui_rendering.py -v
