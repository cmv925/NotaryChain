import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Plus,
  Loader2, ChevronRight, UserCheck, AlertTriangle, Send
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const statusStyles = {
  approved: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  pending: 'bg-coral-500/15 text-coral-600',
  waiting: 'bg-gray-500/15 text-slate-500',
};

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [comment, setComment] = useState('');

  // Create form
  const [docName, setDocName] = useState('');
  const [description, setDescription] = useState('');
  const [chain, setChain] = useState([{ approver_email: '', role: 'manager' }]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const endpoint = tab === 'pending' ? 'pending' : 'my';
    try {
      const res = await fetch(`${API}/api/approvals/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab, token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const createRequest = async () => {
    if (!docName.trim() || chain.every((c) => !c.approver_email.trim())) return;
    setCreating(true);
    try {
      await fetch(`${API}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          document_name: docName,
          description,
          approval_chain: chain.filter((c) => c.approver_email.trim()).map((c, i) => ({ ...c, order: i + 1 })),
        }),
      });
      setShowCreate(false);
      setDocName('');
      setDescription('');
      setChain([{ approver_email: '', role: 'manager' }]);
      fetchRequests();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const takeAction = async (requestId, action) => {
    setActionLoading(requestId);
    try {
      await fetch(`${API}/api/approvals/${requestId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, comment }),
      });
      setComment('');
      fetchRequests();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-coral-500" />
                Approval Workflows
              </h1>
              <p className="text-slate-500 text-sm">Multi-step document approvals</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-coral-500 hover:bg-coral-600" data-testid="create-approval-btn">
            <Plus className="w-4 h-4 mr-2" /> New Request
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="bg-cream-100 border-slate-200 mb-6" data-testid="create-form">
            <CardContent className="pt-5 space-y-3">
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Document name" className="bg-white border-slate-200 text-navy-900" data-testid="doc-name-input" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="bg-white border-slate-200 text-navy-900" />
              <div className="space-y-2">
                <p className="text-slate-500 text-xs">Approval Chain (in order):</p>
                {chain.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={c.approver_email}
                      onChange={(e) => { const n = [...chain]; n[i].approver_email = e.target.value; setChain(n); }}
                      placeholder="Approver email"
                      className="bg-white border-slate-200 text-navy-900 flex-1"
                      data-testid={`approver-email-${i}`}
                    />
                    <select
                      value={c.role}
                      onChange={(e) => { const n = [...chain]; n[i].role = e.target.value; setChain(n); }}
                      className="bg-white border border-slate-200 rounded-md px-2 text-sm text-navy-900"
                    >
                      {['manager', 'legal', 'executive', 'compliance', 'custom'].map((r) => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setChain([...chain, { approver_email: '', role: 'approver' }])} className="text-coral-500 text-xs">
                  + Add step
                </Button>
              </div>
              <Button onClick={createRequest} disabled={creating} className="bg-coral-500 hover:bg-coral-600 w-full" data-testid="submit-approval">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit for Approval
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'pending', label: 'Awaiting My Approval' },
            { key: 'my', label: 'All My Requests' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === key ? 'bg-coral-500/20 text-coral-500' : 'bg-navy-800/50 text-slate-500 hover:text-slate-500'
              }`}
              data-testid={`tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Requests */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : requests.length === 0 ? (
          <Card className="bg-cream-100 border-slate-200">
            <CardContent className="py-12 text-center text-slate-500">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{tab === 'pending' ? 'No approvals waiting' : 'No requests yet'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id} className="bg-cream-100 border-slate-200" data-testid={`approval-${req.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-navy-900 font-medium text-sm">{req.document_name}</h3>
                      <p className="text-slate-500 text-xs">by {req.requester_name} — {new Date(req.created_at).toLocaleDateString()}</p>
                      {req.description && <p className="text-slate-500 text-xs mt-1">{req.description}</p>}
                    </div>
                    <Badge className={statusStyles[req.status]}>{req.status}</Badge>
                  </div>

                  {/* Approval Chain */}
                  <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                    {req.steps?.map((step, i) => (
                      <React.Fragment key={i}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] whitespace-nowrap ${
                          step.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          step.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          step.status === 'pending' ? 'bg-coral-500/10 text-coral-600 ring-1 ring-amber-500/20' :
                          'bg-navy-800/50 text-slate-500'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle className="w-3 h-3" /> :
                           step.status === 'rejected' ? <XCircle className="w-3 h-3" /> :
                           step.status === 'pending' ? <Clock className="w-3 h-3" /> : null}
                          <span>{step.approver_name || step.approver_email}</span>
                          <span className="text-slate-600">({step.role})</span>
                        </div>
                        {i < req.steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Action buttons for pending tab */}
                  {tab === 'pending' && req.status === 'pending' && (
                    <div className="flex gap-2 items-center border-t border-slate-200 pt-3">
                      <Input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Optional comment..."
                        className="bg-white border-slate-200 text-navy-900 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => takeAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="bg-green-600 hover:bg-green-700 text-navy-900 text-xs"
                        data-testid={`approve-${req.id}`}
                      >
                        {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => takeAction(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
                        data-testid={`reject-${req.id}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
