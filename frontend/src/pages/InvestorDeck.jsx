import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Brain, Fingerprint, Link2, Users, FileCheck, ChevronRight, Send, CheckCircle, Layers, Eye, Globe, Zap, BarChart3, ArrowRight, Award, Server, Database, Cpu, GitBranch, Activity, Box, Radio, CreditCard, Calendar, FileText, Settings, UserCheck, Video, Bell, Scale, Network, Blocks, Vote, Wifi, ShieldCheck } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════ DATA ═══════════════════ */

const PLATFORM_STATS = [
  { label: 'Features Shipped', value: '90+' },
  { label: 'API Endpoints', value: '250+' },
  { label: 'Integrations', value: '9' },
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
  { name: 'AI & Intelligence', count: 12, icon: Brain, color: '#8b5cf6' },
  { name: 'Security & Identity', count: 10, icon: Shield, color: '#ef4444' },
  { name: 'Blockchain & Verification', count: 7, icon: Link2, color: '#06b6d4' },
  { name: 'Escrow Intelligence', count: 8, icon: Scale, color: '#f59e0b' },
  { name: 'ANAN Agent Network', count: 6, icon: Vote, color: '#a855f7' },
  { name: 'Payments & Subscriptions', count: 5, icon: CreditCard, color: '#10b981' },
  { name: 'Organization & Enterprise', count: 12, icon: Users, color: '#f97316' },
  { name: 'Real-Time & WebSocket', count: 7, icon: Wifi, color: '#ec4899' },
  { name: 'Templates & Documents', count: 5, icon: FileCheck, color: '#14b8a6' },
  { name: 'Marketplace & Booking', count: 4, icon: Calendar, color: '#6366f1' },
  { name: 'Admin & Monitoring', count: 7, icon: Settings, color: '#64748b' },
];

const DEEP_METRICS = [
  { label: 'Total Features', value: '85+' },
  { label: 'AI Features', value: '12' },
  { label: 'Trademarkable IP', value: '11' },
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
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6" data-testid="password-gate">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-6">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">NotaryChain</h1>
          <p className="text-gray-500 mt-2 text-sm tracking-widest uppercase">Investor Preview</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            data-testid="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter access code"
            className="w-full px-4 py-3.5 bg-[#0f1520] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all text-center tracking-[0.3em] text-lg"
          />
          {error && <p data-testid="password-error" className="text-red-400 text-sm text-center">{error}</p>}
          <button data-testid="password-submit" type="submit" disabled={loading || !password} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
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
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          The Future of <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Trust</span> is Here
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          NotaryChain fuses autonomous AI agent swarms, biometric identity, oracle-verified escrow, and blockchain immutability into a single platform that transforms how documents are authenticated and value is exchanged.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
          {PLATFORM_STATS.map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-gray-500 text-xs mt-1">{s.label}</div>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">11 Trademarkable Innovations</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">Proprietary workflow innovations that form a defensible technology moat.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {TRADEMARKS.map((t) => (
            <div key={t.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-blue-500/20 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-white font-semibold text-sm">{t.name}<sup className="text-amber-400 text-[9px] ml-0.5">TM</sup></span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed mb-1">{t.feature}</p>
              <p className="text-gray-600 text-[11px] italic">{t.reason}</p>
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
          <p className="text-amber-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Core Innovation</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">3 Trust Gaps We Solve</h2>
          <p className="text-gray-500 text-sm max-w-2xl mx-auto">Traditional escrow is slow, expensive, and reliant on human intermediaries. We augment trust with cryptographic verification and AI-driven automation.</p>
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
                    <h3 className="text-white font-semibold text-lg">{g.title}</h3>
                  </div>
                  <p className="text-gray-600 text-xs italic mb-2">{g.subtitle}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{g.desc}</p>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{feature.title}</h2>
            {feature.trademark && <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400">TM</span>}
          </div>
          <p className="text-gray-400 leading-relaxed mb-6">{feature.description}</p>
          <div className="flex flex-wrap gap-3">
            {feature.stats.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-xs text-gray-300 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">6-Phase AI Orchestration Pipeline</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">End-to-end autonomous transaction execution powered by GPT-5.2.</p>
        </div>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 via-cyan-500/50 to-emerald-500/50 hidden sm:block" />
          <div className="space-y-6">
            {AI_PIPELINE.map((p, i) => (
              <div key={p.phase} className="flex items-start gap-6 relative">
                <div className="relative z-10 w-16 h-16 rounded-2xl border border-white/[0.08] bg-[#0c1018] flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold" style={{ color: p.color }}>{p.phase}</span>
                </div>
                <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-semibold">{p.name}</h3>
                    {p.trademark && <sup className="text-amber-400 text-[9px]">TM</sup>}
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{totalFeatures} Features Across {FEATURE_CATEGORIES.length} Categories</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURE_CATEGORIES.map((c) => {
            const CIcon = c.icon;
            return (
              <div key={c.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors">
                <CIcon className="w-5 h-5 mb-3" style={{ color: c.color }} />
                <div className="text-xl font-bold text-white">{c.count}</div>
                <div className="text-gray-500 text-xs mt-1 leading-snug">{c.name}</div>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Architecture Overview</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-white/[0.02] border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Frontend — React SPA</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Bento Dashboard', 'ANAN Monitor', 'Escrow Intelligence', 'Fraud Intelligence', 'Biometric Gate', 'Notary Portal', 'Admin Panel', 'AI Tools', 'Role-Based Onboarding'].map(m => (
                <span key={m} className="text-[11px] text-gray-400 bg-blue-500/5 border border-blue-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          <div className="flex justify-center text-gray-700 text-xs">HTTPS / WebSocket (Real-Time Events)</div>
          <div className="bg-white/[0.02] border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Server className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-semibold text-sm">API Gateway — FastAPI</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['JWT Auth + 2FA', 'RBAC Middleware', 'Rate Limiting', 'SSO (Auth0/Okta)', 'WebSocket Manager'].map(m => (
                <span key={m} className="text-[11px] text-gray-400 bg-purple-500/5 border border-purple-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          <div className="bg-white/[0.02] border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Box className="w-5 h-5 text-cyan-400" />
              <h3 className="text-white font-semibold text-sm">Service Layer — 15 Core Services</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {['ANAN Swarm (GPT-5.2)', 'Escrow Oracle', 'Fraud Intelligence', 'AI Engine', 'Biometric Vision', 'Hedera HCS + Bond', 'Payment (Stripe)', 'Agent Reputation', 'Document Pipeline', 'Email (Resend)', 'Notification WS', 'Webhook Delivery', 'S3 Storage', 'HBAR Alerts', 'Scheduled Reports'].map(m => (
                <span key={m} className="text-[11px] text-center text-gray-400 bg-cyan-500/5 border border-cyan-500/10 rounded-md px-2 py-1.5">{m}</span>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Background Workers</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Doc Expiry', 'Smart Reminders', 'Report Gen', 'HBAR Monitor', 'Service Health'].map(m => (
                  <span key={m} className="text-[11px] text-gray-400 bg-amber-500/5 border border-amber-500/10 rounded-md px-2.5 py-1">{m}</span>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.02] border border-emerald-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-semibold text-sm">MongoDB + Hedera HCS</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Users', 'Documents', 'ANAN Ceremonies', 'Escrow Agreements', 'Fraud Patterns', 'Bond Ledger', 'Orgs', 'RBAC Roles'].map(m => (
                  <span key={m} className="text-[11px] text-gray-400 bg-emerald-500/5 border border-emerald-500/10 rounded-md px-2.5 py-1">{m}</span>
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
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">Production-Ready Tech Stack</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {layers.map((l) => {
            const LIcon = l.icon;
            return (
              <div key={l.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-colors">
                <LIcon className="w-7 h-7 mb-3" style={{ color: l.color }} />
                <h3 className="text-white font-semibold mb-3 text-sm">{l.label}</h3>
                <ul className="space-y-1.5">
                  {l.items.map((item) => (
                    <li key={item} className="text-gray-500 text-xs flex items-center gap-2">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Built for Scale</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it) => {
            const IIcon = it.icon;
            return (
              <div key={it.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-colors">
                <IIcon className="w-8 h-8 mb-4" style={{ color: it.color }} />
                <h3 className="text-white font-semibold mb-2">{it.label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{it.desc}</p>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Platform Metrics</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {DEEP_METRICS.map((m) => (
            <div key={m.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center hover:border-white/[0.12] transition-colors">
              <div className="text-3xl font-bold text-white mb-1">{m.value}</div>
              <div className="text-gray-500 text-xs">{m.label}</div>
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
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-10">Positioned for Exponential Growth</h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <BarChart3 className="w-7 h-7 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">$18.6B</div>
            <p className="text-gray-500 text-xs">Global e-notarization market by 2030 (est. CAGR 19.2%)*</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Globe className="w-7 h-7 text-cyan-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">$5.4T</div>
            <p className="text-gray-500 text-xs">Total addressable escrow market (management estimate)*</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Zap className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">90+</div>
            <p className="text-gray-500 text-xs">Enterprise features shipped and tested</p>
          </div>
        </div>
        <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto text-sm">
          The regulatory landscape is rapidly evolving in favor of digital notarization and AI-verified escrow. NotaryChain is building toward one of the most feature-complete platforms in this space, with autonomous AI agent swarms, oracle-verified smart escrow, and <span className="text-white font-medium">11 trademarkable innovations</span> that create a defensible technological moat.
        </p>
        <p className="text-gray-600 text-[9px] mt-6 max-w-xl mx-auto">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Interested in NotaryChain?</h2>
          <p className="text-gray-500 mt-2 text-sm">Let's discuss how we can work together.</p>
        </div>
        {status === 'sent' ? (
          <div data-testid="contact-success" className="text-center py-12 bg-white/[0.02] border border-emerald-500/20 rounded-2xl">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Message Sent</h3>
            <p className="text-gray-400">Thank you for your interest. We'll be in touch shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <input data-testid="contact-name" required value={form.name} onChange={set('name')} placeholder="Your name" className="w-full px-4 py-3 bg-[#0f1520] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
              <input data-testid="contact-email" required type="email" value={form.email} onChange={set('email')} placeholder="Email" className="w-full px-4 py-3 bg-[#0f1520] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
            </div>
            <input data-testid="contact-company" required value={form.company} onChange={set('company')} placeholder="Company / Fund" className="w-full px-4 py-3 bg-[#0f1520] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm" />
            <textarea data-testid="contact-message" required value={form.message} onChange={set('message')} rows={4} placeholder="Tell us about your interest..." className="w-full px-4 py-3 bg-[#0f1520] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm resize-none" />
            <button data-testid="contact-submit" type="submit" disabled={status === 'sending'} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              {status === 'sending' ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /><span>Send Message</span></>}
            </button>
            {status === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>}
          </form>
        )}
        <div className="mt-10 text-center">
          <p className="text-gray-700 text-[8px] leading-relaxed max-w-md mx-auto">
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
          <p className="text-amber-400 tracking-[0.25em] uppercase text-xs font-medium mb-3">Interactive Demo</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Escrow Lifecycle Walkthrough</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">Watch how a $350K real estate transaction flows through all 3 Trust Gaps.</p>
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-medium border ${isActive ? 'border-white/20 bg-white/[0.06] text-white scale-105' : isPast ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-white/[0.06] bg-white/[0.02] text-gray-600 hover:text-gray-400 hover:border-white/10'}`}>
                  <SIcon className="w-3.5 h-3.5" style={{ color: isActive ? s.color : isPast ? '#10b981' : undefined }} />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.phase}</span>
                </button>
                {i < DEMO_STEPS.length - 1 && (
                  <div className={`w-4 h-px ${isPast ? 'bg-emerald-500/40' : 'bg-white/[0.08]'}`} />
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
                    <h3 className="text-white font-bold text-lg mt-1">{step.title}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
              {/* Progress */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-[10px] uppercase tracking-wider">Trust Score</span>
                  <span className="text-white font-bold text-sm">{Math.round(((activeStep + 1) / DEMO_STEPS.length) * 100)}%</span>
                </div>
                <div className="w-32 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((activeStep + 1) / DEMO_STEPS.length) * 100}%`, background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)` }} />
                </div>
                <button onClick={() => { setAutoDemo(d => !d); if (!autoDemo) setActiveStep(0); }} className="text-[10px] px-2.5 py-1 rounded-md border border-white/[0.08] text-gray-400 hover:text-white transition-colors" data-testid="demo-autoplay">
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
          <p className="text-white font-semibold text-sm">{step.detail}</p>
          <p className="text-gray-500 text-xs">{step.detailSub}</p>
        </div>
        <CheckCircle className="w-5 h-5 text-emerald-400 animate-[fadeIn_1s_ease-out_0.4s_both]" />
      </div>
      <div className="flex items-center justify-center gap-2 animate-[fadeIn_0.8s_ease-out_0.6s_both]">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-blue-400 text-xs font-medium">GPT-5.2 parsing document...</span>
        <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto animate-[fadeIn_0.8s_ease-out_1s_both]">
        {['Clauses Found: 42', 'Parties: 2', 'Conditions: 6'].map(t => (
          <div key={t} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-center">
            <span className="text-gray-400 text-[10px]">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoTriggers({ step }) {
  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Brain className="w-3 h-3 text-purple-400" /> AI-Extracted Performance Triggers
      </p>
      {step.triggers.map((t, i) => (
        <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-2.5 opacity-0 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
          <span className="text-white text-sm flex-1">{t.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.method === 'Oracle' ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10' : t.method === 'Biometric' ? 'text-purple-400 border-purple-500/20 bg-purple-500/10' : t.method === 'AI Photo' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' : 'text-gray-400 border-gray-600 bg-gray-800'}`}>{t.method}</span>
          {t.pct > 0 && <span className="text-amber-400 text-[10px] font-bold">{t.pct}%</span>}
        </div>
      ))}
    </div>
  );
}

function DemoVault({ step }) {
  return (
    <div className="text-center space-y-5">
      <div className="inline-block relative">
        <div className="w-32 h-32 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/30 flex flex-col items-center justify-center mx-auto animate-[pulse_2s_ease-in-out_infinite]">
          <Lock className="w-10 h-10 text-emerald-400 mb-1" />
          <span className="text-emerald-400 text-lg font-bold">${(step.vault.amount / 1000).toFixed(0)}K</span>
          <span className="text-emerald-400/60 text-[9px] uppercase tracking-wider">{step.vault.status}</span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
      </div>
      <div className="flex items-center justify-center gap-6 animate-[fadeIn_0.6s_ease-out_0.5s_both]">
        <div className="text-center"><p className="text-[10px] text-gray-600">Stripe PI</p><p className="text-white font-mono text-xs">pi_escrow_8f2a...</p></div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div className="text-center"><p className="text-[10px] text-gray-600">HTS Token</p><p className="text-white font-mono text-xs">{step.vault.token}</p></div>
      </div>
      <p className="text-gray-500 text-xs max-w-sm mx-auto animate-[fadeIn_0.6s_ease-out_0.8s_both]">Funds are tokenized on Hedera and cryptographically locked. Neither party can access until all conditions are met.</p>
    </div>
  );
}

function DemoOracles({ step }) {
  return (
    <div className="space-y-3">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2">
        <Globe className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} /> Querying External Oracles...
      </p>
      {step.oracles.map((o, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 opacity-0 animate-[fadeSlideUp_0.5s_ease-out_both]" style={{ animationDelay: `${i * 400}ms` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white font-medium text-sm">{o.name}</span>
            <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold"><CheckCircle className="w-3 h-3" /> VERIFIED</span>
          </div>
          <p className="text-gray-500 text-xs">{o.result}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-[growWidth_1s_ease-out_both]" style={{ animationDelay: `${i * 400 + 300}ms`, width: `${o.conf}%` }} />
            </div>
            <span className="text-emerald-400 text-[10px] font-mono">{o.conf}%</span>
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
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white" /></div>
            </div>
            <p className="text-white font-semibold text-sm mb-0.5">{data.name}</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-2">{role}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-emerald-400 text-[10px] flex items-center gap-1"><Eye className="w-3 h-3" /> Liveness</span>
              <span className="text-purple-400 text-[10px] font-bold">{data.conf}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center animate-[fadeIn_0.6s_ease-out_0.8s_both]">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-xs font-bold">BIOMETRIC GATE: BOTH PARTIES VERIFIED</span>
        </div>
      </div>
    </div>
  );
}

function DemoSettlement({ step }) {
  return (
    <div className="text-center space-y-5">
      <div className="inline-block relative">
        <div className="w-32 h-32 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30 flex flex-col items-center justify-center mx-auto animate-[pulse_2s_ease-in-out_infinite]">
          <ShieldCheck className="w-10 h-10 text-amber-400 mb-1" />
          <span className="text-amber-400 text-lg font-bold">${(step.settlement.amount / 1000).toFixed(0)}K</span>
          <span className="text-amber-400/60 text-[9px] uppercase tracking-wider">RELEASED</span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 animate-ping" />
      </div>
      <div className="space-y-1.5 max-w-sm mx-auto animate-[fadeIn_0.6s_ease-out_0.5s_both]">
        <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Settlement Hash</span><span className="text-white font-mono">{step.settlement.hash}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-gray-500">HCS Topic</span><span className="text-white font-mono">{step.settlement.topic}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Network</span><span className="text-amber-400 font-bold">{step.settlement.network}</span></div>
      </div>
      <div className="animate-[fadeIn_0.6s_ease-out_1s_both]">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-5 py-2">
          <Blocks className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold tracking-wider">SEALED ON HEDERA MAINNET FOREVER</span>
        </div>
      </div>
    </div>
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
  ]},
  { category: 'Escrow & Finance', features: [
    { name: 'Smart Escrow Vault', trad: false, docu: false, nota: false, nc: true },
    { name: 'Oracle Verification', trad: false, docu: false, nota: false, nc: true },
    { name: 'Milestone Payments', trad: 'manual', docu: false, nota: false, nc: true },
    { name: 'Biometric Settlement Gate', trad: false, docu: false, nota: false, nc: true },
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
    { name: 'Real-Time WebSocket', trad: false, docu: false, nota: false, nc: true },
    { name: 'Public API + Webhooks', trad: false, docu: true, nota: 'basic', nc: true },
  ]},
];

function CellBadge({ val }) {
  if (val === true) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /></span>;
  if (val === false) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.04]"><span className="w-2 h-px bg-gray-700 block" /></span>;
  return <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 uppercase font-bold">{val}</span>;
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">NotaryChain vs The Market</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">16 critical capabilities across AI, escrow, security, and enterprise. Only one platform has them all.</p>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {COMPETITORS.map((c) => {
            const score = c.name === 'NotaryChain' ? totalNc : c.name === 'DocuSign' ? totalDocu : c.name === 'Notarize' ? totalNota : totalTrad;
            const total = 16;
            const pct = Math.round((score / total) * 100);
            const isUs = c.type === 'us';
            return (
              <div key={c.name} className={`rounded-xl p-4 text-center border ${isUs ? 'bg-amber-500/5 border-amber-500/25' : 'bg-white/[0.02] border-white/[0.06]'}`} data-testid={`competitor-${c.name.toLowerCase().replace(/\s/g, '-')}`}>
                <p className={`text-xs font-semibold mb-1 ${isUs ? 'text-amber-400' : 'text-gray-400'}`}>{c.name}</p>
                <p className={`text-2xl font-bold ${isUs ? 'text-amber-400' : 'text-white'}`}>{score}<span className="text-gray-600 text-sm font-normal">/{total}</span></p>
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
            <div className="px-4 py-2.5"><span className="text-gray-600 text-[10px] uppercase tracking-wider">Category</span></div>
            <div className="px-4 py-2.5"><span className="text-gray-600 text-[10px] uppercase tracking-wider">Capability</span></div>
            {COMPETITORS.map(c => (
              <div key={c.name} className="px-2 py-2.5 text-center">
                <span className={`text-[10px] font-bold ${c.type === 'us' ? 'text-amber-400' : 'text-gray-500'}`}>
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
                      <span className="text-gray-400 text-xs font-medium">{cat.category}</span>
                    </div>
                  ) : <div />}
                  <div className="px-4 py-2 flex items-center"><span className="text-gray-300 text-xs">{f.name}</span></div>
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
          <p className="text-gray-500 text-xs">
            NotaryChain delivers <span className="text-amber-400 font-bold">{totalNc}x the capability</span> of traditional notary services and <span className="text-amber-400 font-bold">{Math.round(totalNc / Math.max(totalDocu, 1))}x more features</span> than the closest digital competitor.
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

const SLIDE_LABELS = ['Intro', 'IP Portfolio', 'Trust Gaps', 'ANAN Network', 'Escrow Intelligence', 'AI Orchestrator', 'Biometric', 'Blockchain + Bond', 'RBAC + Fraud Intel', 'AI Pipeline', 'Live Demo', 'Features', 'Architecture', 'Tech Stack', 'Infra', 'Metrics', 'Competitive', 'Market', 'Contact'];

function NavDots({ current, total, onGo }) {
  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-end gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)} className="group flex items-center gap-2" aria-label={SLIDE_LABELS[i]}>
          <span className={`text-[9px] tracking-wider uppercase transition-opacity whitespace-nowrap ${current === i ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-70 text-gray-400'}`}>
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
  // hero + ip + trust_gaps + 6 features + ai_pipeline + demo + feature_breakdown + architecture + tech + infra + metrics + competitive + market + contact = 19
  const totalSlides = 19;
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const containerRef = useRef(null);

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

  const slideMap = [
    <HeroSlide visible={current === 0} />,
    <IPSlide visible={current === 1} />,
    <TrustGapsSlide visible={current === 2} />,
    ...FEATURES.map((f, i) => <FeatureSlide key={f.title} feature={f} visible={current === i + 3} index={i} />),
    <AIPipelineSlide visible={current === 9} />,
    <DemoWalkthroughSlide visible={current === 10} />,
    <FeatureBreakdownSlide visible={current === 11} />,
    <ArchitectureSlide visible={current === 12} />,
    <TechSlide visible={current === 13} />,
    <InfraSlide visible={current === 14} />,
    <MetricsSlide visible={current === 15} />,
    <CompetitiveSlide visible={current === 16} />,
    <MarketSlide visible={current === 17} />,
    <ContactSlide visible={current === 18} />,
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#080c14] overflow-hidden" data-testid="investor-deck">
      <ProgressBar current={current} total={totalSlides} />
      <NavDots current={current} total={totalSlides} onGo={goTo} />

      <button data-testid="autoplay-toggle" onClick={() => setAutoPlay((p) => !p)} className="fixed bottom-6 right-6 z-50 text-xs text-gray-500 hover:text-gray-300 transition-colors bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-sm">
        {autoPlay ? 'Pause' : 'Play'}
      </button>

      <div className="fixed bottom-6 left-6 z-50 text-xs text-gray-600 font-mono">
        {String(current + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <button onClick={() => { setAutoPlay(false); setCurrent((c) => Math.max(c - 1, 0)); }} disabled={current === 0} className="text-gray-500 hover:text-white disabled:opacity-20 transition-all rotate-180">
          <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={() => { setAutoPlay(false); setCurrent((c) => Math.min(c + 1, totalSlides - 1)); }} disabled={current === totalSlides - 1} className="text-gray-500 hover:text-white disabled:opacity-20 transition-all">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="min-h-screen flex items-center justify-center">
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
