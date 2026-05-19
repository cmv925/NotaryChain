# NotaryChain - Product Requirements Document

## Original Problem Statement
Build a sophisticated, futuristic notarization platform with AI-powered document analysis, blockchain sealing, biometric verification, and enterprise-grade features.

## Tech Stack
- **Frontend**: React, React Router, TailwindCSS, Shadcn UI, TensorFlow.js, PWA
- **Backend**: FastAPI, MongoDB (Motor), ReportLab/fpdf2/qrcode
- **Auth**: JWT + roles, 2FA/TOTP, API Keys | **AI**: GPT-5.2 via emergent-integrations
- **Blockchain**: Hedera Mainnet (HCS + HTS) | **Video**: Daily.co | **Payments**: Stripe
- **Email**: Resend (custom domain `email.notarychain.app` LIVE) | **Infra**: Sentry, AWS S3 | **SSO**: Auth0, Okta

## Completed Features (All Tested & Passing)

| Feature | Testing | Date |
|---------|---------|------|
| Core Platform (26 phases) | Iterations 1-78 | Mar 2026 |
| ANAN Agent Network | Iteration 79 | Apr 2, 2026 |
| Platform Features Suite | Iteration 80 | Apr 2, 2026 |
| HTS Tokenized Escrow + PWA | Iteration 81 | Apr 6, 2026 |
| HTS Real-Time Notifications | Iteration 82 | Apr 6, 2026 |
| Subscription Paywall (3 tiers) | Iteration 83 | Apr 8, 2026 |
| Ceremony Stage Notifications | Iteration 84 | Apr 19, 2026 |
| Freelancer Milestone Template | Iteration 84 | Apr 19, 2026 |
| Auto-Learning Threat Detection | Iteration 85 | Apr 19, 2026 |
| Investor Deck Update | Iteration 85 | Apr 19, 2026 |
| Supply Chain Escrow Template | Iteration 86 | Apr 23, 2026 |
| Resend Custom Domain (email.notarychain.app) | Iteration 86 | Apr 23, 2026 |
| Investor Deck Transaction Orchestrator Deep Dive | Iteration 86 | Apr 23, 2026 |
| GoHighLevel CRM Integration (Location PIT) | Iteration 87 | Apr 23, 2026 |
| Living Identity Notarization (Phase 1 MVP) | Iteration 88 | Apr 25, 2026 |
| Living Identity Phase 2 (Re-Attestation + WebSocket alerts) | Iteration 89 | Apr 25, 2026 |
| NotaryChain Verify (Public Verifier + Trust Badges) | Iteration 90 | Apr 26, 2026 |
| Trust Badge Marketing Landing + Stripe Checkout Funnel | Iteration 91 | Apr 26, 2026 |
| NotaryChain Verify Phase 2 (Public Notary Directory + Profile pages) | Iteration 92 | Apr 26, 2026 |
| TrustLayer Phase 1 MVP (Federated Trust Graph + Partner network + SDK) | Iteration 93 | Apr 26, 2026 |
| SALV Phase 1 MVP (Smart Asset Life-Cycle Vault + DMS + Beneficiary handoff) | Iteration 94 | Apr 26, 2026 |
| Trust Network Integration (SALV scheduler/emails + Beneficiary magic-link + SALV→TrustLayer auto-attest + /trust-hub) | Iteration 95 | Apr 26, 2026 |
| Florida RON Compliance Phase 1 / M1 (State profile + FL notary credentials + onboarding wizard + /florida landing) | Iteration 96 | May 12, 2026 |
| Florida RON Compliance Phase 1 / M2 (KBA adapter pattern + Mock provider + LexisNexis stub + quiz modal + rate limiting + fraud signals) | Iteration 97 | May 12, 2026 |
| Florida RON Compliance Phase 1 / M3 (FL ceremony pipeline: jurisdiction qualifier + GPS, online-will 2-witness flow + magic-link accept, A/V quality enforcement ≥720p/16kHz/30s, 10-yr S3 Object Lock retention with DB ledger fallback, single readiness gate before sealing) | Iteration 98 | May 12, 2026 |
| Florida RON Compliance Phase 1 / M4 (FL Stat. 117.245 journal logging with auto-log on FL ceremony seal + CSV export with date filters, admin compliance dashboard with KPI grid + ceremony gate matrix, subpoena response workflow: intake → scope → CSV bundle → respond + immutable audit_log) | Iteration 99 | May 12, 2026 |
| Florida RON Compliance Phase 1 / M5 (Public /florida launch polish with live KPI grid + RONSP status banner + recruitment CTA, FL notary recruitment portal at /florida/notaries with public lead capture, admin pipeline at /admin/fl-recruitment with status/notes/assignee + audit_log, full RONSP filing lifecycle tracker at /admin/fl-ronsp: draft → submitted → approved → renewing → expired/denied with auto-mirror to state_compliance_profiles) | Iteration 100 | May 12, 2026 |
| Field Document Scanner Phase 1 (mobile-first multi-page camera capture + base64 upload, canonical SHA256 doc hash, Hedera prior-seal lookup, GPT-5.2 Vision forgery analysis via EMERGENT_LLM_KEY, optional Hedera anchoring) + FL hard pre-seal gate in ceremony pipeline (blocks Hedera seal of FL ceremonies when KBA/AV/witnesses gates fail, sets status='fl_blocked' + fl_blocked_reasons) | Iteration 101 | May 12, 2026 |
| Dashboard Corporate Trust rebrand (final cleanup: avatar contrast, slate dividers, status pill palette, removed sky/emerald leftovers) | Screenshot smoke test | May 19, 2026 |
| Embeddable Notarize SDK Phase 1 — M1-M5 (loader JS at `/api/sdk/v1/notarychain.js`, publishable key CRUD with origin allowlist, public session creation, iframe ceremony page at `/embed/ceremony/:token` with postMessage bridge, HMAC-SHA256 signed webhooks, developer portal at `/developers/sdk`, keys management at `/developers/sdk-keys`, sdk_embed feature gate on Pro $99+ tier, demo key auto-creation) | Iteration 102 (18/18 backend pass, 100% backend / 95% frontend) | May 19, 2026 |
| Beneficiary Viral Loop (post-accept signup funnel on /handoff/:token with /api/salv/handoff/:token/signup endpoint, viral stats endpoint, idempotent upsert attribution to salv_handoff_conversions, acquisition_source tracking on users) + Client Portal /my-documents (unified hub aggregating sealed docs + notarizations + vault assets + received handoffs with search/filter/CSV export) | Iteration 103 (12/12 backend pass, 100% backend / 100% frontend after fix) | May 19, 2026 |
| SDK Phase 2 Hardening (event_secret enforcement on /sessions/{token}/event endpoint, demo key in-memory rate limit 10/hour/IP, webhook retry-with-backoff 3 attempts 1s/2s/4s, new /sessions/{token}/seal endpoint with REAL Hedera HCS anchoring on mainnet topic 0.0.10373605) + Multi-state Compliance-as-a-Service (RON statute abstracts for FL/TX/NY/CA/VA at /api/compliance/states + comparison matrix + admin status-matrix, public landing /compliance/states + per-state detail /compliance/states/:code with magazine-style layout, statute citations, gate-by-gate comparison, restrictions, registration cards) | Iteration 104 (18/18 backend pass, 100% backend / 100% frontend) | May 19, 2026 |

### Trust Badge Marketing Landing Page — COMPLETE (Apr 26, 2026)
**Conversion funnel for the Trust Badge revenue stream**

- **Public landing page at `/trust-badge`** (no auth) — full marketing site with:
  - Hero with gradient-text headline + dual CTAs ("Get Trust Badge $29/mo" + "See how it works")
  - Social proof strip: +18% conversion lift (Trustpilot/Norton studies), $1.5B McAfee SECURE annual rev, 74% consumers check trust signals, 60s setup
  - **Interactive badge customizer** — live client-side SVG preview, type business name, switch 4 styles (default/dark/light/minimal), toggle Verified ↔ Pending state, code snippet auto-updates with chosen style
  - 4-step "How it works" cards (Subscribe → Add domain → Paste snippet → Verify)
  - 6 use case cards (Notary firms, Title/escrow, B2B SaaS, Marketplaces, Legal/compliance, Real estate brokerages)
  - Pricing comparison: Pro ($49/mo, "POPULAR") vs Enterprise ($199/mo white-label)
  - 6-question FAQ (setup time, cancellation, compatibility, mobile, vs SiteSeal, Core Web Vitals impact)
  - Final CTA + cross-link to free `/verify` page
- **Stripe checkout integration** — all Subscribe buttons call existing `POST /api/subscriptions/checkout` with `plan_id` + `origin_url`, redirect to live Stripe Checkout (`cs_live_*`)
- **Auth-aware** — unauth users redirected to `/login?next=/trust-badge`, auth users go straight to Stripe
- **Cross-funnel** — `/verify` footer "Get your badge" CTA now points to `/trust-badge` (was `/badges`)
- **Test results**: 10/10 backend tests passing, 100% frontend, 0 issues, 0 console errors (testing agent iteration 91)
- **Live verification**: Real Stripe `cs_live_*` session created for $49/mo Professional plan from a fresh user signup → checkout flow validated end-to-end

### NotaryChain Verify — COMPLETE (Apr 26, 2026)
**Highest-leverage revenue stream — comparable to McAfee SECURE / Verisign trust seals ($1.5B / $400M annually each)**

- **Public verifier at `/verify`** (no auth required):
  - Document upload + drag-and-drop OR SHA256 hash paste → verifies against `blockchain_seals` collection
  - Certificate ID lookup → returns active/expired/revoked status with full lifecycle
  - Notary public profile → name, license, bond, SAN bond ID, sealing/ceremony stats, fraud flags
  - Three-tab UI with sleek result cards + Hedera explorer links + marketing footer
  - Badge banner shown when arrived via `?badge=xxx` query (e.g., user clicked a Trust Badge)
- **Trust Badge revenue stream** (Pro tier $49/mo, Enterprise white-label $199/mo):
  - User creates badge with domain + business name + style (default/dark/light/minimal)
  - Embeddable `<script>` widget OR plain `<img>` HTML — drop on any website
  - Domain ownership verification via DNS TXT record OR `/.well-known/notarychain.txt` (async DNS resolver, non-blocking)
  - Live SVG renderer with palette-aware design + impression tracking
  - Public widget JS uses `PUBLIC_BACKEND_URL` env var (deployment-portable)
  - Stats: impression counter increments per SVG render
- **Backend**: `/api/verify/*` namespace with 11 endpoints (3 public no-auth, 5 owner-auth, 2 admin-public-readonly, 1 widget JS)
- **Subscription gates**: `trust_badge` (pro) + `trust_badge_white_label` (enterprise)
- **Frontend pages**: `/verify` (public), `/badges` (protected), legacy `/verify-document` kept as `/verify-document` for back-compat
- **Test results**: 20/20 backend pytest passing, 100% frontend, 0 critical bugs (testing agent iteration 90)
- **Live verification**: Badge created end-to-end, SVG renders as `image/svg+xml`, widget.js works in production, structured upgrade_required 403 for free users

### Living Identity Phase 2 — COMPLETE (Apr 25, 2026)
- **Public Challenge endpoints** (no auth required — token IS auth):
  - `POST /api/living-identity/public-challenge/{token}` — submit biometric, get verification result with masked subject email + Hedera seal
  - `GET /api/living-identity/public-challenge/{token}/info` — preview token validity, subject info, expiry, uses remaining
  - Atomic uses_count increment, token expiry enforcement, exhaustion handling
- **WebSocket real-time alerts** in `_do_refresh`:
  - `living_identity_drift_detected` — fired when biometric drift OR behavioral signals detected. Severity, signals, current trust score.
  - `living_identity_score_changed` — fired on every score change with previous + new + tier + trigger
- **Frontend `/identity/challenge/:token` page** (public, no auth):
  - Intro state showing masked subject info, uses remaining, expiry
  - Webcam capture flow with retake/submit
  - Result card with passed/failed, match confidence %, trust score, Hedera explorer link
  - Invalid token state for expired/revoked tokens
- **Frontend dashboard QR modal** at `/identity`:
  - "Issue Challenge QR" button on Genesis Anchor card
  - Form for recipient label + duration days + max uses
  - Generates real QR via `qrcode.react` with copyable shareable URL
- **Live drift toast notifications** in dashboard via WebSocket subscription
- **Test results**: 19/19 backend tests passing, 100% frontend, 0 critical bugs (testing agent iteration 89)
- **Live verification**: Public challenge POST sealed on Hedera mainnet (seq #53), mask helper works (`a***n@notarychain.com`), QR opens working public challenge page

### Living Identity Notarization Phase 1 — COMPLETE (Apr 25, 2026)
**Trademarkable IP:** Genesis Anchor · Identity Drift Score · Re-Attestation Protocol · Identity Death Certificate · Living Identity Notarization (5 net-new trademarks)

- **New service**: `/app/backend/services/living_identity_service.py` — trust score algorithm (0-100, 4 tiers), GPT-5.2 Vision drift analysis, per-user Hedera HCS sealing, S3 SSE-S3 (BYOK-ready) blob storage, behavioral consistency scoring
- **11 new endpoints** at `/api/living-identity/*`: anchor, refresh, challenge, partner-challenge ($0.50/call billing), authorize-partner, score/{user_id}, history, me, revoke, recover, admin/drift, admin/billing
- **3 new subscription gates**: `living_identity_refresh` (Pro+), `living_identity_challenge` + `living_identity_partner_api` (Enterprise)
- **Frontend `/identity` dashboard**: Trust Score ring (animated), Genesis Anchor card, Drift Events feed, Score History sparkline, Snapshots Timeline, Capture Modal (webcam + behavioral baseline)
- **Investor Deck**: New Living Identity feature card added (slide 14 of 25)
- **Test results**: 21/21 backend pytest passing, 100% frontend, 0 critical bugs
- **Live verification**: Genesis Anchor created and sealed on Hedera mainnet (topic 0.0.10373605, seq #47), refresh produces drift-aware trust score, S3 blob with SSE-S3 encryption confirmed, all 11 endpoints validated end-to-end

### GoHighLevel CRM — COMPLETE (Apr 23, 2026)
- **Connection type**: Location-level Private Integration Token (PIT), always-on single-tenant
- **Target sub-account**: ClayTelligence (Location ID `3SOWx6wvvlOLJ9h0bJfu`) → NotaryChain pipeline (`0kIvOqYVlWs4KZWJgXW0`, 4 stages)
- **New service**: `/app/backend/services/ghl_service.py` — singleton async GHLService with retry/backoff, plus 5 fire-and-forget `sync_*` helpers wrapped in `_safe()` so CRM failures never break core flows
- **New routes**: `/api/ghl/status`, `/api/ghl/pipelines`, `/api/ghl/test/contact`, `/api/ghl/webhook/inbound` (all admin except webhook)
- **5 sync hooks wired**:
  1. User signup (`auth_routes.signup`) → upsert contact + tags + opportunity in Form Completed stage + note
  2. Ceremony sealed (`ceremony_routes`) → note with request_id + seal hash
  3. Escrow settled (`escrow_routes.settle_escrow`) → note to buyer/seller/creator with amount + hash
  4. HTS token minted (`hts_routes.mint`) → note with token_id + purpose
  5. Subscription upgraded (`subscription_routes.checkout`) → opportunity in Contract Signed stage + note
- **Admin UI**: `/admin/integrations` (new page) showing GHL status, pipeline list, email status + domain verification, test sync form, active sync hooks matrix
- **Inbound webhook placeholder**: `/api/ghl/webhook/inbound` persists events to `ghl_inbound_events` collection for future bidirectional sync
- **Test results**: 16/16 pytest backend tests passing. Real contacts verified in GHL with proper tags, pipeline placement, and event notes.

### Supply Chain Escrow Template — COMPLETE (Apr 23, 2026)
- Added `SUPPLY_CHAIN_CONDITIONS` (6 milestones: PO Confirmation → Production + QC → Shipment Dispatched → Customs Clearance → Delivery + POD → Final Inspection) in `/app/backend/routes/escrow_routes.py`
- Verification mix: party confirmation, AI photo (production inspection), shipping oracle (3 steps), biometric (final acceptance)
- Payment distribution: 10/20/20/10/20/20 across milestones
- Registered under `ESCROW_TEMPLATES['supply_chain']` with default parties "Buyer / Importer" + "Supplier / Exporter"
- Exposed via `GET /api/escrow/templates` (now 3 templates) and activates for `escrow_type='supply_chain'`

### Resend Custom Domain — COMPLETE (Apr 23, 2026)
- `.env` updated: `SENDER_EMAIL=noreply@email.notarychain.app`, new `CUSTOM_SENDER_EMAIL`, `CUSTOM_EMAIL_DOMAIN`, empty `RESEND_API_KEY_CUSTOM` placeholder
- `email_service.py` auto-detects custom domain: if `RESEND_API_KEY_CUSTOM` is set, uses dedicated key; otherwise derives `EMAIL_MODE` from active sender domain matching `CUSTOM_EMAIL_DOMAIN`
- Domain `email.notarychain.app` already verified under the default Resend API key → mode reports `custom_domain` and emails send live
- New admin endpoint `GET /api/email/domain-status` queries Resend `/domains` API and returns verification state, DNS records, and setup instructions if unverified
- `GET /api/email/status` enhanced to report `mode`, `active_sender`, key presence, and advisory note

### Investor Deck Transaction Orchestrator Deep Dive — COMPLETE (Apr 23, 2026)
- New dedicated interactive slide (16/24 in deck) after the Live Demo
- Top capability strip (6 items): Blueprint Engine, Multi-Party Roles, AI Risk Engine, Dependency Graph, On-Chain Audit, In-App Messaging
- Blueprint selector with 3 live blueprints: Real Estate Closing (10 steps, 45d, risk 34), Business Contract (7 steps, 14d, risk 22), Estate Settlement (7 steps, 90d, risk 58)
- Left panel: animated dependency graph with critical path (`CRIT`) markers and step owners
- Middle panel: animated AI Risk Meter (green/amber/red), top risk factors with probability + AI mitigation strategy, participant role chips
- Right panel: Next-Best Action card, Hedera HCS Audit panel (topic 0.0.10373605, event count, immutability), TAM Unlock ($58B)
- **Bug fix**: Previously `totalSlides=19` but `FEATURES` array had 10 items → slides 9-12 were hidden. Refactored `DeckPresentation` to use dynamic indices (INTRO_COUNT + FEATURE_COUNT + CONTENT_AFTER). Total now 24 slides with all 10 feature slides rendering.
- `SLIDE_LABELS` expanded to 24 entries for nav dots

## Remaining / Upcoming
- None pending from user request batch

## Future/Backlog
- NotaryChain Verify Phase 2 (mobile wallet PWA polish, offline doc storage, batch verification, public notary directory) (P1)
- TrustLayer (Universal Trust Verification Network) — federated partner API, multi-chain interop (P2)
- Living Identity Phase 3 (Notary "challenge before sign" UI hook, Recovery flow polish, Admin drift analytics, GHL CRM hooks for drift) (P1)
- Living Identity Phase 4 (ANAN Witness reads trust score, Auto-Learning patterns consume drift events) (P2)
- Smart Asset Life-Cycle Vault (SALV) (P3 — needs anchor pilot first)
- Bidirectional GHL sync (P2)
- Add more languages (DE, PT, JA, ZH) (P2)
- Embeddable Trust Badge for 3rd party websites (P3)
- Ceremony Analytics Dashboard (Admin facing) (P3)
- Document Template Marketplace (P3)
- Client Portal (P3)
- Webhook Event Catalog & Playground (P3)
- Multi-Currency Escrow (USD, EUR, GBP, HBAR) (P3)
- Notary Marketplace with Reviews (P3)
- Batch Certificate Generation (P3)
- Audit Log Export (SOC2/ISO) (P3)
- Smart Contract Escrow (Hedera native contracts) (P3)

## Key API Endpoints (Recent)
- `GET /api/escrow/templates` — returns real_estate, freelancer, supply_chain
- `GET /api/email/status` — email service mode/sender info
- `GET /api/email/domain-status` — admin-only Resend domain verification state

## Test Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@notarychain.com | Admin123! |
| User | demo@test.com | Demo123! |
| Notary | notarytest@test.com | Test123! |
| Notary2 | notary2@test.com | Notary123! |
| Investor Deck | N/A | NotaryChain2026! |
| Viral signup test (beneficiary→user) | alice@example.com | Viral123! |
