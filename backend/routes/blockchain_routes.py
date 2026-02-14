"""
Blockchain API Routes for Document Notarization on Hedera
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os

from models import User
from routes.auth_routes import get_current_user
from services.hedera_service import hedera_service, HederaNotaryService

router = APIRouter(prefix="/api/blockchain", tags=["blockchain"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class SealDocumentRequest(BaseModel):
    document_name: str
    document_hash: str
    notary_request_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class VerifyDocumentRequest(BaseModel):
    document_hash: str
    transaction_id: str


@router.get("/status")
async def blockchain_status():
    """
    Check Hedera blockchain connection status
    """
    account_id = os.environ.get('HEDERA_ACCOUNT_ID')
    network = os.environ.get('HEDERA_NETWORK', 'testnet')
    topic_id = os.environ.get('HEDERA_TOPIC_ID')
    
    return {
        "connected": bool(account_id),
        "network": network,
        "account_id": account_id[:10] + "..." if account_id else None,
        "topic_configured": bool(topic_id),
        "topic_id": topic_id
    }


@router.post("/seal")
async def seal_document(
    request: SealDocumentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Seal a document on Hedera blockchain.
    Records the document hash with a tamper-proof timestamp.
    """
    try:
        # Seal on Hedera
        result = await hedera_service.seal_document(
            document_hash=request.document_hash,
            document_name=request.document_name,
            user_id=current_user.id,
            metadata=request.metadata
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500, 
                detail=f"Blockchain seal failed: {result.get('error', 'Unknown error')}"
            )
        
        # Store seal record in database
        seal_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "document_name": request.document_name,
            "document_hash": request.document_hash,
            "notary_request_id": request.notary_request_id,
            "transaction_id": result["transaction_id"],
            "topic_id": result["topic_id"],
            "sequence_number": result.get("sequence_number"),
            "network": result["network"],
            "explorer_url": result["explorer_url"],
            "sealed_at": datetime.now(timezone.utc),
            "metadata": request.metadata
        }
        
        await db.blockchain_seals.insert_one(seal_record)
        
        # Remove MongoDB _id before returning
        seal_record.pop("_id", None)
        
        return {
            "success": True,
            "seal": seal_record
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seal operation failed: {str(e)}")


@router.post("/seal-file")
async def seal_file(
    file: UploadFile = File(...),
    document_name: str = Form(None),
    notary_request_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and seal a file on Hedera blockchain.
    Computes SHA-256 hash and records on HCS.
    """
    try:
        # Read file content and compute hash
        content = await file.read()
        document_hash = HederaNotaryService.hash_document(content)
        
        # Use filename if no name provided
        doc_name = document_name or file.filename
        
        # Seal on Hedera
        result = await hedera_service.seal_document(
            document_hash=document_hash,
            document_name=doc_name,
            user_id=current_user.id,
            metadata={
                "original_filename": file.filename,
                "content_type": file.content_type,
                "file_size": len(content)
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Blockchain seal failed: {result.get('error', 'Unknown error')}"
            )
        
        # Store seal record
        seal_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "document_name": doc_name,
            "document_hash": document_hash,
            "notary_request_id": notary_request_id,
            "transaction_id": result["transaction_id"],
            "topic_id": result["topic_id"],
            "sequence_number": result.get("sequence_number"),
            "network": result["network"],
            "explorer_url": result["explorer_url"],
            "sealed_at": datetime.now(timezone.utc),
            "file_metadata": {
                "original_filename": file.filename,
                "content_type": file.content_type,
                "file_size": len(content)
            }
        }
        
        await db.blockchain_seals.insert_one(seal_record)
        seal_record.pop("_id", None)
        
        return {
            "success": True,
            "document_hash": document_hash,
            "seal": seal_record
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File seal failed: {str(e)}")


@router.post("/verify")
async def verify_document(request: VerifyDocumentRequest):
    """
    Verify a document seal on Hedera blockchain.
    Public endpoint - no authentication required.
    """
    try:
        # Check local database first
        local_record = await db.blockchain_seals.find_one({
            "document_hash": request.document_hash,
            "transaction_id": request.transaction_id
        }, {"_id": 0})
        
        # Verify on blockchain
        blockchain_result = await hedera_service.verify_document(
            document_hash=request.document_hash,
            transaction_id=request.transaction_id
        )
        
        return {
            "document_hash": request.document_hash,
            "transaction_id": request.transaction_id,
            "blockchain_verified": blockchain_result.get("verified", False),
            "consensus_timestamp": blockchain_result.get("consensus_timestamp"),
            "local_record_found": local_record is not None,
            "local_record": local_record,
            "explorer_url": blockchain_result.get("explorer_url"),
            "network": blockchain_result.get("network")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.get("/verify/{document_hash}")
async def verify_by_hash(document_hash: str):
    """
    Verify a document by its hash.
    Looks up the transaction from local records.
    Public endpoint.
    """
    try:
        # Find seal record by hash
        seal_record = await db.blockchain_seals.find_one({
            "document_hash": document_hash
        }, {"_id": 0})
        
        if not seal_record:
            return {
                "found": False,
                "document_hash": document_hash,
                "message": "No blockchain seal found for this document hash"
            }
        
        # Verify on blockchain
        blockchain_result = await hedera_service.verify_document(
            document_hash=document_hash,
            transaction_id=seal_record["transaction_id"]
        )
        
        return {
            "found": True,
            "document_hash": document_hash,
            "document_name": seal_record.get("document_name"),
            "sealed_at": seal_record.get("sealed_at"),
            "transaction_id": seal_record.get("transaction_id"),
            "blockchain_verified": blockchain_result.get("verified", False),
            "consensus_timestamp": blockchain_result.get("consensus_timestamp"),
            "explorer_url": seal_record.get("explorer_url"),
            "network": seal_record.get("network")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.get("/seals/my")
async def get_my_seals(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """
    Get all blockchain seals for the current user.
    """
    seals = await db.blockchain_seals.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("sealed_at", -1).limit(limit).to_list(limit)
    
    return {
        "count": len(seals),
        "seals": seals
    }


@router.get("/seals/{seal_id}")
async def get_seal(
    seal_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific blockchain seal by ID.
    """
    seal = await db.blockchain_seals.find_one({
        "id": seal_id,
        "user_id": current_user.id
    }, {"_id": 0})
    
    if not seal:
        raise HTTPException(status_code=404, detail="Seal not found")
    
    return seal


@router.get("/topic/messages")
async def get_topic_messages(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """
    Get recent messages from the notary HCS topic.
    """
    messages = await hedera_service.get_topic_messages(limit=limit)
    return {
        "topic_id": os.environ.get('HEDERA_TOPIC_ID'),
        "count": len(messages),
        "messages": messages
    }
