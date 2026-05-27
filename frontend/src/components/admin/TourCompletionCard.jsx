/**
 * TourCompletionCard — admin analytics card visualising onboarding tour
 * engagement per portal. Fed by GET /api/admin/analytics/tour-completion.
 *
 * Lives inside the Analytics tab of Command Authority Suite.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Sparkles, RefreshCw, Star, Scale, Diamond } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PORTAL_META = {
  command_authority: { label: 'Command Authority Suite', Icon: Star },
  assurance: { label: 'Assurance Portal', Icon: Scale },
  client_sovereign: { label: 'Client Sovereign Hub', Icon: Diamond },
};

export default function TourCompletionCard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/analytics/tour-completion`, {
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
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  return (
    <Card className="bg-white border-slate-200" data-testid="tour-completion-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-coral-600" />
            Onboarding Tour Engagement
          </CardTitle>
          <Button
            onClick={fetchStats}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-navy-900"
            data-testid="tour-stats-refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="py-8 text-center text-slate-500 text-sm">Loading…</div>
        ) : !data || data.by_portal.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm mb-1">No tour data yet.</p>
            <p className="text-slate-500 text-xs">
              Once users land on a portal for the first time, their started / completed / skipped events will roll up here.
            </p>
          </div>
        ) : (
          <>
            {/* Totals roll-up */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Started"  value={data.totals.started}  tone="cream" />
              <Stat label="Completed" value={data.totals.completed} tone="emerald" />
              <Stat label="Skipped"  value={data.totals.skipped}  tone="amber" />
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-500 mb-1">
                Global completion rate
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-coral-400 to-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, data.totals.completion_rate)}%` }}
                  />
                </div>
                <span className="text-navy-900 font-semibold text-sm tabular-nums">
                  {data.totals.completion_rate}%
                </span>
              </div>
            </div>

            {/* Per-portal rows */}
            <div className="space-y-3">
              {data.by_portal.map((row) => {
                const meta = PORTAL_META[row.portal] || { label: row.portal, Icon: Sparkles };
                const Icon = meta.Icon;
                return (
                  <div
                    key={row.portal}
                    className="border border-slate-200 rounded-lg p-3"
                    data-testid={`tour-portal-row-${row.portal}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-cream-200 flex items-center justify-center">
                          <Icon className="w-3 h-3 text-navy-900" />
                        </span>
                        <span className="text-navy-900 text-sm font-semibold">
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-navy-900 font-semibold text-sm tabular-nums">
                        {row.completion_rate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>{row.started} started</span>
                      <span className="opacity-50">·</span>
                      <span className="text-emerald-600">{row.completed} completed</span>
                      <span className="opacity-50">·</span>
                      <span className="text-amber-600">{row.skipped} skipped</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-coral-500 rounded-full"
                        style={{ width: `${Math.min(100, row.completion_rate)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    cream: 'bg-cream-200 border-slate-200 text-navy-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold tracking-[0.18em] uppercase opacity-70">{label}</p>
      <p className="text-2xl font-light tabular-nums mt-1">{value}</p>
    </div>
  );
}
