import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Vault, Plus, Calendar, Users, AlertTriangle, CheckCircle, Clock, Shield, Trash2, Edit3,
  ExternalLink, RefreshCw, Loader2, X, FileText, Home, Award, Briefcase, Heart, Key, Banknote,
  ChevronRight, ShieldAlert, Send,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const ASSET_ICONS = {
  deed: Home,
  title: Key,
  ip: Award,
  will: FileText,
  custody: Shield,
  financial: Banknote,
  license: Briefcase,
  contract: FileText,
  other: Vault,
};

const ASSET_LABELS = {
  deed: 'Deed', title: 'Title', ip: 'IP / Patent', will: 'Will / Trust',
  custody: 'Custody Agreement', financial: 'Financial Asset', license: 'License',
  contract: 'Contract', other: 'Other',
};

export default function AssetVault() {
  const { token, isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [activeAssetId, setActiveAssetId] = useState(null);

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json',
  }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/salv/vault`, { headers: authHeaders() });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [token, authHeaders]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="vault-login-required">
        <Card className="bg-slate-900/60 border-slate-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Vault className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Sign in required</h2>
            <p className="text-sm text-slate-400 mb-4">Your asset vault is private.</p>
            <Link to="/login"><Button className="bg-emerald-600 hover:bg-emerald-500">Sign in</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="vault-loading">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8" data-testid="vault-error">
        <Card className="bg-red-500/5 border-red-500/30 max-w-md mx-auto">
          <CardContent className="p-6 text-center text-red-400">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const { vault, dead_mans_switch: dms, stats, assets, beneficiaries } = data;

  const checkIn = async () => {
    const r = await fetch(`${API}/api/salv/vault/check-in`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { toast.success('Check-in recorded'); load(); }
    else toast.error('Check-in failed');
  };

  const verifyAsset = async (assetId) => {
    const r = await fetch(`${API}/api/salv/assets/${assetId}/verify`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { toast.success('Re-verified'); load(); }
    else toast.error('Verify failed');
  };

  const deleteAsset = async (assetId) => {
    if (!window.confirm('Permanently remove this asset and its beneficiaries?')) return;
    const r = await fetch(`${API}/api/salv/assets/${assetId}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { toast.success('Asset deleted'); setActiveAssetId(null); load(); }
    else toast.error('Delete failed');
  };

  const triggerHandoff = async (assetId) => {
    if (!window.confirm('Trigger beneficiary handoff now? They will be notified immediately.')) return;
    const r = await fetch(`${API}/api/salv/assets/${assetId}/trigger-handoff`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { const d = await r.json(); toast.success(`Handoff started · ${d.beneficiaries_notified} beneficiaries notified`); load(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.detail || 'Handoff failed'); }
  };

  const dmsColor = dms.status === 'ok' ? 'emerald' : dms.status === 'warning' ? 'amber' : 'red';
  const activeAsset = assets.find(a => a.asset_id === activeAssetId);

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="asset-vault-page">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-emerald-950/30 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Vault className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 text-[10px] uppercase tracking-[0.25em] font-bold">Smart Asset Vault</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold" data-testid="vault-name">{vault.name}</h1>
              <p className="text-slate-400 text-sm mt-1">A digital safe-deposit box for your highest-value assets.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingSettings(true)} className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800" data-testid="open-settings-btn">
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Settings
              </Button>
              <Button onClick={() => setShowAddAsset(true)} className="bg-emerald-600 hover:bg-emerald-500" data-testid="add-asset-btn">
                <Plus className="w-4 h-4 mr-1" /> Add asset
              </Button>
            </div>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <StatCard label="Assets" value={stats.assets_count} testId="stat-assets" />
            <StatCard label="Beneficiaries" value={stats.beneficiaries_count} testId="stat-beneficiaries" />
            <StatCard label="Due soon" value={stats.due_soon_count} accent={stats.due_soon_count > 0 ? 'amber' : null} testId="stat-due-soon" />
            <StatCard label="Estimated value" value={`$${(stats.total_estimated_value_usd || 0).toLocaleString()}`} testId="stat-value" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Dead-man's-switch + Asset list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dead-man's-switch */}
          <Card className={`bg-${dmsColor}-500/5 border-${dmsColor}-500/30`} data-testid="dms-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {dms.status === 'ok' ? <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" /> :
                   dms.status === 'warning' ? <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" /> :
                   <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />}
                  <div>
                    <h3 className={`font-bold mb-0.5 ${dms.status === 'ok' ? 'text-emerald-300' : dms.status === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>
                      Dead-man's-switch · {dms.status.toUpperCase()}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Last check-in {fmtDate(dms.last_check_in)} · {dms.days_remaining > 0 ? `${dms.days_remaining} days remaining` : 'TRIGGERED — beneficiaries can claim'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">If you don't check in within {dms.interval_days} days, beneficiaries are auto-notified.</p>
                  </div>
                </div>
                <Button onClick={checkIn} size="sm" className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0" data-testid="check-in-btn">
                  <RefreshCw className="w-3 h-3 mr-1" /> Check in
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Asset list */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Assets ({assets.length})</h2>
              </div>
              {assets.length === 0 ? (
                <div className="text-center py-10" data-testid="assets-empty">
                  <Vault className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 mb-4">No assets yet — add your first deed, will, or title.</p>
                  <Button onClick={() => setShowAddAsset(true)} className="bg-emerald-600 hover:bg-emerald-500"><Plus className="w-4 h-4 mr-1" /> Add asset</Button>
                </div>
              ) : (
                <div className="space-y-2" data-testid="assets-list">
                  {assets.map(a => {
                    const Icon = ASSET_ICONS[a.asset_type] || Vault;
                    const dueDays = daysUntil(a.next_verification_at);
                    const isOverdue = dueDays !== null && dueDays <= 0;
                    const isDueSoon = dueDays !== null && dueDays > 0 && dueDays <= 30;
                    const benefCount = beneficiaries.filter(b => b.asset_id === a.asset_id).length;
                    return (
                      <button
                        key={a.asset_id}
                        onClick={() => setActiveAssetId(a.asset_id)}
                        className={`w-full text-left rounded-lg border p-4 transition-colors ${activeAssetId === a.asset_id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
                        data-testid={`asset-row-${a.asset_id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-500/15' : isDueSoon ? 'bg-amber-500/15' : 'bg-slate-700/40'}`}>
                            <Icon className={`w-5 h-5 ${isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-emerald-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-white truncate">{a.title}</h3>
                              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">{ASSET_LABELS[a.asset_type] || a.asset_type}</span>
                              {a.status !== 'active' && (
                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{a.status.replace(/_/g, ' ')}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                              {a.value_estimate_usd && <span className="text-white">${a.value_estimate_usd.toLocaleString()}</span>}
                              <span className={isOverdue ? 'text-red-400 font-bold' : isDueSoon ? 'text-amber-400 font-bold' : ''}>
                                <Clock className="w-3 h-3 inline mr-0.5" />
                                {isOverdue ? `Overdue ${Math.abs(dueDays)}d` : dueDays !== null ? `Due in ${dueDays}d` : '—'}
                              </span>
                              <span><Users className="w-3 h-3 inline mr-0.5" />{benefCount}</span>
                              {a.blockchain_seal && <span className="text-amber-400">⛓ sealed</span>}
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform ${activeAssetId === a.asset_id ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Active asset detail */}
        <div>
          {activeAsset ? (
            <AssetDetailPanel
              asset={activeAsset}
              beneficiaries={beneficiaries.filter(b => b.asset_id === activeAsset.asset_id)}
              onVerify={() => verifyAsset(activeAsset.asset_id)}
              onDelete={() => deleteAsset(activeAsset.asset_id)}
              onTriggerHandoff={() => triggerHandoff(activeAsset.asset_id)}
              onAddBeneficiary={() => load()}
              authHeaders={authHeaders}
              onClose={() => setActiveAssetId(null)}
            />
          ) : (
            <Card className="bg-slate-900/40 border-slate-800 sticky top-4">
              <CardContent className="p-6 text-center">
                <Shield className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Select an asset to view beneficiaries, re-verify, or trigger handoff.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddAsset && (
        <AddAssetModal
          authHeaders={authHeaders}
          onClose={() => setShowAddAsset(false)}
          onCreated={() => { setShowAddAsset(false); load(); }}
        />
      )}
      {editingSettings && (
        <SettingsModal
          vault={vault}
          authHeaders={authHeaders}
          onClose={() => setEditingSettings(false)}
          onSaved={() => { setEditingSettings(false); load(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent, testId }) {
  const accentClass = accent === 'amber' ? 'text-amber-400' : 'text-white';
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-800 px-4 py-3" data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</p>
    </div>
  );
}

function AssetDetailPanel({ asset, beneficiaries, onVerify, onDelete, onTriggerHandoff, onAddBeneficiary, authHeaders, onClose }) {
  const [showAddBenef, setShowAddBenef] = useState(false);
  const totalShare = beneficiaries.reduce((s, b) => s + (b.share_percent || 0), 0);

  const removeBenef = async (id) => {
    if (!window.confirm('Remove this beneficiary?')) return;
    const r = await fetch(`${API}/api/salv/beneficiaries/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { toast.success('Beneficiary removed'); onAddBeneficiary(); }
    else toast.error('Remove failed');
  };

  return (
    <div className="space-y-3 sticky top-4" data-testid={`asset-detail-${asset.asset_id}`}>
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{ASSET_LABELS[asset.asset_type]}</p>
              <h3 className="text-lg font-bold text-white truncate">{asset.title}</h3>
              {asset.description && <p className="text-xs text-slate-400 mt-1">{asset.description}</p>}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close" data-testid="close-asset-detail">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {asset.value_estimate_usd && <Row label="Value" value={`$${asset.value_estimate_usd.toLocaleString()}`} />}
            {asset.jurisdiction && <Row label="Jurisdiction" value={asset.jurisdiction} />}
            <Row label="Last verified" value={fmtDate(asset.last_verified_at)} />
            <Row label="Next due" value={fmtDate(asset.next_verification_at)} />
            <Row label="Interval" value={`${asset.verification_interval_days} days`} />
            {asset.document_hash && <Row label="Hash" value={asset.document_hash.slice(0, 16) + '…'} mono />}
            {asset.blockchain_seal?.transaction_id && (
              <Row label="Hedera tx" value={(
                <a href={asset.blockchain_seal.explorer_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline inline-flex items-center gap-1">
                  {asset.blockchain_seal.transaction_id.slice(0, 16)}… <ExternalLink className="w-3 h-3" />
                </a>
              )} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button onClick={onVerify} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-xs h-9" data-testid="reverify-btn">
              <RefreshCw className="w-3 h-3 mr-1" /> Re-verify
            </Button>
            <Button onClick={onTriggerHandoff} size="sm" variant="outline"
              className="bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs h-9"
              data-testid="trigger-handoff-btn">
              <Send className="w-3 h-3 mr-1" /> Handoff
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Beneficiaries · {totalShare.toFixed(0)}%</h3>
            <button onClick={() => setShowAddBenef(true)} className="text-emerald-400 text-xs hover:text-emerald-300 inline-flex items-center gap-1" data-testid="add-beneficiary-btn">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {beneficiaries.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No beneficiaries set.</p>
          ) : (
            <div className="space-y-2">
              {beneficiaries.map(b => (
                <div key={b.beneficiary_id} className="flex items-center gap-2 bg-slate-800/40 rounded p-2.5 text-xs" data-testid={`beneficiary-${b.beneficiary_id}`}>
                  <Heart className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate font-medium">{b.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{b.email} {b.relationship ? `· ${b.relationship}` : ''}</p>
                  </div>
                  <span className="text-emerald-400 font-bold">{b.share_percent.toFixed(0)}%</span>
                  <button onClick={() => removeBenef(b.beneficiary_id)} className="text-slate-500 hover:text-red-400" data-testid={`remove-beneficiary-${b.beneficiary_id}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddBenef && (
            <AddBeneficiaryForm
              assetId={asset.asset_id}
              maxShare={100 - totalShare}
              authHeaders={authHeaders}
              onClose={() => setShowAddBenef(false)}
              onAdded={() => { setShowAddBenef(false); onAddBeneficiary(); }}
            />
          )}
        </CardContent>
      </Card>

      <button onClick={onDelete} className="text-[11px] text-red-400 hover:text-red-300 inline-flex items-center gap-1 px-2" data-testid="delete-asset-btn">
        <Trash2 className="w-3 h-3" /> Delete asset
      </button>
    </div>
  );
}

function AddAssetModal({ authHeaders, onClose, onCreated }) {
  const [form, setForm] = useState({
    asset_type: 'deed', title: '', description: '', value_estimate_usd: '',
    jurisdiction: '', document_hash: '', verification_interval_days: 365,
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    const payload = { ...form };
    if (payload.value_estimate_usd) payload.value_estimate_usd = parseFloat(payload.value_estimate_usd);
    else delete payload.value_estimate_usd;
    if (!payload.document_hash) delete payload.document_hash;
    if (!payload.jurisdiction) delete payload.jurisdiction;
    if (!payload.description) delete payload.description;
    payload.verification_interval_days = parseInt(payload.verification_interval_days, 10);
    const r = await fetch(`${API}/api/salv/assets`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (r.ok) { toast.success('Asset added'); onCreated(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.detail || 'Create failed'); }
    setSubmitting(false);
  };

  return (
    <Modal title="Add asset" onClose={onClose} testId="add-asset-modal">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={form.asset_type} onChange={(e) => setForm(f => ({ ...f, asset_type: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 h-10 text-sm text-white w-full" data-testid="asset-type-select">
              {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Re-verify every (days)">
            <Input type="number" min={30} max={3650} value={form.verification_interval_days}
              onChange={(e) => setForm(f => ({ ...f, verification_interval_days: e.target.value }))}
              className="bg-slate-900 border-slate-700" data-testid="asset-interval-input" />
          </Field>
        </div>
        <Field label="Title *">
          <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="123 Main St Deed" className="bg-slate-900 border-slate-700" data-testid="asset-title-input" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional notes…" className="bg-slate-900 border-slate-700" data-testid="asset-description-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated value (USD)">
            <Input type="number" min={0} step="0.01" value={form.value_estimate_usd}
              onChange={(e) => setForm(f => ({ ...f, value_estimate_usd: e.target.value }))}
              placeholder="750000" className="bg-slate-900 border-slate-700" data-testid="asset-value-input" />
          </Field>
          <Field label="Jurisdiction">
            <Input value={form.jurisdiction} onChange={(e) => setForm(f => ({ ...f, jurisdiction: e.target.value }))}
              placeholder="CA, USA" className="bg-slate-900 border-slate-700" data-testid="asset-jurisdiction-input" />
          </Field>
        </div>
        <Field label="Document SHA256 hash (optional — auto-links to NotaryChain seal)">
          <Input value={form.document_hash} onChange={(e) => setForm(f => ({ ...f, document_hash: e.target.value }))}
            placeholder="64-char hex" className="bg-slate-900 border-slate-700 font-mono text-xs" data-testid="asset-hash-input" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">Cancel</Button>
          <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500" data-testid="submit-add-asset">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add asset'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddBeneficiaryForm({ assetId, maxShare, authHeaders, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', relationship: '', share_percent: Math.min(100, maxShare) });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name & email required'); return; }
    setSubmitting(true);
    const payload = { ...form, share_percent: parseFloat(form.share_percent) };
    if (!payload.relationship) delete payload.relationship;
    const r = await fetch(`${API}/api/salv/assets/${assetId}/beneficiaries`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (r.ok) { toast.success('Beneficiary added'); onAdded(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.detail || 'Add failed'); }
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} className="mt-3 pt-3 border-t border-slate-800 space-y-2" data-testid="add-beneficiary-form">
      <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Beneficiary name" className="bg-slate-900 border-slate-700 text-xs h-8" data-testid="beneficiary-name-input" />
      <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
        placeholder="email@example.com" className="bg-slate-900 border-slate-700 text-xs h-8" data-testid="beneficiary-email-input" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.relationship} onChange={(e) => setForm(f => ({ ...f, relationship: e.target.value }))}
          placeholder="Relationship" className="bg-slate-900 border-slate-700 text-xs h-8" data-testid="beneficiary-relationship-input" />
        <Input type="number" min={0} max={maxShare} step="0.01" value={form.share_percent}
          onChange={(e) => setForm(f => ({ ...f, share_percent: e.target.value }))}
          placeholder="Share %" className="bg-slate-900 border-slate-700 text-xs h-8" data-testid="beneficiary-share-input" />
      </div>
      <p className="text-[10px] text-slate-500">Max share available: {maxShare.toFixed(0)}%</p>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onClose} className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800 text-xs h-8">Cancel</Button>
        <Button type="submit" size="sm" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-xs h-8" data-testid="submit-beneficiary-btn">
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
        </Button>
      </div>
    </form>
  );
}

function SettingsModal({ vault, authHeaders, onClose, onSaved }) {
  const [name, setName] = useState(vault.name);
  const [days, setDays] = useState(vault.settings?.dead_mans_switch_days || 180);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch(`${API}/api/salv/vault`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ name, dead_mans_switch_days: parseInt(days, 10) }),
    });
    if (r.ok) { toast.success('Settings saved'); onSaved(); }
    else toast.error('Save failed');
    setSaving(false);
  };

  return (
    <Modal title="Vault settings" onClose={onClose} testId="settings-modal">
      <form onSubmit={save} className="space-y-3">
        <Field label="Vault name">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-900 border-slate-700" data-testid="settings-name-input" />
        </Field>
        <Field label="Dead-man's-switch interval (days)">
          <Input type="number" min={30} max={3650} value={days} onChange={(e) => setDays(e.target.value)}
            className="bg-slate-900 border-slate-700" data-testid="settings-days-input" />
          <p className="text-[10px] text-slate-500 mt-1">If you don't check in within this many days, beneficiaries are auto-notified.</p>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">Cancel</Button>
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500" data-testid="settings-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose, testId }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} data-testid={testId}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close" data-testid="modal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-slate-200 text-right truncate min-w-0 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

function daysUntil(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}
