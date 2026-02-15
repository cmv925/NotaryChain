"""
Cryptocurrency Payment Routes for Notary Services
Supports BTC, ETH, USDC payments with real-time price conversion from CoinGecko
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import os
import uuid
import hashlib
import hmac
from pycoingecko import CoinGeckoAPI

from models import User
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/crypto", tags=["crypto-payments"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

# Initialize CoinGecko API (free tier)
cg = CoinGeckoAPI()

# Supported cryptocurrencies
SUPPORTED_CRYPTOS = {
    "bitcoin": {
        "symbol": "BTC",
        "name": "Bitcoin",
        "network": "Bitcoin",
        "confirmations_required": 3,
        "icon": "₿"
    },
    "ethereum": {
        "symbol": "ETH", 
        "name": "Ethereum",
        "network": "Ethereum",
        "confirmations_required": 12,
        "icon": "Ξ"
    },
    "usd-coin": {
        "symbol": "USDC",
        "name": "USD Coin",
        "network": "Ethereum",
        "confirmations_required": 12,
        "icon": "$"
    },
    "tether": {
        "symbol": "USDT",
        "name": "Tether",
        "network": "Ethereum",
        "confirmations_required": 12,
        "icon": "₮"
    }
}

# Fixed pricing packages (same as card payments)
NOTARY_PACKAGES = {
    "general": {"name": "General Document Notarization", "price": 25.00},
    "power_of_attorney": {"name": "Power of Attorney", "price": 35.00},
    "real_estate": {"name": "Real Estate Document", "price": 75.00},
    "affidavit": {"name": "Affidavit", "price": 30.00},
    "will": {"name": "Last Will & Testament", "price": 50.00},
    "trust": {"name": "Trust Document", "price": 65.00},
    "contract": {"name": "Contract", "price": 40.00}
}

# Demo wallet addresses (in production, generate unique addresses per payment)
DEMO_WALLETS = {
    "bitcoin": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "ethereum": "0x742d35Cc6634C0532925a3b844Bc9e7595f5dB21",
    "usd-coin": "0x742d35Cc6634C0532925a3b844Bc9e7595f5dB21",
    "tether": "0x742d35Cc6634C0532925a3b844Bc9e7595f5dB21"
}

# Price cache (in production, use Redis)
_price_cache = {}
_price_cache_time = {}
CACHE_TTL_SECONDS = 60


class CryptoPaymentRequest(BaseModel):
    package_id: str
    crypto_id: str  # bitcoin, ethereum, usd-coin, tether
    notary_request_id: Optional[str] = None


class CryptoPaymentResponse(BaseModel):
    payment_id: str
    wallet_address: str
    crypto_amount: float
    crypto_symbol: str
    crypto_name: str
    usd_amount: float
    exchange_rate: float
    expires_at: str
    qr_data: str
    network: str
    confirmations_required: int
    status: str


class PaymentStatusResponse(BaseModel):
    payment_id: str
    status: str  # pending, confirming, confirmed, expired, failed
    confirmations: int
    confirmations_required: int
    usd_amount: float
    crypto_amount: float
    crypto_symbol: str
    created_at: str
    expires_at: str


async def get_crypto_prices(crypto_ids: List[str]) -> Dict[str, float]:
    """Get current crypto prices in USD with caching"""
    now = datetime.now(timezone.utc)
    
    # Check cache
    prices_to_fetch = []
    result = {}
    
    for crypto_id in crypto_ids:
        cache_time = _price_cache_time.get(crypto_id)
        if cache_time and (now - cache_time).total_seconds() < CACHE_TTL_SECONDS:
            result[crypto_id] = _price_cache[crypto_id]
        else:
            prices_to_fetch.append(crypto_id)
    
    # Fetch missing prices
    if prices_to_fetch:
        try:
            data = cg.get_price(ids=",".join(prices_to_fetch), vs_currencies="usd")
            for crypto_id in prices_to_fetch:
                if crypto_id in data:
                    price = data[crypto_id]["usd"]
                    _price_cache[crypto_id] = price
                    _price_cache_time[crypto_id] = now
                    result[crypto_id] = price
        except Exception as e:
            # Fallback prices if API fails
            fallback_prices = {
                "bitcoin": 95000.0,
                "ethereum": 3500.0,
                "usd-coin": 1.0,
                "tether": 1.0
            }
            for crypto_id in prices_to_fetch:
                result[crypto_id] = fallback_prices.get(crypto_id, 1.0)
    
    return result


def generate_payment_id() -> str:
    """Generate unique payment ID"""
    return f"cp_{uuid.uuid4().hex[:16]}"


def generate_qr_data(crypto_id: str, address: str, amount: float, payment_id: str) -> str:
    """Generate cryptocurrency payment URI for QR code"""
    crypto_info = SUPPORTED_CRYPTOS[crypto_id]
    
    if crypto_id == "bitcoin":
        return f"bitcoin:{address}?amount={amount}&label=NotaryChain&message={payment_id}"
    elif crypto_id in ["ethereum", "usd-coin", "tether"]:
        # EIP-681 format
        return f"ethereum:{address}?value={int(amount * 1e18)}&label=NotaryChain"
    
    return f"{crypto_info['symbol'].lower()}:{address}?amount={amount}"


@router.get("/supported")
async def get_supported_cryptos():
    """Get list of supported cryptocurrencies"""
    return {
        "supported_cryptos": [
            {
                "id": crypto_id,
                **crypto_info
            }
            for crypto_id, crypto_info in SUPPORTED_CRYPTOS.items()
        ]
    }


@router.get("/prices")
async def get_prices():
    """Get current prices for all supported cryptocurrencies"""
    crypto_ids = list(SUPPORTED_CRYPTOS.keys())
    prices = await get_crypto_prices(crypto_ids)
    
    result = []
    for crypto_id, crypto_info in SUPPORTED_CRYPTOS.items():
        result.append({
            "id": crypto_id,
            "symbol": crypto_info["symbol"],
            "name": crypto_info["name"],
            "price_usd": prices.get(crypto_id, 0),
            "icon": crypto_info["icon"]
        })
    
    return {
        "prices": result,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


@router.get("/convert/{crypto_id}/{usd_amount}")
async def convert_usd_to_crypto(crypto_id: str, usd_amount: float):
    """Convert USD amount to cryptocurrency"""
    if crypto_id not in SUPPORTED_CRYPTOS:
        raise HTTPException(status_code=400, detail=f"Unsupported cryptocurrency: {crypto_id}")
    
    if usd_amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    prices = await get_crypto_prices([crypto_id])
    price = prices.get(crypto_id, 0)
    
    if price <= 0:
        raise HTTPException(status_code=500, detail="Unable to get current price")
    
    crypto_amount = usd_amount / price
    
    return {
        "usd_amount": usd_amount,
        "crypto_id": crypto_id,
        "crypto_symbol": SUPPORTED_CRYPTOS[crypto_id]["symbol"],
        "crypto_amount": round(crypto_amount, 8),
        "exchange_rate": price,
        "rate_valid_for": "60 seconds"
    }


@router.post("/payment", response_model=CryptoPaymentResponse)
async def create_crypto_payment(
    request: CryptoPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new cryptocurrency payment request"""
    
    # Validate package
    if request.package_id not in NOTARY_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    # Validate cryptocurrency
    if request.crypto_id not in SUPPORTED_CRYPTOS:
        raise HTTPException(status_code=400, detail=f"Unsupported cryptocurrency: {request.crypto_id}")
    
    package = NOTARY_PACKAGES[request.package_id]
    crypto_info = SUPPORTED_CRYPTOS[request.crypto_id]
    usd_amount = package["price"]
    
    # Get current price
    prices = await get_crypto_prices([request.crypto_id])
    exchange_rate = prices.get(request.crypto_id, 0)
    
    if exchange_rate <= 0:
        raise HTTPException(status_code=500, detail="Unable to get current exchange rate")
    
    # Calculate crypto amount
    crypto_amount = round(usd_amount / exchange_rate, 8)
    
    # Generate payment details
    payment_id = generate_payment_id()
    wallet_address = DEMO_WALLETS[request.crypto_id]
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Generate QR data
    qr_data = generate_qr_data(request.crypto_id, wallet_address, crypto_amount, payment_id)
    
    # Store payment record
    payment_record = {
        "id": payment_id,
        "user_id": current_user.id,
        "user_email": current_user.email,
        "package_id": request.package_id,
        "package_name": package["name"],
        "notary_request_id": request.notary_request_id,
        "crypto_id": request.crypto_id,
        "crypto_symbol": crypto_info["symbol"],
        "crypto_name": crypto_info["name"],
        "crypto_amount": crypto_amount,
        "usd_amount": usd_amount,
        "exchange_rate": exchange_rate,
        "wallet_address": wallet_address,
        "network": crypto_info["network"],
        "confirmations_required": crypto_info["confirmations_required"],
        "confirmations": 0,
        "status": "pending",
        "qr_data": qr_data,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.crypto_payments.insert_one(payment_record)
    
    return CryptoPaymentResponse(
        payment_id=payment_id,
        wallet_address=wallet_address,
        crypto_amount=crypto_amount,
        crypto_symbol=crypto_info["symbol"],
        crypto_name=crypto_info["name"],
        usd_amount=usd_amount,
        exchange_rate=exchange_rate,
        expires_at=expires_at.isoformat(),
        qr_data=qr_data,
        network=crypto_info["network"],
        confirmations_required=crypto_info["confirmations_required"],
        status="pending"
    )


@router.get("/payment/{payment_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check the status of a cryptocurrency payment"""
    
    payment = await db.crypto_payments.find_one({
        "id": payment_id,
        "user_id": current_user.id
    })
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check if expired
    if payment["status"] == "pending":
        expires_at = payment["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        
        if datetime.now(timezone.utc) > expires_at:
            await db.crypto_payments.update_one(
                {"id": payment_id},
                {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc)}}
            )
            payment["status"] = "expired"
    
    return PaymentStatusResponse(
        payment_id=payment["id"],
        status=payment["status"],
        confirmations=payment.get("confirmations", 0),
        confirmations_required=payment["confirmations_required"],
        usd_amount=payment["usd_amount"],
        crypto_amount=payment["crypto_amount"],
        crypto_symbol=payment["crypto_symbol"],
        created_at=payment["created_at"].isoformat() if isinstance(payment["created_at"], datetime) else payment["created_at"],
        expires_at=payment["expires_at"].isoformat() if isinstance(payment["expires_at"], datetime) else payment["expires_at"]
    )


@router.post("/payment/{payment_id}/simulate-confirm")
async def simulate_payment_confirmation(
    payment_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    DEMO ONLY: Simulate a payment confirmation.
    In production, this would be replaced by blockchain monitoring or webhook.
    """
    
    payment = await db.crypto_payments.find_one({
        "id": payment_id,
        "user_id": current_user.id
    })
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] == "expired":
        raise HTTPException(status_code=400, detail="Payment has expired")
    
    if payment["status"] == "confirmed":
        return {"message": "Payment already confirmed", "status": "confirmed"}
    
    # Simulate confirmation
    new_confirmations = payment.get("confirmations", 0) + payment["confirmations_required"]
    new_status = "confirmed" if new_confirmations >= payment["confirmations_required"] else "confirming"
    
    await db.crypto_payments.update_one(
        {"id": payment_id},
        {
            "$set": {
                "confirmations": new_confirmations,
                "status": new_status,
                "confirmed_at": datetime.now(timezone.utc) if new_status == "confirmed" else None,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # If confirmed, update related notary request
    if new_status == "confirmed" and payment.get("notary_request_id"):
        await db.notarization_requests.update_one(
            {"id": payment["notary_request_id"]},
            {"$set": {"payment_status": "paid", "payment_method": "crypto", "updated_at": datetime.now(timezone.utc)}}
        )
    
    return {
        "message": f"Payment {'confirmed' if new_status == 'confirmed' else 'confirming'}",
        "status": new_status,
        "confirmations": new_confirmations
    }


@router.get("/payments/history")
async def get_payment_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get user's cryptocurrency payment history"""
    
    payments = await db.crypto_payments.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Convert datetime objects to strings
    for payment in payments:
        for field in ["created_at", "expires_at", "updated_at", "confirmed_at"]:
            if field in payment and isinstance(payment[field], datetime):
                payment[field] = payment[field].isoformat()
    
    return {
        "count": len(payments),
        "payments": payments
    }


@router.get("/packages")
async def get_packages_with_crypto():
    """Get available packages with crypto pricing"""
    crypto_ids = list(SUPPORTED_CRYPTOS.keys())
    prices = await get_crypto_prices(crypto_ids)
    
    packages_with_crypto = []
    for pkg_id, pkg_info in NOTARY_PACKAGES.items():
        crypto_prices = {}
        for crypto_id, crypto_info in SUPPORTED_CRYPTOS.items():
            rate = prices.get(crypto_id, 0)
            if rate > 0:
                crypto_prices[crypto_info["symbol"]] = {
                    "amount": round(pkg_info["price"] / rate, 8),
                    "rate": rate
                }
        
        packages_with_crypto.append({
            "id": pkg_id,
            "name": pkg_info["name"],
            "price_usd": pkg_info["price"],
            "crypto_prices": crypto_prices
        })
    
    return {
        "packages": packages_with_crypto,
        "supported_cryptos": [
            {"id": k, "symbol": v["symbol"], "name": v["name"], "icon": v["icon"]}
            for k, v in SUPPORTED_CRYPTOS.items()
        ],
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
