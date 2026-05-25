# NotaryChain Changelog

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
