"""
Blockchain API Routes for Document Notarization on Hedera
Supports dynamic HCS topic creation per notarization session
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
    session_topic_id: Optional[str] = None  # Use session-specific topic
    metadata: Optional[Dict[str, Any]] = None


class VerifyDocumentRequest(BaseModel):
    document_hash: str
    transaction_id: str


class CreateTopicRequest(BaseModel):
    memo: Optional[str] = "NotaryChain Session"
    notarization_request_id: Optional[str] = None


class SubmitMessageRequest(BaseModel):
    topic_id: str
    message_type: str  # e.g., "session_start", "document_uploaded", "verification_complete"
    data: Optional[Dict[str, Any]] = None


@router.get("/status")
async def blockchain_status():
    """
    Check Hedera blockchain connection status including SDK availability
    """
    status = hedera_service.get_status()
    
    return {
        "connected": status["configured"],
        "sdk_available": status["sdk_available"],
        "network": status["network"],
        "account_id": status["account_id"][:10] + "..." if status["account_id"] else None,
        "default_topic_id": status["default_topic_id"],
        "mirror_url": status["mirror_url"]
    }


@router.post("/topics/create")
async def create_hcs_topic(
    request: CreateTopicRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new HCS topic for a notarization session.
    Each notarization can have its own private audit trail topic.
    """
    try:
        # Create topic with session memo
        memo = f"NotaryChain: {request.memo}"[:100]
        result = await hedera_service.create_topic(memo=memo)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create topic: {result.get('error')}"
            )
        
        # Store topic record in database
        topic_record = {
            "id": str(uuid.uuid4()),
            "topic_id": result["topic_id"],
            "user_id": current_user.id,
            "notarization_request_id": request.notarization_request_id,
            "memo": memo,
            "network": result["network"],
            "explorer_url": result["explorer_url"],
            "created_at": datetime.now(timezone.utc),
            "message_count": 0
        }
        
        await db.hcs_topics.insert_one(topic_record)
        topic_record.pop("_id", None)
        
        # If linked to a notarization request, update the request
        if request.notarization_request_id:
            await db.notarization_requests.update_one(
                {"id": request.notarization_request_id},
                {"$set": {"hcs_topic_id": result["topic_id"]}}
            )
        
        return {
            "success": True,
            "topic": topic_record
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Topic creation failed. Please try again.")


@router.post("/topics/{topic_id}/messages")
async def submit_topic_message(
    topic_id: str,
    request: SubmitMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Submit a message to an HCS topic (audit trail entry).
    """
    try:
        # Build message payload
        message = {
            "type": request.message_type,
            "user_id": current_user.id,
            "data": request.data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        result = await hedera_service.submit_message(topic_id, message)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to submit message: {result.get('error')}"
            )
        
        # Update topic message count
        await db.hcs_topics.update_one(
            {"topic_id": topic_id},
            {"$inc": {"message_count": 1}}
        )
        
        return {
            "success": True,
            "topic_id": topic_id,
            "sequence_number": result.get("sequence_number"),
            "message_hash": result.get("message_hash"),
            "explorer_url": result.get("explorer_url")
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Message submission failed. Please try again.")


@router.get("/topics/my")
async def get_my_topics(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """
    Get all HCS topics created by the current user.
    Note: This route must be defined BEFORE /topics/{topic_id} to avoid 'my' being parsed as a topic_id.
    """
    topics = await db.hcs_topics.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "count": len(topics),
        "topics": topics
    }


@router.get("/topics/{topic_id}")
async def get_topic_info(
    topic_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get information about an HCS topic including messages.
    """
    try:
        # Get topic info from mirror node
        info = await hedera_service.get_topic_info(topic_id)
        
        # Get messages from mirror node
        messages = await hedera_service.get_topic_messages(topic_id, limit=50)
        
        # Get local record
        local_record = await db.hcs_topics.find_one(
            {"topic_id": topic_id},
            {"_id": 0}
        )
        
        return {
            "topic_id": topic_id,
            "info": info.get("data") if info.get("success") else None,
            "messages": messages,
            "message_count": len(messages),
            "local_record": local_record,
            "explorer_url": f"https://hashscan.io/{hedera_service.network}/topic/{topic_id}"
        }
        
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get topic. Please try again.")


@router.post("/seal")
async def seal_document(
    request: SealDocumentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Seal a document on Hedera blockchain.
    Records the document hash with a tamper-proof timestamp.
    Optionally uses a session-specific HCS topic.
    """
    try:
        # Seal on Hedera (optionally using session topic)
        result = await hedera_service.seal_document(
            document_hash=request.document_hash,
            document_name=request.document_name,
            user_id=current_user.id,
            session_topic_id=request.session_topic_id,
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
            "hcs_submitted": result.get("hcs_submitted", False),
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
            "hcs_submitted": result.get("hcs_submitted", False),
            "seal": seal_record
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Seal operation failed. Please try again.")


@router.post("/seal-file")
async def seal_file(
    file: UploadFile = File(...),
    document_name: str = Form(None),
    notary_request_id: str = Form(None),
    session_topic_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and seal a file on Hedera blockchain.
    Computes SHA-256 hash and records on HCS.
    """
    try:
        # Validate file type
        ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'}
        ext = ('.' + file.filename.rsplit('.', 1)[-1].lower()) if file.filename and '.' in file.filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}")

        # Read file content and compute hash
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")
        document_hash = HederaNotaryService.hash_document(content)
        
        # Use filename if no name provided
        doc_name = document_name or file.filename
        
        # Seal on Hedera (optionally using session topic)
        result = await hedera_service.seal_document(
            document_hash=document_hash,
            document_name=doc_name,
            user_id=current_user.id,
            session_topic_id=session_topic_id,
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
            "hcs_submitted": result.get("hcs_submitted", False),
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
            "hcs_submitted": result.get("hcs_submitted", False),
            "seal": seal_record
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="File seal failed. Please try again.")


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
        
    except Exception:
        raise HTTPException(status_code=500, detail="Verification failed. Please try again.")


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
        
    except Exception:
        raise HTTPException(status_code=500, detail="Verification failed. Please try again.")


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
    topic_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """
    Get recent messages from an HCS topic.
    If no topic_id provided, uses the default topic.
    """
    messages = await hedera_service.get_topic_messages(topic_id=topic_id, limit=limit)
    tid = topic_id or os.environ.get('HEDERA_TOPIC_ID')
    return {
        "topic_id": tid,
        "count": len(messages),
        "messages": messages,
        "explorer_url": f"https://hashscan.io/{hedera_service.network}/topic/{tid}" if tid else None
    }


@router.get("/account/balance")
async def get_account_balance(
    current_user: User = Depends(get_current_user)
):
    """
    Get the Hedera account balance (for admin monitoring).
    """
    # Get user role from database
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await hedera_service.get_account_balance()
    return result
