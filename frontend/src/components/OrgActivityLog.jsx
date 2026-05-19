import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import {
  Activity, Filter, Download, ChevronLeft, ChevronRight,
  User, Shield, Key, FolderOpen, Settings, GitBranch,
  Loader2, Search, BarChart3, Clock,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ACTION_ICONS = {
  'member.joined': User,
  'member.removed': User,
  'member.role_changed': Shield,
  'member.invited': User,
  'role.created': Shield,
  'role.updated': Shield,
  'role.deleted': Shield,
  'role.assigned': Shield,
  'sso_login': Key,
  'sso.configured': Key,
  'vault.uploaded': FolderOpen,
  'vault.deleted': FolderOpen,
  'branding.updated': Settings,
  'org.settings_updated': Settings,
  'approval.created': GitBranch,
  'approval.decided': GitBranch,
};

const ACTION_COLORS = {
  'member.joined': 'text-emerald-400 bg-emerald-500/15',
  'member.removed': 'text-red-400 bg-red-500/15',
  'member.role_changed': 'text-blue-400 bg-blue-500/15',
  'member.invited': 'text-sky-400 bg-sky-500/15',
  'role.created': 'text-purple-400 bg-purple-500/15',
  'role.updated': 'text-purple-400 bg-purple-500/15',
  'role.deleted': 'text-red-400 bg-red-500/15',
  'role.assigned': 'text-purple-400 bg-purple-500/15',
  'sso_login': 'text-amber-400 bg-amber-500/15',
  'sso.configured': 'text-amber-400 bg-amber-500/15',
  'vault.uploaded': 'text-teal-400 bg-teal-500/15',
  'vault.deleted': 'text-red-400 bg-red-500/15',
  'branding.updated': 'text-pink-400 bg-pink-500/15',
  'org.settings_updated': 'text-slate-500 bg-gray-500/15',
  'approval.created': 'text-indigo-400 bg-indigo-500/15',
  'approval.decided': 'text-indigo-400 bg-indigo-500/15',
};

const OrgActivityLog = ({ orgId, token }) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterDays, setFilterDays] = useState(30);
  const [showStats, setShowStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/organizations/${orgId}/activity?page=${page}&page_size=${pageSize}&days=${filterDays}`;
      if (filterAction) url += `&action=${filterAction}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {
      toast({ title: 'Error', description: 'Failed to load activity', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, token, page, filterAction, filterDays]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/activity/stats?days=${filterDays}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch {}
  }, [orgId, token, filterDays]);

  useEffect(() => { fetchLogs(); fetchStats(); }, [fetchLogs, fetchStats]);

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/activity/export?days=${filterDays}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `org-activity-${filterDays}d.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: `${res.data.record_count} events exported.` });
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    }
  };

  const filteredLogs = searchQuery
    ? logs.filter(l => l.description?.toLowerCase().includes(searchQuery.toLowerCase()) || l.actor_email?.toLowerCase().includes(searchQuery.toLowerCase()))
    : logs;

  const totalPages = Math.ceil(total / pageSize);
  const formatTime = (ts) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    } catch { return ts; }
  };

  return (
    <div data-testid="org-activity-log">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Activity Log
            <span className="text-slate-500 text-xs font-normal">({total} events)</span>
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">Track all actions within this organization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStats(!showStats)} className="border-slate-200 text-slate-500 text-xs" data-testid="toggle-stats-btn">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> {showStats ? 'Hide' : 'Show'} Stats
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="border-slate-200 text-slate-500 text-xs" data-testid="export-activity-btn">
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" data-testid="activity-stats">
          <div className="bg-cream-100 rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Total Events</p>
            <p className="text-white text-xl font-bold mt-1">{stats.total_events}</p>
          </div>
          <div className="bg-cream-100 rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Active Users</p>
            <p className="text-white text-xl font-bold mt-1">{Object.keys(stats.by_actor || {}).length}</p>
          </div>
          <div className="bg-cream-100 rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Top Action</p>
            <p className="text-cyan-400 text-sm font-medium mt-1 truncate">
              {Object.entries(stats.by_action || {})[0]?.[0]?.replace('.', ' ') || 'None'}
            </p>
          </div>
          <div className="bg-cream-100 rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Period</p>
            <p className="text-white text-sm font-medium mt-1">{filterDays} days</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-cream-100 rounded-lg border border-slate-200 px-2 py-1 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className="bg-transparent border-none outline-none text-white text-xs placeholder-gray-600 w-full"
            data-testid="activity-search"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="bg-cream-100 border border-slate-200 rounded-lg text-xs text-slate-500 px-2 py-1.5"
          data-testid="activity-action-filter"
        >
          <option value="">All actions</option>
          <option value="role.created">Role Created</option>
          <option value="role.updated">Role Updated</option>
          <option value="role.deleted">Role Deleted</option>
          <option value="role.assigned">Role Assigned</option>
          <option value="member.joined">Member Joined</option>
          <option value="member.removed">Member Removed</option>
          <option value="sso_login">SSO Login</option>
          <option value="vault.uploaded">Vault Upload</option>
          <option value="vault.deleted">Vault Delete</option>
        </select>
        <select
          value={filterDays}
          onChange={(e) => { setFilterDays(parseInt(e.target.value)); setPage(1); }}
          className="bg-cream-100 border border-slate-200 rounded-lg text-xs text-slate-500 px-2 py-1.5"
          data-testid="activity-days-filter"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" /></div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-sm" data-testid="no-activity">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No activity found for this period.
        </div>
      ) : (
        <div className="space-y-1" data-testid="activity-timeline">
          {filteredLogs.map((log) => {
            const Icon = ACTION_ICONS[log.action] || Activity;
            const colorClass = ACTION_COLORS[log.action] || 'text-slate-500 bg-gray-500/15';
            const [textColor, bgColor] = colorClass.split(' ');
            return (
              <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-cream-100 transition-colors group" data-testid={`activity-${log.id}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bgColor}`}>
                  <Icon className={`w-3.5 h-3.5 ${textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{log.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-slate-500 text-[11px]">{log.actor_email}</span>
                    <span className="text-slate-700 text-[11px]">&bull;</span>
                    <span className="text-slate-600 text-[11px] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {formatTime(log.timestamp)}
                    </span>
                    {log.target_name && (
                      <>
                        <span className="text-slate-700 text-[11px]">&bull;</span>
                        <span className="text-slate-500 text-[11px]">{log.target_type}: {log.target_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {log.action}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
          <span className="text-slate-500 text-xs">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-slate-200 text-slate-500 text-xs h-7 w-7 p-0" data-testid="activity-prev-page">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="border-slate-200 text-slate-500 text-xs h-7 w-7 p-0" data-testid="activity-next-page">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgActivityLog;
