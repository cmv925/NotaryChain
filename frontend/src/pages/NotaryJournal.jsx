import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { NotificationBell } from '../components/NotificationBell';
import {
  BookOpen, ArrowLeft, Search, Plus, FileText, DollarSign,
  Calendar, User, ChevronLeft, ChevronRight, X, Shield
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NotaryJournal = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    document_type: 'affidavit', document_name: '', signer_name: '',
    signer_address: '', identification_type: 'drivers_license',
    identification_number: '', notarization_type: 'acknowledgment',
    fee_charged: 0, notes: '',
  });
  const [saving, setSaving] = useState(false);

  const pageSize = 15;

  useEffect(() => { fetchEntries(); fetchStats(); }, [page, search]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: pageSize });
      if (search) params.set('search', search);
      const res = await axios.get(`${API}/notary/professional/journal?${params}`, { headers });
      setEntries(res.data.entries);
      setTotal(res.data.total);
    } catch {}
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/notary/professional/journal/stats`, { headers });
      setStats(res.data);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.document_name || !form.signer_name) {
      toast({ title: 'Error', description: 'Document name and signer name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/notary/professional/journal`, form, { headers });
      toast({ title: 'Entry Added', description: 'Journal entry created successfully' });
      setShowAdd(false);
      setForm({ document_type: 'affidavit', document_name: '', signer_name: '', signer_address: '', identification_type: 'drivers_license', identification_number: '', notarization_type: 'acknowledgment', fee_charged: 0, notes: '' });
      fetchEntries();
      fetchStats();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to create entry', variant: 'destructive' });
    }
    setSaving(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/notary/dashboard')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <h1 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <BookOpen className="w-5 h-5 text-[#00d4aa]" /> Notary Journal
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell token={token} />
              <Button onClick={() => setShowAdd(true)} size="sm" className="bg-[#00d4aa] text-black hover:bg-[#00b894]" data-testid="add-entry-btn">
                <Plus className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">New Entry</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="journal-stats">
            {[
              { label: 'Total Entries', value: stats.total_entries, icon: BookOpen },
              { label: 'This Month', value: stats.this_month, icon: Calendar },
              { label: 'Total Fees', value: `$${stats.total_fees?.toFixed(2) || '0.00'}`, icon: DollarSign },
              { label: 'Doc Types', value: Object.keys(stats.by_document_type || {}).length, icon: FileText },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[#00d4aa] flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-lg font-bold text-white">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by signer or document..."
              className="pl-10 bg-[#1a2332] border-gray-700 text-white"
              data-testid="journal-search"
            />
          </div>
        </div>

        {/* Entries Table */}
        <Card className="bg-[#1a2332] border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="journal-table">
              <thead className="bg-[#0d1b2a] text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Signer</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No journal entries yet</td></tr>
                ) : entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-800 hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.entry_number}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium truncate max-w-[200px]">{e.document_name}</p>
                      <p className="text-gray-500 text-xs">{e.document_type}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{e.signer_name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{e.notarization_type}</td>
                    <td className="px-4 py-3 text-right text-[#00d4aa] font-medium">${e.fee_charged?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm">
              <span className="text-gray-500">Page {page} of {totalPages} ({total} entries)</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-gray-400"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="text-gray-400"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add Entry Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-[#1a2332] border-gray-700" data-testid="add-entry-modal">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">New Journal Entry</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Document Name *</label>
                    <Input value={form.document_name} onChange={e => setForm({...form, document_name: e.target.value})} className="bg-[#0d1b2a] border-gray-700 text-white text-sm" required data-testid="entry-doc-name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Document Type</label>
                    <select value={form.document_type} onChange={e => setForm({...form, document_type: e.target.value})} className="w-full bg-[#0d1b2a] border border-gray-700 text-white text-sm rounded-md px-3 py-2">
                      {['affidavit','power_of_attorney','deed','contract','will','trust','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Signer Name *</label>
                    <Input value={form.signer_name} onChange={e => setForm({...form, signer_name: e.target.value})} className="bg-[#0d1b2a] border-gray-700 text-white text-sm" required data-testid="entry-signer" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Fee Charged ($)</label>
                    <Input type="number" step="0.01" min="0" value={form.fee_charged} onChange={e => setForm({...form, fee_charged: parseFloat(e.target.value) || 0})} className="bg-[#0d1b2a] border-gray-700 text-white text-sm" data-testid="entry-fee" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">ID Type</label>
                    <select value={form.identification_type} onChange={e => setForm({...form, identification_type: e.target.value})} className="w-full bg-[#0d1b2a] border border-gray-700 text-white text-sm rounded-md px-3 py-2">
                      {['drivers_license','passport','state_id','military_id','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Notarization Type</label>
                    <select value={form.notarization_type} onChange={e => setForm({...form, notarization_type: e.target.value})} className="w-full bg-[#0d1b2a] border border-gray-700 text-white text-sm rounded-md px-3 py-2">
                      {['acknowledgment','jurat','oath','affirmation','copy_certification','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full bg-[#0d1b2a] border border-gray-700 text-white text-sm rounded-md px-3 py-2 h-16 resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} className="text-gray-400">Cancel</Button>
                  <Button type="submit" disabled={saving} className="bg-[#00d4aa] text-black hover:bg-[#00b894]" data-testid="save-entry-btn">
                    {saving ? 'Saving...' : 'Save Entry'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NotaryJournal;
