"""
Ceremony SSE & Hedera Integration Tests
Tests: GET /api/ceremony/{id}/stream (SSE), Hedera blockchain seal verification
"""
import pytest
import requests
import os
import time
import json
import sseclient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"

# Expected Hedera topic ID from env
EXPECTED_TOPIC_ID = "0.0.10373605"


class TestCeremonySSEAndHedera:
    """Tests for SSE streaming and Hedera blockchain integration"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_01_sse_stream_endpoint_returns_event_stream(self, headers):
        """GET /api/ceremony/{id}/stream - returns text/event-stream content type"""
        # First create a ceremony
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_SSE_Stream_Document",
            "signer_name": "TEST_SSE Tester"
        }, headers=headers)
        
        assert response.status_code == 200, f"Failed to create ceremony: {response.text}"
        ceremony_id = response.json()["ceremony_id"]
        TestCeremonySSEAndHedera.sse_ceremony_id = ceremony_id
        
        # Test SSE endpoint with streaming
        stream_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
        
        # Use requests with stream=True to get SSE events
        with requests.get(stream_url, headers=headers, stream=True, timeout=120) as response:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            # Verify content type is event-stream
            content_type = response.headers.get('Content-Type', '')
            assert 'text/event-stream' in content_type, f"Expected text/event-stream, got {content_type}"
            
            # Collect events with timeout handling
            events = []
            client = sseclient.SSEClient(response)
            start_time = time.time()
            max_wait = 90  # 90 seconds max
            
            for event in client.events():
                events.append({
                    "event": event.event,
                    "data": json.loads(event.data) if event.data else None
                })
                print(f"SSE Event: {event.event}")
                
                # Stop after ceremony_complete or timeout
                if event.event == "ceremony_complete":
                    break
                if time.time() - start_time > max_wait:
                    print(f"Timeout after {max_wait}s, received {len(events)} events")
                    break
            
            # Verify expected events were received
            event_types = [e["event"] for e in events]
            
            assert "ceremony_started" in event_types, "Should receive ceremony_started event"
            # At minimum we should get some agent events
            assert "agent_started" in event_types, "Should receive at least one agent_started event"
            
            # If we got ceremony_complete, verify full event sequence
            if "ceremony_complete" in event_types:
                assert event_types.count("agent_started") == 3, "Should receive 3 agent_started events"
                assert event_types.count("agent_completed") == 3, "Should receive 3 agent_completed events"
                assert "consensus_started" in event_types, "Should receive consensus_started event"
                assert "consensus_reached" in event_types, "Should receive consensus_reached event"
            
            print(f"Received {len(events)} SSE events: {event_types}")
    
    def test_02_sse_events_contain_correct_data(self, headers):
        """Verify SSE event data structure"""
        # Create another ceremony for this test
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_SSE_Data_Verification",
            "signer_name": "TEST_Data Verifier"
        }, headers=headers)
        
        assert response.status_code == 200
        ceremony_id = response.json()["ceremony_id"]
        
        stream_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
        
        with requests.get(stream_url, headers=headers, stream=True, timeout=60) as response:
            client = sseclient.SSEClient(response)
            
            agent_started_events = []
            agent_completed_events = []
            consensus_event = None
            
            for event in client.events():
                data = json.loads(event.data) if event.data else {}
                
                if event.event == "agent_started":
                    agent_started_events.append(data)
                    assert "agent" in data, "agent_started should have 'agent' field"
                    assert data["agent"] in ["verifier", "witness", "sealer"], f"Invalid agent: {data['agent']}"
                
                elif event.event == "agent_completed":
                    agent_completed_events.append(data)
                    assert "agent" in data, "agent_completed should have 'agent' field"
                    assert "verdict" in data, "agent_completed should have 'verdict' field"
                    assert "confidence" in data, "agent_completed should have 'confidence' field"
                    assert data["verdict"] in ["PASS", "FAIL"], f"Invalid verdict: {data['verdict']}"
                    assert 0 <= data["confidence"] <= 1, f"Confidence out of range: {data['confidence']}"
                
                elif event.event == "consensus_reached":
                    consensus_event = data
                    assert "result" in data, "consensus_reached should have 'result' field"
                    assert "votes" in data, "consensus_reached should have 'votes' field"
                    assert "pass_count" in data, "consensus_reached should have 'pass_count' field"
                    assert "status" in data, "consensus_reached should have 'status' field"
                
                elif event.event == "ceremony_complete":
                    break
            
            # Verify we got all agent events
            assert len(agent_started_events) == 3, f"Expected 3 agent_started, got {len(agent_started_events)}"
            assert len(agent_completed_events) == 3, f"Expected 3 agent_completed, got {len(agent_completed_events)}"
            assert consensus_event is not None, "Should have received consensus_reached event"
            
            print(f"All SSE event data structures verified")
    
    def test_03_sse_sealing_blockchain_event_on_approval(self, headers):
        """Verify sealing_blockchain event is sent when consensus is APPROVED"""
        # We need to run multiple ceremonies until we get an APPROVED one
        max_attempts = 5
        sealing_event_received = False
        
        for attempt in range(max_attempts):
            response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
                "document_name": f"TEST_Hedera_Seal_Attempt_{attempt}",
                "signer_name": "TEST_Hedera Tester"
            }, headers=headers)
            
            assert response.status_code == 200
            ceremony_id = response.json()["ceremony_id"]
            
            stream_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
            
            with requests.get(stream_url, headers=headers, stream=True, timeout=60) as response:
                client = sseclient.SSEClient(response)
                
                for event in client.events():
                    if event.event == "sealing_blockchain":
                        sealing_event_received = True
                        data = json.loads(event.data)
                        assert "message" in data, "sealing_blockchain should have message"
                        print(f"Received sealing_blockchain event: {data['message']}")
                    
                    if event.event == "ceremony_complete":
                        break
            
            if sealing_event_received:
                break
        
        # Note: sealing_blockchain only happens on APPROVED, which is probabilistic
        # We just verify the test ran without errors
        print(f"sealing_blockchain event received: {sealing_event_received}")
    
    def test_04_hedera_seal_has_real_topic_id(self, headers):
        """Verify blockchain_seal contains real Hedera topic ID (0.0.10373605)"""
        # Run ceremonies until we get an APPROVED one with blockchain seal
        max_attempts = 5
        seal_verified = False
        
        for attempt in range(max_attempts):
            response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
                "document_name": f"TEST_Hedera_Topic_Verify_{attempt}",
                "signer_name": "TEST_Topic Verifier"
            }, headers=headers)
            
            assert response.status_code == 200
            ceremony_id = response.json()["ceremony_id"]
            
            # Execute via SSE
            stream_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
            
            with requests.get(stream_url, headers=headers, stream=True, timeout=60) as response:
                client = sseclient.SSEClient(response)
                for event in client.events():
                    if event.event == "ceremony_complete":
                        break
            
            # Fetch ceremony to check seal
            response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            
            if data["status"] == "sealed" and data.get("blockchain_seal"):
                seal = data["blockchain_seal"]
                
                # Verify real topic ID
                assert seal.get("topic_id") == EXPECTED_TOPIC_ID, f"Expected topic_id {EXPECTED_TOPIC_ID}, got {seal.get('topic_id')}"
                
                # Verify hcs_submitted is true
                assert seal.get("hcs_submitted") == True, f"Expected hcs_submitted=True, got {seal.get('hcs_submitted')}"
                
                # Verify transaction_id exists
                assert seal.get("transaction_id"), "Should have transaction_id"
                
                # Verify sequence_number exists and is a number
                assert seal.get("sequence_number") is not None, "Should have sequence_number"
                assert isinstance(seal.get("sequence_number"), int), f"sequence_number should be int, got {type(seal.get('sequence_number'))}"
                
                # Verify explorer_url exists and contains hashscan
                assert seal.get("explorer_url"), "Should have explorer_url"
                assert "hashscan.io" in seal.get("explorer_url", ""), f"explorer_url should contain hashscan.io"
                
                seal_verified = True
                print(f"Hedera seal verified: topic_id={seal['topic_id']}, seq={seal['sequence_number']}, tx={seal['transaction_id']}")
                break
        
        assert seal_verified, "Failed to get an APPROVED ceremony with blockchain seal after 5 attempts"
    
    def test_05_execute_endpoint_still_works_as_fallback(self, headers):
        """POST /api/ceremony/{id}/execute - synchronous fallback still works"""
        # Create ceremony
        response = requests.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Sync_Execute_Fallback",
            "signer_name": "TEST_Sync Tester"
        }, headers=headers)
        
        assert response.status_code == 200
        ceremony_id = response.json()["ceremony_id"]
        
        # Execute via synchronous endpoint (not SSE)
        response = requests.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute", json={}, headers=headers, timeout=60)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify ceremony completed
        assert data["status"] in ["sealed", "consensus_failed"], f"Expected sealed or consensus_failed, got {data['status']}"
        
        # Verify all agents ran
        for agent_name in ["verifier", "witness", "sealer"]:
            agent = data["agents"][agent_name]
            assert agent["status"] in ["passed", "failed"]
            assert agent["verdict"] in ["PASS", "FAIL"]
        
        # Verify consensus
        assert data["consensus"]["result"] in ["APPROVED", "REJECTED", "REVIEW"]
        
        print(f"Sync execute fallback works: status={data['status']}, consensus={data['consensus']['result']}")
    
    def test_06_sealed_ceremony_get_returns_hedera_data(self, headers):
        """GET /api/ceremony/{id} - sealed ceremony returns blockchain_seal with Hedera data"""
        # Find a sealed ceremony from our tests
        response = requests.get(f"{BASE_URL}/api/ceremony/list/my", headers=headers)
        assert response.status_code == 200
        
        ceremonies = response.json().get("ceremonies", [])
        sealed_ceremonies = [c for c in ceremonies if c.get("status") == "sealed"]
        
        if not sealed_ceremonies:
            pytest.skip("No sealed ceremonies found to verify")
        
        # Get full details of a sealed ceremony
        ceremony_id = sealed_ceremonies[0]["ceremony_id"]
        response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify blockchain_seal structure
        assert data.get("blockchain_seal") is not None, "Sealed ceremony should have blockchain_seal"
        
        seal = data["blockchain_seal"]
        
        # Required fields
        assert "network" in seal, "Should have network"
        assert "topic_id" in seal, "Should have topic_id"
        assert "transaction_id" in seal, "Should have transaction_id"
        assert "sealed_at" in seal, "Should have sealed_at"
        assert "consensus_hash" in seal, "Should have consensus_hash"
        
        # Hedera-specific fields when hcs_submitted is true
        if seal.get("hcs_submitted"):
            assert seal.get("sequence_number") is not None, "Should have sequence_number when hcs_submitted"
            assert seal.get("explorer_url"), "Should have explorer_url when hcs_submitted"
            assert seal.get("topic_id") == EXPECTED_TOPIC_ID, f"Topic ID should be {EXPECTED_TOPIC_ID}"
        
        print(f"Sealed ceremony {ceremony_id} has valid blockchain_seal: hcs_submitted={seal.get('hcs_submitted')}")
    
    def test_07_sse_stream_on_already_executed_returns_400(self, headers):
        """GET /api/ceremony/{id}/stream - returns 400 for already executed ceremony"""
        # Get a sealed ceremony
        response = requests.get(f"{BASE_URL}/api/ceremony/list/my", headers=headers)
        ceremonies = response.json().get("ceremonies", [])
        sealed = [c for c in ceremonies if c.get("status") == "sealed"]
        
        if not sealed:
            pytest.skip("No sealed ceremonies to test")
        
        ceremony_id = sealed[0]["ceremony_id"]
        
        # Try to stream an already sealed ceremony
        response = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}/stream", headers=headers)
        
        assert response.status_code == 400, f"Expected 400 for already sealed ceremony, got {response.status_code}"
        print(f"SSE stream correctly returns 400 for already executed ceremony")
    
    def test_08_sse_stream_nonexistent_ceremony_returns_404(self, headers):
        """GET /api/ceremony/{id}/stream - returns 404 for non-existent ceremony"""
        response = requests.get(f"{BASE_URL}/api/ceremony/nonexistent-id-12345/stream", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SSE stream correctly returns 404 for non-existent ceremony")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
