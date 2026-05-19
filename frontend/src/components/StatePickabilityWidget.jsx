import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Compass, ChevronRight, AlertTriangle, CheckCircle2, Share2, Copy, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const scoreColor = (score) => {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { bar: 'bg-coral-500', text: 'text-coral-700', bg: 'bg-coral-50', border: 'border-coral-200' };
};

export default function StatePickabilityWidget({ token }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/compliance/pickability/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Failed to load pickability index');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await axios.post(
        `${API}/compliance/snapshots/share?ttl_days=7`,
        null,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const url = res.data.share_url;
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Snapshot link copied', description: 'Public read-only report URL is in your clipboard. Expires in 7 days.' });
      } catch (_e) {
        toast({ title: 'Snapshot created', description: 'Share link generated. Copy it from the banner below.' });
      }
    } catch (e) {
      toast({ title: 'Could not create snapshot', description: e?.response?.data?.detail || 'Try again in a moment', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Copied to clipboard' });
  };

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg bg-cream-100 p-6" data-testid="pickability-loading">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">State Pickability Index</p>
        <p className="text-slate-500 text-sm mt-3">Loading compliance readiness…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="border border-slate-200 rounded-lg bg-cream-100 p-6" data-testid="pickability-error">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">State Pickability Index</p>
        <p className="text-coral-700 text-sm mt-3">{String(error)}</p>
      </div>
    );
  }
  if (!data || data.total_open === 0) {
    return (
      <div className="border border-slate-200 rounded-lg bg-cream-100 p-6" data-testid="pickability-empty">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-4 h-4 text-coral-600" />
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">State Pickability Index</p>
        </div>
        <p className="text-slate-500 text-sm">No open ceremonies. When you request a notarization, this widget will surface state-specific readiness nudges here.</p>
      </div>
    );
  }

  const overall = scoreColor(data.overall_score);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-cream-100" data-testid="pickability-widget">
      {/* Header */}
      <div className="bg-cream-200 border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-coral-600" />
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">State Pickability Index</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleShare}
            size="sm"
            variant="outline"
            disabled={sharing}
            className="border-slate-300 text-navy-900 hover:bg-cream-100 h-8 text-[10px] uppercase tracking-wider"
            data-testid="pickability-share-btn"
          >
            {sharing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Share2 className="w-3 h-3 mr-1" />}
            Share snapshot
          </Button>
          <div className="text-right">
            <div className={`text-2xl font-light tracking-tight ${overall.text}`} data-testid="pickability-overall-score">{data.overall_score}<span className="text-sm text-slate-500">%</span></div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{data.total_ready} of {data.total_open} ready to seal</div>
          </div>
        </div>
      </div>

      {/* Share link banner */}
      {shareLink && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center gap-3" data-testid="pickability-share-link-banner">
          <Share2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-0.5">Public snapshot · expires in 7 days</p>
            <code className="text-[11px] text-navy-900 font-mono truncate block" data-testid="pickability-share-link">{shareLink}</code>
          </div>
          <Button size="sm" variant="ghost" onClick={copyShareLink} className="h-7 text-[10px] text-emerald-700 hover:bg-emerald-100" data-testid="pickability-copy-link-btn">
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Per-state breakdown */}
        <div className="lg:col-span-2 p-6" data-testid="pickability-states">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500 mb-4">By Jurisdiction</p>
          <div className="space-y-3">
            {data.states.map((s) => {
              const c = scoreColor(s.score);
              return (
                <div key={s.state_code} className={`border ${c.border} ${c.bg} rounded-md p-3`} data-testid={`pickability-state-${s.state_code}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-navy-900 font-bold text-sm tracking-wider">{s.state_code}</span>
                      <span className="text-[10px] text-slate-500">{s.ready_count}/{s.open_count} ready</span>
                    </div>
                    <span className={`text-sm font-semibold ${c.text}`}>{s.score}%</span>
                  </div>
                  <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                    <div className={`h-full ${c.bar} transition-all duration-500`} style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top nudges */}
        <div className="lg:col-span-3 p-6" data-testid="pickability-nudges">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500 mb-4">Actionable Nudges</p>
          {data.nudges.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-700 text-sm" data-testid="pickability-all-clear">
              <CheckCircle2 className="w-4 h-4" />
              All open ceremonies pass their state's pre-seal gates. You can complete them anytime.
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {data.nudges.map((n, idx) => (
                <button
                  key={`${n.ceremony_id}-${n.gate_id}-${idx}`}
                  onClick={() => navigate(n.action_link)}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-md border border-slate-200 bg-white hover:border-coral-300 hover:bg-coral-50/30 transition-all group"
                  data-testid={`pickability-nudge-${idx}`}
                >
                  <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-coral-50 border border-coral-200 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-coral-600" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-wider text-coral-700 uppercase">{n.state_code}</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[11px] text-slate-600 truncate max-w-[180px]">{n.document_name}</span>
                    </div>
                    <p className="text-navy-900 text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">{n.description}</p>
                  </div>
                  <div className="flex items-center text-coral-600 opacity-60 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-semibold uppercase tracking-wider mr-1">{n.action_label}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/compliance/states')}
              className="text-[10px] text-slate-600 hover:text-navy-900 uppercase tracking-wider"
              data-testid="pickability-view-matrix-btn"
            >
              View full state matrix <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
