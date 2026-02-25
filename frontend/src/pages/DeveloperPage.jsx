import React, { useState, useEffect, useCallback } from 'react';
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
  const headers = { Authorization: `Bearer ${token}` };

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
  }, [token]);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/developer/usage`, { headers });
      setUsage(res.data);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token && activeTab === 'keys') { fetchKeys(); fetchUsage(); }
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

  const methodColors = { GET: 'bg-emerald-500', POST: 'bg-blue-500', DELETE: 'bg-red-500' };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <h1 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Code className="w-5 h-5 text-[#00d4aa]" /> Developer Portal
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex gap-1 bg-[#1a2332] rounded-lg p-1 w-fit" data-testid="developer-tabs">
          {[
            { id: 'docs', label: 'API Reference', icon: Code },
            { id: 'keys', label: 'API Keys', icon: Key },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-[#00d4aa] text-black' : 'text-gray-400 hover:text-white'
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
            <Card className="bg-[#1a2332] border-gray-800">
              <CardContent className="p-6">
                <h2 className="text-white text-xl font-semibold mb-2">NotaryChain Public API</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Integrate blockchain-powered document notarization into your applications.
                  All API requests require an <code className="bg-[#0d1b2a] px-2 py-0.5 rounded text-[#00d4aa] text-xs">X-API-Key</code> header.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: Shield, title: 'Authentication', desc: 'API Key via X-API-Key header' },
                    { icon: Zap, title: 'Rate Limits', desc: '30-60 requests/min per endpoint' },
                    { icon: Activity, title: 'Base URL', desc: BASE_URL + '/api/v1' },
                  ].map(item => (
                    <div key={item.title} className="bg-[#0d1b2a] rounded-lg p-3 flex items-start gap-3">
                      <item.icon className="w-5 h-5 text-[#00d4aa] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium">{item.title}</p>
                        <p className="text-gray-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Start */}
            <Card className="bg-[#1a2332] border-gray-800">
              <CardContent className="p-6">
                <h3 className="text-white font-semibold mb-3">Quick Start</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00d4aa] rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">1</span>
                    <p className="text-gray-300 text-sm">Go to <button onClick={() => setActiveTab('keys')} className="text-[#00d4aa] underline">API Keys</button> and generate a new key</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00d4aa] rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">2</span>
                    <p className="text-gray-300 text-sm">Add the <code className="bg-[#0d1b2a] px-1.5 py-0.5 rounded text-[#00d4aa] text-xs">X-API-Key</code> header to your requests</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#00d4aa] rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0">3</span>
                    <p className="text-gray-300 text-sm">Start sealing and verifying documents via the API</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            <div className="space-y-3" data-testid="endpoint-list">
              {endpoints.map((ep, idx) => {
                const expanded = expandedEndpoint === idx;
                return (
                  <Card key={idx} className="bg-[#1a2332] border-gray-800 overflow-hidden">
                    <button
                      onClick={() => setExpandedEndpoint(expanded ? null : idx)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
                      data-testid={`endpoint-${ep.method}-${ep.path.replace(/[/{}]/g, '-')}`}
                    >
                      <Badge className={`${methodColors[ep.method]} text-white text-[10px] font-mono px-2`}>{ep.method}</Badge>
                      <code className="text-gray-200 text-sm font-mono flex-1 text-left">{ep.path}</code>
                      {ep.scope && <Badge className="bg-gray-700 text-gray-300 text-[10px]">{ep.scope}</Badge>}
                      {ep.rateLimit !== 'None' && <span className="text-gray-500 text-xs hidden sm:block">{ep.rateLimit}</span>}
                      {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-gray-800 p-4 space-y-4">
                        <p className="text-gray-400 text-sm">{ep.desc}</p>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500 text-xs">Example Request</span>
                            <button onClick={() => copyToClipboard(ep.example)} className="text-gray-500 hover:text-white"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                          <pre className="bg-[#0d1b2a] rounded-lg p-3 text-xs text-gray-300 overflow-x-auto font-mono">{ep.example}</pre>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Example Response</span>
                          <pre className="bg-[#0d1b2a] rounded-lg p-3 text-xs text-[#00d4aa] overflow-x-auto font-mono mt-1">{ep.response}</pre>
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
            <Card className="bg-[#1a2332] border-gray-800" data-testid="create-key-card">
              <CardContent className="p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00d4aa]" /> Create API Key
                </h2>
                <div className="flex gap-3">
                  <Input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g., Production, Development)"
                    className="bg-[#0d1b2a] border-gray-700 text-white flex-1"
                    data-testid="key-name-input"
                  />
                  <Button onClick={handleCreateKey} disabled={loading} className="bg-[#00d4aa] hover:bg-[#00b894] text-black" data-testid="create-key-btn">
                    <Plus className="w-4 h-4 mr-1" /> Create
                  </Button>
                </div>

                {createdKey && (
                  <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4" data-testid="new-key-display">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <p className="text-emerald-300 text-sm font-medium">Key created! Store it securely — it won't be shown again.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0d1b2a] rounded-lg px-3 py-2">
                      <code className="text-[#00d4aa] text-sm font-mono flex-1 break-all">
                        {showKey ? createdKey.key : '•'.repeat(40)}
                      </code>
                      <button onClick={() => setShowKey(!showKey)} className="text-gray-400 hover:text-white">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => copyToClipboard(createdKey.key)} className="text-gray-400 hover:text-white" data-testid="copy-key-btn">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            {usage && (
              <Card className="bg-[#1a2332] border-gray-800" data-testid="usage-stats">
                <CardContent className="p-6">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" /> API Usage
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0d1b2a] rounded-lg p-4">
                      <p className="text-2xl text-white font-bold">{usage.total_calls}</p>
                      <p className="text-gray-500 text-xs">Total API Calls</p>
                    </div>
                    <div className="bg-[#0d1b2a] rounded-lg p-4">
                      <p className="text-2xl text-white font-bold">{usage.active_keys}</p>
                      <p className="text-gray-500 text-xs">Active Keys</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Keys List */}
            <Card className="bg-[#1a2332] border-gray-800" data-testid="keys-list">
              <CardContent className="p-6">
                <h3 className="text-white font-semibold mb-4">Your API Keys</h3>
                {keys.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No API keys yet. Create one above.</p>
                ) : (
                  <div className="space-y-3">
                    {keys.map(k => (
                      <div key={k.id} className={`bg-[#0d1b2a] rounded-lg p-4 border ${k.revoked ? 'border-red-500/20 opacity-60' : 'border-gray-700'}`} data-testid={`key-row-${k.id}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="text-white font-medium text-sm flex items-center gap-2">
                              <Key className="w-4 h-4 text-[#00d4aa]" /> {k.name}
                              {k.revoked && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Revoked</Badge>}
                            </div>
                            <p className="text-gray-500 text-xs mt-1 font-mono">{k.key_prefix}••••••••••</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
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
                              <Badge key={s} className="bg-gray-800 text-gray-400 text-[10px]">{s}</Badge>
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
      </div>
    </div>
  );
};

export default DeveloperPage;
