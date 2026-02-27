# NotaryChain - Product Requirements Document

## Original Problem Statement
Build a sophisticated, futuristic notarization platform with AI-powered document analysis, blockchain sealing, biometric verification, and enterprise-grade features.

## Tech Stack
- **Frontend**: React, React Router, TailwindCSS, Shadcn UI, TensorFlow.js
- **Backend**: FastAPI, MongoDB (Motor), ReportLab/fpdf2 (PDF generation)
- **Authentication**: JWT with roles, 2FA/TOTP, API Keys
- **AI**: Google Gemini via emergent-integrations
- **Blockchain**: Hedera Hashgraph (Testnet)
- **Video**: Daily.co (RON)
- **Payments**: Stripe (checkout + subscriptions)
- **Email**: Resend
- **Infrastructure**: Sentry, cachetools, background tasks, storage abstraction

## Completed Features

### Phases 1-26: Core + Enterprise Platform — ALL COMPLETED
Website clone, Demo, Auth (multi-role + 2FA), Notary system, AI Analysis, Blockchain, Stripe, Video, Biometrics, Crypto, Compliance/Audit, Email, Notarization Package, Notary Onboarding, AI Orchestrator, Security, WebSockets, Mobile Responsive, Subscriptions, Notary Professional, GDPR, Infrastructure, Real-time Collaboration, Public API, RON Compliance, Webhooks

### Template System — COMPLETED
Templates, AI Wizard, PDF generation, Drafts, Sharing, Versioning

### Enterprise Features — COMPLETED
Multi-tenancy, Organizations, Member management, SSO configuration

### Organization Document Vault — COMPLETED
Upload, search, filter, role-based access, audit trail

### Document Expiry Notifications — COMPLETED (Feb 27, 2026)
- Expiry date management on notarization requests (set/update/remove)
- Background service with threshold-based notifications (30/7/1/0 days)
- Email + in-app notifications
- Dashboard widget with urgency sorting

### Real-time Collaboration Expansion — COMPLETED (Feb 27, 2026)
- WebSocket presence tracking per draft room
- Cursor/typing indicators, live field edit broadcasting
- PresenceBar and FieldCollabIndicator components
- Conflict warnings for remote edits

### Revenue & Conversion Enhancements — COMPLETED (Feb 27, 2026)

**Phase 1: Document Renewal Workflow**
- POST `/api/expiry/requests/{id}/renew` creates new request pre-filled from original
- Renew button on expired/critical docs in Expiry Tracker widget
- Testing: 100%

**Phase 2: Bulk Notarization**
- Full CRUD at `/api/bulk/batches` (create, list, detail, delete)
- Multi-document batch creation (1-20 docs per batch)
- Batch status tracking with completion progress
- Frontend: `/bulk-notarization` page with batch management
- Testing: 100%

**Phase 3: Notary Marketplace with Reviews**
- Public notary search at `/api/marketplace/notaries` with filters (state, specialization, RON, rating sort)
- Notary profile pages with ratings, reviews, completed counts
- Review CRUD requiring completed notarization validation
- Frontend: `/marketplace` page with search, filters, cards, and profile detail
- Testing: 100%

**Phase 4: Subscription Usage Enhancement**
- `/api/subscriptions/usage/history` returns 6-month usage analytics
- Monthly breakdown of notarizations, AI analyses, and seals
- Testing: 100%

**Phase 5: White-Label / Embeddable Widget**
- Full CRUD at `/api/embed/configs` for embed configurations
- Public endpoint `/api/embed/public/{key}` for widget config
- Embed snippet generation with custom branding
- Toggle active/disabled, usage tracking
- Frontend: `/white-label` page with config management
- Testing: 100%

## Architecture
```
/app
├── backend/
│   ├── routes/ (auth, admin, notary, ai, blockchain, payment, subscription,
│   │           template, organization, draft, vault, public_api, webhook,
│   │           expiry, draft_collab, bulk, marketplace, embed, etc.)
│   ├── services/ (cache, email, notification, orchestrator, storage,
│   │             task_manager, webhook, template_wizard, expiry)
│   └── server.py
└── frontend/src/
    ├── components/ (notarization/, ui/, OrgVault, ExpiryTracker,
    │               CollaborationPresence, BiometricVerification, etc.)
    ├── contexts/ (AuthContext, WebSocketContext)
    ├── hooks/ (useGlobalWebSocket, useDraftCollaboration, etc.)
    ├── pages/ (Dashboard, BulkNotarization, NotaryMarketplace,
    │          WhiteLabelPage, TemplateLibrary, TemplateWizard, etc.)
    └── App.js
```

## Key API Endpoints
- `/api/expiry/requests/{id}/renew` — Renewal workflow
- `/api/bulk/batches` — Batch CRUD
- `/api/marketplace/notaries` — Public notary search
- `/api/marketplace/reviews` — Review CRUD
- `/api/embed/configs` — Embed config management
- `/api/embed/public/{key}` — Public widget config
- `/api/subscriptions/usage/history` — Usage analytics

## Upcoming Tasks
- **P1: Cloud Integration** — Migrate to AWS S3 (awaiting user credentials)

## Future/Backlog
- Full SSO integration (SAML/OIDC)
- Enterprise Features Expansion
- Recurring Notarization Subscriptions with discounted per-doc rates
- Additional marketplace features (notary availability calendar, booking)
