import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Code, Plus, Trash2, Copy, Globe, Palette, Eye, EyeOff,
  Loader2, CheckCircle, Settings, ExternalLink,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WhiteLabelPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  // Create form state
  const [formName, setFormName] = useState('');
  const [formOrigins, setFormOrigins] = useState('');
  const [formColor, setFormColor] = useState('#00d4aa');
  const [formCompany, setFormCompany] = useState('');
  const [formBranding, setFormBranding] = useState(true);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/embed/configs`, { headers });
      setConfigs(res.data.configs || []);
    } catch (e) {
      console.error('Failed to load embed configs:', e);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/embed/configs`, {
        name: formName,
        allowed_origins: formOrigins.split(',').map(s => s.trim()).filter(Boolean),
        primary_color: formColor,
        company_name: formCompany || undefined,
        show_branding: formBranding,
      }, { headers });
      toast({ title: 'Created', description: 'Embed configuration created' });
      setShowCreate(false);
      setFormName(''); setFormOrigins(''); setFormCompany('');
      fetchConfigs();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
    setCreating(false);
  };

  const copySnippet = (snippet) => {
    navigator.clipboard.writeText(snippet);
    toast({ title: 'Copied', description: 'Embed snippet copied to clipboard' });
  };

  const deleteConfig = async (id) => {
    try {
      await axios.delete(`${API}/embed/configs/${id}`, { headers });
      toast({ title: 'Deleted' });
      setSelectedConfig(null);
      fetchConfigs();
    } catch (e) {
      console.error('Failed to delete embed config:', e);
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to delete', variant: 'destructive' });
    }
  };

  const toggleActive = async (config) => {
    try {
      await axios.put(`${API}/embed/configs/${config.id}`, {
        active: !config.active,
      }, { headers });
      fetchConfigs();
      toast({ title: config.active ? 'Disabled' : 'Enabled' });
    } catch (e) {
      console.error('Failed to toggle embed config:', e);
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'White-Label Embed' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Code className="w-7 h-7 text-coral-600" />
                White-Label Embed
              </h1>
              <p className="text-slate-500 text-sm mt-1">Embed NotaryChain notarization in your own website</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-emerald-700" data-testid="create-embed-btn">
                <Plus className="w-4 h-4 mr-1" /> New Config
              </Button>
            </div>
          </div>

          {showCreate && (
            <Card className="bg-white border-slate-200 mb-6" data-testid="embed-create-form">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-4">Create Embed Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">Configuration Name *</label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., My Law Firm Widget" className="bg-cream-100 border-slate-200 text-navy-900" data-testid="embed-name-input" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">Allowed Origins (comma-separated)</label>
                    <Input value={formOrigins} onChange={e => setFormOrigins(e.target.value)} placeholder="https://mysite.com, https://app.mysite.com" className="bg-cream-100 border-slate-200 text-navy-900" data-testid="embed-origins-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-500 block mb-1">Company Name</label>
                      <Input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="Your Company" className="bg-cream-100 border-slate-200 text-navy-900" data-testid="embed-company-input" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-500 block mb-1">Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent" data-testid="embed-color-input" />
                        <Input value={formColor} onChange={e => setFormColor(e.target.value)} className="bg-cream-100 border-slate-200 text-navy-900 flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={formBranding} onChange={e => setFormBranding(e.target.checked)} className="rounded" data-testid="embed-branding-checkbox" />
                    <label className="text-sm text-slate-500">Show "Powered by NotaryChain" branding</label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={creating} className="bg-coral-500 hover:bg-emerald-700" data-testid="embed-create-submit">
                      {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                      Create
                    </Button>
                    <Button onClick={() => setShowCreate(false)} variant="ghost" className="text-slate-500">Cancel</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" /></div>
          ) : configs.length === 0 && !showCreate ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-12 text-center">
                <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No embed configurations yet. Create one to get started.</p>
                <Button onClick={() => setShowCreate(true)} className="bg-coral-500 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Create Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" data-testid="embed-config-list">
              {configs.map(config => (
                <Card key={config.id} className="bg-white border-slate-200" data-testid={`embed-config-${config.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.primary_color }} />
                        <div>
                          <h3 className="text-navy-900 font-semibold">{config.name}</h3>
                          <p className="text-slate-500 text-xs">{config.company_name} &middot; Key: {config.embed_key}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => toggleActive(config)} size="sm" variant="outline" className={config.active ? 'border-green-500/50 text-green-400' : 'border-slate-200 text-slate-500'} data-testid={`toggle-embed-${config.id}`}>
                          {config.active ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                          {config.active ? 'Active' : 'Disabled'}
                        </Button>
                        <Button onClick={() => deleteConfig(config.id)} size="sm" variant="outline" className="border-red-500/50 text-red-400" data-testid={`delete-embed-${config.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {(config.allowed_origins || []).map(o => (
                        <span key={o} className="px-2 py-0.5 bg-coral-500/10 text-coral-500 text-xs rounded border border-coral-300/20 flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" /> {o}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 bg-gray-700/50 text-slate-500 text-xs rounded">
                        {config.usage_count} embed loads
                      </span>
                    </div>

                    {/* Embed snippet */}
                    <div className="bg-cream-100 rounded-lg p-3 border border-slate-200 relative">
                      <pre className="text-xs text-slate-500 overflow-x-auto whitespace-pre-wrap">
                        {config.embed_snippet}
                      </pre>
                      <Button onClick={() => copySnippet(config.embed_snippet)} size="sm" className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 h-7 px-2" data-testid={`copy-snippet-${config.id}`}>
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WhiteLabelPage;
