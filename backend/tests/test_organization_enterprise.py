"""
Organization Enterprise Features Tests
Tests for multi-tenancy, member management, and SSO configuration.

Endpoints tested:
- POST /api/organizations/ - create new org
- GET /api/organizations/ - list user's organizations
- GET /api/organizations/{org_id} - get org detail
- PUT /api/organizations/{org_id} - update org
- DELETE /api/organizations/{org_id} - delete org
- GET /api/organizations/{org_id}/members - list members
- POST /api/organizations/{org_id}/invite - invite member
- GET /api/organizations/{org_id}/invites - list pending invites
- GET /api/organizations/my/invites - list current user's pending invites
- POST /api/organizations/accept-invite/{token} - accept invite
- PUT /api/organizations/{org_id}/members/{member_id}/role - update role
- DELETE /api/organizations/{org_id}/members/{member_id} - remove member
- DELETE /api/organizations/{org_id}/invites/{invite_id} - cancel invite
- GET /api/organizations/{org_id}/sso - get SSO config
- PUT /api/organizations/{org_id}/sso - update SSO config
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def demo_token():
    """Get authentication token for demo user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Demo user authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin user authentication failed")


@pytest.fixture(scope="module")
def headers(demo_token):
    """Request headers with demo token"""
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Request headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestOrganizationCRUD:
    """Tests for organization CRUD operations"""
    
    created_org_id = None
    created_org_slug = None
    
    def test_create_organization(self, headers):
        """POST /api/organizations/ - create new org"""
        unique_slug = f"test-org-{uuid.uuid4().hex[:8]}"
        TestOrganizationCRUD.created_org_slug = unique_slug
        
        response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={
                "name": "Test Organization",
                "slug": unique_slug,
                "description": "Test description"
            },
            headers=headers
        )
        
        print(f"Create org response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "id" in data, "Response should contain id"
        assert data["name"] == "Test Organization"
        assert data["slug"] == unique_slug
        assert data["description"] == "Test description"
        assert data["member_count"] == 1, "Creator should be first member"
        
        TestOrganizationCRUD.created_org_id = data["id"]
        print(f"Created org ID: {data['id']}")
    
    def test_list_organizations(self, headers):
        """GET /api/organizations/ - list user's organizations"""
        response = requests.get(f"{BASE_URL}/api/organizations/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "organizations" in data
        assert isinstance(data["organizations"], list)
        
        # Should find the created org
        if TestOrganizationCRUD.created_org_id:
            org_ids = [org["id"] for org in data["organizations"]]
            assert TestOrganizationCRUD.created_org_id in org_ids
        
        print(f"User has {len(data['organizations'])} organizations")
    
    def test_get_organization_detail(self, headers):
        """GET /api/organizations/{org_id} - get org detail"""
        if not TestOrganizationCRUD.created_org_id:
            pytest.skip("No org created")
        
        org_id = TestOrganizationCRUD.created_org_id
        response = requests.get(f"{BASE_URL}/api/organizations/{org_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == org_id
        assert data["name"] == "Test Organization"
        assert "my_role" in data
        assert data["my_role"] == "owner", "Creator should be owner"
        
        print(f"Org detail: {data['name']} (role: {data['my_role']})")
    
    def test_update_organization(self, headers):
        """PUT /api/organizations/{org_id} - update org (admin/owner only)"""
        if not TestOrganizationCRUD.created_org_id:
            pytest.skip("No org created")
        
        org_id = TestOrganizationCRUD.created_org_id
        response = requests.put(
            f"{BASE_URL}/api/organizations/{org_id}",
            json={"name": "Updated Organization", "description": "Updated description"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Updated Organization"
        assert data["description"] == "Updated description"
        
        print(f"Org updated successfully")
    
    def test_get_org_not_member_403(self, admin_headers):
        """GET /api/organizations/{org_id} - non-member gets 403"""
        if not TestOrganizationCRUD.created_org_id:
            pytest.skip("No org created")
        
        # Create a new org with demo user that admin is not a member of
        unique_slug = f"private-org-{uuid.uuid4().hex[:8]}"
        
        # First create with demo user token
        demo_response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        demo_token = demo_response.json().get("access_token")
        demo_headers = {"Authorization": f"Bearer {demo_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "Private Org", "slug": unique_slug},
            headers=demo_headers
        )
        
        if create_response.status_code == 200:
            private_org_id = create_response.json()["id"]
            
            # Now try to access with admin user
            response = requests.get(
                f"{BASE_URL}/api/organizations/{private_org_id}",
                headers=admin_headers
            )
            
            print(f"Non-member access response: {response.status_code}")
            assert response.status_code == 403, f"Expected 403 for non-member, got {response.status_code}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/organizations/{private_org_id}", headers=demo_headers)


class TestMemberManagement:
    """Tests for member management operations"""
    
    test_org_id = None
    test_invite_id = None
    test_invite_token = None
    test_member_id = None
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_test_org(self, headers):
        """Create a test org for member management tests"""
        unique_slug = f"member-test-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "Member Test Org", "slug": unique_slug},
            headers=headers
        )
        
        if response.status_code == 200:
            TestMemberManagement.test_org_id = response.json()["id"]
            print(f"Created member test org: {TestMemberManagement.test_org_id}")
        
        yield
        
        # Cleanup
        if TestMemberManagement.test_org_id:
            requests.delete(
                f"{BASE_URL}/api/organizations/{TestMemberManagement.test_org_id}",
                headers=headers
            )
    
    def test_list_members(self, headers):
        """GET /api/organizations/{org_id}/members - list members"""
        if not TestMemberManagement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestMemberManagement.test_org_id
        response = requests.get(f"{BASE_URL}/api/organizations/{org_id}/members", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        assert len(data["members"]) >= 1, "Should have at least owner member"
        
        # Find owner
        owner = [m for m in data["members"] if m["role"] == "owner"]
        assert len(owner) == 1, "Should have exactly one owner"
        
        print(f"Org has {len(data['members'])} members")
    
    def test_invite_member(self, headers):
        """POST /api/organizations/{org_id}/invite - invite member (admin/owner only)"""
        if not TestMemberManagement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestMemberManagement.test_org_id
        response = requests.post(
            f"{BASE_URL}/api/organizations/{org_id}/invite",
            json={"email": "admin@notarychain.com", "role": "admin"},
            headers=headers
        )
        
        print(f"Invite response: {response.status_code}")
        assert response.status_code == 200, f"Failed to invite: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "token" in data
        assert data["email"] == "admin@notarychain.com"
        assert data["role"] == "admin"
        assert data["status"] == "pending"
        
        TestMemberManagement.test_invite_id = data["id"]
        TestMemberManagement.test_invite_token = data["token"]
        
        print(f"Invite created: {data['id']}")
    
    def test_list_pending_invites(self, headers):
        """GET /api/organizations/{org_id}/invites - list pending invites"""
        if not TestMemberManagement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestMemberManagement.test_org_id
        response = requests.get(f"{BASE_URL}/api/organizations/{org_id}/invites", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "invites" in data
        if TestMemberManagement.test_invite_id:
            invite_ids = [inv["id"] for inv in data["invites"]]
            assert TestMemberManagement.test_invite_id in invite_ids
        
        print(f"Found {len(data['invites'])} pending invites")
    
    def test_get_my_invites(self, admin_headers):
        """GET /api/organizations/my/invites - list current user's pending invites"""
        response = requests.get(f"{BASE_URL}/api/organizations/my/invites", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "invites" in data
        print(f"Admin user has {len(data['invites'])} pending invites")
    
    def test_accept_invite(self, admin_headers):
        """POST /api/organizations/accept-invite/{token} - accept invite"""
        if not TestMemberManagement.test_invite_token:
            pytest.skip("No invite token")
        
        token = TestMemberManagement.test_invite_token
        response = requests.post(
            f"{BASE_URL}/api/organizations/accept-invite/{token}",
            json={},
            headers=admin_headers
        )
        
        print(f"Accept invite response: {response.status_code}")
        assert response.status_code == 200, f"Failed to accept: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "org_id" in data
        assert data["org_id"] == TestMemberManagement.test_org_id
        
        print(f"Successfully joined organization")
    
    def test_update_member_role(self, headers):
        """PUT /api/organizations/{org_id}/members/{member_id}/role - update role (owner only)"""
        if not TestMemberManagement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestMemberManagement.test_org_id
        
        # First get members to find the admin member
        members_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/members",
            headers=headers
        )
        
        if members_response.status_code == 200:
            members = members_response.json()["members"]
            # Find admin member (not owner)
            admin_members = [m for m in members if m["role"] == "admin"]
            
            if admin_members:
                member_id = admin_members[0]["id"]
                TestMemberManagement.test_member_id = member_id
                
                # Update role from admin to member
                response = requests.put(
                    f"{BASE_URL}/api/organizations/{org_id}/members/{member_id}/role",
                    json={"role": "member"},
                    headers=headers
                )
                
                print(f"Update role response: {response.status_code}")
                assert response.status_code == 200
                
                # Verify role was updated
                verify_response = requests.get(
                    f"{BASE_URL}/api/organizations/{org_id}/members",
                    headers=headers
                )
                
                if verify_response.status_code == 200:
                    updated_members = verify_response.json()["members"]
                    updated_member = [m for m in updated_members if m["id"] == member_id]
                    if updated_member:
                        assert updated_member[0]["role"] == "member"
                        print(f"Role successfully updated to member")
    
    def test_remove_member(self, headers):
        """DELETE /api/organizations/{org_id}/members/{member_id} - remove member"""
        if not TestMemberManagement.test_org_id or not TestMemberManagement.test_member_id:
            pytest.skip("No test org or member")
        
        org_id = TestMemberManagement.test_org_id
        member_id = TestMemberManagement.test_member_id
        
        response = requests.delete(
            f"{BASE_URL}/api/organizations/{org_id}/members/{member_id}",
            headers=headers
        )
        
        print(f"Remove member response: {response.status_code}")
        assert response.status_code == 200
        
        # Verify member was removed
        verify_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/members",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            members = verify_response.json()["members"]
            member_ids = [m["id"] for m in members]
            assert member_id not in member_ids or any(m["status"] == "removed" for m in members if m["id"] == member_id)
            print(f"Member successfully removed")


class TestInviteOperations:
    """Tests for invite-specific operations"""
    
    test_org_id = None
    test_invite_id = None
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_org_and_invite(self, headers):
        """Create test org and invite for testing"""
        unique_slug = f"invite-test-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "Invite Test Org", "slug": unique_slug},
            headers=headers
        )
        
        if response.status_code == 200:
            TestInviteOperations.test_org_id = response.json()["id"]
            
            # Create an invite
            invite_response = requests.post(
                f"{BASE_URL}/api/organizations/{TestInviteOperations.test_org_id}/invite",
                json={"email": "testcancel@example.com", "role": "member"},
                headers=headers
            )
            
            if invite_response.status_code == 200:
                TestInviteOperations.test_invite_id = invite_response.json()["id"]
        
        yield
        
        # Cleanup
        if TestInviteOperations.test_org_id:
            requests.delete(
                f"{BASE_URL}/api/organizations/{TestInviteOperations.test_org_id}",
                headers=headers
            )
    
    def test_cancel_invite(self, headers):
        """DELETE /api/organizations/{org_id}/invites/{invite_id} - cancel invite"""
        if not TestInviteOperations.test_org_id or not TestInviteOperations.test_invite_id:
            pytest.skip("No test org or invite")
        
        org_id = TestInviteOperations.test_org_id
        invite_id = TestInviteOperations.test_invite_id
        
        response = requests.delete(
            f"{BASE_URL}/api/organizations/{org_id}/invites/{invite_id}",
            headers=headers
        )
        
        print(f"Cancel invite response: {response.status_code}")
        assert response.status_code == 200
        
        # Verify invite was cancelled
        verify_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/invites",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            invites = verify_response.json()["invites"]
            invite_ids = [inv["id"] for inv in invites]
            assert invite_id not in invite_ids
            print(f"Invite successfully cancelled")
    
    def test_invite_duplicate_email_400(self, headers):
        """POST /api/organizations/{org_id}/invite - duplicate email returns 400"""
        if not TestInviteOperations.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestInviteOperations.test_org_id
        
        # First invite
        first_response = requests.post(
            f"{BASE_URL}/api/organizations/{org_id}/invite",
            json={"email": "duplicate@example.com", "role": "member"},
            headers=headers
        )
        
        if first_response.status_code == 200:
            # Second invite to same email should fail
            response = requests.post(
                f"{BASE_URL}/api/organizations/{org_id}/invite",
                json={"email": "duplicate@example.com", "role": "member"},
                headers=headers
            )
            
            print(f"Duplicate invite response: {response.status_code}")
            assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"


class TestSSOConfiguration:
    """Tests for SSO configuration endpoints"""
    
    test_org_id = None
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_sso_test_org(self, headers):
        """Create test org for SSO tests"""
        unique_slug = f"sso-test-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "SSO Test Org", "slug": unique_slug},
            headers=headers
        )
        
        if response.status_code == 200:
            TestSSOConfiguration.test_org_id = response.json()["id"]
        
        yield
        
        # Cleanup
        if TestSSOConfiguration.test_org_id:
            requests.delete(
                f"{BASE_URL}/api/organizations/{TestSSOConfiguration.test_org_id}",
                headers=headers
            )
    
    def test_get_sso_config(self, headers):
        """GET /api/organizations/{org_id}/sso - get SSO config"""
        if not TestSSOConfiguration.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestSSOConfiguration.test_org_id
        response = requests.get(f"{BASE_URL}/api/organizations/{org_id}/sso", headers=headers)
        
        print(f"Get SSO config response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "sso_enabled" in data
        assert "sso_config" in data
        assert data["sso_enabled"] == False, "SSO should be disabled by default"
        
        print(f"SSO config retrieved: enabled={data['sso_enabled']}")
    
    def test_update_sso_config_oidc(self, headers):
        """PUT /api/organizations/{org_id}/sso - update SSO config with OIDC"""
        if not TestSSOConfiguration.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestSSOConfiguration.test_org_id
        response = requests.put(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            json={
                "sso_enabled": True,
                "sso_provider": "oidc",
                "sso_issuer_url": "https://login.example.com",
                "sso_client_id": "test-client-id",
                "sso_client_secret": "test-client-secret-12345",
                "sso_allowed_domains": ["example.com", "test.com"]
            },
            headers=headers
        )
        
        print(f"Update SSO config response: {response.status_code}")
        assert response.status_code == 200
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            assert data["sso_enabled"] == True
            assert data["sso_config"]["sso_provider"] == "oidc"
            assert data["sso_config"]["sso_client_id"] == "test-client-id"
            # Secret should be masked (shows *** + last 4 chars)
            assert "***" in data["sso_config"]["sso_client_secret"]
            assert data["sso_config"]["sso_client_secret"].endswith("2345")
            
            print(f"SSO config updated successfully")
    
    def test_update_sso_config_saml(self, headers):
        """PUT /api/organizations/{org_id}/sso - update SSO config with SAML"""
        if not TestSSOConfiguration.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestSSOConfiguration.test_org_id
        response = requests.put(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            json={
                "sso_enabled": True,
                "sso_provider": "saml",
                "sso_issuer_url": "https://idp.example.com",
                "sso_client_id": "saml-entity-id",
                "sso_metadata_url": "https://idp.example.com/saml/metadata",
                "sso_allowed_domains": ["company.com"]
            },
            headers=headers
        )
        
        print(f"Update SAML config response: {response.status_code}")
        assert response.status_code == 200
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            assert data["sso_config"]["sso_provider"] == "saml"
            assert data["sso_config"]["sso_metadata_url"] == "https://idp.example.com/saml/metadata"
            
            print(f"SAML config updated successfully")
    
    def test_disable_sso(self, headers):
        """PUT /api/organizations/{org_id}/sso - disable SSO"""
        if not TestSSOConfiguration.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestSSOConfiguration.test_org_id
        response = requests.put(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            json={"sso_enabled": False},
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Verify disabled
        verify_response = requests.get(
            f"{BASE_URL}/api/organizations/{org_id}/sso",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            assert data["sso_enabled"] == False
            print(f"SSO disabled successfully")


class TestPermissionEnforcement:
    """Tests for role-based permission enforcement"""
    
    test_org_id = None
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_permission_test_org(self, headers):
        """Create test org for permission tests"""
        unique_slug = f"perm-test-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "Permission Test Org", "slug": unique_slug},
            headers=headers
        )
        
        if response.status_code == 200:
            TestPermissionEnforcement.test_org_id = response.json()["id"]
        
        yield
        
        # Cleanup
        if TestPermissionEnforcement.test_org_id:
            requests.delete(
                f"{BASE_URL}/api/organizations/{TestPermissionEnforcement.test_org_id}",
                headers=headers
            )
    
    def test_non_owner_cannot_update_sso(self, headers, admin_headers):
        """PUT /api/organizations/{org_id}/sso - non-owner gets 403"""
        if not TestPermissionEnforcement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestPermissionEnforcement.test_org_id
        
        # First invite admin as admin (not owner)
        invite_response = requests.post(
            f"{BASE_URL}/api/organizations/{org_id}/invite",
            json={"email": "admin@notarychain.com", "role": "admin"},
            headers=headers
        )
        
        if invite_response.status_code == 200:
            # Accept invite as admin
            token = invite_response.json()["token"]
            accept_response = requests.post(
                f"{BASE_URL}/api/organizations/accept-invite/{token}",
                json={},
                headers=admin_headers
            )
            
            if accept_response.status_code == 200:
                # Try to update SSO as admin (should fail - owner only)
                sso_response = requests.put(
                    f"{BASE_URL}/api/organizations/{org_id}/sso",
                    json={"sso_enabled": True},
                    headers=admin_headers
                )
                
                print(f"Admin SSO update response: {sso_response.status_code}")
                assert sso_response.status_code == 403, f"Expected 403 for non-owner, got {sso_response.status_code}"
    
    def test_invalid_invite_token_404(self, admin_headers):
        """POST /api/organizations/accept-invite/{token} - invalid token returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/accept-invite/invalid-token-12345",
            json={},
            headers=admin_headers
        )
        
        print(f"Invalid token response: {response.status_code}")
        assert response.status_code == 404
    
    def test_invite_owner_role_400(self, headers):
        """POST /api/organizations/{org_id}/invite - owner role returns 400"""
        if not TestPermissionEnforcement.test_org_id:
            pytest.skip("No test org")
        
        org_id = TestPermissionEnforcement.test_org_id
        response = requests.post(
            f"{BASE_URL}/api/organizations/{org_id}/invite",
            json={"email": "newowner@example.com", "role": "owner"},
            headers=headers
        )
        
        print(f"Invite as owner response: {response.status_code}")
        assert response.status_code == 400, f"Expected 400 for owner role, got {response.status_code}"


class TestOrganizationDelete:
    """Tests for organization deletion"""
    
    def test_delete_organization_owner_only(self, headers):
        """DELETE /api/organizations/{org_id} - owner only can delete"""
        # Create a fresh org
        unique_slug = f"delete-test-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "Delete Test Org", "slug": unique_slug},
            headers=headers
        )
        
        if create_response.status_code == 200:
            org_id = create_response.json()["id"]
            
            # Delete as owner
            response = requests.delete(
                f"{BASE_URL}/api/organizations/{org_id}",
                headers=headers
            )
            
            print(f"Delete org response: {response.status_code}")
            assert response.status_code == 200
            
            # Verify deleted
            verify_response = requests.get(
                f"{BASE_URL}/api/organizations/{org_id}",
                headers=headers
            )
            
            assert verify_response.status_code in [403, 404], "Org should be deleted"
            print(f"Organization successfully deleted")
    
    def test_slug_duplicate_400(self, headers):
        """POST /api/organizations/ - duplicate slug returns 400"""
        unique_slug = f"dup-slug-{uuid.uuid4().hex[:8]}"
        
        # Create first org
        first_response = requests.post(
            f"{BASE_URL}/api/organizations/",
            json={"name": "First Org", "slug": unique_slug},
            headers=headers
        )
        
        if first_response.status_code == 200:
            first_org_id = first_response.json()["id"]
            
            # Try to create second org with same slug
            response = requests.post(
                f"{BASE_URL}/api/organizations/",
                json={"name": "Second Org", "slug": unique_slug},
                headers=headers
            )
            
            print(f"Duplicate slug response: {response.status_code}")
            assert response.status_code == 400, f"Expected 400 for duplicate slug, got {response.status_code}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/organizations/{first_org_id}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
