/**
 * StateComparison — Multi-state RON compliance landing at /compliance
 * Compares Florida, Texas, NY, California, Virginia side-by-side.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { graph, faqSchema, breadcrumbSchema } from '../lib/seo';
import axios from 'axios';
import { Shield, ExternalLink, MapPin, CheckCircle2, Clock, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_BADGES = {
  live: { label: 'Live', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pilot: { label: 'Pilot', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  enacted_pending: { label: 'Implementing', icon: Clock, color: 'bg-coral-50 text-coral-700 border-coral-200' },
  proposed: { label: 'Proposed', icon: AlertCircle, color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const PLATFORM_BADGES = {
  live: { label: 'Live on NotaryChain', color: 'bg-coral-500 text-white' },
  abstract_published: { label: 'Abstract published', color: 'bg-cream-200 text-navy-900 border border-slate-300' },
};

export default function StateComparison() {
  const [states, setStates] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/compliance/states/comparison`)
      .then(r => { setStates(r.data.states); setMatrix(r.data.matrix); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-cream-100 flex items-center justify-center"><Loader2 className="w-8 h-8 text-coral-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-cream-100" data-testid="state-comparison-page">
      <Seo
        path="/compliance/states"
        title="Remote Online Notarization by State — Compliance Matrix"
        description="Compare Remote Online Notarization (RON) requirements across U.S. states. NotaryChain supports Florida, Texas, New York, California, and Virginia with state-specific compliance gates."
        keywords="remote online notarization by state, RON states, online notary laws, state notary compliance, RON requirements"
        jsonLd={graph(
          faqSchema([
            { q: 'Which states allow remote online notarization?', a: 'Most U.S. states authorize RON. NotaryChain supports Florida, Texas, New York, California, and Virginia with state-specific compliance gates, and is expanding to additional states.' },
            { q: 'Is a remotely notarized document valid in other states?', a: 'Generally yes. Under interstate recognition principles, a document validly notarized via RON in one state is typically recognized in others, though specific acts such as certain real-estate or testamentary documents can have state-specific rules.' },
          ]),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'State Compliance' }]),
        )}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </Link>
          <Link to="/pricing" className="text-sm text-slate-600 hover:text-navy-900">Pricing</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-cream-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="inline-flex items-center gap-2 bg-coral-50 border border-coral-200 text-coral-700 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-6">
            <MapPin className="w-3.5 h-3.5" /> Compliance-as-a-Service
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-navy-900 tracking-tight mb-6 leading-[1.05] max-w-3xl">
            Multi-state RON compliance,<br />distilled to <span className="text-coral-600 italic">one matrix</span>.
          </h1>
          <p className="text-lg text-slate-600 mb-2 max-w-2xl leading-relaxed">
            Each US state writes its own Remote Online Notarization statute. We've read all of them so you don't have to. Pick a state below for the full compliance abstract.
          </p>
          <p className="text-[12px] text-slate-500 max-w-2xl">
            Abstracts are compliance summaries, not legal advice. Always cross-reference the source statute before producing legal instruments.
          </p>
        </div>
      </section>

      {/* State cards */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-serif text-4xl text-navy-900 mb-8">Supported states</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="state-cards">
          {states.map(s => {
            const statusBadge = STATUS_BADGES[s.ron_status] || STATUS_BADGES.proposed;
            const Icon = statusBadge.icon;
            const platformBadge = PLATFORM_BADGES[s.platform_status] || PLATFORM_BADGES.abstract_published;
            return (
              <Link
                key={s.code}
                to={`/compliance/states/${s.code}`}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-coral-300 hover:shadow-lg transition-all group"
                data-testid={`state-card-${s.code}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">{s.code}</div>
                    <h3 className="font-serif text-3xl text-navy-900">{s.name}</h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-coral-600 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${statusBadge.color}`}>
                    <Icon className="w-3 h-3" /> {statusBadge.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${platformBadge.color}`}>
                    {platformBadge.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">Effective {s.effective_date}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Comparison matrix */}
      {matrix && (
        <section className="border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <h2 className="font-serif text-4xl text-navy-900 mb-2">Gate-by-gate comparison</h2>
            <p className="text-slate-600 mb-8">Side-by-side requirements for the key RON compliance gates.</p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm" data-testid="comparison-matrix">
                <thead className="bg-cream-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-navy-900 sticky left-0 bg-cream-50 z-10">Gate</th>
                    {states.map(s => (
                      <th key={s.code} className="text-left px-5 py-3 font-semibold text-navy-900 min-w-[180px]">{s.code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matrix.map(row => (
                    <tr key={row.gate_id} className="hover:bg-cream-50/50">
                      <td className="px-5 py-3 font-medium text-navy-900 capitalize sticky left-0 bg-white">{row.gate_id.replace(/_/g, ' ')}</td>
                      {states.map(s => (
                        <td key={s.code} className="px-5 py-3 text-[12px] text-slate-700 align-top">
                          {row.states[s.code] || <span className="text-slate-400">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-slate-200 bg-navy-900 text-cream-100">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-3xl mb-2">Need a state we haven't published yet?</h2>
            <p className="text-slate-300 text-sm">Enterprise customers can commission a custom compliance abstract for any US state in 5 business days.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/pricing"><Button className="bg-coral-500 hover:bg-coral-600 text-white">View Enterprise plan</Button></Link>
            <a href="mailto:hello@notarychain.app"><Button variant="outline" className="border-cream-100 text-cream-100 hover:bg-white/10">Contact sales</Button></a>
          </div>
        </div>
      </section>
    </div>
  );
}
