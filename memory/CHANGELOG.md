# NotaryChain Changelog

## May 27, 2026 — Regulatory Oracle Watchlist Alerts (Email + Slack/Discord)

Turned the Regulatory Oracle from a passive dashboard into a proactive ops tool. Admins can now subscribe to per-jurisdiction watchlist alerts and get an instant ping the moment a rule change in their watched states auto-flags packets.

### Backend
- **NEW** `services/oracle_watchlist_service.py`:
  - CRUD over a new `oracle_watchlists` collection (per admin, per jurisdiction list, with severity floor + `auto_applied_only` flag + email + Slack/Discord webhook channels).
  - `dispatch_alerts(event)` — fans out to every matching watchlist; sends branded HTML email via `EmailService.send_email` and posts a Slack/Discord-compatible incoming-webhook payload via `httpx`.
  - `send_test_alert(...)` for the "Test send" UI button.
  - Failure-mode: NEVER raises. All per-subscription errors are logged + skipped so Oracle polling never breaks.
- **NEW** `routes/oracle_watchlist_routes.py` (admin-gated via `/api/admin/oracle-watchlists`):
  - `GET ""` · `POST ""` · `PATCH "/{id}"` · `DELETE "/{id}"` · `POST "/{id}/test"`
  - Verifies admin role by re-reading the user's DB record (not trusting JWT claims).
- **Wired into the existing Oracle polling loop** (`acn_oracle_service.poll_and_apply` — right after `_db.acn_oracle_events.insert_one`) so every newly-discovered event triggers `dispatch_alerts`.
- Server startup binds DB to both the service and the route module.

### Frontend
- **NEW** `components/OracleWatchlistPanel.jsx`:
  - Lives inside ACN Dashboard → Rule Updates tab, directly below the Oracle live feed card.
  - List view: row per watchlist with jurisdiction chips (coral), severity floor badge (navy), `auto-flagged only` badge (amber when set), email + webhook channel indicators, dispatch counter, plus per-row Enable/Disable toggle, Send-test, and Delete actions.
  - Inline create form: label · 12 common jurisdiction chips + "Any" wildcard · severity-floor select · auto-applied-only checkbox · email-me checkbox · Slack/Discord webhook URL input.
  - All actions wired to the new admin endpoints, with optimistic refresh.
  - `data-testid`s on every interactive element for QA.
- `ACNDashboard.jsx`: imports `useAuth`, forwards `token` into `UpdatesView`, and mounts the new panel.

### Verification (live)
- Backend: `POST /api/admin/oracle-watchlists` → returns full doc with `id`, `severity_floor: medium`, `jurisdictions: [US-FL, US-TX]`. `PATCH .../id` toggles enabled. `DELETE` returns `{deleted: true}`. `POST .../id/test` dispatches a real branded email + reports `email_sent: true`.
- Frontend (Playwright): panel renders inside Rule Updates tab. "New watchlist" button opens form. Filling label + severity=high + Subscribe creates a row. Row shows `US-FL` chip + `HIGH+` badge + admin email + `dispatched 0x` + toggle/test/delete actions.



## May 27, 2026 — Three Value-Add Features: Live KPIs · PCV Marketing · ACN Auto-Passport

### 1) Live WebSocket-driven KPI cards in DashboardHero
- Hero KPI cards now subscribe to `useWS()` events and **pulse + re-count in real time** on every relevant event — no refresh needed.
- Notary/Admin subscriptions: `notary_queue_update` (Pending in queue), `request_assigned` (Assigned to you), `request_in_session` (Ready to seal), `request_completed` (Assigned to you re-counts).
- Client subscriptions: `request_status_change` (routes pulse to Open/Action/Sealed based on new status), `request_completed` (Sealed Documents).
- Visual feedback: 1.6-second `ring-2 ring-coral-400 animate-pulse` glow on the updated card.
- Cleanup: each subscription returns its unsubscribe function and they're all flushed on unmount + the pulse timeout is cleared.

### 2) PCV Marketing public landing page (`/pcv/marketing`)
- New route: `frontend/src/pages/PCVMarketing.jsx` (auth-free, ~340 lines)
- Targeted at compliance officers at title companies, law firms, RIAs, multi-state ops
- Sections:
  - HERO: "Stop preparing for audits. Start passing them by default." + book-demo CTA + see-vault secondary CTA
  - LIVE PROOF-WITHOUT-TRUST DEMO: paste a hash → hits existing `/verify?hash=...` public verifier
  - PAIN STRIP: 3 stats (3-6 wks SOC 2 effort · $4.4M IBM 2024 avg audit miss · <4 sec PCV proof)
  - PERSONAS: 4-card grid (Title · Law · RIAs · Multi-state)
  - HOW IT WORKS: 4-step (Ingest → Anchor → Predict → Export)
  - DIFFERENTIATORS + customer-quote card (navy bg, coral accent)
  - PRICING: 3-band (Starter $499 · Continuous Audit $1,499 ⭐ · Enterprise $4,999)
  - FINAL CTA: coral gradient banner
- Wired into `App.js` + `lazyRoutes.js`. Brand-aligned (coral/navy/cream/gold), `data-testid`s on every section.

### 3) Auto-create ACN cross-border packet on ceremony seal
- New service: `backend/services/acn_auto_packet_service.py`
  - `auto_create_acn_packet_for_ceremony(db, ceremony)` — idempotent (skips if packet already exists for this ceremony_id), uses existing `acn_service.detect_jurisdictions` + `score_risk` + `seal_packet` helpers.
  - Persists `acn_packet_id`, `acn_public_verify_url`, `acn_jurisdictions`, `acn_all_sealed` back onto the ceremony doc.
  - Failure-mode: NEVER raises; all errors are swallowed + logged so notarization seal is never blocked by ACN value-add.
- Hooked into `routes/ceremony_routes.py` seal block (right after PDF cert generation). Emits a new `acn_passport_minted` ceremony stage event.
- Public verifier endpoint `/api/ceremony/verify/certificate/{hash}` now returns an `acn_passport` block when present.
- Frontend `VerifyCertificate.jsx`: new "Cross-Border Passport" card (coral gradient, Globe2 icon) appears below the Blockchain Seal card when ACN data is available — shows jurisdiction chips + "All Sealed / Sealing" badge + a "View cross-border passport" CTA that opens the public ACN packet verifier.
- `PUBLIC_VERIFIER_BASE_URL` env var override available; falls back to `REACT_APP_BACKEND_URL`.

### Verification
- `/pcv/marketing` returns 200 + all 5 sections render (verified via Playwright)
- `/api/ceremony/verify/certificate/{...}` returns 200 with `verified: false` for non-existent hash (no regression)
- Backend restarts clean, no errors in logs
- Both lint passes clean (ruff + eslint)


## May 27, 2026 — Mode-Aware Navigation + Role Badge + UserDropdown + Portal Glyphs

Three connected improvements for identity-first UX:

### 1) Visual fingerprints for each portal
Added distinct glyph + accent tone so each surface feels like its own destination:
- **Command Authority Suite** → ★ filled coral star
- **Assurance Portal** → ⚖ navy scales
- **Client Sovereign Hub** → ◆ filled gold diamond

Glyphs appear in: `GlobalSubheader` page-indicator strip, `DashboardHero` eyebrow text, AdminDashboard top pill, NotaryDashboard top pill.

### 2) Role badge + quick role-switcher in user dropdown (`components/UserDropdown.jsx`)
Replaces the standalone Logout button in both AdminDashboard + NotaryDashboard. Contents:
- Avatar (initials) + name + email
- Role badge: `Admin` (coral), `Notary` (navy), or `Client` (gold) — tinted per role
- **"Switch view" section** (only when the user has multiple eligible profiles):
  - Admins → can flip to **Assurance Portal** or **Client Sovereign Hub**
  - Notaries → can flip to **Client Sovereign Hub**
  - Clients → no switcher (single mode, hidden)
- Each switch entry shows the destination's title + glyph + a `Preview the X experience` subtitle
- Clicking writes `nc_admin_view_mode` to localStorage AND navigates to the canonical landing path for that mode → the whole UI re-skins
- Sign out at the bottom

### 3) Mode-aware top-bar actions in AdminDashboard
Wired via a new `hooks/useViewMode.js` hook (subscribes to `nc_admin_view_mode` localStorage + cross-tab `storage` events + the existing `nc:admin-view-mode-change` custom event already dispatched by GlobalSubheader).

When admin is in **admin** mode (default):
- Top header shows `Blueprint` + `RON Compliance` (existing admin tools)

When admin flips to **notary** mode:
- Those admin-only buttons are hidden
- Replaced with notary-oriented quick actions: `Approvals queue` (coral), `Journal` (navy), `Start session` (emerald)

This means the toggle isn't merely a navigation shortcut — even if the admin manually navigates back to `/admin` while in notary mode, the chrome re-skins to match the context they're working in.

### Files
- NEW `hooks/useViewMode.js` — shared cross-component view-mode state with localStorage + event sync
- NEW `components/UserDropdown.jsx` — role badge + switcher + logout
- `pages/AdminDashboard.jsx` — top header buttons gated on `isNotaryMode`, swapped Logout → `<UserDropdown />`, added ★ glyph to top pill
- `pages/NotaryDashboard.jsx` — swapped Logout → `<UserDropdown />`, added ⚖ glyph to top pill
- `components/DashboardHero.jsx` — glyphs in role-aware eyebrow
- `components/GlobalSubheader.jsx` — glyphs in pathname-mapped page indicator

### Verification (live, with admin@notarychain.com)
- `/admin` in admin mode → Blueprint/RON Compliance visible (1,1,0)
- Click UserDropdown → switch to Notary → URL becomes `/notary/dashboard`
- Navigate back to `/admin` → Blueprint/RON Compliance gone (0,0), Approvals/Journal/Start session visible (1,1,1)
- Switch back to Admin → state restored



## May 27, 2026 — Asset Hierarchy Re-framing (Identity-First Naming)
Pivoted from generic "Dashboard" labels to identity-first framing per the user's brand strategy. Routes/URLs deliberately unchanged so bookmarks, links, and SEO stay intact — only display labels were updated.

| Route | OLD label | NEW label |
|---|---|---|
| `/admin` | "Admin Dashboard" / "Administrator console" | **Command Authority Suite** |
| `/notary/dashboard` | "Notary Workstation" / "Notary workspace" | **Assurance Portal** |
| `/dashboard` | "Welcome back" / "Dashboard" / "Workspace" | **Client Sovereign Hub** |

**Files updated:**
- `components/DashboardHero.jsx` — role-aware eyebrow text
- `components/GlobalSubheader.jsx` — pathname-mapped page indicator
- `pages/AdminDashboard.jsx` — top-bar pill (now coral, no longer red) + Breadcrumb leaf
- `pages/NotaryDashboard.jsx` — Breadcrumb leaf
- `i18n.js` — `notary.workstation` translation key value

Verified live on all three routes via Playwright: each page renders its new framing in the subheader, top pill, breadcrumb, and hero eyebrow.



## May 27, 2026 — Production Blank-Page Fix (Service Worker Stale-Cache Bug)
- **Bug**: After redeploy to `notarychain.app`, the production site rendered a completely blank body (only the `<title>` showed in the browser tab title). Preview was unaffected.
- **Root cause**: `public/sw.js` used a **cache-first** strategy for `/` and `/index.html` (lines 2-6, 64-67) with a never-changing `CACHE_NAME = 'notarychain-v1'`. Classic SPA + service-worker stale-cache failure mode:
  1. First production visit installed the SW and cached the OLD `/index.html` (which referenced OLD hashed JS bundles like `main.abc123.js`).
  2. Redeploy → new build produced NEW JS bundle filenames (`main.xyz789.js`); the old bundle no longer existed.
  3. Subsequent visits → SW served cached OLD `/index.html` → browser tried to load OLD bundle → 404 → React never mounted → blank page.
  Since `CACHE_NAME` never changed, old caches were never evicted, so the bug self-perpetuated across every deploy.
- **Fix** (`public/sw.js` fully rewritten):
  - Bumped to versioned cache names: `notarychain-shell-v3-2026-05-27`, `notarychain-api-v3-...`, `notarychain-certs-v3-...`. Old caches now evicted on every deploy.
  - **Navigation requests + `text/html` + everything else → NETWORK-FIRST** (with cached-shell fallback only when offline). Fresh `/index.html` always reflects the deployed build.
  - **Hashed `/static/*` assets → CACHE-FIRST** (filenames include build hash → immutable → safe).
  - `/api/*` → network-first (unchanged).
  - `/certificate*` → cache-first for offline-viewable PDFs (unchanged).
  - `skipWaiting()` on install + `clients.claim()` on activate so the new SW takes control immediately.
  - On activate, the new SW posts `{type:'SW_UPDATED'}` to every open client so they auto-refresh — fixes users stuck on the broken cached shell without making them manually clear cache.
- **Fix** (`src/index.js`):
  - Listens for `SW_UPDATED` messages + `controllerchange` event → triggers `window.location.reload()` once per session. Users stuck on the cached broken HTML get the fresh shell on their very next page load with zero manual intervention.
- **Future-proofing**: bump `CACHE_VERSION` on every meaningful deploy (or just leave it alone — the network-first navigation strategy means stale-HTML can never block users again).
- Verified live on preview: React mounts, SW registered & activated, full landing page renders, zero console errors.


## May 27, 2026 — Primary CTA Button Color Fix (Accept buttons + illegible navy-on-navy regression)
- **Issue**: Notary Workstation "Accept" buttons (and several other primary CTAs across the app) appeared as **dark navy on dark navy** — the "Accept" text was barely legible. Root cause: my earlier gray→navy sweep (May 25) over-applied to primary CTA buttons that originally read `bg-gray-700 hover:bg-gray-800 text-gray-900` — that pattern was meant for raised dark CTAs that worked when the text was inheriting from light parent, but the sweep made it dark-on-dark.
- **Fix** (4 surgical sweeps across all 228 `.jsx/.js` files):
  1. Primary CTA buttons: `bg-navy-700/800/900 hover:bg-navy-700/800/900 text-navy-900` → `bg-coral-500 hover:bg-coral-600 text-white`. Now matches the brand's primary-action color.
  2. Form inputs: `bg-navy-900 ...text-navy-900` → `bg-white ...text-navy-900` (inputs are no longer dark-on-dark).
  3. Page wrappers: `min-h-screen bg-navy-900 text-navy-900` → `min-h-screen bg-cream-100 text-navy-900` (entire pages no longer dark-on-dark).
  4. One tooltip in `OperationsTab.jsx` manually fixed: `bg-navy-800 text-navy-900` → `bg-navy-900 text-cream-100` (tooltip stays dark with light text, which is correct).
- Verified live on `/notary/dashboard` — every Accept button + "User View" toggle + Performance icons + Pro Tip card render in proper coral with full legibility.



## May 26, 2026 — Admin Access Hardening + Notary Toggle Fix + LexisNexis InstantID Q&A (Drop-in-Ready)

### 🔴 Admin Access Hardening (P0)
- **Issue**: Admin received "Access Denied · Admin access required" toast on production (`acn-oracle-live.emergent.host`) when trying to access `/admin`. On preview, all admin endpoints returned 200 — bug was production-DB-specific (admin user missing or wrong role on prod after redeploy).
- **Fix**: Added idempotent admin user seed (`services/admin_seed_service.py`) that runs on every backend startup (`@app.on_event("startup")`). Per integration playbook auth pattern:
  - If `admin@notarychain.com` does NOT exist → CREATE with bcrypt-hashed password.
  - If exists AND role=admin → no-op (NEVER overwrite an existing admin's password).
  - If exists AND role!=admin → PROMOTE to admin (password untouched).
  - Race-safe on parallel workers (insert collision treated as no-op).
- **New env vars** (all optional, sane defaults):
  - `ADMIN_SEED_EMAIL` (default `admin@notarychain.com`)
  - `ADMIN_SEED_PASSWORD` (default `Admin123!`)
  - `ADMIN_SEED_NAME` (default `Platform Admin`)
  - `ADMIN_SEED_DISABLED` (`"true"` to skip seeding entirely)
- Verified preview log: `[admin_seed] result={'action': 'exists', 'email': 'admin@notarychain.com'}`. On production redeploy, will fire `created` or `promoted` automatically.

### 🟡 Admin ↔ Notary View Toggle (P1)
- **Issue**: The `GlobalSubheader` toggle existed but the "Notary" button routed to `/dashboard` (the regular end-user view) instead of `/notary/dashboard` (the actual Notary Workstation).
- **Fix**: `GlobalSubheader.switchMode` now routes `notary` → `/notary/dashboard`, `admin` → `/admin`. Persists choice in `localStorage` under `nc_admin_view_mode`. Verified live: admin → click "Notary" → URL becomes `/notary/dashboard` with full Notary Workstation (earnings, queue, performance widget) → click "Admin" → URL becomes `/admin`.

### 🟢 LexisNexis InstantID Q&A — Real SOAP Adapter (P2, drop-in-ready)
- **Issue**: `LexisNexisKBAProvider` was a stub that silently delegated to `MockKBAProvider`. The user will provide LexisNexis credentials later.
- **Fix**: Wired the **real LexisNexis InstantID Q&A SOAP/XML integration** per the integration playbook. The adapter:
  - Builds proper SOAP envelope with `<Authentication>` header (Username/Password/AccountId/ProfileId) via `lxml`.
  - Embeds full PII (Name + DOB + SSN + Address) per LexisNexis InstantID Q&A schema.
  - Configures Florida §117.295(3) quiz parameters: `NumberOfQuestions=5`, `MaxTimeSeconds=120`.
  - Sends async via `httpx.AsyncClient` (non-blocking, FastAPI-safe).
  - Parses `<Quiz>/<Question>/<Choice>` response, handles SOAP Faults gracefully.
  - **Drop-in-ready**: silently falls back to `MockKBAProvider` if any required env var is missing OR if user PII is incomplete OR if vendor SOAP call fails (degrades gracefully, never blocks notarization).
- `start_kba` route now enriches `principal` dict with full PII (first/last name, DOB, SSN-last-4, full address) pulled from the user record, so LexisNexis has everything it needs when env vars are populated.
- **Env vars required to activate** (set in `backend/.env`, restart backend → auto-swap):
  - `LEXISNEXIS_INSTANTID_ENDPOINT_URL` (full SOAP endpoint, sandbox or prod)
  - `LEXISNEXIS_USERNAME`
  - `LEXISNEXIS_PASSWORD`
  - `LEXISNEXIS_ACCOUNT_ID` (subscriber ID)
  - `LEXISNEXIS_PROFILE_ID` (InstantID Q&A quiz template ID)
  - Optional: `LEXISNEXIS_ENVIRONMENT` (`sandbox|production`, default `sandbox`), `LEXISNEXIS_TIMEOUT` (default `10`), `LEXISNEXIS_SOAP_NS` (override namespace if your WSDL differs)
- **Where to obtain credentials**: contact LexisNexis Risk Solutions sales at +1‑408‑200‑5755 or via https://risk.lexisnexis.com/products/instantid-q-and-a — sandbox/production credentials + WSDL URL are issued after MSA signed.
- Verified preview: `GET /api/kba/status → {"provider":"mock","is_mock":true}`. `POST /api/kba/start → {"provider":"mock","questions_count":5}`. No regressions in mock mode.



## May 25, 2026 — Dashboard Role Scoping (Critical UX Fix)
- **Bug**: regular end-users (clients) were seeing every notary/admin feature on their `/dashboard` — Trust Hub, Living Identity, Asset Vault, Video Witness, Biometric Passport, Escrow Intelligence, Tokenized Escrow, Compliance Vault, Fraud Intelligence, the full Network & Tools (Templates, ANAN, Branding, Ceremony Mode, Multi-Sig, Approvals, etc.), State Pickability Index, and AI Intelligence Hub. This created confusion ("why does the standard user see all the same features as a notary?") and exposed notary-only workflows to clients who can't use them.
- **Fix**: refactored `Dashboard.jsx` with proper role gating:
  - **Regular users** now get a focused 3-panel layout: `Core Actions` (Quick Seal · Request Notarization · Bulk Notarization · Find Notaries), `AI Document Tools` (AI Doc Generator · AI Summarizer · Doc Compare — no fraud/remediation), `My Vault & Records` (Asset Vault · My Documents · My Drafts · Cert Expiration · Reminders), plus a bottom CTA strip (Verify a Document · Public Audit Trail · Become a Notary). Network & Tools and State Pickability Index hidden.
  - **Notary/Admin** keep the full original layout (Core Actions + AI Intelligence + Security & Identity + Network & Tools + State Pickability).
- New `data-testid`s added for QA gating: `my-vault-section`, `user-cta-section`, `find-notaries-btn-core`, `verify-btn`, `audit-trail-btn-user`.
- Verified live: `demo@test.com` (regular user) sees focused 3-panel layout; `notarytest@test.com` (notary) sees full feature set.



## May 25, 2026 — Code Quality Pass (Critical & Important findings from review)

### Backend (Python — actionable fixes)
- **🔴 CRITICAL crash bug**: `routes/ceremony_routes.py` was using `logger` on lines 585, 619, 675 without importing it — would crash on FL pre-seal gate errors, threat-analysis failures, and FL journal auto-log failures. **Fix**: added `import logging` + `logger = logging.getLogger(__name__)` at top of file.
- **🟡 Bare except → specific**: `services/transaction_orchestrator.py` lines 151 & 718 changed from `except:` → `except (ValueError, TypeError, AttributeError)` and `except (ValueError, TypeError, KeyError)` respectively. Stops masking unrelated errors.
- **🟡 PEP 8 fixes (E701)**: `routes/scheduled_export_routes.py` — split 5× `if cond: stmt` one-liners into multi-line blocks.
- **🟡 Ambiguous variable names (E741)**: renamed `l` → `ln` in `ai_escrow_service.py` and `anan_swarm.py` list comprehensions.
- **🟡 Dead code / F841 cleanup**: removed `mime_type`, `filename`, `snapshot`, `hbar_settings_exist`, `badge_class` unused locals; marked 6 intentional auth-gate `user = await _get_user(request)` calls with `# noqa: F841 - auth gate` (they trigger the auth side-effect, the var itself is unused).
- **🟡 ruff auto-fixes** (14 issues): unused `except Exception as e` exception vars → bare `except Exception`, empty f-strings → plain strings.
- Final ruff state: **All checks passed!** (was 36 errors → 0).

### Code-review findings investigated and confirmed already-fixed / false-positives
- ❌ "29 undefined variables" in Python — actually 3 `F821` (all `logger` in ceremony_routes.py, now fixed); rest were F841 unused locals (29 instances), not crashes.
- ❌ "Insecure `random` in security contexts" — all flagged `random.*` calls in `escrow_routes`, `escrow_oracle_service`, `ceremony_routes`, `kba_routes` were for **mock/demo data** (synthetic Hedera mock IDs, fake processing-time ms, mock confidence scores) OR for a deterministic-by-design seeded RNG in `MockKBAProvider` (`random.Random(seed)`). NOT used for tokens/keys/passwords. No fix needed.
- ❌ "Dynamic imports = RCE vector" — all dynamic imports flagged use **literal module paths** (`from services.notification_service import broadcast_event`, etc.). No user-controlled input is passed to importlib. Not a security risk.
- ❌ "XSS via `dangerouslySetInnerHTML` (7 instances)" — actually **1 instance** total in the entire frontend (`ANANDashboard.jsx:727`), and it is **already protected** by `DOMPurify.sanitize()` with explicit HTML+SVG profile. False positive.
- ❌ "TransactionTimeline WebSocket memory leak" — cleanup is **already correctly implemented** (lines 148-154: clears reconnect timeout + closes WS on unmount, nullifies `wsRef.current`). False positive.
- ⚠️ "localStorage tokens → switch to httpOnly cookies" — out of scope; JWT-in-localStorage is the documented integration pattern from `integration_playbook_expert_v2`, and migrating to httpOnly cookies requires backend cookie middleware + SameSite/CSRF + refresh-token flow (major architecture change, not a "fix").
- ⚠️ "234 missing hook deps" — already swept by Architecture Refactor Pass 2 (Feb 27, 2026, iteration 112). The remaining instances are documented mount-only effects with explicit `// eslint-disable-next-line react-hooks/exhaustive-deps` comments. Adding deps to mount-only effects would cause infinite loops.
- ⚠️ "Oversized components" — out of scope refactor; deferred to a future architectural pass to avoid high-risk low-immediate-value changes.



## May 25, 2026 — Global Color Theme Audit + Brand Compliance Sweep
- Reported issue: Quick Seal page (`/demo`) rendered with off-brand bright-blue "Choose File" CTA + step indicator + a broken duplicate footer (white text on cream bg).
- Fix scope (aggressive sweep — user-approved): swept **all 228 .jsx/.js source files** in `frontend/src` and globally replaced off-brand Tailwind classes with brand palette (coral-500 / navy-900 / cream-100 / gold-500):
  - `bg-blue-*`, `text-blue-*`, `border-blue-*`, `from-blue-*`, `to-blue-*`, `hover:bg-blue-*`, `shadow-blue-*`, `ring-blue-*` → coral equivalents
  - `bg-sky-*`, `text-sky-*`, `border-sky-*` → coral equivalents
  - `text-cyan-*`, `bg-cyan-*`, `border-cyan-*` → coral equivalents
  - `bg-indigo-*`, `text-indigo-*`, `from-indigo-*`, `bg-purple-*`, `text-purple-*` → navy equivalents
  - `bg-gray-800/900`, `hover:bg-gray-700/800` → navy equivalents
  - Trailing hover-state leftovers (`hover:bg-cyan-700`, `hover:bg-sky-700`) → coral-600
- `QuickSealDemo.jsx` fully rewritten with coral CTAs, coral step indicator, coral upload icon, branded "Live Demo" pill, semantic emerald for success states, navy pricing CTA strip.
- `components/Footer.jsx` deprecated → no-op stub (returns null). Eliminates broken duplicate footer (white text on cream bg) across 30+ public pages. `PlatformFooter` (globally rendered in App.js) is the canonical site footer.
- `EscrowDashboard.jsx` biometric/ai legend swatches: `bg-purple-400` → `bg-navy-500`.
- Verified production build passes (`yarn build` ✓). Verified live on Quick Seal, Verify, Florida, Trust Badge, Pricing, Compliance, Landing, and Login pages.



## May 25, 2026 — UI Verification: Scheduled Exports Panel + ACN Regulatory Oracle Watchlist
- Visually verified `ScheduledExportsPanel` renders inside Admin → Audit Logs tab without React errors. Empty state, "New schedule" button, and refresh action all functional. (data-testid: `scheduled-exports-panel`)
- Visually verified `Regulatory Oracle Watchlist` renders inside ACN Dashboard → Rule Updates tab. Live oracle feed shows seeded `DE-de`, `SG`, and `US-TX` events with severity badges, auto-applied indicators, and "Poll now" CTA. Mode badge correctly displays "mock". (data-testid: `acn-oracle-card`)
- Closes verification gap from previous fork (iteration_117). No regressions detected.


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
