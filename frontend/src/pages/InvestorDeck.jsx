import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Brain, Fingerprint, Link2, Users, FileCheck, ChevronRight, Send, CheckCircle, Layers, Eye, Globe, Zap, BarChart3, ArrowRight, Award, Server, Database, Cpu, GitBranch, Activity, Box, Radio, CreditCard, Calendar, FileText, Settings, UserCheck, Video, Bell, Scale, Network, Blocks, Vote, Wifi } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════ DATA ═══════════════════ */

const PLATFORM_STATS = [
  { label: 'Features Shipped', value: '85+' },
  { label: 'API Endpoints', value: '250+' },
  { label: 'Integrations', value: '9' },
  { label: 'Test Pass Rate', value: '100%' },
];

const TRADEMARKS = [
  { name: 'NotaryChain', feature: 'Platform name', reason: 'Unique brand combining notary + blockchain' },
  { name: 'AI Orchestrator', feature: 'GPT-5.2-powered escrow condition extraction and enforcement', reason: 'Novel AI system that converts contracts into programmable financial instruments' },
  { name: 'Autonomous Notary Agent Network', feature: '3-agent GPT-5.2 blind consensus swarm for notarization', reason: 'Industry-first AI swarm architecture for autonomous document verification' },
  { name: 'Biometric Passport', feature: 'Unified identity credential via face verification', reason: 'Unique identity verification concept for notarization' },
  { name: 'Biometric Proof of Intent', feature: 'Facial geometry + liveness gate for escrow settlement', reason: 'Novel identity-bound escrow release mechanism eliminating fraud' },
  { name: 'Dynamic Fraud Intelligence', feature: 'Self-tuning jurisdictional fraud patterns injected into AI agents', reason: 'Adaptive threat detection for RON compliance' },
  { name: 'SAN Bond Ledger', feature: 'On-chain Hedera HCS immutable insurance bond audit trail', reason: 'Cryptographic accountability for AI agent performance' },
  { name: 'Oracle Verification', feature: 'External data feed integration for autonomous escrow condition verification', reason: 'Trustless milestone verification eliminating intermediaries' },
  { name: 'AI Conductor Mode', feature: 'LLM-guided step-by-step transaction execution', reason: 'Distinctive AI-guided workflow branding' },
  { name: 'Evidence Package', feature: 'Automated settlement audit trail generation', reason: 'Novel automated compliance artifact' },
  { name: 'Document Remediation', feature: 'AI clause analysis & fix suggestions', reason: 'Unique AI-powered document healing concept' },
];

const FEATURES = [
  {
    icon: Vote,
    title: 'ANAN: Autonomous Notary Agent Network',
    trademark: true,
    description: 'Industry-first 3-agent GPT-5.2 swarm that performs blind consensus voting on every notarization. Verifier, Witness, and Sealer agents independently analyze documents, then reach consensus without seeing each other\'s votes. Includes dynamic fraud intelligence, agent reputation auto-tuning, and a $1M on-chain insurance bond.',
    stats: ['3-agent blind consensus', 'GPT-5.2 swarm AI', '$1M on-chain bond', 'Self-tuning weights'],
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
    stats: ['95% automation rate', 'Sub-second decisions', '11 orchestration stages'],
    color: '#3b82f6',
  },
  {
    icon: Fingerprint,
    title: 'Biometric Passport & Proof of Intent',
    trademark: true,
    description: 'Military-grade facial recognition creates tamper-proof biometric identities. GPT-5.2 Vision performs liveness detection and 3D facial geometry analysis. The Biometric Proof of Intent ties escrow settlement keys directly to verified identities, preventing unauthorized fund releases.',
    stats: ['GPT-5.2 Vision analysis', 'Liveness detection', 'Court-admissible proof', 'Escrow settlement gate'],
    color: '#a855f7',
  },
  {
    icon: Blocks,
    title: 'Blockchain Sealing & On-Chain Bond',
    trademark: false,
    description: 'Every notarized document and escrow lifecycle is cryptographically sealed on Hedera Hashgraph mainnet. The SAN Bond Ledger records all agent performance events on-chain, creating an immutable, verifiable audit trail that can never be altered or disputed.',
    stats: ['Hedera Mainnet', 'On-chain bond ledger', 'SHA-256 hashing', 'Immutable audit trail'],
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
    { num: '2', title: 'The Verification Gap', subtitle: 'Eliminating Subjective Disputes', desc: 'Oracle networks (shipping trackers, inspection databases, AI photo analysis) autonomously verify milestones. When data confirms completion, escrow settles instantly. No intermediaries.', color: '#06b6d4', icon: Network },
    { num: '3', title: 'The Security Gap', subtitle: 'Biometric Proof of Intent', desc: 'The escrow "key" is tied to GPT-5.2 Vision biometric verification. Funds release only when the recipient\'s identity is confirmed via 3D facial geometry and liveness detection at settlement.', color: '#a855f7', icon: Fingerprint },
  ];
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-amber-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Core Innovation</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">3 Trust Gaps We Solve</h2>
          <p className="text-gray-500 text-sm max-w-2xl mx-auto">Traditional escrow is slow, expensive, and reliant on human intermediaries. We replace trust with mathematics.</p>
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
            <p className="text-gray-500 text-xs">Global e-notarization market by 2030 (CAGR 19.2%)</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Globe className="w-7 h-7 text-cyan-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">$5.4T</div>
            <p className="text-gray-500 text-xs">Global escrow market addressable with AI-powered automation</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Zap className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">85+</div>
            <p className="text-gray-500 text-xs">Enterprise features shipped and tested at 100% pass rate</p>
          </div>
        </div>
        <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto text-sm">
          The regulatory landscape is rapidly evolving in favor of digital notarization and AI-verified escrow. NotaryChain is the most feature-complete platform in this space, with autonomous AI agent swarms, oracle-verified smart escrow, and <span className="text-white font-medium">11 trademarkable innovations</span> that create a defensible technological moat.
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

const SLIDE_LABELS = ['Intro', 'IP Portfolio', 'Trust Gaps', 'ANAN Network', 'Escrow Intelligence', 'AI Orchestrator', 'Biometric', 'Blockchain + Bond', 'RBAC + Fraud Intel', 'AI Pipeline', 'Features', 'Architecture', 'Tech Stack', 'Infra', 'Metrics', 'Market', 'Contact'];

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
  // hero + ip + trust_gaps + 6 features + ai_pipeline + feature_breakdown + architecture + tech + infra + metrics + market + contact = 17
  const totalSlides = 17;
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
    <FeatureBreakdownSlide visible={current === 10} />,
    <ArchitectureSlide visible={current === 11} />,
    <TechSlide visible={current === 12} />,
    <InfraSlide visible={current === 13} />,
    <MetricsSlide visible={current === 14} />,
    <MarketSlide visible={current === 15} />,
    <ContactSlide visible={current === 16} />,
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
