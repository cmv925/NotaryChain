import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { NotificationBell } from '../components/NotificationBell';
import {
  ArrowLeft, Key, Plus, Trash2, Copy, Eye, EyeOff,
  Code, Shield, Zap, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronRight, ExternalLink, Activity,
  Webhook, Send, ToggleLeft, ToggleRight, XCircle
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_URL = process.env.REACT_APP_BACKEND_URL;

const DeveloperPage = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [activeTab, setActiveTab] = useState('docs');
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

  // Webhook state
  const [webhooks, setWebhooks] = useState([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState(['seal.created', 'document.verified', 'request.completed']);
  const [newWebhookDesc, setNewWebhookDesc] = useState('');
  const [createdWebhook, setCreatedWebhook] = useState(null);
  const [expandedWebhook, setExpandedWebhook] = useState(null);
  const [webhookDetails, setWebhookDetails] = useState(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/developer/keys`, { headers });
      setKeys(res.data.keys || []);
    } catch {}
  }, [headers]);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/developer/usage`, { headers });
      setUsage(res.data);
    } catch {}
  }, [headers]);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/developer/webhooks`, { headers });
      setWebhooks(res.data.webhooks || []);
    } catch {}
  }, [headers]);

  const fetchWebhookDetails = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API}/developer/webhooks/${id}`, { headers });
      setWebhookDetails(res.data);
    } catch {}
  }, [headers]);

  useEffect(() => {
    if (token && activeTab === 'keys') { fetchKeys(); fetchUsage(); }
    if (token && activeTab === 'webhooks') { fetchWebhooks(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [token, activeTab]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Name Required', description: 'Give your API key a name', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/developer/keys`, { name: newKeyName, scopes: ['read', 'seal', 'verify'] }, { headers });
      setCreatedKey(res.data);
      setNewKeyName('');
      fetchKeys();
      toast({ title: 'API Key Created', description: 'Copy and store it securely' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to create key', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleRevoke = async (keyId) => {
    try {
      await axios.delete(`${API}/developer/keys/${keyId}`, { headers });
      toast({ title: 'Key Revoked' });
      fetchKeys();
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke key', variant: 'destructive' });
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      toast({ title: 'URL Required', variant: 'destructive' });
      return;
    }
    if (newWebhookEvents.length === 0) {
      toast({ title: 'Select at least one event', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/developer/webhooks`, {
        url: newWebhookUrl, events: newWebhookEvents, description: newWebhookDesc
      }, { headers });
      setCreatedWebhook(res.data);
      setNewWebhookUrl('');
      setNewWebhookDesc('');
      fetchWebhooks();
      toast({ title: 'Webhook Created' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleDeleteWebhook = async (id) => {
    try {
      await axios.delete(`${API}/developer/webhooks/${id}`, { headers });
      toast({ title: 'Webhook Deleted' });
      setExpandedWebhook(null);
      setWebhookDetails(null);
      fetchWebhooks();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleTestWebhook = async (id) => {
    try {
      await axios.post(`${API}/developer/webhooks/${id}/test`, {}, { headers });
      toast({ title: 'Test Event Sent', description: 'Check deliveries for the result' });
      setTimeout(() => fetchWebhookDetails(id), 2000);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleToggleWebhook = async (id) => {
    try {
      const res = await axios.post(`${API}/developer/webhooks/${id}/toggle`, {}, { headers });
      toast({ title: res.data.active ? 'Webhook Enabled' : 'Webhook Disabled' });
      fetchWebhooks();
      if (webhookDetails?.id === id) fetchWebhookDetails(id);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const toggleWebhookEvent = (evt) => {
    setNewWebhookEvents(prev =>
      prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  const endpoints = [
    {
      method: 'GET', path: '/api/v1/status', scope: null, rateLimit: 'None',
      desc: 'Check API status. No authentication required.',
      example: `curl ${BASE_URL}/api/v1/status`,
      response: `{ "status": "operational", "version": "1.0.0" }`,
    },
    {
      method: 'POST', path: '/api/v1/seal', scope: 'seal', rateLimit: '30/min',
      desc: 'Seal a document hash on the Hedera blockchain. Creates an immutable timestamp proof.',
      example: `curl -X POST ${BASE_URL}/api/v1/seal \\
  -H "X-API-Key: nc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"document_name": "contract.pdf", "document_hash": "sha256..."}'`,
      response: `{
  "seal_id": "uuid",
  "document_hash": "sha256...",
  "blockchain": {
    "network": "hedera_testnet",
    "topic_id": "0.0.xxxxx",
    "sequence_number": 1
  },
  "sealed_at": "2026-02-25T..."
}`,
    },
    {
      method: 'POST', path: '/api/v1/verify', scope: 'verify', rateLimit: '60/min',
      desc: 'Verify if a document hash has been sealed on the blockchain.',
      example: `curl -X POST ${BASE_URL}/api/v1/verify \\
  -H "X-API-Key: nc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"document_hash": "sha256..."}'`,
      response: `{ "verified": true, "seal_id": "uuid", "sealed_at": "..." }`,
    },
    {
      method: 'GET', path: '/api/v1/seals', scope: 'read', rateLimit: '60/min',
      desc: 'List all document seals. Supports pagination with ?limit=20&skip=0.',
      example: `curl ${BASE_URL}/api/v1/seals?limit=10 \\
  -H "X-API-Key: nc_live_..."`,
      response: `{ "seals": [...], "total": 42 }`,
    },
    {
      method: 'GET', path: '/api/v1/seals/{seal_id}', scope: 'read', rateLimit: '60/min',
      desc: 'Get details of a specific seal by ID.',
      example: `curl ${BASE_URL}/api/v1/seals/uuid \\
  -H "X-API-Key: nc_live_..."`,
      response: `{ "id": "uuid", "document_name": "...", "sha256_hash": "..." }`,
    },
    {
      method: 'GET', path: '/api/v1/requests', scope: 'read', rateLimit: '30/min',
      desc: 'List notarization requests. Filter by ?status=pending|assigned|completed.',
      example: `curl ${BASE_URL}/api/v1/requests?status=completed \\
  -H "X-API-Key: nc_live_..."`,
      response: `{ "requests": [...], "total": 5 }`,
    },
  ];

  const methodColors = { GET: 'bg-coral-500', POST: 'bg-blue-500', DELETE: 'bg-red-500' };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-navy-900">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <h1 className="text-navy-900 font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Code className="w-5 h-5 text-coral-600" /> Developer Portal
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex gap-1 bg-white rounded-lg p-1 w-fit" data-testid="developer-tabs">
          {[
            { id: 'docs', label: 'API Reference', icon: Code },
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'webhooks', label: 'Webhooks', icon: Zap },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-coral-500 text-black' : 'text-slate-500 hover:text-navy-900'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'docs' && (
          <div className="space-y-6">
            {/* Intro */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <h2 className="text-navy-900 text-xl font-semibold mb-2">NotaryChain Public API</h2>
                <p className="text-slate-500 text-sm mb-4">
                  Integrate blockchain-powered document notarization into your applications.
                  All API requests require an <code className="bg-cream-100 px-2 py-0.5 rounded text-coral-600 text-xs">X-API-Key</code> header.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: Shield, title: 'Authentication', desc: 'API Key via X-API-Key header' },
                    { icon: Zap, title: 'Rate Limits', desc: '30-60 requests/min per endpoint' },
                    { icon: Activity, title: 'Base URL', desc: BASE_URL + '/api/v1' },
                  ].map(item => (
                    <div key={item.title} className="bg-cream-100 rounded-lg p-3 flex items-start gap-3">
                      <item.icon className="w-5 h-5 text-coral-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-navy-900 text-sm font-medium">{item.title}</p>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Start */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <h3 className="text-navy-900 font-semibold mb-3">Quick Start</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-coral-500 rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">1</span>
                    <p className="text-slate-500 text-sm">Go to <button onClick={() => setActiveTab('keys')} className="text-coral-600 underline">API Keys</button> and generate a new key</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-coral-500 rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">2</span>
                    <p className="text-slate-500 text-sm">Add the <code className="bg-cream-100 px-1.5 py-0.5 rounded text-coral-600 text-xs">X-API-Key</code> header to your requests</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-coral-500 rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">3</span>
                    <p className="text-slate-500 text-sm">Start sealing and verifying documents via the API</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            <div className="space-y-3" data-testid="endpoint-list">
              {endpoints.map((ep, idx) => {
                const expanded = expandedEndpoint === idx;
                return (
                  <Card key={idx} className="bg-white border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedEndpoint(expanded ? null : idx)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
                      data-testid={`endpoint-${ep.method}-${ep.path.replace(/[/{}]/g, '-')}`}
                    >
                      <Badge className={`${methodColors[ep.method]} text-navy-900 text-[10px] font-mono px-2`}>{ep.method}</Badge>
                      <code className="text-slate-500 text-sm font-mono flex-1 text-left">{ep.path}</code>
                      {ep.scope && <Badge className="bg-gray-700 text-slate-500 text-[10px]">{ep.scope}</Badge>}
                      {ep.rateLimit !== 'None' && <span className="text-slate-500 text-xs hidden sm:block">{ep.rateLimit}</span>}
                      {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-200 p-4 space-y-4">
                        <p className="text-slate-500 text-sm">{ep.desc}</p>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-500 text-xs">Example Request</span>
                            <button onClick={() => copyToClipboard(ep.example)} className="text-slate-500 hover:text-navy-900"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                          <pre className="bg-cream-100 rounded-lg p-3 text-xs text-slate-500 overflow-x-auto font-mono">{ep.example}</pre>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs">Example Response</span>
                          <pre className="bg-cream-100 rounded-lg p-3 text-xs text-coral-600 overflow-x-auto font-mono mt-1">{ep.response}</pre>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-6">
            {/* Create Key */}
            <Card className="bg-white border-slate-200" data-testid="create-key-card">
              <CardContent className="p-6">
                <h2 className="text-navy-900 font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-coral-600" /> Create API Key
                </h2>
                <div className="flex gap-3">
                  <Input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g., Production, Development)"
                    className="bg-cream-100 border-slate-200 text-navy-900 flex-1"
                    data-testid="key-name-input"
                  />
                  <Button onClick={handleCreateKey} disabled={loading} className="bg-coral-500 hover:bg-coral-600 text-black" data-testid="create-key-btn">
                    <Plus className="w-4 h-4 mr-1" /> Create
                  </Button>
                </div>

                {createdKey && (
                  <div className="mt-4 bg-coral-500/10 border border-coral-200 rounded-lg p-4" data-testid="new-key-display">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-coral-600" />
                      <p className="text-coral-700 text-sm font-medium">Key created! Store it securely — it won't be shown again.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-cream-100 rounded-lg px-3 py-2">
                      <code className="text-coral-600 text-sm font-mono flex-1 break-all">
                        {showKey ? createdKey.key : '•'.repeat(40)}
                      </code>
                      <button onClick={() => setShowKey(!showKey)} className="text-slate-500 hover:text-navy-900">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => copyToClipboard(createdKey.key)} className="text-slate-500 hover:text-navy-900" data-testid="copy-key-btn">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            {usage && (
              <Card className="bg-white border-slate-200" data-testid="usage-stats">
                <CardContent className="p-6">
                  <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" /> API Usage
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-cream-100 rounded-lg p-4">
                      <p className="text-2xl text-navy-900 font-bold">{usage.total_calls}</p>
                      <p className="text-slate-500 text-xs">Total API Calls</p>
                    </div>
                    <div className="bg-cream-100 rounded-lg p-4">
                      <p className="text-2xl text-navy-900 font-bold">{usage.active_keys}</p>
                      <p className="text-slate-500 text-xs">Active Keys</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Keys List */}
            <Card className="bg-white border-slate-200" data-testid="keys-list">
              <CardContent className="p-6">
                <h3 className="text-navy-900 font-semibold mb-4">Your API Keys</h3>
                {keys.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No API keys yet. Create one above.</p>
                ) : (
                  <div className="space-y-3">
                    {keys.map(k => (
                      <div key={k.id} className={`bg-cream-100 rounded-lg p-4 border ${k.revoked ? 'border-red-500/20 opacity-60' : 'border-slate-200'}`} data-testid={`key-row-${k.id}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="text-navy-900 font-medium text-sm flex items-center gap-2">
                              <Key className="w-4 h-4 text-coral-600" /> {k.name}
                              {k.revoked && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Revoked</Badge>}
                            </div>
                            <p className="text-slate-500 text-xs mt-1 font-mono">{k.key_prefix}••••••••••</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {k.usage_count > 0 && <span>{k.usage_count} calls</span>}
                            {k.last_used_at && <span>Last used: {new Date(k.last_used_at).toLocaleDateString()}</span>}
                            <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                            {!k.revoked && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevoke(k.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7"
                                data-testid={`revoke-key-${k.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {!k.revoked && k.scopes && (
                          <div className="flex gap-1.5 mt-2">
                            {k.scopes.map(s => (
                              <Badge key={s} className="bg-gray-800 text-slate-500 text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            {/* Create Webhook */}
            <Card className="bg-white border-slate-200" data-testid="create-webhook-card">
              <CardContent className="p-6">
                <h2 className="text-navy-900 font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-coral-600" /> Register Webhook
                </h2>
                <div className="space-y-3">
                  <Input
                    value={newWebhookUrl}
                    onChange={e => setNewWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/webhooks/notarychain"
                    className="bg-cream-100 border-slate-200 text-navy-900"
                    data-testid="webhook-url-input"
                  />
                  <Input
                    value={newWebhookDesc}
                    onChange={e => setNewWebhookDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="bg-cream-100 border-slate-200 text-navy-900"
                  />
                  <div>
                    <p className="text-slate-500 text-xs mb-2">Events to subscribe:</p>
                    <div className="flex flex-wrap gap-2">
                      {['seal.created', 'document.verified', 'request.completed', 'request.assigned', 'request.created'].map(evt => (
                        <button
                          key={evt}
                          onClick={() => toggleWebhookEvent(evt)}
                          className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                            newWebhookEvents.includes(evt)
                              ? 'bg-coral-500/20 text-coral-600 border border-coral-500/30'
                              : 'bg-cream-100 text-slate-500 border border-slate-200'
                          }`}
                          data-testid={`event-toggle-${evt}`}
                        >
                          {evt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreateWebhook} disabled={loading} className="bg-coral-500 hover:bg-coral-600 text-black" data-testid="create-webhook-btn">
                    <Plus className="w-4 h-4 mr-1" /> Register Webhook
                  </Button>
                </div>

                {createdWebhook && (
                  <div className="mt-4 bg-coral-500/10 border border-coral-200 rounded-lg p-4" data-testid="new-webhook-secret">
                    <p className="text-coral-700 text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Webhook created! Store the signing secret:
                    </p>
                    <div className="flex items-center gap-2 bg-cream-100 rounded-lg px-3 py-2">
                      <code className="text-coral-600 text-xs font-mono flex-1 break-all">{createdWebhook.secret}</code>
                      <button onClick={() => copyToClipboard(createdWebhook.secret)} className="text-slate-500 hover:text-navy-900">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-slate-500 text-xs mt-2">Use this secret to verify webhook signatures via HMAC-SHA256.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhooks List */}
            <Card className="bg-white border-slate-200" data-testid="webhooks-list">
              <CardContent className="p-6">
                <h3 className="text-navy-900 font-semibold mb-4">Your Webhooks ({webhooks.length})</h3>
                {webhooks.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No webhooks registered yet.</p>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map(wh => (
                      <div key={wh.id} className={`bg-cream-100 rounded-lg border ${wh.active ? 'border-slate-200' : 'border-red-500/20 opacity-60'}`} data-testid={`webhook-row-${wh.id}`}>
                        <button
                          onClick={() => { setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id); if (expandedWebhook !== wh.id) fetchWebhookDetails(wh.id); }}
                          className="w-full p-4 text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <Zap className={`w-4 h-4 flex-shrink-0 ${wh.active ? 'text-coral-600' : 'text-red-400'}`} />
                              <div className="min-w-0">
                                <p className="text-navy-900 text-sm truncate">{wh.url}</p>
                                <p className="text-slate-500 text-xs">{wh.events?.join(', ')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!wh.active && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Disabled</Badge>}
                              {wh.disabled_reason === '10 consecutive failures' && <Badge className="bg-coral-500/20 text-coral-600 text-[10px]">Auto-disabled</Badge>}
                              {expandedWebhook === wh.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </div>
                          </div>
                        </button>

                        {expandedWebhook === wh.id && webhookDetails && (
                          <div className="px-4 pb-4 border-t border-slate-200 space-y-4">
                            {/* Actions */}
                            <div className="flex gap-2 pt-3">
                              <Button size="sm" onClick={() => handleTestWebhook(wh.id)} className="bg-blue-600 hover:bg-blue-700 text-navy-900 text-xs h-7" data-testid={`test-webhook-${wh.id}`}>
                                <Send className="w-3 h-3 mr-1" /> Test
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleToggleWebhook(wh.id)} className="border-slate-200 text-slate-500 text-xs h-7" data-testid={`toggle-webhook-${wh.id}`}>
                                {wh.active ? <ToggleRight className="w-3 h-3 mr-1" /> : <ToggleLeft className="w-3 h-3 mr-1" />}
                                {wh.active ? 'Disable' : 'Enable'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteWebhook(wh.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 ml-auto" data-testid={`delete-webhook-${wh.id}`}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>

                            {/* Stats */}
                            {webhookDetails.stats && (
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: 'Total', value: webhookDetails.stats.total_deliveries },
                                  { label: 'Success', value: webhookDetails.stats.successful, color: 'text-coral-600' },
                                  { label: 'Failed', value: webhookDetails.stats.failed, color: 'text-red-400' },
                                  { label: 'Rate', value: `${webhookDetails.stats.success_rate}%`, color: 'text-coral-600' },
                                ].map(s => (
                                  <div key={s.label} className="bg-white rounded p-2 text-center">
                                    <p className={`text-lg font-bold ${s.color || 'text-navy-900'}`}>{s.value}</p>
                                    <p className="text-slate-500 text-[10px]">{s.label}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Recent Deliveries */}
                            <div>
                              <p className="text-slate-500 text-xs mb-2">Recent Deliveries</p>
                              {webhookDetails.deliveries?.length === 0 ? (
                                <p className="text-slate-600 text-xs">No deliveries yet</p>
                              ) : (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {webhookDetails.deliveries?.map(d => (
                                    <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-slate-200 last:border-0 text-xs">
                                      {d.success ? <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                      <span className="text-slate-500 font-mono">{d.event}</span>
                                      <span className={`${d.success ? 'text-coral-600' : 'text-red-400'}`}>{d.status_code || 'err'}</span>
                                      <span className="text-slate-500">#{d.attempt}</span>
                                      <span className="text-slate-600 ml-auto">{new Date(d.timestamp).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Verification Guide */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" /> Verifying Webhook Signatures
                </h3>
                <p className="text-slate-500 text-sm mb-3">Each webhook delivery includes an <code className="bg-cream-100 px-1.5 py-0.5 rounded text-coral-600 text-xs">X-Webhook-Signature</code> header with an HMAC-SHA256 signature.</p>
                <pre className="bg-cream-100 rounded-lg p-4 text-xs text-slate-500 overflow-x-auto font-mono">{`import hmac, hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)`}</pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperPage;
