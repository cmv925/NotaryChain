import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Shield, ScanFace, Eye, Lock, CheckCircle, XCircle, Loader2,
  Play, RotateCcw, Fingerprint, FileSearch, Link2,
  ShieldCheck, Vote, Blocks, Clock, ChevronRight, AlertTriangle, Radio, Camera,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { WebcamCapture } from '../components/WebcamCapture';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ── Agent Status Badge ─────────────────────────── */
function AgentStatusBadge({ status }) {
  const map = {
    idle: { label: 'STANDBY', cls: 'bg-slate-700/60 text-navy-800 border-slate-600' },
    running: { label: 'PROCESSING', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/50 animate-pulse' },
    passed: { label: 'PASS', cls: 'bg-coral-500/20 text-coral-600 border-emerald-500/50' },
    failed: { label: 'FAIL', cls: 'bg-red-500/20 text-red-400 border-red-500/50' },
  };
  const s = map[status] || map.idle;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border rounded-sm ${s.cls}`} data-testid={`agent-status-${status}`}>
      {s.label}
    </span>
  );
}

/* ── Confidence Bar ─────────────────────────────── */
function ConfidenceBar({ value, status }) {
  if (value == null) return <div className="h-1.5 w-full bg-slate-700/50 rounded-sm" />;
  const pct = Math.round(value * 100);
  const color = status === 'passed' ? 'bg-coral-500' : status === 'failed' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-600 font-medium tracking-wide uppercase">Confidence</span>
        <span className="text-navy-900 font-bold font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-700/50 rounded-sm overflow-hidden">
        <div className={`h-full ${color} rounded-sm transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Single Agent Card ──────────────────────────── */
function AgentCard({ name, icon: Icon, agent, accent }) {
  const isRunning = agent.status === 'running';
  const borderCls = isRunning ? 'border-blue-500/60 ring-1 ring-blue-500/30' : agent.status === 'passed' ? 'border-emerald-500/40' : agent.status === 'failed' ? 'border-red-500/40' : 'border-slate-200';
  const checks = agent.details?.checks || agent.details?.evidence || agent.details?.compliance;

  return (
    <Card className={`bg-white ${borderCls} transition-all duration-500 rounded-sm`} data-testid={`agent-card-${name.toLowerCase()}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${accent}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-navy-900 font-semibold text-sm tracking-tight">{name} Agent</h3>
              <div className="flex items-center gap-1.5">
                <p className="text-slate-500 text-[11px] tracking-wide uppercase">
                  {name === 'Verifier' ? 'Biometric & ID' : name === 'Witness' ? 'Audit & Evidence' : 'Blockchain & Compliance'}
                </p>
                {agent.details?.ai_powered && (
                  <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40 px-1 py-0.5 rounded-sm" data-testid="ai-powered-badge">GPT-5.2</span>
                )}
              </div>
            </div>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>

        <ConfidenceBar value={agent.confidence} status={agent.status} />

        {agent.evidence_hash && (
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <Fingerprint className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">Evidence:</span>
            <code className="text-blue-400 font-mono">{agent.evidence_hash}</code>
          </div>
        )}

        {checks && Object.keys(checks).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {Object.entries(checks).slice(0, 4).map(([key, val]) => {
              const s = typeof val === 'object' ? val.status : 'PASS';
              return (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">{key.replace(/_/g, ' ')}</span>
                  <span className={s === 'PASS' || s === 'VALID' ? 'text-coral-600' : 'text-red-400'}>{s}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Witness Agent audit details */}
        {agent.details?.real_audit && agent.details?.evidence && (
          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">merkle root</span>
              <code className="text-blue-400 font-mono">{agent.details.evidence.audit_integrity?.merkle_root?.slice(0, 16)}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">timeline entries</span>
              <span className="text-coral-600">{agent.details.evidence.audit_integrity?.entries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">evidence items</span>
              <span className="text-coral-600">{agent.details.evidence.evidence_package?.items_collected}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">tamper proof</span>
              <span className="text-coral-600">{agent.details.evidence.evidence_package?.tamper_proof ? 'VALID' : 'INVALID'}</span>
            </div>
            {agent.details.audit_log_written && (
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle className="w-3 h-3 text-coral-600" />
                <span className="text-coral-600">Audit log written</span>
              </div>
            )}
          </div>
        )}

        {isRunning && (
          <div className="mt-4 flex items-center gap-2 text-blue-400 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Consensus Oracle ───────────────────────────── */
function ConsensusOracle({ consensus, blockchainSeal }) {
  if (!consensus || consensus.status === 'pending') {
    return (
      <Card className="bg-white border-slate-200 rounded-sm" data-testid="consensus-oracle">
        <CardContent className="p-6 text-center">
          <Vote className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-navy-900 font-semibold text-lg tracking-tight mb-1">Consensus Oracle</h3>
          <p className="text-slate-500 text-sm">Awaiting agent verdicts...</p>
          <div className="flex justify-center gap-4 mt-4">
            {['Verifier', 'Witness', 'Sealer'].map(a => (
              <div key={a} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-600" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const isApproved = consensus.result === 'APPROVED';
  const borderCls = isApproved ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-red-500/50 ring-1 ring-red-500/20';

  return (
    <Card className={`bg-white ${borderCls} rounded-sm`} data-testid="consensus-oracle">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${isApproved ? 'bg-coral-500/20 text-coral-600' : 'bg-red-500/20 text-red-400'}`}>
              {isApproved ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-navy-900 font-semibold text-lg tracking-tight">Consensus Oracle</h3>
              <p className="text-slate-500 text-[11px] tracking-wide uppercase">2-of-3 multi-agent vote</p>
            </div>
          </div>
          <span className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded-sm border ${isApproved ? 'bg-coral-500/20 text-coral-600 border-emerald-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`} data-testid="consensus-result">
            {consensus.result}
          </span>
        </div>

        {/* Vote Display */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {Object.entries(consensus.votes).map(([agent, vote]) => (
            <div key={agent} className={`p-3 rounded-sm border text-center ${vote === 'PASS' ? 'bg-coral-500/10 border-coral-200' : vote === 'FAIL' ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/30 border-slate-600'}`} data-testid={`vote-${agent}`}>
              <div className="flex justify-center mb-1">
                {vote === 'PASS' ? <CheckCircle className="w-5 h-5 text-coral-600" /> : vote === 'FAIL' ? <XCircle className="w-5 h-5 text-red-400" /> : <Clock className="w-5 h-5 text-slate-500" />}
              </div>
              <p className="text-xs text-slate-600 capitalize">{agent}</p>
              <p className={`text-xs font-bold ${vote === 'PASS' ? 'text-coral-600' : vote === 'FAIL' ? 'text-red-400' : 'text-slate-500'}`}>{vote || '—'}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-slate-600">Vote Tally</span>
          <span className="text-navy-900 font-mono font-bold">{consensus.pass_count} / {consensus.total_votes} PASS</span>
        </div>

        {/* Blockchain Seal */}
        {blockchainSeal && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Blocks className="w-4 h-4 text-blue-400" />
              <span className="text-navy-900 font-semibold text-sm">Blockchain Seal</span>
              {blockchainSeal.hcs_submitted && (
                <span className="text-[10px] font-bold bg-coral-500/20 text-coral-600 border border-emerald-500/40 px-1.5 py-0.5 rounded-sm">HCS VERIFIED</span>
              )}
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Network</span>
                <span className="text-navy-900 font-mono">{blockchainSeal.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Topic ID</span>
                <span className="text-blue-400 font-mono">{blockchainSeal.topic_id}</span>
              </div>
              {blockchainSeal.transaction_id && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID</span>
                  <span className="text-blue-400 font-mono text-right break-all max-w-[280px]">{blockchainSeal.transaction_id}</span>
                </div>
              )}
              {blockchainSeal.sequence_number != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Sequence #</span>
                  <span className="text-navy-900 font-mono">{blockchainSeal.sequence_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Consensus Hash</span>
                <code className="text-coral-600 font-mono">{blockchainSeal.consensus_hash}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sealed At</span>
                <span className="text-navy-900 font-mono">{new Date(blockchainSeal.sealed_at).toLocaleString()}</span>
              </div>
              {blockchainSeal.explorer_url && (
                <a href={blockchainSeal.explorer_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 mt-1" data-testid="explorer-link">
                  <Link2 className="w-3 h-3" />
                  <span>View on HashScan Explorer</span>
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Pipeline Connector SVG ────────────────────── */
function PipelineConnector({ agents }) {
  const getColor = (status) => {
    if (status === 'passed') return '#10B981';
    if (status === 'failed') return '#EF4444';
    if (status === 'running') return '#007AFF';
    return '#334155';
  };

  return (
    <div className="hidden lg:flex items-center justify-center py-2">
      <svg width="60" height="200" viewBox="0 0 60 200" className="text-slate-600">
        {/* Verifier line */}
        <line x1="30" y1="0" x2="30" y2="60" stroke={getColor(agents.verifier.status)} strokeWidth="2" strokeDasharray={agents.verifier.status === 'running' ? '4 4' : 'none'}>
          {agents.verifier.status === 'running' && <animate attributeName="stroke-dashoffset" values="8;0" dur="0.6s" repeatCount="indefinite" />}
        </line>
        {/* Witness line */}
        <line x1="30" y1="70" x2="30" y2="130" stroke={getColor(agents.witness.status)} strokeWidth="2" strokeDasharray={agents.witness.status === 'running' ? '4 4' : 'none'}>
          {agents.witness.status === 'running' && <animate attributeName="stroke-dashoffset" values="8;0" dur="0.6s" repeatCount="indefinite" />}
        </line>
        {/* Sealer line */}
        <line x1="30" y1="140" x2="30" y2="200" stroke={getColor(agents.sealer.status)} strokeWidth="2" strokeDasharray={agents.sealer.status === 'running' ? '4 4' : 'none'}>
          {agents.sealer.status === 'running' && <animate attributeName="stroke-dashoffset" values="8;0" dur="0.6s" repeatCount="indefinite" />}
        </line>
        {/* Dots */}
        <circle cx="30" cy="0" r="4" fill={getColor(agents.verifier.status)} />
        <circle cx="30" cy="65" r="4" fill={getColor(agents.witness.status)} />
        <circle cx="30" cy="135" r="4" fill={getColor(agents.sealer.status)} />
        <circle cx="30" cy="200" r="5" fill={getColor(agents.sealer.status)} stroke="#007AFF" strokeWidth="1" />
      </svg>
    </div>
  );
}

/* ── Main Page Component ────────────────────────── */
const CeremonyDashboard = () => {
  const { ceremonyId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [ceremony, setCeremony] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [ceremonies, setCeremonies] = useState([]);
  const [showNew, setShowNew] = useState(!ceremonyId);
  const [form, setForm] = useState({ document_name: '', signer_name: '', id_image_base64: null, selfie_base64: null });
  const [streamLog, setStreamLog] = useState([]);
  const [idCaptureMode, setIdCaptureMode] = useState('upload'); // 'upload' | 'webcam'
  const [selfieCaptureMode, setSelfieCaptureMode] = useState('upload'); // 'upload' | 'webcam'

  // Fetch ceremony detail
  const fetchCeremony = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API}/ceremony/${id}`, { headers });
      setCeremony(res.data);
      return res.data;
    } catch {
      toast({ title: 'Error', description: 'Failed to load ceremony', variant: 'destructive' });
    }
  }, [token]);

  // Fetch ceremony list
  const fetchList = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ceremony/list/my`, { headers });
      setCeremonies(res.data.ceremonies || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchList();
    if (ceremonyId) { fetchCeremony(ceremonyId); setShowNew(false); }
  }, [ceremonyId]);

  // Start new ceremony
  const handleStart = async () => {
    if (!form.document_name.trim()) return toast({ title: 'Required', description: 'Enter a document name' });
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ceremony/start`, form, { headers });
      const newId = res.data.ceremony_id;
      await fetchCeremony(newId);
      setShowNew(false);
      fetchList();
      toast({ title: 'Ceremony Created', description: 'Ready to execute the agent pipeline' });
    } catch {
      toast({ title: 'Error', description: 'Failed to start ceremony', variant: 'destructive' });
    }
    setLoading(false);
  };

  // Execute ceremony via SSE streaming
  const handleExecute = () => {
    if (!ceremony) return;
    setExecuting(true);
    setStreamLog([]);

    const url = `${API}/ceremony/${ceremony.ceremony_id}/stream`;
    const eventSource = new EventSource(url);

    const addLog = (msg) => setStreamLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

    eventSource.addEventListener('ceremony_started', () => {
      addLog('Pipeline initiated');
      setCeremony(prev => prev ? { ...prev, status: 'in_progress' } : prev);
    });

    eventSource.addEventListener('agent_started', (e) => {
      const d = JSON.parse(e.data);
      addLog(`${d.agent.charAt(0).toUpperCase() + d.agent.slice(1)} Agent analyzing...`);
      setCeremony(prev => {
        if (!prev) return prev;
        return { ...prev, agents: { ...prev.agents, [d.agent]: { ...prev.agents[d.agent], status: 'running' } } };
      });
    });

    eventSource.addEventListener('agent_completed', (e) => {
      const d = JSON.parse(e.data);
      const pct = d.confidence ? Math.round(d.confidence * 100) : '?';
      addLog(`${d.agent.charAt(0).toUpperCase() + d.agent.slice(1)} Agent: ${d.verdict} (${pct}%)`);
      setCeremony(prev => {
        if (!prev) return prev;
        return { ...prev, agents: { ...prev.agents, [d.agent]: { ...prev.agents[d.agent], status: d.verdict === 'PASS' ? 'passed' : 'failed', verdict: d.verdict, confidence: d.confidence } } };
      });
    });

    eventSource.addEventListener('consensus_started', (e) => {
      const d = JSON.parse(e.data);
      addLog(d.message || 'Evaluating consensus...');
    });

    eventSource.addEventListener('sealing_blockchain', (e) => {
      const d = JSON.parse(e.data);
      addLog(d.message || 'Submitting to Hedera...');
    });

    eventSource.addEventListener('consensus_reached', (e) => {
      const d = JSON.parse(e.data);
      addLog(`Consensus: ${d.result} (${d.pass_count}/${Object.keys(d.votes).length} PASS)`);
      if (d.blockchain_seal?.hcs_submitted) {
        addLog(`Sealed on Hedera — Topic ${d.blockchain_seal.topic_id}`);
      }
    });

    eventSource.addEventListener('certificate_generated', () => {
      addLog('Certificate PDF generated');
      setCeremony(prev => prev ? { ...prev, has_certificate: true } : prev);
    });

    eventSource.addEventListener('ceremony_complete', () => {
      addLog('Ceremony complete');
      eventSource.close();
      setExecuting(false);
      fetchCeremony(ceremony.ceremony_id);
      fetchList();
    });

    eventSource.addEventListener('error', () => {
      // SSE reconnect or end — fetch final state
      eventSource.close();
      setTimeout(() => {
        fetchCeremony(ceremony.ceremony_id);
        fetchList();
        setExecuting(false);
      }, 1000);
    });
  };

  const agents = ceremony?.agents || { verifier: { status: 'idle' }, witness: { status: 'idle' }, sealer: { status: 'idle' } };
  const statusColor = {
    pending: 'text-slate-600',
    in_progress: 'text-blue-400',
    sealed: 'text-coral-600',
    consensus_failed: 'text-red-400',
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <h1 className="text-navy-900 font-semibold tracking-tight">Notarization Ceremony</h1>
              </div>
            </div>
            <Button size="sm" onClick={() => { setShowNew(true); setCeremony(null); setForm({ document_name: '', signer_name: '', id_image_base64: null, selfie_base64: null }); }} className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs" data-testid="new-ceremony-btn">
              <Play className="w-3.5 h-3.5 mr-1.5" /> New Ceremony
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Ceremony' }]} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Sidebar — History */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-navy-900 font-semibold text-sm tracking-tight">Ceremony History</h2>
              <Button variant="ghost" size="sm" onClick={fetchList} className="text-slate-500 hover:text-navy-900 h-7 w-7 p-0">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto" data-testid="ceremony-history">
              {ceremonies.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-8">No ceremonies yet</p>
              ) : ceremonies.map(c => (
                <button
                  key={c.ceremony_id}
                  onClick={() => { fetchCeremony(c.ceremony_id); setShowNew(false); }}
                  className={`w-full text-left p-3 rounded-sm border transition-all ${ceremony?.ceremony_id === c.ceremony_id ? 'bg-white border-blue-500/40' : 'bg-white/50 border-slate-200 hover:border-slate-500'}`}
                  data-testid={`ceremony-item-${c.ceremony_id}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-navy-900 text-sm font-medium truncate">{c.document_name}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-bold tracking-wider uppercase ${c.status === 'sealed' ? 'text-coral-600' : c.status === 'consensus_failed' ? 'text-red-400' : 'text-slate-500'}`}>
                      {c.status === 'sealed' ? 'SEALED' : c.status === 'consensus_failed' ? 'REJECTED' : c.status?.toUpperCase()}
                    </span>
                    <span className="text-slate-600 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            {showNew ? (
              /* ── New Ceremony Form ──── */
              <Card className="bg-white border-slate-200 rounded-sm" data-testid="new-ceremony-form">
                <CardContent className="p-8">
                  <div className="max-w-lg mx-auto">
                    <div className="text-center mb-8">
                      <div className="w-14 h-14 rounded-sm bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-7 h-7 text-blue-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-navy-900 tracking-tight mb-2">Initialize Ceremony</h2>
                      <p className="text-slate-600 text-sm">Start a multi-agent notarization verification pipeline</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-navy-900 text-sm block mb-1.5 font-medium">Document Name</label>
                        <Input
                          value={form.document_name}
                          onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))}
                          placeholder="e.g., Power of Attorney - Smith Estate"
                          className="bg-cream-100 border-slate-200 text-navy-900 rounded-sm"
                          data-testid="ceremony-doc-name"
                        />
                      </div>
                      <div>
                        <label className="text-navy-900 text-sm block mb-1.5 font-medium">Signer Name</label>
                        <Input
                          value={form.signer_name}
                          onChange={e => setForm(f => ({ ...f, signer_name: e.target.value }))}
                          placeholder="e.g., John Smith"
                          className="bg-cream-100 border-slate-200 text-navy-900 rounded-sm"
                          data-testid="ceremony-signer-name"
                        />
                      </div>

                      {/* Biometric Verification Images */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <ScanFace className="w-4 h-4 text-purple-400" />
                          <span className="text-navy-900 text-sm font-medium">AI Biometric Verification</span>
                          <span className="text-[10px] text-slate-500 bg-cream-200 px-2 py-0.5 rounded-sm">GPT-5.2 Vision</span>
                        </div>
                        <p className="text-slate-500 text-xs mb-3">Upload images or use your webcam for real AI-powered identity verification. Without images, the Verifier Agent uses simulated checks.</p>

                        <div className="grid grid-cols-2 gap-3">
                          {/* ID Document */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-navy-800 text-xs">ID Document</label>
                              <div className="flex gap-1">
                                <button onClick={() => { setIdCaptureMode('upload'); }} className={`text-[9px] px-1.5 py-0.5 rounded-sm transition-colors ${idCaptureMode === 'upload' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-500 hover:text-navy-800'}`} data-testid="id-mode-upload">Upload</button>
                                <button onClick={() => { setIdCaptureMode('webcam'); }} className={`text-[9px] px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-0.5 ${idCaptureMode === 'webcam' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-navy-800'}`} data-testid="id-mode-webcam"><Camera className="w-2.5 h-2.5" />Cam</button>
                              </div>
                            </div>
                            {idCaptureMode === 'webcam' ? (
                              <WebcamCapture
                                label="Capture ID"
                                onCapture={(b64) => setForm(f => ({ ...f, id_image_base64: b64 }))}
                                onCancel={() => setIdCaptureMode('upload')}
                              />
                            ) : (
                              <label
                                className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-sm cursor-pointer transition-all ${form.id_image_base64 ? 'border-purple-500/50 bg-purple-500/10' : 'border-slate-200 bg-cream-100 hover:border-slate-500'}`}
                                data-testid="upload-id-image"
                              >
                                {form.id_image_base64 ? (
                                  <div className="text-center">
                                    <CheckCircle className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                                    <span className="text-purple-300 text-[11px]">ID uploaded</span>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <Fingerprint className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                                    <span className="text-slate-500 text-[11px]">Drop or click</span>
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = () => setForm(f => ({ ...f, id_image_base64: reader.result.split(',')[1] }));
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          {/* Selfie Photo */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-navy-800 text-xs">Selfie Photo</label>
                              <div className="flex gap-1">
                                <button onClick={() => { setSelfieCaptureMode('upload'); }} className={`text-[9px] px-1.5 py-0.5 rounded-sm transition-colors ${selfieCaptureMode === 'upload' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-navy-800'}`} data-testid="selfie-mode-upload">Upload</button>
                                <button onClick={() => { setSelfieCaptureMode('webcam'); }} className={`text-[9px] px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-0.5 ${selfieCaptureMode === 'webcam' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-navy-800'}`} data-testid="selfie-mode-webcam"><Camera className="w-2.5 h-2.5" />Cam</button>
                              </div>
                            </div>
                            {selfieCaptureMode === 'webcam' ? (
                              <WebcamCapture
                                label="Take Selfie"
                                onCapture={(b64) => setForm(f => ({ ...f, selfie_base64: b64 }))}
                                onCancel={() => setSelfieCaptureMode('upload')}
                              />
                            ) : (
                              <label
                                className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-sm cursor-pointer transition-all ${form.selfie_base64 ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-200 bg-cream-100 hover:border-slate-500'}`}
                                data-testid="upload-selfie"
                              >
                                {form.selfie_base64 ? (
                                  <div className="text-center">
                                    <CheckCircle className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                                    <span className="text-blue-300 text-[11px]">Selfie uploaded</span>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <ScanFace className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                                    <span className="text-slate-500 text-[11px]">Drop or click</span>
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = () => setForm(f => ({ ...f, selfie_base64: reader.result.split(',')[1] }));
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button onClick={handleStart} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm mt-2" data-testid="start-ceremony-btn">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {loading ? 'Initializing...' : 'Start Ceremony'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : ceremony ? (
              /* ── Ceremony Pipeline View ──── */
              <div className="space-y-6">
                {/* Ceremony Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-navy-900 tracking-tight">{ceremony.document_name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-slate-500 text-xs">Signer: <span className="text-navy-800">{ceremony.signer_name}</span></span>
                      <span className="text-slate-700">|</span>
                      <span className={`text-xs font-bold tracking-wider uppercase ${statusColor[ceremony.status] || 'text-slate-600'}`} data-testid="ceremony-status">
                        {ceremony.status?.toUpperCase()}
                      </span>
                      {ceremony.has_id_image && (
                        <>
                          <span className="text-slate-700">|</span>
                          <span className="text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-sm">AI BIOMETRICS</span>
                        </>
                      )}
                    </div>
                  </div>
                  {ceremony.status === 'pending' && (
                    <Button onClick={handleExecute} disabled={executing} className="bg-blue-600 hover:bg-blue-700 rounded-sm" data-testid="execute-ceremony-btn">
                      {executing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {executing ? 'Running Pipeline...' : 'Execute Pipeline'}
                    </Button>
                  )}
                  {ceremony.status === 'consensus_failed' && (
                    <Button onClick={handleExecute} disabled={executing} variant="outline" className="border-amber-500/50 text-coral-600 hover:bg-coral-500/10 rounded-sm" data-testid="retry-ceremony-btn">
                      <RotateCcw className="w-4 h-4 mr-2" /> Retry
                    </Button>
                  )}
                  {ceremony.status === 'sealed' && ceremony.has_certificate && (
                    <a href={`${API}/ceremony/${ceremony.ceremony_id}/certificate`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="border-emerald-500/50 text-coral-600 hover:bg-coral-500/10 rounded-sm" data-testid="download-certificate-btn">
                        <FileSearch className="w-4 h-4 mr-2" /> Download Certificate
                      </Button>
                    </a>
                  )}
                  {(ceremony.status === 'sealed' || ceremony.status === 'consensus_failed') && (
                    <Button variant="outline" onClick={() => navigate(`/ceremony-replay/${ceremony.ceremony_id}`)}
                      className="border-sky-500/50 text-coral-600 hover:bg-sky-500/10 rounded-sm" data-testid="replay-ceremony-btn">
                      <Play className="w-4 h-4 mr-2" /> Replay
                    </Button>
                  )}
                </div>

                {/* Agent Pipeline */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <AgentCard name="Verifier" icon={ScanFace} agent={agents.verifier} accent="bg-purple-500/20 text-purple-400" />
                  <AgentCard name="Witness" icon={Eye} agent={agents.witness} accent="bg-blue-500/20 text-blue-400" />
                  <AgentCard name="Sealer" icon={Lock} agent={agents.sealer} accent="bg-coral-500/20 text-coral-600" />
                </div>

                {/* Pipeline Flow Indicator */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {['verifier', 'witness', 'sealer'].map((a, i) => (
                    <React.Fragment key={a}>
                      <div className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${agents[a].status === 'passed' ? 'bg-coral-500 border-emerald-500' : agents[a].status === 'failed' ? 'bg-red-500 border-red-500' : agents[a].status === 'running' ? 'bg-blue-500 border-blue-500 animate-pulse' : 'bg-transparent border-slate-600'}`} />
                      {i < 2 && <div className={`w-16 h-0.5 transition-all duration-500 ${agents[a].status === 'passed' ? 'bg-coral-500' : agents[a].status === 'failed' ? 'bg-red-500' : 'bg-slate-700'}`} />}
                    </React.Fragment>
                  ))}
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className={`w-4 h-4 rounded-sm border-2 transition-all duration-500 ${ceremony.status === 'sealed' ? 'bg-coral-500 border-emerald-500' : ceremony.status === 'consensus_failed' ? 'bg-red-500 border-red-500' : 'bg-transparent border-slate-600'}`} />
                </div>

                {/* Consensus Oracle */}
                <ConsensusOracle consensus={ceremony.consensus} blockchainSeal={ceremony.blockchain_seal} />

                {/* Live Stream Log */}
                {streamLog.length > 0 && (
                  <Card className="bg-cream-100 border-slate-200 rounded-sm" data-testid="ceremony-stream-log">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2 h-2 rounded-full ${executing ? 'bg-blue-500 animate-pulse' : 'bg-coral-500'}`} />
                        <span className="text-slate-600 text-xs font-bold tracking-wider uppercase">
                          {executing ? 'Live Stream' : 'Execution Log'}
                        </span>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                        {streamLog.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-slate-600 flex-shrink-0">{entry.time}</span>
                            <span className={
                              entry.msg.includes('PASS') ? 'text-coral-600' :
                              entry.msg.includes('FAIL') ? 'text-red-400' :
                              entry.msg.includes('APPROVED') ? 'text-coral-600' :
                              entry.msg.includes('REJECTED') ? 'text-red-400' :
                              entry.msg.includes('Hedera') ? 'text-blue-400' :
                              'text-navy-800'
                            }>{entry.msg}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <Shield className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Select a ceremony or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CeremonyDashboard;
