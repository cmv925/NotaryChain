# NotaryChain E2E Suite (Playwright)

End-to-end smoke tests for the 5 critical user paths:

| # | Path | Spec |
|---|------|------|
| 1 | Login (UI auth, client + admin + invalid creds) | `tests/01-auth.spec.js` |
| 2 | Quick Seal (client-side SHA-256 at `/demo`) | `tests/02-quick-seal.spec.js` |
| 3 | Public Verify (`/verify` hash lookup + tabs) | `tests/03-verify.spec.js` |
| 4 | Notarize (request wizard + identity-gate + async-HCS latency) | `tests/04-notarize.spec.js` |
| 5 | Admin Approve (Command Authority dashboard + approval chain) | `tests/05-admin-approve.spec.js` |

## Running

```bash
cd /app/frontend
# Against the deployed/preview origin (read from REACT_APP_BACKEND_URL automatically):
PLAYWRIGHT_BROWSERS_PATH=/pw-browsers npx playwright test --config=e2e/playwright.config.js

# Or pin an explicit base URL:
E2E_BASE_URL=https://your-app.example.com npx playwright test --config=e2e/playwright.config.js
```

## Configuration (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `E2E_BASE_URL` | falls back to `REACT_APP_BACKEND_URL` | App origin under test |
| `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD` | `demo@test.com` / `Demo123!` | Client account |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `admin@notarychain.com` / `Admin123!` | Admin account |

## Notes
- Auth is seeded via the API (`/api/auth/login`) into `localStorage` for speed; the login UI is still exercised directly in `01-auth.spec.js`.
- The notarize spec accepts **either** `200` (verified client) **or** `403 identity_verification_required` (gated client) — both prove the gate is wired. It also asserts the endpoint returns in under 10s, validating the async HCS provisioning.
- Camera permission + fake media device flags are enabled so the Enhanced KBA selfie step never blocks a run.
- HTML report is written to `e2e/report/`.
