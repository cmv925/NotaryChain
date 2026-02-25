"""
Security Middleware and Utilities
Rate limiting, security headers, and other security features
"""

import os
import time
import logging
from typing import Callable
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ============ RATE LIMITING ============

def get_real_ip(request: Request) -> str:
    """Get real IP address from request, handling proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return get_remote_address(request)

# Create limiter instance
limiter = Limiter(key_func=get_real_ip)

# Rate limit configurations
RATE_LIMITS = {
    "default": "100/minute",
    "auth": "10/minute",  # Strict for auth endpoints
    "signup": "5/minute",  # Very strict for signups
    "api": "60/minute",   # Standard API calls
    "ai": "20/minute",    # AI operations (expensive)
    "blockchain": "30/minute",  # Blockchain operations
}


# ============ SECURITY HEADERS MIDDLEWARE ============

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Content Security Policy
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https: http:",
            "connect-src 'self' https: wss:",
            "frame-src 'self' https://daily.co https://*.daily.co",
            "media-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ]
        
        # Security Headers
        security_headers = {
            # Prevent clickjacking
            "X-Frame-Options": "SAMEORIGIN",
            
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Enable XSS filter
            "X-XSS-Protection": "1; mode=block",
            
            # Referrer Policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Permissions Policy (formerly Feature-Policy)
            "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
            
            # Content Security Policy
            "Content-Security-Policy": "; ".join(csp_directives),
            
            # Strict Transport Security (HSTS)
            # Only enable in production with HTTPS
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            
            # Prevent caching of sensitive data
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        
        # Apply headers (skip for OPTIONS preflight)
        if request.method != "OPTIONS":
            for header, value in security_headers.items():
                response.headers[header] = value
        
        return response


# ============ REQUEST LOGGING MIDDLEWARE ============

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for audit purposes"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Get request info
        client_ip = get_real_ip(request)
        method = request.method
        path = request.url.path
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log request (skip health checks to reduce noise)
        if not path.endswith("/health"):
            logger.info(
                f"{client_ip} - {method} {path} - {response.status_code} - {duration:.3f}s"
            )
        
        # Add timing header
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        
        return response


# ============ SENTRY INTEGRATION ============

def init_sentry(app: FastAPI):
    """Initialize Sentry error tracking if DSN is configured"""
    sentry_dsn = os.environ.get("SENTRY_DSN")
    
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.starlette import StarletteIntegration
            
            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[
                    FastApiIntegration(),
                    StarletteIntegration(),
                ],
                traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
                profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_RATE", "0.1")),
                environment=os.environ.get("ENVIRONMENT", "development"),
                release=os.environ.get("APP_VERSION", "1.1.0"),
                send_default_pii=False,
                before_send=_sentry_before_send,
            )
            logger.info("Sentry error tracking initialized")
            return True
        except Exception as e:
            logger.warning(f"Failed to initialize Sentry: {e}")
    else:
        logger.info("Sentry DSN not configured, error tracking disabled")
    return False


def _sentry_before_send(event, hint):
    """Filter / enrich Sentry events before sending."""
    # Scrub sensitive fields
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        for key in list(headers.keys()):
            if key.lower() in ("authorization", "cookie", "x-api-key"):
                headers[key] = "[Filtered]"
    # Drop noisy 404 errors
    if event.get("exception"):
        values = event["exception"].get("values", [])
        for exc in values:
            if exc.get("type") == "HTTPException" and "404" in str(exc.get("value", "")):
                return None
    return event


def capture_sentry_error(error: Exception, context: dict = None):
    """Safely capture an error to Sentry with optional context."""
    try:
        import sentry_sdk
        if context:
            with sentry_sdk.push_scope() as scope:
                for k, v in context.items():
                    scope.set_extra(k, v)
                sentry_sdk.capture_exception(error)
        else:
            sentry_sdk.capture_exception(error)
    except Exception:
        pass  # Sentry not configured


# ============ HEALTH CHECK ============

async def health_check():
    """Comprehensive health check endpoint"""
    from motor.motor_asyncio import AsyncIOMotorClient
    from services.cache_service import cache_service
    from services.storage_service import storage_service
    
    health = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.1.0",
        "checks": {}
    }
    
    # Check MongoDB
    try:
        mongo_url = os.environ.get("MONGO_URL")
        if mongo_url:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
            await client.admin.command('ping')
            client.close()
            health["checks"]["mongodb"] = {"status": "healthy"}
        else:
            health["checks"]["mongodb"] = {"status": "not_configured"}
    except Exception as e:
        health["checks"]["mongodb"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"
    
    # Check Hedera
    hedera_configured = bool(os.environ.get("HEDERA_ACCOUNT_ID"))
    health["checks"]["hedera"] = {
        "status": "configured" if hedera_configured else "not_configured"
    }
    
    # Check Stripe
    stripe_configured = bool(os.environ.get("STRIPE_API_KEY"))
    health["checks"]["stripe"] = {
        "status": "configured" if stripe_configured else "not_configured"
    }
    
    # Check Daily.co
    daily_configured = bool(os.environ.get("DAILY_API_KEY"))
    health["checks"]["daily"] = {
        "status": "configured" if daily_configured else "not_configured"
    }
    
    # Check Resend
    resend_configured = bool(os.environ.get("RESEND_API_KEY"))
    health["checks"]["resend"] = {
        "status": "configured" if resend_configured else "not_configured"
    }

    # Cache
    health["checks"]["cache"] = {"status": "healthy", "backend": "in-memory"}

    # Storage
    health["checks"]["storage"] = {
        "status": "healthy",
        "backend": storage_service.backend,
    }

    # Sentry
    sentry_configured = bool(os.environ.get("SENTRY_DSN"))
    health["checks"]["sentry"] = {
        "status": "configured" if sentry_configured else "not_configured"
    }
    
    return health


# ============ INPUT SANITIZATION ============

import re
import html

def sanitize_string(value: str, max_length: int = 10000) -> str:
    """Sanitize string input to prevent XSS and injection"""
    if not isinstance(value, str):
        return value
    
    # Truncate to max length
    value = value[:max_length]
    
    # HTML escape
    value = html.escape(value)
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    return value


def sanitize_email(email: str) -> str:
    """Validate and sanitize email address"""
    if not email:
        return email
    
    email = email.strip().lower()
    
    # Basic email validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValueError("Invalid email format")
    
    return email


# ============ PASSWORD VALIDATION ============

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password strength
    Returns (is_valid, message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password must not exceed 128 characters"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    # Check for common passwords (basic check)
    common_passwords = [
        'password', '12345678', 'qwerty', 'abc123', 'monkey',
        'letmein', 'dragon', 'master', 'admin', 'welcome'
    ]
    if password.lower() in common_passwords:
        return False, "Password is too common"
    
    return True, "Password is valid"


# ============ SETUP FUNCTION ============

def setup_security(app: FastAPI):
    """Setup all security features for the application"""
    
    # Add rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Add request logging
    app.add_middleware(RequestLoggingMiddleware)
    
    # Initialize Sentry
    init_sentry(app)
    
    logger.info("Security middleware initialized")
