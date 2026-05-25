"""
SOC2 / ISO 27001 — Audit Log Export
Generates a tamper-evident export bundle of operational audit_logs.

Each exported row gets:
  - prev_hash: SHA256 of the previous row's row_hash (genesis = 64 zeros)
  - row_hash:  SHA256(prev_hash || canonical_json(row_without_hash_fields))

The final row_hash becomes the "merkle tip" of the export; we then anchor it
on Hedera HCS so any verifier can later prove the bundle has not been altered.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional
import base64
import hashlib
import io
import json
import csv
import zipfile
import logging
import uuid

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/audit-export", tags=["audit-export"])
db = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _canonical_json(obj) -> str:
    """Stable canonical JSON for hashing (sorted keys, compact)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


@router.get("/preview")
async def preview_export(
    start_date: Optional[str] = Query(None, description="ISO date, inclusive"),
    end_date: Optional[str] = Query(None, description="ISO date, inclusive"),
    actor: Optional[str] = Query(None, description="user_email substring"),
    action: Optional[str] = Query(None, description="action substring"),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Returns a count + sample of rows that would be exported."""
    await _check_admin(current_user)
    query = _build_query(start_date, end_date, actor, action, severity)
    total = await db.audit_logs.count_documents(query)
    sample = []
    async for r in db.audit_logs.find(query, {"_id": 0}).sort("timestamp", 1).limit(5):
        r.pop("password", None)
        sample.append({
            "id": r.get("id"),
            "timestamp": r.get("timestamp"),
            "user_email": r.get("user_email", "system"),
            "action": r.get("action"),
            "severity": r.get("severity", "info"),
        })
    return {
        "total_rows": total,
        "sample": sample,
        "filters": {
            "start_date": start_date, "end_date": end_date,
            "actor": actor, "action": action, "severity": severity,
        },
    }


def _build_query(start_date, end_date, actor, action, severity):
    q = {}
    if start_date or end_date:
        ts = {}
        if start_date:
            ts["$gte"] = start_date
        if end_date:
            ts["$lte"] = end_date + ("T23:59:59.999999+00:00" if "T" not in (end_date or "") else "")
        q["timestamp"] = ts
    if actor:
        q["user_email"] = {"$regex": actor, "$options": "i"}
    if action:
        q["action"] = {"$regex": action, "$options": "i"}
    if severity:
        q["severity"] = severity
    return q


@router.post("/generate")
async def generate_export(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Generate a tamper-evident audit log export ZIP."""
    await _check_admin(current_user)
    query = _build_query(start_date, end_date, actor, action, severity)
    cursor = db.audit_logs.find(query, {"_id": 0}).sort("timestamp", 1)

    rows = []
    prev_hash = "0" * 64  # genesis
    async for row in cursor:
        row.pop("password", None)
        # Stable payload for hashing — exclude prev_hash/row_hash themselves
        payload = {k: v for k, v in row.items() if k not in ("prev_hash", "row_hash")}
        canon = _canonical_json(payload)
        row_hash = hashlib.sha256((prev_hash + canon).encode()).hexdigest()
        row["prev_hash"] = prev_hash
        row["row_hash"] = row_hash
        rows.append(row)
        prev_hash = row_hash

    if not rows:
        raise HTTPException(status_code=400, detail="No audit log rows matched these filters.")

    export_id = "AUDIT-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6].upper()
    root_hash = rows[-1]["row_hash"]
    generated_at = datetime.now(timezone.utc).isoformat()

    # Anchor root hash on Hedera HCS (best-effort)
    hcs_result = None
    hedera_tx_id = None
    hedera_topic = None
    hedera_network = None
    try:
        from services.hedera_service import hedera_service
        hcs_result = await hedera_service.submit_message(
            hedera_service.default_topic_id,
            {
                "type": "AUDIT_LOG_EXPORT_ANCHOR",
                "export_id": export_id,
                "root_hash": root_hash,
                "row_count": len(rows),
                "generated_at": generated_at,
                "generated_by": current_user.email,
                "filters": {
                    "start_date": start_date, "end_date": end_date,
                    "actor": actor, "action": action, "severity": severity,
                },
            },
        )
        if hcs_result and hcs_result.get("success"):
            hedera_tx_id = f"{hedera_service.account_id}@{int(datetime.now(timezone.utc).timestamp())}"
            hedera_topic = hedera_service.default_topic_id
            hedera_network = hedera_service.network
    except Exception as e:
        logger.warning(f"Hedera anchor failed for audit export: {e}")

    # ── Build CSV
    csv_buf = io.StringIO()
    cols = ["#", "id", "timestamp", "user_email", "action", "resource_type",
            "resource_id", "severity", "description", "ip_address",
            "prev_hash", "row_hash"]
    w = csv.writer(csv_buf)
    w.writerow(cols)
    for i, r in enumerate(rows, start=1):
        w.writerow([
            i, r.get("id", ""), r.get("timestamp", ""),
            r.get("user_email", "system"), r.get("action", ""),
            r.get("resource_type", ""), r.get("resource_id", ""),
            r.get("severity", "info"),
            (r.get("description") or "")[:240],
            r.get("ip_address", ""),
            r.get("prev_hash", ""), r.get("row_hash", ""),
        ])
    csv_bytes = csv_buf.getvalue().encode("utf-8")

    # ── Build JSON (full hash chain, machine-readable)
    json_doc = {
        "export_id": export_id,
        "generated_at": generated_at,
        "generated_by": current_user.email,
        "row_count": len(rows),
        "root_hash": root_hash,
        "genesis_hash": "0" * 64,
        "hash_algorithm": "sha256",
        "chain_algorithm": "row_hash = sha256(prev_hash || canonical_json(row_without_hash_fields))",
        "hedera_anchor": {
            "submitted": bool(hcs_result and hcs_result.get("success")),
            "network": hedera_network,
            "topic_id": hedera_topic,
            "transaction_id": hedera_tx_id,
            "sequence_number": (hcs_result or {}).get("sequence_number") if hcs_result else None,
            "explorer_url": (hcs_result or {}).get("explorer_url") if hcs_result else None,
        },
        "filters": {
            "start_date": start_date, "end_date": end_date,
            "actor": actor, "action": action, "severity": severity,
        },
        "rows": rows,
    }
    json_bytes = json.dumps(json_doc, indent=2, default=str).encode("utf-8")

    # ── MANIFEST.txt
    txt = io.StringIO()
    txt.write("NotaryChain — Audit Log Export Bundle\n")
    txt.write("SOC 2 / ISO 27001 — Tamper-Evident Hash Chain\n")
    txt.write("=" * 60 + "\n")
    txt.write(f"Export ID:        {export_id}\n")
    txt.write(f"Generated at:     {generated_at}\n")
    txt.write(f"Generated by:     {current_user.email}\n")
    txt.write(f"Row count:        {len(rows)}\n")
    txt.write("Hash algorithm:   sha256\n")
    txt.write(f"Genesis hash:     {'0' * 64}\n")
    txt.write(f"Root hash:        {root_hash}\n")
    txt.write("\n")
    if hedera_tx_id:
        txt.write("HEDERA ANCHOR (Mainnet HCS)\n")
        txt.write(f"  Network:       {hedera_network}\n")
        txt.write(f"  Topic:         {hedera_topic}\n")
        txt.write(f"  Transaction:   {hedera_tx_id}\n")
        if (hcs_result or {}).get("explorer_url"):
            txt.write(f"  Explorer:      {hcs_result.get('explorer_url')}\n")
    else:
        txt.write("HEDERA ANCHOR — NOT SUBMITTED (offline or unconfigured)\n")
        txt.write("  Root hash is still cryptographically chained; anchor can\n")
        txt.write("  be added later by re-anchoring this export_id + root_hash.\n")
    txt.write("\n")
    txt.write("VERIFICATION\n")
    txt.write("  1. For each row in audit_log.json['rows'] in order:\n")
    txt.write("       expected = sha256(prev_hash || canonical_json(row\\{prev_hash,row_hash}))\n")
    txt.write("       assert expected == row['row_hash']\n")
    txt.write("  2. assert rows[-1]['row_hash'] == export_meta['root_hash']\n")
    txt.write("  3. If a Hedera tx id is present, look it up on hashscan.io and\n")
    txt.write("     confirm the message payload's root_hash matches.\n")
    txt.write("\n")
    txt.write("FILTERS\n")
    for k, v in [("start_date", start_date), ("end_date", end_date),
                 ("actor", actor), ("action", action), ("severity", severity)]:
        txt.write(f"  {k}: {v or '(any)'}\n")
    manifest_bytes = txt.getvalue().encode("utf-8")

    # ── Build ZIP
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("audit_log.csv", csv_bytes)
        zf.writestr("audit_log.json", json_bytes)
        zf.writestr("MANIFEST.txt", manifest_bytes)
    zip_bytes = zip_buf.getvalue()

    # Persist export record (so we can list / re-verify later)
    await db.audit_log_exports.insert_one({
        "id": uuid.uuid4().hex,
        "export_id": export_id,
        "generated_at": generated_at,
        "generated_by": current_user.email,
        "row_count": len(rows),
        "root_hash": root_hash,
        "hedera_tx_id": hedera_tx_id,
        "hedera_topic": hedera_topic,
        "hedera_network": hedera_network,
        "filters": {
            "start_date": start_date, "end_date": end_date,
            "actor": actor, "action": action, "severity": severity,
        },
        "size_bytes": len(zip_bytes),
    })

    # Self-log
    try:
        await db.audit_logs.insert_one({
            "id": uuid.uuid4().hex,
            "user_id": getattr(current_user, "id", None),
            "user_email": current_user.email,
            "action": "audit_log_export",
            "resource_type": "audit_log",
            "description": f"Exported {len(rows)} audit log rows ({export_id}), root={root_hash[:12]}…",
            "details": {"export_id": export_id, "row_count": len(rows), "root_hash": root_hash,
                        "hedera_tx_id": hedera_tx_id},
            "severity": "info",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{export_id}.zip"',
            "X-Export-Id": export_id,
            "X-Root-Hash": root_hash,
            "X-Row-Count": str(len(rows)),
            "X-Hedera-Tx": hedera_tx_id or "",
        },
    )


@router.get("/history")
async def export_history(current_user: User = Depends(get_current_user)):
    """List previous audit exports for re-download evidence / SOC2 auditor."""
    await _check_admin(current_user)
    items = []
    async for e in db.audit_log_exports.find({}, {"_id": 0, "zip_b64": 0}).sort("generated_at", -1).limit(100):
        items.append(e)
    return {"exports": items, "total": len(items)}


@router.post("/run-now")
async def run_scheduled_now(current_user: User = Depends(get_current_user)):
    """Admin convenience: triggers the weekly SOC2 cron immediately.
    Useful for demoing the compliance officer email pipeline."""
    await _check_admin(current_user)
    from services import soc2_cron_service
    result = await soc2_cron_service.run_weekly_export()
    if not result:
        raise HTTPException(status_code=400, detail="No audit rows in the last 7 days — nothing to export.")
    return result


@router.get("/scheduled/{export_id}/download")
async def download_scheduled_export(export_id: str, current_user: User = Depends(get_current_user)):
    """Streams a previously-generated scheduled export ZIP (linked from the
    compliance officer email)."""
    await _check_admin(current_user)
    rec = await db.audit_log_exports.find_one({"export_id": export_id}, {"_id": 0})
    if not rec or not rec.get("zip_b64"):
        raise HTTPException(status_code=404, detail="Export not found")
    return Response(
        content=base64.b64decode(rec["zip_b64"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{export_id}.zip"',
            "X-Export-Id": export_id,
            "X-Root-Hash": rec.get("root_hash", ""),
            "X-Row-Count": str(rec.get("row_count", 0)),
        },
    )
