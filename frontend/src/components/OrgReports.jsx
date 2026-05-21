import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import {
  FileBarChart, Download, Trash2, Loader2, Settings, Plus,
  Calendar, Clock, CheckCircle, Eye, ChevronDown, ChevronUp,
  BarChart3, Users, Webhook, CreditCard, Activity,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SECTION_ICONS = {
  activity: Activity,
  notarizations: FileBarChart,
  members: Users,
  webhooks: Webhook,
  billing: CreditCard,
};

const OrgReports = ({ orgId, token }) => {
  const [config, setConfig] = useState(null);
  const [reports, setReports] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState({});
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  // Config form state
  const [cfgFrequency, setCfgFrequency] = useState('weekly');
  const [cfgSections, setCfgSections] = useState(new Set());
  const [cfgActive, setCfgActive] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cfgRes, reportsRes, sectionsRes] = await Promise.all([
        axios.get(`${API}/organizations/${orgId}/reports/config`, { headers }),
        axios.get(`${API}/organizations/${orgId}/reports?page_size=20`, { headers }),
        axios.get(`${API}/organizations/${orgId}/reports/sections`, { headers }),
      ]);
      setConfig(cfgRes.data);
      setReports(reportsRes.data.reports);
      setSections(sectionsRes.data.sections);
      if (cfgRes.data.configured) {
        setCfgFrequency(cfgRes.data.frequency || 'weekly');
        setCfgSections(new Set(cfgRes.data.sections || []));
        setCfgActive(cfgRes.data.is_active !== false);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/organizations/${orgId}/reports/generate`, {}, { headers });
      toast({ title: 'Report Generated', description: 'Your report is ready for download.' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId, filename) => {
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/reports/${reportId}/download`, {
        headers, responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Download failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await axios.delete(`${API}/organizations/${orgId}/reports/${reportId}`, { headers });
      toast({ title: 'Deleted' });
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleExpand = async (reportId) => {
    if (expandedReport === reportId) { setExpandedReport(null); return; }
    setExpandedReport(reportId);
    if (!reportDetail[reportId]) {
      try {
        const res = await axios.get(`${API}/organizations/${orgId}/reports/${reportId}`, { headers });
        setReportDetail(prev => ({ ...prev, [reportId]: res.data }));
      } catch {}
    }
  };

  const handleSaveConfig = async () => {
    if (cfgSections.size === 0) { toast({ title: 'Error', description: 'Select at least one section', variant: 'destructive' }); return; }
    setSavingConfig(true);
    try {
      await axios.post(`${API}/organizations/${orgId}/reports/config`, {
        frequency: cfgFrequency,
        sections: Array.from(cfgSections),
        is_active: cfgActive,
      }, { headers });
      toast({ title: 'Saved', description: 'Report schedule updated.' });
      setShowConfig(false);
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleSection = (key) => {
    setCfgSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const formatDate = (ts) => {
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" /></div>;

  return (
    <div data-testid="org-reports">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-violet-400" /> Scheduled Reports
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            {config?.configured
              ? <span>Generating <span className="text-violet-400">{config.frequency}</span> reports with {config.sections?.length} sections {config.is_active ? '(active)' : '(paused)'}</span>
              : 'Configure automatic report generation'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowConfig(!showConfig)} className="border-slate-200 text-slate-500 text-xs" data-testid="configure-reports-btn">
            <Settings className="w-3.5 h-3.5 mr-1" /> Configure
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="generate-report-btn">
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Generate Now
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="mb-4 p-4 bg-cream-100 rounded-lg border border-violet-500/20" data-testid="report-config-panel">
          <h4 className="text-white text-sm font-medium mb-3">Report Schedule</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-slate-500 text-xs block mb-1">Frequency</label>
                <div className="flex gap-2">
                  {['weekly', 'monthly'].map(f => (
                    <button key={f} onClick={() => setCfgFrequency(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${cfgFrequency === f ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-200'}`}
                      data-testid={`freq-${f}`}
                    >
                      <Calendar className="w-3 h-3 inline mr-1" /> {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-500 text-xs block mb-1">Status</label>
                <button onClick={() => setCfgActive(!cfgActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cfgActive ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-slate-500'}`}
                  data-testid="toggle-report-active"
                >
                  {cfgActive ? 'Active' : 'Paused'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1.5">Report Sections</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sections.map(s => {
                  const Icon = SECTION_ICONS[s.key] || FileBarChart;
                  return (
                    <label key={s.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-xs ${cfgSections.has(s.key) ? 'bg-violet-500/10 border-violet-500/30 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-200'}`}>
                      <input type="checkbox" checked={cfgSections.has(s.key)} onChange={() => toggleSection(s.key)} className="rounded border-slate-200 text-violet-500 w-3 h-3" />
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{s.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="save-config-btn">
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
              Save Schedule
            </Button>
          </div>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-sm" data-testid="no-reports">
          <FileBarChart className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No reports generated yet. Click "Generate Now" to create your first report.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => {
            const detail = reportDetail[r.id];
            return (
              <div key={r.id} className="bg-cream-100 rounded-lg border border-slate-200 overflow-hidden" data-testid={`report-${r.id}`}>
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-cream-100 transition-colors" onClick={() => handleExpand(r.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <FileBarChart className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{r.period_days}-Day Report</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" /> {formatDate(r.generated_at)}
                        <span>&bull; {r.sections?.length} sections</span>
                        {r.generated_by === 'system' && <span className="text-violet-400">(auto)</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDownload(r.id, r.filename); }} className="border-slate-200 text-slate-500 text-xs h-7" data-testid={`download-report-${r.id}`}>
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs h-7 w-7 p-0" data-testid={`delete-report-${r.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    {expandedReport === r.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {/* Expanded Preview */}
                {expandedReport === r.id && detail && (
                  <div className="border-t border-slate-200 p-3 space-y-3">
                    <p className="text-slate-500 text-xs font-medium">REPORT PREVIEW</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {detail.data_snapshot?.activity && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-slate-500 text-[10px] uppercase">Activity</p>
                          <p className="text-white text-lg font-bold">{detail.data_snapshot.activity.total_events}</p>
                          <p className="text-slate-600 text-[10px]">events</p>
                        </div>
                      )}
                      {detail.data_snapshot?.notarizations && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-slate-500 text-[10px] uppercase">Notarizations</p>
                          <p className="text-white text-lg font-bold">{detail.data_snapshot.notarizations.total_documents}</p>
                          <p className="text-slate-600 text-[10px]">documents</p>
                        </div>
                      )}
                      {detail.data_snapshot?.members && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-slate-500 text-[10px] uppercase">Members</p>
                          <p className="text-white text-lg font-bold">{detail.data_snapshot.members.total_active}</p>
                          <p className="text-slate-600 text-[10px]">active</p>
                        </div>
                      )}
                      {detail.data_snapshot?.webhooks && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-slate-500 text-[10px] uppercase">Webhooks</p>
                          <p className="text-white text-lg font-bold">{detail.data_snapshot.webhooks.success_rate}%</p>
                          <p className="text-slate-600 text-[10px]">delivery rate</p>
                        </div>
                      )}
                      {detail.data_snapshot?.billing && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-slate-500 text-[10px] uppercase">Revenue</p>
                          <p className="text-white text-lg font-bold">${detail.data_snapshot.billing.total_revenue}</p>
                          <p className="text-slate-600 text-[10px]">in period</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrgReports;
