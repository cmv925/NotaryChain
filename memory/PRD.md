# NotaryChain - Product Requirements Document

## Original Problem Statement
Build a sophisticated, futuristic notarization platform with AI-powered document analysis, blockchain sealing, biometric verification, and enterprise-grade features.

## Tech Stack
- **Frontend**: React, React Router, TailwindCSS, Shadcn UI, TensorFlow.js
- **Backend**: FastAPI, MongoDB (Motor), ReportLab/fpdf2 (PDF generation)
- **Authentication**: JWT with roles, 2FA/TOTP, API Keys
- **AI**: OpenAI GPT-5.2 via emergent-integrations
- **Blockchain**: Hedera Hashgraph (Mainnet)
- **Video**: Daily.co (RON)
- **Payments**: Stripe (Live Mode)
- **Email**: Resend
- **Infrastructure**: Sentry, cachetools, background tasks, AWS S3 (boto3)

## Completed Features

### Phases 1-26: Core + Enterprise Platform — ALL COMPLETED
Website clone, Demo, Auth (multi-role + 2FA), Notary system, AI Analysis, Blockchain, Stripe, Video, Biometrics, Crypto, Compliance/Audit, Email, Notarization Package, Notary Onboarding, AI Orchestrator, Security, WebSockets, Mobile Responsive, Subscriptions, Notary Professional, GDPR, Infrastructure, Real-time Collaboration, Public API, RON Compliance, Webhooks

### Template System — COMPLETED
### Enterprise Features — COMPLETED
### Role-Based Access Control (RBAC) — COMPLETED
### Full SSO Integration (Auth0 + Okta) — COMPLETED
### Permission-based UI Rendering — COMPLETED
### Security Audit & Fixes — COMPLETED
### Hedera Mainnet Integration — COMPLETED
### Stripe Live Mode — COMPLETED
### Operations Dashboard — COMPLETED
### Full Session Package Email — COMPLETED
### HBAR Balance Alert Service — COMPLETED
### Analytics Dashboard with Recharts — COMPLETED
### i18n Internationalization (EN, ES, FR) — COMPLETED
### Multi-Agent Notarization Ceremony — COMPLETED
### GPT-5.2 Vision Biometrics — COMPLETED
### Real Witness Agent (Merkle Tree) — COMPLETED
### Ceremony Certificate PDF — COMPLETED
### Universal Breadcrumbs — COMPLETED
### Public Certificate Verification — COMPLETED
### Webcam Face Capture — COMPLETED
### Dynamic Escrow Intelligence — COMPLETED
### Real GPT-5.2 AI Contract Parsing for Escrow — COMPLETED

### Autonomous Notary Agent Network (ANAN) — COMPLETED (Mar 29, 2026)
- 3-agent GPT-5.2 blind consensus swarm (Verifier, Witness, Sealer)
- HITL escalation queue, Shareable Verification Badges
- Dynamic Fraud Intelligence (8 patterns, 8 RON jurisdictions)
- Agent Reputation & Self-Tuning Weights

### Modernized Bento-grid Dashboard with Role-based Filtering — COMPLETED (Mar 31, 2026)

### On-Chain Hedera Bond Management — COMPLETED (Mar 31, 2026)
- **Backend**: `HederaBondService` class in `services/hedera_service.py`
  - Creates dedicated HCS topic for bond events (topic `0.0.10415918` on mainnet)
  - Records all bond slash/restock events to Hedera HCS as immutable audit trail
  - Bond state verification by comparing DB balance with on-chain ledger replay
  - Lazy topic initialization with DB persistence in `system_settings`
- **Backend**: Updated `anan_swarm.py` — `apply_bond_event()` and `restock_bond()` now submit to HCS alongside MongoDB
- **New Endpoints**:
  - `GET /api/anan/bond/status` — Now returns `on_chain` section (enabled, bond_topic_id, network)
  - `GET /api/anan/bond/ledger` — On-chain bond event history from Hedera mirror node (admin/notary only)
  - `GET /api/anan/bond/verify` — Verifies bond state DB vs chain (admin/notary only)
- **Frontend**: ANAN Dashboard bond card now shows ON-CHAIN LEDGER section with ACTIVE badge, topic ID, MAINNET label, and "Verify On-Chain" button
- Testing: 100% pass rate — 16/16 backend + all frontend (iteration_73)

### Role-Specific Onboarding Tour — COMPLETED (Mar 31, 2026)
- **Frontend**: `OnboardingTour.jsx` rewritten with 3 role-specific step sets:
  - **Admin Tour** (5 steps): Notifications, ANAN Network, Fraud Intelligence, Escrow, Analytics
  - **Notary Tour** (5 steps): Notifications, Upload Docs, ANAN Ceremonies, AI Generator, Biometric Passport
  - **User Tour** (5 steps): Notifications, Upload Docs, AI Generator, Doc Remediation, Escrow
- Role badge displayed in tour tooltip (e.g., "Admin Tour", "Notary Tour", "User Tour")
- Dashboard passes `userRole={user?.role}` prop to OnboardingTour
- Testing: 100% pass rate — all 3 roles verified (iteration_73)

### Additional Completed Features (abbreviated)
- Landing Page Refresh, Guided Onboarding, Service Degradation Alerts
- SOC2 Security Export, S3 Storage Dashboard
- AI Co-pilot, AI Document Generator, AI Summarizer, Video Witness
- Booking Calendar, Revenue Enhancements, Custom Branding, Dark/Light Theme
- Approval Workflows, Document Comparison, Smart Reminders
- Organization Webhooks, Scheduled Reports, Incident Reporting
- Transaction Timeline, Real-Time Timeline Streaming
- RBAC Policy Builder, Advanced Calendar Widget, Marketplace Enhancements
- SSO Routes Refactor, React Lazy Loading, Investor Demo Flow

## Architecture
```
/app
├── backend/
│   ├── routes/
│   │   ├── anan_routes.py         # ANAN ceremonies, bond, reputation, badges
│   │   ├── fraud_intelligence_routes.py  # Threat patterns & RON rules
│   │   ├── escrow_routes.py       # AI-powered escrow
│   │   └── ... (40+ route files)
│   ├── services/
│   │   ├── anan_swarm.py          # GPT-5.2 blind consensus engine + on-chain bond
│   │   ├── anan_reputation.py     # Agent weight auto-tuning
│   │   ├── fraud_intelligence_service.py  # Jurisdictional fraud injection
│   │   ├── hedera_service.py      # HCS + HederaBondService (on-chain bond)
│   │   └── ... (15+ service files)
│   └── server.py
└── frontend/src/
    ├── components/
    │   ├── OnboardingTour.jsx     # Role-specific guided tours
    │   └── ... (20+ components)
    ├── pages/
    │   ├── Dashboard.jsx          # Bento-grid role-based dashboard
    │   ├── ANANDashboard.jsx      # Swarm agent monitoring + on-chain bond
    │   ├── FraudIntelligencePage.jsx  # Threat intelligence
    │   ├── EscrowDashboard.jsx    # AI escrow management
    │   └── ... (50+ pages)
    └── App.js
```

## Key API Endpoints
- `POST /api/anan/ceremony/start` — Init ANAN ceremony
- `POST /api/anan/ceremony/{id}/execute` — Run blind consensus
- `GET /api/anan/bond/status` — Bond with on-chain info
- `GET /api/anan/bond/ledger` — On-chain bond events (admin/notary)
- `GET /api/anan/bond/verify` — Verify DB vs chain (admin/notary)
- `POST /api/anan/reputation/tune` — Auto-adjust agent weights
- `GET /api/anan/badge/{id}` — Embeddable verification badge

## Upcoming Tasks
- Resend Domain Verification (user task — verify domain on resend.com)

## Future/Backlog
- Connect real Hedera Token Service (HTS) for on-chain tokenized escrow (P2)
- Add Freelancer Milestone and Supply Chain escrow templates (P2)
- Add more languages (DE, PT, JA, ZH) & extract translation files (P2)
- Auto-learning threat detection from GPT-5.2 responses (P3)
- ANAN: Multi-jurisdiction RON automation with real-time rule updates (P3)
- ANAN: Real deepfake detection model integration (P3)

## Test Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@notarychain.com | Admin123! |
| User | demo@test.com | Demo123! |
| Notary | notarytest@test.com | Test123! |
| Investor Deck | N/A | NotaryChain2026! |
