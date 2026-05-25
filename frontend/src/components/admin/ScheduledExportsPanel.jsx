import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, Pencil, Play, RefreshCw, Mail, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/admin/scheduled-exports`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
});

const CADENCE_PRESETS = [
  { label: 'Daily',     hours: 24 },
  { label: 'Weekly',    hours: 168 },
  { label: 'Bi-weekly', hours: 336 },
  { label: 'Monthly',   hours: 720 },
];

const SEVERITIES = ['', 'info', 'warning', 'critical'];

/**
 * Per-org scheduled SOC 2 audit-log export manager.
 * Admins can create multiple schedules with cadence + recipient lists.
 * The backend scheduler ticks each minute, generates the tamper-evident bundle,
 * Hedera-anchors the root hash, and emails every recipient.
 */
export default function ScheduledExportsPanel() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);  // {id?, name, cadence_hours, recipients, filters}

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API, { headers: authHeaders() });
      setConfigs(res.data.configs || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* mount-only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!editing.name?.trim()) { toast.warning('Name required'); return; }
    if (!editing.recipients?.length) { toast.warning('At least one recipient'); return; }
    try {
      if (editing.id) {
        await axios.put(`${API}/${editing.id}`, editing, { headers: authHeaders() });
        toast.success('Schedule updated');
      } else {
        await axios.post(API, editing, { headers: authHeaders() });
        toast.success('Schedule created');
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this schedule? Past exports will remain.')) return;
    try {
      await axios.delete(`${API}/${id}`, { headers: authHeaders() });
      toast.success('Schedule deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const runNow = async (id) => {
    try {
      const res = await axios.post(`${API}/${id}/run-now`, {}, { headers: authHeaders() });
      toast.success(`Sent ${res.data.row_count} rows to ${res.data.sent_to.length} recipient(s)`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Run-now failed');
    }
  };

  return (
    <Card className="bg-white border-slate-200" data-testid="scheduled-exports-panel">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-coral-600" /> Scheduled SOC 2 Exports
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Multi-cadence, multi-recipient tamper-evident audit-log exports — emailed automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} data-testid="se-refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" className="bg-coral-500 hover:bg-coral-600" onClick={() => setEditing({ name: '', cadence_hours: 168, recipients: [], filters: {} })} data-testid="se-add-btn">
              <Plus className="w-3.5 h-3.5 mr-1" /> New schedule
            </Button>
          </div>
        </div>

        {/* Editor */}
        {editing && (
          <div className="bg-cream-100 border border-coral-200 rounded-lg p-4 mb-4 space-y-3" data-testid="se-editor">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Name</label>
                <Input value={editing.name} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Weekly compliance review" data-testid="se-name" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cadence</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {CADENCE_PRESETS.map(p => (
                    <button key={p.hours}
                      onClick={() => setEditing(s => ({ ...s, cadence_hours: p.hours }))}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${
                        editing.cadence_hours === p.hours
                          ? 'bg-coral-500 text-white border-coral-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-coral-300'
                      }`}
                      data-testid={`se-cadence-${p.label.toLowerCase()}`}
                    >{p.label}</button>
                  ))}
                  <Input type="number" value={editing.cadence_hours}
                    onChange={e => setEditing(s => ({ ...s, cadence_hours: parseInt(e.target.value || 0, 10) }))}
                    className="w-20 ml-1 h-8 text-xs" placeholder="hours" data-testid="se-cadence-custom" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Recipients (comma-separated)</label>
              <Input value={(editing.recipients || []).join(', ')}
                onChange={e => setEditing(s => ({ ...s, recipients: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))}
                placeholder="compliance@org.com, ciso@org.com" data-testid="se-recipients" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1"><Filter className="w-3 h-3" /> Actor filter</label>
                <Input placeholder="(any)" value={editing.filters?.actor || ''}
                  onChange={e => setEditing(s => ({ ...s, filters: { ...(s.filters || {}), actor: e.target.value } }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Action filter</label>
                <Input placeholder="(any)" value={editing.filters?.action || ''}
                  onChange={e => setEditing(s => ({ ...s, filters: { ...(s.filters || {}), action: e.target.value } }))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Severity</label>
                <select value={editing.filters?.severity || ''}
                  onChange={e => setEditing(s => ({ ...s, filters: { ...(s.filters || {}), severity: e.target.value } }))}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s || 'any'}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" className="bg-coral-500 hover:bg-coral-600" onClick={save} data-testid="se-save-btn">
                {editing.id ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {configs.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-sm">No scheduled exports yet.</p>
        ) : (
          <div className="space-y-2" data-testid="se-list">
            {configs.map(c => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex items-center gap-3 hover:bg-cream-50 transition-colors">
                <div className={`w-2 h-12 rounded-full ${c.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-navy-900 text-sm">{c.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-coral-100 text-coral-700 font-bold uppercase tracking-wider">
                      every {c.cadence_hours}h
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <Mail className="w-2.5 h-2.5" /> {c.recipients.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {c.recipients.join(', ')}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    next: {c.next_run?.slice(0, 16)}
                    {c.last_run && <> · last: {c.last_run?.slice(0, 16)}</>}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => runNow(c.id)} data-testid={`se-run-${c.id}`}>
                  <Play className="w-3 h-3 mr-1" /> Run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)} data-testid={`se-edit-${c.id}`}>
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(c.id)} data-testid={`se-del-${c.id}`}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
