import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { graph, faqSchema, howToSchema, breadcrumbSchema } from '../lib/seo';
import { Shield, FileText, Award, Search, CheckCircle, XCircle, Loader2, Upload, ExternalLink, Hash, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PublicVerify() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('document'); // 'document' | 'certificate' | 'notary'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [hashInput, setHashInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [notaryInput, setNotaryInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [badgeInfo, setBadgeInfo] = useState(null);

  // Auto-load badge info if /verify?badge=xxx
  const badgeId = searchParams.get('badge');
  useEffect(() => {
    if (!badgeId) return;
    fetch(`${API}/api/verify/badge/${badgeId}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setBadgeInfo)
      .catch(() => null);
  }, [badgeId]);

  const verifyByHash = async (hash) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/verify/document/${hash}`);
      const d = await r.json();
      setResult({ kind: 'document', data: d });
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const verifyByFile = useCallback(async (file) => {
    setLoading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/api/verify/document`, { method: 'POST', body: fd });
      const d = await r.json();
      setResult({ kind: 'document', data: d });
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  const verifyCert = async () => {
    if (!certInput) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/verify/certificate/${certInput.trim()}`);
      if (!r.ok) {
        setResult({ kind: 'certificate', data: { verified: false, certificate_id: certInput, message: 'Certificate not found' } });
      } else {
        setResult({ kind: 'certificate', data: await r.json() });
      }
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const verifyNotary = async () => {
    if (!notaryInput) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/verify/notary/${notaryInput.trim()}`);
      if (!r.ok) {
        setResult({ kind: 'notary', data: { verified: false, notary_id: notaryInput, message: 'Notary not found' } });
      } else {
        setResult({ kind: 'notary', data: await r.json() });
      }
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) verifyByFile(file);
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="public-verify-page">
      <Seo
        path="/verify"
        title="Verify a Notarized Document — Free Blockchain Verification"
        description="Instantly verify any NotaryChain document, certificate, or notary. Upload a file or paste its SHA-256 hash to confirm it's authentic and untampered on the Hedera blockchain — free, no account required."
        keywords="verify notarized document, blockchain document verification, check document authenticity, verify notary, tamper-evident verification"
        jsonLd={graph(
          faqSchema([
            { q: 'How do I verify a notarized document?', a: 'Upload the document or paste its SHA-256 hash at notarychain.app/verify. NotaryChain recomputes the hash and checks it against the Hedera public ledger. A match confirms the document is authentic and unaltered; any change is detected instantly. No account is required and verification is free.' },
            { q: 'Is document verification free?', a: 'Yes. Anyone can verify a NotaryChain document, certificate, or commissioned notary by hash or certificate ID at /verify with no account and no cost.' },
            { q: 'What does a blockchain seal prove?', a: 'It proves the exact document existed at the time of notarization and has not been altered since. The seal\u2019s cryptographic SHA-256 hash is permanently recorded on the Hedera Consensus Service.' },
          ]),
          howToSchema({
            name: 'How to verify a notarized document',
            steps: [
              { name: 'Open the verifier', text: 'Go to notarychain.app/verify.' },
              { name: 'Provide the document or hash', text: 'Upload the document file, paste its SHA-256 hash, or enter a certificate ID.' },
              { name: 'Read the result', text: 'NotaryChain checks the hash against the Hedera ledger and shows whether the document is authentic and untampered.' },
            ],
          }),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Verify' }]),
        )}
      />
      {/* Hero */}
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="text-coral-600 text-[11px] uppercase tracking-[0.25em] font-bold">NotaryChain Verify</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-navy-900 mb-2">Verify any document, certificate, or notary.</h1>
          <p className="text-slate-600 text-base max-w-2xl">Public, free, and instant. Every verification is sealed on the Hedera blockchain — tamper-proof and auditable forever.</p>
        </div>
      </div>

      {/* Badge info banner if /verify?badge=xxx */}
      {badgeInfo && (
        <div className="bg-coral-500/10 border-y border-coral-200 px-6 py-3" data-testid="badge-banner">
          <div className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
            <CheckCircle className="w-5 h-5 text-coral-600 flex-shrink-0" />
            <div>
              <span className="text-coral-600 font-bold">{badgeInfo.business_name}</span>
              <span className="text-navy-800"> · trusted by NotaryChain · </span>
              <span className="text-slate-500 font-mono text-xs">{badgeInfo.domain}</span>
            </div>
            <span className="ml-auto text-[11px] text-slate-500">Status: {badgeInfo.verified ? <span className="text-coral-600 font-semibold">verified</span> : <span className="text-coral-600 font-semibold">pending</span>}</span>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
          {[
            { k: 'document', label: 'Document', icon: FileText },
            { k: 'certificate', label: 'Certificate', icon: Award },
            { k: 'notary', label: 'Notary', icon: Shield },
          ].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setResult(null); }}
              className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${tab === t.k ? 'border-coral-300 text-coral-600 font-semibold' : 'border-transparent text-slate-600 hover:text-navy-900'}`}
              data-testid={`tab-${t.k}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* DOCUMENT TAB */}
        {tab === 'document' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="document-tab">
            <Card
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`bg-white border-2 border-dashed transition-colors cursor-pointer ${dragOver ? 'border-coral-500 bg-coral-50' : 'border-slate-300'}`}>
              <CardContent className="p-8 text-center">
                <Upload className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-coral-600' : 'text-slate-500'}`} />
                <h3 className="font-bold mb-2 text-navy-900">Drop a PDF here</h3>
                <p className="text-xs text-slate-500 mb-4">or</p>
                <label className="inline-block">
                  <input type="file" accept=".pdf,application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) verifyByFile(f); }} data-testid="document-file-input" />
                  <span className="bg-coral-500 hover:bg-coral-600 text-white px-4 py-2 rounded text-sm font-semibold cursor-pointer inline-block">Choose File</span>
                </label>
                <p className="text-[10px] text-slate-600 mt-3">Max 50 MB · We hash locally; document never leaves verification</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200">
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-3"><Hash className="w-5 h-5 text-slate-600" /><h3 className="font-bold text-navy-900">…or paste a hash</h3></div>
                <p className="text-xs text-slate-500 mb-3">Have the SHA256 hash already? Paste it below.</p>
                <Input
                  placeholder="64-character SHA256 hex..."
                  value={hashInput} onChange={(e) => setHashInput(e.target.value)}
                  className="bg-cream-200 border-slate-300 mb-3 font-mono text-xs"
                  data-testid="document-hash-input" />
                <Button onClick={() => verifyByHash(hashInput.trim())} disabled={hashInput.length !== 64 || loading}
                  className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="verify-hash-btn">
                  <Search className="w-4 h-4 mr-2" /> Verify Hash
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CERTIFICATE TAB */}
        {tab === 'certificate' && (
          <Card className="bg-white border border-slate-200" data-testid="certificate-tab">
            <CardContent className="p-8">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Award className="w-5 h-5 text-coral-600" /> Certificate ID Lookup</h3>
              <p className="text-xs text-slate-500 mb-4">Enter the certificate ID from the bottom of any NotaryChain certificate.</p>
              <div className="flex gap-2">
                <Input placeholder="Certificate ID..." value={certInput} onChange={(e) => setCertInput(e.target.value)}
                  className="bg-cream-200 border-slate-300 font-mono text-xs" data-testid="cert-input"
                  onKeyDown={(e) => e.key === 'Enter' && verifyCert()} />
                <Button onClick={verifyCert} disabled={!certInput || loading} className="bg-amber-600 hover:bg-coral-500" data-testid="verify-cert-btn">
                  <Search className="w-4 h-4 mr-2" /> Look Up
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NOTARY TAB */}
        {tab === 'notary' && (
          <Card className="bg-white border border-slate-200" data-testid="notary-tab">
            <CardContent className="p-8">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-coral-600" /> Notary Public Profile</h3>
              <p className="text-xs text-slate-500 mb-4">Look up a notary by their NotaryChain ID to see their bond, license, and sealing history.</p>
              <div className="flex gap-2">
                <Input placeholder="Notary ID..." value={notaryInput} onChange={(e) => setNotaryInput(e.target.value)}
                  className="bg-cream-200 border-slate-300 font-mono text-xs" data-testid="notary-input"
                  onKeyDown={(e) => e.key === 'Enter' && verifyNotary()} />
                <Button onClick={verifyNotary} disabled={!notaryInput || loading} className="bg-coral-500 hover:bg-coral-500" data-testid="verify-notary-btn">
                  <Search className="w-4 h-4 mr-2" /> Look Up
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Don’t have an ID? <a href="/notaries" className="text-coral-600 hover:underline" data-testid="browse-directory-link">Browse the public notary directory →</a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* RESULT */}
        {loading && (
          <div className="mt-8 text-center" data-testid="loading-state">
            <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Checking on-chain registry…</p>
          </div>
        )}

        {result && !loading && (
          <div className="mt-8" data-testid="verify-result">
            {result.kind === 'document' && <DocumentResult data={result.data} />}
            {result.kind === 'certificate' && <CertificateResult data={result.data} />}
            {result.kind === 'notary' && <NotaryResult data={result.data} />}
          </div>
        )}
      </div>

      {/* Footer with Trust Badge marketing */}
      <div className="border-t border-slate-200 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <Shield className="w-5 h-5 text-coral-600 mb-2" />
              <h4 className="font-bold mb-1">Why NotaryChain Verify?</h4>
              <p className="text-slate-500 text-xs leading-relaxed">Every notarization sealed on the Hedera blockchain. Free, public, and impossible to forge.</p>
            </div>
            <div>
              <Award className="w-5 h-5 text-coral-600 mb-2" />
              <h4 className="font-bold mb-1">Get a Trust Badge</h4>
              <p className="text-slate-500 text-xs leading-relaxed mb-2">Show visitors your business uses NotaryChain. Embed a verified badge on your site.</p>
              <a href="/trust-badge" className="text-coral-600 text-xs hover:underline" data-testid="trust-badge-cta">Get your badge →</a>
            </div>
            <div>
              <ExternalLink className="w-5 h-5 text-coral-600 mb-2" />
              <h4 className="font-bold mb-1">Need notarization?</h4>
              <p className="text-slate-500 text-xs leading-relaxed mb-2">AI-powered, blockchain-sealed, court-admissible.</p>
              <a href="/" className="text-coral-600 text-xs hover:underline">Start with NotaryChain →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════ Result Components ══════════ */

function DocumentResult({ data }) {
  if (!data.verified) {
    return (
      <Card className="bg-coral-500/5 border-gold-500/30" data-testid="document-not-found">
        <CardContent className="p-6 text-center">
          <XCircle className="w-12 h-12 mx-auto text-coral-600 mb-2" />
          <h3 className="text-xl font-bold text-coral-600 mb-1">Not Found</h3>
          <p className="text-sm text-slate-600 mb-2">{data.message || 'This document is not registered with NotaryChain.'}</p>
          {data.document_hash && <p className="text-[10px] text-slate-600 font-mono break-all">SHA256: {data.document_hash}</p>}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-coral-500/5 border-coral-200" data-testid="document-verified">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-10 h-10 text-coral-600" />
          <div>
            <h3 className="text-xl font-bold text-coral-600">Document Verified</h3>
            <p className="text-xs text-slate-600">Sealed on {data.network || 'Hedera'} mainnet</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {data.document_name && <Field label="Document" value={data.document_name} />}
          {data.filename && <Field label="Filename" value={data.filename} />}
          {data.sealed_at && <Field label="Sealed At" value={fmtDate(data.sealed_at)} />}
          {data.sealed_by && <Field label="Sealed By" value={data.sealed_by} />}
          {data.transaction_id && <Field label="Transaction" value={data.transaction_id} mono />}
          {data.topic_id && <Field label="Topic ID" value={data.topic_id} mono />}
        </div>
        {data.document_hash && (
          <div className="mt-3 pt-3 border-t border-slate-200 text-[10px] font-mono text-slate-500 break-all">
            SHA256: {data.document_hash}
          </div>
        )}
        {data.explorer_url && (
          <a href={data.explorer_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-coral-600 hover:text-coral-700" data-testid="explorer-link">
            View on Hedera <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function CertificateResult({ data }) {
  if (!data.verified) {
    return (
      <Card className="bg-coral-500/5 border-gold-500/30">
        <CardContent className="p-6 text-center">
          <XCircle className="w-12 h-12 mx-auto text-coral-600 mb-2" />
          <h3 className="text-xl font-bold text-coral-600">Certificate Not Found</h3>
          <p className="text-sm text-slate-600 mt-1">{data.message}</p>
        </CardContent>
      </Card>
    );
  }
  const statusConfig = {
    active: { color: '#10b981', icon: CheckCircle, label: 'ACTIVE' },
    expired: { color: '#f59e0b', icon: Clock, label: 'EXPIRED' },
    revoked: { color: '#ef4444', icon: AlertTriangle, label: 'REVOKED' },
  }[data.status] || { color: '#94a3b8', icon: Clock, label: 'UNKNOWN' };
  const StatusIcon = statusConfig.icon;
  return (
    <Card className="border" style={{ borderColor: `${statusConfig.color}33`, backgroundColor: `${statusConfig.color}0a` }}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <StatusIcon className="w-10 h-10" style={{ color: statusConfig.color }} />
          <div>
            <h3 className="text-xl font-bold" style={{ color: statusConfig.color }}>{statusConfig.label}</h3>
            <p className="text-xs text-slate-600">Certificate {data.certificate_id}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {data.document_name && <Field label="Document" value={data.document_name} />}
          {data.issued_at && <Field label="Issued" value={fmtDate(data.issued_at)} />}
          {data.expires_at && <Field label="Expires" value={fmtDate(data.expires_at)} />}
          {data.revoked_at && <Field label="Revoked" value={fmtDate(data.revoked_at)} />}
          {data.revocation_reason && <Field label="Reason" value={data.revocation_reason} />}
          {data.notary_id && <Field label="Notary" value={data.notary_id} mono />}
        </div>
      </CardContent>
    </Card>
  );
}

function NotaryResult({ data }) {
  if (!data.verified) {
    return (
      <Card className="bg-coral-500/5 border-gold-500/30">
        <CardContent className="p-6 text-center">
          <XCircle className="w-12 h-12 mx-auto text-coral-600 mb-2" />
          <h3 className="text-xl font-bold text-coral-600">Notary Not Found</h3>
        </CardContent>
      </Card>
    );
  }
  const statusColor = data.active ? '#10b981' : '#ef4444';
  return (
    <Card className="bg-coral-500/5 border-coral-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-10 h-10" style={{ color: statusColor }} />
          <div>
            <h3 className="text-xl font-bold" style={{ color: statusColor }}>{data.name}</h3>
            <p className="text-xs text-slate-600">{data.role} · {data.active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {data.license_number && <Field label="License" value={`${data.license_number} (${data.license_state || 'N/A'})`} />}
          {data.license_expiration && <Field label="License Expires" value={fmtDate(data.license_expiration)} />}
          {data.bond && (
            <>
              <Field label="Bond Amount" value={`$${(data.bond.amount_usd || 0).toLocaleString()}`} />
              <Field label="Bond Status" value={data.bond.status} />
              {data.bond.san_bond_id && <Field label="SAN Bond ID" value={data.bond.san_bond_id} mono />}
            </>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3 text-center">
          <Stat label="Total Seals" value={data.stats?.total_seals || 0} />
          <Stat label="Ceremonies" value={data.stats?.total_ceremonies || 0} />
          <Stat label="Fraud Flags" value={data.stats?.active_fraud_flags || 0} red={data.stats?.active_fraud_flags > 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-slate-200 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, red }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${red ? 'text-red-400' : 'text-navy-900'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
