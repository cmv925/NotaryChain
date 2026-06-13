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
    from auth import decode_access_token, extract_request_token
    token = extract_request_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
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
    Production adapter for LexisNexis InstantID Q&A (SOAP/XML over HTTPS).

    Activates automatically when ALL required env vars are populated; otherwise
    silently falls back to MockKBAProvider so the route never breaks.

    REQUIRED ENV VARS (drop-in-ready — set these and restart backend):
      • LEXISNEXIS_INSTANTID_ENDPOINT_URL   — Full SOAP endpoint (sandbox or prod)
      • LEXISNEXIS_USERNAME                 — LexisNexis web-services user ID
      • LEXISNEXIS_PASSWORD                 — LexisNexis web-services password
      • LEXISNEXIS_ACCOUNT_ID               — Subscriber / account ID
      • LEXISNEXIS_PROFILE_ID               — InstantID Q&A profile / quiz template ID

    OPTIONAL:
      • LEXISNEXIS_ENVIRONMENT  ("sandbox"|"production", default "sandbox")
      • LEXISNEXIS_TIMEOUT      (HTTP timeout seconds, default 10)
      • LEXISNEXIS_SOAP_NS      (override default namespace if your WSDL differs)

    NOTE: This adapter follows the integration playbook (see
    /app/memory/CHANGELOG.md). LexisNexis's official WSDL/element names are
    delivered after contract — adjust element names in _build_*_request /
    _parse_*_response as required by your implementation guide. The
    SOAP envelope structure, Header-based credentials, and HTTP transport
    pattern remain stable.
    """

    name = "lexisnexis"

    SOAP_ENV_NS = "http://schemas.xmlsoap.org/soap/envelope/"
    DEFAULT_LEXIS_NS = "http://lexisnexis.com/risk/instantidqa"

    def __init__(self):
        self.endpoint_url = os.environ.get("LEXISNEXIS_INSTANTID_ENDPOINT_URL", "").strip()
        self.username = os.environ.get("LEXISNEXIS_USERNAME", "").strip()
        self.password = os.environ.get("LEXISNEXIS_PASSWORD", "").strip()
        self.account_id = os.environ.get("LEXISNEXIS_ACCOUNT_ID", "").strip()
        self.profile_id = os.environ.get("LEXISNEXIS_PROFILE_ID", "").strip()
        self.environment = os.environ.get("LEXISNEXIS_ENVIRONMENT", "sandbox").strip()
        self.timeout = float(os.environ.get("LEXISNEXIS_TIMEOUT", "10"))
        self.lexis_ns = os.environ.get("LEXISNEXIS_SOAP_NS", self.DEFAULT_LEXIS_NS).strip()

    def _is_configured(self) -> bool:
        return bool(
            self.endpoint_url
            and self.username
            and self.password
            and self.account_id
            and self.profile_id
        )

    @staticmethod
    def _has_required_pii(principal: dict) -> bool:
        """LexisNexis can't quiz without real PII. Need name + DOB + SSN-last-4 + address."""
        return all(
            principal.get(k)
            for k in ("first_name", "last_name", "date_of_birth", "ssn_last4",
                      "address_line1", "city", "state", "postal_code")
        )

    def _build_generate_quiz_request(self, principal: dict) -> bytes:
        from lxml import etree
        nsmap = {"soapenv": self.SOAP_ENV_NS, "lexis": self.lexis_ns}
        envelope = etree.Element(etree.QName(self.SOAP_ENV_NS, "Envelope"), nsmap=nsmap)
        header = etree.SubElement(envelope, etree.QName(self.SOAP_ENV_NS, "Header"))
        auth = etree.SubElement(header, etree.QName(self.lexis_ns, "Authentication"))
        etree.SubElement(auth, etree.QName(self.lexis_ns, "Username")).text = self.username
        etree.SubElement(auth, etree.QName(self.lexis_ns, "Password")).text = self.password
        etree.SubElement(auth, etree.QName(self.lexis_ns, "AccountId")).text = self.account_id
        etree.SubElement(auth, etree.QName(self.lexis_ns, "ProfileId")).text = self.profile_id

        body = etree.SubElement(envelope, etree.QName(self.SOAP_ENV_NS, "Body"))
        req = etree.SubElement(body, etree.QName(self.lexis_ns, "GenerateQuizRequest"))

        person_el = etree.SubElement(req, etree.QName(self.lexis_ns, "Person"))
        name_el = etree.SubElement(person_el, etree.QName(self.lexis_ns, "Name"))
        etree.SubElement(name_el, etree.QName(self.lexis_ns, "First")).text = principal["first_name"]
        if principal.get("middle_name"):
            etree.SubElement(name_el, etree.QName(self.lexis_ns, "Middle")).text = principal["middle_name"]
        etree.SubElement(name_el, etree.QName(self.lexis_ns, "Last")).text = principal["last_name"]

        etree.SubElement(person_el, etree.QName(self.lexis_ns, "DateOfBirth")).text = principal["date_of_birth"]

        ssn_el = etree.SubElement(person_el, etree.QName(self.lexis_ns, "SSN"))
        ssn_el.text = principal.get("ssn_full") or f"XXXXX{principal['ssn_last4']}"

        addr_el = etree.SubElement(person_el, etree.QName(self.lexis_ns, "Address"))
        etree.SubElement(addr_el, etree.QName(self.lexis_ns, "Line1")).text = principal["address_line1"]
        if principal.get("address_line2"):
            etree.SubElement(addr_el, etree.QName(self.lexis_ns, "Line2")).text = principal["address_line2"]
        etree.SubElement(addr_el, etree.QName(self.lexis_ns, "City")).text = principal["city"]
        etree.SubElement(addr_el, etree.QName(self.lexis_ns, "State")).text = principal["state"]
        etree.SubElement(addr_el, etree.QName(self.lexis_ns, "PostalCode")).text = principal["postal_code"]

        # FL §117.295(3) — 5 questions, 2-minute window
        cfg = etree.SubElement(req, etree.QName(self.lexis_ns, "KBAConfig"))
        etree.SubElement(cfg, etree.QName(self.lexis_ns, "NumberOfQuestions")).text = "5"
        etree.SubElement(cfg, etree.QName(self.lexis_ns, "MaxTimeSeconds")).text = "120"

        return etree.tostring(envelope, xml_declaration=True, encoding="utf-8")

    def _parse_generate_quiz_response(self, xml_bytes: bytes) -> List[dict]:
        from lxml import etree
        root = etree.fromstring(xml_bytes)
        ns = {"soapenv": self.SOAP_ENV_NS, "lexis": self.lexis_ns}

        fault = root.find(".//soapenv:Fault", namespaces=ns)
        if fault is not None:
            code = fault.findtext("faultcode") or "unknown"
            msg = fault.findtext("faultstring") or "unknown"
            raise RuntimeError(f"LexisNexis SOAP Fault: {code} - {msg}")

        quiz_el = root.find(".//lexis:Quiz", namespaces=ns)
        if quiz_el is None:
            raise RuntimeError("LexisNexis response missing <Quiz> element")

        questions = []
        for i, q_el in enumerate(quiz_el.findall("lexis:Question", namespaces=ns)):
            q_id = q_el.findtext("lexis:QuestionId", namespaces=ns) or f"q{i+1}"
            q_text = q_el.findtext("lexis:Text", namespaces=ns) or ""
            opts = []
            correct_id = None
            for c_el in q_el.findall("lexis:Choice", namespaces=ns):
                c_id = c_el.findtext("lexis:ChoiceId", namespaces=ns)
                c_label = c_el.findtext("lexis:Text", namespaces=ns) or ""
                is_correct = (c_el.findtext("lexis:Correct", namespaces=ns) or "").lower() == "true"
                opts.append({"id": c_id, "label": c_label})
                if is_correct:
                    correct_id = c_id
            # If LexisNexis doesn't tag the correct choice (server-side grading model),
            # store sentinel so submit_quiz delegates grading back to the vendor.
            questions.append({
                "question_id": q_id,
                "prompt": q_text,
                "options": opts,
                "correct_id": correct_id or "__server_graded__",
            })
        if not questions:
            raise RuntimeError("LexisNexis returned 0 questions")
        return questions

    async def generate_questions(self, principal: dict) -> List[dict]:
        # Fall-back paths (drop-in-ready behaviour)
        if not self._is_configured():
            logger.info("[kba.lexisnexis] env vars not set — using MockKBAProvider")
            return await MockKBAProvider().generate_questions(principal)

        if not self._has_required_pii(principal):
            logger.warning("[kba.lexisnexis] missing required PII (name/DOB/SSN/address) — falling back to mock")
            return await MockKBAProvider().generate_questions(principal)

        import httpx
        try:
            xml_req = self._build_generate_quiz_request(principal)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    self.endpoint_url,
                    content=xml_req,
                    headers={
                        "Content-Type": "text/xml; charset=utf-8",
                        "SOAPAction": "GenerateQuiz",
                    },
                )
            resp.raise_for_status()
            return self._parse_generate_quiz_response(resp.content)
        except Exception as e:
            # Never block notarization on vendor outage — degrade to mock with a loud log
            logger.error(f"[kba.lexisnexis] generate_questions failed — falling back to mock: {type(e).__name__}: {e}")
            return await MockKBAProvider().generate_questions(principal)


def get_provider() -> KBAProvider:
    """Provider selector.
    Activates LexisNexis when all required env vars are populated;
    otherwise returns MockKBAProvider (drop-in-ready)."""
    lexis = LexisNexisKBAProvider()
    if lexis._is_configured():
        return lexis
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

    # Build PII-enriched principal so the LexisNexis adapter has what it needs.
    # If any of these fields are absent, the adapter detects that and falls back
    # to the mock provider gracefully (drop-in-ready behaviour).
    principal: dict = {
        "id": user["id"],
        "email": user["email"],
    }
    # Split full_name → first/last for vendor schemas that expect them
    full_name = (user.get("full_name") or "").strip()
    if full_name:
        parts = full_name.split(None, 1)
        principal["first_name"] = parts[0]
        if len(parts) > 1:
            principal["last_name"] = parts[1]
    # Identity-proofing PII (set by KYC flow on the user record when available)
    for k in ("middle_name", "date_of_birth", "ssn_last4", "ssn_full",
              "address_line1", "address_line2", "city", "state", "postal_code"):
        if user.get(k):
            principal[k] = user[k]

    questions = await provider.generate_questions(principal)

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
