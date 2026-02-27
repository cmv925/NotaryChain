"""
Bulk Notarization Routes
Upload and process multiple documents in a single batch session.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from models import User
from models_notary import NotarizationRequest
from routes.auth_routes import get_current_user
from services.hedera_service import hedera_service
from services.notification_service import create_notification, broadcast_event, get_notary_user_ids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bulk", tags=["bulk-notarization"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class BulkDocumentItem(BaseModel):
    document_name: str
    document_type: str
    notarization_type: str = "ron"
    signers: List[dict] = []
    notes: str = ""


class CreateBulkRequest(BaseModel):
    batch_name: str
    documents: List[BulkDocumentItem]


@router.post("/batches")
async def create_batch(
    body: CreateBulkRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a batch of notarization requests."""
    if len(body.documents) == 0:
        raise HTTPException(status_code=400, detail="At least one document is required")
    if len(body.documents) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 documents per batch")

    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    requests_created = []

    for doc in body.documents:
        req = NotarizationRequest(
            user_id=current_user.id,
            document_name=doc.document_name,
            document_type=doc.document_type,
            notarization_type=doc.notarization_type,
            signers=doc.signers,
            notes=doc.notes,
        )

        # Create HCS topic
        hcs_topic_id = None
        hcs_explorer = None
        try:
            result = await hedera_service.create_topic(
                memo=f"Batch {batch_id[:8]}: {doc.document_type}"
            )
            if result.get("success"):
                hcs_topic_id = result["topic_id"]
                hcs_explorer = result.get("explorer_url")
        except Exception:
            pass

        req_dict = req.dict()
        req_dict["hcs_topic_id"] = hcs_topic_id
        req_dict["hcs_topic_explorer"] = hcs_explorer
        req_dict["batch_id"] = batch_id

        await db.notarization_requests.insert_one(req_dict)
        req_dict.pop("_id", None)
        requests_created.append({
            "id": req_dict["id"],
            "document_name": req_dict["document_name"],
            "document_type": req_dict["document_type"],
            "status": req_dict["status"],
        })

    # Save batch record
    batch = {
        "id": batch_id,
        "user_id": current_user.id,
        "name": body.batch_name,
        "total_documents": len(requests_created),
        "status": "pending",
        "request_ids": [r["id"] for r in requests_created],
        "created_at": now,
        "updated_at": now,
    }
    await db.notarization_batches.insert_one(batch)

    # Notify notaries
    try:
        notary_ids = await get_notary_user_ids()
        await broadcast_event("notary_queue_update", {
            "action": "new_batch",
            "batch_id": batch_id,
            "count": len(requests_created),
        }, target_user_ids=notary_ids)
    except Exception:
        pass

    batch.pop("_id", None)
    return {"batch": batch, "requests": requests_created}


@router.get("/batches")
async def list_batches(
    current_user: User = Depends(get_current_user),
):
    """List all batches for the current user."""
    batches = await db.notarization_batches.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Enrich with completion stats
    for batch in batches:
        request_ids = batch.get("request_ids", [])
        if request_ids:
            completed = await db.notarization_requests.count_documents({
                "id": {"$in": request_ids}, "status": "completed"
            })
            batch["completed_count"] = completed
        else:
            batch["completed_count"] = 0

    return {"batches": batches}


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get batch details with all request statuses."""
    batch = await db.notarization_batches.find_one(
        {"id": batch_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    request_ids = batch.get("request_ids", [])
    requests = await db.notarization_requests.find(
        {"id": {"$in": request_ids}}, {"_id": 0}
    ).to_list(100)

    # Calculate stats
    statuses = {}
    for r in requests:
        s = r.get("status", "pending")
        statuses[s] = statuses.get(s, 0) + 1

    batch["requests"] = [{
        "id": r["id"],
        "document_name": r.get("document_name"),
        "document_type": r.get("document_type"),
        "status": r.get("status"),
        "notary_id": r.get("notary_id"),
        "created_at": r.get("created_at"),
        "completed_at": r.get("completed_at"),
    } for r in requests]
    batch["status_breakdown"] = statuses

    return batch


@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a batch (only if all requests are still pending)."""
    batch = await db.notarization_batches.find_one(
        {"id": batch_id, "user_id": current_user.id}
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    request_ids = batch.get("request_ids", [])
    non_pending = await db.notarization_requests.count_documents({
        "id": {"$in": request_ids}, "status": {"$ne": "pending"}
    })
    if non_pending > 0:
        raise HTTPException(status_code=400, detail="Cannot delete batch with non-pending requests")

    await db.notarization_requests.delete_many({"id": {"$in": request_ids}})
    await db.notarization_batches.delete_one({"id": batch_id})

    return {"message": "Batch deleted", "documents_removed": len(request_ids)}
