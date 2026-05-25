import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, ChevronLeft, Loader2, Plus, Download, Send, ShieldAlert, Clock, CheckCircle, FileText } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminSubpoena() {
  const { token, isAuthenticated, user } = useAuth();
  const [subpoenas, setSubpoenas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/fl/subpoena/list`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setSubpoenas(d.subpoenas || []);
    } catch (e) { toast.error('Load failed'); }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (isAuthenticated && user?.role === 'admin') load(); }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Shell><Card className="bg-white border-slate-200 max-w-md mx-auto"><CardContent className="p-8 text-center"><ShieldAlert className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p>Admin only</p></CardContent></Card></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto" data-testid="admin-subpoena-page">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="w-5 h-5 text-coral-600" />
              <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Subpoena Workflow</span>
            </div>
            <h1 className="text-3xl font-bold">Subpoena response</h1>
            <p className="text-slate-600 text-sm mt-1">Intake legal requests, scope the journal slice, produce a CSV bundle with audit trail.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-coral-500" data-testid="new-subpoena-btn"><Plus className="w-4 h-4 mr-1" />Intake subpoena</Button>
        </div>

        <Card className="bg-white border-slate-200" data-testid="subpoena-list">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">All subpoenas {loading && <Loader2 className="w-3 h-3 inline animate-spin ml-2" />}</h2>
            </div>
            {subpoenas.length === 0 && !loading && <div className="p-12 text-center text-slate-500 text-sm" data-testid="no-subpoenas">No subpoenas on record.</div>}
            {subpoenas.map(s => (
              <button key={s.subpoena_id} onClick={() => setSelected(s)} className="w-full px-5 py-3 border-b border-slate-200/60 hover:bg-cream-200 grid grid-cols-12 gap-2 text-xs items-center text-left" data-testid={`subpoena-row-${s.subpoena_id}`}>
                <span className="col-span-2 font-mono text-navy-800 truncate">{s.case_number}</span>
                <span className="col-span-4 text-slate-600 truncate">{s.issuing_court}</span>
                <span className="col-span-2 text-slate-500">Due {s.response_due_date}</span>
                <span className="col-span-2 text-slate-500 truncate">{s.issuing_attorney || '—'}</span>
                <span className="col-span-2 text-right"><StatusBadge status={s.status} /></span>
              </button>
            ))}
          </CardContent>
        </Card>

        {showCreate && <IntakeModal token={token} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        {selected && <DetailModal subpoena={selected} token={token} onClose={() => setSelected(null)} onUpdated={(s) => { setSelected(s); load(); }} />}
      </div>
    </Shell>
  );
}

function StatusBadge({ status }) {
  const map = {
    intake: { c: 'bg-coral-500/20 text-coral-700', i: Clock },
    in_progress: { c: 'bg-coral-500/20 text-coral-400', i: Loader2 },
    responded: { c: 'bg-coral-500/20 text-coral-700', i: CheckCircle },
  };
  const m = map[status] || { c: 'bg-slate-700 text-navy-800', i: FileText };
  const I = m.i;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${m.c}`}><I className="w-3 h-3" />{status}</span>;
}

function IntakeModal({ token, onClose, onCreated }) {
  const [f, setF] = useState({
    case_number: '', issuing_court: '', issuing_attorney: '', attorney_email: '',
    served_date: new Date().toISOString().slice(0, 10), response_due_date: '',
    requested_records: '', scope_signer_name: '', scope_start_date: '', scope_end_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(o => ({ ...o, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/fl/subpoena/intake`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Save failed');
      toast.success('Subpoena recorded');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} testId="intake-modal">
      <h2 className="text-xl font-bold mb-1">New subpoena intake</h2>
      <p className="text-xs text-slate-500 mb-4">All fields are immutable once saved and added to the audit trail.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Field label="Case number"><Input value={f.case_number} onChange={e => upd('case_number', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-case" /></Field>
        <Field label="Issuing court"><Input value={f.issuing_court} onChange={e => upd('issuing_court', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-court" /></Field>
        <Field label="Issuing attorney"><Input value={f.issuing_attorney} onChange={e => upd('issuing_attorney', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-attorney" /></Field>
        <Field label="Attorney email"><Input type="email" value={f.attorney_email} onChange={e => upd('attorney_email', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-email" /></Field>
        <Field label="Served date"><Input type="date" value={f.served_date} onChange={e => upd('served_date', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-served" /></Field>
        <Field label="Response due"><Input type="date" value={f.response_due_date} onChange={e => upd('response_due_date', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-due" /></Field>
        <Field label="Requested records" full><Input value={f.requested_records} onChange={e => upd('requested_records', e.target.value)} placeholder="All notarial acts for John Doe between Jan and Mar 2026…" className="bg-cream-100/60 border-slate-200" data-testid="sub-records" /></Field>
        <Field label="Scope: signer name"><Input value={f.scope_signer_name} onChange={e => upd('scope_signer_name', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-scope-name" /></Field>
        <Field label="Scope: start date"><Input type="date" value={f.scope_start_date} onChange={e => upd('scope_start_date', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-scope-start" /></Field>
        <Field label="Scope: end date"><Input type="date" value={f.scope_end_date} onChange={e => upd('scope_end_date', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-scope-end" /></Field>
        <Field label="Internal notes" full><Input value={f.notes} onChange={e => upd('notes', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="sub-notes" /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="bg-cream-200 border-slate-300 text-navy-900 hover:bg-cream-200">Cancel</Button>
        <Button onClick={save} disabled={saving || !f.case_number || !f.issuing_court || !f.response_due_date || !f.requested_records} className="bg-coral-500 hover:bg-coral-500" data-testid="save-subpoena-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record subpoena'}
        </Button>
      </div>
    </Modal>
  );
}

function DetailModal({ subpoena: s, token, onClose, onUpdated }) {
  const [responding, setResponding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resp, setResp] = useState({ response_method: 'secure_portal', delivered_to: s.attorney_email || '', tracking_ref: '', bundle_sha256: '', entries_exported: 0, notes: '' });

  const exportCSV = async () => {
    setExporting(true);
    try {
      const r = await fetch(`${API}/api/fl/subpoena/${s.subpoena_id}/export.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `subpoena_${s.case_number}.csv`; a.click();
      URL.revokeObjectURL(url);
      const exported = parseInt(r.headers.get('X-Entries-Exported') || '0', 10);
      setResp(p => ({ ...p, entries_exported: exported }));
      toast.success(`Exported ${exported} entries`);
    } catch (e) { toast.error(e.message); }
    setExporting(false);
  };

  const submitResponse = async () => {
    setResponding(true);
    try {
      const r = await fetch(`${API}/api/fl/subpoena/${s.subpoena_id}/respond`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resp),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Submit failed');
      toast.success('Subpoena marked as responded');
      onUpdated(body);
    } catch (e) { toast.error(e.message); }
    setResponding(false);
  };

  return (
    <Modal onClose={onClose} testId="subpoena-detail-modal" wide>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Case</p>
          <h2 className="text-2xl font-bold font-mono">{s.case_number}</h2>
          <p className="text-sm text-slate-600">{s.issuing_court}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-cream-100/40 p-3 rounded mb-4">
        <Info label="Served" v={s.served_date} />
        <Info label="Response due" v={s.response_due_date} />
        <Info label="Attorney" v={s.issuing_attorney || '—'} />
        <Info label="Attorney email" v={s.attorney_email || '—'} />
        <Info label="Requested records" v={s.requested_records} full />
        <Info label="Scope: signer" v={s.scope_signer_name || '—'} />
        <Info label="Scope: range" v={`${s.scope_start_date || '—'} → ${s.scope_end_date || '—'}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={exportCSV} disabled={exporting} className="bg-coral-500 hover:bg-coral-500" data-testid="export-bundle-btn">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" />Export journal slice (CSV)</>}
        </Button>
        {resp.entries_exported > 0 && <span className="text-xs text-coral-700">{resp.entries_exported} entries downloaded</span>}
      </div>

      {s.status !== 'responded' && (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="font-bold mb-3 text-sm flex items-center gap-1.5"><Send className="w-4 h-4 text-coral-600" /> Mark as responded</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Field label="Response method">
              <select value={resp.response_method} onChange={e => setResp(p => ({ ...p, response_method: e.target.value }))} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="resp-method">
                <option value="secure_portal">Secure portal</option>
                <option value="email">Email (encrypted)</option>
                <option value="courier">Courier</option>
                <option value="mail">Mail</option>
              </select>
            </Field>
            <Field label="Delivered to"><Input value={resp.delivered_to} onChange={e => setResp(p => ({ ...p, delivered_to: e.target.value }))} className="bg-cream-100/60 border-slate-200" data-testid="resp-to" /></Field>
            <Field label="Tracking reference"><Input value={resp.tracking_ref} onChange={e => setResp(p => ({ ...p, tracking_ref: e.target.value }))} className="bg-cream-100/60 border-slate-200" data-testid="resp-tracking" /></Field>
            <Field label="Bundle SHA256"><Input value={resp.bundle_sha256} onChange={e => setResp(p => ({ ...p, bundle_sha256: e.target.value }))} className="bg-cream-100/60 border-slate-200 font-mono text-[11px]" data-testid="resp-sha" /></Field>
            <Field label="Notes" full><Input value={resp.notes} onChange={e => setResp(p => ({ ...p, notes: e.target.value }))} className="bg-cream-100/60 border-slate-200" data-testid="resp-notes" /></Field>
          </div>
          <Button onClick={submitResponse} disabled={responding} className="bg-coral-500 hover:bg-coral-500" data-testid="submit-response-btn">
            {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark responded'}
          </Button>
        </div>
      )}

      {s.response && (
        <div className="border-t border-slate-200 pt-4 mt-4 bg-coral-500/5 -mx-6 px-6 pb-2" data-testid="response-record">
          <h3 className="font-bold mb-2 text-sm text-coral-700">Response on file</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Responded at" v={s.response.responded_at?.slice(0, 16).replace('T', ' ')} />
            <Info label="By" v={s.response.responded_by} />
            <Info label="Method" v={s.response.response_method} />
            <Info label="Entries exported" v={s.response.entries_exported} />
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-4 mt-4">
        <h3 className="font-bold mb-2 text-sm">Audit trail</h3>
        <div className="space-y-1.5" data-testid="audit-trail">
          {(s.audit_log || []).map((a, i) => (
            <div key={i} className="text-xs flex gap-3">
              <span className="text-slate-500 font-mono w-36">{(a.at || '').slice(0, 16).replace('T', ' ')}</span>
              <span className="text-coral-700 font-bold uppercase tracking-wider text-[10px] w-24">{a.action}</span>
              <span className="text-slate-600 flex-1">{a.detail}</span>
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
function Field({ label, full, children }) {
  return <div className={full ? 'sm:col-span-2' : ''}><label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>{children}</div>;
}
function Info({ label, v, full }) {
  return <div className={full ? 'sm:col-span-2' : ''}><span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold block">{label}</span><span className="text-slate-200 break-words">{v}</span></div>;
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
