from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = None
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 25      # short-lived access token (silently refreshed)
IDLE_TIMEOUT_MINUTES = 30             # sliding idle window (refresh-token lifetime)
ABSOLUTE_SESSION_HOURS = 12           # hard cap regardless of activity

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


def create_refresh_token(data: dict, expires_delta: timedelta):
    """Refresh token JWT. Its own exp encodes the sliding idle window; an `abs_exp`
    claim carries the absolute session cap so it can never be extended past it."""
    to_encode = data.copy()
    to_encode.update({"exp": datetime.now(timezone.utc) + expires_delta})
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ── httpOnly cookie helpers (cookie-based auth migration) ─────────────
AUTH_COOKIE_NAME = "access_token"


def extract_request_token(request, _auth_header: Optional[str] = None) -> Optional[str]:
    """Cookie-first token extraction shared by every route's auth resolver.

    Order: httpOnly `access_token` cookie → `Authorization: Bearer <jwt>` header.
    Ignores the literal `cookie` sentinel the frontend sends in the Bearer header
    when running under cookie auth (so legacy header-only routes keep working).
    """
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        return token
    auth = _auth_header if _auth_header is not None else request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        candidate = auth.split(" ", 1)[1].strip()
        if candidate and candidate != "cookie":
            return candidate
    return None

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


# ── Refresh-token cookie (scoped to /api/auth so it's only sent to auth endpoints) ──
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


def set_refresh_cookie(response, token: str, max_age_seconds: int):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=max_age_seconds,
        path=REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)