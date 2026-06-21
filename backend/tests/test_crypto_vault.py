"""
Regression tests for envelope encryption of secrets at rest (crypto_vault).

Run: cd /app/backend && python -m pytest tests/test_crypto_vault.py -v
"""
import os
import base64
import importlib


def _reload_with_key(key_b64):
    if key_b64 is None:
        os.environ.pop("DATA_ENCRYPTION_KEY", None)
    else:
        os.environ["DATA_ENCRYPTION_KEY"] = key_b64
    import services.crypto_vault as cv
    return importlib.reload(cv)


def test_envelope_roundtrip_and_ciphertext():
    cv = _reload_with_key(base64.b64encode(os.urandom(32)).decode())
    assert cv.is_enabled()
    secret = "ed25519-private-key-b64-value"
    token = cv.encrypt_str(secret)
    # Stored value must be an opaque enc:v1: token, NOT the plaintext.
    assert token.startswith("enc:v1:")
    assert secret not in token
    assert cv.decrypt_str(token) == secret


def test_legacy_plaintext_passthrough():
    cv = _reload_with_key(base64.b64encode(os.urandom(32)).decode())
    # Records written before encryption (no prefix) must still be readable.
    assert cv.decrypt_str("legacy-plaintext-key") == "legacy-plaintext-key"


def test_unique_ciphertext_per_call():
    cv = _reload_with_key(base64.b64encode(os.urandom(32)).decode())
    a = cv.encrypt_str("same-secret")
    b = cv.encrypt_str("same-secret")
    assert a != b  # random DEK + nonce per call
    assert cv.decrypt_str(a) == cv.decrypt_str(b) == "same-secret"


def test_no_key_passthrough_dev_mode():
    cv = _reload_with_key(None)
    assert not cv.is_enabled()
    # Without a KEK we degrade to plaintext (dev only) rather than crashing.
    assert cv.encrypt_str("x") == "x"
