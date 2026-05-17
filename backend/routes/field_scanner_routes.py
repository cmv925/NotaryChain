"""
Field Document Scanner routes — mobile-first capture endpoint.

POST /api/scanner/scans          — create a scan from base64 pages, run analysis
GET  /api/scanner/scans          — list scans (auth user)
GET  /api/scanner/scans/{id}     — fetch single scan
POST /api/scanner/scans/{id}/seal — seal the scan on Hedera (if not already)
"""
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/scanner", tags=["field-scanner"])
logger = logging.getLogger(__name__)
db = None


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


# ───────────────── Models ─────────────────

class ScanPage(BaseModel):
    image_base64: str = Field(min_length=10)
    page_number: Optional[int] = None
    capture_meta: Optional[dict] = None  # device, geo, etc.


class ScanCreate(BaseModel):
    document_label: str = Field(min_length=1, max_length=200)
    document_type: Optional[str] = "scan"
    pages: List[ScanPage] = Field(min_length=1, max_length=20)
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    geo_accuracy_m: Optional[float] = None
    note: Optional[str] = None
    run_ai: bool = True


class PublicDemoScan(BaseModel):
    pages: List[ScanPage] = Field(min_length=1, max_length=3)


@router.post("/demo")
async def public_demo_scan(body: PublicDemoScan, request: Request):
    """
    Public, rate-limited demo of the AI forgery scanner.
    • No auth, no Hedera anchoring, no persistent record.
    • Returns: doc_hash, ai_analysis (GPT-5.2 Vision).
    • Limit: 5 demos per IP per UTC day.
    """
    from datetime import datetime, timezone
    from services.field_scanner_service import canonical_document_hash, analyze_pages_for_forgery

    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (request.client.host if request.client else "unknown"))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bucket = f"{ip}:{today}"

    used = await db.scanner_demo_quota.count_documents({"bucket": bucket})
    if used >= 5:
        raise HTTPException(status_code=429, detail=f"Daily demo limit reached (5 per day). Sign up for unlimited scans.")
    await db.scanner_demo_quota.insert_one({"bucket": bucket, "ip": ip, "at": datetime.now(timezone.utc).isoformat()})

    page_b64_list = [p.image_base64 for p in body.pages]
    doc_hash, page_hashes = canonical_document_hash(page_b64_list)
    analysis = await analyze_pages_for_forgery(page_b64_list)

    return {
        "document_hash": doc_hash,
        "page_hashes": page_hashes,
        "page_count": len(body.pages),
        "ai_analysis": analysis,
        "demo_only": True,
        "demos_remaining_today": max(0, 5 - used - 1),
        "upsell": {
            "anchor_on_hedera": False,
            "persistent_record": False,
            "message": "Demo verdict is not persisted or anchored. Sign up to seal your scan on Hedera mainnet and keep a permanent record.",
        },
    }


@router.post("/scans")
async def create_scan(body: ScanCreate, request: Request):
    user = await _get_user(request)
    from services.field_scanner_service import (
        canonical_document_hash, analyze_pages_for_forgery, check_existing_seal, now_iso,
    )

    page_b64_list = [p.image_base64 for p in body.pages]
    doc_hash, page_hashes = canonical_document_hash(page_b64_list)

    prior = await check_existing_seal(db, doc_hash)

    analysis = None
    if body.run_ai:
        analysis = await analyze_pages_for_forgery(page_b64_list)

    scan = {
        "scan_id": uuid.uuid4().hex[:16],
        "user_id": user["id"],
        "user_email": user["email"],
        "document_label": body.document_label,
        "document_type": body.document_type or "scan",
        "page_count": len(body.pages),
        "page_hashes": page_hashes,
        "document_hash": doc_hash,
        "geo": {
            "lat": body.geo_lat, "lng": body.geo_lng, "accuracy_m": body.geo_accuracy_m,
        } if body.geo_lat is not None else None,
        "note": body.note,
        "ai_analysis": analysis,
        "prior_seal": prior,
        "sealed": False,
        "seal": None,
        "created_at": now_iso(),
    }
    await db.field_scans.insert_one(scan)
    scan.pop("_id", None)

    # Don't echo the source images back — caller already has them and they're heavy
    return {
        **{k: v for k, v in scan.items() if k != "page_hashes"},
        "page_hashes": page_hashes,
    }


@router.get("/scans")
async def list_scans(request: Request, limit: int = 25, skip: int = 0):
    user = await _get_user(request)
    q = {} if user.get("role") == "admin" else {"user_id": user["id"]}
    total = await db.field_scans.count_documents(q)
    out = []
    async for s in db.field_scans.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit):
        out.append(s)
    return {"total": total, "scans": out, "limit": limit, "skip": skip}


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str, request: Request):
    user = await _get_user(request)
    s = await db.field_scans.find_one({"scan_id": scan_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Scan not found")
    if s["user_id"] != user["id"] and user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return s


@router.post("/scans/{scan_id}/seal")
async def seal_scan(scan_id: str, request: Request):
    """Anchor the document hash on Hedera HCS (or no-op if already sealed)."""
    user = await _get_user(request)
    s = await db.field_scans.find_one({"scan_id": scan_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Scan not found")
    if s["user_id"] != user["id"] and user.get("role") not in ("admin", "notary"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if s.get("sealed") and s.get("seal"):
        return {"already_sealed": True, "seal": s["seal"]}

    try:
        from services.hedera_service import hedera_service
        seal_result = await hedera_service.seal_document(
            document_hash=s["document_hash"],
            document_name=s["document_label"],
            user_id=user["id"],
            metadata={"source": "field_scanner", "page_count": s["page_count"],
                      "ai_risk": (s.get("ai_analysis") or {}).get("overall_risk")},
        )
    except Exception as e:
        logger.warning(f"Scanner seal call failed: {e}")
        raise HTTPException(status_code=502, detail=f"Hedera sealing failed: {str(e)[:200]}")

    if not seal_result.get("success"):
        raise HTTPException(status_code=502, detail="Hedera sealing returned non-success")

    seal_payload = {
        "topic_id": seal_result.get("topic_id"),
        "sequence_number": seal_result.get("sequence_number"),
        "transaction_id": seal_result.get("transaction_id"),
        "message_hash": seal_result.get("verification_hash", s["document_hash"]),
        "explorer_url": seal_result.get("explorer_url", ""),
        "sealed_at": seal_result.get("sealed_at"),
        "network": seal_result.get("network", "Hedera Mainnet"),
    }
    await db.field_scans.update_one(
        {"scan_id": scan_id},
        {"$set": {"sealed": True, "seal": seal_payload}},
    )
    return {"already_sealed": False, "seal": seal_payload}
