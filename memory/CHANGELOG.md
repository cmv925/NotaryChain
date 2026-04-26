# NotaryChain Changelog

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
