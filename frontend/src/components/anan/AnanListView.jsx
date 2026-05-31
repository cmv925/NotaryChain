/**
 * AnanListView — the ANAN dashboard "list" screen (stats, bond, reputation,
 * escalation queue, create form, ceremony list). Presentational; all data and
 * handlers are injected by ANANDashboard. Extracted to shrink that file.
 */
import React from 'react';
import {
  Shield, Brain, Blocks, ChevronRight, AlertTriangle, ShieldCheck,
  Loader2, XCircle, CheckCircle, TrendingUp, Zap, Vote, Award, Target,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Breadcrumbs } from '../Breadcrumbs';
import { StatusBadge, StatCard } from './AnanPrimitives';

export default function AnanListView({
  stats, bond, reputation, escalations, ceremonies, loading, actionLoading,
  showCreate, form, setShowCreate, setForm, handleCreate, handleTuneWeights,
  handleResolve, handleVerifyBond, navigate,
}) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="bg-cream-100 border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-coral-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-navy-900" />
            </div>
            <div>
              <h1 className="text-navy-900 font-bold text-lg tracking-tight">ANAN — Agent Network</h1>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">Autonomous Notary Agent Network</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-coral-600 text-navy-900" data-testid="anan-create-btn">
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
          <Card className="bg-cream-100 border-slate-200 mb-6" data-testid="anan-bond-status">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-coral-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-coral-600" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-[10px] uppercase tracking-wider">SAN E&O Insurance Bond</p>
                    <p className="text-navy-900 font-bold">${bond.balance?.toLocaleString()} <span className="text-slate-500 text-xs font-normal">/ $1,000,000</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-2 bg-white rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${bond.health === 'healthy' ? 'bg-coral-500' : bond.health === 'warning' ? 'bg-coral-500' : 'bg-red-500'}`} style={{ width: `${bond.health_pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${bond.health === 'healthy' ? 'text-coral-600' : bond.health === 'warning' ? 'text-coral-600' : 'text-red-400'}`}>{bond.health_pct}%</span>
                </div>
              </div>
              {bond.on_chain && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Blocks className="w-3.5 h-3.5 text-coral-600" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">On-Chain Ledger</span>
                    {bond.on_chain.enabled ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-coral-500/10 text-coral-600 border border-coral-200 font-bold" data-testid="bond-chain-active">ACTIVE</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 border border-slate-500/20 font-bold">SDK PENDING</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {bond.on_chain.bond_topic_id && (
                      <span className="text-[10px] text-slate-500 font-mono" data-testid="bond-topic-id">Topic: {bond.on_chain.bond_topic_id}</span>
                    )}
                    {bond.on_chain.network && (
                      <span className="text-[10px] text-coral-600 font-bold uppercase">{bond.on_chain.network}</span>
                    )}
                    <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 text-[10px] h-6"
                      onClick={handleVerifyBond} data-testid="bond-verify-btn">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verify On-Chain
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agent Reputation & Fraud Intel Links */}
        {reputation && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card className="bg-cream-100 border-slate-200" data-testid="anan-reputation">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-coral-600" />
                    <h3 className="text-navy-900 font-bold text-sm">Agent Reputation</h3>
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
                        <span className="text-slate-600 w-14 capitalize">{agent}</span>
                        <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${rep.all_time.accuracy}%` }} />
                        </div>
                        <span className="text-navy-900 font-mono w-10 text-right">{rep.all_time.accuracy}%</span>
                        <span className="text-slate-600 text-[10px] w-16">wt: {(weight * 100).toFixed(0)}%</span>
                        <span className="text-slate-600 text-[10px]">({rep.all_time.total} samples)</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-cream-100 border-slate-200 cursor-pointer hover:border-red-500/30 transition-colors"
              onClick={() => navigate('/fraud-intelligence')} data-testid="anan-fraud-link">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-navy-900 font-bold text-sm">Fraud Intelligence</h3>
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
          <Card className="bg-cream-100 border-coral-300/30 mb-6" data-testid="anan-create-form">
            <CardContent className="p-6">
              <h2 className="text-navy-900 font-bold text-lg mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-coral-600" /> New ANAN Ceremony
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-600 text-xs block mb-1">Document Name *</label>
                  <Input value={form.document_name} onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))} placeholder="e.g. Affidavit of Identity" className="bg-white border-slate-200 text-navy-900" data-testid="anan-doc-name" />
                </div>
                <div>
                  <label className="text-slate-600 text-xs block mb-1">Signer Name *</label>
                  <Input value={form.signer_name} onChange={e => setForm(f => ({ ...f, signer_name: e.target.value }))} placeholder="e.g. John Smith" className="bg-white border-slate-200 text-navy-900" data-testid="anan-signer-name" />
                </div>
                <div>
                  <label className="text-slate-600 text-xs block mb-1">Document Type</label>
                  <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 text-navy-900 rounded-md text-sm" data-testid="anan-doc-type">
                    <option value="affidavit">Affidavit</option>
                    <option value="power_of_attorney">Power of Attorney</option>
                    <option value="deed">Deed</option>
                    <option value="contract">Contract</option>
                    <option value="will">Will / Testament</option>
                    <option value="general">General Document</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 text-xs block mb-1">Jurisdiction</label>
                  <select value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 text-navy-900 rounded-md text-sm" data-testid="anan-jurisdiction">
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
                <Button onClick={handleCreate} disabled={actionLoading === 'create'} className="bg-coral-500 hover:bg-coral-600" data-testid="anan-submit-btn">
                  {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Initialize ANAN Protocol
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-200 text-slate-600">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Escalation Queue */}
        {escalations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-coral-600 font-bold text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> HITL Escalation Queue ({escalations.length})
            </h3>
            <div className="space-y-2" data-testid="anan-escalation-queue">
              {escalations.map((esc) => (
                <Card key={esc.escalation_id} className="bg-cream-100 border-amber-500/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-navy-900 text-sm font-medium">{esc.ceremony_context?.document_name || 'Unknown'}</p>
                      <p className="text-slate-500 text-[10px]">Signer: {esc.ceremony_context?.signer_name} | Score: {esc.weighted_average?.toFixed(1)}</p>
                      <p className="text-coral-600/70 text-[10px] mt-0.5">{esc.reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResolve(esc.escalation_id, 'approve')}
                        disabled={actionLoading === `resolve-${esc.escalation_id}`}
                        className="bg-coral-500 hover:bg-emerald-700 text-xs" data-testid={`anan-approve-${esc.escalation_id}`}>
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
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-coral-600 animate-spin" /></div>
        ) : ceremonies.length === 0 ? (
          <Card className="bg-cream-100 border-slate-200">
            <CardContent className="p-12 text-center">
              <Brain className="w-14 h-14 text-slate-700 mx-auto mb-4" />
              <h3 className="text-navy-900 font-bold text-lg mb-2">No ANAN Ceremonies Yet</h3>
              <p className="text-slate-500 text-sm mb-4">Launch your first autonomous notarization with the ANAN swarm.</p>
              <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-coral-600">
                <Zap className="w-4 h-4 mr-2" /> Create First ANAN Ceremony
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="anan-ceremony-list">
            {ceremonies.map((c) => (
              <Card key={c.ceremony_id} className="bg-cream-100 border-slate-200 hover:border-coral-300/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/anan/${c.ceremony_id}`)} data-testid={`anan-card-${c.ceremony_id}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-coral-500/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-coral-600" />
                    </div>
                    <div>
                      <h3 className="text-navy-900 font-semibold text-sm">{c.document_name}</h3>
                      <p className="text-slate-500 text-[10px]">{c.signer_name} | {c.protocol}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {c.consensus?.weighted_average != null && (
                      <span className="text-navy-900 font-mono font-bold text-sm">{c.consensus.weighted_average.toFixed(1)}</span>
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
