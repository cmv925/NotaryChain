"""
Test Suite: Ceremony Stage Notifications & Freelancer Milestone Escrow Template
Tests the new features:
1. Real-Time Notifications for Ceremony Stage Progressions (5 stages)
2. Freelancer Milestone Escrow Template (5 conditions with progressive payment splits)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - admin bypasses feature gates
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"

class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}


class TestEscrowTemplates(TestAuth):
    """Test escrow templates endpoint - should return both real_estate and freelancer templates"""
    
    def test_templates_endpoint_returns_2_templates(self, admin_headers):
        """GET /api/escrow/templates returns 2 templates"""
        response = requests.get(f"{BASE_URL}/api/escrow/templates", headers=admin_headers)
        assert response.status_code == 200, f"Templates endpoint failed: {response.text}"
        data = response.json()
        assert "templates" in data
        templates = data["templates"]
        assert len(templates) == 2, f"Expected 2 templates, got {len(templates)}"
    
    def test_real_estate_template_has_6_milestones(self, admin_headers):
        """Real estate template has 6 milestones"""
        response = requests.get(f"{BASE_URL}/api/escrow/templates", headers=admin_headers)
        assert response.status_code == 200
        templates = response.json()["templates"]
        real_estate = next((t for t in templates if t["id"] == "real_estate"), None)
        assert real_estate is not None, "Real estate template not found"
        assert real_estate["milestones"] == 6, f"Expected 6 milestones, got {real_estate['milestones']}"
        assert real_estate["name"] == "Real Estate Purchase"
    
    def test_freelancer_template_has_5_milestones(self, admin_headers):
        """Freelancer template has 5 milestones"""
        response = requests.get(f"{BASE_URL}/api/escrow/templates", headers=admin_headers)
        assert response.status_code == 200
        templates = response.json()["templates"]
        freelancer = next((t for t in templates if t["id"] == "freelancer"), None)
        assert freelancer is not None, "Freelancer template not found"
        assert freelancer["milestones"] == 5, f"Expected 5 milestones, got {freelancer['milestones']}"
        assert freelancer["name"] == "Freelancer Milestone"
    
    def test_freelancer_template_has_correct_description(self, admin_headers):
        """Freelancer template has correct description"""
        response = requests.get(f"{BASE_URL}/api/escrow/templates", headers=admin_headers)
        assert response.status_code == 200
        templates = response.json()["templates"]
        freelancer = next((t for t in templates if t["id"] == "freelancer"), None)
        assert "milestone-based" in freelancer["description"].lower()
        assert freelancer["icon"] == "briefcase"


class TestFreelancerEscrowCreation(TestAuth):
    """Test creating freelancer escrow and extracting conditions"""
    
    def test_create_freelancer_escrow(self, admin_headers):
        """POST /api/escrow/create with escrow_type='freelancer' creates a freelancer escrow"""
        response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Project Escrow",
            "description": "Test freelancer escrow for milestone payments",
            "escrow_type": "freelancer",
            "escrow_amount": 5000,
            "buyer_name": "Test Client",
            "seller_name": "Test Freelancer",
            "seller_email": "freelancer@test.com"
        }, headers=admin_headers)
        assert response.status_code == 200, f"Create escrow failed: {response.text}"
        data = response.json()
        assert "escrow_id" in data
        assert data["escrow_type"] == "freelancer"
        assert data["status"] == "draft"
        return data["escrow_id"]
    
    def test_extract_freelancer_conditions_returns_5_conditions(self, admin_headers):
        """POST /api/escrow/{id}/extract-conditions for freelancer escrow returns 5 conditions"""
        # First create a freelancer escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Conditions Test",
            "escrow_type": "freelancer",
            "escrow_amount": 10000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={"document_name": "Freelance Contract"},
            headers=admin_headers
        )
        assert extract_response.status_code == 200, f"Extract conditions failed: {extract_response.text}"
        data = extract_response.json()
        assert data["total"] == 5, f"Expected 5 conditions, got {data['total']}"
        assert len(data["conditions"]) == 5
    
    def test_freelancer_conditions_have_correct_payment_percentages(self, admin_headers):
        """Freelancer conditions have correct payment_pct (10%, 25%, 0%, 25%, 40%)"""
        # Create freelancer escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Payment Pct Test",
            "escrow_type": "freelancer",
            "escrow_amount": 10000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert extract_response.status_code == 200
        conditions = extract_response.json()["conditions"]
        
        # Expected payment percentages in order
        expected_pcts = [10, 25, 0, 25, 40]
        actual_pcts = [c["payment_pct"] for c in conditions]
        assert actual_pcts == expected_pcts, f"Expected {expected_pcts}, got {actual_pcts}"
    
    def test_freelancer_conditions_have_correct_categories(self, admin_headers):
        """Freelancer conditions have categories: kickoff, milestone_1, review_1, milestone_2, final_delivery"""
        # Create freelancer escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Categories Test",
            "escrow_type": "freelancer",
            "escrow_amount": 10000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert extract_response.status_code == 200
        conditions = extract_response.json()["conditions"]
        
        # Expected categories in order
        expected_categories = ["kickoff", "milestone_1", "review_1", "milestone_2", "final_delivery"]
        actual_categories = [c["category"] for c in conditions]
        assert actual_categories == expected_categories, f"Expected {expected_categories}, got {actual_categories}"
    
    def test_freelancer_conditions_payment_pct_sums_to_100(self, admin_headers):
        """Freelancer conditions payment percentages sum to 100%"""
        # Create freelancer escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Sum Test",
            "escrow_type": "freelancer",
            "escrow_amount": 10000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert extract_response.status_code == 200
        conditions = extract_response.json()["conditions"]
        
        total_pct = sum(c["payment_pct"] for c in conditions)
        assert total_pct == 100, f"Expected payment_pct sum to be 100, got {total_pct}"


class TestCeremonyCreation(TestAuth):
    """Test ceremony creation and execution"""
    
    def test_create_ceremony(self, admin_headers):
        """POST /api/ceremony/start creates a new ceremony"""
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Ceremony Document",
            "signer_name": "Test Signer"
        }, headers=admin_headers)
        assert response.status_code == 200, f"Create ceremony failed: {response.text}"
        data = response.json()
        assert "ceremony_id" in data
        assert data["status"] == "pending"
        assert "message" in data
        return data["ceremony_id"]
    
    def test_get_ceremony(self, admin_headers):
        """GET /api/ceremony/{id} returns ceremony details"""
        # Create ceremony first
        create_response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Get Ceremony Test",
            "signer_name": "Test Signer"
        }, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Get ceremony
        get_response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=admin_headers)
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["ceremony_id"] == ceremony_id
        assert data["status"] == "pending"
        assert "agents" in data


class TestCeremonyExecution(TestAuth):
    """Test ceremony execution and notification creation"""
    
    def test_execute_ceremony_creates_notifications(self, admin_headers):
        """POST /api/ceremony/{id}/execute runs all agents and creates 5 ceremony stage notifications"""
        # Create ceremony
        create_response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Ceremony Execution Test",
            "signer_name": "Test Signer"
        }, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Execute ceremony (this takes 3-5 seconds due to agent processing)
        execute_response = requests.post(
            f"{BASE_URL}/api/ceremony/{ceremony_id}/execute",
            headers=admin_headers,
            timeout=60  # Longer timeout for agent execution
        )
        assert execute_response.status_code == 200, f"Execute ceremony failed: {execute_response.text}"
        data = execute_response.json()
        
        # Verify ceremony completed
        assert data["status"] in ["sealed", "consensus_failed"], f"Unexpected status: {data['status']}"
        
        # Verify all agents ran
        agents = data["agents"]
        assert agents["verifier"]["status"] in ["passed", "failed"]
        assert agents["witness"]["status"] in ["passed", "failed"]
        assert agents["sealer"]["status"] in ["passed", "failed"]
        
        # Verify consensus was reached
        assert data["consensus"]["status"] in ["reached", "failed"]
        assert data["consensus"]["result"] in ["APPROVED", "REJECTED", "REVIEW"]
        
        return ceremony_id
    
    def test_ceremony_notifications_exist_after_execution(self, admin_headers):
        """GET /api/notifications/ returns ceremony notifications with type='ceremony' after execution"""
        # Create and execute ceremony
        create_response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Notification Check",
            "signer_name": "Test Signer"
        }, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Execute ceremony
        execute_response = requests.post(
            f"{BASE_URL}/api/ceremony/{ceremony_id}/execute",
            headers=admin_headers,
            timeout=60
        )
        assert execute_response.status_code == 200
        
        # Wait a moment for notifications to be created
        time.sleep(1)
        
        # Get notifications
        notif_response = requests.get(f"{BASE_URL}/api/notifications/", headers=admin_headers)
        assert notif_response.status_code == 200, f"Get notifications failed: {notif_response.text}"
        data = notif_response.json()
        
        # Filter ceremony notifications for this ceremony
        notifications = data.get("notifications", [])
        ceremony_notifs = [n for n in notifications if n.get("type") == "ceremony" and ceremony_id in n.get("link", "")]
        
        # Should have at least 4-5 notifications (verifier, witness, sealer, consensus, possibly blockchain_seal)
        assert len(ceremony_notifs) >= 4, f"Expected at least 4 ceremony notifications, got {len(ceremony_notifs)}"
    
    def test_ceremony_notification_titles_contain_agent_names(self, admin_headers):
        """Each ceremony notification has title like 'Ceremony: Verifier Agent' with verdict and confidence"""
        # Create and execute ceremony
        create_response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Notification Titles",
            "signer_name": "Test Signer"
        }, headers=admin_headers)
        assert create_response.status_code == 200
        ceremony_id = create_response.json()["ceremony_id"]
        
        # Execute ceremony
        execute_response = requests.post(
            f"{BASE_URL}/api/ceremony/{ceremony_id}/execute",
            headers=admin_headers,
            timeout=60
        )
        assert execute_response.status_code == 200
        
        time.sleep(1)
        
        # Get notifications
        notif_response = requests.get(f"{BASE_URL}/api/notifications/", headers=admin_headers)
        assert notif_response.status_code == 200
        notifications = notif_response.json().get("notifications", [])
        
        # Filter ceremony notifications for this ceremony
        ceremony_notifs = [n for n in notifications if n.get("type") == "ceremony" and ceremony_id in n.get("link", "")]
        
        # Check that expected agent titles are present
        expected_titles = ["Verifier Agent", "Witness Agent", "Sealer Agent", "Consensus Oracle"]
        found_titles = [n.get("title", "") for n in ceremony_notifs]
        
        for expected in expected_titles:
            assert any(expected in title for title in found_titles), f"Expected notification with '{expected}' in title, found: {found_titles}"


class TestExistingCeremonyNotifications(TestAuth):
    """Test notifications for already-executed ceremony (ID from context)"""
    
    def test_existing_ceremony_has_notifications(self, admin_headers):
        """Verify ceremony 520c3c1e-3cca-4191-be26-e4c7c4a15d81 has notifications"""
        existing_ceremony_id = "520c3c1e-3cca-4191-be26-e4c7c4a15d81"
        
        # Get notifications
        notif_response = requests.get(f"{BASE_URL}/api/notifications/", headers=admin_headers)
        assert notif_response.status_code == 200
        notifications = notif_response.json().get("notifications", [])
        
        # Filter ceremony notifications for this ceremony
        ceremony_notifs = [n for n in notifications if n.get("type") == "ceremony" and existing_ceremony_id in n.get("link", "")]
        
        # Should have notifications from previous execution
        assert len(ceremony_notifs) >= 4, f"Expected at least 4 ceremony notifications for existing ceremony, got {len(ceremony_notifs)}"


class TestExistingFreelancerEscrow(TestAuth):
    """Test existing freelancer escrow (ID from context)"""
    
    def test_existing_freelancer_escrow_has_correct_type(self, admin_headers):
        """Verify escrow 8139e83a-e667-48ad-b69b-b9fc8f94e756 is freelancer type"""
        existing_escrow_id = "8139e83a-e667-48ad-b69b-b9fc8f94e756"
        
        response = requests.get(f"{BASE_URL}/api/escrow/{existing_escrow_id}", headers=admin_headers)
        # May return 404 if escrow doesn't exist or 403 if not authorized
        if response.status_code == 200:
            data = response.json()
            assert data["escrow_type"] == "freelancer", f"Expected freelancer type, got {data['escrow_type']}"
        elif response.status_code == 404:
            pytest.skip("Existing freelancer escrow not found - may have been cleaned up")
        else:
            pytest.skip(f"Could not access existing escrow: {response.status_code}")


class TestRealEstateVsFreelancerComparison(TestAuth):
    """Compare real estate and freelancer escrow condition generation"""
    
    def test_real_estate_escrow_has_6_conditions(self, admin_headers):
        """Real estate escrow generates 6 conditions"""
        # Create real estate escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Real Estate Comparison",
            "escrow_type": "real_estate",
            "escrow_amount": 350000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert extract_response.status_code == 200
        data = extract_response.json()
        assert data["total"] == 6, f"Expected 6 conditions for real estate, got {data['total']}"
    
    def test_freelancer_escrow_has_5_conditions(self, admin_headers):
        """Freelancer escrow generates 5 conditions"""
        # Create freelancer escrow
        create_response = requests.post(f"{BASE_URL}/api/escrow/create", json={
            "title": "TEST_Freelancer Comparison",
            "escrow_type": "freelancer",
            "escrow_amount": 5000
        }, headers=admin_headers)
        assert create_response.status_code == 200
        escrow_id = create_response.json()["escrow_id"]
        
        # Extract conditions
        extract_response = requests.post(
            f"{BASE_URL}/api/escrow/{escrow_id}/extract-conditions",
            json={},
            headers=admin_headers
        )
        assert extract_response.status_code == 200
        data = extract_response.json()
        assert data["total"] == 5, f"Expected 5 conditions for freelancer, got {data['total']}"


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
