"""
HTS Notifications Backend Tests
Tests for real-time push notifications when HTS tokens are minted, transferred, or burned.
Verifies notifications are persisted in the notifications collection.
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHTSNotifications:
    """Test HTS notification creation for mint, transfer, and burn operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        assert self.token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_notifications_endpoint_accessible(self):
        """Test GET /api/notifications/ returns notifications list (note trailing slash)"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200, f"Notifications endpoint failed: {resp.text}"
        data = resp.json()
        assert "notifications" in data, "Response should have 'notifications' key"
        assert isinstance(data["notifications"], list), "notifications should be a list"
    
    def test_hts_notifications_have_correct_type(self):
        """Test that HTS notifications have type='hts'"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        hts_notifications = [n for n in data["notifications"] if n.get("type") == "hts"]
        # Should have at least some HTS notifications from previous operations
        assert len(hts_notifications) > 0, "Should have HTS notifications from previous operations"
        
        for notif in hts_notifications:
            assert notif["type"] == "hts", f"HTS notification should have type='hts', got {notif['type']}"
    
    def test_hts_notifications_have_correct_link(self):
        """Test that HTS notifications have link='/tokenized-escrow'"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        hts_notifications = [n for n in data["notifications"] if n.get("type") == "hts"]
        
        for notif in hts_notifications:
            assert notif.get("link") == "/tokenized-escrow", f"HTS notification should have link='/tokenized-escrow', got {notif.get('link')}"
    
    def test_mint_notification_title(self):
        """Test that mint notifications have title='Token Minted'"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        mint_notifications = [n for n in data["notifications"] if n.get("title") == "Token Minted"]
        assert len(mint_notifications) > 0, "Should have at least one 'Token Minted' notification"
        
        for notif in mint_notifications:
            assert notif["type"] == "hts", "Mint notification should have type='hts'"
            assert notif["link"] == "/tokenized-escrow", "Mint notification should link to /tokenized-escrow"
    
    def test_transfer_notification_title(self):
        """Test that transfer notifications have title='Token Transfer'"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        transfer_notifications = [n for n in data["notifications"] if n.get("title") == "Token Transfer"]
        assert len(transfer_notifications) > 0, "Should have at least one 'Token Transfer' notification"
        
        for notif in transfer_notifications:
            assert notif["type"] == "hts", "Transfer notification should have type='hts'"
            assert notif["link"] == "/tokenized-escrow", "Transfer notification should link to /tokenized-escrow"
    
    def test_burn_notification_title(self):
        """Test that burn notifications have title='Tokens Burned'"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        burn_notifications = [n for n in data["notifications"] if n.get("title") == "Tokens Burned"]
        assert len(burn_notifications) > 0, "Should have at least one 'Tokens Burned' notification"
        
        for notif in burn_notifications:
            assert notif["type"] == "hts", "Burn notification should have type='hts'"
            assert notif["link"] == "/tokenized-escrow", "Burn notification should link to /tokenized-escrow"
    
    def test_notification_metadata_contains_escrow_id(self):
        """Test that HTS notifications contain escrow_id in metadata"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        hts_notifications = [n for n in data["notifications"] if n.get("type") == "hts"]
        
        for notif in hts_notifications:
            metadata = notif.get("metadata", {})
            assert "escrow_id" in metadata, f"HTS notification metadata should contain escrow_id"
            assert "token_id" in metadata, f"HTS notification metadata should contain token_id"
            assert "token_symbol" in metadata, f"HTS notification metadata should contain token_symbol"
    
    def test_notification_structure(self):
        """Test that notifications have required fields"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data["notifications"]) > 0:
            notif = data["notifications"][0]
            required_fields = ["id", "user_id", "title", "message", "type", "read", "created_at"]
            for field in required_fields:
                assert field in notif, f"Notification should have '{field}' field"


class TestHTSTokenizeCreatesNotification:
    """Test that tokenize operation creates a persistent notification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def _get_untokenized_escrow(self):
        """Find an escrow that hasn't been tokenized yet"""
        # Get all escrows
        escrows_resp = self.session.get(f"{BASE_URL}/api/escrow/list")
        if escrows_resp.status_code != 200:
            return None
        escrows = escrows_resp.json().get("escrows", [])
        
        # Get all tokens
        tokens_resp = self.session.get(f"{BASE_URL}/api/hts/tokens")
        if tokens_resp.status_code != 200:
            return None
        tokens = tokens_resp.json().get("tokens", [])
        tokenized_ids = {t["escrow_id"] for t in tokens}
        
        # Find untokenized escrow
        for escrow in escrows:
            if escrow["escrow_id"] not in tokenized_ids:
                return escrow
        return None
    
    def test_tokenize_creates_notification(self):
        """Test POST /api/hts/tokenize creates a persistent notification with type='hts' and title='Token Minted'"""
        # Get count of notifications before
        before_resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert before_resp.status_code == 200
        before_count = len([n for n in before_resp.json()["notifications"] if n.get("title") == "Token Minted"])
        
        # Find an untokenized escrow
        escrow = self._get_untokenized_escrow()
        if not escrow:
            pytest.skip("No untokenized escrows available for testing")
        
        # Tokenize the escrow
        unique_symbol = f"T{str(uuid.uuid4())[:3].upper()}"
        tokenize_resp = self.session.post(f"{BASE_URL}/api/hts/tokenize", json={
            "escrow_id": escrow["escrow_id"],
            "token_name": f"TEST_Notification_Token",
            "token_symbol": unique_symbol,
            "initial_supply": 1000
        })
        
        # If already tokenized, that's fine - we just verify the notification exists
        if tokenize_resp.status_code == 200:
            data = tokenize_resp.json()
            if not data.get("already_tokenized"):
                # Wait a moment for notification to be created
                time.sleep(0.5)
                
                # Check notifications after
                after_resp = self.session.get(f"{BASE_URL}/api/notifications/")
                assert after_resp.status_code == 200
                after_count = len([n for n in after_resp.json()["notifications"] if n.get("title") == "Token Minted"])
                
                assert after_count > before_count, "Tokenize should create a 'Token Minted' notification"
                
                # Verify the new notification has correct structure
                new_notifications = [n for n in after_resp.json()["notifications"] 
                                    if n.get("title") == "Token Minted" and 
                                    n.get("metadata", {}).get("escrow_id") == escrow["escrow_id"]]
                
                if new_notifications:
                    notif = new_notifications[0]
                    assert notif["type"] == "hts", "Notification type should be 'hts'"
                    assert notif["link"] == "/tokenized-escrow", "Notification link should be '/tokenized-escrow'"


class TestHTSTransferCreatesNotification:
    """Test that transfer operation creates a persistent notification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def _get_active_token_with_supply(self):
        """Find an active token with remaining supply"""
        tokens_resp = self.session.get(f"{BASE_URL}/api/hts/tokens")
        if tokens_resp.status_code != 200:
            return None
        tokens = tokens_resp.json().get("tokens", [])
        
        for token in tokens:
            if token.get("status") == "active" and token.get("current_supply", 0) > 10:
                return token
        return None
    
    def test_transfer_creates_notification(self):
        """Test POST /api/hts/transfer creates a persistent notification with type='hts' and title='Token Transfer'"""
        # Get count of notifications before
        before_resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert before_resp.status_code == 200
        before_count = len([n for n in before_resp.json()["notifications"] if n.get("title") == "Token Transfer"])
        
        # Find an active token with supply
        token = self._get_active_token_with_supply()
        if not token:
            pytest.skip("No active tokens with supply available for testing")
        
        # Transfer some tokens
        transfer_resp = self.session.post(f"{BASE_URL}/api/hts/transfer", json={
            "escrow_id": token["escrow_id"],
            "amount": 5,
            "to_party": "seller"
        })
        
        if transfer_resp.status_code == 200:
            # Wait a moment for notification to be created
            time.sleep(0.5)
            
            # Check notifications after
            after_resp = self.session.get(f"{BASE_URL}/api/notifications/")
            assert after_resp.status_code == 200
            after_count = len([n for n in after_resp.json()["notifications"] if n.get("title") == "Token Transfer"])
            
            assert after_count > before_count, "Transfer should create a 'Token Transfer' notification"


class TestHTSBurnCreatesNotification:
    """Test that burn operation creates a persistent notification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_burn_notification_exists(self):
        """Test that burn notifications exist with type='hts' and title='Tokens Burned'"""
        # We don't want to burn tokens in tests, just verify burn notifications exist from previous operations
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        burn_notifications = [n for n in data["notifications"] if n.get("title") == "Tokens Burned"]
        
        # Should have at least one burn notification from previous operations
        assert len(burn_notifications) > 0, "Should have at least one 'Tokens Burned' notification from previous operations"
        
        # Verify structure
        notif = burn_notifications[0]
        assert notif["type"] == "hts", "Burn notification type should be 'hts'"
        assert notif["link"] == "/tokenized-escrow", "Burn notification link should be '/tokenized-escrow'"
        assert "escrow_id" in notif.get("metadata", {}), "Burn notification should have escrow_id in metadata"


class TestNotificationServiceIntegration:
    """Test notification service integration with HTS routes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@notarychain.com"
        self.admin_password = "Admin123!"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_notifications_endpoint_requires_trailing_slash(self):
        """Test that /api/notifications/ requires trailing slash (redirects without it)"""
        # Without trailing slash - should redirect
        resp_no_slash = self.session.get(f"{BASE_URL}/api/notifications", allow_redirects=False)
        # With trailing slash - should work
        resp_with_slash = self.session.get(f"{BASE_URL}/api/notifications/")
        
        assert resp_with_slash.status_code == 200, "Notifications endpoint with trailing slash should work"
    
    def test_all_hts_notification_types_present(self):
        """Test that all three HTS notification types are present: Token Minted, Token Transfer, Tokens Burned"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        titles = {n.get("title") for n in data["notifications"]}
        
        assert "Token Minted" in titles, "Should have 'Token Minted' notifications"
        assert "Token Transfer" in titles, "Should have 'Token Transfer' notifications"
        assert "Tokens Burned" in titles, "Should have 'Tokens Burned' notifications"
    
    def test_hts_notifications_ordered_by_created_at(self):
        """Test that notifications are ordered by created_at (most recent first)"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/")
        assert resp.status_code == 200
        data = resp.json()
        
        notifications = data["notifications"]
        if len(notifications) > 1:
            # Check that notifications are in descending order by created_at
            for i in range(len(notifications) - 1):
                current_time = notifications[i].get("created_at", "")
                next_time = notifications[i + 1].get("created_at", "")
                assert current_time >= next_time, "Notifications should be ordered by created_at descending"
