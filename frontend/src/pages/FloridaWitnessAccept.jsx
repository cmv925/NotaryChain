import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, Sun, Loader2, CheckCircle, AlertTriangle, Clock, Users } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FloridaWitnessAccept() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`${API}/api/fl/ceremony/will/witness-token/${token}`)
      .then(async r => {
        let body = null;
        try { body = await r.clone().json(); } catch { /* ignore */ }
        if (!r.ok) {
          throw new Error((body && body.detail) || (r.status === 404 ? 'Invalid witness link' : `HTTP ${r.status}`));
        }
        return body;
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/fl/ceremony/will/witness-token/${token}/accept`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Accept failed');
      setAccepted(true);
      toast.success('Witness role accepted');
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  if (loading) {
    return <Shell><Center><Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto" /></Center></Shell>;
  }
  if (error) {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-gold-500/30 max-w-md mx-auto" data-testid="witness-error">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-coral-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-coral-700 mb-1">Invalid witness link</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }
  if (data?.status === 'expired') {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-gold-500/30 max-w-md mx-auto" data-testid="witness-expired">
          <CardContent className="p-8 text-center">
            <Clock className="w-10 h-10 text-coral-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-coral-700 mb-1">Invitation expired</h2>
            <p className="text-sm text-slate-600">This witness invitation expired on {fmtDate(data.expires_at)}. Ask the principal for a new link.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }
  if (accepted || data?.status === 'accepted' || data?.status === 'completed') {
    return (
      <Shell>
        <Card className="bg-coral-500/5 border-coral-200 max-w-md mx-auto" data-testid="witness-accepted">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-coral-600 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-coral-700 mb-1">You're confirmed as a witness</h2>
            <p className="text-sm text-slate-600 mb-3">The principal has been notified. You'll receive a calendar invite for the live video ceremony soon.</p>
            <Link to="/" className="text-coral-600 text-xs hover:underline">Back to NotaryChain →</Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const w = data?.witness || {};

  return (
    <Shell>
      <div className="max-w-xl mx-auto" data-testid="witness-active">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-coral-500/10 border border-orange-500/20">
            <Users className="w-3.5 h-3.5 text-coral-600" />
            <span className="text-coral-700 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Online Will Witness</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Hello{w.name ? `, ${w.name}` : ''}.</h1>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            <strong className="text-navy-900">{data.invited_by_email}</strong> has named you as a <strong>witness</strong> on a Florida online will ceremony.
            Florida law (Stat. 732.522) requires two witnesses present on video.
          </p>
        </div>

        <Card className="bg-white border-slate-200 mb-6">
          <CardContent className="p-5">
            <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">What you're agreeing to</h2>
            <ul className="space-y-2 text-sm">
              <Item ok>Attend the scheduled video ceremony at the agreed time.</Item>
              <Item ok>Verify your identity on camera (and complete a brief KBA quiz).</Item>
              <Item ok>Watch the principal sign the will, and sign as a witness yourself.</Item>
              <Item ok>Your participation is sealed on the Hedera blockchain for 10 years.</Item>
            </ul>
            {w.relationship && (
              <p className="text-[11px] text-slate-500 mt-4">Relationship indicated: {w.relationship}</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3">
          <Link to="/" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center px-4 py-2">Decline</Link>
          <Button onClick={accept} disabled={submitting} className="bg-coral-500 hover:bg-coral-500 px-6 h-11" data-testid="accept-witness-btn">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept witness role'}
          </Button>
        </div>

        <p className="text-[10px] text-slate-600 text-center mt-8 max-w-sm mx-auto">
          By accepting, you confirm you are over 18, are not the principal, and have no direct beneficial
          interest in the will. Misrepresentation may invalidate the document.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="fl-witness-page">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <Sun className="w-4 h-4 text-coral-600" />
          <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">NotaryChain · Florida</span>
        </div>
      </div>
      <div className="px-6 py-12">{children}</div>
    </div>
  );
}
function Center({ children }) { return <div className="text-center py-16">{children}</div>; }
function Item({ ok, children }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${ok ? 'text-coral-600' : 'text-slate-600'}`} />
      <span className="text-navy-800">{children}</span>
    </li>
  );
}
function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleDateString(); } catch { return s; } }
