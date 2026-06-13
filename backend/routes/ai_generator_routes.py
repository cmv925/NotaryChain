"""
AI Document Generator Routes
Generate legal documents from natural language descriptions using Gemini.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import json
import uuid
import hashlib
import logging

from models import User
from routes.auth_routes import get_current_user
from middleware.security import limiter
from services.hedera_service import hedera_service
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-generator", tags=["ai-generator"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


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


async def _llm_json(system: str, prompt: str, session_id: str) -> Any:
    """Send a prompt expecting JSON back; strips ``` fences and parses."""
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id, system_message=system)
    text = (await chat.send_message(UserMessage(text=prompt))).strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)


def _flatten_document(result: Dict[str, Any]) -> str:
    """Render a generated-document JSON into a single plain-text agreement
    (used for hashing / anchoring and compliance scanning)."""
    lines: List[str] = []
    if result.get("title"):
        lines.append(str(result["title"]).upper())
        lines.append("")
    for section in result.get("sections", []) or []:
        if section.get("heading"):
            lines.append(str(section["heading"]))
        if section.get("content"):
            lines.append(str(section["content"]))
        lines.append("")
    fields = result.get("fields") or {}
    if fields:
        lines.append("DETAILS")
        for k, v in fields.items():
            lines.append(f"{k.replace('_', ' ').title()}: {v}")
        lines.append("")
    sigs = result.get("signature_blocks") or []
    if sigs:
        lines.append("SIGNATURES")
        for s in sigs:
            lines.append(f"{s.get('role', 'Party')}: {s.get('name', '____________')}  Date: ____________")
    return "\n".join(lines).strip()


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
@limiter.limit("5/minute")
async def generate_document(
    request: Request,
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
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
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
@limiter.limit("5/minute")
async def refine_document(
    request: Request,
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
        )
        text = await chat.send_message(UserMessage(text=prompt))
        text = text.strip()
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



# ─────────────────────────────────────────────────────────────────────────────
# Smart Document Studio — granular editing, condition mapping, compliance (PCV),
# signer mapping, and one-click notarize/anchor.
# ─────────────────────────────────────────────────────────────────────────────

class EditSectionRequest(BaseModel):
    generation_id: str
    section_index: int
    instruction: str


class SaveDocRequest(BaseModel):
    generation_id: str
    result: Optional[Dict[str, Any]] = None
    signers: Optional[List[Dict[str, Any]]] = None
    conditions: Optional[List[Dict[str, Any]]] = None


class GenIdRequest(BaseModel):
    generation_id: str


class NotarizeRequest(BaseModel):
    generation_id: str


async def _load_gen(gen_id: str, user_id: str) -> Dict[str, Any]:
    gen = await db.ai_generated_docs.find_one({"id": gen_id, "user_id": user_id}, {"_id": 0})
    if not gen:
        raise HTTPException(status_code=404, detail="Document not found")
    return gen


@router.post("/edit-section")
@limiter.limit("15/minute")
async def edit_section(request: Request, body: EditSectionRequest, current_user: User = Depends(get_current_user)):
    """AI-edit a single section in place (precise studio editing)."""
    gen = await _load_gen(body.generation_id, current_user.id)
    sections = gen["result"].get("sections", []) or []
    if body.section_index < 0 or body.section_index >= len(sections):
        raise HTTPException(status_code=400, detail="Invalid section index")
    target = sections[body.section_index]

    prompt = f"""Rewrite ONLY the following legal-document section per the instruction. Keep it legally sound and consistent with the rest of the document.

Document title: {gen['result'].get('title', '')}
Section heading: {target.get('heading', '')}
Current section content:
\"\"\"{target.get('content', '')}\"\"\"

Instruction: "{body.instruction}"

Return JSON only: {{"heading": "...", "content": "..."}}"""
    try:
        updated = await _llm_json(
            "You are a precise legal document editor. Respond with valid JSON only.",
            prompt,
            f"editsec_{body.generation_id}_{datetime.now().timestamp()}",
        )
    except Exception as e:
        logger.error(f"edit-section error: {e}")
        raise HTTPException(status_code=500, detail="AI edit failed")

    sections[body.section_index] = {
        "heading": updated.get("heading", target.get("heading")),
        "content": updated.get("content", target.get("content")),
    }
    gen["result"]["sections"] = sections
    await db.ai_generated_docs.update_one(
        {"id": body.generation_id},
        {"$set": {"result": gen["result"], "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"section": sections[body.section_index], "document": gen["result"]}


@router.put("/documents/{gen_id}")
async def save_document(gen_id: str, body: SaveDocRequest, current_user: User = Depends(get_current_user)):
    """Persist manual edits to the document, signer mapping, and trigger conditions."""
    await _load_gen(gen_id, current_user.id)
    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.result is not None:
        update["result"] = body.result
    if body.signers is not None:
        update["signers"] = body.signers
    if body.conditions is not None:
        update["conditions"] = body.conditions
    await db.ai_generated_docs.update_one({"id": gen_id}, {"$set": update})
    doc = await db.ai_generated_docs.find_one({"id": gen_id}, {"_id": 0})
    return doc


@router.post("/suggest-conditions")
@limiter.limit("10/minute")
async def suggest_conditions(request: Request, body: GenIdRequest, current_user: User = Depends(get_current_user)):
    """AI-extract candidate Trust Anchor trigger conditions from the document.

    These feed the Self-Executing Trust Network (payment due dates, delivery
    milestones, expirations, etc.)."""
    gen = await _load_gen(body.generation_id, current_user.id)
    flat = _flatten_document(gen["result"])
    prompt = f"""Read this agreement and extract key terms that could act as automated trigger conditions for a self-executing trust/escrow (e.g. payment due dates, delivery milestones, expiration, renewal, deposit release).

Agreement:
\"\"\"{flat[:6000]}\"\"\"

Return JSON only: {{"conditions": [{{"label": "short name", "type": "payment|delivery|date|renewal|condition", "term": "the exact clause/term text", "trigger": "plain-English description of what fires this condition"}}]}}
Return at most 6, most important first."""
    try:
        data = await _llm_json(
            "You extract structured trigger conditions from legal agreements. Respond with valid JSON only.",
            prompt,
            f"cond_{body.generation_id}_{datetime.now().timestamp()}",
        )
        suggestions = data.get("conditions", [])[:6]
    except Exception as e:
        logger.error(f"suggest-conditions error: {e}")
        raise HTTPException(status_code=500, detail="Condition extraction failed")
    for c in suggestions:
        c["id"] = str(uuid.uuid4())
        c["enabled"] = False
    return {"conditions": suggestions}


def _rule_based_checks(gen: Dict[str, Any], flat: str) -> List[Dict[str, Any]]:
    """Deterministic compliance checks (part of the hybrid PCV scan)."""
    issues: List[Dict[str, Any]] = []
    lower = flat.lower()
    result = gen.get("result", {})
    sigs = result.get("signature_blocks") or []
    if not sigs:
        issues.append({"severity": "high", "category": "Execution",
                       "message": "No signature blocks found.",
                       "suggestion": "Add signature blocks for every party that must execute the document."})
    if "[blank]" in lower or "____" in flat:
        issues.append({"severity": "medium", "category": "Completeness",
                       "message": "Unfilled placeholders ([BLANK] / blanks) remain.",
                       "suggestion": "Fill all party names, dates, and amounts before notarizing."})
    if not any(k in lower for k in ["governing law", "jurisdiction", "state of", "laws of"]):
        issues.append({"severity": "medium", "category": "Enforceability",
                       "message": "No governing-law / jurisdiction clause detected.",
                       "suggestion": "Add a governing-law clause naming the controlling state."})
    if len(flat) < 400:
        issues.append({"severity": "low", "category": "Substance",
                       "message": "Document appears unusually short.",
                       "suggestion": "Confirm all required terms and clauses are present."})
    return issues


@router.post("/compliance-check")
@limiter.limit("8/minute")
async def compliance_check(request: Request, body: GenIdRequest, current_user: User = Depends(get_current_user)):
    """Predictive Compliance Vault (PCV) scan — hybrid rule-based + AI review.

    Returns a readiness score and a list of issues/missing clauses before sealing."""
    gen = await _load_gen(body.generation_id, current_user.id)
    flat = _flatten_document(gen["result"])
    doc_type = gen.get("document_type") or gen["result"].get("document_type") or "legal document"

    rule_issues = _rule_based_checks(gen, flat)

    ai_issues: List[Dict[str, Any]] = []
    missing_clauses: List[str] = []
    ai_score = None
    try:
        prompt = f"""Act as a Predictive Compliance Vault reviewing a {doc_type} before blockchain notarization. Identify enforceability/compliance risks and missing standard clauses.

Document:
\"\"\"{flat[:7000]}\"\"\"

Return JSON only:
{{"score": 0-100 readiness, "issues": [{{"severity": "high|medium|low", "category": "...", "message": "...", "suggestion": "..."}}], "missing_clauses": ["..."]}}"""
        data = await _llm_json(
            "You are a meticulous legal compliance reviewer. Respond with valid JSON only.",
            prompt,
            f"pcv_{body.generation_id}_{datetime.now().timestamp()}",
        )
        ai_issues = data.get("issues", []) or []
        missing_clauses = data.get("missing_clauses", []) or []
        ai_score = data.get("score")
    except Exception as e:
        logger.warning(f"compliance AI step failed, using rules only: {e}")

    all_issues = rule_issues + ai_issues
    high = sum(1 for i in all_issues if i.get("severity") == "high")
    medium = sum(1 for i in all_issues if i.get("severity") == "medium")
    low = sum(1 for i in all_issues if i.get("severity") == "low")
    rule_score = max(0, 100 - (high * 25 + medium * 10 + low * 3))
    score = int(round((rule_score + ai_score) / 2)) if isinstance(ai_score, (int, float)) else rule_score

    compliance = {
        "score": score,
        "passed": high == 0,
        "issues": all_issues,
        "missing_clauses": missing_clauses,
        "counts": {"high": high, "medium": medium, "low": low},
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_generated_docs.update_one(
        {"id": body.generation_id}, {"$set": {"compliance": compliance}}
    )
    return compliance


@router.post("/notarize")
@limiter.limit("10/minute")
async def notarize_document(request: Request, body: NotarizeRequest, current_user: User = Depends(get_current_user)):
    """One-click notarize: flatten the finalized draft, hash it, and anchor it on
    Hedera HCS. Identity-gated (same as the notarization/anchor flow)."""
    gen = await _load_gen(body.generation_id, current_user.id)

    user_doc = await db.users.find_one(
        {"id": current_user.id}, {"role": 1, "identity_verified": 1, "full_name": 1}
    )
    role = (user_doc or {}).get("role", "user")
    if role == "user" and not (user_doc or {}).get("identity_verified"):
        raise HTTPException(status_code=403, detail="identity_verification_required")

    content = _flatten_document(gen["result"])
    if len(content) < 20:
        raise HTTPException(status_code=400, detail="Document is too short to anchor")
    title = gen["result"].get("title") or "Generated Document"
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    seal = await hedera_service.seal_document(
        document_hash=content_hash,
        document_name=title,
        user_id=current_user.id,
        metadata={
            "kind": "studio_document",
            "document_type": gen.get("document_type"),
            "generation_id": body.generation_id,
            "conditions": len(gen.get("conditions", []) or []),
            "anchored_by": (user_doc or {}).get("full_name", current_user.email),
        },
    )

    anchor_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": anchor_id,
        "user_id": current_user.id,
        "template_id": "studio_document",
        "template_name": gen.get("document_type") or "Smart Document Studio",
        "title": title,
        "content": content,
        "content_hash": content_hash,
        "transaction_id": seal.get("transaction_id"),
        "topic_id": seal.get("topic_id"),
        "sequence_number": seal.get("sequence_number"),
        "hcs_submitted": seal.get("hcs_submitted", False),
        "verification_hash": seal.get("verification_hash"),
        "explorer_url": seal.get("explorer_url"),
        "network": seal.get("network"),
        "status": "anchored" if seal.get("success") else "failed",
        "anchored_at": seal.get("sealed_at", now),
        "created_at": now,
    }
    await db.contract_anchors.insert_one(record)
    await db.ai_generated_docs.update_one(
        {"id": body.generation_id},
        {"$set": {"status": "anchored", "anchor_id": anchor_id, "content_hash": content_hash,
                  "transaction_id": record["transaction_id"], "explorer_url": record["explorer_url"]}},
    )
    return {
        "anchor_id": anchor_id,
        "content_hash": content_hash,
        "transaction_id": record["transaction_id"],
        "topic_id": record["topic_id"],
        "explorer_url": record["explorer_url"],
        "network": record["network"],
        "anchored_at": record["anchored_at"],
        "title": title,
    }
