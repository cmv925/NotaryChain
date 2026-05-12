"""
Field Document Scanner — multi-page document capture + SHA256 Hedera anchoring
+ GPT-5.2 Vision forgery / tampering analysis.

Flow per scan:
  1. Frontend sends a list of base64-encoded page images.
  2. We compute a canonical SHA256 over (sorted page hashes joined by newline).
  3. We check Hedera (and our seal store) for an existing seal of that hash.
  4. We run GPT-5.2 Vision on each page (best-effort) and grade the document
     overall (low/medium/high tampering risk).
  5. We persist the scan + analysis; the caller can later seal it on Hedera
     by promoting the scan into the standard ceremony sealing flow.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

FORGERY_SYSTEM_PROMPT = (
    "You are a forensic document examiner. Inspect each provided document page image "
    "for signs of digital tampering, photocopy artifacts, mismatched fonts, inconsistent "
    "ink density, splicing seams, cloned regions, suspicious whitespace, or visible alterations. "
    "Respond with STRICT JSON only — no prose, no code fences. Schema:\n"
    "{\n"
    '  "overall_risk": "low" | "medium" | "high",\n'
    '  "overall_confidence": 0.0-1.0,\n'
    '  "pages": [ {"page_index": int, "risk": "low|medium|high", "confidence": 0.0-1.0,\n'
    '              "findings": [string], "page_summary": string} ],\n'
    '  "document_summary": string,\n'
    '  "recommendation": "accept" | "manual_review" | "reject"\n'
    "}\n"
    "Be specific and conservative; when in doubt say medium with manual_review. "
    "Never invent details about content; focus strictly on visual integrity signals."
)


# ───────────────── helpers ─────────────────

def _strip_data_url(b64: str) -> str:
    if not b64:
        return ""
    if b64.startswith("data:"):
        try:
            return b64.split(",", 1)[1]
        except IndexError:
            return ""
    return b64


def _page_sha256(b64: str) -> str:
    raw = base64.b64decode(_strip_data_url(b64), validate=False)
    return hashlib.sha256(raw).hexdigest()


def canonical_document_hash(page_b64_list: List[str]) -> tuple[str, List[str]]:
    """SHA256 over the sorted+joined page hashes, returning (doc_hash, page_hashes_in_order)."""
    page_hashes = [_page_sha256(p) for p in page_b64_list]
    canonical = "\n".join(sorted(page_hashes))
    return hashlib.sha256(canonical.encode()).hexdigest(), page_hashes


# ───────────────── AI forgery analysis ─────────────────

def _empty_analysis(reason: str, model_used: Optional[str] = None) -> Dict:
    return {
        "overall_risk": "medium",
        "overall_confidence": 0.5,
        "pages": [],
        "document_summary": reason,
        "recommendation": "manual_review",
        "ai_powered": False,
        "model": model_used,
    }


async def analyze_pages_for_forgery(page_b64_list: List[str]) -> Dict:
    """Best-effort GPT-5.2 Vision call across all pages of the scan."""
    if not page_b64_list:
        return _empty_analysis("No pages provided")
    if not EMERGENT_KEY:
        return _empty_analysis("EMERGENT_LLM_KEY not configured (degraded fallback)")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"scanner-{uuid.uuid4().hex[:8]}",
            system_message=FORGERY_SYSTEM_PROMPT,
        ).with_model("openai", "gpt-5.2")

        # Cap to first 5 pages to keep payload reasonable
        pages_for_ai = page_b64_list[:5]
        images = [ImageContent(image_base64=_strip_data_url(p)) for p in pages_for_ai]

        prompt = (
            f"Inspect these {len(pages_for_ai)} document page image(s) for tampering or forgery signs. "
            "Number the pages starting at 0 in the order provided. Respond with the JSON schema in your system prompt."
        )
        response = await chat.send_message(UserMessage(text=prompt, file_contents=images))

        text = (response or "").strip()
        if text.startswith("```"):
            text = "\n".join(line for line in text.split("\n") if not line.strip().startswith("```")).strip()
        try:
            result = json.loads(text)
        except Exception:
            start, end = text.find("{"), text.rfind("}") + 1
            result = json.loads(text[start:end]) if start >= 0 and end > start else {}

        if not isinstance(result, dict) or "overall_risk" not in result:
            return _empty_analysis("AI returned malformed JSON", "gpt-5.2")

        # Coerce + clamp
        result["overall_risk"] = result.get("overall_risk", "medium").lower()
        if result["overall_risk"] not in ("low", "medium", "high"):
            result["overall_risk"] = "medium"
        try:
            result["overall_confidence"] = float(min(max(result.get("overall_confidence", 0.5), 0.0), 1.0))
        except Exception:
            result["overall_confidence"] = 0.5
        result["recommendation"] = result.get("recommendation", "manual_review")
        if result["recommendation"] not in ("accept", "manual_review", "reject"):
            result["recommendation"] = "manual_review"
        result.setdefault("pages", [])
        result.setdefault("document_summary", "")
        result["ai_powered"] = True
        result["model"] = "gpt-5.2"
        return result

    except Exception as e:
        logger.warning(f"Field scanner AI analysis failed: {e}")
        return _empty_analysis(f"AI error: {str(e)[:150]}", "gpt-5.2")


# ───────────────── Hedera prior-seal lookup ─────────────────

async def check_existing_seal(db, document_hash: str) -> Optional[Dict]:
    """Return a previously sealed record for this exact SHA256 if one exists."""
    seal = await db.blockchain_seals.find_one(
        {"$or": [
            {"document_hash": document_hash},
            {"message_hash": document_hash},
            {"verification_hash": document_hash},
        ]},
        {"_id": 0},
        sort=[("sealed_at", -1)],
    )
    if not seal:
        return None
    return {
        "found": True,
        "topic_id": seal.get("topic_id"),
        "sequence_number": seal.get("sequence_number"),
        "transaction_id": seal.get("transaction_id"),
        "sealed_at": seal.get("sealed_at"),
        "explorer_url": seal.get("explorer_url"),
        "document_name": seal.get("document_name"),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
