/**
 * OracleWatchlistPanel — admin-facing UI for subscribing to per-jurisdiction
 * Regulatory Oracle alerts via email + Slack webhook.
 *
 * Lives inside the ACN Dashboard "Rule Updates" tab, below the Oracle card.
 *
 * Behaviour:
 *   • Lists current admin's watchlists
 *   • Inline editor (label · jurisdictions chips · severity floor · channels)
 *   • "Test send" button per row → triggers a synthetic alert dispatch
 *   • Enable/Disable toggle without re-creating
 *   • Delete with confirm
 *
 * All endpoints under /api/admin/oracle-watchlists
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  BellRing, Plus, Trash2, Send, X, ToggleLeft, ToggleRight, Mail, Hash, Globe2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_OPTIONS = [
  { value: 'low',    label: 'Low+',    color: 'text-slate-600' },
  { value: 'medium', label: 'Medium+', color: 'text-gold-600' },
  { value: 'high',   label: 'High',    color: 'text-coral-600' },
];

const COMMON_JURISDICTIONS = [
  'US-FL', 'US-TX', 'US-CA', 'US-NY', 'US-VA',
  'US-IL', 'US-NV', 'US-WA',
  'SG', 'DE-de', 'CA', 'UK',
];

export default function OracleWatchlistPanel({ token }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [testingId, setTestingId] = useState(null);
  const [error, setError] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [token]);

  function blankForm() {
    return {
      label: '',
      jurisdictions: ['US-FL'],
      severity_floor: 'medium',
      auto_applied_only: false,
      email_enabled: true,
      slack_webhook_url: '',
    };
  }

  async function fetchList() {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/oracle-watchlists`, { headers });
      setList(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  }

  async function createOne(e) {
    e?.preventDefault?.();
    setError(null);
    if (!form.label.trim()) {
      setError('Please give your watchlist a name.');
      return;
    }
    try {
      await axios.post(`${API}/admin/oracle-watchlists`, {
        ...form,
        slack_webhook_url: form.slack_webhook_url.trim() || null,
      }, { headers });
      setForm(blankForm());
      setCreating(false);
      fetchList();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create watchlist');
    }
  }

  async function toggleEnabled(w) {
    await axios.patch(`${API}/admin/oracle-watchlists/${w.id}`, {
      enabled: !w.enabled,
    }, { headers });
    fetchList();
  }

  async function deleteOne(w) {
    if (!window.confirm(`Delete watchlist "${w.label}"? This cannot be undone.`)) return;
    await axios.delete(`${API}/admin/oracle-watchlists/${w.id}`, { headers });
    fetchList();
  }

  async function testSend(w) {
    setTestingId(w.id);
    try {
      const res = await axios.post(`${API}/admin/oracle-watchlists/${w.id}/test`, {}, { headers });
      const parts = [];
      if (res.data?.email_sent) parts.push('email dispatched');
      if (res.data?.slack_sent) parts.push('Slack posted');
      alert(parts.length ? `Test alert: ${parts.join(' · ')}.` : 'Sent (no enabled channels delivered)');
    } catch (e) {
      alert(`Test failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setTestingId(null);
    }
  }

  function toggleJur(j) {
    setForm((f) => ({
      ...f,
      jurisdictions: f.jurisdictions.includes(j)
        ? f.jurisdictions.filter((x) => x !== j)
        : [...f.jurisdictions, j],
    }));
  }

  return (
    <Card className="border-coral-200" data-testid="oracle-watchlist-panel">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-coral-600" />
              Oracle alert subscriptions
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Get a ping the moment a rule change in your watched jurisdictions auto-flags any packet.
            </p>
          </div>
          {!creating && (
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="bg-coral-500 hover:bg-coral-600 text-white"
              data-testid="watchlist-new-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New watchlist
            </Button>
          )}
        </div>

        {/* Create editor */}
        {creating && (
          <form
            onSubmit={createOne}
            className="border border-coral-200 bg-coral-50/30 rounded-lg p-4 mb-4 space-y-3"
            data-testid="watchlist-form"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-coral-700 font-bold">New subscription</p>
              <button type="button" onClick={() => { setCreating(false); setForm(blankForm()); setError(null); }}
                      className="text-slate-500 hover:text-navy-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 font-semibold mb-1">Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Florida + Texas High-Severity"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-coral-500 focus:ring-1 focus:ring-coral-500"
                data-testid="watchlist-label-input"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Globe2 className="w-3 h-3" /> Jurisdictions
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, jurisdictions: ['*'] }))}
                  className={`px-2.5 py-1 text-[11px] rounded-full border font-semibold ${
                    form.jurisdictions.includes('*') ? 'bg-navy-900 text-cream-100 border-navy-900' : 'bg-white text-slate-600 border-slate-300 hover:border-coral-300'
                  }`}
                >
                  Any jurisdiction
                </button>
                {COMMON_JURISDICTIONS.map((j) => (
                  <button
                    type="button"
                    key={j}
                    onClick={() => toggleJur(j)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border font-mono ${
                      form.jurisdictions.includes(j) ? 'bg-coral-500 text-white border-coral-500' : 'bg-white text-slate-600 border-slate-300 hover:border-coral-300'
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1">Minimum severity</label>
                <select
                  value={form.severity_floor}
                  onChange={(e) => setForm((f) => ({ ...f, severity_floor: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  data-testid="watchlist-severity-select"
                >
                  {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 mt-5 text-sm text-navy-900">
                <input
                  type="checkbox"
                  checked={form.auto_applied_only}
                  onChange={(e) => setForm((f) => ({ ...f, auto_applied_only: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Only when Oracle auto-flags ≥1 packet
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-navy-900">
                <input
                  type="checkbox"
                  checked={form.email_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, email_enabled: e.target.checked }))}
                  className="rounded border-slate-300"
                  data-testid="watchlist-email-checkbox"
                />
                <Mail className="w-3.5 h-3.5 text-coral-600" /> Email me
              </label>
              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Slack / Discord webhook URL (optional)
                </label>
                <input
                  value={form.slack_webhook_url}
                  onChange={(e) => setForm((f) => ({ ...f, slack_webhook_url: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/T0…"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono"
                  data-testid="watchlist-slack-input"
                />
              </div>
            </div>

            {error && <p className="text-xs text-coral-700 bg-coral-50 border border-coral-200 rounded p-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm"
                      onClick={() => { setCreating(false); setForm(blankForm()); }}>Cancel</Button>
              <Button type="submit" size="sm" className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="watchlist-save-btn">
                Subscribe
              </Button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <p className="text-center text-slate-500 text-sm py-6">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">
            No subscriptions yet. Add one to start receiving Oracle alerts.
          </p>
        ) : (
          <div className="space-y-2" data-testid="watchlist-list">
            {list.map((w) => (
              <div
                key={w.id}
                className={`border rounded-lg p-3 ${w.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-cream-100/60 opacity-70'}`}
                data-testid={`watchlist-row-${w.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-900 truncate">{w.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(w.jurisdictions || []).slice(0, 8).map((j) => (
                        <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-coral-50 text-coral-700 border border-coral-200">
                          {j}
                        </span>
                      ))}
                      <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-navy-50 text-navy-800 border border-navy-200">
                        {w.severity_floor}+
                      </span>
                      {w.auto_applied_only && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          auto-flagged only
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-500">
                      {w.channels?.email && (
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {w.admin_email}</span>
                      )}
                      {w.channels?.slack_webhook_url && (
                        <span className="inline-flex items-center gap-1"><Hash className="w-3 h-3" /> webhook configured</span>
                      )}
                      <span>· dispatched {w.dispatch_count || 0}x</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleEnabled(w)} title={w.enabled ? 'Disable' : 'Enable'}
                            data-testid={`watchlist-toggle-${w.id}`}>
                      {w.enabled
                        ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                        : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    </Button>
                    <Button size="sm" variant="ghost"
                            onClick={() => testSend(w)} disabled={testingId === w.id}
                            title="Send a test alert"
                            data-testid={`watchlist-test-${w.id}`}>
                      <Send className={`w-4 h-4 text-coral-600 ${testingId === w.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteOne(w)} title="Delete"
                            data-testid={`watchlist-delete-${w.id}`}>
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-coral-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
