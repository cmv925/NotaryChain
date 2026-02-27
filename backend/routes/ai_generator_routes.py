"""
AI Document Generator Routes
Generate legal documents from natural language descriptions using Gemini.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import json
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.template_wizard_service import generate_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-generator", tags=["ai-generator"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
UPLOAD_DIR = "/tmp/notary_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def set_db(database):
    global db
    db = database


DOCUMENT_TEMPLATES = {
    "bill_of_sale": "Bill of Sale",
    "simple_will": "Simple Will / Last Will and Testament",
    "lease_agreement": "Residential Lease Agreement",
    "nda": "Non-Disclosure Agreement (NDA)",
    "promissory_note": "Promissory Note",
    "independent_contractor": "Independent Contractor Agreement",
    "release_of_liability": "Release of Liability / Waiver",
    "general_affidavit": "General Affidavit",
}


class GenerateRequest(BaseModel):
    description: str
    document_type: Optional[str] = None  # If user selects a type


class RefineRequest(BaseModel):
    generation_id: str
    feedback: str


@router.get("/types")
async def get_document_types():
    """Get available document types for generation."""
    return {"types": [{"id": k, "name": v} for k, v in DOCUMENT_TEMPLATES.items()]}


@router.post("/generate")
async def generate_document(
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a legal document from a natural language description."""
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    doc_type_name = DOCUMENT_TEMPLATES.get(body.document_type, "Legal Document")

    prompt = f"""You are an expert legal document drafting assistant. Generate a complete, professional legal document based on the user's description.

User's request: "{body.description}"
Document type: {doc_type_name if body.document_type else "Determine the best document type from the description"}

Generate a COMPLETE document with all necessary legal language, clauses, and formatting. Return as JSON:
{{
  "title": "Document Title",
  "document_type": "{body.document_type or 'auto-detected type'}",
  "sections": [
    {{
      "heading": "Section heading",
      "content": "Full section text with proper legal language..."
    }}
  ],
  "fields": {{
    "field_name": "value or [BLANK] for user to fill"
  }},
  "signature_blocks": [
    {{
      "role": "Party A / Seller / etc",
      "name": "[BLANK]",
      "date_line": true
    }}
  ],
  "notes": "Any important notes about this document",
  "disclaimer": "Standard legal disclaimer"
}}

Make the document thorough, legally sound, and professionally written. Use [BLANK] for any information the user needs to fill in."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"docgen_{current_user.id}_{datetime.now().timestamp()}",
            system_message="You are a professional legal document generator. Always respond with valid JSON only.",
            model="gemini-2.0-flash",
        )
        response = await chat.send_message(UserMessage(message=prompt))
        text = response.message.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI response parsing failed")
    except Exception as e:
        logger.error(f"Document generation error: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed")

    # Save generation record
    gen_id = str(uuid.uuid4())
    record = {
        "id": gen_id,
        "user_id": current_user.id,
        "description": body.description,
        "document_type": body.document_type or result.get("document_type"),
        "result": result,
        "status": "generated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_generated_docs.insert_one(record)
    record.pop("_id", None)

    return {"generation_id": gen_id, "document": result}


@router.post("/refine")
async def refine_document(
    body: RefineRequest,
    current_user: User = Depends(get_current_user),
):
    """Refine a previously generated document based on feedback."""
    gen = await db.ai_generated_docs.find_one(
        {"id": body.generation_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")

    prompt = f"""Refine this legal document based on the user's feedback.

Current document:
{json.dumps(gen['result'], indent=2)}

User's feedback: "{body.feedback}"

Return the complete updated document in the same JSON format. Make the requested changes while preserving the overall document structure and legal integrity."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"refine_{body.generation_id}_{datetime.now().timestamp()}",
            system_message="You are a professional legal document editor. Always respond with valid JSON only.",
            model="gemini-2.0-flash",
        )
        response = await chat.send_message(UserMessage(message=prompt))
        text = response.message.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except Exception as e:
        logger.error(f"Document refine error: {e}")
        raise HTTPException(status_code=500, detail="AI refinement failed")

    await db.ai_generated_docs.update_one(
        {"id": body.generation_id},
        {"$set": {"result": result, "refined_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"generation_id": body.generation_id, "document": result}


@router.get("/my-documents")
async def get_my_generations(
    current_user: User = Depends(get_current_user),
):
    """List user's generated documents."""
    docs = await db.ai_generated_docs.find(
        {"user_id": current_user.id}, {"_id": 0, "id": 1, "description": 1, "document_type": 1, "status": 1, "created_at": 1, "result.title": 1}
    ).sort("created_at", -1).to_list(30)
    return {"documents": docs}


@router.get("/documents/{gen_id}")
async def get_generation(
    gen_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific generated document."""
    doc = await db.ai_generated_docs.find_one(
        {"id": gen_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
