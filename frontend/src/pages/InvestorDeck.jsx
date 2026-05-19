import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Brain, Fingerprint, Link2, Users, FileCheck, ChevronRight, Send, CheckCircle, Layers, Eye, Globe, Zap, BarChart3, ArrowRight, Award, Server, Database, Cpu, GitBranch, Activity, Box, Radio, CreditCard, Calendar, FileText, Settings, UserCheck, Video, Bell, Scale, Network, Blocks, Vote, Wifi, ShieldCheck, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════ DATA ═══════════════════ */

const PLATFORM_STATS = [
  { label: 'Features Shipped', value: '100+' },
  { label: 'API Endpoints', value: '280+' },
  { label: 'Integrations', value: '10' },
  { label: 'Internal Tests', value: 'Passing' },
];

const TRADEMARKS = [
  { name: 'NotaryChain', feature: 'Platform name', reason: 'Unique brand combining notary + blockchain' },
  { name: 'AI Orchestrator', feature: 'GPT-5.2-powered escrow condition extraction and enforcement', reason: 'Novel AI system that converts contracts into programmable financial instruments' },
  { name: 'Autonomous Notary Agent Network', feature: '3-agent GPT-5.2 blind consensus swarm for notarization', reason: 'Industry-first AI swarm architecture for autonomous document verification' },
  { name: 'Biometric Passport', feature: 'Unified identity credential via face verification', reason: 'Unique identity verification concept for notarization' },
  { name: 'Biometric Proof of Intent', feature: 'Facial geometry + liveness gate for escrow settlement', reason: 'Novel identity-bound escrow release mechanism designed to reduce fraud risk' },
  { name: 'Dynamic Fraud Intelligence', feature: 'Self-tuning jurisdictional fraud patterns injected into AI agents', reason: 'Adaptive threat detection for RON compliance' },
  { name: 'SAN Bond Ledger', feature: 'On-chain Hedera HCS bond audit trail', reason: 'Cryptographic accountability for AI agent performance' },
  { name: 'Oracle Verification', feature: 'External data feed integration for autonomous escrow condition verification', reason: 'Programmatic milestone verification reducing intermediary dependency' },
  { name: 'AI Conductor Mode', feature: 'LLM-guided step-by-step transaction execution', reason: 'Distinctive AI-guided workflow branding' },
  { name: 'Evidence Package', feature: 'Automated settlement audit trail generation', reason: 'Novel automated compliance artifact' },
  { name: 'Document Remediation', feature: 'AI clause analysis & fix suggestions', reason: 'Unique AI-powered document healing concept' },
  { name: 'Auto-Learning Threat Detection', feature: 'GPT-5.2 responses auto-generate fraud patterns', reason: 'Self-improving threat intelligence that learns from every ceremony' },
  { name: 'Tokenized Escrow (HTS)', feature: 'Hedera Token Service fungible tokens for escrow value', reason: 'On-chain tokenized escrow combining DeFi with legal notarization' },
  { name: 'Transaction Orchestrator', feature: 'Blueprint-driven multi-party transaction engine with AI risk scoring', reason: 'Turns a notary tool into a full transaction management platform — larger TAM' },
];

const FEATURES = [
  {
    icon: Vote,
    title: 'ANAN: Autonomous Notary Agent Network',
    trademark: true,
    description: 'Industry-first 3-agent GPT-5.2 swarm that performs blind consensus voting on every notarization. Verifier, Witness, and Sealer agents independently analyze documents, then reach consensus without seeing each other\'s votes. Includes dynamic fraud intelligence and agent reputation auto-tuning.',
    stats: ['3-agent blind consensus', 'GPT-5.2 swarm AI', 'Virtual bond reserve', 'Self-tuning weights'],
    color: '#8b5cf6',
  },
  {
    icon: Scale,
    title: 'Dynamic Escrow Intelligence',
    trademark: true,
    description: 'Transforms legal documents into programmable financial instruments. The AI Orchestrator extracts performance triggers from contracts, oracle networks verify milestones autonomously, and biometric proof of intent ensures funds move only between verified individuals. Real-time WebSocket notifications keep all parties synchronized.',
    stats: ['3 Trust Gaps solved', 'Oracle verification', 'Biometric settlement', 'Real-time WebSocket'],
    color: '#f59e0b',
  },
  {
    icon: Brain,
    title: 'AI Transaction Orchestrator',
    trademark: true,
    description: 'Autonomous AI engine powered by GPT-5.2 that manages the entire notarization lifecycle. Identifies document types, suggests signers, validates compliance, and orchestrates multi-party transactions end-to-end with real-time streaming status.',
    stats: ['High automation rate', 'Sub-second decisions', '11 orchestration stages'],
    color: '#3b82f6',
  },
  {
    icon: Fingerprint,
    title: 'Biometric Passport & Proof of Intent',
    trademark: true,
    description: 'Advanced facial recognition creates biometric identities with liveness detection. GPT-5.2 Vision performs facial geometry analysis and anti-spoofing checks. The Biometric Proof of Intent ties escrow settlement keys directly to verified identities, adding a security layer against unauthorized fund releases.',
    stats: ['GPT-5.2 Vision analysis', 'Liveness detection', 'Identity-bound proof', 'Escrow settlement gate'],
    color: '#a855f7',
  },
  {
    icon: Blocks,
    title: 'Blockchain Sealing & On-Chain Bond',
    trademark: false,
    description: 'Every notarized document and escrow lifecycle is cryptographically sealed on Hedera Hashgraph mainnet. The SAN Bond Ledger records all agent performance events on-chain, creating a verifiable audit trail designed for tamper resistance and long-term integrity.',
    stats: ['Hedera Mainnet', 'On-chain bond ledger', 'SHA-256 hashing', 'Tamper-resistant trail'],
    color: '#06b6d4',
  },
  {
    icon: Shield,
    title: 'Enterprise RBAC, SSO & Fraud Intelligence',
    trademark: false,
    description: 'Granular role-based access control with 23 permissions across 7 categories. Single sign-on via Auth0 and Okta. Dynamic Fraud Intelligence injects jurisdictional RON compliance rules and threat patterns into AI agent analysis in real-time.',
    stats: ['23 permissions', 'Auth0 + Okta SSO', '8 fraud patterns', '8 RON jurisdictions'],
    color: '#10b981',
  },
  {
    icon: Blocks,
    title: 'HTS Tokenized Escrow',
    trademark: true,
    description: 'Transforms escrow agreements into Hedera Token Service fungible tokens on mainnet. Full token lifecycle management — mint, transfer, burn — with real-time WebSocket notifications and on-chain verification via Hedera Mirror Node. Bridges DeFi tokenomics with legal notarization.',
    stats: ['Hedera HTS mainnet', 'Fungible tokens', 'Mirror Node verify', 'Real-time WS events'],
    color: '#f97316',
  },
  {
    icon: Radio,
    title: 'Auto-Learning Threat Detection',
    trademark: true,
    description: 'Every GPT-5.2 ceremony response is analyzed for threat signals. The system automatically discovers fraud patterns from agent verdicts, classifies severity, and creates new threat rules that are injected into future ANAN agent analysis. Self-improving security that gets smarter with every transaction.',
    stats: ['Auto-learns patterns', 'Severity classification', 'Feeds back to ANAN', 'Hit count tracking'],
    color: '#ef4444',
  },
  {
    icon: CreditCard,
    title: 'Subscription Paywall & Monetization',
    trademark: false,
    description: 'Four-tier subscription model (Starter $0, Trust Badge $29/mo, Professional $99/mo, Enterprise $199/mo) with Stripe checkout. 21 features gated across tiers with server-side enforcement, admin bypass, and structured upgrade prompts. Built for SaaS revenue from day one.',
    stats: ['3 tiers', '21 gated features', 'Stripe checkout', 'Server + client gates'],
    color: '#8b5cf6',
  },
  {
    icon: GitBranch,
    title: 'Transaction Orchestrator',
    trademark: true,
    description: 'Full lifecycle engine for complex multi-party transactions — from draft to blockchain settlement. Blueprint-driven workflows (Real Estate Closing, Business Contract, Estate Settlement) coordinate 6+ participant roles across dependency-ordered task graphs. AI Risk Engine scores live transactions (0-100), flags overdue tasks, detects blocked chains, and suggests next-best actions. Every event sealed on a dedicated Hedera HCS topic with on-chain audit trail. In-app messaging keeps all parties in context.',
    stats: ['3 system blueprints', '6+ participant roles', 'AI risk scoring', 'Hedera on-chain audit'],
    color: '#0ea5e9',
  },
  {
    icon: Activity,
    title: 'Living Identity Notarization',
    trademark: true,
    description: 'Identity is no longer a snapshot — it\'s a living biometric ledger that ages with the user, detects compromise the moment it happens, and can be re-challenged by any party at any time. Genesis Anchor sealed on Hedera mainnet. Identity Drift Score (0-100, four tiers) updates on every interaction via GPT-5.2 Vision drift analysis. Re-Attestation Protocol exposes a per-challenge billable API ($0.50/challenge) for partner platforms — turning NotaryChain into an identity oracle for title companies, lenders, and other notarization platforms.',
    stats: ['5 net-new trademarks', 'GPT-5.2 drift detection', 'Per-user HCS sealing', '$0.50/challenge oracle API'],
    color: '#22c55e',
  },
];

const AI_PIPELINE = [
  { phase: '01', name: 'Document Remediation', trademark: true, desc: 'GPT-5.2 analyzes clauses, identifies issues, and suggests fixes before notarization begins.', color: '#3b82f6' },
  { phase: '02', name: 'ANAN Blind Consensus', trademark: true, desc: '3-agent AI swarm (Verifier, Witness, Sealer) independently analyze and vote. 2-of-3 consensus required.', color: '#8b5cf6' },
  { phase: '03', name: 'Biometric Passport', trademark: true, desc: 'GPT-5.2 Vision biometric identity credential with liveness detection and 3D facial geometry.', color: '#a855f7' },
  { phase: '04', name: 'AI Conductor Mode', trademark: true, desc: 'LLM-guided step-by-step transaction execution with real-time compliance validation and streaming.', color: '#06b6d4' },
  { phase: '05', name: 'Escrow Settlement', trademark: true, desc: 'Oracle-verified conditions trigger autonomous fund release. Biometric Proof of Intent gates settlement.', color: '#f59e0b' },
  { phase: '06', name: 'Blockchain Sealing', trademark: false, desc: 'Lifecycle hash sealed on Hedera HCS. Bond events recorded. Immutable audit trail generated.', color: '#10b981' },
];

const FEATURE_CATEGORIES = [
  { name: 'Core Notarization', count: 7, icon: FileText, color: '#3b82f6' },
  { name: 'AI & Intelligence', count: 14, icon: Brain, color: '#8b5cf6' },
  { name: 'Security & Identity', count: 11, icon: Shield, color: '#ef4444' },
  { name: 'Blockchain & Verification', count: 9, icon: Link2, color: '#06b6d4' },
  { name: 'Escrow Intelligence', count: 10, icon: Scale, color: '#f59e0b' },
  { name: 'ANAN Agent Network', count: 6, icon: Vote, color: '#a855f7' },
  { name: 'Payments & Subscriptions', count: 7, icon: CreditCard, color: '#10b981' },
  { name: 'Organization & Enterprise', count: 12, icon: Users, color: '#f97316' },
  { name: 'Real-Time & WebSocket', count: 9, icon: Wifi, color: '#ec4899' },
  { name: 'Templates & Documents', count: 6, icon: FileCheck, color: '#14b8a6' },
  { name: 'Marketplace & Booking', count: 4, icon: Calendar, color: '#6366f1' },
  { name: 'Admin & Monitoring', count: 8, icon: Settings, color: '#64748b' },
];

const DEEP_METRICS = [
  { label: 'Total Features', value: '100+' },
  { label: 'AI Features', value: '14' },
  { label: 'Trademarkable IP', value: '14' },
  { label: 'RBAC Permissions', value: '23' },
  { label: 'Oracle Types', value: '4' },
  { label: 'AI Agents', value: '3' },
  { label: 'Trust Gaps Solved', value: '3' },
  { label: 'Feature Categories', value: '12' },
];

/* ═══════════════════ PASSWORD GATE ═══════════════════ */

function PasswordGate({ onVerified }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/investor-deck/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { setError('Invalid access code'); setLoading(false); return; }
      onVerified();
    } catch {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6" data-testid="password-gate">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-6">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">NotaryChain</h1>
          <p className="text-slate-500 mt-2 text-sm tracking-widest uppercase">Investor Preview</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            data-testid="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter access code"
            className="w-full px-4 py-3.5 bg-cream-100 border border-white/10 rounded-xl text-navy-900 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all text-center tracking-[0.3em] text-lg"
          />
          {error && <p data-testid="password-error" className="text-red-400 text-sm text-center">{error}</p>}
          <button data-testid="password-submit" type="submit" disabled={loading || !password} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-medium rounded-xl transition-all flex items-center justify-center gap-2">
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Access Deck</span><ChevronRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════ SLIDE: HERO ═══════════════════ */

function HeroSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="text-center max-w-4xl mx-auto py-20 px-6">
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-6">Enterprise-Grade Digital Notarization + AI Escrow</p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-navy-900 text-navy-900 leading-tight mb-6">
          The Future of <span className="italic text-coral-600">Trust</span> is Here
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          NotaryChain fuses autonomous AI agent swarms, biometric identity, oracle-verified escrow, and blockchain immutability into a single platform that transforms how documents are authenticated and value is exchanged.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
          {PLATFORM_STATS.map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-2xl font-bold text-navy-900">{s.value}</div>
              <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: IP PORTFOLIO ═══════════════════ */

function IPSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Intellectual Property</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">11 Trademarkable Innovations</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">Proprietary workflow innovations that form a defensible technology moat.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {TRADEMARKS.map((t) => (
            <div key={t.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-blue-500/20 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-coral-600 shrink-0" />
                <span className="text-navy-900 font-semibold text-sm">{t.name}<sup className="text-coral-600 text-[9px] ml-0.5">TM</sup></span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-1">{t.feature}</p>
              <p className="text-slate-600 text-[11px] italic">{t.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: TRUST GAPS ═══════════════════ */

function TrustGapsSlide({ visible }) {
  const gaps = [
    { num: '1', title: 'The Execution Gap', subtitle: 'From Signature to Action', desc: 'AI Orchestrator extracts "Performance Triggers" from contracts and holds funds in a smart vault that only opens when milestones are verified. No more dead zones between signing and payment.', color: '#f59e0b', icon: Zap },
    { num: '2', title: 'The Verification Gap', subtitle: 'Reducing Subjective Disputes', desc: 'Oracle networks (shipping trackers, inspection databases, AI photo analysis) autonomously verify milestones. When data confirms completion, escrow settlement is triggered programmatically, minimizing the need for manual intermediaries.', color: '#06b6d4', icon: Network },
    { num: '3', title: 'The Security Gap', subtitle: 'Biometric Proof of Intent', desc: 'The escrow "key" is tied to GPT-5.2 Vision biometric verification. Funds release only when the recipient\'s identity is confirmed via 3D facial geometry and liveness detection at settlement.', color: '#a855f7', icon: Fingerprint },
  ];
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-coral-600 tracking-[0.25em] uppercase text-xs font-medium mb-4">Core Innovation</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">3 Trust Gaps We Solve</h2>
          <p className="text-slate-500 text-sm max-w-2xl mx-auto">Traditional escrow is slow, expensive, and reliant on human intermediaries. We augment trust with cryptographic verification and AI-driven automation.</p>
        </div>
        <div className="space-y-4">
          {gaps.map((g) => {
            const GIcon = g.icon;
            return (
              <div key={g.num} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors flex gap-6 items-start">
                <div className="w-14 h-14 rounded-2xl border border-white/[0.08] flex items-center justify-center shrink-0" style={{ background: `${g.color}10` }}>
                  <GIcon className="w-7 h-7" style={{ color: g.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ color: g.color, background: `${g.color}15`, border: `1px solid ${g.color}30` }}>GAP {g.num}</span>
                    <h3 className="text-navy-900 font-semibold text-lg">{g.title}</h3>
                  </div>
                  <p className="text-slate-600 text-xs italic mb-2">{g.subtitle}</p>
                  <p className="text-slate-500 text-sm leading-relaxed">{g.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: FEATURE CARD ═══════════════════ */

function FeatureSlide({ feature, visible, index }) {
  const Icon = feature.icon;
  const isEven = index % 2 === 0;
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className={`max-w-5xl mx-auto px-6 py-16 flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-20" style={{ background: feature.color }} />
            <div className="relative w-56 h-56 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-20 h-20" style={{ color: feature.color }} strokeWidth={1} />
            </div>
          </div>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">{feature.title}</h2>
            {feature.trademark && <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border border-gold-500/30 text-coral-600">TM</span>}
          </div>
          <p className="text-slate-500 leading-relaxed mb-6">{feature.description}</p>
          <div className="flex flex-wrap gap-3">
            {feature.stats.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5">
                <CheckCircle className="w-3 h-3" style={{ color: feature.color }} />
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: AI PIPELINE ═══════════════════ */

function AIPipelineSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Core Innovation</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">6-Phase AI Orchestration Pipeline</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">End-to-end autonomous transaction execution powered by GPT-5.2.</p>
        </div>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 via-cyan-500/50 to-emerald-500/50 hidden sm:block" />
          <div className="space-y-6">
            {AI_PIPELINE.map((p, i) => (
              <div key={p.phase} className="flex items-start gap-6 relative">
                <div className="relative z-10 w-16 h-16 rounded-2xl border border-white/[0.08] bg-cream-100 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold" style={{ color: p.color }}>{p.phase}</span>
                </div>
                <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-navy-900 font-semibold">{p.name}</h3>
                    {p.trademark && <sup className="text-coral-600 text-[9px]">TM</sup>}
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{p.desc}</p>
                </div>
                {i < AI_PIPELINE.length - 1 && (
                  <div className="absolute left-8 top-16 w-px h-6 hidden sm:block" style={{ background: `linear-gradient(${p.color}, ${AI_PIPELINE[i+1].color})` }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: FEATURE BREAKDOWN ═══════════════════ */

function FeatureBreakdownSlide({ visible }) {
  const totalFeatures = FEATURE_CATEGORIES.reduce((a, c) => a + c.count, 0);
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Platform Depth</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">{totalFeatures} Features Across {FEATURE_CATEGORIES.length} Categories</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURE_CATEGORIES.map((c) => {
            const CIcon = c.icon;
            return (
              <div key={c.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors">
                <CIcon className="w-5 h-5 mb-3" style={{ color: c.color }} />
                <div className="text-xl font-bold text-navy-900">{c.count}</div>
                <div className="text-slate-500 text-xs mt-1 leading-snug">{c.name}</div>
              </div>
            );
          })}
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 flex flex-col justify-center items-center">
            <div className="text-2xl font-bold text-blue-400">{totalFeatures}</div>
            <div className="text-blue-300 text-xs mt-1">Total Features</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: ARCHITECTURE ═══════════════════ */

function ArchitectureSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">System Design</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">Architecture Overview</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-white/[0.02] border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="text-navy-900 font-semibold text-sm">Frontend — React SPA</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Bento Dashboard', 'ANAN Monitor', 'Escrow Intelligence', 'Fraud Intelligence', 'Biometric Gate', 'Notary Portal', 'Admin Panel', 'AI Tools', 'Role-Based Onboarding'].map(m => (
                <span key={m} className="text-[11px] text-slate-500 bg-blue-500/5 border border-blue-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          <div className="flex justify-center text-slate-700 text-xs">HTTPS / WebSocket (Real-Time Events)</div>
          <div className="bg-white/[0.02] border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Server className="w-5 h-5 text-purple-400" />
              <h3 className="text-navy-900 font-semibold text-sm">API Gateway — FastAPI</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['JWT Auth + 2FA', 'RBAC Middleware', 'Rate Limiting', 'SSO (Auth0/Okta)', 'WebSocket Manager'].map(m => (
                <span key={m} className="text-[11px] text-slate-500 bg-purple-500/5 border border-purple-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          <div className="bg-white/[0.02] border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Box className="w-5 h-5 text-coral-600" />
              <h3 className="text-navy-900 font-semibold text-sm">Service Layer — 15 Core Services</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {['ANAN Swarm (GPT-5.2)', 'Escrow Oracle', 'Fraud Intelligence', 'AI Engine', 'Biometric Vision', 'Hedera HCS + Bond', 'Payment (Stripe)', 'Agent Reputation', 'Document Pipeline', 'Email (Resend)', 'Notification WS', 'Webhook Delivery', 'S3 Storage', 'HBAR Alerts', 'Scheduled Reports'].map(m => (
                <span key={m} className="text-[11px] text-center text-slate-500 bg-cyan-500/5 border border-cyan-500/10 rounded-md px-2 py-1.5">{m}</span>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-5 h-5 text-coral-600" />
                <h3 className="text-navy-900 font-semibold text-sm">Background Workers</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Doc Expiry', 'Smart Reminders', 'Report Gen', 'HBAR Monitor', 'Service Health'].map(m => (
                  <span key={m} className="text-[11px] text-slate-500 bg-coral-500/5 border border-amber-500/10 rounded-md px-2.5 py-1">{m}</span>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.02] border border-coral-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-5 h-5 text-coral-600" />
                <h3 className="text-navy-900 font-semibold text-sm">MongoDB + Hedera HCS</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Users', 'Documents', 'ANAN Ceremonies', 'Escrow Agreements', 'Fraud Patterns', 'Bond Ledger', 'Orgs', 'RBAC Roles'].map(m => (
                  <span key={m} className="text-[11px] text-slate-500 bg-coral-500/5 border border-emerald-500/10 rounded-md px-2.5 py-1">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: TECH STACK ═══════════════════ */

function TechSlide({ visible }) {
  const layers = [
    { icon: Eye, label: 'Frontend', items: ['React 18 (SPA)', 'React Router v6', 'TailwindCSS + Shadcn/UI', 'WebSocket (real-time)', 'TensorFlow.js', 'Recharts analytics'], color: '#3b82f6' },
    { icon: Zap, label: 'Backend', items: ['FastAPI (async Python)', 'Motor (async MongoDB)', 'ReportLab (PDF gen)', 'SSE streaming', 'SlowAPI (rate limiting)'], color: '#8b5cf6' },
    { icon: Layers, label: 'Integrations', items: ['GPT-5.2 (AI + Vision)', 'Stripe (payments)', 'Hedera Hashgraph', 'Auth0 + Okta (SSO)', 'AWS S3 (storage)', 'Resend (email)'], color: '#06b6d4' },
    { icon: Shield, label: 'Security', items: ['JWT + TOTP 2FA', 'Auth0/Okta SSO', 'Custom RBAC engine', 'Biometric Vision AI', 'Sentry monitoring'], color: '#10b981' },
  ];
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4 text-center">Technology</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 text-center mb-10">Production-Ready Tech Stack</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {layers.map((l) => {
            const LIcon = l.icon;
            return (
              <div key={l.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-colors">
                <LIcon className="w-7 h-7 mb-3" style={{ color: l.color }} />
                <h3 className="text-navy-900 font-semibold mb-3 text-sm">{l.label}</h3>
                <ul className="space-y-1.5">
                  {l.items.map((item) => (
                    <li key={item} className="text-slate-500 text-xs flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: l.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: INFRASTRUCTURE ═══════════════════ */

function InfraSlide({ visible }) {
  const items = [
    { icon: Box, label: 'Deployment', desc: 'Kubernetes — containerized, scalable, production-grade', color: '#3b82f6' },
    { icon: GitBranch, label: 'CI/CD', desc: 'Emergent Platform — preview environments per branch', color: '#8b5cf6' },
    { icon: Activity, label: 'Monitoring', desc: 'Sentry error tracking, HBAR balance alerts, service health monitor', color: '#ef4444' },
    { icon: Cpu, label: 'Graceful Degradation', desc: 'ML, blockchain & AI features degrade safely in resource-constrained environments', color: '#10b981' },
  ];
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Infrastructure</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">Built for Scale</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it) => {
            const IIcon = it.icon;
            return (
              <div key={it.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-colors">
                <IIcon className="w-8 h-8 mb-4" style={{ color: it.color }} />
                <h3 className="text-navy-900 font-semibold mb-2">{it.label}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{it.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: METRICS ═══════════════════ */

function MetricsSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">By The Numbers</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">Platform Metrics</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {DEEP_METRICS.map((m) => (
            <div key={m.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center hover:border-white/[0.12] transition-colors">
              <div className="text-3xl font-bold text-navy-900 mb-1">{m.value}</div>
              <div className="text-slate-500 text-xs">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: MARKET ═══════════════════ */

function MarketSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Market Opportunity</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-10">Positioned for Exponential Growth</h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <BarChart3 className="w-7 h-7 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-navy-900 mb-1">$18.6B</div>
            <p className="text-slate-500 text-xs">Global e-notarization market by 2030 (est. CAGR 19.2%)*</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Globe className="w-7 h-7 text-coral-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-navy-900 mb-1">$5.4T</div>
            <p className="text-slate-500 text-xs">Total addressable escrow market (management estimate)*</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Zap className="w-7 h-7 text-coral-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-navy-900 mb-1">90+</div>
            <p className="text-slate-500 text-xs">Enterprise features shipped and tested</p>
          </div>
        </div>
        <p className="text-slate-500 leading-relaxed max-w-2xl mx-auto text-sm">
          The regulatory landscape is rapidly evolving in favor of digital notarization and AI-verified escrow. NotaryChain is building toward one of the most feature-complete platforms in this space, with autonomous AI agent swarms, oracle-verified smart escrow, and <span className="text-navy-900 font-medium">11 trademarkable innovations</span> that create a defensible technological moat.
        </p>
        <p className="text-slate-600 text-[9px] mt-6 max-w-xl mx-auto">
          *Market estimates based on third-party research reports and management projections. Actual market sizes may vary. This presentation does not constitute an offer to sell securities. Forward-looking statements involve risks and uncertainties. Past performance of internal test suites does not guarantee commercial outcomes.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: CONTACT ═══════════════════ */

function ContactSlide({ visible }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`${API}/api/investor-deck/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setStatus('sent'); else setStatus('error');
    } catch { setStatus('error'); }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Get in Touch</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">Interested in NotaryChain?</h2>
          <p className="text-slate-500 mt-2 text-sm">Let's discuss how we can work together.</p>
        </div>
        {status === 'sent' ? (
          <div data-testid="contact-success" className="text-center py-12 bg-white/[0.02] border border-coral-200 rounded-2xl">
            <CheckCircle className="w-12 h-12 text-coral-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-navy-900 mb-2">Message Sent</h3>
            <p className="text-slate-500">Thank you for your interest. We'll be in touch shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <input data-testid="contact-name" required value={form.name} onChange={set('name')} placeholder="Your name" className="w-full px-4 py-3 bg-cream-100 border border-white/10 rounded-xl text-navy-900 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
              <input data-testid="contact-email" required type="email" value={form.email} onChange={set('email')} placeholder="Email" className="w-full px-4 py-3 bg-cream-100 border border-white/10 rounded-xl text-navy-900 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
            </div>
            <input data-testid="contact-company" required value={form.company} onChange={set('company')} placeholder="Company / Fund" className="w-full px-4 py-3 bg-cream-100 border border-white/10 rounded-xl text-navy-900 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
            <textarea data-testid="contact-message" required value={form.message} onChange={set('message')} rows={4} placeholder="Tell us about your interest..." className="w-full px-4 py-3 bg-cream-100 border border-white/10 rounded-xl text-navy-900 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm resize-none" />
            <button data-testid="contact-submit" type="submit" disabled={status === 'sending'} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-navy-900 font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              {status === 'sending' ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /><span>Send Message</span></>}
            </button>
            {status === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>}
          </form>
        )}
        <div className="mt-10 text-center">
          <p className="text-slate-700 text-[8px] leading-relaxed max-w-md mx-auto">
            CONFIDENTIAL — This presentation is for informational purposes only and does not constitute an offer to sell or solicitation of an offer to buy any securities. Forward-looking statements involve risks and uncertainties. NotaryChain is a technology platform and does not itself provide notary, legal, or financial services. All performance claims reflect internal test environments unless otherwise noted. Biometric data is processed in accordance with applicable privacy laws. Consult your own legal and financial advisors before making investment decisions.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ SLIDE: LIVE DEMO WALKTHROUGH ═══════════════════ */

const DEMO_STEPS = [
  {
    phase: 1,
    label: 'Contract Upload',
    title: 'Upload & AI Parsing',
    desc: 'A real estate purchase agreement is uploaded. The AI Orchestrator (GPT-5.2) scans the full text in under 3 seconds.',
    icon: FileText,
    color: '#3b82f6',
    animClass: 'animate-slideUp',
    detail: 'Purchase_Agreement_123_Main_St.pdf',
    detailSub: '14 pages · 8,204 words · PDF/A compliant',
  },
  {
    phase: 2,
    label: 'AI Extraction',
    title: 'Performance Triggers Extracted',
    desc: 'GPT-5.2 identifies 6 contractual milestones that must be verified before funds can move. Each is mapped to a verification method.',
    icon: Brain,
    color: '#8b5cf6',
    animClass: 'animate-slideUp',
    triggers: [
      { name: 'Home Inspection', method: 'Oracle', pct: 0 },
      { name: 'Mortgage Approval', method: 'Party', pct: 0 },
      { name: 'Title Search Clear', method: 'Oracle', pct: 0 },
      { name: 'Appraisal Meets Price', method: 'Oracle', pct: 0 },
      { name: 'Final Walk-Through', method: 'AI Photo', pct: 0 },
      { name: 'Closing: Biometric Gate', method: 'Biometric', pct: 100 },
    ],
  },
  {
    phase: 3,
    label: 'Fund Deposit',
    title: 'Smart Vault Locked',
    desc: 'Buyer deposits $350,000 via Stripe. Funds are tokenized on Hedera and held in a smart contract vault. Neither party can touch the funds.',
    icon: Lock,
    color: '#10b981',
    animClass: 'animate-scaleIn',
    vault: { amount: 350000, token: '0.0.7841923', status: 'LOCKED' },
  },
  {
    phase: 4,
    label: 'Oracle Verification',
    title: 'Autonomous Milestone Checks',
    desc: 'External oracles query real data sources — title companies, inspection databases, shipping APIs. Conditions auto-verify when data confirms completion.',
    icon: Globe,
    color: '#06b6d4',
    animClass: 'animate-slideUp',
    oracles: [
      { name: 'First American Title', result: 'Clear title — 0 liens', status: 'verified', conf: 99 },
      { name: 'National Inspection Registry', result: 'Score: 92/100 — Passed', status: 'verified', conf: 97 },
      { name: 'Metro Valuation Services', result: '$365K appraisal > $350K price', status: 'verified', conf: 94 },
    ],
  },
  {
    phase: 5,
    label: 'Biometric Gate',
    title: 'Proof of Intent',
    desc: 'At settlement, both buyer and seller verify their identity via live webcam. GPT-5.2 Vision confirms liveness and 3D facial geometry. No imposters.',
    icon: Fingerprint,
    color: '#a855f7',
    animClass: 'animate-scaleIn',
    bio: { buyer: { name: 'John Doe', conf: 98, liveness: true }, seller: { name: 'Jane Smith', conf: 97, liveness: true } },
  },
  {
    phase: 6,
    label: 'Settlement',
    title: 'Trustless Release',
    desc: 'All conditions met. Both identities confirmed. The smart vault opens autonomously — $350,000 released to the seller. Lifecycle hash sealed on Hedera mainnet forever.',
    icon: ShieldCheck,
    color: '#f59e0b',
    animClass: 'animate-scaleIn',
    settlement: { hash: 'a4f8c1e9...d73b20f1', topic: '0.0.10373605', amount: 350000, network: 'Hedera Mainnet' },
  },
];

function DemoWalkthroughSlide({ visible }) {
  const [activeStep, setActiveStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [autoDemo, setAutoDemo] = useState(false);

  useEffect(() => {
    if (!visible) { setActiveStep(0); setAutoDemo(false); return; }
  }, [visible]);

  useEffect(() => {
    if (!autoDemo || !visible) return;
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveStep(s => {
          if (s >= DEMO_STEPS.length - 1) { setAutoDemo(false); return s; }
          return s + 1;
        });
        setAnimating(false);
      }, 300);
    }, 3500);
    return () => clearInterval(timer);
  }, [autoDemo, visible]);

  const goStep = (i) => {
    if (i === activeStep) return;
    setAutoDemo(false);
    setAnimating(true);
    setTimeout(() => { setActiveStep(i); setAnimating(false); }, 200);
  };

  const step = DEMO_STEPS[activeStep];
  const StepIcon = step.icon;

  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} data-testid="demo-walkthrough-slide">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <p className="text-coral-600 tracking-[0.25em] uppercase text-xs font-medium mb-3">Interactive Demo</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-1">Escrow Lifecycle Walkthrough</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">Watch how a $350K real estate transaction flows through all 3 Trust Gaps.</p>
        </div>

        {/* Step Timeline Bar */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {DEMO_STEPS.map((s, i) => {
            const SIcon = s.icon;
            const isActive = i === activeStep;
            const isPast = i < activeStep;
            return (
              <React.Fragment key={i}>
                <button onClick={() => goStep(i)} data-testid={`demo-step-${i + 1}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-medium border ${isActive ? 'border-white/20 bg-white/[0.06] text-navy-900 scale-105' : isPast ? 'border-coral-200 bg-coral-500/5 text-coral-600' : 'border-white/[0.06] bg-white/[0.02] text-slate-600 hover:text-slate-500 hover:border-white/10'}`}>
                  <SIcon className="w-3.5 h-3.5" style={{ color: isActive ? s.color : isPast ? '#10b981' : undefined }} />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.phase}</span>
                </button>
                {i < DEMO_STEPS.length - 1 && (
                  <div className={`w-4 h-px ${isPast ? 'bg-coral-500/40' : 'bg-white/[0.08]'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Main Demo Area */}
        <div className={`transition-all duration-500 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Left: Context */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl border border-white/[0.08] flex items-center justify-center" style={{ background: `${step.color}10` }}>
                    <StepIcon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ color: step.color, background: `${step.color}15`, border: `1px solid ${step.color}30` }}>Phase {step.phase}</span>
                    <h3 className="text-navy-900 font-bold text-lg mt-1">{step.title}</h3>
                  </div>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
              {/* Progress */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-[10px] uppercase tracking-wider">Trust Score</span>
                  <span className="text-navy-900 font-bold text-sm">{Math.round(((activeStep + 1) / DEMO_STEPS.length) * 100)}%</span>
                </div>
                <div className="w-32 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((activeStep + 1) / DEMO_STEPS.length) * 100}%`, background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)` }} />
                </div>
                <button onClick={() => { setAutoDemo(d => !d); if (!autoDemo) setActiveStep(0); }} className="text-[10px] px-2.5 py-1 rounded-md border border-white/[0.08] text-slate-500 hover:text-navy-900 transition-colors" data-testid="demo-autoplay">
                  {autoDemo ? 'Stop' : 'Auto-Play'}
                </button>
              </div>
            </div>

            {/* Right: Visualization */}
            <div className="lg:col-span-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 min-h-[300px] flex flex-col justify-center">
              {activeStep === 0 && <DemoUpload step={step} />}
              {activeStep === 1 && <DemoTriggers step={step} />}
              {activeStep === 2 && <DemoVault step={step} />}
              {activeStep === 3 && <DemoOracles step={step} />}
              {activeStep === 4 && <DemoBiometric step={step} />}
              {activeStep === 5 && <DemoSettlement step={step} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Demo Sub-Visualizations ─── */

function DemoUpload({ step }) {
  return (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center gap-4 bg-blue-500/5 border border-blue-500/15 rounded-xl px-6 py-4 animate-[fadeSlideUp_0.6s_ease-out]">
        <div className="w-14 h-16 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><FileText className="w-7 h-7 text-blue-400" /></div>
        <div className="text-left">
          <p className="text-navy-900 font-semibold text-sm">{step.detail}</p>
          <p className="text-slate-500 text-xs">{step.detailSub}</p>
        </div>
        <CheckCircle className="w-5 h-5 text-coral-600 animate-[fadeIn_1s_ease-out_0.4s_both]" />
      </div>
      <div className="flex items-center justify-center gap-2 animate-[fadeIn_0.8s_ease-out_0.6s_both]">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-blue-400 text-xs font-medium">GPT-5.2 parsing document...</span>
        <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto animate-[fadeIn_0.8s_ease-out_1s_both]">
        {['Clauses Found: 42', 'Parties: 2', 'Conditions: 6'].map(t => (
          <div key={t} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-center">
            <span className="text-slate-500 text-[10px]">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoTriggers({ step }) {
  return (
    <div className="space-y-2">
      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Brain className="w-3 h-3 text-purple-400" /> AI-Extracted Performance Triggers
      </p>
      {step.triggers.map((t, i) => (
        <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-2.5 opacity-0 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
          <span className="text-navy-900 text-sm flex-1">{t.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.method === 'Oracle' ? 'text-coral-600 border-cyan-500/20 bg-cyan-500/10' : t.method === 'Biometric' ? 'text-purple-400 border-purple-500/20 bg-purple-500/10' : t.method === 'AI Photo' ? 'text-coral-600 border-amber-500/20 bg-coral-500/10' : 'text-slate-500 border-slate-200 bg-gray-800'}`}>{t.method}</span>
          {t.pct > 0 && <span className="text-coral-600 text-[10px] font-bold">{t.pct}%</span>}
        </div>
      ))}
    </div>
  );
}

function DemoVault({ step }) {
  return (
    <div className="text-center space-y-5">
      <div className="inline-block relative">
        <div className="w-32 h-32 rounded-2xl bg-coral-500/5 border-2 border-coral-200 flex flex-col items-center justify-center mx-auto animate-[pulse_2s_ease-in-out_infinite]">
          <Lock className="w-10 h-10 text-coral-600 mb-1" />
          <span className="text-coral-600 text-lg font-bold">${(step.vault.amount / 1000).toFixed(0)}K</span>
          <span className="text-coral-600/60 text-[9px] uppercase tracking-wider">{step.vault.status}</span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-coral-500 animate-ping" />
      </div>
      <div className="flex items-center justify-center gap-6 animate-[fadeIn_0.6s_ease-out_0.5s_both]">
        <div className="text-center"><p className="text-[10px] text-slate-600">Stripe PI</p><p className="text-navy-900 font-mono text-xs">pi_escrow_8f2a...</p></div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div className="text-center"><p className="text-[10px] text-slate-600">HTS Token</p><p className="text-navy-900 font-mono text-xs">{step.vault.token}</p></div>
      </div>
      <p className="text-slate-500 text-xs max-w-sm mx-auto animate-[fadeIn_0.6s_ease-out_0.8s_both]">Funds are tokenized on Hedera and cryptographically locked. Neither party can access until all conditions are met.</p>
    </div>
  );
}

function DemoOracles({ step }) {
  return (
    <div className="space-y-3">
      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2">
        <Globe className="w-3 h-3 text-coral-600 animate-spin" style={{ animationDuration: '4s' }} /> Querying External Oracles...
      </p>
      {step.oracles.map((o, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 opacity-0 animate-[fadeSlideUp_0.5s_ease-out_both]" style={{ animationDelay: `${i * 400}ms` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-navy-900 font-medium text-sm">{o.name}</span>
            <span className="flex items-center gap-1 text-coral-600 text-[10px] font-bold"><CheckCircle className="w-3 h-3" /> VERIFIED</span>
          </div>
          <p className="text-slate-500 text-xs">{o.result}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-coral-500 rounded-full animate-[growWidth_1s_ease-out_both]" style={{ animationDelay: `${i * 400 + 300}ms`, width: `${o.conf}%` }} />
            </div>
            <span className="text-coral-600 text-[10px] font-mono">{o.conf}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoBiometric({ step }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(step.bio).map(([role, data]) => (
          <div key={role} className="bg-white/[0.02] border border-purple-500/15 rounded-xl p-5 text-center animate-[fadeSlideUp_0.5s_ease-out_both]" style={{ animationDelay: role === 'buyer' ? '0ms' : '300ms' }}>
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border-2 border-purple-500/30 mx-auto mb-3 flex items-center justify-center relative">
              <Fingerprint className="w-8 h-8 text-purple-400" />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-coral-500 flex items-center justify-center"><CheckCircle className="w-3 h-3 text-navy-900" /></div>
            </div>
            <p className="text-navy-900 font-semibold text-sm mb-0.5">{data.name}</p>
            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-2">{role}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-coral-600 text-[10px] flex items-center gap-1"><Eye className="w-3 h-3" /> Liveness</span>
              <span className="text-purple-400 text-[10px] font-bold">{data.conf}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center animate-[fadeIn_0.6s_ease-out_0.8s_both]">
        <div className="inline-flex items-center gap-2 bg-coral-500/10 border border-coral-200 rounded-full px-4 py-2">
          <Shield className="w-4 h-4 text-coral-600" />
          <span className="text-coral-600 text-xs font-bold">BIOMETRIC GATE: BOTH PARTIES VERIFIED</span>
        </div>
      </div>
    </div>
  );
}

function DemoSettlement({ step }) {
  return (
    <div className="text-center space-y-5">
      <div className="inline-block relative">
        <div className="w-32 h-32 rounded-2xl bg-coral-500/5 border-2 border-gold-500/30 flex flex-col items-center justify-center mx-auto animate-[pulse_2s_ease-in-out_infinite]">
          <ShieldCheck className="w-10 h-10 text-coral-600 mb-1" />
          <span className="text-coral-600 text-lg font-bold">${(step.settlement.amount / 1000).toFixed(0)}K</span>
          <span className="text-coral-600/60 text-[9px] uppercase tracking-wider">RELEASED</span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-coral-500 animate-ping" />
      </div>
      <div className="space-y-1.5 max-w-sm mx-auto animate-[fadeIn_0.6s_ease-out_0.5s_both]">
        <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Settlement Hash</span><span className="text-navy-900 font-mono">{step.settlement.hash}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-slate-500">HCS Topic</span><span className="text-navy-900 font-mono">{step.settlement.topic}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Network</span><span className="text-coral-600 font-bold">{step.settlement.network}</span></div>
      </div>
      <div className="animate-[fadeIn_0.6s_ease-out_1s_both]">
        <div className="inline-flex items-center gap-2 bg-coral-500/10 border border-amber-500/20 rounded-full px-5 py-2">
          <Blocks className="w-4 h-4 text-coral-600" />
          <span className="text-coral-600 text-xs font-bold tracking-wider">SEALED ON HEDERA MAINNET FOREVER</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ SLIDE: TRANSACTION ORCHESTRATOR DEEP DIVE ═══════════════════ */

const ORCHESTRATOR_BLUEPRINTS = [
  {
    id: 'bp_real_estate_closing',
    name: 'Real Estate Closing',
    color: '#0ea5e9',
    estDays: 45,
    roles: ['buyer', 'seller', 'agent', 'lender', 'title_company', 'notary'],
    steps: [
      { id: 's1', name: 'Purchase Agreement', owner: 'buyer + seller', deps: [], crit: true },
      { id: 's2', name: 'Title Search', owner: 'title_company', deps: ['s1'] },
      { id: 's3', name: 'Loan Application', owner: 'buyer + lender', deps: ['s1'] },
      { id: 's4', name: 'Inspection', owner: 'buyer', deps: ['s1'] },
      { id: 's5', name: 'Appraisal', owner: 'lender', deps: ['s3'] },
      { id: 's6', name: 'Final Loan Approval', owner: 'lender', deps: ['s3', 's5'], crit: true },
      { id: 's7', name: 'Closing Disclosure', owner: 'all parties', deps: ['s2', 's6'] },
      { id: 's8', name: 'Final Walkthrough', owner: 'buyer', deps: ['s7'] },
      { id: 's9', name: 'Closing Meeting', owner: 'buyer + seller + notary', deps: ['s7', 's8'], crit: true },
      { id: 's10', name: 'Funds Transfer & Recording', owner: 'title + lender', deps: ['s9'], crit: true },
    ],
    risk: 34,
    risks: [
      { factor: 'Appraisal falls below purchase price', prob: 'medium', mitigation: 'AI re-scores transaction, triggers renegotiation flow' },
      { factor: 'Title lien discovered', prob: 'low', mitigation: 'Oracle verification at Title Search step halts progression' },
      { factor: 'Mortgage approval delays', prob: 'medium', mitigation: 'AI flags overdue dependency and alerts lender' },
    ],
    nba: 'Lender approval pending 3 days — escalate to relationship manager',
  },
  {
    id: 'bp_business_contract',
    name: 'Business Contract',
    color: '#8b5cf6',
    estDays: 14,
    roles: ['owner', 'signer', 'attorney', 'reviewer', 'notary'],
    steps: [
      { id: 's1', name: 'Draft Contract Upload', owner: 'owner', deps: [], crit: true },
      { id: 's2', name: 'Legal Review', owner: 'attorney', deps: ['s1'] },
      { id: 's3', name: 'Revisions & Negotiation', owner: 'owner + attorney', deps: ['s2'] },
      { id: 's4', name: 'Compliance Check', owner: 'reviewer', deps: ['s3'] },
      { id: 's5', name: 'Signer Review', owner: 'signer', deps: ['s3'] },
      { id: 's6', name: 'Execution & Notarization', owner: 'all + notary', deps: ['s4', 's5'], crit: true },
      { id: 's7', name: 'Hedera Seal', owner: 'system', deps: ['s6'], crit: true },
    ],
    risk: 22,
    risks: [
      { factor: 'Counter-party redlines beyond scope', prob: 'medium', mitigation: 'AI document remediation suggests standard language' },
      { factor: 'Regulatory filing deadline missed', prob: 'low', mitigation: 'AI overdue detection + auto-escalation' },
    ],
    nba: 'Attorney review overdue — send reminder + escalate within 24h',
  },
  {
    id: 'bp_estate_settlement',
    name: 'Estate Settlement',
    color: '#f59e0b',
    estDays: 90,
    roles: ['executor', 'beneficiaries', 'attorney', 'court', 'notary'],
    steps: [
      { id: 's1', name: 'Will / Testament Filed', owner: 'executor + court', deps: [], crit: true },
      { id: 's2', name: 'Asset Inventory', owner: 'executor', deps: ['s1'] },
      { id: 's3', name: 'Beneficiary Notifications', owner: 'attorney', deps: ['s1'] },
      { id: 's4', name: 'Debt & Tax Settlement', owner: 'executor + attorney', deps: ['s2'] },
      { id: 's5', name: 'Asset Distribution Plan', owner: 'attorney', deps: ['s2', 's3'] },
      { id: 's6', name: 'Court Approval', owner: 'court', deps: ['s4', 's5'], crit: true },
      { id: 's7', name: 'Final Distribution', owner: 'executor + beneficiaries', deps: ['s6'], crit: true },
    ],
    risk: 58,
    risks: [
      { factor: 'Beneficiary contest', prob: 'high', mitigation: 'AI detects dispute signals, escalates to mediation' },
      { factor: 'Hidden debts discovered', prob: 'medium', mitigation: 'Oracle credit-bureau check during Inventory phase' },
      { factor: 'Tax filing deadline lapse', prob: 'medium', mitigation: 'AI deadline tracker triggers 14-day early warning' },
    ],
    nba: 'High-risk transaction — schedule mediation call with beneficiaries this week',
  },
];

const ORCHESTRATOR_CAPABILITIES = [
  { icon: GitBranch, label: 'Blueprint Engine', desc: '3 system blueprints + custom', color: '#0ea5e9' },
  { icon: Users, label: 'Multi-Party Roles', desc: '6+ participant roles per deal', color: '#8b5cf6' },
  { icon: Brain, label: 'AI Risk Engine', desc: 'Live 0-100 risk scoring', color: '#ef4444' },
  { icon: Activity, label: 'Dependency Graph', desc: 'Task chains & critical path', color: '#10b981' },
  { icon: Blocks, label: 'On-Chain Audit', desc: 'Dedicated Hedera HCS topic', color: '#f59e0b' },
  { icon: Send, label: 'In-App Messaging', desc: 'Context-aware chat per txn', color: '#ec4899' },
];

function RiskMeter({ score, color }) {
  // 0-30 green, 31-60 amber, 61-100 red
  const ringColor = score >= 61 ? '#ef4444' : score >= 31 ? '#f59e0b' : '#10b981';
  const label = score >= 61 ? 'HIGH RISK' : score >= 31 ? 'MODERATE' : 'LOW RISK';
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative inline-block">
      <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
        <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="55" cy="55" r="42" fill="none" stroke={ringColor} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 800ms ease-out, stroke 400ms ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: ringColor }}>{score}</span>
        <span className="text-[8px] tracking-[0.15em] font-bold" style={{ color: ringColor }}>{label}</span>
      </div>
    </div>
  );
}

function TaskGraph({ steps, color }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-md px-2.5 py-1.5 opacity-0 animate-[fadeSlideUp_0.35s_ease-out_both] hover:border-white/[0.15] transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{ background: `${color}15`, color, border: `1px solid ${color}33` }}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-navy-900 text-[11px] font-medium truncate">{s.name}</span>
              {s.crit && <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-bold">CRIT</span>}
            </div>
            <p className="text-slate-600 text-[9px] truncate">{s.owner}</p>
          </div>
          {s.deps.length > 0 && (
            <span className="text-[8px] text-slate-600 font-mono flex-shrink-0">↖ {s.deps.join(',')}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function TransactionOrchestratorDeepDiveSlide({ visible }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = ORCHESTRATOR_BLUEPRINTS[activeIdx];

  useEffect(() => {
    if (!visible) setActiveIdx(0);
  }, [visible]);

  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} data-testid="orchestrator-deep-dive-slide">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="text-center mb-5">
          <p className="text-coral-600 tracking-[0.25em] uppercase text-xs font-medium mb-2.5">Deep Dive · Trademarkable IP</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-1">Transaction Orchestrator</h2>
          <p className="text-slate-500 text-sm max-w-2xl mx-auto">Full lifecycle engine for complex multi-party transactions — blueprint-driven, AI risk-scored, Hedera-sealed.</p>
        </div>

        {/* Top capability strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
          {ORCHESTRATOR_CAPABILITIES.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 text-center opacity-0 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }} data-testid={`orchestrator-cap-${i}`}>
                <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: c.color }} />
                <p className="text-navy-900 text-[10px] font-semibold leading-tight">{c.label}</p>
                <p className="text-slate-600 text-[8.5px] mt-0.5 leading-tight">{c.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Blueprint selector */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {ORCHESTRATOR_BLUEPRINTS.map((bp, i) => (
            <button key={bp.id}
              onClick={() => setActiveIdx(i)}
              data-testid={`orchestrator-blueprint-${bp.id}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${activeIdx === i ? 'text-navy-900' : 'text-slate-500 hover:text-slate-500'}`}
              style={{
                background: activeIdx === i ? `${bp.color}20` : 'rgba(255,255,255,0.02)',
                borderColor: activeIdx === i ? `${bp.color}66` : 'rgba(255,255,255,0.06)',
              }}>
              {bp.name}
            </button>
          ))}
        </div>

        {/* Deep dive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* LEFT: Task Graph */}
          <div className="lg:col-span-5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3" key={`graph-${activeIdx}`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" style={{ color: active.color }} /> Dependency Graph
              </p>
              <span className="text-[9px] text-slate-500">{active.steps.length} steps · ~{active.estDays}d</span>
            </div>
            <TaskGraph steps={active.steps} color={active.color} />
          </div>

          {/* MIDDLE: Risk Engine + Roles */}
          <div className="lg:col-span-4 space-y-3">
            {/* AI Risk */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center" key={`risk-${activeIdx}`}>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                <Brain className="w-3 h-3 text-red-400" /> AI Risk Engine
              </p>
              <RiskMeter score={active.risk} color={active.color} />
              <div className="mt-2 space-y-1">
                {active.risks.slice(0, 3).map((r, i) => (
                  <div key={i} className="text-left bg-white/[0.02] border border-white/[0.04] rounded px-2 py-1 opacity-0 animate-[fadeSlideUp_0.3s_ease-out_both]" style={{ animationDelay: `${200 + i * 80}ms` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-navy-900 text-[10px] font-medium truncate pr-1">{r.factor}</span>
                      <span className={`text-[8px] font-bold uppercase px-1 rounded flex-shrink-0 ${r.prob === 'high' ? 'text-red-400 bg-red-500/10' : r.prob === 'medium' ? 'text-coral-600 bg-coral-500/10' : 'text-coral-600 bg-coral-500/10'}`}>{r.prob}</span>
                    </div>
                    <p className="text-slate-600 text-[8.5px] mt-0.5 leading-tight">{r.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Participant Roles */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" style={{ color: active.color }} /> Participant Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {active.roles.map((r, i) => (
                  <span key={r} className="text-[10px] px-2 py-0.5 rounded-full border text-navy-900 opacity-0 animate-[fadeIn_0.3s_ease-out_both]"
                    style={{ animationDelay: `${i * 40}ms`, background: `${active.color}12`, borderColor: `${active.color}33` }}>
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Next-Best-Action + On-Chain Audit */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white/[0.02] border border-sky-500/20 rounded-xl p-3" key={`nba-${activeIdx}`}>
              <p className="text-coral-600 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Next-Best Action
              </p>
              <p className="text-navy-900 text-[11px] leading-snug">{active.nba}</p>
              <button className="mt-2 w-full text-[9px] font-bold text-coral-600 bg-sky-500/10 border border-sky-500/20 rounded px-2 py-1 hover:bg-sky-500/20 transition-colors">
                EXECUTE →
              </button>
            </div>

            <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-3">
              <p className="text-coral-600 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Blocks className="w-3 h-3" /> Hedera HCS Audit
              </p>
              <div className="space-y-1 font-mono text-[9px] text-slate-500">
                <div className="flex justify-between"><span className="text-slate-600">Topic</span><span className="text-coral-600">0.0.10373605</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Network</span><span className="text-navy-900">mainnet</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Events</span><span className="text-navy-900">{active.steps.length + 3}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Sealed</span><span className="text-coral-600">✓ immutable</span></div>
              </div>
              <div className="mt-2 text-center">
                <div className="inline-flex items-center gap-1 text-[8px] text-coral-600 uppercase tracking-wider font-bold">
                  <CheckCircle className="w-2.5 h-2.5" /> On-chain provenance
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">TAM Unlock</p>
              <p className="text-lg font-bold text-navy-900 mt-0.5">$58B</p>
              <p className="text-[8.5px] text-slate-500 leading-tight">Multi-party transaction mgmt market</p>
            </div>
          </div>
        </div>

        {/* Bottom insight */}
        <div className="mt-4 text-center">
          <p className="text-slate-500 text-[11px]">
            Transforms NotaryChain from a notary tool into a <span className="text-coral-600 font-semibold">full transaction management platform</span> — pulling in escrow, signing, messaging, AI risk, and on-chain audit under one engine.
          </p>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════ SLIDE: COMPETITIVE COMPARISON ═══════════════════ */

const COMPETITORS = [
  { name: 'Traditional Notary', type: 'legacy', color: '#64748b' },
  { name: 'DocuSign', type: 'incumbent', color: '#4f46e5' },
  { name: 'Notarize', type: 'incumbent', color: '#0ea5e9' },
  { name: 'NotaryChain', type: 'us', color: '#f59e0b' },
];

const COMPARISON_FEATURES = [
  { category: 'AI & Automation', features: [
    { name: 'AI Document Analysis', trad: false, docu: 'basic', nota: 'basic', nc: true },
    { name: 'AI Condition Extraction', trad: false, docu: false, nota: false, nc: true },
    { name: 'Autonomous Agent Swarm', trad: false, docu: false, nota: false, nc: true },
    { name: 'Self-Tuning AI Reputation', trad: false, docu: false, nota: false, nc: true },
    { name: 'Auto-Learning Threat Detection', trad: false, docu: false, nota: false, nc: true },
  ]},
  { category: 'Escrow & Finance', features: [
    { name: 'Smart Escrow Vault', trad: false, docu: false, nota: false, nc: true },
    { name: 'Oracle Verification', trad: false, docu: false, nota: false, nc: true },
    { name: 'Milestone Payments', trad: 'manual', docu: false, nota: false, nc: true },
    { name: 'Biometric Settlement Gate', trad: false, docu: false, nota: false, nc: true },
    { name: 'HTS Tokenized Escrow', trad: false, docu: false, nota: false, nc: true },
    { name: 'Freelancer Templates', trad: false, docu: false, nota: false, nc: true },
  ]},
  { category: 'Security & Identity', features: [
    { name: 'Biometric Verification', trad: false, docu: false, nota: 'basic', nc: true },
    { name: 'Blockchain Immutability', trad: false, docu: false, nota: false, nc: true },
    { name: 'On-Chain Audit Trail', trad: false, docu: false, nota: false, nc: true },
    { name: 'Dynamic Fraud Intelligence', trad: false, docu: false, nota: false, nc: true },
  ]},
  { category: 'Enterprise & Platform', features: [
    { name: 'SSO (Auth0 + Okta)', trad: false, docu: true, nota: 'basic', nc: true },
    { name: 'Granular RBAC (23 perms)', trad: false, docu: 'basic', nota: false, nc: true },
    { name: 'Transaction Orchestrator', trad: false, docu: false, nota: false, nc: true },
    { name: 'Real-Time WebSocket', trad: false, docu: false, nota: false, nc: true },
    { name: 'Public API + Webhooks', trad: false, docu: true, nota: 'basic', nc: true },
    { name: '3-Tier Subscription Paywall', trad: false, docu: true, nota: true, nc: true },
  ]},
];

function CellBadge({ val }) {
  if (val === true) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral-500/20"><CheckCircle className="w-3.5 h-3.5 text-coral-600" /></span>;
  if (val === false) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.04]"><span className="w-2 h-px bg-gray-700 block" /></span>;
  return <span className="text-[9px] text-coral-600 bg-coral-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 uppercase font-bold">{val}</span>;
}

function CompetitiveSlide({ visible }) {
  const totalNc = COMPARISON_FEATURES.reduce((a, c) => a + c.features.filter(f => f.nc === true).length, 0);
  const totalDocu = COMPARISON_FEATURES.reduce((a, c) => a + c.features.filter(f => f.docu === true).length, 0);
  const totalNota = COMPARISON_FEATURES.reduce((a, c) => a + c.features.filter(f => f.nota === true).length, 0);
  const totalTrad = COMPARISON_FEATURES.reduce((a, c) => a + c.features.filter(f => f.trad === true).length, 0);

  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} data-testid="competitive-comparison-slide">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <p className="text-red-400 tracking-[0.25em] uppercase text-xs font-medium mb-3">Competitive Landscape</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-1">NotaryChain vs The Market</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">22 critical capabilities across AI, escrow, security, and enterprise. Only one platform has them all.</p>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {COMPETITORS.map((c) => {
            const score = c.name === 'NotaryChain' ? totalNc : c.name === 'DocuSign' ? totalDocu : c.name === 'Notarize' ? totalNota : totalTrad;
            const total = 22;
            const pct = Math.round((score / total) * 100);
            const isUs = c.type === 'us';
            return (
              <div key={c.name} className={`rounded-xl p-4 text-center border ${isUs ? 'bg-coral-500/5 border-amber-500/25' : 'bg-white/[0.02] border-white/[0.06]'}`} data-testid={`competitor-${c.name.toLowerCase().replace(/\s/g, '-')}`}>
                <p className={`text-xs font-semibold mb-1 ${isUs ? 'text-coral-600' : 'text-slate-500'}`}>{c.name}</p>
                <p className={`text-2xl font-bold ${isUs ? 'text-coral-600' : 'text-navy-900'}`}>{score}<span className="text-slate-600 text-sm font-normal">/{total}</span></p>
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Matrix */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr,1fr,80px,80px,80px,80px] gap-0 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="px-4 py-2.5"><span className="text-slate-600 text-[10px] uppercase tracking-wider">Category</span></div>
            <div className="px-4 py-2.5"><span className="text-slate-600 text-[10px] uppercase tracking-wider">Capability</span></div>
            {COMPETITORS.map(c => (
              <div key={c.name} className="px-2 py-2.5 text-center">
                <span className={`text-[10px] font-bold ${c.type === 'us' ? 'text-coral-600' : 'text-slate-500'}`}>
                  {c.name === 'Traditional Notary' ? 'Trad.' : c.name === 'NotaryChain' ? 'NC' : c.name}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {COMPARISON_FEATURES.map((cat, ci) => (
            <React.Fragment key={cat.category}>
              {cat.features.map((f, fi) => (
                <div key={f.name} className={`grid grid-cols-[1fr,1fr,80px,80px,80px,80px] gap-0 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${fi === 0 ? 'border-t border-white/[0.06]' : ''}`}>
                  {fi === 0 ? (
                    <div className="px-4 py-2 flex items-center" style={{ gridRow: `span ${cat.features.length}` }}>
                      <span className="text-slate-500 text-xs font-medium">{cat.category}</span>
                    </div>
                  ) : <div />}
                  <div className="px-4 py-2 flex items-center"><span className="text-slate-500 text-xs">{f.name}</span></div>
                  <div className="px-2 py-2 flex items-center justify-center"><CellBadge val={f.trad} /></div>
                  <div className="px-2 py-2 flex items-center justify-center"><CellBadge val={f.docu} /></div>
                  <div className="px-2 py-2 flex items-center justify-center"><CellBadge val={f.nota} /></div>
                  <div className="px-2 py-2 flex items-center justify-center"><CellBadge val={f.nc} /></div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        {/* Bottom Insight */}
        <div className="mt-4 text-center">
          <p className="text-slate-500 text-xs">
            NotaryChain delivers <span className="text-coral-600 font-bold">{totalNc}x the capability</span> of traditional notary services and <span className="text-coral-600 font-bold">{Math.round(totalNc / Math.max(totalDocu, 1))}x more features</span> than the closest digital competitor.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ PROGRESS BAR ═══════════════════ */

function ProgressBar({ current, total }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-white/[0.05]">
      <div className="h-full bg-blue-500 transition-all duration-700 ease-out" style={{ width: `${((current + 1) / total) * 100}%` }} />
    </div>
  );
}

/* ═══════════════════ NAV DOTS ═══════════════════ */

const SLIDE_LABELS = [
  'Intro', 'IP Portfolio', 'Trust Gaps',
  'ANAN Network', 'Dynamic Escrow', 'AI Orchestrator', 'Biometric Passport',
  'Blockchain + Bond', 'RBAC + SSO', 'HTS Escrow', 'Auto-Learning Threat',
  'Subscription Paywall', 'Transaction Orchestrator', 'Living Identity',
  'AI Pipeline', 'Live Demo', 'Orchestrator Deep Dive',
  'Features', 'Architecture', 'Tech Stack', 'Infra', 'Metrics',
  'Competitive', 'Market', 'Contact'
];

function NavDots({ current, total, onGo }) {
  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-end gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)} className="group flex items-center gap-2" aria-label={SLIDE_LABELS[i]}>
          <span className={`text-[9px] tracking-wider uppercase transition-opacity whitespace-nowrap ${current === i ? 'opacity-100 text-navy-900' : 'opacity-0 group-hover:opacity-70 text-slate-500'}`}>
            {SLIDE_LABELS[i]}
          </span>
          <span className={`block rounded-full transition-all ${current === i ? 'w-2.5 h-2.5 bg-blue-500' : 'w-1.5 h-1.5 bg-white/20 group-hover:bg-white/40'}`} />
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════ MAIN DECK ═══════════════════ */

function DeckPresentation() {
  // Dynamic slide count: 3 intros + N feature slides + 10 content slides = totalSlides
  // Intros: Hero, IP, TrustGaps (3)
  // Features: FEATURES.length (dynamic)
  // Content: AIPipeline, Demo, OrchestratorDeepDive, FeatureBreakdown, Architecture, Tech, Infra, Metrics, Competitive, Market, Contact (11)
  const FEATURE_COUNT = FEATURES.length;
  const INTRO_COUNT = 3;
  const CONTENT_AFTER = 11;
  const totalSlides = INTRO_COUNT + FEATURE_COUNT + CONTENT_AFTER;
  const FEATURE_START = INTRO_COUNT;                   // 3
  const AI_PIPELINE_IDX = FEATURE_START + FEATURE_COUNT;        // 3 + 10 = 13
  const DEMO_IDX = AI_PIPELINE_IDX + 1;                          // 14
  const ORCHESTRATOR_DEEP_DIVE_IDX = DEMO_IDX + 1;               // 15
  const FEATURE_BREAKDOWN_IDX = ORCHESTRATOR_DEEP_DIVE_IDX + 1;  // 16
  const ARCHITECTURE_IDX = FEATURE_BREAKDOWN_IDX + 1;            // 17
  const TECH_IDX = ARCHITECTURE_IDX + 1;                         // 18
  const INFRA_IDX = TECH_IDX + 1;                                // 19
  const METRICS_IDX = INFRA_IDX + 1;                             // 20
  const COMPETITIVE_IDX = METRICS_IDX + 1;                       // 21
  const MARKET_IDX = COMPETITIVE_IDX + 1;                        // 22
  const CONTACT_IDX = MARKET_IDX + 1;                            // 23
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef(null);
  const slideRef = useRef(null);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => setCurrent((c) => (c < totalSlides - 1 ? c + 1 : c)), 6000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setAutoPlay(false); setCurrent((c) => Math.min(c + 1, totalSlides - 1)); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setAutoPlay(false); setCurrent((c) => Math.max(c - 1, 0)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    let throttle = false;
    const handler = (e) => {
      if (throttle) return;
      throttle = true;
      setTimeout(() => { throttle = false; }, 800);
      setAutoPlay(false);
      if (e.deltaY > 0) setCurrent((c) => Math.min(c + 1, totalSlides - 1));
      else setCurrent((c) => Math.max(c - 1, 0));
    };
    const el = containerRef.current;
    el?.addEventListener('wheel', handler, { passive: false });
    return () => el?.removeEventListener('wheel', handler);
  }, []);

  const goTo = (i) => { setAutoPlay(false); setCurrent(i); };

  const exportToPDF = async () => {
    setExporting(true);
    setAutoPlay(false);
    const savedSlide = current;

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] });
    const slideContainer = slideRef.current;

    for (let i = 0; i < totalSlides; i++) {
      setCurrent(i);
      // Wait for slide transition + render
      await new Promise(r => setTimeout(r, 600));

      try {
        const canvas = await html2canvas(slideContainer, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#080c14',
          width: slideContainer.offsetWidth,
          height: slideContainer.offsetHeight,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage([1920, 1080], 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
      } catch (err) {
        console.error(`Failed to capture slide ${i + 1}:`, err);
      }
    }

    pdf.save('NotaryChain_Investor_Deck.pdf');
    setCurrent(savedSlide);
    setExporting(false);
  };

  const slideMap = [
    <HeroSlide key="hero" visible={current === 0} />,
    <IPSlide key="ip" visible={current === 1} />,
    <TrustGapsSlide key="trust" visible={current === 2} />,
    ...FEATURES.map((f, i) => <FeatureSlide key={f.title} feature={f} visible={current === i + FEATURE_START} index={i} />),
    <AIPipelineSlide key="aipipeline" visible={current === AI_PIPELINE_IDX} />,
    <DemoWalkthroughSlide key="demo" visible={current === DEMO_IDX} />,
    <TransactionOrchestratorDeepDiveSlide key="orch-deepdive" visible={current === ORCHESTRATOR_DEEP_DIVE_IDX} />,
    <FeatureBreakdownSlide key="breakdown" visible={current === FEATURE_BREAKDOWN_IDX} />,
    <ArchitectureSlide key="arch" visible={current === ARCHITECTURE_IDX} />,
    <TechSlide key="tech" visible={current === TECH_IDX} />,
    <InfraSlide key="infra" visible={current === INFRA_IDX} />,
    <MetricsSlide key="metrics" visible={current === METRICS_IDX} />,
    <CompetitiveSlide key="competitive" visible={current === COMPETITIVE_IDX} />,
    <MarketSlide key="market" visible={current === MARKET_IDX} />,
    <ContactSlide key="contact" visible={current === CONTACT_IDX} />,
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-cream-100 overflow-hidden" data-testid="investor-deck">
      <ProgressBar current={current} total={totalSlides} />
      <NavDots current={current} total={totalSlides} onGo={goTo} />

      <button data-testid="autoplay-toggle" onClick={() => setAutoPlay((p) => !p)} className="fixed bottom-6 right-6 z-50 text-xs text-slate-500 hover:text-slate-500 transition-colors bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-sm">
        {autoPlay ? 'Pause' : 'Play'}
      </button>

      <button data-testid="download-pdf-btn" onClick={exportToPDF} disabled={exporting}
        className="fixed top-6 right-6 z-50 flex items-center gap-2 text-xs text-slate-500 hover:text-navy-900 transition-colors bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-sm disabled:opacity-50">
        {exporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download PDF</>}
      </button>

      <div className="fixed bottom-6 left-6 z-50 text-xs text-slate-600 font-mono">
        {String(current + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <button onClick={() => { setAutoPlay(false); setCurrent((c) => Math.max(c - 1, 0)); }} disabled={current === 0} className="text-slate-500 hover:text-navy-900 disabled:opacity-20 transition-all rotate-180">
          <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={() => { setAutoPlay(false); setCurrent((c) => Math.min(c + 1, totalSlides - 1)); }} disabled={current === totalSlides - 1} className="text-slate-500 hover:text-navy-900 disabled:opacity-20 transition-all">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div ref={slideRef} className="min-h-screen flex items-center justify-center">
        {slideMap[current]}
      </div>
    </div>
  );
}

/* ═══════════════════ PAGE WRAPPER ═══════════════════ */

export default function InvestorDeck() {
  const [verified, setVerified] = useState(false);
  return verified ? <DeckPresentation /> : <PasswordGate onVerified={() => setVerified(true)} />;
}
