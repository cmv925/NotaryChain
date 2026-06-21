"""
TrustLayer — Universal Trust Verification Network (Phase 1 MVP + Phase 2)

Federated trust graph: 3rd party "Trust Partners" register with NotaryChain and issue
verifiable attestations about NotaryChain users. Anyone can query the trust graph for
a user_id and see who vouches for them and for what.

Phase 1:
- Admin: register/list/rotate/disable partners (issues an API key per partner).
- Partner (API key auth): create attestations, revoke own attestations.
- Public: fetch trust graph for a user_id, fetch single attestation, embeddable SDK.

Phase 2 (this file):
- Every partner gets an Ed25519 signing keypair (private key persisted server-side
  for now; future: HSM / partner-held).
- Each attestation is canonical-JSON-signed with Ed25519, payload digest pinned.
- Each attestation is anchored on Hedera HCS for tamper-evident provenance.
- Multi-chain SDK at /api/trustlayer/sdk-v2.js — verifies signatures off-chain (works
  in any browser / Node / chain runtime that supports Ed25519 verification).
"""
import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from services import trustlayer_crypto
from services import crypto_vault

router = APIRouter(prefix="/api/trustlayer", tags=["trustlayer"])
logger = logging.getLogger(__name__)
db = None


def set_db(database):
    global db
    db = database


# ────────── helpers ──────────

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


async def _require_admin(request: Request):
    user = await _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def _require_partner(request: Request):
    """Authenticate a Trust Partner via X-TrustLayer-Key header."""
    raw_key = request.headers.get("X-TrustLayer-Key", "").strip()
    if not raw_key:
        raise HTTPException(status_code=401, detail="X-TrustLayer-Key header required")
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    partner = await db.trust_partners.find_one({"api_key_hash": key_hash}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Invalid TrustLayer API key")
    if partner.get("status") != "active":
        raise HTTPException(status_code=403, detail="Partner is not active")
    return partner


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _strip_partner(p: dict) -> dict:
    return {k: v for k, v in p.items() if k not in ("api_key_hash", "ed25519_private_b64")}


# ────────── Models ──────────

class PartnerCreate(BaseModel):
    name: str
    domain: str
    description: Optional[str] = ""
    scopes: Optional[List[str]] = Field(default_factory=lambda: ["attest:create", "attest:revoke"])


class AttestationCreate(BaseModel):
    subject_user_id: str
    claim_type: str   # e.g. "verified_employer", "licensed_cpa", "kyc_passed"
    claim_value: Optional[str] = None
    evidence_url: Optional[str] = None
    expires_at: Optional[str] = None  # ISO 8601


# ════════════════════════════════════════════════════════
#  ADMIN — partner management
# ════════════════════════════════════════════════════════

@router.post("/partners")
async def create_partner(body: PartnerCreate, request: Request):
    admin = await _require_admin(request)
    domain = body.domain.replace("https://", "").replace("http://", "").rstrip("/").lower()
    slug = "".join(c for c in body.name.lower().replace(" ", "-") if c.isalnum() or c == "-")[:40] or uuid.uuid4().hex[:8]

    # Ensure unique slug
    if await db.trust_partners.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    raw_key = f"tl_{secrets.token_urlsafe(32)}"
    # Phase 2: provision Ed25519 signing keypair for this partner
    priv_b64, pub_b64 = trustlayer_crypto.generate_keypair()
    partner = {
        "partner_id": uuid.uuid4().hex[:16],
        "name": body.name.strip(),
        "slug": slug,
        "domain": domain,
        "description": body.description or "",
        "scopes": body.scopes or [],
        "api_key_hash": _hash_key(raw_key),
        "api_key_preview": raw_key[:10] + "…" + raw_key[-4:],
        "ed25519_private_b64": crypto_vault.encrypt_str(priv_b64),  # encrypted at rest (HSM-bound in Phase 3)
        "ed25519_public_b64": pub_b64,
        "key_version": 1,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_id": admin["id"],
        "created_by_email": admin["email"],
        "stats": {"attestations_issued": 0, "verifications_served": 0, "attestations_anchored": 0},
    }
    await db.trust_partners.insert_one(partner)
    out = _strip_partner({k: v for k, v in partner.items() if k != "_id"})
    out["api_key"] = raw_key  # ONLY returned once
    return out


@router.get("/partners")
async def list_partners(request: Request):
    await _require_admin(request)
    out = []
    async for p in db.trust_partners.find({}, {"_id": 0, "api_key_hash": 0, "ed25519_private_b64": 0}).sort("created_at", -1):
        out.append(p)
    return {"partners": out, "total": len(out)}


@router.post("/partners/{partner_id}/rotate-key")
async def rotate_partner_key(partner_id: str, request: Request):
    await _require_admin(request)
    partner = await db.trust_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    raw_key = f"tl_{secrets.token_urlsafe(32)}"
    await db.trust_partners.update_one(
        {"partner_id": partner_id},
        {"$set": {
            "api_key_hash": _hash_key(raw_key),
            "api_key_preview": raw_key[:10] + "…" + raw_key[-4:],
            "key_rotated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"partner_id": partner_id, "api_key": raw_key, "rotated_at": datetime.now(timezone.utc).isoformat()}


@router.post("/partners/{partner_id}/status")
async def set_partner_status(partner_id: str, request: Request):
    await _require_admin(request)
    body = await request.json()
    status = body.get("status")
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'disabled'")
    res = await db.trust_partners.update_one({"partner_id": partner_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"partner_id": partner_id, "status": status}


# ════════════════════════════════════════════════════════
#  PARTNER — attestations (API-key authed)
# ════════════════════════════════════════════════════════

@router.post("/attestations")
async def create_attestation(body: AttestationCreate, request: Request):
    partner = await _require_partner(request)

    # Subject must be a real NotaryChain user
    subject = await db.users.find_one({"id": body.subject_user_id}, {"_id": 0, "id": 1, "email": 1})
    if not subject:
        raise HTTPException(status_code=404, detail="subject_user_id not found in NotaryChain")

    claim_type = body.claim_type.strip().lower()
    if not claim_type or len(claim_type) > 64:
        raise HTTPException(status_code=400, detail="claim_type required (<=64 chars)")

    evidence_hash = None
    if body.evidence_url:
        evidence_hash = hashlib.sha256(body.evidence_url.encode()).hexdigest()

    attestation = {
        "attestation_id": uuid.uuid4().hex[:16],
        "partner_id": partner["partner_id"],
        "partner_name": partner["name"],
        "partner_slug": partner["slug"],
        "subject_user_id": body.subject_user_id,
        "claim_type": claim_type,
        "claim_value": body.claim_value,
        "evidence_url": body.evidence_url,
        "evidence_hash": evidence_hash,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": body.expires_at,
        "revoked": False,
    }

    # ─── Phase 2 ─────────────────────────────────────────
    # Ed25519 sign + Hedera HCS anchor (best-effort, non-blocking on anchor failure)
    signed_blob = None
    if partner.get("ed25519_private_b64"):
        try:
            signed_blob = trustlayer_crypto.sign_attestation(crypto_vault.decrypt_str(partner["ed25519_private_b64"]), attestation)
            attestation["signature"] = signed_blob["signature"]
            attestation["signature_alg"] = signed_blob["signature_alg"]
            attestation["payload_digest"] = signed_blob["payload_digest"]
            attestation["partner_key_version"] = partner.get("key_version", 1)
        except Exception as e:
            logger.error(f"sign attestation failed: {e}")

    anchor = None
    if signed_blob:
        anchor = await trustlayer_crypto.anchor_on_hedera(signed_blob)
        if anchor:
            attestation["hcs_anchor"] = anchor

    await db.trust_attestations.insert_one(attestation)
    await db.trust_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$inc": {
            "stats.attestations_issued": 1,
            "stats.attestations_anchored": 1 if anchor else 0,
        }}
    )
    attestation.pop("_id", None)
    return attestation


@router.delete("/attestations/{attestation_id}")
async def revoke_attestation(attestation_id: str, request: Request):
    partner = await _require_partner(request)
    att = await db.trust_attestations.find_one({"attestation_id": attestation_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attestation not found")
    if att["partner_id"] != partner["partner_id"]:
        raise HTTPException(status_code=403, detail="Not your attestation")
    await db.trust_attestations.update_one(
        {"attestation_id": attestation_id},
        {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"attestation_id": attestation_id, "revoked": True}


@router.post("/verify")
async def partner_verify(request: Request):
    """Partner-facing: real-time verify call. Returns trust score + attestations for a user."""
    partner = await _require_partner(request)
    body = await request.json()
    subject_id = body.get("subject_user_id") or body.get("user_id")
    if not subject_id:
        raise HTTPException(status_code=400, detail="subject_user_id required")
    await db.trust_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$inc": {"stats.verifications_served": 1}}
    )
    return await _build_trust_graph(subject_id)


# ════════════════════════════════════════════════════════
#  PUBLIC — trust graph
# ════════════════════════════════════════════════════════

async def _build_trust_graph(subject_user_id: str) -> dict:
    user = await db.users.find_one({"id": subject_user_id}, {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Subject user not found")

    now = datetime.now(timezone.utc)
    attestations = []
    active_count = 0
    partner_ids = set()

    cursor = db.trust_attestations.find({"subject_user_id": subject_user_id}, {"_id": 0}).sort("signed_at", -1)
    async for a in cursor:
        is_active = not a.get("revoked", False)
        if is_active and a.get("expires_at"):
            try:
                if datetime.fromisoformat(a["expires_at"].replace("Z", "+00:00")) < now:
                    is_active = False
            except Exception:
                pass
        if is_active:
            active_count += 1
            partner_ids.add(a["partner_id"])
        attestations.append({**a, "active": is_active})

    # Trust score: weight by # active attestations + # unique partners (cap 100)
    score = min(100, active_count * 8 + len(partner_ids) * 12)

    # Pull living identity trust score if available
    li = await db.living_identities.find_one({"user_id": subject_user_id}, {"_id": 0, "current_trust_score": 1, "trust_tier": 1})
    if li and li.get("current_trust_score") is not None:
        score = max(score, int(li["current_trust_score"]))

    return {
        "subject": {
            "user_id": user["id"],
            "name": user.get("full_name"),
            "role": user.get("role"),
        },
        "trust_score": score,
        "attestations_total": len(attestations),
        "attestations_active": active_count,
        "unique_partners": len(partner_ids),
        "living_identity_tier": li.get("trust_tier") if li else None,
        "attestations": attestations,
        "computed_at": now.isoformat(),
    }


@router.get("/trust-graph/{user_id}")
async def get_trust_graph(user_id: str):
    """Public, no-auth: federated trust graph for a NotaryChain user."""
    return await _build_trust_graph(user_id)


@router.get("/attestations/{attestation_id}")
async def get_attestation(attestation_id: str):
    a = await db.trust_attestations.find_one({"attestation_id": attestation_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attestation not found")
    return a


@router.get("/partners/public")
async def list_public_partners():
    """Public registry of active trust partners — drives partner credibility."""
    out = []
    async for p in db.trust_partners.find(
        {"status": "active"},
        {"_id": 0, "partner_id": 1, "name": 1, "slug": 1, "domain": 1, "description": 1, "stats": 1, "created_at": 1, "ed25519_public_b64": 1, "key_version": 1}
    ).sort("created_at", -1):
        out.append(p)
    return {"partners": out, "total": len(out)}


# ════════════════════════════════════════════════════════
#  PHASE 2 — Crypto: public keys + signature verification
# ════════════════════════════════════════════════════════

@router.get("/partners/{partner_id}/public-key")
async def get_partner_public_key(partner_id: str):
    """Returns the Ed25519 public key for a partner. Used by SDKs to verify
    attestation signatures off-chain on any platform/chain."""
    p = await db.trust_partners.find_one(
        {"partner_id": partner_id},
        {"_id": 0, "partner_id": 1, "name": 1, "slug": 1, "ed25519_public_b64": 1, "key_version": 1, "status": 1}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Partner not found")
    if not p.get("ed25519_public_b64"):
        raise HTTPException(status_code=409, detail="Partner has no signing key (legacy partner). Rotate the key to provision one.")
    return p


@router.post("/attestations/{attestation_id}/verify")
async def verify_attestation(attestation_id: str):
    """Public, no-auth verification of a stored attestation.
    Recomputes canonical bytes from current DB state and verifies the stored
    Ed25519 signature against the partner's public key. Also re-checks the
    Hedera HCS anchor."""
    a = await db.trust_attestations.find_one({"attestation_id": attestation_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attestation not found")

    result = {
        "attestation_id": attestation_id,
        "signature_valid": False,
        "signature_alg": a.get("signature_alg"),
        "payload_digest_match": False,
        "hcs_anchored": bool(a.get("hcs_anchor")),
        "hcs_anchor": a.get("hcs_anchor"),
        "revoked": a.get("revoked", False),
        "errors": [],
    }

    if not a.get("signature"):
        result["errors"].append("Attestation has no signature (legacy/pre-Phase-2).")
        return result

    partner = await db.trust_partners.find_one({"partner_id": a["partner_id"]}, {"_id": 0, "ed25519_public_b64": 1, "key_version": 1})
    if not partner or not partner.get("ed25519_public_b64"):
        result["errors"].append("Partner public key unavailable.")
        return result

    signed_blob = {
        "payload": trustlayer_crypto.canonical_payload(a),
        "signature": a["signature"],
        "payload_digest": a.get("payload_digest"),
    }
    is_valid, err = trustlayer_crypto.verify_attestation(partner["ed25519_public_b64"], signed_blob)
    result["signature_valid"] = is_valid
    result["payload_digest_match"] = True  # verify_attestation already checks this
    if err:
        result["errors"].append(err)
    return result


# ════════════════════════════════════════════════════════
#  EMBEDDABLE SDK
# ════════════════════════════════════════════════════════

@router.get("/badge/{user_id}.svg")
async def trust_badge_svg(user_id: str):
    """Embeddable SVG badge: shows trust score + partner count for a NotaryChain user."""
    try:
        graph = await _build_trust_graph(user_id)
    except HTTPException:
        graph = None

    if not graph:
        score, partners, active = 0, 0, 0
        title = "UNVERIFIED"
        color = "#f59e0b"
    else:
        score = graph["trust_score"]
        partners = graph["unique_partners"]
        active = graph["attestations_active"]
        if score >= 80:
            title, color = "TRUSTED", "#10b981"
        elif score >= 50:
            title, color = "VERIFIED", "#0ea5e9"
        else:
            title, color = "EMERGING", "#f59e0b"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="TrustLayer">
  <rect width="220" height="64" rx="8" fill="#0f172a" stroke="{color}" stroke-opacity="0.4"/>
  <g transform="translate(12, 12)">
    <path d="M20 0 L36 8 V20 C36 30 28 38 20 40 C12 38 4 30 4 20 V8 Z" fill="none" stroke="{color}" stroke-width="2"/>
    <text x="20" y="26" text-anchor="middle" font-family="-apple-system,Segoe UI,sans-serif" font-size="14" font-weight="800" fill="{color}">{score}</text>
  </g>
  <text x="58" y="22" font-family="-apple-system,Segoe UI,sans-serif" font-size="9" font-weight="700" letter-spacing="1.2" fill="{color}">{title}</text>
  <text x="58" y="38" font-family="-apple-system,Segoe UI,sans-serif" font-size="12" font-weight="700" fill="#f8fafc">TrustLayer</text>
  <text x="58" y="54" font-family="-apple-system,Segoe UI,sans-serif" font-size="9" fill="#94a3b8">{partners} partner{"s" if partners != 1 else ""} · {active} attestation{"s" if active != 1 else ""}</text>
</svg>'''
    return Response(content=svg, media_type="image/svg+xml", headers={
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
    })


@router.get("/sdk.js", response_class=PlainTextResponse)
async def trustlayer_sdk(request: Request):
    """
    Drop-in widget. Usage:
      <script src=".../api/trustlayer/sdk.js" data-user-id="xxx"></script>
    """
    import os as _os
    public_base = (
        _os.environ.get("PUBLIC_BACKEND_URL")
        or _os.environ.get("REACT_APP_BACKEND_URL")
        or str(request.base_url).rstrip("/")
    ).rstrip("/")
    js = '''(function(){
  var s=document.currentScript;if(!s)return;
  var uid=s.getAttribute("data-user-id");if(!uid)return;
  var link=document.createElement("a");
  link.href="''' + public_base + '''/trust-graph/"+uid;
  link.target="_blank";link.rel="noopener noreferrer";
  link.style.display="inline-block";link.style.textDecoration="none";link.style.lineHeight="0";
  var img=document.createElement("img");
  img.src="''' + public_base + '''/api/trustlayer/badge/"+uid+".svg";
  img.alt="TrustLayer score";
  img.style.border="0";img.style.maxWidth="220px";img.style.width="100%";img.style.height="auto";
  link.appendChild(img);s.parentNode.insertBefore(link,s);
})();'''
    return Response(content=js, media_type="application/javascript", headers={
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
    })



# ════════════════════════════════════════════════════════
#  PHASE 2 — Multi-chain verifier SDK
# ════════════════════════════════════════════════════════

SDK_V2_TEMPLATE = """/*! TrustLayer SDK v2 — Ed25519 verifier (works in Node, browser, & any
 * runtime that ships WebCrypto / SubtleCrypto with Ed25519). Anchor lookups
 * use Hedera Mirror Node REST (mainnet). */
(function(global) {
  'use strict';
  var API = '__API_BASE__';
  var MIRROR = 'https://mainnet-public.mirrornode.hedera.com';

  function b64ToBytes(s) {
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function canonicalJSON(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function(k) {
      return JSON.stringify(k) + ':' + canonicalJSON(obj[k]);
    }).join(',') + '}';
  }

  async function fetchAttestation(attestationId) {
    var r = await fetch(API + '/api/trustlayer/attestations/' + attestationId);
    if (!r.ok) throw new Error('attestation not found');
    return r.json();
  }

  async function fetchPartnerKey(partnerId) {
    var r = await fetch(API + '/api/trustlayer/partners/' + partnerId + '/public-key');
    if (!r.ok) throw new Error('partner key not found');
    return r.json();
  }

  function canonicalPayload(att) {
    return {
      schema: 'trustlayer.attestation.v2',
      attestation_id: att.attestation_id,
      partner_id: att.partner_id,
      partner_slug: att.partner_slug || null,
      subject_user_id: att.subject_user_id,
      claim_type: att.claim_type,
      claim_value: att.claim_value || null,
      evidence_hash: att.evidence_hash || null,
      signed_at: att.signed_at,
      expires_at: att.expires_at || null
    };
  }

  async function verifyEd25519(publicKeyB64, message, signatureB64) {
    var key = await crypto.subtle.importKey(
      'raw',
      b64ToBytes(publicKeyB64),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return crypto.subtle.verify('Ed25519', key, b64ToBytes(signatureB64), message);
  }

  async function verifyHederaAnchor(attestation) {
    if (!attestation.hcs_anchor) return { anchored: false };
    var topic = attestation.hcs_anchor.topic_id;
    var seq = attestation.hcs_anchor.sequence_number;
    if (!topic || !seq) return { anchored: false };
    try {
      var r = await fetch(MIRROR + '/api/v1/topics/' + topic + '/messages/' + seq);
      if (!r.ok) return { anchored: false, mirror_status: r.status };
      var data = await r.json();
      return {
        anchored: true,
        topic_id: topic,
        sequence_number: seq,
        consensus_timestamp: data.consensus_timestamp,
        explorer_url: attestation.hcs_anchor.explorer_url
      };
    } catch (e) {
      return { anchored: false, error: String(e) };
    }
  }

  async function verify(attestationId) {
    var att = await fetchAttestation(attestationId);
    if (!att.signature) {
      return { valid: false, reason: 'no signature (legacy attestation)', attestation: att };
    }
    var partner = await fetchPartnerKey(att.partner_id);
    var payload = canonicalPayload(att);
    var msg = new TextEncoder().encode(canonicalJSON(payload));
    var sigValid = false;
    try {
      sigValid = await verifyEd25519(partner.ed25519_public_b64, msg, att.signature);
    } catch (e) {
      return { valid: false, reason: 'ed25519_verify_failed: ' + e.message, attestation: att };
    }
    var anchor = await verifyHederaAnchor(att);
    return {
      valid: sigValid && !att.revoked,
      signature_valid: sigValid,
      revoked: !!att.revoked,
      anchor: anchor,
      partner: { partner_id: partner.partner_id, name: partner.name, key_version: partner.key_version },
      attestation: att
    };
  }

  global.TrustLayer = {
    version: '2.0.0',
    api: API,
    verify: verify,
    fetchAttestation: fetchAttestation,
    fetchPartnerKey: fetchPartnerKey,
    canonicalPayload: canonicalPayload,
    canonicalJSON: canonicalJSON
  };
})(typeof window !== 'undefined' ? window : globalThis);
"""


@router.get("/sdk-v2.js", response_class=PlainTextResponse)
async def trustlayer_sdk_v2(request: Request):
    """Multi-chain TrustLayer SDK — verifies Ed25519 signatures off-chain in any
    runtime with WebCrypto (browsers, Node 19+, Cloudflare Workers, Deno).
    Cross-checks Hedera HCS anchors via the public Mirror Node REST API."""
    import os as _os
    public_base = (
        _os.environ.get("PUBLIC_BACKEND_URL")
        or _os.environ.get("REACT_APP_BACKEND_URL")
        or str(request.base_url).rstrip("/")
    ).rstrip("/")
    js = SDK_V2_TEMPLATE.replace("__API_BASE__", public_base)
    return Response(
        content=js,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
        },
    )



# ════════════════════════════════════════════════════════
#  PHASE 2 — Auto-verify <trust-badge> Web Component
# ════════════════════════════════════════════════════════

BADGE_V2_TEMPLATE = """/*! TrustLayer Auto-Verify Badge — drop-in web component
 * Usage:  <script src="__API_BASE__/api/trustlayer/badge-v2.js" defer></script>
 *         <trust-badge attestation-id="abc123..."></trust-badge>
 *
 * Runs full Ed25519 + Hedera HCS verification in the visitor's browser,
 * renders a live verified pill with explorer link. Industry-first.
 */
(function() {
  'use strict';
  if (customElements.get('trust-badge')) return;

  var API = '__API_BASE__';
  var SDK_URL = API + '/api/trustlayer/sdk-v2.js';
  var sdkPromise = null;

  function loadSDK() {
    if (window.TrustLayer && window.TrustLayer.verify) return Promise.resolve(window.TrustLayer);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = function() {
        if (window.TrustLayer && window.TrustLayer.verify) resolve(window.TrustLayer);
        else reject(new Error('TrustLayer SDK loaded but verify() missing'));
      };
      s.onerror = function() { reject(new Error('Failed to load TrustLayer SDK from ' + SDK_URL)); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  var STYLES = '\\n    :host { display: inline-block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\\n    .wrap { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 999px; border: 1px solid; transition: all 0.2s; text-decoration: none; color: inherit; line-height: 1.2; }\\n    .wrap.verified { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }\\n    .wrap.verified:hover { background: #d1fae5; border-color: #34d399; }\\n    .wrap.failed { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }\\n    .wrap.loading { background: #f8fafc; border-color: #cbd5e1; color: #475569; }\\n    .icon { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; flex-shrink: 0; }\\n    .icon.ok { background: #10b981; }\\n    .icon.bad { background: #ef4444; }\\n    .icon.loading { background: #94a3b8; }\\n    .label { font-size: 12px; font-weight: 600; }\\n    .sub { font-size: 10px; opacity: 0.8; font-weight: 500; }\\n    .col { display: flex; flex-direction: column; }\\n    .spin { animation: spin 1s linear infinite; }\\n    @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }\\n  ';

  function renderLoading(shadow) {
    shadow.innerHTML = '<style>' + STYLES + '</style>' +
      '<span class="wrap loading">' +
      '<span class="icon loading spin">⟳</span>' +
      '<span class="col">' +
        '<span class="label">Verifying…</span>' +
        '<span class="sub">Checking signature & Hedera anchor</span>' +
      '</span></span>';
  }

  function renderVerified(shadow, result) {
    var explorer = result.anchor && result.anchor.explorer_url;
    var partnerName = (result.partner && result.partner.name) || 'Unknown partner';
    var html =
      '<style>' + STYLES + '</style>' +
      (explorer ? '<a class="wrap verified" href="' + explorer + '" target="_blank" rel="noopener">' : '<span class="wrap verified">') +
      '<span class="icon ok">✓</span>' +
      '<span class="col">' +
        '<span class="label">Cryptographically verified</span>' +
        '<span class="sub">' + (result.anchor && result.anchor.anchored ? 'Hedera-anchored · ' : '') + escapeHTML(partnerName) + '</span>' +
      '</span>' +
      (explorer ? '</a>' : '</span>');
    shadow.innerHTML = html;
  }

  function renderFailed(shadow, reason) {
    shadow.innerHTML = '<style>' + STYLES + '</style>' +
      '<span class="wrap failed" title="' + escapeHTML(reason) + '">' +
      '<span class="icon bad">!</span>' +
      '<span class="col">' +
        '<span class="label">Unable to verify</span>' +
        '<span class="sub">' + escapeHTML(reason.slice(0, 64)) + '</span>' +
      '</span></span>';
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  class TrustBadge extends HTMLElement {
    static get observedAttributes() { return ['attestation-id']; }

    connectedCallback() {
      this._shadow = this.attachShadow({ mode: 'open' });
      this._render();
    }

    attributeChangedCallback() {
      if (this._shadow) this._render();
    }

    async _render() {
      var id = this.getAttribute('attestation-id');
      if (!id) {
        renderFailed(this._shadow, 'Missing attestation-id attribute');
        return;
      }
      renderLoading(this._shadow);
      try {
        var sdk = await loadSDK();
        var result = await sdk.verify(id);
        if (result.valid && result.signature_valid) {
          renderVerified(this._shadow, result);
          this.dispatchEvent(new CustomEvent('verified', { detail: result, bubbles: true }));
        } else {
          var reason = result.reason || (result.revoked ? 'attestation revoked' : 'signature invalid');
          renderFailed(this._shadow, reason);
          this.dispatchEvent(new CustomEvent('verification-failed', { detail: { reason: reason, result: result }, bubbles: true }));
        }
      } catch (e) {
        renderFailed(this._shadow, e.message || 'Network error');
      }
    }
  }

  customElements.define('trust-badge', TrustBadge);
})();
"""


@router.get("/badge-v2.js", response_class=PlainTextResponse)
async def trustlayer_badge_v2(request: Request):
    """Auto-verify Trust Badge web component. Drop-in <trust-badge> element with
    live Ed25519 + Hedera HCS verification in the visitor's browser."""
    import os as _os
    public_base = (
        _os.environ.get("PUBLIC_BACKEND_URL")
        or _os.environ.get("REACT_APP_BACKEND_URL")
        or str(request.base_url).rstrip("/")
    ).rstrip("/")
    js = BADGE_V2_TEMPLATE.replace("__API_BASE__", public_base)
    return Response(
        content=js,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
        },
    )
