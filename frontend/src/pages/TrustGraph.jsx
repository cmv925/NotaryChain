import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Network, Shield, ChevronLeft, CheckCircle, AlertTriangle, Loader2, Hash, Calendar, ExternalLink, Copy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TrustGraph() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setGraph(null);
    fetch(`${API}/api/trustlayer/trust-graph/${userId}`)
      .then(async r => {
        let body = null;
        try { body = await r.clone().json(); } catch { /* ignore */ }
        if (!r.ok) {
          const detail = (body && body.detail) || (r.status === 404 ? 'Trust graph not found' : `HTTP ${r.status}`);
          throw new Error(detail);
        }
        return body;
      })
      .then(d => { if (!cancelled) setGraph(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="trust-graph-loading">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading trust graph…</p>
        </div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="min-h-screen bg-slate-950 text-white" data-testid="trust-graph-not-found">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link to="/trustlayer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-6">
            <ChevronLeft className="w-4 h-4" /> Back to TrustLayer
          </Link>
          <Card className="bg-amber-500/5 border-amber-500/30">
            <CardContent className="p-10 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-3" />
              <h2 className="text-2xl font-bold text-amber-400 mb-1">User Not Found</h2>
              <p className="text-sm text-slate-400">{error || 'No trust graph for this user_id.'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const score = graph.trust_score || 0;
  const tier = score >= 80 ? { label: 'TRUSTED', color: '#10b981' } :
               score >= 50 ? { label: 'VERIFIED', color: '#0ea5e9' } :
               score >= 20 ? { label: 'EMERGING', color: '#f59e0b' } :
                              { label: 'UNVERIFIED', color: '#64748b' };

  const copy = (txt) => navigator.clipboard.writeText(txt).then(() => toast.success('Copied'));

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="trust-graph-page">
      <div className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link to="/trustlayer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white" data-testid="back-to-trustlayer">
            <ChevronLeft className="w-4 h-4" /> Back to TrustLayer
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-violet-950/20 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Score ring */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8"/>
                <circle
                  cx="50" cy="50" r="44" fill="none"
                  stroke={tier.color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 276.46} 276.46`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" data-testid="trust-score-number">{score}</span>
                <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Network className="w-4 h-4 text-violet-400" />
                <span className="text-violet-400 text-[10px] uppercase tracking-[0.25em] font-bold">Federated Trust Graph</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 truncate" data-testid="subject-name">{graph.subject?.name || '—'}</h1>
              <button onClick={() => copy(graph.subject?.user_id)} className="font-mono text-[11px] text-slate-500 hover:text-white inline-flex items-center gap-1" data-testid="copy-user-id">
                <Hash className="w-3 h-3" /> {graph.subject?.user_id} <Copy className="w-3 h-3" />
              </button>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <Pill label="Active attestations" value={graph.attestations_active} />
                <Pill label="Unique partners" value={graph.unique_partners} />
                <Pill label="Total" value={graph.attestations_total} />
                {graph.living_identity_tier && (
                  <Pill label="Living Identity" value={graph.living_identity_tier} accent />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attestation list */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Attestations ({graph.attestations.length})</h2>
        {graph.attestations.length === 0 ? (
          <Card className="bg-slate-900/40 border-dashed border-slate-700" data-testid="no-attestations">
            <CardContent className="p-10 text-center">
              <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold mb-1">No attestations yet</h3>
              <p className="text-xs text-slate-500">When trust partners issue attestations about this user, they’ll appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="attestations-list">
            {graph.attestations.map(a => (
              <Card key={a.attestation_id} className={`bg-slate-900/60 border ${a.active ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`} data-testid={`attestation-${a.attestation_id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-shrink-0">
                      {a.active ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold text-white">{a.partner_name}</span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-bold">{a.claim_type}</span>
                        {a.claim_value && <span className="text-xs text-slate-300">{a.claim_value}</span>}
                        {!a.active && (
                          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">{a.revoked ? 'revoked' : 'expired'}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(a.signed_at)}</span>
                        {a.expires_at && <span>expires {fmtDate(a.expires_at)}</span>}
                        {a.evidence_url && (
                          <a href={a.evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                            evidence <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 break-all sm:text-right">{a.attestation_id}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-[11px] text-slate-500">
          Computed at {fmtDate(graph.computed_at)} · <a className="text-violet-400 hover:underline" href={`${API}/api/trustlayer/trust-graph/${graph.subject?.user_id}`} target="_blank" rel="noreferrer">JSON</a>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, accent }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] ${accent ? 'bg-violet-500/15 text-violet-300' : 'bg-slate-800/60 text-slate-300'}`}>
      <span className="text-slate-500">{label}</span>
      <b className="text-white">{value}</b>
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
