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

### Core Platform (Phases 1-26) — ALL COMPLETE
### ANAN — Autonomous Notary Agent Network — COMPLETE
### On-Chain Hedera Bond Management — COMPLETE
### Role-Specific Onboarding Tour — COMPLETE

### Dynamic Escrow Intelligence — COMPLETE (Apr 1, 2026)
**Trust Gap 1: Execution** — AI Orchestrator extracts Performance Triggers, locks funds in smart vault
**Trust Gap 2: Verification** — Oracle-based automated verification (shipping, inspection, appraisal, title) + AI Photo Verification via GPT-5.2 Vision
**Trust Gap 3: Security** — Biometric Proof of Intent via GPT-5.2 Vision (facial geometry + liveness)

### Real-Time WebSocket Escrow Notifications — COMPLETE (Apr 1, 2026)
- Backend emits WebSocket events for: `escrow_oracle`, `escrow_biometric`, `escrow_settlement`, `escrow_photo_verified`
- `_emit_escrow_event` helper resolves buyer/seller/creator emails to user IDs and calls `broadcast_event`
- Frontend subscribes via `useWS()` hook, shows toast notifications, auto-refreshes escrow data
- **LIVE** indicator in escrow detail header shows WebSocket connection status
- **Live Events feed** card in sidebar shows real-time event stream with timestamps
- Testing: 100% pass rate — iteration_75 (22/22 backend + all frontend)

## Key API Endpoints
- `POST /api/escrow/create` — Create escrow
- `POST /api/escrow/{id}/extract-conditions` — AI extract performance triggers
- `POST /api/escrow/{id}/deposit` — Deposit into smart vault
- `POST /api/escrow/{id}/verify-condition` — Party confirmation
- `POST /api/escrow/{id}/oracle-verify/{cid}` — Oracle automated verification (+ WS emit)
- `POST /api/escrow/{id}/photo-verify/{cid}` — AI photo verification (+ WS emit)
- `POST /api/escrow/{id}/biometric-gate` — Biometric Proof of Intent (+ WS emit)
- `POST /api/escrow/{id}/settle` — Execute settlement (+ WS emit)

## Upcoming Tasks
- Resend Domain Verification (user task) (P1)

## Future/Backlog
- Connect real Hedera Token Service (HTS) for on-chain tokenized escrow (P2)
- Add Freelancer Milestone and Supply Chain escrow templates (P2)
- Add more languages (DE, PT, JA, ZH) (P2)
- Auto-learning threat detection from GPT-5.2 responses (P3)

## Test Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@notarychain.com | Admin123! |
| User | demo@test.com | Demo123! |
| Notary | notarytest@test.com | Test123! |
| Investor Deck | N/A | NotaryChain2026! |
