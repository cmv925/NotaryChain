/**
 * AdminCeremonyAnalytics — Admin-only dashboard at /admin/analytics
 * Aggregates ceremony KPIs, funnel, time-series, state breakdown, top notaries,
 * gate-failure heatmap. Uses recharts for visualisation.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Loader2, TrendingUp, Clock, CheckCircle2, AlertTriangle, MapPin, Users, BarChart3, Activity } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_PALETTE = {
  navy: '#0F1E3D',
  coral: '#E36A5C',
  cream: '#FDF8F0',
  emerald: '#10B981',
  slate: '#64748B',
  amber: '#F59E0B',
  sky: '#0EA5E9',
};

const STAGE_LABELS = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_session: 'In session',
  completed: 'Completed',
  sealed: 'Sealed',
  fl_blocked: 'FL blocked',
};

const STAGE_COLORS = {
  pending: CHART_PALETTE.amber,
  assigned: CHART_PALETTE.sky,
  in_session: CHART_PALETTE.coral,
  completed: CHART_PALETTE.emerald,
  sealed: CHART_PALETTE.navy,
  fl_blocked: '#94A3B8',
};

function fmtDuration(secs) {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`;
  return `${(secs / 86400).toFixed(1)}d`;
}

export default function AdminCeremonyAnalytics() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [stateBreakdown, setStateBreakdown] = useState(null);
  const [topNotaries, setTopNotaries] = useState(null);
  const [gateFails, setGateFails] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setError('Admin access required.');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [o, f, ts, sb, tn, gf] = await Promise.all([
          axios.get(`${API}/admin/analytics/overview`, { headers }),
          axios.get(`${API}/admin/analytics/funnel`, { headers }),
          axios.get(`${API}/admin/analytics/timeseries?days=${days}`, { headers }),
          axios.get(`${API}/admin/analytics/state-breakdown`, { headers }),
          axios.get(`${API}/admin/analytics/top-notaries`, { headers }),
          axios.get(`${API}/admin/analytics/gate-failures`, { headers }),
        ]);
        setOverview(o.data); setFunnel(f.data); setTimeseries(ts.data);
        setStateBreakdown(sb.data); setTopNotaries(tn.data); setGateFails(gf.data);
      } catch (e) {
        setError(e.response?.data?.detail || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [days, user?.role]);

  const funnelData = useMemo(() => (funnel?.stages || []).map(s => ({
    name: STAGE_LABELS[s.stage] || s.stage,
    value: s.count,
    fill: STAGE_COLORS[s.stage] || CHART_PALETTE.slate,
  })), [funnel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <Card className="max-w-md bg-white border-coral-200 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-coral-600 mx-auto mb-3" />
          <h2 className="font-serif text-2xl text-navy-900 mb-1">Unable to load analytics</h2>
          <p className="text-slate-600 text-sm mb-5">{error}</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-navy-900 text-cream-100">Back to dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100" data-testid="admin-analytics-page">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
            <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Admin · Analytics</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/dashboard')} className="border-slate-300 text-navy-900 hover:bg-cream-200/50" data-testid="back-admin-btn">
            ← Admin home
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl text-navy-900 tracking-tight mb-1">Ceremony Analytics</h1>
            <p className="text-slate-600 text-sm">Real-time funnel, throughput, and compliance health.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500" data-testid="window-selector">
            {[7, 30, 90, 180].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded border ${days === d ? 'bg-navy-900 text-cream-100 border-navy-900' : 'bg-white text-navy-900 border-slate-300 hover:border-slate-400'}`}
                data-testid={`window-${d}d`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="kpi-strip">
            <KPI icon={Activity} label="Ceremonies (all-time)" value={overview.total_ceremonies.toLocaleString()} sub={`+${overview.last_30d} in last 30d`} />
            <KPI icon={CheckCircle2} label="Completion rate" value={`${overview.completion_rate_pct}%`} sub={`${overview.sealed} sealed`} accent="emerald" />
            <KPI icon={Clock} label="Avg time-to-seal" value={fmtDuration(overview.avg_time_to_seal_secs)} sub="completed ceremonies" />
            <KPI icon={TrendingUp} label="Revenue (30d)" value={`$${(overview.revenue_30d_usd).toLocaleString()}`} sub="completed payments" accent="coral" />
          </div>
        )}

        {/* Time series */}
        {timeseries && (
          <Card className="bg-white border-slate-200 p-6 mb-6" data-testid="timeseries-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif text-2xl text-navy-900">Daily ceremonies</h2>
                <p className="text-[12px] text-slate-500">Created vs. sealed, last {days} days</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-created" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_PALETTE.coral} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_PALETTE.coral} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-sealed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_PALETTE.emerald} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_PALETTE.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="created" stroke={CHART_PALETTE.coral} fill="url(#grad-created)" strokeWidth={2} name="Created" />
                  <Area type="monotone" dataKey="sealed" stroke={CHART_PALETTE.emerald} fill="url(#grad-sealed)" strokeWidth={2} name="Sealed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Funnel + Gate failures */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {funnel && (
            <Card className="bg-white border-slate-200 p-6" data-testid="funnel-card">
              <h2 className="font-serif text-2xl text-navy-900 mb-1">Funnel</h2>
              <p className="text-[12px] text-slate-500 mb-4">{funnel.total_started} total ceremonies started</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#0F1E3D' }} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {gateFails && (
            <Card className="bg-white border-slate-200 p-6" data-testid="gate-failures-card">
              <h2 className="font-serif text-2xl text-navy-900 mb-1">Top compliance-gate failures</h2>
              <p className="text-[12px] text-slate-500 mb-4">{gateFails.total_blocked_ceremonies} blocked ceremonies</p>
              {(gateFails.failures || []).length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  Zero blocks · pipeline is healthy
                </div>
              ) : (
                <div className="space-y-2.5">
                  {gateFails.failures.slice(0, 8).map(f => {
                    const max = gateFails.failures[0].count;
                    return (
                      <div key={f.gate} className="flex items-center gap-3" data-testid={`gate-fail-${f.gate}`}>
                        <span className="text-[12px] text-navy-900 capitalize w-40 truncate">{f.gate.replace(/_/g, ' ')}</span>
                        <div className="flex-1 h-2 bg-cream-100 rounded-full overflow-hidden">
                          <div className="h-full bg-coral-500" style={{ width: `${(f.count / max) * 100}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 w-10 text-right">{f.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* State breakdown + Top notaries */}
        <div className="grid lg:grid-cols-2 gap-6">
          {stateBreakdown && (
            <Card className="bg-white border-slate-200 p-6" data-testid="state-breakdown-card">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-5 h-5 text-coral-600" />
                <h2 className="font-serif text-2xl text-navy-900">By jurisdiction</h2>
              </div>
              <p className="text-[12px] text-slate-500 mb-4">Sealed / blocked share per state</p>
              <div className="overflow-hidden border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-cream-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-navy-900">State</th>
                      <th className="text-right px-4 py-2 font-semibold text-navy-900">Total</th>
                      <th className="text-right px-4 py-2 font-semibold text-navy-900">Sealed</th>
                      <th className="text-right px-4 py-2 font-semibold text-navy-900">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(stateBreakdown.states || []).slice(0, 10).map(s => (
                      <tr key={s.state} className="hover:bg-cream-50/40">
                        <td className="px-4 py-2 font-medium text-navy-900">{s.state}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{s.total}</td>
                        <td className="px-4 py-2 text-right text-emerald-700">{s.sealed}</td>
                        <td className="px-4 py-2 text-right font-bold text-navy-900">{s.completion_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {topNotaries && (
            <Card className="bg-white border-slate-200 p-6" data-testid="top-notaries-card">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-coral-600" />
                <h2 className="font-serif text-2xl text-navy-900">Top notaries</h2>
              </div>
              <p className="text-[12px] text-slate-500 mb-4">Sealed ceremonies, all-time</p>
              {(topNotaries.top_notaries || []).length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No sealed ceremonies yet.</div>
              ) : (
                <ol className="space-y-2">
                  {topNotaries.top_notaries.map((n, i) => (
                    <li key={n.notary_id} className="flex items-center gap-3 bg-cream-50 border border-slate-200 rounded-lg p-3" data-testid={`top-notary-${i}`}>
                      <span className="w-7 h-7 rounded-full bg-navy-900 text-cream-100 text-sm flex items-center justify-center font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-navy-900 truncate">{n.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{n.email}</div>
                      </div>
                      <span className="text-coral-600 font-bold text-sm">{n.sealed_count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-8">
          Data refreshed at {overview?.as_of ? new Date(overview.as_of).toLocaleString() : 'just now'} · time window: {days} days
        </p>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, accent }) {
  const accentClass = accent === 'emerald' ? 'text-emerald-600' : accent === 'coral' ? 'text-coral-600' : 'text-navy-900';
  return (
    <Card className="bg-white border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{label}</span>
        <Icon className={`w-4 h-4 ${accentClass}`} />
      </div>
      <div className={`font-serif text-3xl ${accentClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}
