"""
Organization Document Vault
Stores and manages documents within organizations with role-based access and audit trails.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import os
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vault", tags=["vault"])

db: AsyncIOMotorDatabase = None

UPLOAD_DIR = "/tmp/notary_vault"
os.makedirs(UPLOAD_DIR, exist_ok=True)

CATEGORIES = ["contracts", "agreements", "notarized", "identity", "financial", "legal", "other"]

def set_db(database):
    global db
    db = database


async def _get_membership(org_id: str, user_id: str):
    return await db.org_members.find_one(
        {"org_id": org_id, "user_id": user_id, "status": "active"},
        {"_id": 0}
    )

async def _require_member(org_id: str, user_id: str):
    membership = await _get_membership(org_id, user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return membership

async def _require_admin(org_id: str, user_id: str):
    membership = await _get_membership(org_id, user_id)
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership

async def _add_audit_entry(doc_id: str, action: str, user_email: str, user_id: str, details: str = ""):
    entry = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "action": action,
        "user_email": user_email,
        "user_id": user_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.vault_audit.insert_one(entry)
    return entry


# --- Upload Document ---

@router.post("/{org_id}/documents")
async def upload_document(
    org_id: str,
    file: UploadFile = File(...),
    name: str = Form(None),
    category: str = Form("other"),
    tags: str = Form(""),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user),
):
    """Upload a document to the org vault (admin/owner only)."""
    await _require_admin(org_id, current_user.id)

    if category not in CATEGORIES:
        category = "other"

    # Save file
    doc_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    stored_name = f"{doc_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, stored_name)

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    with open(filepath, "wb") as f:
        f.write(content)

    now = datetime.now(timezone.utc).isoformat()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    doc = {
        "id": doc_id,
        "org_id": org_id,
        "name": name or file.filename,
        "original_filename": file.filename,
        "stored_filename": stored_name,
        "file_size": len(content),
        "content_type": file.content_type,
        "category": category,
        "tags": tag_list,
        "description": description,
        "uploaded_by": current_user.id,
        "uploaded_by_email": current_user.email,
        "uploaded_by_name": current_user.full_name,
        "created_at": now,
        "updated_at": now,
        "download_count": 0,
        "view_count": 0,
    }
    await db.vault_documents.insert_one(doc)
    doc.pop("_id", None)

    await _add_audit_entry(doc_id, "uploaded", current_user.email, current_user.id, f"Uploaded {file.filename}")

    return doc


# --- List Documents ---

@router.get("/{org_id}/documents")
async def list_documents(
    org_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List documents in the org vault (all members)."""
    await _require_member(org_id, current_user.id)

    query = {"org_id": org_id}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if tag:
        query["tags"] = tag

    docs = await db.vault_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    categories_used = await db.vault_documents.distinct("category", {"org_id": org_id})
    all_tags = await db.vault_documents.distinct("tags", {"org_id": org_id})

    return {
        "documents": docs,
        "total": len(docs),
        "categories": categories_used,
        "tags": all_tags,
    }


# --- Get Document Detail ---

@router.get("/{org_id}/documents/{doc_id}")
async def get_document(org_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get document details with audit trail (all members)."""
    await _require_member(org_id, current_user.id)

    doc = await db.vault_documents.find_one({"id": doc_id, "org_id": org_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Track view
    await db.vault_documents.update_one({"id": doc_id}, {"$inc": {"view_count": 1}})
    await _add_audit_entry(doc_id, "viewed", current_user.email, current_user.id)

    # Get audit trail
    audit = await db.vault_audit.find(
        {"document_id": doc_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(50)

    doc["audit_trail"] = audit
    return doc


# --- Download Document ---

@router.get("/{org_id}/documents/{doc_id}/download")
async def download_document(org_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    """Download a document from the vault (all members)."""
    await _require_member(org_id, current_user.id)

    doc = await db.vault_documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = os.path.join(UPLOAD_DIR, doc["stored_filename"])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")

    await db.vault_documents.update_one({"id": doc_id}, {"$inc": {"download_count": 1}})
    await _add_audit_entry(doc_id, "downloaded", current_user.email, current_user.id)

    from fastapi.responses import FileResponse
    return FileResponse(
        filepath,
        media_type=doc.get("content_type", "application/octet-stream"),
        filename=doc["original_filename"],
    )


# --- Update Document ---

class UpdateDocRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None

@router.put("/{org_id}/documents/{doc_id}")
async def update_document(
    org_id: str, doc_id: str, body: UpdateDocRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update document metadata (admin/owner only)."""
    await _require_admin(org_id, current_user.id)

    doc = await db.vault_documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    changes = []
    if body.name is not None:
        update["name"] = body.name
        changes.append(f"name → {body.name}")
    if body.category is not None:
        update["category"] = body.category
        changes.append(f"category → {body.category}")
    if body.tags is not None:
        update["tags"] = body.tags
        changes.append("tags updated")
    if body.description is not None:
        update["description"] = body.description
        changes.append("description updated")

    await db.vault_documents.update_one({"id": doc_id}, {"$set": update})
    await _add_audit_entry(doc_id, "updated", current_user.email, current_user.id, "; ".join(changes))

    updated = await db.vault_documents.find_one({"id": doc_id}, {"_id": 0})
    return updated


# --- Delete Document ---

@router.delete("/{org_id}/documents/{doc_id}")
async def delete_document(org_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document from the vault (admin/owner only)."""
    await _require_admin(org_id, current_user.id)

    doc = await db.vault_documents.find_one({"id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = os.path.join(UPLOAD_DIR, doc["stored_filename"])
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.vault_documents.delete_one({"id": doc_id})
    await db.vault_audit.delete_many({"document_id": doc_id})

    return {"message": "Document deleted"}


# --- Stats ---

@router.get("/{org_id}/stats")
async def vault_stats(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get vault statistics for the org."""
    await _require_member(org_id, current_user.id)

    total = await db.vault_documents.count_documents({"org_id": org_id})
    categories = await db.vault_documents.aggregate([
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]).to_list(20)

    total_size = 0
    async for doc in db.vault_documents.find({"org_id": org_id}, {"file_size": 1}):
        total_size += doc.get("file_size", 0)

    return {
        "total_documents": total,
        "total_size_bytes": total_size,
        "categories": {c["_id"]: c["count"] for c in categories},
    }
