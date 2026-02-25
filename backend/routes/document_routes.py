from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from models import DocumentSeal, DocumentSealCreate, DocumentSealResponse, User
from routes.auth_routes import get_current_user
import os

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "/tmp/notary_uploads"

# This will be injected from main server.py
db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

@router.post("/seal", response_model=DocumentSealResponse)
async def create_document_seal(
    document_data: DocumentSealCreate,
    current_user: User = Depends(get_current_user)
):
    # Create document seal
    document = DocumentSeal(
        user_id=current_user.id,
        file_name=document_data.file_name,
        file_size=document_data.file_size,
        file_type=document_data.file_type,
        sha256_hash=document_data.sha256_hash,
        transaction_id=document_data.transaction_id
    )
    
    await db.document_seals.insert_one(document.dict())
    
    return DocumentSealResponse(**document.dict())

@router.get("/seals", response_model=List[DocumentSealResponse])
async def get_user_document_seals(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0
):
    # Get user's document seals
    cursor = db.document_seals.find({"user_id": current_user.id})
    cursor = cursor.sort("timestamp", -1).skip(skip).limit(limit)
    
    documents = await cursor.to_list(length=limit)
    
    return [DocumentSealResponse(**doc) for doc in documents]

@router.get("/seals/{document_id}", response_model=DocumentSealResponse)
async def get_document_seal(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    # Get specific document seal
    document = await db.document_seals.find_one({
        "id": document_id,
        "user_id": current_user.id
    })
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return DocumentSealResponse(**document)

@router.get("/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user)
):
    # Get user statistics
    total_seals = await db.document_seals.count_documents({"user_id": current_user.id})
    
    # Get seals in last 30 days
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_seals = await db.document_seals.count_documents({
        "user_id": current_user.id,
        "timestamp": {"$gte": thirty_days_ago}
    })
    
    return {
        "total_seals": total_seals,
        "recent_seals": recent_seals,
        "user_since": current_user.created_at
    }