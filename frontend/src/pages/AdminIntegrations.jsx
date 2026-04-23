import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, CheckCircle, AlertCircle, Mail, Users, RefreshCw, Send, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminIntegrations() {
  const navigate = useNavigate();
  const [ghlStatus, setGhlStatus] = useState(null);
  const [ghlPipelines, setGhlPipelines] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailDomain, setEmailDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Manual Test');
  const [testRole, setTestRole] = useState('user');
  const [testTier, setTestTier] = useState('starter');
  const [testing, setTesting] = useState(false);

  const token = localStorage.getItem('notarychain_token') || localStorage.getItem('token');

  const authedFetch = async (path, opts = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 403) {
      toast.error('Admin access required');
      navigate('/dashboard');
      return null;
    }
    return res;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [gStatus, gPipes, eStatus, eDomain] = await Promise.all([
        authedFetch('/api/ghl/status'),
        authedFetch('/api/ghl/pipelines'),
        authedFetch('/api/email/status'),
        authedFetch('/api/email/domain-status'),
      ]);
      if (gStatus?.ok) setGhlStatus(await gStatus.json());
      if (gPipes?.ok) setGhlPipelines((await gPipes.json()).pipelines || []);
      if (eStatus?.ok) setEmailStatus(await eStatus.json());
      if (eDomain?.ok) setEmailDomain(await eDomain.json());
    } catch (e) {
      toast.error(`Failed to load integrations: ${e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const handleTestContact = async () => {
    if (!testEmail) { toast.error('Enter an email'); return; }
    setTesting(true);
    try {
      const res = await authedFetch('/api/ghl/test/contact', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail, full_name: testName, role: testRole, subscription_tier: testTier }),
      });
      if (res?.ok) {
        const data = await res.json();
        toast.success(`Contact created in GHL — ID ${data.contact_id}`);
      } else {
        const data = await res?.json().catch(() => ({}));
        toast.error(`Failed: ${data.detail || res?.statusText}`);
      }
    } catch (e) {
      toast.error(e.message);
    }
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6" data-testid="admin-integrations-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sky-400 text-xs uppercase tracking-[0.2em] mb-1">Admin</p>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Link2 className="w-7 h-7 text-sky-400" /> Integrations
            </h1>
            <p className="text-slate-400 text-sm mt-1">CRM, email, and third-party sync status.</p>
          </div>
          <Button onClick={loadAll} variant="outline" size="sm" data-testid="refresh-integrations-btn" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {loading && !ghlStatus && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* GoHighLevel Card */}
          <Card className="bg-slate-900/60 border-slate-800" data-testid="ghl-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" /> GoHighLevel CRM
                </CardTitle>
                {ghlStatus?.connected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                ) : ghlStatus?.configured ? (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                    <AlertCircle className="w-3 h-3 mr-1" /> Error
                  </Badge>
                ) : (
                  <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/30">Not configured</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ghlStatus && (
                <>
                  <KV label="Location" value={ghlStatus.location_name || '—'} />
                  <KV label="Location ID" value={ghlStatus.location_id} mono />
                  <KV label="Pipeline" value={ghlPipelines.find(p => p.id === ghlStatus.pipeline_id)?.name || ghlStatus.pipeline_id} />
                  <KV label="Token" value={ghlStatus.token_prefix} mono />
                  {ghlStatus.error && <p className="text-red-400 text-xs">{ghlStatus.error}</p>}
                </>
              )}

              {ghlPipelines.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Pipelines ({ghlPipelines.length})</p>
                  <div className="space-y-1">
                    {ghlPipelines.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs" data-testid={`pipeline-${p.id}`}>
                        <span className={p.id === ghlStatus?.pipeline_id ? 'text-sky-400 font-semibold' : 'text-slate-300'}>
                          {p.id === ghlStatus?.pipeline_id ? '★ ' : ''}{p.name}
                        </span>
                        <span className="text-slate-600">{p.stages.length} stages</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test contact */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider">Test Sync</p>
                <Input placeholder="email@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                       className="bg-slate-800/60 border-slate-700 h-9 text-xs" data-testid="ghl-test-email-input" />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Name" value={testName} onChange={e => setTestName(e.target.value)}
                         className="bg-slate-800/60 border-slate-700 h-9 text-xs" data-testid="ghl-test-name-input" />
                  <select value={testRole} onChange={e => setTestRole(e.target.value)}
                          className="bg-slate-800/60 border border-slate-700 rounded-md h-9 text-xs px-2" data-testid="ghl-test-role-select">
                    <option value="user">User</option>
                    <option value="notary">Notary</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select value={testTier} onChange={e => setTestTier(e.target.value)}
                          className="bg-slate-800/60 border border-slate-700 rounded-md h-9 text-xs px-2" data-testid="ghl-test-tier-select">
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <Button onClick={handleTestContact} disabled={testing || !ghlStatus?.connected}
                        className="w-full h-9 bg-sky-600 hover:bg-sky-500 text-xs" data-testid="ghl-test-contact-btn">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                  Push Test Contact to GHL
                </Button>
                <p className="text-[10px] text-slate-500">Creates contact + tags + pipeline opportunity + note.</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card className="bg-slate-900/60 border-slate-800" data-testid="email-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-400" /> Email (Resend)
                </CardTitle>
                {emailStatus?.mode === 'custom_domain' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" /> Custom domain live
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Sandbox</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {emailStatus && (
                <>
                  <KV label="Mode" value={emailStatus.mode} />
                  <KV label="Sender" value={emailStatus.active_sender} mono />
                  <KV label="Domain" value={emailStatus.custom_domain || '—'} />
                </>
              )}
              {emailDomain && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <p className="text-slate-500 text-xs uppercase tracking-wider">Resend Domain</p>
                  <KV label="Status" value={
                    <span className={emailDomain.verified ? 'text-emerald-400' : 'text-amber-400'}>
                      {emailDomain.status}
                    </span>
                  } />
                  {emailDomain.region && <KV label="Region" value={emailDomain.region} mono />}
                  {emailDomain.created_at && <KV label="Created" value={new Date(emailDomain.created_at).toLocaleDateString()} />}
                </div>
              )}
              <div className="pt-3 border-t border-slate-800">
                <a href="https://resend.com/domains" target="_blank" rel="noreferrer"
                   className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1" data-testid="resend-dashboard-link">
                  Open Resend Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Sync Matrix */}
        <Card className="mt-5 bg-slate-900/60 border-slate-800">
          <CardHeader><CardTitle className="text-base">Active Sync Hooks</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                ['User Signup', 'Upsert contact + tag + pipeline opportunity + note', 'auth_routes.signup'],
                ['Ceremony Sealed', 'Add note to contact with request_id + seal hash', 'ceremony_routes'],
                ['Escrow Settled', 'Add note to buyer, seller, creator with amount + hash', 'escrow_routes.settle_escrow'],
                ['HTS Token Minted', 'Add note to creator with token_id + purpose', 'hts_routes.mint'],
                ['Subscription Upgraded', 'Move opportunity to Contract Signed + note', 'subscription_routes.checkout'],
              ].map(([event, desc, origin]) => (
                <div key={event} className="flex items-center gap-3 bg-slate-800/40 rounded-md p-2.5 border border-slate-700/40" data-testid={`sync-hook-${event.toLowerCase().replace(/ /g, '-')}`}>
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{event}</p>
                    <p className="text-slate-500">{desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono hidden md:inline">{origin}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KV({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
      <span className={`text-slate-200 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</span>
    </div>
  );
}
