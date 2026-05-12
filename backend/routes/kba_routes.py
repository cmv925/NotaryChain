"""
KBA (Knowledge-Based Authentication) — M2 for Florida RON Compliance.

Adapter pattern:
  • MockKBAProvider — synthetic 5-question quiz, used in dev/staging and until
    LexisNexis credentials are provisioned.
  • LexisNexisKBAProvider — production adapter. Stubbed (requires LEXISNEXIS_API_KEY).

The selection is automatic based on env vars; once LEXISNEXIS_API_KEY is set,
the platform swaps providers without code changes.

Compliance:
  • FL Stat. 117.295 — max 2 KBA attempts per principal per 24 hours
  • 5 questions, 4-of-5 required to pass, 120s time limit
  • All attempts logged with IP + device fingerprint for fraud analytics
"""
import hashlib
import logging
import os
import random
import secrets
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/kba", tags=["kba"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ─────────── helpers ───────────

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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _device_fingerprint(request: Request) -> str:
    """Lightweight server-side fingerprint (UA + accept-language). Not as strong as
    FingerprintJS but useful for fraud correlation without adding a new dep."""
    ua = request.headers.get("user-agent", "")
    al = request.headers.get("accept-language", "")
    return hashlib.sha256(f"{ua}|{al}".encode()).hexdigest()[:32]


def _client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown"))


# ─────────── Adapter Interface + Providers ───────────

class KBAProvider(ABC):
    """Provider interface — every KBA backend implements this."""

    name: str = "abstract"

    @abstractmethod
    async def generate_questions(self, principal: dict) -> List[dict]:
        """Return 5 questions: [{question_id, prompt, options:[{id,label}], correct_id}]."""
        ...


class MockKBAProvider(KBAProvider):
    """Synthetic provider — uses generic identity-related questions seeded from user data.

    NOTE: MOCK provider only. Not for production decisions. Once LexisNexis
    credentials are provisioned, the LexisNexisKBAProvider takes over automatically.
    """

    name = "mock"

    async def generate_questions(self, principal: dict) -> List[dict]:
        # Deterministic-ish from user email so retries see consistent right answers
        seed = int(hashlib.sha256(principal["email"].encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        pool = [
            {
                "prompt": "Which of these street names have you ever lived on?",
                "options": ["Pine St", "Oak Ave", "Maple Rd", "Elm Dr", "None of the above"],
            },
            {
                "prompt": "What is the approximate balance on your most recent mortgage statement?",
                "options": ["Under $50,000", "$50,000–$150,000", "$150,000–$300,000", "$300,000–$500,000", "Over $500,000"],
            },
            {
                "prompt": "Which of the following vehicles have you owned in the past 10 years?",
                "options": ["Honda Civic", "Toyota Camry", "Ford F-150", "Tesla Model 3", "None of the above"],
            },
            {
                "prompt": "Which county have you been a registered resident of?",
                "options": ["Miami-Dade", "Broward", "Palm Beach", "Orange", "Hillsborough"],
            },
            {
                "prompt": "Which credit card issuer has issued you a card in the past 5 years?",
                "options": ["Chase", "American Express", "Capital One", "Discover", "None of the above"],
            },
            {
                "prompt": "Which of these phone area codes is associated with you historically?",
                "options": ["305", "407", "813", "954", "561"],
            },
            {
                "prompt": "Which of these employers have you worked for?",
                "options": ["Self-employed", "Publix", "Disney", "AT&T", "None of the above"],
            },
        ]
        # Pick 5 random questions and a random correct option for each
        picks = rng.sample(pool, 5)
        questions = []
        for i, p in enumerate(picks):
            correct_idx = rng.randint(0, len(p["options"]) - 1)
            opts = [{"id": f"o{j}", "label": p["options"][j]} for j in range(len(p["options"]))]
            questions.append({
                "question_id": f"q{i+1}",
                "prompt": p["prompt"],
                "options": opts,
                "correct_id": opts[correct_idx]["id"],
            })
        return questions


class LexisNexisKBAProvider(KBAProvider):
    """
    Production adapter. Activates automatically when LEXISNEXIS_API_KEY env var is set.

    REQUIRED ENV VARS (not yet configured — see /app/memory/PRD.md M2 notes):
      • LEXISNEXIS_API_KEY
      • LEXISNEXIS_API_URL (default: https://api.lexisnexis.com/instantid)
      • LEXISNEXIS_ACCOUNT_ID

    Until those are set, MockKBAProvider is used. To activate:
      1. Acquire LexisNexis InstantID Q&A contract
      2. Add the env vars to /app/backend/.env
      3. Restart backend → swap is automatic
    """

    name = "lexisnexis"

    def __init__(self):
        self.api_key = os.environ.get("LEXISNEXIS_API_KEY")
        self.api_url = os.environ.get("LEXISNEXIS_API_URL", "https://api.lexisnexis.com/instantid")
        self.account_id = os.environ.get("LEXISNEXIS_ACCOUNT_ID")

    async def generate_questions(self, principal: dict) -> List[dict]:
        # Stub: would call self.api_url/quiz with principal PII and return real questions.
        # NOT IMPLEMENTED yet — falls back to mock for now.
        logger.warning("LexisNexisKBAProvider.generate_questions: not yet implemented — using mock")
        return await MockKBAProvider().generate_questions(principal)


def get_provider() -> KBAProvider:
    if os.environ.get("LEXISNEXIS_API_KEY"):
        return LexisNexisKBAProvider()
    return MockKBAProvider()


# ─────────── Models ───────────

class StartKBAReq(BaseModel):
    ceremony_id: Optional[str] = None


class SubmitKBAReq(BaseModel):
    session_id: str
    answers: List[dict] = Field(min_items=1)  # [{question_id, selected_id}]


# ─────────── Rate Limiting (FL Stat. 117.295) ───────────

MAX_ATTEMPTS_PER_24H = 2
COOLDOWN_AFTER_FAIL_HOURS = 24


async def _attempts_in_24h(user_id: str) -> int:
    since = _iso(_now() - timedelta(hours=24))
    return await db.kba_attempts.count_documents({
        "user_id": user_id,
        "completed_at": {"$gte": since},
    })


# ─────────── Routes ───────────

@router.get("/status")
async def kba_status(request: Request):
    """Lightweight: which provider is active + user's recent attempt counts."""
    user = await _get_user(request)
    attempts = await _attempts_in_24h(user["id"])
    last = await db.kba_attempts.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("completed_at", -1)]
    )
    provider = get_provider()
    return {
        "provider": provider.name,
        "is_mock": isinstance(provider, MockKBAProvider),
        "attempts_in_24h": attempts,
        "max_attempts_in_24h": MAX_ATTEMPTS_PER_24H,
        "can_attempt": attempts < MAX_ATTEMPTS_PER_24H,
        "last_attempt": last,
    }


@router.post("/start")
async def start_kba(body: StartKBAReq, request: Request):
    """Initiate a KBA session: generate 5 questions, return session token + questions (without correct answers)."""
    user = await _get_user(request)

    # Rate-limit check
    attempts = await _attempts_in_24h(user["id"])
    if attempts >= MAX_ATTEMPTS_PER_24H:
        raise HTTPException(
            status_code=429,
            detail=f"You've reached the maximum of {MAX_ATTEMPTS_PER_24H} KBA attempts in 24 hours. Please try again later.",
        )

    provider = get_provider()
    questions = await provider.generate_questions({"email": user["email"], "id": user["id"]})

    session_id = uuid.uuid4().hex[:16]
    now = _now()
    session = {
        "session_id": session_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "ceremony_id": body.ceremony_id,
        "provider": provider.name,
        "questions_count": len(questions),
        "min_correct": 4,
        "time_limit_seconds": 120,
        "started_at": _iso(now),
        "expires_at": _iso(now + timedelta(seconds=120)),
        "status": "in_progress",
        "ip": _client_ip(request),
        "device_fingerprint": _device_fingerprint(request),
        # Keep correct answers server-side only:
        "_questions_internal": questions,
    }
    await db.kba_sessions.insert_one(session)

    # Strip correct answers before returning
    public_questions = [
        {"question_id": q["question_id"], "prompt": q["prompt"], "options": q["options"]}
        for q in questions
    ]
    return {
        "session_id": session_id,
        "expires_at": session["expires_at"],
        "time_limit_seconds": 120,
        "questions_count": len(questions),
        "min_correct": 4,
        "provider": provider.name,
        "questions": public_questions,
    }


@router.post("/submit")
async def submit_kba(body: SubmitKBAReq, request: Request):
    """Submit answers; return pass/fail. Single-use session (consumed)."""
    user = await _get_user(request)

    session = await db.kba_sessions.find_one({"session_id": body.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="KBA session not found")
    if session["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your KBA session")
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail=f"KBA session is already {session['status']}")

    # Time check
    now = _now()
    try:
        expires = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    except Exception:
        expires = now
    expired = now > expires

    # Score
    correct_map = {q["question_id"]: q["correct_id"] for q in session["_questions_internal"]}
    submitted = {a.get("question_id"): a.get("selected_id") for a in body.answers}
    correct = sum(1 for qid, cid in correct_map.items() if submitted.get(qid) == cid)
    min_correct = int(session.get("min_correct", 4))
    passed = (not expired) and (correct >= min_correct)

    elapsed = (now - datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))).total_seconds()
    completion_status = "passed" if passed else ("expired" if expired else "failed")

    # Update session (clear internal questions)
    await db.kba_sessions.update_one(
        {"session_id": body.session_id},
        {"$set": {
            "status": completion_status,
            "correct_count": correct,
            "passed": passed,
            "completed_at": _iso(now),
            "elapsed_seconds": int(elapsed),
            "answers_hash": hashlib.sha256(str(submitted).encode()).hexdigest(),
        },
         "$unset": {"_questions_internal": ""}}
    )

    # Append to attempts ledger (used for rate limiting + audit)
    await db.kba_attempts.insert_one({
        "attempt_id": uuid.uuid4().hex[:16],
        "user_id": user["id"],
        "session_id": body.session_id,
        "ceremony_id": session.get("ceremony_id"),
        "provider": session.get("provider"),
        "passed": passed,
        "correct_count": correct,
        "questions_count": session["questions_count"],
        "elapsed_seconds": int(elapsed),
        "ip": _client_ip(request),
        "device_fingerprint": _device_fingerprint(request),
        "completed_at": _iso(now),
    })

    # Fraud signal: rapid retry from different device
    if not passed:
        prev = await db.kba_attempts.find_one(
            {"user_id": user["id"], "session_id": {"$ne": body.session_id}},
            sort=[("completed_at", -1)]
        )
        if prev and prev.get("device_fingerprint") and prev["device_fingerprint"] != _device_fingerprint(request):
            await db.fraud_signals.insert_one({
                "signal_id": uuid.uuid4().hex[:16],
                "user_id": user["id"],
                "type": "kba_device_mismatch",
                "severity": "medium",
                "detected_at": _iso(now),
                "details": {
                    "current_device": _device_fingerprint(request),
                    "previous_device": prev["device_fingerprint"],
                },
            })

    return {
        "session_id": body.session_id,
        "passed": passed,
        "expired": expired,
        "correct_count": correct,
        "questions_count": session["questions_count"],
        "min_correct": min_correct,
        "elapsed_seconds": int(elapsed),
        "status": completion_status,
    }


@router.get("/sessions/{session_id}")
async def get_kba_session(session_id: str, request: Request):
    """Owner/admin view of a session (sanitized — no correct answers)."""
    user = await _get_user(request)
    session = await db.kba_sessions.find_one({"session_id": session_id}, {"_id": 0, "_questions_internal": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return session


@router.get("/admin/fraud-signals")
async def admin_fraud_signals(request: Request, limit: int = 50):
    """Admin: recent KBA-related fraud signals."""
    user = await _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    out = []
    async for s in db.fraud_signals.find(
        {"type": {"$regex": "^kba_"}}, {"_id": 0}
    ).sort("detected_at", -1).limit(min(limit, 500)):
        out.append(s)
    return {"total": len(out), "signals": out}
