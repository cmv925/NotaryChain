import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Shield, Plus, FileText, DollarSign, CheckCircle, XCircle,
  Clock, Loader2, ChevronRight, Blocks,
  ShieldCheck, AlertTriangle, Lock, Unlock, Eye,
  Fingerprint, Brain, Globe, Landmark, Home, Scale,
  Building2, User, Users, Sparkles, Radio, Camera,
  Truck, ClipboardCheck, ImageIcon, Scan, Zap, Briefcase,
  ArrowDownToLine, ArrowUpFromLine, Network, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  draft:          { label: 'Draft',          color: 'text-slate-500 bg-gray-500/15 border-slate-300/25' },
  active:         { label: 'Active',         color: 'text-blue-400 bg-blue-500/15 border-blue-500/25' },
  conditions_met: { label: 'Conditions Met', color: 'text-coral-600 bg-coral-500/15 border-emerald-500/25' },
  settling:       { label: 'Settling',       color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25' },
  settled:        { label: 'Settled',        color: 'text-coral-600 bg-coral-500/15 border-emerald-500/25' },
  disputed:       { label: 'Disputed',       color: 'text-red-400 bg-red-500/15 border-red-500/25' },
};

const ORACLE_ICONS = { shipping_tracker: Truck, inspection_service: ClipboardCheck, appraisal_service: Building2, title_company_api: Scale, ai_photo_verification: ImageIcon };
const CAT_ICONS = { inspection: Eye, financing: Landmark, title: Scale, appraisal: Building2, closing: Lock, walkthrough: Home };

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${cfg.color}`} data-testid={`status-${status}`}>{cfg.label}</span>;
}

export default function EscrowDashboard() {
  const { escrowId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { connected: wsConnected, subscribe } = useWS();
  const [view, setView] = useState(escrowId ? 'detail' : 'list');
  const [escrows, setEscrows] = useState([]);
  const [currentEscrow, setCurrentEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const webcamRef = useRef(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/escrow/list`, { headers });
      setEscrows(res.data.escrows);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const fetchEscrow = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API}/escrow/${id}`, { headers });
      setCurrentEscrow(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load escrow', variant: 'destructive' });
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (escrowId) { fetchEscrow(escrowId); setView('detail'); }
    else fetchEscrows();
  }, [token, escrowId]);

  // WebSocket subscriptions for real-time escrow events
  useEffect(() => {
    if (!subscribe) return;
    const unsubs = [];

    const handleEvent = (msg) => {
      const data = msg.data || {};
      const evtEscrowId = data.escrow_id;
      const escrowTitle = data.title || 'Escrow';
      const now = new Date().toLocaleTimeString();

      // Show toast for the event
      if (msg.event === 'escrow_oracle') {
        const met = data.condition_met;
        toast({
          title: `Oracle: ${met ? 'Condition Verified' : 'Not Yet Met'}`,
          description: `${data.oracle_source}: "${data.condition_title}" (${data.met_count}/${data.total}) — ${escrowTitle}`,
          variant: met ? 'default' : 'destructive',
        });
      } else if (msg.event === 'escrow_biometric') {
        toast({
          title: data.verified ? 'Biometric Gate: Passed' : 'Biometric Gate: Failed',
          description: `${data.party_role?.charAt(0).toUpperCase() + data.party_role?.slice(1)} identity ${data.verified ? 'confirmed' : 'not confirmed'} — ${escrowTitle}`,
          variant: data.verified ? 'default' : 'destructive',
        });
      } else if (msg.event === 'escrow_settlement') {
        toast({
          title: 'Settlement Complete!',
          description: `$${data.amount_released?.toLocaleString()} released. Hash: ${data.settlement_hash}... — ${escrowTitle}`,
        });
      } else if (msg.event === 'escrow_photo_verified') {
        toast({
          title: data.verified ? 'Photo Evidence: Verified' : 'Photo Evidence: Insufficient',
          description: `"${data.condition_title}" — Quality: ${data.evidence_quality} — ${escrowTitle}`,
          variant: data.verified ? 'default' : 'destructive',
        });
      }

      // Add to live events feed
      setLiveEvents(prev => [{
        id: Date.now(),
        event: msg.event,
        data,
        time: now,
      }, ...prev].slice(0, 20));

      // Auto-refresh current escrow if it matches
      if (evtEscrowId && currentEscrow?.escrow_id === evtEscrowId) {
        fetchEscrow(evtEscrowId);
      }
    };

    unsubs.push(subscribe('escrow_oracle', handleEvent));
    unsubs.push(subscribe('escrow_biometric', handleEvent));
    unsubs.push(subscribe('escrow_settlement', handleEvent));
    unsubs.push(subscribe('escrow_photo_verified', handleEvent));

    return () => unsubs.forEach(u => u && u());
  }, [subscribe, currentEscrow?.escrow_id]);

  const openEscrow = (id) => navigate(`/escrow/${id}`);

  // ─── FORM STATE ───
  const [createForm, setCreateForm] = useState({ title: '', description: '', buyer_name: '', seller_name: '', seller_email: '', escrow_amount: '', document_name: '', escrow_type: 'real_estate' });

  const handleCreate = async () => {
    if (!createForm.title || !createForm.escrow_amount) { toast({ title: 'Error', description: 'Title and escrow amount required', variant: 'destructive' }); return; }
    setActionLoading('create');
    try {
      const res = await axios.post(`${API}/escrow/create`, { ...createForm, escrow_amount: parseFloat(createForm.escrow_amount) }, { headers });
      toast({ title: 'Escrow Created', description: `"${createForm.title}" created` });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', buyer_name: '', seller_name: '', seller_email: '', escrow_amount: '', document_name: '', escrow_type: 'real_estate' });
      navigate(`/escrow/${res.data.escrow_id}`);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  const handleExtract = async () => {
    if (!currentEscrow) return;
    setActionLoading('extract');
    try {
      let res;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/extract-conditions`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/extract-conditions`, { document_name: currentEscrow.document?.name || 'Purchase Agreement' }, { headers });
      }
      toast({ title: `${res.data.ai_powered ? 'GPT-5.2 AI' : 'Demo'} Extraction Complete`, description: `${res.data.total} performance triggers extracted` });
      setUploadedFile(null);
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Extraction failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  const handleDeposit = async () => {
    if (!currentEscrow) return;
    setActionLoading('deposit');
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/deposit`, {}, { headers });
      toast({ title: 'Funds Deposited', description: `$${res.data.amount.toLocaleString()} locked in smart vault` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  const handleVerify = async (conditionId) => {
    if (!currentEscrow) return;
    setActionLoading(`verify-${conditionId}`);
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/verify-condition`, { condition_id: conditionId }, { headers });
      toast({ title: 'Condition Verified', description: res.data.all_conditions_met ? 'All triggers satisfied! Ready for biometric settlement.' : `Verified (${res.data.met_count}/${res.data.total})` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  const handleOracleVerify = async (conditionId) => {
    if (!currentEscrow) return;
    setActionLoading(`oracle-${conditionId}`);
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/oracle-verify/${conditionId}`, {}, { headers });
      const met = res.data.oracle_result?.condition_met;
      toast({ title: met ? 'Oracle: Condition Met' : 'Oracle: Not Yet Met', description: `${res.data.oracle_result?.source}: ${met ? 'Verified' : 'Pending verification'}`, variant: met ? 'default' : 'destructive' });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Oracle check failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  const handleBiometricGate = async () => {
    if (!currentEscrow) return;
    setActionLoading('biometric');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      await new Promise(r => setTimeout(r, 1500));
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 480;
      canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
      stream.getTracks().forEach(t => t.stop());
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/biometric-gate`, { selfie_base64: base64, party_role: 'buyer' }, { headers });
      if (res.data.gate_passed) {
        toast({ title: 'Biometric Verified', description: `Identity confirmed with ${(res.data.biometric_result.confidence * 100).toFixed(0)}% confidence` });
      } else {
        toast({ title: 'Verification Failed', description: res.data.biometric_result?.analysis || 'Please try again', variant: 'destructive' });
      }
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) {
      toast({ title: 'Biometric Error', description: err.message?.includes('getUserMedia') ? 'Camera access denied. Please enable camera permissions.' : (err.response?.data?.detail || 'Biometric verification failed'), variant: 'destructive' });
    }
    setActionLoading(null);
    setShowBiometricModal(false);
  };

  const handleSettle = async () => {
    if (!currentEscrow) return;
    setActionLoading('settle');
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/settle`, {}, { headers });
      toast({ title: 'Settlement Complete!', description: `$${res.data.amount_released.toLocaleString()} released. Hash: ${res.data.settlement_hash.slice(0, 16)}...` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Settlement failed', variant: 'destructive' }); }
    setActionLoading(null);
  };

  // ═══════════════════════════════════════════════════════
  //  RENDER — LIST VIEW
  // ═══════════════════════════════════════════════════════
  if (view === 'list' || (!escrowId && !showCreate)) {
    return (
      <div className="min-h-screen bg-cream-100 text-navy-900">
        <div className="bg-cream-100 border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Scale className="w-5 h-5 text-navy-900" /></div>
              <div>
                <h1 className="text-navy-900 font-bold text-lg">Dynamic Escrow Intelligence</h1>
                <p className="text-slate-500 text-xs">AI Orchestrator + Oracle Verification + Biometric Settlement</p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700 text-navy-900" data-testid="create-escrow-btn"><Plus className="w-4 h-4 mr-2" /> New Escrow</Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Escrow Intelligence' }]} />

          {/* Trust Gap Intro Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <TrustGapCard icon={Zap} color="amber" number="1" title="Execution Gap" desc="AI extracts performance triggers and locks funds in a smart vault until milestones are met." />
            <TrustGapCard icon={Network} color="cyan" number="2" title="Verification Gap" desc="Oracles and AI Vision autonomously confirm milestones via shipping, inspection, and photo evidence." />
            <TrustGapCard icon={Fingerprint} color="purple" number="3" title="Security Gap" desc="Biometric Proof of Intent ties the escrow key to your verified identity at settlement." />
          </div>

          {showCreate && (
            <Card className="bg-cream-100 border-gold-500/30 mb-6" data-testid="create-escrow-form">
              <CardContent className="p-6">
                <h2 className="text-navy-900 font-bold text-lg mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-coral-600" /> New Escrow Agreement</h2>
                {/* Template Selector */}
                <div className="mb-5">
                  <label className="text-slate-500 text-xs block mb-2">Escrow Template</label>
                  <div className="grid grid-cols-2 gap-3" data-testid="template-selector">
                    <button type="button" onClick={() => setCreateForm(f => ({ ...f, escrow_type: 'real_estate' }))}
                      className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all text-left ${createForm.escrow_type === 'real_estate' ? 'border-amber-500 bg-coral-500/10 text-navy-900' : 'border-slate-200 bg-cream-100 text-slate-500 hover:border-slate-200'}`}
                      data-testid="template-real-estate">
                      <Home className={`w-5 h-5 flex-shrink-0 ${createForm.escrow_type === 'real_estate' ? 'text-coral-600' : 'text-slate-500'}`} />
                      <div><p className="font-medium text-sm">Real Estate</p><p className="text-[11px] text-slate-500">6 milestones, inspection to closing</p></div>
                    </button>
                    <button type="button" onClick={() => setCreateForm(f => ({ ...f, escrow_type: 'freelancer' }))}
                      className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all text-left ${createForm.escrow_type === 'freelancer' ? 'border-amber-500 bg-coral-500/10 text-navy-900' : 'border-slate-200 bg-cream-100 text-slate-500 hover:border-slate-200'}`}
                      data-testid="template-freelancer">
                      <Briefcase className={`w-5 h-5 flex-shrink-0 ${createForm.escrow_type === 'freelancer' ? 'text-coral-600' : 'text-slate-500'}`} />
                      <div><p className="font-medium text-sm">Freelancer</p><p className="text-[11px] text-slate-500">5 milestones, kickoff to delivery</p></div>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="text-slate-500 text-xs block mb-1">Agreement Title *</label><Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 123 Main St Purchase" className="bg-cream-100 border-slate-200 text-navy-900" data-testid="escrow-title-input" /></div>
                  <div><label className="text-slate-500 text-xs block mb-1">Escrow Amount (USD) *</label><Input type="number" value={createForm.escrow_amount} onChange={e => setCreateForm(f => ({ ...f, escrow_amount: e.target.value }))} placeholder="350000" className="bg-cream-100 border-slate-200 text-navy-900" data-testid="escrow-amount-input" /></div>
                  <div><label className="text-slate-500 text-xs block mb-1">Buyer Name</label><Input value={createForm.buyer_name} onChange={e => setCreateForm(f => ({ ...f, buyer_name: e.target.value }))} placeholder="John Doe" className="bg-cream-100 border-slate-200 text-navy-900" /></div>
                  <div><label className="text-slate-500 text-xs block mb-1">Seller Name</label><Input value={createForm.seller_name} onChange={e => setCreateForm(f => ({ ...f, seller_name: e.target.value }))} placeholder="Jane Smith" className="bg-cream-100 border-slate-200 text-navy-900" /></div>
                  <div><label className="text-slate-500 text-xs block mb-1">Seller Email</label><Input value={createForm.seller_email} onChange={e => setCreateForm(f => ({ ...f, seller_email: e.target.value }))} placeholder="seller@email.com" className="bg-cream-100 border-slate-200 text-navy-900" /></div>
                  <div><label className="text-slate-500 text-xs block mb-1">Document Name</label><Input value={createForm.document_name} onChange={e => setCreateForm(f => ({ ...f, document_name: e.target.value }))} placeholder="Purchase Agreement" className="bg-cream-100 border-slate-200 text-navy-900" /></div>
                </div>
                <div className="mb-4"><label className="text-slate-500 text-xs block mb-1">Description</label><Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" className="bg-cream-100 border-slate-200 text-navy-900" /></div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={actionLoading === 'create'} className="bg-amber-600 hover:bg-amber-700" data-testid="submit-escrow-btn">{actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Create Agreement</Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-200 text-slate-500">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-coral-600 animate-spin" /></div>
          ) : escrows.length === 0 ? (
            <Card className="bg-cream-100 border-slate-200"><CardContent className="p-12 text-center"><Scale className="w-14 h-14 text-slate-700 mx-auto mb-4" /><h3 className="text-navy-900 font-bold text-lg mb-2">No Escrow Agreements Yet</h3><p className="text-slate-500 text-sm mb-4">Create your first AI-powered escrow agreement to get started.</p><Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4 mr-2" /> Create First Escrow</Button></CardContent></Card>
          ) : (
            <div className="space-y-3" data-testid="escrow-list">
              {escrows.map((e) => (
                <Card key={e.escrow_id} className="bg-cream-100 border-slate-200 hover:border-gold-500/30 transition-colors cursor-pointer" onClick={() => openEscrow(e.escrow_id)} data-testid={`escrow-card-${e.escrow_id}`}>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-coral-500/10 flex items-center justify-center flex-shrink-0"><Scale className="w-5 h-5 text-coral-600" /></div>
                      <div>
                        <h3 className="text-navy-900 font-semibold text-sm">{e.title}</h3>
                        <p className="text-slate-500 text-xs mt-0.5">{e.parties?.buyer?.name || 'Buyer'} &#8594; {e.parties?.seller?.name || 'Seller'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-navy-900 font-bold text-sm">${e.financial?.escrow_amount?.toLocaleString()}</p>
                        <p className="text-slate-500 text-xs">{e.conditions_met_count || 0}/{e.conditions_total || 0} triggers</p>
                      </div>
                      <StatusBadge status={e.status} />
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
  //  RENDER — DETAIL VIEW
  // ═══════════════════════════════════════════════════════
  if (!currentEscrow) return <div className="min-h-screen bg-cream-100 flex items-center justify-center"><Loader2 className="w-8 h-8 text-coral-600 animate-spin" /></div>;

  const e = currentEscrow;
  const progress = e.conditions_total > 0 ? (e.conditions_met_count / e.conditions_total) * 100 : 0;
  const biometricPassed = e.settlement?.biometric_gate_passed;
  const buyerBio = e.parties?.buyer?.biometric_verified;
  const sellerBio = e.parties?.seller?.biometric_verified;

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      {/* Header */}
      <div className="bg-cream-100 border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Scale className="w-5 h-5 text-navy-900" /></div>
            <div>
              <h1 className="text-navy-900 font-bold text-lg">{e.title}</h1>
              <p className="text-slate-500 text-xs">{e.escrow_type === 'freelancer' ? 'Freelancer Escrow' : e.escrow_type === 'real_estate' ? 'Real Estate Escrow' : 'Escrow Agreement'} &#8212; {e.escrow_id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={e.status} />
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border ${wsConnected ? 'text-coral-600 border-coral-200 bg-coral-500/10' : 'text-slate-500 border-slate-200 bg-gray-800'}`} data-testid="ws-status-indicator">
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Escrow', path: '/escrow' }, { label: e.title }]} />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Smart Vault" value={`$${e.financial.escrow_amount.toLocaleString()}`} icon={DollarSign} colorClass="text-coral-600 bg-coral-500/10" />
          <SummaryCard label="Vault Status" value={e.financial.deposit_status === 'held' ? 'FUNDS LOCKED' : e.financial.deposit_status === 'released' ? 'RELEASED' : 'PENDING'} icon={e.financial.deposit_status === 'held' ? Lock : Unlock} colorClass={e.financial.deposit_status === 'held' ? 'text-coral-600 bg-coral-500/10' : 'text-slate-500 bg-gray-500/10'} />
          <SummaryCard label="Performance Triggers" value={`${e.conditions_met_count}/${e.conditions_total}`} icon={Zap} colorClass="text-blue-400 bg-blue-500/10" />
          <SummaryCard label="Biometric Gate" value={biometricPassed ? 'PASSED' : buyerBio || sellerBio ? 'PARTIAL' : 'PENDING'} icon={Fingerprint} colorClass={biometricPassed ? 'text-coral-600 bg-coral-500/10' : 'text-purple-400 bg-purple-500/10'} />
        </div>

        {/* Progress Bar */}
        {e.conditions_total > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Escrow Progress</span>
              <span>{e.conditions_met_count}/{e.conditions_total} triggers verified</span>
            </div>
            <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'italic text-coral-600' : 'italic text-coral-600'}`} style={{ width: `${progress}%` }} data-testid="escrow-progress-bar" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — Main Content */}
          <div className="lg:col-span-2 space-y-4">

            {/* ═══ TRUST GAP 1: EXECUTION ═══ */}
            <Card className="bg-cream-100 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-coral-500/15 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-coral-600" /></div>
                  <h3 className="text-navy-900 font-bold text-sm">Trust Gap 1: Execution</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-coral-500/10 text-coral-600 border border-amber-500/20 font-bold">AI ORCHESTRATOR</span>
                </div>
                <p className="text-slate-500 text-xs mb-3">The AI Orchestrator extracts Performance Triggers from your contract and locks funds in a smart vault that only opens when milestones are verified.</p>

                {e.status === 'draft' && (
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${uploadedFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-200 hover:border-purple-500/30'}`} data-testid="upload-contract">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${uploadedFile ? 'bg-purple-500/15' : 'bg-white'}`}>
                        {uploadedFile ? <CheckCircle className="w-5 h-5 text-purple-400" /> : <FileText className="w-5 h-5 text-slate-500" />}
                      </div>
                      <div className="flex-1">
                        {uploadedFile ? (
                          <><p className="text-purple-300 text-sm font-medium">{uploadedFile.name}</p><p className="text-purple-400/60 text-[10px]">{(uploadedFile.size / 1024).toFixed(1)} KB ready for AI</p></>
                        ) : (
                          <><p className="text-slate-500 text-sm">Upload Contract Document</p><p className="text-slate-600 text-[10px]">PDF, DOCX, or TXT for real GPT-5.2 extraction</p></>
                        )}
                      </div>
                      <input type="file" accept=".pdf,.docx,.txt,.doc" className="hidden" onChange={(ev) => setUploadedFile(ev.target.files?.[0] || null)} />
                    </label>
                    <div className="flex gap-2">
                      <Button onClick={handleExtract} disabled={actionLoading === 'extract'} className={`${uploadedFile ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'}`} data-testid="extract-conditions-btn">
                        {actionLoading === 'extract' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                        {uploadedFile ? 'AI Extract (GPT-5.2)' : 'Demo Extract'}
                      </Button>
                      {uploadedFile && <Button variant="outline" size="sm" onClick={() => setUploadedFile(null)} className="border-slate-200 text-slate-500">Clear</Button>}
                    </div>
                  </div>
                )}

                {e.status === 'active' && e.financial.deposit_status === 'pending' && (
                  <Button onClick={handleDeposit} disabled={actionLoading === 'deposit'} className="bg-coral-500 hover:bg-emerald-700" data-testid="deposit-funds-btn">
                    {actionLoading === 'deposit' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
                    Deposit Funds into Smart Vault
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* ═══ TRUST GAP 2: VERIFICATION — Conditions List ═══ */}
            {e.conditions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-cyan-500/15 flex items-center justify-center"><Network className="w-3.5 h-3.5 text-coral-600" /></div>
                  <h3 className="text-navy-900 font-bold text-sm">Trust Gap 2: Verification</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-coral-600 border border-cyan-500/20 font-bold">ORACLE + AI VISION</span>
                </div>
                <p className="text-slate-500 text-xs -mt-1 ml-8">Conditions are verified autonomously by oracles (shipping, inspection, appraisal) or AI-analyzed photo evidence.</p>

                <div className="space-y-2" data-testid="conditions-list">
                  {e.conditions.map((c) => {
                    const CatIcon = CAT_ICONS[c.category] || FileText;
                    const OracleIcon = ORACLE_ICONS[c.oracle_type] || Globe;
                    const isMet = c.status === 'met';
                    const isOracle = c.verification_method === 'oracle' || c.verification_method === 'ai_photo_verification';
                    const isBiometric = c.verification_method === 'biometric_confirmation';
                    return (
                      <Card key={c.condition_id} className={`border transition-colors ${isMet ? 'bg-coral-500/5 border-coral-200' : 'bg-cream-100 border-slate-200'}`} data-testid={`condition-${c.condition_id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMet ? 'bg-coral-500/15' : 'bg-white'}`}>
                                {isMet ? <CheckCircle className="w-5 h-5 text-coral-600" /> : <CatIcon className="w-5 h-5 text-slate-500" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className={`text-sm font-semibold ${isMet ? 'text-coral-700' : 'text-navy-900'}`}>{c.title}</h4>
                                  <span className="text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded">{c.category}</span>
                                  {isOracle && <span className="text-[10px] text-coral-600 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 flex items-center gap-0.5"><OracleIcon className="w-2.5 h-2.5" /> Oracle</span>}
                                  {isBiometric && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-0.5"><Fingerprint className="w-2.5 h-2.5" /> Biometric</span>}
                                  {c.payment_pct > 0 && <span className="text-[10px] text-coral-600 bg-coral-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{c.payment_pct}% Release</span>}
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed">{c.description}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  {c.deadline_days && <span className="text-[10px] text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" /> {c.deadline_days}d deadline</span>}
                                  {c.confidence && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{Math.round(c.confidence * 100)}% AI</span>}
                                  {c.oracle_result && <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.oracle_result.condition_met ? 'text-coral-600 bg-coral-500/10' : 'text-red-400 bg-red-500/10'}`}>{c.oracle_result.condition_met ? 'Oracle: Verified' : 'Oracle: Not Met'}</span>}
                                </div>
                                {isMet && <p className="text-coral-600 text-[10px] mt-1.5">Verified by {c.verified_by} at {new Date(c.verified_at).toLocaleString()}</p>}
                              </div>
                            </div>
                            {!isMet && e.status !== 'settled' && (
                              <div className="flex flex-col gap-1.5 flex-shrink-0">
                                {isOracle && !isBiometric && (
                                  <Button size="sm" onClick={() => handleOracleVerify(c.condition_id)} disabled={actionLoading === `oracle-${c.condition_id}`} className="bg-cyan-600 hover:bg-cyan-700 text-xs" data-testid={`oracle-btn-${c.condition_id}`}>
                                    {actionLoading === `oracle-${c.condition_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Globe className="w-3 h-3 mr-1" /> Check Oracle</>}
                                  </Button>
                                )}
                                {!isBiometric && (
                                  <Button size="sm" onClick={() => handleVerify(c.condition_id)} disabled={actionLoading === `verify-${c.condition_id}`} className="bg-blue-600 hover:bg-blue-700 text-xs" data-testid={`verify-btn-${c.condition_id}`}>
                                    {actionLoading === `verify-${c.condition_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Fingerprint className="w-3 h-3 mr-1" /> Verify</>}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {e.conditions.length === 0 && e.status !== 'draft' && (
              <Card className="bg-cream-100 border-slate-200"><CardContent className="p-8 text-center"><Brain className="w-10 h-10 text-slate-700 mx-auto mb-3" /><h3 className="text-navy-900 font-semibold mb-1">No Conditions Extracted</h3><p className="text-slate-500 text-xs">Use AI Orchestrator to extract performance triggers from the contract.</p></CardContent></Card>
            )}

            {/* ═══ TRUST GAP 3: SECURITY — Biometric Settlement ═══ */}
            {e.conditions_total > 0 && e.status !== 'draft' && (
              <Card className={`border ${biometricPassed ? 'bg-coral-500/5 border-coral-200' : 'bg-cream-100 border-slate-200'}`} data-testid="biometric-gate-section">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-purple-500/15 flex items-center justify-center"><Fingerprint className="w-3.5 h-3.5 text-purple-400" /></div>
                    <h3 className="text-navy-900 font-bold text-sm">Trust Gap 3: Security</h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">BIOMETRIC PROOF OF INTENT</span>
                  </div>
                  <p className="text-slate-500 text-xs mb-4">Funds are only released when the recipient's identity is verified via facial geometry and liveness detection at settlement.</p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`p-3 rounded-lg border ${buyerBio ? 'border-coral-200 bg-coral-500/5' : 'border-slate-200 bg-cream-100'}`} data-testid="buyer-biometric-status">
                      <div className="flex items-center gap-2 mb-1">
                        {buyerBio ? <CheckCircle className="w-4 h-4 text-coral-600" /> : <Scan className="w-4 h-4 text-slate-500" />}
                        <span className="text-xs font-semibold text-navy-900">Buyer</span>
                      </div>
                      <p className="text-[10px] text-slate-500">{buyerBio ? 'Identity Verified' : 'Pending verification'}</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${sellerBio ? 'border-coral-200 bg-coral-500/5' : 'border-slate-200 bg-cream-100'}`} data-testid="seller-biometric-status">
                      <div className="flex items-center gap-2 mb-1">
                        {sellerBio ? <CheckCircle className="w-4 h-4 text-coral-600" /> : <Scan className="w-4 h-4 text-slate-500" />}
                        <span className="text-xs font-semibold text-navy-900">Seller</span>
                      </div>
                      <p className="text-[10px] text-slate-500">{sellerBio ? 'Identity Verified' : 'Pending verification'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!biometricPassed && e.status !== 'settled' && (
                      <Button onClick={handleBiometricGate} disabled={actionLoading === 'biometric'} className="bg-purple-600 hover:bg-purple-700" data-testid="biometric-verify-btn">
                        {actionLoading === 'biometric' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                        Verify My Identity
                      </Button>
                    )}
                    {(e.status === 'conditions_met' || (e.status === 'active' && e.conditions_met_count === e.conditions_total && e.conditions_total > 0)) && e.status !== 'settled' && (
                      <Button onClick={handleSettle} disabled={actionLoading === 'settle'} className="italic text-coral-600 hover:from-amber-600 hover:to-orange-700" data-testid="settle-escrow-btn">
                        {actionLoading === 'settle' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                        Execute Settlement
                      </Button>
                    )}
                    {e.status === 'settled' && (
                      <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-coral-600" /><span className="text-coral-600 text-sm font-bold">Settlement Complete — Funds Released</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT — Sidebar */}
          <div className="space-y-4">
            {/* Parties */}
            <Card className="bg-cream-100 border-slate-200" data-testid="escrow-parties">
              <CardContent className="p-4">
                <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Parties</h3>
                <div className="space-y-2.5">
                  <PartyRow label="Buyer" name={e.parties.buyer.name || 'TBD'} email={e.parties.buyer.email} bio={buyerBio} />
                  <PartyRow label="Seller" name={e.parties.seller.name || 'TBD'} email={e.parties.seller.email} bio={sellerBio} />
                  <PartyRow label="Agent" name="NotaryChain AI Orchestrator" email="Automated" bio={true} />
                </div>
              </CardContent>
            </Card>

            {/* Smart Vault */}
            <Card className="bg-cream-100 border-slate-200" data-testid="escrow-financial">
              <CardContent className="p-4">
                <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-coral-600" /> Smart Vault</h3>
                <div className="space-y-2 text-xs">
                  <InfoRow label="Amount" value={`$${e.financial.escrow_amount.toLocaleString()} ${e.financial.currency}`} />
                  <InfoRow label="Vault Status" value={e.financial.deposit_status.toUpperCase()} />
                  {e.financial.stripe_payment_intent && <InfoRow label="Stripe PI" value={e.financial.stripe_payment_intent} mono />}
                  {e.financial.hts_token_id && <InfoRow label="HTS Token" value={e.financial.hts_token_id} mono />}
                </div>
              </CardContent>
            </Card>

            {/* Oracle Activity */}
            {(e.oracle_events?.length > 0) && (
              <Card className="bg-cream-100 border-slate-200" data-testid="escrow-oracle-events">
                <CardContent className="p-4">
                  <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-coral-600" /> Oracle Activity</h3>
                  <div className="space-y-2">
                    {e.oracle_events.slice(-5).reverse().map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${o.condition_met ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-slate-500 text-[10px] flex-1">{o.source}: {o.condition_met ? 'Verified' : 'Not met'}</span>
                        <span className="text-slate-600 text-[10px] font-mono">{o.confidence ? `${(o.confidence * 100).toFixed(0)}%` : ''}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Blockchain */}
            {(e.blockchain?.creation_hash || e.blockchain?.settlement_hash) && (
              <Card className="bg-cream-100 border-slate-200" data-testid="escrow-blockchain">
                <CardContent className="p-4">
                  <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2"><Blocks className="w-4 h-4 text-coral-600" /> Blockchain</h3>
                  <div className="space-y-2 text-xs">
                    {e.blockchain.creation_hash && <InfoRow label="Creation Hash" value={e.blockchain.creation_hash.slice(0, 20) + '...'} mono />}
                    {e.blockchain.settlement_hash && <InfoRow label="Settlement" value={e.blockchain.settlement_hash.slice(0, 20) + '...'} mono />}
                    {e.blockchain.settlement_tx?.explorer_url && (
                      <a href={e.blockchain.settlement_tx.explorer_url} target="_blank" rel="noopener noreferrer" className="text-coral-600 hover:text-coral-700 text-[10px] flex items-center gap-1 mt-1"><Globe className="w-3 h-3" /> View on HashScan</a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live WebSocket Events */}
            {liveEvents.length > 0 && (
              <Card className="bg-cream-100 border-coral-200" data-testid="escrow-live-events">
                <CardContent className="p-4">
                  <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-coral-600 animate-pulse" /> Live Events
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-coral-500/10 text-coral-600 border border-coral-200 font-bold">REAL-TIME</span>
                  </h3>
                  <div className="space-y-2">
                    {liveEvents.slice(0, 8).map((evt) => {
                      const icon = evt.event === 'escrow_oracle' ? Globe
                        : evt.event === 'escrow_biometric' ? Fingerprint
                        : evt.event === 'escrow_settlement' ? ShieldCheck
                        : evt.event === 'escrow_photo_verified' ? ImageIcon
                        : Zap;
                      const IconComponent = icon;
                      const isPositive = evt.data?.condition_met || evt.data?.verified || evt.event === 'escrow_settlement';
                      const label = evt.event === 'escrow_oracle' ? `Oracle: ${evt.data?.oracle_source || 'Unknown'}`
                        : evt.event === 'escrow_biometric' ? `Biometric: ${evt.data?.party_role || 'unknown'}`
                        : evt.event === 'escrow_settlement' ? 'Settlement executed'
                        : evt.event === 'escrow_photo_verified' ? `Photo: ${evt.data?.condition_title || 'Evidence'}`
                        : evt.event;
                      return (
                        <div key={evt.id} className="flex items-center gap-2">
                          <IconComponent className={`w-3 h-3 flex-shrink-0 ${isPositive ? 'text-coral-600' : 'text-red-400'}`} />
                          <span className="text-slate-500 text-[10px] flex-1 truncate">{label}</span>
                          <span className="text-slate-600 text-[10px]">{evt.time}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="bg-cream-100 border-slate-200" data-testid="escrow-timeline">
              <CardContent className="p-4">
                <h3 className="text-navy-900 font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Timeline</h3>
                <div className="space-y-3">
                  {(e.timeline || []).slice().reverse().slice(0, 10).map((t, i) => {
                    const cat = t.category || '';
                    const dotColor = cat === 'settlement' || t.event?.includes('settled') ? 'bg-emerald-400'
                      : cat === 'biometric' ? 'bg-purple-400'
                      : cat === 'oracle' ? 'bg-cyan-400'
                      : cat === 'ai' ? 'bg-purple-400'
                      : cat === 'financial' ? 'bg-amber-400'
                      : cat === 'verification' ? 'bg-blue-400'
                      : 'bg-gray-600';
                    return (
                      <div key={i} className="flex gap-2.5">
                        <div className="flex flex-col items-center"><div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />{i < 9 && <div className="w-px flex-1 bg-white mt-1" />}</div>
                        <div className="pb-3"><p className="text-navy-900 text-xs">{t.details}</p><p className="text-slate-600 text-[10px] mt-0.5">{t.actor} &#8212; {new Date(t.timestamp).toLocaleString()}</p></div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ───

function TrustGapCard({ icon: Icon, color, number, title, desc }) {
  return (
    <Card className="bg-cream-100 border-slate-200 hover:border-amber-500/20 transition-colors" data-testid={`trust-gap-${number}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 rounded-lg bg-${color}-500/10 flex items-center justify-center`}><Icon className={`w-4 h-4 text-${color}-400`} /></div>
          <span className={`text-[10px] font-bold text-${color}-400`}>GAP {number}</span>
        </div>
        <h4 className="text-navy-900 font-semibold text-sm mb-1">{title}</h4>
        <p className="text-slate-500 text-[11px] leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card className="bg-cream-100 border-slate-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
        <div><p className="text-slate-500 text-[10px]">{label}</p><p className="text-navy-900 font-bold text-sm">{value}</p></div>
      </CardContent>
    </Card>
  );
}

function PartyRow({ label, name, email, bio }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-blue-400" /></div>
      <div className="flex-1"><p className="text-navy-900 text-xs font-medium">{name}</p><p className="text-slate-600 text-[10px]">{label} &#8212; {email || 'N/A'}</p></div>
      {bio && <CheckCircle className="w-3.5 h-3.5 text-coral-600" />}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-navy-900 ${mono ? 'font-mono text-[10px]' : ''}`}>{String(value)}</span>
    </div>
  );
}
