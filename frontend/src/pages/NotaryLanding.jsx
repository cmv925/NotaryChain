import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Award, FileSignature, Stamp, Sparkles, ChevronRight,
  CheckCircle2, ArrowRight, Lock, Users, MapPin, Camera,
  Brain, Link2, Eye, Fingerprint, FileSearch, Zap,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function NotaryLanding() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/fl/launch/public-stats`)
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-cream-100 font-sans text-navy-900">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50" data-testid="public-nav">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5" data-testid="brand-home">
            <Seal className="w-8 h-8" />
            <span className="font-serif text-xl font-bold text-navy-900">NotaryChain</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <Link to="/florida" className="text-slate-700 hover:text-navy-900" data-testid="nav-florida">Florida</Link>
            <Link to="/notaries" className="text-slate-700 hover:text-navy-900" data-testid="nav-notaries">Notary directory</Link>
            <Link to="/scanner/demo" className="text-slate-700 hover:text-navy-900 inline-flex items-center gap-1" data-testid="nav-scanner-demo">
              Try the AI demo <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold tracking-wider bg-coral-500 text-white rounded">NEW</span>
            </Link>
            <Link to="/trust-badge" className="text-slate-700 hover:text-navy-900" data-testid="nav-trust-badge">Trust badge</Link>
            <Link to="/verify" className="text-slate-700 hover:text-navy-900" data-testid="nav-verify">Verify a document</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-block text-sm text-navy-900 px-3 py-2 hover:bg-cream-200 rounded-md" data-testid="nav-signin">Sign in</Link>
            <Link to="/request-notarization" data-testid="nav-cta">
              <button className="bg-coral-500 hover:bg-coral-600 text-white text-sm font-medium px-5 h-10 rounded-md shadow-sm transition-colors">
                Start notarization
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-cream-100" data-testid="hero">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-24 lg:py-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-white border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-coral-500" />
              <span className="text-[11px] font-semibold text-navy-900 tracking-wide">AI-verified · Hedera blockchain sealed · Florida RON-compliant</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-navy-900 leading-[1.05] mb-6">
              Notarization, <span className="italic text-coral-600">done right.</span>
              <br />Online, in minutes.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl">
              The first notary platform built on <strong className="text-navy-900">AI forensics</strong> and the
              <strong className="text-navy-900"> Hedera public blockchain</strong>. Every document is scanned by
              GPT-5 Vision for tampering, every signer is biometrically identity-proofed, and every seal is
              cryptographically anchored on-chain — admissible evidence the moment it&apos;s complete.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/request-notarization" data-testid="hero-cta-notarize">
                <button className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-6 h-12 rounded-md shadow-sm transition-colors inline-flex items-center gap-2 w-full sm:w-auto justify-center">
                  Start a notarization <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/florida/notaries" data-testid="hero-cta-notary">
                <button className="bg-white border border-navy-900 text-navy-900 hover:bg-cream-200 font-medium px-6 h-12 rounded-md transition-colors inline-flex items-center gap-2 w-full sm:w-auto justify-center">
                  Become a notary
                </button>
              </Link>
            </div>
            <Link to="/scanner/demo" data-testid="hero-cta-demo" className="inline-flex items-center gap-2 text-sm text-coral-700 hover:text-coral-800 font-medium mb-10 group">
              <Sparkles className="w-4 h-4" />
              <span>Try the live AI forgery demo — no signup, 5 free scans</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm text-slate-600">
              <Bullet text="GPT-5 forgery scan" />
              <Bullet text="KBA + biometric ID" />
              <Bullet text="Hedera-anchored seals" />
              <Bullet text="10-yr Object-Lock vault" />
            </div>
          </div>

          {/* Hero seal visual */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="absolute -inset-8 bg-gradient-to-br from-cream-300/40 to-transparent blur-2xl rounded-full" />
            <div className="relative bg-white border border-slate-200 rounded-md shadow-md p-8 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-5">
                <BigSeal className="w-20 h-20 flex-shrink-0" />
                <div>
                  <p className="font-serif text-lg text-navy-900 font-bold">Notarized & Sealed</p>
                  <p className="text-xs text-slate-500 tracking-wide">May 16, 2026 · 2:14 PM EST</p>
                </div>
              </div>
              <div className="space-y-2.5 mb-5 text-sm">
                <Row label="Document" value="Warranty Deed · 12 pages" />
                <Row label="Signer" value="Jane Doe · DL verified" />
                <Row label="Notary" value="John Notary, FL #GG987" />
                <Row label="Seal hash" value="0x4a2f…b91c" mono />
              </div>
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-green-700" />
                <span className="text-xs text-green-800 font-medium">Anchored on Hedera mainnet · Topic 0.0.4823</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      {stats && (
        <section className="bg-white border-y border-slate-200" data-testid="trust-strip">
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <Stat label="Commissioned notaries" value={stats.fl_notaries ?? '—'} />
            <Stat label="Notarial acts logged" value={stats.journal_entries ?? '—'} sub={stats.journal_30d ? `+${stats.journal_30d} in 30 days` : null} />
            <Stat label="A/V quality compliant" value={stats.av_pass_rate != null ? `${stats.av_pass_rate}%` : '—'} />
            <Stat label="KBA pass rate" value={stats.kba_pass_rate != null ? `${stats.kba_pass_rate}%` : '—'} />
          </div>
        </section>
      )}

      {/* WHAT WE NOTARIZE */}
      <section className="bg-cream-100 py-20" data-testid="use-cases">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-bold tracking-[0.2em] text-coral-600 uppercase mb-3">What we notarize</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-4 max-w-2xl">The documents your business actually needs witnessed.</h2>
          <p className="text-slate-600 max-w-2xl mb-12">Title closings, wills, powers of attorney, affidavits, business contracts. Each held to Florida RON standards by default.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { i: FileSignature, t: 'Real estate', d: 'Warranty deeds, quitclaim deeds, mortgages, refinance docs.' },
              { i: Award, t: 'Estate planning', d: 'Wills (with FL 2-witness flow), trusts, healthcare directives.' },
              { i: Stamp, t: 'Business affidavits', d: 'Sworn statements, declarations, corporate resolutions.' },
              { i: ShieldCheck, t: 'Powers of attorney', d: 'Durable, springing, healthcare, financial — fully compliant.' },
              { i: Lock, t: 'Custodial assets', d: 'Hand-off agreements for vaults, wallets, escrowed instruments.' },
              { i: Sparkles, t: 'Specialty acts', d: 'Acknowledgments, jurats, oaths, copy certifications.' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-md p-6 hover:shadow-md transition-shadow" data-testid={`use-case-${i}`}>
                <c.i className="w-6 h-6 text-coral-500 mb-3" strokeWidth={1.5} />
                <h3 className="font-serif text-lg text-navy-900 font-bold mb-1.5">{c.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-20" data-testid="how-it-works">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-bold tracking-[0.2em] text-coral-600 uppercase mb-3 text-center">How it works</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-4 text-center max-w-3xl mx-auto">Four steps from upload to sealed.</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-14">Most ceremonies complete in under 15 minutes. Every step is logged, every artifact is hash-pinned, every record is admissible in court.</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                n: 1, t: 'Upload', icon: FileSearch,
                d: 'Drop your document. Our GPT-5 Vision pipeline scans for tampered pixels, missing signature blocks, and altered text — flagging issues before a notary ever sees it.',
                tech: 'AI · GPT-5 Vision',
              },
              {
                n: 2, t: 'Prove who you are', icon: Fingerprint,
                d: 'Government-ID match + 4-question KBA quiz + live face biometric. Our Living Identity engine continuously re-scores trust during the session — drift triggers an alert.',
                tech: 'AI · Biometric + KBA',
              },
              {
                n: 3, t: 'Meet your notary', icon: Users,
                d: 'HD audio-video session with a commissioned notary. Witnesses join via magic-link. A/V quality is enforced in real time — 720p, 16kHz, ≥30s segments per Florida statute.',
                tech: 'Compliance · FL 117.245',
              },
              {
                n: 4, t: 'Sealed on-chain', icon: Link2,
                d: 'A canonical SHA-256 hash of the executed packet is submitted to a Hedera Consensus Service topic on mainnet. You get a permanent transaction ID, a downloadable certificate, and a 10-year Object-Locked S3 vault.',
                tech: 'Blockchain · Hedera HCS',
              },
            ].map((s) => (
              <div key={s.n} className="relative" data-testid={`step-${s.n}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white font-serif text-lg flex items-center justify-center font-bold flex-shrink-0">{s.n}</div>
                  <s.icon className="w-5 h-5 text-coral-500" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg text-navy-900 font-bold mb-2">{s.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{s.d}</p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-coral-700 bg-coral-50 border border-coral-200 px-2 py-1 rounded">
                  {s.tech}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/request-notarization" data-testid="how-it-works-cta">
              <button className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-6 h-12 rounded-md shadow-sm inline-flex items-center gap-2">
                Start your first notarization <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* TECHNOLOGY — AI + BLOCKCHAIN */}
      <section className="bg-navy-900 text-white py-24 relative overflow-hidden" data-testid="technology">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-coral-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="max-w-3xl mb-16">
            <p className="text-xs font-bold tracking-[0.2em] text-coral-300 uppercase mb-3">Under the hood</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl mb-5 leading-tight">
              Built on <span className="italic text-coral-300">AI forensics</span> and
              <span className="italic text-coral-300"> public blockchain</span>.
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Legacy notaries rely on a stamp and a signature. We replace that with continuous machine verification
              and an immutable public ledger — so the proof outlasts the notary, the platform, and even us.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* AI column */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-7 backdrop-blur-sm hover:bg-white/[0.06] transition-colors">
              <div className="w-11 h-11 rounded-md bg-coral-500/20 border border-coral-400/30 flex items-center justify-center mb-5">
                <Brain className="w-5 h-5 text-coral-300" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl mb-3">AI Document Forensics</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                Every uploaded document is dissected by GPT-5 Vision before it touches a notary&apos;s desk. We detect
                copy-paste seals, font mismatches, pixel-level tampering, missing notary blocks, and conflicts with
                prior sealed versions.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <TechBullet text="Multi-modal forgery detection" />
                <TechBullet text="Doc-vs-doc semantic diff" />
                <TechBullet text="Prior-seal collision check" />
                <TechBullet text="AI-generated summary & risk score" />
              </ul>
            </div>

            {/* Blockchain column */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-7 backdrop-blur-sm hover:bg-white/[0.06] transition-colors lg:scale-[1.02] lg:shadow-2xl">
              <div className="w-11 h-11 rounded-md bg-gold-500/20 border border-gold-400/30 flex items-center justify-center mb-5">
                <Link2 className="w-5 h-5 text-gold-300" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl mb-3">Hedera Public Ledger</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                Every sealed packet is hashed (SHA-256) and submitted to Hedera Consensus Service on
                <strong className="text-white"> mainnet</strong>. The result: a globally-verifiable, tamper-proof
                receipt that any third party can independently confirm without trusting NotaryChain.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <TechBullet text="Hedera mainnet HCS topic" />
                <TechBullet text="Ed25519 partner signatures" />
                <TechBullet text="Public transaction ID per seal" />
                <TechBullet text="Verifiable via Hedera Mirror Node" />
              </ul>
            </div>

            {/* Continuous trust column */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-7 backdrop-blur-sm hover:bg-white/[0.06] transition-colors">
              <div className="w-11 h-11 rounded-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-5">
                <Eye className="w-5 h-5 text-emerald-300" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl mb-3">Living Identity Trust</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">
                Identity isn&apos;t a one-time check — it&apos;s a continuous biometric score. We re-attest signers over
                time, detect behavioral drift, and trigger alerts if a notarized identity later shows
                signs of compromise.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <TechBullet text="Continuous biometric re-attestation" />
                <TechBullet text="Drift + behavioral signal scoring" />
                <TechBullet text="WebSocket trust-change alerts" />
                <TechBullet text="Federated TrustLayer network" />
              </ul>
            </div>
          </div>

          {/* Pipeline diagram */}
          <div className="mt-16 bg-white/[0.03] border border-white/10 rounded-lg p-6 sm:p-8">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-coral-300 mb-5">The end-to-end pipeline</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              {[
                { l: 'Document upload', c: 'bg-white/10' },
                { l: 'AI forgery scan', c: 'bg-coral-500/30' },
                { l: 'KBA + biometric', c: 'bg-coral-500/30' },
                { l: 'Live A/V ceremony', c: 'bg-white/10' },
                { l: 'Multi-state evaluator', c: 'bg-white/10' },
                { l: 'SHA-256 canonical hash', c: 'bg-gold-500/30' },
                { l: 'Hedera HCS anchor', c: 'bg-gold-500/30' },
                { l: 'S3 Object-Lock vault', c: 'bg-emerald-500/30' },
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <span className={`${step.c} border border-white/20 px-3 py-1.5 rounded-full font-medium whitespace-nowrap`}>{step.l}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
            <p className="text-slate-400 text-xs mt-5 leading-relaxed">
              Each box is logged with a timestamp, hash, and actor ID. The full chain is exportable as a single
              evidence packet — admissible in any U.S. court, verifiable by any third-party auditor.
            </p>
          </div>
        </div>
      </section>

      {/* WHY IT MATTERS — TRUST CONTRAST */}
      <section className="bg-white py-20" data-testid="why-it-matters">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.2em] text-coral-600 uppercase mb-3">Why it matters</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-navy-900 max-w-3xl mx-auto leading-tight">
              The proof outlasts the paper.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div className="bg-cream-200/40 border border-slate-200 rounded-md p-7">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-4">Traditional notary</p>
              <ul className="space-y-3 text-sm text-slate-700">
                <ContrastRow neg text="Ink stamp on paper — easily forged or scanned away" />
                <ContrastRow neg text="Identity checked once, never re-verified" />
                <ContrastRow neg text="Records sit in a notary&apos;s file cabinet" />
                <ContrastRow neg text="Verification requires phoning the original notary" />
                <ContrastRow neg text="If the notary loses records, the proof is gone" />
              </ul>
            </div>
            <div className="bg-navy-900 border border-navy-900 rounded-md p-7 text-white relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-coral-500/20 blur-3xl" />
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-coral-300 mb-4">NotaryChain</p>
              <ul className="space-y-3 text-sm text-slate-200 relative">
                <ContrastRow pos text="Cryptographic seal anchored to a public blockchain" />
                <ContrastRow pos text="Continuous biometric trust — drift triggers alerts" />
                <ContrastRow pos text="10-year Object-Locked vault, replicated across regions" />
                <ContrastRow pos text="One-click verify via any Hedera Mirror Node — no calls" />
                <ContrastRow pos text="Even if NotaryChain disappears, your proof remains on-chain" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SPLIT — Florida + Trust Badge highlights */}
      <section className="bg-cream-100 py-20" data-testid="features-split">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8">
          <div className="bg-navy-900 text-white rounded-md p-10 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-coral-500/15 blur-3xl" />
            <MapPin className="w-7 h-7 text-coral-300 mb-5" strokeWidth={1.5} />
            <h3 className="font-serif text-2xl mb-3">Florida-first RON compliance</h3>
            <p className="text-slate-300 mb-6 leading-relaxed">Built end-to-end to Florida Statute 117 — KBA, A/V quality enforcement, jurisdiction qualifier, online wills with 2 witnesses, 10-year object-locked retention. RONSP filing on record with FL DoS.</p>
            <Link to="/florida" data-testid="cta-florida-explore">
              <span className="inline-flex items-center gap-2 text-coral-300 hover:text-coral-100 font-medium">
                Explore Florida → <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
          <div className="bg-white border border-slate-200 rounded-md p-10 relative overflow-hidden shadow-sm">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gold-500/10 blur-3xl" />
            <Award className="w-7 h-7 text-gold-600 mb-5" strokeWidth={1.5} />
            <h3 className="font-serif text-2xl text-navy-900 mb-3">Trusted seal on your website</h3>
            <p className="text-slate-600 mb-6 leading-relaxed">Show every visitor your business is a verified notary. Drop a 1-line snippet, prove domain ownership in 60 seconds, and get a Hedera-backed trust seal. From <strong className="text-navy-900">$29/mo</strong>.</p>
            <Link to="/trust-badge" data-testid="cta-trust-badge-explore">
              <span className="inline-flex items-center gap-2 text-coral-600 hover:text-coral-700 font-medium">
                Get the trust badge → <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="bg-navy-900 text-white py-20" data-testid="footer-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl mb-4">Ready to get notarized?</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">Most signings complete in under 15 minutes. Every seal is permanent, every record is admissible.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/request-notarization" data-testid="footer-cta-start">
              <button className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-6 h-12 rounded-md shadow-sm w-full sm:w-auto inline-flex items-center justify-center gap-2">
                Start a notarization <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/scanner" data-testid="footer-cta-scanner">
              <button className="bg-transparent border border-slate-400 text-white hover:bg-white/5 font-medium px-6 h-12 rounded-md w-full sm:w-auto inline-flex items-center justify-center gap-2">
                <Camera className="w-4 h-4" /> Scan a document
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-cream-200 border-t border-slate-200 py-10" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Seal className="w-7 h-7" />
              <span className="font-serif text-lg font-bold text-navy-900">NotaryChain</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">Florida RON-compliant online notarization, anchored on the Hedera public ledger.</p>
          </div>
          <FooterCol title="Product" items={[
            ['Start notarization', '/request-notarization'],
            ['Notary directory', '/notaries'],
            ['Trust badge', '/trust-badge'],
            ['Field scanner', '/scanner'],
          ]} />
          <FooterCol title="Florida" items={[
            ['Florida overview', '/florida'],
            ['Become a notary', '/florida/notaries'],
            ['Notary onboarding', '/notary/onboard/florida'],
            ['Pre-ceremony checks', '/florida/ceremony-readiness'],
          ]} />
          <FooterCol title="Trust" items={[
            ['Verify a document', '/verify'],
            ['Trust Hub', '/trust-hub'],
            ['Public audit trail', '/audit-trail'],
            ['Investor deck', '/investor-deck'],
          ]} />
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-slate-300 flex flex-wrap justify-between text-xs text-slate-500 gap-2">
          <span>© 2026 NotaryChain. Florida RONSP registered.</span>
          <span>Built with care for the documents that matter.</span>
        </div>
      </footer>
    </div>
  );
}

function Bullet({ text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />
      {text}
    </span>
  );
}

function TechBullet({ text }) {
  return (
    <li className="flex items-start gap-2">
      <Zap className="w-3.5 h-3.5 text-coral-300 flex-shrink-0 mt-0.5" strokeWidth={2} />
      <span>{text}</span>
    </li>
  );
}

function ContrastRow({ pos, neg, text }) {
  const Icon = pos ? CheckCircle2 : Lock;
  const color = pos ? 'text-emerald-400' : 'text-slate-500';
  return (
    <li className="flex items-start gap-2.5">
      {neg ? (
        <span className="w-4 h-4 rounded-full border-2 border-slate-400 flex-shrink-0 mt-0.5 flex items-center justify-center">
          <span className="w-1.5 h-0.5 bg-slate-400 block" />
        </span>
      ) : (
        <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
      )}
      <span>{text}</span>
    </li>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="font-serif text-3xl sm:text-4xl text-navy-900 font-bold">{value}</p>
      <p className="text-xs text-slate-500 tracking-wide mt-1">{label}</p>
      {sub && <p className="text-[10px] text-coral-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-20 flex-shrink-0">{label}</span>
      <span className={`text-navy-900 ${mono ? 'font-mono text-xs' : 'text-sm font-medium'} truncate`}>{value}</span>
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="font-semibold text-navy-900 mb-3">{title}</p>
      <ul className="space-y-1.5">
        {items.map(([label, href]) => (
          <li key={href}><Link to={href} className="text-slate-600 hover:text-coral-600">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

// Small inline notary seal mark for the brand lockup
function Seal({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#0A192F" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#D4AF37" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#D4AF37" strokeWidth="0.8" />
      <g stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
          <line key={d} x1="32" y1="5" x2="32" y2="9" transform={`rotate(${d} 32 32)`} />
        ))}
      </g>
      <path d="M32 24 L36 42 L32 45 L28 42 Z" fill="#D4AF37" />
    </svg>
  );
}

function BigSeal({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#FAF6EC" stroke="#0A192F" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#D4AF37" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="22" fill="#0A192F" fillOpacity="0.06" stroke="#0A192F" strokeWidth="0.8" />
      <g stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
          <line key={d} x1="50" y1="8" x2="50" y2="14" transform={`rotate(${d} 50 50)`} />
        ))}
      </g>
      <path d="M50 36 L56 64 L50 68 L44 64 Z" fill="#0A192F" />
      <circle cx="50" cy="55" r="2" fill="#D4AF37" />
      <text x="50" y="86" textAnchor="middle" fontFamily="Playfair Display, serif" fontSize="8" fontWeight="700" fill="#0A192F" letterSpacing="0.4">SEALED</text>
    </svg>
  );
}
