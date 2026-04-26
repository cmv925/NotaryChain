import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Plus, Loader2, Copy, Trash2, ExternalLink, CheckCircle, AlertTriangle, X, Code } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TrustBadges() {
  const navigate = useNavigate();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEmbed, setShowEmbed] = useState(null);
  const [showVerify, setShowVerify] = useState(null);
  const token = localStorage.getItem('token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/verify/badges`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { navigate('/login'); return; }
      const d = await res.json();
      setBadges(d.badges || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, [token, navigate]);

  useEffect(() => { load(); }, [load]);

  const create = async (form) => {
    try {
      const res = await fetch(`${API}/api/verify/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.status === 403) {
        const d = await res.json();
        if (d?.detail?.error === 'upgrade_required') {
          toast.error(`Upgrade to ${d.detail.required_plan_name} ($${d.detail.required_plan_price}/mo) to create Trust Badges`);
        } else {
          toast.error(d?.detail || 'Forbidden');
        }
        return;
      }
      if (!res.ok) {
        toast.error('Failed to create badge');
        return;
      }
      toast.success('Trust Badge created');
      setShowCreate(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (badge_id) => {
    if (!confirm('Delete this Trust Badge?')) return;
    try {
      await fetch(`${API}/api/verify/badges/${badge_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      toast.success('Badge deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading && badges.length === 0) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6" data-testid="trust-badges-page">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-amber-400 text-xs uppercase tracking-[0.2em] mb-1">Revenue Stream</p>
            <h1 className="text-3xl font-bold flex items-center gap-3"><Award className="w-7 h-7 text-amber-400" /> Trust Badges</h1>
            <p className="text-slate-400 text-sm mt-1">Embed a "Verified by NotaryChain" badge on your website. Drives trust, lifts conversions.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-500" data-testid="create-badge-btn">
            <Plus className="w-4 h-4 mr-2" /> New Trust Badge
          </Button>
        </div>

        {badges.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badges.map(b => (
              <BadgeCard key={b.badge_id} badge={b}
                onShowEmbed={() => setShowEmbed(b)}
                onShowVerify={() => setShowVerify(b)}
                onDelete={() => remove(b.badge_id)} />
            ))}
          </div>
        )}

        {showCreate && <CreateBadgeModal onClose={() => setShowCreate(false)} onCreate={create} />}
        {showEmbed && <EmbedModal badge={showEmbed} onClose={() => setShowEmbed(null)} />}
        {showVerify && <VerifyDomainModal badge={showVerify} onClose={() => { setShowVerify(null); load(); }} token={token} />}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <Card className="bg-gradient-to-br from-amber-950/40 to-slate-900/60 border-amber-800/40 text-center py-12 px-6" data-testid="badges-empty-state">
      <Award className="w-16 h-16 mx-auto text-amber-400 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Create Your First Trust Badge</h2>
      <p className="text-slate-400 max-w-xl mx-auto mb-6">
        Show visitors your business is verified. Drop a one-line `&lt;script&gt;` tag on your site, and a NotaryChain trust badge appears — links to a public verification page sealed on Hedera.
      </p>
      <Button onClick={onCreate} size="lg" className="bg-amber-600 hover:bg-amber-500" data-testid="empty-create-btn">
        <Plus className="w-4 h-4 mr-2" /> Create Trust Badge
      </Button>
    </Card>
  );
}

function BadgeCard({ badge, onShowEmbed, onShowVerify, onDelete }) {
  const badgeUrl = `${API}/api/verify/badge/${badge.badge_id}.svg`;
  return (
    <Card className="bg-slate-900/60 border-slate-800" data-testid={`badge-card-${badge.badge_id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{badge.business_name}</CardTitle>
          {badge.verified ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" /> Pending</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 font-mono">{badge.domain}</p>
      </CardHeader>
      <CardContent>
        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-3 flex justify-center mb-3">
          <img src={badgeUrl} alt="Trust Badge" className="h-12" data-testid="badge-preview" />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>Impressions: <b className="text-white">{badge.stats?.impressions || 0}</b></span>
          <span>Style: <b className="text-white">{badge.style}</b></span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {!badge.verified && (
            <Button onClick={onShowVerify} size="sm" variant="outline" className="text-xs h-8 col-span-1 border-amber-700 text-amber-400 hover:bg-amber-500/10" data-testid={`verify-domain-btn-${badge.badge_id}`}>
              Verify
            </Button>
          )}
          <Button onClick={onShowEmbed} size="sm" variant="outline" className={`text-xs h-8 ${!badge.verified ? 'col-span-1' : 'col-span-2'} border-slate-700`} data-testid={`embed-btn-${badge.badge_id}`}>
            <Code className="w-3.5 h-3.5 mr-1" /> Embed
          </Button>
          <Button onClick={onDelete} size="sm" variant="outline" className="text-xs h-8 border-red-700/40 text-red-400 hover:bg-red-500/10" data-testid={`delete-btn-${badge.badge_id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateBadgeModal({ onClose, onCreate }) {
  const [domain, setDomain] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [style, setStyle] = useState('default');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!domain) { toast.error('Domain required'); return; }
    setSubmitting(true);
    await onCreate({ domain, business_name: businessName, style });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()} data-testid="create-badge-modal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">New Trust Badge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500">Domain</label>
            <Input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="bg-slate-800 border-slate-700 mt-1" data-testid="domain-input" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500">Business Name</label>
            <Input placeholder="Acme Inc." value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="bg-slate-800 border-slate-700 mt-1" data-testid="business-name-input" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500">Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm mt-1" data-testid="style-select">
              <option value="default">Default (sky)</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-500" data-testid="submit-create-badge">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Badge
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ badge, onClose }) {
  const snippet = `<script src="${API}/api/verify/widget.js" data-badge-id="${badge.badge_id}"${badge.style !== 'default' ? ` data-style="${badge.style}"` : ''}></script>`;
  const imgSnippet = `<a href="${API.replace(/\/$/, '')}/verify?badge=${badge.badge_id}" target="_blank">
  <img src="${API}/api/verify/badge/${badge.badge_id}.svg" alt="Verified by NotaryChain" />
</a>`;
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied'); };
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-5" onClick={e => e.stopPropagation()} data-testid="embed-modal">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2"><Code className="w-5 h-5 text-amber-400" /> Embed Trust Badge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Paste either snippet anywhere on your website. The badge links to a public verification page.</p>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Recommended — JavaScript widget</p>
            <div className="bg-slate-800/60 border border-slate-700 rounded p-3 font-mono text-[11px] text-slate-300 break-all relative">
              {snippet}
              <button onClick={() => copy(snippet)} className="absolute top-2 right-2 text-slate-400 hover:text-white" data-testid="copy-snippet-js"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Alternative — Plain HTML</p>
            <div className="bg-slate-800/60 border border-slate-700 rounded p-3 font-mono text-[11px] text-slate-300 break-all relative whitespace-pre-wrap">
              {imgSnippet}
              <button onClick={() => copy(imgSnippet)} className="absolute top-2 right-2 text-slate-400 hover:text-white" data-testid="copy-snippet-html"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="pt-2 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Preview</p>
            <img src={`${API}/api/verify/badge/${badge.badge_id}.svg`} alt="preview" className="mx-auto h-16" />
          </div>
          {!badge.verified && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs text-amber-300">
              <strong>Heads up:</strong> Your badge currently shows "Pending Verification". Verify your domain to switch it to "Verified".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyDomainModal({ badge, onClose, token }) {
  const [verifying, setVerifying] = useState(false);
  const [instructions, setInstructions] = useState(null);
  const [verified, setVerified] = useState(false);
  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${API}/api/verify/badges/${badge.badge_id}/verify-domain`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.verified) {
        setVerified(true);
        toast.success(`Verified via ${d.method}`);
      } else {
        setInstructions(d.instructions);
        toast.info('No proof found yet. Add the record below and try again.');
      }
    } catch (e) { toast.error(e.message); }
    setVerifying(false);
  };
  useEffect(() => { verify(); /* eslint-disable-next-line */ }, []);

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-5" onClick={e => e.stopPropagation()} data-testid="verify-domain-modal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Verify Domain Ownership</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {verified ? (
          <div className="text-center py-6" data-testid="verify-domain-success">
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-400 mb-2" />
            <h4 className="text-xl font-bold text-emerald-400">Domain Verified</h4>
            <p className="text-sm text-slate-400 mt-2">Your Trust Badge now displays the verified state.</p>
            <Button onClick={onClose} className="mt-4 bg-emerald-600 hover:bg-emerald-500">Done</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">Choose <em>one</em> of these methods to prove ownership of <span className="font-mono text-amber-400">{badge.domain}</span>.</p>
            {instructions && (
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Method 1 — DNS TXT Record</p>
                  <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-xs space-y-1 font-mono">
                    <div className="flex items-center"><span className="text-slate-500 w-16">Host</span><span className="text-slate-200 flex-1 truncate">{instructions.dns_txt.host}</span><button onClick={() => copy(instructions.dns_txt.host)} className="text-slate-400 hover:text-white"><Copy className="w-3 h-3" /></button></div>
                    <div className="flex items-center"><span className="text-slate-500 w-16">Type</span><span className="text-slate-200 flex-1">{instructions.dns_txt.type}</span></div>
                    <div className="flex items-center"><span className="text-slate-500 w-16">Value</span><span className="text-slate-200 flex-1 truncate">{instructions.dns_txt.value}</span><button onClick={() => copy(instructions.dns_txt.value)} className="text-slate-400 hover:text-white"><Copy className="w-3 h-3" /></button></div>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Method 2 — Well-known file</p>
                  <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-xs space-y-1 font-mono">
                    <div className="flex items-center"><span className="text-slate-500 w-16">URL</span><span className="text-slate-200 flex-1 truncate">{instructions.well_known.url}</span></div>
                    <div className="flex items-center"><span className="text-slate-500 w-16">Content</span><span className="text-slate-200 flex-1 truncate">{instructions.well_known.content}</span><button onClick={() => copy(instructions.well_known.content)} className="text-slate-400 hover:text-white"><Copy className="w-3 h-3" /></button></div>
                  </div>
                </div>
              </div>
            )}
            <Button onClick={verify} disabled={verifying} className="w-full mt-4 bg-amber-600 hover:bg-amber-500" data-testid="recheck-verify-btn">
              {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Re-check Now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
