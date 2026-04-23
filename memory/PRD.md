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
- GoHighLevel CRM integration (P2) — deferred by user
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
