"""
Biometric Passport Routes
Synthesizes multi-modal biometric verifications (facial, voiceprint, liveness)
into a single verifiable credential — the Biometric Passport.
"""

from fastapi import APIRouter, HTTPException, Depends, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from datetime import datetime, timezone
import os
import uuid
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/biometric-passport", tags=["biometric-passport"])

db: AsyncIOMotorDatabase = None

REQUIRED_MODALITIES = ["facial", "voiceprint", "liveness"]
PASS_THRESHOLD = 0.70
PASSPORT_VALIDITY_DAYS = 90


def set_db(database):
    global db
    db = database


def _compute_composite_score(verifications: list) -> dict:
    """Compute a weighted composite biometric score."""
    weights = {"facial": 0.45, "voiceprint": 0.30, "liveness": 0.25}
    total_weight = 0
    weighted_score = 0
    modality_results = {}

    for v in verifications:
        vtype = v.get("verification_type", "")
        score = v.get("confidence_score", 0)
        w = weights.get(vtype, 0.2)
        weighted_score += score * w
        total_weight += w
        modality_results[vtype] = {
            "score": score,
            "status": v.get("status"),
            "verification_id": v.get("id"),
            "timestamp": v.get("timestamp"),
        }

    composite = weighted_score / total_weight if total_weight > 0 else 0
    return {
        "composite_score": round(composite, 4),
        "modality_results": modality_results,
        "total_weight": round(total_weight, 2),
    }


@router.post("/generate")
async def generate_passport(
    session_id: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a Biometric Passport from all biometric verifications in a session.
    Requires at least facial + one other modality. Creates a cryptographic hash
    of all biometric data for tamper-proof verification.
    """
    verifications = await db.biometric_verifications.find(
        {"session_id": session_id, "user_id": current_user.id},
        {"_id": 0},
    ).to_list(20)

    if not verifications:
        raise HTTPException(status_code=400, detail="No biometric verifications found for this session")

    # Check which modalities are present
    modalities_present = {v.get("verification_type") for v in verifications}
    passed_verifications = [v for v in verifications if v.get("status") == "passed"]

    if "facial" not in modalities_present:
        raise HTTPException(status_code=400, detail="Facial verification is required for passport generation")

    if len(modalities_present) < 2:
        raise HTTPException(status_code=400, detail="At least 2 biometric modalities required (facial + voiceprint or liveness)")

    # Compute composite score
    scoring = _compute_composite_score(passed_verifications)
    composite_score = scoring["composite_score"]
    passport_status = "verified" if composite_score >= PASS_THRESHOLD else "insufficient"

    # Create cryptographic fingerprint of all biometric data
    bio_data_str = json.dumps(
        [{"id": v.get("id"), "type": v.get("verification_type"),
          "score": v.get("confidence_score"), "status": v.get("status")}
         for v in verifications],
        sort_keys=True,
    )
    biometric_hash = hashlib.sha256(bio_data_str.encode()).hexdigest()

    passport_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    passport = {
        "id": passport_id,
        "user_id": current_user.id,
        "session_id": session_id,
        "status": passport_status,
        "composite_score": composite_score,
        "modalities_verified": list(modalities_present),
        "modality_details": scoring["modality_results"],
        "total_verifications": len(verifications),
        "passed_verifications": len(passed_verifications),
        "biometric_hash": biometric_hash,
        "issued_at": now.isoformat(),
        "expires_at": None,  # Set on approval
        "created_at": now.isoformat(),
    }

    if passport_status == "verified":
        from datetime import timedelta
        passport["expires_at"] = (now + timedelta(days=PASSPORT_VALIDITY_DAYS)).isoformat()

    await db.biometric_passports.insert_one(passport)
    passport.pop("_id", None)

    return passport


@router.get("/my")
async def get_my_passports(
    current_user: User = Depends(get_current_user),
):
    """Get all biometric passports for the current user."""
    passports = await db.biometric_passports.find(
        {"user_id": current_user.id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(10)
    return {"passports": passports}


@router.get("/{passport_id}")
async def get_passport(
    passport_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific biometric passport."""
    passport = await db.biometric_passports.find_one(
        {"id": passport_id}, {"_id": 0}
    )
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    return passport


@router.get("/verify/{passport_id}")
async def verify_passport(passport_id: str):
    """
    Public endpoint to verify a biometric passport's integrity.
    Recalculates the hash from source verifications and compares.
    """
    passport = await db.biometric_passports.find_one(
        {"id": passport_id}, {"_id": 0}
    )
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")

    # Check expiry
    expired = False
    if passport.get("expires_at"):
        expires = datetime.fromisoformat(passport["expires_at"])
        expired = datetime.now(timezone.utc) > expires

    # Re-fetch source verifications and recompute hash
    verifications = await db.biometric_verifications.find(
        {"session_id": passport["session_id"], "user_id": passport["user_id"]},
        {"_id": 0},
    ).to_list(20)

    bio_data_str = json.dumps(
        [{"id": v.get("id"), "type": v.get("verification_type"),
          "score": v.get("confidence_score"), "status": v.get("status")}
         for v in verifications],
        sort_keys=True,
    )
    recomputed_hash = hashlib.sha256(bio_data_str.encode()).hexdigest()

    tamper_free = recomputed_hash == passport.get("biometric_hash")

    return {
        "passport_id": passport_id,
        "status": passport["status"],
        "composite_score": passport["composite_score"],
        "modalities_verified": passport["modalities_verified"],
        "issued_at": passport["issued_at"],
        "expires_at": passport["expires_at"],
        "expired": expired,
        "integrity_verified": tamper_free,
        "biometric_hash": passport["biometric_hash"],
    }


@router.get("/session/{session_id}")
async def get_session_passport(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the biometric passport for a specific session."""
    passport = await db.biometric_passports.find_one(
        {"session_id": session_id, "user_id": current_user.id},
        {"_id": 0},
    )
    if not passport:
        raise HTTPException(status_code=404, detail="No passport for this session")
    return passport
