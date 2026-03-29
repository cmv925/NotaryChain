import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Loader2,
  Plus, Search, ToggleLeft, ToggleRight, Trash2, Edit,
  Globe, Scale, FileWarning, Fingerprint, Building,
  Eye, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_MAP = {
  critical: { cls: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'CRITICAL' },
  high: { cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'HIGH' },
  medium: { cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'MEDIUM' },
  low: { cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'LOW' },
};

const CATEGORY_ICONS = {
  identity: Fingerprint,
  document: FileWarning,
  biometric: Eye,
  transaction: Scale,
};

export default function FraudIntelligencePage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('patterns');
  const [patterns, setPatterns] = useState([]);
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedRule, setExpandedRule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [pRes, rRes, sRes] = await Promise.all([
        axios.get(`${API}/fraud-intelligence/patterns`, { headers }),
        axios.get(`${API}/fraud-intelligence/ron-rules`, { headers }),
        axios.get(`${API}/fraud-intelligence/stats`, { headers }),
      ]);
      setPatterns(pRes.data.patterns);
      setRules(rRes.data.rules);
      setStats(sRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (token) fetchData(); }, [token]);

  // Create pattern
  const [form, setForm] = useState({ category: 'document', title: '', description: '', severity: 'high', indicators: '' });

  const handleCreatePattern = async () => {
    if (!form.title || !form.description) {
      toast({ title: 'Error', description: 'Title and description required', variant: 'destructive' });
      return;
    }
    setActionLoading('create');
    try {
      await axios.post(`${API}/fraud-intelligence/patterns`, {
        ...form,
        indicators: form.indicators.split(',').map(s => s.trim()).filter(Boolean),
      }, { headers });
      toast({ title: 'Pattern Created' });
      setShowCreate(false);
      setForm({ category: 'document', title: '', description: '', severity: 'high', indicators: '' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Create failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleToggle = async (patternId) => {
    setActionLoading(`toggle-${patternId}`);
    try {
      await axios.post(`${API}/fraud-intelligence/patterns/${patternId}/toggle`, {}, { headers });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleDelete = async (patternId) => {
    setActionLoading(`delete-${patternId}`);
    try {
      await axios.delete(`${API}/fraud-intelligence/patterns/${patternId}`, { headers });
      toast({ title: 'Pattern deleted' });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const filtered = patterns.filter(p =>
    !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen bg-[#060a12] flex items-center justify-center"><Loader2 className="w-8 h-8 text-red-400 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <div className="bg-[#0a0f1a] border-b border-[#1a2540] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Fraud Intelligence</h1>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">Dynamic Threat Patterns & RON Compliance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'ANAN', path: '/anan' }, { label: 'Fraud Intelligence' }]} />

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="fraud-stats">
            <MiniStat label="Active Patterns" value={stats.fraud_patterns.active} color="red" />
            <MiniStat label="Critical Alerts" value={stats.fraud_patterns.critical} color="orange" />
            <MiniStat label="RON Jurisdictions" value={stats.ron_rules.enabled} color="emerald" />
            <MiniStat label="Non-RON States" value={stats.ron_rules.disabled} color="amber" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0d1420] rounded-lg p-1 w-fit" data-testid="fraud-tabs">
          <button onClick={() => setTab('patterns')} className={`px-4 py-2 text-xs font-bold rounded ${tab === 'patterns' ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-white'}`}>
            Fraud Patterns ({patterns.length})
          </button>
          <button onClick={() => setTab('ron')} className={`px-4 py-2 text-xs font-bold rounded ${tab === 'ron' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-white'}`}>
            RON Rules ({rules.length})
          </button>
        </div>

        {/* ── FRAUD PATTERNS TAB ── */}
        {tab === 'patterns' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search patterns..."
                  className="pl-9 bg-[#0d1420] border-[#1a2540] text-white text-sm" data-testid="fraud-search" />
              </div>
              <Button onClick={() => setShowCreate(true)} className="bg-red-600 hover:bg-red-700 text-white text-xs" data-testid="fraud-add-btn">
                <Plus className="w-3 h-3 mr-1" /> Add Pattern
              </Button>
            </div>

            {showCreate && (
              <Card className="bg-[#0d1420] border-red-500/20 mb-4" data-testid="fraud-create-form">
                <CardContent className="p-4">
                  <h3 className="text-white font-bold text-sm mb-3">New Fraud Pattern</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Category</label>
                      <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                        className="w-full px-3 py-2 bg-[#060a12] border border-[#1a2540] text-white rounded text-xs" data-testid="fraud-category">
                        <option value="identity">Identity</option>
                        <option value="document">Document</option>
                        <option value="biometric">Biometric</option>
                        <option value="transaction">Transaction</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Severity</label>
                      <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}
                        className="w-full px-3 py-2 bg-[#060a12] border border-[#1a2540] text-white rounded text-xs" data-testid="fraud-severity">
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>
                  <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                    placeholder="Pattern title" className="mb-2 bg-[#060a12] border-[#1a2540] text-white text-sm" data-testid="fraud-title" />
                  <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    placeholder="Description..." rows={2}
                    className="w-full px-3 py-2 mb-2 bg-[#060a12] border border-[#1a2540] text-white rounded text-sm resize-none" data-testid="fraud-desc" />
                  <Input value={form.indicators} onChange={e => setForm(f => ({...f, indicators: e.target.value}))}
                    placeholder="Indicators (comma-separated)" className="mb-3 bg-[#060a12] border-[#1a2540] text-white text-sm" data-testid="fraud-indicators" />
                  <div className="flex gap-2">
                    <Button onClick={handleCreatePattern} disabled={actionLoading === 'create'} className="bg-red-600 hover:bg-red-700 text-xs" data-testid="fraud-submit-btn">
                      {actionLoading === 'create' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Create
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1a2540] text-slate-400 text-xs">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2" data-testid="fraud-pattern-list">
              {filtered.map(p => {
                const sev = SEVERITY_MAP[p.severity] || SEVERITY_MAP.medium;
                const CatIcon = CATEGORY_ICONS[p.category] || FileWarning;
                return (
                  <Card key={p.pattern_id} className={`bg-[#0d1420] border-[#1a2540] ${!p.active ? 'opacity-50' : ''}`}
                    data-testid={`fraud-pattern-${p.pattern_id}`}>
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center mt-0.5">
                          <CatIcon className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-semibold text-sm">{p.title}</h4>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold border rounded ${sev.cls}`}>{sev.label}</span>
                            <span className="px-1.5 py-0.5 text-[9px] text-slate-500 border border-[#1a2540] rounded capitalize">{p.category}</span>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed mb-1.5">{p.description}</p>
                          {p.indicators?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {p.indicators.map(ind => (
                                <span key={ind} className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-400 rounded">{ind}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleToggle(p.pattern_id)} title={p.active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded hover:bg-slate-800 transition-colors" data-testid={`fraud-toggle-${p.pattern_id}`}>
                          {p.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-600" />}
                        </button>
                        <button onClick={() => handleDelete(p.pattern_id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" data-testid={`fraud-delete-${p.pattern_id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ── RON RULES TAB ── */}
        {tab === 'ron' && (
          <div className="space-y-2" data-testid="ron-rule-list">
            {rules.map(r => (
              <Card key={r.jurisdiction} className="bg-[#0d1420] border-[#1a2540]"
                data-testid={`ron-rule-${r.jurisdiction}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRule(expandedRule === r.jurisdiction ? null : r.jurisdiction)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${r.ron_enabled ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        <Building className={`w-4 h-4 ${r.ron_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-sm">{r.state_name}
                          <span className="text-slate-500 text-xs ml-2">({r.jurisdiction})</span>
                        </h4>
                        <p className="text-slate-500 text-[10px]">{r.statute || 'No statute'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-[9px] font-bold border rounded ${r.ron_enabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {r.ron_enabled ? 'RON ENABLED' : 'RON DISABLED'}
                      </span>
                      {expandedRule === r.jurisdiction ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {expandedRule === r.jurisdiction && (
                    <div className="mt-3 pt-3 border-t border-[#1a2540] grid grid-cols-2 gap-2 text-[11px]">
                      {r.requirements && Object.entries(r.requirements).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                          <span className={`font-medium ${val === true ? 'text-emerald-400' : val === false ? 'text-red-400' : 'text-white'}`}>
                            {val === true ? 'Yes' : val === false ? 'No' : val === null ? 'N/A' : String(val)}
                          </span>
                        </div>
                      ))}
                      {r.prohibited_documents?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-red-400 text-[10px] font-bold">Prohibited: {r.prohibited_documents.join(', ')}</span>
                        </div>
                      )}
                      {r.notes && <p className="col-span-2 text-slate-400 text-[10px] mt-1">{r.notes}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <Card className="bg-[#0d1420] border-[#1a2540]">
      <CardContent className="p-3 text-center">
        <p className={`text-${color}-400 font-bold text-xl`}>{value}</p>
        <p className="text-slate-500 text-[10px]">{label}</p>
      </CardContent>
    </Card>
  );
}
