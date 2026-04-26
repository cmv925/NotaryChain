"""
NotaryChain Verify — Public Document Integrity Wallet & Trust Badge System

Public, no-auth endpoints for:
- Document hash verification (drop a PDF, see if it's notarized)
- Certificate ID lookup (active/expired/revoked status)
- Notary public profile lookup (bond, license, sealing history)
- Trust Badge embeddable widget for businesses (revenue stream — $29/mo Pro)
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Response
from fastapi.responses import PlainTextResponse

router = APIRouter(prefix="/api/verify", tags=["verify"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ────────── helpers ──────────

async def _get_user(request: Request):
    """Extract user from Bearer token."""
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


# ════════════════════════════════════════════════════════
#  PUBLIC VERIFICATION (no auth required)
# ════════════════════════════════════════════════════════

@router.post("/document")
async def verify_document_upload(file: UploadFile = File(...)):
    """Upload a document, hash it, and check if it's notarized on NotaryChain."""
    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    document_hash = hashlib.sha256(contents).hexdigest()

    seal = await db.blockchain_seals.find_one({"document_hash": document_hash}, {"_id": 0})
    if not seal:
        return {
            "verified": False,
            "document_hash": document_hash,
            "filename": file.filename,
            "size": len(contents),
            "message": "Document not found in NotaryChain registry",
        }
    return _seal_response(document_hash, seal, filename=file.filename, size=len(contents))


@router.get("/document/{document_hash}")
async def verify_document_by_hash(document_hash: str):
    """Verify a document by its SHA256 hash."""
    if len(document_hash) != 64:
        raise HTTPException(status_code=400, detail="Invalid SHA256 hash (must be 64 hex chars)")
    seal = await db.blockchain_seals.find_one({"document_hash": document_hash}, {"_id": 0})
    if not seal:
        return {"verified": False, "document_hash": document_hash, "message": "Document not found"}
    return _seal_response(document_hash, seal)


def _seal_response(document_hash: str, seal: dict, filename: Optional[str] = None, size: Optional[int] = None) -> dict:
    return {
        "verified": True,
        "document_hash": document_hash,
        "sha256": document_hash,
        "filename": filename,
        "size_bytes": size,
        "document_name": seal.get("document_name"),
        "sealed_at": seal.get("sealed_at"),
        "transaction_id": seal.get("transaction_id"),
        "explorer_url": seal.get("explorer_url"),
        "network": seal.get("network"),
        "topic_id": seal.get("topic_id"),
        "sealed_by": seal.get("sealed_by_email"),
    }


@router.get("/certificate/{cert_id}")
async def verify_certificate(cert_id: str):
    """
    Look up a notarization certificate by ID. Returns status (active/expired/revoked) +
    full lifecycle, or 404.
    """
    # Try multiple known collections — certificates may live in ceremonies, notarizations, expiry, etc.
    cert = (
        await db.ceremonies.find_one({"certificate_id": cert_id}, {"_id": 0}) or
        await db.notarizations.find_one({"certificate_id": cert_id}, {"_id": 0}) or
        await db.ceremonies.find_one({"ceremony_id": cert_id}, {"_id": 0}) or
        await db.notarizations.find_one({"id": cert_id}, {"_id": 0})
    )
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    expiry = await db.certificate_expirations.find_one({"certificate_id": cert_id}, {"_id": 0})
    revocation = await db.certificate_revocations.find_one({"certificate_id": cert_id}, {"_id": 0})

    status = "active"
    expires_at = expiry.get("expires_at") if expiry else None
    if revocation:
        status = "revoked"
    elif expires_at:
        try:
            if datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
                status = "expired"
        except Exception:
            pass

    return {
        "verified": True,
        "certificate_id": cert_id,
        "status": status,
        "issued_at": cert.get("created_at") or cert.get("sealed_at") or cert.get("started_at"),
        "expires_at": expires_at,
        "revoked_at": revocation.get("revoked_at") if revocation else None,
        "revocation_reason": revocation.get("reason") if revocation else None,
        "document_name": cert.get("document_name") or cert.get("document_type"),
        "notary_id": cert.get("notary_id") or cert.get("notarized_by"),
        "blockchain_seal": cert.get("blockchain_seal") or cert.get("hedera_seal"),
    }


@router.get("/notary/{notary_id}")
async def verify_notary_public_profile(notary_id: str):
    """Public profile for a notary — bond, license, sealing history. No PII beyond what's public record."""
    notary = (
        await db.users.find_one({"id": notary_id, "role": {"$in": ["notary", "admin"]}}, {"_id": 0}) or
        await db.users.find_one({"id": notary_id}, {"_id": 0})
    )
    if not notary:
        raise HTTPException(status_code=404, detail="Notary not found")

    bond = await db.notary_bonds.find_one({"notary_id": notary_id}, {"_id": 0})
    sealing_count = await db.blockchain_seals.count_documents({"sealed_by_id": notary_id})
    ceremonies_count = await db.ceremonies.count_documents({"notary_id": notary_id})
    try:
        fraud_flags = await db.fraud_flags.count_documents({"flagged_user_id": notary_id, "resolved": False})
    except Exception:
        fraud_flags = 0

    return {
        "verified": True,
        "notary_id": notary_id,
        "name": notary.get("full_name", "—"),
        "role": notary.get("role"),
        "license_number": notary.get("license_number"),
        "license_state": notary.get("license_state"),
        "license_expiration": notary.get("license_expiration"),
        "bond": {
            "amount_usd": bond.get("amount_usd") if bond else None,
            "status": bond.get("status") if bond else "no_bond",
            "san_bond_id": bond.get("san_bond_id") if bond else None,
            "expires_at": bond.get("expires_at") if bond else None,
        } if bond else None,
        "stats": {
            "total_seals": sealing_count,
            "total_ceremonies": ceremonies_count,
            "active_fraud_flags": fraud_flags,
        },
        "active": notary.get("active", True) and (bond.get("status") == "active" if bond else True),
    }


# ════════════════════════════════════════════════════════
#  TRUST BADGE — embeddable widget (revenue stream)
# ════════════════════════════════════════════════════════

@router.post("/badges")
async def create_trust_badge(request: Request):
    """Create a Trust Badge for a business website. Pro+ subscription required."""
    from middleware.feature_gate import enforce_feature_gate
    await enforce_feature_gate(request, "trust_badge")

    user = await _get_user(request)
    body = await request.json()
    domain = (body.get("domain") or "").strip().lower()
    if not domain:
        raise HTTPException(status_code=400, detail="domain is required")
    domain = domain.replace("https://", "").replace("http://", "").rstrip("/")
    business_name = body.get("business_name") or domain
    style = body.get("style", "default")  # default | dark | light | minimal
    if style not in ("default", "dark", "light", "minimal"):
        style = "default"

    badge = {
        "badge_id": uuid.uuid4().hex[:16],
        "user_id": user["id"],
        "user_email": user["email"],
        "domain": domain,
        "business_name": business_name,
        "style": style,
        "verified": False,         # admin verifies after DNS proof
        "verification_token": uuid.uuid4().hex,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "stats": {"impressions": 0, "verifications": 0},
    }
    await db.trust_badges.insert_one(badge)
    badge.pop("_id", None)
    return badge


@router.get("/badges")
async def list_my_badges(request: Request):
    user = await _get_user(request)
    badges = []
    async for b in db.trust_badges.find({"user_id": user["id"]}, {"_id": 0}):
        badges.append(b)
    return {"badges": badges, "total": len(badges)}


@router.delete("/badges/{badge_id}")
async def delete_badge(badge_id: str, request: Request):
    user = await _get_user(request)
    badge = await db.trust_badges.find_one({"badge_id": badge_id}, {"_id": 0})
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    if badge["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your badge")
    await db.trust_badges.delete_one({"badge_id": badge_id})
    return {"success": True, "badge_id": badge_id}


@router.post("/badges/{badge_id}/verify-domain")
async def verify_badge_domain(badge_id: str, request: Request):
    """Verify domain ownership via DNS TXT record OR /.well-known/notarychain.txt."""
    user = await _get_user(request)
    badge = await db.trust_badges.find_one({"badge_id": badge_id}, {"_id": 0})
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    if badge["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your badge")

    expected = badge["verification_token"]
    domain = badge["domain"]
    verified = False
    method = None

    # Try DNS TXT record first (run sync resolver in thread pool to avoid blocking)
    try:
        import asyncio as _asyncio
        import dns.resolver  # may not be installed, fall through
        def _dns_lookup():
            try:
                answers = dns.resolver.resolve(f"_notarychain.{domain}", "TXT")
                for rdata in answers:
                    txt = "".join([s.decode() if isinstance(s, bytes) else s for s in rdata.strings])
                    if expected in txt:
                        return True
            except Exception:
                return False
            return False
        if await _asyncio.get_event_loop().run_in_executor(None, _dns_lookup):
            verified = True
            method = "dns_txt"
    except ImportError:
        pass

    # Try /.well-known/notarychain.txt
    if not verified:
        import httpx
        for scheme in ("https", "http"):
            try:
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                    resp = await client.get(f"{scheme}://{domain}/.well-known/notarychain.txt")
                if resp.status_code == 200 and expected in resp.text:
                    verified = True
                    method = "well_known"
                    break
            except Exception:
                continue

    if not verified:
        return {
            "verified": False,
            "instructions": {
                "dns_txt": {
                    "host": f"_notarychain.{domain}",
                    "type": "TXT",
                    "value": expected,
                },
                "well_known": {
                    "url": f"https://{domain}/.well-known/notarychain.txt",
                    "content": expected,
                },
            },
            "message": "No proof found yet. Add either record above and try again.",
        }

    await db.trust_badges.update_one(
        {"badge_id": badge_id},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat(), "verification_method": method}}
    )
    return {"verified": True, "method": method}


@router.get("/badge/{badge_id}.svg")
async def render_badge_svg(badge_id: str):
    """Render the embeddable trust badge as SVG. Public, cached, no auth."""
    badge = await db.trust_badges.find_one({"badge_id": badge_id}, {"_id": 0})
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")

    # Track impression
    try:
        await db.trust_badges.update_one(
            {"badge_id": badge_id},
            {"$inc": {"stats.impressions": 1}}
        )
    except Exception:
        pass

    style = badge.get("style", "default")
    verified = badge.get("verified", False)
    business = badge.get("business_name", badge.get("domain", "Verified"))

    palettes = {
        "default": {"bg": "#0f172a", "accent": "#0ea5e9", "text": "#f8fafc", "muted": "#94a3b8"},
        "dark":    {"bg": "#020617", "accent": "#22c55e", "text": "#f1f5f9", "muted": "#64748b"},
        "light":   {"bg": "#f8fafc", "accent": "#0284c7", "text": "#0f172a", "muted": "#475569"},
        "minimal": {"bg": "#ffffff", "accent": "#1e293b", "text": "#0f172a", "muted": "#64748b"},
    }
    p = palettes.get(style, palettes["default"])
    status_text = "VERIFIED" if verified else "PENDING VERIFICATION"
    status_color = p["accent"] if verified else "#f59e0b"
    short_business = (business[:24] + "…") if len(business) > 25 else business

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="68" viewBox="0 0 200 68" role="img" aria-label="Verified by NotaryChain">
  <defs>
    <linearGradient id="g{badge_id[:6]}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{p['bg']}"/>
      <stop offset="100%" stop-color="{p['bg']}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="200" height="68" rx="8" fill="url(#g{badge_id[:6]})" stroke="{p['accent']}" stroke-opacity="0.3"/>
  <g transform="translate(12, 14)">
    <path d="M20 0 L36 8 V20 C36 30 28 38 20 40 C12 38 4 30 4 20 V8 Z" fill="none" stroke="{p['accent']}" stroke-width="2"/>
    <path d="M14 20 L18 24 L26 14" fill="none" stroke="{p['accent']}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="56" y="22" font-family="-apple-system,Segoe UI,sans-serif" font-size="9" font-weight="700" letter-spacing="1.2" fill="{status_color}">{status_text}</text>
  <text x="56" y="40" font-family="-apple-system,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="{p['text']}">NotaryChain</text>
  <text x="56" y="56" font-family="-apple-system,Segoe UI,sans-serif" font-size="9" fill="{p['muted']}">{short_business}</text>
</svg>'''
    return Response(content=svg, media_type="image/svg+xml", headers={
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
    })


@router.get("/badge/{badge_id}.json")
async def badge_metadata(badge_id: str):
    """Public metadata for a badge (used by widget JS)."""
    badge = await db.trust_badges.find_one({"badge_id": badge_id}, {"_id": 0, "verification_token": 0, "user_id": 0, "user_email": 0})
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    return badge


@router.get("/widget.js", response_class=PlainTextResponse)
async def widget_js(request: Request):
    """
    Embeddable widget script. Usage:
      <script src="https://notarychain.app/api/verify/widget.js" data-badge-id="xxx"></script>
    """
    import os as _os
    public_base = (
        _os.environ.get("PUBLIC_BACKEND_URL")
        or _os.environ.get("REACT_APP_BACKEND_URL")
        or str(request.base_url).rstrip("/")
    ).rstrip("/")
    js = '''(function(){
  var s=document.currentScript;if(!s)return;
  var id=s.getAttribute("data-badge-id");if(!id)return;
  var style=s.getAttribute("data-style")||"";
  var link=document.createElement("a");
  link.href="''' + public_base + '''/verify?badge="+id;
  link.target="_blank";link.rel="noopener noreferrer";
  link.style.display="inline-block";link.style.textDecoration="none";link.style.lineHeight="0";
  var img=document.createElement("img");
  img.src="''' + public_base + '''/api/verify/badge/"+id+".svg"+(style?"?style="+style:"");
  img.alt="Verified by NotaryChain";
  img.style.border="0";img.style.maxWidth="200px";img.style.width="100%";img.style.height="auto";
  link.appendChild(img);s.parentNode.insertBefore(link,s);
})();'''
    return Response(content=js, media_type="application/javascript", headers={
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
    })
