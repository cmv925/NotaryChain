import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { NotificationBell } from '../components/NotificationBell';
import {
  ArrowLeft, Shield, MapPin, CheckCircle, XCircle, AlertTriangle,
  Search, ChevronDown, ChevronRight, Clock, FileText, Activity
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  full: { label: 'Full RON', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle, dotColor: 'bg-emerald-500' },
  limited: { label: 'Limited', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle, dotColor: 'bg-yellow-500' },
  pending: { label: 'Pending', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock, dotColor: 'bg-blue-500' },
  prohibited: { label: 'Prohibited', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, dotColor: 'bg-red-500' },
};

const RONComplianceDashboard = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [activeTab, setActiveTab] = useState('map');
  const [states, setStates] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedState, setExpandedState] = useState(null);
  const [violations, setViolations] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/compliance/ron/states`);
      setStates(res.data.states || []);
      setStats(res.data.stats || {});
    } catch {}
    setLoading(false);
  }, []);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/compliance/ron/violations?page_size=30`, { headers });
      setViolations(res.data.violations || []);
    } catch {}
  }, [token]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/compliance/ron/activity?page_size=30`, { headers });
      setActivity(res.data);
    } catch {}
  }, [token]);

  useEffect(() => { fetchStates(); }, [fetchStates]);
  useEffect(() => {
    if (activeTab === 'violations') fetchViolations();
    if (activeTab === 'activity') fetchActivity();
  }, [activeTab]);

  const filteredStates = states.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.state_code.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const groupedByStatus = {
    full: filteredStates.filter(s => s.status === 'full'),
    limited: filteredStates.filter(s => s.status === 'limited'),
    pending: filteredStates.filter(s => s.status === 'pending'),
    prohibited: filteredStates.filter(s => s.status === 'prohibited'),
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Admin</span>
              </Button>
              <h1 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Shield className="w-5 h-5 text-[#00d4aa]" /> RON Compliance Engine
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="compliance-stats">
            {[
              { label: 'Jurisdictions', value: stats.total_jurisdictions, color: 'text-white' },
              { label: 'Full RON', value: stats.full_ron, color: 'text-emerald-400' },
              { label: 'Limited', value: stats.limited_ron, color: 'text-yellow-400' },
              { label: 'Pending', value: stats.pending_legislation, color: 'text-blue-400' },
              { label: 'Prohibited', value: stats.prohibited, color: 'text-red-400' },
              { label: 'Coverage', value: `${stats.coverage_pct}%`, color: 'text-[#00d4aa]' },
            ].map(item => (
              <Card key={item.label} className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-gray-500 text-xs">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-[#1a2332] rounded-lg p-1 w-fit" data-testid="compliance-tabs">
          {[
            { id: 'map', label: 'State Rules', icon: MapPin },
            { id: 'violations', label: 'Violations', icon: AlertTriangle },
            { id: 'activity', label: 'Activity Log', icon: Activity },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-[#00d4aa] text-black' : 'text-gray-400 hover:text-white'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search state..."
                  className="bg-[#1a2332] border-gray-700 text-white pl-10"
                  data-testid="state-search"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'full', 'limited', 'pending', 'prohibited'].map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filterStatus === f ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(f)}
                    className={filterStatus === f ? 'bg-[#00d4aa] text-black' : 'border-gray-700 text-gray-400'}
                    data-testid={`filter-${f}`}
                  >
                    {f === 'all' ? 'All' : statusConfig[f]?.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* State Grid */}
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading state rules...</p>
            ) : (
              Object.entries(groupedByStatus).map(([status, stateList]) => {
                if (stateList.length === 0) return null;
                const cfg = statusConfig[status];
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
                      <h3 className="text-white font-medium text-sm">{cfg.label} ({stateList.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid={`state-grid-${status}`}>
                      {stateList.map(state => {
                        const expanded = expandedState === state.state_code;
                        return (
                          <Card key={state.state_code} className="bg-[#1a2332] border-gray-800 overflow-hidden">
                            <button
                              onClick={() => setExpandedState(expanded ? null : state.state_code)}
                              className="w-full p-4 text-left hover:bg-white/5 transition-colors"
                              data-testid={`state-card-${state.state_code}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-white font-mono font-bold text-sm bg-[#0d1b2a] px-2 py-1 rounded">{state.state_code}</span>
                                  <span className="text-gray-300 text-sm">{state.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                                  {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                </div>
                              </div>
                            </button>
                            {expanded && (
                              <div className="px-4 pb-4 pt-0 border-t border-gray-800 space-y-2">
                                {state.effective_date && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Effective</span>
                                    <span className="text-gray-300">{state.effective_date}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">ID Requirements</span>
                                  <span className="text-gray-300">{(state.id_requirements || []).join(', ') || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Witnesses</span>
                                  <span className="text-gray-300">{state.witnesses_required || 'None'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Recording</span>
                                  <span className="text-gray-300">{state.recording_required ? 'Required' : 'Not Required'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Max Signers</span>
                                  <span className="text-gray-300">{state.max_signers_per_session || 'N/A'}</span>
                                </div>
                                {state.restricted_doc_types && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Restricted Docs</span>
                                    <span className="text-red-400">{state.restricted_doc_types.join(', ')}</span>
                                  </div>
                                )}
                                {state.notes && (
                                  <p className="text-gray-500 text-xs mt-2 italic">{state.notes}</p>
                                )}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'violations' && (
          <Card className="bg-[#1a2332] border-gray-800" data-testid="violations-list">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" /> Compliance Violations & Warnings
              </h3>
              {violations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No compliance violations found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {violations.map((v, i) => (
                    <div key={v.id || i} className="bg-[#0d1b2a] rounded-lg p-4 border border-gray-700" data-testid={`violation-${i}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono font-bold text-sm bg-[#1a2332] px-2 py-0.5 rounded">{v.state_code}</span>
                          <span className="text-gray-300 text-sm">{v.document_type}</span>
                          {!v.compliant && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Failed</Badge>}
                          {v.compliant && v.warnings?.length > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Warning</Badge>}
                        </div>
                        <span className="text-gray-500 text-xs">{new Date(v.timestamp).toLocaleString()}</span>
                      </div>
                      {v.errors?.map((err, j) => (
                        <p key={j} className="text-red-400 text-xs flex items-start gap-1.5 mt-1">
                          <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {err}
                        </p>
                      ))}
                      {v.warnings?.map((warn, j) => (
                        <p key={j} className="text-yellow-400 text-xs flex items-start gap-1.5 mt-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {warn}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'activity' && (
          <Card className="bg-[#1a2332] border-gray-800" data-testid="activity-log">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" /> Validation Activity
                </h3>
                {activity?.summary && (
                  <div className="flex gap-3 text-xs">
                    <span className="text-gray-400">Checks: <span className="text-white">{activity.summary.total_checks}</span></span>
                    <span className="text-gray-400">Failed: <span className="text-red-400">{activity.summary.failed}</span></span>
                    <span className="text-gray-400">Pass Rate: <span className="text-emerald-400">{activity.summary.pass_rate}%</span></span>
                  </div>
                )}
              </div>
              {!activity?.activity?.length ? (
                <p className="text-gray-500 text-sm text-center py-8">No validation activity yet</p>
              ) : (
                <div className="space-y-2">
                  {activity.activity.map((a, i) => (
                    <div key={a.id || i} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                      {a.compliant ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      <span className="text-white font-mono text-sm w-8">{a.state_code}</span>
                      <span className="text-gray-300 text-sm flex-1">{a.document_type}</span>
                      <span className="text-gray-500 text-xs">{a.signer_count} signer(s)</span>
                      <span className="text-gray-500 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RONComplianceDashboard;
