/**
 * NextActionCard — AI-driven nudge that surfaces THE single highest-impact
 * next step for the current user. Backed by GET /api/dashboard/next-action,
 * which compresses three scattered signals (expiry banner, awaiting-action
 * KPI, pending requests) into one decisive call-to-action.
 *
 * Renders above the hero / KPI strip on the Client Sovereign Hub.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, Sparkles, CheckCircle2, RefreshCw, Compass } from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TONE_STYLES = {
  warning: {
    container: 'bg-amber-50 border-amber-200',
    iconBg: 'bg-amber-500/10 text-amber-700',
    title: 'text-amber-900',
    body: 'text-amber-800/85',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    Icon: AlertTriangle,
  },
  primary: {
    container: 'bg-gradient-to-br from-coral-50 to-cream-100 border-coral-200',
    iconBg: 'bg-coral-500/15 text-coral-600',
    title: 'text-navy-900',
    body: 'text-slate-700',
    btn: 'bg-coral-500 hover:bg-coral-600 text-white',
    Icon: Sparkles,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200',
    iconBg: 'bg-emerald-500/15 text-emerald-700',
    title: 'text-emerald-900',
    body: 'text-emerald-800/85',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    Icon: CheckCircle2,
  },
  neutral: {
    container: 'bg-white border-slate-200',
    iconBg: 'bg-navy-700/10 text-navy-700',
    title: 'text-navy-900',
    body: 'text-slate-600',
    btn: 'bg-navy-900 hover:bg-navy-800 text-white',
    Icon: Compass,
  },
};

export default function NextActionCard({ token }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dashboard/next-action`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- token-triggered only
  }, [token]);

  if (loading || !data) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-sm px-5 py-4 flex items-center gap-3"
        data-testid="next-action-loading"
      >
        <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-500">Finding your next best action…</span>
      </div>
    );
  }

  const tone = TONE_STYLES[data.tone] || TONE_STYLES.primary;
  const Icon = tone.Icon;

  return (
    <div
      className={`relative rounded-xl border ${tone.container} p-5 sm:p-6 flex items-start gap-4 transition-all hover:shadow-sm overflow-hidden`}
      data-testid="next-action-card"
      data-signal={data.signal_type}
    >
      {/* tiny corner badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400/80">
        <Sparkles className="w-2.5 h-2.5" />
        Suggested
      </div>

      <div className={`w-11 h-11 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h3
          className={`font-serif text-lg sm:text-xl ${tone.title} tracking-tight`}
          data-testid="next-action-title"
        >
          {data.title}
        </h3>
        <p
          className={`text-sm ${tone.body} mt-1 max-w-2xl`}
          data-testid="next-action-description"
        >
          {data.description}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <Button
            onClick={() => navigate(data.cta_route)}
            size="sm"
            className={`${tone.btn} h-8 px-3.5 text-[13px] font-semibold`}
            data-testid="next-action-cta"
          >
            {data.cta_label}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          {data.signal_type !== 'all_clear' && (
            <button
              onClick={fetch}
              className="text-[11px] text-slate-500 hover:text-navy-900 transition-colors inline-flex items-center gap-1"
              data-testid="next-action-refresh"
              title="Re-check next action"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
