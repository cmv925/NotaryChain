import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import AnanListView from '../components/anan/AnanListView';
import AnanDetailView from '../components/anan/AnanDetailView';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
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
  }, [headers]);

  const fetchDetail = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API}/anan/ceremony/${id}`, { headers });
      setCurrent(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load ceremony', variant: 'destructive' });
    }
  }, [headers]);

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/anan/escalations`, { headers });
      setEscalations(res.data.escalations);
    } catch { /* ignore */ }
  }, [headers]);

  useEffect(() => {
    if (!token) return;
    if (ceremonyId) {
      fetchDetail(ceremonyId);
      setView('detail');
    } else {
      fetchList();
      fetchEscalations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
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

  // ─── Badge ───
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

  const handleVerifyBond = async () => {
    try {
      const res = await axios.get(`${API}/anan/bond/verify`, { headers });
      if (res.data.verified) {
        toast({ title: 'Bond Verified', description: `Chain balance matches DB: $${res.data.chain_balance?.toLocaleString()}` });
      } else {
        toast({ title: 'Verification Result', description: res.data.reason || `DB: $${res.data.db_balance} | Chain: $${res.data.chain_balance}`, variant: 'destructive' });
      }
    } catch { toast({ title: 'Verify unavailable', variant: 'destructive' }); }
  };

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  // ─── Render ───
  if (view === 'list' || !ceremonyId) {
    return (
      <AnanListView
        stats={stats}
        bond={bond}
        reputation={reputation}
        escalations={escalations}
        ceremonies={ceremonies}
        loading={loading}
        actionLoading={actionLoading}
        showCreate={showCreate}
        form={form}
        setShowCreate={setShowCreate}
        setForm={setForm}
        handleCreate={handleCreate}
        handleTuneWeights={handleTuneWeights}
        handleResolve={handleResolve}
        handleVerifyBond={handleVerifyBond}
        navigate={navigate}
      />
    );
  }

  if (!current) {
    return <div className="min-h-screen bg-navy-900 flex items-center justify-center"><Loader2 className="w-8 h-8 text-coral-600 animate-spin" /></div>;
  }

  return (
    <AnanDetailView
      current={current}
      streaming={streaming}
      actionLoading={actionLoading}
      sseEvents={sseEvents}
      badgeData={badgeData}
      showBadge={showBadge}
      handleExecuteStream={handleExecuteStream}
      handleExecute={handleExecute}
      fetchBadge={fetchBadge}
      setShowBadge={setShowBadge}
      copyToClipboard={copyToClipboard}
    />
  );
}
