from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = None
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

def _get_secret_key():
    global SECRET_KEY
    if SECRET_KEY is None:
        SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
        if not SECRET_KEY:
            raise RuntimeError("JWT_SECRET_KEY environment variable is required")
    return SECRET_KEY

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ── httpOnly cookie helpers (cookie-based auth migration) ─────────────
AUTH_COOKIE_NAME = "access_token"

def set_auth_cookie(response, token: str):
    """Set the JWT as an httpOnly, Secure, SameSite=Lax cookie (same-origin app)."""
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

def clear_auth_cookie(response):
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")