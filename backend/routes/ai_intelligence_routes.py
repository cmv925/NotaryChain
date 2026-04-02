"""
AI Document Intelligence Routes
Endpoints for: Risk Scoring, Smart Notary Matching, Fraud Detection Dashboard,
AI Document Summarization, Voice-Authenticated Ceremonies.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from middleware.security import limiter
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-intelligence", tags=["ai-intelligence"])
db = None

MAX_DOCUMENT_LENGTH = 50000  # chars


def set_db(database):
    global db
    db = database


# ── Auth helpers ──

async def _get_user(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _require_admin_or_notary(request: Request):
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")
    return user


# ══════════════════════════════════════════════
#  1. AI DOCUMENT RISK SCORING
# ══════════════════════════════════════════════

class RiskScoreRequest(BaseModel):
    document_text: str = Field(..., max_length=50000)
    document_name: str = Field(default="Untitled Document", max_length=500)


@router.post("/risk-score")
@limiter.limit("10/minute")
async def risk_score_endpoint(body: RiskScoreRequest, request: Request):
    """Score a document for legal risk factors using GPT-5.2."""
    user = await _get_user(request)
    from services.ai_document_intelligence import score_document_risk

    result = await score_document_risk(body.document_text, body.document_name)

    # Store the analysis
    record = {
        "analysis_id": str(uuid.uuid4()),
        "type": "risk_score",
        "user_email": user.get("email"),
        "document_name": body.document_name,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_analyses.insert_one(record)

    return {
        "analysis_id": record["analysis_id"],
        **result,
    }


# ══════════════════════════════════════════════
#  2. AI DOCUMENT SUMMARIZATION
# ══════════════════════════════════════════════

class SummarizeRequest(BaseModel):
    document_text: str = Field(..., max_length=50000)
    document_name: str = Field(default="Untitled Document", max_length=500)


@router.post("/summarize")
@limiter.limit("10/minute")
async def summarize_endpoint(body: SummarizeRequest, request: Request):
    """Generate a plain-English summary of a legal document."""
    user = await _get_user(request)
    from services.ai_document_intelligence import summarize_document

    result = await summarize_document(body.document_text, body.document_name)

    record = {
        "analysis_id": str(uuid.uuid4()),
        "type": "summarize",
        "user_email": user.get("email"),
        "document_name": body.document_name,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_analyses.insert_one(record)

    return {
        "analysis_id": record["analysis_id"],
        **result,
    }


# ══════════════════════════════════════════════
#  3. SMART NOTARY MATCHING
# ══════════════════════════════════════════════

class MatchNotaryRequest(BaseModel):
    document_type: str = Field(default="contract", max_length=100)
    jurisdiction: str = Field(default="All States", max_length=200)
    urgency: str = Field(default="normal", max_length=20)


@router.post("/match-notary")
@limiter.limit("15/minute")
async def match_notary_endpoint(body: MatchNotaryRequest, request: Request):
    """AI-powered notary recommendation engine."""
    user = await _get_user(request)
    from services.ai_document_intelligence import match_notary

    result = await match_notary(db, body.document_type, body.jurisdiction, body.urgency)
    return result


# ══════════════════════════════════════════════
#  4. FRAUD DETECTION DASHBOARD
# ══════════════════════════════════════════════

@router.get("/fraud-analytics")
@limiter.limit("20/minute")
async def fraud_analytics_endpoint(request: Request):
    """Admin-facing fraud detection analytics dashboard data."""
    user = await _require_admin_or_notary(request)
    from services.ai_document_intelligence import get_fraud_analytics

    result = await get_fraud_analytics(db)
    return result


# ══════════════════════════════════════════════
#  5. VOICE-AUTHENTICATED CEREMONY
# ══════════════════════════════════════════════

class VoiceAuthRequest(BaseModel):
    audio_base64: str = Field(default="", max_length=5000000)
    party_name: str = Field(..., max_length=200)
    expected_phrase: Optional[str] = Field(default=None, max_length=500)


@router.post("/voice-auth")
@limiter.limit("5/minute")
async def voice_auth_endpoint(body: VoiceAuthRequest, request: Request):
    """Voice biometric verification for ceremony authentication."""
    user = await _get_user(request)
    from services.ai_document_intelligence import verify_voice_biometric

    phrase = body.expected_phrase or f"I, {body.party_name}, confirm my identity and consent to this notarization."
    result = await verify_voice_biometric(body.audio_base64, body.party_name, phrase)

    record = {
        "verification_id": str(uuid.uuid4()),
        "type": "voice_auth",
        "user_email": user.get("email"),
        "party_name": body.party_name,
        "result": {k: v for k, v in result.items() if k != "audio_base64"},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_analyses.insert_one(record)

    return {
        "verification_id": record["verification_id"],
        **result,
    }


# ══════════════════════════════════════════════
#  HISTORY / ANALYTICS
# ══════════════════════════════════════════════

@router.get("/history")
async def get_analysis_history(request: Request, limit: int = 20):
    """Get recent AI analysis history for the current user."""
    user = await _get_user(request)
    limit = min(limit, 100)  # Cap to prevent excessive queries
    analyses = []
    cursor = db.ai_analyses.find(
        {"user_email": user.get("email")},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        analyses.append(doc)
    return {"analyses": analyses, "total": len(analyses)}
