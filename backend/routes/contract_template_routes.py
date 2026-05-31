"""
Smart Contract Template Library routes.

Browse curated legal-agreement templates, render them (deterministic field
substitution + optional GPT-5.2 clause tailoring), and ANCHOR the finalized
agreement on Hedera HCS for an immutable, timestamped proof. Anchoring is gated
behind identity verification (consistent with the notarization flow).
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
import os
import uuid
import hashlib
import logging

from models import User
from routes.auth_routes import get_current_user
from middleware.security import limiter
from services.hedera_service import hedera_service
import legal_templates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contract-templates", tags=["contract-templates"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def set_db(database):
    global db
    db = database


class RenderRequest(BaseModel):
    values: Dict[str, str] = {}
    ai_tailor: bool = False
    instructions: Optional[str] = None


class AnchorRequest(BaseModel):
    template_id: str
    title: str
    content: str


@router.get("")
@router.get("/")
async def list_contract_templates(category: Optional[str] = None, q: Optional[str] = None):
    """List available agreement templates, optionally filtered by category/search."""
    return {
        "categories": [{"id": k, "label": v} for k, v in legal_templates.CATEGORIES.items()],
        "templates": legal_templates.list_templates(category=category, query=q),
    }


@router.get("/detail/{template_id}")
async def get_contract_template(template_id: str):
    """Full template detail incl. the field schema for the fill-in form."""
    t = legal_templates.get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": t["id"], "name": t["name"], "category": t["category"],
        "category_label": legal_templates.CATEGORIES.get(t["category"], t["category"]),
        "icon": t["icon"], "description": t["description"], "fields": t["fields"],
    }


async def _run_tailor_job(job_id: str, base_content: str, instructions: Optional[str], user_id: str):
    """Background worker: tailor an agreement with GPT-5.2 and persist the result.

    Runs OUTSIDE the request/response cycle so a slow LLM cold-start can never cause
    a proxy 502 — the frontend polls /tailor-status/{job_id} for the outcome.
    """
    final_content, ai_used, error = base_content, False, None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        extra = f"\n\nAdditional instructions from the user: {instructions}" if instructions else ""
        prompt = (
            "You are a legal drafting assistant. Improve and tailor the following agreement: "
            "tighten the language, add any standard protective clauses that are clearly missing "
            "(e.g. severability, entire-agreement, notices), and keep all party names, dates, and "
            "figures EXACTLY as given. Do NOT invent facts or fill blanks shown as [__________]. "
            "Return ONLY the full revised agreement as plain text — no preamble, no markdown fences."
            f"{extra}\n\n--- AGREEMENT ---\n{base_content}"
        )
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"contract_tailor_{user_id}_{datetime.now().timestamp()}",
            system_message="You are a meticulous legal document editor.",
        ).with_model("openai", "gpt-5.2")
        text = (await chat.send_message(UserMessage(text=prompt))).strip()
        if text.startswith("```"):
            text = "\n".join(ln for ln in text.split("\n") if not ln.strip().startswith("```")).strip()
        if len(text) > 100:
            final_content, ai_used = text, True
    except Exception as e:
        error = str(e)
        logger.warning(f"AI tailoring job {job_id} failed, falling back to base render: {e}")

    await db.tailor_jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "failed" if error else "done",
            "content": final_content,
            "ai_tailored": ai_used,
            "error": error,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


@router.post("/render/{template_id}")
@limiter.limit("20/minute")
async def render_contract_template(
    request: Request,
    template_id: str,
    body: RenderRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Render a template instantly. If AI tailoring is requested, kick it off in the
    background and return a `tailor_job_id` the client can poll — keeping this request fast.
    """
    rendered = legal_templates.render_template(template_id, body.values)
    if rendered.get("error"):
        raise HTTPException(status_code=404, detail=rendered["error"])

    rendered["ai_tailored"] = False
    if body.ai_tailor and EMERGENT_KEY:
        job_id = str(uuid.uuid4())
        await db.tailor_jobs.insert_one({
            "id": job_id,
            "user_id": current_user.id,
            "status": "pending",
            "content": None,
            "ai_tailored": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background_tasks.add_task(
            _run_tailor_job, job_id, rendered["content"], body.instructions, current_user.id,
        )
        rendered["tailor_job_id"] = job_id

    return rendered


@router.get("/tailor-status/{job_id}")
async def tailor_status(job_id: str, current_user: User = Depends(get_current_user)):
    """Poll the status of a background AI-tailoring job."""
    doc = await db.tailor_jobs.find_one(
        {"id": job_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Tailor job not found")
    return {
        "status": doc.get("status", "pending"),
        "content": doc.get("content"),
        "ai_tailored": doc.get("ai_tailored", False),
    }


@router.post("/anchor")
@limiter.limit("10/minute")
async def anchor_contract(
    request: Request,
    body: AnchorRequest,
    current_user: User = Depends(get_current_user),
):
    """Anchor a finalized agreement on Hedera HCS. Requires identity verification."""
    # Identity gate — consistent with the notarization flow.
    user_doc = await db.users.find_one(
        {"id": current_user.id}, {"role": 1, "identity_verified": 1, "full_name": 1}
    )
    role = (user_doc or {}).get("role", "user")
    if role == "user" and not (user_doc or {}).get("identity_verified"):
        raise HTTPException(status_code=403, detail="identity_verification_required")

    content = (body.content or "").strip()
    if len(content) < 20:
        raise HTTPException(status_code=400, detail="Agreement content is too short to anchor")

    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    template = legal_templates.get_template(body.template_id)
    template_name = template["name"] if template else (body.title or "Agreement")

    seal = await hedera_service.seal_document(
        document_hash=content_hash,
        document_name=body.title or template_name,
        user_id=current_user.id,
        metadata={
            "kind": "smart_contract_agreement",
            "template_id": body.template_id,
            "template_name": template_name,
            "anchored_by": (user_doc or {}).get("full_name", current_user.email),
        },
    )

    anchor_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": anchor_id,
        "user_id": current_user.id,
        "template_id": body.template_id,
        "template_name": template_name,
        "title": body.title or template_name,
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
    record.pop("_id", None)

    return {
        "anchor_id": anchor_id,
        "content_hash": content_hash,
        "transaction_id": record["transaction_id"],
        "topic_id": record["topic_id"],
        "sequence_number": record["sequence_number"],
        "hcs_submitted": record["hcs_submitted"],
        "verification_hash": record["verification_hash"],
        "explorer_url": record["explorer_url"],
        "network": record["network"],
        "anchored_at": record["anchored_at"],
        "title": record["title"],
        "template_name": template_name,
    }


@router.get("/anchors/my")
async def my_anchored_contracts(current_user: User = Depends(get_current_user)):
    """List the user's anchored agreements (for the certificate / history view)."""
    cursor = db.contract_anchors.find(
        {"user_id": current_user.id},
        {"_id": 0, "content": 0},
    ).sort("created_at", -1).limit(50)
    return {"anchors": await cursor.to_list(50)}


@router.get("/anchors/{anchor_id}")
async def get_anchored_contract(anchor_id: str, current_user: User = Depends(get_current_user)):
    """Fetch a single anchored agreement incl. content (certificate view)."""
    doc = await db.contract_anchors.find_one(
        {"id": anchor_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Anchored agreement not found")
    return doc


@router.get("/verify/{content_hash}")
async def verify_contract_by_hash(content_hash: str):
    """PUBLIC: verify an agreement's integrity by its SHA-256 hash. No auth required.

    Returns only non-sensitive proof metadata — never the agreement text — so anyone
    holding the document can independently confirm it was anchored and untampered.
    """
    content_hash = (content_hash or "").strip().lower()
    if len(content_hash) != 64 or not all(c in "0123456789abcdef" for c in content_hash):
        return {"verified": False, "reason": "invalid_hash_format"}

    doc = await db.contract_anchors.find_one(
        {"content_hash": content_hash, "status": "anchored"},
        {
            "_id": 0, "content": 0, "user_id": 0,
        },
    )
    if not doc:
        return {"verified": False}

    return {
        "verified": True,
        "anchor": {
            "content_hash": doc.get("content_hash"),
            "title": doc.get("title"),
            "template_name": doc.get("template_name"),
            "transaction_id": doc.get("transaction_id"),
            "topic_id": doc.get("topic_id"),
            "sequence_number": doc.get("sequence_number"),
            "hcs_submitted": doc.get("hcs_submitted", False),
            "verification_hash": doc.get("verification_hash"),
            "explorer_url": doc.get("explorer_url"),
            "network": doc.get("network"),
            "anchored_at": doc.get("anchored_at"),
        },
    }
