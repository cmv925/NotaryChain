"""
Predictive Compliance Vault (PCV) — REST API

All endpoints prefixed /api/pcv. Most require auth; the evidence packet
verifier is public so any court / third party can confirm integrity
without trusting NotaryChain.
"""
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from services import pcv_service
from routes.auth_routes import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pcv", tags=["predictive-compliance-vault"])
db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


def _org_id_for(user: User) -> Optional[str]:
    return getattr(user, "organization_id", None)


async def _require_admin_or_member(user: User) -> None:
    """PCV is gated behind enterprise tier. For MVP we allow admin or any logged-in user."""
    if not user:
        raise HTTPException(401, "Authentication required")


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    summary = await pcv_service.dashboard_summary(organization_id=_org_id_for(current_user))
    return summary


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRITY SCANNING
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/integrity/scan")
async def trigger_integrity_scan(current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    scan = await pcv_service.run_integrity_scan(organization_id=_org_id_for(current_user), manual=True)
    return {"ok": True, "scan": scan}


@router.get("/integrity/scans")
async def list_integrity_scans(limit: int = Query(20, ge=1, le=200), current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    q = {"organization_id": _org_id_for(current_user)} if _org_id_for(current_user) else {}
    cur = db.pcv_integrity_scans.find(q, {"_id": 0}).sort("started_at", -1).limit(limit)
    return {"scans": await cur.to_list(limit)}


@router.get("/integrity/issues")
async def list_issues(
    status: Optional[str] = Query(None, pattern="^(open|acknowledged|auto_resolved|resolved)$"),
    severity: Optional[str] = Query(None, pattern="^(warning|critical)$"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    await _require_admin_or_member(current_user)
    issues = await pcv_service.list_integrity_issues(
        organization_id=_org_id_for(current_user),
        status=status,
        severity=severity,
        limit=limit,
    )
    return {"issues": issues, "count": len(issues)}


class AcknowledgeIssueRequest(BaseModel):
    note: str = Field("", max_length=500)


@router.post("/integrity/issues/{issue_id}/acknowledge")
async def acknowledge_issue(
    issue_id: str,
    body: AcknowledgeIssueRequest,
    current_user: User = Depends(get_current_user),
):
    await _require_admin_or_member(current_user)
    ok = await pcv_service.acknowledge_issue(issue_id, actor_id=current_user.id, note=body.note)
    if not ok:
        raise HTTPException(404, "Issue not found")
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# REGULATORY ORACLE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/regulatory/seed")
async def seed_rules(force: bool = Query(False), current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    n = await pcv_service.seed_regulatory_rules(force=force)
    return {"ok": True, "inserted_or_updated": n}


@router.get("/regulatory/rules")
async def list_rules(
    jurisdiction: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    await _require_admin_or_member(current_user)
    rules = await pcv_service.list_regulatory_rules(jurisdiction=jurisdiction)
    return {"rules": rules, "count": len(rules)}


@router.get("/regulatory/changes")
async def list_changes(limit: int = Query(50, ge=1, le=200), current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    changes = await pcv_service.list_regulatory_changes(limit=limit)
    return {"changes": changes, "count": len(changes)}


class RecordChangeRequest(BaseModel):
    rule_id: str = Field(..., min_length=1)
    change_kind: str = Field(..., pattern="^(new|amended|repealed|court_precedent)$")
    summary: str = Field(..., min_length=1, max_length=2000)
    diff: Optional[str] = Field(None, max_length=10000)


@router.post("/regulatory/changes")
async def record_change(body: RecordChangeRequest, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    change = await pcv_service.record_regulatory_change(
        rule_id=body.rule_id, change_kind=body.change_kind, summary=body.summary, diff=body.diff,
    )
    return {"ok": True, "change": change}


@router.post("/regulatory/rescore")
async def rescore_portfolio(current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    result = await pcv_service.score_portfolio_against_rules(organization_id=_org_id_for(current_user))
    return {"ok": True, **result}


@router.get("/compliance/scores")
async def list_scores(
    status: Optional[str] = Query(None, pattern="^(passing|warning|failing)$"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    await _require_admin_or_member(current_user)
    q: Dict[str, Any] = {}
    org_id = _org_id_for(current_user)
    if org_id:
        q["organization_id"] = org_id
    if status:
        q["status"] = status
    cur = db.pcv_compliance_scores.find(q, {"_id": 0}).sort("scored_at", -1).limit(limit)
    scores = await cur.to_list(limit)
    return {"scores": scores, "count": len(scores)}


# ─────────────────────────────────────────────────────────────────────────────
# REMEDIATION
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/remediation/draft-all")
async def draft_all_remediations(current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    n = await pcv_service.draft_remediation_for_low_scores(organization_id=_org_id_for(current_user))
    return {"ok": True, "tasks_created": n}


@router.get("/remediation/tasks")
async def list_tasks(
    status: Optional[str] = Query(None, pattern="^(pending|approved|rejected|completed|in_progress)$"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    await _require_admin_or_member(current_user)
    tasks = await pcv_service.list_remediation_tasks(
        organization_id=_org_id_for(current_user), status=status, limit=limit,
    )
    return {"tasks": tasks, "count": len(tasks)}


@router.get("/remediation/tasks/{task_id}")
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    task = await pcv_service.get_remediation_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


class TaskActionRequest(BaseModel):
    note: str = Field("", max_length=500)


@router.post("/remediation/tasks/{task_id}/approve")
async def approve_task(task_id: str, body: TaskActionRequest, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    ok = await pcv_service.update_remediation_status(task_id, "approved", current_user.id, body.note)
    if not ok:
        raise HTTPException(404, "Task not found")
    return {"ok": True}


@router.post("/remediation/tasks/{task_id}/reject")
async def reject_task(task_id: str, body: TaskActionRequest, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    ok = await pcv_service.update_remediation_status(task_id, "rejected", current_user.id, body.note)
    if not ok:
        raise HTTPException(404, "Task not found")
    return {"ok": True}


@router.post("/remediation/tasks/{task_id}/complete")
async def complete_task(task_id: str, body: TaskActionRequest, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    ok = await pcv_service.update_remediation_status(task_id, "completed", current_user.id, body.note)
    if not ok:
        raise HTTPException(404, "Task not found")
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# PORTFOLIO INTEGRITY GRAPH (MERKLE DAG)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/portfolio/graph/rebuild")
async def rebuild_graph(current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    res = await pcv_service.rebuild_portfolio_graph(organization_id=_org_id_for(current_user))
    return {"ok": True, **res}


@router.get("/portfolio/graph")
async def get_graph(max_nodes: int = Query(500, ge=1, le=10000), current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    return await pcv_service.get_portfolio_graph(
        organization_id=_org_id_for(current_user), max_nodes=max_nodes,
    )


@router.post("/portfolio/graph/{anchor_id}/anchor-hedera")
async def anchor_graph(anchor_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    res = await pcv_service.anchor_graph_to_hedera(anchor_id)
    if not res.get("ok"):
        raise HTTPException(404, res.get("error", "Anchor not found"))
    return res


# ─────────────────────────────────────────────────────────────────────────────
# EVIDENCE PACKETS
# ─────────────────────────────────────────────────────────────────────────────

class GeneratePacketRequest(BaseModel):
    title: str = Field("Portfolio Evidence Packet", min_length=1, max_length=200)
    notarization_ids: Optional[List[str]] = None


@router.post("/evidence-packet/generate")
async def generate_packet(body: GeneratePacketRequest, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    packet = await pcv_service.build_evidence_packet(
        organization_id=_org_id_for(current_user),
        actor_id=current_user.id,
        notarization_ids=body.notarization_ids,
        title=body.title,
    )
    return {"ok": True, "packet": packet}


@router.get("/evidence-packet")
async def list_packets(limit: int = Query(50, ge=1, le=200), current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    packets = await pcv_service.list_evidence_packets(organization_id=_org_id_for(current_user), limit=limit)
    return {"packets": packets, "count": len(packets)}


@router.get("/evidence-packet/{packet_id}")
async def get_packet(packet_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    packet = await pcv_service.get_evidence_packet(packet_id, include_body=False)
    if not packet:
        raise HTTPException(404, "Packet not found")
    return packet


@router.get("/evidence-packet/{packet_id}/download")
async def download_packet(packet_id: str, current_user: User = Depends(get_current_user)):
    await _require_admin_or_member(current_user)
    packet = await pcv_service.get_evidence_packet(packet_id, include_body=True)
    if not packet:
        raise HTTPException(404, "Packet not found")
    payload = json.dumps(packet, indent=2, default=str).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="evidence-packet-{packet_id}.json"'},
    )


# Public verifier — no auth required
@router.get("/evidence-packet/{packet_id}/verify")
async def verify_packet_public(packet_id: str):
    res = await pcv_service.verify_evidence_packet(packet_id)
    if not res.get("ok") and res.get("error") == "Packet not found":
        raise HTTPException(404, "Packet not found")
    return res
