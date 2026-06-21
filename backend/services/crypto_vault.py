"""
Envelope encryption for secrets at rest (Ed25519 private keys, etc.).

A master key (KEK) from DATA_ENCRYPTION_KEY wraps a per-record random data key
(DEK); the DEK encrypts the secret with AES-256-GCM (authenticated). This is true
envelope encryption: rotating the KEK only requires re-wrapping DEKs, never
re-encrypting the underlying data.

Tokens are strings prefixed with "enc:v1:". Any value WITHOUT that prefix is
treated as legacy plaintext and passed through unchanged on decrypt — so existing
records keep working and migrate to ciphertext the next time they're written.
"""
import os
import json
import base64
import logging
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"
_warned = False


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def _ub64(s: str) -> bytes:
    return base64.b64decode(s)


def _kek() -> Optional[bytes]:
    raw = (os.environ.get("DATA_ENCRYPTION_KEY") or "").strip()
    if not raw:
        return None
    # Accept base64 (preferred) or hex; must decode to exactly 32 bytes.
    for decoder in (base64.b64decode, bytes.fromhex):
        try:
            k = decoder(raw)
            if len(k) == 32:
                return k
        except Exception:
            continue
    logger.error("[crypto_vault] DATA_ENCRYPTION_KEY is set but not a valid 32-byte base64/hex key")
    return None


def is_enabled() -> bool:
    return _kek() is not None


def encrypt_str(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a string into an 'enc:v1:' token. If no KEK is configured, returns
    the plaintext unchanged (dev fallback) and warns once."""
    global _warned
    if plaintext is None:
        return None
    kek = _kek()
    if kek is None:
        if not _warned:
            logger.warning("[crypto_vault] DATA_ENCRYPTION_KEY not set — storing secrets UNENCRYPTED (dev only)")
            _warned = True
        return plaintext
    dek = os.urandom(32)
    data_nonce = os.urandom(12)
    ct = AESGCM(dek).encrypt(data_nonce, plaintext.encode(), None)
    kek_nonce = os.urandom(12)
    wrapped_dek = AESGCM(kek).encrypt(kek_nonce, dek, None)
    blob = {"ct": _b64(ct), "dn": _b64(data_nonce), "wdek": _b64(wrapped_dek), "kn": _b64(kek_nonce)}
    return _PREFIX + base64.b64encode(json.dumps(blob).encode()).decode()


def decrypt_str(token: Optional[str]) -> Optional[str]:
    """Decrypt an 'enc:v1:' token. Legacy plaintext (no prefix) is returned as-is."""
    if not isinstance(token, str) or not token.startswith(_PREFIX):
        return token  # legacy plaintext — graceful migration
    kek = _kek()
    if kek is None:
        raise RuntimeError("DATA_ENCRYPTION_KEY not configured — cannot decrypt secret")
    blob = json.loads(base64.b64decode(token[len(_PREFIX):]))
    dek = AESGCM(kek).decrypt(_ub64(blob["kn"]), _ub64(blob["wdek"]), None)
    pt = AESGCM(dek).decrypt(_ub64(blob["dn"]), _ub64(blob["ct"]), None)
    return pt.decode()
