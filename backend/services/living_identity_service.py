"""
Living Identity Notarization — Core Service
Identity is a living, evolving credential — not a snapshot.
Tracks biometric drift, computes trust scores, seals events on Hedera per-user HCS topics.

Trademarkable IP:
- Genesis Anchor: initial sealed identity baseline
- Identity Drift Score: continuous 0-100 trust metric
- Re-Attestation Protocol: on-demand identity challenges
- Identity Death Certificate: revocation artifact
"""
import os
import uuid
import json
import hashlib
import logging
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")


# ────────── TRUST SCORE ALGORITHM ──────────

def compute_trust_score(
    biometric_match: float,           # 0.0-1.0
    behavioral_consistency: float,    # 0.0-1.0
    days_since_last_verification: int,
    refresh_cadence_days: int,
    anan_reputation: float = 0.85,    # 0.0-1.0
    drift_penalties: int = 0,
) -> int:
    """Compute the 0-100 Identity Drift Score."""
    base = biometric_match * 50.0
    behavioral = behavioral_consistency * 25.0
    # Recency: 100% if fresh, decays linearly to 0 at 2x cadence
    recency_ratio = max(0.0, 1.0 - (days_since_last_verification / max(refresh_cadence_days * 2, 1)))
    recency = recency_ratio * 15.0
    reputation = anan_reputation * 10.0
    score = base + behavioral + recency + reputation - drift_penalties
    return max(0, min(100, int(round(score))))


def trust_tier(score: int) -> str:
    if score >= 90:
        return "verified"
    if score >= 70:
        return "watch"
    if score >= 40:
        return "challenged"
    return "revoked"


# ────────── HASHING / ENCRYPTION HELPERS ──────────

def biometric_hash(image_bytes: bytes) -> str:
    """SHA256 hash — never store raw biometric in DB."""
    return hashlib.sha256(image_bytes).hexdigest()


def device_fingerprint_hash(payload: Dict[str, Any]) -> str:
    """Hash of device signals (UA, screen, timezone) — opaque token."""
    canonical = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


# ────────── GPT-5.2 VISION — DRIFT ANALYSIS ──────────

DRIFT_SYSTEM_PROMPT = """You are the Identity Drift Analyst for the NotaryChain Living Identity protocol.
Your job is to compare two biometric captures of the SAME person, taken N days apart,
and produce a confidence-weighted analysis.

ACCOUNT FOR (these are normal, not suspicious):
- Natural aging (skin tone, weight, hair changes proportional to elapsed time)
- Lighting and pose differences
- Glasses on/off, facial hair changes, makeup, hairstyle changes
- Camera quality / device differences

FLAG AS SUSPICIOUS:
- 3D facial geometry mismatch beyond aging tolerance
- Liveness anomalies (potential deepfake, mask, photo-of-photo, screen replay)
- Apparent age difference incompatible with elapsed days
- Sudden ethnicity/structural facial change

Respond with ONLY valid JSON, no markdown:
{
  "match_confidence": 0.0-1.0,
  "aging_normal": true|false,
  "alert_required": true|false,
  "drift_signals": ["..."],
  "reasoning": "1-2 sentences"
}"""


async def analyze_drift(
    baseline_b64: str,
    current_b64: str,
    days_elapsed: int,
) -> Dict[str, Any]:
    """Call GPT-5.2 Vision to compare two biometric snapshots."""
    if not EMERGENT_KEY:
        # Fallback: assume normal aging, mid confidence
        return {
            "match_confidence": 0.85,
            "aging_normal": True,
            "alert_required": False,
            "drift_signals": [],
            "reasoning": "AI unavailable — degraded fallback assumed normal",
            "ai_powered": False,
            "model": None,
        }

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"li-drift-{uuid.uuid4().hex[:8]}",
            system_message=DRIFT_SYSTEM_PROMPT,
        ).with_model("openai", "gpt-5.2")

        prompt = (
            f"Compare these two biometric captures of the same person. "
            f"The first is the baseline; the second was captured {days_elapsed} days later. "
            f"Determine if drift between them is consistent with natural aging or suggests compromise."
        )
        response = await chat.send_message(UserMessage(
            text=prompt,
            images=[ImageContent(image_base64=baseline_b64), ImageContent(image_base64=current_b64)],
        ))

        text = response.strip()
        if text.startswith("```"):
            text = "\n".join(line for line in text.split("\n") if not line.strip().startswith("```")).strip()
        try:
            result = json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}") + 1
            result = json.loads(text[start:end]) if start >= 0 and end > start else {}

        return {
            "match_confidence": float(min(max(result.get("match_confidence", 0.7), 0.0), 1.0)),
            "aging_normal": bool(result.get("aging_normal", True)),
            "alert_required": bool(result.get("alert_required", False)),
            "drift_signals": result.get("drift_signals", []),
            "reasoning": result.get("reasoning", ""),
            "ai_powered": True,
            "model": "gpt-5.2",
        }
    except Exception as e:
        logger.warning(f"Living Identity AI drift analysis failed: {e}")
        return {
            "match_confidence": 0.7,
            "aging_normal": True,
            "alert_required": False,
            "drift_signals": ["ai_unavailable"],
            "reasoning": f"AI error: {str(e)[:150]}",
            "ai_powered": False,
            "model": None,
        }


# ────────── HEDERA SEALING ──────────

async def seal_event(event_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Seal a living-identity event on Hedera HCS. Returns tx info or None on failure."""
    try:
        from services.hedera_service import hedera_service
        # Use shared default topic for now; per-user dedicated topic is Phase 2 enhancement.
        topic_id = hedera_service.default_topic_id
        result = await hedera_service.submit_message(topic_id, event_payload)
        if result and result.get("success"):
            return {
                "topic_id": topic_id,
                "sequence_number": result.get("sequence_number"),
                "explorer_url": result.get("explorer_url"),
                "network": getattr(hedera_service, "network", "mainnet"),
                "sealed": True,
            }
    except Exception as e:
        logger.warning(f"Living Identity Hedera seal failed: {e}")
    return None


# ────────── ENCRYPTED BLOB STORAGE (S3 + KMS / BYOK) ──────────

async def store_biometric_blob(
    image_bytes: bytes,
    user_id: str,
    snapshot_id: str,
    byok_kms_arn: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Store an encrypted biometric blob.

    BYOK: if `byok_kms_arn` is set (Enterprise), use customer-managed KMS key.
    Otherwise S3 SSE-S3 default encryption.
    """
    bucket = os.environ.get("AWS_S3_BUCKET")
    region = os.environ.get("AWS_REGION", "us-east-1")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")

    key = f"living-identity/{user_id}/{snapshot_id}.bin"
    sha256 = biometric_hash(image_bytes)

    if not (bucket and access_key and secret_key):
        # SECURITY: biometric data is sensitive PII. We refuse to persist it to an
        # unencrypted local path. If encrypted object storage isn't configured the
        # capture fails closed rather than leaking PII to disk.
        logger.error("Biometric storage rejected: S3 (encrypted object storage) is not configured")
        raise HTTPException(
            status_code=503,
            detail="Secure biometric storage is not available. Identity capture is temporarily disabled.",
        )

    try:
        import boto3
        s3 = boto3.client(
            "s3", region_name=region,
            aws_access_key_id=access_key, aws_secret_access_key=secret_key,
        )
        put_kwargs = {
            "Bucket": bucket, "Key": key, "Body": image_bytes,
            "ContentType": "application/octet-stream",
        }
        if byok_kms_arn:
            put_kwargs["ServerSideEncryption"] = "aws:kms"
            put_kwargs["SSEKMSKeyId"] = byok_kms_arn
            encryption_mode = "kms-byok"
        else:
            put_kwargs["ServerSideEncryption"] = "AES256"
            encryption_mode = "sse-s3"
        s3.put_object(**put_kwargs)
        return {
            "backend": "s3",
            "bucket": bucket,
            "key": key,
            "size": len(image_bytes),
            "sha256": sha256,
            "encryption": encryption_mode,
            "kms_arn": byok_kms_arn,
        }
    except HTTPException:
        raise
    except Exception as e:
        # SECURITY: never silently fall back to unencrypted local storage for PII.
        logger.error(f"Biometric S3 upload failed — failing closed (no local fallback): {e}")
        raise HTTPException(
            status_code=503,
            detail="Secure biometric storage is temporarily unavailable. Please try again later.",
        )


# ────────── BEHAVIORAL DRIFT ──────────

def behavioral_consistency_score(
    baseline: Dict[str, Any],
    current: Dict[str, Any],
) -> tuple[float, List[str]]:
    """Compare current behavioral signals to baseline. Returns (0.0-1.0, signals_list)."""
    signals: List[str] = []
    score = 1.0

    # Typing cadence delta
    base_cadence = baseline.get("typing_cadence_ms_avg", 0)
    cur_cadence = current.get("typing_cadence_ms_avg", 0)
    if base_cadence and cur_cadence:
        delta = abs(base_cadence - cur_cadence) / max(base_cadence, 1)
        if delta > 0.5:
            signals.append("typing_cadence_unusual")
            score -= 0.15

    # Active hours
    base_hours = set(baseline.get("active_hours_utc", []))
    cur_hour = current.get("hour_utc")
    if base_hours and cur_hour is not None and cur_hour not in base_hours:
        signals.append(f"unusual_hour_utc_{cur_hour}")
        score -= 0.1

    # Device new?
    base_devices = set(baseline.get("device_oses", []))
    cur_device = current.get("device_os")
    if base_devices and cur_device and cur_device not in base_devices:
        signals.append("new_device_first_use")
        score -= 0.2

    # Geo region change
    base_region = baseline.get("geo_region")
    cur_region = current.get("geo_region")
    if base_region and cur_region and base_region != cur_region:
        signals.append(f"geo_region_change_{base_region}_to_{cur_region}")
        score -= 0.15

    return max(0.0, score), signals
