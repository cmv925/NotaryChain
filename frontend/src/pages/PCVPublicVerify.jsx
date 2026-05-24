import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ShieldCheck, ShieldAlert, FileText, ExternalLink } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/pcv`;

export default function PCVPublicVerify() {
  const { packetId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API}/evidence-packet/${packetId}/verify`)
      .then((res) => { if (mounted) setResult(res.data); })
      .catch((e) => { if (mounted) setError(e?.response?.data?.detail || 'Verification failed'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [packetId]);

  return (
    <div className="min-h-screen bg-cream-100 py-16" data-testid="pcv-public-verify">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-white border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-coral-500" />
            <span className="text-[11px] font-semibold text-navy-900 tracking-wide">NotaryChain Public Verifier · No Authentication Required</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-3">Evidence Packet Verification</h1>
          <p className="text-slate-600">Anyone in the world can verify this packet without trusting NotaryChain.</p>
        </header>

        {loading && <div className="text-center text-slate-500 py-12">Verifying packet…</div>}

        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-6 text-center">
              <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <p className="text-rose-700 font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card className={result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}>
              <CardContent className="p-6 text-center">
                {result.ok ? (
                  <>
                    <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-2xl font-serif text-emerald-800 mb-1">Packet is authentic</p>
                    <p className="text-sm text-emerald-700">SHA-256 hash matches the stored value byte-for-byte.</p>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-2xl font-serif text-rose-800 mb-1">Tampered or invalid</p>
                    <p className="text-sm text-rose-700">Hash does not match. Do not trust this packet.</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6 border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Title</p>
                    <p className="font-serif text-lg text-navy-900">{result.title}</p>
                  </div>
                  <Badge className="bg-navy-900 text-cream-100 border-0">{result.ceremony_count} ceremonies</Badge>
                </div>

                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Packet ID</p>
                  <code className="text-xs text-coral-700 font-mono break-all">{result.packet_id}</code>
                </div>

                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Stored Hash</p>
                  <code className="text-xs text-slate-700 font-mono break-all bg-cream-200/50 p-2 rounded block">{result.stored_hash}</code>
                </div>

                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Recomputed Hash (live)</p>
                  <code className={`text-xs font-mono break-all p-2 rounded block ${result.ok ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>{result.recomputed_hash}</code>
                </div>

                {result.hedera_transaction_id && (
                  <div>
                    <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Hedera Anchor</p>
                    <code className="text-xs text-emerald-700 font-mono break-all bg-emerald-50 p-2 rounded block">{result.hedera_transaction_id}</code>
                    <a
                      href={`https://hashscan.io/mainnet/transaction/${result.hedera_transaction_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-coral-700 hover:text-coral-800 mt-2"
                    >
                      View on HashScan <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Generated</p>
                  <p className="text-sm text-slate-700">{result.generated_at}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Verified at</p>
                  <p className="text-sm text-slate-700">{result.verified_at}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6 bg-navy-900 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-coral-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-serif text-lg mb-2">How verification works</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      This verifier pulls the stored packet body, recomputes its SHA-256 canonical hash, and
                      compares it byte-for-byte to the hash anchored on the Hedera mainnet. If they match,
                      the packet is provably unchanged since generation. No NotaryChain servers required for trust.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
