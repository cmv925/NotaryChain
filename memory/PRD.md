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
- **Infrastructure**: Sentry, cachetools, background tasks, storage abstraction, AWS S3 (boto3)

## Completed Features

### Phases 1-26: Core + Enterprise Platform — ALL COMPLETED
Website clone, Demo, Auth (multi-role + 2FA), Notary system, AI Analysis, Blockchain, Stripe, Video, Biometrics, Crypto, Compliance/Audit, Email, Notarization Package, Notary Onboarding, AI Orchestrator, Security, WebSockets, Mobile Responsive, Subscriptions, Notary Professional, GDPR, Infrastructure, Real-time Collaboration, Public API, RON Compliance, Webhooks

### Template System — COMPLETED
Templates, AI Wizard, PDF generation, Drafts, Sharing, Versioning

### Enterprise Features — COMPLETED
Multi-tenancy, Organizations, Member management, SSO configuration

### Role-Based Access Control (RBAC) — COMPLETED (Feb 27, 2026)
- **Backend:** `rbac_routes.py` — Full CRUD for custom roles with granular permissions
- 23 permissions across 7 categories (Documents, Vault, Members, Templates, Approvals, Notarization, Organization)
- 3 auto-created system roles per org: Organization Admin (all perms), Editor (11 perms), Viewer (5 perms)
- Custom role creation, editing, deletion (system roles protected from deletion)
- Role assignment to org members via dedicated endpoints
- Effective permissions endpoint resolving role inheritance
- **Frontend:** `RBACManagement.jsx` — Role editor modal with category-grouped permission checkboxes
- Roles tab in Organization page, custom role dropdown in Members tab

### Full SSO Integration (Mock SAML/OIDC) — COMPLETED (Feb 27, 2026)
- **Backend:** `sso_routes.py` — Simulated SSO authentication flow
- Domain-based SSO discovery, session-based flow initiation
- Mock IdP consent flow with JIT (Just-In-Time) user provisioning
- Auto-join org on SSO login, audit logging of SSO events
- SSO configuration testing endpoint for admins
- **Frontend:** `SSOLoginPage.jsx` — Multi-step SSO login (email discovery → org selection → mock IdP authorize → complete)
- Enterprise SSO button on login page, SSO settings tab on org page

### Permission-based UI Rendering — COMPLETED (Feb 28, 2026)

### Security Audit & Critical Fixes — COMPLETED (Feb 2026)
- Conducted full security audit: identified 6 Critical, 8 High, 9 Medium, 5 Low issues
- **All 6 Critical fixed:** CORS wildcard, regex injection (3 routes), HTML injection in email, blockchain file size limit, JWT expiry 7d→24h, WebSocket token moved from URL to message-based auth
- **All 8 High fixed:** Rate limiting on investor deck, error message sanitization (blockchain + payment), file type validation on uploads, notary upload size check, SSO sessions moved to MongoDB, deprecated datetime.utcnow→datetime.now(timezone.utc) across all files, account lockout after 5 failed logins (15min cooldown)
- **7 of 9 Medium fixed:** Constant-time password comparison, hashed 2FA backup codes with bcrypt, email enumeration prevention (generic signup error), global 10MB request body size limit, template PDF field sanitization, Content-Disposition: attachment on all file downloads, admin audit logging (already existed)
- Testing: 100% pass rate — all 12 security features verified
- Full report: `/app/security_audit_report.md`

### Low-Severity Security Fixes — COMPLETED (Mar 14, 2026)
- **L1 — Password Blacklist:** Expanded from 10 to 100+ common passwords (top NIST list) in `middleware/security.py`
- **L3 — Security.txt:** Added `/.well-known/security.txt` (RFC 9116) with security contact in `frontend/public/.well-known/security.txt`
- **L5 — Health Check Obfuscation:** Removed version number, renamed service identifiers (mongodb→database, stripe→payments), removed error details and non-essential service checks from public health endpoint

### Hedera Mainnet Integration — COMPLETED (Mar 14, 2026)
- Migrated from testnet to mainnet using user-provided mnemonic phrase
- Derived ECDSA private key from 24-word BIP39 mnemonic via BIP44 Hedera path (m/44'/3030'/0'/0/0)
- Account: `0.0.10373542`, funded with 172 HBAR
- Created default mainnet HCS topic: `0.0.10373605`
- First mainnet seal recorded: sequence #1, verified on HashScan
- Explorer: https://hashscan.io/mainnet/topic/0.0.10373605

### Stripe Live Mode — COMPLETED (Mar 14, 2026)
- Replaced test key (`sk_test_emergent`) with user-provided live key
- Live checkout sessions (`cs_live_*`) verified working
- Zero code changes — env-only migration

### Operations Dashboard — COMPLETED (Mar 14, 2026)
- New admin-only "Operations" tab in AdminDashboard showing real-time production metrics
- **Backend**: `routes/ops_dashboard_routes.py` — `GET /api/admin/ops/metrics` aggregates data from Hedera, S3, Stripe, and MongoDB
- **Hedera Section**: HBAR balance, total/mainnet seals, HCS submission stats, 30d seal trend, estimated cost
- **S3 Section**: Bucket name, total files, total size, per-category breakdown (seals, credentials, etc.)
- **Stripe Section**: Total/30d revenue, payment counts, active subscriptions, revenue trend chart
- **System Health**: Live status indicators for all 4 services with pulsing green dots
- **Low Balance Alert**: Automatic warning when HBAR drops below 10
- Testing: 100% pass rate — all backend API + frontend UI tests passed

### Full Session Package Email — COMPLETED (Mar 14, 2026)
- Enhanced `send_notarization_complete_email` in `services/email_service.py` to accept full `package_data`
- Email now includes 4 comprehensive sections:
  - **AI Document Analysis** (blue): Number of analyses, document filenames, types, verification status
  - **Biometric Verification** (dynamic color): Pass/fail count, confidence scores, overall status
  - **Notary Session Details** (purple): Notary name, license #, state, RON certification, video session duration
  - **Hedera Blockchain Proof** (green): Network, seal hash, HCS topic, transaction ID, package ID, HashScan explorer link
- Updated `complete_notarization` endpoint in `routes/notary_routes.py` to compile sealed package data and pass to email
- Testing: 100% pass rate — all package compilation, sealing, email queuing flows verified
- Note: Resend email delivery requires domain verification for non-owner recipients

### HBAR Balance Alert Service — COMPLETED (Mar 14, 2026)

### Auth0 SSO Integration — COMPLETED (Mar 15, 2026)
- Real Auth0 OIDC integration replacing the mocked SSO
- **Backend** (`routes/sso_routes.py`): Auth0 login URL generator, PKCE callback handler, JIT user provisioning
  - `GET /api/sso/auth0/login` — generates Auth0 authorization URL with state (CSRF protection)
  - `POST /api/sso/auth0/callback` — exchanges code for tokens, fetches userinfo, creates/syncs user, issues JWT
  - `GET /api/sso/auth0/status` — check if Auth0 is configured
- **Frontend**: "Sign in with Auth0" button on LoginPage, Auth0Callback page at `/auth/callback`
- Users are JIT-provisioned in MongoDB on first Auth0 login with `auth0_sub` stored for identity linking
- Works alongside existing email/password auth — no breaking changes
- Auth0 Domain: `dev-ec3s8jabv4ei2wjs.us.auth0.com`
- Testing: 100% pass rate — 13 backend + all frontend tests passed

### Okta SSO Integration — COMPLETED (Mar 15, 2026)
- Real Okta OIDC integration alongside Auth0
- **Backend** (`routes/sso_routes.py`): Okta login URL generator, callback handler, status endpoint
  - `GET /api/sso/okta/login` — generates Okta authorization URL via `/oauth2/default/v1/authorize`
  - `POST /api/sso/okta/callback` — exchanges code via `/oauth2/default/v1/token`, fetches userinfo, JIT provisions user
  - `GET /api/sso/okta/status` — check if Okta is configured
  - `GET /api/sso/providers` — lists all configured SSO providers (Auth0 + Okta)
- **Frontend**: "Sign in with Okta" button (blue) on LoginPage, OktaCallback page at `/auth/okta/callback`
- Okta Domain: `trial-1257751.okta.com`, Client ID: `0oa110cnei9quynQC698`
- **Bug fix (Mar 15, 2026):** Fixed redirect_uri mismatch — corrected Okta Client ID and Client Secret in backend/.env to match the Okta application with the registered redirect URIs
- Testing: 100% pass rate — 12 backend + all frontend tests passed (iteration_52)

### Configurable Alert Settings Panel — COMPLETED (Mar 15, 2026)
- **Backend** (`routes/alert_settings_routes.py`):
  - `GET /api/admin/ops/alert-settings` — returns current settings (defaults if not customized)
  - `PUT /api/admin/ops/alert-settings` — update thresholds, interval, cooldown, notification channels
  - Settings stored in MongoDB `system_settings` collection, validated (interval 5–1440min, cooldown 1–168h)
- **Backend** (`services/hbar_alert_service.py`): Refactored to read settings dynamically from DB via `reload_settings()`
  - Supports per-threshold enable/disable, configurable check interval, and email/in-app notification toggles
- **Frontend**: Alert Configuration panel in Operations tab with Edit/Save, channel toggles, threshold controls
- Admin-only (403 for non-admin users)
- Testing: 100% pass rate — 17 backend + all frontend tests passed (iteration_53)

### Security Compliance Dashboard — COMPLETED (Mar 15, 2026)
- **Backend** (`routes/security_compliance_routes.py`):
  - `GET /api/admin/security/compliance` — returns security posture across 6 categories
- **6 Categories**: Authentication (4 items), SSO (3 items), Data Protection (4 items), Network & Transport (5 items), Authorization & RBAC (3 items), Monitoring & Alerting (3 items)
- **22 total security features** tracked with live status detection from env vars and DB queries
- **Score calculation**: Percentage of active features shown in circular progress indicator
- **Frontend**: New "Security" tab in Admin Dashboard with score banner + 6 category cards
- Admin-only (403 for non-admin users)
- Testing: 100% pass rate — included in iteration_53
- New background service: `services/hbar_alert_service.py` — checks balance every 30 minutes
- **3 alert levels**: Warning (< 50 HBAR), Critical (< 10 HBAR), Emergency (< 1 HBAR)
- **In-app notifications**: Created for all admin users when threshold triggered
- **Email alerts**: Sent to admins with detailed balance info, account ID, network, explorer links
- **Audit logging**: All alerts stored in `hbar_balance_alerts` MongoDB collection
- **24-hour cooldown**: Won't repeat same threshold alert within cooldown period
- **Alert history**: Displayed in Operations Dashboard with color-coded severity badges
- Auto-clears cooldown when balance recovers above threshold

### S3 Storage Dashboard Enhancements — COMPLETED (Mar 15, 2026)
- **Backend** (`routes/ops_dashboard_routes.py`): `GET /api/admin/ops/storage-analytics`
- Per-user storage usage breakdown (top 20 by size)
- Upload activity trend (daily counts, last 30 days) with bar chart visualization
- Cost projections: current GB, monthly cost ($0.023/GB S3 Standard), 12-month projected cost
- Growth rate calculation (current 30d vs previous 30d)
- Testing: 100% pass rate — iteration_54, iteration_55

### SOC2 Security Audit Export — COMPLETED (Mar 15, 2026)
- **Backend** (`routes/soc2_export_routes.py`): `GET /api/admin/security/export-pdf`
- Professional PDF report using ReportLab: score banner, summary table, all 6 security categories
- One-click download from Security tab with audit log entry
- Admin-only access, filename includes date
- Testing: 100% pass rate — iteration_54, iteration_55

### Landing Page Refresh — COMPLETED (Mar 15, 2026)
- **Frontend** (`components/HeroSection.jsx`): Modernized hero with animated grid background
- "Production-Ready on Hedera Mainnet" status badge with pulsing indicator
- 4 trust indicator cards: SOC2 Compliant, Hedera Mainnet, AI-Powered, Biometric ID
- Updated CTAs: "Get Started Free" → /signup, "Live Demo" → /demo
- Testing: 100% pass rate — iteration_54, iteration_55

### Guided Onboarding Flow — COMPLETED (Mar 15, 2026)
- **Frontend** (`pages/OnboardingPage.jsx`): 4-step onboarding for new users
- Step 1: Welcome with platform highlights
- Step 2: Role selection (Individual, Business, Notary Professional)
- Step 3: Personalized feature recommendations based on role
- Step 4: Completion with quick-action shortcuts to key features
- Route: `/onboarding` (authenticated, ProtectedRoute)
- Testing: 100% pass rate — iteration_54, iteration_55

### Service Degradation Alerts — COMPLETED (Mar 15, 2026)
- **Backend** (`services/service_health_monitor.py`): Background service monitoring MongoDB, S3, Stripe, Hedera
- 5-minute check interval, 60-minute cooldown per service
- Auto-detects degradation AND recovery — sends appropriate notifications
- In-app + email alerts to all admin users when service goes down
- Health snapshot stored in `system_settings`, alerts in `service_health_alerts` collection
- **API**: `GET /api/admin/ops/service-health` — live health check with recent alerts
- **Frontend**: Service Health panel in Operations tab with color-coded cards per service
- Testing: 100% pass rate — 23/23 backend + all frontend (iteration_55)

### Audit Log 500 Error Fix — COMPLETED (Mar 15, 2026)
- Fixed `AuditLogResponse` model to use default values for optional fields
- Added try/except around log parsing to handle mixed schema entries
- `GET /api/audit/logs` now returns 200 (was 500)

### SSO Routes Refactor — COMPLETED (Mar 26, 2026)
- Split `sso_routes.py` (684 lines) into 4 focused modules:
  - `sso_common.py` — shared helpers (get_callback_base, sync_sso_user, session management)
  - `auth0_routes.py` — Auth0 OIDC login/callback/status
  - `okta_routes.py` — Okta OIDC login/callback/status
  - `sso_routes.py` — Enterprise SSO (discover, initiate, callback, test, providers) - slimmed to ~240 lines
- All endpoints maintain identical URL paths — zero frontend changes required
- Testing: 100% pass rate — 11/11 backend + all frontend (iteration_56)

### Marketplace UI Enhancement — COMPLETED (Mar 26, 2026)
- **Review Submission Form**: Interactive 5-star rating, comment textarea, submit/cancel buttons
- **Availability Preview**: Weekly availability grid in notary profile (Mon-Sun with slot counts)
- Auto-fetches notary availability when viewing profile
- data-testid attributes: write-review-btn, review-form, review-star-1 to -5, review-comment, submit-review-btn, notary-availability
- Testing: 100% pass rate (iteration_56)

### Organization Invite Modal Enhancement — COMPLETED (Mar 26, 2026)
- Replaced dropdown with visual role cards (Admin/Member) with icons and descriptions
- Admin: "Full access — manage members, billing, settings, and SSO" (Shield icon)
- Member: "Standard access — create and manage own documents" (Users icon)
- data-testid: invite-role-admin, invite-role-member
- Testing: 100% pass rate (iteration_56)


### Custom RBAC Policy Builder Visual Editor — COMPLETED (Mar 26, 2026)
- **Frontend** (`components/RBACManagement.jsx`): Completely rebuilt with two view modes
  - **Grid View**: Visual permission matrix with role columns × permission rows, toggle switches per cell
  - **List View**: Expandable role cards with effective permissions preview per category
  - Inline permission toggling (click grid cell to toggle, auto-saves)
  - Category-aware UI with color-coded icons (Documents, Vault, Members, Templates, etc.)
  - Permission progress bar in role editor, Select All / Clear All shortcuts
- Create/Edit modal with categorized checkboxes and indeterminate state
- Testing: 100% pass rate (iteration_57)

### Advanced Availability Calendar Widget — COMPLETED (Mar 26, 2026)

### React Lazy Loading & Performance Optimization — COMPLETED (Mar 27, 2026)
- **App.js**: 50+ pages converted to `React.lazy()` with `Suspense` fallback (PageLoader spinner)
- Critical path pages (HomePage, LoginPage, SignUpPage) remain eager-loaded
- Lazy-loaded routes include: Dashboard, AdminDashboard, Marketplace, BookingCalendar, all AI pages, all transaction pages, SSO callbacks, etc.
- Testing: 100% pass rate — all routes navigate without blank screens (iteration_58)

### Analytics Dashboard with Recharts Charts — COMPLETED (Mar 27, 2026)
- **Frontend** (`AdminDashboard.jsx`): Full analytics tab with 7 chart sections
  - **Summary Cards**: Total Revenue, New Users, Notarizations, Transactions (with data-testid)
  - **Revenue Trends**: AreaChart with Stripe (purple gradient) and Crypto (orange gradient) dual series
  - **User Growth**: LineChart with Total Users and New Users dual series
  - **Payment Distribution**: Donut PieChart with dynamic colors per payment type
  - **Notarization Volume**: BarChart with Completed/Pending stacked bars
  - **Top Performing Notaries**: Ranked list with medal badges (#1 gold, #2 silver, #3 bronze)
  - **Document Types & Transaction Types**: Progress bar visualizations
- **Period Selector**: 7/30/90/180/365 day range with live data refresh
- **Backend**: `GET /api/admin/analytics/comprehensive` aggregates data from users, payments, crypto_payments, notarization_requests, transactions collections
- Testing: 100% pass rate (iteration_58)

### i18n Internationalization Setup — COMPLETED (Mar 27, 2026)
- **Libraries**: `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- **Languages**: English (EN), Spanish (ES), French (FR)
- **Translation keys**: nav (6), hero (7), trust (4), auth (12), dashboard (5), marketplace (22), notary (19), security (22), common (7) = ~80 keys per language
- **Pages with i18n applied**: HeroSection, Navbar (desktop + mobile), LoginPage, SignUpPage, Dashboard, NotaryMarketplace, NotaryDashboard, SecuritySettings
- **LanguageSwitcher**: Dropdown component with flag labels, localStorage persistence
- Testing: 100% pass rate — all 3 languages verified across all pages (iteration_58, iteration_59)

### Multi-Agent Notarization Ceremony — COMPLETED (Mar 27, 2026)
- **Architecture**: 3-agent pipeline (Verifier, Witness, Sealer) + 2-of-3 Consensus Oracle
- **Backend**: `ceremony_routes.py` with POST /start, GET /{id}, POST /{id}/execute, GET /list/my
- **Verifier Agent**: Simulated biometric match, ID forensics, liveness proof, face comparison
- **Witness Agent**: Simulated session timeline, Merkle tree audit, evidence packaging
- **Sealer Agent**: Simulated jurisdiction/compliance checks, blockchain preparation
- **Consensus Oracle**: 2-of-3 voting — APPROVED (2+ PASS), REJECTED (2+ FAIL), REVIEW (else)
- **Frontend**: `CeremonyDashboard.jsx` with live pipeline view, 3 agent cards with animated states, consensus display, blockchain seal info, ceremony history sidebar
- **Dashboard Integration**: "Ceremony Mode" button in Quick Actions grid
- **Note**: Verifier and Witness agents are SIMULATED (architecture-first). Sealer Agent connected to REAL Hedera Mainnet.
- **SSE Streaming**: GET /api/ceremony/{id}/stream provides real-time events (ceremony_started, agent_started×3, agent_completed×3, consensus_started, sealing_blockchain, consensus_reached, ceremony_complete)
- **Hedera Integration**: seal_document() via hedera_service, real HCS topic 0.0.10373605, hcs_submitted=true, explorer URL
- Testing: 100% pass rate backend + frontend (iteration_60, iteration_61)

- **Frontend** (`pages/BookingCalendar.jsx`): Enhanced booking experience
  - Weekly Availability Overview: 7-day grid showing slot count + hours per day
  - Slot Period Grouping: Morning (before noon), Afternoon (12-5pm), Evening (5pm+)
  - Visual indicators for available vs booked slots with disabled states
- **Marketplace** (`pages/NotaryMarketplace.jsx`): Availability preview in notary profile detail
- Testing: 100% pass rate (iteration_57)

### Automated Incident Reporting — COMPLETED (Mar 26, 2026)
- **Backend** (`routes/incident_routes.py`):
  - `GET /api/admin/incidents?days=7` — Lists all service incidents with timeline events, duration, status
  - `GET /api/admin/incidents/export-pdf?days=30` — Downloadable PDF incident report
  - Groups sequential degradation/recovery alerts into incidents automatically
  - Calculates incident duration, tracks ongoing vs resolved status
- **Frontend**: Incidents panel in Operations tab with:
  - Summary badges (total, resolved, ongoing)
  - "All Clear" state with green checkmark when no incidents
  - Expandable incident cards with event timeline
  - One-click PDF export for stakeholder communication
- Testing: 100% pass rate — 13/13 backend + all frontend (iteration_57)

- **Storage Service:** `services/storage_service.py` — Unified StorageService with S3 (boto3) + local filesystem fallback
- S3 bucket: `notarychain-documents` (us-east-2), pre-signed URL generation for downloads
- **server.py fix:** Moved `load_dotenv()` before route imports so StorageService singleton picks up AWS credentials
- **Routes migrated to S3:**
  - `vault_routes.py` — Upload, download (presigned URL redirect), delete
  - `document_routes.py` — File serving with S3 presigned URL redirect
  - `notary_professional_routes.py` — Seal upload/download/delete via S3
  - `branding_routes.py` — Logo upload/download via S3
  - `witness_routes.py` — Video upload via S3
  - `scheduled_reports_routes.py` — PDF generation → S3 upload, download via presigned URL
  - `notary_routes.py` — Credential upload migrated from base64-in-MongoDB to S3
  - `ai_routes.py` — Document analysis files uploaded to S3
  - `summarizer_routes.py` — Temp file upload to S3, cleanup after processing
- **Removed:** Direct local filesystem writes from all routes, base64 credential storage
- **Testing:** 100% pass rate — S3 upload, presigned URL, download, delete all verified


### Investor Demo Flow — COMPLETED (Feb 2026)
- **Backend:** `investor_deck_routes.py` — Password verification (`/api/investor-deck/verify-password`) and contact form (`/api/investor-deck/contact`) with Resend email + MongoDB storage
- **Frontend:** `InvestorDeck.jsx` — Password-protected cinematic auto-playing presentation at `/investor-deck`
- 16 slides: Hero (platform stats) → IP Portfolio (8 trademarkable names) → 6 Feature showcases (AI Orchestrator, Biometric Passport, Blockchain Sealing, Enterprise RBAC, Smart Templates, Real-Time Collaboration) → 4-Phase AI Pipeline → Feature Breakdown (11 categories, 67 features) → Architecture Diagram → Tech Stack → Infrastructure → Platform Metrics → Market Opportunity → Contact Form
- Data sourced from live website pages: /full-feature-list and /architecture
- Navigation: keyboard arrows, scroll wheel, click arrows, right-side nav dots with labels, auto-play (6s interval) with pause/play toggle
- Contact form submissions stored in MongoDB `investor_inquiries` collection and emailed via Resend
- Testing: 100% pass rate — Backend 2/2, Frontend 16/16 slides verified
- **Backend:** `GET /api/organizations/{org_id}/my-permissions` — returns current user's effective permissions, base_role, custom_role, source
- **Frontend Hook:** `usePermissions(orgId)` — fetches and caches user's RBAC permissions with helpers: `hasPermission()`, `hasAny()`, `hasAll()`
- **Frontend Component:** `<PermissionGate>` — conditionally renders children based on permissions (single, any-of, all-of modes). Shows lock indicator when `showLock=true`
- **Applied across Organization page:** Tabs filtered by permissions (owner=6 tabs, default member=2 tabs), Invite/Remove/Role management buttons gated, Vault upload/delete gated, Settings delete gated
- **OrgVault:** Upload/delete actions gated by `vault:upload`/`vault:delete` permissions
- **Settings tab:** Shows user's effective permissions summary with count and source badge

### Recurring Notarization Subscriptions with Per-Doc Discounts — COMPLETED (Feb 28, 2026)
- **Backend:** Added `discount_pct` to all subscription plans (Starter=0%, Professional=15%, Enterprise=35%)
- `GET /api/subscriptions/discount` — returns user's current discount rate and billing-cycle savings
- `POST /api/subscriptions/calculate-discount` — previews discounted price for any notarization package
- `POST /api/payments/checkout` — now applies subscription discount server-side to Stripe checkout amount
- Payment transactions track `original_amount`, `discount_applied`, `discount_pct`, `plan_id`
- **Frontend:** Pricing page shows per-doc discount badges on Pro and Enterprise plans
- Subscription page shows discount savings card (discount rate, saved this cycle, docs discounted)

### Activity Audit Log Dashboard — COMPLETED (Feb 28, 2026)
- **Backend:** `org_activity_routes.py` — Org-scoped activity log system
- `GET /api/organizations/{org_id}/activity` — paginated, filterable activity logs (action type, days, actor)
- `GET /api/organizations/{org_id}/activity/stats` — aggregated statistics (by action, by actor, daily trend)
- `GET /api/organizations/{org_id}/activity/export` — export logs as JSON
- `log_org_activity()` helper integrated into RBAC routes (role create/update/delete/assign)
- **Frontend:** `OrgActivityLog.jsx` — full-featured activity dashboard with timeline view, stats panel, search, filters, pagination, and export
- New "Activity" tab in Organization page (permission-gated by `org:settings`)

### Organization Webhooks — COMPLETED (Mar 2, 2026)
- **Backend:** `org_webhook_routes.py` — Full webhook management system
- CRUD for webhook endpoints (URL, events, description, active toggle)
- HMAC-SHA256 payload signing (X-Webhook-Signature header)
- 3-attempt retry with exponential backoff delivery engine
- 11 supported event types: document.notarized, document.uploaded, member.joined/removed/invited, role.assigned/created, approval.created/decided, vault.uploaded, sso.login
- Test webhook, rotate secret, delivery log endpoints
- Max 10 webhooks per org, admin-only access
- **Frontend:** `OrgWebhooks.jsx` — Webhook management UI in Organization page
- Create/edit modal with URL input, event checkboxes by category, select all
- Webhook list with status indicators, event counts, last delivery badge
- Expandable details: subscribed events, masked secret, delivery log
- Actions: Test, Edit, Enable/Disable, Rotate Secret, Delete
- Integrated with RBAC: role.created and role.assigned fire webhooks to subscribed endpoints

### Scheduled Reports — COMPLETED (Mar 2, 2026)
- **Backend:** `scheduled_reports_routes.py` — Downloadable PDF report system
- Configurable schedule (weekly/monthly) with 5 selectable sections: Activity, Notarizations, Members, Webhooks, Billing
- PDF generation using reportlab with formatted tables per section
- Data aggregation from org_activity_logs, documents, notary_requests, org_members, rbac_roles, org_webhooks, webhook_deliveries, subscriptions, payment_transactions
- Background scheduler (hourly check) for auto-generation based on configured frequency
- Manual "Generate Now", download PDF, delete report endpoints
- Admin-only access, paginated report list, full data snapshot in detail view
- **Frontend:** `OrgReports.jsx` — Report management UI in Organization page
- Configure panel: frequency toggle (weekly/monthly), section checkboxes with icons, active/paused toggle
- Reports list with download PDF and delete buttons
- Expandable preview with data snapshot cards (events, documents, members, delivery rate, revenue)

### Organization Document Vault — COMPLETED
Upload, search, filter, role-based access, audit trail

### Document Expiry Notifications — COMPLETED (Feb 27, 2026)
Expiry date management, background checker, email + in-app notifications, dashboard widget

### Real-time Collaboration Expansion — COMPLETED (Feb 27, 2026)
WebSocket presence tracking, cursor/typing indicators, live co-editing

### Revenue & Conversion Enhancements — COMPLETED (Feb 27, 2026)
- Phase 1: Document Renewal Workflow (one-click renew)
- Phase 2: Bulk Notarization (batch creation, management)
- Phase 3: Notary Marketplace with Reviews (search, profiles, ratings)
- Phase 4: Subscription Usage Enhancement (usage analytics)
- Phase 5: White-Label Embed (config management, embed snippets)

### Notary Booking Calendar — COMPLETED (Feb 27, 2026)

**Backend:** `booking_routes.py`
- Notary availability management: weekly schedule (day/start/end), session duration, break time
- Blocked dates management (CRUD)
- Intelligent slot generation: generates available time slots accounting for weekly schedule, blocked dates, existing bookings, and past time filtering
- Full booking CRUD: create (also creates linked notarization request with HCS topic), list user/notary bookings
- Booking lifecycle: pending → confirmed → completed / cancelled
- Confirm/cancel/complete actions with proper role/status checks
- Email + in-app notifications for bookings (new, confirmed, cancelled)
- Duplicate slot prevention (409 Conflict)

**Frontend:**
- `BookingCalendar.jsx` — Interactive month-view calendar with:
  - Visual available/unavailable date indicators
  - Time slot grid on date selection
  - Booking form with document details
  - Success confirmation with booking details
- `MyBookings.jsx` — User booking management with:
  - Upcoming/Past sections
  - Status filters (All, Pending, Confirmed, Completed, Cancelled)
  - Join Session button for confirmed bookings (links to video)
  - Cancel button for active bookings
- `NotaryAvailabilitySettings.jsx` — Notary schedule management:
  - Add/remove weekly time slots (day, start, end)
  - Session duration and break time configuration
  - Blocked dates management (add/remove)
- Marketplace integration: "Book a Session" button on notary profiles
- Dashboard: "My Bookings" quick action button
- NotaryDashboard: "Schedule" tab with availability settings

**Testing:** 97% backend (28/29 — 1 intermittent HCS timeout), 100% frontend

### AI & Video Features — COMPLETED (Feb 27, 2026)

**1. AI Co-pilot for Notaries** (`copilot_routes.py`)
- POST /api/ai-copilot/analyze: Analyzes notarization request data via Gemini AI
- Returns: summary, key highlights, inconsistency flags, risk level, readiness score, checklist, recommendations
- POST /api/ai-copilot/prefill-journal: Auto-fills notary e-journal fields from request data
- Integrated into NotaryDashboard RequestDetailModal with dedicated copilot panel

**2. AI Document Generator** (`ai_generator_routes.py`, `AIDocumentGenerator.jsx`)
- Generate legal documents from natural language descriptions
- 8 document types: Bill of Sale, Will, Lease, NDA, Promissory Note, Contractor Agreement, Liability Waiver, Affidavit
- Iterative refinement: generate → review → refine with feedback
- Full history: my-documents listing, individual document retrieval

**3. AI Document Summarizer** (`summarizer_routes.py`, `AIDocumentSummarizer.jsx`)
- Upload any document (PDF, images, TXT, DOC) for instant AI summary
- 3 detail levels: brief, standard, detailed
- Extracts: key terms, parties, dates, obligations, notable clauses, complexity level
- Full history with retrieval

**4. Video Witness Recording** (`witness_routes.py`, `VideoWitness.jsx`)
- Browser-based video recording with webcam/microphone
- 2 verification types: Standard (30s, 5 steps) and Enhanced (60s, 6 steps)
- Upload to server with notary notification
- Notary review workflow: pending → under_review → approved/rejected
- Recording history with status tracking

**Frontend Integration:**
- Dashboard: Quick action buttons for AI Generator, AI Summarizer, Video Witness
- Routes: /ai-generator, /ai-summarizer, /video-witness
- NotaryDashboard: AI Co-pilot panel in request detail modal

**Testing:** 100% backend (22/22), 100% frontend

### AI Transaction Orchestrator™ Enhancement — COMPLETED (Feb 27, 2026)

**Phase 1: AI Document Remediation** (`remediation_routes.py`, `DocumentRemediation.jsx`)
- POST /api/remediation/analyze: AI analyzes document text, identifies missing legal clauses, weak language, risk areas
- Returns: overall_risk_score, missing_clauses with severity + suggested_text, weak_language, risk_areas, compliance_notes
- POST /api/remediation/apply-clauses: Applies selected clauses into document via AI insertion
- GET /api/remediation/history: User's remediation history
- Frontend: Document type selector, text input, clause selection with checkboxes, remediated output viewer

**Phase 2: Biometric Passport** (`biometric_passport_routes.py`, `BiometricPassportPage.jsx`)
- POST /api/biometric-passport/generate: Synthesizes facial + voiceprint + liveness into unified credential
- Weighted composite scoring (facial 45%, voiceprint 30%, liveness 25%)
- Cryptographic hash of all biometric data for tamper-proof verification
- GET /api/biometric-passport/verify/{id}: Public integrity verification endpoint
- Passport validity: 90 days, requires facial + 1 other modality minimum
- Frontend: Session ID input, passport list with verify buttons, modality breakdown

**Phase 3: AI Conductor Mode** (`conductor_routes.py`, `AIConductorPage.jsx`)
- POST /api/conductor/guide: LLM-powered personalized step-by-step guidance per participant role
- Returns: greeting, current_status_summary, next_steps with urgency/estimated_time/tips, blockers, timeline_estimate
- POST /api/conductor/chat: Interactive Q&A about transaction context
- GET /api/conductor/status/{id}: Per-participant progress overview
- Frontend: Guidance panel with step cards + real-time chat panel with suggested questions

**Phase 4: Evidence Package** (`evidence_package_routes.py`, `EvidencePackagePage.jsx`)
- POST /api/evidence-package/generate/{id}: Compiles forensic-grade evidence bundle
- Bundles: transaction metadata, participants, tasks, documents, AI analyses, remediations, biometric passports, witness recordings, communication records, blockchain proof
- SHA-256 integrity hash + component-level hashes for granular verification
- Auto-generated at settlement (integrated into transaction settle flow)
- GET /api/evidence-package/verify/{id}: Public package integrity verification
- Frontend: Collapsible sections for each evidence category, hash display, blockchain explorer link

**Integration Points:**
- Dashboard: Quick action buttons for Doc Remediation + Biometric Passport
- Transaction Room header: AI Conductor + Evidence Package buttons
- Settlement flow: Auto-generates evidence package on blockchain settlement

**Testing:** 100% backend (24/24), 100% frontend

### Transaction Timeline Visualization — COMPLETED (Feb 27, 2026)

**Backend** (`timeline_routes.py`)
- GET /api/timeline/{transaction_id}: Aggregates events from 13+ MongoDB collections
- Sources: transaction creation, participant joins, task starts/completions, document uploads, AI analyses, copilot analyses, remediations, biometric passports, biometric verifications, conductor guidance, evidence packages, blockchain settlements, witness recordings
- Events have: type, category (7 types), icon, title, description, timestamp, severity, sequence number, metadata
- Sorted chronologically (newest first), grouped by date

**Frontend** (`TransactionTimeline.jsx`)
- Forensic-style vertical timeline with gradient line
- Category-colored icon nodes (lifecycle=blue, people=violet, tasks=amber, documents=cyan, AI=pink, verification=emerald, blockchain=orange)
- Filter bar with 7 category toggles + Clear button
- Stats strip showing event counts per category
- Date grouping headers
- Expandable event cards with full metadata details (event#, type, timestamp, all metadata fields)
- Severity dots (green=success, amber=warning, red=error, blue=info)

**Integration:**
- Transaction Room: Timeline button in header (data-testid='timeline-btn')
- Route: /timeline/:transactionId

**Testing:** 100% backend (14/14), 100% frontend

### Real-Time Timeline Event Streaming — COMPLETED (Feb 27, 2026)

**Backend WebSocket** (`ws_manager.py`, `ws_routes.py`)
- WSS endpoint: `/api/ws/timeline/{transaction_id}`
- Auth flow: client sends `{type:"auth", token}` → server responds `{type:"connected", transaction_id, user_id, viewers}`
- Access control: rejects invalid tokens (4001), non-participants (4003)
- Ping/pong keepalive for connection stability
- `emit_timeline_event()` broadcasts to all connected timeline viewers

**Event Emission Points** (`transaction_orchestrator.py`)
- Task started/completed → emits task event with severity info/success
- Participant invited/joined → emits people event
- Blockchain settlement → emits blockchain event with hash
- All emissions via `_emit_timeline()` helper (fire-and-forget, non-blocking)

**Frontend Live Updates** (`TransactionTimeline.jsx`)
- Auto-connects to WSS on page load with JWT auth
- Green "Live" indicator when connected, auto-reconnect (exponential backoff, max 5 retries)
- New events appear at top with green ring highlight + animated "LIVE" badge
- Live event counter badge with pulse animation
- Supports multiple concurrent viewers

**Testing:** WS auth PASS, multiple viewers PASS, ping/pong PASS, access control PASS, 100% frontend

### 6 Enhancement Features — COMPLETED (Feb 27, 2026)

**1. Smart Reminders & Calendar Integration** (`reminder_routes.py`, `reminder_service.py`, `RemindersPage.jsx`)
- GET/PUT /api/reminders/preferences: Toggle overdue tasks, upcoming bookings, pending approvals, email notifications
- GET /api/reminders/calendar/bookings.ics: Export bookings as .ics for Google Calendar/Outlook/Apple
- GET /api/reminders/calendar/tasks.ics: Export task deadlines as .ics
- Background service: 30-min interval checks for overdue tasks, 24h upcoming bookings, stale approvals
- Frontend: Preference toggle switches + calendar export buttons

**2. Approval Workflows** (`approval_routes.py`, `ApprovalsPage.jsx`)
- POST /api/approvals: Create multi-step approval chain (manager → legal → executive)
- POST /api/approvals/{id}/action: Approve/reject with comments at each step
- Auto-advance to next approver, notifications at each step
- GET /api/approvals/pending: Requests needing my approval
- GET /api/approvals/my: All my requests (submitted + received)
- Frontend: Create form with dynamic chain builder, tabs (pending/my), chain visualizer, approve/reject buttons

**3. Document Comparison / Diff View** (`doc_compare_routes.py`, `DocComparePage.jsx`)
- POST /api/doc-compare/compare: AI-powered diff analysis (changes, legal implications, significance level)
- Side-by-side input with labels, results show additions (green), deletions (red), modifications (amber)
- Impact badges, legal implications section, comparison history

**4. Custom Branding** (`branding_routes.py`, `BrandingPage.jsx`)
- GET/PUT /api/branding: Display name, primary/accent colors, tagline
- POST /api/branding/logo: Logo upload with preview
- Live preview with brand colors applied to buttons
- Applied per-organization when org exists

**5. Dark/Light Theme Toggle** (`ThemeContext.jsx`)
- CSS variable-based theme system (--bg-primary, --bg-secondary, --text-primary, etc.)
- data-theme attribute on html element
- Persisted in localStorage, toggle button in Dashboard header

**6. Onboarding Tour** (`OnboardingTour.jsx`)
- 5-step guided walkthrough targeting key UI elements by data-testid
- Auto-shows on first visit (1.5s delay), skip/next/back navigation
- Progress dots, overlay with highlighted target elements
- localStorage flag prevents re-showing

**Testing:** 100% backend (19/19), 100% frontend

## Architecture
```
/app
├── backend/
│   ├── routes/ (auth, admin, notary, ai, blockchain, payment, subscription,
│   │           template, organization, draft, vault, public_api, webhook,
│   │           expiry, draft_collab, bulk, marketplace, embed, booking)
│   ├── services/ (cache, email, notification, orchestrator, storage,
│   │             task_manager, webhook, template_wizard, expiry)
│   └── server.py
└── frontend/src/
    ├── components/ (NotaryAvailabilitySettings, ExpiryTracker,
    │               CollaborationPresence, NotificationBell, etc.)
    ├── pages/ (Dashboard, BulkNotarization, NotaryMarketplace,
    │          WhiteLabelPage, BookingCalendar, MyBookings, etc.)
    └── App.js
```

## Key API Endpoints (New)
- `/api/timeline/{transaction_id}` — Transaction Timeline events
- `/api/remediation/analyze|apply-clauses|history|{id}` — AI Document Remediation
- `/api/biometric-passport/generate|my|{id}|verify/{id}|session/{id}` — Biometric Passport
- `/api/conductor/guide|chat|status/{id}` — AI Conductor
- `/api/evidence-package/generate/{id}|{id}|verify/{id}` — Evidence Package
- `/api/ai-copilot/analyze` — AI Co-pilot analysis
- `/api/ai-copilot/prefill-journal` — Journal auto-fill
- `/api/ai-generator/types|generate|refine|my-documents|documents/:id` — AI Doc Generator
- `/api/ai-summarizer/summarize|history|history/:id` — AI Summarizer
- `/api/video-witness/instructions|upload|my|request/:id|review/pending|review/:id` — Video Witness
- `/api/bookings/availability` — Notary schedule CRUD
- `/api/bookings/blocked-dates` — Blocked date management
- `/api/bookings/slots/{notary_id}?date=YYYY-MM-DD` — Available time slots
- `/api/bookings` — Booking CRUD (POST create, GET my/notary)
- `/api/bookings/{id}/confirm|cancel|complete` — Booking actions
- `/api/organizations/{org_id}/permissions` — List all RBAC permissions
- `/api/organizations/{org_id}/roles` — RBAC role CRUD (GET/POST)
- `/api/organizations/{org_id}/roles/{role_id}` — RBAC role update/delete (PUT/DELETE)
- `/api/organizations/{org_id}/members/{member_id}/custom-role` — Assign/remove custom role (PUT/DELETE)
- `/api/organizations/{org_id}/members/{member_id}/effective-permissions` — Get effective permissions
- `/api/sso/discover` — Check SSO availability for email domain
- `/api/sso/initiate` — Start SSO authentication flow
- `/api/sso/session/{session_id}` — Get SSO session details
- `/api/sso/callback` — Complete SSO authentication
- `/api/sso/test` — Test SSO configuration validity

## Upcoming Tasks
- Plug real biometric API into Verifier Agent (e.g., Onfido, Jumio, or GPT-5.2 Vision)
- Plug real audit/evidence packaging into Witness Agent
- Resend Domain Verification (user task — verify domain on resend.com)

## Future/Backlog
- Add more languages (DE, PT, JA, ZH)
- Extract translation strings to separate JSON locale files for scalability

## Test Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@notarychain.com | Admin123! |
| User | demo@test.com | Demo123! |
| Notary | notarytest@test.com | Test123! |
| Investor Deck | N/A | NotaryChain2026! |
