"""
Public API Routes
Rate-limited endpoints for third-party integrations, authenticated via API key (X-API-Key header)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from middleware.security import limiter
from routes.api_key_routes import get_api_key_user
from services.hedera_service import hedera_service
import uuid
import hashlib
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["public-api"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class SealRequest(BaseModel):
    document_name: str
    document_hash: str
    metadata: Optional[dict] = None

class VerifyRequest(BaseModel):
    document_hash: str


# --- Helpers ---

async def _log_api_call(user_id: str, key_id: str, endpoint: str, method: str, status_code: int):
    await db.api_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "key_id": key_id,
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def _check_scope(key_doc: dict, required: str):
    if required not in key_doc.get("scopes", []):
        raise HTTPException(status_code=403, detail=f"API key missing required scope: {required}")


# --- Public Endpoints ---

@router.get("/status")
async def api_status():
    """Public API status — no auth required"""
    return {
        "status": "operational",
        "version": "1.0.0",
        "docs": "/developers",
    }


@router.post("/seal")
@limiter.limit("30/minute")
async def seal_document(
    request: Request,
    body: SealRequest,
    auth: tuple = Depends(get_api_key_user),
):
    """Seal a document hash on the Hedera blockchain"""
    user_doc, key_doc = auth
    _check_scope(key_doc, "seal")

    user_id = user_doc["id"]

    # Check subscription limits
    user_plan = user_doc.get("subscription_plan", "starter")
    seal_count = await db.document_seals.count_documents({"user_id": user_id})
    limits = {"starter": 10, "pro": 100, "enterprise": 10000}
    if seal_count >= limits.get(user_plan, 10):
        await _log_api_call(user_id, key_doc["id"], "/v1/seal", "POST", 429)
        raise HTTPException(status_code=429, detail=f"Seal limit reached for {user_plan} plan. Upgrade at /pricing")

    # Seal on blockchain
    seal_result = None
    try:
        topic_result = await hedera_service.create_topic(memo=f"API Seal: {body.document_name[:50]}")
        if topic_result.get("success"):
            seal_result = await hedera_service.submit_message(topic_result["topic_id"], {
                "type": "DOCUMENT_SEALED",
                "document_hash": body.document_hash,
                "document_name": body.document_name,
                "sealed_by": user_id,
                "sealed_via": "api",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        logger.error(f"Public API seal failed: {e}")

    # Store seal record
    seal_id = str(uuid.uuid4())
    seal_doc = {
        "id": seal_id,
        "user_id": user_id,
        "document_name": body.document_name,
        "sha256_hash": body.document_hash,
        "file_type": "api",
        "file_size": 0,
        "transaction_id": seal_result.get("sequence_number") if seal_result else None,
        "topic_id": topic_result.get("topic_id") if topic_result and topic_result.get("success") else None,
        "metadata": body.metadata or {},
        "source": "api",
        "timestamp": datetime.now(timezone.utc),
    }
    await db.document_seals.insert_one(seal_doc)

    await _log_api_call(user_id, key_doc["id"], "/v1/seal", "POST", 200)

    return {
        "seal_id": seal_id,
        "document_hash": body.document_hash,
        "blockchain": {
            "network": "hedera_testnet",
            "topic_id": seal_doc.get("topic_id"),
            "sequence_number": seal_doc.get("transaction_id"),
        },
        "sealed_at": seal_doc["timestamp"].isoformat(),
    }


@router.post("/verify")
@limiter.limit("60/minute")
async def verify_document(
    request: Request,
    body: VerifyRequest,
    auth: tuple = Depends(get_api_key_user),
):
    """Verify if a document hash has been sealed on the blockchain"""
    user_doc, key_doc = auth
    _check_scope(key_doc, "verify")

    seal = await db.document_seals.find_one(
        {"sha256_hash": body.document_hash},
        {"_id": 0}
    )

    await _log_api_call(user_doc["id"], key_doc["id"], "/v1/verify", "POST", 200)

    if not seal:
        return {
            "verified": False,
            "document_hash": body.document_hash,
            "message": "No seal found for this document hash",
        }

    return {
        "verified": True,
        "seal_id": seal.get("id"),
        "document_name": seal.get("document_name"),
        "document_hash": body.document_hash,
        "blockchain": {
            "network": "hedera_testnet",
            "topic_id": seal.get("topic_id"),
            "sequence_number": seal.get("transaction_id"),
        },
        "sealed_at": seal.get("timestamp").isoformat() if isinstance(seal.get("timestamp"), datetime) else str(seal.get("timestamp")),
        "sealed_by": seal.get("user_id"),
    }


@router.get("/seals")
@limiter.limit("60/minute")
async def list_seals(
    request: Request,
    limit: int = 20,
    skip: int = 0,
    auth: tuple = Depends(get_api_key_user),
):
    """List document seals for the authenticated user"""
    user_doc, key_doc = auth
    _check_scope(key_doc, "read")

    seals = await db.document_seals.find(
        {"user_id": user_doc["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(min(limit, 100)).to_list(100)

    # Convert datetime objects to strings
    for s in seals:
        if isinstance(s.get("timestamp"), datetime):
            s["timestamp"] = s["timestamp"].isoformat()

    total = await db.document_seals.count_documents({"user_id": user_doc["id"]})

    await _log_api_call(user_doc["id"], key_doc["id"], "/v1/seals", "GET", 200)

    return {
        "seals": seals,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/seals/{seal_id}")
@limiter.limit("60/minute")
async def get_seal(
    request: Request,
    seal_id: str,
    auth: tuple = Depends(get_api_key_user),
):
    """Get a specific seal by ID"""
    user_doc, key_doc = auth
    _check_scope(key_doc, "read")

    seal = await db.document_seals.find_one(
        {"id": seal_id, "user_id": user_doc["id"]},
        {"_id": 0}
    )
    if not seal:
        raise HTTPException(status_code=404, detail="Seal not found")

    if isinstance(seal.get("timestamp"), datetime):
        seal["timestamp"] = seal["timestamp"].isoformat()

    await _log_api_call(user_doc["id"], key_doc["id"], f"/v1/seals/{seal_id}", "GET", 200)

    return seal


@router.get("/requests")
@limiter.limit("30/minute")
async def list_requests(
    request: Request,
    status: Optional[str] = None,
    limit: int = 20,
    auth: tuple = Depends(get_api_key_user),
):
    """List notarization requests for the authenticated user"""
    user_doc, key_doc = auth
    _check_scope(key_doc, "read")

    query = {"user_id": user_doc["id"]}
    if status:
        query["status"] = status

    requests = await db.notarization_requests.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 50)).to_list(50)

    for r in requests:
        for field in ["created_at", "scheduled_time", "completed_at"]:
            if isinstance(r.get(field), datetime):
                r[field] = r[field].isoformat()

    await _log_api_call(user_doc["id"], key_doc["id"], "/v1/requests", "GET", 200)

    return {"requests": requests, "total": len(requests)}
