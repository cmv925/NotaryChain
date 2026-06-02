import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Download, BookOpen, ChevronLeft, Loader2, Search, Plus, FileText, ShieldCheck, Video } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const ACT_TYPES = [
  { id: '', label: 'All acts' },
  { id: 'acknowledgment', label: 'Acknowledgment' },
  { id: 'jurat', label: 'Jurat' },
  { id: 'oath_affirmation', label: 'Oath / Affirmation' },
  { id: 'signature_witnessing', label: 'Signature witnessing' },
  { id: 'copy_certification', label: 'Copy certification' },
  { id: 'online_will', label: 'Online will' },
  { id: 'other', label: 'Other' },
];

export default function NotaryFLJournal() {
  const { token, isAuthenticated, user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actType, setActType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [recordings, setRecordings] = useState({});

  const fetchRecordings = useCallback(async (ents) => {
    const refs = [...new Set((ents || []).map(e => e.ceremony_id).filter(Boolean))];
    if (refs.length === 0) { setRecordings({}); return; }
    try {
      const r = await fetch(`${API}/api/ceremony-videos/by-references`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_ids: refs }),
      });
      const d = await r.json();
      setRecordings(d.recordings || {});
    } catch { /* ignore */ }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (actType) params.set('notarial_act_type', actType);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const r = await fetch(`${API}/api/fl/journal/entries?${params}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setEntries(d.entries || []);
      setTotal(d.total || 0);
    } catch (e) { toast.error('Load failed'); }
    setLoading(false);
  }, [token, actType, startDate, endDate]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  useEffect(() => { fetchRecordings(entries); }, [entries, fetchRecordings]);

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const r = await fetch(`${API}/api/fl/journal/export.csv?${params}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fl_journal_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Journal exported');
    } catch (e) { toast.error(e.message); }
  };

  if (!isAuthenticated) {
    return <Shell><Card className="bg-white border-slate-200 max-w-md mx-auto"><CardContent className="p-8 text-center"><p>Sign in required</p><Link to="/login"><Button className="mt-3 bg-coral-500 hover:bg-coral-500">Sign in</Button></Link></CardContent></Card></Shell>;
  }
  if (user?.role !== 'notary' && user?.role !== 'admin') {
    return <Shell><Card className="bg-white border-slate-200 max-w-md mx-auto"><CardContent className="p-8 text-center"><p>This page is for FL notaries.</p></CardContent></Card></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto" data-testid="fl-journal-page">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-5 h-5 text-coral-600" />
              <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Notary Journal</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="w-7 h-7 text-coral-600" /> My FL journal</h1>
            <p className="text-slate-600 text-sm mt-1">FL Stat. 117.245 — tamper-evident notarial journal · 10-year retention.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-coral-500" data-testid="new-entry-btn"><Plus className="w-4 h-4 mr-1" />New entry</Button>
            <Button onClick={exportCSV} variant="outline" className="bg-white border-slate-300 text-navy-900 hover:bg-cream-200" data-testid="export-csv-btn"><Download className="w-4 h-4 mr-1" />Export CSV</Button>
          </div>
        </div>

        <Card className="bg-white border-slate-200 mb-4">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <FilterField label="Act type">
              <select value={actType} onChange={e => setActType(e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-9 text-sm text-navy-900 w-full" data-testid="filter-act-type">
                {ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Start date">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-cream-100/60 border-slate-200 text-sm h-9" data-testid="filter-start" />
            </FilterField>
            <FilterField label="End date">
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-cream-100/60 border-slate-200 text-sm h-9" data-testid="filter-end" />
            </FilterField>
            <FilterField label=" ">
              <Button onClick={load} variant="outline" className="bg-cream-100/60 border-slate-300 text-navy-900 hover:bg-cream-200 h-9" data-testid="refresh-btn"><Search className="w-3 h-3 mr-1" /> Apply</Button>
            </FilterField>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Entries</h2>
              <span className="text-xs text-slate-600" data-testid="entry-count">{loading ? <Loader2 className="w-3 h-3 inline animate-spin" /> : `${entries.length} of ${total}`}</span>
            </div>
            {entries.length === 0 && !loading && (
              <div className="p-12 text-center text-slate-500 text-sm" data-testid="no-entries">
                <FileText className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                No journal entries yet. Sealed FL ceremonies are auto-logged here.
              </div>
            )}
            {entries.map(e => {
              const rec = recordings[e.ceremony_id];
              return (
              <div key={e.entry_id} className="px-5 py-3 border-b border-slate-200/60 hover:bg-cream-200 grid grid-cols-12 gap-3 text-xs items-center" data-testid={`entry-${e.entry_id}`}>
                <span className="text-slate-500 col-span-2 font-mono">{(e.recorded_at || '').slice(0, 16).replace('T', ' ')}</span>
                <span className="col-span-2"><span className="px-2 py-0.5 rounded bg-coral-500/15 text-coral-700 text-[10px] uppercase tracking-wider font-bold">{(e.notarial_act_type || '').replace(/_/g, ' ')}</span></span>
                <span className="col-span-2 text-navy-900 truncate">{e.signer_name}</span>
                <span className="col-span-3 text-slate-600 truncate">{e.document_description}</span>
                <span className="col-span-1 text-coral-700 font-mono text-right">${(e.fee_charged_usd || 0).toFixed(2)}</span>
                <span className="col-span-2 flex items-center justify-end gap-2">
                  {e.hedera_seal_hash && <span className="text-[10px] text-coral-600 font-bold">SEALED</span>}
                  {rec?.content_hash ? (
                    <a
                      href={`/verify/recording/${rec.content_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Recording anchored on-chain — click to verify"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                      data-testid={`entry-recording-${e.entry_id}`}
                    >
                      <Video className="w-3 h-3" /> REC <ShieldCheck className="w-3 h-3" />
                    </a>
                  ) : null}
                </span>
              </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-[10px] text-slate-600 mt-4">Retention: every entry locked for 10 years (FL Stat. 117.305). Exports include retention dates for audit.</p>

        {showCreate && (
          <NewEntryModal token={token} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
        )}
      </div>
    </Shell>
  );
}

function NewEntryModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({
    ceremony_id: '', notarial_act_type: 'acknowledgment', document_description: '',
    signer_name: '', signer_address: '', signer_id_type: 'DL', signer_id_number_last4: '',
    signer_id_issuer: 'FL', signer_id_expires: '', fee_charged_usd: 10, notes: '',
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/fl/journal/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fee_charged_usd: parseFloat(form.fee_charged_usd) || 0 }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Save failed');
      toast.success('Entry recorded');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="new-entry-modal">
      <Card className="bg-white border-slate-200 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-1">New journal entry</h2>
          <p className="text-xs text-slate-500 mb-4">FL Stat. 117.245 — required fields below.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Field label="Ceremony ID"><Input value={form.ceremony_id} onChange={e => update('ceremony_id', e.target.value)} placeholder="cer-…" className="bg-cream-100/60 border-slate-200" data-testid="entry-ceremony" /></Field>
            <Field label="Act type">
              <select value={form.notarial_act_type} onChange={e => update('notarial_act_type', e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="entry-act-type">
                {ACT_TYPES.filter(t => t.id).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Document description" full>
              <Input value={form.document_description} onChange={e => update('document_description', e.target.value)} placeholder="Warranty deed for 123 Oak St, Tampa FL…" className="bg-cream-100/60 border-slate-200" data-testid="entry-doc" />
            </Field>
            <Field label="Signer name"><Input value={form.signer_name} onChange={e => update('signer_name', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-signer-name" /></Field>
            <Field label="Signer address"><Input value={form.signer_address} onChange={e => update('signer_address', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-signer-addr" /></Field>
            <Field label="ID type">
              <select value={form.signer_id_type} onChange={e => update('signer_id_type', e.target.value)} className="bg-cream-100/60 border border-slate-200 rounded-md px-3 h-10 text-sm text-navy-900 w-full" data-testid="entry-id-type">
                <option>DL</option><option>PASSPORT</option><option>STATE_ID</option><option>MILITARY</option><option>OTHER</option>
              </select>
            </Field>
            <Field label="ID number (last 4)"><Input maxLength={4} value={form.signer_id_number_last4} onChange={e => update('signer_id_number_last4', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-id-last4" /></Field>
            <Field label="ID issuer"><Input value={form.signer_id_issuer} onChange={e => update('signer_id_issuer', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-id-issuer" /></Field>
            <Field label="ID expires"><Input type="date" value={form.signer_id_expires} onChange={e => update('signer_id_expires', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-id-exp" /></Field>
            <Field label="Fee (USD)"><Input type="number" step="0.01" value={form.fee_charged_usd} onChange={e => update('fee_charged_usd', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-fee" /></Field>
            <Field label="Notes" full><Input value={form.notes} onChange={e => update('notes', e.target.value)} className="bg-cream-100/60 border-slate-200" data-testid="entry-notes" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="bg-cream-200 border-slate-300 text-navy-900 hover:bg-cream-200">Cancel</Button>
            <Button onClick={save} disabled={saving || !form.ceremony_id || !form.signer_name || !form.document_description} className="bg-coral-500 hover:bg-coral-500" data-testid="save-entry-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save entry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>
      {children}
    </div>
  );
}
function FilterField({ label, children }) {
  return <div><label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>{children}</div>;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}
