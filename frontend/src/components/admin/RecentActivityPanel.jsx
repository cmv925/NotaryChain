/**
 * RecentActivityPanel — shows the most recent dashboard telemetry events
 * (admin/notary surface fetches + mutations + tour events). Lives inside
 * the Operations tab of Command Authority Suite.
 *
 * Pulls from GET /api/admin/telemetry/recent and merges with the in-memory
 * ring buffer maintained by `useDashboardTelemetry` so freshly-fired events
 * appear instantly without polling.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Activity, RefreshCw, CheckCircle, XCircle, Sparkles, Star, Scale, Diamond } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import useDashboardTelemetry from '../../hooks/useDashboardTelemetry';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SURFACE_META = {
  command_authority: { label: 'Command', Icon: Star, color: 'text-coral-600' },
  assurance: { label: 'Assurance', Icon: Scale, color: 'text-navy-700' },
  client_sovereign: { label: 'Client', Icon: Diamond, color: 'text-amber-600' },
  tour: { label: 'Tour', Icon: Sparkles, color: 'text-coral-500' },
};

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RecentActivityPanel() {
  const { token } = useAuth();
  const { recent: liveBuffer } = useDashboardTelemetry();
  const [serverEvents, setServerEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/telemetry/recent?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setServerEvents(res.data.events || []);
    } catch {
      setServerEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // Merge live + server, dedupe by (ts + action + target_id), newest first.
  const seen = new Set();
  const merged = [...liveBuffer, ...serverEvents]
    .filter((e) => {
      const key = `${e.ts}-${e.action}-${e.target_id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 50);

  return (
    <Card className="bg-white border-slate-200" data-testid="recent-activity-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-coral-600" />
            Operator Activity Feed
            <span className="text-[10px] font-medium text-slate-500 ml-1">
              ({merged.length})
            </span>
          </CardTitle>
          <Button
            onClick={fetchEvents}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-navy-900"
            data-testid="recent-activity-refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {merged.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No activity yet — fetches and mutations will appear here in real time.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {merged.map((e, idx) => {
              const meta = SURFACE_META[e.surface] || { label: e.surface, Icon: Activity, color: 'text-slate-600' };
              const Icon = meta.Icon;
              const outcomeOk = e.outcome === 'success' || e.outcome === 'completed' || !e.outcome;
              return (
                <div
                  key={`${e.ts}-${idx}`}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-cream-100 transition-colors text-[12px]"
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${meta.color}`} />
                  <span className="text-slate-500 w-16 flex-shrink-0">{meta.label}</span>
                  <span className="text-navy-900 flex-1 truncate font-medium">
                    {e.action.replace(/_/g, ' ')}
                  </span>
                  {e.actor_email && (
                    <span className="text-slate-400 text-[11px] hidden md:inline truncate max-w-[140px]">
                      {e.actor_email}
                    </span>
                  )}
                  {e.outcome && (
                    outcomeOk
                      ? <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-slate-500 text-[10px] tabular-nums w-14 text-right flex-shrink-0">
                    {timeAgo(e.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
