"""
Evidence Package Routes
Auto-generates a comprehensive forensic Evidence Package at transaction settlement.
Bundles: document analysis, biometric passports, all signatures, blockchain proof.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from datetime import datetime, timezone
import hashlib
import json
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evidence-package", tags=["evidence-package"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _compile_evidence_package(transaction_id: str, triggered_by: str) -> dict:
    """Core logic: compile all evidence for a transaction into a single verifiable artifact."""

    transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise ValueError("Transaction not found")

    # Participants
    participants = await db.transaction_participants.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).to_list(50)
    for p in participants:
        for f in ["invite_sent_at", "joined_at", "last_active_at", "created_at"]:
            if f in p and isinstance(p[f], datetime):
                p[f] = p[f].isoformat()

    # Tasks
    tasks = await db.transaction_tasks.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).sort("order", 1).to_list(100)
    for t in tasks:
        for f in ["due_date", "started_at", "completed_at", "created_at", "updated_at"]:
            if f in t and isinstance(t[f], datetime):
                t[f] = t[f].isoformat()

    # Documents
    documents = await db.transaction_documents.find(
        {"transaction_id": transaction_id}, {"_id": 0, "storage_url": 0}
    ).to_list(100)
    for d in documents:
        if isinstance(d.get("uploaded_at"), datetime):
            d["uploaded_at"] = d["uploaded_at"].isoformat()

    # AI analyses linked to this transaction
    ai_analyses = await db.document_analyses.find(
        {"session_id": transaction_id}, {"_id": 0, "file_path": 0}
    ).to_list(50)
    for a in ai_analyses:
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()

    # Copilot analyses
    copilot_analyses = await db.copilot_analyses.find(
        {"request_id": transaction_id}, {"_id": 0}
    ).to_list(10)

    # Remediations
    remediations = await db.remediations.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "id": 1, "document_type": 1, "result.overall_risk_score": 1,
         "applied_clauses": 1, "created_at": 1},
    ).to_list(10)

    # Biometric passports for all participants
    user_ids = [p.get("user_id") for p in participants if p.get("user_id")]
    biometric_passports = await db.biometric_passports.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0},
    ).to_list(50)

    # Individual biometric verifications
    biometric_verifications = []
    for uid in user_ids:
        bvs = await db.biometric_verifications.find(
            {"user_id": uid}, {"_id": 0}
        ).to_list(20)
        for bv in bvs:
            if isinstance(bv.get("timestamp"), datetime):
                bv["timestamp"] = bv["timestamp"].isoformat()
            biometric_verifications.append(bv)

    # Conductor guidance logs
    guidance_logs = await db.conductor_guidance.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "user_id": 1, "role": 1, "created_at": 1},
    ).to_list(50)

    # Messages summary
    message_count = await db.transaction_messages.count_documents(
        {"transaction_id": transaction_id}
    )

    # Witness recordings linked to any request in this transaction
    witness_recordings = await db.witness_recordings.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "file_path": 0},
    ).to_list(20)

    # Build the package
    now = datetime.now(timezone.utc)

    package = {
        "id": str(uuid.uuid4()),
        "transaction_id": transaction_id,
        "version": "2.0.0",
        "generated_at": now.isoformat(),
        "triggered_by": triggered_by,

        # Transaction metadata
        "transaction": {
            "name": transaction.get("name"),
            "type": transaction.get("transaction_type"),
            "status": transaction.get("status"),
            "blueprint_name": transaction.get("blueprint_name"),
            "progress": transaction.get("progress_percentage"),
            "created_at": transaction.get("created_at") if isinstance(transaction.get("created_at"), str)
                          else transaction.get("created_at", now).isoformat() if isinstance(transaction.get("created_at"), datetime)
                          else str(transaction.get("created_at", "")),
            "settlement_hash": transaction.get("settlement_hash"),
            "settlement_transaction_id": transaction.get("settlement_transaction_id"),
            "hcs_topic_id": transaction.get("hcs_topic_id"),
            "hcs_explorer_url": transaction.get("hcs_explorer_url"),
        },

        # Participants
        "participants": [{
            "name": p.get("name"),
            "email": p.get("email"),
            "role": p.get("role"),
            "status": p.get("status"),
            "joined_at": p.get("joined_at"),
        } for p in participants],

        # Task completion record
        "tasks": [{
            "name": t.get("name"),
            "order": t.get("order"),
            "status": t.get("status"),
            "completed_by": t.get("completed_by"),
            "completed_at": t.get("completed_at"),
            "requires_document": t.get("requires_document"),
            "requires_signature": t.get("requires_signature"),
            "requires_notarization": t.get("requires_notarization"),
        } for t in tasks],

        # Document evidence
        "documents": documents,

        # AI analysis evidence
        "ai_evidence": {
            "document_analyses": len(ai_analyses),
            "copilot_analyses": len(copilot_analyses),
            "remediations": remediations,
        },

        # Biometric evidence
        "biometric_evidence": {
            "passports": biometric_passports,
            "individual_verifications": len(biometric_verifications),
            "modalities_used": list({v.get("verification_type") for v in biometric_verifications}),
        },

        # Witness recordings
        "witness_recordings": [{
            "id": w.get("id"),
            "instruction_type": w.get("instruction_type"),
            "status": w.get("status"),
            "created_at": w.get("created_at"),
        } for w in witness_recordings],

        # Communication record
        "communication": {
            "total_messages": message_count,
            "conductor_guidance_sessions": len(guidance_logs),
        },

        # Blockchain proof
        "blockchain_proof": {
            "network": "Hedera Hashgraph",
            "topic_id": transaction.get("hcs_topic_id"),
            "explorer_url": transaction.get("hcs_explorer_url"),
            "settlement_hash": transaction.get("settlement_hash"),
            "settlement_tx_id": transaction.get("settlement_transaction_id"),
        },
    }

    # Compute integrity hash over the entire package (excluding the hash itself)
    package_json = json.dumps(package, sort_keys=True, default=str)
    package["integrity_hash"] = hashlib.sha256(package_json.encode()).hexdigest()

    # Component hashes for granular verification
    package["component_hashes"] = {
        "participants": hashlib.sha256(json.dumps(package["participants"], sort_keys=True).encode()).hexdigest(),
        "tasks": hashlib.sha256(json.dumps(package["tasks"], sort_keys=True).encode()).hexdigest(),
        "biometric": hashlib.sha256(json.dumps(package["biometric_evidence"], sort_keys=True, default=str).encode()).hexdigest(),
        "blockchain": hashlib.sha256(json.dumps(package["blockchain_proof"], sort_keys=True).encode()).hexdigest(),
    }

    # Store the evidence package
    await db.evidence_packages.insert_one(package)
    package.pop("_id", None)

    return package


@router.post("/generate/{transaction_id}")
async def generate_evidence_package(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
):
    """Generate a full Evidence Package for a transaction."""
    # Verify participant
    participant = await db.transaction_participants.find_one(
        {"transaction_id": transaction_id, "user_id": current_user.id}
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        package = await _compile_evidence_package(transaction_id, current_user.id)
        return package
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Evidence package generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate evidence package")


@router.get("/{transaction_id}")
async def get_evidence_package(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the latest evidence package for a transaction."""
    package = await db.evidence_packages.find_one(
        {"transaction_id": transaction_id},
        {"_id": 0},
        sort=[("generated_at", -1)],
    )
    if not package:
        raise HTTPException(status_code=404, detail="No evidence package found")
    return package


@router.get("/verify/{package_id}")
async def verify_evidence_package(package_id: str):
    """Public endpoint to verify an evidence package's integrity."""
    package = await db.evidence_packages.find_one(
        {"id": package_id}, {"_id": 0}
    )
    if not package:
        raise HTTPException(status_code=404, detail="Evidence package not found")

    stored_hash = package.pop("integrity_hash", None)
    component_hashes = package.pop("component_hashes", None)

    # Recompute
    package_json = json.dumps(package, sort_keys=True, default=str)
    recomputed_hash = hashlib.sha256(package_json.encode()).hexdigest()

    return {
        "package_id": package_id,
        "transaction_id": package.get("transaction_id"),
        "generated_at": package.get("generated_at"),
        "integrity_verified": stored_hash == recomputed_hash,
        "stored_hash": stored_hash,
        "recomputed_hash": recomputed_hash,
        "component_hashes": component_hashes,
        "blockchain_proof": package.get("blockchain_proof"),
    }
