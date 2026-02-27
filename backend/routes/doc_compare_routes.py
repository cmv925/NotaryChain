"""
Document Comparison / Diff Routes
AI-powered document comparison highlighting differences.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from datetime import datetime, timezone
import os
import uuid
import json
import logging

from models import User
from routes.auth_routes import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/doc-compare", tags=["doc-compare"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def set_db(database):
    global db
    db = database


class CompareRequest(BaseModel):
    text_a: str
    text_b: str
    label_a: str = "Version A"
    label_b: str = "Version B"


@router.post("/compare")
async def compare_documents(
    body: CompareRequest,
    current_user: User = Depends(get_current_user),
):
    """Compare two document texts and return AI-generated diff analysis."""
    if not body.text_a.strip() or not body.text_b.strip():
        raise HTTPException(status_code=400, detail="Both document texts are required")

    prompt = f"""Compare these two document versions and identify all differences.

{body.label_a}:
---
{body.text_a[:6000]}
---

{body.label_b}:
---
{body.text_b[:6000]}
---

Return a JSON object:
{{
  "summary": "Brief summary of the overall changes",
  "change_count": 0,
  "significance": "minor|moderate|major",
  "changes": [
    {{
      "type": "addition|deletion|modification",
      "section": "Section or area where the change occurs",
      "original": "Original text (empty string for additions)",
      "modified": "Modified text (empty string for deletions)",
      "impact": "high|medium|low",
      "explanation": "What this change means"
    }}
  ],
  "legal_implications": ["Any legal implications of the changes"],
  "recommendation": "Overall recommendation about these changes"
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"compare_{current_user.id}_{datetime.now().timestamp()}",
            system_message="You are a legal document comparison expert. Respond with valid JSON only.",
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError:
        result = {
            "summary": "Unable to parse comparison results",
            "change_count": 0,
            "significance": "unknown",
            "changes": [],
            "legal_implications": [],
            "recommendation": "Please try again",
        }
    except Exception as e:
        logger.error(f"Compare error: {e}")
        raise HTTPException(status_code=500, detail="Comparison failed")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "label_a": body.label_a,
        "label_b": body.label_b,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.doc_comparisons.insert_one(record)
    record.pop("_id", None)

    return {"comparison_id": record["id"], "result": result}


@router.get("/history")
async def get_comparison_history(current_user: User = Depends(get_current_user)):
    """Get user's comparison history."""
    docs = await db.doc_comparisons.find(
        {"user_id": current_user.id},
        {"_id": 0, "id": 1, "label_a": 1, "label_b": 1,
         "result.summary": 1, "result.significance": 1, "result.change_count": 1,
         "created_at": 1},
    ).sort("created_at", -1).to_list(20)
    return {"comparisons": docs}
