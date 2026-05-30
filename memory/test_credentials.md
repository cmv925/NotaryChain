# Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@notarychain.com | Admin123! |
| Regular User | demo@test.com | Demo123! |
| Notary | notarytest@test.com | Test123! |
| Notary | notary2@test.com | Notary123! |
| Viral signup test (beneficiary→user) | alice@example.com | Viral123! |

## Auth mechanism (updated May 30, 2026)
Auth now uses **httpOnly Secure cookies** (`access_token`, SameSite=Lax). The backend
**dual-reads**: cookie first, then `Authorization: Bearer` header (so API tests can still
send the Bearer token from the login response). Same-origin → cookies flow automatically.
- Login: `POST /api/auth/login` sets the cookie AND returns `access_token` in the body.
- `POST /api/auth/logout` clears the cookie. `POST /api/auth/session` exchanges a Bearer token → cookie (SSO).
- Backend tests must send a browser-like User-Agent (preview ingress bot-challenges defaults) — use `tests/credentials.py` / `tests/conftest.py` fixtures.

