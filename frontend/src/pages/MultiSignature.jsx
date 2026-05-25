import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Users, Plus, Trash2, CheckCircle, Clock, XCircle,
  Loader2, FileText, Send, UserCheck, ChevronRight,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function SignerBadge({ signer }) {
  const statusMap = {
    completed: { bg: 'bg-coral-500/15 text-coral-600 border-coral-200', icon: CheckCircle },
    pending: { bg: 'bg-coral-500/10 text-coral-600 border-gold-500/30', icon: Clock },
  };
  const s = statusMap[signer.status] || statusMap.pending;
  const Icon = s.icon;
  return (
    <div data-testid={`signer-${signer.signer_id}`}
      className={`flex items-center justify-between p-3 rounded-lg border ${s.bg}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-xs font-bold text-navy-900">
          {signer.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <span className="text-sm text-navy-900 font-medium">{signer.name}</span>
          <p className="text-[10px] text-slate-500">{signer.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] uppercase font-semibold">{signer.status}</span>
      </div>
    </div>
  );
}

export default function MultiSignature() {
  const { token, user } = useAuth();
  const [ceremonies, setCeremonies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New ceremony form
  const [docName, setDocName] = useState('');
  const [signers, setSigners] = useState([
    { name: '', email: '' },
    { name: '', email: '' },
  ]);

  const [selectedCeremony, setSelectedCeremony] = useState(null);

  const fetchCeremonies = async () => {
    try {
      const res = await axios.get(`${API}/platform/multi-sig`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCeremonies(res.data.ceremonies || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  useEffect(() => { fetchCeremonies(); }, [token]);

  const addSigner = () => setSigners([...signers, { name: '', email: '' }]);
  const removeSigner = (i) => { if (signers.length > 2) setSigners(signers.filter((_, idx) => idx !== i)); };
  const updateSigner = (i, field, val) => {
    const updated = [...signers];
    updated[i] = { ...updated[i], [field]: val };
    setSigners(updated);
  };

  const createCeremony = async () => {
    if (!docName.trim()) { toast({ title: 'Error', description: 'Enter a document name', variant: 'destructive' }); return; }
    const validSigners = signers.filter(s => s.name.trim());
    if (validSigners.length < 2) { toast({ title: 'Error', description: 'At least 2 signers required', variant: 'destructive' }); return; }

    setCreating(true);
    try {
      const res = await axios.post(`${API}/platform/multi-sig/start`, {
        document_name: docName,
        signers: validSigners,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Multi-Sig Ceremony Created', description: `${res.data.total_signers} signers required` });
      setDocName('');
      setSigners([{ name: '', email: '' }, { name: '', email: '' }]);
      fetchCeremonies();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to create', variant: 'destructive' });
    }
    setCreating(false);
  };

  const signCeremony = async (ceremonyId, signerId) => {
    try {
      const res = await axios.post(`${API}/platform/multi-sig/${ceremonyId}/sign/${signerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: res.data.all_signed ? 'All Signers Complete!' : 'Signed Successfully' });
      fetchCeremonies();
      if (selectedCeremony?.ceremony_id === ceremonyId) {
        const updated = await axios.get(`${API}/platform/multi-sig/${ceremonyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSelectedCeremony(updated.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Sign failed', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-cream-100" data-testid="multi-sig-page">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Multi-Signature' }]} />

        <div className="flex items-center gap-3 mt-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-coral-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Multi-Signature Ceremonies</h1>
            <p className="text-xs text-slate-500">Require 2+ signers with biometric verification per ceremony</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">New Multi-Sig Ceremony</h3>
            <div className="space-y-3">
              <Input data-testid="multi-sig-doc-name" value={docName} onChange={e => setDocName(e.target.value)}
                placeholder="Document name" className="bg-white border-slate-300 text-navy-900" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Signers ({signers.length})</span>
                  <button data-testid="add-signer-btn" onClick={addSigner}
                    className="text-[10px] text-coral-600 hover:text-coral-400 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Signer
                  </button>
                </div>
                {signers.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={s.name} onChange={e => updateSigner(i, 'name', e.target.value)}
                      placeholder={`Signer ${i + 1} name`} className="bg-white border-slate-300 text-navy-900 text-xs flex-1" />
                    <Input value={s.email} onChange={e => updateSigner(i, 'email', e.target.value)}
                      placeholder="Email" className="bg-white border-slate-300 text-navy-900 text-xs flex-1" />
                    {signers.length > 2 && (
                      <button onClick={() => removeSigner(i)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Button data-testid="create-multi-sig-btn" onClick={createCeremony} disabled={creating}
                className="w-full bg-violet-600 hover:bg-violet-700 text-navy-900">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : <><Send className="w-4 h-4 mr-2" />Create Multi-Sig Ceremony</>}
              </Button>
            </div>
          </div>

          {/* Detail View */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {selectedCeremony ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-navy-900">{selectedCeremony.document_name}</h3>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    selectedCeremony.status === 'all_signed' ? 'bg-coral-500/15 text-coral-600 border-coral-200' : 'bg-coral-500/10 text-coral-600 border-gold-500/30'
                  }`}>{selectedCeremony.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3 mb-4 text-xs text-slate-500">
                  <span>{selectedCeremony.completed_signers}/{selectedCeremony.total_signers} signed</span>
                  <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                    <div className="h-full bg-coral-500 rounded-full transition-all"
                      style={{ width: `${(selectedCeremony.completed_signers / selectedCeremony.total_signers) * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedCeremony.signers?.map((s, i) => (
                    <div key={i}>
                      <SignerBadge signer={s} />
                      {s.status === 'pending' && (
                        <Button size="sm" onClick={() => signCeremony(selectedCeremony.ceremony_id, s.signer_id)}
                          data-testid={`sign-btn-${s.signer_id}`}
                          className="mt-1 w-full bg-coral-500 hover:bg-emerald-700 text-navy-900 text-xs">
                          <UserCheck className="w-3 h-3 mr-1" /> Sign as {s.name}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 py-12">
                <div className="text-center">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a ceremony to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ceremonies List */}
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">Your Multi-Sig Ceremonies</h3>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : ceremonies.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No multi-signature ceremonies yet</p>
          ) : (
            <div className="space-y-2">
              {ceremonies.map((c, i) => (
                <button key={i} data-testid={`multi-sig-item-${i}`}
                  onClick={() => setSelectedCeremony(c)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedCeremony?.ceremony_id === c.ceremony_id ? 'border-violet-500/40 bg-violet-500/5' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-sm text-navy-900">{c.document_name}</span>
                      <p className="text-[10px] text-slate-500">{c.completed_signers}/{c.total_signers} signed &middot; {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      c.status === 'all_signed' ? 'bg-coral-500/15 text-coral-600' : 'bg-coral-500/10 text-coral-600'
                    }`}>{c.status === 'all_signed' ? 'Complete' : 'Pending'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
