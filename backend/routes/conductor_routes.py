"""
AI Conductor Routes
LLM-powered orchestrator that guides each participant through their steps.
Provides contextual instructions, AI interviews, and real-time guidance.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import json
import logging

from models import User
from routes.auth_routes import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conductor", tags=["ai-conductor"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def set_db(database):
    global db
    db = database


class ConductorGuideRequest(BaseModel):
    transaction_id: str


class ConductorChatRequest(BaseModel):
    transaction_id: str
    message: str
    task_id: Optional[str] = None


@router.post("/guide")
async def get_participant_guidance(
    body: ConductorGuideRequest,
    current_user: User = Depends(get_current_user),
):
    """
    AI Conductor generates personalized step-by-step guidance for the
    current participant based on their role, pending tasks, and transaction state.
    """
    transaction = await db.transactions.find_one(
        {"id": body.transaction_id}, {"_id": 0}
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    participant = await db.transaction_participants.find_one(
        {"transaction_id": body.transaction_id, "user_id": current_user.id},
        {"_id": 0},
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")

    # Gather tasks
    all_tasks = await db.transaction_tasks.find(
        {"transaction_id": body.transaction_id}, {"_id": 0}
    ).sort("order", 1).to_list(100)

    # Identify tasks relevant to this participant's role
    my_role = participant.get("role", "signer")
    my_tasks = [t for t in all_tasks if my_role in t.get("assigned_roles", [])]
    pending_tasks = [t for t in my_tasks if t.get("status") in ("pending", "in_progress")]
    completed_tasks = [t for t in my_tasks if t.get("status") == "completed"]
    blocked_tasks = [t for t in my_tasks if t.get("status") == "blocked"]

    # Format dates safely
    for field_list in [all_tasks, my_tasks]:
        for t in field_list:
            for f in ["due_date", "started_at", "completed_at", "created_at"]:
                if f in t and isinstance(t[f], datetime):
                    t[f] = t[f].isoformat()

    context = {
        "transaction_name": transaction.get("name"),
        "transaction_type": transaction.get("transaction_type"),
        "transaction_status": transaction.get("status"),
        "progress": transaction.get("progress_percentage", 0),
        "participant_role": my_role,
        "participant_name": participant.get("name"),
        "total_tasks": len(all_tasks),
        "my_pending_tasks": [{"name": t["name"], "description": t.get("description", ""),
                              "requires_document": t.get("requires_document"),
                              "requires_signature": t.get("requires_signature"),
                              "requires_notarization": t.get("requires_notarization"),
                              "status": t["status"]}
                             for t in pending_tasks],
        "my_completed_tasks": [t["name"] for t in completed_tasks],
        "my_blocked_tasks": [{"name": t["name"], "status": t["status"]} for t in blocked_tasks],
    }

    prompt = f"""You are the AI Conductor for a high-trust digital transaction. Your role is to guide this specific participant through their next steps clearly and precisely.

Transaction context:
{json.dumps(context, indent=2, default=str)}

Provide personalized guidance for this {my_role}. Be specific, actionable, and encouraging.

Return a JSON object:
{{
  "greeting": "Personalized greeting addressing them by role",
  "current_status_summary": "Brief summary of where they stand in this transaction",
  "next_steps": [
    {{
      "step_number": 1,
      "action": "Specific action to take",
      "details": "Detailed instructions on how to complete this step",
      "urgency": "immediate|soon|when_ready",
      "estimated_time": "e.g., 5 minutes, 1-2 hours",
      "documents_needed": ["list of documents if any"],
      "tips": "Helpful tip for this step"
    }}
  ],
  "blockers": [
    {{"issue": "What's blocking", "resolution": "How to resolve"}}
  ],
  "timeline_estimate": "Estimated time to complete all remaining steps",
  "encouragement": "Motivational note about progress"
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"conductor_{body.transaction_id}_{current_user.id}_{datetime.now().timestamp()}",
            system_message="You are an AI Transaction Conductor. Respond with valid JSON only.",
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError:
        result = {
            "greeting": f"Hello {participant.get('name', 'Participant')}",
            "current_status_summary": "Unable to generate AI guidance at this time.",
            "next_steps": [{"step_number": 1, "action": "Review your pending tasks",
                           "details": "Check the task list for your next action items",
                           "urgency": "soon", "estimated_time": "varies"}],
            "blockers": [],
            "timeline_estimate": "Check back for updated guidance",
            "encouragement": "You're making progress!",
        }
    except Exception as e:
        logger.error(f"Conductor guide error: {e}")
        raise HTTPException(status_code=500, detail="AI guidance generation failed")

    # Store guidance for audit
    await db.conductor_guidance.insert_one({
        "transaction_id": body.transaction_id,
        "user_id": current_user.id,
        "role": my_role,
        "guidance": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"guidance": result, "role": my_role, "pending_count": len(pending_tasks)}


@router.post("/chat")
async def conductor_chat(
    body: ConductorChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Interactive chat with the AI Conductor for transaction-specific questions.
    The conductor has full context of the transaction state.
    """
    transaction = await db.transactions.find_one(
        {"id": body.transaction_id}, {"_id": 0}
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    participant = await db.transaction_participants.find_one(
        {"transaction_id": body.transaction_id, "user_id": current_user.id},
        {"_id": 0},
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")

    # Gather context
    tasks = await db.transaction_tasks.find(
        {"transaction_id": body.transaction_id}, {"_id": 0}
    ).to_list(50)
    for t in tasks:
        for f in ["due_date", "started_at", "completed_at", "created_at"]:
            if f in t and isinstance(t[f], datetime):
                t[f] = t[f].isoformat()

    participants = await db.transaction_participants.find(
        {"transaction_id": body.transaction_id},
        {"_id": 0, "name": 1, "role": 1, "status": 1},
    ).to_list(20)

    task_context = ""
    if body.task_id:
        task = next((t for t in tasks if t.get("id") == body.task_id), None)
        if task:
            task_context = f"\nThe user is asking about task: {task['name']} ({task['status']}): {task.get('description', '')}"

    context_summary = f"""Transaction: {transaction.get('name')} ({transaction.get('transaction_type')})
Status: {transaction.get('status')}, Progress: {transaction.get('progress_percentage', 0)}%
User role: {participant.get('role')}
Tasks: {len([t for t in tasks if t['status'] == 'completed'])}/{len(tasks)} completed
Participants: {', '.join(f"{p['name']} ({p['role']})" for p in participants)}{task_context}"""

    prompt = f"""You are the AI Conductor for this transaction. Answer the participant's question with full context.

{context_summary}

Participant's question: {body.message}

Provide a helpful, specific answer. If they ask about process, explain the next steps. If they ask about requirements, be specific about documents or actions needed. Keep it concise but thorough."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"conductor_chat_{body.transaction_id}_{current_user.id}",
            system_message="You are a helpful AI Transaction Conductor. Be concise, specific, and professional.",
        )
        response_text = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"Conductor chat error: {e}")
        raise HTTPException(status_code=500, detail="AI chat failed")

    return {"response": response_text.strip(), "role": participant.get("role")}


@router.get("/status/{transaction_id}")
async def get_conductor_status(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the overall AI conductor status for a transaction — for all participants."""
    transaction = await db.transactions.find_one(
        {"id": transaction_id}, {"_id": 0}
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    participants = await db.transaction_participants.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).to_list(20)

    tasks = await db.transaction_tasks.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).to_list(100)

    role_status = {}
    for p in participants:
        role = p.get("role", "unknown")
        role_tasks = [t for t in tasks if role in t.get("assigned_roles", [])]
        role_completed = len([t for t in role_tasks if t.get("status") == "completed"])
        role_status[p.get("name", p.get("email"))] = {
            "role": role,
            "status": p.get("status"),
            "total_tasks": len(role_tasks),
            "completed_tasks": role_completed,
            "progress": round(role_completed / len(role_tasks) * 100, 1) if role_tasks else 100,
        }

    return {
        "transaction_id": transaction_id,
        "transaction_status": transaction.get("status"),
        "overall_progress": transaction.get("progress_percentage", 0),
        "participant_progress": role_status,
    }
