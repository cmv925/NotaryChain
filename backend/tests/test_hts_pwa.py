"""
HTS (Hedera Token Service) and PWA Feature Tests
Tests for tokenized escrow with HTS fungible tokens and PWA capabilities.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"

# Test escrow ID (untokenized)
TEST_ESCROW_ID = "b31f491c-fbe9-4393-8e7a-a600e96c0c6e"
# Already tokenized escrow
TOKENIZED_ESCROW_ID = "e437e80a-39db-4368-a672-dcc93c8f1ad6"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code}")


@pytest.fixture(scope="module")
def user_token():
    """Get regular user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"User login failed: {response.status_code}")


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def user_headers(user_token):
    """Headers with user auth"""
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ══════════════════════════════════════════════
#  HTS BACKEND TESTS
# ══════════════════════════════════════════════

class TestHTSAuth:
    """Test HTS endpoints require authentication"""
    
    def test_tokenize_requires_auth(self):
        """POST /api/hts/tokenize returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/hts/tokenize", json={
            "escrow_id": TEST_ESCROW_ID
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/tokenize requires auth (401)")
    
    def test_transfer_requires_auth(self):
        """POST /api/hts/transfer returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/hts/transfer", json={
            "escrow_id": TEST_ESCROW_ID,
            "amount": 100,
            "to_party": "seller"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/transfer requires auth (401)")
    
    def test_burn_requires_auth(self):
        """POST /api/hts/burn/{escrow_id} returns 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/hts/burn/{TEST_ESCROW_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/burn requires auth (401)")
    
    def test_token_info_requires_auth(self):
        """GET /api/hts/token/{escrow_id} returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/hts/token/{TEST_ESCROW_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/token/{escrow_id} requires auth (401)")
    
    def test_tokens_list_requires_auth(self):
        """GET /api/hts/tokens returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/hts/tokens")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/tokens requires auth (401)")
    
    def test_verify_requires_auth(self):
        """GET /api/hts/token/{escrow_id}/verify returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/hts/token/{TEST_ESCROW_ID}/verify")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/hts/token/{escrow_id}/verify requires auth (401)")


class TestHTSTokenize:
    """Test HTS tokenize endpoint"""
    
    def test_tokenize_already_tokenized_escrow(self, admin_headers):
        """POST /api/hts/tokenize returns already_tokenized for existing token"""
        response = requests.post(f"{BASE_URL}/api/hts/tokenize", json={
            "escrow_id": TOKENIZED_ESCROW_ID,
            "token_name": "NCROW",
            "token_symbol": "NCR",
            "initial_supply": 1000
        }, headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("already_tokenized") == True, "Expected already_tokenized=True"
        assert "token_id" in data, "Expected token_id in response"
        print(f"PASS: Already tokenized escrow returns token_id={data['token_id']}, already_tokenized=True")
    
    def test_tokenize_nonexistent_escrow(self, admin_headers):
        """POST /api/hts/tokenize returns 404 for nonexistent escrow"""
        response = requests.post(f"{BASE_URL}/api/hts/tokenize", json={
            "escrow_id": "nonexistent-escrow-id-12345"
        }, headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Nonexistent escrow returns 404")


class TestHTSTokenInfo:
    """Test HTS token info endpoints"""
    
    def test_get_token_info(self, admin_headers):
        """GET /api/hts/token/{escrow_id} returns token details"""
        response = requests.get(f"{BASE_URL}/api/hts/token/{TOKENIZED_ESCROW_ID}", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Validate response structure
        assert "token_id" in data, "Expected token_id"
        assert "escrow_id" in data, "Expected escrow_id"
        assert "token_name" in data, "Expected token_name"
        assert "token_symbol" in data, "Expected token_symbol"
        assert "initial_supply" in data, "Expected initial_supply"
        assert "current_supply" in data, "Expected current_supply"
        assert "status" in data, "Expected status"
        assert "operations" in data, "Expected operations array"
        print(f"PASS: Token info returned - token_id={data['token_id']}, status={data['status']}, supply={data['current_supply']}/{data['initial_supply']}")
    
    def test_get_token_info_not_found(self, admin_headers):
        """GET /api/hts/token/{escrow_id} returns 404 for non-tokenized escrow"""
        response = requests.get(f"{BASE_URL}/api/hts/token/nonexistent-escrow-id", headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-tokenized escrow returns 404")
    
    def test_list_tokens(self, admin_headers):
        """GET /api/hts/tokens returns list of tokens"""
        response = requests.get(f"{BASE_URL}/api/hts/tokens", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tokens" in data, "Expected tokens array"
        assert "total" in data, "Expected total count"
        assert isinstance(data["tokens"], list), "tokens should be a list"
        print(f"PASS: Token list returned - {data['total']} tokens")
        if data["tokens"]:
            token = data["tokens"][0]
            print(f"  First token: {token.get('token_symbol')} ({token.get('token_id')}) - {token.get('status')}")


class TestHTSVerify:
    """Test HTS on-chain verification"""
    
    def test_verify_token_on_chain(self, admin_headers):
        """GET /api/hts/token/{escrow_id}/verify checks mirror node"""
        response = requests.get(f"{BASE_URL}/api/hts/token/{TOKENIZED_ESCROW_ID}/verify", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Validate response structure
        assert "token_id" in data, "Expected token_id"
        assert "escrow_id" in data, "Expected escrow_id"
        assert "on_chain_verified" in data, "Expected on_chain_verified boolean"
        assert "db_supply" in data, "Expected db_supply"
        assert "operations_count" in data, "Expected operations_count"
        print(f"PASS: Verification result - on_chain_verified={data['on_chain_verified']}, token_id={data['token_id']}")
        if data.get("on_chain_data"):
            print(f"  On-chain data: name={data['on_chain_data'].get('name')}, symbol={data['on_chain_data'].get('symbol')}")


class TestHTSTransfer:
    """Test HTS token transfer"""
    
    def test_transfer_insufficient_supply(self, admin_headers):
        """POST /api/hts/transfer returns 400 for insufficient supply"""
        # First get current supply
        info_response = requests.get(f"{BASE_URL}/api/hts/token/{TOKENIZED_ESCROW_ID}", headers=admin_headers)
        if info_response.status_code != 200:
            pytest.skip("Could not get token info")
        
        current_supply = info_response.json().get("current_supply", 0)
        
        # Try to transfer more than available
        response = requests.post(f"{BASE_URL}/api/hts/transfer", json={
            "escrow_id": TOKENIZED_ESCROW_ID,
            "amount": current_supply + 10000,
            "to_party": "seller"
        }, headers=admin_headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Transfer of {current_supply + 10000} tokens (more than {current_supply} available) returns 400")
    
    def test_transfer_nonexistent_token(self, admin_headers):
        """POST /api/hts/transfer returns 404 for non-tokenized escrow"""
        response = requests.post(f"{BASE_URL}/api/hts/transfer", json={
            "escrow_id": "nonexistent-escrow-id",
            "amount": 100,
            "to_party": "seller"
        }, headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Transfer on non-tokenized escrow returns 404")


class TestHTSBurn:
    """Test HTS token burn"""
    
    def test_burn_nonexistent_token(self, admin_headers):
        """POST /api/hts/burn/{escrow_id} returns 404 for non-tokenized escrow"""
        response = requests.post(f"{BASE_URL}/api/hts/burn/nonexistent-escrow-id", headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Burn on non-tokenized escrow returns 404")


# ══════════════════════════════════════════════
#  PWA FEATURE TESTS
# ══════════════════════════════════════════════

class TestPWAManifest:
    """Test PWA manifest.json"""
    
    def test_manifest_accessible(self):
        """GET /manifest.json returns valid manifest"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Validate required fields
        assert "name" in data, "Expected name in manifest"
        assert "short_name" in data, "Expected short_name in manifest"
        assert "start_url" in data, "Expected start_url in manifest"
        assert "display" in data, "Expected display in manifest"
        assert "icons" in data, "Expected icons in manifest"
        assert "theme_color" in data, "Expected theme_color in manifest"
        assert "background_color" in data, "Expected background_color in manifest"
        print(f"PASS: manifest.json accessible - name={data['name']}, display={data['display']}")
        print(f"  Icons: {len(data['icons'])} defined")
    
    def test_manifest_icons_defined(self):
        """manifest.json has 192x192 and 512x512 icons"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        icons = data.get("icons", [])
        sizes = [icon.get("sizes") for icon in icons]
        assert "192x192" in sizes, "Expected 192x192 icon"
        assert "512x512" in sizes, "Expected 512x512 icon"
        print(f"PASS: manifest.json has required icon sizes: {sizes}")


class TestPWAServiceWorker:
    """Test PWA service worker"""
    
    def test_service_worker_accessible(self):
        """GET /sw.js returns service worker script"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        content = response.text
        # Validate it's a service worker
        assert "self.addEventListener" in content, "Expected service worker event listeners"
        assert "install" in content, "Expected install event handler"
        assert "fetch" in content, "Expected fetch event handler"
        print("PASS: sw.js accessible and contains service worker code")
        # Check for caching
        if "caches" in content:
            print("  Service worker includes caching logic")
        if "push" in content:
            print("  Service worker includes push notification support")


class TestPWAIcons:
    """Test PWA icons"""
    
    def test_icon_192_accessible(self):
        """GET /icon-192.png returns icon"""
        response = requests.get(f"{BASE_URL}/icon-192.png")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "image" in response.headers.get("Content-Type", ""), "Expected image content type"
        print(f"PASS: /icon-192.png accessible ({len(response.content)} bytes)")
    
    def test_icon_512_accessible(self):
        """GET /icon-512.png returns icon"""
        response = requests.get(f"{BASE_URL}/icon-512.png")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "image" in response.headers.get("Content-Type", ""), "Expected image content type"
        print(f"PASS: /icon-512.png accessible ({len(response.content)} bytes)")


class TestPWAIndexHTML:
    """Test PWA meta tags in index.html"""
    
    def test_index_has_pwa_meta_tags(self):
        """GET / returns HTML with PWA meta tags"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        html = response.text
        # Check for PWA meta tags
        assert 'name="theme-color"' in html, "Expected theme-color meta tag"
        assert 'rel="manifest"' in html, "Expected manifest link"
        assert 'rel="apple-touch-icon"' in html, "Expected apple-touch-icon link"
        print("PASS: index.html has PWA meta tags (theme-color, manifest, apple-touch-icon)")


# ══════════════════════════════════════════════
#  ESCROW LIST TEST (for tokenization)
# ══════════════════════════════════════════════

class TestEscrowList:
    """Test escrow list for tokenization"""
    
    def test_escrow_list_accessible(self, admin_headers):
        """GET /api/escrow/list returns escrows"""
        response = requests.get(f"{BASE_URL}/api/escrow/list", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "escrows" in data, "Expected escrows array"
        print(f"PASS: Escrow list returned - {len(data['escrows'])} escrows")
        if data["escrows"]:
            escrow = data["escrows"][0]
            print(f"  First escrow: {escrow.get('title')} (${escrow.get('escrow_amount', 0):,.0f})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
