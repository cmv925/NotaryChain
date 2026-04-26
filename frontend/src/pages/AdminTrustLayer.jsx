import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network, Plus, Copy, RotateCw, Power, ExternalLink, ChevronLeft, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminTrustLayer() {
  const { user, token } = useAuth();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState(null); // { partner_id, api_key, name }

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/trustlayer/partners`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      const d = await r.json();
      setPartners(d.partners || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin && token) load(); else setLoading(false); }, [isAdmin, token]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" data-testid="trustlayer-admin-denied">
        <Card className="bg-red-500/5 border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Admin only</h2>
            <p className="text-sm text-slate-400">Sign in as an admin to manage TrustLayer partners.</p>
            <Link to="/login" className="inline-block mt-4 text-violet-400 hover:underline text-sm">Go to login</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createPartner = async (form) => {
    const r = await fetch(`${API}/api/trustlayer/partners`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.detail || 'Failed to create partner');
      return;
    }
    const d = await r.json();
    setNewKey({ partner_id: d.partner_id, api_key: d.api_key, name: d.name });
    setShowCreate(false);
    toast.success('Partner created');
    load();
  };

  const rotate = async (partner_id) => {
    if (!window.confirm('Rotate API key? The old key will stop working immediately.')) return;
    const r = await fetch(`${API}/api/trustlayer/partners/${partner_id}/rotate-key`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) { toast.error('Rotate failed'); return; }
    const d = await r.json();
    const partner = partners.find(p => p.partner_id === partner_id);
    setNewKey({ partner_id, api_key: d.api_key, name: partner?.name || 'Partner' });
    toast.success('Key rotated');
    load();
  };

  const setStatus = async (partner_id, status) => {
    const r = await fetch(`${API}/api/trustlayer/partners/${partner_id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) { toast.error('Update failed'); return; }
    toast.success(status === 'active' ? 'Partner activated' : 'Partner disabled');
    load();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="trustlayer-admin-page">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-violet-950/20 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white" data-testid="back-to-admin">
              <ChevronLeft className="w-4 h-4" /> Admin
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-500">TrustLayer</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Network className="w-5 h-5 text-violet-400" />
                <span className="text-violet-400 text-[10px] uppercase tracking-[0.25em] font-bold">TrustLayer · Admin</span>
              </div>
              <h1 className="text-3xl font-bold">Trust Partners</h1>
              <p className="text-slate-400 text-sm mt-1">Onboard verifiers and manage API keys for the federated trust network.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/trustlayer">
                <Button variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800">
                  Public page <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </Link>
              <Button onClick={() => { setNewKey(null); setShowCreate(true); }} className="bg-violet-600 hover:bg-violet-500" data-testid="new-partner-btn">
                <Plus className="w-4 h-4 mr-1" /> New partner
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {newKey && <NewKeyBanner data={newKey} onClose={() => setNewKey(null)} />}

        {showCreate && <CreatePartnerForm onCreate={createPartner} onClose={() => setShowCreate(false)} />}

        {loading && (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto" /></div>
        )}

        {error && !loading && (
          <Card className="bg-red-500/5 border-red-500/30">
            <CardContent className="p-6 text-sm text-red-400">{error}</CardContent>
          </Card>
        )}

        {!loading && !error && partners.length === 0 && (
          <Card className="bg-slate-900/40 border-dashed border-slate-700" data-testid="no-partners-empty">
            <CardContent className="p-10 text-center">
              <Network className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold mb-1">No partners yet</h3>
              <p className="text-xs text-slate-500 mb-4">Create the first TrustLayer partner to start issuing attestations.</p>
              <Button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-500">
                <Plus className="w-4 h-4 mr-1" /> Create first partner
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && partners.length > 0 && (
          <div className="space-y-2" data-testid="partners-list">
            {partners.map(p => (
              <Card key={p.partner_id} className="bg-slate-900/60 border-slate-800" data-testid={`partner-row-${p.partner_id}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-white">{p.name}</h3>
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mb-1 truncate">{p.domain}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{p.api_key_preview}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <Stat label="Issued" value={p.stats?.attestations_issued || 0} />
                      <Stat label="Verified" value={p.stats?.verifications_served || 0} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => rotate(p.partner_id)}
                        className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800 text-xs h-8" data-testid={`rotate-${p.partner_id}`}>
                        <RotateCw className="w-3 h-3 mr-1" /> Rotate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(p.partner_id, p.status === 'active' ? 'disabled' : 'active')}
                        className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800 text-xs h-8" data-testid={`toggle-${p.partner_id}`}>
                        <Power className="w-3 h-3 mr-1" /> {p.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
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

function CreatePartnerForm({ onCreate, onClose }) {
  const [form, setForm] = useState({ name: '', domain: '', description: '' });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.domain) { toast.error('Name and domain required'); return; }
    onCreate(form);
  };
  return (
    <Card className="bg-violet-500/5 border-violet-500/30" data-testid="create-partner-form">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-violet-300">New trust partner</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close" data-testid="close-create-form">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Name</label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Acme KYC" className="bg-slate-900/60 border-slate-700 mt-1" data-testid="partner-name-input" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Domain</label>
            <Input value={form.domain} onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="acme.com" className="bg-slate-900/60 border-slate-700 mt-1" data-testid="partner-domain-input" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Description (optional)</label>
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does this partner verify?" rows={2}
              className="bg-slate-900/60 border-slate-700 mt-1" data-testid="partner-description-input" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">Cancel</Button>
            <Button type="submit" className="bg-violet-600 hover:bg-violet-500" data-testid="submit-create-partner">
              Create partner
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NewKeyBanner({ data, onClose }) {
  const copy = () => navigator.clipboard.writeText(data.api_key).then(() => toast.success('Key copied'));
  return (
    <Card className="bg-emerald-500/5 border-emerald-500/30" data-testid="new-key-banner">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-emerald-300 mb-1">{data.name} — API key generated</h3>
            <p className="text-xs text-slate-400 mb-3">
              <strong>This key will only appear once.</strong> Copy it now and store it in your partner’s secret manager.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[11px] font-mono text-emerald-300 flex-1 break-all">
                {data.api_key}
              </code>
              <Button size="sm" onClick={copy} className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0" data-testid="copy-new-key">
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Dismiss" data-testid="dismiss-new-key">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
