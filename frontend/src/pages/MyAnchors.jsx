/**
 * MyAnchors — history view of the user's blockchain-anchored agreements.
 * Lists anchors from /contract-templates/anchors/my, opens a certificate detail
 * (/anchors/{id}) with the full text, and exposes a shareable public verify link.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Anchor, Loader2, FileText, ExternalLink, Copy, ArrowLeft, ShieldCheck,
  Clock, Link2, Inbox,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export default function MyAnchors() {
  const navigate = useNavigate();
  const [anchors, setAnchors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // full detail
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchAnchors = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/contract-templates/anchors/my`);
      setAnchors(res.data.anchors || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load your anchored agreements', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnchors(); }, [fetchAnchors]);

  const openDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/contract-templates/anchors/${id}`);
      setSelected(res.data);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not open this agreement', variant: 'destructive' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const copy = (text, label = 'Copied') => {
    navigator.clipboard?.writeText(text);
    toast({ title: label });
  };

  const verifyUrl = (hash) => `${window.location.origin}/verify/contract/${hash}`;

  return (
    <div className="min-h-screen bg-cream-100" data-testid="my-anchors-page">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[
            { label: 'Smart Contract Templates', href: '/smart-contracts' },
            { label: 'My Anchored Agreements' },
          ]} />

          <header className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-2">
                <Anchor className="w-7 h-7 text-coral-500" /> My Anchored Agreements
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Every agreement you've sealed on Hedera, with a shareable proof of integrity.
              </p>
            </div>
            <Button
              onClick={() => navigate('/smart-contracts')}
              className="bg-navy-900 hover:bg-navy-800 text-white hidden sm:flex"
              data-testid="new-agreement-btn"
            >
              <FileText className="w-4 h-4 mr-2" /> New Agreement
            </Button>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-coral-500" />
            </div>
          ) : anchors.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-12 text-center">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-navy-900 font-semibold">No anchored agreements yet</p>
                <p className="text-sm text-slate-500 mt-1 mb-5">
                  Generate a legal agreement and anchor it on the blockchain to see it here.
                </p>
                <Button onClick={() => navigate('/smart-contracts')} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="browse-templates-btn">
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="anchors-list">
              {anchors.map((a) => (
                <Card
                  key={a.id}
                  onClick={() => openDetail(a.id)}
                  className="bg-white border-slate-200 hover:border-coral-300 hover:shadow-md transition-all cursor-pointer"
                  data-testid={`anchor-row-${a.id}`}
                >
                  <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-coral-500/12 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-coral-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy-900 text-sm truncate">{a.title}</p>
                      <p className="text-xs text-slate-500 truncate">{a.template_name}</p>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtDate(a.anchored_at || a.created_at)}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                        a.hcs_submitted
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      }`}>
                        {a.hcs_submitted ? 'On-chain' : 'Recorded'}
                      </span>
                      <p className="font-mono text-[10px] text-slate-400 mt-1 truncate max-w-[140px]">{a.content_hash?.slice(0, 18)}…</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Certificate detail drawer */}
      {(selected || loadingDetail) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4" data-testid="anchor-detail-modal">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 max-h-[88vh] overflow-y-auto">
            {loadingDetail || !selected ? (
              <div className="p-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-coral-500" /></div>
            ) : (
              <div className="p-6 space-y-5">
                <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy-900" data-testid="anchor-detail-back">
                  <ArrowLeft className="w-4 h-4" /> Back to list
                </button>

                <div>
                  <h3 className="text-lg font-bold text-navy-900">{selected.title}</h3>
                  <p className="text-sm text-slate-500">{selected.template_name} · anchored {fmtDate(selected.anchored_at || selected.created_at)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['Document hash (SHA-256)', selected.content_hash],
                    ['Transaction ID', selected.transaction_id],
                    ['HCS topic', selected.topic_id],
                    ['Sequence #', String(selected.sequence_number ?? '—')],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                      <button onClick={() => copy(val)} className="font-mono text-xs text-navy-800 truncate w-full text-left flex items-center gap-1 hover:text-coral-600" title={val}>
                        <span className="truncate">{val}</span><Copy className="w-3 h-3 flex-shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-coral-200 bg-coral-50/60 p-3">
                  <p className="text-xs font-semibold text-navy-800 flex items-center gap-1 mb-1.5">
                    <Link2 className="w-3.5 h-3.5 text-coral-500" /> Shareable public verify link
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={verifyUrl(selected.content_hash)}
                      className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-600"
                      data-testid="verify-link-input"
                    />
                    <Button size="sm" onClick={() => copy(verifyUrl(selected.content_hash), 'Verify link copied')} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="copy-verify-link-btn">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-navy-800 mb-1.5">Agreement text</p>
                  <pre className="w-full max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-slate-700" data-testid="anchor-detail-content">{selected.content}</pre>
                </div>

                <div className="flex gap-2">
                  {selected.explorer_url && (
                    <a href={selected.explorer_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" className="w-full border-slate-300" data-testid="anchor-detail-explorer">
                        <ExternalLink className="w-4 h-4 mr-2" /> View on HashScan
                      </Button>
                    </a>
                  )}
                  <Button onClick={() => navigate(`/verify/contract/${selected.content_hash}`)} className="flex-1 bg-navy-900 hover:bg-navy-800 text-white" data-testid="anchor-detail-verify">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Open verify page
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
