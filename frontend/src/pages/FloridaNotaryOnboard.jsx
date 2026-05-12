import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertTriangle, FileText, Award, GraduationCap, Stamp, X } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  { id: 'commission', label: 'Commission', icon: FileText },
  { id: 'bond', label: 'Bond', icon: Award },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'seal', label: 'Seal & Sig', icon: Stamp },
  { id: 'review', label: 'Review', icon: CheckCircle },
];

const APPROVED_TRAINING = [
  'FloridaNotary.com',
  'American Society of Notaries',
  'National Notary Association',
];

export default function FloridaNotaryOnboard() {
  const { token, isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fl_commission_number: '',
    fl_commission_expires: '',
    fl_bond_provider: '',
    fl_bond_number: '',
    fl_bond_amount_usd: 25000,
    fl_bond_expires_at: '',
    fl_training_provider: APPROVED_TRAINING[0],
    fl_training_certificate_url: '',
    fl_seal_image_url: '',
    fl_e_signature_id: '',
    notes: '',
  });

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json',
  }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/fl/notary/credentials`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setExisting(d);
      if (d?.credentials) {
        setForm(f => ({ ...f, ...d.credentials }));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (isAuthenticated) load(); else setLoading(false); }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <Shell>
        <Card className="bg-slate-900/60 border-slate-800 max-w-md mx-auto" data-testid="fl-onboard-login-required">
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Sign in to onboard</h2>
            <p className="text-sm text-slate-400 mb-4">Florida notary onboarding requires a NotaryChain account.</p>
            <Link to="/login"><Button className="bg-emerald-600 hover:bg-emerald-500">Sign in</Button></Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (loading) {
    return <Shell><Center><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></Center></Shell>;
  }

  const status = existing?.status;
  // Already verified or rejected — show status screen
  if (status === 'verified') {
    const c = existing.credentials;
    return (
      <Shell>
        <Card className="bg-emerald-500/5 border-emerald-500/30 max-w-xl mx-auto" data-testid="fl-onboard-verified">
          <CardContent className="p-8">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-9 h-9 text-emerald-400 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-emerald-300">You're a verified Florida online notary.</h2>
                <p className="text-sm text-slate-400 mt-1">Commission {c.fl_commission_number} · verified {fmtDate(c.verified_at)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs mt-6">
              <Field label="Bond amount" value={`$${(c.fl_bond_amount_usd || 0).toLocaleString()}`} />
              <Field label="Bond expires" value={fmtDate(c.fl_bond_expires_at)} />
              <Field label="Commission expires" value={fmtDate(c.fl_commission_expires)} />
              <Field label="Training provider" value={c.fl_training_provider} />
            </div>
            <div className="mt-6 flex gap-2">
              <Link to="/dashboard"><Button variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800">Back to dashboard</Button></Link>
              <Link to="/florida"><Button className="bg-emerald-600 hover:bg-emerald-500">View Florida page</Button></Link>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'pending_review') {
    return (
      <Shell>
        <Card className="bg-amber-500/5 border-amber-500/30 max-w-xl mx-auto" data-testid="fl-onboard-pending">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-9 h-9 text-amber-400 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-amber-300 mb-1">Under review</h2>
            <p className="text-sm text-slate-400 mb-3">Your Florida notary credentials are being verified by our compliance team. This typically takes under 48 hours.</p>
            <p className="text-[11px] text-slate-500">Commission #{existing.credentials?.fl_commission_number}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/fl/notary/onboard`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Submission failed');
      toast.success('Submitted for review — we’ll email you within 48 hours');
      await load();
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isRejected = status === 'rejected';
  const stepValid = () => {
    if (step === 0) return form.fl_commission_number.trim().length >= 4 && form.fl_commission_expires;
    if (step === 1) return form.fl_bond_provider && form.fl_bond_number && form.fl_bond_amount_usd >= 25000 && form.fl_bond_expires_at;
    if (step === 2) return !!form.fl_training_provider;
    return true;
  };

  return (
    <Shell>
      <div className="max-w-3xl mx-auto" data-testid="fl-onboard-page">
        {isRejected && (
          <Card className="bg-red-500/5 border-red-500/30 mb-4">
            <CardContent className="p-4 text-sm">
              <p className="text-red-300 font-bold mb-1">Previous submission rejected</p>
              <p className="text-xs text-slate-400">{existing.credentials?.rejection_reason}. Update the fields below and resubmit.</p>
            </CardContent>
          </Card>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6" data-testid="fl-onboard-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1" data-testid={`step-${s.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    done ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' :
                    active ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' :
                    'bg-slate-800/60 border-slate-700 text-slate-500'
                  }`}>
                    {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider hidden sm:block ${active || done ? 'text-emerald-300' : 'text-slate-500'}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6">
            {step === 0 && (
              <div data-testid="fl-step-commission">
                <h2 className="text-xl font-bold mb-1">Your Florida commission</h2>
                <p className="text-xs text-slate-400 mb-5">Find these on your commission certificate (issued by FL Department of State).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Commission number *" hint="Format: GG followed by 6-8 digits">
                    <Input value={form.fl_commission_number} onChange={e => update('fl_commission_number', e.target.value.toUpperCase())}
                      placeholder="GG123456" className="bg-slate-800/60 border-slate-700 uppercase font-mono" data-testid="commission-input" />
                  </FormField>
                  <FormField label="Commission expires *">
                    <Input type="date" value={form.fl_commission_expires.slice(0,10)} onChange={e => update('fl_commission_expires', e.target.value)}
                      className="bg-slate-800/60 border-slate-700" data-testid="commission-expires-input" />
                  </FormField>
                </div>
              </div>
            )}

            {step === 1 && (
              <div data-testid="fl-step-bond">
                <h2 className="text-xl font-bold mb-1">Your $25,000 bond</h2>
                <p className="text-xs text-slate-400 mb-5">Florida requires a $25,000 surety bond. Enter your active bond details.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Bond provider *">
                    <Input value={form.fl_bond_provider} onChange={e => update('fl_bond_provider', e.target.value)}
                      placeholder="Sun Bonding Co" className="bg-slate-800/60 border-slate-700" data-testid="bond-provider-input" />
                  </FormField>
                  <FormField label="Bond number *">
                    <Input value={form.fl_bond_number} onChange={e => update('fl_bond_number', e.target.value)}
                      placeholder="SB-12345" className="bg-slate-800/60 border-slate-700 font-mono" data-testid="bond-number-input" />
                  </FormField>
                  <FormField label="Bond amount (USD) *" hint="Must be ≥ $25,000">
                    <Input type="number" min={25000} step={1000} value={form.fl_bond_amount_usd} onChange={e => update('fl_bond_amount_usd', parseFloat(e.target.value) || 0)}
                      className="bg-slate-800/60 border-slate-700" data-testid="bond-amount-input" />
                  </FormField>
                  <FormField label="Bond expires *">
                    <Input type="date" value={form.fl_bond_expires_at.slice(0,10)} onChange={e => update('fl_bond_expires_at', e.target.value)}
                      className="bg-slate-800/60 border-slate-700" data-testid="bond-expires-input" />
                  </FormField>
                </div>
              </div>
            )}

            {step === 2 && (
              <div data-testid="fl-step-training">
                <h2 className="text-xl font-bold mb-1">RON training certification</h2>
                <p className="text-xs text-slate-400 mb-5">Florida requires completion of a state-approved RON training course.</p>
                <div className="space-y-4">
                  <FormField label="Training provider *">
                    <select value={form.fl_training_provider} onChange={e => update('fl_training_provider', e.target.value)}
                      className="bg-slate-800/60 border border-slate-700 rounded-md px-3 h-10 text-sm text-white w-full" data-testid="training-provider-select">
                      {APPROVED_TRAINING.map(t => <option key={t}>{t}</option>)}
                      <option value="other">Other approved provider</option>
                    </select>
                  </FormField>
                  <FormField label="Certificate URL (optional)">
                    <Input value={form.fl_training_certificate_url} onChange={e => update('fl_training_certificate_url', e.target.value)}
                      placeholder="https://..." className="bg-slate-800/60 border-slate-700 font-mono text-xs" data-testid="training-cert-input" />
                    <p className="text-[10px] text-slate-500 mt-1">A link to your certificate of completion. We can also verify via certificate number during review.</p>
                  </FormField>
                </div>
              </div>
            )}

            {step === 3 && (
              <div data-testid="fl-step-seal">
                <h2 className="text-xl font-bold mb-1">E-seal & digital signature</h2>
                <p className="text-xs text-slate-400 mb-5">Optional now — you can upload these after verification too.</p>
                <div className="space-y-4">
                  <FormField label="Seal image URL (optional)">
                    <Input value={form.fl_seal_image_url} onChange={e => update('fl_seal_image_url', e.target.value)}
                      placeholder="https://..." className="bg-slate-800/60 border-slate-700 font-mono text-xs" data-testid="seal-image-input" />
                  </FormField>
                  <FormField label="E-signature provider ID (optional)">
                    <Input value={form.fl_e_signature_id} onChange={e => update('fl_e_signature_id', e.target.value)}
                      placeholder="Provider account/key ID" className="bg-slate-800/60 border-slate-700" data-testid="esig-input" />
                  </FormField>
                  <FormField label="Notes for review team (optional)">
                    <Textarea rows={2} value={form.notes} onChange={e => update('notes', e.target.value)}
                      placeholder="Anything our compliance team should know?" className="bg-slate-800/60 border-slate-700" data-testid="notes-input" />
                  </FormField>
                </div>
              </div>
            )}

            {step === 4 && (
              <div data-testid="fl-step-review">
                <h2 className="text-xl font-bold mb-1">Review & submit</h2>
                <p className="text-xs text-slate-400 mb-5">We’ll verify against FL Department of State records within 48 hours.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <Field label="Commission #" value={form.fl_commission_number} />
                  <Field label="Commission expires" value={fmtDate(form.fl_commission_expires)} />
                  <Field label="Bond provider" value={form.fl_bond_provider} />
                  <Field label="Bond #" value={form.fl_bond_number} />
                  <Field label="Bond amount" value={`$${(form.fl_bond_amount_usd || 0).toLocaleString()}`} />
                  <Field label="Bond expires" value={fmtDate(form.fl_bond_expires_at)} />
                  <Field label="Training" value={form.fl_training_provider} />
                  {form.fl_seal_image_url && <Field label="Seal" value="Provided" />}
                </div>
                <Card className="bg-slate-800/40 border-slate-700 mt-5">
                  <CardContent className="p-3 text-[11px] text-slate-400">
                    By submitting, you certify that the information above is accurate, your bond and commission are active,
                    and you have completed Florida-approved RON training. Misrepresentation may result in account suspension
                    and notification to the FL Department of State.
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                disabled={step === 0 || submitting}
                onClick={() => setStep(s => Math.max(0, s - 1))}
                className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800"
                data-testid="step-back-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                  disabled={!stepValid()}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  data-testid="step-next-btn"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  data-testid="submit-fl-onboard-btn"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for review'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-gradient-to-b from-emerald-950/20 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-400">Florida · Notary Onboarding</span>
          </div>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}

function Center({ children }) { return <div className="text-center py-16">{children}</div>; }
function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-slate-200 text-sm break-words">{value || '—'}</p>
    </div>
  );
}
function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleDateString(); } catch { return s; } }
