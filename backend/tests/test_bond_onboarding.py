"""
Test Suite for On-Chain Bond Management and Role-Specific Onboarding Tour
Tests:
1. GET /api/anan/bond/status — returns on_chain section with enabled, bond_topic_id, network
2. GET /api/anan/bond/ledger — returns on-chain bond events (admin/notary only, 403 for regular users)
3. GET /api/anan/bond/verify — verifies bond state (admin/notary only, 403 for regular users)
4. Non-admin users get 403 on /api/anan/bond/ledger and /api/anan/bond/verify
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASSWORD = "Test123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


class TestBondManagement:
    """Tests for on-chain bond management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def notary_token(self):
        """Get notary authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": NOTARY_EMAIL,
            "password": NOTARY_PASSWORD
        })
        assert response.status_code == 200, f"Notary login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    # ─── Bond Status Tests ───
    
    def test_bond_status_returns_on_chain_section(self, admin_token):
        """GET /api/anan/bond/status returns on_chain section with enabled, bond_topic_id, network"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Bond status failed: {response.text}"
        
        data = response.json()
        
        # Verify on_chain section exists
        assert "on_chain" in data, "Response missing 'on_chain' section"
        on_chain = data["on_chain"]
        
        # Verify on_chain has required fields
        assert "enabled" in on_chain, "on_chain missing 'enabled' field"
        assert "bond_topic_id" in on_chain, "on_chain missing 'bond_topic_id' field"
        assert "network" in on_chain, "on_chain missing 'network' field"
        
        # Verify types
        assert isinstance(on_chain["enabled"], bool), "enabled should be boolean"
        
        # Verify network is mainnet (as per context)
        if on_chain["network"]:
            assert on_chain["network"] == "mainnet", f"Expected mainnet, got {on_chain['network']}"
        
        print(f"Bond status on_chain: enabled={on_chain['enabled']}, topic={on_chain['bond_topic_id']}, network={on_chain['network']}")
    
    def test_bond_status_has_balance_and_health(self, admin_token):
        """Bond status includes balance, health, and health_pct"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify core bond fields
        assert "balance" in data, "Missing balance field"
        assert "health" in data, "Missing health field"
        assert "health_pct" in data, "Missing health_pct field"
        assert "initial_balance" in data, "Missing initial_balance field"
        assert "min_threshold" in data, "Missing min_threshold field"
        
        # Verify health is one of expected values
        assert data["health"] in ["healthy", "warning", "depleted"], f"Unexpected health: {data['health']}"
        
        print(f"Bond balance: ${data['balance']:,}, health: {data['health']} ({data['health_pct']}%)")
    
    def test_bond_status_accessible_by_notary(self, notary_token):
        """Notary can access bond status"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/status",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200, f"Notary bond status failed: {response.text}"
        
        data = response.json()
        assert "on_chain" in data
        print("Notary can access bond status: PASS")
    
    def test_bond_status_accessible_by_regular_user(self, user_token):
        """Regular user can access bond status (read-only)"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"User bond status failed: {response.text}"
        
        data = response.json()
        assert "on_chain" in data
        print("Regular user can access bond status: PASS")
    
    # ─── Bond Ledger Tests ───
    
    def test_bond_ledger_admin_access(self, admin_token):
        """Admin can access bond ledger"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/ledger",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin bond ledger failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "success" in data, "Missing success field"
        assert "events" in data, "Missing events field"
        assert "topic_id" in data, "Missing topic_id field"
        assert "network" in data, "Missing network field"
        
        # Events should be a list
        assert isinstance(data["events"], list), "events should be a list"
        
        print(f"Bond ledger: {data['total']} events on topic {data['topic_id']}")
    
    def test_bond_ledger_notary_access(self, notary_token):
        """Notary can access bond ledger"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/ledger",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200, f"Notary bond ledger failed: {response.text}"
        
        data = response.json()
        assert "events" in data
        print("Notary can access bond ledger: PASS")
    
    def test_bond_ledger_regular_user_forbidden(self, user_token):
        """Regular user gets 403 on bond ledger"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/ledger",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for regular user, got {response.status_code}"
        print("Regular user gets 403 on bond ledger: PASS")
    
    # ─── Bond Verify Tests ───
    
    def test_bond_verify_admin_access(self, admin_token):
        """Admin can verify bond state"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/verify",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin bond verify failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "verified" in data or "reason" in data, "Missing verified or reason field"
        assert "db_balance" in data, "Missing db_balance field"
        assert "topic_id" in data, "Missing topic_id field"
        
        print(f"Bond verify: verified={data.get('verified')}, db_balance=${data.get('db_balance'):,}")
    
    def test_bond_verify_notary_access(self, notary_token):
        """Notary can verify bond state"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/verify",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200, f"Notary bond verify failed: {response.text}"
        
        data = response.json()
        assert "db_balance" in data
        print("Notary can verify bond state: PASS")
    
    def test_bond_verify_regular_user_forbidden(self, user_token):
        """Regular user gets 403 on bond verify"""
        response = requests.get(
            f"{BASE_URL}/api/anan/bond/verify",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for regular user, got {response.status_code}"
        print("Regular user gets 403 on bond verify: PASS")
    
    # ─── Unauthenticated Access Tests ───
    
    def test_bond_status_requires_auth(self):
        """Bond status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/bond/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Bond status requires auth: PASS")
    
    def test_bond_ledger_requires_auth(self):
        """Bond ledger requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/bond/ledger")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Bond ledger requires auth: PASS")
    
    def test_bond_verify_requires_auth(self):
        """Bond verify requires authentication"""
        response = requests.get(f"{BASE_URL}/api/anan/bond/verify")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Bond verify requires auth: PASS")


class TestUserRoles:
    """Tests to verify user roles are correctly returned"""
    
    def test_admin_role_returned(self):
        """Admin user has role='admin'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        data = me_response.json()
        assert data.get("role") == "admin", f"Expected role='admin', got {data.get('role')}"
        print("Admin role verified: PASS")
    
    def test_notary_role_returned(self):
        """Notary user has role='notary'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": NOTARY_EMAIL,
            "password": NOTARY_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        data = me_response.json()
        assert data.get("role") == "notary", f"Expected role='notary', got {data.get('role')}"
        print("Notary role verified: PASS")
    
    def test_regular_user_no_special_role(self):
        """Regular user has no special role or role='user'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        data = me_response.json()
        # Regular user should have no role or role='user'
        role = data.get("role")
        assert role is None or role == "user" or role == "", f"Expected no role or 'user', got {role}"
        print(f"Regular user role verified: {role or 'None'}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
