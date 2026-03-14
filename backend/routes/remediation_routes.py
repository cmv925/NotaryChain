"""
AI Document Remediation Routes
Analyzes documents to suggest and insert missing legal clauses.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
import json
import logging

from models import User
from routes.auth_routes import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/remediation", tags=["remediation"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def set_db(database):
    global db
    db = database


class RemediateTextRequest(BaseModel):
    document_text: str
    document_type: Optional[str] = "general"
    transaction_id: Optional[str] = None


class ApplyClauseRequest(BaseModel):
    remediation_id: str
    clause_indices: List[int]


@router.post("/analyze")
async def analyze_for_remediation(
    body: RemediateTextRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze a document and suggest missing legal clauses, improvements, and risk areas."""
    if not body.document_text.strip():
        raise HTTPException(status_code=400, detail="Document text is required")

    prompt = f"""You are an expert legal document reviewer. Analyze the following document and identify:
1. Missing legal clauses that should be present for this type of document
2. Weak or ambiguous language that should be strengthened
3. Risk areas that could cause legal disputes
4. Suggested improvements

Document type: {body.document_type}
Document text:
---
{body.document_text[:8000]}
---

Respond with a JSON object:
{{
  "document_type_detected": "contract|agreement|will|deed|affidavit|other",
  "overall_risk_score": 0-100,
  "overall_assessment": "Brief assessment of the document's legal completeness",
  "missing_clauses": [
    {{
      "clause_name": "Name of the missing clause",
      "severity": "critical|important|recommended",
      "reason": "Why this clause is needed",
      "suggested_text": "Full suggested clause text ready to insert",
      "insert_after": "Description of where this should be inserted"
    }}
  ],
  "weak_language": [
    {{
      "original_text": "The weak text from the document",
      "issue": "What's wrong with it",
      "suggested_replacement": "Improved replacement text",
      "severity": "high|medium|low"
    }}
  ],
  "risk_areas": [
    {{
      "area": "Description of the risk area",
      "risk_level": "high|medium|low",
      "recommendation": "How to mitigate this risk"
    }}
  ],
  "compliance_notes": ["Any regulatory or compliance observations"]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"remediate_{current_user.id}_{datetime.now().timestamp()}",
            system_message="You are a legal document remediation expert. Always respond with valid JSON only.",
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError:
        result = {
            "overall_risk_score": 50,
            "overall_assessment": "Unable to parse AI analysis. Please try again.",
            "missing_clauses": [],
            "weak_language": [],
            "risk_areas": [],
            "compliance_notes": [],
        }
    except Exception as e:
        logger.error(f"Remediation analysis error: {e}")
        raise HTTPException(status_code=500, detail="AI remediation analysis failed")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "transaction_id": body.transaction_id,
        "document_type": body.document_type,
        "original_text": body.document_text[:10000],
        "result": result,
        "applied_clauses": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.remediations.insert_one(record)
    record.pop("_id", None)

    return {"remediation_id": record["id"], "analysis": result}


@router.post("/apply-clauses")
async def apply_suggested_clauses(
    body: ApplyClauseRequest,
    current_user: User = Depends(get_current_user),
):
    """Apply selected suggested clauses to the document and return the remediated text."""
    rec = await db.remediations.find_one(
        {"id": body.remediation_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Remediation not found")

    clauses = rec.get("result", {}).get("missing_clauses", [])
    selected = [clauses[i] for i in body.clause_indices if i < len(clauses)]

    if not selected:
        raise HTTPException(status_code=400, detail="No valid clauses selected")

    clause_text = "\n\n".join(
        [f"/* {c['clause_name']} */\n{c['suggested_text']}" for c in selected]
    )

    prompt = f"""Insert the following clauses into the document at appropriate positions.
Return the complete updated document text with the clauses integrated naturally.

Original document:
---
{rec['original_text'][:8000]}
---

Clauses to insert:
---
{clause_text}
---

Return a JSON object:
{{
  "remediated_text": "The complete document with clauses inserted",
  "changes_made": ["Description of each change made"],
  "insertion_points": [
    {{"clause_name": "...", "inserted_after_section": "..."}}
  ]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"apply_{body.remediation_id}_{datetime.now().timestamp()}",
            system_message="You are a legal document editor. Always respond with valid JSON only.",
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except Exception as e:
        logger.error(f"Clause application error: {e}")
        raise HTTPException(status_code=500, detail="Failed to apply clauses")

    await db.remediations.update_one(
        {"id": body.remediation_id},
        {"$set": {
            "applied_clauses": [c["clause_name"] for c in selected],
            "remediated_text": result.get("remediated_text", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    return result


@router.get("/history")
async def get_remediation_history(
    current_user: User = Depends(get_current_user),
):
    """Get user's remediation history."""
    docs = await db.remediations.find(
        {"user_id": current_user.id},
        {"_id": 0, "id": 1, "document_type": 1, "result.overall_risk_score": 1,
         "result.overall_assessment": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(20)
    return {"remediations": docs}


@router.get("/{remediation_id}")
async def get_remediation(
    remediation_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific remediation result."""
    doc = await db.remediations.find_one(
        {"id": remediation_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Remediation not found")
    return doc
