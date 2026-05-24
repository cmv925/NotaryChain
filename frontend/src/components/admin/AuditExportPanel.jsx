import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, ShieldCheck, FileLock2, History, Anchor } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/admin/audit-export`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
});

/**
 * Tamper-evident audit log export (SOC 2 / ISO 27001).
 *  - Filters → server walks audit_logs in order, builds a sha256 hash chain,
 *  - anchors the root hash on Hedera HCS, and returns a ZIP bundle
 *    (audit_log.csv + audit_log.json + MANIFEST.txt).
 */
export default function AuditExportPanel() {
  const [filters, setFilters] = useState({
    start_date: '', end_date: '', actor: '', action: '', severity: '',
  });
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const buildQS = () => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.append(k, v); });
    return qs.toString();
  };

  const runPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await axios.get(`${API}/preview?${buildQS()}`, { headers: authHeaders() });
      setPreview(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
    } finally {
      setLoadingPreview(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const res = await axios.post(`${API}/generate?${buildQS()}`, null, {
        headers: authHeaders(), responseType: 'blob',
      });
      const exportId = res.headers['x-export-id'] || 'audit_export';
      const rootHash = res.headers['x-root-hash'];
      const rowCount = res.headers['x-row-count'];
      const hederaTx = res.headers['x-hedera-tx'];
      // Trigger download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${exportId}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(
        `Exported ${rowCount} rows · root=${rootHash?.slice(0, 12)}…` +
        (hederaTx ? ` · Hedera ✓` : ' · Hedera offline')
      );
      if (showHistory) fetchHistory();
    } catch (e) {
      // Blob error responses need a manual read
      let msg = 'Export failed';
      if (e.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).detail || msg; } catch (_) { /* ignore */ }
      } else {
        msg = e.response?.data?.detail || msg;
      }
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/history`, { headers: authHeaders() });
      setHistory(res.data.exports || []);
    } catch (_) {
      setHistory([]);
    }
  };

  useEffect(() => { runPreview(); /* mount-only preview */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="bg-white border-slate-200" data-testid="audit-export-panel">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-coral-600" />
              SOC 2 / ISO Audit Log Export
            </h3>
            <p className="text-slate-500 text-xs mt-1 max-w-2xl">
              Build a tamper-evident bundle: every row is hash-linked to the previous (SHA-256
              chain), the bundle's root hash is anchored on Hedera HCS, and the ZIP includes
              CSV + JSON + a verification MANIFEST.
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => { setShowHistory(s => !s); if (!showHistory) fetchHistory(); }}
            data-testid="audit-export-history-btn"
          >
            <History className="w-4 h-4 mr-1" /> History
          </Button>
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Start date</label>
            <Input type="date" value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
              data-testid="audit-export-start" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">End date</label>
            <Input type="date" value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
              data-testid="audit-export-end" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Actor (email)</label>
            <Input placeholder="user@…" value={filters.actor}
              onChange={e => setFilters(f => ({ ...f, actor: e.target.value }))}
              data-testid="audit-export-actor" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Action</label>
            <Input placeholder="login, seal, …" value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              data-testid="audit-export-action" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Severity</label>
            <select
              value={filters.severity}
              onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
              data-testid="audit-export-severity"
            >
              <option value="">Any</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button onClick={runPreview} variant="outline" size="sm" disabled={loadingPreview} data-testid="audit-export-preview-btn">
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingPreview ? 'animate-spin' : ''}`} />
            Preview
          </Button>
          <Button onClick={runExport} disabled={exporting || !preview?.total_rows} className="bg-coral-500 hover:bg-coral-600" data-testid="audit-export-generate-btn">
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? 'Generating…' : `Export ZIP (${preview?.total_rows || 0} rows)`}
          </Button>
          {preview?.total_rows === 0 && (
            <span className="text-xs text-slate-500">No rows match these filters.</span>
          )}
        </div>

        {/* Preview sample */}
        {preview?.sample?.length > 0 && (
          <div className="bg-cream-100 border border-slate-200 rounded-lg p-3 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Preview — first {preview.sample.length} rows</p>
            <div className="space-y-1.5">
              {preview.sample.map((r) => (
                <div key={r.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.severity === 'critical' ? 'bg-red-500' : r.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <span className="text-slate-500 font-mono">{r.timestamp?.slice(0, 19)}</span>
                  <span className="font-medium text-navy-900">{r.action}</span>
                  <span className="text-slate-500 truncate">{r.user_email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {showHistory && (
          <div className="border-t border-slate-200 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <FileLock2 className="w-4 h-4 text-slate-500" />
                Previous Exports
              </h4>
              <Button size="sm" variant="outline" onClick={fetchHistory}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No exports yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.export_id} className="bg-cream-100 rounded p-2 text-xs flex items-center justify-between gap-2" data-testid="audit-export-history-row">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-navy-900 truncate">{h.export_id}</p>
                      <p className="text-slate-500 truncate">
                        {h.generated_at?.slice(0, 19)} · {h.row_count} rows · {h.generated_by}
                      </p>
                      <p className="font-mono text-[10px] text-coral-700 truncate">root: {h.root_hash}</p>
                    </div>
                    {h.hedera_tx_id ? (
                      <div className="flex items-center gap-1 text-emerald-600 flex-shrink-0">
                        <Anchor className="w-3 h-3" />
                        <span className="text-[10px]">anchored</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">no anchor</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
