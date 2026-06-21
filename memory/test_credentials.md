# Test Credentials — NotaryChain

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@notarychain.com | Admin123! |
| Regular user | demo@test.com | Demo123! |
| FL Notary (identity-verified) | notarytest@test.com | Test123! |

Notes:
- `demo@test.com` is NOT identity-verified → cannot mint a Sovereign ID (gate returns 403, expected).
- `notarytest@test.com` is identity-verified → can mint Sovereign ID.
- Auth is cookie-based (httponly, secure, samesite=lax). Use a cookie jar for curl tests.
- `DATA_ENCRYPTION_KEY` (backend/.env) encrypts Ed25519 private keys at rest (envelope/AES-256-GCM). Do not rotate without re-wrapping existing records.
