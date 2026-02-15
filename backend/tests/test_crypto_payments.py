"""
Test suite for Cryptocurrency Payment Routes
Tests: BTC, ETH, USDC, USDT payments with CoinGecko price conversion
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "demo@test.com"
TEST_USER_PASSWORD = "Demo123!"


class TestCryptoPublicEndpoints:
    """Test public crypto endpoints (no auth required)"""
    
    def test_get_supported_cryptos(self):
        """GET /api/crypto/supported - should list all supported cryptocurrencies"""
        response = requests.get(f"{BASE_URL}/api/crypto/supported")
        assert response.status_code == 200
        
        data = response.json()
        assert "supported_cryptos" in data
        cryptos = data["supported_cryptos"]
        assert len(cryptos) == 4  # BTC, ETH, USDC, USDT
        
        # Verify each crypto has required fields
        symbols = [c["symbol"] for c in cryptos]
        assert "BTC" in symbols
        assert "ETH" in symbols
        assert "USDC" in symbols
        assert "USDT" in symbols
        
        # Verify structure
        for crypto in cryptos:
            assert "id" in crypto
            assert "symbol" in crypto
            assert "name" in crypto
            assert "network" in crypto
            assert "confirmations_required" in crypto
            assert "icon" in crypto
    
    def test_get_crypto_prices(self):
        """GET /api/crypto/prices - should return real-time prices from CoinGecko"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        assert response.status_code == 200
        
        data = response.json()
        assert "prices" in data
        assert "last_updated" in data
        
        prices = data["prices"]
        assert len(prices) == 4
        
        # Verify price structure
        for price in prices:
            assert "id" in price
            assert "symbol" in price
            assert "name" in price
            assert "price_usd" in price
            assert "icon" in price
            # Price should be positive
            assert price["price_usd"] > 0
        
        # BTC should have highest price
        btc_price = next((p for p in prices if p["symbol"] == "BTC"), None)
        assert btc_price is not None
        assert btc_price["price_usd"] > 10000  # BTC should be > $10k
        
        # Stablecoins should be close to $1
        usdc_price = next((p for p in prices if p["symbol"] == "USDC"), None)
        assert usdc_price is not None
        assert 0.99 < usdc_price["price_usd"] < 1.01  # USDC should be ~$1
    
    def test_convert_usd_to_bitcoin(self):
        """GET /api/crypto/convert/bitcoin/{usd_amount} - should convert USD to BTC"""
        usd_amount = 25.0
        response = requests.get(f"{BASE_URL}/api/crypto/convert/bitcoin/{usd_amount}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["usd_amount"] == usd_amount
        assert data["crypto_id"] == "bitcoin"
        assert data["crypto_symbol"] == "BTC"
        assert "crypto_amount" in data
        assert "exchange_rate" in data
        assert data["crypto_amount"] > 0
        assert data["exchange_rate"] > 0
        
        # Verify conversion math: crypto_amount * exchange_rate ≈ usd_amount
        calculated = data["crypto_amount"] * data["exchange_rate"]
        assert abs(calculated - usd_amount) < 0.01
    
    def test_convert_usd_to_ethereum(self):
        """GET /api/crypto/convert/ethereum/{usd_amount} - should convert USD to ETH"""
        usd_amount = 50.0
        response = requests.get(f"{BASE_URL}/api/crypto/convert/ethereum/{usd_amount}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_id"] == "ethereum"
        assert data["crypto_symbol"] == "ETH"
        assert data["crypto_amount"] > 0
    
    def test_convert_usd_to_usdc(self):
        """GET /api/crypto/convert/usd-coin/{usd_amount} - should convert USD to USDC"""
        usd_amount = 100.0
        response = requests.get(f"{BASE_URL}/api/crypto/convert/usd-coin/{usd_amount}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_id"] == "usd-coin"
        assert data["crypto_symbol"] == "USDC"
        # USDC is a stablecoin, so amount should be close to USD amount
        assert 99.0 < data["crypto_amount"] < 101.0
    
    def test_convert_usd_to_usdt(self):
        """GET /api/crypto/convert/tether/{usd_amount} - should convert USD to USDT"""
        usd_amount = 75.0
        response = requests.get(f"{BASE_URL}/api/crypto/convert/tether/{usd_amount}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_id"] == "tether"
        assert data["crypto_symbol"] == "USDT"
        # USDT is a stablecoin, so amount should be close to USD amount
        assert 74.0 < data["crypto_amount"] < 76.0
    
    def test_convert_invalid_crypto(self):
        """GET /api/crypto/convert/{invalid_crypto} - should return 400"""
        response = requests.get(f"{BASE_URL}/api/crypto/convert/dogecoin/25")
        assert response.status_code == 400
        assert "Unsupported cryptocurrency" in response.json()["detail"]
    
    def test_convert_invalid_amount(self):
        """GET /api/crypto/convert/bitcoin/{negative_amount} - should return 400"""
        response = requests.get(f"{BASE_URL}/api/crypto/convert/bitcoin/-10")
        assert response.status_code == 400
        assert "must be positive" in response.json()["detail"]
    
    def test_get_packages_with_crypto_pricing(self):
        """GET /api/crypto/packages - should return packages with crypto prices"""
        response = requests.get(f"{BASE_URL}/api/crypto/packages")
        assert response.status_code == 200
        
        data = response.json()
        assert "packages" in data
        assert "supported_cryptos" in data
        assert "last_updated" in data
        
        packages = data["packages"]
        assert len(packages) == 7  # 7 notary packages
        
        # Verify each package has crypto pricing
        for pkg in packages:
            assert "id" in pkg
            assert "name" in pkg
            assert "price_usd" in pkg
            assert "crypto_prices" in pkg
            assert pkg["price_usd"] > 0
            
            crypto_prices = pkg["crypto_prices"]
            assert "BTC" in crypto_prices
            assert "ETH" in crypto_prices
            assert "USDC" in crypto_prices
            assert "USDT" in crypto_prices
            
            # Verify BTC pricing structure
            btc_price = crypto_prices["BTC"]
            assert "amount" in btc_price
            assert "rate" in btc_price
            assert btc_price["amount"] > 0


class TestCryptoAuthenticatedEndpoints:
    """Test crypto payment endpoints requiring authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed - cannot test authenticated endpoints")
        
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_create_bitcoin_payment(self):
        """POST /api/crypto/payment - should create BTC payment request"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "general",
                "crypto_id": "bitcoin"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payment_id" in data
        assert data["payment_id"].startswith("cp_")
        assert "wallet_address" in data
        assert data["wallet_address"].startswith("bc1")  # Bitcoin address
        assert data["crypto_symbol"] == "BTC"
        assert data["crypto_name"] == "Bitcoin"
        assert data["usd_amount"] == 25.0  # General package price
        assert data["crypto_amount"] > 0
        assert data["exchange_rate"] > 0
        assert "expires_at" in data
        assert "qr_data" in data
        assert "bitcoin:" in data["qr_data"]
        assert data["network"] == "Bitcoin"
        assert data["confirmations_required"] == 3
        assert data["status"] == "pending"
        
        # Store payment_id for later tests
        self.btc_payment_id = data["payment_id"]
    
    def test_create_ethereum_payment(self):
        """POST /api/crypto/payment - should create ETH payment request"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "power_of_attorney",
                "crypto_id": "ethereum"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_symbol"] == "ETH"
        assert data["usd_amount"] == 35.0  # Power of attorney price
        assert data["wallet_address"].startswith("0x")  # Ethereum address
        assert data["network"] == "Ethereum"
        assert data["confirmations_required"] == 12
    
    def test_create_usdc_payment(self):
        """POST /api/crypto/payment - should create USDC payment request"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "real_estate",
                "crypto_id": "usd-coin"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_symbol"] == "USDC"
        assert data["usd_amount"] == 75.0  # Real estate price
        # USDC crypto_amount should be close to USD amount
        assert 74.0 < data["crypto_amount"] < 76.0
    
    def test_create_usdt_payment(self):
        """POST /api/crypto/payment - should create USDT payment request"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "contract",
                "crypto_id": "tether"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["crypto_symbol"] == "USDT"
        assert data["crypto_name"] == "Tether"
        assert data["usd_amount"] == 40.0  # Contract price
    
    def test_create_payment_invalid_package(self):
        """POST /api/crypto/payment - should fail with invalid package"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "invalid_package",
                "crypto_id": "bitcoin"
            },
            headers=self.headers
        )
        assert response.status_code == 400
        assert "Invalid package" in response.json()["detail"]
    
    def test_create_payment_invalid_crypto(self):
        """POST /api/crypto/payment - should fail with unsupported crypto"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "general",
                "crypto_id": "dogecoin"
            },
            headers=self.headers
        )
        assert response.status_code == 400
        assert "Unsupported cryptocurrency" in response.json()["detail"]
    
    def test_create_payment_no_auth(self):
        """POST /api/crypto/payment - should fail without auth"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "general",
                "crypto_id": "bitcoin"
            }
        )
        assert response.status_code == 401
    
    def test_payment_status_and_simulate_confirm(self):
        """Full flow: Create -> Status -> Simulate Confirm -> Verify Confirmed"""
        # Step 1: Create payment
        create_response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "affidavit",
                "crypto_id": "bitcoin"
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        payment_id = create_response.json()["payment_id"]
        
        # Step 2: Check initial status
        status_response = requests.get(
            f"{BASE_URL}/api/crypto/payment/{payment_id}/status",
            headers=self.headers
        )
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data["status"] == "pending"
        assert status_data["confirmations"] == 0
        assert status_data["usd_amount"] == 30.0
        
        # Step 3: Simulate confirmation
        simulate_response = requests.post(
            f"{BASE_URL}/api/crypto/payment/{payment_id}/simulate-confirm",
            headers=self.headers
        )
        assert simulate_response.status_code == 200
        assert simulate_response.json()["status"] == "confirmed"
        
        # Step 4: Verify confirmed status
        final_status = requests.get(
            f"{BASE_URL}/api/crypto/payment/{payment_id}/status",
            headers=self.headers
        )
        assert final_status.status_code == 200
        assert final_status.json()["status"] == "confirmed"
        assert final_status.json()["confirmations"] >= final_status.json()["confirmations_required"]
    
    def test_payment_status_not_found(self):
        """GET /api/crypto/payment/{id}/status - should return 404 for invalid payment"""
        response = requests.get(
            f"{BASE_URL}/api/crypto/payment/cp_invalid123456/status",
            headers=self.headers
        )
        assert response.status_code == 404
        assert "Payment not found" in response.json()["detail"]
    
    def test_simulate_confirm_not_found(self):
        """POST /api/crypto/payment/{id}/simulate-confirm - should return 404 for invalid payment"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/cp_invalid123456/simulate-confirm",
            headers=self.headers
        )
        assert response.status_code == 404
    
    def test_get_payment_history(self):
        """GET /api/crypto/payments/history - should return user's payment history"""
        # First create a payment to ensure there's history
        requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={
                "package_id": "will",
                "crypto_id": "ethereum"
            },
            headers=self.headers
        )
        
        # Get payment history
        response = requests.get(
            f"{BASE_URL}/api/crypto/payments/history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data
        assert "payments" in data
        assert data["count"] >= 1
        
        # Verify payment record structure
        payments = data["payments"]
        assert len(payments) > 0
        payment = payments[0]
        assert "id" in payment
        assert "user_id" in payment
        assert "package_id" in payment
        assert "crypto_id" in payment
        assert "crypto_symbol" in payment
        assert "crypto_amount" in payment
        assert "usd_amount" in payment
        assert "status" in payment
        assert "created_at" in payment
    
    def test_payment_history_no_auth(self):
        """GET /api/crypto/payments/history - should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/crypto/payments/history")
        assert response.status_code == 401
    
    def test_already_confirmed_payment_resimulate(self):
        """Simulating confirm on already confirmed payment should be idempotent"""
        # Create and confirm payment
        create_response = requests.post(
            f"{BASE_URL}/api/crypto/payment",
            json={"package_id": "trust", "crypto_id": "usd-coin"},
            headers=self.headers
        )
        payment_id = create_response.json()["payment_id"]
        
        # Confirm first time
        requests.post(
            f"{BASE_URL}/api/crypto/payment/{payment_id}/simulate-confirm",
            headers=self.headers
        )
        
        # Try to confirm again - should return already confirmed message
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/{payment_id}/simulate-confirm",
            headers=self.headers
        )
        assert response.status_code == 200
        assert "already confirmed" in response.json()["message"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
