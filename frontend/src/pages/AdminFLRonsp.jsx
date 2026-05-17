import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ChevronLeft, Loader2, ShieldAlert, Plus, ExternalLink, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUSES = ['draft', 'submitted', 'approved', 'renewing', 'expired', 'denied'];
const STATUS_STYLES = {
  draft: 'bg-slate-700/50 text-navy-800',
  submitted: 'bg-blue-500/20 text-blue-300',
  approved: 'bg-coral-500/20 text-coral-700',
  renewing: 'bg-coral-500/20 text-coral-700',
  expired: 'bg-red-500/20 text-red-300',
  denied: 'bg-red-500/20 text-red-300',
};

export default function AdminFLRonsp() {
  const { token, isAuthenticated, user } = useAuth();
  const [filings, setFilings] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, cur] = await Promise.all([
        fetch(`${API}/api/fl/ronsp/filings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/api/fl/ronsp/filings/current`).then(r => r.json()),
      ]);
      setFilings(list.filings || []);
      setCurrent(cur);
    } catch (e) { toast.error('Load failed'); }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (isAuthenticated && user?.role === 'admin') load(); }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Shell><Card className="bg-white border-slate-200 max-w-md mx-auto"><CardContent className="p-8 text-center"><ShieldAlert className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p>Admin only</p></CardContent></Card></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto" data-testid="admin-fl-ronsp-page">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSearch className="w-5 h-5 text-coral-600" />
              <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · RONSP Filing Tracker</span>
            </div>
            <h1 className="text-3xl font-bold">RON Service Provider filings</h1>
            <p className="text-slate-600 text-sm mt-1">FL Stat. 117.295 — required platform registration with FL Dept of State.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-coral-500" data-testid="new-filing-btn"><Plus className="w-4 h-4 mr-1" />New filing</Button>
        </div>

        {/* Current banner */}
        <Card className={`mb-6 ${current?.active ? 'bg-coral-500/5 border-coral-200' : 'bg-coral-500/5 border-gold-500/30'}`} data-testid="ronsp-current-banner">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 flex-wrap">
              {current?.active ? <CheckCircle className="w-8 h-8 text-coral-600" /> : <AlertTriangle className="w-8 h-8 text-coral-600" />}
              <div className="flex-1 min-w-0">
                <p className={`text-xs uppercase tracking-wider font-bold ${current?.active ? 'text-coral-700' : 'text-coral-700'}`}>
                  {current?.active ? 'Active RONSP registration' : 'No active RONSP registration'}
                </p>
                {current?.active && current.filing ? (
                  <>
                    <p className="text-lg font-bold mt-0.5">#{current.filing.filing_id || current.filing.filing_label}</p>
                    <p className="text-xs text-slate-600">
                      Approved {current.filing.approved_at?.slice(0, 10) || '—'} · Expires {current.filing.expires_at?.slice(0, 10) || '—'}
                      {current.days_until_renewal !== null && current.days_until_renewal !== undefined && ` · ${current.days_until_renewal} days until renewal`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 mt-0.5">Create your first filing to start the registration lifecycle.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filings list */}
        <Card className="bg-white border-slate-200" data-testid="filings-list">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">All filings {loading && <Loader2 className="w-3 h-3 inline animate-spin ml-2" />}</h2>
            </div>
            {filings.length === 0 && !loading && <div className="p-12 text-center text-slate-500 text-sm" data-testid="no-filings">No filings yet.</div>}
            {filings.map(f => (
              <button key={f.filing_record_id} onClick={() => setSelected(f)} className="w-full px-5 py-3 border-b border-slate-200/60 hover:bg-cream-200 grid grid-cols-12 gap-2 text-xs items-center text-left" data-testid={`filing-row-${f.filing_record_id}`}>
                <span className="col-span-4 text-navy-900 font-medium truncate">{f.filing_label}</span>
                <span className="col-span-2 font-mono text-navy-800">{f.filing_id || '—'}</span>
                <span className="col-span-2 text-slate-500">Sub: {f.submitted_at?.slice(0, 10) || '—'}</span>
                <span className="col-span-2 text-slate-500">Exp: {f.expires_at?.slice(0, 10) || '—'}</span>
                <span className="col-span-2 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${STATUS_STYLES[f.status] || 'bg-slate-700 text-navy-800'}`}>{f.status}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {showCreate && <CreateModal token={token} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        {selected && <DetailModal filing={selected} token={token} onClose={() => setSelected(null)} onSaved={(f) => { setSelected(f); load(); }} />}
      </div>
    </Shell>
  );
}

function CreateModal({ token, onClose, onCreated }) {
  const [f, setF] = useState({
    filing_label: '', filing_id: '', status: 'draft',
    submitted_at: '', approved_at: '', expires_at: '',
    registered_agent: '', document_url: '', document_sha256: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(o => ({ ...o, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      // Strip empty strings → null for date fields
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
      const r = await fetch(`${API}/api/fl/ronsp/filings`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Save failed');
      toast.success('Filing recorded');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} testId="create-filing-modal">
      <h2 className="text-xl font-bold mb-1">New RONSP filing</h2>
      <p className="text-xs text-slate-500 mb-4">Capture the filing in 'draft' first, then update as it moves through the lifecycle.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <FieldI label="Internal label *"><Input value={f.filing_label} onChange={e => upd('filing_label', e.target.value)} placeholder="2026 initial filing" className="bg-cream-100/60 border-slate-200" data-testid="filing-label" /></FieldI>
        <FieldI label="Status">
          <select value={f.status} onChange={e => upd('status', e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="filing-status">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FieldI>
        <FieldI label="FL DoS filing #"><Input value={f.filing_id} onChange={e => upd('filing_id', e.target.value)} className="bg-cream-100/60 border-slate-200 font-mono" data-testid="filing-doc-id" /></FieldI>
        <FieldI label="Registered agent"><Input value={f.registered_agent} onChange={e => upd('registered_agent', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="filing-agent" /></FieldI>
        <FieldI label="Submitted"><Input type="date" value={f.submitted_at} onChange={e => upd('submitted_at', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="filing-submitted" /></FieldI>
        <FieldI label="Approved"><Input type="date" value={f.approved_at} onChange={e => upd('approved_at', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="filing-approved" /></FieldI>
        <FieldI label="Expires"><Input type="date" value={f.expires_at} onChange={e => upd('expires_at', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="filing-expires" /></FieldI>
        <FieldI label="Document URL"><Input value={f.document_url} onChange={e => upd('document_url', e.target.value)} placeholder="https://…" className="bg-cream-100/60 border-slate-200" data-testid="filing-doc-url" /></FieldI>
        <FieldI label="Document SHA256" full><Input value={f.document_sha256} onChange={e => upd('document_sha256', e.target.value)} className="bg-cream-100/60 border-slate-200 font-mono text-[11px]" data-testid="filing-sha" /></FieldI>
        <FieldI label="Notes" full><Input value={f.notes} onChange={e => upd('notes', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="filing-notes" /></FieldI>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="bg-cream-200 border-slate-300 text-navy-900 hover:bg-cream-200">Cancel</Button>
        <Button onClick={save} disabled={saving || !f.filing_label} className="bg-coral-500 hover:bg-coral-500" data-testid="save-filing-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create filing'}
        </Button>
      </div>
    </Modal>
  );
}

function DetailModal({ filing, token, onClose, onSaved }) {
  const [f, setF] = useState({
    status: filing.status,
    filing_id: filing.filing_id || '',
    submitted_at: (filing.submitted_at || '').slice(0, 10),
    approved_at: (filing.approved_at || '').slice(0, 10),
    expires_at: (filing.expires_at || '').slice(0, 10),
    registered_agent: filing.registered_agent || '',
    document_url: filing.document_url || '',
    document_sha256: filing.document_sha256 || '',
    notes: filing.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(o => ({ ...o, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
      const r = await fetch(`${API}/api/fl/ronsp/filings/${filing.filing_record_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Save failed');
      toast.success('Filing updated');
      onSaved(data);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} testId="filing-detail-modal" wide>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Filing</p>
          <h2 className="text-2xl font-bold">{filing.filing_label}</h2>
          {filing.filing_id && <p className="text-sm text-slate-600 font-mono">#{filing.filing_id}</p>}
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${STATUS_STYLES[filing.status]}`}>{filing.status}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <FieldI label="Status">
          <select value={f.status} onChange={e => upd('status', e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="detail-status">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FieldI>
        <FieldI label="FL DoS filing #"><Input value={f.filing_id} onChange={e => upd('filing_id', e.target.value)} className="bg-cream-100/60 border-slate-200 font-mono" data-testid="detail-filing-id" /></FieldI>
        <FieldI label="Registered agent"><Input value={f.registered_agent} onChange={e => upd('registered_agent', e.target.value)} className="bg-cream-100/60 border-slate-200" /></FieldI>
        <FieldI label="Submitted"><Input type="date" value={f.submitted_at} onChange={e => upd('submitted_at', e.target.value)} className="bg-cream-100/60 border-slate-200" /></FieldI>
        <FieldI label="Approved"><Input type="date" value={f.approved_at} onChange={e => upd('approved_at', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="detail-approved" /></FieldI>
        <FieldI label="Expires"><Input type="date" value={f.expires_at} onChange={e => upd('expires_at', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="detail-expires" /></FieldI>
        <FieldI label="Document URL" full>
          <div className="flex gap-2">
            <Input value={f.document_url} onChange={e => upd('document_url', e.target.value)} className="bg-cream-100/60 border-slate-200 flex-1" />
            {filing.document_url && <a href={filing.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 bg-cream-200 border border-slate-300 rounded text-xs hover:bg-cream-200"><ExternalLink className="w-3 h-3" /></a>}
          </div>
        </FieldI>
        <FieldI label="SHA256" full><Input value={f.document_sha256} onChange={e => upd('document_sha256', e.target.value)} className="bg-cream-100/60 border-slate-200 font-mono text-[11px]" /></FieldI>
        <FieldI label="Notes" full><textarea rows={2} value={f.notes} onChange={e => upd('notes', e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md p-3 text-sm text-navy-900 w-full" /></FieldI>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={onClose} className="bg-cream-200 border-slate-300 text-navy-900 hover:bg-cream-200">Close</Button>
        <Button onClick={save} disabled={saving} className="bg-coral-500 hover:bg-coral-500" data-testid="save-filing-detail-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">Audit trail</h3>
        <div className="space-y-1.5" data-testid="filing-audit">
          {(filing.audit_log || []).map((a, i) => (
            <div key={i} className="text-xs flex gap-3">
              <span className="text-slate-500 font-mono w-36">{(a.at || '').slice(0, 16).replace('T', ' ')}</span>
              <span className="text-coral-700 font-bold uppercase tracking-wider text-[10px] w-28">{a.action}</span>
              <span className="text-slate-600 flex-1 break-words">{a.detail}</span>
              <span className="text-slate-500">{a.actor}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, testId, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-auto" onClick={onClose} data-testid={testId}>
      <Card className={`bg-white border-slate-200 ${wide ? 'max-w-3xl' : 'max-w-2xl'} w-full my-8`} onClick={e => e.stopPropagation()}>
        <CardContent className="p-6">{children}</CardContent>
      </Card>
    </div>
  );
}
function FieldI({ label, full, children }) {
  return <div className={full ? 'sm:col-span-2 lg:col-span-3' : ''}><label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>{children}</div>;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/admin/fl-compliance" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> FL compliance</Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}
