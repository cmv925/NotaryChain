import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Brain, Fingerprint, Link2, Users, FileCheck, ChevronRight, Send, CheckCircle, Layers, Eye, Globe, Zap, BarChart3, ArrowRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

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
    stats: ['Face-API deep learning', 'Liveness detection', 'Court-admissible proof'],
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
    description: 'Granular role-based access control with custom permissions, single sign-on integration, and organization-wide security policies. Built for enterprise compliance at scale.',
    stats: ['Custom role builder', 'SAML/OIDC ready', 'Org-level policies'],
    color: '#10b981',
  },
  {
    icon: FileCheck,
    title: 'Smart Document Templates',
    trademark: false,
    description: 'AI-powered document generation and a comprehensive template library with field extraction, auto-population, and intelligent validation. From creation to notarization in minutes.',
    stats: ['100+ templates', 'AI field detection', 'Batch processing'],
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

const PLATFORM_STATS = [
  { label: 'Features Shipped', value: '67+' },
  { label: 'API Endpoints', value: '200+' },
  { label: 'Enterprise Integrations', value: '7' },
  { label: 'Test Pass Rate', value: '100%' },
];

/* ────────────────── PASSWORD GATE ────────────────── */
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
          <button
            data-testid="password-submit"
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Access Deck</span><ChevronRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ────────────────── SECTION: HERO ────────────────── */
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

/* ────────────────── SECTION: FEATURE CARD ────────────────── */
function FeatureSlide({ feature, visible, index }) {
  const Icon = feature.icon;
  const isEven = index % 2 === 0;
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className={`max-w-5xl mx-auto px-6 py-16 flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}>
        {/* Visual */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-20" style={{ background: feature.color }} />
            <div className="relative w-64 h-64 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-24 h-24" style={{ color: feature.color }} strokeWidth={1} />
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{feature.title}</h2>
            {feature.trademark && <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border border-blue-500/30 text-blue-400">TM</span>}
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

/* ────────────────── SECTION: TECH STACK ────────────────── */
function TechSlide({ visible }) {
  const layers = [
    { icon: Eye, label: 'Frontend', items: ['React 18', 'TailwindCSS', 'Shadcn UI', 'face-api.js'], color: '#3b82f6' },
    { icon: Zap, label: 'Backend', items: ['FastAPI', 'Motor (async MongoDB)', 'APScheduler', 'WebSockets'], color: '#8b5cf6' },
    { icon: Layers, label: 'Infrastructure', items: ['MongoDB Atlas', 'Hedera Hashgraph', 'Stripe Payments', 'Resend Email'], color: '#06b6d4' },
    { icon: Globe, label: 'AI & Security', items: ['Google Gemini', 'JWT + 2FA', 'HMAC Webhooks', 'RBAC Engine'], color: '#10b981' },
  ];
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4 text-center">Architecture</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">Production-Ready Tech Stack</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {layers.map((l) => {
            const LIcon = l.icon;
            return (
              <div key={l.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-colors">
                <LIcon className="w-8 h-8 mb-4" style={{ color: l.color }} />
                <h3 className="text-white font-semibold mb-3">{l.label}</h3>
                <ul className="space-y-2">
                  {l.items.map((item) => (
                    <li key={item} className="text-gray-500 text-sm flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full" style={{ background: l.color }} />
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

/* ────────────────── SECTION: MARKET OPPORTUNITY ────────────────── */
function MarketSlide({ visible }) {
  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Market Opportunity</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-12">Positioned for Exponential Growth</h2>
        <div className="grid sm:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <BarChart3 className="w-8 h-8 text-blue-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">$18.6B</div>
            <p className="text-gray-500 text-sm">Global e-notarization market by 2030 (CAGR 19.2%)</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <Globe className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">43 States</div>
            <p className="text-gray-500 text-sm">Now permit remote online notarization in the US</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <Zap className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">67+</div>
            <p className="text-gray-500 text-sm">Enterprise features shipped and tested at 100% pass rate</p>
          </div>
        </div>
        <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
          The regulatory landscape is rapidly evolving in favor of digital notarization. NotaryChain is the most feature-complete platform in this space, with AI-first architecture that creates a defensible technological moat.
        </p>
      </div>
    </section>
  );
}

/* ────────────────── SECTION: CONTACT FORM ────────────────── */
function ContactSlide({ visible }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`${API}/api/investor-deck/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setStatus('sent'); }
      else { setStatus('error'); }
    } catch {
      setStatus('error');
    }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <section className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-blue-400 tracking-[0.25em] uppercase text-xs font-medium mb-4">Get in Touch</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Interested in NotaryChain?</h2>
          <p className="text-gray-500 mt-2">Let's discuss how we can work together.</p>
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
            <button
              data-testid="contact-submit"
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {status === 'sending' ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /><span>Send Message</span></>}
            </button>
            {status === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>}
          </form>
        )}
      </div>
    </section>
  );
}

/* ────────────────── PROGRESS BAR ────────────────── */
function ProgressBar({ current, total }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-white/[0.05]">
      <div className="h-full bg-blue-500 transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ────────────────── NAV DOTS ────────────────── */
function NavDots({ current, total, onGo }) {
  const labels = ['Intro', ...FEATURES.map(f => f.title.split(' ')[0]), 'Tech', 'Market', 'Contact'];
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-end gap-3">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          className="group flex items-center gap-2"
          aria-label={labels[i] || `Slide ${i + 1}`}
        >
          <span className={`text-[10px] tracking-wider uppercase transition-opacity ${current === i ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-70 text-gray-400'}`}>
            {labels[i]}
          </span>
          <span className={`block rounded-full transition-all ${current === i ? 'w-3 h-3 bg-blue-500' : 'w-2 h-2 bg-white/20 group-hover:bg-white/40'}`} />
        </button>
      ))}
    </div>
  );
}

/* ────────────────── MAIN DECK ────────────────── */
function DeckPresentation() {
  const totalSlides = 1 + FEATURES.length + 3; // hero + features + tech + market + contact
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const containerRef = useRef(null);

  // Auto-advance every 6s
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c < totalSlides - 1 ? c + 1 : c));
    }, 6000);
    return () => clearInterval(timer);
  }, [autoPlay, totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setAutoPlay(false);
        setCurrent((c) => Math.min(c + 1, totalSlides - 1));
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setAutoPlay(false);
        setCurrent((c) => Math.max(c - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalSlides]);

  // Scroll/wheel navigation
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
  }, [totalSlides]);

  const goTo = (i) => { setAutoPlay(false); setCurrent(i); };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#080c14] overflow-hidden" data-testid="investor-deck">
      <ProgressBar current={current} total={totalSlides} />
      <NavDots current={current} total={totalSlides} onGo={goTo} />

      {/* Auto-play toggle */}
      <button
        data-testid="autoplay-toggle"
        onClick={() => setAutoPlay((p) => !p)}
        className="fixed bottom-6 right-6 z-50 text-xs text-gray-500 hover:text-gray-300 transition-colors bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-sm"
      >
        {autoPlay ? 'Pause' : 'Play'}
      </button>

      {/* Slide counter */}
      <div className="fixed bottom-6 left-6 z-50 text-xs text-gray-600 font-mono">
        {String(current + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
      </div>

      {/* Navigation arrows */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <button
          onClick={() => { setAutoPlay(false); setCurrent((c) => Math.max(c - 1, 0)); }}
          disabled={current === 0}
          className="text-gray-500 hover:text-white disabled:opacity-20 transition-all rotate-180"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setAutoPlay(false); setCurrent((c) => Math.min(c + 1, totalSlides - 1)); }}
          disabled={current === totalSlides - 1}
          className="text-gray-500 hover:text-white disabled:opacity-20 transition-all"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Slides */}
      <div className="min-h-screen flex items-center justify-center">
        {current === 0 && <HeroSlide visible={current === 0} />}
        {FEATURES.map((f, i) => current === i + 1 && <FeatureSlide key={f.title} feature={f} visible={current === i + 1} index={i} />)}
        {current === FEATURES.length + 1 && <TechSlide visible={current === FEATURES.length + 1} />}
        {current === FEATURES.length + 2 && <MarketSlide visible={current === FEATURES.length + 2} />}
        {current === FEATURES.length + 3 && <ContactSlide visible={current === FEATURES.length + 3} />}
      </div>
    </div>
  );
}

/* ────────────────── PAGE WRAPPER ────────────────── */
export default function InvestorDeck() {
  const [verified, setVerified] = useState(false);
  return verified ? <DeckPresentation /> : <PasswordGate onVerified={() => setVerified(true)} />;
}
