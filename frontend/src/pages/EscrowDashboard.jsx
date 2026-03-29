import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Shield, Plus, FileText, DollarSign, CheckCircle, XCircle,
  Clock, Loader2, ArrowRight, ChevronRight, Blocks,
  ShieldCheck, AlertTriangle, Lock, Unlock, Eye,
  Fingerprint, Brain, Globe, Landmark, Home, Scale,
  Building2, User, Users, Sparkles, Radio,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ═══════════════════════════════════════════════════════
//  STATUS CONFIG
// ═══════════════════════════════════════════════════════
const STATUS_CONFIG = {
  draft:          { label: 'Draft',          color: 'gray',    icon: FileText },
  active:         { label: 'Active',         color: 'blue',    icon: Radio },
  conditions_met: { label: 'Conditions Met', color: 'emerald', icon: CheckCircle },
  settling:       { label: 'Settling',       color: 'yellow',  icon: Loader2 },
  settled:        { label: 'Settled',        color: 'emerald', icon: ShieldCheck },
  disputed:       { label: 'Disputed',       color: 'red',     icon: AlertTriangle },
};

const VERIFICATION_ICONS = {
  party_confirmation: Fingerprint,
  biometric_confirmation: Fingerprint,
  oracle: Globe,
};

const CATEGORY_ICONS = {
  inspection: Eye,
  financing: Landmark,
  title: Scale,
  appraisal: Building2,
  closing: Lock,
  walkthrough: Home,
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-${cfg.color}-500/15 text-${cfg.color}-400 border border-${cfg.color}-500/25`} data-testid={`status-${status}`}>
      <Icon className={`w-3 h-3 ${status === 'settling' ? 'animate-spin' : ''}`} /> {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════
export default function EscrowDashboard() {
  const { escrowId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [view, setView] = useState(escrowId ? 'detail' : 'list');
  const [escrows, setEscrows] = useState([]);
  const [currentEscrow, setCurrentEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

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
    if (escrowId) {
      fetchEscrow(escrowId);
      setView('detail');
    } else {
      fetchEscrows();
    }
  }, [token, escrowId]);

  const openEscrow = (id) => navigate(`/escrow/${id}`);

  // ─── CREATE ───
  const [createForm, setCreateForm] = useState({
    title: '', description: '', buyer_name: '', seller_name: '', seller_email: '',
    escrow_amount: '', document_name: '',
  });

  const handleCreate = async () => {
    if (!createForm.title || !createForm.escrow_amount) {
      toast({ title: 'Error', description: 'Title and escrow amount are required', variant: 'destructive' });
      return;
    }
    setActionLoading('create');
    try {
      const res = await axios.post(`${API}/escrow/create`, {
        ...createForm,
        escrow_amount: parseFloat(createForm.escrow_amount),
        escrow_type: 'real_estate',
      }, { headers });
      toast({ title: 'Escrow Created', description: `Agreement "${createForm.title}" created` });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', buyer_name: '', seller_name: '', seller_email: '', escrow_amount: '', document_name: '' });
      navigate(`/escrow/${res.data.escrow_id}`);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to create escrow', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── AI EXTRACTION ───
  const handleExtract = async () => {
    if (!currentEscrow) return;
    setActionLoading('extract');
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/extract-conditions`, {
        document_name: currentEscrow.document?.name || 'Real Estate Purchase Agreement',
      }, { headers });
      toast({ title: 'AI Extraction Complete', description: `${res.data.total} conditions extracted` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Extraction failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── DEPOSIT ───
  const handleDeposit = async () => {
    if (!currentEscrow) return;
    setActionLoading('deposit');
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/deposit`, {}, { headers });
      toast({ title: 'Funds Deposited', description: `$${res.data.amount.toLocaleString()} held in escrow` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Deposit failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── VERIFY CONDITION ───
  const handleVerify = async (conditionId) => {
    if (!currentEscrow) return;
    setActionLoading(`verify-${conditionId}`);
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/verify-condition`, {
        condition_id: conditionId,
      }, { headers });
      const msg = res.data.all_conditions_met
        ? 'All conditions met! Ready for settlement.'
        : `Condition verified (${res.data.met_count}/${res.data.total})`;
      toast({ title: 'Condition Verified', description: msg });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Verification failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ─── SETTLE ───
  const handleSettle = async () => {
    if (!currentEscrow) return;
    setActionLoading('settle');
    try {
      const res = await axios.post(`${API}/escrow/${currentEscrow.escrow_id}/settle`, {}, { headers });
      toast({ title: 'Escrow Settled!', description: `$${res.data.amount_released.toLocaleString()} released. Hash: ${res.data.settlement_hash.slice(0, 16)}...` });
      await fetchEscrow(currentEscrow.escrow_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Settlement failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ═══════════════════════════════════════════════════════
  //  RENDER — LIST VIEW
  // ═══════════════════════════════════════════════════════
  if (view === 'list' || (!escrowId && !showCreate)) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        {/* Header bar */}
        <div className="bg-[#0d1420] border-b border-[#1e293b] sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Escrow Intelligence</h1>
                <p className="text-gray-500 text-xs">Dynamic Escrow powered by AI + Blockchain</p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="create-escrow-btn">
              <Plus className="w-4 h-4 mr-2" /> New Escrow
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Escrow Intelligence' }]} />

          {/* Create Modal */}
          {showCreate && (
            <Card className="bg-[#111827] border-amber-500/30 mb-6" data-testid="create-escrow-form">
              <CardContent className="p-6">
                <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> New Escrow Agreement
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Agreement Title *</label>
                    <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 123 Main St Purchase" className="bg-[#0d1420] border-[#1e293b] text-white" data-testid="escrow-title-input" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Escrow Amount (USD) *</label>
                    <Input type="number" value={createForm.escrow_amount} onChange={e => setCreateForm(f => ({ ...f, escrow_amount: e.target.value }))} placeholder="350000" className="bg-[#0d1420] border-[#1e293b] text-white" data-testid="escrow-amount-input" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Buyer Name</label>
                    <Input value={createForm.buyer_name} onChange={e => setCreateForm(f => ({ ...f, buyer_name: e.target.value }))} placeholder="John Doe" className="bg-[#0d1420] border-[#1e293b] text-white" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Seller Name</label>
                    <Input value={createForm.seller_name} onChange={e => setCreateForm(f => ({ ...f, seller_name: e.target.value }))} placeholder="Jane Smith" className="bg-[#0d1420] border-[#1e293b] text-white" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Seller Email</label>
                    <Input value={createForm.seller_email} onChange={e => setCreateForm(f => ({ ...f, seller_email: e.target.value }))} placeholder="seller@email.com" className="bg-[#0d1420] border-[#1e293b] text-white" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Document Name</label>
                    <Input value={createForm.document_name} onChange={e => setCreateForm(f => ({ ...f, document_name: e.target.value }))} placeholder="Purchase Agreement" className="bg-[#0d1420] border-[#1e293b] text-white" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-xs block mb-1">Description</label>
                  <Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the escrow agreement" className="bg-[#0d1420] border-[#1e293b] text-white" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={actionLoading === 'create'} className="bg-amber-600 hover:bg-amber-700" data-testid="submit-escrow-btn">
                    {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create Agreement
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1e293b] text-gray-400">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Escrow List */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
          ) : escrows.length === 0 ? (
            <Card className="bg-[#111827] border-[#1e293b]">
              <CardContent className="p-12 text-center">
                <Scale className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">No Escrow Agreements Yet</h3>
                <p className="text-gray-500 text-sm mb-4">Create your first AI-powered escrow agreement to get started.</p>
                <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="w-4 h-4 mr-2" /> Create First Escrow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="escrow-list">
              {escrows.map((e) => (
                <Card key={e.escrow_id} className="bg-[#111827] border-[#1e293b] hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => openEscrow(e.escrow_id)} data-testid={`escrow-card-${e.escrow_id}`}>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Scale className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">{e.title}</h3>
                        <p className="text-gray-500 text-xs mt-0.5">{e.parties?.buyer?.name || 'Buyer'} → {e.parties?.seller?.name || 'Seller'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-bold text-sm">${e.financial?.escrow_amount?.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">{e.conditions_met_count || 0}/{e.conditions_total || 0} conditions</p>
                      </div>
                      <StatusBadge status={e.status} />
                      <ChevronRight className="w-4 h-4 text-gray-600" />
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
  if (!currentEscrow) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  const e = currentEscrow;
  const progress = e.conditions_total > 0 ? (e.conditions_met_count / e.conditions_total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Header */}
      <div className="bg-[#0d1420] border-b border-[#1e293b] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{e.title}</h1>
              <p className="text-gray-500 text-xs">{e.escrow_type === 'real_estate' ? 'Real Estate Escrow' : 'Escrow Agreement'} — {e.escrow_id.slice(0, 8)}</p>
            </div>
          </div>
          <StatusBadge status={e.status} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Escrow', path: '/escrow' }, { label: e.title }]} />

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Escrow Amount" value={`$${e.financial.escrow_amount.toLocaleString()}`} icon={DollarSign} color="amber" />
          <SummaryCard label="Deposit Status" value={e.financial.deposit_status.replace('_', ' ').toUpperCase()} icon={e.financial.deposit_status === 'held' ? Lock : Unlock} color={e.financial.deposit_status === 'held' ? 'emerald' : 'gray'} />
          <SummaryCard label="Conditions" value={`${e.conditions_met_count}/${e.conditions_total}`} icon={CheckCircle} color="blue" />
          <SummaryCard label="Progress" value={`${Math.round(progress)}%`} icon={Radio} color={progress === 100 ? 'emerald' : 'blue'} />
        </div>

        {/* Progress Bar */}
        {e.conditions_total > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Escrow Progress</span>
              <span>{e.conditions_met_count}/{e.conditions_total} conditions verified</span>
            </div>
            <div className="w-full h-2.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
                style={{ width: `${progress}%` }}
                data-testid="escrow-progress-bar"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — Conditions & Actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Action Buttons */}
            <Card className="bg-[#111827] border-[#1e293b]">
              <CardContent className="p-4 flex flex-wrap gap-2">
                {e.status === 'draft' && (
                  <Button onClick={handleExtract} disabled={actionLoading === 'extract'} className="bg-purple-600 hover:bg-purple-700" data-testid="extract-conditions-btn">
                    {actionLoading === 'extract' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                    AI Extract Conditions
                  </Button>
                )}
                {e.status === 'active' && e.financial.deposit_status === 'pending' && (
                  <Button onClick={handleDeposit} disabled={actionLoading === 'deposit'} className="bg-emerald-600 hover:bg-emerald-700" data-testid="deposit-funds-btn">
                    {actionLoading === 'deposit' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                    Deposit Funds
                  </Button>
                )}
                {(e.status === 'conditions_met' || (e.status === 'active' && e.conditions_met_count === e.conditions_total && e.conditions_total > 0)) && (
                  <Button onClick={handleSettle} disabled={actionLoading === 'settle'} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" data-testid="settle-escrow-btn">
                    {actionLoading === 'settle' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                    Execute Settlement
                  </Button>
                )}
                {e.status === 'settled' && (
                  <span className="text-emerald-400 text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" /> Settlement Complete
                  </span>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
            {e.conditions.length > 0 ? (
              <div className="space-y-3" data-testid="conditions-list">
                <h3 className="text-white font-bold flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> Extracted Conditions</h3>
                {e.conditions.map((c, i) => {
                  const CatIcon = CATEGORY_ICONS[c.category] || FileText;
                  const VerIcon = VERIFICATION_ICONS[c.verification_method] || ShieldCheck;
                  const isMet = c.status === 'met';
                  return (
                    <Card key={c.condition_id} className={`border transition-colors ${isMet ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#111827] border-[#1e293b]'}`} data-testid={`condition-${c.condition_id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMet ? 'bg-emerald-500/15' : 'bg-[#1e293b]'}`}>
                              {isMet ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <CatIcon className="w-5 h-5 text-gray-500" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`text-sm font-semibold ${isMet ? 'text-emerald-300' : 'text-white'}`}>{c.title}</h4>
                                <span className="text-[10px] text-gray-600 bg-[#1e293b] px-1.5 py-0.5 rounded">{c.category}</span>
                              </div>
                              <p className="text-gray-500 text-xs leading-relaxed">{c.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                  <VerIcon className="w-3 h-3" />
                                  {c.verification_method === 'oracle' ? 'Oracle Verified' : c.verification_method === 'biometric_confirmation' ? 'Biometric Required' : 'Party Confirmation'}
                                </span>
                                {c.deadline_days && <span className="text-[10px] text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" /> {c.deadline_days}d deadline</span>}
                                {c.confidence && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{Math.round(c.confidence * 100)}% AI conf</span>}
                              </div>
                              {isMet && <p className="text-emerald-400 text-[10px] mt-1.5">Verified by {c.verified_by} at {new Date(c.verified_at).toLocaleString()}</p>}
                            </div>
                          </div>
                          {!isMet && e.status !== 'settled' && (
                            <Button
                              size="sm"
                              onClick={() => handleVerify(c.condition_id)}
                              disabled={actionLoading === `verify-${c.condition_id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-xs flex-shrink-0"
                              data-testid={`verify-btn-${c.condition_id}`}
                            >
                              {actionLoading === `verify-${c.condition_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Fingerprint className="w-3 h-3 mr-1" /> Verify</>}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-[#111827] border-[#1e293b]">
                <CardContent className="p-8 text-center">
                  <Brain className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-white font-semibold mb-1">No Conditions Extracted</h3>
                  <p className="text-gray-500 text-xs">Click "AI Extract Conditions" to analyze the document and create executable escrow triggers.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT — Sidebar: Parties, Financial, Blockchain, Timeline */}
          <div className="space-y-4">
            {/* Parties */}
            <Card className="bg-[#111827] border-[#1e293b]" data-testid="escrow-parties">
              <CardContent className="p-4">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Parties</h3>
                <div className="space-y-2.5">
                  <PartyRow label="Buyer" name={e.parties.buyer.name || 'TBD'} email={e.parties.buyer.email} icon={User} color="blue" />
                  <PartyRow label="Seller" name={e.parties.seller.name || 'TBD'} email={e.parties.seller.email} icon={User} color="orange" />
                  <PartyRow label="Agent" name="NotaryChain AI" email="Automated" icon={Brain} color="purple" />
                </div>
              </CardContent>
            </Card>

            {/* Financial */}
            <Card className="bg-[#111827] border-[#1e293b]" data-testid="escrow-financial">
              <CardContent className="p-4">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> Financial</h3>
                <div className="space-y-2 text-xs">
                  <InfoRow label="Amount" value={`$${e.financial.escrow_amount.toLocaleString()} ${e.financial.currency}`} />
                  <InfoRow label="Deposit" value={e.financial.deposit_status.toUpperCase()} />
                  {e.financial.stripe_payment_intent && <InfoRow label="Stripe PI" value={e.financial.stripe_payment_intent} mono />}
                  {e.financial.hts_token_id && <InfoRow label="HTS Token" value={e.financial.hts_token_id} mono />}
                  {e.financial.hts_escrow_account && <InfoRow label="Escrow Acct" value={e.financial.hts_escrow_account} mono />}
                </div>
              </CardContent>
            </Card>

            {/* Blockchain */}
            {(e.blockchain.creation_hash || e.blockchain.settlement_hash) && (
              <Card className="bg-[#111827] border-[#1e293b]" data-testid="escrow-blockchain">
                <CardContent className="p-4">
                  <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Blocks className="w-4 h-4 text-orange-400" /> Blockchain</h3>
                  <div className="space-y-2 text-xs">
                    {e.blockchain.creation_hash && <InfoRow label="Creation Hash" value={e.blockchain.creation_hash.slice(0, 20) + '...'} mono />}
                    {e.blockchain.settlement_hash && <InfoRow label="Settlement Hash" value={e.blockchain.settlement_hash.slice(0, 20) + '...'} mono />}
                    {e.blockchain.settlement_tx && (
                      <>
                        <InfoRow label="Network" value={e.blockchain.settlement_tx.network} />
                        <InfoRow label="Topic" value={e.blockchain.settlement_tx.topic_id} mono />
                        <InfoRow label="Sequence" value={e.blockchain.settlement_tx.sequence_number} />
                        {e.blockchain.settlement_tx.explorer_url && (
                          <a href={e.blockchain.settlement_tx.explorer_url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 text-[10px] flex items-center gap-1 mt-1">
                            <Globe className="w-3 h-3" /> View on HashScan
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="bg-[#111827] border-[#1e293b]" data-testid="escrow-timeline">
              <CardContent className="p-4">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Timeline</h3>
                <div className="space-y-3">
                  {(e.timeline || []).slice().reverse().map((t, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.event.includes('settled') ? 'bg-emerald-400' : t.event.includes('condition') ? 'bg-blue-400' : t.event.includes('deposit') ? 'bg-amber-400' : 'bg-gray-600'}`} />
                        {i < e.timeline.length - 1 && <div className="w-px flex-1 bg-[#1e293b] mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-white text-xs">{t.details}</p>
                        <p className="text-gray-600 text-[10px] mt-0.5">{t.actor} — {new Date(t.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
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

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="bg-[#111827] border-[#1e293b]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <div>
          <p className="text-gray-500 text-[10px]">{label}</p>
          <p className="text-white font-bold text-sm">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PartyRow({ label, name, email, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-md bg-${color}-500/10 flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 text-${color}-400`} />
      </div>
      <div>
        <p className="text-white text-xs font-medium">{name}</p>
        <p className="text-gray-600 text-[10px]">{label} — {email || 'N/A'}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`text-white ${mono ? 'font-mono text-[10px]' : ''}`}>{String(value)}</span>
    </div>
  );
}
