# NotaryChain Changelog

## May 12, 2026 — Florida RON Compliance Phase 1 / M2 (KBA Integration)

### Knowledge-Based Authentication (KBA)
- New `routes/kba_routes.py` with 6 endpoints (status, start, submit, session detail, admin fraud signals).
- **Adapter pattern**: abstract `KBAProvider` interface; `MockKBAProvider` (active now, synthetic 5-question quiz with deterministic seed per user); `LexisNexisKBAProvider` stub (auto-activates when `LEXISNEXIS_API_KEY` env var is set — no code change required).
- **FL Stat. 117.295 compliance** baked in: 5 questions, 4-of-5 to pass, 120-second time limit, max 2 attempts per principal per 24 hours (429 on exceed), `kba_attempts` ledger for audit.
- **Fraud signals**: server-side device fingerprint (UA + accept-language hash) + IP capture; rapid retry from different device emits `kba_device_mismatch` signal.
- **Security**: correct answers stored server-side only (`_questions_internal`), stripped from all API responses + sanitized session view; session ownership enforced (403 on cross-user access).
- New frontend `components/KBAQuizModal.jsx` — full quiz modal: intro screen (compliance info + attempt counter), question carousel with progress bar, live countdown timer with low-time warning, result screen with pass/fail; emits MOCK badge when MockKBAProvider active.
- New frontend `/kba-test` page — admin/dev harness to preview the modal and view provider status (auth-gated).
- Testing: iteration_97 — 17/17 backend pytest + full frontend e2e all pass.
- ⚠️ **MOCKED**: LexisNexis InstantID Q&A — MockKBAProvider in use until real API key + contract provisioned.


## May 12, 2026 — Florida RON Compliance Phase 1 / M1 (Foundation)

### State Compliance Profile + FL Notary Credentials + Public FL Landing
- New `routes/fl_compliance_routes.py` with 11 endpoints:
  - Public: state-profile, notaries/public, eligibility/{user_id}
  - Notary: POST /notary/onboard (5-field validated wizard), GET /notary/credentials
  - Admin: pending/verified lists, decision approve/reject, set RONSP filing metadata
- Canonical FL state profile constants (FL Stat. 117.201-117.305, KBA req, 10yr retention, $25K bond min, online wills enabled with 2 witnesses, etc.) — pattern reusable for other states.
- Indexes: `fl_notary_credentials` (user_id + fl_commission_number unique), `state_compliance_profiles` (state_code unique).
- New frontend pages:
  - **`/florida`** — public marketing landing with hero, live stats (verified notaries count, RONSP status), use cases (RE/Estate/Business), compliance grid, notary directory, 5-question FAQ, dual CTAs.
  - **`/notary/onboard/florida`** — protected 5-step wizard (Commission → Bond → Training → Seal → Review) with idempotent updates, validation gates, and status screens (`pending_review`, `verified`, `rejected`).
- Testing: iteration_96 — 16/16 backend pytest + full frontend e2e all pass.
- Next: M2 (KBA via LexisNexis), M3 (FL ceremony pipeline + jurisdiction qualifier + online will witnesses), M4 (FL journal export + admin compliance dashboard), M5 (public launch).


## Apr 26, 2026 — Trust Network Integration Layer

### Cross-feature: SALV ↔ TrustLayer ↔ Living Identity ↔ Email/Resend
- New `services/salv_service.py`:
  - **Background scheduler** (hourly) — surfaces dead-man's-switch warnings/triggers and asset overdue notifications via Resend; idempotent per asset/vault.
  - **Auto-attestation issuer** — when an asset value ≥ $100K, issues a TrustLayer attestation (`high_value_asset_under_custody`, $100K+/$250K+/$500K+/$1M+/$10M+ brackets) under a self-created system partner ("NotaryChain Asset Vault"). Re-issues on re-verify, revokes when value drops or asset deleted/transferred.
  - **Handoff token issuance** — opaque single-use tokens stored hashed in `salv_handoff_tokens` (30-day TTL).
- `salv_routes.py` extended:
  - `POST /assets/{id}/trigger-handoff` now issues per-beneficiary tokens + sends Resend invitations.
  - Public no-auth endpoints `GET /handoff/{token}` and `POST /handoff/{token}/accept` — single-use token claim flow that flips beneficiary→accepted; once all beneficiaries accept, asset auto-flips to `transferred` and SALV attestation revokes.
- New frontend pages:
  - `/handoff/:token` (public) — beneficiary magic-link claim page with asset preview, share %, accept CTA.
  - `/trust-hub` (auth) — unified dashboard with score ring, three pillar cards (Living Identity / TrustLayer / Asset Vault), copyable share link, recent attestation activity.
- Dashboard navigation updated — added Trust Hub (accent), Living Identity, Asset Vault entries to Security & Identity section.
- Robustness: switched `r.clone().json()` pattern across HandoffAccept, TrustGraph, NotaryProfile to fix StrictMode/SW double-read showing "body stream already read" error text.
- Testing: iteration_95 — 11/11 integration pytest + 23/23 SALV regression + frontend e2e all pass.


## Apr 26, 2026 — SALV Phase 1 MVP

### Smart Asset Life-Cycle Vault
- New `routes/salv_routes.py` with full CRUD + lifecycle endpoints:
  - Vault: auto-created per user, settings (name + dead-man's-switch interval), check-in.
  - Assets: 9 asset types (deed/title/IP/will/custody/financial/license/contract/other), value, jurisdiction, document_hash auto-link to NotaryChain seal, scheduled re-verification.
  - Beneficiaries: name/email/relationship/share_percent (total ≤ 100%), trigger conditions.
  - Handoff: manual `POST /assets/{id}/trigger-handoff` notifies beneficiaries and flips status; emits structured events.
  - Admin sweep: `POST /admin/scan` flags overdue assets + DMS warnings/triggers.
- Indexes: `salv_vaults`, `salv_assets` (incl. `next_verification_at` for due-soon scans), `salv_beneficiaries`, `salv_events`.
- New page `/asset-vault` (auth required) — single dashboard with stat cards, dead-man's-switch panel, asset list with overdue/due-soon highlighting, asset detail panel (re-verify, handoff, delete), inline beneficiary management, vault settings modal.
- Testing: iteration_94 — 23/23 backend pytest + frontend e2e all pass.


## Apr 26, 2026 — TrustLayer Phase 1 MVP

### Universal Trust Verification Network
- New backend `routes/trustlayer_routes.py` exposing 11 endpoints:
  - Admin: create/list partners, rotate API key, toggle status.
  - Partner (X-TrustLayer-Key auth): create attestations, revoke own attestations, real-time `verify`.
  - Public: trust graph for any user_id, single attestation lookup, public partner registry, embeddable SVG badge `/badge/{user_id}.svg` and drop-in widget `sdk.js`.
- Trust score blends partner attestations + Living Identity score (max).
- New collections + indexes: `trust_partners` (slug+partner_id+key_hash), `trust_attestations` (subject_user_id desc).
- Frontend pages:
  - `/trustlayer` — public marketing landing with partner registry, SDK snippets, copy buttons.
  - `/trust-graph/:userId` — public federated trust graph with score ring, attestation cards, revoked/expired states.
  - `/admin/trustlayer` — admin partner CRUD with one-time API key reveal banner, rotate, enable/disable.
- Robustness fix applied to TrustGraph + NotaryProfile error parsing (avoid double `.json()` read on error responses).
- Testing: iteration_93 — 19/19 backend pytest + frontend e2e all pass.


## Apr 26, 2026 — NotaryChain Verify Phase 2

### Public Notary Directory & Profile Pages
- **`/notaries`** — public, SEO-indexable notary directory with name search, US state filter, and pagination (24/page).
- **`/notary/:notaryId`** — public notary profile with sealing stats, license, bond status, fraud flags, and CTAs to verify documents and book sessions.
- Backend: `GET /api/verify/notaries` (q, state, limit, offset) and `GET /api/verify/notary/{id}` already exposed; both no-auth.
- Cross-link from `/verify` Notary tab → directory ("Browse the public notary directory").
- Minor UX fix: `/identity` Score History tier labels (90/70/40) refactored into a left flex column so they no longer overlap chart gridlines.
- Testing: iteration_92, 15/15 backend pytest + frontend e2e all pass.


## Mar 27, 2026

### React Lazy Loading & Performance Optimization
- 50+ pages converted to React.lazy() with Suspense fallback (PageLoader spinner)
- Critical path pages (HomePage, LoginPage, SignUpPage) remain eager-loaded
- Testing: 100% pass rate (iteration_58)

### Analytics Dashboard with Recharts Charts
- Full analytics tab in AdminDashboard with 7 chart sections
- Summary Cards: Total Revenue, New Users, Notarizations, Transactions
- Revenue Trends AreaChart (Stripe + Crypto), User Growth LineChart
- Payment Distribution PieChart, Notarization Volume BarChart
- Top Performing Notaries list, Document/Transaction Types progress bars
- Period selector (7/30/90/180/365 days) with live data refresh
- Testing: 100% pass rate (iteration_58)

### i18n Internationalization Setup
- Languages: EN, ES, FR with 41 translation keys
- Applied to: HeroSection, Navbar, LoginPage, SignUpPage, Dashboard
- LanguageSwitcher dropdown with localStorage persistence
- Testing: 100% pass rate (iteration_58)

## Mar 26, 2026

### SSO Routes Refactor
- Split sso_routes.py into sso_common.py, auth0_routes.py, okta_routes.py

### Marketplace UI Enhancement
- Review submission form, availability preview in notary profiles

### Custom RBAC Policy Builder Visual Editor
- Grid/list view modes, inline permission toggling

### Advanced Availability Calendar Widget
- Weekly overview, slot period grouping

### Automated Incident Reporting
- Backend incident aggregation with PDF export

## Mar 15, 2026

### Configurable Alert Settings, Security Compliance Dashboard
### S3 Storage Analytics, SOC2 Export PDF
### Landing Page Refresh, Guided Onboarding Flow
### Service Degradation Alerts, Audit Log Fix
### Auth0 + Okta SSO Integration

## Mar 14, 2026

### Hedera Mainnet Migration, Stripe Live Mode
### Operations Dashboard, Full Session Package Email
### HBAR Balance Alert Service
