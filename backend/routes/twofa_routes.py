"""
Two-Factor Authentication Routes
TOTP-based 2FA implementation
"""

from fastapi import APIRouter, HTTPException, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
import pyotp
import qrcode
import io
import base64
from datetime import datetime, timezone
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/2fa", tags=["2fa"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class Enable2FAResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: list[str]


class Verify2FARequest(BaseModel):
    code: str


class Disable2FARequest(BaseModel):
    code: str
    password: str


@router.post("/enable", response_model=Enable2FAResponse)
async def enable_2fa(current_user: User = Depends(get_current_user)):
    """
    Enable 2FA for the current user.
    Returns a secret, QR code, and backup codes.
    """
    # Check if already enabled
    user_doc = await db.users.find_one({"email": current_user.email})
    if user_doc.get("two_factor_enabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled"
        )
    
    # Generate secret
    secret = pyotp.random_base32()
    
    # Generate QR code
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="NotaryChain"
    )
    
    # Create QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Generate backup codes
    backup_codes = [pyotp.random_base32()[:8] for _ in range(10)]
    
    # Store pending 2FA setup (not enabled until verified)
    await db.users.update_one(
        {"email": current_user.email},
        {
            "$set": {
                "two_factor_secret_pending": secret,
                "two_factor_backup_codes_pending": backup_codes,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return Enable2FAResponse(
        secret=secret,
        qr_code=f"data:image/png;base64,{qr_base64}",
        backup_codes=backup_codes
    )


@router.post("/verify-setup")
async def verify_2fa_setup(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_user)
):
    """
    Verify and activate 2FA setup.
    User must provide a valid TOTP code from their authenticator.
    """
    user_doc = await db.users.find_one({"email": current_user.email})
    
    pending_secret = user_doc.get("two_factor_secret_pending")
    if not pending_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending 2FA setup found. Please start setup first."
        )
    
    # Verify code
    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(request.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    # Activate 2FA - hash backup codes for security
    from auth import get_password_hash
    backup_codes = user_doc.get("two_factor_backup_codes_pending", [])
    hashed_backup_codes = [get_password_hash(code) for code in backup_codes]
    
    await db.users.update_one(
        {"email": current_user.email},
        {
            "$set": {
                "two_factor_enabled": True,
                "two_factor_secret": pending_secret,
                "two_factor_backup_codes": hashed_backup_codes,
                "two_factor_enabled_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "two_factor_secret_pending": "",
                "two_factor_backup_codes_pending": ""
            }
        }
    )
    
    logger.info(f"2FA enabled for user: {current_user.email}")
    
    return {
        "message": "2FA has been enabled successfully",
        "backup_codes_remaining": len(backup_codes)
    }


@router.post("/disable")
async def disable_2fa(
    request: Disable2FARequest,
    current_user: User = Depends(get_current_user)
):
    """
    Disable 2FA for the current user.
    Requires valid TOTP code and password.
    """
    from auth import verify_password
    
    user_doc = await db.users.find_one({"email": current_user.email})
    
    if not user_doc.get("two_factor_enabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled"
        )
    
    # Verify password
    if not verify_password(request.password, user_doc.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Verify TOTP code
    secret = user_doc.get("two_factor_secret")
    totp = pyotp.TOTP(secret)
    
    if not totp.verify(request.code, valid_window=1):
        # Check backup codes
        backup_codes = user_doc.get("two_factor_backup_codes", [])
        if request.code not in backup_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
    
    # Disable 2FA
    await db.users.update_one(
        {"email": current_user.email},
        {
            "$set": {
                "two_factor_enabled": False,
                "updated_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "two_factor_secret": "",
                "two_factor_backup_codes": ""
            }
        }
    )
    
    logger.info(f"2FA disabled for user: {current_user.email}")
    
    return {"message": "2FA has been disabled"}


@router.get("/status")
async def get_2fa_status(current_user: User = Depends(get_current_user)):
    """Get 2FA status for current user"""
    user_doc = await db.users.find_one({"email": current_user.email})
    
    enabled = user_doc.get("two_factor_enabled", False)
    backup_codes = user_doc.get("two_factor_backup_codes", [])
    
    return {
        "enabled": enabled,
        "backup_codes_remaining": len(backup_codes) if enabled else 0,
        "enabled_at": user_doc.get("two_factor_enabled_at")
    }


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate backup codes.
    Requires valid TOTP code.
    """
    user_doc = await db.users.find_one({"email": current_user.email})
    
    if not user_doc.get("two_factor_enabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled"
        )
    
    # Verify TOTP code
    secret = user_doc.get("two_factor_secret")
    totp = pyotp.TOTP(secret)
    
    if not totp.verify(request.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    # Generate new backup codes
    new_backup_codes = [pyotp.random_base32()[:8] for _ in range(10)]
    
    await db.users.update_one(
        {"email": current_user.email},
        {
            "$set": {
                "two_factor_backup_codes": new_backup_codes,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Backup codes regenerated",
        "backup_codes": new_backup_codes
    }


# ============ 2FA VERIFICATION FOR LOGIN ============

async def verify_2fa_code(user_doc: dict, code: str) -> bool:
    """
    Verify a 2FA code (TOTP or backup code).
    Returns True if valid, False otherwise.
    """
    if not user_doc.get("two_factor_enabled"):
        return True  # 2FA not enabled, skip verification
    
    secret = user_doc.get("two_factor_secret")
    if not secret:
        return True  # No secret stored, skip verification
    
    # Try TOTP first
    totp = pyotp.TOTP(secret)
    if totp.verify(code, valid_window=1):
        return True
    
    # Try backup codes
    backup_codes = user_doc.get("two_factor_backup_codes", [])
    if code in backup_codes:
        # Remove used backup code
        backup_codes.remove(code)
        await db.users.update_one(
            {"id": user_doc.get("id")},
            {"$set": {"two_factor_backup_codes": backup_codes}}
        )
        logger.info(f"Backup code used for user: {user_doc.get('email')}")
        return True
    
    return False
