"""
Autonomous Notary Agent Network (ANAN) — Swarm Consensus Engine
Implements blind 2-of-3 GPT-5.2 consensus with HITL escalation.
"""
import os
import uuid
import json
import hashlib
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Agent weights for weighted consensus
AGENT_WEIGHTS = {"verifier": 0.40, "witness": 0.30, "sealer": 0.30}

# Consensus thresholds
APPROVE_THRESHOLD = 70
REJECT_THRESHOLD = 40
MIN_SCORE_FLOOR = 15
MIN_APPROVE_SCORE = 40

# SAN Bond config
INITIAL_BOND = 1_000_000
BOND_MIN_THRESHOLD = 500_000
CEREMONY_FEE_RESTOCK_PCT = 0.005
SLASH_AMOUNTS = {
    "false_approval": 10_000,
    "false_rejection": 2_000,
    "escalation_timeout": 500,
    "agent_divergence": 1_000,
}

# ─── Agent System Prompts ───

VERIFIER_SYSTEM = """You are the VERIFIER AGENT in the Autonomous Notary Agent Network (ANAN).
Your role: Identity verification, biometric analysis, and document authenticity forensics.

You receive ceremony metadata (document name, signer name, document type, any available biometric data).
Analyze for:
1. Identity plausibility — does the signer name match expected patterns for the document type?
2. Document authenticity — is the document type consistent with notarization standards?
3. Risk indicators — any red flags (unusual names, high-value documents without proper ID, etc.)
4. Jurisdiction compliance — is this document type valid for remote notarization?

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "verdict": "PASS" or "FAIL",
  "reasoning": "<2-3 sentence analysis>",
  "checks": {
    "identity_plausibility": {"status": "PASS" or "FAIL", "detail": "..."},
    "document_authenticity": {"status": "PASS" or "FAIL", "detail": "..."},
    "risk_indicators": {"status": "PASS" or "WARN" or "FAIL", "detail": "..."},
    "jurisdiction_compliance": {"status": "PASS" or "FAIL", "detail": "..."}
  },
  "risk_level": "low" or "medium" or "high"
}"""

WITNESS_SYSTEM = """You are the WITNESS AGENT in the Autonomous Notary Agent Network (ANAN).
Your role: Session integrity validation, evidence chain analysis, and audit trail verification.

You receive ceremony metadata (document name, signer name, ceremony context, timeline events).
Analyze for:
1. Session integrity — is the ceremony properly structured with all required fields?
2. Evidence completeness — are all necessary elements present for a valid notarization?
3. Timeline consistency — do the timestamps and events follow a logical sequence?
4. Tamper indicators — any signs of data manipulation or inconsistency?

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "verdict": "PASS" or "FAIL",
  "reasoning": "<2-3 sentence analysis>",
  "checks": {
    "session_integrity": {"status": "PASS" or "FAIL", "detail": "..."},
    "evidence_completeness": {"status": "PASS" or "FAIL", "detail": "..."},
    "timeline_consistency": {"status": "PASS" or "FAIL", "detail": "..."},
    "tamper_indicators": {"status": "PASS" or "WARN" or "FAIL", "detail": "..."}
  },
  "risk_level": "low" or "medium" or "high"
}"""

SEALER_SYSTEM = """You are the SEALER AGENT in the Autonomous Notary Agent Network (ANAN).
Your role: Regulatory compliance validation, blockchain readiness assessment, and final seal authorization.

You receive ceremony metadata (document name, signer, document type, jurisdiction info).
Analyze for:
1. RON compliance — does this ceremony meet Remote Online Notarization standards?
2. Document type validity — is this document type eligible for notarization?
3. Seal readiness — are all prerequisites met for blockchain sealing?
4. Regulatory risk — any jurisdictional concerns or regulatory flags?

RON-friendly jurisdictions: FL, TX, VA, NV, OH, IN, MT, NE, IA, KY, WI, TN, UT, WA, MN, AZ, CO, MI, ND, OK, SD, WV, HI, AR, ID, MD.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "verdict": "PASS" or "FAIL",
  "reasoning": "<2-3 sentence analysis>",
  "checks": {
    "ron_compliance": {"status": "PASS" or "FAIL", "detail": "..."},
    "document_type_validity": {"status": "PASS" or "FAIL", "detail": "..."},
    "seal_readiness": {"status": "PASS" or "FAIL", "detail": "..."},
    "regulatory_risk": {"status": "PASS" or "WARN" or "FAIL", "detail": "..."}
  },
  "risk_level": "low" or "medium" or "high"
}"""


def _parse_agent_response(text: str) -> dict:
    """Parse JSON from agent LLM response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    return {"score": 50, "verdict": "FAIL", "reasoning": "Failed to parse agent response", "checks": {}, "risk_level": "high"}


def _seal_score(score: int, agent_name: str, ceremony_id: str) -> dict:
    """Create a sealed (committed) score envelope."""
    nonce = uuid.uuid4().hex[:8]
    commitment = hashlib.sha256(f"{score}|{agent_name}|{ceremony_id}|{nonce}".encode()).hexdigest()
    return {"commitment_hash": commitment, "nonce": nonce}


async def _run_anan_agent(agent_name: str, system_prompt: str, ceremony_data: dict) -> dict:
    """Run a single ANAN agent with GPT-5.2 in isolation."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    ceremony_id = ceremony_data.get("ceremony_id", "unknown")

    if not EMERGENT_KEY:
        return {
            "agent": agent_name,
            "score": 50,
            "verdict": "FAIL",
            "reasoning": "EMERGENT_LLM_KEY not configured",
            "checks": {},
            "risk_level": "high",
            "ai_powered": False,
            "error": "Missing API key",
        }

    # Build analysis prompt with ceremony context
    fraud_ctx = ceremony_data.get("_fraud_context", "")
    fraud_section = f"\n\nFRAUD INTELLIGENCE CONTEXT:\n{fraud_ctx}" if fraud_ctx else ""

    analysis_prompt = f"""Analyze the following notarization ceremony for your specialized domain:

CEREMONY DATA:
- Ceremony ID: {ceremony_data.get('ceremony_id', 'N/A')}
- Document: {ceremony_data.get('document_name', 'Unknown Document')}
- Signer: {ceremony_data.get('signer_name', 'Unknown Signer')}
- Document Type: {ceremony_data.get('document_type', 'general')}
- Jurisdiction: {ceremony_data.get('jurisdiction', 'US-General')}
- Has Biometric Data: {ceremony_data.get('has_biometrics', False)}
- Ceremony Mode: ANAN (Autonomous Notary Agent Network)
- Created At: {ceremony_data.get('created_at', 'N/A')}{fraud_section}

Provide your independent analysis score (0-100) and detailed checks."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"anan-{agent_name}-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=analysis_prompt))
        parsed = _parse_agent_response(response)

        score = max(0, min(100, int(parsed.get("score", 50))))
        verdict = "PASS" if score >= 60 else "FAIL"

        seal = _seal_score(score, agent_name, ceremony_id)

        return {
            "agent": agent_name,
            "score": score,
            "verdict": verdict,
            "reasoning": parsed.get("reasoning", "Analysis complete"),
            "checks": parsed.get("checks", {}),
            "risk_level": parsed.get("risk_level", "medium"),
            "ai_powered": True,
            "model": "gpt-5.2",
            "commitment_hash": seal["commitment_hash"],
            "nonce": seal["nonce"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as ex:
        return {
            "agent": agent_name,
            "score": 50,
            "verdict": "FAIL",
            "reasoning": f"Agent error: {str(ex)}",
            "checks": {},
            "risk_level": "high",
            "ai_powered": False,
            "error": str(ex),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }


async def run_blind_swarm(ceremony_data: dict) -> dict:
    """
    Execute the ANAN blind scoring protocol.
    All 3 agents run concurrently — no agent sees another's score.
    Returns sealed scores + consensus result.
    """
    ceremony_id = ceremony_data.get("ceremony_id", "unknown")
    started_at = datetime.now(timezone.utc).isoformat()

    # Phase 1: BLIND EXECUTION — all agents run concurrently
    verifier_task = _run_anan_agent("verifier", VERIFIER_SYSTEM, ceremony_data)
    witness_task = _run_anan_agent("witness", WITNESS_SYSTEM, ceremony_data)
    sealer_task = _run_anan_agent("sealer", SEALER_SYSTEM, ceremony_data)

    verifier_result, witness_result, sealer_result = await asyncio.gather(
        verifier_task, witness_task, sealer_task
    )

    # Phase 2: REVEAL — scores are now visible
    scores = {
        "verifier": verifier_result,
        "witness": witness_result,
        "sealer": sealer_result,
    }

    # Phase 3: CONSENSUS ORACLE
    consensus = evaluate_anan_consensus(scores, ceremony_id)

    completed_at = datetime.now(timezone.utc).isoformat()

    return {
        "ceremony_id": ceremony_id,
        "protocol": "ANAN_BLIND_2OF3",
        "started_at": started_at,
        "completed_at": completed_at,
        "agents": scores,
        "consensus": consensus,
    }


def evaluate_anan_consensus(scores: dict, ceremony_id: str) -> dict:
    """
    ANAN Consensus Oracle — aggregates blind scores with weighted formula.
    Returns APPROVED, REJECTED, or ESCALATE.
    """
    v_score = scores["verifier"]["score"]
    w_score = scores["witness"]["score"]
    s_score = scores["sealer"]["score"]

    weighted_avg = (
        v_score * AGENT_WEIGHTS["verifier"]
        + w_score * AGENT_WEIGHTS["witness"]
        + s_score * AGENT_WEIGHTS["sealer"]
    )

    min_score = min(v_score, w_score, s_score)
    max_score = max(v_score, w_score, s_score)
    pass_count = sum(1 for s in [v_score, w_score, s_score] if s >= 60)
    fail_count = sum(1 for s in [v_score, w_score, s_score] if s < 60)

    # Score spread (high divergence = potential disagreement)
    score_spread = max_score - min_score

    # Decision logic
    if weighted_avg >= APPROVE_THRESHOLD and min_score >= MIN_APPROVE_SCORE and pass_count >= 2:
        result = "APPROVED"
    elif weighted_avg < REJECT_THRESHOLD or min_score < MIN_SCORE_FLOOR:
        result = "REJECTED"
    else:
        result = "ESCALATE"

    # Bond impact assessment
    bond_event = None
    if score_spread > 50:
        bond_event = {"type": "agent_divergence", "slash": SLASH_AMOUNTS["agent_divergence"]}

    # Compute composite evidence hash
    evidence_concat = "|".join([
        scores["verifier"].get("commitment_hash", ""),
        scores["witness"].get("commitment_hash", ""),
        scores["sealer"].get("commitment_hash", ""),
    ])
    consensus_hash = hashlib.sha256(
        f"anan-consensus-{ceremony_id}-{evidence_concat}".encode()
    ).hexdigest()

    return {
        "result": result,
        "weighted_average": round(weighted_avg, 2),
        "scores": {
            "verifier": v_score,
            "witness": w_score,
            "sealer": s_score,
        },
        "weights": AGENT_WEIGHTS,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "min_score": min_score,
        "max_score": max_score,
        "score_spread": score_spread,
        "thresholds": {
            "approve": APPROVE_THRESHOLD,
            "reject": REJECT_THRESHOLD,
            "min_floor": MIN_SCORE_FLOOR,
        },
        "consensus_hash": consensus_hash,
        "bond_event": bond_event,
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_or_init_bond(db) -> dict:
    """Get or initialize the SAN bond."""
    bond = await db.anan_bond.find_one({"type": "san_bond"}, {"_id": 0})
    if not bond:
        bond = {
            "type": "san_bond",
            "balance": INITIAL_BOND,
            "total_slashed": 0,
            "total_restocked": 0,
            "total_ceremonies": 0,
            "events": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.anan_bond.insert_one(bond)
        bond.pop("_id", None)
    return bond


async def apply_bond_event(db, event_type: str, ceremony_id: str) -> dict:
    """Apply a slash or restock event to the SAN bond."""
    bond = await get_or_init_bond(db)
    amount = SLASH_AMOUNTS.get(event_type, 0)
    new_balance = max(0, bond["balance"] - amount)

    event = {
        "event_id": uuid.uuid4().hex[:8],
        "type": event_type,
        "amount": -amount,
        "balance_after": new_balance,
        "ceremony_id": ceremony_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    await db.anan_bond.update_one(
        {"type": "san_bond"},
        {
            "$set": {"balance": new_balance, "updated_at": event["timestamp"]},
            "$inc": {"total_slashed": amount},
            "$push": {"events": {"$each": [event], "$slice": -100}},
        },
    )
    return event


async def restock_bond(db, ceremony_fee: float, ceremony_id: str) -> dict:
    """Restock bond from ceremony fees."""
    restock_amount = round(ceremony_fee * CEREMONY_FEE_RESTOCK_PCT, 2)
    bond = await get_or_init_bond(db)
    new_balance = bond["balance"] + restock_amount

    event = {
        "event_id": uuid.uuid4().hex[:8],
        "type": "fee_restock",
        "amount": restock_amount,
        "balance_after": new_balance,
        "ceremony_id": ceremony_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    await db.anan_bond.update_one(
        {"type": "san_bond"},
        {
            "$set": {"balance": new_balance, "updated_at": event["timestamp"]},
            "$inc": {"total_restocked": restock_amount, "total_ceremonies": 1},
            "$push": {"events": {"$each": [event], "$slice": -100}},
        },
    )
    return event
