"""
TrustLayer Phase 2 cryptography service.

- Ed25519 keypair generation/persistence per partner
- Canonical attestation payload signing (deterministic JSON)
- Hedera HCS anchoring of attestations for tamper-evident provenance
- Multi-chain verification primitives (works against any chain that can verify
  Ed25519 signatures — Hedera, Solana, Aptos, Sui, Stellar, and via precompiles
  on Ethereum mainnet)
"""
import json
import logging
import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey
)
from cryptography.hazmat.primitives.serialization import (
    Encoding, PrivateFormat, PublicFormat, NoEncryption,
)
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger(__name__)

# Schema version embedded in every signed payload — bump when we change canonical form
ATTESTATION_SCHEMA = "trustlayer.attestation.v2"


# ─────────────────────────────────────────────────────────────────────────────
# Keypair management
# ─────────────────────────────────────────────────────────────────────────────

def generate_keypair() -> tuple[str, str]:
    """Generate a new Ed25519 keypair. Returns (private_key_b64, public_key_b64)."""
    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    priv_bytes = priv.private_bytes(
        encoding=Encoding.Raw,
        format=PrivateFormat.Raw,
        encryption_algorithm=NoEncryption(),
    )
    pub_bytes = pub.public_bytes(
        encoding=Encoding.Raw,
        format=PublicFormat.Raw,
    )
    return base64.b64encode(priv_bytes).decode(), base64.b64encode(pub_bytes).decode()


def load_private_key(priv_b64: str) -> Ed25519PrivateKey:
    return Ed25519PrivateKey.from_private_bytes(base64.b64decode(priv_b64))


def load_public_key(pub_b64: str) -> Ed25519PublicKey:
    return Ed25519PublicKey.from_public_bytes(base64.b64decode(pub_b64))


# ─────────────────────────────────────────────────────────────────────────────
# Canonical attestation payload (deterministic encoding)
# ─────────────────────────────────────────────────────────────────────────────

def canonical_payload(att: dict) -> dict:
    """Return the fields-to-sign payload. ORDER + KEYS matter — never reorder
    after deployment; only append new fields with a schema bump."""
    return {
        "schema": ATTESTATION_SCHEMA,
        "attestation_id": att["attestation_id"],
        "partner_id": att["partner_id"],
        "partner_slug": att.get("partner_slug"),
        "subject_user_id": att["subject_user_id"],
        "claim_type": att["claim_type"],
        "claim_value": att.get("claim_value"),
        "evidence_hash": att.get("evidence_hash"),
        "signed_at": att["signed_at"],
        "expires_at": att.get("expires_at"),
    }


def canonical_bytes(payload: dict) -> bytes:
    """Sort keys + tight separators — same input → same bytes everywhere."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def payload_digest(payload: dict) -> str:
    """SHA-256 of canonical bytes (for HCS anchor + chain references)."""
    return hashlib.sha256(canonical_bytes(payload)).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Signing & verification
# ─────────────────────────────────────────────────────────────────────────────

def sign_attestation(priv_b64: str, attestation: dict) -> dict:
    """Sign an attestation. Returns a dict with payload + signature + digest."""
    payload = canonical_payload(attestation)
    msg = canonical_bytes(payload)
    priv = load_private_key(priv_b64)
    sig = priv.sign(msg)
    return {
        "schema": ATTESTATION_SCHEMA,
        "payload": payload,
        "payload_digest": hashlib.sha256(msg).hexdigest(),
        "signature": base64.b64encode(sig).decode(),
        "signature_alg": "Ed25519",
        "signed_at_unix": int(datetime.now(timezone.utc).timestamp()),
    }


def verify_attestation(public_key_b64: str, signed_blob: dict) -> tuple[bool, Optional[str]]:
    """Verify a signed attestation. Returns (is_valid, error_message)."""
    try:
        payload = signed_blob.get("payload")
        sig_b64 = signed_blob.get("signature")
        if not payload or not sig_b64:
            return False, "missing payload or signature"
        # Recompute digest from canonical bytes — refuse to trust signed digest
        msg = canonical_bytes(payload)
        computed_digest = hashlib.sha256(msg).hexdigest()
        if signed_blob.get("payload_digest") and signed_blob["payload_digest"] != computed_digest:
            return False, "payload_digest mismatch (data tampered)"
        pub = load_public_key(public_key_b64)
        pub.verify(base64.b64decode(sig_b64), msg)
        return True, None
    except InvalidSignature:
        return False, "invalid signature"
    except Exception as e:
        return False, f"verification error: {type(e).__name__}: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# Hedera HCS anchor
# ─────────────────────────────────────────────────────────────────────────────

async def anchor_on_hedera(signed_blob: dict) -> Optional[dict]:
    """Submit signed attestation to Hedera HCS. Returns
    {topic_id, sequence_number, tx_id, explorer_url} or None on failure.
    Anchors only the digest + signature (not full payload) to keep HCS messages small."""
    try:
        from services.hedera_service import hedera_service
        anchor_msg = {
            "kind": ATTESTATION_SCHEMA,
            "attestation_id": signed_blob["payload"]["attestation_id"],
            "partner_id": signed_blob["payload"]["partner_id"],
            "subject_user_id": signed_blob["payload"]["subject_user_id"],
            "payload_digest": signed_blob["payload_digest"],
            "signature": signed_blob["signature"][:88],  # truncate to fit 1024B HCS limit
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        topic_id = hedera_service.default_topic_id
        result = await hedera_service.submit_message(topic_id, anchor_msg)
        if not result.get("success"):
            logger.warning(f"hedera anchor failed: {result}")
            return None
        seq = result.get("sequence_number")
        tx_id = f"{topic_id}@{seq}" if seq else topic_id
        return {
            "topic_id": topic_id,
            "sequence_number": seq,
            "tx_id": tx_id,
            "explorer_url": f"https://hashscan.io/mainnet/topic/{topic_id}/message/{seq}" if seq else None,
            "anchored_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"hedera anchor exception: {e}")
        return None
