import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { graph, serviceSchema, faqSchema, howToSchema, breadcrumbSchema } from '../lib/seo';
import { Shield, ArrowRight, CheckCircle, Sun, Home, FileText, Users, Award, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FloridaLanding() {
  const [profile, setProfile] = useState(null);
  const [notaries, setNotaries] = useState({ total: 0, notaries: [] });
  const [stats, setStats] = useState(null);
  const [ronspCurrent, setRonspCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/fl/state-profile`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/fl/notaries/public?limit=6`).then(r => r.ok ? r.json() : { total: 0, notaries: [] }).catch(() => ({ total: 0, notaries: [] })),
      fetch(`${API}/api/fl/launch/public-stats`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/fl/ronsp/filings/current`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([p, n, s, c]) => {
      setProfile(p);
      setNotaries(n);
      setStats(s);
      setRonspCurrent(c);
      setLoading(false);
    });
  }, []);

  const ronspLive = profile?.live_in_state || ronspCurrent?.active;

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="florida-landing">
      <Seo
        path="/florida"
        title="Florida Online Notarization (RON) — Notarize Online in Minutes"
        description="Get documents notarized online in Florida with NotaryChain. Florida RON-compliant: credential analysis, knowledge-based authentication, secure video, and blockchain sealing. Court-admissible in minutes."
        keywords="Florida online notarization, Florida RON, remote online notary Florida, notarize document online Florida, Florida notary public online"
        jsonLd={graph(
          serviceSchema({
            name: 'Florida Online Notarization (RON)',
            description: 'Florida RON-compliant remote online notarization with AI document forensics, identity proofing, and Hedera blockchain sealing.',
            serviceType: 'Remote Online Notarization',
            areaServed: { '@type': 'State', name: 'Florida' },
          }),
          faqSchema([
            { q: 'Is online notarization legal in Florida?', a: 'Yes. Florida authorizes Remote Online Notarization (RON) under Florida Statutes Chapter 117 Part II. NotaryChain meets Florida\u2019s RON requirements, including credential analysis, knowledge-based authentication, a live audio-video session, tamper-evident sealing, and 10-year recording retention.' },
            { q: 'How do I notarize a document online in Florida?', a: 'Create a request, upload your document, complete identity proofing (Florida-compliant credential analysis + KBA), and meet a Florida-commissioned online notary over secure video. The signed document is sealed and anchored on the Hedera blockchain.' },
            { q: 'What are Florida\u2019s RON requirements?', a: 'Florida requires identity proofing via credential analysis and knowledge-based authentication (KBA), a live audio-video session, tamper-evident sealing, and retention of the session recording for at least 10 years.' },
            { q: 'How long does online notarization take in Florida?', a: 'Most Florida RON sessions are completed in under 15 minutes once identity proofing is passed.' },
          ]),
          howToSchema({
            name: 'How to notarize a document online in Florida',
            steps: [
              { name: 'Create a request and upload', text: 'Start a notarization request and upload your document.' },
              { name: 'Complete identity proofing', text: 'Pass Florida-compliant credential analysis and a knowledge-based authentication (KBA) quiz.' },
              { name: 'Meet the notary on video', text: 'Join a live, recorded audio-video session with a Florida-commissioned online notary.' },
              { name: 'Receive the sealed document', text: 'The executed document is sealed and anchored on the Hedera blockchain, then available to download.' },
            ],
          }),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Florida' }]),
        )}
      />
      {/* Hero */}
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-5 h-5 text-coral-600" />
            <span className="text-coral-600 text-[11px] uppercase tracking-[0.25em] font-bold">Florida · Online Notary Service</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-navy-900 mb-5 leading-tight">
            Notarize anything in Florida —<br/>
            <span className="italic text-coral-600">
              from anywhere in the world.
            </span>
          </h1>
          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mb-8">
            Real estate closings, online wills, powers of attorney, and more. Done with a Florida-commissioned notary
            on video — fully compliant with FL Stat. 117.201, blockchain-sealed on Hedera for the next 10+ years.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/request-notarization" data-testid="cta-notarize">
              <Button className="bg-coral-500 hover:bg-coral-600 text-white text-sm px-6 h-11">
                Start a Florida notarization <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/florida/ceremony-readiness" data-testid="cta-ceremony-readiness">
              <Button variant="outline" className="bg-white border-slate-300 text-navy-900 hover:bg-cream-200 text-sm px-6 h-11">
                Pre-ceremony checks
              </Button>
            </Link>
            <Link to="/notary/onboard/florida" data-testid="cta-notary-onboard">
              <Button variant="outline" className="bg-white border-slate-300 text-navy-900 hover:bg-cream-200 text-sm px-6 h-11">
                I'm a FL notary — onboard
              </Button>
            </Link>
            <Link to="/florida/notaries" data-testid="cta-notary-recruit">
              <Button variant="outline" className="bg-coral-50 border-coral-200 text-coral-700 hover:bg-coral-100 text-sm px-6 h-11">
                Notaries: get paid more →
              </Button>
            </Link>
          </div>

          {/* RONSP banner */}
          {ronspCurrent?.active && ronspCurrent.filing && (
            <div className="mt-8 inline-flex items-center gap-3 bg-coral-500/10 border border-coral-200 rounded-lg px-4 py-2.5" data-testid="ronsp-status-banner">
              <CheckCircle className="w-4 h-4 text-coral-600" />
              <div className="text-xs">
                <span className="text-coral-700 font-bold uppercase tracking-wider">Registered RONSP</span>
                <span className="text-navy-800 ml-2">FL DoS #{ronspCurrent.filing.filing_id || ronspCurrent.filing.filing_label}</span>
                {ronspCurrent.filing.expires_at && <span className="text-slate-500 ml-2">· renews {ronspCurrent.filing.expires_at.slice(0, 10)}</span>}
                {ronspCurrent.days_until_renewal !== null && ronspCurrent.days_until_renewal !== undefined && ronspCurrent.days_until_renewal < 60 && (
                  <span className="text-coral-700 ml-2 font-bold">({ronspCurrent.days_until_renewal}d)</span>
                )}
              </div>
            </div>
          )}

          {/* Live stats */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm" data-testid="florida-live-stats">
            <Stat label="Verified FL notaries" value={loading ? '…' : (stats?.fl_notaries ?? notaries.total)} sub="commissioned & bonded" />
            <Stat label="FL ceremonies" value={loading ? '…' : (stats?.ceremonies ?? 0)} sub={stats ? `+${stats.journal_30d} journal in 30d` : 'live counter'} />
            <Stat label="A/V quality pass" value={loading ? '…' : (stats ? `${stats.av_pass_rate}%` : '—')} sub="720p · 16kHz · 30s min" accent="emerald" />
            <Stat
              label="Platform status"
              value={ronspLive ? 'Live' : 'Pending RONSP'}
              sub={ronspLive ? 'registered with FL DoS' : 'awaiting state confirmation'}
              accent={ronspLive ? 'emerald' : 'amber'}
            />
          </div>
          </div>

          {/* Right-side certificate visual */}
          <div className="lg:col-span-5 hidden lg:flex justify-center relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-cream-300/40 to-transparent blur-2xl rounded-full" />
            <div className="relative bg-white border border-slate-200 rounded-md shadow-md p-8 max-w-sm w-full" data-testid="fl-hero-certificate">
              <div className="text-center mb-5">
                <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mb-3" aria-hidden="true">
                  <circle cx="50" cy="50" r="46" fill="#FAF6EC" stroke="#0A192F" strokeWidth="2" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#D4AF37" strokeWidth="0.8" />
                  <circle cx="50" cy="50" r="22" fill="#0A192F" fillOpacity="0.05" stroke="#0A192F" strokeWidth="0.7" />
                  <g stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round">
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => (
                      <line key={d} x1="50" y1="8" x2="50" y2="14" transform={`rotate(${d} 50 50)`} />
                    ))}
                  </g>
                  <text x="50" y="48" textAnchor="middle" fontFamily="Playfair Display, serif" fontSize="13" fontWeight="700" fill="#0A192F">FL</text>
                  <text x="50" y="60" textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize="6" fontWeight="700" fill="#D4AF37" letterSpacing="0.6">NOTARY</text>
                </svg>
                <p className="font-serif text-lg text-navy-900 font-bold">Certificate of Notarization</p>
                <p className="text-xs text-slate-500 mt-1">State of Florida · RON Compliant</p>
              </div>
              <div className="space-y-2 text-sm border-y border-slate-200 py-4 mb-4">
                <CertRow label="Act" value="Acknowledgment" />
                <CertRow label="Doc" value="Warranty Deed · 12 pp" />
                <CertRow label="Signer" value="Jane Doe · DL verified" />
                <CertRow label="KBA" value="Passed · 5/5 · 2 min" />
                <CertRow label="A/V" value="1080p · 48kHz · 14:23" />
                <CertRow label="Hedera" value="Topic 0.0.4823 · Seq #1247" mono />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 tracking-wide">FL Stat. 117.245 journal entry recorded · 10-yr retention</span>
                <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What's allowed in Florida */}
      <div className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">What you can notarize in Florida</h2>
          <p className="text-slate-600 max-w-2xl mb-10 text-sm">Florida is one of only a few states allowing online wills. Most legal acts are RON-eligible.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UseCase icon={Home} title="Real estate" items={['Deeds', 'Mortgages', 'Title affidavits', 'HUD-1s', 'Closing packages']} />
            <UseCase icon={FileText} title="Estate planning" items={['Online wills (FL Stat. 732.522)', 'Trust documents', 'Powers of attorney', 'Health directives']} highlight />
            <UseCase icon={Users} title="Business & legal" items={['UCC filings', 'Affidavits', 'Acknowledgments', 'Jurats & oaths', 'Snowbird POAs']} />
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="border-b border-slate-200 bg-cream-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">Florida-grade compliance, by default</h2>
          <p className="text-slate-600 max-w-2xl mb-10 text-sm">Every Florida notarization on NotaryChain enforces the FL DoS requirements automatically.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Compliance icon={Shield} title="Identity proofing" desc="Photo ID + biometric match + 5-question knowledge-based auth (KBA)" />
            <Compliance icon={FileText} title="Audio + video recording" desc={`Retained ${profile?.av_retention_years || 10} years on tamper-proof storage`} />
            <Compliance icon={Award} title="$25,000 bond required" desc="Every FL notary on the platform is fully bonded & state-trained" />
            <Compliance icon={CheckCircle} title="Hedera-sealed forever" desc="Tamper-evident blockchain seal exceeds FL's technology mandate" />
          </div>
        </div>
      </div>

      {/* Notaries showcase */}
      <div className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-1">Verified Florida notaries</h2>
              <p className="text-slate-600 text-sm">Real notaries, real commissions, every one verified.</p>
            </div>
            <Link to="/notaries?state=FL" className="text-coral-600 text-sm hover:underline inline-flex items-center gap-1" data-testid="fl-directory-link">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto" /></div>
          ) : notaries.notaries.length === 0 ? (
            <Card className="bg-white border-dashed border-slate-300" data-testid="fl-no-notaries">
              <CardContent className="p-10 text-center">
                <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold mb-1">Onboarding Florida notaries now</h3>
                <p className="text-xs text-slate-500 mb-4">Are you a FL-commissioned notary? Get listed for free.</p>
                <Link to="/notary/onboard/florida">
                  <Button className="bg-coral-500 hover:bg-coral-500">Onboard now</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="fl-notaries-grid">
              {notaries.notaries.map(n => (
                <Link key={n.user_id} to={n.profile_url} className="block group">
                  <Card className="bg-white border-slate-200 hover:border-emerald-500/40 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-coral-600" />
                        <h3 className="font-bold text-navy-900 truncate group-hover:text-coral-700">{n.name || '—'}</h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mb-2">FL #{n.commission_number}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-200">
                        <span>${(n.bond_amount_usd || 0).toLocaleString()} bond</span>
                        <span>Verified {fmtDate(n.verified_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="border-b border-slate-200 bg-white/20">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8">Florida FAQ</h2>
          <div className="space-y-4">
            <Faq q="Do I need to be in Florida to use a FL notary?">
              No. Florida law allows out-of-state principals when the document concerns Florida property or law (e.g., a deed for a FL home, an online will under FL Stat. 732.522). The platform asks you to confirm the FL nexus during the ceremony.
            </Faq>
            <Faq q="What's the knowledge-based authentication quiz?">
              Florida requires identity proofing beyond an ID photo. You'll answer 5 dynamic questions about your background (drawn from public records) within 2 minutes. You must get 4 of 5 correct. It's how FL law catches impersonation.
            </Faq>
            <Faq q="Are online wills really enforceable in Florida?">
              Yes. Florida Statute 732.522 enables electronic wills since 2020. The notarization must include 2 witnesses, all on video with you simultaneously. NotaryChain handles the witness flow automatically.
            </Faq>
            <Faq q="How long are records kept?">
              All audio-video recordings, journal entries, and supporting evidence are retained for 10 years — Florida's mandatory minimum. We store on tamper-proof AWS with Hedera blockchain anchoring, retrievable on subpoena.
            </Faq>
            <Faq q="Is NotaryChain a registered RONSP in Florida?">
              {ronspLive
                ? 'Yes. NotaryChain is a registered Remote Online Notarization Service Provider with the FL Department of State.'
                : 'Our RONSP registration is in progress with the FL Department of State. We accept early-access bookings and will activate live ceremonies as soon as confirmation is received.'}
            </Faq>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-coral-500/5 border-coral-200">
          <CardContent className="p-6">
            <Sun className="w-6 h-6 text-coral-600 mb-2" />
            <h3 className="text-xl font-bold mb-2">Need something notarized?</h3>
            <p className="text-sm text-slate-600 mb-4">Match with a FL notary, complete the ceremony in 15 minutes.</p>
            <Link to="/request-notarization"><Button className="bg-coral-500 hover:bg-coral-500">Start notarization</Button></Link>
          </CardContent>
        </Card>
        <Card className="bg-coral-500/5 border-coral-200">
          <CardContent className="p-6">
            <Shield className="w-6 h-6 text-coral-600 mb-2" />
            <h3 className="text-xl font-bold mb-2">Are you a FL notary?</h3>
            <p className="text-sm text-slate-600 mb-4">Onboard in 6 steps. Get found by clients automatically.</p>
            <Link to="/notary/onboard/florida"><Button variant="outline" className="bg-white border-slate-300 text-navy-900 hover:bg-cream-200">Onboard now <ExternalLink className="w-3 h-3 ml-1.5" /></Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const accentClass = accent === 'emerald' ? 'text-coral-600' : accent === 'amber' ? 'text-coral-600' : 'text-navy-900';
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accentClass}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function UseCase({ icon: Icon, title, items, highlight }) {
  return (
    <Card className={`bg-white border-slate-200 ${highlight ? 'ring-1 ring-orange-500/30' : ''}`}>
      <CardContent className="p-6">
        <Icon className={`w-6 h-6 mb-3 ${highlight ? 'text-coral-600' : 'text-coral-600'}`} />
        <h3 className="font-bold text-base mb-3">{title}</h3>
        <ul className="space-y-1.5">
          {items.map(i => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {i}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Compliance({ icon: Icon, title, desc }) {
  return (
    <Card className="bg-white border-slate-200">
      <CardContent className="p-5">
        <Icon className="w-5 h-5 text-coral-600 mb-2" />
        <h4 className="font-bold text-sm mb-1">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Faq({ q, children }) {
  return (
    <Card className="bg-white border-slate-200">
      <CardContent className="p-5">
        <p className="font-bold text-navy-900 mb-1">{q}</p>
        <p className="text-sm text-slate-600">{children}</p>
      </CardContent>
    </Card>
  );
}

function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleDateString(); } catch { return s; } }

function CertRow({ label, value, mono }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold w-12 flex-shrink-0">{label}</span>
      <span className={`text-navy-900 ${mono ? 'font-mono text-[11px]' : 'text-xs font-medium'} truncate`}>{value}</span>
    </div>
  );
}
