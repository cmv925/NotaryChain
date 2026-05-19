import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Compass, AlertTriangle, CheckCircle2, Loader2, Clock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const scoreColor = (score) => {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { bar: 'bg-coral-500', text: 'text-coral-700', bg: 'bg-coral-50', border: 'border-coral-200' };
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const ms = new Date(iso).getTime() - Date.now();
    const days = Math.round(ms / 86400000);
    if (days <= 0) return 'expired';
    if (days === 1) return 'expires in 1 day';
    return `expires in ${days} days`;
  } catch (_e) { return ''; }
};

export default function CompliancePublicSnapshot() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/compliance/snapshots/${token}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) {
          const code = e?.response?.status;
          setError(code === 410 ? 'This snapshot has expired.' : code === 404 ? 'Snapshot not found.' : 'Unable to load snapshot');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6" data-testid="snapshot-error">
        <div className="max-w-md bg-white border border-slate-200 rounded-lg p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-coral-600 mx-auto mb-3" />
          <h2 className="font-serif text-2xl text-navy-900 mb-1">Snapshot unavailable</h2>
          <p className="text-slate-600 text-sm mb-5">{error}</p>
          <Link to="/" className="text-coral-600 text-sm font-semibold hover:underline">Visit NotaryChain →</Link>
        </div>
      </div>
    );
  }

  const overall = scoreColor(data.overall_score);

  return (
    <div className="min-h-screen bg-cream-100" data-testid="snapshot-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </Link>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Compliance Snapshot</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero card */}
        <div className="bg-white border border-slate-200 rounded-lg p-8 mb-8" data-testid="snapshot-hero">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-coral-600" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold">Shared by {data.owner_email_masked || 'NotaryChain user'}</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-navy-900 tracking-tight mb-2">
            <span className={overall.text}>{data.overall_score}%</span> seal-ready
          </h1>
          <p className="text-slate-600 text-sm mb-6">
            {data.total_ready} of {data.total_open} active ceremonies pass their state-specific pre-seal gates right now.
          </p>
          {data.note && (
            <div className="bg-cream-200/60 border border-slate-200 rounded-md p-4 mb-6" data-testid="snapshot-note">
              <p className="text-navy-900 text-sm leading-relaxed">{data.note}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {fmtRelative(data.expires_at)}</span>
            <span>·</span>
            <span>Generated {new Date(data.created_at).toLocaleString()}</span>
            <span>·</span>
            <span data-testid="snapshot-view-count">{data.view_count ?? 0} view{(data.view_count ?? 0) === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Per-state breakdown */}
        <h2 className="font-serif text-2xl text-navy-900 mb-4">By Jurisdiction</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-10" data-testid="snapshot-states">
          {data.states.map((s) => {
            const c = scoreColor(s.score);
            return (
              <div key={s.state_code} className={`border ${c.border} ${c.bg} rounded-md p-4`} data-testid={`snapshot-state-${s.state_code}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-navy-900 font-bold text-lg tracking-wider">{s.state_code}</span>
                    <span className="ml-2 text-[11px] text-slate-500">{s.ready_count} of {s.open_count} ready</span>
                  </div>
                  <span className={`text-2xl font-light ${c.text}`}>{s.score}%</span>
                </div>
                <div className="h-2 bg-white/70 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${c.bar}`} style={{ width: `${s.score}%` }} />
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  {s.ceremonies.slice(0, 3).map((cer, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      {cer.ready
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        : <AlertTriangle className="w-3 h-3 text-coral-600" />}
                      <span className="capitalize">{(cer.document_type || 'ceremony').replace(/_/g, ' ')}</span>
                      {!cer.ready && cer.failing_gates?.length > 0 && (
                        <span className="text-slate-500">— missing {cer.failing_gates.slice(0, 2).join(', ')}{cer.failing_gates.length > 2 ? '…' : ''}</span>
                      )}
                    </div>
                  ))}
                  {s.ceremonies.length > 3 && (
                    <div className="text-slate-500 italic">+ {s.ceremonies.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top blockers */}
        {data.nudges?.length > 0 && (
          <>
            <h2 className="font-serif text-2xl text-navy-900 mb-4">Top blockers</h2>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-10" data-testid="snapshot-nudges">
              <ul className="divide-y divide-slate-200">
                {data.nudges.map((n, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-coral-50 border border-coral-200 flex-shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-coral-600" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold tracking-wider text-coral-700 uppercase">{n.state_code}</span>
                        {n.document_type && (
                          <>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[11px] text-slate-600 capitalize">{n.document_type.replace(/_/g, ' ')}</span>
                          </>
                        )}
                      </div>
                      <p className="text-navy-900 text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-slate-500 text-[12px] mt-0.5 leading-snug">{n.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* CTA */}
        <div className="bg-navy-900 text-cream-100 rounded-lg p-8 text-center" data-testid="snapshot-cta">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cream-200/70 font-semibold mb-2">Powered by NotaryChain</p>
          <h3 className="font-serif text-2xl mb-2">Pre-seal compliance, automated.</h3>
          <p className="text-cream-200/80 text-sm mb-5 max-w-xl mx-auto">
            Every NotaryChain ceremony runs through state-specific pre-seal gate evaluators for FL, TX, NY, CA, and VA before it can be sealed on the Hedera ledger.
          </p>
          <Link
            to="/compliance/states"
            className="inline-block bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold px-6 py-2.5 rounded transition-colors"
            data-testid="snapshot-cta-states-link"
          >
            See full state compliance matrix →
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 text-[11px] text-slate-500 text-center">
          This snapshot is a read-only summary scrubbed of document names and identifiers. {fmtRelative(data.expires_at)}.
        </div>
      </footer>
    </div>
  );
}
