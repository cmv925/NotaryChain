from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from models import DocumentSeal, DocumentSealCreate, DocumentSealResponse, User
from routes.auth_routes import get_current_user
from services.storage_service import storage_service
import os

router = APIRouter(prefix="/api/documents", tags=["documents"])

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

@router.get("/seals")
async def get_user_document_seals(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0
):
    # Get user's document seals
    cursor = db.document_seals.find(
        {"user_id": current_user.id},
        {"_id": 0, "file_name": 1, "fileName": 1, "file_size": 1, "fileSize": 1, "file_type": 1, "fileType": 1, "sha256_hash": 1, "transaction_id": 1, "timestamp": 1, "user_id": 1, "topic_id": 1, "status": 1}
    )
    cursor = cursor.sort("timestamp", -1).skip(skip).limit(limit)
    
    documents = await cursor.to_list(length=limit)
    
    # Normalize data to handle legacy records
    results = []
    for doc in documents:
        doc["file_name"] = str(doc.get("file_name", doc.get("fileName", "Unknown")))
        doc["file_size"] = str(doc.get("file_size", doc.get("fileSize", "0")))
        doc["file_type"] = str(doc.get("file_type", doc.get("fileType", "")))
        doc["sha256_hash"] = str(doc.get("sha256_hash", doc.get("hash", "")))
        doc["transaction_id"] = str(doc.get("transaction_id", doc.get("txId", "")))
        results.append(doc)
    
    return results

@router.get("/seals/{document_id}", response_model=DocumentSealResponse)
async def get_document_seal(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    # Get specific document seal
    document = await db.document_seals.find_one({
        "id": document_id,
        "user_id": current_user.id
    }, {"_id": 0})
    
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
    from datetime import datetime, timedelta, timezone
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_seals = await db.document_seals.count_documents({
        "user_id": current_user.id,
        "timestamp": {"$gte": thirty_days_ago}
    })
    
    return {
        "total_seals": total_seals,
        "recent_seals": recent_seals,
        "user_since": current_user.created_at
    }


@router.get("/files/{filename}")
async def serve_document_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Serve an uploaded document file (authenticated access)"""
    safe_name = os.path.basename(filename)

    # Check DB for storage metadata
    doc_record = await db.document_seals.find_one(
        {"$or": [{"stored_filename": safe_name}, {"stored_filename": {"$regex": safe_name}}]},
        {"_id": 0, "storage_backend": 1, "stored_filename": 1}
    )

    backend = doc_record.get("storage_backend", "local") if doc_record else "local"
    stored_path = doc_record.get("stored_filename", safe_name) if doc_record else safe_name

    # Try presigned URL for S3
    if backend == "s3":
        url = storage_service.get_presigned_url(stored_path)
        if url:
            return RedirectResponse(url=url, status_code=307)

    # Fallback to local file serve
    local_path = await storage_service.get_file_path(stored_path, backend)
    if not local_path:
        raise HTTPException(status_code=404, detail="File not found")

    ext = os.path.splitext(safe_name)[1].lower()
    content_types = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
    }
    media_type = content_types.get(ext, 'application/octet-stream')

    return FileResponse(local_path, media_type=media_type, filename=safe_name, headers={"Content-Disposition": f"attachment; filename={safe_name}"})