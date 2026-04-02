"""
Escrow Oracle Service — External data verification for escrow conditions.
Simulates oracle connections (shipping, inspection, appraisal) and
provides real GPT-5.2 AI photo verification for milestone completion.
"""
import os
import uuid
import random
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ─── Simulated Oracle Data Sources ───

SHIPPING_STATUSES = [
    {"status": "in_transit", "location": "Memphis, TN Hub", "eta_days": 2, "verified": False},
    {"status": "out_for_delivery", "location": "Local Distribution Center", "eta_days": 0, "verified": False},
    {"status": "delivered", "location": "Delivered to recipient", "eta_days": 0, "verified": True},
    {"status": "delivered", "location": "Signed by J. SMITH", "eta_days": 0, "verified": True},
]

INSPECTION_RESULTS = [
    {"result": "passed", "score": 92, "inspector": "J. Williams, PE", "license": "PE-2024-88431", "findings": "All systems operational. Minor cosmetic issue in garage noted (non-structural).", "verified": True},
    {"result": "passed_with_notes", "score": 78, "inspector": "M. Chen, PE", "license": "PE-2023-76210", "findings": "HVAC unit nearing end of life (3-5 yrs). Roof in good condition. Plumbing passed.", "verified": True},
    {"result": "failed", "score": 45, "inspector": "R. Garcia, PE", "license": "PE-2024-91002", "findings": "Foundation crack detected in southeast corner. Mold present in crawl space. Requires remediation.", "verified": False},
]

APPRAISAL_RESULTS = [
    {"appraised_value": 365000, "vs_purchase": "above", "appraiser": "National Appraisal Group", "method": "Comparable Sales", "verified": True},
    {"appraised_value": 348000, "vs_purchase": "at_value", "appraiser": "Metro Valuation Services", "method": "Income Approach", "verified": True},
    {"appraised_value": 310000, "vs_purchase": "below", "appraiser": "Regional Appraisal Co", "method": "Cost Approach", "verified": False},
]

TITLE_RESULTS = [
    {"status": "clear", "title_company": "First American Title", "policy_number": f"FA-{random.randint(100000,999999)}", "liens": 0, "encumbrances": [], "verified": True},
    {"status": "clear", "title_company": "Stewart Title Guaranty", "policy_number": f"ST-{random.randint(100000,999999)}", "liens": 0, "encumbrances": [], "verified": True},
    {"status": "defect_found", "title_company": "Chicago Title", "policy_number": None, "liens": 1, "encumbrances": ["Mechanics lien - $12,400"], "verified": False},
]


async def check_oracle(oracle_type: str, condition: dict, escrow: dict) -> dict:
    """
    Query an oracle data source to verify an escrow condition.
    Returns oracle result with verification status.
    """
    now = datetime.now(timezone.utc).isoformat()
    oracle_id = uuid.uuid4().hex[:8]

    if oracle_type == "shipping_tracker":
        data = random.choice(SHIPPING_STATUSES)
        return {
            "oracle_id": oracle_id,
            "oracle_type": oracle_type,
            "source": "FedEx Tracking API",
            "queried_at": now,
            "condition_met": data["verified"],
            "data": data,
            "confidence": 0.99 if data["verified"] else 0.95,
            "hash": hashlib.sha256(f"oracle-{oracle_id}-{now}".encode()).hexdigest()[:16],
        }

    elif oracle_type == "inspection_service":
        data = random.choice(INSPECTION_RESULTS)
        return {
            "oracle_id": oracle_id,
            "oracle_type": oracle_type,
            "source": "National Home Inspection Registry",
            "queried_at": now,
            "condition_met": data["verified"],
            "data": data,
            "confidence": 0.97 if data["verified"] else 0.85,
            "hash": hashlib.sha256(f"oracle-{oracle_id}-{now}".encode()).hexdigest()[:16],
        }

    elif oracle_type == "appraisal_service":
        purchase_price = escrow.get("financial", {}).get("escrow_amount", 350000)
        data = random.choice(APPRAISAL_RESULTS)
        data["purchase_price"] = purchase_price
        return {
            "oracle_id": oracle_id,
            "oracle_type": oracle_type,
            "source": data["appraiser"],
            "queried_at": now,
            "condition_met": data["verified"],
            "data": data,
            "confidence": 0.94 if data["verified"] else 0.80,
            "hash": hashlib.sha256(f"oracle-{oracle_id}-{now}".encode()).hexdigest()[:16],
        }

    elif oracle_type == "title_company_api":
        data = random.choice(TITLE_RESULTS)
        return {
            "oracle_id": oracle_id,
            "oracle_type": oracle_type,
            "source": data["title_company"],
            "queried_at": now,
            "condition_met": data["verified"],
            "data": data,
            "confidence": 0.99 if data["verified"] else 0.70,
            "hash": hashlib.sha256(f"oracle-{oracle_id}-{now}".encode()).hexdigest()[:16],
        }

    else:
        return {
            "oracle_id": oracle_id,
            "oracle_type": oracle_type,
            "source": "Generic Oracle",
            "queried_at": now,
            "condition_met": random.random() > 0.3,
            "data": {"message": f"Oracle '{oracle_type}' check complete"},
            "confidence": 0.80,
            "hash": hashlib.sha256(f"oracle-{oracle_id}-{now}".encode()).hexdigest()[:16],
        }


async def verify_photo_with_ai(photo_base64: str, condition: dict) -> dict:
    """
    Use GPT-5.2 Vision to verify photo evidence against a condition.
    Analyzes whether the uploaded photo proves the milestone is complete.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    if not EMERGENT_KEY:
        return {
            "verified": False,
            "ai_powered": False,
            "error": "EMERGENT_LLM_KEY not configured",
            "confidence": 0,
        }

    system_prompt = """You are an escrow condition verifier for NotaryChain. 
You analyze photos submitted as evidence that a contractual milestone has been completed.
You must determine if the photo provides sufficient evidence that the described condition is met.
Respond with ONLY valid JSON:
{
  "verified": true or false,
  "confidence": 0.0 to 1.0,
  "analysis": "2-3 sentence analysis of what the photo shows",
  "evidence_quality": "strong" or "moderate" or "weak" or "insufficient",
  "concerns": ["list of any concerns"] or []
}"""

    prompt = f"""Analyze this photo as evidence for the following escrow condition:

CONDITION: {condition.get('title', 'Unknown')}
DESCRIPTION: {condition.get('description', 'No description')}
CATEGORY: {condition.get('category', 'general')}

Does this photo provide sufficient evidence that this condition has been met?
Consider: Is the subject relevant? Is the quality sufficient? Are there any signs of manipulation?"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"escrow-photo-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.2")

        import json
        response = await chat.send_message(
            UserMessage(
                text=prompt,
                images=[ImageContent(base64=photo_base64)],
            )
        )

        # Parse response
        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [line for line in text.split("\n") if not line.strip().startswith("```")]
            text = "\n".join(lines).strip()

        try:
            result = json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
            else:
                result = {"verified": False, "confidence": 0.5, "analysis": "Could not parse AI response", "evidence_quality": "insufficient", "concerns": []}

        return {
            "verified": result.get("verified", False),
            "ai_powered": True,
            "model": "gpt-5.2",
            "confidence": min(max(result.get("confidence", 0.5), 0.0), 1.0),
            "analysis": result.get("analysis", "Analysis complete"),
            "evidence_quality": result.get("evidence_quality", "moderate"),
            "concerns": result.get("concerns", []),
        }

    except Exception as ex:
        logger.warning(f"AI photo verification failed: {ex}")
        return {
            "verified": False,
            "ai_powered": False,
            "error": "AI verification temporarily unavailable",
            "confidence": 0,
        }


async def verify_biometric_identity(selfie_base64: str, party_name: str) -> dict:
    """
    Use GPT-5.2 Vision to perform biometric identity verification at settlement.
    Verifies liveness and identity consistency.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    if not EMERGENT_KEY:
        return {
            "verified": False,
            "liveness": False,
            "ai_powered": False,
            "error": "EMERGENT_LLM_KEY not configured",
        }

    system_prompt = """You are a biometric identity verification specialist for NotaryChain escrow settlements.
You analyze selfie photos to verify:
1. Liveness - Is this a real person (not a photo of a photo, screen capture, or mask)?
2. Identity consistency - Does the person appear legitimate and present?

Respond with ONLY valid JSON:
{
  "liveness_passed": true or false,
  "identity_verified": true or false,
  "confidence": 0.0 to 1.0,
  "liveness_indicators": ["list of indicators"],
  "concerns": ["list of any concerns"] or [],
  "analysis": "brief analysis"
}"""

    prompt = f"""Verify the identity of the escrow party "{party_name}" from this selfie.
Check for:
1. Real human face (not a photo of a screen, printout, or mask)
2. Good image quality suitable for identity verification
3. Single person in frame
4. No obvious signs of image manipulation"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"escrow-bio-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.2")

        import json
        response = await chat.send_message(
            UserMessage(
                text=prompt,
                images=[ImageContent(base64=selfie_base64)],
            )
        )

        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [line for line in text.split("\n") if not line.strip().startswith("```")]
            text = "\n".join(lines).strip()

        try:
            result = json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
            else:
                result = {"liveness_passed": False, "identity_verified": False, "confidence": 0.5}

        return {
            "verified": result.get("identity_verified", False) and result.get("liveness_passed", False),
            "liveness": result.get("liveness_passed", False),
            "identity_confirmed": result.get("identity_verified", False),
            "confidence": min(max(result.get("confidence", 0.5), 0.0), 1.0),
            "liveness_indicators": result.get("liveness_indicators", []),
            "concerns": result.get("concerns", []),
            "analysis": result.get("analysis", "Verification complete"),
            "ai_powered": True,
            "model": "gpt-5.2",
        }

    except Exception as ex:
        logger.warning(f"AI biometric verification failed: {ex}")
        return {
            "verified": False,
            "liveness": False,
            "ai_powered": False,
            "error": "Biometric verification temporarily unavailable",
            "confidence": 0,
        }
