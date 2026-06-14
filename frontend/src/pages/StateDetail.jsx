/**
 * StateDetail — full RON compliance abstract for a single state at /compliance/:code
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Shield, ExternalLink, CheckCircle2, Clock, AlertCircle, ArrowLeft, Calendar, FileText, Loader2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Seo } from '../components/Seo';
import { graph, serviceSchema, breadcrumbSchema } from '../lib/seo';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_BADGES = {
  live: { label: 'Live', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pilot: { label: 'Pilot', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  enacted_pending: { label: 'Implementing', icon: Clock, color: 'bg-coral-50 text-coral-700 border-coral-200' },
  proposed: { label: 'Proposed', icon: AlertCircle, color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function StateDetail() {
  const { code } = useParams();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/compliance/states/${code}`)
      .then(r => setState(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Not found'));
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <Card className="max-w-md bg-white border-coral-200">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-coral-600 mx-auto mb-3" />
            <h2 className="font-serif text-2xl text-navy-900 mb-1">State not found</h2>
            <p className="text-slate-600 text-sm mb-5">{error}</p>
            <Link to="/compliance/states" className="text-coral-600 hover:underline text-sm">← Back to all states</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!state) {
    return <div className="min-h-screen bg-cream-100 flex items-center justify-center"><Loader2 className="w-8 h-8 text-coral-500 animate-spin" /></div>;
  }

  const statusBadge = STATUS_BADGES[state.ron_status] || STATUS_BADGES.proposed;
  const StatusIcon = statusBadge.icon;

  return (
    <div className="min-h-screen bg-cream-100" data-testid={`state-detail-${state.code}`}>
      <Seo
        path={`/compliance/states/${state.code}`}
        title={`${state.name} Remote Online Notarization (RON) Compliance`}
        description={`How Remote Online Notarization works in ${state.name}: statute ${state.statute}, identity proofing, A/V and journal requirements, and what documents you can notarize online. NotaryChain is built to meet ${state.name} RON standards.`}
        keywords={`${state.name} online notarization, ${state.name} RON, ${state.name} remote notary, ${state.statute}`}
        jsonLd={graph(
          serviceSchema({
            name: `Online Notarization in ${state.name}`,
            description: `Remote Online Notarization compliant with ${state.name} law (${state.statute}).`,
            serviceType: 'Remote Online Notarization',
            areaServed: { '@type': 'State', name: state.name },
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'State Compliance', path: '/compliance/states' },
            { name: state.name },
          ]),
        )}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </Link>
          <Link to="/compliance/states" className="text-sm text-slate-600 hover:text-navy-900 flex items-center gap-1" data-testid="back-to-comparison">
            <ArrowLeft className="w-4 h-4" /> All states
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-cream-50">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-semibold mb-2">{state.code} · RON Compliance Abstract</div>
          <h1 className="font-serif text-5xl md:text-6xl text-navy-900 tracking-tight mb-4 leading-[1.05]">{state.name}</h1>
          <div className="flex flex-wrap gap-3 mb-6">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded border ${statusBadge.color}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {statusBadge.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 px-3 py-1.5 rounded border border-slate-200 bg-white">
              <Calendar className="w-3.5 h-3.5" /> Effective {state.effective_date}
            </span>
          </div>
          <p className="text-slate-700 max-w-2xl">
            <strong>{state.statute}</strong>
          </p>
          {state.statute_url && (
            <a href={state.statute_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-coral-600 hover:underline text-sm mt-2" data-testid="statute-link">
              Read the statute <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </section>

      {/* Key gates */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="font-serif text-3xl text-navy-900 mb-2">Compliance gates</h2>
        <p className="text-slate-600 mb-8">The hard requirements NotaryChain enforces before sealing a {state.name} ceremony.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {state.key_gates.map(g => (
            <Card key={g.id} className="bg-white border-slate-200" data-testid={`gate-${g.id}`}>
              <CardContent className="p-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{g.id.replace(/_/g, ' ')}</div>
                <h3 className="text-base font-medium text-navy-900 mb-2">{g.label}</h3>
                <p className="text-[13px] text-slate-700 leading-relaxed">{g.min}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Highlights & restrictions */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="font-serif text-2xl text-navy-900 mb-4">Highlights</h3>
            <ul className="space-y-3">
              {(state.highlights || []).map((h, i) => (
                <li key={i} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[14px] text-slate-700">{h}</p>
                </li>
              ))}
            </ul>
          </div>
          {state.restrictions?.length > 0 && (
            <div>
              <h3 className="font-serif text-2xl text-navy-900 mb-4">Restrictions</h3>
              <ul className="space-y-2">
                {state.restrictions.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-coral-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[14px] text-slate-700">{r}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Registration */}
      {state.registration && (
        <section className="bg-cream-50 border-t border-slate-200">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <h3 className="font-serif text-2xl text-navy-900 mb-3 flex items-center gap-2"><FileText className="w-6 h-6 text-coral-600" /> Provider registration</h3>
            <p className="text-slate-700 text-sm mb-3">
              <strong className="text-navy-900">{state.registration.name}</strong> — {state.registration.required ? 'Required' : 'Optional'}, renewable every {state.registration.renewal_years} years.
            </p>
            {state.registration.implementation_status && (
              <p className="text-[12px] text-slate-600 italic mb-3">{state.registration.implementation_status}</p>
            )}
            {state.registration.filing_url && (
              <a href={state.registration.filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-coral-600 hover:underline text-sm" data-testid="filing-url-link">
                Official filing page <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-slate-200 bg-navy-900 text-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <h2 className="font-serif text-3xl mb-3">Ready to ceremoniate in {state.name}?</h2>
          <p className="text-slate-300 text-sm mb-6 max-w-xl mx-auto">
            {state.platform_status === 'live'
              ? `NotaryChain is fully wired for ${state.name} RON. Start a ceremony from your dashboard.`
              : `Pipeline integration for ${state.name} is on our roadmap. Talk to sales to fast-track it for your firm.`}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/dashboard"><button className="bg-coral-500 hover:bg-coral-600 text-white px-6 py-2.5 rounded-md text-sm font-medium inline-flex items-center" data-testid="cta-dashboard">Open dashboard <ChevronRight className="w-4 h-4 ml-1" /></button></Link>
            <Link to="/compliance/states"><button className="border border-cream-100 text-cream-100 hover:bg-white/10 px-6 py-2.5 rounded-md text-sm font-medium">Compare all states</button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
