# Autonomous Notary Agent Network (ANAN) — Technical Specification

## 1. Executive Summary

ANAN transforms NotaryChain from "AI-assisted" to "AI-conducted" notarization. A swarm of three specialized GPT-5.2 agents (Verifier, Witness, Sealer) autonomously execute legally binding notarizations using a blind 2-of-3 consensus mechanism with human escalation.

## 2. Swarm Consensus Logic

### 2.1 Blind Scoring Protocol

Each agent runs **concurrently and independently** via `asyncio.gather()`. No agent can see another's score until all three have committed.

**Protocol Steps:**
1. **Commit Phase**: Each agent analyzes the document/identity and produces a sealed confidence score (0-100) + reasoning hash
2. **Reveal Phase**: After all 3 agents commit, scores are revealed simultaneously
3. **Oracle Phase**: Consensus Oracle aggregates with weighted formula

**Score Isolation:**
- Agents receive ONLY the raw ceremony data (document, identity, metadata)
- No cross-agent communication during analysis
- Each agent's GPT-5.2 session uses a unique `session_id` to prevent context leakage

### 2.2 Consensus Oracle Architecture

```
Weighted Score = (Verifier × 0.40) + (Witness × 0.30) + (Sealer × 0.30)

APPROVED:  weighted_avg >= 70  AND  min(scores) >= 40  AND  pass_count >= 2
REJECTED:  weighted_avg < 40   OR   any_score < 15
ESCALATE:  everything else → Human-in-the-Loop
```

**Oracle Triggers:**
- APPROVED → Hedera HCS Seal + Certificate Generation
- REJECTED → Rejection Record + Audit Log
- ESCALATE → HITL Queue Entry + Notification

### 2.3 Agent Specializations

| Agent | Domain | Weight | GPT-5.2 System Prompt Focus |
|-------|--------|--------|---------------------------|
| Verifier | Identity & Biometrics | 0.40 | 3D facial geometry, ID forensics, document authenticity |
| Witness | Audit & Evidence | 0.30 | Session integrity, evidence chain, Merkle tree validation |
| Sealer | Compliance & Blockchain | 0.30 | RON jurisdiction rules, regulatory compliance, seal readiness |

## 3. Dynamic Fraud Intelligence

### 3.1 Learning Layer Design

Each agent receives a `fraud_context` injection containing:
- Known fraud patterns for the document type
- Recent deepfake detection signatures
- Jurisdiction-specific risk indicators

The fraud context is refreshed per-ceremony from a `fraud_intelligence` MongoDB collection.

### 3.2 RON Compliance Engine

State-specific rules are encoded as configuration:
- **Florida (FL)**: Audio/video required, tamper-evident seal
- **Texas (TX)**: Identity proofing + credential analysis
- **Virginia (VA)**: First RON state, knowledge-based authentication

## 4. Supervised Autonomous Notary (SAN) Framework

### 4.1 Bond Structure

Virtual $1M E&O Insurance Bond tracked on-chain:

```
Bond Pool:
- Starting Balance: $1,000,000
- Slash Events: Agent errors reduce balance
- Restock: 0.5% of each ceremony fee goes to bond pool
- Min Threshold: $500,000 (below = pause autonomous mode)
```

### 4.2 Slashing Rules

| Event | Slash Amount | Trigger |
|-------|-------------|---------|
| False Approval | $10,000 | Human review overturns APPROVED |
| False Rejection | $2,000 | Human review overturns REJECTED |
| Escalation Timeout | $500 | HITL not resolved in 24h |
| Agent Divergence | $1,000 | 3-way disagreement (all different) |

### 4.3 Restocking

- 0.5% of each ceremony transaction fee
- Monthly insurance premium credits
- Performance bonuses when approval accuracy > 99%

## 5. Technical Stack

### 5.1 LLM Configuration

All three agents use **GPT-5.2** via `emergentintegrations`:
- Model: `openai/gpt-5.2`
- Each agent has a specialized system prompt
- Unique session IDs prevent cross-contamination
- Max analysis tokens: 4096 per agent

### 5.2 Hedera HCS Integration

Sealed ceremonies submit to Hedera Consensus Service:
- Topic: Dedicated ANAN topic ID
- Message: JSON with ceremony hash, consensus scores, agent evidence
- Verification: Public explorer URL for audit

### 5.3 Database Schema

```
anan_ceremonies: {
  ceremony_id, anan_mode: true,
  blind_scores: { verifier: {score, hash, reasoning}, witness: {...}, sealer: {...} },
  consensus: { weighted_avg, result, oracle_decision, decided_at },
  escalation: { status, assigned_to, resolved_at, override_decision },
  bond_impact: { event_type, amount, balance_after },
  blockchain_seal: { ... }
}

anan_escalations: {
  escalation_id, ceremony_id, reason, scores, created_at,
  status: "pending"|"assigned"|"resolved",
  assigned_to, resolved_at, override_decision, notes
}

anan_bond: {
  balance, total_slashed, total_restocked, events: [...]
}
```

## 6. Implementation Roadmap

### Phase 1: MVP — Instant Affidavit (Current)
- Blind 2-of-3 GPT-5.2 consensus engine
- HITL escalation queue
- ANAN mode toggle on ceremony creation
- ANAN Dashboard with swarm visualization
- SAN bond status tracking

### Phase 2: Fraud Intelligence
- Global fraud feed ingestion
- Per-jurisdiction RON compliance rules
- Deepfake evolution tracking

### Phase 3: Full Autonomy
- Smart contract bond management on Hedera
- Multi-jurisdiction RON automation
- Agent weight self-tuning based on accuracy

---
*Document Version: 1.0 | Date: March 29, 2026 | Author: NotaryChain Architecture Team*
