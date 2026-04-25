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
- Living Identity Phase 2 (Re-Attestation polish: public challenge QR page, notary "challenge before sign" UI hook, WebSocket events) (P1)
- Living Identity Phase 3 (Recovery flow polish, behavioral baseline drift over time, Admin drift analytics dashboard, GHL CRM hooks for drift events) (P2)
- Living Identity Phase 4 (ANAN Witness reads trust score, Auto-Learning patterns consume drift events) (P2)
- Bidirectional GHL sync (GHL → NotaryChain via `/api/ghl/webhook/inbound`) (P2)
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
