import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, MapPin, Award, ChevronLeft, ExternalLink, AlertTriangle, CheckCircle, XCircle, Loader2, Calendar, Hash, Copy, Sparkles } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function NotaryProfile() {
  const { notaryId } = useParams();
  const [loading, setLoading] = useState(true);
  const [notary, setNotary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setNotary(null);
    fetch(`${API}/api/verify/notary/${notaryId}`)
      .then(async r => {
        let body = null;
        try { body = await r.clone().json(); } catch { /* ignore */ }
        if (!r.ok) {
          const detail = (body && body.detail) || (r.status === 404 ? 'Notary not found' : `HTTP ${r.status}`);
          throw new Error(detail);
        }
        return body;
      })
      .then(d => { if (!cancelled) setNotary(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [notaryId]);

  const copy = (txt) => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copied'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 text-navy-900 flex items-center justify-center" data-testid="notary-profile-loading">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading notary profile…</p>
        </div>
      </div>
    );
  }

  if (error || !notary?.verified) {
    return (
      <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="notary-profile-not-found">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link to="/notaries" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-navy-900 mb-6" data-testid="back-to-directory">
            <ChevronLeft className="w-4 h-4" /> Back to directory
          </Link>
          <Card className="bg-coral-500/5 border-gold-500/30">
            <CardContent className="p-10 text-center">
              <XCircle className="w-12 h-12 mx-auto text-coral-600 mb-3" />
              <h2 className="text-2xl font-bold text-coral-600 mb-1">Notary Not Found</h2>
              <p className="text-sm text-slate-600">{error || 'This notary ID is not registered with NotaryChain.'}</p>
              <p className="text-[11px] text-slate-600 font-mono break-all mt-3">{notaryId}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const active = !!notary.active;
  const ringColor = active ? '#10b981' : '#ef4444';
  const fraudFlags = notary.stats?.active_fraud_flags || 0;

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="notary-profile-page">
      {/* Top nav */}
      <div className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link to="/notaries" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-navy-900" data-testid="back-to-directory">
            <ChevronLeft className="w-4 h-4" /> Back to directory
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 border-2"
              style={{ borderColor: ringColor, backgroundColor: `${ringColor}1a` }}
              data-testid="notary-status-ring"
            >
              <Shield className="w-9 h-9" style={{ color: ringColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase tracking-[0.25em] font-bold ${active ? 'text-coral-600' : 'text-red-400'}`}>
                  {active ? 'Active Notary' : 'Inactive'}
                </span>
                {fraudFlags > 0 && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {fraudFlags} flag{fraudFlags > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2" data-testid="notary-name">{notary.name || '—'}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                {notary.license_state && (
                  <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-coral-600/70" />{notary.license_state}</span>
                )}
                {notary.role && <span className="capitalize">{notary.role}</span>}
                <button onClick={() => copy(notary.notary_id)} className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-navy-900 transition-colors" data-testid="copy-notary-id">
                  <Hash className="w-3 h-3" /> {notary.notary_id} <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats column */}
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-white border-slate-200" data-testid="notary-stats-card">
            <CardContent className="p-6">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Sealing History</h2>
              <div className="grid grid-cols-3 gap-4">
                <Stat
                  label="Total seals"
                  value={(notary.stats?.total_seals || 0).toLocaleString()}
                  testId="stat-seals"
                />
                <Stat
                  label="Ceremonies"
                  value={(notary.stats?.total_ceremonies || 0).toLocaleString()}
                  testId="stat-ceremonies"
                />
                <Stat
                  label="Active flags"
                  value={fraudFlags}
                  red={fraudFlags > 0}
                  testId="stat-flags"
                />
              </div>
            </CardContent>
          </Card>

          {/* License */}
          <Card className="bg-white border-slate-200" data-testid="notary-license-card">
            <CardContent className="p-6">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">License</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="License Number" value={notary.license_number || '—'} mono />
                <Field label="State" value={notary.license_state || '—'} />
                {notary.license_expiration && <Field label="Expires" value={fmtDate(notary.license_expiration)} icon={Calendar} />}
              </div>
            </CardContent>
          </Card>

          {/* Bond */}
          {notary.bond ? (
            <Card className="bg-white border-slate-200" data-testid="notary-bond-card">
              <CardContent className="p-6">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-coral-600" /> Bond
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Amount" value={`$${(notary.bond.amount_usd || 0).toLocaleString()}`} />
                  <Field
                    label="Status"
                    value={notary.bond.status || '—'}
                    badge={notary.bond.status === 'active' ? 'emerald' : 'slate'}
                  />
                  {notary.bond.san_bond_id && <Field label="SAN Bond ID" value={notary.bond.san_bond_id} mono />}
                  {notary.bond.expires_at && <Field label="Bond Expires" value={fmtDate(notary.bond.expires_at)} />}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white border-slate-200" data-testid="notary-no-bond-card">
              <CardContent className="p-6 text-center">
                <Award className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600">This notary does not currently have an active bond on file.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card className="bg-white border-slate-200" data-testid="notary-trust-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-coral-600" />
                <h3 className="font-bold text-sm">Public Trust</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Every notarization performed by this notary is sealed to the Hedera blockchain.
                You can independently verify any document they’ve sealed, even years from now.
              </p>
              <Link to="/verify" data-testid="verify-document-cta">
                <Button className="w-full bg-coral-500 hover:bg-coral-500 text-navy-900">
                  Verify a document
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200" data-testid="notary-book-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-coral-600" />
                <h3 className="font-bold text-sm">Book a session</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Reserve a remote online notarization slot directly with this notary.
              </p>
              <Link to={`/book/${notary.notary_id}`} data-testid="book-notary-cta">
                <Button variant="outline" className="w-full bg-cream-200/40 border-slate-300 text-navy-900 hover:bg-cream-200">
                  Book a session <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200" data-testid="notary-share-card">
            <CardContent className="p-5">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">Share this profile</h3>
              <button
                onClick={() => copy(window.location.href)}
                className="text-xs text-navy-800 font-mono break-all hover:text-coral-700 inline-flex items-start gap-1"
                data-testid="share-profile-link"
              >
                <Copy className="w-3 h-3 mt-0.5 flex-shrink-0" /> {window.location.href}
              </button>
            </CardContent>
          </Card>

          {/* Trust Badge cross-sell — visible to every notary profile visitor */}
          <Card className="bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/60 border-gold-500/30 relative overflow-hidden" data-testid="trust-badge-crosssell">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl" />
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-coral-600" />
                <h3 className="text-xs uppercase tracking-[0.2em] text-coral-700 font-bold">Display this trust seal on your site</h3>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Want the NotaryChain verification badge on your business website? Visitors click it to land on this profile — proving you're a real, commissioned, and chain-of-trust-anchored notary.
              </p>
              <div className="text-[10px] text-slate-500 mb-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <span><span className="text-coral-700 font-bold">$29/mo</span> · cancel anytime</span>
                <span>· 60-second install</span>
                <span>· DNS or .well-known</span>
              </div>
              <Link to="/trust-badge" data-testid="trust-badge-cta">
                <Button className="bg-coral-500 hover:bg-coral-600 text-slate-950 font-bold w-full h-10" data-testid="get-trust-badge-btn">
                  <Award className="w-4 h-4 mr-2" /> Get my trust seal →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, red, testId }) {
  return (
    <div data-testid={testId}>
      <p className={`text-2xl font-bold ${red ? 'text-red-400' : 'text-navy-900'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function Field({ label, value, mono, icon: Icon, badge }) {
  const badgeClasses = {
    emerald: 'bg-coral-500/15 text-coral-700',
    slate: 'bg-slate-700/50 text-navy-800',
  }[badge];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 inline-flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : null}{label}
      </p>
      {badge ? (
        <span className={`inline-block text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${badgeClasses}`}>{value}</span>
      ) : (
        <p className={`text-slate-200 ${mono ? 'font-mono text-xs break-all' : 'text-sm'}`}>{value}</p>
      )}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}
