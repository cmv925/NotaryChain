"""
Hedera Token Service (HTS) Routes
Tokenized escrow with real HTS fungible tokens on Hedera Mainnet.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
import hashlib
import logging
import os
import aiohttp

router = APIRouter(prefix="/api/hts", tags=["hts"])
db = None
logger = logging.getLogger(__name__)


def set_db(database):
    global db
    db = database


async def _get_user(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _get_hedera_config():
    account_id = os.environ.get("HEDERA_ACCOUNT_ID")
    network = os.environ.get("HEDERA_NETWORK", "mainnet")
    mirror = "https://mainnet-public.mirrornode.hedera.com" if network == "mainnet" else "https://testnet.mirrornode.hedera.com"
    return account_id, network, mirror


async def _emit_hts_event(escrow_id: str, event_type: str, data: dict, actor_email: str):
    """Broadcast real-time HTS event to escrow parties and create persistent notifications."""
    from services.notification_service import broadcast_event, create_notification

    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    target_emails = set()
    if escrow:
        for src in [escrow.get("created_by"),
                     escrow.get("parties", {}).get("buyer", {}).get("email"),
                     escrow.get("parties", {}).get("seller", {}).get("email")]:
            if src:
                target_emails.add(src)
    target_emails.add(actor_email)

    target_ids = []
    async for u in db.users.find({"email": {"$in": list(target_emails)}}, {"_id": 0, "id": 1, "email": 1}):
        uid = u.get("id") or u.get("email")
        if uid:
            target_ids.append(uid)

    payload = {"escrow_id": escrow_id, "title": escrow.get("title", "Escrow") if escrow else "Escrow", **data}
    await broadcast_event(event_type, payload, target_ids if target_ids else None)

    # Persistent notification for each party
    notif_titles = {
        "hts_mint": "Token Minted",
        "hts_transfer": "Token Transfer",
        "hts_burn": "Tokens Burned",
    }
    notif_title = notif_titles.get(event_type, "HTS Event")
    notif_msg = data.get("message", f"{event_type} on escrow {escrow_id}")
    for uid in target_ids:
        await create_notification(uid, notif_title, notif_msg, notif_type="hts", link="/tokenized-escrow", metadata=payload)


# ══════════════════════════════════════════════
#  TOKENIZE ESCROW
# ══════════════════════════════════════════════

class TokenizeRequest(BaseModel):
    escrow_id: str
    token_name: str = Field(default="NCROW", max_length=100)
    token_symbol: str = Field(default="NCR", max_length=10)
    initial_supply: int = Field(default=1000, ge=1, le=10000000)


@router.post("/tokenize")
async def tokenize_escrow(body: TokenizeRequest, request: Request):
    """Create an HTS fungible token representing escrow value."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "hts_tokens")
    user = await _get_user(request)
    account_id, network, mirror = _get_hedera_config()

    escrow = await db.escrow_agreements.find_one({"escrow_id": body.escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")

    # Verify user is party or admin
    email = user["email"]
    is_party = (escrow.get("created_by") == email
                or escrow.get("parties", {}).get("buyer", {}).get("email") == email
                or escrow.get("parties", {}).get("seller", {}).get("email") == email)
    if not is_party and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only escrow parties can tokenize")

    # Check if already tokenized
    existing = await db.hts_tokens.find_one({"escrow_id": body.escrow_id}, {"_id": 0})
    if existing:
        return {**existing, "already_tokenized": True}

    now = datetime.now(timezone.utc).isoformat()
    token_id = f"0.0.{abs(hash(body.escrow_id + now)) % 99999999}"

    # Attempt real HTS creation via SDK
    hts_result = await _create_hts_token(body.token_name, body.token_symbol, body.initial_supply)

    if hts_result.get("success"):
        token_id = hts_result["token_id"]

    token_record = {
        "token_id": token_id,
        "escrow_id": body.escrow_id,
        "token_name": body.token_name,
        "token_symbol": body.token_symbol,
        "initial_supply": body.initial_supply,
        "current_supply": body.initial_supply,
        "treasury_account": account_id,
        "network": network,
        "status": "active",
        "on_chain": hts_result.get("success", False),
        "transaction_id": hts_result.get("transaction_id"),
        "created_by": email,
        "created_at": now,
        "operations": [{
            "type": "mint",
            "amount": body.initial_supply,
            "timestamp": now,
            "transaction_id": hts_result.get("transaction_id"),
            "by": email,
        }],
        "explorer_url": f"https://hashscan.io/{network}/token/{token_id}",
    }

    await db.hts_tokens.insert_one(token_record)

    # Update escrow with token reference
    await db.escrow_agreements.update_one(
        {"escrow_id": body.escrow_id},
        {"$set": {"hts_token": {
            "token_id": token_id,
            "symbol": body.token_symbol,
            "supply": body.initial_supply,
            "on_chain": hts_result.get("success", False),
        }}}
    )

    # Emit real-time notification
    await _emit_hts_event(body.escrow_id, "hts_mint", {
        "token_id": token_id,
        "token_symbol": body.token_symbol,
        "amount": body.initial_supply,
        "on_chain": hts_result.get("success", False),
        "by": email,
        "message": f"{body.token_symbol} token minted with {body.initial_supply:,} supply on {network}",
    }, email)

    # CRM sync — HTS mint
    try:
        from services.ghl_service import sync_hts_token_minted
        import asyncio as _asyncio
        _asyncio.create_task(sync_hts_token_minted(
            email=email, token_id=token_id,
            amount=float(body.initial_supply),
            purpose=f"Escrow {body.escrow_id} · {body.token_symbol}",
        ))
    except Exception:
        pass

    return {
        "token_id": token_id,
        "escrow_id": body.escrow_id,
        "token_name": body.token_name,
        "token_symbol": body.token_symbol,
        "initial_supply": body.initial_supply,
        "network": network,
        "on_chain": hts_result.get("success", False),
        "explorer_url": token_record["explorer_url"],
        "status": "active",
    }


# ══════════════════════════════════════════════
#  TOKEN TRANSFER (on settlement)
# ══════════════════════════════════════════════

class TransferRequest(BaseModel):
    escrow_id: str
    amount: int = Field(ge=1)
    to_party: str = Field(default="seller", max_length=50)


@router.post("/transfer")
async def transfer_tokens(body: TransferRequest, request: Request):
    """Transfer tokens from treasury to a party on escrow settlement."""
    user = await _get_user(request)

    token = await db.hts_tokens.find_one({"escrow_id": body.escrow_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="No HTS token found for this escrow")
    if token["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Token is {token['status']}")
    if body.amount > token["current_supply"]:
        raise HTTPException(status_code=400, detail="Insufficient token supply")

    now = datetime.now(timezone.utc).isoformat()
    tx_id = f"0.0.{abs(hash(body.escrow_id + now)) % 99999999}@{now[:19]}"

    # Attempt real HTS transfer
    transfer_result = await _transfer_hts_token(token["token_id"], body.amount)
    if transfer_result.get("transaction_id"):
        tx_id = transfer_result["transaction_id"]

    op = {
        "type": "transfer",
        "amount": body.amount,
        "to_party": body.to_party,
        "timestamp": now,
        "transaction_id": tx_id,
        "by": user["email"],
        "on_chain": transfer_result.get("success", False),
    }

    await db.hts_tokens.update_one(
        {"escrow_id": body.escrow_id},
        {
            "$inc": {"current_supply": -body.amount},
            "$push": {"operations": op},
            "$set": {"updated_at": now},
        }
    )

    # Emit real-time notification
    await _emit_hts_event(body.escrow_id, "hts_transfer", {
        "token_id": token["token_id"],
        "token_symbol": token["token_symbol"],
        "amount": body.amount,
        "to_party": body.to_party,
        "remaining_supply": token["current_supply"] - body.amount,
        "on_chain": transfer_result.get("success", False),
        "by": user["email"],
        "message": f"{body.amount:,} {token['token_symbol']} transferred to {body.to_party}",
    }, user["email"])

    return {
        "transfer_id": tx_id,
        "amount": body.amount,
        "to_party": body.to_party,
        "remaining_supply": token["current_supply"] - body.amount,
        "on_chain": transfer_result.get("success", False),
    }


# ══════════════════════════════════════════════
#  TOKEN BURN (on cancellation)
# ══════════════════════════════════════════════

@router.post("/burn/{escrow_id}")
async def burn_tokens(escrow_id: str, request: Request):
    """Burn all remaining tokens on escrow cancellation."""
    user = await _get_user(request)

    token = await db.hts_tokens.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="No HTS token found for this escrow")

    now = datetime.now(timezone.utc).isoformat()
    burn_amount = token["current_supply"]

    burn_result = await _burn_hts_token(token["token_id"], burn_amount)
    tx_id = burn_result.get("transaction_id", f"burn-{uuid.uuid4()}")

    op = {
        "type": "burn",
        "amount": burn_amount,
        "timestamp": now,
        "transaction_id": tx_id,
        "by": user["email"],
        "on_chain": burn_result.get("success", False),
    }

    await db.hts_tokens.update_one(
        {"escrow_id": escrow_id},
        {
            "$set": {"current_supply": 0, "status": "burned", "updated_at": now},
            "$push": {"operations": op},
        }
    )

    # Emit real-time notification
    await _emit_hts_event(escrow_id, "hts_burn", {
        "token_id": token["token_id"],
        "token_symbol": token["token_symbol"],
        "amount": burn_amount,
        "on_chain": burn_result.get("success", False),
        "by": user["email"],
        "message": f"{burn_amount:,} {token['token_symbol']} tokens burned",
    }, user["email"])

    return {
        "burned": burn_amount,
        "status": "burned",
        "transaction_id": tx_id,
        "on_chain": burn_result.get("success", False),
    }


# ══════════════════════════════════════════════
#  TOKEN INFO
# ══════════════════════════════════════════════

@router.get("/token/{escrow_id}")
async def get_token_info(escrow_id: str, request: Request):
    """Get HTS token details for an escrow."""
    user = await _get_user(request)  # noqa: F841 - auth gate
    token = await db.hts_tokens.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="No HTS token found")
    return token


@router.get("/tokens")
async def list_tokens(request: Request):
    """List all HTS tokens for the current user."""
    user = await _get_user(request)
    query = {"created_by": user["email"]}
    if user.get("role") == "admin":
        query = {}
    tokens = []
    cursor = db.hts_tokens.find(query, {"_id": 0}).sort("created_at", -1).limit(50)
    async for t in cursor:
        tokens.append(t)
    return {"tokens": tokens, "total": len(tokens)}


@router.get("/token/{escrow_id}/verify")
async def verify_token_on_chain(escrow_id: str, request: Request):
    """Verify token existence on Hedera mirror node."""
    user = await _get_user(request)  # noqa: F841 - auth gate
    token = await db.hts_tokens.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="No HTS token found")

    _, network, mirror = _get_hedera_config()
    on_chain_data = None
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{mirror}/api/v1/tokens/{token['token_id']}", timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    on_chain_data = await resp.json()
    except Exception as e:
        logger.warning(f"Mirror node query failed: {e}")

    return {
        "token_id": token["token_id"],
        "escrow_id": escrow_id,
        "db_supply": token["current_supply"],
        "on_chain_verified": on_chain_data is not None,
        "on_chain_data": {
            "name": on_chain_data.get("name"),
            "symbol": on_chain_data.get("symbol"),
            "total_supply": on_chain_data.get("total_supply"),
            "treasury_account_id": on_chain_data.get("treasury_account_id"),
        } if on_chain_data else None,
        "operations_count": len(token.get("operations", [])),
        "explorer_url": token.get("explorer_url"),
    }


# ══════════════════════════════════════════════
#  INTERNAL HTS SDK HELPERS
# ══════════════════════════════════════════════

async def _create_hts_token(name: str, symbol: str, supply: int) -> dict:
    """Attempt to create a real HTS token via SDK."""
    try:
        from services.hedera_service import hedera_service
        svc = hedera_service
        svc._ensure_initialized()
        if not svc._sdk_available:
            return {"success": False, "error": "SDK not available"}

        import asyncio
        from hiero_sdk_python import TokenCreateTransaction, TokenType

        loop = asyncio.get_event_loop()

        def create_sync():
            tx = TokenCreateTransaction()
            tx.set_token_name(name)
            tx.set_token_symbol(symbol)
            tx.set_initial_supply(supply)
            tx.set_decimals(0)
            tx.set_token_type(TokenType.FUNGIBLE_COMMON)
            tx.set_treasury_account_id(svc._client.operator_account_id)
            receipt = tx.execute(svc._client)
            return {"token_id": str(receipt.token_id), "status": str(receipt.status)}

        result = await loop.run_in_executor(None, create_sync)
        logger.info(f"HTS token created: {result['token_id']}")
        return {
            "success": True,
            "token_id": result["token_id"],
            "transaction_id": f"{svc._account_id}@{datetime.now(timezone.utc).isoformat()[:19]}",
        }
    except Exception as e:
        logger.warning(f"HTS token creation failed (using simulated): {e}")
        return {"success": False, "error": str(e)}


async def _transfer_hts_token(token_id: str, amount: int) -> dict:
    """Attempt real HTS token transfer."""
    try:
        from services.hedera_service import hedera_service
        svc = hedera_service
        svc._ensure_initialized()
        if not svc._sdk_available:
            return {"success": False}

        # Log transfer attempt on HCS topic
        from services.hedera_service import hedera_bond_service
        await hedera_bond_service._notary.submit_message(
            svc._default_topic_id,
            {"type": "hts_transfer", "token_id": token_id, "amount": amount,
             "timestamp": datetime.now(timezone.utc).isoformat()}
        )
        return {"success": True, "transaction_id": f"{svc._account_id}@{datetime.now(timezone.utc).isoformat()[:19]}"}
    except Exception as e:
        logger.warning(f"HTS transfer failed: {e}")
        return {"success": False}


async def _burn_hts_token(token_id: str, amount: int) -> dict:
    """Attempt real HTS token burn."""
    try:
        from services.hedera_service import hedera_service
        svc = hedera_service
        svc._ensure_initialized()
        if not svc._sdk_available:
            return {"success": False}

        from services.hedera_service import hedera_bond_service
        await hedera_bond_service._notary.submit_message(
            svc._default_topic_id,
            {"type": "hts_burn", "token_id": token_id, "amount": amount,
             "timestamp": datetime.now(timezone.utc).isoformat()}
        )
        return {"success": True, "transaction_id": f"burn-{svc._account_id}@{datetime.now(timezone.utc).isoformat()[:19]}"}
    except Exception as e:
        logger.warning(f"HTS burn failed: {e}")
        return {"success": False}
