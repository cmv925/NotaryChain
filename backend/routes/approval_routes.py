"""
Approval Workflow Routes
Multi-step approval chains for documents and transactions.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class CreateApprovalRequest(BaseModel):
    document_name: str
    document_id: Optional[str] = None
    description: Optional[str] = ""
    approval_chain: List[dict]  # [{"approver_email": "...", "role": "manager", "order": 1}, ...]


class ApprovalActionRequest(BaseModel):
    action: str  # "approve" or "reject"
    comment: Optional[str] = ""


@router.post("/")
async def create_approval_request(
    body: CreateApprovalRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new multi-step approval request."""
    if not body.approval_chain:
        raise HTTPException(status_code=400, detail="At least one approver required")

    # Resolve approver user IDs
    steps = []
    # Sort by order field - use 9999 as default for items without order
    sorted_chain = sorted(body.approval_chain, key=lambda x: x.get("order", 9999))
    for i, link in enumerate(sorted_chain):
        email = link.get("approver_email", "")
        user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "full_name": 1})
        steps.append({
            "step_order": i + 1,
            "approver_email": email,
            "approver_id": user["id"] if user else None,
            "approver_name": user.get("full_name", email) if user else email,
            "role": link.get("role", "approver"),
            "status": "pending" if i == 0 else "waiting",
            "action_at": None,
            "comment": "",
        })

    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": request_id,
        "requester_id": current_user.id,
        "requester_name": current_user.full_name,
        "document_name": body.document_name,
        "document_id": body.document_id,
        "description": body.description,
        "steps": steps,
        "current_step": 1,
        "total_steps": len(steps),
        "status": "pending",  # pending | approved | rejected
        "created_at": now,
        "updated_at": now,
    }

    await db.approval_requests.insert_one(record)
    record.pop("_id", None)

    # Notify first approver
    first = steps[0]
    if first.get("approver_id"):
        from services.notification_service import create_notification
        await create_notification(
            user_id=first["approver_id"],
            title="Approval Required",
            message=f'{current_user.full_name} requests approval for "{body.document_name}"',
            notif_type="action",
            link="/approvals",
        )

    return record


@router.get("/pending")
async def get_pending_approvals(current_user: User = Depends(get_current_user)):
    """Get approval requests where the current user is the active approver."""
    requests = await db.approval_requests.find(
        {
            "status": "pending",
            "steps": {
                "$elemMatch": {
                    "approver_id": current_user.id,
                    "status": "pending",
                }
            },
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"requests": requests}


@router.get("/my")
async def get_my_requests(current_user: User = Depends(get_current_user)):
    """Get approval requests created by or involving the current user."""
    requests = await db.approval_requests.find(
        {
            "$or": [
                {"requester_id": current_user.id},
                {"steps.approver_id": current_user.id},
            ]
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"requests": requests}


@router.post("/{request_id}/action")
async def take_approval_action(
    request_id: str,
    body: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Approve or reject at the current step."""
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    req = await db.approval_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    # Find the current pending step for this user
    step_idx = None
    for i, step in enumerate(req["steps"]):
        if step["approver_id"] == current_user.id and step["status"] == "pending":
            step_idx = i
            break

    if step_idx is None:
        raise HTTPException(status_code=403, detail="You are not the current approver")

    now = datetime.now(timezone.utc).isoformat()
    req["steps"][step_idx]["status"] = "approved" if body.action == "approve" else "rejected"
    req["steps"][step_idx]["action_at"] = now
    req["steps"][step_idx]["comment"] = body.comment or ""

    if body.action == "reject":
        req["status"] = "rejected"
    elif body.action == "approve":
        # Advance to next step or complete
        next_step = step_idx + 1
        if next_step < len(req["steps"]):
            req["steps"][next_step]["status"] = "pending"
            req["current_step"] = next_step + 1
            # Notify next approver
            next_approver = req["steps"][next_step]
            if next_approver.get("approver_id"):
                from services.notification_service import create_notification
                await create_notification(
                    user_id=next_approver["approver_id"],
                    title="Approval Required",
                    message=f'"{req["document_name"]}" needs your approval (step {next_step + 1}/{req["total_steps"]})',
                    notif_type="action",
                    link="/approvals",
                )
        else:
            req["status"] = "approved"

    req["updated_at"] = now
    await db.approval_requests.update_one(
        {"id": request_id},
        {"$set": {
            "steps": req["steps"],
            "current_step": req.get("current_step", 1),
            "status": req["status"],
            "updated_at": now,
        }},
    )

    # Notify requester
    from services.notification_service import create_notification
    await create_notification(
        user_id=req["requester_id"],
        title=f'Approval {body.action.title()}d',
        message=f'{current_user.full_name} {body.action}d "{req["document_name"]}" at step {step_idx + 1}',
        notif_type="success" if body.action == "approve" else "warning",
        link="/approvals",
    )

    req.pop("_id", None)
    return req


@router.get("/{request_id}")
async def get_approval_detail(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific approval request."""
    req = await db.approval_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    return req
