import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Brain, Fingerprint, Link2, Users, FileCheck, ChevronRight, Send, CheckCircle, Layers, Eye, Globe, Zap, BarChart3, ArrowRight, Award, Server, Database, Cpu, GitBranch, Activity, Box, Radio, CreditCard, Calendar, FileText, Settings, UserCheck, Video, Bell } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════ DATA ═══════════════════ */

const PLATFORM_STATS = [
  { label: 'Features Shipped', value: '67+' },
  { label: 'API Endpoints', value: '200+' },
  { label: 'Integrations', value: '7' },
  { label: 'Test Pass Rate', value: '100%' },
];

const TRADEMARKS = [
  { name: 'NotaryChain', feature: 'Platform name', reason: 'Unique brand combining notary + blockchain' },
  { name: 'AI Co-pilot', feature: 'Intelligent notary assistant', reason: 'Distinctive AI assistant branding for legal/notary vertical' },
  { name: 'AI Transaction Orchestrator', feature: '4-phase automated transaction execution', reason: 'Novel end-to-end AI-guided notarization workflow' },
  { name: 'Biometric Passport', feature: 'Unified identity credential via face verification', reason: 'Unique identity verification concept for notarization' },
  { name: 'AI Conductor Mode', feature: 'LLM-guided step-by-step transaction execution', reason: 'Distinctive AI-guided workflow branding' },
  { name: 'Evidence Package', feature: 'Automated settlement audit trail generation', reason: 'Novel automated compliance artifact' },
  { name: 'Document Remediation', feature: 'AI clause analysis & fix suggestions', reason: 'Unique AI-powered document healing concept' },
  { name: 'Smart Reminders', feature: 'Context-aware intelligent notification system', reason: 'AI-driven reminder system for legal workflows' },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Transaction Orchestrator',
    trademark: true,
    description: 'Autonomous AI engine that manages the entire notarization lifecycle. Identifies document types, suggests signers, validates compliance, and orchestrates multi-party transactions end-to-end.',
    stats: ['95% automation rate', 'Sub-second decisions', '11 orchestration stages'],
    color: '#3b82f6',
  },
  {
    icon: Fingerprint,
    title: 'Biometric Passport',
    trademark: true,
    description: 'Military-grade facial recognition creates a unique, tamper-proof biometric identity for every participant. Ensures irrefutable identity verification that exceeds court admissibility standards.',
    stats: ['TensorFlow.js deep learning', 'Liveness detection', 'Court-admissible proof'],
    color: '#8b5cf6',
  },
  {
    icon: Link2,
    title: 'Blockchain Sealing Engine',
    trademark: false,
    description: 'Every notarized document is cryptographically sealed on the Hedera Hashgraph network, creating an immutable, timestamped proof of authenticity that can never be altered or disputed.',
    stats: ['Hedera Hashgraph', 'SHA-256 hashing', 'Immutable ledger'],
    color: '#06b6d4',
  },
  {
    icon: Shield,
    title: 'Enterprise RBAC & SSO',
    trademark: false,
    description: 'Granular role-based access control with 23 permissions across 7 categories, custom roles, single sign-on integration, and organization-wide security policies. Built for enterprise compliance at scale.',
    stats: ['23 permissions', 'SAML/OIDC ready', 'Permission-gated UI'],
    color: '#10b981',
  },
  {
    icon: FileCheck,
    title: 'Smart Document Templates',
    trademark: false,
    description: 'AI-powered document generation and a comprehensive template library with field extraction, auto-population, and intelligent validation. From creation to notarization in minutes.',
    stats: ['5+ template types', 'AI field detection', 'Batch processing'],
    color: '#f59e0b',
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    trademark: false,
    description: 'WebSocket-powered live sessions for multi-party notarizations. Video conferencing, real-time notifications, co-editing, and a full audit trail of every action.',
    stats: ['Live video sessions', 'WebSocket events', 'Complete audit trail'],
    color: '#ef4444',
  },
];

const AI_PIPELINE = [
  { phase: '01', name: 'Document Remediation', trademark: true, desc: 'AI analyzes clauses, identifies issues, and suggests fixes before notarization begins.', color: '#3b82f6' },
  { phase: '02', name: 'Biometric Passport', trademark: true, desc: 'Unified biometric identity credential created via client-side face detection and liveness challenges.', color: '#8b5cf6' },
  { phase: '03', name: 'AI Conductor Mode', trademark: true, desc: 'LLM-guided step-by-step transaction execution with real-time compliance validation.', color: '#06b6d4' },
  { phase: '04', name: 'Evidence Package', trademark: true, desc: 'Automated settlement audit trail with blockchain sealing and exportable compliance artifacts.', color: '#10b981' },
];

const FEATURE_CATEGORIES = [
  { name: 'Core Notarization', count: 7, icon: FileText, color: '#3b82f6' },
  { name: 'AI & Intelligence', count: 7, icon: Brain, color: '#8b5cf6' },
  { name: 'Security & Identity', count: 8, icon: Shield, color: '#ef4444' },
  { name: 'Blockchain & Verification', count: 4, icon: Link2, color: '#06b6d4' },
  { name: 'Payments & Subscriptions', count: 5, icon: CreditCard, color: '#10b981' },
  { name: 'Organization & Enterprise', count: 12, icon: Users, color: '#f59e0b' },
  { name: 'Real-Time & Collaboration', count: 5, icon: Radio, color: '#ec4899' },
  { name: 'Templates & Documents', count: 5, icon: FileCheck, color: '#14b8a6' },
  { name: 'Marketplace & Booking', count: 4, icon: Calendar, color: '#a855f7' },
  { name: 'User Experience', count: 5, icon: Eye, color: '#f97316' },
  { name: 'Admin & Monitoring', count: 5, icon: Settings, color: '#6366f1' },
];

const DEEP_METRICS = [
  { label: 'Total Features', value: '67+' },
  { label: 'AI Features', value: '7' },
  { label: 'Trademarkable IP', value: '8' },
  { label: 'RBAC Permissions', value: '23' },
  { label: 'Webhook Events', value: '11' },
  { label: 'Report Sections', value: '5' },
  { label: 'Subscription Tiers', value: '3' },
  { label: 'Feature Categories', value: '11' },
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
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-6">Enterprise-Grade Digital Notarization</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          The Future of <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Notarization</span> is Here
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          NotaryChain fuses AI orchestration, biometric identity, and blockchain immutability into a single platform that transforms how documents are authenticated and trusted.
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">8 Trademarkable Innovations</h2>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">4-Phase AI Orchestration Pipeline</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">End-to-end autonomous transaction execution powered by Google Gemini.</p>
        </div>
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-emerald-500/50 hidden sm:block" />
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
          {/* Summary card */}
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
          {/* Frontend Layer */}
          <div className="bg-white/[0.02] border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Frontend — React SPA</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Auth & Dashboard', 'Notary Portal', 'Admin Panel', 'AI Tools', 'Org Management', 'RBAC & SSO', 'Biometric Verification', 'Real-Time Collab'].map(m => (
                <span key={m} className="text-[11px] text-gray-400 bg-blue-500/5 border border-blue-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center text-gray-700 text-xs">HTTPS / WebSocket</div>
          {/* API Gateway */}
          <div className="bg-white/[0.02] border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Server className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-semibold text-sm">API Gateway — FastAPI</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['JWT Auth', 'RBAC Middleware', 'Rate Limiting (SlowAPI)', 'CORS'].map(m => (
                <span key={m} className="text-[11px] text-gray-400 bg-purple-500/5 border border-purple-500/10 rounded-md px-2.5 py-1">{m}</span>
              ))}
            </div>
          </div>
          {/* Service Layer */}
          <div className="bg-white/[0.02] border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Box className="w-5 h-5 text-cyan-400" />
              <h3 className="text-white font-semibold text-sm">Service Layer — 9 Core Services</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {['Document', 'Notary', 'AI Engine (Gemini)', 'Payment (Stripe)', 'Blockchain (Hedera)', 'Organization & RBAC', 'Webhook Delivery', 'Scheduled Reports', 'Real-Time WS'].map(m => (
                <span key={m} className="text-[11px] text-center text-gray-400 bg-cyan-500/5 border border-cyan-500/10 rounded-md px-2 py-1.5">{m}</span>
              ))}
            </div>
          </div>
          {/* Background & DB */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-amber-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Background Workers</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Doc Expiry Checker', 'Smart Reminders', 'Report Generation'].map(m => (
                  <span key={m} className="text-[11px] text-gray-400 bg-amber-500/5 border border-amber-500/10 rounded-md px-2.5 py-1">{m}</span>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.02] border border-emerald-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-semibold text-sm">MongoDB</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Users', 'Documents', 'Transactions', 'Orgs', 'RBAC Roles', 'Webhooks', 'Activity Logs', 'Reports'].map(m => (
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
    { icon: Eye, label: 'Frontend', items: ['React 18 (SPA)', 'React Router v6', 'TailwindCSS + Shadcn/UI', 'TensorFlow.js + MediaPipe', 'react-pdf', 'Axios'], color: '#3b82f6' },
    { icon: Zap, label: 'Backend', items: ['FastAPI (async Python)', 'Motor (async MongoDB)', 'ReportLab (PDF gen)', 'AsyncIO scheduler', 'SlowAPI (rate limiting)'], color: '#8b5cf6' },
    { icon: Layers, label: 'Integrations', items: ['Google Gemini (AI)', 'Stripe (payments)', 'Hedera Hashgraph', 'Daily.co (video)', 'Resend (email)', 'CoinGecko (crypto)'], color: '#06b6d4' },
    { icon: Shield, label: 'Security', items: ['JWT + TOTP 2FA', 'SAML/OIDC SSO', 'Custom RBAC engine', 'HMAC-SHA256 webhooks', 'Sentry monitoring'], color: '#10b981' },
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
    { icon: Activity, label: 'Monitoring', desc: 'Sentry error tracking — real-time alerting', color: '#ef4444' },
    { icon: Cpu, label: 'Graceful Degradation', desc: 'ML & blockchain features degrade safely in resource-constrained environments', color: '#10b981' },
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
            <div className="text-3xl font-bold text-white mb-1">43 States</div>
            <p className="text-gray-500 text-xs">Now permit remote online notarization in the US</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <Zap className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">67+</div>
            <p className="text-gray-500 text-xs">Enterprise features shipped and tested at 100% pass rate</p>
          </div>
        </div>
        <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto text-sm">
          The regulatory landscape is rapidly evolving in favor of digital notarization. NotaryChain is the most feature-complete platform in this space, with AI-first architecture and <span className="text-white font-medium">8 trademarkable innovations</span> that create a defensible technological moat.
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

const SLIDE_LABELS = ['Intro', 'IP Portfolio', 'AI Orchestrator', 'Biometric', 'Blockchain', 'RBAC', 'Templates', 'Collaboration', 'AI Pipeline', 'Features', 'Architecture', 'Tech Stack', 'Infra', 'Metrics', 'Market', 'Contact'];

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
  // hero + ip + 6 features + ai_pipeline + feature_breakdown + architecture + tech + infra + metrics + market + contact = 16
  const totalSlides = 16;
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

  // Map slide index to component
  const slideMap = [
    <HeroSlide visible={current === 0} />,
    <IPSlide visible={current === 1} />,
    ...FEATURES.map((f, i) => <FeatureSlide key={f.title} feature={f} visible={current === i + 2} index={i} />),
    <AIPipelineSlide visible={current === 8} />,
    <FeatureBreakdownSlide visible={current === 9} />,
    <ArchitectureSlide visible={current === 10} />,
    <TechSlide visible={current === 11} />,
    <InfraSlide visible={current === 12} />,
    <MetricsSlide visible={current === 13} />,
    <MarketSlide visible={current === 14} />,
    <ContactSlide visible={current === 15} />,
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
