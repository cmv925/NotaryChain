"""
AI Co-pilot Routes
Intelligent assistant for notary review — highlights key data, flags inconsistencies,
and pre-fills the e-journal.
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

router = APIRouter(prefix="/api/ai-copilot", tags=["ai-copilot"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def set_db(database):
    global db
    db = database


class CopilotAnalyzeRequest(BaseModel):
    request_id: str


class CopilotJournalRequest(BaseModel):
    request_id: str


@router.post("/analyze")
async def copilot_analyze_request(
    body: CopilotAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    """AI Co-pilot analyzes a notarization request for the notary.
    Returns key data highlights, inconsistency flags, and recommendations."""

    req = await db.notarization_requests.find_one(
        {"id": body.request_id}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Gather related data
    analyses = await db.ai_analyses.find(
        {"session_id": body.request_id}, {"_id": 0}
    ).to_list(5)

    biometric = await db.biometric_verifications.find_one(
        {"request_id": body.request_id}, {"_id": 0}
    )

    signers = req.get("signers", [])
    booking = await db.bookings.find_one(
        {"request_id": body.request_id}, {"_id": 0, "user_name": 1, "user_email": 1, "date": 1, "start_time": 1}
    )

    # Build context for AI
    context = {
        "request": {
            "document_name": req.get("document_name"),
            "document_type": req.get("document_type"),
            "notarization_type": req.get("notarization_type"),
            "status": req.get("status"),
            "notes": req.get("notes"),
            "signers": signers,
            "created_at": str(req.get("created_at")),
        },
        "ai_analyses": [
            {
                "confidence": a.get("analysis", {}).get("confidence_score"),
                "status": a.get("analysis", {}).get("status"),
                "discrepancies": a.get("analysis", {}).get("discrepancies", []),
                "key_information": a.get("analysis", {}).get("key_information", {}),
            }
            for a in analyses
        ] if analyses else [],
        "biometric_verification": {
            "status": biometric.get("status") if biometric else "not_performed",
            "confidence": biometric.get("confidence") if biometric else None,
        },
        "booking": booking,
    }

    prompt = f"""You are an AI Co-pilot assisting a notary in reviewing a notarization request.

Analyze the following request data and provide your assessment:

{json.dumps(context, indent=2, default=str)}

Respond with a JSON object:
{{
  "summary": "Brief 2-sentence summary of the request",
  "key_highlights": [
    {{"label": "...", "value": "...", "status": "ok|warning|alert"}}
  ],
  "inconsistency_flags": [
    {{"severity": "low|medium|high", "description": "...", "recommendation": "..."}}
  ],
  "risk_level": "low|medium|high",
  "risk_factors": ["..."],
  "recommendations": ["..."],
  "readiness_score": 0-100,
  "checklist": [
    {{"item": "...", "completed": true/false, "note": "..."}}
  ]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"copilot_{body.request_id}_{datetime.now().timestamp()}",
            system_message="You are a professional notary AI assistant. Always respond with valid JSON only.",
        )
        response = await chat.send_message(UserMessage(text=prompt))
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]

        result = json.loads(text)
    except json.JSONDecodeError:
        result = {
            "summary": "Unable to parse AI response",
            "key_highlights": [],
            "inconsistency_flags": [],
            "risk_level": "medium",
            "recommendations": ["Manual review recommended"],
            "readiness_score": 50,
            "checklist": [],
        }
    except Exception as e:
        logger.error(f"Copilot analysis error: {e}")
        raise HTTPException(status_code=500, detail="AI analysis failed")

    # Store analysis
    await db.copilot_analyses.insert_one({
        "request_id": body.request_id,
        "notary_id": current_user.id,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return result


@router.post("/prefill-journal")
async def copilot_prefill_journal(
    body: CopilotJournalRequest,
    current_user: User = Depends(get_current_user),
):
    """AI pre-fills the notary e-journal entry from a request's data."""

    req = await db.notarization_requests.find_one(
        {"id": body.request_id}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Gather user info
    user = await db.users.find_one(
        {"id": req.get("user_id")}, {"_id": 0, "full_name": 1, "email": 1}
    )

    signers = req.get("signers", [])
    booking = await db.bookings.find_one(
        {"request_id": body.request_id}, {"_id": 0}
    )

    context = {
        "document_name": req.get("document_name"),
        "document_type": req.get("document_type"),
        "notarization_type": req.get("notarization_type"),
        "user_name": user.get("full_name") if user else "",
        "user_email": user.get("email") if user else "",
        "signers": signers,
        "notes": req.get("notes"),
        "booking_date": booking.get("date") if booking else None,
        "booking_time": booking.get("start_time") if booking else None,
    }

    prompt = f"""Pre-fill a notary journal entry based on this notarization request data:

{json.dumps(context, indent=2, default=str)}

Return a JSON object with these exact fields:
{{
  "document_type": "...",
  "document_name": "...",
  "signer_name": "...",
  "signer_address": "...",
  "identification_type": "drivers_license|passport|state_id|other",
  "identification_number": "",
  "notarization_type": "acknowledgment|jurat|oath|copy_certification|other",
  "fee_charged": 0.0,
  "notes": "Auto-generated journal entry notes..."
}}

Fill what you can from the data. Leave blanks for unknowns."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"journal_{body.request_id}_{datetime.now().timestamp()}",
            system_message="You are a notary journal assistant. Respond with valid JSON only.",
        )
        response = await chat.send_message(UserMessage(message=prompt))
        text = response.message.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except Exception as e:
        logger.error(f"Journal prefill error: {e}")
        # Fallback to manual extraction
        signer = signers[0]["name"] if signers else (user.get("full_name", "") if user else "")
        result = {
            "document_type": req.get("document_type", ""),
            "document_name": req.get("document_name", ""),
            "signer_name": signer,
            "signer_address": "",
            "identification_type": "",
            "identification_number": "",
            "notarization_type": "acknowledgment",
            "fee_charged": 0.0,
            "notes": f"Notarization for {req.get('document_name', '')}. {req.get('notes', '')}",
        }

    return result
