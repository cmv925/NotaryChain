import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { 
  Plus, Search, Filter, Clock, CheckCircle2, Users, 
  AlertTriangle, ArrowRight, Building2, FileText, Briefcase,
  Scale, Sparkles, ArrowLeft
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  draft: 'bg-gray-500',
  pending_participants: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  pending_review: 'bg-purple-500',
  pending_settlement: 'bg-orange-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  on_hold: 'bg-gray-400'
};

const typeIcons = {
  real_estate_closing: Building2,
  business_contract: Briefcase,
  estate_settlement: Scale,
  trust_settlement: FileText,
  merger_acquisition: Building2,
  loan_closing: Building2,
  custom: FileText
};

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [transactions, setTransactions] = useState([]);
  const [blueprints, setBlueprints] = useState({ system_blueprints: [], custom_blueprints: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // New transaction form
  const [newTransaction, setNewTransaction] = useState({
    name: '',
    description: '',
    transaction_type: 'business_contract',
    blueprint_id: null,
    participants: [],
    ai_enabled: true
  });
  const [newParticipant, setNewParticipant] = useState({ email: '', name: '', role: 'signer' });

  useEffect(() => {
    fetchTransactions();
    fetchBlueprints();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlueprints = async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions/blueprints`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBlueprints(data);
      }
    } catch (error) {
      console.error('Failed to fetch blueprints:', error);
    }
  };

  const createTransaction = async () => {
    if (!newTransaction.name.trim()) return;
    
    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTransaction)
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowCreateDialog(false);
        navigate(`/transactions/${data.id}`);
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setCreating(false);
    }
  };

  const addParticipant = () => {
    if (!newParticipant.email.trim()) return;
    setNewTransaction({
      ...newTransaction,
      participants: [...newTransaction.participants, { ...newParticipant }]
    });
    setNewParticipant({ email: '', name: '', role: 'signer' });
  };

  const removeParticipant = (index) => {
    setNewTransaction({
      ...newTransaction,
      participants: newTransaction.participants.filter((_, i) => i !== index)
    });
  };

  const selectBlueprint = (blueprint) => {
    setNewTransaction({
      ...newTransaction,
      blueprint_id: blueprint.id,
      transaction_type: blueprint.transaction_type,
      name: newTransaction.name || `${blueprint.name} - ${new Date().toLocaleDateString()}`
    });
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: transactions.length,
    active: transactions.filter(t => t.status === 'in_progress').length,
    completed: transactions.filter(t => t.status === 'completed').length,
    pending: transactions.filter(t => ['draft', 'pending_participants'].includes(t.status)).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4aa] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white mb-4" data-testid="back-to-dashboard">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transaction Orchestrator</h1>
            <p className="text-gray-400 mt-1">Manage complex multi-party transactions with AI assistance</p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#00d4aa] text-black hover:bg-[#00b894]">
                <Plus className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a2e] border-[#333] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Create New Transaction</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Blueprint Selection */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Select Blueprint (Optional)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {blueprints.system_blueprints.map((bp) => {
                      const Icon = typeIcons[bp.transaction_type] || FileText;
                      return (
                        <button
                          key={bp.id}
                          onClick={() => selectBlueprint(bp)}
                          className={`p-4 rounded-lg border text-left transition-colors ${
                            newTransaction.blueprint_id === bp.id
                              ? 'border-[#00d4aa] bg-[#00d4aa]/10'
                              : 'border-[#333] bg-[#0d1b2a] hover:border-[#555]'
                          }`}
                        >
                          <Icon className={`h-5 w-5 mb-2 ${
                            newTransaction.blueprint_id === bp.id ? 'text-[#00d4aa]' : 'text-gray-400'
                          }`} />
                          <p className="font-medium text-sm">{bp.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{bp.steps?.length || 0} steps</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Transaction Name *</label>
                    <Input
                      value={newTransaction.name}
                      onChange={(e) => setNewTransaction({ ...newTransaction, name: e.target.value })}
                      placeholder="e.g., Property Sale - 123 Main St"
                      className="bg-[#0d1b2a] border-[#333] text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Description</label>
                    <Input
                      value={newTransaction.description}
                      onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                      placeholder="Brief description of the transaction"
                      className="bg-[#0d1b2a] border-[#333] text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Transaction Type</label>
                    <select
                      value={newTransaction.transaction_type}
                      onChange={(e) => setNewTransaction({ ...newTransaction, transaction_type: e.target.value })}
                      className="w-full p-2 rounded-lg bg-[#0d1b2a] border border-[#333] text-white"
                    >
                      <option value="real_estate_closing">Real Estate Closing</option>
                      <option value="business_contract">Business Contract</option>
                      <option value="estate_settlement">Estate Settlement</option>
                      <option value="trust_settlement">Trust Settlement</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                {/* Add Participants */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Add Participants</label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={newParticipant.email}
                      onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                      placeholder="Email"
                      className="flex-1 bg-[#0d1b2a] border-[#333] text-white"
                    />
                    <Input
                      value={newParticipant.name}
                      onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                      placeholder="Name"
                      className="w-32 bg-[#0d1b2a] border-[#333] text-white"
                    />
                    <select
                      value={newParticipant.role}
                      onChange={(e) => setNewParticipant({ ...newParticipant, role: e.target.value })}
                      className="w-32 p-2 rounded-lg bg-[#0d1b2a] border border-[#333] text-white"
                    >
                      <option value="signer">Signer</option>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="agent">Agent</option>
                      <option value="attorney">Attorney</option>
                      <option value="notary">Notary</option>
                      <option value="reviewer">Reviewer</option>
                    </select>
                    <Button onClick={addParticipant} variant="outline" className="border-[#333]">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {newTransaction.participants.length > 0 && (
                    <div className="space-y-2">
                      {newTransaction.participants.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-[#0d1b2a] rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-white">{p.email}</span>
                            <Badge className="bg-[#333] text-gray-300">{p.role}</Badge>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeParticipant(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#0d1b2a] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[#00d4aa]" />
                    <div>
                      <p className="font-medium">AI Orchestration</p>
                      <p className="text-sm text-gray-400">Get intelligent suggestions and risk analysis</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNewTransaction({ ...newTransaction, ai_enabled: !newTransaction.ai_enabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      newTransaction.ai_enabled ? 'bg-[#00d4aa]' : 'bg-[#333]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      newTransaction.ai_enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Create Button */}
                <Button
                  onClick={createTransaction}
                  disabled={creating || !newTransaction.name.trim()}
                  className="w-full bg-[#00d4aa] text-black hover:bg-[#00b894]"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Transaction
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#1a1a2e] border-[#333]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#1a1a2e] border-[#333]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active</p>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#1a1a2e] border-[#333]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-white">{stats.completed}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#00d4aa]/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-[#00d4aa]" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#1a1a2e] border-[#333]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-white">{stats.pending}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="pl-10 bg-[#1a1a2e] border-[#333] text-white"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 rounded-lg bg-[#1a1a2e] border border-[#333] text-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="pending_participants">Pending Participants</option>
          </select>
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <Card className="bg-[#1a1a2e] border-[#333]">
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Transactions Yet</h3>
              <p className="text-gray-400 mb-6">Create your first transaction to get started with AI-powered orchestration.</p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-[#00d4aa] text-black hover:bg-[#00b894]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Transaction
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((tx) => {
              const Icon = typeIcons[tx.transaction_type] || FileText;
              return (
                <Card 
                  key={tx.id} 
                  className="bg-[#1a1a2e] border-[#333] hover:border-[#555] transition-colors cursor-pointer"
                  onClick={() => navigate(`/transactions/${tx.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-[#00d4aa]/20 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-[#00d4aa]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white text-lg">{tx.name}</h3>
                            <Badge className={`${statusColors[tx.status]} text-white`}>
                              {tx.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                            <span>{tx.transaction_type.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {tx.participant_count} participants
                            </span>
                            <span>•</span>
                            <span>{tx.completed_tasks}/{tx.total_tasks} tasks</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Progress</p>
                          <p className="text-lg font-semibold text-[#00d4aa]">{tx.progress_percentage}%</p>
                        </div>
                        <div className="w-32">
                          <Progress value={tx.progress_percentage} className="h-2 bg-[#333]" />
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
