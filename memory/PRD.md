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

### Template System — COMPLETED (Feb 25, 2026)
- 8 pre-built legal templates with search/filter
- AI Form-Fill Wizard with Gemini-powered field suggestions
- PDF generation (ReportLab) with professional legal formatting
- Draft save/resume with auto-versioning and revision history
- Share drafts via link (view-only or editable), cross-user collaboration
- My Drafts page, Shared Draft Viewer

### Enterprise Features — COMPLETED (Feb 25, 2026)
- Multi-tenancy: Organizations with full CRUD
- Member management: invite, accept, role changes (owner/admin/member), remove
- SSO configuration: OIDC/SAML provider settings, allowed domains

### Organization Document Vault — COMPLETED (Feb 26, 2026)
- Upload docs with categorization, tagging, descriptions
- List/search/filter documents with category and text search
- Role-based access, audit trail, vault statistics

### Document Expiry Notifications — COMPLETED (Feb 27, 2026)
**Backend:** `expiry_routes.py`, `expiry_service.py`
- Set/update/remove expiry dates on notarization requests
- Expiry dashboard API with status calculation (expired/critical/warning/approaching/active)
- Background service checks every hour and sends notifications at 30/7/1/0 day thresholds
- Email notifications via Resend for expiring documents
- In-app notifications via WebSocket

**Frontend:** `ExpiryTracker.jsx`
- ExpiryWidget on dashboard showing all tracked documents sorted by urgency
- Summary pills (expired, critical, warning, approaching counts)
- ExpiryBadge inline on notarization request cards
- SetExpiryButton with date picker to manage expiry dates
- Real-time notification bell updates for expiry alerts

**Testing:** 100% (15/15 backend, all frontend)

### Real-time Collaboration Expansion — COMPLETED (Feb 27, 2026)
**Backend:** `draft_collab_routes.py`
- WebSocket endpoint `/api/ws/draft/{draft_id}` for draft-specific rooms
- Auth-gated WebSocket with JWT validation
- Presence tracking: who is viewing/editing a draft
- Cursor position broadcasting between collaborators
- Typing indicators (start/stop)
- Live field edit broadcasting for real-time co-editing

**Frontend:** `CollaborationPresence.jsx`, `useDraftCollaboration.js`
- PresenceBar: shows live connection status, user avatars, count
- FieldCollabIndicator: per-field typing/cursor indicators
- useDraftCollaboration hook: manages WebSocket lifecycle
- Conflict warnings when remote edits are received
- Integrated into SharedDraftViewer page

**Testing:** 100% - WebSocket connects, presence shows, fields editable

## Architecture
```
/app
├── backend/
│   ├── routes/ (auth, admin, notary, ai, blockchain, payment, subscription,
│   │           template, organization, draft, vault, public_api, webhook,
│   │           expiry, draft_collab, etc.)
│   ├── services/ (cache, email, notification, orchestrator, storage,
│   │             task_manager, webhook, template_wizard, expiry)
│   └── server.py
└── frontend/src/
    ├── components/ (notarization/, ui/, OrgVault, ExpiryTracker,
    │               CollaborationPresence, BiometricVerification, etc.)
    ├── contexts/ (AuthContext, WebSocketContext)
    ├── hooks/ (useGlobalWebSocket, useDraftCollaboration, etc.)
    ├── pages/ (Dashboard, TemplateLibrary, TemplateWizard, MyDrafts,
    │          SharedDraftViewer, OrganizationPage, RequestNotarization, etc.)
    └── App.js
```

## Key API Endpoints
- `/api/organizations/` — Org CRUD + members + SSO
- `/api/vault/{org_id}/documents` — Document vault CRUD + download + stats
- `/api/drafts/` — Draft CRUD + sharing + revisions
- `/api/templates/` — Template library + generate PDF + AI suggest
- `/api/expiry/requests/{id}` — Set/get/remove expiry dates
- `/api/expiry/dashboard` — All documents with expiry status
- `/api/ws/draft/{draft_id}` — WebSocket for draft collaboration

## Upcoming Tasks
- **P1: Cloud Integration** — Migrate to AWS S3 (awaiting user credentials)

## Future/Backlog
- Full SSO integration (SAML/OIDC) using existing groundwork
- Enterprise Features Expansion
