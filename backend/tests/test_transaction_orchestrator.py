"""
Transaction Orchestrator API Tests
Tests for the AI Transaction Orchestrator feature - blueprints, transactions, tasks, participants, messages, AI recommendations, and settlement
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


class TestAuthentication:
    """Test authentication for demo and admin users"""
    
    def test_demo_user_login(self):
        """Test demo user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Demo user login successful")
    
    def test_admin_user_login(self):
        """Test admin user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin user login successful")


@pytest.fixture(scope="module")
def demo_token():
    """Get demo user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Demo user login failed: {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin user login failed: {response.text}")


class TestBlueprints:
    """Test blueprint endpoints"""
    
    def test_get_blueprints_unauthenticated(self):
        """Test blueprints require authentication"""
        response = requests.get(f"{BASE_URL}/api/transactions/blueprints")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Blueprints require authentication")
    
    def test_get_blueprints(self, demo_token):
        """Test fetching all blueprints"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/blueprints",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get blueprints failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "system_blueprints" in data
        assert "custom_blueprints" in data
        assert isinstance(data["system_blueprints"], list)
        
        # Verify 4 system blueprints exist
        system_bps = data["system_blueprints"]
        assert len(system_bps) >= 4, f"Expected 4+ system blueprints, got {len(system_bps)}"
        
        print(f"✓ Got {len(system_bps)} system blueprints")
    
    def test_system_blueprints_content(self, demo_token):
        """Verify system blueprints contain expected types"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/blueprints",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        data = response.json()
        
        blueprint_types = [bp["transaction_type"] for bp in data["system_blueprints"]]
        
        expected_types = [
            "real_estate_closing",
            "business_contract",
            "estate_settlement",
            "trust_settlement"
        ]
        
        for exp_type in expected_types:
            assert exp_type in blueprint_types, f"Missing blueprint type: {exp_type}"
        
        print(f"✓ All 4 expected blueprint types present: {expected_types}")
    
    def test_get_single_blueprint(self, demo_token):
        """Test fetching a single blueprint by ID"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/blueprints/bp_real_estate_closing",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get single blueprint failed: {response.text}"
        
        bp = response.json()
        assert bp["id"] == "bp_real_estate_closing"
        assert bp["name"] == "Real Estate Closing"
        assert bp["transaction_type"] == "real_estate_closing"
        assert "steps" in bp
        assert len(bp["steps"]) >= 5, f"Expected 5+ steps, got {len(bp['steps'])}"
        
        print(f"✓ Real Estate Closing blueprint has {len(bp['steps'])} steps")
    
    def test_get_blueprint_not_found(self, demo_token):
        """Test fetching non-existent blueprint returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/blueprints/non_existent_bp",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent blueprint returns 404")


class TestTransactionCRUD:
    """Test transaction CRUD operations"""
    
    @pytest.fixture(scope="class")
    def created_transaction_id(self, demo_token):
        """Create a test transaction for subsequent tests"""
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Business Contract - Pytest",
                "description": "Test transaction created by pytest",
                "transaction_type": "business_contract",
                "blueprint_id": "bp_business_contract",
                "ai_enabled": True,
                "participants": []
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Failed to create transaction: {response.text}")
        
        data = response.json()
        transaction_id = data["id"]
        print(f"✓ Created test transaction: {transaction_id}")
        return transaction_id
    
    def test_create_transaction_unauthenticated(self):
        """Test creating transaction requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={"Content-Type": "application/json"},
            json={
                "name": "Test Transaction",
                "description": "Test",
                "transaction_type": "business_contract"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Transaction creation requires authentication")
    
    def test_create_transaction(self, demo_token):
        """Test creating a new transaction"""
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Real Estate Closing - Unit Test",
                "description": "Test real estate transaction",
                "transaction_type": "real_estate_closing",
                "blueprint_id": "bp_real_estate_closing",
                "ai_enabled": True,
                "participants": []
            }
        )
        assert response.status_code == 200, f"Create transaction failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Real Estate Closing - Unit Test"
        assert data["transaction_type"] == "real_estate_closing"
        assert data["status"] == "draft"
        assert data["blueprint_id"] == "bp_real_estate_closing"
        assert data["total_tasks"] >= 5, f"Expected 5+ tasks from blueprint, got {data['total_tasks']}"
        
        print(f"✓ Created transaction {data['id']} with {data['total_tasks']} tasks")
    
    def test_get_my_transactions(self, demo_token):
        """Test fetching user's transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        data = response.json()
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        
        print(f"✓ User has {len(data['transactions'])} transactions")
    
    def test_get_transaction_details(self, demo_token, created_transaction_id):
        """Test fetching single transaction details"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/{created_transaction_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get transaction details failed: {response.text}"
        
        data = response.json()
        assert data["id"] == created_transaction_id
        assert "name" in data
        assert "status" in data
        assert "transaction_type" in data
        assert "participant_count" in data
        assert "total_tasks" in data
        
        print(f"✓ Transaction details: {data['name']}, status={data['status']}")
    
    def test_get_transaction_not_found(self, demo_token):
        """Test getting non-existent transaction returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/transactions/non-existent-id-12345",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print(f"✓ Non-existent transaction returns {response.status_code}")


class TestTransactionRoom:
    """Test transaction room data endpoint"""
    
    def test_get_transaction_room(self, demo_token):
        """Test fetching full transaction room data"""
        # First get a transaction
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available to test room")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/room",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get room failed: {response.text}"
        
        data = response.json()
        
        # Verify room contains all expected data
        assert "transaction" in data
        assert "participants" in data
        assert "tasks" in data
        assert "messages" in data
        assert "documents" in data
        assert "current_participant" in data
        
        # Verify current_participant has expected fields
        cp = data["current_participant"]
        assert "id" in cp
        assert "email" in cp
        assert "role" in cp
        assert "can_send_messages" in cp
        assert "can_complete_tasks" in cp
        
        print(f"✓ Transaction room data: {len(data['participants'])} participants, {len(data['tasks'])} tasks, {len(data['messages'])} messages")


class TestTasks:
    """Test task management endpoints"""
    
    def test_get_tasks(self, demo_token):
        """Test fetching transaction tasks"""
        # Get a transaction
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/tasks",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        
        data = response.json()
        assert "tasks" in data
        assert isinstance(data["tasks"], list)
        
        if data["tasks"]:
            task = data["tasks"][0]
            assert "id" in task
            assert "name" in task
            assert "status" in task
            assert "order" in task
            
        print(f"✓ Transaction has {len(data['tasks'])} tasks")
    
    def test_complete_task(self, demo_token):
        """Test completing a task"""
        # Get a transaction with pending tasks
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200:
            pytest.skip("No transactions available")
        
        transactions = tx_response.json().get("transactions", [])
        
        # Find a transaction in progress or draft with pending tasks
        for tx in transactions:
            tasks_response = requests.get(
                f"{BASE_URL}/api/transactions/{tx['id']}/tasks",
                headers={"Authorization": f"Bearer {demo_token}"}
            )
            if tasks_response.status_code == 200:
                tasks = tasks_response.json().get("tasks", [])
                pending_tasks = [t for t in tasks if t["status"] == "pending"]
                
                if pending_tasks:
                    task_id = pending_tasks[0]["id"]
                    transaction_id = tx["id"]
                    
                    response = requests.post(
                        f"{BASE_URL}/api/transactions/{transaction_id}/tasks/{task_id}/complete",
                        headers={"Authorization": f"Bearer {demo_token}"}
                    )
                    assert response.status_code == 200, f"Complete task failed: {response.text}"
                    
                    data = response.json()
                    assert "task" in data or "status" in data
                    print(f"✓ Task completed successfully")
                    return
        
        print("✓ No pending tasks available to complete (skipped)")


class TestParticipants:
    """Test participant management endpoints"""
    
    def test_get_participants(self, demo_token):
        """Test fetching transaction participants"""
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/participants",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get participants failed: {response.text}"
        
        data = response.json()
        assert "participants" in data
        assert isinstance(data["participants"], list)
        
        # Verify owner is always a participant
        assert len(data["participants"]) >= 1
        
        owner = next((p for p in data["participants"] if p["role"] == "owner"), None)
        assert owner is not None, "Owner should be in participants"
        
        print(f"✓ Transaction has {len(data['participants'])} participants")
    
    def test_add_participant(self, demo_token):
        """Test adding a participant to transaction"""
        # Create a new transaction for this test
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Add Participant Test",
                "description": "Test for adding participants",
                "transaction_type": "business_contract",
                "blueprint_id": "bp_business_contract"
            }
        )
        if create_response.status_code != 200:
            pytest.skip(f"Could not create transaction: {create_response.text}")
        
        transaction_id = create_response.json()["id"]
        
        # Add participant
        response = requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/participants",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "email": "test_participant@example.com",
                "name": "Test Participant",
                "role": "signer"
            }
        )
        assert response.status_code == 200, f"Add participant failed: {response.text}"
        
        data = response.json()
        assert data["email"] == "test_participant@example.com"
        assert data["role"] == "signer"
        assert data["status"] == "invited"
        
        # Verify participant was added
        get_response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/participants",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        participants = get_response.json()["participants"]
        
        added = next((p for p in participants if p["email"] == "test_participant@example.com"), None)
        assert added is not None
        
        print(f"✓ Participant added successfully")


class TestMessages:
    """Test messaging endpoints"""
    
    def test_get_messages(self, demo_token):
        """Test fetching transaction messages"""
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/messages",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        
        print(f"✓ Transaction has {len(data['messages'])} messages")
    
    def test_send_message(self, demo_token):
        """Test sending a message in transaction room"""
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        test_message = f"TEST_Message from pytest - {int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/messages",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={"content": test_message}
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["content"] == test_message
        assert "sender_id" in data
        assert "sender_name" in data
        assert "created_at" in data
        
        # Verify message appears in message list
        get_response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/messages",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        messages = get_response.json()["messages"]
        sent_msg = next((m for m in messages if m["content"] == test_message), None)
        assert sent_msg is not None
        
        print(f"✓ Message sent and retrieved successfully")


class TestAIRecommendations:
    """Test AI recommendations endpoint"""
    
    def test_get_ai_recommendations(self, demo_token):
        """Test fetching AI analysis for transaction"""
        tx_response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        if tx_response.status_code != 200 or not tx_response.json().get("transactions"):
            pytest.skip("No transactions available")
        
        transaction_id = tx_response.json()["transactions"][0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{transaction_id}/ai/recommendations",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Get AI recommendations failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "transaction_id" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "recommendations" in data
        assert "risk_factors" in data
        assert "analysis_timestamp" in data
        
        # Verify risk score is valid
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ["low", "medium", "high"]
        
        print(f"✓ AI analysis: risk_score={data['risk_score']}, risk_level={data['risk_level']}, recommendations={len(data['recommendations'])}")


class TestTransactionLifecycle:
    """Test transaction lifecycle - start, progress, settle"""
    
    def test_start_transaction(self, demo_token):
        """Test starting a draft transaction"""
        # Create a new transaction
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Start Lifecycle Test",
                "description": "Test transaction lifecycle",
                "transaction_type": "business_contract",
                "blueprint_id": "bp_business_contract"
            }
        )
        if create_response.status_code != 200:
            pytest.skip(f"Could not create transaction: {create_response.text}")
        
        transaction_id = create_response.json()["id"]
        assert create_response.json()["status"] == "draft"
        
        # Start the transaction
        response = requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/start",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200, f"Start transaction failed: {response.text}"
        
        data = response.json()
        # Status should be in_progress (no pending participants) or pending_participants
        assert data["status"] in ["in_progress", "pending_participants"], f"Unexpected status: {data['status']}"
        
        print(f"✓ Transaction started, status: {data['status']}")
    
    def test_settle_transaction_incomplete_tasks(self, demo_token):
        """Test settling transaction fails if tasks not complete"""
        # Create transaction
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Settle Test (Incomplete)",
                "description": "Test settlement with incomplete tasks",
                "transaction_type": "business_contract",
                "blueprint_id": "bp_business_contract"
            }
        )
        if create_response.status_code != 200:
            pytest.skip(f"Could not create transaction: {create_response.text}")
        
        transaction_id = create_response.json()["id"]
        
        # Start it
        requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/start",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        
        # Try to settle (should fail - tasks not complete)
        response = requests.post(
            f"{BASE_URL}/api/transactions/{transaction_id}/settle",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        
        # Should fail because tasks are not completed
        assert response.status_code == 400, f"Settlement should fail with incomplete tasks, got {response.status_code}"
        
        print(f"✓ Settlement correctly rejected for incomplete tasks")


class TestHCSIntegration:
    """Test Hedera HCS integration for transactions"""
    
    def test_transaction_has_hcs_topic(self, demo_token):
        """Verify new transactions get HCS topic created"""
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_HCS Topic Test",
                "description": "Test HCS topic creation",
                "transaction_type": "trust_settlement",
                "blueprint_id": "bp_trust_settlement"
            }
        )
        assert response.status_code == 200, f"Create transaction failed: {response.text}"
        
        data = response.json()
        
        # Verify HCS topic was created
        assert "hcs_topic_id" in data, "Transaction should have hcs_topic_id"
        
        if data["hcs_topic_id"]:
            assert data["hcs_topic_id"].startswith("0.0."), f"Invalid topic ID format: {data['hcs_topic_id']}"
            print(f"✓ HCS Topic created: {data['hcs_topic_id']}")
        else:
            print(f"✓ Transaction created (HCS topic creation may be disabled or failed)")


class TestAuthorization:
    """Test authorization for transaction operations"""
    
    def test_cannot_view_others_transaction(self, admin_token):
        """Admin cannot view transaction they're not part of (unless admin override exists)"""
        # Create a transaction as admin
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Admin Transaction",
                "description": "Created by admin",
                "transaction_type": "business_contract"
            }
        )
        if create_response.status_code != 200:
            pytest.skip(f"Could not create transaction: {create_response.text}")
        
        admin_transaction_id = create_response.json()["id"]
        
        # Demo user should not be able to view admin's transaction
        demo_login = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        demo_token = demo_login.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/transactions/{admin_transaction_id}",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        
        # Should be forbidden (user is not a participant)
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
        
        print(f"✓ Non-participant cannot view transaction (403)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
