/**
 * SDKKeys — manage publishable keys, webhooks, and view usage.
 * Mounted at /developers/sdk-keys (protected, Pro+).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Shield, KeyRound, Plus, Copy, Eye, EyeOff, Trash2, Webhook, AlertCircle, TrendingUp, Check, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SDKKeys() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [keys, setKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState(null);

  const [newKey, setNewKey] = useState({ name: '', mode: 'test', allowed_origins: '' });
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealed, setRevealed] = useState({});

  const [newWebhook, setNewWebhook] = useState({ url: '', events: 'ceremony.sealed' });
  const [creatingWh, setCreatingWh] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [k, w, u] = await Promise.all([
        axios.get(`${API}/sdk/keys`, { headers }),
        axios.get(`${API}/sdk/webhooks`, { headers }),
        axios.get(`${API}/sdk/usage`, { headers }),
      ]);
      setKeys(k.data.keys || []);
      setWebhooks(w.data.webhooks || []);
      setUsage(u.data);
      setGateError(null);
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.detail?.error === 'upgrade_required') {
        setGateError(e.response.data.detail);
      } else {
        toast({ title: 'Error', description: 'Failed to load SDK data', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-line */ }, []);

  const createKey = async () => {
    if (!newKey.name.trim()) return toast({ title: 'Name required', variant: 'destructive' });
    setCreatingKey(true);
    try {
      const r = await axios.post(`${API}/sdk/keys`, {
        name: newKey.name,
        mode: newKey.mode,
        allowed_origins: newKey.allowed_origins.split(',').map(s => s.trim()).filter(Boolean),
      }, { headers });
      toast({ title: 'Key created', description: r.data.publishable_key });
      setNewKey({ name: '', mode: 'test', allowed_origins: '' });
      setRevealed(prev => ({ ...prev, [r.data.id]: true }));
      fetchAll();
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.detail?.error === 'upgrade_required') {
        setGateError(e.response.data.detail);
      } else {
        toast({ title: 'Failed', description: e.response?.data?.detail?.message || e.response?.data?.detail || 'Error', variant: 'destructive' });
      }
    } finally {
      setCreatingKey(false);
    }
  };

  const revokeKey = async (id) => {
    if (!window.confirm('Revoke this key? Any sites using it will stop working immediately.')) return;
    try {
      await axios.delete(`${API}/sdk/keys/${id}`, { headers });
      toast({ title: 'Key revoked' });
      fetchAll();
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const createWebhook = async () => {
    if (!newWebhook.url.startsWith('http')) return toast({ title: 'URL must start with http/https', variant: 'destructive' });
    setCreatingWh(true);
    try {
      await axios.post(`${API}/sdk/webhooks`, {
        url: newWebhook.url,
        events: newWebhook.events.split(',').map(s => s.trim()).filter(Boolean),
        active: true,
      }, { headers });
      setNewWebhook({ url: '', events: 'ceremony.sealed' });
      toast({ title: 'Webhook created' });
      fetchAll();
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.detail?.error === 'upgrade_required') {
        setGateError(e.response.data.detail);
      } else {
        toast({ title: 'Failed', description: e.response?.data?.detail?.message || e.response?.data?.detail, variant: 'destructive' });
      }
    } finally {
      setCreatingWh(false);
    }
  };

  const deleteWebhook = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await axios.delete(`${API}/sdk/webhooks/${id}`, { headers });
      toast({ title: 'Webhook deleted' });
      fetchAll();
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const mask = (key) => key.slice(0, 12) + '·'.repeat(16) + key.slice(-4);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-navy-900">Loading SDK dashboard…</div>
      </div>
    );
  }

  if (gateError) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-10 text-center" data-testid="sdk-upgrade-gate">
          <Lock className="w-12 h-12 text-coral-500 mx-auto mb-4" />
          <h2 className="font-serif text-3xl text-navy-900 mb-2">Upgrade required</h2>
          <p className="text-slate-600 text-sm mb-6">{gateError.message}</p>
          <Button onClick={() => navigate('/subscription')} className="bg-coral-500 hover:bg-coral-600 text-white w-full" data-testid="upgrade-cta">
            View {gateError.required_plan_name} plan — ${gateError.required_plan_price}/mo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100" data-testid="sdk-keys-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </div>
          <Button onClick={() => navigate('/developers/sdk')} variant="outline" className="border-slate-300 text-navy-900 hover:bg-cream-200/50" data-testid="view-docs-btn">
            View Docs
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-4xl text-navy-900 tracking-tight mb-1">SDK Keys & Webhooks</h1>
          <p className="text-slate-600">Provision publishable keys, lock them to your domains, and wire up server-side webhook confirmations.</p>
        </div>

        {/* Usage strip */}
        {usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10" data-testid="usage-strip">
            <Card className="p-5 bg-white border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Sessions (30d)</span>
                <TrendingUp className="w-4 h-4 text-coral-500" />
              </div>
              <div className="text-3xl font-light text-navy-900" data-testid="sessions-30d">{usage.sessions_30d}</div>
            </Card>
            <Card className="p-5 bg-white border-slate-200">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold block mb-2">Sealed (30d)</span>
              <div className="text-3xl font-light text-navy-900" data-testid="sealed-30d">{usage.sealed_30d}</div>
            </Card>
            <Card className="p-5 bg-white border-slate-200">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold block mb-2">Active Keys</span>
              <div className="text-3xl font-light text-navy-900">{keys.filter(k => k.active).length}</div>
            </Card>
          </div>
        )}

        {/* Create key */}
        <Card className="p-6 mb-6 bg-white border-slate-200" data-testid="create-key-card">
          <h2 className="font-serif text-2xl text-navy-900 mb-1">Create a publishable key</h2>
          <p className="text-slate-600 text-sm mb-5">Use <code className="bg-cream-100 text-navy-900 px-1.5 py-0.5 rounded text-[12px] font-mono">pk_test_*</code> for development and <code className="bg-cream-100 text-navy-900 px-1.5 py-0.5 rounded text-[12px] font-mono">pk_live_*</code> for production.</p>

          <div className="grid md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Key name</Label>
              <Input value={newKey.name} onChange={e => setNewKey({ ...newKey, name: e.target.value })} placeholder="Production · Marketing Site" data-testid="key-name-input" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Mode</Label>
              <select className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={newKey.mode} onChange={e => setNewKey({ ...newKey, mode: e.target.value })} data-testid="key-mode-select">
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Allowed origins (comma-separated)</Label>
              <Input value={newKey.allowed_origins} onChange={e => setNewKey({ ...newKey, allowed_origins: e.target.value })} placeholder="example.com, app.example.com" data-testid="key-origins-input" />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button onClick={createKey} disabled={creatingKey} className="bg-coral-500 hover:bg-coral-600 text-white w-full" data-testid="create-key-btn">
                <Plus className="w-4 h-4 mr-1" /> Create
              </Button>
            </div>
          </div>
        </Card>

        {/* Keys list */}
        <Card className="mb-10 bg-white border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-cream-50">
            <h3 className="font-semibold text-navy-900 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Your keys ({keys.length})</h3>
          </div>
          {keys.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500 text-sm">No keys yet. Create one above to get started.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {keys.map(k => (
                <li key={k.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream-50/50" data-testid={`key-row-${k.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-navy-900 text-sm">{k.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${k.mode === 'live' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {k.mode}
                      </span>
                      {!k.active && <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">REVOKED</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-[12px] font-mono text-slate-700 bg-cream-100 px-2 py-1 rounded border border-slate-200">
                        {revealed[k.id] ? k.publishable_key : mask(k.publishable_key)}
                      </code>
                      <button onClick={() => setRevealed(prev => ({ ...prev, [k.id]: !prev[k.id] }))} className="p-1.5 text-slate-500 hover:text-navy-900" data-testid={`reveal-${k.id}-btn`}>
                        {revealed[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => copy(k.publishable_key, 'Key')} className="p-1.5 text-slate-500 hover:text-navy-900" data-testid={`copy-${k.id}-btn`}>
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1.5">
                      {k.allowed_origins?.length ? `Origins: ${k.allowed_origins.join(', ')}` : 'Origins: any (unrestricted)'} · {k.usage_count} sessions
                    </div>
                  </div>
                  {k.active && (
                    <Button onClick={() => revokeKey(k.id)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 ml-4" size="sm" data-testid={`revoke-${k.id}-btn`}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Webhooks */}
        <Card className="p-6 mb-6 bg-white border-slate-200" data-testid="create-webhook-card">
          <h2 className="font-serif text-2xl text-navy-900 mb-1 flex items-center gap-2"><Webhook className="w-6 h-6 text-coral-600" /> Webhooks</h2>
          <p className="text-slate-600 text-sm mb-5">Receive HMAC-SHA256-signed events when ceremonies complete or seal. Verify with the <code className="bg-cream-100 text-navy-900 px-1.5 py-0.5 rounded text-[12px] font-mono">X-NotaryChain-Signature</code> header.</p>

          <div className="grid md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Endpoint URL</Label>
              <Input value={newWebhook.url} onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })} placeholder="https://api.example.com/webhooks/notarychain" data-testid="webhook-url-input" />
            </div>
            <div className="md:col-span-4">
              <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Events (comma-separated)</Label>
              <Input value={newWebhook.events} onChange={e => setNewWebhook({ ...newWebhook, events: e.target.value })} placeholder="ceremony.sealed, ceremony.completed" data-testid="webhook-events-input" />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button onClick={createWebhook} disabled={creatingWh} className="bg-navy-900 hover:bg-navy-800 text-cream-100 w-full" data-testid="create-webhook-btn">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-cream-50">
            <h3 className="font-semibold text-navy-900">Configured webhooks ({webhooks.length})</h3>
          </div>
          {webhooks.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">No webhooks yet.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {webhooks.map(w => (
                <li key={w.id} className="px-6 py-4 flex items-center justify-between" data-testid={`webhook-row-${w.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy-900 truncate">{w.url}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Events: {w.events?.join(', ')} · Delivered: {w.delivery_count} · Last: {w.last_status || 'never'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                      Signing secret: <code className="bg-cream-100 text-navy-900 px-1.5 py-0.5 rounded text-[10px] font-mono">{w.secret.slice(0, 10)}…{w.secret.slice(-4)}</code>
                      <button onClick={() => copy(w.secret, 'Webhook secret')} className="text-slate-500 hover:text-navy-900"><Copy className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <Button onClick={() => deleteWebhook(w.id)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 ml-4" size="sm" data-testid={`delete-wh-${w.id}-btn`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="mt-8 bg-coral-50 border border-coral-200 rounded-lg p-5 flex items-start gap-3" data-testid="security-tip">
          <AlertCircle className="w-5 h-5 text-coral-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-navy-900 mb-1">Security best practice</div>
            <p className="text-[13px] text-slate-700 leading-relaxed">
              Always lock production keys to your domain via <strong>Allowed origins</strong>. Publishable keys are safe to expose in your frontend, but origin-locking prevents malicious sites from spawning ceremonies under your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
