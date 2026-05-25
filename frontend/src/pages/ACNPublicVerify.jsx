import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { Globe2, Anchor, ShieldCheck, AlertTriangle, ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/acn/public`;

/**
 * Cross-Border Verification Passport — public, no-auth view of a sealed ACN
 * packet. Anyone with the packet ID (or QR scan) can verify every
 * jurisdictional proof + the Hedera anchor.
 */
export default function ACNPublicVerify() {
  const { packetId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/verify/${packetId}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || 'Packet not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [packetId]);

  // Build a QR code via a public-domain SVG endpoint (qrserver.com)
  // — fallback graphic encoding the verifier URL.
  const verifierUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/acn/verify/${packetId}`
    : `/acn/verify/${packetId}`;
  const qrSrc = useMemo(() => (
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifierUrl)}`
  ), [verifierUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center text-slate-300">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading verification passport…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <Card className="bg-navy-800 border-red-500/40 max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-2" />
            <h2 className="text-white font-bold mb-1">Packet not found</h2>
            <p className="text-slate-400 text-sm">{error}</p>
            <p className="text-slate-500 text-xs mt-3 font-mono">{packetId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const proofs = data.proofs || [];
  const sealedCount = proofs.filter(p => p.hcs?.submitted).length;

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-cyan-950 via-navy-900 to-navy-900 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-cyan-300 mb-2 flex items-center gap-2">
            <Globe2 className="w-3.5 h-3.5" /> Cross-Border Verification Passport
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl mb-3">
            This document is notarised across <span className="text-cyan-300">{data.detected_jurisdictions?.length || 0}</span> jurisdictions.
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Pill tone={data.status === 'sealed' ? 'emerald' : data.status === 'partially_sealed' ? 'amber' : 'slate'}>
              {data.status}
            </Pill>
            <Pill tone="cyan">{sealedCount}/{proofs.length} sealed on Hedera</Pill>
            {data.needs_reseal && <Pill tone="red"><AlertTriangle className="w-3 h-3 mr-1 inline" /> Needs re-seal</Pill>}
            {data.sealed_at && (
              <span className="text-slate-400 text-xs ml-2">
                Sealed {new Date(data.sealed_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-500 truncate">packet: {packetId}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {proofs.length === 0 ? (
            <Card className="bg-navy-800 border-slate-700"><CardContent className="p-8 text-center text-slate-400">
              No proofs sealed yet for this packet.
            </CardContent></Card>
          ) : proofs.map(p => (
            <Card key={p.id} className="bg-navy-800 border-slate-700" data-testid={`acn-public-proof-${p.jurisdiction_code}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.hcs?.submitted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-white">{p.jurisdiction_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.jurisdiction_code} · sealed {p.sealed_at?.slice(0, 19)}</p>
                  </div>
                  {p.hcs?.submitted ? (
                    <Pill tone="emerald"><Anchor className="w-3 h-3 mr-1 inline" /> Hedera HCS</Pill>
                  ) : (
                    <Pill tone="amber">HCS pending</Pill>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 mt-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Certificate sha256</p>
                    <p className="text-cyan-200 break-all">{p.certificate_sha256}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Rule version hash</p>
                    <p className="text-cyan-200 break-all">{p.rule_version_hash?.slice(0, 32)}…</p>
                  </div>
                  {p.hcs?.transaction_id && (
                    <div className="sm:col-span-2">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Hedera transaction</p>
                      <p className="text-emerald-300 break-all">{p.hcs.transaction_id}</p>
                    </div>
                  )}
                  {p.hcs?.explorer_url && (
                    <a href={p.hcs.explorer_url} target="_blank" rel="noreferrer"
                       className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline sm:col-span-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View on HashScan
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sidebar — QR + provenance */}
        <aside className="space-y-4">
          <Card className="bg-white text-navy-900">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 text-center">Verification QR</p>
              <img src={qrSrc} alt="QR code" className="w-full max-w-[180px] mx-auto" />
              <p className="text-[10px] text-slate-500 mt-2 text-center font-mono break-all">{verifierUrl}</p>
            </CardContent>
          </Card>
          <Card className="bg-navy-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Source jurisdiction</p>
              <p className="text-cyan-300 flex items-center gap-1 text-sm font-bold"><MapPin className="w-3 h-3" /> {data.source_jurisdiction}</p>
            </CardContent>
          </Card>
          {data.nft && (
            <Card className="bg-gradient-to-br from-indigo-950 to-navy-800 border-cyan-500/30" data-testid="acn-public-nft">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold mb-2 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Passport NFT
                </p>
                <p className="text-white text-sm font-mono">{data.nft.token_id}</p>
                <p className="text-slate-400 text-[11px] font-mono">serial #{data.nft.serial_number}</p>
                <p className="text-[9px] text-slate-500 mt-1 font-bold uppercase tracking-wider">mode: {data.nft.mode}</p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-navy-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Detected jurisdictions</p>
              <div className="flex flex-wrap gap-1">
                {(data.detected_jurisdictions || []).map(c => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">{c}</span>
                ))}
              </div>
            </CardContent>
          </Card>
          <Link to="/" className="block text-center text-xs text-slate-500 hover:text-cyan-300 mt-4">
            Powered by NotaryChain — ACN
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Pill({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
    amber: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    red: 'bg-red-500/20 text-red-200 border-red-500/40',
    slate: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}
