/**
 * VerifyCeremonyVideo — PUBLIC page to verify a RON recording's integrity by its
 * SHA-256 hash. No auth, never exposes the video. /verify/recording/:hash.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, ShieldX, Loader2, Search, ExternalLink, Copy, Video, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || '—'; } };

export default function VerifyCeremonyVideo() {
  const { hash: hashParam } = useParams();
  const navigate = useNavigate();
  const [hash, setHash] = useState(hashParam || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const verify = useCallback(async (h) => {
    const clean = (h || '').trim().toLowerCase();
    if (!clean) return;
    setLoading(true); setResult(null);
    try {
      const res = await axios.get(`${API}/ceremony-videos/verify/${clean}`);
      setResult(res.data);
    } catch { setResult({ verified: false }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (hashParam) verify(hashParam); }, [hashParam, verify]);

  const submit = (e) => { e.preventDefault(); if (hash.trim()) navigate(`/verify/recording/${hash.trim().toLowerCase()}`); };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast({ title: 'Copied' }); };
  const r = result?.recording;

  return (
    <div className="min-h-screen bg-cream-100" data-testid="verify-recording-page">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Verify Recording' }]} />
          <header className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-900 mb-4">
              <Video className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-2">Verify a Recording</h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Paste a recording's SHA-256 hash to confirm it was anchored on Hedera and has not been altered.
            </p>
          </header>

          <form onSubmit={submit} className="flex gap-2 mb-8">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Enter SHA-256 hash (64 hex characters)…" value={hash} onChange={(e) => setHash(e.target.value)} className="pl-9 font-mono text-xs" data-testid="verify-recording-input" />
            </div>
            <Button type="submit" disabled={loading || !hash.trim()} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="verify-recording-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </Button>
          </form>

          {loading && <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-coral-500" /></div>}

          {!loading && result && !result.verified && (
            <Card className="bg-white border-rose-200" data-testid="verify-recording-failed">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-500/12 flex items-center justify-center mx-auto mb-3"><ShieldX className="w-8 h-8 text-rose-500" /></div>
                <h3 className="font-bold text-navy-900 text-lg">Not Verified</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {result.reason === 'invalid_hash_format'
                    ? "That doesn't look like a valid SHA-256 hash (64 hex characters)."
                    : 'No anchored recording matches this hash. It may not have been anchored, or the file was altered.'}
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && result?.verified && r && (
            <Card className="bg-white border-emerald-200" data-testid="verify-recording-success">
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-col items-center text-center gap-2 py-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center"><ShieldCheck className="w-8 h-8 text-emerald-600" /></div>
                  <h3 className="font-bold text-navy-900 text-lg">Verified & Untampered</h3>
                  <p className="text-sm text-slate-600 flex items-center gap-1"><Video className="w-3.5 h-3.5 text-coral-500" /> {r.file_name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Anchored {fmtDate(r.anchored_at)}</p>
                </div>
                <div className="space-y-2">
                  {[
                    ['Document hash (SHA-256)', r.content_hash],
                    ['Transaction ID', r.transaction_id],
                    ['HCS topic', r.topic_id],
                    ['Duration', r.duration_sec ? `${Math.round(r.duration_sec)}s` : '—'],
                    ['Network', r.network],
                  ].map(([k, val]) => (
                    <div key={k} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">{k}</span>
                      <button onClick={() => val && copy(val)} className="font-mono text-navy-800 truncate max-w-[60%] flex items-center gap-1 hover:text-coral-600" title={val || ''}>
                        <span className="truncate">{val || '—'}</span>{val && <Copy className="w-3 h-3 flex-shrink-0" />}
                      </button>
                    </div>
                  ))}
                </div>
                {r.explorer_url && (
                  <a href={r.explorer_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full border-slate-300" data-testid="verify-recording-explorer"><ExternalLink className="w-4 h-4 mr-2" /> View on HashScan</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
