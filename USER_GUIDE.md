# NotaryChain — Comprehensive User Guide

A practical, step-by-step walkthrough of everything you can do on NotaryChain, from your first notarization to compliance reporting and shareable snapshots.

> **Three audiences are covered**
> - 👤 **Clients** — people getting a document notarized
> - 🖋️ **Notaries** — commissioned notary publics running ceremonies
> - 🛠️ **Admins** — operators monitoring platform health & compliance

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Account & Roles](#2-account--roles)
3. [For Clients](#3-for-clients-getting-a-document-notarized)
4. [For Notaries](#4-for-notaries-running-a-ceremony)
5. [Understanding Multi-State Compliance](#5-understanding-multi-state-compliance)
6. [The State Pickability Index](#6-the-state-pickability-index)
7. [Sharing a Compliance Snapshot](#7-sharing-a-compliance-snapshot)
8. [The Asset Vault (SALV)](#8-the-asset-vault-salv)
9. [TrustLayer for Partners](#9-trustlayer-for-partners)
10. [Verifying a Sealed Document](#10-verifying-a-sealed-document)
11. [For Developers — SDK](#11-for-developers--sdk)
12. [For Admins](#12-for-admins)
13. [Troubleshooting](#13-troubleshooting)
14. [Glossary](#14-glossary)

---

## 1. Quick Start

### 1.1 Sign up
1. Open the homepage and click **Sign Up** (top right).
2. Enter your full name, email, and a password (min 8 characters).
3. Confirm your email if asked. You'll land on your **Dashboard**.

### 1.2 Sign in
- Email + password, **or**
- One of the SSO options if your firm has enabled them (Auth0, Okta, Enterprise SSO).

### 1.3 Your home base
After login, you land on the **Dashboard** which contains:
- **Top stats strip** — Total Seals, Last 30 Days, Member Since
- **Core Actions** — Quick Seal, Request Notarization, Bulk Notarization
- **AI Intelligence** — generators, summarizers, doc-compare, remediation
- **Security & Identity** — Trust Hub, Asset Vault, Video Witness, Biometrics
- **Network & Tools** — Bookings, Find Notaries, Templates, etc.
- **State Pickability Index** — your live compliance readiness widget
- **Document Expiry Tracker** — heads-up on renewals
- **My Notarization Requests** — recent in-flight ceremonies
- **Recent Document Seals** — your sealed Hedera ledger entries

---

## 2. Account & Roles

NotaryChain has three roles. Your role is set during signup or by an admin.

| Role | Sees / can do |
|------|---------------|
| **Client** (default) | Request notarizations, view their docs, manage Asset Vault, share snapshots |
| **Notary** | Everything Clients can, plus accept ceremony requests, run RON sessions, journal entries |
| **Admin** | Everything plus analytics, compliance dashboards, partner CRUD, SDK key management |

To become a notary: click **Become a Notary** on the Dashboard → submit your commission certificate, government ID, e-signature, and (optionally) background check + RON certificate. An admin will review.

---

## 3. For Clients — Getting a Document Notarized

### 3.1 Quick Seal (no notary, just blockchain timestamp)
Use this when you only need cryptographic proof a document existed at a moment in time — **not** a notarization.

1. Dashboard → **Quick Seal**.
2. Upload your PDF/image.
3. Click **Seal Now**. We compute a SHA-256, anchor it to **Hedera mainnet**, and you get a transaction ID + HashScan link.
4. Done in ~5 seconds.

### 3.2 Full Remote Online Notarization (RON)
Use this when you actually need a commissioned notary to witness signing.

1. Dashboard → **Request Notarization**.
2. **Fill the request form:**
   - **Document name** (e.g. `Real Estate Purchase Agreement`)
   - **Document type** (`real_estate`, `affidavit`, `power_of_attorney`, `will`, …)
   - **State** — *important.* Choose the state your ceremony is governed by (FL / TX / NY / CA / VA). Each state has different pre-seal gate requirements; see §5.
   - **Upload your document.**
3. Click **Submit Request**. The request enters the **pending** queue.
4. A commissioned notary in your state picks it up. You'll be notified.
5. When the notary starts the session, you'll receive a "Join Ceremony" notification.
6. **Join the video session** — you'll go through:
   - **Identity proofing** — KBA quiz + government ID capture
   - **Audio/video recording** — at least 30 seconds of clean signal
   - **Document signing** — e-signature on the doc
   - (CA only, for real-property/POA): **biometric thumbprint capture**
   - (NY only): **GPS location capture**
7. The notary completes the ceremony. Behind the scenes the multi-state evaluator checks every required gate. If a gate fails, sealing is **blocked** and the ceremony returns to the queue with a clear reason.
8. On success, you see the sealed document + Hedera transaction ID in your Dashboard.

### 3.3 Tracking the status
**My Notarization Requests** on the Dashboard shows each request with a colored pill:

| Pill | Meaning |
|------|---------|
| **Pending** (amber) | Waiting for a notary to pick it up |
| **Assigned** (sky) | A notary has claimed it — ceremony scheduled |
| **In session** (emerald) | Video ceremony is live right now |
| **Completed** (slate) | Sealed on Hedera, you're done |
| **FL_blocked / TX_blocked / …** | Pre-seal gate failed; see the reason in the audit trail |

Click **Audit** on any in-flight request to see every event written to its Hedera HCS topic.

### 3.4 Bulk Notarization
Have a stack of documents to notarize together? Dashboard → **Bulk Notarization** lets you upload many files in one request that a notary handles as a single session.

---

## 4. For Notaries — Running a Ceremony

### 4.1 Get commissioned on the platform
1. Dashboard → **Become a Notary** → fill the application.
2. Upload your **commission certificate**, **government ID**, **e-signature**, **background check** (optional), **RON certificate** (required for online ceremonies).
3. Wait for admin approval. Once approved, your role flips to **Notary** and you'll see the notary action panel.

### 4.2 Pick up a request
1. Dashboard → **Approvals** (or the notary queue).
2. Review pending requests filtered by your commission state.
3. Click **Accept** to assign it to yourself. The status flips to *assigned*.

### 4.3 Run the session
1. Click **Start** to launch the video room. The principal joins from their side.
2. Follow the on-screen checklist (varies by state — see §5):
   - Verify ID via the AI document analyzer
   - Administer KBA quiz
   - Capture A/V quality report
   - (CA only) capture biometric thumbprint for real-property / POA
   - (NY only) capture GPS location
   - Record the signing
3. Add your **journal entry** (NotaryChain auto-creates a draft from the ceremony metadata; you confirm + edit).
4. Tag the **retention period** (NotaryChain pre-fills 5 yr for TX/CA/VA, 10 yr for NY, 10 yr for FL).
5. Click **Complete & Seal**. The multi-state evaluator runs:
   - **All gates pass** → ceremony seals on Hedera, returns transaction ID
   - **One or more gates fail** → HTTP 412 with `blocked_reasons`; status flips to `<state>_blocked`. Fix what's missing and click Complete again.

### 4.4 Reading a blocked-ceremony response
If sealing was blocked, the audit panel shows something like:

```
TX preseal_gate_failed
- audio_video: av_not_reported_yet
- kba: no_passing_kba_in_last_hour
- journal: no_journal_entry
```

Each line tells you which gate failed and why. Once you remediate, **Complete** again.

---

## 5. Understanding Multi-State Compliance

NotaryChain's `multistate_evaluator` runs a pre-seal gate check for **TX / NY / CA / VA** before a ceremony can be sealed. **FL** has its own dedicated readiness route at `/api/fl/ron/readiness/{id}`.

### 5.1 The shared gate primitives
| Gate | Description | Required for |
|------|-------------|--------------|
| `audio_video` | ≥ 30 s of clean A/V signal | TX, NY, CA, VA |
| `kba` | Passing KBA quiz within last hour | TX, NY, CA, VA |
| `id_check` | Government ID approved by AI doc analyzer | TX, NY, CA, VA |
| `retention` | Retention tag set to ≥ state-required years | TX 5y, NY 10y, CA 5y, VA 5y |
| `journal` | Notary journal entry recorded | TX, NY, CA, VA |
| `tamper_evident` | PKI seal needs both `kba` + `id_check` | TX, VA |
| `identity_proofing` | Multi-factor = KBA *and* ID-check | NY |
| `thumbprint` | Biometric thumbprint capture | CA real-property/POA/mortgage/lien-release |
| `principal_location` | Principal GPS captured at signing | NY |
| `document_type_allowed` | NY hard-blocks wills, codicils, testamentary trusts, life-estate deeds | NY |

### 5.2 State-by-state quick reference

**Florida (FL)** — handled by the dedicated FL pipeline (witness flow for online wills, 10 yr S3 Object Lock retention, FL Stat. 117.245 journal, RONSP filing lifecycle).

**Texas (TX)** — A/V + KBA + ID + 5 yr retention + journal + tamper-evident (KBA & ID required).

**New York (NY)** — A/V + multi-factor identity proofing (KBA *and* ID) + 10 yr retention + journal + principal GPS. **Wills/codicils/testamentary trusts/life-estate deeds are RON-prohibited.**

**California (CA)** — A/V + KBA + ID + 5 yr retention + journal. **Biometric thumbprint required** for `deed`, `real_property`, `power_of_attorney`, `mortgage`, `lien_release`.

**Virginia (VA)** — A/V + KBA + ID + 5 yr retention + journal + tamper-evident (KBA & ID required).

Full statute citations, side-by-side comparison, and registration cards live at `/compliance/states`.

---

## 6. The State Pickability Index

The **State Pickability Index** widget on your Dashboard turns abstract compliance data into actionable nudges.

### 6.1 What it shows
- **Overall score** (top-right) — % of your open ceremonies that are seal-ready right now.
- **By Jurisdiction** (left column) — a colored bar per state with `{ready}/{open}` and a score:
  - 🟢 80 %+ — green, healthy
  - 🟡 50–79 % — amber, attention
  - 🔴 < 50 % — coral, needs work
- **Actionable Nudges** (right column) — up to 8 distinct ceremonies, each with a one-click CTA to the ceremony page to fix the failing gate.

### 6.2 How nudges are prioritized
1. States with **the most open ceremonies** surface first (highest impact).
2. Inside the priority list, **one nudge per ceremony** before showing a second nudge for any ceremony (so the widget shows variety, not 6 nudges for the same doc).
3. Each nudge has a short title + 1-line description + a CTA label (e.g. *Start KBA*, *Capture thumbprint*, *Set retention*).

### 6.3 Acting on a nudge
Click any nudge row → you're deep-linked to `/session/{ceremony_id}`. The ceremony page shows exactly which gate is failing, with a button to fix it (start KBA quiz, capture thumbprint, write journal entry, etc.).

### 6.4 When the widget is empty
*"No open ceremonies. When you request a notarization, this widget will surface state-specific readiness nudges here."* — request your first ceremony and it lights up.

---

## 7. Sharing a Compliance Snapshot

A **Compliance Snapshot** is a public, read-only, **scrubbed** version of your State Pickability Index that you can send to counterparties — mortgage brokers, title agents, escrow counsel, your CFO, anyone who needs visibility into your compliance posture without an account.

### 7.1 Generate the link
1. Dashboard → State Pickability Index widget → click **Share snapshot** (top-right of the widget).
2. A green banner appears with the full public URL, e.g.
   `https://notary-chain-preview-2.preview.emergentagent.com/compliance/snapshot/OCPTr3gnxtXZiVfRY7IJvw`
3. The URL is **auto-copied to your clipboard** + you see a "Snapshot created" toast.

### 7.2 What's in the snapshot
- Hero score: `47% seal-ready · 28 of 60 active ceremonies pass their state-specific pre-seal gates`
- Per-jurisdiction cards with the same color-coding + sample ceremonies + missing-gate hints
- Top Blockers — the most pressing nudges, scrubbed of document names
- Optional note you supply when creating the snapshot
- Footer: `Generated <timestamp> · expires in N days · X views`

### 7.3 What's **NOT** in the snapshot
- ❌ No ceremony IDs
- ❌ No user IDs
- ❌ No document names
- ❌ No file contents
- ✅ Owner email is masked to `j***@yourfirm.com`

### 7.4 Lifespan
Snapshots default to **7 days TTL** (configurable 1–30 days via API). After expiry, anyone who hits the URL sees a "Snapshot has expired" error.

### 7.5 Re-sharing
Each click of "Share snapshot" creates a **new** token — old links keep working until they expire. There's no way to "edit" a snapshot — generate a fresh one to share the latest state.

---

## 8. The Asset Vault (SALV)

The **Smart Asset Life-cycle Vault** is for documents you want to manage long-term — deeds, wills, IP licenses, beneficiary documents, etc.

### 8.1 Upload an asset
1. Dashboard → **Asset Vault**.
2. Click **+ New Asset** → name it, choose a type (deed, will, IP, etc.), upload the file.
3. The file is **AES-GCM-256 encrypted** with a per-asset key (HKDF-SHA256 derived) before it lands in storage (S3 or local FS). Only the owner can decrypt.

### 8.2 Add a beneficiary
1. Open the asset → **Beneficiaries** tab → **+ Add**.
2. Enter beneficiary email + share percentage.
3. They receive a magic-link invite. When they accept, you'll get a notification.

### 8.3 Partial release
Owners can release a percentage of an asset to a beneficiary without giving up full control:
1. Open the asset → click the **Release** slider next to a beneficiary.
2. Pick a percent (e.g. 50 %) → optional note → confirm.
3. The release is anchored to **Hedera HCS** with a receipt. The beneficiary can now decrypt the document.
4. The release history is immutable and auditable in the **Beneficiaries** tab.

### 8.4 Beneficiary viral loop
When a beneficiary accepts a handoff, they're prompted to sign up for their own NotaryChain account. The owner receives an in-app notification + email when this conversion happens. Acquisition source tracking ties the new user back to the original asset.

---

## 9. TrustLayer for Partners

TrustLayer is the federated trust graph that lets external firms (lenders, brokerages, escrow agents, government agencies) issue **Ed25519-signed**, Hedera-anchored attestations about a NotaryChain document.

### 9.1 Register as a partner
1. An admin creates your partner profile in `/admin/trust-layer`.
2. You receive a **publishable key** + your Ed25519 public key is published at `/api/trustlayer/partners/{id}/public-key`.
3. Your **private key** is stored in NotaryChain's vault (never exposed via any public route).

### 9.2 Issue an attestation
Use the v2 SDK (`/sdk-v2.js`) or POST to `/api/trustlayer/attestations` with:
- `subject_id` — the NotaryChain seal hash you're attesting about
- `claim` — short JSON of what you're asserting (e.g. `{"lender_funded": true, "loan_id": "L-12345"}`)
- `partner_id`

The platform signs the attestation with your Ed25519 keypair (canonical-JSON serialization), anchors the digest to **Hedera HCS**, and returns the verifiable receipt.

### 9.3 Embed the auto-verify badge
Drop the `<trust-badge>` web component on any page:
```html
<script src="https://notary-chain-preview-2.preview.emergentagent.com/api/trustlayer/badge-v2.js"></script>
<trust-badge attestation-id="ATT-12345"></trust-badge>
```
The badge verifies the Ed25519 signature in-browser using WebCrypto + pulls the Hedera Mirror Node payload, then emits a `verified` or `failed` CustomEvent. Verification is shadow-DOM isolated so it can't be tampered with by host-page CSS/JS.

---

## 10. Verifying a Sealed Document

Anyone — no account required — can verify a NotaryChain seal at **`/verify`**.

### 10.1 Three ways to verify
1. **Upload the document** — we hash it client-side and look up the hash in `blockchain_seals`. Shows seal date, notary, ceremony details, Hedera link.
2. **Paste the SHA-256 hash** — same flow.
3. **Look up a certificate ID** — for documents with a printable cover sheet that has the cert ID.

### 10.2 What you see on a match
- ✅ **VERIFIED** badge
- Document name, hash, seal timestamp
- Notary profile (name, license, bond, SAN bond ID)
- Hedera transaction ID with HashScan link
- Ceremony details (state, document type, etc.)
- Notary stats (ceremonies sealed, fraud flags, KBA pass rate)

If revoked, you'll see a **REVOKED** badge with the reason.

---

## 11. For Developers — SDK

Embed NotaryChain ceremonies into your own app with the Embeddable Notarize SDK.

### 11.1 Get a publishable key
1. Login → **Developers → SDK Keys** (admin or pro+ tier).
2. Click **+ New Key** → name it + add your `allowed_origins` (e.g. `https://yourapp.com`).
3. Copy the publishable key (`pk_live_...`).

### 11.2 Load the SDK
```html
<script src="https://notary-chain-preview-2.preview.emergentagent.com/api/sdk/v1/notarychain.js"></script>
<script>
  NotaryChain.init({ publishable_key: 'pk_live_…' });

  const session = await NotaryChain.createSession({
    document_url: 'https://yourapp.com/files/doc.pdf',
    state_code: 'FL',
    document_type: 'real_estate',
  });
  NotaryChain.openCeremony(session.embed_url);
</script>
```

### 11.3 Listen for events
```js
window.addEventListener('message', (ev) => {
  if (ev.origin !== 'https://notary-chain-preview-2.preview.emergentagent.com') return;
  // Verify ev.data.event_secret against your server-side stored secret
  if (ev.data.type === 'ceremony.sealed') {
    console.log('Sealed!', ev.data.payload);
  }
});
```

### 11.4 Webhooks
Configure a webhook URL + HMAC secret in `/developers/sdk`. Every ceremony event POSTs a signed payload (HMAC-SHA256 in `X-NotaryChain-Signature`) with **retry-with-backoff** at 1 s, 2 s, 4 s.

### 11.5 Rate limits
- Demo keys: **10 requests / hour / IP** (in-memory)
- Pro keys: subject to your subscription tier
- Each session token can only be used once per ceremony

---

## 12. For Admins

### 12.1 Admin Dashboard
`/admin/dashboard` — user CRUD, partner CRUD, system health, recent activity feed.

### 12.2 Ceremony Analytics (`/admin/analytics`)
- **KPI strip** — Ceremonies (all-time), Completion rate, Avg time-to-seal, Revenue (30d)
- **🚨 Evaluator-errors alert** — appears as a coral banner above the KPIs if any ceremonies hit the fail-closed `<state>_evaluator_error` status in the last 24 h. Shows the count + total since launch + an action hint to check backend logs.
- **Daily ceremonies** area chart (created vs. sealed) with 7d/30d/90d/180d window selector
- **Funnel** — Pending → Assigned → In session → Completed → Sealed → FL_blocked
- **Top compliance-gate failures** heatmap
- **State breakdown** table (per-jurisdiction totals + completion %)
- **Top notaries** leaderboard

### 12.3 FL Compliance (`/admin/fl-compliance`)
KPI grid, ceremony gate matrix, subpoena response workflow (intake → scope → CSV bundle → respond), RONSP filing lifecycle tracker.

### 12.4 Backfilling state_code
For ceremonies that pre-date the multi-state pipeline:
```bash
POST /api/admin/compliance/backfill-state-codes?default_state=FL&dry_run=true
```
Dry-run first to see how many ceremonies would be updated; the live run copies `state_code` from the notary's commission state first, then falls back to the `default_state` parameter.

### 12.5 Partner / TrustLayer admin
`/admin/trust-layer` — CRUD partners, view public Ed25519 keys, revoke attestations, browse the federated trust graph.

### 12.6 RBAC / SSO
`/admin/rbac` — role assignments. SSO via Auth0, Okta, or Enterprise SSO is configured in `/admin/integrations`.

---

## 13. Troubleshooting

### "My ceremony is stuck on `tx_blocked`"
**Cause**: The TX evaluator found one or more gates unmet.
**Fix**: Open the ceremony → check the `blocked_reasons` list → complete the missing gate (KBA, A/V capture, journal, retention tag, ID approval). Then **Complete & Seal** again.

### "Snapshot link returns 410 Gone"
**Cause**: The snapshot expired (default 7-day TTL).
**Fix**: Generate a fresh snapshot from the State Pickability widget.

### "I see `503 preseal_evaluator_unavailable` when completing"
**Cause**: The multi-state evaluator itself errored (DB outage, code regression). NotaryChain **fails closed** — it will not seal a ceremony when the evaluator is unhealthy.
**Fix**: Retry in a few moments. If it persists, an admin can check `/admin/analytics` for the evaluator-error alert and triage from backend logs. Your ceremony status will be `<state>_evaluator_error` until it can be re-evaluated.

### "Quick Seal returns a transaction ID but I don't see it in 'Recent Document Seals'"
**Cause**: Real-time refresh may have missed the WebSocket update.
**Fix**: Refresh the page. If still missing, check the audit trail at `/audit-trail` with your transaction ID.

### "My SDK iframe shows 'Origin not allowed'"
**Cause**: The `allowed_origins` on your publishable key doesn't include the host the iframe is loaded on.
**Fix**: Developers → SDK Keys → edit the key → add the host (must match scheme + host + port exactly).

### "I lost access to my Asset Vault encrypted file"
**Cause**: AES-GCM-256 keys are owner-only. If you lost your account, the per-asset key is gone.
**Fix**: There is no platform-side recovery — this is by design. **Always set at least one beneficiary** with a release plan on every vault asset so the encrypted material remains accessible to your successors.

### "The Pickability widget shows the same TX ceremony over and over"
**Cause**: You're looking at an older build — the current build diversifies nudges to one per ceremony first.
**Fix**: Hard-refresh (Cmd-Shift-R / Ctrl-Shift-F5). If still happening, file a bug.

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **RON** | Remote Online Notarization — notarization via live A/V ceremony |
| **KBA** | Knowledge-Based Authentication — quiz used to verify principal identity |
| **HCS / HTS** | Hedera Consensus Service / Hedera Token Service — the mainnet ledger we use |
| **SALV** | Smart Asset Life-cycle Vault — encrypted document storage with release controls |
| **TrustLayer** | Federated trust graph with Ed25519 partner attestations |
| **Pre-seal gate** | State-specific compliance check that must pass before a ceremony can be sealed |
| **Pickability score** | % of your open ceremonies that are seal-ready under their state's gates |
| **Compliance Snapshot** | Public, scrubbed, read-only export of your Pickability data |
| **Seal hash** | SHA-256 of the canonical document, anchored to Hedera |
| **Attestation** | Ed25519-signed JSON claim about a NotaryChain seal, issued by a partner |
| **Handoff** | A partial-release event from an Asset Vault owner to a beneficiary |
| **Evaluator-error** | Status indicating the multi-state evaluator itself failed (fail-closed safeguard) |

---

## Need Help?

- **In-app**: Click the chat bubble (bottom-right) on any page → support routes to our team.
- **Email**: support@notarychain.app
- **Docs**: `/compliance/states` for state-by-state legal abstracts.
- **Developer questions**: `/developers/sdk` has the full API playground.

> *NotaryChain — Notarization, done right. Online, in minutes.*
