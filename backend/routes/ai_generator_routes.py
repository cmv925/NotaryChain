"""
AI Document Generator Routes
Generate legal documents from natural language descriptions using Gemini.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
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


@router.get("/clauses")
async def get_clauses(state: Optional[str] = None, category: Optional[str] = None,
                      current_user: User = Depends(get_current_user)):
    """Smart Clause Library — curated (optionally state-specific) insertable clauses."""
    from legal_clauses import list_clauses, CLAUSE_CATEGORIES, SUPPORTED_STATES
    return {
        "clauses": list_clauses(state=state, category=category),
        "categories": [{"id": k, "label": v} for k, v in CLAUSE_CATEGORIES.items()],
        "states": [{"code": k, "name": v} for k, v in SUPPORTED_STATES.items()],
    }


def _generate_prompt(description: str, document_type: Optional[str]) -> str:
    doc_type_name = DOCUMENT_TEMPLATES.get(document_type, "Legal Document")
    return f"""You are an expert legal document drafting assistant. Generate a complete, professional legal document based on the user's description.

User's request: "{description}"
Document type: {doc_type_name if document_type else "Determine the best document type from the description"}

Generate a COMPLETE document with all necessary legal language, clauses, and formatting. Return as JSON:
{{
  "title": "Document Title",
  "document_type": "{document_type or 'auto-detected type'}",
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


async def _run_generation(gen_id: str, description: str, document_type: Optional[str], user_id: str):
    """Background worker: runs the (slow) LLM call off the request path so the API
    never hits the proxy timeout. Frontend polls GET /documents/{id} for status."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"docgen_{user_id}_{datetime.now().timestamp()}",
            system_message="You are a professional legal document generator. Always respond with valid JSON only.",
        )
        text = (await chat.send_message(UserMessage(text=_generate_prompt(description, document_type)))).strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
        await db.ai_generated_docs.update_one(
            {"id": gen_id},
            {"$set": {"result": result, "status": "generated",
                      "document_type": document_type or result.get("document_type"),
                      "completed_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception as e:
        logger.error(f"Document generation error (gen_id={gen_id}): {e}")
        await db.ai_generated_docs.update_one(
            {"id": gen_id},
            {"$set": {"status": "failed", "error": "AI generation failed"}},
        )


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_document(
    request: Request,
    body: GenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Kick off a legal-document generation. Returns immediately with a processing
    status; the LLM runs in the background and the client polls GET /documents/{id}."""
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    gen_id = str(uuid.uuid4())
    await db.ai_generated_docs.insert_one({
        "id": gen_id,
        "user_id": current_user.id,
        "description": body.description,
        "document_type": body.document_type,
        "result": None,
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(_run_generation, gen_id, body.description, body.document_type, current_user.id)
    return {"generation_id": gen_id, "status": "processing"}


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
        {"user_id": current_user.id, "result": {"$ne": None}}, {"_id": 0, "id": 1, "description": 1, "document_type": 1, "status": 1, "created_at": 1, "result.title": 1}
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


# ── Async AI jobs: keep slow LLM work off the request path so it never hits the
# proxy timeout (502). Callers POST → get {job_id} → poll GET /jobs/{job_id}. ──
async def _create_job(user_id: str, kind: str) -> str:
    job_id = str(uuid.uuid4())
    await db.ai_jobs.insert_one({
        "id": job_id, "user_id": user_id, "kind": kind, "status": "processing",
        "result": None, "error": None, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return job_id


async def _finish_job(job_id: str, result: Any):
    await db.ai_jobs.update_one({"id": job_id}, {"$set": {
        "status": "done", "result": result, "completed_at": datetime.now(timezone.utc).isoformat()}})


async def _fail_job(job_id: str, error: str):
    await db.ai_jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error": error}})


@router.get("/jobs/{job_id}")
async def get_ai_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Poll an async AI job (edit-section / suggest-conditions / compliance)."""
    job = await db.ai_jobs.find_one({"id": job_id, "user_id": current_user.id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": job["status"], "result": job.get("result"), "error": job.get("error"), "kind": job.get("kind")}



_VERIFY_METHOD = {
    "payment": "party_confirmation",
    "delivery": "oracle",
    "date": "party_confirmation",
    "renewal": "party_confirmation",
    "condition": "party_confirmation",
}


def _slug(text: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in (text or "").lower()).strip("_")[:40] or "condition"


def _map_studio_condition(c: Dict[str, Any], idx: int, now: str) -> Dict[str, Any]:
    ctype = c.get("type", "condition")
    return {
        "type": "date" if ctype == "date" else "milestone",
        "category": ctype,
        "title": c.get("label", f"Condition {idx + 1}"),
        "description": c.get("trigger") or c.get("term") or c.get("label", ""),
        "trigger": _slug(c.get("label", f"condition_{idx + 1}")),
        "verification_method": _VERIFY_METHOD.get(ctype, "party_confirmation"),
        "required_party": None,
        "deadline_days": 30,
        "confidence": 0.9,
        "oracle_type": "shipping_tracker" if ctype == "delivery" else None,
        "payment_pct": 0,
        "condition_id": str(uuid.uuid4())[:8],
        "status": "pending",
        "created_at": now,
        "deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "verified_at": None,
        "verified_by": None,
        "evidence": None,
        "oracle_result": None,
        "photo_verification": None,
        "source": "studio",
    }


async def _create_trust_anchor(gen: Dict[str, Any], user, active_conditions: List[Dict[str, Any]],
                               signers: List[Dict[str, Any]], content_hash: str, anchor_id: str) -> Dict[str, Any]:
    """Materialize enabled Studio trigger conditions into a Self-Executing Trust
    Anchor (escrow agreement) so they can be verified/settled in the Escrow engine."""
    from routes.escrow_routes import _mint_mock_contract

    now = datetime.now(timezone.utc).isoformat()
    escrow_id = str(uuid.uuid4())
    title = gen["result"].get("title") or "Smart Document"
    buyer = signers[0] if len(signers) > 0 else {}
    seller = signers[1] if len(signers) > 1 else {}
    conditions = [_map_studio_condition(c, i, now) for i, c in enumerate(active_conditions)]

    escrow = {
        "escrow_id": escrow_id,
        "title": f"{title} — Trust Anchor",
        "description": f"Self-executing trust anchor generated from Smart Document Studio for '{title}'.",
        "escrow_type": "studio",
        "status": "active",
        "created_by": user.email,
        "created_at": now,
        "updated_at": now,
        "parties": {
            "buyer": {"name": buyer.get("name", ""), "email": buyer.get("email", user.email),
                      "role": buyer.get("role", "buyer"), "verified": False,
                      "biometric_verified": False, "biometric_at": None},
            "seller": {"name": seller.get("name", ""), "email": seller.get("email", ""),
                       "role": seller.get("role", "seller"), "verified": False,
                       "biometric_verified": False, "biometric_at": None},
            "escrow_agent": {"name": "NotaryChain AI Orchestrator", "role": "escrow_agent", "type": "automated"},
        },
        "financial": {"escrow_amount": 0, "currency": "USD", "deposit_status": "pending",
                      "amount_released": 0, "amount_held": 0, "release_schedule": [],
                      "stripe_payment_intent": None, "hts_token_id": None, "hts_escrow_account": None},
        "document": {"name": title, "uploaded": True, "analysis_complete": True,
                     "generation_id": gen["id"], "anchor_id": anchor_id, "content_hash": content_hash},
        "conditions": conditions,
        "conditions_met_count": 0,
        "conditions_total": len(conditions),
        "oracle_events": [],
        "biometric_proofs": [],
        "blockchain": {"creation_hash": content_hash, "settlement_hash": None,
                       "hcs_topic_id": None, "audit_trail": []},
        "settlement": {"biometric_gate_passed": False, "biometric_gate_at": None, "biometric_gate_by": None},
        "smart_contract": _mint_mock_contract(escrow_id),
        "timeline": [{
            "event": "escrow_created",
            "timestamp": now,
            "actor": user.email,
            "details": f"Trust Anchor created from notarized document with {len(conditions)} trigger condition(s)",
            "category": "lifecycle",
        }],
        "source": "smart_document_studio",
    }
    await db.escrow_agreements.insert_one(escrow)
    return {"escrow_id": escrow_id, "conditions_total": len(conditions), "title": escrow["title"]}


async def _run_edit_section(job_id: str, gen_id: str, section_index: int, instruction: str, user_id: str):
    try:
        gen = await db.ai_generated_docs.find_one({"id": gen_id, "user_id": user_id}, {"_id": 0})
        sections = gen["result"].get("sections", []) or []
        target = sections[section_index]
        prompt = f"""Rewrite ONLY the following legal-document section per the instruction. Keep it legally sound and consistent with the rest of the document.

Document title: {gen['result'].get('title', '')}
Section heading: {target.get('heading', '')}
Current section content:
\"\"\"{target.get('content', '')}\"\"\"

Instruction: "{instruction}"

Return JSON only: {{"heading": "...", "content": "..."}}"""
        updated = await _llm_json(
            "You are a precise legal document editor. Respond with valid JSON only.",
            prompt,
            f"editsec_{gen_id}_{datetime.now().timestamp()}",
        )
        sections[section_index] = {
            "heading": updated.get("heading", target.get("heading")),
            "content": updated.get("content", target.get("content")),
        }
        gen["result"]["sections"] = sections
        await db.ai_generated_docs.update_one(
            {"id": gen_id},
            {"$set": {"result": gen["result"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await _finish_job(job_id, {"section": sections[section_index], "document": gen["result"]})
    except Exception as e:
        logger.error(f"edit-section error: {e}")
        await _fail_job(job_id, "AI edit failed")


@router.post("/edit-section")
@limiter.limit("15/minute")
async def edit_section(request: Request, body: EditSectionRequest, background_tasks: BackgroundTasks,
                       current_user: User = Depends(get_current_user)):
    """AI-edit a single section in place (async; poll /jobs/{job_id})."""
    gen = await _load_gen(body.generation_id, current_user.id)
    sections = gen["result"].get("sections", []) or []
    if body.section_index < 0 or body.section_index >= len(sections):
        raise HTTPException(status_code=400, detail="Invalid section index")
    job_id = await _create_job(current_user.id, "edit_section")
    background_tasks.add_task(_run_edit_section, job_id, body.generation_id, body.section_index, body.instruction, current_user.id)
    return {"job_id": job_id, "status": "processing"}


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


async def _run_suggest_conditions(job_id: str, gen_id: str, user_id: str):
    try:
        gen = await db.ai_generated_docs.find_one({"id": gen_id, "user_id": user_id}, {"_id": 0})
        flat = _flatten_document(gen["result"])
        prompt = f"""Read this agreement and extract key terms that could act as automated trigger conditions for a self-executing trust/escrow (e.g. payment due dates, delivery milestones, expiration, renewal, deposit release).

Agreement:
\"\"\"{flat[:6000]}\"\"\"

Return JSON only: {{"conditions": [{{"label": "short name", "type": "payment|delivery|date|renewal|condition", "term": "the exact clause/term text", "trigger": "plain-English description of what fires this condition"}}]}}
Return at most 6, most important first."""
        data = await _llm_json(
            "You extract structured trigger conditions from legal agreements. Respond with valid JSON only.",
            prompt,
            f"cond_{gen_id}_{datetime.now().timestamp()}",
        )
        suggestions = data.get("conditions", [])[:6]
        for c in suggestions:
            c["id"] = str(uuid.uuid4())
            c["enabled"] = False
        await _finish_job(job_id, {"conditions": suggestions})
    except Exception as e:
        logger.error(f"suggest-conditions error: {e}")
        await _fail_job(job_id, "Condition extraction failed")


@router.post("/suggest-conditions")
@limiter.limit("10/minute")
async def suggest_conditions(request: Request, body: GenIdRequest, background_tasks: BackgroundTasks,
                             current_user: User = Depends(get_current_user)):
    """AI-extract candidate Trust Anchor trigger conditions (async; poll /jobs/{job_id})."""
    await _load_gen(body.generation_id, current_user.id)
    job_id = await _create_job(current_user.id, "suggest_conditions")
    background_tasks.add_task(_run_suggest_conditions, job_id, body.generation_id, current_user.id)
    return {"job_id": job_id, "status": "processing"}


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


async def _run_compliance(job_id: str, gen_id: str, user_id: str):
    try:
        gen = await db.ai_generated_docs.find_one({"id": gen_id, "user_id": user_id}, {"_id": 0})
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
                f"pcv_{gen_id}_{datetime.now().timestamp()}",
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
        await db.ai_generated_docs.update_one({"id": gen_id}, {"$set": {"compliance": compliance}})
        await _finish_job(job_id, compliance)
    except Exception as e:
        logger.error(f"compliance-check error: {e}")
        await _fail_job(job_id, "Compliance scan failed")


@router.post("/compliance-check")
@limiter.limit("8/minute")
async def compliance_check(request: Request, body: GenIdRequest, background_tasks: BackgroundTasks,
                           current_user: User = Depends(get_current_user)):
    """Predictive Compliance Vault (PCV) scan — hybrid rule-based + AI (async; poll /jobs/{job_id})."""
    await _load_gen(body.generation_id, current_user.id)
    job_id = await _create_job(current_user.id, "compliance")
    background_tasks.add_task(_run_compliance, job_id, body.generation_id, current_user.id)
    return {"job_id": job_id, "status": "processing"}


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

    # Self-Executing Trust Anchor: materialize enabled trigger conditions into an escrow.
    trust_anchor = None
    active_conditions = [c for c in (gen.get("conditions", []) or []) if c.get("enabled")]
    if active_conditions:
        try:
            trust_anchor = await _create_trust_anchor(
                gen, current_user, active_conditions, gen.get("signers", []) or [], content_hash, anchor_id,
            )
            await db.ai_generated_docs.update_one(
                {"id": body.generation_id}, {"$set": {"trust_anchor_escrow_id": trust_anchor["escrow_id"]}}
            )
        except Exception as e:
            logger.error(f"Trust Anchor creation failed (document still anchored): {e}")

    return {
        "anchor_id": anchor_id,
        "content_hash": content_hash,
        "transaction_id": record["transaction_id"],
        "topic_id": record["topic_id"],
        "explorer_url": record["explorer_url"],
        "network": record["network"],
        "anchored_at": record["anchored_at"],
        "title": title,
        "trust_anchor": trust_anchor,
    }
