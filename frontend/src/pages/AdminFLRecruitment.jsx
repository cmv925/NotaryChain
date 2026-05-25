import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronLeft, Loader2, ShieldAlert, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUSES = ['new', 'contacted', 'qualified', 'onboarded', 'declined'];
const STATUS_STYLES = {
  new: 'bg-coral-500/20 text-coral-700',
  contacted: 'bg-coral-500/20 text-coral-400',
  qualified: 'bg-navy-600/20 text-purple-300',
  onboarded: 'bg-coral-500/20 text-coral-700',
  declined: 'bg-slate-700/50 text-slate-600',
};

export default function AdminFLRecruitment() {
  const { token, isAuthenticated, user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = `${API}/api/fl/recruitment/leads${statusFilter ? `?status=${statusFilter}` : ''}`;
      const [l, s] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/api/fl/recruitment/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setLeads(l.leads || []);
      setStats(s);
    } catch (e) { toast.error('Load failed'); }
    setLoading(false);
  }, [token, statusFilter]);

  useEffect(() => { if (isAuthenticated && user?.role === 'admin') load(); }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Shell><Card className="bg-white border-slate-200 max-w-md mx-auto"><CardContent className="p-8 text-center"><ShieldAlert className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p>Admin only</p></CardContent></Card></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto" data-testid="admin-fl-recruitment-page">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-coral-600" />
              <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Recruitment Pipeline</span>
            </div>
            <h1 className="text-3xl font-bold">FL notary leads</h1>
            <p className="text-slate-600 text-sm mt-1">Track every prospective Florida notary from interest to onboarded.</p>
          </div>
          <Button onClick={load} variant="outline" className="bg-white border-slate-300 text-navy-900 hover:bg-cream-200" data-testid="refresh-leads-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total" value={stats?.total ?? '—'} testId="stat-total" />
          {STATUSES.map(s => (
            <StatCard key={s} label={s} value={stats?.by_status?.[s] ?? '—'} onClick={() => setStatusFilter(statusFilter === s ? '' : s)} active={statusFilter === s} testId={`stat-${s}`} />
          ))}
        </div>

        <div className="mb-3 text-xs text-slate-600">
          {statusFilter ? <>Filtered by <span className="text-coral-700 font-bold">{statusFilter}</span> · <button onClick={() => setStatusFilter('')} className="text-coral-600 hover:underline">clear</button></> : 'All leads'}
          {stats && <> · {stats.conversion_rate}% conversion · {stats.last_30d} in 30d</>}
        </div>

        {/* Leads list */}
        <Card className="bg-white border-slate-200" data-testid="leads-list">
          <CardContent className="p-0">
            {leads.length === 0 && !loading && <div className="p-12 text-center text-slate-500 text-sm" data-testid="no-leads">No leads {statusFilter ? `in status "${statusFilter}"` : 'yet'}.</div>}
            {leads.map(lead => (
              <button key={lead.lead_id} onClick={() => setSelected(lead)} className="w-full px-5 py-3 border-b border-slate-200/60 hover:bg-cream-200 grid grid-cols-12 gap-2 text-xs items-center text-left" data-testid={`lead-row-${lead.lead_id}`}>
                <span className="col-span-3 text-navy-900 font-medium truncate">{lead.full_name}</span>
                <span className="col-span-3 text-slate-600 truncate">{lead.email}</span>
                <span className="col-span-2 text-slate-500 truncate">{lead.county || '—'} {lead.fl_commission_number ? `· #${lead.fl_commission_number}` : ''}</span>
                <span className="col-span-2 text-slate-500">{lead.monthly_volume_estimate || '—'}</span>
                <span className="col-span-1 text-right text-slate-500 font-mono">{(lead.created_at || '').slice(5, 10)}</span>
                <span className="col-span-1 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${STATUS_STYLES[lead.status] || 'bg-slate-700 text-navy-800'}`}>{lead.status}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && <LeadDetailModal lead={selected} token={token} onClose={() => setSelected(null)} onSaved={(l) => { setSelected(l); load(); }} />}
      </div>
    </Shell>
  );
}

function StatCard({ label, value, onClick, active, testId }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={`text-left bg-white border rounded-lg p-3 transition-colors ${active ? 'border-emerald-500' : 'border-slate-200'} ${onClick ? 'hover:border-slate-600 cursor-pointer' : ''}`} data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-2xl font-bold text-navy-900">{value}</p>
    </button>
  );
}

function LeadDetailModal({ lead, token, onClose, onSaved }) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.internal_notes || '');
  const [assignee, setAssignee] = useState(lead.assigned_to || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/fl/recruitment/leads/${lead.lead_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, internal_notes: notes, assigned_to: assignee }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Save failed');
      toast.success('Lead updated');
      onSaved(body);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-auto" onClick={onClose} data-testid="lead-detail-modal">
      <Card className="bg-white border-slate-200 max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">{lead.full_name}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                {lead.county && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.county}</span>}
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {(lead.created_at || '').slice(0, 10)}</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-cream-100/40 p-3 rounded mb-4">
            <Info label="FL Commission #" v={lead.fl_commission_number || '—'} />
            <Info label="Monthly volume" v={lead.monthly_volume_estimate || '—'} />
            <Info label="Years experience" v={lead.years_experience ?? '—'} />
            <Info label="Source" v={lead.referral_source || '—'} />
            {lead.message && <Info label="Message" v={lead.message} full />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="lead-status-select">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Assigned to</label>
              <input value={assignee} onChange={e => setAssignee(e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" placeholder="recruiter@notarychain.com" data-testid="lead-assignee-input" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Internal notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md p-3 text-sm text-navy-900 w-full" data-testid="lead-notes-input" />
          </div>
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={onClose} className="bg-cream-200 border-slate-300 text-navy-900 hover:bg-cream-200">Close</Button>
            <Button onClick={save} disabled={saving} className="bg-coral-500 hover:bg-coral-500" data-testid="save-lead-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
            </Button>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">Audit trail</h3>
            <div className="space-y-1.5" data-testid="lead-audit">
              {(lead.audit_log || []).map((a, i) => (
                <div key={i} className="text-xs flex gap-3">
                  <span className="text-slate-500 font-mono w-36">{(a.at || '').slice(0, 16).replace('T', ' ')}</span>
                  <span className="text-coral-700 font-bold uppercase tracking-wider text-[10px] w-24">{a.action}</span>
                  <span className="text-slate-600 flex-1">{a.detail}</span>
                  <span className="text-slate-500">{a.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, v, full }) {
  return <div className={full ? 'col-span-2' : ''}><span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold block">{label}</span><span className="text-slate-200 break-words">{v}</span></div>;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/admin/fl-compliance" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> FL compliance</Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}
