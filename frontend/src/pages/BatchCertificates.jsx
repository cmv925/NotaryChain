import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, FileBox, CheckSquare, Square, ScrollText, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/admin/batch-certificates`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
});

/**
 * Admin tool — pick multiple sealed ceremonies and download a single ZIP
 * containing each certificate PDF + a combined PDF + manifest.csv.
 */
export default function BatchCertificates() {
  const navigate = useNavigate();
  const [ceremonies, setCeremonies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [filterText, setFilterText] = useState('');

  const fetchEligible = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/eligible`, { headers: authHeaders() });
      setCeremonies(res.data.ceremonies || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load ceremonies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEligible(); /* mount-only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!filterText) return ceremonies;
    const q = filterText.toLowerCase();
    return ceremonies.filter(c =>
      (c.document_name || '').toLowerCase().includes(q) ||
      (c.signer_name || '').toLowerCase().includes(q) ||
      (c.initiated_by || '').toLowerCase().includes(q) ||
      (c.ceremony_id || '').toLowerCase().includes(q)
    );
  }, [ceremonies, filterText]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.ceremony_id)));
    }
  };

  const generate = async () => {
    if (selected.size === 0) {
      toast.warning('Pick at least one ceremony.');
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/generate`,
        { ceremony_ids: Array.from(selected) },
        { headers: authHeaders(), responseType: 'blob' },
      );
      const batchId = res.headers['x-batch-id'] || 'batch';
      const count = res.headers['x-batch-count'];
      const failed = res.headers['x-batch-failed'];
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${batchId}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Bundled ${count} certificate(s)${Number(failed) > 0 ? ` · ${failed} failed` : ''}.`);
    } catch (e) {
      let msg = 'Batch generation failed';
      if (e.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).detail?.message || msg; } catch (_) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} data-testid="batch-cert-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-coral-600">Admin Tool</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-navy-900 flex items-center gap-2">
              <FileBox className="w-6 h-6 text-coral-600" /> Batch Certificate Generation
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Select sealed ceremonies and download a single ZIP with each PDF certificate, a combined PDF, and a manifest.
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-4 border-slate-200">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filter by document, signer or ID…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9"
                data-testid="batch-cert-filter"
              />
            </div>
            <Button variant="outline" onClick={fetchEligible} disabled={loading} data-testid="batch-cert-refresh">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={toggleAll} data-testid="batch-cert-toggle-all">
              {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />}
              {selected.size === filtered.length && filtered.length > 0 ? 'Unselect all' : 'Select all (filtered)'}
            </Button>
            <div className="text-xs text-slate-500 ml-1">
              <span className="font-bold text-navy-900">{selected.size}</span> of <span className="font-bold text-navy-900">{filtered.length}</span> selected
            </div>
            <Button
              onClick={generate}
              disabled={generating || selected.size === 0}
              className="ml-auto bg-coral-500 hover:bg-coral-600"
              data-testid="batch-cert-generate-btn"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {generating ? 'Bundling…' : `Download ZIP (${selected.size})`}
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-slate-200">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading sealed ceremonies…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No matching ceremonies.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-cream-200/40 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  <div className="col-span-1"></div>
                  <div className="col-span-4">Document</div>
                  <div className="col-span-3">Signer</div>
                  <div className="col-span-2">Sealed</div>
                  <div className="col-span-2">Result</div>
                </div>
                {filtered.map(c => {
                  const checked = selected.has(c.ceremony_id);
                  return (
                    <button
                      key={c.ceremony_id}
                      onClick={() => toggle(c.ceremony_id)}
                      className={`w-full grid grid-cols-12 gap-3 px-4 py-3 text-left items-center transition-colors ${
                        checked ? 'bg-coral-50/60 hover:bg-coral-100/60' : 'hover:bg-slate-50'
                      }`}
                      data-testid={`batch-cert-row-${c.ceremony_id}`}
                    >
                      <div className="col-span-1">
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-coral-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">{c.document_name || '—'}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{c.ceremony_id}</p>
                      </div>
                      <div className="col-span-3 text-sm text-slate-700 truncate">{c.signer_name || '—'}</div>
                      <div className="col-span-2 text-xs font-mono text-slate-500">
                        {c.created_at?.slice(0, 10) || '—'}
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          c.consensus_result === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          c.consensus_result === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {c.consensus_result || 'pending'}
                        </span>
                        {c.has_certificate && (
                          <span className="ml-1 text-[9px] text-emerald-600">cached</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-400 mt-4 text-center">
          ZIP contents: <code className="font-mono">certificates/*.pdf</code>, <code className="font-mono">combined_certificates.pdf</code>,
          {' '}<code className="font-mono">cover.pdf</code>, <code className="font-mono">manifest.csv</code>, <code className="font-mono">MANIFEST.txt</code>
        </p>
      </div>
    </div>
  );
}
