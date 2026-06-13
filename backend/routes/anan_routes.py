"""
ANAN (Autonomous Notary Agent Network) Routes
Enhances existing ceremony pipeline with blind 2-of-3 GPT-5.2 consensus,
HITL escalation, and SAN bond tracking.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import uuid
import json
import hashlib
import os

router = APIRouter(prefix="/api/anan", tags=["anan"])
db = None


def set_db(database):
    global db
    db = database


# ─── Models ───

class ANANCeremonyRequest(BaseModel):
    document_name: Optional[str] = "Untitled Document"
    signer_name: Optional[str] = "Unknown Signer"
    document_type: Optional[str] = "general"
    jurisdiction: Optional[str] = "US-General"
    id_image_base64: Optional[str] = None
    selfie_base64: Optional[str] = None


class EscalationResolveRequest(BaseModel):
    decision: str  # "approve" or "reject"
    notes: Optional[str] = ""


# ─── Auth helper ───

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


# ═══════════════════════════════════════════════════════
#  ANAN CEREMONY LIFECYCLE
# ═══════════════════════════════════════════════════════

@router.post("/ceremony/start")
async def start_anan_ceremony(req: ANANCeremonyRequest, request: Request):
    """Initialize an ANAN-mode ceremony with blind scoring protocol."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "anan")
    user = await _get_user(request)

    ceremony_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    ceremony = {
        "ceremony_id": ceremony_id,
        "anan_mode": True,
        "protocol": "BLIND_2OF3",
        "document_name": req.document_name,
        "signer_name": req.signer_name,
        "document_type": req.document_type,
        "jurisdiction": req.jurisdiction,
        "has_biometrics": bool(req.id_image_base64 or req.selfie_base64),
        "initiated_by": user["email"],
        "initiated_by_name": user.get("full_name", user["email"]),
        "status": "pending",
        "created_at": now,
        "agents": {
            "verifier": {"status": "idle", "score": None, "verdict": None, "reasoning": None, "checks": {}, "risk_level": None, "commitment_hash": None, "completed_at": None, "ai_powered": False},
            "witness": {"status": "idle", "score": None, "verdict": None, "reasoning": None, "checks": {}, "risk_level": None, "commitment_hash": None, "completed_at": None, "ai_powered": False},
            "sealer": {"status": "idle", "score": None, "verdict": None, "reasoning": None, "checks": {}, "risk_level": None, "commitment_hash": None, "completed_at": None, "ai_powered": False},
        },
        "consensus": {
            "status": "pending",
            "result": None,
            "weighted_average": None,
            "scores": {},
            "decided_at": None,
        },
        "escalation": None,
        "blockchain_seal": None,
        "bond_impact": None,
    }

    await db.anan_ceremonies.insert_one(ceremony)
    ceremony.pop("_id", None)

    # Store images separately if provided
    if req.id_image_base64 or req.selfie_base64:
        await db.ceremony_images.insert_one({
            "ceremony_id": ceremony_id,
            "id_image_base64": req.id_image_base64,
            "selfie_base64": req.selfie_base64,
        })

    return {
        "ceremony_id": ceremony_id,
        "status": "pending",
        "protocol": "BLIND_2OF3",
        "message": "ANAN ceremony initialized. Call /execute or /stream to begin blind agent scoring.",
    }


@router.post("/ceremony/{ceremony_id}/execute")
async def execute_anan_ceremony(ceremony_id: str, request: Request):
    """Execute the full ANAN blind scoring pipeline (non-streaming)."""
    user = await _get_user(request)  # noqa: F841 - auth gate
    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="ANAN ceremony not found")
    if ceremony["status"] not in ("pending", "escalated"):
        raise HTTPException(status_code=400, detail=f"Ceremony is already {ceremony['status']}")

    from services.anan_swarm import run_blind_swarm, get_or_init_bond, restock_bond, apply_bond_event
    from services.fraud_intelligence_service import get_fraud_context

    now = datetime.now(timezone.utc).isoformat()
    await db.anan_ceremonies.update_one(
        {"ceremony_id": ceremony_id},
        {"$set": {"status": "in_progress"}}
    )

    # Inject fraud context into ceremony data
    fraud_ctx = await get_fraud_context(db, ceremony.get("document_type", "general"), ceremony.get("jurisdiction", "US-General"))
    ceremony_with_ctx = {**ceremony, "_fraud_context": fraud_ctx}

    # Run blind swarm
    swarm_result = await run_blind_swarm(ceremony_with_ctx)
    agents = swarm_result["agents"]
    consensus = swarm_result["consensus"]

    # Determine final status
    if consensus["result"] == "APPROVED":
        final_status = "sealed"
    elif consensus["result"] == "REJECTED":
        final_status = "rejected"
    else:
        final_status = "escalated"

    # Blockchain seal if approved
    blockchain_seal = None
    if final_status == "sealed":
        blockchain_seal = await _seal_anan_on_hedera(ceremony_id, ceremony, consensus)

    # Bond impact
    bond_impact = None
    if consensus.get("bond_event"):
        bond_impact = await apply_bond_event(db, consensus["bond_event"]["type"], ceremony_id)

    # Restock bond from ceremony fee
    await restock_bond(db, 25.0, ceremony_id)  # $25 standard ceremony fee

    # Create escalation if needed
    escalation = None
    if final_status == "escalated":
        escalation = {
            "escalation_id": uuid.uuid4().hex[:8],
            "ceremony_id": ceremony_id,
            "reason": _escalation_reason(consensus),
            "scores": consensus["scores"],
            "weighted_average": consensus["weighted_average"],
            "status": "pending",
            "created_at": now,
            "assigned_to": None,
            "resolved_at": None,
            "override_decision": None,
            "notes": None,
        }
        await db.anan_escalations.insert_one(escalation)
        escalation.pop("_id", None)

    # Update ceremony with results
    update_data = {
        "status": final_status,
        "agents.verifier": _agent_to_db(agents["verifier"]),
        "agents.witness": _agent_to_db(agents["witness"]),
        "agents.sealer": _agent_to_db(agents["sealer"]),
        "consensus": {
            "status": "reached",
            "result": consensus["result"],
            "weighted_average": consensus["weighted_average"],
            "scores": consensus["scores"],
            "weights": consensus["weights"],
            "pass_count": consensus["pass_count"],
            "fail_count": consensus["fail_count"],
            "score_spread": consensus["score_spread"],
            "consensus_hash": consensus["consensus_hash"],
            "decided_at": consensus["decided_at"],
        },
        "blockchain_seal": blockchain_seal,
        "bond_impact": bond_impact,
        "escalation": escalation,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.anan_ceremonies.update_one({"ceremony_id": ceremony_id}, {"$set": update_data})

    # Record reputation data for agent self-tuning
    from services.anan_reputation import record_ceremony_outcome
    await record_ceremony_outcome(db, ceremony_id, agents, consensus["result"])

    result = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    return result


def _agent_to_db(agent_result: dict) -> dict:
    """Convert agent result to DB-storable format."""
    return {
        "status": "passed" if agent_result.get("score", 0) >= 60 else "failed",
        "score": agent_result.get("score"),
        "verdict": agent_result.get("verdict"),
        "reasoning": agent_result.get("reasoning"),
        "checks": agent_result.get("checks", {}),
        "risk_level": agent_result.get("risk_level"),
        "commitment_hash": agent_result.get("commitment_hash"),
        "completed_at": agent_result.get("completed_at"),
        "ai_powered": agent_result.get("ai_powered", False),
        "model": agent_result.get("model"),
    }


def _escalation_reason(consensus: dict) -> str:
    """Generate a human-readable escalation reason."""
    reasons = []
    if consensus["weighted_average"] < 70 and consensus["weighted_average"] >= 40:
        reasons.append(f"Marginal weighted score ({consensus['weighted_average']:.1f}/100)")
    if consensus["score_spread"] > 30:
        reasons.append(f"High agent divergence (spread: {consensus['score_spread']})")
    if consensus["min_score"] < 40:
        reasons.append(f"Low minimum score ({consensus['min_score']}/100)")
    if consensus["pass_count"] < 2:
        reasons.append(f"Insufficient passes ({consensus['pass_count']}/3)")
    return "; ".join(reasons) if reasons else "Consensus threshold not met"


# ─── SSE Streaming ───

def _sse(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, **data})
    return f"event: {event_type}\ndata: {payload}\n\n"


async def _stream_anan_pipeline(ceremony_id: str):
    """Generator for SSE streaming of ANAN blind scoring."""
    from services.anan_swarm import (
        _run_anan_agent, VERIFIER_SYSTEM, WITNESS_SYSTEM, SEALER_SYSTEM,
        evaluate_anan_consensus, restock_bond, apply_bond_event,
    )
    import asyncio

    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        yield _sse("error", {"message": "Ceremony not found"})
        return

    if ceremony["status"] not in ("pending", "escalated"):
        yield _sse("error", {"message": f"Ceremony is already {ceremony['status']}"})
        return

    now = datetime.now(timezone.utc).isoformat()  # noqa: F841 - reserved for future stage timestamps
    await db.anan_ceremonies.update_one({"ceremony_id": ceremony_id}, {"$set": {"status": "in_progress"}})
    yield _sse("ceremony_started", {"ceremony_id": ceremony_id, "protocol": "BLIND_2OF3"})

    # Inject fraud context
    from services.fraud_intelligence_service import get_fraud_context
    fraud_ctx = await get_fraud_context(db, ceremony.get("document_type", "general"), ceremony.get("jurisdiction", "US-General"))
    ceremony_with_ctx = {**ceremony, "_fraud_context": fraud_ctx}

    # Phase 1: Signal all agents starting (blind mode)
    yield _sse("blind_phase_started", {"message": "All 3 agents analyzing concurrently in isolation..."})
    for agent_name in ["verifier", "witness", "sealer"]:
        await db.anan_ceremonies.update_one(
            {"ceremony_id": ceremony_id},
            {"$set": {f"agents.{agent_name}.status": "running"}}
        )
    yield _sse("agents_running", {"agents": ["verifier", "witness", "sealer"]})

    # Phase 2: Run all agents concurrently (BLIND)
    v_task = _run_anan_agent("verifier", VERIFIER_SYSTEM, ceremony_with_ctx)
    w_task = _run_anan_agent("witness", WITNESS_SYSTEM, ceremony_with_ctx)
    s_task = _run_anan_agent("sealer", SEALER_SYSTEM, ceremony_with_ctx)

    v_result, w_result, s_result = await asyncio.gather(v_task, w_task, s_task)

    # Phase 3: Reveal scores one by one
    yield _sse("reveal_phase_started", {"message": "All agents complete. Revealing sealed scores..."})

    for name, result in [("verifier", v_result), ("witness", w_result), ("sealer", s_result)]:
        db_data = _agent_to_db(result)
        await db.anan_ceremonies.update_one(
            {"ceremony_id": ceremony_id},
            {"$set": {f"agents.{name}": db_data}}
        )
        yield _sse("score_revealed", {
            "agent": name,
            "score": result["score"],
            "verdict": result["verdict"],
            "reasoning": result.get("reasoning", ""),
            "risk_level": result.get("risk_level", "medium"),
            "checks": result.get("checks", {}),
            "ai_powered": result.get("ai_powered", False),
        })
        await asyncio.sleep(0.5)  # Dramatic reveal pacing

    # Phase 4: Consensus Oracle
    yield _sse("consensus_started", {"message": "Consensus Oracle evaluating weighted scores..."})
    scores = {"verifier": v_result, "witness": w_result, "sealer": s_result}
    consensus = evaluate_anan_consensus(scores, ceremony_id)

    if consensus["result"] == "APPROVED":
        final_status = "sealed"
    elif consensus["result"] == "REJECTED":
        final_status = "rejected"
    else:
        final_status = "escalated"

    # Blockchain seal if approved
    blockchain_seal = None
    if final_status == "sealed":
        yield _sse("sealing_blockchain", {"message": "Submitting to Hedera Mainnet..."})
        blockchain_seal = await _seal_anan_on_hedera(ceremony_id, ceremony, consensus)

    # Bond
    bond_impact = None
    if consensus.get("bond_event"):
        bond_impact = await apply_bond_event(db, consensus["bond_event"]["type"], ceremony_id)
    await restock_bond(db, 25.0, ceremony_id)

    # Escalation
    escalation = None
    if final_status == "escalated":
        escalation = {
            "escalation_id": uuid.uuid4().hex[:8],
            "ceremony_id": ceremony_id,
            "reason": _escalation_reason(consensus),
            "scores": consensus["scores"],
            "weighted_average": consensus["weighted_average"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.anan_escalations.insert_one({**escalation})

    # Final update
    update_data = {
        "status": final_status,
        "consensus": {
            "status": "reached",
            "result": consensus["result"],
            "weighted_average": consensus["weighted_average"],
            "scores": consensus["scores"],
            "weights": consensus["weights"],
            "pass_count": consensus["pass_count"],
            "fail_count": consensus["fail_count"],
            "score_spread": consensus["score_spread"],
            "consensus_hash": consensus["consensus_hash"],
            "decided_at": consensus["decided_at"],
        },
        "blockchain_seal": blockchain_seal,
        "bond_impact": bond_impact,
        "escalation": escalation,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.anan_ceremonies.update_one({"ceremony_id": ceremony_id}, {"$set": update_data})

    # Record reputation data
    from services.anan_reputation import record_ceremony_outcome
    scores_dict = {"verifier": v_result, "witness": w_result, "sealer": s_result}
    await record_ceremony_outcome(db, ceremony_id, scores_dict, consensus["result"])

    yield _sse("consensus_reached", {
        "result": consensus["result"],
        "weighted_average": consensus["weighted_average"],
        "scores": consensus["scores"],
        "pass_count": consensus["pass_count"],
        "score_spread": consensus["score_spread"],
        "status": final_status,
        "blockchain_seal": blockchain_seal,
    })

    if escalation:
        yield _sse("escalation_created", {
            "escalation_id": escalation["escalation_id"],
            "reason": escalation["reason"],
        })

    yield _sse("ceremony_complete", {"ceremony_id": ceremony_id, "status": final_status})


@router.get("/ceremony/{ceremony_id}/stream")
async def stream_anan_ceremony(ceremony_id: str, request: Request):
    """SSE endpoint — streams real-time ANAN blind scoring with phased reveals."""
    # SSE auth: EventSource can't set headers, but it DOES send the httpOnly cookie
    # same-origin. Prefer a real ?token= (legacy), else fall back to the cookie.
    from auth import decode_access_token, extract_request_token
    token = request.query_params.get("token")
    if not token or token == "cookie":
        token = extract_request_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="ANAN ceremony not found")

    return StreamingResponse(
        _stream_anan_pipeline(ceremony_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/ceremony/{ceremony_id}")
async def get_anan_ceremony(ceremony_id: str, request: Request):
    """Get ANAN ceremony details."""
    await _get_user(request)
    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="ANAN ceremony not found")
    return ceremony


@router.get("/ceremonies")
async def list_anan_ceremonies(request: Request):
    """List all ANAN ceremonies for the current user."""
    user = await _get_user(request)
    ceremonies = []
    async for c in db.anan_ceremonies.find(
        {"initiated_by": user["email"]},
        {"_id": 0, "ceremony_id": 1, "document_name": 1, "signer_name": 1, "status": 1,
         "created_at": 1, "consensus.result": 1, "consensus.weighted_average": 1, "protocol": 1}
    ).sort("created_at", -1).limit(50):
        ceremonies.append(c)
    return {"ceremonies": ceremonies, "total": len(ceremonies)}


# ═══════════════════════════════════════════════════════
#  HITL ESCALATION
# ═══════════════════════════════════════════════════════

@router.get("/escalations")
async def list_escalations(request: Request):
    """List pending HITL escalations."""
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")

    escalations = []
    async for e in db.anan_escalations.find(
        {"status": {"$in": ["pending", "assigned"]}}, {"_id": 0}
    ).sort("created_at", -1).limit(50):
        # Attach ceremony context
        ceremony = await db.anan_ceremonies.find_one(
            {"ceremony_id": e["ceremony_id"]},
            {"_id": 0, "document_name": 1, "signer_name": 1, "initiated_by": 1}
        )
        e["ceremony_context"] = ceremony
        escalations.append(e)
    return {"escalations": escalations, "total": len(escalations)}


@router.post("/escalation/{escalation_id}/resolve")
async def resolve_escalation(escalation_id: str, req: EscalationResolveRequest, request: Request):
    """Human resolves an escalated ANAN ceremony."""
    from services.anan_swarm import apply_bond_event

    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")

    escalation = await db.anan_escalations.find_one({"escalation_id": escalation_id}, {"_id": 0})
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    if escalation["status"] == "resolved":
        raise HTTPException(status_code=400, detail="Escalation already resolved")

    now = datetime.now(timezone.utc).isoformat()
    decision = req.decision.lower()
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")

    # Update escalation
    await db.anan_escalations.update_one(
        {"escalation_id": escalation_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": user["email"],
            "override_decision": decision,
            "notes": req.notes,
        }}
    )

    # Update ceremony
    ceremony_id = escalation["ceremony_id"]
    new_status = "sealed" if decision == "approve" else "rejected"

    blockchain_seal = None
    if decision == "approve":
        ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
        consensus = ceremony.get("consensus", {})
        blockchain_seal = await _seal_anan_on_hedera(ceremony_id, ceremony, consensus)

    await db.anan_ceremonies.update_one(
        {"ceremony_id": ceremony_id},
        {"$set": {
            "status": new_status,
            "escalation.status": "resolved",
            "escalation.resolved_at": now,
            "escalation.resolved_by": user["email"],
            "escalation.override_decision": decision,
            "blockchain_seal": blockchain_seal,
        }}
    )

    # Record HITL override for reputation tracking — this is key for accuracy calibration
    ceremony_full = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if ceremony_full:
        from services.anan_reputation import record_ceremony_outcome
        await record_ceremony_outcome(db, ceremony_id, ceremony_full.get("agents", {}), "ESCALATE", override=decision)

    return {
        "escalation_id": escalation_id,
        "ceremony_id": ceremony_id,
        "decision": decision,
        "new_status": new_status,
        "resolved_by": user["email"],
    }


# ═══════════════════════════════════════════════════════
#  SAN BOND & DASHBOARD STATS
# ═══════════════════════════════════════════════════════

@router.get("/bond/status")
async def get_bond_status(request: Request):
    """Get SAN bond status including on-chain verification info."""
    await _get_user(request)
    from services.anan_swarm import get_or_init_bond, INITIAL_BOND, BOND_MIN_THRESHOLD
    from services.hedera_service import hedera_bond_service

    bond = await get_or_init_bond(db)
    bond_service_status = hedera_bond_service.get_status()

    return {
        **bond,
        "initial_balance": INITIAL_BOND,
        "min_threshold": BOND_MIN_THRESHOLD,
        "health": "healthy" if bond["balance"] >= BOND_MIN_THRESHOLD else "warning" if bond["balance"] > 0 else "depleted",
        "health_pct": round(bond["balance"] / INITIAL_BOND * 100, 1),
        "on_chain": {
            "enabled": bond_service_status.get("sdk_available", False),
            "bond_topic_id": bond_service_status.get("bond_topic_id"),
            "network": bond_service_status.get("network"),
        },
    }


@router.get("/bond/ledger")
async def get_bond_ledger(request: Request):
    """Get on-chain bond event history from Hedera mirror node."""
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")

    from services.hedera_service import hedera_bond_service
    ledger = await hedera_bond_service.get_bond_ledger(limit=100)
    return ledger


@router.get("/bond/verify")
async def verify_bond_state(request: Request):
    """Verify bond state by comparing DB balance with on-chain ledger."""
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin or notary access required")

    from services.anan_swarm import get_or_init_bond
    from services.hedera_service import hedera_bond_service

    bond = await get_or_init_bond(db)
    verification = await hedera_bond_service.verify_bond_state(bond["balance"])
    return verification


@router.get("/dashboard/stats")
async def get_anan_stats(request: Request):
    """Get ANAN swarm dashboard statistics."""
    await _get_user(request)

    total = await db.anan_ceremonies.count_documents({})
    sealed = await db.anan_ceremonies.count_documents({"status": "sealed"})
    rejected = await db.anan_ceremonies.count_documents({"status": "rejected"})
    escalated = await db.anan_ceremonies.count_documents({"status": "escalated"})
    pending = await db.anan_ceremonies.count_documents({"status": {"$in": ["pending", "in_progress"]}})
    pending_escalations = await db.anan_escalations.count_documents({"status": "pending"})

    # Average weighted score
    avg_pipeline = [
        {"$match": {"consensus.weighted_average": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$consensus.weighted_average"}}},
    ]
    avg_raw = await db.anan_ceremonies.aggregate(avg_pipeline).to_list(1)
    avg_score = round(avg_raw[0]["avg"], 1) if avg_raw and avg_raw[0].get("avg") else 0

    # Per-agent average scores
    agent_avgs = {}
    for agent in ["verifier", "witness", "sealer"]:
        pipe = [
            {"$match": {f"agents.{agent}.score": {"$ne": None}}},
            {"$group": {"_id": None, "avg": {"$avg": f"$agents.{agent}.score"}}},
        ]
        raw = await db.anan_ceremonies.aggregate(pipe).to_list(1)
        agent_avgs[agent] = round(raw[0]["avg"], 1) if raw and raw[0].get("avg") else 0

    # Bond status
    from services.anan_swarm import get_or_init_bond
    bond = await get_or_init_bond(db)

    return {
        "total_ceremonies": total,
        "sealed": sealed,
        "rejected": rejected,
        "escalated": escalated,
        "pending": pending,
        "pending_escalations": pending_escalations,
        "avg_weighted_score": avg_score,
        "agent_averages": agent_avgs,
        "approval_rate": round(sealed / max(total, 1) * 100, 1),
        "escalation_rate": round(escalated / max(total, 1) * 100, 1),
        "bond_balance": bond["balance"],
        "bond_health_pct": round(bond["balance"] / 1_000_000 * 100, 1),
    }


# ─── Hedera Seal ───

async def _seal_anan_on_hedera(ceremony_id: str, ceremony: dict, consensus: dict) -> dict:
    """Submit ANAN ceremony seal to Hedera Mainnet."""
    from services.hedera_service import hedera_service
    import random

    evidence_concat = "|".join([
        str(consensus.get("scores", {}).get("verifier", "")),
        str(consensus.get("scores", {}).get("witness", "")),
        str(consensus.get("scores", {}).get("sealer", "")),
        consensus.get("consensus_hash", ""),
    ])
    document_hash = hashlib.sha256(evidence_concat.encode()).hexdigest()

    metadata = {
        "ceremony_id": ceremony_id,
        "protocol": "ANAN_BLIND_2OF3",
        "consensus_result": consensus.get("result"),
        "weighted_average": consensus.get("weighted_average"),
        "scores": consensus.get("scores"),
    }

    seal_result = await hedera_service.seal_document(
        document_hash=document_hash,
        document_name=ceremony.get("document_name", "ANAN Ceremony"),
        user_id=ceremony.get("initiated_by", "anan"),
        metadata=metadata,
    )

    if seal_result.get("success"):
        return {
            "network": seal_result.get("network", "mainnet"),
            "topic_id": seal_result.get("topic_id", ""),
            "transaction_id": seal_result.get("transaction_id", ""),
            "sequence_number": seal_result.get("sequence_number"),
            "message_hash": seal_result.get("verification_hash", ""),
            "hcs_submitted": seal_result.get("hcs_submitted", False),
            "sealed_at": seal_result.get("sealed_at", datetime.now(timezone.utc).isoformat()),
            "consensus_hash": consensus.get("consensus_hash", ""),
            "explorer_url": seal_result.get("explorer_url", ""),
        }
    else:
        return {
            "network": "Hedera Mainnet",
            "topic_id": "submission_failed",
            "message_hash": document_hash,
            "hcs_submitted": False,
            "sealed_at": datetime.now(timezone.utc).isoformat(),
            "consensus_hash": consensus.get("consensus_hash", ""),
            "error": seal_result.get("error", "Unknown error"),
        }


# ═══════════════════════════════════════════════════════
#  AGENT REPUTATION & WEIGHT TUNING
# ═══════════════════════════════════════════════════════

@router.get("/reputation")
async def get_agent_reputations(request: Request):
    """Get all agent reputation stats + current weights."""
    await _get_user(request)
    from services.anan_reputation import get_all_reputations
    from services.anan_swarm import AGENT_WEIGHTS

    reputations = await get_all_reputations(db)
    return {
        "reputations": reputations,
        "current_weights": dict(AGENT_WEIGHTS),
    }


@router.post("/reputation/tune")
async def tune_agent_weights(request: Request):
    """Compute and apply tuned weights based on agent accuracy."""
    user = await _get_user(request)
    if user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from services.anan_reputation import apply_tuned_weights
    result = await apply_tuned_weights(db)
    return result


@router.get("/reputation/history")
async def get_weight_history(request: Request):
    """Get weight tuning history."""
    await _get_user(request)
    history = []
    async for h in db.anan_weight_history.find({}, {"_id": 0}).sort("applied_at", -1).limit(20):
        history.append(h)
    return {"history": history}


# ═══════════════════════════════════════════════════════
#  SHAREABLE VERIFICATION BADGE
# ═══════════════════════════════════════════════════════

@router.get("/badge/{ceremony_id}")
async def get_badge(ceremony_id: str, request: Request):
    """Get embeddable badge data + HTML snippet for a sealed ceremony."""
    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        # Also check regular ceremonies
        ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")

    status = ceremony.get("status", "unknown")
    consensus_hash = ceremony.get("consensus", {}).get("consensus_hash", "")
    blockchain = ceremony.get("blockchain_seal", {})
    is_sealed = status == "sealed"

    app_url = os.environ.get("APP_URL", request.base_url._url.rstrip("/"))
    verify_url = f"{app_url}/verify-certificate/{consensus_hash}" if consensus_hash else ""

    badge_data = {
        "ceremony_id": ceremony_id,
        "status": status,
        "document_name": ceremony.get("document_name", "Document"),
        "sealed_at": ceremony.get("completed_at") or ceremony.get("created_at", ""),
        "consensus_hash": consensus_hash,
        "blockchain_network": blockchain.get("network", ""),
        "verify_url": verify_url,
        "is_sealed": is_sealed,
    }

    # Static HTML badge
    seal_color = "#10b981" if is_sealed else "#ef4444"
    status_text = "VERIFIED" if is_sealed else status.upper()
    onclick_attr = ' onclick="window.open(\'' + verify_url + '\')" style="cursor:pointer"' if verify_url else ''
    hash_display = consensus_hash[:12] if consensus_hash else "N/A"

    static_html = (
        '<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:6px;'
        'background:#060a12;border:1px solid ' + seal_color + '40;font-family:system-ui,sans-serif;'
        'text-decoration:none;color:#fff;font-size:12px;"' + onclick_attr + '>'
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + seal_color + '" stroke-width="2">'
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
        '<div>'
        '<div style="font-weight:700;color:' + seal_color + ';font-size:10px;letter-spacing:1px">' + status_text + '</div>'
        '<div style="color:#94a3b8;font-size:9px">NotaryChain | ' + hash_display + '...</div>'
        '</div></div>'
    )

    # Dynamic JS widget
    badge_div_id = "nc-badge-" + ceremony_id[:8]
    dynamic_js = (
        '<div id="' + badge_div_id + '"></div>\n'
        '<script>\n'
        '(function(){\n'
        '  var d=document.getElementById("' + badge_div_id + '");\n'
        '  fetch("' + app_url + '/api/anan/badge/' + ceremony_id + '/json")\n'
        '    .then(function(r){return r.json()}).then(function(b){\n'
        '      var c=b.is_sealed?"#10b981":"#ef4444",t=b.is_sealed?"VERIFIED":b.status.toUpperCase();\n'
        '      d.innerHTML=\'<a href="\'+b.verify_url+\'" target="_blank" rel="noopener" '
        'style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:6px;'
        'background:#060a12;border:1px solid \'+c+\'40;font-family:system-ui,sans-serif;text-decoration:none;'
        'color:#fff;font-size:12px">\'+'
        '\'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="\'+c+\'" stroke-width="2">'
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>\'+'
        '\'<div><div style="font-weight:700;color:\'+c+\';font-size:10px;letter-spacing:1px">\'+t+\'</div>\'+'
        '\'<div style="color:#94a3b8;font-size:9px">NotaryChain | \'+b.consensus_hash.slice(0,12)+\'...</div>'
        '</div></a>\';\n'
        '    });\n'
        '})();\n'
        '</script>'
    )

    return {
        **badge_data,
        "embed_html": static_html,
        "embed_js": dynamic_js,
    }


@router.get("/badge/{ceremony_id}/json")
async def get_badge_json(ceremony_id: str):
    """Public JSON endpoint for dynamic badge widget (no auth required)."""
    ceremony = await db.anan_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")

    status = ceremony.get("status", "unknown")
    consensus_hash = ceremony.get("consensus", {}).get("consensus_hash", "")
    blockchain = ceremony.get("blockchain_seal", {})

    return {
        "ceremony_id": ceremony_id,
        "status": status,
        "is_sealed": status == "sealed",
        "document_name": ceremony.get("document_name", "Document"),
        "sealed_at": ceremony.get("completed_at") or ceremony.get("created_at", ""),
        "consensus_hash": consensus_hash or "N/A",
        "blockchain_network": blockchain.get("network", ""),
        "verify_url": "",
    }
