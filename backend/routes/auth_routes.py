from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import UserCreate, UserLogin, User, Token
from auth import get_password_hash, verify_password, create_access_token, decode_access_token
from services.email_service import email_service
from middleware.security import limiter, validate_password, sanitize_email
from routes.notification_routes import create_notification as create_notif
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
import pyotp
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])
security = HTTPBearer()

# This will be injected from main server.py
db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return User(**user)


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    temp_token: Optional[str] = None


class TwoFALoginRequest(BaseModel):
    temp_token: str
    code: str


@router.post("/signup", response_model=Token)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserCreate, background_tasks: BackgroundTasks):
    # Sanitize email
    try:
        clean_email = sanitize_email(user_data.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Validate password strength
    is_valid, message = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": clean_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=clean_email,
        full_name=user_data.full_name
    )
    
    user_dict = user.dict()
    user_dict["hashed_password"] = get_password_hash(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Send welcome email in background
    background_tasks.add_task(
        email_service.send_welcome_email,
        email=user.email,
        full_name=user.full_name or user.email.split('@')[0]
    )
    logger.info(f"Welcome email queued for {user.email}")
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return Token(access_token=access_token)

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin):
    # Sanitize email
    try:
        clean_email = sanitize_email(user_data.email)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Find user
    user = await db.users.find_one({"email": clean_email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if 2FA is enabled
    if user.get("two_factor_enabled"):
        # Issue a short-lived temp token (not a full access token)
        temp_token = create_access_token(
            data={"sub": user["email"], "purpose": "2fa_verification"},
            expires_delta=timedelta(minutes=5)
        )
        return LoginResponse(requires_2fa=True, temp_token=temp_token)
    
    # No 2FA - issue full access token
    access_token = create_access_token(data={"sub": user["email"]})
    return LoginResponse(access_token=access_token)


@router.post("/login/2fa", response_model=Token)
@limiter.limit("10/minute")
async def login_2fa(request: Request, data: TwoFALoginRequest):
    """Verify 2FA code and complete login"""
    # Decode the temp token
    payload = decode_access_token(data.temp_token)
    if payload is None or payload.get("purpose") != "2fa_verification":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification session"
        )
    
    email = payload.get("sub")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Verify the TOTP code
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA configuration error"
        )
    
    totp = pyotp.TOTP(secret)
    code_valid = totp.verify(data.code, valid_window=1)
    
    # If TOTP failed, check backup codes
    if not code_valid:
        backup_codes = user.get("two_factor_backup_codes", [])
        if data.code in backup_codes:
            code_valid = True
            # Remove used backup code
            backup_codes.remove(data.code)
            await db.users.update_one(
                {"email": email},
                {"$set": {"two_factor_backup_codes": backup_codes}}
            )
            logger.info(f"Backup code used for user: {email}")
    
    if not code_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification code"
        )
    
    # Issue full access token
    access_token = create_access_token(data={"sub": email})
    return Token(access_token=access_token)


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    # Fetch extended user info including 2FA status
    user_doc = await db.users.find_one({"email": current_user.email}, {"_id": 0, "hashed_password": 0, "two_factor_secret": 0, "two_factor_secret_pending": 0, "two_factor_backup_codes": 0, "two_factor_backup_codes_pending": 0})
    if user_doc:
        return user_doc
    return current_user