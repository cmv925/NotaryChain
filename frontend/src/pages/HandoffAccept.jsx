import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Loader2, CheckCircle, AlertTriangle, Clock, Shield, Home, Key, Award, FileText, Banknote, Briefcase, Vault, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ASSET_ICONS = {
  deed: Home, title: Key, ip: Award, will: FileText,
  custody: Shield, financial: Banknote, license: Briefcase,
  contract: FileText, other: Vault,
};

export default function HandoffAccept() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`${API}/api/salv/handoff/${token}`)
      .then(async r => {
        let body = null;
        try { body = await r.clone().json(); } catch { /* ignore */ }
        if (!r.ok) {
          const detail = (body && body.detail) || (r.status === 404 ? 'Invalid or unknown handoff token' : `HTTP ${r.status}`);
          throw new Error(detail);
        }
        return body;
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/salv/handoff/${token}/accept`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Accept failed');
      setAccepted(body);
      toast.success(`Share of ${body.share_percent}% accepted`);
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Shell>
        <Center>
          <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading handoff…</p>
        </Center>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-gold-500/30 max-w-md mx-auto" data-testid="handoff-error">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-coral-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-coral-600 mb-1">Invalid handoff link</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data?.status === 'expired') {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-gold-500/30 max-w-md mx-auto" data-testid="handoff-expired">
          <CardContent className="p-8 text-center">
            <Clock className="w-10 h-10 text-coral-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-coral-600 mb-1">Link expired</h2>
            <p className="text-sm text-slate-600">This handoff link expired on {fmtDate(data.expires_at)}. Contact the asset owner to re-issue.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data?.status === 'claimed' || accepted) {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-coral-200 max-w-md mx-auto" data-testid="handoff-claimed">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-coral-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-coral-700 mb-1">Handoff accepted</h2>
            <p className="text-sm text-slate-600 mb-4">Your share has been recorded on NotaryChain. The asset owner has been notified.</p>
            <Link to="/" className="text-coral-600 text-xs hover:underline">Back to NotaryChain →</Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const a = data.asset || {};
  const b = data.beneficiary || {};
  const Icon = ASSET_ICONS[a.asset_type] || Vault;

  return (
    <Shell>
      <div className="max-w-xl mx-auto" data-testid="handoff-active">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300 text-[10px] uppercase tracking-[0.25em] font-bold">Beneficiary Handoff</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Hello{b.name ? `, ${b.name}` : ''}.</h1>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            {data.owner?.name || 'A NotaryChain user'} has named you as a beneficiary on the asset below.
            Review the details and accept to record your share on the blockchain.
          </p>
        </div>

        <Card className="bg-white border-slate-200 mb-4" data-testid="handoff-asset-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-coral-500/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-coral-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{a.asset_type || '—'}</p>
                <h2 className="text-xl font-bold text-navy-900 truncate">{a.title}</h2>
                {a.description && <p className="text-xs text-slate-600 mt-1">{a.description}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {a.value_estimate_usd && <Row label="Estimated value" value={`$${a.value_estimate_usd.toLocaleString()}`} />}
              {a.jurisdiction && <Row label="Jurisdiction" value={a.jurisdiction} />}
              {a.handoff_started_at && <Row label="Handoff started" value={fmtDate(a.handoff_started_at)} />}
              {a.blockchain_seal?.transaction_id && (
                <Row label="Hedera tx" value={(
                  <a href={a.blockchain_seal.explorer_url} target="_blank" rel="noreferrer" className="text-coral-600 hover:underline inline-flex items-center gap-1">
                    {a.blockchain_seal.transaction_id.slice(0, 14)}… <ExternalLink className="w-3 h-3" />
                  </a>
                )} />
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/5 border-rose-500/30 mb-6" data-testid="handoff-share-card">
          <CardContent className="p-6 text-center">
            <Heart className="w-7 h-7 text-rose-400 mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-rose-300 font-bold">Your share</p>
            <p className="text-5xl font-bold text-navy-900 my-2">{(b.share_percent || 0).toFixed(0)}%</p>
            {b.relationship && <p className="text-xs text-slate-600">Relationship: {b.relationship}</p>}
            <p className="text-xs text-slate-500 mt-2">Token expires {fmtDate(data.expires_at)}</p>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-center">
          <Link to="/" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center justify-center px-4 py-2">
            Decline & exit
          </Link>
          <Button
            onClick={accept}
            disabled={submitting}
            className="bg-coral-500 hover:bg-coral-500 text-navy-900 px-6 h-11"
            data-testid="accept-handoff-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Accept ${(b.share_percent || 0).toFixed(0)}% share`}
          </Button>
        </div>

        <p className="text-[10px] text-slate-600 text-center mt-8 max-w-sm mx-auto">
          By accepting, you agree this share is recorded on NotaryChain and may be referenced
          in any future legal proceedings around the asset's transfer.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="handoff-page">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <Vault className="w-4 h-4 text-coral-600" />
          <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">NotaryChain Asset Vault</span>
        </div>
      </div>
      <div className="px-6 py-12">{children}</div>
    </div>
  );
}

function Center({ children }) {
  return <div className="text-center py-16">{children}</div>;
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-slate-200 mt-0.5">{value}</dd>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}
