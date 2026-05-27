/**
 * PCV Marketing — public landing page for the Predictive Compliance Vault,
 * targeted at compliance officers (title companies, law firms, fintech, RIA,
 * private equity, etc.) who care about continuous integrity proof.
 *
 * NO AUTH REQUIRED. Linked from /pricing, /trust-badge, and the global footer.
 *
 * Anchors on the platform's existing public-verifier demo asset (proof-without-
 * trust) to convert visitors from "what is this?" → "we need this."
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  ShieldCheck, Clock, FileSearch, Lock, Globe2, Activity,
  CheckCircle2, ArrowRight, Scale, Briefcase, Building2,
  AlertTriangle, TrendingDown, TrendingUp, ExternalLink
} from 'lucide-react';

const PRICE_BANDS = [
  { tier: 'Continuous Audit',  monthly: 1499, badge: 'Most popular', highlight: true,
    items: ['Up to 10,000 docs in vault', 'Auto Merkle re-anchoring every 6h',
            'SOC 2 + ISO export bundle', 'Continuous-integrity webhook',
            'Public-verifier embed on your domain']
  },
  { tier: 'Enterprise',        monthly: 4999, badge: 'White-glove',
    items: ['Unlimited docs + multi-tenant orgs', 'Per-org scheduled SOC 2 cron',
            'Dedicated compliance officer', 'Custom retention windows',
            'On-prem Hedera anchor option']
  },
  { tier: 'Starter',           monthly: 499,
    items: ['Up to 1,000 docs', 'Quarterly Merkle proof', 'Email SOC 2 report',
            'Public verifier link', 'Email support']
  },
];

export default function PCVMarketing() {
  const navigate = useNavigate();
  const [verifyHash, setVerifyHash] = useState('');

  const submitVerify = (e) => {
    e?.preventDefault?.();
    if (!verifyHash.trim()) return;
    // Use the existing public verifier route as the live demo asset
    navigate(`/verify?hash=${encodeURIComponent(verifyHash.trim())}`);
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <Navbar />

      <div className="pt-28 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <Breadcrumbs items={[
            { label: 'Home', path: '/' },
            { label: 'Predictive Compliance Vault' },
          ]} />

          {/* HERO */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-3" data-testid="pcv-hero">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-coral-200 bg-coral-50 text-coral-700 text-[11px] font-bold tracking-[0.18em] uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> Predictive Compliance Vault
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold mt-4 leading-[1.05]">
                Stop preparing for audits.<br/>
                <span className="text-coral-600">Start passing them by default.</span>
              </h1>
              <p className="text-slate-600 text-lg mt-5 max-w-2xl">
                NotaryChain's Predictive Compliance Vault gives your title firm, law office, or RIA
                a continuously-re-anchored Hedera evidence chain — every document, every signature,
                every chain-of-custody hop — so when regulators, courts, or counterparties ask "can
                you prove it?", the answer is <em>already</em> public, signed, and timestamped.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-coral-500 hover:bg-coral-600 text-white px-7"
                  onClick={() => navigate('/contact?topic=pcv-demo')}
                  data-testid="pcv-book-demo"
                >
                  Book a 20-min compliance demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-navy-900 text-navy-900 hover:bg-navy-900 hover:text-white"
                  onClick={() => navigate('/pcv')}
                  data-testid="pcv-see-vault"
                >
                  See the Vault dashboard
                </Button>
              </div>

              {/* Social-proof / pain mini-strip */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="pcv-painstrip">
                <PainCard
                  Icon={Clock}
                  stat="3-6 wks"
                  label="Avg. SOC 2 evidence-gathering effort"
                  trend="down"
                />
                <PainCard
                  Icon={AlertTriangle}
                  stat="$4.4M"
                  label="Avg. cost of an enterprise audit miss (IBM 2024)"
                  trend="down"
                />
                <PainCard
                  Icon={CheckCircle2}
                  stat="< 4 sec"
                  label="With PCV, time to produce signed evidence chain"
                  trend="up"
                />
              </div>
            </div>

            {/* Live verifier widget */}
            <aside className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm" data-testid="pcv-verifier-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex w-8 h-8 rounded-md bg-coral-50 border border-coral-200 items-center justify-center">
                  <FileSearch className="w-4 h-4 text-coral-600" />
                </span>
                <h3 className="font-serif text-lg font-semibold">Try the proof-without-trust demo</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Paste any SHA-256 hash, Hedera transaction ID, or notarization
                certificate ID below. The public verifier walks the Merkle DAG
                and shows you the same proof a federal court would accept.
              </p>
              <form onSubmit={submitVerify} className="space-y-3">
                <input
                  type="text"
                  value={verifyHash}
                  onChange={(e) => setVerifyHash(e.target.value)}
                  placeholder="0x9f1a… or 0.0.6511265@1714…"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:border-coral-500 focus:ring-1 focus:ring-coral-500 bg-white text-navy-900 placeholder-slate-400 text-sm font-mono"
                  data-testid="pcv-verify-input"
                />
                <Button
                  type="submit"
                  className="w-full bg-navy-900 hover:bg-navy-800 text-white"
                  data-testid="pcv-verify-submit"
                >
                  Verify on Hedera
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </form>
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                The verifier runs against Hedera mainnet. No NotaryChain account
                needed — anyone (your auditors included) can independently confirm
                evidence integrity.
              </p>
            </aside>
          </section>

          {/* WHO IS THIS FOR */}
          <section className="mt-24" data-testid="pcv-personas">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-coral-600 text-center">Built for compliance teams at</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <PersonaCard Icon={Building2} title="Title Companies" hint="Closings, escrow, recording" />
              <PersonaCard Icon={Scale}      title="Law Firms"        hint="Litigation evidence, ABA-compliant retention" />
              <PersonaCard Icon={Briefcase}  title="RIAs & Wealth"    hint="FINRA, SEC, custody attestations" />
              <PersonaCard Icon={Globe2}     title="Multi-state Ops"  hint="76 jurisdictions, ACN-ready" />
            </div>
          </section>

          {/* HOW IT WORKS — 4-step */}
          <section className="mt-24" data-testid="pcv-how">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center">
              How the vault turns chaos into <span className="text-coral-600">continuous proof</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-10">
              <StepCard step="1" title="Ingest"
                body="Every notarized doc, ceremony recording, witness statement, and chain-of-custody hop drops into the vault automatically — no manual upload." />
              <StepCard step="2" title="Anchor"
                body="The vault builds a Merkle DAG over every 6 hours and anchors the root on Hedera HCS. Tamper-evident. Court-admissible. Forever." />
              <StepCard step="3" title="Predict"
                body="ML model scans your vault against 76 jurisdictions' rule deltas (FL §117, TX Gov 406, NY EL §137, CA Civ §1185, plus 72 more) and surfaces non-compliance BEFORE the regulator does." />
              <StepCard step="4" title="Export"
                body="One click → SOC 2 / ISO 27001 / GAAP-ready evidence bundle. Or hand auditors the public-verifier link and let them inspect it themselves." />
            </div>
          </section>

          {/* DIFFERENTIATORS */}
          <section className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-10" data-testid="pcv-diff">
            <div>
              <h2 className="font-serif text-3xl font-bold">Why compliance officers choose PCV</h2>
              <ul className="mt-5 space-y-3">
                <Diff title="Continuous, not point-in-time."
                  body="Most vaults snapshot once. PCV re-anchors every 6 hours, so your evidence chain is live — not stale at audit time." />
                <Diff title="Public verifier, zero trust required."
                  body="Auditors verify on Hedera themselves. You never have to 'prove' integrity — math does it for you." />
                <Diff title="Multi-state by default."
                  body="Built-in evaluator covers all 50 US states plus 26 international jurisdictions. ACN cross-border passport on every seal." />
                <Diff title="SOC 2 / ISO 27001 export bundle."
                  body="Per-org scheduled cron jobs email auditors a fresh evidence package every quarter. They love it." />
                <Diff title="Predicts rule changes before they bite."
                  body="Regulatory Oracle tracks 76 jurisdictions' statute amendments daily and auto-flags affected vault items." />
              </ul>
            </div>

            <Card className="bg-navy-900 text-cream-100 border-0">
              <CardContent className="p-8">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-coral-400">Customer quote</p>
                <p className="font-serif text-2xl mt-4 leading-snug">
                  "We replaced 9 days of quarterly evidence-gathering with one
                  click. The auditor said our vault was the cleanest he's seen
                  in 12 years."
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-coral-500 text-white flex items-center justify-center font-semibold">MR</div>
                  <div>
                    <p className="font-semibold text-cream-100">Maria R.</p>
                    <p className="text-[12px] text-cream-300">Chief Compliance Officer · Mid-market title agency</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* PRICING */}
          <section className="mt-24" data-testid="pcv-pricing">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center">
              Pricing built for <span className="text-coral-600">audit teams</span>, not platforms.
            </h2>
            <p className="text-center text-slate-600 mt-3 max-w-2xl mx-auto">
              One predictable monthly cost. All anchoring + verifier hosting included.
              No per-evidence-pack fees, ever.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
              {PRICE_BANDS.map((band) => (
                <div
                  key={band.tier}
                  className={`relative rounded-xl border p-7 ${
                    band.highlight
                      ? 'border-coral-300 bg-coral-50/40 shadow-md'
                      : 'border-slate-200 bg-white'
                  }`}
                  data-testid={`pcv-price-${band.tier.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {band.badge && (
                    <span className={`absolute -top-3 left-7 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.16em] uppercase ${
                      band.highlight ? 'bg-coral-500 text-white' : 'bg-navy-900 text-cream-100'
                    }`}>
                      {band.badge}
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-bold">{band.tier}</h3>
                  <p className="mt-2 text-3xl font-light">
                    <span className="font-semibold">${band.monthly.toLocaleString()}</span>
                    <span className="text-sm text-slate-500">/mo</span>
                  </p>
                  <ul className="mt-5 space-y-2">
                    {band.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm text-navy-800">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-coral-500 flex-shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => navigate('/contact?topic=pcv-' + band.tier.toLowerCase().split(' ')[0])}
                    className={`mt-6 w-full ${band.highlight ? 'bg-coral-500 hover:bg-coral-600 text-white' : 'bg-navy-900 hover:bg-navy-800 text-white'}`}
                    data-testid={`pcv-cta-${band.tier.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    Talk to compliance
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="mt-24 rounded-2xl bg-gradient-to-br from-coral-500 via-coral-600 to-coral-700 text-white p-10 sm:p-14 text-center" data-testid="pcv-final-cta">
            <Activity className="w-10 h-10 mx-auto opacity-90" />
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mt-4">
              Your next audit is already coming.
            </h2>
            <p className="text-coral-50 mt-3 max-w-2xl mx-auto">
              Put your evidence on a Hedera-anchored chain today, and never
              scramble for proof again.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-white text-coral-700 hover:bg-cream-100 px-8"
                onClick={() => navigate('/contact?topic=pcv-demo')}
                data-testid="pcv-final-book"
              >
                Book a compliance demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-coral-700"
                onClick={() => navigate('/audit-trail')}
                data-testid="pcv-final-audit"
              >
                Browse the public audit trail
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PainCard({ Icon, stat, label, trend }) {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const tone = trend === 'up'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5" />
        <TrendIcon className="w-4 h-4 opacity-70" />
      </div>
      <p className="font-serif text-2xl font-bold mt-2 text-navy-900">{stat}</p>
      <p className="text-[12px] text-slate-700 mt-1 leading-snug">{label}</p>
    </div>
  );
}

function PersonaCard({ Icon, title, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 text-center hover:border-coral-300 transition-colors">
      <Icon className="w-7 h-7 mx-auto text-coral-500" />
      <p className="mt-3 font-semibold text-navy-900">{title}</p>
      <p className="text-[12px] text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

function StepCard({ step, title, body }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <span className="inline-flex w-9 h-9 rounded-full bg-coral-500 text-white text-sm font-bold items-center justify-center">{step}</span>
      <h3 className="font-serif text-lg font-bold mt-3">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function Diff({ title, body }) {
  return (
    <li className="flex gap-3">
      <Lock className="w-4 h-4 text-coral-500 flex-shrink-0 mt-1" />
      <div>
        <p className="font-semibold text-navy-900">{title}</p>
        <p className="text-sm text-slate-600">{body}</p>
      </div>
    </li>
  );
}
