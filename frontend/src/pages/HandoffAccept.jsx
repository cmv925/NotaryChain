import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Loader2, CheckCircle, AlertTriangle, Clock, Shield, Home, Key, Award, FileText, Banknote, Briefcase, Vault, ExternalLink, Sparkles, Lock, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const ASSET_ICONS = {
  deed: Home, title: Key, ip: Award, will: FileText,
  custody: Shield, financial: Banknote, license: Briefcase,
  contract: FileText, other: Vault,
};

export default function HandoffAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(null);
  const [stats, setStats] = useState(null);

  // Viral signup state
  const [showSignup, setShowSignup] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    Promise.all([
      fetch(`${API}/api/salv/handoff/${token}`).then(async r => {
        let body = null;
        try { body = await r.clone().json(); } catch { /* ignore */ }
        if (!r.ok) {
          const detail = (body && body.detail) || (r.status === 404 ? 'Invalid or unknown handoff token' : `HTTP ${r.status}`);
          throw new Error(detail);
        }
        return body;
      }),
      fetch(`${API}/api/salv/viral/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([d, s]) => { if (!cancelled) { setData(d); setStats(s); setSignupName(d?.beneficiary?.name || ''); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/salv/handoff/${token}/accept`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Accept failed');
      setAccepted(body);
      toast.success(`Share of ${body.share_percent}% accepted & sealed on Hedera`);
      // Auto-open the viral signup card after accept
      setTimeout(() => setShowSignup(true), 600);
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  const signup = async () => {
    if (signupPass.length < 8) return toast.error('Password must be at least 8 characters');
    setSigningUp(true);
    try {
      const r = await fetch(`${API}/api/salv/handoff/${token}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: signupPass, full_name: signupName }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Signup failed');

      // Login the new user
      if (loginWithToken) loginWithToken(body.access_token);
      else localStorage.setItem('token', body.access_token);

      toast.success(body.is_existing ? 'Welcome back! Logged in.' : 'Account created — your legacy is now protected.');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSigningUp(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <Center>
          <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading handoff…</p>
        </Center>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <Card className="bg-white border-coral-200 max-w-md mx-auto" data-testid="handoff-error">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-coral-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-navy-900 mb-1">Invalid handoff link</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data?.status === 'expired') {
    return (
      <Shell>
        <Card className="bg-white border-coral-200 max-w-md mx-auto" data-testid="handoff-expired">
          <CardContent className="p-8 text-center">
            <Clock className="w-10 h-10 text-coral-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-navy-900 mb-1">Link expired</h2>
            <p className="text-sm text-slate-600">This handoff link expired on {fmtDate(data.expires_at)}. Contact the asset owner to re-issue.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Post-accept (or already-claimed) state — show success + viral signup loop
  if (data?.status === 'claimed' || accepted) {
    const sharePercent = accepted?.share_percent ?? data?.beneficiary?.share_percent ?? 0;
    return (
      <Shell>
        <div className="max-w-2xl mx-auto" data-testid="handoff-claimed">
          {/* Success card */}
          <Card className="bg-white border-emerald-200 mb-6">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="font-serif text-3xl text-navy-900 mb-1">Sealed on-chain</h2>
              <p className="text-slate-600 text-sm mb-4">
                Your {sharePercent}% share has been permanently recorded on NotaryChain.
                <br />The asset owner has been notified.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-800 text-[11px] font-semibold uppercase tracking-wider">Hedera Anchored</span>
              </div>
            </CardContent>
          </Card>

          {/* Viral CTA */}
          {!showSignup && (
            <Card className="bg-gradient-to-br from-coral-50 to-white border-coral-200" data-testid="viral-cta-card">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-lg bg-coral-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl text-navy-900 mb-1">Your share is protected. Is yours?</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      You've just been added as a beneficiary on a Hedera-anchored asset. Don't leave your own legacy to chance — secure your deeds, IP, custody agreements, and digital assets the same way.
                    </p>
                  </div>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-3 my-5">
                    <Stat label="Assets protected" value={stats.total_assets_protected.toLocaleString()} />
                    <Stat label="Total value" value={`$${(stats.total_value_usd / 1_000_000).toFixed(1)}M`} />
                    <Stat label="Beneficiaries" value={stats.total_beneficiaries.toLocaleString()} />
                  </div>
                )}

                <ul className="space-y-2 mb-6 text-sm text-slate-700">
                  <Li>Free to start — no credit card required</Li>
                  <Li>Add unlimited beneficiaries with share percentages</Li>
                  <Li>Hedera Hashgraph anchoring on every asset</Li>
                  <Li>Annual re-verification + dead-man's-switch alerts</Li>
                </ul>

                <Button onClick={() => setShowSignup(true)} className="w-full bg-coral-500 hover:bg-coral-600 text-white text-base py-6" data-testid="viral-signup-cta">
                  <Sparkles className="w-4 h-4 mr-2" /> Protect my legacy — Free signup
                </Button>
                <p className="text-[11px] text-slate-500 text-center mt-3">Takes under 90 seconds · Email pre-filled from your beneficiary record</p>
              </CardContent>
            </Card>
          )}

          {showSignup && (
            <Card className="bg-white border-slate-200" data-testid="viral-signup-form">
              <CardContent className="p-8">
                <h3 className="font-serif text-2xl text-navy-900 mb-1">Create your account</h3>
                <p className="text-sm text-slate-600 mb-6">Your email <strong className="text-navy-900">{data?.beneficiary?.email || '(from your beneficiary record)'}</strong> will be used to sign in.</p>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Your name</Label>
                    <Input value={signupName} onChange={e => setSignupName(e.target.value)} placeholder="Full name" data-testid="signup-name-input" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5">Password</Label>
                    <div className="relative">
                      <Input type={showPass ? 'text' : 'password'} value={signupPass} onChange={e => setSignupPass(e.target.value)} placeholder="At least 8 characters" data-testid="signup-pass-input" className="pr-10" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-navy-900 p-1">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Minimum 8 characters, mixed case + number recommended</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button onClick={signup} disabled={signingUp} className="bg-coral-500 hover:bg-coral-600 text-white flex-1" data-testid="signup-submit-btn">
                    {signingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account & continue <TrendingUp className="w-4 h-4 ml-2" /></>}
                  </Button>
                  <Button variant="outline" onClick={() => setShowSignup(false)} className="border-slate-300 text-slate-700 hover:bg-cream-200/40">
                    Cancel
                  </Button>
                </div>

                <p className="text-[10px] text-slate-500 text-center mt-5">
                  By creating an account, you agree to NotaryChain's terms. Your beneficiary record will be linked to your new account.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="text-center mt-8">
            <Link to="/" className="text-slate-500 hover:text-navy-900 text-[12px]">Back to NotaryChain →</Link>
          </div>
        </div>
      </Shell>
    );
  }

  const a = data.asset || {};
  const b = data.beneficiary || {};
  const Icon = ASSET_ICONS[a.asset_type] || Vault;

  return (
    <Shell>
      <div className="max-w-xl mx-auto" data-testid="handoff-active">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-coral-50 border border-coral-200">
            <Heart className="w-3.5 h-3.5 text-coral-600" />
            <span className="text-coral-700 text-[10px] uppercase tracking-[0.25em] font-bold">Beneficiary Handoff</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-2">Hello{b.name ? `, ${b.name}` : ''}.</h1>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            {data.owner?.name || 'A NotaryChain user'} has named you as a beneficiary on the asset below.
            Review the details and accept to record your share on the blockchain.
          </p>
        </div>

        <Card className="bg-white border-slate-200 mb-4" data-testid="handoff-asset-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-coral-50 border border-coral-200 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-coral-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{a.asset_type || '—'}</p>
                <h2 className="text-xl font-bold text-navy-900 truncate">{a.title}</h2>
                {a.description && <p className="text-xs text-slate-600 mt-1">{a.description}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {a.value_estimate_usd && <Row label="Estimated value" value={`$${a.value_estimate_usd.toLocaleString()}`} />}
              {a.jurisdiction && <Row label="Jurisdiction" value={a.jurisdiction} />}
              {a.handoff_started_at && <Row label="Handoff started" value={fmtDate(a.handoff_started_at)} />}
              {a.blockchain_seal?.transaction_id && (
                <Row label="Hedera tx" value={(
                  <a href={a.blockchain_seal.explorer_url} target="_blank" rel="noreferrer" className="text-coral-600 hover:underline inline-flex items-center gap-1">
                    {a.blockchain_seal.transaction_id.slice(0, 14)}… <ExternalLink className="w-3 h-3" />
                  </a>
                )} />
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="bg-coral-50 border-coral-200 mb-6" data-testid="handoff-share-card">
          <CardContent className="p-6 text-center">
            <Heart className="w-7 h-7 text-coral-500 mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-coral-700 font-bold">Your share</p>
            <p className="font-serif text-5xl text-navy-900 my-2">{(b.share_percent || 0).toFixed(0)}%</p>
            {b.relationship && <p className="text-xs text-slate-600">Relationship: {b.relationship}</p>}
            <p className="text-xs text-slate-500 mt-2">Token expires {fmtDate(data.expires_at)}</p>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-center">
          <Link to="/" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center justify-center px-4 py-2">
            Decline & exit
          </Link>
          <Button
            onClick={accept}
            disabled={submitting}
            className="bg-coral-500 hover:bg-coral-600 text-white px-6 h-11"
            data-testid="accept-handoff-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Accept ${(b.share_percent || 0).toFixed(0)}% share`}
          </Button>
        </div>

        <p className="text-[10px] text-slate-600 text-center mt-8 max-w-sm mx-auto">
          By accepting, you agree this share is recorded on NotaryChain and may be referenced
          in any future legal proceedings around the asset's transfer.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="handoff-page">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <Vault className="w-4 h-4 text-coral-600" />
          <span className="text-coral-700 text-[10px] uppercase tracking-[0.25em] font-bold">NotaryChain Asset Vault</span>
        </div>
      </div>
      <div className="px-6 py-12">{children}</div>
    </div>
  );
}

function Center({ children }) {
  return <div className="text-center py-16">{children}</div>;
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-navy-900 mt-0.5">{value}</dd>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</div>
      <div className="font-serif text-2xl text-navy-900">{value}</div>
    </div>
  );
}

function Li({ children }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}
