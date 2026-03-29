import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Shield, ScanFace, Eye, Lock, CheckCircle, XCircle,
  Loader2, Play, Brain, Blocks, Clock, ChevronRight,
  AlertTriangle, Radio, Users, Fingerprint, Globe,
  Scale, Zap, TrendingUp, ShieldCheck, Vote,
  ArrowRight, FileText, RefreshCw, UserCheck,
  Copy, Code, X, Target, Award,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AGENT_CONFIG = {
  verifier: { label: 'Verifier', subtitle: 'Identity & Biometrics', icon: ScanFace, weight: 0.40, color: 'cyan' },
  witness: { label: 'Witness', subtitle: 'Audit & Evidence', icon: Eye, weight: 0.30, color: 'violet' },
  sealer: { label: 'Sealer', subtitle: 'Compliance & Blockchain', icon: Lock, weight: 0.30, color: 'amber' },
};

const STATUS_MAP = {
  pending: { label: 'Pending', cls: 'bg-slate-700/40 text-slate-300 border-slate-600' },
  in_progress: { label: 'Scoring', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse' },
  sealed: { label: 'Sealed', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
  escalated: { label: 'Escalated', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border rounded ${s.cls}`} data-testid={`anan-status-${status}`}>
      {s.label}
    </span>
  );
}

function ScoreRing({ score, size = 64, color = 'cyan' }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * (score || 0)) / 100;
  const colorMap = { cyan: '#06b6d4', violet: '#8b5cf6', amber: '#f59e0b', emerald: '#10b981', red: '#ef4444' };
  const stroke = colorMap[color] || colorMap.cyan;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-sm font-mono">{score ?? '--'}</span>
      </div>
    </div>
  );
}

export default function ANANDashboard() {
  const { ceremonyId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [view, setView] = useState(ceremonyId ? 'detail' : 'list');
  const [ceremonies, setCeremonies] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stats, setStats] = useState(null);
  const [bond, setBond] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sseEvents, setSseEvents] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef(null);
  const [badgeData, setBadgeData] = useState(null);
  const [showBadge, setShowBadge] = useState(false);
  const [reputation, setReputation] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchList = useCallback(async () => {
    try {
      const [cRes, sRes, bRes, repRes] = await Promise.all([
        axios.get(`${API}/anan/ceremonies`, { headers }),
        axios.get(`${API}/anan/dashboard/stats`, { headers }),
        axios.get(`${API}/anan/bond/status`, { headers }),
        axios.get(`${API}/anan/reputation`, { headers }),
      ]);
      setCeremonies(cRes.data.ceremonies);
      setStats(sRes.data);
      setBond(bRes.data);
      setReputation(repRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const fetchDetail = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API}/anan/ceremony/${id}`, { headers });
      setCurrent(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load ceremony', variant: 'destructive' });
    }
  }, [token]);

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/anan/escalations`, { headers });
      setEscalations(res.data.escalations);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (ceremonyId) {
      fetchDetail(ceremonyId);
      setView('detail');
    } else {
      fetchList();
      fetchEscalations();
    }
  }, [token, ceremonyId]);

  // ─── Create Ceremony ───
  const [form, setForm] = useState({ document_name: '', signer_name: '', document_type: 'affidavit', jurisdiction: 'US-FL' });

  const handleCreate = async () => {
    if (!form.document_name || !form.signer_name) {
      toast({ title: 'Error', description: 'Document name and signer name required', variant: 'destructive' });
      return;
    }
    setActionLoading('create');
    try {
      const res = await axios.post(`${API}/anan/ceremony/start`, form, { headers });
      toast({ title: 'ANAN Ceremony Created', description: `Protocol: ${res.data.protocol}` });
      setShowCreate(false);
      setForm({ document_name: '', signer_name: '', document_type: 'affidavit', jurisdiction: 'US-FL' });
      navigate(`/anan/${res.data.ceremony_id}`);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Create failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── Execute via SSE ───
  const handleExecuteStream = () => {
    if (!current || streaming) return;
    setStreaming(true);
    setSseEvents([]);

    const url = `${API}/anan/ceremony/${current.ceremony_id}/stream?token=${token}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = () => {};

    const eventTypes = [
      'ceremony_started', 'blind_phase_started', 'agents_running',
      'reveal_phase_started', 'score_revealed', 'consensus_started',
      'sealing_blockchain', 'consensus_reached', 'escalation_created',
      'ceremony_complete', 'error',
    ];

    eventTypes.forEach((evt) => {
      es.addEventListener(evt, (e) => {
        const data = JSON.parse(e.data);
        setSseEvents((prev) => [...prev, { type: evt, data, ts: new Date().toISOString() }]);

        if (evt === 'score_revealed') {
          setCurrent((prev) => {
            if (!prev) return prev;
            const agents = { ...prev.agents };
            agents[data.agent] = {
              ...agents[data.agent],
              status: data.score >= 60 ? 'passed' : 'failed',
              score: data.score,
              verdict: data.verdict,
              reasoning: data.reasoning,
              risk_level: data.risk_level,
              checks: data.checks,
              ai_powered: data.ai_powered,
            };
            return { ...prev, agents };
          });
        }

        if (evt === 'consensus_reached') {
          setCurrent((prev) => prev ? {
            ...prev,
            status: data.status,
            consensus: { ...prev.consensus, status: 'reached', result: data.result, weighted_average: data.weighted_average, scores: data.scores, pass_count: data.pass_count, score_spread: data.score_spread },
            blockchain_seal: data.blockchain_seal,
          } : prev);
        }

        if (evt === 'ceremony_complete' || evt === 'error') {
          es.close();
          setStreaming(false);
          fetchDetail(current.ceremony_id);
        }
      });
    });

    es.onerror = () => {
      es.close();
      setStreaming(false);
      fetchDetail(current.ceremony_id);
    };
  };

  // ─── Execute non-streaming ───
  const handleExecute = async () => {
    if (!current) return;
    setActionLoading('execute');
    try {
      const res = await axios.post(`${API}/anan/ceremony/${current.ceremony_id}/execute`, {}, { headers });
      toast({ title: `ANAN: ${res.data.consensus?.result || 'Complete'}`, description: `Weighted Score: ${res.data.consensus?.weighted_average}` });
      setCurrent(res.data);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Execution failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── Resolve Escalation ───
  const handleResolve = async (escalationId, decision) => {
    setActionLoading(`resolve-${escalationId}`);
    try {
      await axios.post(`${API}/anan/escalation/${escalationId}/resolve`, { decision, notes: `Resolved by admin` }, { headers });
      toast({ title: 'Escalation Resolved', description: `Decision: ${decision.toUpperCase()}` });
      fetchEscalations();
      if (current) fetchDetail(current.ceremony_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Resolve failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  useEffect(() => {
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, []);

  // Badge
  const fetchBadge = async (cId) => {
    try {
      const res = await axios.get(`${API}/anan/badge/${cId}`, { headers });
      setBadgeData(res.data);
      setShowBadge(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to load badge', variant: 'destructive' });
    }
  };

  const handleTuneWeights = async () => {
    setActionLoading('tune');
    try {
      const res = await axios.post(`${API}/anan/reputation/tune`, {}, { headers });
      if (res.data.tuned) {
        toast({ title: 'Weights Tuned', description: `New weights: V=${res.data.weights.verifier}, W=${res.data.weights.witness}, S=${res.data.weights.sealer}` });
      } else {
        toast({ title: 'Not Tuned', description: res.data.reason || 'Insufficient data' });
      }
      setReputation(prev => prev ? { ...prev, current_weights: res.data.weights } : prev);
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setActionLoading(null);
  };

  // ═══════════════════════════════════════════════════════
  //  LIST VIEW
  // ═══════════════════════════════════════════════════════
  if (view === 'list' || !ceremonyId) {
    return (
      <div className="min-h-screen bg-[#060a12] text-white">
        <div className="bg-[#0a0f1a] border-b border-[#1a2540] sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg tracking-tight">ANAN — Agent Network</h1>
                <p className="text-slate-500 text-[10px] tracking-wider uppercase">Autonomous Notary Agent Network</p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="anan-create-btn">
              <Zap className="w-4 h-4 mr-2" /> New ANAN Ceremony
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'ANAN Network' }]} />

          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6" data-testid="anan-stats">
              <StatCard label="Total" value={stats.total_ceremonies} icon={Brain} color="cyan" />
              <StatCard label="Sealed" value={stats.sealed} icon={ShieldCheck} color="emerald" />
              <StatCard label="Rejected" value={stats.rejected} icon={XCircle} color="red" />
              <StatCard label="Escalated" value={stats.escalated} icon={AlertTriangle} color="amber" />
              <StatCard label="Approval %" value={`${stats.approval_rate}%`} icon={TrendingUp} color="emerald" />
              <StatCard label="Avg Score" value={stats.avg_weighted_score} icon={Vote} color="violet" />
            </div>
          )}

          {/* Bond Status */}
          {bond && (
            <Card className="bg-[#0d1420] border-[#1a2540] mb-6" data-testid="anan-bond-status">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">SAN E&O Insurance Bond</p>
                    <p className="text-white font-bold">${bond.balance?.toLocaleString()} <span className="text-slate-500 text-xs font-normal">/ $1,000,000</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${bond.health === 'healthy' ? 'bg-emerald-500' : bond.health === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${bond.health_pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${bond.health === 'healthy' ? 'text-emerald-400' : bond.health === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>{bond.health_pct}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Agent Reputation & Fraud Intel Links */}
          {reputation && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Reputation */}
              <Card className="bg-[#0d1420] border-[#1a2540]" data-testid="anan-reputation">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-violet-400" />
                      <h3 className="text-white font-bold text-sm">Agent Reputation</h3>
                    </div>
                    <Button size="sm" onClick={handleTuneWeights} disabled={actionLoading === 'tune'}
                      className="bg-violet-600 hover:bg-violet-700 text-[10px] h-7" data-testid="anan-tune-btn">
                      {actionLoading === 'tune' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Target className="w-3 h-3 mr-1" />}
                      Auto-Tune Weights
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(reputation.reputations || {}).map(([agent, rep]) => {
                      const weight = reputation.current_weights?.[agent] || 0;
                      return (
                        <div key={agent} className="flex items-center gap-3 text-xs" data-testid={`anan-rep-${agent}`}>
                          <span className="text-slate-400 w-14 capitalize">{agent}</span>
                          <div className="flex-1 h-1.5 bg-[#1a2540] rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${rep.all_time.accuracy}%` }} />
                          </div>
                          <span className="text-white font-mono w-10 text-right">{rep.all_time.accuracy}%</span>
                          <span className="text-slate-600 text-[10px] w-16">wt: {(weight * 100).toFixed(0)}%</span>
                          <span className="text-slate-600 text-[10px]">({rep.all_time.total} samples)</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Fraud Intel Link */}
              <Card className="bg-[#0d1420] border-[#1a2540] cursor-pointer hover:border-red-500/30 transition-colors"
                onClick={() => navigate('/fraud-intelligence')} data-testid="anan-fraud-link">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Fraud Intelligence</h3>
                      <p className="text-slate-500 text-[10px]">
                        {stats ? `${stats.total_ceremonies > 0 ? 'Active' : 'Ready'} | 8 fraud patterns, 8 RON jurisdictions` : 'Manage threat patterns & RON rules'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Create Form */}
          {showCreate && (
            <Card className="bg-[#0d1420] border-cyan-500/30 mb-6" data-testid="anan-create-form">
              <CardContent className="p-6">
                <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" /> New ANAN Ceremony
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Document Name *</label>
                    <Input value={form.document_name} onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))} placeholder="e.g. Affidavit of Identity" className="bg-[#060a12] border-[#1a2540] text-white" data-testid="anan-doc-name" />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Signer Name *</label>
                    <Input value={form.signer_name} onChange={e => setForm(f => ({ ...f, signer_name: e.target.value }))} placeholder="e.g. John Smith" className="bg-[#060a12] border-[#1a2540] text-white" data-testid="anan-signer-name" />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Document Type</label>
                    <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))} className="w-full px-3 py-2 bg-[#060a12] border border-[#1a2540] text-white rounded-md text-sm" data-testid="anan-doc-type">
                      <option value="affidavit">Affidavit</option>
                      <option value="power_of_attorney">Power of Attorney</option>
                      <option value="deed">Deed</option>
                      <option value="contract">Contract</option>
                      <option value="will">Will / Testament</option>
                      <option value="general">General Document</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Jurisdiction</label>
                    <select value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} className="w-full px-3 py-2 bg-[#060a12] border border-[#1a2540] text-white rounded-md text-sm" data-testid="anan-jurisdiction">
                      <option value="US-FL">Florida (FL)</option>
                      <option value="US-TX">Texas (TX)</option>
                      <option value="US-VA">Virginia (VA)</option>
                      <option value="US-NV">Nevada (NV)</option>
                      <option value="US-OH">Ohio (OH)</option>
                      <option value="US-CA">California (CA)</option>
                      <option value="US-NY">New York (NY)</option>
                      <option value="US-General">US General</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={actionLoading === 'create'} className="bg-cyan-600 hover:bg-cyan-700" data-testid="anan-submit-btn">
                    {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                    Initialize ANAN Protocol
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1a2540] text-slate-400">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Escalation Queue */}
          {escalations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-amber-400 font-bold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> HITL Escalation Queue ({escalations.length})
              </h3>
              <div className="space-y-2" data-testid="anan-escalation-queue">
                {escalations.map((esc) => (
                  <Card key={esc.escalation_id} className="bg-[#0d1420] border-amber-500/20">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{esc.ceremony_context?.document_name || 'Unknown'}</p>
                        <p className="text-slate-500 text-[10px]">Signer: {esc.ceremony_context?.signer_name} | Score: {esc.weighted_average?.toFixed(1)}</p>
                        <p className="text-amber-400/70 text-[10px] mt-0.5">{esc.reason}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleResolve(esc.escalation_id, 'approve')}
                          disabled={actionLoading === `resolve-${esc.escalation_id}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs" data-testid={`anan-approve-${esc.escalation_id}`}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" onClick={() => handleResolve(esc.escalation_id, 'reject')}
                          disabled={actionLoading === `resolve-${esc.escalation_id}`}
                          className="bg-red-600 hover:bg-red-700 text-xs" data-testid={`anan-reject-${esc.escalation_id}`}>
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ceremony List */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
          ) : ceremonies.length === 0 ? (
            <Card className="bg-[#0d1420] border-[#1a2540]">
              <CardContent className="p-12 text-center">
                <Brain className="w-14 h-14 text-slate-700 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">No ANAN Ceremonies Yet</h3>
                <p className="text-slate-500 text-sm mb-4">Launch your first autonomous notarization with the ANAN swarm.</p>
                <Button onClick={() => setShowCreate(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Zap className="w-4 h-4 mr-2" /> Create First ANAN Ceremony
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2" data-testid="anan-ceremony-list">
              {ceremonies.map((c) => (
                <Card key={c.ceremony_id} className="bg-[#0d1420] border-[#1a2540] hover:border-cyan-500/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/anan/${c.ceremony_id}`)} data-testid={`anan-card-${c.ceremony_id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">{c.document_name}</h3>
                        <p className="text-slate-500 text-[10px]">{c.signer_name} | {c.protocol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {c.consensus?.weighted_average != null && (
                        <span className="text-white font-mono font-bold text-sm">{c.consensus.weighted_average.toFixed(1)}</span>
                      )}
                      <StatusBadge status={c.status} />
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  DETAIL VIEW
  // ═══════════════════════════════════════════════════════
  if (!current) {
    return <div className="min-h-screen bg-[#060a12] flex items-center justify-center"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>;
  }

  const c = current;
  const consensus = c.consensus || {};
  const isComplete = ['sealed', 'rejected', 'escalated'].includes(c.status);
  const canExecute = c.status === 'pending' || c.status === 'escalated';

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      {/* Header */}
      <div className="bg-[#0a0f1a] border-b border-[#1a2540] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">{c.document_name}</h1>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">{c.protocol} | {c.ceremony_id.slice(0, 8)}</p>
            </div>
          </div>
          <StatusBadge status={c.status} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'ANAN', path: '/anan' }, { label: c.document_name }]} />

        {/* Execute Actions */}
        {canExecute && (
          <Card className="bg-[#0d1420] border-cyan-500/20 mb-6" data-testid="anan-execute-panel">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">Ready to Execute Blind Scoring Protocol</p>
                <p className="text-slate-500 text-[10px]">3 GPT-5.2 agents will analyze concurrently in isolation</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExecuteStream} disabled={streaming || actionLoading === 'execute'}
                  className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700" data-testid="anan-execute-stream-btn">
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {streaming ? 'Scoring...' : 'Execute (Live Stream)'}
                </Button>
                <Button onClick={handleExecute} disabled={streaming || actionLoading === 'execute'} variant="outline"
                  className="border-[#1a2540] text-slate-400 hover:text-white" data-testid="anan-execute-btn">
                  {actionLoading === 'execute' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Execute (Instant)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent Cards + Consensus */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(AGENT_CONFIG).map(([key, cfg]) => {
            const agent = c.agents?.[key] || {};
            return <AgentScoreCard key={key} agentKey={key} config={cfg} agent={agent} streaming={streaming} />;
          })}
        </div>

        {/* Consensus Oracle */}
        {consensus.status === 'reached' && (
          <Card className={`mb-6 ${consensus.result === 'APPROVED' ? 'bg-emerald-500/5 border-emerald-500/30' : consensus.result === 'REJECTED' ? 'bg-red-500/5 border-red-500/30' : 'bg-amber-500/5 border-amber-500/30'}`} data-testid="anan-consensus-oracle">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Vote className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="text-white font-bold text-lg tracking-tight">Consensus Oracle</h3>
                    <p className="text-slate-500 text-[10px] tracking-wider uppercase">Weighted 2-of-3 Blind Protocol</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold font-mono ${consensus.result === 'APPROVED' ? 'text-emerald-400' : consensus.result === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}`} data-testid="anan-consensus-result">
                  {consensus.result}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Weighted Average</p>
                  <p className="text-white font-bold font-mono text-lg">{consensus.weighted_average?.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Pass Count</p>
                  <p className="text-white font-bold font-mono text-lg">{consensus.pass_count}/3</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Score Spread</p>
                  <p className="text-white font-bold font-mono text-lg">{consensus.score_spread}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Consensus Hash</p>
                  <code className="text-cyan-400 font-mono text-[10px]">{consensus.consensus_hash?.slice(0, 16)}...</code>
                </div>
              </div>

              {/* Score Breakdown Bar */}
              <div className="mt-4 space-y-2">
                {Object.entries(consensus.scores || {}).map(([agent, score]) => {
                  const w = (AGENT_CONFIG[agent]?.weight || 0.33) * 100;
                  const colorCls = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={agent} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 w-16 capitalize">{agent}</span>
                      <div className="flex-1 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                        <div className={`h-full ${colorCls} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-white font-mono w-8 text-right">{score}</span>
                      <span className="text-slate-600 text-[10px] w-10">x{AGENT_CONFIG[agent]?.weight}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blockchain Seal */}
        {c.blockchain_seal && (
          <Card className="bg-[#0d1420] border-[#1a2540] mb-6" data-testid="anan-blockchain-seal">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2"><Blocks className="w-4 h-4 text-orange-400" /> Blockchain Seal</h3>
                {c.status === 'sealed' && (
                  <Button size="sm" onClick={() => fetchBadge(c.ceremony_id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-[10px] h-7" data-testid="anan-get-badge-btn">
                    <Code className="w-3 h-3 mr-1" /> Get Embed Badge
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoRow label="Network" value={c.blockchain_seal.network} />
                <InfoRow label="Topic" value={c.blockchain_seal.topic_id} mono />
                {c.blockchain_seal.transaction_id && <InfoRow label="TX ID" value={c.blockchain_seal.transaction_id} mono />}
                {c.blockchain_seal.consensus_hash && <InfoRow label="Hash" value={c.blockchain_seal.consensus_hash.slice(0, 20) + '...'} mono />}
                {c.blockchain_seal.explorer_url && (
                  <a href={c.blockchain_seal.explorer_url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 text-[10px] flex items-center gap-1 col-span-2">
                    <Globe className="w-3 h-3" /> View on HashScan
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Badge Embed Modal */}
        {showBadge && badgeData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBadge(false)}>
            <Card className="bg-[#0d1420] border-emerald-500/30 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="anan-badge-modal">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-400" /> Shareable Verification Badge</h3>
                  <button onClick={() => setShowBadge(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Preview */}
                <div className="mb-4 p-4 bg-white/5 rounded-lg border border-[#1a2540] flex justify-center">
                  <div dangerouslySetInnerHTML={{ __html: badgeData.embed_html }} />
                </div>

                {/* Static HTML */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-400 text-xs font-bold">Static HTML (Works Everywhere)</label>
                    <Button size="sm" variant="outline" className="border-[#1a2540] text-slate-400 text-[10px] h-6"
                      onClick={() => { navigator.clipboard.writeText(badgeData.embed_html); toast({ title: 'Copied HTML!' }); }}
                      data-testid="badge-copy-html">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="bg-[#060a12] border border-[#1a2540] rounded p-3 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {badgeData.embed_html}
                  </pre>
                </div>

                {/* Dynamic JS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-400 text-xs font-bold">Dynamic JS Widget (Live Status Updates)</label>
                    <Button size="sm" variant="outline" className="border-[#1a2540] text-slate-400 text-[10px] h-6"
                      onClick={() => { navigator.clipboard.writeText(badgeData.embed_js); toast({ title: 'Copied JS widget!' }); }}
                      data-testid="badge-copy-js">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="bg-[#060a12] border border-[#1a2540] rounded p-3 text-[10px] text-cyan-400 font-mono overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {badgeData.embed_js}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Escalation Info */}
        {c.escalation && (
          <Card className="bg-amber-500/5 border-amber-500/20 mb-6" data-testid="anan-escalation-info">
            <CardContent className="p-4">
              <h3 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Human Escalation</h3>
              <p className="text-slate-400 text-xs mb-2">{c.escalation.reason}</p>
              {c.escalation.status === 'resolved' ? (
                <p className="text-emerald-400 text-xs">Resolved: <span className="font-bold uppercase">{c.escalation.override_decision}</span> by {c.escalation.resolved_by}</p>
              ) : (
                <p className="text-amber-400 text-xs">Awaiting human review...</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SSE Event Log */}
        {sseEvents.length > 0 && (
          <Card className="bg-[#0d1420] border-[#1a2540]" data-testid="anan-event-log">
            <CardContent className="p-4">
              <h3 className="text-slate-400 font-bold text-sm mb-3 flex items-center gap-2"><Radio className="w-4 h-4" /> Live Event Stream</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[10px]">
                {sseEvents.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 w-20 flex-shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className={`${e.type.includes('error') ? 'text-red-400' : e.type.includes('reveal') ? 'text-cyan-400' : e.type.includes('consensus') ? 'text-violet-400' : 'text-slate-400'}`}>
                      [{e.type}] {e.data.message || e.data.agent || e.data.result || ''}
                      {e.data.score != null && ` → score: ${e.data.score}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ceremony Meta */}
        <Card className="bg-[#0d1420] border-[#1a2540] mt-6" data-testid="anan-ceremony-meta">
          <CardContent className="p-4">
            <h3 className="text-slate-400 font-bold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Ceremony Details</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Document" value={c.document_name} />
              <InfoRow label="Signer" value={c.signer_name} />
              <InfoRow label="Type" value={c.document_type} />
              <InfoRow label="Jurisdiction" value={c.jurisdiction} />
              <InfoRow label="Initiated By" value={c.initiated_by} />
              <InfoRow label="Created" value={new Date(c.created_at).toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function AgentScoreCard({ agentKey, config, agent, streaming }) {
  const Icon = config.icon;
  const isRunning = agent.status === 'running' || (streaming && agent.status === 'idle');
  const hasScore = agent.score != null;
  const scoreColor = hasScore ? (agent.score >= 70 ? 'emerald' : agent.score >= 40 ? 'amber' : 'red') : config.color;

  return (
    <Card className={`bg-[#0d1420] transition-all duration-500 ${isRunning ? 'border-blue-500/40 ring-1 ring-blue-500/20' : hasScore && agent.score >= 60 ? 'border-emerald-500/30' : hasScore ? 'border-red-500/30' : 'border-[#1a2540]'}`}
      data-testid={`anan-agent-${agentKey}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/10 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 text-${config.color}-400`} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{config.label} Agent</h3>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">{config.subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            {hasScore ? (
              <ScoreRing score={agent.score} size={52} color={scoreColor} />
            ) : isRunning ? (
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full border-2 border-[#1a2540] flex items-center justify-center">
                <span className="text-slate-600 text-xs">--</span>
              </div>
            )}
          </div>
        </div>

        {/* Weight indicator */}
        <div className="flex items-center gap-2 mb-3 text-[10px]">
          <span className="text-slate-500">Weight:</span>
          <span className={`text-${config.color}-400 font-bold`}>{(config.weight * 100).toFixed(0)}%</span>
          {agent.ai_powered && <span className="bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">GPT-5.2</span>}
        </div>

        {/* Reasoning */}
        {agent.reasoning && (
          <p className="text-slate-400 text-[10px] leading-relaxed mb-2">{agent.reasoning}</p>
        )}

        {/* Risk Level */}
        {agent.risk_level && (
          <div className="flex items-center gap-2 text-[10px] mb-2">
            <span className="text-slate-500">Risk:</span>
            <span className={`font-bold uppercase ${agent.risk_level === 'low' ? 'text-emerald-400' : agent.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>{agent.risk_level}</span>
          </div>
        )}

        {/* Checks */}
        {agent.checks && Object.keys(agent.checks).length > 0 && (
          <div className="space-y-1 mt-2">
            {Object.entries(agent.checks).slice(0, 4).map(([key, val]) => {
              const s = typeof val === 'object' ? val.status : 'PASS';
              return (
                <div key={key} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                  <span className={s === 'PASS' ? 'text-emerald-400' : s === 'WARN' ? 'text-amber-400' : 'text-red-400'}>{s}</span>
                </div>
              );
            })}
          </div>
        )}

        {isRunning && !hasScore && (
          <div className="mt-3 flex items-center gap-2 text-blue-400 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing in isolation...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="bg-[#0d1420] border-[#1a2540]">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">{label}</p>
          <p className="text-white font-bold text-sm">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-white ${mono ? 'font-mono text-[10px]' : ''}`}>{String(value || 'N/A')}</span>
    </div>
  );
}
