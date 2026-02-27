"""
Transaction Timeline Routes
Aggregates all transaction events into a single chronological timeline.
Sources: status changes, task updates, participant joins, messages,
AI analyses, biometric verifications, conductor sessions, evidence packages, blockchain events.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/timeline", tags=["timeline"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


def _parse_dt(val) -> str:
    """Normalise a datetime or ISO string to ISO string."""
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, str):
        return val
    return datetime.now(timezone.utc).isoformat()


@router.get("/{transaction_id}")
async def get_transaction_timeline(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Build a comprehensive, chronological timeline of every event in a transaction.
    """
    # Verify participant
    participant = await db.transaction_participants.find_one(
        {"transaction_id": transaction_id, "user_id": current_user.id}
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Not authorized")

    transaction = await db.transactions.find_one(
        {"id": transaction_id}, {"_id": 0}
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    events = []

    # --- 1. Transaction created ---
    created_at = transaction.get("created_at")
    events.append({
        "type": "transaction",
        "category": "lifecycle",
        "icon": "rocket",
        "title": "Transaction Created",
        "description": f'"{transaction.get("name")}" ({transaction.get("transaction_type", "").replace("_", " ")})',
        "timestamp": _parse_dt(created_at),
        "severity": "info",
        "metadata": {"blueprint": transaction.get("blueprint_name")},
    })

    # --- 2. Participants ---
    participants = await db.transaction_participants.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).to_list(50)

    for p in participants:
        if p.get("joined_at"):
            events.append({
                "type": "participant",
                "category": "people",
                "icon": "user-check",
                "title": f'{p.get("name", "Unknown")} Joined',
                "description": f'Role: {p.get("role", "participant")}',
                "timestamp": _parse_dt(p["joined_at"]),
                "severity": "success",
                "metadata": {"email": p.get("email"), "role": p.get("role")},
            })
        elif p.get("invite_sent_at"):
            events.append({
                "type": "participant",
                "category": "people",
                "icon": "mail",
                "title": f'Invitation Sent to {p.get("name", p.get("email", "Unknown"))}',
                "description": f'Role: {p.get("role", "participant")}',
                "timestamp": _parse_dt(p["invite_sent_at"]),
                "severity": "info",
                "metadata": {"email": p.get("email"), "role": p.get("role")},
            })

    # --- 3. Tasks ---
    tasks = await db.transaction_tasks.find(
        {"transaction_id": transaction_id}, {"_id": 0}
    ).to_list(100)

    for t in tasks:
        if t.get("started_at"):
            events.append({
                "type": "task",
                "category": "tasks",
                "icon": "play",
                "title": f'Task Started: {t.get("name")}',
                "description": t.get("description", "")[:100],
                "timestamp": _parse_dt(t["started_at"]),
                "severity": "info",
                "metadata": {"task_id": t.get("id"), "status": t.get("status")},
            })
        if t.get("completed_at"):
            events.append({
                "type": "task",
                "category": "tasks",
                "icon": "check-circle",
                "title": f'Task Completed: {t.get("name")}',
                "description": f'Completed by: {t.get("completed_by", "unknown")}',
                "timestamp": _parse_dt(t["completed_at"]),
                "severity": "success",
                "metadata": {"task_id": t.get("id")},
            })

    # --- 4. Documents ---
    documents = await db.transaction_documents.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "storage_url": 0},
    ).to_list(100)

    for d in documents:
        events.append({
            "type": "document",
            "category": "documents",
            "icon": "file-text",
            "title": f'Document Uploaded: {d.get("name", d.get("filename", "Untitled"))}',
            "description": d.get("document_type", ""),
            "timestamp": _parse_dt(d.get("uploaded_at", d.get("created_at", datetime.now(timezone.utc)))),
            "severity": "info",
            "metadata": {"doc_id": d.get("id")},
        })

    # --- 5. AI Analyses ---
    ai_analyses = await db.document_analyses.find(
        {"session_id": transaction_id},
        {"_id": 0, "file_path": 0},
    ).to_list(50)

    for a in ai_analyses:
        events.append({
            "type": "ai_analysis",
            "category": "ai",
            "icon": "brain",
            "title": f'AI Document Analysis: {a.get("filename", "Document")}',
            "description": f'Type: {a.get("document_type", "general")}',
            "timestamp": _parse_dt(a.get("timestamp", datetime.now(timezone.utc))),
            "severity": "info",
            "metadata": {"analysis_id": a.get("id")},
        })

    # --- 6. Copilot analyses ---
    copilot_records = await db.copilot_analyses.find(
        {"request_id": transaction_id}, {"_id": 0}
    ).to_list(10)

    for c in copilot_records:
        events.append({
            "type": "ai_copilot",
            "category": "ai",
            "icon": "sparkles",
            "title": "AI Co-pilot Analysis",
            "description": c.get("summary", "")[:120] if isinstance(c.get("summary"), str) else "Copilot review completed",
            "timestamp": _parse_dt(c.get("created_at", datetime.now(timezone.utc))),
            "severity": "info",
        })

    # --- 7. Remediations ---
    remediations = await db.remediations.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "original_text": 0, "remediated_text": 0},
    ).to_list(10)

    for r in remediations:
        risk = r.get("result", {}).get("overall_risk_score", "?")
        clauses = len(r.get("result", {}).get("missing_clauses", []))
        events.append({
            "type": "remediation",
            "category": "ai",
            "icon": "shield-alert",
            "title": "AI Document Remediation",
            "description": f'Risk score: {risk}/100, {clauses} missing clause(s) found',
            "timestamp": _parse_dt(r.get("created_at", datetime.now(timezone.utc))),
            "severity": "warning" if isinstance(risk, (int, float)) and risk > 50 else "info",
            "metadata": {"remediation_id": r.get("id"), "applied_clauses": r.get("applied_clauses", [])},
        })

    # --- 8. Biometric passports ---
    user_ids = [p.get("user_id") for p in participants if p.get("user_id")]
    passports = await db.biometric_passports.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0}
    ).to_list(50)

    for bp in passports:
        user_name = next(
            (p.get("name") for p in participants if p.get("user_id") == bp.get("user_id")),
            "Unknown",
        )
        events.append({
            "type": "biometric",
            "category": "verification",
            "icon": "fingerprint",
            "title": f'Biometric Passport Issued: {user_name}',
            "description": f'Score: {round(bp.get("composite_score", 0) * 100, 1)}%, Modalities: {", ".join(bp.get("modalities_verified", []))}',
            "timestamp": _parse_dt(bp.get("issued_at", bp.get("created_at", datetime.now(timezone.utc)))),
            "severity": "success" if bp.get("status") == "verified" else "warning",
            "metadata": {"passport_id": bp.get("id"), "status": bp.get("status")},
        })

    # --- 9. Biometric verifications (individual) ---
    bio_verifications = await db.biometric_verifications.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0},
    ).to_list(50)

    for bv in bio_verifications:
        events.append({
            "type": "biometric_check",
            "category": "verification",
            "icon": "scan-face",
            "title": f'Biometric Check: {bv.get("verification_type", "unknown").title()}',
            "description": f'Confidence: {round(bv.get("confidence_score", 0) * 100, 1)}% — {bv.get("status", "unknown")}',
            "timestamp": _parse_dt(bv.get("timestamp", datetime.now(timezone.utc))),
            "severity": "success" if bv.get("status") == "passed" else "error",
            "metadata": {"verification_id": bv.get("id"), "type": bv.get("verification_type")},
        })

    # --- 10. Conductor guidance ---
    guidance_logs = await db.conductor_guidance.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "guidance": 0},
    ).to_list(50)

    for g in guidance_logs:
        events.append({
            "type": "conductor",
            "category": "ai",
            "icon": "wand",
            "title": f'AI Conductor Guidance ({g.get("role", "participant")})',
            "description": "Personalised step-by-step guidance delivered",
            "timestamp": _parse_dt(g.get("created_at", datetime.now(timezone.utc))),
            "severity": "info",
        })

    # --- 11. Evidence packages ---
    evidence_pkgs = await db.evidence_packages.find(
        {"transaction_id": transaction_id},
        {"_id": 0, "participants": 0, "tasks": 0, "documents": 0,
         "ai_evidence": 0, "biometric_evidence": 0, "witness_recordings": 0, "communication": 0},
    ).to_list(5)

    for ep in evidence_pkgs:
        events.append({
            "type": "evidence_package",
            "category": "blockchain",
            "icon": "package",
            "title": "Evidence Package Generated",
            "description": f'Version {ep.get("version", "?")} — Integrity hash: {(ep.get("integrity_hash", "") or "")[:16]}...',
            "timestamp": _parse_dt(ep.get("generated_at", datetime.now(timezone.utc))),
            "severity": "success",
            "metadata": {"package_id": ep.get("id")},
        })

    # --- 12. Blockchain settlement ---
    if transaction.get("settlement_hash"):
        events.append({
            "type": "settlement",
            "category": "blockchain",
            "icon": "shield",
            "title": "Transaction Settled on Blockchain",
            "description": f'Hash: {transaction["settlement_hash"][:24]}...',
            "timestamp": _parse_dt(transaction.get("settlement_timestamp", transaction.get("actual_completion_date", datetime.now(timezone.utc)))),
            "severity": "success",
            "metadata": {
                "hash": transaction["settlement_hash"],
                "hcs_topic_id": transaction.get("hcs_topic_id"),
                "explorer_url": transaction.get("hcs_explorer_url"),
            },
        })

    # --- 13. Witness recordings ---
    witness_recordings = await db.witness_recordings.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "file_path": 0},
    ).to_list(20)

    for w in witness_recordings:
        events.append({
            "type": "witness_recording",
            "category": "verification",
            "icon": "video",
            "title": f'Video Witness Recording ({w.get("instruction_type", "standard")})',
            "description": f'Status: {w.get("status", "unknown")}',
            "timestamp": _parse_dt(w.get("created_at", datetime.now(timezone.utc))),
            "severity": "success" if w.get("status") == "approved" else "info",
            "metadata": {"recording_id": w.get("id")},
        })

    # Sort by timestamp descending (newest first) and add sequence numbers
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    for i, ev in enumerate(events):
        ev["sequence"] = len(events) - i

    return {
        "transaction_id": transaction_id,
        "transaction_name": transaction.get("name"),
        "transaction_status": transaction.get("status"),
        "total_events": len(events),
        "categories": list({e["category"] for e in events}),
        "events": events,
    }
