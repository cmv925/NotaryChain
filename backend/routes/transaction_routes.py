"""
Transaction Orchestrator Routes
API endpoints for managing transactions, blueprints, participants, and tasks
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
import logging
import json

from models import User
from models_transaction import (
    TransactionCreate, TransactionType, TransactionStatus,
    TaskStatus, ParticipantRole
)
from routes.auth_routes import get_current_user
from services.transaction_orchestrator import TransactionOrchestratorService
from services.email_service import email_service
from services.ws_manager import ws_manager
from services.task_manager import task_manager
from auth import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

db: AsyncIOMotorDatabase = None
orchestrator: TransactionOrchestratorService = None

def set_db(database):
    global db, orchestrator
    db = database
    # Import hedera service
    from services.hedera_service import hedera_service
    orchestrator = TransactionOrchestratorService(db, hedera_service)


# ============ BLUEPRINTS ============

@router.get("/blueprints")
async def get_blueprints(
    transaction_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get available transaction blueprints"""
    system_blueprints = await orchestrator.get_system_blueprints()
    
    # Get custom blueprints
    query = {"is_active": True}
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    custom_blueprints = await db.transaction_blueprints.find(
        query,
        {"_id": 0}
    ).to_list(50)
    
    # Filter system blueprints by type if specified
    if transaction_type:
        system_blueprints = [bp for bp in system_blueprints if bp["transaction_type"] == transaction_type]
    
    return {
        "system_blueprints": system_blueprints,
        "custom_blueprints": custom_blueprints
    }


@router.get("/blueprints/{blueprint_id}")
async def get_blueprint(
    blueprint_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific blueprint"""
    blueprint = await orchestrator.get_blueprint(blueprint_id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return blueprint


@router.post("/blueprints")
async def create_blueprint(
    blueprint_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a custom blueprint"""
    try:
        blueprint = await orchestrator.create_blueprint(blueprint_data, current_user.id)
        return blueprint
    except Exception as e:
        logger.error(f"Failed to create blueprint: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============ TRANSACTIONS ============

@router.post("")
async def create_transaction(
    transaction_data: TransactionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Create a new transaction"""
    try:
        transaction = await orchestrator.create_transaction(
            transaction_data=transaction_data.dict(),
            owner_id=current_user.id,
            owner_email=current_user.email
        )
        
        # Send invitation emails to participants
        for participant in transaction_data.participants:
            background_tasks.add_task(
                _send_transaction_invite_email,
                participant["email"],
                participant.get("name", participant["email"].split('@')[0]),
                transaction["name"],
                current_user.full_name or current_user.email
            )
        
        return transaction
    except Exception as e:
        logger.error(f"Failed to create transaction: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def get_my_transactions(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get user's transactions"""
    transactions = await orchestrator.get_user_transactions(current_user.id)
    
    if status:
        transactions = [t for t in transactions if t["status"] == status]
    
    return {"transactions": transactions}


@router.get("/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get transaction details"""
    transaction = await orchestrator.get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check user is participant
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")
    
    return transaction


@router.patch("/{transaction_id}/status")
async def update_transaction_status(
    transaction_id: str,
    status: TransactionStatus = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Update transaction status"""
    # Verify ownership
    transaction = await db.transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only transaction owner can change status")
    
    try:
        updated = await orchestrator.update_transaction_status(
            transaction_id, status.value, current_user.id
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transaction_id}/start")
async def start_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start a transaction (change from draft to in_progress)"""
    transaction = await db.transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only transaction owner can start")
    
    if transaction["status"] not in ["draft", "pending_participants"]:
        raise HTTPException(status_code=400, detail="Transaction already started")
    
    # Check if there are pending participants
    pending = await db.transaction_participants.count_documents({
        "transaction_id": transaction_id,
        "status": "invited"
    })
    
    new_status = "pending_participants" if pending > 0 else "in_progress"
    
    updated = await orchestrator.update_transaction_status(
        transaction_id, new_status, current_user.id
    )
    return updated


@router.post("/{transaction_id}/join")
async def join_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Join a transaction user was invited to"""
    try:
        participant = await orchestrator.join_transaction(
            transaction_id, current_user.id, current_user.email
        )
        return {"message": "Successfully joined transaction", "participant": participant}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ PARTICIPANTS ============

@router.get("/{transaction_id}/participants")
async def get_participants(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get transaction participants"""
    # Verify user is participant
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    participants = await orchestrator.get_participants(transaction_id)
    return {"participants": participants}


@router.post("/{transaction_id}/participants")
async def add_participant(
    transaction_id: str,
    participant_data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Add a participant to transaction"""
    # Verify ownership
    transaction = await db.transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can add participants")
    
    try:
        participant = await orchestrator.add_participant(
            transaction_id=transaction_id,
            email=participant_data["email"],
            name=participant_data.get("name", participant_data["email"].split('@')[0]),
            role=participant_data.get("role", "signer"),
            custom_role_name=participant_data.get("custom_role_name")
        )
        
        # Send invite email
        background_tasks.add_task(
            _send_transaction_invite_email,
            participant_data["email"],
            participant_data.get("name", participant_data["email"].split('@')[0]),
            transaction["name"],
            current_user.full_name or current_user.email
        )
        
        return participant
    except Exception as e:
        logger.error(f"Failed to add participant: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============ TASKS ============

@router.get("/{transaction_id}/tasks")
async def get_tasks(
    transaction_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get transaction tasks"""
    # Verify user is participant
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    tasks = await orchestrator.get_tasks(transaction_id)
    
    if status:
        tasks = [t for t in tasks if t["status"] == status]
    
    return {"tasks": tasks}


@router.patch("/{transaction_id}/tasks/{task_id}")
async def update_task(
    transaction_id: str,
    task_id: str,
    task_update: dict,
    current_user: User = Depends(get_current_user)
):
    """Update task status"""
    # Verify user is participant
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not participant.get("can_complete_tasks"):
        raise HTTPException(status_code=403, detail="You cannot complete tasks")
    
    try:
        task = await orchestrator.update_task_status(
            task_id=task_id,
            new_status=task_update.get("status", "pending"),
            user_id=current_user.id,
            notes=task_update.get("notes")
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transaction_id}/tasks/{task_id}/complete")
async def complete_task(
    transaction_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a task as completed"""
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        task = await orchestrator.update_task_status(
            task_id=task_id,
            new_status="completed",
            user_id=current_user.id
        )
        return {"message": "Task completed", "task": task}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ MESSAGES ============

@router.get("/{transaction_id}/messages")
async def get_messages(
    transaction_id: str,
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user)
):
    """Get transaction room messages"""
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await orchestrator.get_messages(transaction_id, limit)
    return {"messages": messages}


@router.post("/{transaction_id}/messages")
async def send_message(
    transaction_id: str,
    message_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Send a message in transaction room"""
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not participant.get("can_send_messages"):
        raise HTTPException(status_code=403, detail="You cannot send messages")
    
    message = await orchestrator.send_message(
        transaction_id=transaction_id,
        sender_participant_id=participant["id"],
        sender_name=participant.get("name", current_user.email),
        content=message_data["content"],
        message_type=message_data.get("type", "text"),
        attachments=message_data.get("attachments")
    )

    # Broadcast new message via WebSocket
    await ws_manager.broadcast(transaction_id, {
        "type": "new_message",
        "message": _serialize(message),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return message


# ============ AI ORCHESTRATION ============

@router.get("/{transaction_id}/ai/recommendations")
async def get_ai_recommendations(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered recommendations for transaction"""
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        recommendations = await orchestrator.get_ai_recommendations(transaction_id)
        return recommendations
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ SETTLEMENT ============

@router.post("/{transaction_id}/settle")
async def settle_transaction(
    transaction_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Settle and seal transaction on blockchain"""
    # Verify ownership
    transaction = await db.transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can settle transaction")
    
    try:
        result = await orchestrator.settle_transaction(transaction_id, current_user.id)
        
        # Send completion emails to all participants
        participants = await orchestrator.get_participants(transaction_id)
        for p in participants:
            background_tasks.add_task(
                _send_transaction_complete_email,
                p["email"],
                p.get("name", "Participant"),
                transaction["name"],
                result.get("settlement_hash")
            )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ TRANSACTION ROOM DATA ============

@router.get("/{transaction_id}/room")
async def get_transaction_room(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all transaction room data (transaction, participants, tasks, messages)"""
    # Verify user is participant
    participant = await db.transaction_participants.find_one({
        "transaction_id": transaction_id,
        "user_id": current_user.id
    })
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update last active
    await db.transaction_participants.update_one(
        {"id": participant["id"]},
        {"$set": {"last_active_at": datetime.now(timezone.utc)}}
    )
    
    transaction = await orchestrator.get_transaction(transaction_id)
    participants = await orchestrator.get_participants(transaction_id)
    tasks = await orchestrator.get_tasks(transaction_id)
    messages = await orchestrator.get_messages(transaction_id, limit=50)
    
    # Get documents
    documents = await db.transaction_documents.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "storage_url": 0}
    ).to_list(100)
    
    for doc in documents:
        if isinstance(doc.get("uploaded_at"), datetime):
            doc["uploaded_at"] = doc["uploaded_at"].isoformat()
    
    return {
        "transaction": transaction,
        "participants": participants,
        "tasks": tasks,
        "messages": messages,
        "documents": documents,
        "current_participant": {k: v for k, v in participant.items() if k != "_id"}
    }


# ============ HELPER FUNCTIONS ============

async def _send_transaction_invite_email(
    email: str,
    name: str,
    transaction_name: str,
    inviter_name: str
):
    """Send transaction invitation email"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 40px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
            .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
            h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
            p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
            .highlight {{ color: #00d4aa; font-weight: 600; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a89d 100%); color: #000000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">NotaryChain</div>
            </div>
            <div class="content">
                <h1>You're Invited to a Transaction</h1>
                <p>Hi {name},</p>
                <p><span class="highlight">{inviter_name}</span> has invited you to participate in:</p>
                <p style="font-size: 18px; color: #fff; margin: 20px 0;"><strong>{transaction_name}</strong></p>
                <p>This is a secure, blockchain-verified transaction managed through NotaryChain's AI Transaction Orchestrator.</p>
                <p>Log in to your NotaryChain account to join this transaction and view your assigned tasks.</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 NotaryChain. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    await email_service.send_email(
        to_email=email,
        subject=f"You're invited to: {transaction_name}",
        html_content=html
    )


async def _send_transaction_complete_email(
    email: str,
    name: str,
    transaction_name: str,
    settlement_hash: str
):
    """Send transaction completion email"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 40px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
            .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
            .success-badge {{ display: inline-block; background: #00d4aa; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
            h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
            p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
            .hash-box {{ background: #0d1b2a; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #00d4aa; }}
            .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">NotaryChain</div>
            </div>
            <div class="content">
                <span class="success-badge">TRANSACTION COMPLETE</span>
                <h1>Transaction Successfully Settled</h1>
                <p>Hi {name},</p>
                <p>The transaction <strong>{transaction_name}</strong> has been successfully completed and sealed on the blockchain.</p>
                <p>Settlement Hash:</p>
                <div class="hash-box">{settlement_hash or 'N/A'}</div>
                <p>This settlement is immutable and can be verified at any time through the NotaryChain platform.</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 NotaryChain. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    await email_service.send_email(
        to_email=email,
        subject=f"Transaction Complete: {transaction_name}",
        html_content=html
    )
