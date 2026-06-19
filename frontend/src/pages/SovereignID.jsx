import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../hooks/use-toast';
import { Seo } from '../components/Seo';
import {
  ShieldCheck, Fingerprint, Loader2, BadgeCheck, ExternalLink,
  Lock, Sparkles, Copy, ArrowLeft, Hexagon,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE = process.env.REACT_APP_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const TIER_STYLE = {
  sovereign: 'from-amber-300 to-yellow-500 text-black',
  verified: 'from-emerald-300 to-emerald-500 text-black',
  provisional: 'from-sky-300 to-sky-500 text-black',
  unverified: 'from-slate-400 to-slate-500 text-black',
};

export default function SovereignID() {
  const { token } = useAuth();
  const [state, setState] = useState({ loading: true, minted: false, identityVerified: false, card: null });
  const [minting, setMinting] = useState(false);

  const headers = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/sovereign/me`, headers);
      setState({ loading: false, minted: res.data.minted, identityVerified: res.data.identity_verified, card: res.data.card });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Poll once after mint so the HCS anchor (background task) shows when ready.
  useEffect(() => {
    if (state.minted && state.card && state.card.anchor_status === 'pending') {
      const t = setTimeout(load, 6000);
      return () => clearTimeout(t);
    }
  }, [state.minted, state.card, load]);

  const mint = async () => {
    setMinting(true);
    try {
      const res = await axios.post(`${API}/sovereign/mint`, {}, headers);
      setState((s) => ({ ...s, minted: true, card: res.data.card }));
      toast({ title: 'Sovereign ID minted', description: 'Your identity credential is now anchored on-chain.' });
    } catch (e) {
      toast({ title: 'Could not mint', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setMinting(false);
    }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center" data-testid="sovereign-loading">
        <Loader2 className="w-8 h-8 text-coral-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0d1426] to-[#0a0e1a] text-white px-4 py-10" data-testid="sovereign-id-page">
      <Seo path="/sovereign-id" title="Sovereign ID — Your On-Chain Identity Credential" description="A blockchain-sealed, Ed25519-attested identity credential." noindex />
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors" data-testid="back-to-dashboard">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Hexagon className="w-7 h-7 text-coral-400" />
          <h1 className="text-3xl font-semibold tracking-tight">Sovereign ID</h1>
        </div>
        <p className="text-slate-400 mb-10 max-w-lg">
          Your portable, tamper-evident identity credential — an Ed25519-signed attestation minted as a Hedera NFT and anchored on a public ledger.
        </p>

        {!state.minted && !state.identityVerified && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center" data-testid="sovereign-locked">
            <Lock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">Verify your identity to claim it</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Your Sovereign ID is an earned credential. Complete identity verification first, then mint your card.
            </p>
            <Link to="/kba-test" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-sm font-medium transition-colors" data-testid="start-verification-btn">
              <ShieldCheck className="w-4 h-4" /> Start verification
            </Link>
          </div>
        )}

        {!state.minted && state.identityVerified && (
          <div className="rounded-2xl border border-coral-500/30 bg-gradient-to-br from-coral-500/10 to-transparent p-8 text-center" data-testid="sovereign-claim">
            <Sparkles className="w-10 h-10 text-coral-400 mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">You're verified — claim your Sovereign ID</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Mint a one-of-one identity NFT, cryptographically signed and anchored on Hedera. This is yours forever.
            </p>
            <button onClick={mint} disabled={minting} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-coral-500 hover:bg-coral-600 disabled:opacity-60 text-white font-medium transition-colors" data-testid="mint-sovereign-btn">
              {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hexagon className="w-4 h-4" />}
              {minting ? 'Minting…' : 'Mint Sovereign ID'}
            </button>
          </div>
        )}

        {state.minted && state.card && (
          <BlackCard card={state.card} site={SITE} onCopy={copy} data-testid="sovereign-card" />
        )}
      </div>
    </div>
  );
}

function BlackCard({ card, site, onCopy }) {
  const tier = card.trust_tier || 'Verified';
  const tierClass = TIER_STYLE[String(tier).toLowerCase()] || TIER_STYLE.verified;
  const verifyUrl = `${site}/sovereign/verify/${card.sovereign_id}`;
  const nft = card.nft || {};

  return (
    <div data-testid="sovereign-card">
      {/* The card */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
           style={{ background: 'radial-gradient(120% 120% at 0% 0%, #1a2340 0%, #0b1020 55%, #05070f 100%)' }}>
        {/* holographic sheen */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,124,92,0.25) 45%, rgba(96,165,250,0.2) 55%, transparent 70%)' }} />
        <div className="relative p-7">
          <div className="flex items-start justify-between mb-10">
            <div className="flex items-center gap-2">
              <Hexagon className="w-6 h-6 text-coral-400" />
              <span className="text-xs uppercase tracking-[0.25em] text-slate-300">NotaryChain</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold capitalize bg-gradient-to-r ${tierClass}`} data-testid="card-tier">
              <BadgeCheck className="w-3.5 h-3.5" /> {tier}
            </span>
          </div>

          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">Sovereign Identity</p>
            <p className="text-2xl font-semibold tracking-wide" data-testid="card-holder">{card.holder_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Token</p>
              <p className="font-mono text-slate-200" data-testid="card-token">{nft.token_id} · #{nft.serial_number}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Trust Score</p>
              <p className="font-mono text-slate-200" data-testid="card-score">{card.trust_score}/100</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                <Fingerprint className="w-3 h-3" /> Ed25519 Key
              </p>
              <p className="font-mono text-xs text-slate-300 break-all" data-testid="card-fingerprint">{card.key_fingerprint}</p>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 bg-white p-1.5 rounded-lg">
            <QRCodeSVG value={verifyUrl} size={72} level="M" data-testid="card-qr" />
          </div>
          <p className="mt-6 text-[10px] text-slate-500">Issued {new Date(card.issued_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Provenance / actions */}
      <div className="mt-6 space-y-3">
        <Row label="Status" testid="card-anchor-status">
          {card.anchor_status === 'anchored' ? (
            <span className="text-emerald-400 inline-flex items-center gap-1"><BadgeCheck className="w-4 h-4" /> Anchored on Hedera</span>
          ) : card.anchor_status === 'pending' ? (
            <span className="text-amber-400 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Anchoring…</span>
          ) : (
            <span className="text-slate-400">On-chain anchor unavailable</span>
          )}
        </Row>
        {card.anchor?.explorer_url && (
          <Row label="Ledger">
            <a href={card.anchor.explorer_url} target="_blank" rel="noreferrer" className="text-coral-400 hover:text-coral-300 inline-flex items-center gap-1 text-sm" data-testid="anchor-explorer-link">
              View HCS message <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Row>
        )}
        {nft.explorer_url && (
          <Row label="NFT">
            <a href={nft.explorer_url} target="_blank" rel="noreferrer" className="text-coral-400 hover:text-coral-300 inline-flex items-center gap-1 text-sm" data-testid="nft-explorer-link">
              View on HashScan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Row>
        )}
        <Row label="Public verify">
          <button onClick={() => onCopy(verifyUrl, 'Verify link')} className="text-slate-300 hover:text-white inline-flex items-center gap-1 text-sm" data-testid="copy-verify-link">
            {verifyUrl.replace(/^https?:\/\//, '')} <Copy className="w-3.5 h-3.5" />
          </button>
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children, testid }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3" data-testid={testid}>
      <span className="text-xs uppercase tracking-widest text-slate-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}
