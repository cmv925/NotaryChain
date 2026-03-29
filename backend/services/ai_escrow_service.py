"""
AI-Powered Escrow Condition Extraction using GPT-5.2
Parses uploaded contract documents (PDF, DOCX, TXT) and extracts
structured executable conditions for the escrow intelligence engine.
"""
import os
import json
import uuid
import hashlib
import tempfile
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

CONDITION_EXTRACTION_PROMPT = """You are an expert legal contract analyst for NotaryChain, an AI-powered escrow intelligence platform.

Analyze the following contract/agreement text and extract ALL executable conditions, contingencies, milestones, and deadlines that must be fulfilled before escrow funds can be released.

For each condition, classify it with:
- A clear short title
- A detailed description of what must happen
- The category (one of: inspection, financing, title, appraisal, closing, walkthrough, delivery, milestone, compliance, insurance, repair, legal, other)
- The trigger keyword (a snake_case identifier like "inspection_approved", "financing_secured", "title_clear")
- The verification method:
  * "party_confirmation" — requires one party to confirm (e.g., buyer approves inspection)
  * "biometric_confirmation" — requires biometric identity verification from one or both parties (use for final closing / high-value confirmations)
  * "oracle" — could be verified by an external data source / third-party API (title searches, appraisals, shipping tracking)
- Which party is required to act: "buyer", "seller", "both", or null (for oracle-verified)
- The deadline in days from contract execution (estimate if not explicitly stated)
- Your confidence score (0.0 to 1.0) that this is a real, enforceable condition
- The oracle_type if verification_method is "oracle" (e.g., "title_company_api", "appraisal_service", "shipping_tracker", "inspection_service") or null

Return ONLY a valid JSON array of condition objects. No markdown, no explanation, no preamble.
Each object must have this exact structure:
{
  "title": "string",
  "description": "string",
  "category": "string",
  "trigger": "string",
  "type": "milestone" or "date" or "deliverable",
  "verification_method": "party_confirmation" or "biometric_confirmation" or "oracle",
  "required_party": "buyer" or "seller" or "both" or null,
  "deadline_days": number,
  "confidence": number (0.0-1.0),
  "oracle_type": "string" or null
}

If the document does not appear to be a contract or agreement, return an empty array [].

CONTRACT TEXT:
"""


def _parse_json_response(text: str) -> list:
    """Parse JSON array from LLM response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "conditions" in result:
            return result["conditions"]
        return [result] if isinstance(result, dict) else []
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
        return []


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes."""
    from PyPDF2 import PdfReader
    import io
    reader = PdfReader(io.BytesIO(file_bytes))
    text_parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text_parts.append(t)
    return "\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes."""
    import docx
    import io
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extract text from file bytes based on extension."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif lower.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    elif lower.endswith(".txt") or lower.endswith(".md"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        return file_bytes.decode("utf-8", errors="replace")


async def extract_conditions_from_text(document_text: str, document_name: str = "Contract") -> dict:
    """
    Use GPT-5.2 to extract executable escrow conditions from contract text.
    Returns structured conditions ready for the escrow engine.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not EMERGENT_KEY:
        return {
            "success": False,
            "error": "EMERGENT_LLM_KEY not configured",
            "conditions": [],
        }

    # Truncate very long documents to fit context window
    max_chars = 30000
    if len(document_text) > max_chars:
        document_text = document_text[:max_chars] + "\n\n[... document truncated for analysis ...]"

    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"escrow-extract-{uuid.uuid4().hex[:8]}",
        system_message="You are a legal contract analyst. Always respond with valid JSON only. Never include markdown formatting."
    ).with_model("openai", "gpt-5.2")

    prompt = CONDITION_EXTRACTION_PROMPT + document_text

    try:
        response = await chat.send_message(UserMessage(text=prompt))
        raw_conditions = _parse_json_response(response)

        if not raw_conditions:
            return {
                "success": True,
                "conditions": [],
                "message": "No executable conditions found in the document.",
                "ai_model": "gpt-5.2",
            }

        # Enrich each condition with IDs and metadata
        now = datetime.now(timezone.utc).isoformat()
        conditions = []
        for c in raw_conditions:
            deadline_days = c.get("deadline_days", 30)
            conditions.append({
                "condition_id": uuid.uuid4().hex[:8],
                "type": c.get("type", "milestone"),
                "category": c.get("category", "other"),
                "title": c.get("title", "Untitled Condition"),
                "description": c.get("description", ""),
                "trigger": c.get("trigger", f"condition_{uuid.uuid4().hex[:6]}"),
                "verification_method": c.get("verification_method", "party_confirmation"),
                "required_party": c.get("required_party"),
                "deadline_days": deadline_days,
                "deadline": (datetime.now(timezone.utc) + timedelta(days=deadline_days)).isoformat(),
                "status": "pending",
                "confidence": min(max(c.get("confidence", 0.8), 0.0), 1.0),
                "oracle_type": c.get("oracle_type"),
                "created_at": now,
                "verified_at": None,
                "verified_by": None,
                "evidence": None,
            })

        return {
            "success": True,
            "conditions": conditions,
            "total": len(conditions),
            "document_name": document_name,
            "ai_model": "gpt-5.2",
            "chars_analyzed": len(document_text),
        }

    except Exception as ex:
        return {
            "success": False,
            "error": str(ex),
            "conditions": [],
            "ai_model": "gpt-5.2",
        }
