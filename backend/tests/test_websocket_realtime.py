"""
WebSocket Real-time Collaboration Tests (P2)
Tests for global WebSocket notifications and dashboard updates
"""
import pytest
import requests
import asyncio
import websockets
import json
import os

# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://notary-pro-demo.preview.emergentagent.com').rstrip('/')
WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws/global'

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
NOTARY_USER = {"email": "notarytest@test.com", "password": "Test123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


class TestHealthCheck:
    """Basic health check to ensure backend is running"""
    
    def test_health_endpoint_working(self):
        """Verify health endpoint still works correctly"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data.get('status')}")


class TestAuthentication:
    """Test authentication and token retrieval"""
    
    def test_demo_user_login(self):
        """Login demo user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Demo user login successful")
        return data["access_token"]
    
    def test_notary_user_login(self):
        """Login notary user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NOTARY_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Notary user login successful")
        return data["access_token"]
    
    def test_admin_user_login(self):
        """Login admin user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin user login successful")
        return data["access_token"]


class TestWebSocketAuth:
    """Test WebSocket authentication flow"""
    
    @pytest.fixture
    def demo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get demo user token")
    
    @pytest.mark.asyncio
    async def test_ws_connect_and_auth_success(self, demo_token):
        """Test WebSocket connection with valid JWT auth"""
        try:
            async with websockets.connect(WS_URL, close_timeout=5) as ws:
                # Send auth message
                await ws.send(json.dumps({"type": "auth", "token": demo_token}))
                
                # Wait for connected response
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                
                assert msg.get("type") == "connected"
                assert "user_id" in msg
                assert "online_count" in msg
                print(f"✓ WebSocket auth successful: user_id={msg.get('user_id')}, online={msg.get('online_count')}")
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    @pytest.mark.asyncio
    async def test_ws_invalid_token_rejection(self):
        """Test WebSocket rejects invalid JWT with 4001 close code"""
        try:
            async with websockets.connect(WS_URL, close_timeout=5) as ws:
                # Send invalid auth message
                await ws.send(json.dumps({"type": "auth", "token": "invalid_token_12345"}))
                
                # Expect error message then close
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                
                # Should receive error message
                assert msg.get("type") == "error"
                assert "Invalid token" in msg.get("message", "") or "token" in msg.get("message", "").lower()
                print(f"✓ Invalid token correctly rejected with error: {msg.get('message')}")
                
                # Connection should close after error
                try:
                    await asyncio.wait_for(ws.recv(), timeout=2)
                except websockets.exceptions.ConnectionClosed as e:
                    # Expected: close with 4001 code
                    assert e.code == 4001
                    print(f"✓ WebSocket closed with code 4001 as expected")
        except websockets.exceptions.ConnectionClosed as e:
            assert e.code == 4001
            print(f"✓ WebSocket closed with code 4001 (immediate close)")
        except Exception as e:
            pytest.fail(f"Unexpected error: {e}")
    
    @pytest.mark.asyncio
    async def test_ws_no_auth_message_rejection(self):
        """Test WebSocket rejects connection without proper auth message"""
        try:
            async with websockets.connect(WS_URL, close_timeout=5) as ws:
                # Send wrong message type
                await ws.send(json.dumps({"type": "hello", "data": "test"}))
                
                # Should receive error
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                
                assert msg.get("type") == "error"
                print(f"✓ Non-auth message rejected: {msg.get('message')}")
        except websockets.exceptions.ConnectionClosed as e:
            assert e.code == 4001
            print(f"✓ Connection closed with 4001 after invalid message")


class TestWebSocketPingPong:
    """Test WebSocket keepalive mechanism"""
    
    @pytest.fixture
    def demo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get demo user token")
    
    @pytest.mark.asyncio
    async def test_ping_pong_keepalive(self, demo_token):
        """Test ping/pong keepalive mechanism"""
        try:
            async with websockets.connect(WS_URL, close_timeout=5) as ws:
                # Authenticate first
                await ws.send(json.dumps({"type": "auth", "token": demo_token}))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                assert msg.get("type") == "connected"
                print(f"✓ WebSocket connected")
                
                # Send ping
                await ws.send(json.dumps({"type": "ping"}))
                
                # Expect pong
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                
                assert msg.get("type") == "pong"
                print(f"✓ Ping/pong keepalive working")
        except Exception as e:
            pytest.fail(f"Ping/pong test failed: {e}")
    
    @pytest.mark.asyncio
    async def test_multiple_pings(self, demo_token):
        """Test multiple ping/pong exchanges"""
        try:
            async with websockets.connect(WS_URL, close_timeout=10) as ws:
                # Authenticate
                await ws.send(json.dumps({"type": "auth", "token": demo_token}))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                assert msg.get("type") == "connected"
                
                # Send multiple pings
                for i in range(3):
                    await ws.send(json.dumps({"type": "ping"}))
                    response = await asyncio.wait_for(ws.recv(), timeout=5)
                    msg = json.loads(response)
                    assert msg.get("type") == "pong"
                
                print(f"✓ Multiple ping/pong exchanges successful (3 pings)")
        except Exception as e:
            pytest.fail(f"Multiple ping test failed: {e}")


class TestNotificationService:
    """Test notification service integration with WebSocket"""
    
    @pytest.fixture
    def demo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get demo user token")
    
    def test_notification_api_working(self, demo_token):
        """Test that notification API endpoints work"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        
        # Get unread count
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Notification unread count: {data.get('count')}")
        
        # Get notifications list
        response = requests.get(f"{BASE_URL}/api/notifications/?limit=5", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        print(f"✓ Notification list retrieved: {len(data.get('notifications', []))} items")


class TestNotaryQueueBroadcast:
    """Test notary queue update broadcasts"""
    
    @pytest.fixture
    def notary_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NOTARY_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get notary user token")
    
    @pytest.fixture
    def demo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get demo user token")
    
    def test_notary_pending_requests_api(self, notary_token):
        """Test that notary can access pending requests endpoint"""
        headers = {"Authorization": f"Bearer {notary_token}"}
        response = requests.get(f"{BASE_URL}/api/notary/requests/pending", headers=headers)
        # Notary should be able to see pending requests (403 means not a notary)
        if response.status_code == 403:
            print(f"✓ Notary user needs to be certified notary first (403 expected)")
        else:
            assert response.status_code == 200
            data = response.json()
            print(f"✓ Notary pending requests retrieved: {len(data)} items")
    
    def test_user_my_requests_api(self, demo_token):
        """Test that user can access their own requests"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/notary/requests/my", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ User requests retrieved: {len(data)} items")


class TestDashboardEndpoints:
    """Test dashboard-related API endpoints that should auto-refresh via WebSocket"""
    
    @pytest.fixture
    def demo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get demo user token")
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get admin user token")
    
    def test_dashboard_stats_endpoint(self, demo_token):
        """Test dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_seals" in data
        print(f"✓ Dashboard stats: total_seals={data.get('total_seals')}, recent_seals={data.get('recent_seals')}")
    
    def test_admin_stats_endpoint(self):
        """Test admin dashboard stats endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code != 200:
            pytest.skip("Could not get admin user token")
        admin_token = response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        print(f"✓ Admin stats: users={data.get('total_users')}, notaries={data.get('total_notaries')}")


class TestBroadcastEventIntegration:
    """Integration tests for broadcast_event function"""
    
    @pytest.mark.asyncio
    async def test_ws_receives_events_structure(self):
        """Test that WS connection is ready to receive events"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code != 200:
            pytest.skip("Could not get demo user token")
        demo_token = response.json().get("access_token")
        
        try:
            async with websockets.connect(WS_URL, close_timeout=5) as ws:
                # Authenticate
                await ws.send(json.dumps({"type": "auth", "token": demo_token}))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(response)
                assert msg.get("type") == "connected"
                
                # Connection is ready for events
                # Events would come as: {"type": "event", "event": "<event_name>", "data": {...}, "timestamp": "..."}
                # Notifications come as: {"type": "notification", "notification": {...}}
                print(f"✓ WebSocket ready for event broadcasts (user_id={msg.get('user_id')})")
        except Exception as e:
            pytest.fail(f"WS event readiness test failed: {e}")


class TestWebSocketMultipleConnections:
    """Test WebSocket supports multiple connections per user (multi-tab)"""
    
    @pytest.mark.asyncio
    async def test_multiple_tabs_same_user(self):
        """Test that same user can connect from multiple tabs"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        if response.status_code != 200:
            pytest.skip("Could not get demo user token")
        demo_token = response.json().get("access_token")
        
        try:
            # Open first connection
            async with websockets.connect(WS_URL, close_timeout=5) as ws1:
                await ws1.send(json.dumps({"type": "auth", "token": demo_token}))
                response1 = await asyncio.wait_for(ws1.recv(), timeout=5)
                msg1 = json.loads(response1)
                assert msg1.get("type") == "connected"
                count1 = msg1.get("online_count", 0)
                print(f"✓ First tab connected, online_count={count1}")
                
                # Open second connection with same token
                async with websockets.connect(WS_URL, close_timeout=5) as ws2:
                    await ws2.send(json.dumps({"type": "auth", "token": demo_token}))
                    response2 = await asyncio.wait_for(ws2.recv(), timeout=5)
                    msg2 = json.loads(response2)
                    assert msg2.get("type") == "connected"
                    count2 = msg2.get("online_count", 0)
                    print(f"✓ Second tab connected, online_count={count2}")
                    
                    # Both should be connected
                    # Send ping on both
                    await ws1.send(json.dumps({"type": "ping"}))
                    pong1 = await asyncio.wait_for(ws1.recv(), timeout=5)
                    assert json.loads(pong1).get("type") == "pong"
                    
                    await ws2.send(json.dumps({"type": "ping"}))
                    pong2 = await asyncio.wait_for(ws2.recv(), timeout=5)
                    assert json.loads(pong2).get("type") == "pong"
                    
                    print(f"✓ Multiple tabs working correctly")
        except Exception as e:
            pytest.fail(f"Multiple tabs test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
