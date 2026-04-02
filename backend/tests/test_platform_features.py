"""
Platform Features Tests - Iteration 80
Tests for: Public Audit Trail, Multi-Signature Ceremonies, Certificate Expiration & Renewal,
Ceremony Replay, Document Versioning
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def user_token(api_client):
    """Get regular user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("User authentication failed")


@pytest.fixture(scope="module")
def user_ceremony_id(api_client, user_token):
    """Create a ceremony for testing - owned by the user"""
    # Create a new ceremony for testing
    create_resp = api_client.post(
        f"{BASE_URL}/api/ceremony/start",
        json={
            "document_name": "TEST_CeremonyForPlatformFeatures",
            "signer_name": "Test Signer",
            "document_type": "contract"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if create_resp.status_code == 200:
        ceremony_id = create_resp.json().get("ceremony_id")
        print(f"Created test ceremony: {ceremony_id}")
        return ceremony_id
    print(f"Failed to create ceremony: {create_resp.status_code} - {create_resp.text}")
    return None


class TestPublicAuditTrail:
    """Tests for Public Audit Trail Explorer - NO AUTH REQUIRED"""

    def test_audit_trail_public_access(self, api_client):
        """Test that audit trail is accessible without authentication"""
        response = api_client.get(f"{BASE_URL}/api/platform/audit-trail")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Public audit trail accessible without auth")

    def test_audit_trail_returns_platform_stats(self, api_client):
        """Test that audit trail returns platform statistics"""
        response = api_client.get(f"{BASE_URL}/api/platform/audit-trail")
        assert response.status_code == 200
        data = response.json()
        
        # Verify platform_stats structure
        assert "platform_stats" in data, "Missing platform_stats"
        stats = data["platform_stats"]
        assert "total_notarizations" in stats
        assert "blockchain_seals" in stats
        assert "registered_users" in stats
        assert "approval_rate" in stats
        assert "platform_uptime" in stats
        print(f"PASS: Platform stats returned - {stats['total_notarizations']} notarizations, {stats['registered_users']} users")

    def test_audit_trail_returns_recent_seals(self, api_client):
        """Test that audit trail returns recent blockchain seals"""
        response = api_client.get(f"{BASE_URL}/api/platform/audit-trail")
        assert response.status_code == 200
        data = response.json()
        
        assert "recent_seals" in data, "Missing recent_seals"
        assert isinstance(data["recent_seals"], list)
        print(f"PASS: Recent seals returned - {len(data['recent_seals'])} seals")

    def test_audit_trail_returns_daily_volume(self, api_client):
        """Test that audit trail returns daily volume data"""
        response = api_client.get(f"{BASE_URL}/api/platform/audit-trail")
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_volume" in data, "Missing daily_volume"
        assert isinstance(data["daily_volume"], list)
        assert len(data["daily_volume"]) == 14, "Expected 14 days of volume data"
        
        # Verify volume structure
        if data["daily_volume"]:
            vol = data["daily_volume"][0]
            assert "date" in vol
            assert "count" in vol
        print(f"PASS: Daily volume returned - {len(data['daily_volume'])} days")

    def test_audit_trail_returns_last_updated(self, api_client):
        """Test that audit trail returns last_updated timestamp"""
        response = api_client.get(f"{BASE_URL}/api/platform/audit-trail")
        assert response.status_code == 200
        data = response.json()
        
        assert "last_updated" in data, "Missing last_updated"
        print(f"PASS: Last updated timestamp: {data['last_updated']}")


class TestMultiSignatureCeremonies:
    """Tests for Multi-Signature Ceremonies - 2+ signers"""

    def test_multi_sig_start_requires_auth(self, api_client):
        """Test that starting multi-sig requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/platform/multi-sig/start", json={
            "document_name": "Test Doc",
            "signers": [{"name": "Signer 1"}, {"name": "Signer 2"}]
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Multi-sig start requires auth")

    def test_multi_sig_start_success(self, api_client, user_token):
        """Test creating a multi-sig ceremony with 2+ signers"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/start",
            json={
                "document_name": f"TEST_MultiSig_{unique_id}",
                "signers": [
                    {"name": "Alice Smith", "email": "alice@test.com"},
                    {"name": "Bob Jones", "email": "bob@test.com"},
                    {"name": "Carol White", "email": "carol@test.com"}
                ]
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "ceremony_id" in data
        assert data["total_signers"] == 3
        assert data["status"] == "awaiting_signatures"
        assert len(data["signers"]) == 3
        print(f"PASS: Multi-sig ceremony created with {data['total_signers']} signers")
        return data["ceremony_id"], data["signers"]

    def test_multi_sig_requires_minimum_2_signers(self, api_client, user_token):
        """Test that multi-sig requires at least 2 signers"""
        response = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/start",
            json={
                "document_name": "Test Doc",
                "signers": [{"name": "Only One"}]
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 422, f"Expected 422 for <2 signers, got {response.status_code}"
        print("PASS: Multi-sig requires minimum 2 signers")

    def test_multi_sig_list_ceremonies(self, api_client, user_token):
        """Test listing user's multi-sig ceremonies"""
        response = api_client.get(
            f"{BASE_URL}/api/platform/multi-sig",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "ceremonies" in data
        assert "total" in data
        assert isinstance(data["ceremonies"], list)
        print(f"PASS: Listed {data['total']} multi-sig ceremonies")

    def test_multi_sig_sign_flow(self, api_client, user_token):
        """Test the full multi-sig signing flow"""
        # Create ceremony
        unique_id = str(uuid.uuid4())[:8]
        create_resp = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/start",
            json={
                "document_name": f"TEST_SignFlow_{unique_id}",
                "signers": [
                    {"name": "Signer A", "email": "a@test.com"},
                    {"name": "Signer B", "email": "b@test.com"}
                ]
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        signers = create_resp.json()["signers"]
        
        # Sign as first signer
        signer1_id = signers[0]["signer_id"]
        sign_resp = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/{ceremony_id}/sign/{signer1_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert sign_resp.status_code == 200
        sign_data = sign_resp.json()
        assert sign_data["signed"] == True
        assert sign_data["completed_signers"] == 1
        assert sign_data["all_signed"] == False
        print("PASS: First signer completed")
        
        # Sign as second signer
        signer2_id = signers[1]["signer_id"]
        sign_resp2 = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/{ceremony_id}/sign/{signer2_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert sign_resp2.status_code == 200
        sign_data2 = sign_resp2.json()
        assert sign_data2["completed_signers"] == 2
        assert sign_data2["all_signed"] == True
        assert sign_data2["status"] == "all_signed"
        print("PASS: All signers completed - ceremony complete")

    def test_multi_sig_get_ceremony_details(self, api_client, user_token):
        """Test getting multi-sig ceremony details"""
        # First create a ceremony
        unique_id = str(uuid.uuid4())[:8]
        create_resp = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/start",
            json={
                "document_name": f"TEST_Details_{unique_id}",
                "signers": [
                    {"name": "Test1", "email": "t1@test.com"},
                    {"name": "Test2", "email": "t2@test.com"}
                ]
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Get details
        response = api_client.get(
            f"{BASE_URL}/api/platform/multi-sig/{ceremony_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["ceremony_id"] == ceremony_id
        assert "signers" in data
        assert "status" in data
        print(f"PASS: Got ceremony details - status: {data['status']}")

    def test_multi_sig_double_sign_prevented(self, api_client, user_token):
        """Test that double signing is prevented"""
        # Create ceremony
        unique_id = str(uuid.uuid4())[:8]
        create_resp = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/start",
            json={
                "document_name": f"TEST_DoubleSig_{unique_id}",
                "signers": [
                    {"name": "Signer X", "email": "x@test.com"},
                    {"name": "Signer Y", "email": "y@test.com"}
                ]
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        ceremony_id = create_resp.json()["ceremony_id"]
        signer_id = create_resp.json()["signers"][0]["signer_id"]
        
        # Sign once
        api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/{ceremony_id}/sign/{signer_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Try to sign again
        response = api_client.post(
            f"{BASE_URL}/api/platform/multi-sig/{ceremony_id}/sign/{signer_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for double sign, got {response.status_code}"
        print("PASS: Double signing prevented")


class TestCertificateExpiration:
    """Tests for Certificate Expiration & Renewal"""

    def test_set_expiration_requires_auth(self, api_client):
        """Test that setting expiration requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/platform/certificate/test-id/set-expiration",
            json={"validity_days": 365}
        )
        assert response.status_code == 401
        print("PASS: Set expiration requires auth")

    def test_set_expiration_success(self, api_client, user_token, user_ceremony_id):
        """Test setting certificate expiration"""
        if not user_ceremony_id:
            pytest.skip("No ceremony available for testing")
        
        response = api_client.post(
            f"{BASE_URL}/api/platform/certificate/{user_ceremony_id}/set-expiration",
            json={"validity_days": 365},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["ceremony_id"] == user_ceremony_id
        assert data["validity_days"] == 365
        assert "expires_at" in data
        assert data["status"] == "active"
        print(f"PASS: Expiration set - expires at {data['expires_at']}")

    def test_get_expiring_certificates(self, api_client, user_token):
        """Test getting expiring certificates"""
        response = api_client.get(
            f"{BASE_URL}/api/platform/certificates/expiring?days_ahead=365",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "expiring_certificates" in data
        assert "total" in data
        assert isinstance(data["expiring_certificates"], list)
        print(f"PASS: Got {data['total']} expiring certificates")

    def test_renew_certificate(self, api_client, user_token, user_ceremony_id):
        """Test renewing a certificate"""
        if not user_ceremony_id:
            pytest.skip("No ceremony available for testing")
        
        # First set expiration
        api_client.post(
            f"{BASE_URL}/api/platform/certificate/{user_ceremony_id}/set-expiration",
            json={"validity_days": 30},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Then renew
        response = api_client.post(
            f"{BASE_URL}/api/platform/certificate/{user_ceremony_id}/renew",
            json={"validity_days": 365},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["renewed"] == True
        assert data["validity_days"] == 365
        assert "new_expires_at" in data
        print(f"PASS: Certificate renewed - new expiry: {data['new_expires_at']}")

    def test_expiration_validity_bounds(self, api_client, user_token, user_ceremony_id):
        """Test that validity days must be within bounds (30-3650)"""
        if not user_ceremony_id:
            pytest.skip("No ceremony available for testing")
        
        # Test too short
        response = api_client.post(
            f"{BASE_URL}/api/platform/certificate/{user_ceremony_id}/set-expiration",
            json={"validity_days": 10},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 422, f"Expected 422 for validity < 30, got {response.status_code}"
        print("PASS: Validity bounds enforced")


class TestCeremonyReplay:
    """Tests for Ceremony Replay - Animated Timeline"""

    def test_ceremony_replay_requires_auth(self, api_client):
        """Test that ceremony replay requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/platform/ceremony-replay/test-id")
        assert response.status_code == 401
        print("PASS: Ceremony replay requires auth")

    def test_ceremony_replay_success(self, api_client, user_token, user_ceremony_id):
        """Test getting ceremony replay timeline"""
        if not user_ceremony_id:
            pytest.skip("No ceremony available for testing")
        
        response = api_client.get(
            f"{BASE_URL}/api/platform/ceremony-replay/{user_ceremony_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["ceremony_id"] == user_ceremony_id
        assert "document_name" in data
        assert "steps" in data
        assert isinstance(data["steps"], list)
        assert len(data["steps"]) > 0, "Expected at least one step"
        
        # Verify step structure
        step = data["steps"][0]
        assert "step" in step
        assert "phase" in step
        assert "title" in step
        assert "status" in step
        print(f"PASS: Ceremony replay returned {len(data['steps'])} steps")

    def test_ceremony_replay_not_found(self, api_client, user_token):
        """Test ceremony replay with invalid ID"""
        response = api_client.get(
            f"{BASE_URL}/api/platform/ceremony-replay/invalid-ceremony-id",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 404
        print("PASS: Ceremony replay returns 404 for invalid ID")


class TestDocumentVersioning:
    """Tests for Document Versioning"""

    def test_document_versions_requires_auth(self, api_client):
        """Test that document versions requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/platform/document-versions/test-doc")
        assert response.status_code == 401
        print("PASS: Document versions requires auth")

    def test_document_versions_success(self, api_client, user_token):
        """Test getting document version history"""
        # Use a document name that might exist
        response = api_client.get(
            f"{BASE_URL}/api/platform/document-versions/test-document",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "document_id" in data
        assert "versions" in data
        assert "total_versions" in data
        assert isinstance(data["versions"], list)
        print(f"PASS: Document versions returned - {data['total_versions']} versions")


class TestMultiSigListRequiresAuth:
    """Additional auth tests"""

    def test_multi_sig_list_requires_auth(self, api_client):
        """Test that listing multi-sig ceremonies requires auth"""
        response = api_client.get(f"{BASE_URL}/api/platform/multi-sig")
        assert response.status_code == 401
        print("PASS: Multi-sig list requires auth")

    def test_expiring_certs_requires_auth(self, api_client):
        """Test that expiring certificates requires auth"""
        response = api_client.get(f"{BASE_URL}/api/platform/certificates/expiring")
        assert response.status_code == 401
        print("PASS: Expiring certificates requires auth")
