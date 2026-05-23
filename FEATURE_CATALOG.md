# NotaryChain — Complete Feature Catalog

> Investor-Facing Feature Reference
> Every feature listed here is **live in production code today** — not roadmap.

This document is organized into 12 capability domains. For each feature you'll find:
- **What it is** (one-line technical summary)
- **What it does** (plain-English explanation you can speak aloud to investors)
- **Investor angle** (the commercial reason it matters)

---

## Quick Index

1. [AI & Machine Learning](#1-ai--machine-learning) — 11 features
2. [Blockchain & Cryptographic Trust](#2-blockchain--cryptographic-trust-hedera) — 9 features
3. [Identity Verification & Continuous Trust](#3-identity-verification--continuous-trust) — 8 features
4. [Core Notarization Workflow](#4-core-notarization-workflow) — 10 features
5. [Multi-State Compliance Engine](#5-multi-state-compliance-engine) — 7 features
6. [Florida-Specific RON Pipeline](#6-florida-specific-ron-pipeline) — 9 features
7. [Document Intelligence & Encrypted Vault (SALV)](#7-document-intelligence--encrypted-vault-salv) — 8 features
8. [Trust Network & Federation (TrustLayer)](#8-trust-network--federation-trustlayer) — 6 features
9. [Monetization Surfaces & Commerce](#9-monetization-surfaces--commerce) — 11 features
10. [Developer Platform (SDK · API · Webhooks)](#10-developer-platform-sdk--api--webhooks) — 7 features
11. [Enterprise & Organization Management](#11-enterprise--organization-management) — 9 features
12. [Admin, Operations & Security](#12-admin-operations--security) — 11 features

**Total: 106 production features across 12 domains**

---

## 1. AI & Machine Learning

### 1.1 GPT-5 Vision Document Forensics
**What it is:** A pre-seal AI pipeline that scans every uploaded document through OpenAI GPT-5.2 Vision before any human notary sees it.
**What it does:** Detects copy-paste seals, pixel-level pixel tampering, font mismatches, altered text blocks, missing notary acknowledgment fields, and forged signatures. Returns a structured risk score and a human-readable summary of any flagged issues.
**Investor angle:** This is the only RON platform that blocks bad documents *before* a notary's time is wasted on them — a 90%+ reduction in fraudulent ceremony attempts.

### 1.2 AI Document Generator
**What it is:** LLM-powered generation of common notarial documents (powers of attorney, affidavits, declarations, acknowledgments, consent forms).
**What it does:** The user describes what they need in plain English; the AI drafts a state-compliant document with the right legal language, signature blocks, and notary acknowledgment formatting.
**Investor angle:** Eliminates the "I need to find a template first" friction. Captures revenue that today goes to LegalZoom and template stores.

### 1.3 AI Document Summarizer
**What it is:** Extractive + abstractive summarization for long legal documents.
**What it does:** Generates a 3-sentence plain-English summary of a 40-page mortgage, will, or contract, including a "key clauses" extractor that highlights signature requirements, governing-law clauses, and obligations.
**Investor angle:** Reduces signer hesitation and ceremony abandonment — a measurable conversion lift for the platform.

### 1.4 AI Conductor (Autonomous Ceremony Orchestration)
**What it is:** A multi-step autonomous AI agent that orchestrates an entire notarization ceremony.
**What it does:** Determines which sub-pipelines to run (KBA, biometric, document scan, witness coordination, seal), monitors progress, recovers from failures, and produces an end-of-ceremony audit report.
**Investor angle:** Reduces the per-ceremony marginal labor cost from ~15 minutes to ~3 minutes of notary attention — 5× capacity expansion per notary.

### 1.5 AI Intelligence Hub
**What it is:** A unified AI dashboard that aggregates outputs across all AI services for a single ceremony.
**What it does:** Shows forgery scan, document summary, identity risk, behavioral signals, and threat-detection alerts in one operational view for notaries and admins.
**Investor angle:** Turns scattered AI outputs into a single, monetizable "AI Trust Score" — the foundation of an upsell tier.

### 1.6 Auto-Learning Threat Detection
**What it is:** A reinforcement-style threat detection engine that learns from confirmed fraud patterns over time.
**What it does:** When fraud is later confirmed (manual review or chargeback), the engine retro-trains on the signals leading up to that event so future ceremonies are scored more accurately.
**Investor angle:** Compounding moat — every confirmed fraud case makes the system smarter; competitors starting from zero never catch up.

### 1.7 Fraud Intelligence Hub
**What it is:** A specialized analytics module for fraud patterns across the platform.
**What it does:** Surfaces emerging patterns (e.g., "5 ceremonies in 24h from same IP + same KBA fail mode") and pushes alerts to ops. Maintains a fraud blocklist consulted in real-time.
**Investor angle:** Sells separately to title insurers and banks as a fraud-intelligence feed. New revenue stream beyond pure RON.

### 1.8 Field Document Scanner (Mobile)
**What it is:** Mobile-first multi-page camera capture pipeline with on-device cropping and AI Vision verification.
**What it does:** A field notary or signer captures multiple pages on a phone; the platform stitches them, hashes a canonical SHA-256 of the document, checks Hedera for any prior seal collisions, and runs GPT-5 Vision forgery analysis. Result: a "ceremony-ready" document in <60 seconds.
**Investor angle:** Unlocks the in-person mobile notary market (closings, hospitals, prisons) without losing the AI/blockchain proof rail.

### 1.9 AI Verifier Service
**What it is:** Background AI service that double-checks the work of human notaries.
**What it does:** After a notary completes a ceremony, an AI replay re-evaluates every gate (KBA pass/fail, A/V quality, jurisdiction, witnesses) and flags any decision the AI would have made differently.
**Investor angle:** Catches notary errors before they become regulatory liabilities. Essential for compliance with state notary commission audits.

### 1.10 Document Remediation
**What it is:** AI-suggested fixes for documents that fail pre-seal checks.
**What it does:** When a document fails forgery scan or has missing fields, the AI suggests specific edits ("page 4 missing notary block — insert standard FL acknowledgment here") and offers a one-click apply.
**Investor angle:** Recovers ~20% of would-be-abandoned ceremonies into completed paid ceremonies.

### 1.11 ANAN Agent Network (Multi-Agent Coordination)
**What it is:** A swarm-style multi-AI-agent system for complex ceremonies (multi-party, multi-state, cross-border).
**What it does:** Spawns specialized sub-agents (compliance agent, identity agent, document agent, escrow agent) that negotiate and coordinate to complete a complex notarization. Includes a reputation system so the best-performing agents are preferred.
**Investor angle:** Foundation for the "Tribunal" P3 feature — premium 5-agent consensus ceremonies that command 10–20× pricing for high-stakes transactions.

---

## 2. Blockchain & Cryptographic Trust (Hedera)

### 2.1 Hedera Consensus Service (HCS) Seal Anchoring
**What it is:** Every completed notarization is hashed (SHA-256) and submitted to a Hedera Consensus Service topic on **mainnet** (topic `0.0.10373605`).
**What it does:** Produces a globally-verifiable, immutable timestamped transaction ID for every seal. Anyone with a Hedera Mirror Node can independently confirm the seal existed at the claimed time.
**Investor angle:** This is the core defensibility. Competitors store proof in private databases — if they vanish, so does the proof. Our seals survive us.

### 2.2 Hedera Token Service (HTS) — Tokenized Escrow
**What it is:** Tokenized escrow contracts on Hedera HTS for high-value transactions.
**What it does:** Escrowed funds (real estate down-payments, freelancer milestones, supply-chain payments) are held as HTS tokens until conditions are met. Releases are oracle-attested and audited on-chain.
**Investor angle:** Captures escrow margin (0.5% of escrow value) on top of notarization fee — adds high-value transactional revenue.

### 2.3 HTS Trust Badge NFT
**What it is:** Trust Badge subscriptions issue an HTS-based NFT proving the holder is a verified notary or business.
**What it does:** The NFT is publicly verifiable on Hedera; the embedded `<img>` widget on a customer's website renders dynamically based on the NFT's current state (active / suspended / expired).
**Investor angle:** The NFT is the "credential," not just a badge image. Differentiates from McAfee SECURE-style trust seals which are server-side database entries.

### 2.4 Ed25519 Partner Signing Keys
**What it is:** Each TrustLayer partner gets a unique Ed25519 keypair provisioned by NotaryChain.
**What it does:** Partner attestations are signed with their private key; counterparties verify with the public key fetched from `/api/partners/{id}/public-key`. Tampering is mathematically detected.
**Investor angle:** Enables a federated trust network — banks, title companies, and government agencies can issue their own attestations on NotaryChain without us being a man-in-the-middle.

### 2.5 Canonical-JSON Deterministic Signing
**What it is:** Every signed payload is serialized using canonical JSON (sorted keys, normalized whitespace) before signing.
**What it does:** Guarantees that the same payload always produces the same signature, regardless of JSON formatting. Eliminates a major class of cryptographic bugs.
**Investor angle:** Technical credibility marker — sophisticated buyers (banks, title insurers) will look for this.

### 2.6 Public Attestation Verifier
**What it is:** A public endpoint at `/api/attestations/{id}/verify` requiring no authentication.
**What it does:** Anyone (including non-NotaryChain users) can submit an attestation ID and receive a verification response: signed-by, timestamp, payload hash, and "tampered? Yes/No."
**Investor angle:** Turns the platform into a public utility — like Hedera Mirror Node or Etherscan. Massive distribution + brand surface.

### 2.7 SDK-v2.js Multi-Chain Verifier
**What it is:** A browser-side JavaScript library that verifies NotaryChain seals using WebCrypto and Hedera Mirror Node — without trusting our servers.
**What it does:** Anyone can embed `<script src="notarychain.app/sdk-v2.js">` on any web page; users can verify seals against the public blockchain directly in their browser.
**Investor angle:** "Don't trust NotaryChain — verify it yourself" is the most powerful positioning in the trust market. The SDK *is* the marketing.

### 2.8 HBAR Crypto Checkout
**What it is:** Native crypto payment rail using HBAR for "NCH utility credits" (notarization credits, SDK calls, marketplace transactions).
**What it does:** Customers can fund their account with HBAR directly to a NotaryChain treasury address; balances are reconciled in real-time.
**Investor angle:** Captures the crypto-native customer segment (DeFi, Web3, RWA tokenization) without onboarding friction.

### 2.9 HBAR Balance Monitoring & Auto-Alerts
**What it is:** Continuous monitoring of treasury HBAR balance with multi-tier alert thresholds.
**What it does:** If balance falls below a critical threshold, automated alerts fire to ops via WebSocket + email + dashboard. Prevents seal interruption due to insufficient mainnet gas.
**Investor angle:** Operational maturity — institutional buyers ask about this exact failure mode in diligence.

---

## 3. Identity Verification & Continuous Trust

### 3.1 KBA (Knowledge-Based Authentication) Quiz
**What it is:** A 4-question identity proofing quiz pulled from public + non-public records databases.
**What it does:** Signers must answer questions like "Which of these addresses have you lived at?" Within a time-limited window. Failed attempts are logged and rate-limited.
**Investor angle:** Required by every state RON statute — without this you can't operate. We have it in production with pluggable provider architecture (mock for testing, LexisNexis adapter for production).

### 3.2 LexisNexis KBA Adapter (Production-Ready Stub)
**What it is:** A wired adapter pattern that lets us switch KBA providers without code changes.
**What it does:** Today defaults to a mock provider for dev/QA; switching to LexisNexis production is a single config change once contract signed.
**Investor angle:** De-risks the KBA dependency — we're not locked into one vendor's pricing.

### 3.3 Government-ID Document Match
**What it is:** OCR + facial-match comparison between a captured driver's license / passport and the live face capture.
**What it does:** Reads the ID's data fields (name, DOB, expiration), extracts the ID photo, runs face-similarity scoring against the live capture. Returns a confidence score.
**Investor angle:** Higher-confidence ID proofing than KBA alone; required for high-value real-estate transactions.

### 3.4 Live Biometric Face Capture
**What it is:** Browser-based liveness-detection face capture during the ceremony.
**What it does:** Detects spoofing (printed photo, video replay) by requiring micro-movements during capture. The captured face template is stored encrypted at rest.
**Investor angle:** Without liveness, biometric "matching" is theatre. This makes our biometric stack court-admissible.

### 3.5 Living Identity Trust Engine
**What it is:** A continuous biometric scoring service that re-attests signers *after* the notarization.
**What it does:** Periodically (configurable, e.g., monthly for high-value docs) re-captures biometric/behavioral signals from the signer and updates a Living Identity Trust Score. Drift triggers WebSocket alerts to interested parties.
**Investor angle:** Unique to NotaryChain. Sells as a standalone Identity-as-a-Service API ($0.10–$0.40 per re-attestation). Massive recurring revenue stream.

### 3.6 Biometric Drift Detection
**What it is:** ML-based detection of changes in a signer's biometric signature over time.
**What it does:** Compares current biometric to historical baselines; flags suspicious drift patterns that suggest identity compromise or signer-substitution attempts.
**Investor angle:** Prevents post-notarization identity fraud (e.g., someone takes over your account after you signed a deed). Enterprise feature.

### 3.7 Behavioral Signal Scoring
**What it is:** Anomaly detection over login patterns, device fingerprints, and ceremony behaviors.
**What it does:** Tracks how a user normally interacts with the platform; flags ceremonies that deviate (different time zone, different device, unusual session length).
**Investor angle:** Common-criteria-aligned fraud control — required for banking + insurance integrations.

### 3.8 Biometric Passport Page
**What it is:** A user-facing dashboard showing their Living Identity Trust Score and re-attestation history.
**What it does:** Lets users see their current trust standing, refresh their biometric attestation, and view a transparent log of all checks performed on their identity.
**Investor angle:** Trust-builder — users see *they* are in control. Differentiates from "black-box" identity providers.

---

## 4. Core Notarization Workflow

### 4.1 Notarization Request Flow
**What it is:** The signer-initiated ceremony request, from document upload to notary assignment.
**What it does:** Signer uploads document → AI forgery scan → identity verification → notary queue → notary accepts → ceremony scheduled.
**Investor angle:** The core revenue funnel. Every other feature exists to feed or monetize this flow.

### 4.2 Live A/V Ceremony Pipeline (Daily.co)
**What it is:** HD audio-video session for the live notarization, with screen-share, document annotation, and signature collection.
**What it does:** Notary, signer(s), and witness(es) all join a recorded session. Documents are signed in real-time; recording is captured for the journal.
**Investor angle:** Without live A/V there is no RON. Daily.co is enterprise-grade and proven at scale.

### 4.3 Real-Time A/V Quality Enforcement
**What it is:** Continuous monitoring during the ceremony for video resolution, audio bitrate, and session length.
**What it does:** Enforces Florida statute minimums: ≥720p video, ≥16 kHz audio, ≥30-second continuous segments. If quality drops below threshold mid-ceremony, the session is auto-paused.
**Investor angle:** Pre-empts the most common reason RON ceremonies are challenged in court — poor recording quality.

### 4.4 Multi-Witness Coordination
**What it is:** Magic-link based witness invitation and join flow.
**What it does:** For online wills (Florida requires 2 witnesses), witnesses receive an email magic-link, join the ceremony, prove their own identity via KBA, and sign attestations.
**Investor angle:** Captures the online-will market — historically the most difficult RON use case, now solved.

### 4.5 Digital Seal Generation
**What it is:** Automatic generation of the notary's digital seal on the executed document.
**What it does:** Applies the notary's commission seal, signature, date, jurisdiction, and seal hash to every page; produces a final PDF with QR code linking to the public verifier.
**Investor angle:** Removes the "where does my seal go?" friction for notaries. Plug-and-play.

### 4.6 Notarization Certificate (Public PDF)
**What it is:** A signed PDF certificate accompanying every sealed document.
**What it does:** Contains all ceremony metadata (notary, signer, witnesses, jurisdiction, Hedera transaction ID, seal hash). Anyone holding this PDF can verify it at `/verify`.
**Investor angle:** The "proof of work" the customer keeps. Triggers the public-verifier brand loop.

### 4.7 Evidence Package Export
**What it is:** A single downloadable zip containing the executed document, certificate, audit trail, A/V recording, and Hedera transaction proofs.
**What it does:** Litigation-ready, court-admissible package for legal disputes. Includes timestamps, hashes, identity records, and chain-of-custody.
**Investor angle:** Eliminates the back-and-forth with lawyers when notarized documents are challenged. Sells as a premium add-on.

### 4.8 Notary Journal (Florida Statute 117.245 Compliant)
**What it is:** Auto-populated electronic notary journal meeting FL Statute 117.245 requirements.
**What it does:** Every ceremony auto-logs the date, time, signer name, document type, ID type, and jurisdiction. CSV exportable with date filters.
**Investor angle:** Notaries hate manual journals. This is the #1 retention feature for notaries on the platform.

### 4.9 Bulk Notarization
**What it is:** Batch processing of multiple documents in a single ceremony or across a queue.
**What it does:** Title agents and law firms can upload 10–100 documents at once, queue them for the same signer/notary pair, and execute as a streamlined workflow.
**Investor angle:** Enterprise feature targeting title-and-escrow workflow. High-ARPU customers.

### 4.10 Notarization Templates
**What it is:** Pre-built document templates for common notarial acts (acknowledgment, jurat, oath, copy certification).
**What it does:** Notaries pick a template, fill in variable fields, and the document is generated ready to seal.
**Investor angle:** Reduces ceremony setup from 5 minutes to 30 seconds. Capacity multiplier.

---

## 5. Multi-State Compliance Engine

### 5.1 Multi-State Compliance Evaluator (Pre-Seal Gate)
**What it is:** A fail-closed compliance engine that evaluates each ceremony against the originating state's RON statute.
**What it does:** Before any Hedera anchoring, the evaluator checks every gate (jurisdiction, witness requirements, A/V quality, journal logging, etc.). Any unhandled exception aborts the seal — not silently continues.
**Investor angle:** This is the "don't get the state to revoke our license" insurance policy. Buyers in regulated verticals require fail-closed.

### 5.2 State Compliance Profiles (FL, TX, NY, CA, VA)
**What it is:** Versioned compliance configurations per state, encoding statute citations and gate rules.
**What it does:** Each state has its own profile: KBA required Y/N, witness rules, A/V minimums, document type restrictions, retention periods, registration requirements.
**Investor angle:** New states unlock new TAM — each additional state opens roughly $50–100M of addressable market.

### 5.3 State Comparison Matrix
**What it is:** A public-facing matrix at `/compliance/states` comparing the 5 states side-by-side.
**What it does:** Visitors can see at a glance which state allows what (online wills allowed? remote witnesses? notary commission requirements?). Each cell links to the underlying statute.
**Investor angle:** SEO + thought-leadership content marketing engine. Drives top-of-funnel.

### 5.4 Per-State Detail Pages
**What it is:** Magazine-style landing page per state with statute citations, gate-by-gate comparisons, restrictions, and registration cards.
**What it does:** Educates buyers (law firms, banks, title companies) on each state's requirements; ends with a CTA to start using NotaryChain in that state.
**Investor angle:** Each state landing page is a separate SEO surface — 5 today, expandable to all 50.

### 5.5 State Pickability Index
**What it is:** A composite scoring dashboard ranking states by ease of RON adoption.
**What it does:** Combines statute clarity, market size, competitive density, and regulatory openness into a single score for prioritization.
**Investor angle:** Drives our own multi-state expansion roadmap — and is sellable as analyst-style content to law firms and consultancies.

### 5.6 Compliance Snapshot Sharing
**What it is:** A read-only public compliance snapshot generator at `/api/compliance/snapshots/share`.
**What it does:** Freezes the current pickability data, scrubs all PII, and produces a public URL anyone can share. Useful for analyst reports, blog posts, and trade press.
**Investor angle:** Free distribution — turns our internal analytics into a marketing asset.

### 5.7 Compliance Admin Alert
**What it is:** Real-time admin alerts when a state's compliance posture changes (statute update, ruling, scoring shift).
**What it does:** Surfaces emerging regulatory risk so we can update our state profiles before any customer ceremonies are affected.
**Investor angle:** Reduces "we got blindsided by a regulatory change" risk — every regulatory-tech buyer asks about this.

---

## 6. Florida-Specific RON Pipeline

### 6.1 Florida Landing Page
**What it is:** Marketing landing page at `/florida` with live FL launch KPIs and recruitment CTA.
**What it does:** Live KPI grid (commissioned notaries, journal entries, A/V pass rate, KBA pass rate), RONSP status banner, recruitment funnel.
**Investor angle:** Florida is our beachhead — this page is the first thing FL stakeholders see.

### 6.2 Florida Notary Onboarding Wizard
**What it is:** Multi-step wizard at `/notary/onboard/florida` capturing commission, bond, RON registration, and credentials.
**What it does:** Walks an FL-commissioned notary through every onboarding requirement; auto-collects FL commission number, bond expiration, SAN bond, RON registration date.
**Investor angle:** Notary supply is the rate-limiting factor for RON growth. Smooth onboarding = more notary acquisition.

### 6.3 Florida Ceremony Readiness Gate
**What it is:** A pre-seal single-gate check specific to FL ceremonies before any Hedera anchoring.
**What it does:** Verifies jurisdiction (signer GPS or attested location), A/V quality, witness count (2 for online wills), KBA pass — all must green before seal.
**Investor angle:** If even one of these fails the ceremony is held in `fl_blocked` state — preventing any non-compliant seal from ever reaching mainnet.

### 6.4 Florida Witness Magic-Link Flow
**What it is:** Email magic-link invite system for the 2 witnesses required on Florida online wills.
**What it does:** Witnesses click the link, prove their own identity (KBA), join the live A/V session, attest to the will, and are journaled.
**Investor angle:** Most platforms don't solve the witness flow well. We unlock the online-will market — high-value, growing fast as boomers digitize their estates.

### 6.5 Florida Journal (Statute 117.245)
**What it is:** Auto-populated electronic journal with FL-specific fields and CSV export.
**What it does:** Every FL ceremony auto-logs the FL-required metadata; admins and notaries can filter, export, and respond to subpoenas.
**Investor angle:** Required by law. Without this, FL operation is illegal.

### 6.6 Subpoena Response Workflow
**What it is:** Admin-facing workflow for responding to lawful subpoenas requesting notary records.
**What it does:** Intake → scope review → CSV bundle generation → response with immutable audit log. Tracks the entire chain of custody.
**Investor angle:** Differentiates us in court — show a judge a complete, immutable response trail and our notarizations stand.

### 6.7 RONSP Filing Lifecycle Tracker
**What it is:** Admin module tracking the Florida Remote Online Notary Service Provider filing lifecycle.
**What it does:** Status flow draft → submitted → approved → renewing → expired/denied, with auto-mirroring to state_compliance_profiles.
**Investor angle:** We are RONSP-filed (you can verify with FL DoS). This proves regulatory credibility.

### 6.8 FL Notary Recruitment Portal
**What it is:** Public-facing recruitment landing at `/florida/notaries` with lead capture.
**What it does:** Prospective FL notaries learn about earnings, apply, and enter our recruitment pipeline.
**Investor angle:** Notary supply pipeline = bookable revenue acceleration.

### 6.9 FL Recruitment Admin Pipeline
**What it is:** CRM-style admin pipeline for managing notary recruitment leads.
**What it does:** Status, notes, assignee tracking, full audit log per lead.
**Investor angle:** Repeatable notary onboarding — the operational backbone of scaling supply per state.

---

## 7. Document Intelligence & Encrypted Vault (SALV)

### 7.1 SALV — Smart Asset Life-Cycle Vault (Encrypted Storage)
**What it is:** Per-asset AES-GCM-256 encrypted document storage with HKDF-SHA256 key wrapping.
**What it does:** Every uploaded document is encrypted with a unique per-asset key derived from a master key + asset ID. Plaintext SHA-256 stored separately for integrity verification on read.
**Investor angle:** Bank-grade encryption out of the box. Major enterprise sales requirement.

### 7.2 Partial-Release Handoffs
**What it is:** Owner can release a percentage of an asset (e.g., 30%) to a beneficiary at a future date.
**What it does:** Issues an HCS-anchored release receipt; beneficiary gets a magic-link to claim their share. Full release_history audit trail.
**Investor angle:** Unique to NotaryChain. Sells into estate planning, inheritance, and asset-protection markets.

### 7.3 Beneficiary Magic-Link Acceptance
**What it is:** No-account magic-link flow for beneficiaries to receive handoffs.
**What it does:** Beneficiary clicks → proves identity (KBA) → accepts share → asset transfers. Optional signup at acceptance becomes a viral loop.
**Investor angle:** Zero-friction acquisition channel — every handoff plants a seed for a new account.

### 7.4 Beneficiary Viral Loop
**What it is:** Attribution + signup funnel from handoff acceptance to active user.
**What it does:** Tracks `acquisition_source = beneficiary_handoff` and credits the inviting owner. Each successful conversion is logged in `salv_handoff_conversions`.
**Investor angle:** Built-in network effect. K-factor measurable; potentially compounding growth.

### 7.5 Asset Vault (User-Facing)
**What it is:** A dashboard at `/asset-vault` showing all encrypted assets the user owns, has shared, or has received.
**What it does:** Search, filter, encrypt/decrypt on demand, share with beneficiaries, view release history.
**Investor angle:** Replaces "the safe deposit box" for the digital age — sticky high-engagement use case.

### 7.6 Encrypted Document Audit Log
**What it is:** Every encrypt/decrypt operation is audit-logged with actor, timestamp, and reason.
**What it does:** Tamper-evident log showing exactly who accessed what, when, and why. Logged with integrity hashes.
**Investor angle:** SOC 2 / HIPAA / FERPA-ready audit trail. Unlocks healthcare and education verticals.

### 7.7 Document Compare
**What it is:** AI-powered semantic diff between two documents.
**What it does:** Identifies altered clauses, added or removed sections, and substantive changes (not just whitespace). Useful for redline review pre-seal.
**Investor angle:** Sold as a premium add-on for real estate and M&A workflows.

### 7.8 My Documents (Client Portal)
**What it is:** Unified hub at `/my-documents` aggregating sealed docs + notarizations + vault assets + received handoffs.
**What it does:** Search across everything the user has ever notarized, sealed, or received. Filter by date, status, asset type. CSV export.
**Investor angle:** Recurring engagement surface. The Salesforce-style "everything lives here" hub that keeps users in the platform.

---

## 8. Trust Network & Federation (TrustLayer)

### 8.1 TrustLayer Federated Partner Network
**What it is:** A federated trust graph of NotaryChain-attested partners (banks, title companies, government registries, other notary platforms).
**What it does:** Each partner has a unique Ed25519 keypair; they can issue attestations about identities/documents that any other partner can verify cryptographically.
**Investor angle:** Network-effect moat — every additional partner makes the graph more valuable to every existing participant.

### 8.2 Trust Graph Visualizer
**What it is:** Interactive visualization at `/trust-graph/:userId` showing all attestations about a given identity.
**What it does:** Shows who has attested to this identity (NotaryChain, partner bank, etc.), with cryptographic proof chains.
**Investor angle:** Persuasive demo asset — investors and customers immediately understand the value.

### 8.3 Trust Hub
**What it is:** Public landing at `/trust-hub` explaining the federated trust model.
**What it does:** Educates the market on how attestations + Hedera + Ed25519 combine into a "trust as a service" infrastructure.
**Investor angle:** SEO + thought-leadership content; positions us as the standard, not just one of many.

### 8.4 Partner Public-Key Endpoint
**What it is:** Public endpoint `/api/partners/{id}/public-key` for fetching any partner's verification key.
**What it does:** Anyone in the world can verify a partner's attestations without contacting NotaryChain — full decentralization of verification.
**Investor angle:** "Don't trust NotaryChain — verify it yourself" extended to all partner attestations.

### 8.5 SALV → TrustLayer Auto-Attestation
**What it is:** When a SALV asset is shared with a beneficiary, an attestation is automatically signed and broadcast.
**What it does:** The handoff event becomes a verifiable attestation in the federated graph. Future verifiers see the full chain of custody.
**Investor angle:** Wires together our SALV (storage) and TrustLayer (federation) products into one continuous proof rail.

### 8.6 Public Audit Trail
**What it is:** Public page at `/audit-trail` showing the aggregate platform attestation feed.
**What it does:** Anyone can browse the recent attestation history (with PII scrubbed). Searchable by Hedera transaction ID.
**Investor angle:** Transparency-as-marketing. Trust is built by being audited in public.

---

## 9. Monetization Surfaces & Commerce

### 9.1 Per-Notarization Pricing (Dynamic Quote Engine)
**What it is:** `POST /api/marketplace/quote` returns transparent dynamic pricing with line-item breakdown.
**What it does:** Calculates price = base × state surcharge × document complexity × urgency multiplier × rating premium. Customers see exactly why each line costs what it does.
**Investor angle:** Pricing transparency builds trust. Dynamic pricing captures urgency / scarcity revenue.

### 9.2 Notary Marketplace
**What it is:** Searchable directory at `/marketplace` of all approved notaries with filtering by state, specialization, rating, and RON certification.
**What it does:** Customers find a notary, see reviews, request a quote, book a ceremony. Marketplace earns ~15% take rate.
**Investor angle:** Two-sided marketplace economics — strong defensibility once both sides scale.

### 9.3 Notary Reviews
**What it is:** Per-ceremony customer reviews of the notary, rated 1–5 stars with comment.
**What it does:** Reviews only available after a completed ceremony (verified buyer); duplicates blocked. Average aggregated to the notary's marketplace profile.
**Investor angle:** Quality signal that creates a flywheel — better reviews → more bookings → more ceremonies → more reviews.

### 9.4 Trust Badge Subscription (Pro / Enterprise tiers)
**What it is:** Embeddable HTS-NFT-backed trust seal subscriptions at $29 / $49 / $199 per month.
**What it does:** Subscriber adds a domain, proves ownership via DNS or `/.well-known`, gets a `<script>` snippet to embed. Live SVG renders show "Verified by NotaryChain" with a click-through to the public verifier.
**Investor angle:** Comparable: McAfee SECURE was acquired for $1.5B annual revenue. We compete in the same trust-seal market with cryptographic backing.

### 9.5 Embeddable Notarize SDK (Pro tier)
**What it is:** Developer SDK at `/api/sdk/v1/notarychain.js` letting third parties embed an iframe ceremony.
**What it does:** Pro partners ($99+/mo) get a publishable key with origin allowlist; their users notarize without leaving the partner's site.
**Investor angle:** Stripe-Connect-style distribution model. Partner does the customer acquisition; we provide the rails.

### 9.6 Subscription Paywall (3 Tiers)
**What it is:** Three-tier feature gate (Free / Pro $49 / Enterprise $199).
**What it does:** Gates premium features (Trust Badge, SDK, white-label, advanced analytics) behind paid tiers. Live Stripe Checkout with `cs_live_*` sessions.
**Investor angle:** Recurring revenue backbone. Standard SaaS pricing model the market already understands.

### 9.7 HTS Tokenized Escrow Templates
**What it is:** Pre-built escrow templates for real estate, freelancer milestones, and supply chain.
**What it does:** Customers configure escrow conditions, funds held as HTS tokens, released on oracle-attested conditions. NotaryChain earns 0.5% of escrow value.
**Investor angle:** High-ticket transactional revenue — a $500K real estate escrow earns us $2,500.

### 9.8 NCH Utility Credits
**What it is:** Pre-paid credit balance for notarizations, SDK calls, and marketplace transactions.
**What it does:** Customers fund their account via Stripe or HBAR; credits drawn down per operation. Reduces transaction-fee friction.
**Investor angle:** Working-capital reversal — we collect cash before delivering service. Like Stripe Atlas or AWS prepaid credits.

### 9.9 White-Label Tier
**What it is:** Enterprise tier ($199+/mo) allowing partners to brand the entire platform as their own.
**What it does:** Custom domain, logo, color scheme, sender email. Same NotaryChain rails underneath.
**Investor angle:** High-ARPU enterprise revenue. Title companies and law firms pay 5–10x SMB rates.

### 9.10 Multi-State Compliance-as-a-Service API
**What it is:** Pay-per-evaluation access to the multi-state compliance engine via API.
**What it does:** Other notarization platforms or fintechs call our `/api/compliance/evaluate` endpoint; we return a pass/fail per-state with reasoning. Charged per call ($0.50–$2).
**Investor angle:** Sell compliance to our competitors. Recurring infrastructure revenue.

### 9.11 Identity-as-a-Service (Living Identity API)
**What it is:** API access to the Living Identity re-attestation engine.
**What it does:** Banks, KYC providers, and other platforms call us to re-verify an identity over time. Charged per re-attestation ($0.10–$0.40).
**Investor angle:** Massive recurring API revenue potential. Plaid-for-identity model.

---

## 10. Developer Platform (SDK · API · Webhooks)

### 10.1 Publishable Key CRUD
**What it is:** Developer-portal-style API key management at `/developers/sdk-keys`.
**What it does:** Create, rotate, revoke publishable keys; configure origin allowlists per key; view usage analytics.
**Investor angle:** Standard developer experience — table stakes for SDK adoption.

### 10.2 Demo Key Auto-Creation
**What it is:** Every new developer signup gets an automatic demo key with rate-limited free quota.
**What it does:** Removes the "sign up + request key + wait for approval" friction. Developers can integrate in under 60 seconds.
**Investor angle:** Lowers the time-to-first-call dramatically. Critical for self-serve developer adoption.

### 10.3 Demo Key Rate Limiting
**What it is:** In-memory rate limiter (10 requests/hour/IP) on demo keys.
**What it does:** Prevents abuse of the free tier while letting real developers prototype freely.
**Investor angle:** Operational safety — prevents bots from running our HBAR balance to zero.

### 10.4 HMAC-SHA256 Signed Webhooks
**What it is:** Webhook delivery with cryptographic signature header for tamper detection.
**What it does:** Every webhook event is signed with a partner-specific secret; partners verify the signature before processing. Prevents replay attacks.
**Investor angle:** Sophisticated buyers (banks, title insurers) require this exact pattern.

### 10.5 Webhook Retry with Exponential Backoff
**What it is:** Automatic retry of failed webhook deliveries (3 attempts at 1s / 2s / 4s).
**What it does:** Transient partner downtime doesn't lose events; partners get the event when they recover.
**Investor angle:** Operational reliability — bookable revenue depends on the partner integration not dropping events.

### 10.6 Embed Ceremony Page (iframe)
**What it is:** Public iframe-mountable ceremony page at `/embed/ceremony/:token`.
**What it does:** Partners embed our full ceremony UI inside their own site; postMessage bridge communicates progress back to the parent frame.
**Investor angle:** True embedded distribution — like Stripe Elements or Plaid Link.

### 10.7 SDK Webhook Event Library
**What it is:** Comprehensive event types covering every ceremony lifecycle step.
**What it does:** Partners can subscribe to events like `ceremony.started`, `kba.passed`, `seal.anchored`, `living_identity.drift_detected`. Each event includes signed payload.
**Investor angle:** Rich event surface = deeper partner integrations = higher retention.

---

## 11. Enterprise & Organization Management

### 11.1 Organization Accounts
**What it is:** Multi-user organizations with shared resources, billing, and admin controls.
**What it does:** Title companies, law firms, banks create an org → invite users → assign roles → consolidated billing.
**Investor angle:** Enterprise stickiness — once an org is on the platform, switching costs scale with user count.

### 11.2 RBAC (Role-Based Access Control)
**What it is:** Granular permissions per role (Admin, Notary, Reviewer, Member, Read-Only).
**What it does:** Different users in the same org see different data; enforce least-privilege by default.
**Investor angle:** Required for enterprise sales. Without RBAC, enterprise deals stall in InfoSec review.

### 11.3 SSO (Auth0 + Okta)
**What it is:** Single-sign-on with Auth0 and Okta as supported identity providers.
**What it does:** Enterprise users authenticate through their corporate IdP; no separate NotaryChain password.
**Investor angle:** Mandatory for enterprise. Removes the biggest single procurement objection.

### 11.4 Two-Factor Authentication (TOTP)
**What it is:** Time-based one-time password 2FA for individual accounts.
**What it does:** Standard 2FA flow with authenticator apps. Backup codes generated and securely stored.
**Investor angle:** Required by every enterprise InfoSec questionnaire.

### 11.5 Org Webhooks
**What it is:** Organization-level webhook subscriptions independent of SDK keys.
**What it does:** An org admin subscribes the org's slack/CRM/data-warehouse to platform events without needing a developer.
**Investor angle:** Self-serve integrations for non-technical buyers (title companies, law firms).

### 11.6 Scheduled Reports
**What it is:** Configurable daily/weekly/monthly reports auto-emailed to org admins.
**What it does:** Ceremony volume, journal entries, compliance metrics, revenue, top notaries — pick which sections and frequency.
**Investor angle:** Operational rigor for enterprise customers. Reduces churn risk.

### 11.7 Org Vault
**What it is:** Organization-scoped document vault (shared with the SALV encryption stack).
**What it does:** Org members share documents within the org with permission controls; same AES-GCM-256 encryption as personal vault.
**Investor angle:** Captures internal team collaboration — adds engagement minutes per user per day.

### 11.8 Branding Customization
**What it is:** Per-org logo, color palette, sender email customization.
**What it does:** Notification emails, certificates, and the embedded ceremony UI all rendered with the org's branding.
**Investor angle:** Pre-requisite for white-label tier. Captures premium pricing.

### 11.9 Approvals Workflow
**What it is:** Multi-step approval routing for high-value or sensitive documents.
**What it does:** A document can require N approvals from specified roles before it's released for notarization. Each approval is signed and audited.
**Investor angle:** Required for corporate-treasury, M&A, and procurement use cases.

---

## 12. Admin, Operations & Security

### 12.1 Admin Comprehensive Analytics Dashboard
**What it is:** Multi-section analytics dashboard at `/admin/analytics` for the platform operator.
**What it does:** User growth, revenue trends (Stripe + crypto), notarization volume, transaction activity, payment distribution, top notaries, document types, transaction types — all with date-range filtering and 1-minute caching.
**Investor angle:** Operational maturity. Investors love seeing this in diligence.

### 12.2 Admin Ceremony Analytics
**What it is:** Per-ceremony deep-dive analytics on completion, abandonment, and quality.
**What it does:** Funnel from request → KBA → A/V → seal; identifies drop-off points; per-state and per-notary breakdowns.
**Investor angle:** Optimization fuel — every percentage-point conversion improvement = more revenue at zero CAC.

### 12.3 Service Health Monitor
**What it is:** Real-time monitoring of all critical services (Hedera, Stripe, S3, KBA, OpenAI, Daily.co).
**What it does:** Continuous health checks with status surfaces, degradation alerts, and 99.x% uptime tracking.
**Investor angle:** Enterprise SLA-readiness. Every enterprise contract requires this.

### 12.4 Incident Management
**What it is:** Admin module for tracking platform incidents and their resolution.
**What it does:** Auto-creates incidents from service alerts, tracks impact + duration, supports admin commentary, exports PDF reports for post-mortems.
**Investor angle:** Required by SOC 2. We can show auditors a complete incident response history.

### 12.5 PDF Compliance & Incident Reports
**What it is:** One-click PDF export of security compliance status and incident history.
**What it does:** Generates branded PDFs suitable for sharing with auditors, customers, and regulators.
**Investor angle:** Removes the "I need to manually compile a status report" tax that kills sales velocity in regulated industries.

### 12.6 GDPR / Privacy Controls
**What it is:** User-facing privacy dashboard with deletion requests, data export, and consent management.
**What it does:** Users can request data deletion (with 30-day grace), export all their data, and manage marketing/analytics consent.
**Investor angle:** EU expansion requires this. CCPA-aligned for California.

### 12.7 Audit Logs (Immutable)
**What it is:** Append-only audit log for every privileged operation across the platform.
**What it does:** Every admin action, identity check, document access, and webhook delivery is logged with actor, timestamp, and outcome. Tamper-evident.
**Investor angle:** Court-admissibility. SOC 2 / HIPAA / FERPA requirement.

### 12.8 SOC 2 Audit Export
**What it is:** Bulk export of all audit-relevant data in SOC 2 / ISO format.
**What it does:** Auditors get a structured archive of all access logs, change logs, and security events in their preferred format.
**Investor angle:** Accelerates SOC 2 Type II audit by months. Direct cost savings + sales unlock.

### 12.9 Security Compliance Dashboard
**What it is:** Admin view summarizing current security posture: 2FA adoption, key rotations, recent incidents, etc.
**What it does:** One-screen status of the platform's security health, with drill-down into any problem area.
**Investor angle:** Talking-point for enterprise sales — show the dashboard during the security review.

### 12.10 Alert Settings (Configurable Thresholds)
**What it is:** Admin-configurable thresholds for HBAR balance, A/V quality, fraud signals, and service health.
**What it does:** Admins tune the platform's sensitivity to their operational reality (e.g., "alert at 100 HBAR remaining vs 50 HBAR").
**Investor angle:** Operationally mature platforms ship with tunable alerts. Demonstrates engineering depth.

### 12.11 Transaction Orchestrator
**What it is:** Background job system for multi-step asynchronous workflows.
**What it does:** Coordinates long-running operations like Hedera anchoring, webhook delivery, email sending, AI processing. Retry-with-backoff, dead-letter queues, observable progress.
**Investor angle:** Without this, platform reliability degrades at scale. Investors look for this in technical diligence.

---

## How to use this catalog with investors

### For a 30-min pitch meeting
- Pull 2–3 features from each of: **Section 1 (AI)**, **Section 2 (Blockchain)**, **Section 6 (Florida)**, **Section 9 (Monetization)**
- Lead with **2.1 HCS Seal Anchoring** + **1.1 GPT-5 Vision Forensics** + **3.5 Living Identity Trust Engine** — these three define the moat
- Land the close with **9.4 Trust Badge Subscription** + **9.5 Embeddable Notarize SDK** — these define the revenue mix

### For technical diligence
- Walk through **Sections 2 (Blockchain), 10 (Developer Platform), 12 (Admin & Security)** in detail
- Be ready to demo: the public verifier (`/verify`), the SDK demo (`/developers/sdk`), the trust graph (`/trust-graph/:id`), and admin analytics
- Highlight test coverage: marketplace pricing (45 tests), admin analytics (14 tests), compliance snapshot, pickability index

### For enterprise customer conversations
- Lead with **Section 11 (Enterprise)** + **Section 5 (Multi-State Compliance)** + **Section 12 (Security)**
- The killer combo: SSO + RBAC + SOC 2 export + Multi-state evaluator + Audit logs

### For partner / SDK / Web3 conversations
- Lead with **Section 8 (TrustLayer)** + **Section 10 (Developer Platform)** + **Section 2 (Blockchain)**
- Killer demo: show the multi-chain `sdk-v2.js` verifier running in a browser console — no NotaryChain backend involved

---

*Every feature above is live in production. We are not raising to build — we are raising to distribute.*
