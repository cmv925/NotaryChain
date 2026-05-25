import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Shield, Search, CheckCircle, XCircle, Loader2,
  Blocks, FileText, User, Clock, ExternalLink, Copy, ShieldCheck,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyCertificate() {
  const { certHash } = useParams();
  const navigate = useNavigate();
  const [inputHash, setInputHash] = useState(certHash || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (certHash) verify(certHash);
  }, [certHash]);

  const verify = async (hash) => {
    if (!hash.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`${API}/ceremony/verify/certificate/${encodeURIComponent(hash.trim())}`);
      setResult(res.data);
    } catch (err) {
      setResult({ verified: false, message: 'Verification request failed. Please check the hash and try again.' });
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verify(inputHash);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-28 sm:pt-32 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Verify Certificate' }]} />

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-coral-500/20 mb-5">
              <ShieldCheck className="w-8 h-8 text-coral-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3" data-testid="verify-cert-title">
              Verify Certificate
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
              Enter a Certificate ID, Ceremony ID, or Blockchain Hash to verify the authenticity of a NotaryChain notarization certificate.
            </p>
          </div>

          {/* Search Card */}
          <Card className="bg-white border-slate-200 mb-8" data-testid="verify-cert-search">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <Input
                  value={inputHash}
                  onChange={(e) => setInputHash(e.target.value)}
                  placeholder="e.g. NC-A1B2C3D4E5F6, ceremony ID, or blockchain hash..."
                  className="bg-cream-100 border-slate-200 text-navy-900 flex-1 placeholder:text-slate-600"
                  data-testid="verify-cert-input"
                />
                <Button type="submit" disabled={loading || !inputHash.trim()} className="bg-coral-500 hover:bg-emerald-700 text-navy-900 px-6" data-testid="verify-cert-submit">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  {loading ? '' : 'Verify'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <div data-testid="verify-cert-result">
              {result.verified ? (
                <div className="space-y-5">
                  {/* Verified Banner */}
                  <Card className="bg-coral-500/10 border-coral-200" data-testid="cert-verified-banner">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-7 h-7 text-coral-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-coral-600">Certificate Verified</h2>
                        <p className="text-coral-700/70 text-sm mt-1">{result.message}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Document Info */}
                  <Card className="bg-white border-slate-200" data-testid="cert-document-info">
                    <CardContent className="p-6">
                      <h3 className="text-navy-900 font-semibold text-lg mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-coral-500" /> Document Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoRow label="Certificate ID" value={result.certificate_id} copyable onCopy={copyToClipboard} />
                        <InfoRow label="Ceremony ID" value={result.ceremony_id} copyable onCopy={copyToClipboard} />
                        <InfoRow label="Document" value={result.document_name} />
                        <InfoRow label="Signer" value={result.signer_name} />
                        <InfoRow label="Status" value={result.status?.toUpperCase()} badge badgeColor="emerald" />
                        <InfoRow label="Created" value={formatDate(result.created_at)} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent Verdicts */}
                  <Card className="bg-white border-slate-200" data-testid="cert-agent-verdicts">
                    <CardContent className="p-6">
                      <h3 className="text-navy-900 font-semibold text-lg mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-navy-500" /> Agent Verification Results
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {result.agents.map((a) => (
                          <div
                            key={a.agent}
                            className={`p-4 rounded-lg border text-center ${a.verdict === 'PASS' ? 'bg-coral-500/10 border-coral-200' : a.verdict === 'FAIL' ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-700/20 border-slate-200'}`}
                            data-testid={`cert-agent-${a.agent.toLowerCase()}`}
                          >
                            <div className="flex justify-center mb-2">
                              {a.verdict === 'PASS' ? <CheckCircle className="w-6 h-6 text-coral-600" /> : a.verdict === 'FAIL' ? <XCircle className="w-6 h-6 text-red-400" /> : <Clock className="w-6 h-6 text-slate-500" />}
                            </div>
                            <p className="text-navy-900 font-medium text-sm">{a.agent}</p>
                            <p className={`text-xs font-bold mt-1 ${a.verdict === 'PASS' ? 'text-coral-600' : a.verdict === 'FAIL' ? 'text-red-400' : 'text-slate-500'}`}>
                              {a.verdict}
                            </p>
                            {a.confidence != null && (
                              <p className="text-slate-500 text-xs mt-1">{a.confidence}% confidence</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Consensus */}
                  <Card className="bg-white border-slate-200" data-testid="cert-consensus">
                    <CardContent className="p-6">
                      <h3 className="text-navy-900 font-semibold text-lg mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-coral-600" /> Consensus Oracle
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <InfoRow label="Result" value={result.consensus.result} badge badgeColor={result.consensus.result === 'APPROVED' ? 'emerald' : 'red'} />
                        <InfoRow label="Pass Votes" value={result.consensus.pass_count} />
                        <InfoRow label="Fail Votes" value={result.consensus.fail_count} />
                        <InfoRow label="Decided" value={formatDate(result.consensus.decided_at)} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Blockchain Seal */}
                  {result.blockchain_seal && (
                    <Card className="bg-white border-slate-200" data-testid="cert-blockchain-seal">
                      <CardContent className="p-6">
                        <h3 className="text-navy-900 font-semibold text-lg mb-4 flex items-center gap-2">
                          <Blocks className="w-5 h-5 text-coral-600" /> Blockchain Seal
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <InfoRow label="Network" value={result.blockchain_seal.network} />
                          <InfoRow label="Topic ID" value={result.blockchain_seal.topic_id} copyable onCopy={copyToClipboard} />
                          {result.blockchain_seal.transaction_id && (
                            <InfoRow label="Transaction ID" value={result.blockchain_seal.transaction_id} copyable onCopy={copyToClipboard} />
                          )}
                          {result.blockchain_seal.sequence_number != null && (
                            <InfoRow label="Sequence #" value={result.blockchain_seal.sequence_number} />
                          )}
                          <InfoRow label="Consensus Hash" value={result.blockchain_seal.consensus_hash} copyable onCopy={copyToClipboard} mono />
                          <InfoRow label="Sealed At" value={formatDate(result.blockchain_seal.sealed_at)} />
                        </div>
                        {result.blockchain_seal.explorer_url && (
                          <a
                            href={result.blockchain_seal.explorer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-coral-500/10 border border-coral-200 text-coral-600 text-sm hover:bg-coral-500/20 transition-colors"
                            data-testid="cert-explorer-link"
                          >
                            <ExternalLink className="w-4 h-4" /> View on HashScan Explorer
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="bg-red-500/10 border-red-500/30" data-testid="cert-not-found">
                  <CardContent className="p-8 text-center">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-400 mb-2">Certificate Not Found</h2>
                    <p className="text-red-300/70 text-sm max-w-md mx-auto">{result.message}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function InfoRow({ label, value, copyable, onCopy, badge, badgeColor, mono }) {
  if (value == null || value === undefined) return null;
  const displayVal = String(value);
  return (
    <div>
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {badge ? (
          <span className={`px-2 py-0.5 text-xs font-bold rounded-md bg-${badgeColor}-500/20 text-${badgeColor}-400 border border-${badgeColor}-500/30`}>
            {displayVal}
          </span>
        ) : (
          <span className={`text-navy-900 text-sm ${mono ? 'font-mono text-xs break-all' : ''}`}>{displayVal}</span>
        )}
        {copyable && onCopy && (
          <button onClick={() => onCopy(displayVal)} className="text-slate-600 hover:text-slate-500 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}
