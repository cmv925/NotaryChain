/**
 * DashboardHero — personalized welcome panel shown above the bento grid.
 *
 * Adapts to role:
 *  - **Notary**: shows live queue stats (pending in their state · assigned to
 *    them · ready to seal) with a big CTA to /approvals + journal shortcut.
 *  - **End user / client**: shows their open notarization requests + signed
 *    documents and a big CTA to /request-notarization + Quick Seal shortcut.
 *
 * Designed to replace the generic 3-cell stats strip with something that
 * tells the user *what to do next* the moment they land.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Upload, Search, Hammer, BookOpen, ChevronRight, Sparkles, ShieldCheck, Clock, CheckCircle2, Star, Scale, Diamond } from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatNumber = (n) => Number.isFinite(n) ? n.toLocaleString() : '—';

function StatCell({ label, value, hint, tone = 'cream', testid }) {
  const tones = {
    cream: 'bg-cream-200/50 border-slate-200',
    amber: 'bg-amber-50 border-amber-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    coral: 'bg-coral-50 border-coral-200',
    ink: 'bg-ink-900 text-cream-100 border-ink-800',
  };
  const labelColor = tone === 'ink' ? 'text-ink-200' : 'text-slate-600';
  const valueColor = tone === 'ink' ? 'text-cream-100' : 'text-ink-900';
  const hintColor = tone === 'ink' ? 'text-ink-300' : 'text-slate-500';
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`} data-testid={testid}>
      <p className={`text-[11px] font-semibold tracking-[0.18em] uppercase mb-1.5 ${labelColor}`}>{label}</p>
      <p className={`font-light text-3xl tracking-tight ${valueColor}`}>{value}</p>
      {hint && <p className={`text-[12px] mt-1 ${hintColor}`}>{hint}</p>}
    </div>
  );
}

export default function DashboardHero({ token, user, role }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ pending: [], assigned: [], my: [] });

  const isNotary = role === 'notary' || user?.is_notary;
  const isAdmin = role === 'admin';
  const firstName = (user?.full_name || user?.email || 'there').split(' ')[0].split('@')[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        if (isNotary || isAdmin) {
          const [p, a] = await Promise.allSettled([
            axios.get(`${API}/notary/requests/pending`, { headers }),
            axios.get(`${API}/notary/requests/assigned`, { headers }),
          ]);
          if (!cancelled) {
            setData({
              pending: p.status === 'fulfilled' ? p.value.data : [],
              assigned: a.status === 'fulfilled' ? a.value.data : [],
              my: [],
            });
          }
        } else {
          const m = await axios.get(`${API}/notary/requests/my`, { headers }).catch(() => ({ data: [] }));
          if (!cancelled) setData({ pending: [], assigned: [], my: m.data || [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, isNotary, isAdmin]);

  return (
    <div className="mt-6 mb-2" data-testid="dashboard-hero">
      {/* Welcome strip */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-coral-600 mb-1.5 flex items-center gap-1.5">
            {isNotary ? (
              <><Scale className="w-3 h-3 text-navy-700" /> Assurance Portal</>
            ) : isAdmin ? (
              <><Star className="w-3 h-3 text-coral-600 fill-coral-600" /> Command Authority Suite</>
            ) : (
              <><Diamond className="w-3 h-3 text-gold-500 fill-gold-500" /> Client Sovereign Hub</>
            )}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink-900 tracking-tight">
            Good to see you, <span className="text-coral-600">{firstName}</span>.
          </h1>
          <p className="text-slate-700 text-[15px] mt-2 max-w-xl">
            {isNotary
              ? 'Your queue, journal, and compliance gates — all one click away.'
              : 'Notarize, vault, or verify a document. We\'ll keep your ledger sealed on Hedera.'}
          </p>
        </div>

        {/* Quick action pill */}
        <div className="flex items-center gap-2 flex-wrap">
          {isNotary ? (
            <>
              <Button
                onClick={() => navigate('/approvals')}
                className="bg-coral-500 hover:bg-coral-600 text-white h-11 px-5 font-semibold"
                data-testid="hero-cta-queue"
              >
                Open queue <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                onClick={() => navigate('/notary/journal')}
                variant="outline"
                className="border-ink-300 text-ink-900 h-11 px-4"
                data-testid="hero-cta-journal"
              >
                <BookOpen className="w-4 h-4 mr-1.5" /> My journal
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate('/request-notarization')}
                className="bg-coral-500 hover:bg-coral-600 text-white h-11 px-5 font-semibold"
                data-testid="hero-cta-request"
              >
                Start a notarization <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                onClick={() => navigate('/demo')}
                variant="outline"
                className="border-ink-300 text-ink-900 h-11 px-4"
                data-testid="hero-cta-quick-seal"
              >
                <Upload className="w-4 h-4 mr-1.5" /> Quick Seal
              </Button>
              <Button
                onClick={() => navigate('/verify')}
                variant="ghost"
                className="text-ink-900 hover:bg-cream-200 h-11 px-4"
                data-testid="hero-cta-verify"
              >
                <Search className="w-4 h-4 mr-1.5" /> Verify
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role-aware KPI strip */}
      {isNotary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="hero-notary-kpis">
          <StatCell
            label="Pending in queue"
            value={loading ? '—' : formatNumber(data.pending.length)}
            hint={data.pending.length > 0 ? 'Awaiting a notary' : 'You\'re all caught up'}
            tone={data.pending.length > 0 ? 'amber' : 'cream'}
            testid="hero-kpi-pending"
          />
          <StatCell
            label="Assigned to you"
            value={loading ? '—' : formatNumber(data.assigned.length)}
            hint={data.assigned.length > 0 ? 'Ceremonies in progress' : 'No active sessions'}
            tone={data.assigned.length > 0 ? 'coral' : 'cream'}
            testid="hero-kpi-assigned"
          />
          <StatCell
            label="Ready to seal"
            value={loading ? '—' : formatNumber(data.assigned.filter(r => r.status === 'in_session' || r.status === 'pre_seal').length)}
            hint="Pass pre-seal evaluator"
            tone="emerald"
            testid="hero-kpi-ready"
          />
          <StatCell
            label="Commission state"
            value={user?.commission_state || user?.state || 'FL'}
            hint="Multi-state evaluator active"
            tone="ink"
            testid="hero-kpi-state"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="hero-user-kpis">
          <StatCell
            label="Open requests"
            value={loading ? '—' : formatNumber(data.my.filter(r => ['pending','assigned','in_session'].includes(r.status)).length)}
            hint="In progress"
            tone={(data.my.filter(r => ['pending','assigned','in_session'].includes(r.status)).length > 0) ? 'amber' : 'cream'}
            testid="hero-kpi-open"
          />
          <StatCell
            label="Sealed documents"
            value={loading ? '—' : formatNumber(data.my.filter(r => r.status === 'completed' || r.status === 'sealed').length)}
            hint="On Hedera"
            tone="emerald"
            testid="hero-kpi-sealed"
          />
          <StatCell
            label="Awaiting your action"
            value={loading ? '—' : formatNumber(data.my.filter(r => ['identity_pending','signature_pending'].includes(r.status)).length)}
            hint="Tap to continue"
            tone={(data.my.filter(r => ['identity_pending','signature_pending'].includes(r.status)).length > 0) ? 'coral' : 'cream'}
            testid="hero-kpi-action"
          />
          <StatCell
            label="Member since"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
            tone="ink"
            testid="hero-kpi-since"
          />
        </div>
      )}

      {/* Smart suggestion strip */}
      {!loading && isNotary && data.pending.length > 0 && (
        <button
          onClick={() => navigate('/approvals')}
          className="mt-4 w-full text-left flex items-center gap-3 bg-coral-50 border border-coral-200 hover:bg-coral-100 rounded-lg p-3.5 transition-colors group"
          data-testid="hero-suggestion"
        >
          <span className="inline-flex w-8 h-8 rounded-md bg-coral-500 text-white items-center justify-center">
            <Clock className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ink-900 text-sm font-semibold">
              {data.pending.length} pending {data.pending.length === 1 ? 'request' : 'requests'} waiting in your state
            </p>
            <p className="text-slate-600 text-[12px]">Open the queue to claim one — typical turnaround &lt; 15 min.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-coral-600 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
      {!loading && !isNotary && data.my.filter(r => ['identity_pending','signature_pending'].includes(r.status)).length > 0 && (
        <button
          onClick={() => {
            const next = data.my.find(r => ['identity_pending','signature_pending'].includes(r.status));
            if (next) navigate(`/session/${next.id}`);
          }}
          className="mt-4 w-full text-left flex items-center gap-3 bg-coral-50 border border-coral-200 hover:bg-coral-100 rounded-lg p-3.5 transition-colors group"
          data-testid="hero-suggestion"
        >
          <span className="inline-flex w-8 h-8 rounded-md bg-coral-500 text-white items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ink-900 text-sm font-semibold">Your notary is waiting — finish identity verification</p>
            <p className="text-slate-600 text-[12px]">Tap to resume the ceremony.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-coral-600 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
      {!loading && !isNotary && data.my.filter(r => ['pending','assigned','in_session','identity_pending','signature_pending'].includes(r.status)).length === 0 && (
        <button
          onClick={() => navigate('/request-notarization')}
          className="mt-4 w-full text-left flex items-center gap-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg p-3.5 transition-colors group"
          data-testid="hero-suggestion"
        >
          <span className="inline-flex w-8 h-8 rounded-md bg-emerald-500 text-white items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ink-900 text-sm font-semibold">Everything sealed and shipshape.</p>
            <p className="text-slate-600 text-[12px]">Ready to notarize something new? Start a request →</p>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  );
}
