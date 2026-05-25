import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Cpu, Copy, RefreshCw, Undo2, ExternalLink, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/escrow`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
});

/** State-machine display order */
const STATES = ['DRAFT', 'FUNDED', 'CONDITIONS_MET', 'RELEASED'];

const STATE_TONE = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  FUNDED: 'bg-blue-100 text-blue-700 border-blue-300',
  CONDITIONS_MET: 'bg-amber-100 text-amber-700 border-amber-300',
  RELEASED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  REFUNDED: 'bg-red-100 text-red-700 border-red-300',
};

const OPCODE_TONE = {
  CONSTRUCTOR: 'bg-slate-100 text-slate-700',
  FUND: 'bg-blue-100 text-blue-700',
  RELEASE: 'bg-emerald-100 text-emerald-700',
  REFUND: 'bg-red-100 text-red-700',
};

/**
 * Mock Hedera HSCS-style smart contract inspector.
 * Shows the synthetic contract address, current state, balance, ABI and op log.
 * Provides a one-click REFUND action when the escrow is funded but not yet released.
 */
export default function SmartContractPanel({ escrowId, onAfterAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/${escrowId}/contract-state`, { headers: authHeaders() });
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load smart contract');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (escrowId) load(); /* refetch on id change */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrowId]);

  const handleRefund = async () => {
    if (!window.confirm('Refund the held escrow amount back to the buyer? This cannot be undone.')) return;
    setRefunding(true);
    try {
      const res = await axios.post(`${API}/${escrowId}/refund`,
        { reason: 'Refund triggered from Smart Contract Inspector' },
        { headers: authHeaders() });
      toast.success(`Refunded $${(res.data.amount_refunded || 0).toLocaleString()} — tx ${res.data.tx_hash?.slice(0, 14)}…`);
      await load();
      if (onAfterAction) onAfterAction();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const handleDeployReal = async () => {
    setDeploying(true);
    try {
      const res = await axios.post(`${API}/${escrowId}/contract/deploy-real`, {}, { headers: authHeaders() });
      const dep = res.data.deployment || {};
      toast.success(`Hedera deployment ${dep.mode === 'real' ? 'submitted' : 'shadowed (mode=mock)'} · ${dep.contract_id}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied');
  };

  if (loading && !data) {
    return (
      <Card className="bg-navy-900 border-slate-700">
        <CardContent className="p-4 flex items-center gap-3 text-slate-300">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading smart contract…
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const currentState = data.state || 'DRAFT';
  const isTerminal = currentState === 'RELEASED' || currentState === 'REFUNDED';
  const canRefund = currentState === 'FUNDED' || currentState === 'CONDITIONS_MET';

  return (
    <Card className="bg-navy-900 border-slate-700" data-testid="smart-contract-panel">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white font-bold text-sm tracking-wide">SMART CONTRACT</h3>
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                data.mode === 'real'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {data.mode === 'real' ? 'Hedera HSCS · live' : 'Mock · Hedera HSCS-style'}
              </span>
            </div>
            <button
              onClick={() => copy(data.contract_address)}
              className="text-cyan-200/80 hover:text-cyan-100 text-xs font-mono flex items-center gap-1 transition-colors"
              data-testid="sc-contract-addr"
              title="Copy contract address"
            >
              {data.contract_address}
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white" onClick={load} data-testid="sc-refresh-btn">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {data.mode !== 'real' && (
              <Button
                size="sm" variant="outline"
                className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10 hover:text-cyan-100"
                onClick={handleDeployReal} disabled={deploying}
                data-testid="sc-deploy-real-btn"
                title="Promote to a real Hedera HSCS deployment (gated by ESCROW_CONTRACT_MODE=real)"
              >
                <Cpu className="w-3.5 h-3.5 mr-1" />
                {deploying ? 'Deploying…' : 'Deploy to Hedera'}
              </Button>
            )}
            {canRefund && !isTerminal && (
              <Button
                size="sm" variant="outline"
                className="border-red-500/40 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                onClick={handleRefund} disabled={refunding}
                data-testid="sc-refund-btn"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                {refunding ? 'Refunding…' : 'Refund Buyer'}
              </Button>
            )}
          </div>
        </div>

        {/* State machine */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {STATES.map(s => {
            const passed = STATES.indexOf(currentState) >= STATES.indexOf(s) && currentState !== 'REFUNDED';
            const isCurrent = s === currentState;
            return (
              <div
                key={s}
                className={`rounded px-2 py-1.5 text-center text-[10px] font-bold tracking-wider border transition-all ${
                  isCurrent ? STATE_TONE[s] + ' ring-2 ring-cyan-400/50' :
                  passed ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                  'bg-slate-800 text-slate-500 border-slate-700'
                }`}
              >
                {s}
              </div>
            );
          })}
        </div>

        {currentState === 'REFUNDED' && (
          <div className="rounded p-2 mb-4 text-center text-[10px] font-bold tracking-wider border bg-red-500/15 text-red-300 border-red-500/30">
            REFUNDED — escrow funds returned to buyer
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Balance</p>
            <p className="text-cyan-300 text-sm font-bold font-mono">
              ${Number(data.balance_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">≈ {data.balance_hbar} HBAR</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Network</p>
            <p className="text-slate-200 text-xs">{data.network}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">ABI version</p>
            <p className="text-slate-200 text-xs font-mono">{data.abi_version}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Conditions</p>
            <p className="text-slate-200 text-xs">{data.conditions_met} / {data.conditions_total}</p>
          </div>
        </div>

        {/* Operation log */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Operation log ({data.operations?.length || 0})
          </p>
          <div className="bg-slate-950/60 border border-slate-700 rounded p-2 max-h-56 overflow-y-auto font-mono text-[10px] space-y-1">
            {(data.operations || []).slice().reverse().map((op) => (
              <div key={op.tx_hash} className="flex items-center gap-2 py-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${OPCODE_TONE[op.opcode] || 'bg-slate-700 text-slate-200'}`}>
                  {op.opcode}
                </span>
                <button onClick={() => copy(op.tx_hash)} className="text-cyan-300 hover:text-cyan-100 truncate" title="Copy tx hash" data-testid={`sc-op-${op.opcode}`}>
                  {op.tx_hash}
                </button>
                <span className="text-slate-500 ml-auto whitespace-nowrap">gas {op.gas_used?.toLocaleString()}</span>
                <span className="text-slate-500 whitespace-nowrap hidden sm:inline">{op.timestamp?.slice(11, 19)}</span>
              </div>
            ))}
            {(data.operations || []).length === 0 && (
              <p className="text-slate-500 text-center py-3">No operations yet.</p>
            )}
          </div>
        </div>

        {/* ABI */}
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 font-bold hover:text-slate-300 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> ABI ({data.abi?.length} functions)
          </summary>
          <div className="mt-2 bg-slate-950/60 border border-slate-700 rounded p-2 font-mono text-[10px] space-y-1">
            {(data.abi || []).map((fn) => (
              <div key={fn.name} className="flex items-baseline gap-2">
                <span className="text-cyan-300">function</span>
                <span className="text-amber-300">{fn.name}</span>
                <span className="text-slate-500">({(fn.inputs || []).join(', ')})</span>
                {fn.state_change && <span className="text-slate-500 ml-auto">→ {fn.state_change}</span>}
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
