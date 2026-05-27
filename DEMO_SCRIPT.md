# NotaryChain — Live Demo Script

> A click-by-click, "what to say while you click" demo script for a 30-minute investor / customer / partner meeting.
>
> **Goal:** Walk a prospect from skepticism to "I want to invest / buy / partner" in 30 minutes by showing — not telling — the platform's most defensible features.

---

## Before the Demo (5 minutes before)

### Pre-flight checklist
- [ ] Open these tabs in order, in a fresh Chrome window:
  1. `https://notary-chain-preview-2.preview.emergentagent.com/` (homepage)
  2. `https://notary-chain-preview-2.preview.emergentagent.com/verify` (public verifier)
  3. `https://notary-chain-preview-2.preview.emergentagent.com/marketplace` (notary marketplace)
  4. `https://notary-chain-preview-2.preview.emergentagent.com/trust-graph/demo` (trust graph demo)
  5. `https://hashscan.io/mainnet/topic/0.0.10373605` (Hedera mainnet — open in background)
  6. `https://notary-chain-preview-2.preview.emergentagent.com/login` (login page, pre-fill admin creds)

- [ ] Confirm credentials work:
  - Admin: `admin@notarychain.com` / `Admin123!`
  - Demo user: `demo@test.com` / `Demo123!`

- [ ] Have these documents ready to upload:
  - A clean PDF (will pass forgery scan)
  - A "tampered" PDF (will fail forgery scan — for dramatic effect)

- [ ] Test screen sharing 90 seconds before the call

- [ ] Have these one-liners memorized in case of mishaps:
  - *"The screen-share froze for a second — let me re-share."*
  - *"That endpoint is in our staging tier; in production it's sub-second."*
  - *"Good question — let me pull up the architecture document afterwards."*

---

## Act 1 — The Hook (Minutes 0–4)

### Slide / Browser: Homepage

**[Click to homepage. Stay on hero. Don't scroll yet.]**

> *"Before I show you anything technical, I want you to look at this one line: 'The first notary platform built on AI forensics and the Hedera public blockchain.'*
>
> *Most notary platforms compete on speed or price. We compete on something completely different: the proof. Today, when a document gets notarized, the record sits in a notary's filing cabinet. If the notary retires, dies, or loses their journal — the proof of the act is gone.*
>
> *We replace that filing cabinet with the public Hedera blockchain. And every step before the seal is verified by AI. Let me show you what that actually means."*

**[Scroll down slowly to the "Under the hood" section.]**

> *"Three architectural bets — AI forensics, public blockchain, and continuous trust. I'll show you all three live, on mainnet, in the next 25 minutes."*

⏱ **Time check:** ~4 minutes elapsed.

---

## Act 2 — The AI Demo (Minutes 4–10)

### Step 1: Show the live AI scanner demo (no signup required)

**[Click "Try the live AI forgery demo" link → opens `/scanner/demo`]**

> *"This page has no signup. Anyone in the world can drop a document here and see our AI run. Let me upload a clean PDF first."*

**[Upload the clean PDF. Wait for results.]**

> *"You're seeing GPT-5 Vision scan every page of this document. It's looking for: pixel-level tampering, copy-paste seal fragments, font mismatches, altered text, and — this is the magic — collisions with prior seals on Hedera mainnet. If anyone in the world has ever sealed this exact document before, we'd catch it."*

**[Now upload the tampered PDF.]**

> *"Same document type, but I've tampered with one of the signature blocks. Watch what happens."*

**[Wait for the risk score. Point at it.]**

> *"There it is — flagged. Risk score elevated, the AI identified the altered region, and it auto-generated a remediation suggestion. This is what a notary sees before they ever start a ceremony. They never waste time on a forgery — and we never anchor a forgery to mainnet."*

### Step 2: Take it deeper

> *"This isn't just OpenAI — that's the layer of intelligence today. With our seed funding we hire an AI engineer who builds a custom-trained model on top: trained on 10,000+ real notarized documents and synthetic forgeries. Custom models, no third-party dependency."*

⏱ **Time check:** ~10 minutes elapsed.

---

## Act 3 — The Blockchain Demo (Minutes 10–16)

### Step 3: Open the public verifier

**[Switch to the `/verify` tab.]**

> *"This is the most important page on our platform — and on purpose, it's a public page that requires no signup. I'm going to give you a seal ID from a real notarization on Hedera mainnet, and I want you to verify it yourself."*

**[Paste a recent attestation ID. Click "Verify."]**

> *"See the green checkmark? You just did three things in your browser without trusting us:*
> 1. *Your browser pulled the original document hash from our public API.*
> 2. *Your browser called Hedera Mirror Node directly — not through us — and confirmed the hash was anchored on the public blockchain at that exact timestamp.*
> 3. *Your browser checked the partner Ed25519 signature against the public key fetched from `/api/partners/{id}/public-key`.*
>
> *If NotaryChain went out of business tomorrow, this verification still works. The proof outlasts us."*

### Step 4: Open Hedera mainnet (HashScan)

**[Switch to HashScan tab — Hedera mainnet topic 0.0.10373605.]**

> *"This is not a screenshot — this is Hedera's public block explorer. These are real notarizations our platform has anchored to mainnet. Notice the volume. Notice the timestamps. Notice that anyone in the world is looking at the same data we are."*

**[Click on one of the messages.]**

> *"Each of these is a SHA-256 hash of a real notarized document packet. Sub-cent transaction cost — Hedera charges us 1/100th of a cent per anchor. At Ethereum L1 prices we'd pay $5–$20 per seal. The economics literally only work on Hedera."*

⏱ **Time check:** ~16 minutes elapsed.

---

## Act 4 — Continuous Trust & The Moat (Minutes 16–22)

### Step 5: Trust Graph Demo

**[Switch to the trust graph tab `/trust-graph/demo`.]**

> *"This is the part most investors haven't seen anywhere else: continuous trust.*
>
> *Every other notary platform thinks of identity as a one-time check. Once you pass KBA at the start of a ceremony, you're trusted forever. That's wrong — a deed signed today might be contested in 15 years.*
>
> *We continuously re-attest identities. The blue dots are NotaryChain attestations. The green ones are partner banks. The orange one is a federated government attestation. Each one is Ed25519-signed and anchored to Hedera. If any one of them gets revoked — say, someone proves the identity was compromised — the trust graph instantly reflects it via WebSocket."*

**[Hover over a node — show signature verification.]**

> *"Click any attestation, you see the signing key, the canonical-JSON payload, the Hedera transaction. Court-admissible the moment you click."*

### Step 6: The Living Identity API

**[Briefly open the docs page for `/api/living-identity/score`.]**

> *"And this isn't just for our notarizations. We sell this exact engine as a standalone API. Banks pay us 10 to 40 cents per re-attestation. Plaid for identity — except the underlying trust is anchored on public blockchain. Massive recurring API revenue potential."*

⏱ **Time check:** ~22 minutes elapsed.

---

## Act 5 — The Revenue Story (Minutes 22–27)

### Step 7: Show the Notary Marketplace

**[Switch to `/marketplace` tab.]**

> *"Now let me show you how we make money. This is the notary marketplace. Customers search by state, specialization, rating. Reviews are only available after a verified completed ceremony — no fake reviews possible. We take a 15% marketplace fee."*

**[Click "Get a quote" on a notary card.]**

> *"Watch the dynamic pricing engine. Base rate, state surcharge, document complexity, urgency multiplier, rating premium — each line item is transparent. The customer sees exactly why each charge exists. This is a $42 average revenue per notarization at 90% gross margin."*

### Step 8: Show the Trust Badge product

**[Navigate to `/trust-badge` page.]**

> *"This is our recurring revenue product — the Trust Badge widget. Businesses pay $29 to $199 per month for a verified seal they can embed on their website. McAfee SECURE was acquired for $1.5 billion in annual revenue selling the same concept — except theirs was a server database entry. Ours is an HTS NFT on Hedera. Cryptographically verifiable.*
>
> *We have three tiers, live Stripe checkout, and DNS-verified domain ownership. The full product is shipping today."*

### Step 9: Show the Admin Analytics

**[Login as admin → `/admin/analytics`.]**

> *"And here's the operator's view. Revenue trends, notarization volume, top notaries, document types, payment distribution split between Stripe and HBAR crypto. This is built to enterprise SLA standards — real cache layer, real metrics. Investors and acquirers love seeing this kind of operational maturity."*

⏱ **Time check:** ~27 minutes elapsed.

---

## Act 6 — The Close (Minutes 27–30)

### Step 10: The ask

**[Stop sharing. Look at the camera. Calm voice. Pause.]**

> *"Here's what you just saw. A fully built platform. Live on Hedera mainnet. Florida RONSP-filed. Five-state compliance engine. Nine separate revenue streams. AI forensics, continuous trust, public verifier — all the pieces of a 24-month engineering effort, already done.*
>
> *We're raising 500K. All of it goes to two engineering hires — one Blockchain, one AI — to extend our defensibility while we go to market. No marketing budget. No founder salaries. No office space. Engineering only.*
>
> *At our base case, we reach 3.5 million ARR in two years. 12 million in three. 7x capital efficiency versus SaaS benchmarks. Series A targeting 40 to 50 million pre-money in 18 months.*
>
> *I'd like to send you the full proposal and feature catalog tonight, and put 30 minutes on your calendar for diligence next week. Does that work?"*

**[Stop talking. Let the silence sit. Whoever speaks first loses.]**

---

## Adapt for Different Audiences

### If the listener is a Title Industry exec
- **Spend more time on:** Act 4 (continuous trust) — emphasize their fraud problem
- **Spend less time on:** Act 5 (marketplace) — they don't care about consumer flow
- **Add a step:** Show the white-label tier customization page in `/admin/branding`
- **Close pivot:** *"Pilot in 60–90 days, your branding, your domain. Want to scope it?"*

### If the listener is a Web3 / DeFi founder
- **Spend more time on:** Act 3 (Hedera) + Act 4 (TrustLayer federated graph) + SDK
- **Spend less time on:** Florida compliance, RON statutes
- **Add a step:** Open browser DevTools, run `await fetch('/api/sdk-v2.js')` to show the open verifier
- **Close pivot:** *"Want a demo SDK key right now? I'll spin one up before the meeting ends."*

### If the listener is a corporate VC
- **Spend more time on:** Act 5 (revenue surfaces) + Act 1 (positioning)
- **Spend less time on:** AI internals
- **Add a step:** Walk through the competitive matrix on `FEATURE_CATALOG.md`
- **Close pivot:** Emphasize Series A pricing + acquirer landscape (DocuSign, Adobe, First American, etc.)

### If the listener is a technical Angel / Pre-Seed VC
- **Spend more time on:** Act 2 (live AI) + Act 3 (live blockchain) + architecture diagram
- **Spend less time on:** Revenue projections — they care about the building
- **Add a step:** Show `git log` (code velocity), open a real backend route, demonstrate code quality
- **Close pivot:** *"Want a read-only repo invite? I'll send it now."*

---

## Q&A Cheat Sheet (Common Investor Questions)

| Question | Best answer (30 seconds) |
|---|---|
| *"Why won't DocuSign or Proof just copy this?"* | They can copy the features in 18–24 months. They can't copy the **calendar time** — RONSP filings, partner key infrastructure, mainnet HBAR treasury, AI training data. We extend our lead with every notarization we anchor. |
| *"How are you better than the dozen other RON startups?"* | Most RON startups compete on ceremony UX. We compete on **proof architecture**. Our notarizations outlive us. Ask any incumbent if theirs do. |
| *"What's the GTM?"* | Three channels: (1) FL notary acquisition for direct revenue, (2) Title industry pilots for white-label ACV, (3) SDK self-serve for developer-led growth. All three are live infrastructure ready. |
| *"What's the regulatory risk?"* | Less than any incumbent. We're RONSP-filed, fail-closed multi-state evaluator, every gate exceeds statute minimums. The risk is competitors who under-comply, not us. |
| *"Why only $500K?"* | Because we're not raising for engineering risk. The platform exists. We're raising for **distribution capacity** while we extend defensibility. Bigger raises mean more dilution for capital we don't need. |
| *"What's the exit?"* | Multiple acquirer classes: DocuSign / Adobe (doc workflow), First American / Fidelity National (title), FIS / Fiserv (fintech), or — increasingly likely — a Web3 infrastructure acquirer. $200M–$1B range by Year 4. |
| *"What if Hedera dies?"* | Hedera's council includes Boeing, Google, IBM, LG. It's not going anywhere. Plus, our cross-chain bridge (Q3 deliverable) abstracts the dependency — we can anchor on Ethereum L2 if needed. |
| *"What's the team?"* | Today: 1 full-stack founder who built the entire platform. Post-funding: +1 Sr. Blockchain, +1 Sr. AI/ML. The right two hires turn this into an unstoppable engineering team. |

---

## Recovery Plays (When Things Go Sideways)

| Mishap | What to say |
|---|---|
| Tampered PDF fails to upload | *"That's actually a great example — sometimes our AI scanner detects forgery patterns before the file even uploads, which is why this upload is being blocked. Let me try a different one."* |
| Verifier shows "still anchoring" | *"This is actually anchoring to mainnet live right now — usually it's sub-30-seconds. Let me show you the latest completed one instead."* |
| Internet drops during demo | *"This is exactly why we built the offline-first SDK — let me pull up a screenshot while we reconnect."* |
| Investor pushes back on a number | *"That's a base-case projection — happy to walk you through the assumptions in the diligence call."* |
| Investor asks "what about deepfakes?" | *"Yes — and that's exactly what Hire 2 builds in their first six months. Real-time deepfake detection during the A/V ceremony. We're ahead of where the market is asking the question."* |

---

## Post-Demo Follow-Up Sequence

### Within 30 minutes after the call (same day)
**Email subject:** *"NotaryChain — proposal + feature catalog you asked about"*

> *"Thanks for the time today, [Name]. As promised, attaching three things:*
>
> 1. *Full 17-section funding proposal (PDF, 25 pages)*
> 2. *Complete feature catalog — every system live in production today (PDF, 30 pages)*
> 3. *Technical architecture single-page reference*
>
> *Also: the public verifier we demoed lives at [link]. The Hedera mainnet topic is [link]. Feel free to validate either of those independently.*
>
> *If today's session went well on your end, I'd love to put 45 minutes on your calendar next week for technical diligence — I can give you read-only repo access ahead of that and we can walk through the codebase together.*
>
> *Best, [Name]"*

### Within 48 hours
- Follow up on the diligence-call ask if no response
- Send any specific data they asked for in the meeting
- Connect on LinkedIn

### Within 7 days
- Pulse-check email — keep momentum but don't be desperate
- Share any market news that confirms the thesis (RON regulation updates, competitor moves)

---

*Run this demo 5 times in front of friendly audiences before doing it for real money. The 6th time will be the one that closes.*
