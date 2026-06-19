import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Seo } from '../components/Seo';
import {
  ShieldCheck, ShieldX, Loader2, Fingerprint, BadgeCheck,
  ExternalLink, Hexagon,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SovereignVerify() {
  const { sovereignId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/sovereign/verify/${sovereignId}`)
      .then((r) => setResult(r.data))
      .catch(() => setResult({ found: false, valid: false, reason: 'error' }))
      .finally(() => setLoading(false));
  }, [sovereignId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0d1426] to-[#0a0e1a] text-white px-4 py-12" data-testid="sovereign-verify-page">
      <Seo path={`/sovereign/verify/${sovereignId}`} title="Verify Sovereign ID" description="Cryptographically verify a NotaryChain Sovereign ID identity credential." noindex />
      <div className="max-w-lg mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 text-slate-400 hover:text-white transition-colors">
          <Hexagon className="w-5 h-5 text-coral-400" />
          <span className="text-xs uppercase tracking-[0.25em]">NotaryChain</span>
        </Link>

        {loading && (
          <div className="flex flex-col items-center py-20" data-testid="verify-loading">
            <Loader2 className="w-8 h-8 text-coral-400 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Verifying signature…</p>
          </div>
        )}

        {!loading && result && !result.found && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center" data-testid="verify-notfound">
            <ShieldX className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">No credential found</h1>
            <p className="text-slate-400 text-sm">This Sovereign ID does not exist or has been revoked.</p>
          </div>
        )}

        {!loading && result && result.found && (
          <div data-testid="verify-result">
            <div className={`rounded-2xl border p-6 mb-6 text-center ${result.valid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              {result.valid ? (
                <>
                  <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" data-testid="verify-valid-icon" />
                  <h1 className="text-xl font-semibold text-emerald-300">Signature Valid</h1>
                  <p className="text-slate-400 text-sm mt-1">This identity credential is authentic and untampered.</p>
                </>
              ) : (
                <>
                  <ShieldX className="w-12 h-12 text-red-400 mx-auto mb-3" data-testid="verify-invalid-icon" />
                  <h1 className="text-xl font-semibold text-red-300">Verification Failed</h1>
                  <p className="text-slate-400 text-sm mt-1">Reason: {result.reason || 'invalid'}</p>
                </>
              )}
            </div>

            {result.card && (
              <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10">
                <Field label="Holder" value={result.card.holder_name} testid="verify-holder" />
                <Field label="Trust Tier" value={`${result.card.trust_tier} · ${result.card.trust_score}/100`} icon={<BadgeCheck className="w-4 h-4 text-emerald-400" />} />
                <Field label="NFT" value={`${result.card.nft?.token_id} · #${result.card.nft?.serial_number}`} mono />
                <Field label="Ed25519 Key" value={result.card.key_fingerprint} mono icon={<Fingerprint className="w-4 h-4 text-coral-400" />} />
                <Field label="Issued" value={new Date(result.card.issued_at).toLocaleString()} />
                {result.card.anchor?.explorer_url && (
                  <div className="px-5 py-4 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-slate-500">On-chain</span>
                    <a href={result.card.anchor.explorer_url} target="_blank" rel="noreferrer" className="text-coral-400 hover:text-coral-300 inline-flex items-center gap-1 text-sm" data-testid="verify-explorer-link">
                      Hedera ledger <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
            <p className="text-center text-xs text-slate-600 mt-6">Verified by NotaryChain · Ed25519 + Hedera</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono, icon, testid }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4" data-testid={testid}>
      <span className="text-xs uppercase tracking-widest text-slate-500 shrink-0">{label}</span>
      <span className={`text-sm text-slate-200 text-right flex items-center gap-1.5 ${mono ? 'font-mono break-all' : ''}`}>
        {icon}{value}
      </span>
    </div>
  );
}
