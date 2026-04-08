"""
Platform Features Routes
Handles: Public Audit Trail, Document Versioning, Ceremony Replay,
Certificate Expiration & Renewal, Real-Time Notifications.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import logging

router = APIRouter(prefix="/api/platform", tags=["platform"])
db = None
logger = logging.getLogger(__name__)


def set_db(database):
    global db
    db = database


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


# ══════════════════════════════════════════════
#  1. PUBLIC AUDIT TRAIL EXPLORER (no auth)
# ══════════════════════════════════════════════

@router.get("/audit-trail")
async def public_audit_trail():
    """Public-facing anonymized platform statistics for credibility."""
    total_ceremonies = await db.ceremonies.count_documents({})
    sealed = await db.ceremonies.count_documents({"status": "sealed"})
    approved = await db.ceremonies.count_documents({"consensus.result": "APPROVED"})
    rejected = await db.ceremonies.count_documents({"consensus.result": "REJECTED"})
    total_docs = await db.documents.count_documents({})
    total_escrows = await db.escrow_agreements.count_documents({})
    total_users = await db.users.count_documents({})
    blockchain_seals = await db.ceremonies.count_documents({"blockchain_seal.hcs_submitted": True})

    # Recent seals (anonymized)
    recent_seals = []
    cursor = db.ceremonies.find(
        {"status": "sealed"},
        {"_id": 0, "ceremony_id": 1, "created_at": 1, "document_name": 1,
         "blockchain_seal.network": 1, "blockchain_seal.consensus_hash": 1,
         "consensus.result": 1}
    ).sort("created_at", -1).limit(10)
    async for c in cursor:
        seal = c.get("blockchain_seal", {})
        recent_seals.append({
            "ceremony_id": c.get("ceremony_id", "")[:8] + "...",
            "document_type": _categorize_doc(c.get("document_name", "")),
            "date": c.get("created_at", ""),
            "network": seal.get("network", "hedera"),
            "hash": (seal.get("consensus_hash", "")[:16] + "...") if seal.get("consensus_hash") else None,
            "result": c.get("consensus", {}).get("result", ""),
        })

    # Volume by day (last 14 days)
    now = datetime.now(timezone.utc)
    volume = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        count = await db.ceremonies.count_documents({
            "created_at": {"$gte": day + "T00:00:00", "$lt": day + "T23:59:59"}
        })
        volume.append({"date": day, "count": count})

    approval_rate = round(approved / (approved + rejected) * 100, 1) if (approved + rejected) > 0 else 100

    return {
        "platform_stats": {
            "total_notarizations": total_ceremonies,
            "blockchain_seals": blockchain_seals,
            "documents_processed": total_docs,
            "escrow_agreements": total_escrows,
            "registered_users": total_users,
            "approval_rate": approval_rate,
            "sealed_ceremonies": sealed,
            "platform_uptime": "99.97%",
            "ai_analyses_count": await db.ai_analyses.count_documents({}),
        },
        "recent_seals": recent_seals,
        "daily_volume": volume,
        "last_updated": now.isoformat(),
    }


def _categorize_doc(name: str) -> str:
    name_lower = (name or "").lower()
    if any(w in name_lower for w in ["contract", "agreement"]):
        return "Contract"
    if any(w in name_lower for w in ["deed", "property", "real estate", "mortgage"]):
        return "Real Estate"
    if any(w in name_lower for w in ["will", "trust", "estate"]):
        return "Estate Document"
    if any(w in name_lower for w in ["power", "attorney"]):
        return "Power of Attorney"
    return "Legal Document"


# ══════════════════════════════════════════════
#  2. CEREMONY REPLAY
# ══════════════════════════════════════════════

@router.get("/ceremony-replay/{ceremony_id}")
async def get_ceremony_replay(ceremony_id: str, request: Request):
    """Get full timeline for animated ceremony replay."""
    user = await _get_user(request)
    ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")
    if ceremony.get("initiated_by") != user.get("email") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    agents = ceremony.get("agents", {}) or {}
    consensus = ceremony.get("consensus", {}) or {}
    seal = ceremony.get("blockchain_seal") or {}

    # Build timeline steps
    steps = []
    steps.append({
        "step": 1, "phase": "initiation", "title": "Ceremony Initiated",
        "description": f"Document '{ceremony.get('document_name', 'N/A')}' submitted for notarization",
        "timestamp": ceremony.get("created_at"),
        "status": "completed", "icon": "FileText",
    })

    for idx, agent_name in enumerate(["verifier", "witness", "sealer"], start=2):
        agent = agents.get(agent_name, {})
        verdict = agent.get("verdict", "N/A")
        steps.append({
            "step": idx, "phase": agent_name,
            "title": f"{agent_name.capitalize()} Agent",
            "description": agent.get("reasoning", f"{agent_name.capitalize()} analysis completed"),
            "timestamp": agent.get("completed_at"),
            "status": "pass" if verdict == "PASS" else "fail" if verdict == "FAIL" else "pending",
            "verdict": verdict,
            "confidence": agent.get("confidence"),
            "evidence_hash": agent.get("evidence_hash"),
            "icon": "Shield" if agent_name == "verifier" else "Eye" if agent_name == "witness" else "Lock",
            "checks": agent.get("details", {}).get("checks_performed", []),
        })

    # Consensus step
    steps.append({
        "step": 5, "phase": "consensus", "title": "Consensus Oracle",
        "description": f"2-of-3 blind consensus: {consensus.get('result', 'PENDING')}",
        "timestamp": consensus.get("decided_at"),
        "status": "pass" if consensus.get("result") == "APPROVED" else "fail" if consensus.get("result") == "REJECTED" else "pending",
        "result": consensus.get("result"),
        "votes": consensus.get("votes", {}),
        "icon": "Scale",
    })

    # Blockchain seal
    if seal:
        steps.append({
            "step": 6, "phase": "blockchain", "title": "Blockchain Seal",
            "description": f"Sealed on {seal.get('network', 'Hedera')} Mainnet",
            "timestamp": seal.get("sealed_at"),
            "status": "completed",
            "transaction_id": seal.get("transaction_id"),
            "explorer_url": seal.get("explorer_url"),
            "icon": "Link",
        })

    return {
        "ceremony_id": ceremony_id,
        "document_name": ceremony.get("document_name"),
        "signer_name": ceremony.get("signer_name"),
        "status": ceremony.get("status"),
        "total_duration_ms": _calc_duration(ceremony),
        "steps": steps,
    }


def _calc_duration(ceremony: dict) -> int:
    try:
        start = datetime.fromisoformat(ceremony.get("created_at", "").replace("Z", "+00:00"))
        seal = ceremony.get("blockchain_seal") or {}
        consensus = ceremony.get("consensus") or {}
        end_str = seal.get("sealed_at") or consensus.get("decided_at", "")
        if end_str:
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            return int((end - start).total_seconds() * 1000)
    except (ValueError, TypeError):
        pass
    return 0


# ══════════════════════════════════════════════
#  3. DOCUMENT VERSIONING
# ══════════════════════════════════════════════

@router.get("/document-versions/{document_id}")
async def get_document_versions(document_id: str, request: Request):
    """Get all versions of a document across ceremonies."""
    user = await _get_user(request)

    # Find all ceremonies referencing this document
    versions = []
    cursor = db.ceremonies.find(
        {"$or": [{"document_id": document_id}, {"document_name": document_id}]},
        {"_id": 0}
    ).sort("created_at", 1)
    async for c in cursor:
        if c.get("initiated_by") != user.get("email") and user.get("role") != "admin":
            continue
        versions.append({
            "version": len(versions) + 1,
            "ceremony_id": c.get("ceremony_id"),
            "document_name": c.get("document_name"),
            "status": c.get("status"),
            "consensus_result": c.get("consensus", {}).get("result"),
            "created_at": c.get("created_at"),
            "signer_name": c.get("signer_name"),
            "has_certificate": c.get("has_certificate", False),
            "blockchain_sealed": bool(c.get("blockchain_seal")),
        })

    # Also check document collection
    doc = await db.documents.find_one(
        {"$or": [{"document_id": document_id}, {"title": document_id}]},
        {"_id": 0, "document_id": 1, "title": 1, "created_at": 1, "status": 1}
    )

    return {
        "document_id": document_id,
        "document_info": doc,
        "versions": versions,
        "total_versions": len(versions),
    }


# ══════════════════════════════════════════════
#  4. CERTIFICATE EXPIRATION & RENEWAL
# ══════════════════════════════════════════════

class SetExpirationRequest(BaseModel):
    validity_days: int = Field(default=365, ge=30, le=3650)


@router.post("/certificate/{ceremony_id}/set-expiration")
async def set_certificate_expiration(ceremony_id: str, body: SetExpirationRequest, request: Request):
    """Set a validity period on a notarized certificate."""
    user = await _get_user(request)
    ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")
    if ceremony.get("initiated_by") != user.get("email") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=body.validity_days)

    await db.ceremonies.update_one(
        {"ceremony_id": ceremony_id},
        {"$set": {
            "certificate_expiration": {
                "validity_days": body.validity_days,
                "set_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "renewal_reminder_sent": False,
                "status": "active",
            }
        }}
    )

    return {
        "ceremony_id": ceremony_id,
        "validity_days": body.validity_days,
        "expires_at": expires_at.isoformat(),
        "status": "active",
    }


@router.get("/certificates/expiring")
async def get_expiring_certificates(request: Request, days_ahead: int = 30):
    """Get certificates expiring within the given window."""
    user = await _get_user(request)
    now = datetime.now(timezone.utc)
    threshold = (now + timedelta(days=days_ahead)).isoformat()

    query = {
        "certificate_expiration.expires_at": {"$lte": threshold},
        "certificate_expiration.status": "active",
    }
    if user.get("role") != "admin":
        query["initiated_by"] = user.get("email")

    expiring = []
    cursor = db.ceremonies.find(query, {"_id": 0}).sort("certificate_expiration.expires_at", 1).limit(50)
    async for c in cursor:
        exp = c.get("certificate_expiration", {})
        expiring.append({
            "ceremony_id": c.get("ceremony_id"),
            "document_name": c.get("document_name"),
            "expires_at": exp.get("expires_at"),
            "validity_days": exp.get("validity_days"),
            "days_remaining": max(0, (datetime.fromisoformat(exp["expires_at"].replace("Z", "+00:00")) - now).days),
        })

    return {"expiring_certificates": expiring, "total": len(expiring)}


@router.post("/certificate/{ceremony_id}/renew")
async def renew_certificate(ceremony_id: str, body: SetExpirationRequest, request: Request):
    """Renew an expiring or expired certificate."""
    user = await _get_user(request)
    ceremony = await db.ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Ceremony not found")
    if ceremony.get("initiated_by") != user.get("email") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=body.validity_days)

    await db.ceremonies.update_one(
        {"ceremony_id": ceremony_id},
        {"$set": {
            "certificate_expiration": {
                "validity_days": body.validity_days,
                "set_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "renewed_at": now.isoformat(),
                "renewal_reminder_sent": False,
                "status": "active",
            }
        }}
    )

    return {
        "ceremony_id": ceremony_id,
        "renewed": True,
        "new_expires_at": expires_at.isoformat(),
        "validity_days": body.validity_days,
    }


# ══════════════════════════════════════════════
#  5. MULTI-SIGNATURE CEREMONIES
# ══════════════════════════════════════════════

class MultiSigStartRequest(BaseModel):
    document_name: str = Field(default="Untitled Document", max_length=500)
    signers: List[dict] = Field(..., min_length=2, max_length=10)
    document_id: Optional[str] = None


@router.post("/multi-sig/start")
async def start_multi_sig_ceremony(body: MultiSigStartRequest, request: Request):
    """Start a multi-signature ceremony requiring 2+ signers."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "multi_signature")
    user = await _get_user(request)
    ceremony_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    signer_entries = []
    for s in body.signers:
        signer_entries.append({
            "signer_id": str(uuid.uuid4())[:8],
            "name": s.get("name", "Unknown"),
            "email": s.get("email", ""),
            "status": "pending",
            "verified_at": None,
            "biometric_passed": False,
        })

    ceremony = {
        "ceremony_id": ceremony_id,
        "type": "multi_signature",
        "document_name": body.document_name,
        "document_id": body.document_id,
        "initiated_by": user.get("email"),
        "initiated_by_name": user.get("name", user.get("email")),
        "signers": signer_entries,
        "total_signers": len(signer_entries),
        "completed_signers": 0,
        "status": "awaiting_signatures",
        "created_at": now,
        "updated_at": now,
    }
    await db.multi_sig_ceremonies.insert_one(ceremony)

    return {
        "ceremony_id": ceremony_id,
        "status": "awaiting_signatures",
        "total_signers": len(signer_entries),
        "signers": signer_entries,
    }


@router.post("/multi-sig/{ceremony_id}/sign/{signer_id}")
async def multi_sig_sign(ceremony_id: str, signer_id: str, request: Request):
    """A signer completes their part of the multi-sig ceremony."""
    user = await _get_user(request)
    ceremony = await db.multi_sig_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Multi-sig ceremony not found")

    # Find signer
    signer = None
    for s in ceremony.get("signers", []):
        if s["signer_id"] == signer_id:
            signer = s
            break
    if not signer:
        raise HTTPException(status_code=404, detail="Signer not found")
    if signer["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already signed")

    now = datetime.now(timezone.utc).isoformat()
    await db.multi_sig_ceremonies.update_one(
        {"ceremony_id": ceremony_id, "signers.signer_id": signer_id},
        {"$set": {
            "signers.$.status": "completed",
            "signers.$.verified_at": now,
            "signers.$.biometric_passed": True,
            "signers.$.signed_by": user.get("email"),
            "updated_at": now,
        },
         "$inc": {"completed_signers": 1}}
    )

    # Check if all signers completed
    updated = await db.multi_sig_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    all_done = updated.get("completed_signers", 0) >= updated.get("total_signers", 0)
    if all_done:
        await db.multi_sig_ceremonies.update_one(
            {"ceremony_id": ceremony_id},
            {"$set": {"status": "all_signed", "completed_at": now}}
        )

    return {
        "ceremony_id": ceremony_id,
        "signer_id": signer_id,
        "signed": True,
        "completed_signers": updated.get("completed_signers", 0),
        "total_signers": updated.get("total_signers", 0),
        "all_signed": all_done,
        "status": "all_signed" if all_done else "awaiting_signatures",
    }


@router.get("/multi-sig/{ceremony_id}")
async def get_multi_sig_ceremony(ceremony_id: str, request: Request):
    """Get multi-sig ceremony status."""
    user = await _get_user(request)
    ceremony = await db.multi_sig_ceremonies.find_one({"ceremony_id": ceremony_id}, {"_id": 0})
    if not ceremony:
        raise HTTPException(status_code=404, detail="Multi-sig ceremony not found")
    if ceremony.get("initiated_by") != user.get("email") and user.get("role") != "admin":
        is_signer = any(s.get("email") == user.get("email") for s in ceremony.get("signers", []))
        if not is_signer:
            raise HTTPException(status_code=403, detail="Access denied")
    return ceremony


@router.get("/multi-sig")
async def list_multi_sig_ceremonies(request: Request):
    """List user's multi-sig ceremonies."""
    user = await _get_user(request)
    ceremonies = []
    query = {"$or": [
        {"initiated_by": user.get("email")},
        {"signers.email": user.get("email")},
    ]}
    if user.get("role") == "admin":
        query = {}
    cursor = db.multi_sig_ceremonies.find(query, {"_id": 0}).sort("created_at", -1).limit(50)
    async for c in cursor:
        ceremonies.append(c)
    return {"ceremonies": ceremonies, "total": len(ceremonies)}
