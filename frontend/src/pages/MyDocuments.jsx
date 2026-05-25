/**
 * MyDocuments — Client Portal
 * Unified hub at /my-documents showing all of a user's documents:
 *   • Sealed documents (blockchain timestamps)
 *   • Notarization requests (pending / completed / signed)
 *   • Asset vault items (SALV — read-only summary)
 *   • Beneficiary handoffs received
 * Search + filter by type, status, date range.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Shield, FileText, Search, Filter, ExternalLink, Copy, Video, CheckCircle2, Clock, AlertTriangle, Vault, Heart, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_PILL = {
  sealed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_session: 'bg-coral-50 text-coral-700 border-coral-200',
  assigned: 'bg-coral-50 text-coral-700 border-coral-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-coral-50 text-coral-700 border-coral-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200',
};

const TYPE_META = {
  seal: { label: 'Sealed', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ceremony: { label: 'Notarized', icon: FileText, color: 'text-coral-600', bg: 'bg-coral-50', border: 'border-coral-200' },
  asset: { label: 'Vault Asset', icon: Vault, color: 'text-navy-700', bg: 'bg-navy-50', border: 'border-slate-200' },
  handoff: { label: 'Handoff', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
};

export default function MyDocuments() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [seals, setSeals] = useState([]);
  const [ceremonies, setCeremonies] = useState([]);
  const [assets, setAssets] = useState([]);
  const [handoffs, setHandoffs] = useState([]);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sealsRes, ceremoniesRes, vaultRes, handoffsRes] = await Promise.all([
          axios.get(`${API}/documents/seals?limit=100`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/notary/requests/my`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salv/vault`, { headers }).catch(() => ({ data: { assets: [] } })),
          axios.get(`${API}/salv/handoffs/received`, { headers }).catch(() => ({ data: { beneficiaries: [] } })),
        ]);
        setSeals(sealsRes.data || []);
        setCeremonies(ceremoniesRes.data || []);
        setAssets(vaultRes.data?.assets || []);
        setHandoffs(handoffsRes.data?.beneficiaries || []);
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to load documents', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const unified = useMemo(() => {
    const items = [];
    seals.forEach(s => items.push({
      _kind: 'seal',
      _id: s.sha256_hash || s.transaction_id,
      title: s.file_name || 'Sealed document',
      status: 'sealed',
      timestamp: s.timestamp,
      meta: { hash: s.sha256_hash, tx: s.transaction_id, size: s.file_size },
    }));
    ceremonies.forEach(c => items.push({
      _kind: 'ceremony',
      _id: c.id,
      title: c.document_name,
      subtitle: c.document_type,
      status: c.status || 'pending',
      timestamp: c.created_at,
      meta: { request_id: c.id, hcs_topic_id: c.hcs_topic_id },
    }));
    (assets || []).forEach(a => items.push({
      _kind: 'asset',
      _id: a.asset_id,
      title: a.title,
      subtitle: a.asset_type,
      status: a.status || 'active',
      timestamp: a.created_at,
      meta: { value: a.value_estimate_usd, jurisdiction: a.jurisdiction },
    }));
    (handoffs || []).forEach(h => items.push({
      _kind: 'handoff',
      _id: h.beneficiary_id,
      title: h.asset_title || 'Asset handoff',
      subtitle: `${(h.share_percent || 0).toFixed(0)}% share`,
      status: h.status || 'active',
      timestamp: h.created_at,
      meta: { share: h.share_percent, relationship: h.relationship },
    }));
    return items.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [seals, ceremonies, assets, handoffs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unified.filter(it => {
      if (filterType !== 'all' && it._kind !== filterType) return false;
      if (filterStatus !== 'all' && it.status !== filterStatus) return false;
      if (!q) return true;
      return (
        (it.title || '').toLowerCase().includes(q) ||
        (it.subtitle || '').toLowerCase().includes(q) ||
        (it.meta?.hash || '').toLowerCase().includes(q) ||
        (it.meta?.tx || '').toLowerCase().includes(q)
      );
    });
  }, [unified, search, filterType, filterStatus]);

  const counts = useMemo(() => ({
    all: unified.length,
    seal: unified.filter(i => i._kind === 'seal').length,
    ceremony: unified.filter(i => i._kind === 'ceremony').length,
    asset: unified.filter(i => i._kind === 'asset').length,
    handoff: unified.filter(i => i._kind === 'handoff').length,
  }), [unified]);

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const exportCSV = () => {
    const rows = [['Type', 'Title', 'Status', 'Date', 'Reference']];
    filtered.forEach(it => {
      rows.push([
        TYPE_META[it._kind]?.label || it._kind,
        it.title,
        it.status,
        it.timestamp ? new Date(it.timestamp).toISOString() : '',
        it.meta?.hash || it.meta?.tx || it.meta?.request_id || it._id || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `my-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100" data-testid="my-documents-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-slate-300 text-navy-900 hover:bg-cream-200/50" data-testid="back-to-dashboard-btn">
            ← Dashboard
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Title + filters */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-4xl text-navy-900 tracking-tight mb-1">My Documents</h1>
            <p className="text-slate-600 text-sm">Every sealed document, notarization, vault asset, and beneficiary handoff in one place.</p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="border-slate-300 text-navy-900 hover:bg-cream-200/50" data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Category strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="category-strip">
          {[
            { id: 'all', label: 'All', count: counts.all, color: 'navy' },
            { id: 'seal', label: 'Sealed', count: counts.seal, color: 'emerald' },
            { id: 'ceremony', label: 'Notarized', count: counts.ceremony, color: 'coral' },
            { id: 'asset', label: 'Vault', count: counts.asset, color: 'navy' },
            { id: 'handoff', label: 'Handoffs', count: counts.handoff, color: 'rose' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setFilterType(c.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                filterType === c.id
                  ? 'bg-navy-900 border-navy-900 text-cream-100'
                  : 'bg-white border-slate-200 text-navy-900 hover:border-slate-300'
              }`}
              data-testid={`filter-tab-${c.id}`}
            >
              <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-1 ${filterType === c.id ? 'text-cream-200/70' : 'text-slate-500'}`}>{c.label}</div>
              <div className="font-serif text-3xl">{c.count}</div>
            </button>
          ))}
        </div>

        {/* Search + status filter */}
        <Card className="bg-white border-slate-200 mb-6 p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by title, hash, transaction ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 border-slate-300"
              data-testid="search-input"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="flex h-10 rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm appearance-none"
              data-testid="filter-status"
            >
              <option value="all">All statuses</option>
              <option value="sealed">Sealed</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="in_session">In session</option>
              <option value="assigned">Assigned</option>
              <option value="active">Active</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </Card>

        {/* Results list */}
        {filtered.length === 0 ? (
          <Card className="bg-white border-slate-200 p-16 text-center" data-testid="empty-state">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="font-serif text-2xl text-navy-900 mb-1">No documents found</h3>
            <p className="text-slate-600 text-sm mb-6">
              {search || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search or filters.'
                : "You haven't created any documents yet."}
            </p>
            <Button onClick={() => navigate('/dashboard')} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="empty-action-btn">
              Seal your first document
            </Button>
          </Card>
        ) : (
          <Card className="bg-white border-slate-200 overflow-hidden">
            <div className="px-6 py-3 bg-cream-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Showing {filtered.length} of {unified.length} {filtered.length === 1 ? 'item' : 'items'}
            </div>
            <ul className="divide-y divide-slate-200">
              {filtered.map((it, idx) => {
                const meta = TYPE_META[it._kind] || TYPE_META.seal;
                const Icon = meta.icon;
                const statusClass = STATUS_PILL[it.status] || STATUS_PILL.default;
                return (
                  <li key={`${it._kind}-${it._id}-${idx}`} className="px-6 py-4 hover:bg-cream-50/50 transition-colors" data-testid={`doc-row-${it._kind}-${idx}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] uppercase tracking-wider font-bold ${meta.color}`}>{meta.label}</span>
                          {it.subtitle && <span className="text-[11px] text-slate-500">· {it.subtitle}</span>}
                        </div>
                        <h3 className="text-sm font-medium text-navy-900 truncate">{it.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                          <span>{it.timestamp ? new Date(it.timestamp).toLocaleString() : '—'}</span>
                          {it.meta?.hash && (
                            <span className="flex items-center gap-1">
                              <code className="font-mono text-[10px] bg-cream-100 px-1.5 py-0.5 rounded">{it.meta.hash.slice(0, 12)}…</code>
                              <button onClick={() => copyText(it.meta.hash, 'Hash')} className="hover:text-navy-900"><Copy className="w-3 h-3" /></button>
                            </span>
                          )}
                          {it.meta?.tx && (
                            <a href={`https://hashscan.io/mainnet/transaction/${it.meta.tx}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-navy-900">
                              <code className="font-mono text-[10px] bg-cream-100 px-1.5 py-0.5 rounded">{it.meta.tx.slice(0, 14)}…</code>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {it.meta?.value && <span>${Number(it.meta.value).toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${statusClass}`}>
                          {String(it.status).replace('_', ' ')}
                        </span>
                        {it._kind === 'ceremony' && (it.status === 'pending' || it.status === 'assigned' || it.status === 'in_session') && (
                          <Button size="sm" onClick={() => navigate(`/session/${it.meta.request_id}`)} className="bg-coral-500 hover:bg-coral-600 text-white h-7 text-[10px]" data-testid={`open-session-${idx}`}>
                            {it.status === 'in_session' ? <><Video className="w-3 h-3 mr-1" /> Join</> : 'Open'}
                          </Button>
                        )}
                        {it._kind === 'asset' && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/asset-vault`)} className="border-slate-300 text-navy-900 h-7 text-[10px]" data-testid={`view-asset-${idx}`}>
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Bottom CTA strip */}
        <div className="mt-10 grid md:grid-cols-3 gap-4" data-testid="cta-strip">
          <CTACard icon={Shield} title="Seal a new document" desc="Get a blockchain timestamp in 60 seconds." onClick={() => navigate('/demo')} testid="cta-seal" />
          <CTACard icon={FileText} title="Request notarization" desc="Full RON ceremony with a licensed notary." onClick={() => navigate('/request-notarization')} testid="cta-notarize" />
          <CTACard icon={Vault} title="Add to Asset Vault" desc="Protect long-lived deeds, wills, and IP." onClick={() => navigate('/asset-vault')} testid="cta-vault" />
        </div>
      </div>
    </div>
  );
}

function CTACard({ icon: Icon, title, desc, onClick, testid }) {
  return (
    <button onClick={onClick} className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-coral-300 hover:shadow-md transition-all" data-testid={testid}>
      <div className="w-10 h-10 rounded-lg bg-coral-50 border border-coral-200 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-coral-600" />
      </div>
      <h3 className="font-serif text-lg text-navy-900 mb-1">{title}</h3>
      <p className="text-slate-600 text-[13px]">{desc}</p>
    </button>
  );
}
