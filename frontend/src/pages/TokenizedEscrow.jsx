import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Coins, Plus, Flame, ArrowRightLeft, ExternalLink,
  Shield, Loader2, CheckCircle, XCircle, Eye,
  Copy, RefreshCw, AlertTriangle, Hash, Layers,
  TrendingDown, Activity, ChevronRight, Search,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  active: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
  burned: 'text-red-400 bg-red-500/15 border-red-500/25',
};

const OP_ICONS = {
  mint: Coins,
  transfer: ArrowRightLeft,
  burn: Flame,
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || 'text-gray-400 bg-gray-500/15 border-gray-500/25';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${c}`} data-testid={`token-status-${status}`}>
      {status?.toUpperCase()}
    </span>
  );
}

export default function TokenizedEscrow() {
  const { user, token } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenize, setShowTokenize] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [escrows, setEscrows] = useState([]);

  // Tokenize form
  const [form, setForm] = useState({ escrow_id: '', token_name: 'NCROW', token_symbol: 'NCR', initial_supply: 1000 });
  // Transfer form
  const [transferForm, setTransferForm] = useState({ amount: '', to_party: 'seller' });
  const [showTransfer, setShowTransfer] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTokens = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hts/tokens`, { headers });
      setTokens(res.data.tokens || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/escrow/list`, { headers });
      setEscrows(res.data.escrows || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchTokens();
    fetchEscrows();
  }, [token]);

  const handleTokenize = async () => {
    if (!form.escrow_id) {
      toast({ title: 'Error', description: 'Select an escrow to tokenize', variant: 'destructive' });
      return;
    }
    setActionLoading('tokenize');
    try {
      const res = await axios.post(`${API}/hts/tokenize`, form, { headers });
      if (res.data.already_tokenized) {
        toast({ title: 'Already Tokenized', description: `Escrow already has token ${res.data.token_id}` });
      } else {
        toast({ title: 'Token Created', description: `${res.data.token_symbol} (${res.data.token_id}) minted with ${res.data.initial_supply} supply` });
      }
      setShowTokenize(false);
      setForm({ escrow_id: '', token_name: 'NCROW', token_symbol: 'NCR', initial_supply: 1000 });
      fetchTokens();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Tokenization failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleTransfer = async () => {
    if (!selectedToken || !transferForm.amount) return;
    setActionLoading('transfer');
    try {
      const res = await axios.post(`${API}/hts/transfer`, {
        escrow_id: selectedToken.escrow_id,
        amount: parseInt(transferForm.amount),
        to_party: transferForm.to_party,
      }, { headers });
      toast({ title: 'Transfer Complete', description: `${res.data.amount} tokens transferred to ${res.data.to_party}. Remaining: ${res.data.remaining_supply}` });
      setShowTransfer(false);
      setTransferForm({ amount: '', to_party: 'seller' });
      fetchTokens();
      // Refresh selected token
      const updated = await axios.get(`${API}/hts/token/${selectedToken.escrow_id}`, { headers });
      setSelectedToken(updated.data);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Transfer failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleBurn = async (escrowId) => {
    setActionLoading('burn');
    try {
      const res = await axios.post(`${API}/hts/burn/${escrowId}`, {}, { headers });
      toast({ title: 'Tokens Burned', description: `${res.data.burned} tokens burned successfully` });
      fetchTokens();
      if (selectedToken?.escrow_id === escrowId) {
        const updated = await axios.get(`${API}/hts/token/${escrowId}`, { headers });
        setSelectedToken(updated.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Burn failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleVerify = async (escrowId) => {
    setActionLoading('verify');
    try {
      const res = await axios.get(`${API}/hts/token/${escrowId}/verify`, { headers });
      setVerifyResult(res.data);
      toast({ title: res.data.on_chain_verified ? 'Verified On-Chain' : 'Not Found On-Chain', description: `Token ${res.data.token_id}`, variant: res.data.on_chain_verified ? 'default' : 'destructive' });
    } catch (err) {
      toast({ title: 'Error', description: 'Verification failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const copyText = (t) => {
    navigator.clipboard.writeText(t);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const selectToken = async (tk) => {
    setSelectedToken(tk);
    setVerifyResult(null);
    setShowTransfer(false);
  };

  // Escrows that haven't been tokenized yet
  const untokenizedEscrows = escrows.filter(e => !tokens.some(t => t.escrow_id === e.escrow_id));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825] text-white" data-testid="tokenized-escrow-page">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0f1825]/80 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-amber-500" />
            <span className="text-lg font-bold text-white tracking-tight">
              HTS <span className="text-amber-500">Tokenized Escrow</span>
            </span>
          </div>
          <Button onClick={() => setShowTokenize(true)} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="tokenize-btn">
            <Plus className="w-4 h-4 mr-1.5" /> Tokenize Escrow
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Escrow', path: '/escrow' },
          { label: 'Tokenized Escrow' },
        ]} />

        {/* Tokenize Modal */}
        {showTokenize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="tokenize-modal">
            <Card className="w-full max-w-lg bg-[#162032] border-slate-700 text-white">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" /> Tokenize Escrow
                </h2>
                <p className="text-sm text-slate-400">Create an HTS fungible token representing escrow value on Hedera.</p>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Select Escrow</label>
                  <select
                    value={form.escrow_id}
                    onChange={(e) => setForm({ ...form, escrow_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    data-testid="escrow-select"
                  >
                    <option value="">Choose an escrow...</option>
                    {untokenizedEscrows.map(e => (
                      <option key={e.escrow_id} value={e.escrow_id}>{e.title} — ${e.escrow_amount?.toLocaleString()}</option>
                    ))}
                    {untokenizedEscrows.length === 0 && <option disabled>No untokenized escrows available</option>}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Token Name</label>
                    <Input value={form.token_name} onChange={(e) => setForm({ ...form, token_name: e.target.value })} className="bg-slate-900 border-slate-700 text-white" data-testid="token-name-input" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Symbol</label>
                    <Input value={form.token_symbol} onChange={(e) => setForm({ ...form, token_symbol: e.target.value })} className="bg-slate-900 border-slate-700 text-white" data-testid="token-symbol-input" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Supply</label>
                    <Input type="number" value={form.initial_supply} onChange={(e) => setForm({ ...form, initial_supply: parseInt(e.target.value) || 0 })} className="bg-slate-900 border-slate-700 text-white" data-testid="token-supply-input" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setShowTokenize(false)} className="text-slate-400 hover:text-white" data-testid="cancel-tokenize-btn">Cancel</Button>
                  <Button onClick={handleTokenize} disabled={actionLoading === 'tokenize'} className="bg-amber-600 hover:bg-amber-700" data-testid="confirm-tokenize-btn">
                    {actionLoading === 'tokenize' ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Coins className="w-4 h-4 mr-1.5" />}
                    Create Token
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Token List */}
          <div className="lg:col-span-1">
            <div className="border border-slate-800 rounded-lg bg-[#162032] overflow-hidden" data-testid="token-list">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400">HTS Tokens</h3>
                <span className="text-xs text-slate-500">{tokens.length} total</span>
              </div>
              {tokens.length === 0 ? (
                <div className="p-8 text-center">
                  <Coins className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No tokenized escrows yet</p>
                  <Button onClick={() => setShowTokenize(true)} size="sm" variant="ghost" className="mt-3 text-amber-500 hover:text-amber-400" data-testid="empty-tokenize-btn">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create First Token
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                  {tokens.map((tk) => (
                    <button
                      key={tk.token_id}
                      onClick={() => selectToken(tk)}
                      className={`w-full text-left px-5 py-4 hover:bg-slate-800/30 transition-colors ${selectedToken?.token_id === tk.token_id ? 'bg-slate-800/40 border-l-2 border-amber-500' : ''}`}
                      data-testid={`token-item-${tk.escrow_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{tk.token_symbol}</span>
                            <StatusBadge status={tk.status} />
                          </div>
                          <p className="text-slate-500 text-xs mt-1 truncate">
                            {tk.token_id}
                          </p>
                          <p className="text-slate-600 text-[10px] mt-0.5">
                            Supply: {tk.current_supply?.toLocaleString()} / {tk.initial_supply?.toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Token Detail */}
          <div className="lg:col-span-2">
            {!selectedToken ? (
              <div className="border border-slate-800 rounded-lg bg-[#0f1825] p-12 text-center" data-testid="no-token-selected">
                <Coins className="w-14 h-14 text-slate-800 mx-auto mb-4" />
                <h3 className="text-slate-400 font-medium mb-1">Select a Token</h3>
                <p className="text-slate-600 text-sm">Choose a token from the list to view details and manage operations.</p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="token-detail">
                {/* Token Header Card */}
                <Card className="bg-[#162032] border-slate-800 text-white">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-xl font-bold">{selectedToken.token_name}</h2>
                          <StatusBadge status={selectedToken.status} />
                          {selectedToken.on_chain && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full" data-testid="on-chain-badge">
                              <Shield className="w-3 h-3" /> On-Chain
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Hash className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs">{selectedToken.token_id}</span>
                          <button onClick={() => copyText(selectedToken.token_id)} className="hover:text-white transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedToken.explorer_url && (
                          <a href={selectedToken.explorer_url} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 transition-colors" data-testid="explorer-link">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Supply Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-400">Current Supply</span>
                        <span className="text-white font-bold">{selectedToken.current_supply?.toLocaleString()} / {selectedToken.initial_supply?.toLocaleString()} {selectedToken.token_symbol}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-amber-600 to-amber-400 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${selectedToken.initial_supply ? (selectedToken.current_supply / selectedToken.initial_supply) * 100 : 0}%` }}
                          data-testid="supply-bar"
                        />
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Network</p>
                        <p className="text-sm text-white font-medium mt-0.5" data-testid="token-network">{selectedToken.network}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Treasury</p>
                        <p className="text-sm text-white font-mono mt-0.5 truncate" data-testid="token-treasury">{selectedToken.treasury_account || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Operations</p>
                        <p className="text-sm text-white font-medium mt-0.5" data-testid="token-ops-count">{selectedToken.operations?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Created</p>
                        <p className="text-sm text-white mt-0.5">{new Date(selectedToken.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                {selectedToken.status === 'active' && (
                  <div className="flex items-center gap-3" data-testid="token-actions">
                    <Button onClick={() => setShowTransfer(true)} size="sm" className="bg-sky-600 hover:bg-sky-700" data-testid="transfer-btn">
                      <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Transfer
                    </Button>
                    <Button onClick={() => handleBurn(selectedToken.escrow_id)} size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={actionLoading === 'burn'} data-testid="burn-btn">
                      {actionLoading === 'burn' ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Flame className="w-4 h-4 mr-1.5" />}
                      Burn All
                    </Button>
                    <Button onClick={() => handleVerify(selectedToken.escrow_id)} size="sm" variant="ghost" className="text-slate-400 hover:text-white" disabled={actionLoading === 'verify'} data-testid="verify-btn">
                      {actionLoading === 'verify' ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Search className="w-4 h-4 mr-1.5" />}
                      Verify On-Chain
                    </Button>
                  </div>
                )}

                {/* Transfer Modal */}
                {showTransfer && (
                  <Card className="bg-[#1a2740] border-sky-500/20 text-white" data-testid="transfer-modal">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-sky-400" /> Transfer Tokens
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Amount</label>
                          <Input
                            type="number"
                            placeholder={`Max ${selectedToken.current_supply}`}
                            value={transferForm.amount}
                            onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                            className="bg-slate-900 border-slate-700 text-white"
                            data-testid="transfer-amount-input"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">To Party</label>
                          <select
                            value={transferForm.to_party}
                            onChange={(e) => setTransferForm({ ...transferForm, to_party: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-sky-500 outline-none"
                            data-testid="transfer-party-select"
                          >
                            <option value="seller">Seller</option>
                            <option value="buyer">Buyer</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowTransfer(false)} className="text-slate-400" data-testid="cancel-transfer-btn">Cancel</Button>
                        <Button size="sm" onClick={handleTransfer} disabled={actionLoading === 'transfer'} className="bg-sky-600 hover:bg-sky-700" data-testid="confirm-transfer-btn">
                          {actionLoading === 'transfer' ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ArrowRightLeft className="w-4 h-4 mr-1.5" />}
                          Execute Transfer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Verification Result */}
                {verifyResult && (
                  <Card className={`border ${verifyResult.on_chain_verified ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'} text-white`} data-testid="verify-result">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        {verifyResult.on_chain_verified ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        )}
                        <h3 className="text-sm font-bold">{verifyResult.on_chain_verified ? 'Verified on Hedera Mirror Node' : 'Not Found on Mirror Node'}</h3>
                      </div>
                      {verifyResult.on_chain_data && (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500">Name:</span>
                            <span className="text-white ml-2">{verifyResult.on_chain_data.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Symbol:</span>
                            <span className="text-white ml-2">{verifyResult.on_chain_data.symbol}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Total Supply:</span>
                            <span className="text-white ml-2">{verifyResult.on_chain_data.total_supply}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Treasury:</span>
                            <span className="text-white ml-2 font-mono">{verifyResult.on_chain_data.treasury_account_id}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Operations History */}
                <Card className="bg-[#162032] border-slate-800 text-white" data-testid="operations-history">
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400">Operations History</h3>
                    </div>
                    {(!selectedToken.operations || selectedToken.operations.length === 0) ? (
                      <div className="p-6 text-center text-slate-600 text-sm">No operations recorded</div>
                    ) : (
                      <div className="divide-y divide-slate-800/50">
                        {selectedToken.operations.map((op, i) => {
                          const OpIcon = OP_ICONS[op.type] || Activity;
                          const colorMap = { mint: 'text-emerald-400', transfer: 'text-sky-400', burn: 'text-red-400' };
                          return (
                            <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-800/20 transition-colors" data-testid={`op-${i}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/50 ${colorMap[op.type] || 'text-slate-400'}`}>
                                <OpIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white capitalize">{op.type}</span>
                                  <span className="text-xs text-slate-500">{op.amount?.toLocaleString()} tokens</span>
                                  {op.to_party && <span className="text-[10px] text-slate-600">to {op.to_party}</span>}
                                </div>
                                <p className="text-[10px] text-slate-600 font-mono truncate">{op.transaction_id || '—'}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-500">{new Date(op.timestamp).toLocaleString()}</p>
                                {op.on_chain ? (
                                  <span className="text-[9px] text-emerald-500">on-chain</span>
                                ) : (
                                  <span className="text-[9px] text-slate-600">simulated</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
