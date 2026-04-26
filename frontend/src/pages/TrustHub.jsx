import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Network, Vault, ArrowRight, Activity, Loader2, AlertTriangle, CheckCircle, ExternalLink, Copy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TrustHub() {
  const { user, token, isAuthenticated } = useAuth();
  const [identity, setIdentity] = useState(null);
  const [graph, setGraph] = useState(null);
  const [vault, setVault] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const safeFetch = async (url, useAuth = false) => {
      try {
        const r = await fetch(url, useAuth ? { headers } : {});
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    };
    const [li, tg, sv] = await Promise.all([
      safeFetch(`${API}/api/living-identity/me`, true),
      safeFetch(`${API}/api/trustlayer/trust-graph/${user.id}`, false),
      safeFetch(`${API}/api/salv/vault`, true),
    ]);
    setIdentity(li);
    setGraph(tg);
    setVault(sv);
    setLoading(false);
  }, [user, token]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="trust-hub-login-required">
        <Card className="bg-slate-900/60 border-slate-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Sign in required</h2>
            <p className="text-sm text-slate-400 mb-4">The Trust Hub is your private dashboard.</p>
            <Link to="/login"><Button className="bg-emerald-600 hover:bg-emerald-500">Sign in</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="trust-hub-loading">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const trustScore = graph?.trust_score || 0;
  const livingScore = identity?.current_trust_score ?? null;
  const attestations = graph?.attestations_active || 0;
  const partners = graph?.unique_partners || 0;
  const assetsCount = vault?.stats?.assets_count || 0;
  const assetsValue = vault?.stats?.total_estimated_value_usd || 0;
  const benefCount = vault?.stats?.beneficiaries_count || 0;
  const dms = vault?.dead_mans_switch;

  const tier = trustScore >= 80 ? { label: 'TRUSTED', color: '#10b981' } :
               trustScore >= 50 ? { label: 'VERIFIED', color: '#0ea5e9' } :
               trustScore >= 20 ? { label: 'EMERGING', color: '#f59e0b' } :
                                  { label: 'UNVERIFIED', color: '#64748b' };

  const copy = (txt) => navigator.clipboard.writeText(txt).then(() => toast.success('Copied'));
  const shareUrl = `${window.location.origin}/trust-graph/${user.id}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="trust-hub-page">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-violet-950/20 via-slate-950 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8"/>
                <circle
                  cx="50" cy="50" r="44" fill="none"
                  stroke={tier.color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(trustScore / 100) * 276.46} 276.46`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" data-testid="hub-trust-score">{trustScore}</span>
                <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-violet-400 text-[10px] uppercase tracking-[0.25em] font-bold">Personal Trust Hub</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{user.full_name || user.email}</h1>
              <p className="text-slate-400 text-sm max-w-2xl">
                Your federated trust score is the union of NotaryChain Living Identity, partner attestations,
                and assets under custody. Share your public profile or embed the badge anywhere.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button onClick={() => copy(shareUrl)} className="bg-slate-900/60 border border-slate-700 hover:border-violet-500/40 px-3 py-2 rounded text-xs font-mono text-slate-300 inline-flex items-center gap-2" data-testid="copy-share-link">
                  <Copy className="w-3 h-3" /> {shareUrl}
                </button>
                <Link to={`/trust-graph/${user.id}`}>
                  <Button size="sm" variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800">
                    Public profile <ExternalLink className="w-3 h-3 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Living Identity */}
        <PillarCard
          icon={Activity}
          color="sky"
          title="Living Identity"
          score={livingScore !== null ? `${livingScore}` : '—'}
          subtitle={identity?.trust_tier ? `Tier: ${identity.trust_tier}` : 'Not yet anchored'}
          to="/identity"
          ctaLabel={identity ? 'Refresh identity' : 'Set up identity'}
          empty={!identity}
          testId="hub-living-identity"
        >
          <Stat label="Drift events" value={identity?.drift_events_count ?? 0} />
          <Stat label="Snapshots" value={identity?.snapshots_count ?? 0} />
        </PillarCard>

        {/* TrustLayer */}
        <PillarCard
          icon={Network}
          color="violet"
          title="TrustLayer"
          score={`${attestations}`}
          subtitle="active attestations"
          to="/trustlayer"
          ctaLabel="Open TrustLayer"
          empty={attestations === 0}
          testId="hub-trustlayer"
        >
          <Stat label="Partners" value={partners} />
          <Stat label="Total" value={graph?.attestations_total ?? 0} />
        </PillarCard>

        {/* SALV */}
        <PillarCard
          icon={Vault}
          color="emerald"
          title="Asset Vault"
          score={`${assetsCount}`}
          subtitle={`$${(assetsValue || 0).toLocaleString()} under custody`}
          to="/asset-vault"
          ctaLabel={assetsCount === 0 ? 'Add first asset' : 'Open vault'}
          empty={assetsCount === 0}
          testId="hub-vault"
        >
          <Stat label="Beneficiaries" value={benefCount} />
          <Stat label="DMS" value={dms?.status || '—'} accent={dms?.status === 'warning' ? 'amber' : dms?.status === 'triggered' ? 'red' : null} />
        </PillarCard>
      </div>

      {/* Recent attestations */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Recent activity</h2>
        {(!graph?.attestations || graph.attestations.length === 0) ? (
          <Card className="bg-slate-900/40 border-dashed border-slate-700">
            <CardContent className="p-8 text-center" data-testid="hub-no-activity">
              <Shield className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-3">No attestations yet. Add a high-value asset to your vault, or invite a verifier to TrustLayer.</p>
              <div className="flex gap-2 justify-center">
                <Link to="/asset-vault"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-500">Open vault</Button></Link>
                <Link to="/trustlayer"><Button size="sm" variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">TrustLayer</Button></Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="hub-recent-list">
            {graph.attestations.slice(0, 6).map(a => (
              <Card key={a.attestation_id} className={`bg-slate-900/60 border-slate-800 ${a.active ? '' : 'opacity-60'}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  {a.active ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-slate-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{a.partner_name}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-bold">{a.claim_type}</span>
                      {a.claim_value && <span className="text-xs text-slate-300">{a.claim_value}</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(a.signed_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PillarCard({ icon: Icon, color, title, score, subtitle, to, ctaLabel, empty, testId, children }) {
  const colors = {
    sky: { ring: 'border-sky-500/30', icon: 'text-sky-400', bg: 'bg-sky-500/10' },
    violet: { ring: 'border-violet-500/30', icon: 'text-violet-400', bg: 'bg-violet-500/10' },
    emerald: { ring: 'border-emerald-500/30', icon: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  }[color];
  return (
    <Card className={`bg-slate-900/60 ${colors.ring}`} data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{title}</p>
            <p className="text-3xl font-bold text-white">{score}</p>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-800">
          {children}
        </div>
        <Link to={to}>
          <Button size="sm" variant="outline" className="w-full bg-slate-800/40 border-slate-700 text-white hover:bg-slate-800">
            {ctaLabel} <ArrowRight className="w-3 h-3 ml-1.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }) {
  const cls = accent === 'amber' ? 'text-amber-400' : accent === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-base font-bold ${cls}`}>{value}</p>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
