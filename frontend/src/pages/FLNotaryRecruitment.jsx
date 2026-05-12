import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, ArrowRight, Briefcase, DollarSign, TrendingUp, Shield, CheckCircle, Loader2, Send, Users } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const BENEFITS = [
  { icon: DollarSign, title: 'Premium per-act fees', body: '$25-$75/act vs FL statutory cap of $10. Online wills and complex closings pay top tier.' },
  { icon: TrendingUp, title: 'High-volume pipeline', body: 'Real-estate, B2B, and SALV anchor pilots queue ceremonies directly to qualified notaries.' },
  { icon: Shield, title: 'Built-in compliance', body: 'KBA, A/V gate, jurisdiction qualifier, journal logging, 10-yr retention — all automatic.' },
  { icon: Briefcase, title: 'Tech that does the work', body: 'AI-assisted document review, biometric proofing, Hedera sealing — you focus on the ceremony.' },
];

const STEPS = [
  { n: 1, t: 'Submit interest', b: 'Tell us about your commission, county, monthly volume.' },
  { n: 2, t: 'Verification call', b: '20-min onboarding call — we confirm your commission, bond, and E&O coverage.' },
  { n: 3, t: 'Platform onboard', b: 'Complete your notary credential profile and the FL compliance modules.' },
  { n: 4, t: 'Go live', b: 'Accept ceremonies from the queue. First $500 in fees waived from platform cut.' },
];

const VOLUMES = ['<10', '10-50', '50-200', '200+'];

export default function FLNotaryRecruitment() {
  const [stats, setStats] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', fl_commission_number: '',
    county: '', monthly_volume_estimate: '10-50', years_experience: '',
    referral_source: '', message: '',
  });

  useEffect(() => {
    fetch(`${API}/api/fl/launch/public-stats`)
      .then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name || !form.email) { toast.error('Name and email required'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/fl/recruitment/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Submit failed');
      setSubmitted(body);
      toast.success(body.message || 'Thanks — we\'ll be in touch!');
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="fl-recruitment-page">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-orange-950/30 via-slate-950 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Sun className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-300 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Notary recruitment</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 max-w-3xl">
            Get paid more.
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-lime-300 bg-clip-text text-transparent"> Do less paperwork.</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mb-8">
            NotaryChain pays Florida-commissioned notaries premium fees per online act, queues high-value real-estate
            and online-will ceremonies to you automatically, and handles every state-mandated compliance step in the background.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <a href="#apply" data-testid="cta-apply-scroll">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-6 h-11">
                Apply to onboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Link to="/florida"><Button variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800 text-sm px-6 h-11">See platform stats</Button></Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
            <Stat label="FL notaries onboarded" value={stats?.fl_notaries ?? '—'} testId="stat-notaries" />
            <Stat label="Ceremonies" value={stats?.ceremonies ?? '—'} testId="stat-ceremonies" />
            <Stat label="Journal entries" value={stats?.journal_entries ?? '—'} sub={stats ? `+${stats.journal_30d} in 30d` : ''} testId="stat-journal" />
            <Stat label="A/V quality pass" value={stats ? `${stats.av_pass_rate}%` : '—'} testId="stat-av" />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8">Why FL notaries pick NotaryChain</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BENEFITS.map((b, i) => (
            <Card key={i} className="bg-slate-900/60 border-slate-800" data-testid={`benefit-${i}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <b.icon className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold">{b.title}</h3>
                </div>
                <p className="text-sm text-slate-400">{b.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="border-y border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8">From interested to earning in 4 steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-slate-900/60 border border-slate-800 rounded-lg p-5" data-testid={`step-${s.n}`}>
                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-300 flex items-center justify-center text-sm font-bold mb-3">{s.n}</div>
                <h3 className="font-bold mb-1">{s.t}</h3>
                <p className="text-xs text-slate-400">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply form */}
      <div id="apply" className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 text-[10px] uppercase tracking-[0.25em] font-bold">Apply now</span>
          </div>
          <h2 className="text-3xl font-bold">Tell us about you</h2>
          <p className="text-slate-400 text-sm mt-2">We'll respond within 2 business days. No spam, no pressure.</p>
        </div>

        {submitted ? (
          <Card className="bg-emerald-500/5 border-emerald-500/30" data-testid="recruitment-success">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-emerald-300 mb-1">Got it — thanks!</h3>
              <p className="text-sm text-slate-400 mb-3">{submitted.message}</p>
              <p className="text-[10px] text-slate-500 font-mono">lead_id: {submitted.lead_id}</p>
              <Link to="/florida" className="text-emerald-400 text-xs hover:underline mt-3 inline-block">Back to /florida →</Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-6 space-y-3" data-testid="recruitment-form">
              <Row>
                <FieldI label="Full name *"><Input value={form.full_name} onChange={e => upd('full_name', e.target.value)} className="bg-slate-950/60 border-slate-800" data-testid="lead-name" /></FieldI>
                <FieldI label="Email *"><Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} className="bg-slate-950/60 border-slate-800" data-testid="lead-email" /></FieldI>
              </Row>
              <Row>
                <FieldI label="Phone"><Input value={form.phone} onChange={e => upd('phone', e.target.value)} className="bg-slate-950/60 border-slate-800" data-testid="lead-phone" /></FieldI>
                <FieldI label="FL Commission #"><Input value={form.fl_commission_number} onChange={e => upd('fl_commission_number', e.target.value)} className="bg-slate-950/60 border-slate-800" data-testid="lead-commission" /></FieldI>
              </Row>
              <Row>
                <FieldI label="County"><Input value={form.county} onChange={e => upd('county', e.target.value)} placeholder="Hillsborough" className="bg-slate-950/60 border-slate-800" data-testid="lead-county" /></FieldI>
                <FieldI label="Years of experience"><Input type="number" value={form.years_experience} onChange={e => upd('years_experience', e.target.value)} className="bg-slate-950/60 border-slate-800" data-testid="lead-experience" /></FieldI>
              </Row>
              <Row>
                <FieldI label="Monthly volume estimate">
                  <select value={form.monthly_volume_estimate} onChange={e => upd('monthly_volume_estimate', e.target.value)} className="bg-slate-950/60 border border-slate-800 rounded-md px-3 h-10 text-sm text-white w-full" data-testid="lead-volume">
                    {VOLUMES.map(v => <option key={v} value={v}>{v} acts/mo</option>)}
                  </select>
                </FieldI>
                <FieldI label="Referral source">
                  <Input value={form.referral_source} onChange={e => upd('referral_source', e.target.value)} placeholder="Google, LinkedIn, colleague…" className="bg-slate-950/60 border-slate-800" data-testid="lead-source" />
                </FieldI>
              </Row>
              <FieldI label="Anything else we should know?">
                <textarea rows={3} value={form.message} onChange={e => upd('message', e.target.value)} className="bg-slate-950/60 border border-slate-800 rounded-md p-3 text-sm text-white w-full" data-testid="lead-message" />
              </FieldI>
              <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 w-full h-11" data-testid="submit-lead-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit application</>}
              </Button>
              <p className="text-[10px] text-slate-500 text-center">By submitting, you consent to be contacted about NotaryChain notary opportunities.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, testId }) {
  return (
    <div data-testid={testId} className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}
function Row({ children }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>; }
function FieldI({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>
      {children}
    </div>
  );
}
