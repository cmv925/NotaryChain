# NotaryChain — Comprehensive Security Audit Report

**Date:** February 2026  
**Scope:** Full backend codebase (`/app/backend/`) — authentication, authorization, input validation, data exposure, file handling, API security, cryptography, infrastructure  
**Methodology:** Manual static analysis of all route handlers, middleware, services, and models

---

## EXECUTIVE SUMMARY

NotaryChain's security posture is **strong for a pre-production platform**. The fundamentals are solid — bcrypt password hashing, JWT with env-sourced secrets, rate limiting, security headers (CSP, HSTS, X-Frame-Options), input sanitization, and proper `_id` exclusion patterns. However, the audit identified **6 Critical**, **8 High**, and **9 Medium** severity findings that should be remediated before production deployment.

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 6 | Must fix before production |
| HIGH | 8 | Fix before public beta |
| MEDIUM | 9 | Fix during hardening phase |
| LOW | 5 | Best practice improvements |
| INFO | 4 | Observations / commendations |

---

## CRITICAL FINDINGS (Must Fix Before Production)

### C1: Regex Injection via Search Parameters
**Location:** `template_routes.py:222-223`, `marketplace_routes.py:63-65`, `notary_professional_routes.py:64-65`  
**Risk:** Remote Denial of Service (ReDoS)  
**Description:** User-supplied search strings are passed directly to MongoDB's `$regex` operator without escaping. An attacker can submit crafted regex patterns (e.g., `(a+)+$`) that cause catastrophic backtracking, consuming server CPU and causing denial of service.
```python
# VULNERABLE
{"name": {"$regex": search, "$options": "i"}}

# FIXED — escape special regex characters
import re
safe_search = re.escape(search)
{"name": {"$regex": safe_search, "$options": "i"}}
```
**Impact:** Any unauthenticated or authenticated user can crash the database query engine.  
**Fix:** Escape all user input before passing to `$regex` using `re.escape()`.

---

### C2: HTML Injection in Investor Deck Contact Form Email
**Location:** `investor_deck_routes.py:44-51`  
**Risk:** Stored XSS / Email HTML Injection  
**Description:** The contact form fields (`name`, `email`, `company`, `message`) are interpolated directly into an HTML email template using f-strings without escaping. An attacker can inject malicious HTML/JavaScript that executes when the recipient opens the email.
```python
# VULNERABLE
html = f"<td>{req.name}</td>"

# FIXED
from html import escape
html = f"<td>{escape(req.name)}</td>"
```
**Impact:** Phishing attacks via injected links/scripts in email sent to platform administrators.  
**Fix:** HTML-escape all user input before interpolating into email templates.

---

### C3: No File Size Limit on Blockchain Seal Upload
**Location:** `blockchain_routes.py:284-300`  
**Risk:** Denial of Service / Memory Exhaustion  
**Description:** The `seal_file` endpoint reads the entire uploaded file into memory with `content = await file.read()` without any size limit. An attacker can upload a multi-gigabyte file to exhaust server memory.
```python
# VULNERABLE
content = await file.read()  # No size limit

# FIXED — add size check
content = await file.read()
if len(content) > 50 * 1024 * 1024:  # 50MB limit
    raise HTTPException(status_code=413, detail="File too large")
```
**Impact:** Server crash via OOM (Out of Memory).  
**Fix:** Add a maximum file size check. Consider streaming the hash computation instead of loading the entire file.

---

### C4: CORS Wildcard in Production
**Location:** `server.py:187`, `backend/.env:3`  
**Risk:** Cross-Origin Attack Surface  
**Description:** `CORS_ORIGINS` is set to `"*"` which allows any website to make authenticated API requests to the backend. Combined with `allow_credentials=True`, this is a serious misconfiguration — browsers will send cookies/auth headers with cross-origin requests from any domain.
```python
# VULNERABLE (server.py)
allow_credentials=True,
allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),

# .env has:
CORS_ORIGINS="*"
```
**Impact:** Any malicious website can make authenticated API calls on behalf of logged-in users.  
**Fix:** Set `CORS_ORIGINS` to the specific frontend domain(s). When using `allow_credentials=True`, `*` origins should **never** be used.

---

### C5: JWT Token Expiry Too Long (7 Days)
**Location:** `auth.py:11`  
**Risk:** Extended Attack Window  
**Description:** Access tokens expire after 7 days (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7`). If a token is compromised, the attacker has a full week of access. There is no token revocation mechanism or refresh token pattern.
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days — too long
```
**Impact:** Stolen tokens remain valid for 7 days with no way to revoke them.  
**Fix:** Reduce access token lifetime to 15-60 minutes. Implement a refresh token pattern for seamless re-authentication. Add a token blacklist for forced logout/revocation.

---

### C6: WebSocket Token Exposed in URL Query Parameter
**Location:** `transaction_routes.py:568`  
**Risk:** Token Leakage via Logs/Referrer  
**Description:** The transaction WebSocket authenticates using a JWT token passed as a URL query parameter (`?token=...`). This token appears in server logs, proxy logs, browser history, and referrer headers.
```python
# VULNERABLE
token = websocket.query_params.get("token")
```
**Impact:** JWT tokens leaked in access logs, reverse proxy logs, and potentially CDN logs.  
**Fix:** Authenticate WebSocket connections via the first message (like the global WS endpoint already does correctly in `ws_routes.py:38`). The global WebSocket uses the correct pattern — apply it to transaction WebSockets too.

---

## HIGH FINDINGS (Fix Before Public Beta)

### H1: No Rate Limiting on Investor Deck Password Endpoint
**Location:** `investor_deck_routes.py:33`  
**Risk:** Brute Force Attack  
**Description:** The password verification endpoint has no rate limiting. An attacker can brute-force the investor deck password at high speed.  
**Fix:** Add `@limiter.limit("5/minute")` decorator.

### H2: Information Disclosure in Error Messages
**Location:** `blockchain_routes.py` (9 occurrences), `payment_routes.py:214,291,348`  
**Risk:** Internal System Details Exposed  
**Description:** Multiple endpoints return raw exception messages to the client via `str(e)` in HTTP error responses. This can expose internal paths, library versions, database errors, and stack traces.  
**Fix:** Return generic error messages to clients. Log detailed errors server-side only.

### H3: No File Type Validation on Blockchain Seal Upload
**Location:** `blockchain_routes.py:284`  
**Risk:** Malicious File Processing  
**Description:** The `seal_file` endpoint accepts any file type without validation. While it only hashes the content, accepting arbitrary file types broadens the attack surface.  
**Fix:** Validate file extension and MIME type against an allowlist.

### H4: Notary Professional Seal Upload Missing Size Limit
**Location:** `notary_professional_routes.py` — UploadFile endpoint  
**Risk:** Denial of Service  
**Description:** Similar to C3, the notary seal upload doesn't enforce a file size limit during upload processing.  
**Fix:** Add streaming size check with a reasonable limit (e.g., 10MB for seal images).

### H5: SSO Sessions Stored In-Memory
**Location:** `sso_routes.py:32`  
**Risk:** Session Loss / No Expiry  
**Description:** SSO sessions are stored in a Python dictionary (`sso_sessions = {}`) with no TTL or cleanup. Sessions persist until server restart and grow unbounded. In a multi-instance deployment, sessions won't be shared.  
**Fix:** Store sessions in MongoDB with a TTL index. Add automatic cleanup of expired sessions.

### H6: Missing Authorization Check on Some Organization Endpoints
**Location:** Various org-related routes  
**Risk:** IDOR (Insecure Direct Object Reference)  
**Description:** Some organization endpoints accept `org_id` as a path parameter but should verify the requesting user is a member/admin of that organization. While the critical routes (vault, webhooks, reports) correctly verify membership, ensure all org endpoints follow the same pattern.  
**Fix:** Audit all `/{org_id}/` routes and ensure `_require_member()` or `_require_admin()` is called.

### H7: Deprecated datetime.utcnow() Usage
**Location:** `auth.py:30,32`, `document_routes.py:91`, multiple routes  
**Risk:** Timezone Bugs  
**Description:** `datetime.utcnow()` is deprecated in Python 3.12+ and returns a naive datetime object. This can cause subtle comparison bugs with timezone-aware datetimes stored elsewhere.  
**Fix:** Replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`.

### H8: No Account Lockout After Failed Login Attempts
**Location:** `auth_routes.py:124-162`  
**Risk:** Credential Stuffing  
**Description:** While rate limiting exists (10/minute per IP), there's no per-account lockout after repeated failed attempts. An attacker using distributed IPs can bypass IP-based rate limiting.  
**Fix:** Track failed login attempts per account. Lock the account after 5-10 consecutive failures with a cooldown period (e.g., 15 minutes). Notify the user via email.

---

## MEDIUM FINDINGS (Fix During Hardening Phase)

### M1: No CSRF Protection on State-Changing Endpoints
**Description:** The API relies solely on JWT Bearer tokens for authentication, which provides implicit CSRF protection. However, if the app ever stores tokens in cookies (e.g., for SSO), CSRF becomes a risk. No explicit CSRF tokens are implemented.  
**Fix:** If cookies are ever used for auth, implement CSRF token validation. Current JWT-in-header approach is acceptable.

### M2: Investor Deck Password Comparison Not Constant-Time
**Location:** `investor_deck_routes.py:35`  
**Description:** Password comparison uses `!=` (Python string comparison) which may be vulnerable to timing attacks, though the practical risk is low for this specific use case.  
**Fix:** Use `hmac.compare_digest()` for constant-time comparison.

### M3: API Key Displayed Once But No Confirmation of Receipt
**Location:** `api_key_routes.py` — key creation  
**Description:** When an API key is created, the raw key is returned once. If the user misses it, they must regenerate. Consider adding a confirmation step or allowing one re-display within a short window.

### M4: No Request Body Size Limit
**Description:** FastAPI doesn't enforce a global request body size limit. Extremely large JSON payloads could consume memory.  
**Fix:** Add middleware to reject request bodies exceeding a reasonable limit (e.g., 10MB).

### M5: Backup Codes Not Hashed
**Location:** `auth_routes.py:198-199`  
**Description:** 2FA backup codes are stored in plaintext in the database. If the database is compromised, backup codes are immediately usable.  
**Fix:** Hash backup codes with bcrypt (like passwords). Compare submitted codes by hashing the input.

### M6: No Audit Trail for Sensitive Admin Actions
**Description:** While organization activity logging is comprehensive, platform-level admin actions (user role changes, user bans, etc.) may not generate audit entries in all cases.  
**Fix:** Ensure all admin dashboard actions log to `audit_logs` collection.

### M7: Template PDF Generation May Be Vulnerable to Injection
**Location:** `template_routes.py:288`  
**Description:** User-supplied field values are passed to `generate_pdf()`. Depending on the ReportLab implementation, specially crafted input could potentially inject content or cause rendering issues.  
**Fix:** Sanitize all field values before PDF generation.

### M8: Email Enumeration via Signup Error
**Location:** `auth_routes.py:85-88`  
**Description:** The signup endpoint returns "Email already registered" for duplicate emails. This allows attackers to enumerate valid email addresses.  
**Fix:** Return a generic message: "If this email is not already registered, you will receive a confirmation email."

### M9: No Content-Disposition Header on File Downloads
**Location:** Various FileResponse usages  
**Description:** Some file download endpoints don't explicitly set `Content-Disposition: attachment`, which could lead to inline rendering of potentially malicious files in the browser.  
**Fix:** Ensure all file downloads use `Content-Disposition: attachment`.

---

## LOW FINDINGS (Best Practice Improvements)

### L1: Common Password Blacklist Too Small
**Location:** `security.py:338-342`  
**Description:** The common password check only has 10 entries. Consider using a larger list (e.g., top 1,000 from Have I Been Pwned).

### L2: No Security.txt File
**Description:** No `/.well-known/security.txt` endpoint exists for responsible vulnerability disclosure.

### L3: Health Endpoint Exposes Service Configuration
**Location:** `security.py:206-272`  
**Description:** The health check reveals which services are configured/unconfigured. Consider restricting detailed health info to authenticated admin requests.

### L4: No Subresource Integrity for CDN Scripts
**Location:** CSP allows scripts from `cdn.jsdelivr.net` and `unpkg.com` without SRI.  
**Fix:** Add `require-sri-for script` to CSP or use integrity attributes on script tags.

### L5: MongoDB Connection String in Environment Variable
**Description:** Standard practice, but ensure the MongoDB connection uses authentication and TLS in production.

---

## COMMENDATIONS (Things Done Well)

### I1: Strong Password Hashing
bcrypt with auto-deprecation — industry best practice.

### I2: Comprehensive Security Headers
CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — all properly configured.

### I3: Proper _id Exclusion Pattern
Most MongoDB queries correctly exclude `_id` from responses using `{"_id": 0}` projections. GDPR export properly excludes `hashed_password` and `two_factor_secret`.

### I4: Sentry PII Scrubbing
The `_sentry_before_send` hook correctly filters Authorization, Cookie, and API key headers before sending to Sentry.

---

## PRIORITY REMEDIATION ROADMAP

### Phase 1: Pre-Launch Blockers (Week 1-2)
1. Fix CORS wildcard (C4) — 5 minutes
2. Escape regex in search queries (C1) — 30 minutes
3. HTML-escape contact form email (C2) — 10 minutes
4. Add file size limit to blockchain upload (C3) — 15 minutes
5. Fix WebSocket token-in-URL (C6) — 1 hour
6. Add rate limiting to investor deck (H1) — 5 minutes

### Phase 2: Beta Hardening (Week 3-4)
7. Reduce JWT expiry + implement refresh tokens (C5) — 4 hours
8. Sanitize error messages (H2) — 2 hours
9. Add account lockout (H8) — 2 hours
10. Move SSO sessions to MongoDB (H5) — 1 hour
11. File type validation on uploads (H3, H4) — 1 hour

### Phase 3: Production Polish (Week 5-6)
12. Hash backup codes (M5) — 1 hour
13. Fix email enumeration (M8) — 15 minutes
14. Add request body size limit (M4) — 30 minutes
15. Constant-time password comparison (M2) — 5 minutes
16. Replace deprecated datetime.utcnow() (H7) — 1 hour

**Estimated total remediation effort: ~15-20 developer hours**

---

*Report generated by security audit of NotaryChain codebase. This is a static analysis — a dynamic penetration test is recommended before production launch.*
