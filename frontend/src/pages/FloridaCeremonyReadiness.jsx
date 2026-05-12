import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Shield, MapPin, Users, Video, Lock, CheckCircle, AlertTriangle, Loader2, ChevronLeft, Plus, Copy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import KBAQuizModal from '../components/KBAQuizModal';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const NEXUS_OPTIONS = [
  { id: 'real_estate_in_fl', label: 'Real estate located in Florida' },
  { id: 'fl_law_governed', label: 'Document governed by Florida law' },
  { id: 'fl_resident_signer', label: 'Principal is a Florida resident' },
  { id: 'fl_business_entity', label: 'FL-registered business entity' },
  { id: 'online_will_fl_resident', label: 'Florida-resident online will' },
  { id: 'other', label: 'Other Florida nexus (explain below)' },
];

export default function FloridaCeremonyReadiness() {
  const { token, isAuthenticated, user } = useAuth();
  const [ceremonyId] = useState(() => `cer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [documentType, setDocumentType] = useState('deed');
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showKBA, setShowKBA] = useState(false);

  // Jurisdiction qualifier form
  const [juris, setJuris] = useState({
    concerns_fl_property: false,
    concerns_fl_law: false,
    fl_nexus_basis: 'real_estate_in_fl',
    nexus_details: '',
    geo_lat: null, geo_lng: null, geo_accuracy_m: null,
  });
  const [savingJuris, setSavingJuris] = useState(false);

  // Witness state
  const [witnesses, setWitnesses] = useState([]);
  const [witnessForm, setWitnessForm] = useState({ name: '', email: '', relationship: '' });
  const [witnessLinks, setWitnessLinks] = useState({});  // witness_id -> share path

  // A/V state
  const [avForm, setAvForm] = useState({ video_width: 1280, video_height: 720, audio_sample_rate_hz: 48000, recording_duration_sec: 60 });
  const [avResult, setAvResult] = useState(null);

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json',
  }), [token]);

  const loadReadiness = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/fl/ceremony/readiness/${ceremonyId}?document_type=${documentType}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setReadiness(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, ceremonyId, documentType]);

  const loadWitnesses = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/fl/ceremony/will/witnesses/${ceremonyId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setWitnesses(d.witnesses || []);
    } catch { /* ignore */ }
  }, [token, ceremonyId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadReadiness();
      if (documentType === 'will') loadWitnesses();
    }
  }, [isAuthenticated, loadReadiness, loadWitnesses, documentType]);

  // Try to capture GPS
  const captureGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS not available'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setJuris(j => ({ ...j, geo_lat: pos.coords.latitude, geo_lng: pos.coords.longitude, geo_accuracy_m: pos.coords.accuracy }));
        toast.success('Location captured');
      },
      (err) => { toast.error('Location denied'); },
      { timeout: 5000, enableHighAccuracy: false }
    );
  };

  // Auto-derive concerns_fl_property / concerns_fl_law from nexus basis when user hasn't ticked anything
  const updateBasis = (newBasis) => {
    setJuris(j => {
      const next = { ...j, fl_nexus_basis: newBasis };
      if (!j.concerns_fl_property && !j.concerns_fl_law) {
        if (newBasis === 'real_estate_in_fl') next.concerns_fl_property = true;
        else if (newBasis === 'fl_law_governed') next.concerns_fl_law = true;
      }
      return next;
    });
  };

  const submitJuris = async () => {
    setSavingJuris(true);
    try {
      const r = await fetch(`${API}/api/fl/ceremony/jurisdiction-qualifier`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ceremony_id: ceremonyId, ...juris }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Submit failed');
      toast.success('Jurisdiction confirmed');
      loadReadiness();
    } catch (e) { toast.error(e.message); }
    setSavingJuris(false);
  };

  const inviteWitness = async () => {
    if (!witnessForm.name || !witnessForm.email) { toast.error('Name and email required'); return; }
    try {
      const r = await fetch(`${API}/api/fl/ceremony/will/witnesses/invite`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ceremony_id: ceremonyId, ...witnessForm }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Invite failed');
      setWitnessLinks(l => ({ ...l, [body.witness_id]: body.share_link_path }));
      toast.success(`${body.name} invited as witness`);
      setWitnessForm({ name: '', email: '', relationship: '' });
      loadWitnesses();
      loadReadiness();
    } catch (e) { toast.error(e.message); }
  };

  const submitAV = async () => {
    try {
      const r = await fetch(`${API}/api/fl/ceremony/av/report-quality`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ceremony_id: ceremonyId, ...avForm }),
      });
      const body = await r.json();
      setAvResult(body);
      if (body.passed) toast.success('A/V quality OK'); else toast.error('A/V quality below threshold');
      loadReadiness();
    } catch (e) { toast.error(e.message); }
  };

  if (!isAuthenticated) {
    return (
      <Shell>
        <Card className="bg-slate-900/60 border-slate-800 max-w-md mx-auto" data-testid="fl-readiness-login-required">
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Sign in required</h2>
            <Link to="/login"><Button className="bg-emerald-600 hover:bg-emerald-500 mt-3">Sign in</Button></Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const gates = readiness?.gates || {};
  return (
    <Shell>
      <div className="max-w-4xl mx-auto" data-testid="fl-ceremony-readiness-page">
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Ceremony Readiness</span>
            </div>
            <h1 className="text-3xl font-bold">Pre-ceremony checks</h1>
            <p className="text-slate-400 text-sm mt-1">Every Florida notarization must pass these gates before sealing.</p>
            <p className="text-[10px] text-slate-600 font-mono mt-1">ceremony_id: {ceremonyId}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Document type:</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-md px-3 h-9 text-sm text-white" data-testid="document-type-select">
              <option value="deed">Deed</option>
              <option value="poa">Power of Attorney</option>
              <option value="affidavit">Affidavit</option>
              <option value="will">Online Will (2 witnesses)</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Readiness summary */}
        <Card className={`mb-6 ${readiness?.ready ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`} data-testid="readiness-summary">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {readiness?.ready
                ? <CheckCircle className="w-7 h-7 text-emerald-400" />
                : <AlertTriangle className="w-7 h-7 text-amber-400" />}
              <div>
                <h3 className={`font-bold ${readiness?.ready ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {readiness?.ready ? 'Ready to seal' : 'Pending gates'}
                </h3>
                <p className="text-xs text-slate-400">
                  {readiness ? `${Object.values(gates).filter(g => g.passed).length} of ${Object.keys(gates).length} gates passed` : 'Loading…'}
                </p>
              </div>
              <Button onClick={loadReadiness} variant="outline" size="sm" className="ml-auto bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800" data-testid="refresh-readiness-btn">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {Object.entries(gates).map(([k, v]) => (
                <Gate key={k} name={k} passed={v.passed} testId={`gate-${k}`} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GATE: Jurisdiction qualifier */}
        <SectionCard title="1. Jurisdiction qualifier" icon={MapPin} testId="jurisdiction-section">
          <p className="text-xs text-slate-400 mb-4">Confirm Florida nexus and capture principal location.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Checkbox label="Concerns Florida property" checked={juris.concerns_fl_property}
              onChange={v => setJuris(j => ({ ...j, concerns_fl_property: v }))} testId="check-fl-property" />
            <Checkbox label="Governed by Florida law" checked={juris.concerns_fl_law}
              onChange={v => setJuris(j => ({ ...j, concerns_fl_law: v }))} testId="check-fl-law" />
          </div>
          <FormField label="Nexus basis">
            <select value={juris.fl_nexus_basis} onChange={(e) => updateBasis(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-md px-3 h-10 text-sm text-white w-full" data-testid="nexus-basis-select">
              {NEXUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Tick at least one box above (property / law) unless filing a FL-resident online will.</p>
          </FormField>
          {juris.fl_nexus_basis === 'other' && (
            <FormField label="Details">
              <Input value={juris.nexus_details} onChange={e => setJuris(j => ({ ...j, nexus_details: e.target.value }))}
                className="bg-slate-900/60 border-slate-800" data-testid="nexus-details-input" />
            </FormField>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={captureGPS} size="sm" variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800" data-testid="capture-gps-btn">
              <MapPin className="w-3 h-3 mr-1" /> {juris.geo_lat ? 'Re-capture GPS' : 'Capture GPS'}
            </Button>
            {juris.geo_lat && (
              <span className="text-[11px] text-slate-500 font-mono">
                {juris.geo_lat.toFixed(4)}, {juris.geo_lng.toFixed(4)} (±{juris.geo_accuracy_m?.toFixed(0)}m)
              </span>
            )}
            <Button onClick={submitJuris} disabled={savingJuris} className="ml-auto bg-emerald-600 hover:bg-emerald-500" size="sm" data-testid="submit-juris-btn">
              {savingJuris ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit'}
            </Button>
          </div>
        </SectionCard>

        {/* GATE: KBA */}
        <SectionCard title="2. Identity proofing (KBA)" icon={Shield} testId="kba-section">
          <p className="text-xs text-slate-400 mb-3">Take the 5-question quiz. Required by FL Stat. 117.295.</p>
          <Button onClick={() => setShowKBA(true)} className="bg-emerald-600 hover:bg-emerald-500" data-testid="open-kba-btn">
            Launch KBA quiz
          </Button>
        </SectionCard>

        {/* GATE: Witnesses (only for wills) */}
        {documentType === 'will' && (
          <SectionCard title="3. Online will — 2 witnesses" icon={Users} testId="witnesses-section">
            <p className="text-xs text-slate-400 mb-4">FL Stat. 732.522 requires 2 witnesses present on video.</p>
            {witnesses.length > 0 && (
              <div className="space-y-2 mb-4">
                {witnesses.map(w => (
                  <div key={w.witness_id} className="flex items-center gap-3 bg-slate-800/40 rounded p-3 text-xs" data-testid={`witness-row-${w.witness_id}`}>
                    <Users className="w-4 h-4 text-orange-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{w.name}</p>
                      <p className="text-slate-500">{w.email} {w.relationship ? `· ${w.relationship}` : ''}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                      w.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                    }`}>{w.status}</span>
                    {witnessLinks[w.witness_id] && (
                      <button onClick={() => navigator.clipboard.writeText(window.location.origin + witnessLinks[w.witness_id]).then(() => toast.success('Link copied'))}
                        className="text-slate-500 hover:text-emerald-400" title="Copy witness link" data-testid={`copy-witness-link-${w.witness_id}`}>
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {witnesses.length < 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <Input placeholder="Name" value={witnessForm.name} onChange={e => setWitnessForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-slate-900/60 border-slate-800 text-sm" data-testid="witness-name-input" />
                <Input type="email" placeholder="Email" value={witnessForm.email} onChange={e => setWitnessForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-slate-900/60 border-slate-800 text-sm" data-testid="witness-email-input" />
                <Input placeholder="Relationship (optional)" value={witnessForm.relationship} onChange={e => setWitnessForm(f => ({ ...f, relationship: e.target.value }))}
                  className="bg-slate-900/60 border-slate-800 text-sm" data-testid="witness-relationship-input" />
              </div>
            )}
            {witnesses.length < 2 && (
              <Button onClick={inviteWitness} className="bg-emerald-600 hover:bg-emerald-500" size="sm" data-testid="invite-witness-btn">
                <Plus className="w-3 h-3 mr-1" /> Invite witness ({witnesses.length}/2)
              </Button>
            )}
          </SectionCard>
        )}

        {/* GATE: A/V quality */}
        <SectionCard title={`${documentType === 'will' ? '4' : '3'}. A/V recording quality`} icon={Video} testId="av-section">
          <p className="text-xs text-slate-400 mb-3">Minimum 720p, 16kHz audio, 30s duration.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <FormField label="Width"><Input type="number" value={avForm.video_width} onChange={e => setAvForm(f => ({ ...f, video_width: parseInt(e.target.value) || 0 }))} className="bg-slate-900/60 border-slate-800" data-testid="av-width-input" /></FormField>
            <FormField label="Height"><Input type="number" value={avForm.video_height} onChange={e => setAvForm(f => ({ ...f, video_height: parseInt(e.target.value) || 0 }))} className="bg-slate-900/60 border-slate-800" data-testid="av-height-input" /></FormField>
            <FormField label="Audio Hz"><Input type="number" value={avForm.audio_sample_rate_hz} onChange={e => setAvForm(f => ({ ...f, audio_sample_rate_hz: parseInt(e.target.value) || 0 }))} className="bg-slate-900/60 border-slate-800" data-testid="av-audio-input" /></FormField>
            <FormField label="Duration s"><Input type="number" value={avForm.recording_duration_sec} onChange={e => setAvForm(f => ({ ...f, recording_duration_sec: parseInt(e.target.value) || 0 }))} className="bg-slate-900/60 border-slate-800" data-testid="av-duration-input" /></FormField>
          </div>
          <Button onClick={submitAV} className="bg-emerald-600 hover:bg-emerald-500" size="sm" data-testid="submit-av-btn">Report A/V</Button>
          {avResult && (
            <div className={`mt-3 p-3 rounded text-xs ${avResult.passed ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`} data-testid="av-result">
              {avResult.passed ? '✓ A/V quality OK' : `✗ Issues: ${avResult.issues.map(i => i.type).join(', ')}`}
            </div>
          )}
        </SectionCard>

        <KBAQuizModal
          open={showKBA}
          token={token}
          ceremonyId={ceremonyId}
          onPass={() => { toast.success('KBA passed'); loadReadiness(); }}
          onFail={() => loadReadiness()}
          onClose={() => setShowKBA(false)}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-gradient-to-b from-orange-950/20 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, testId, children }) {
  return (
    <Card className="bg-slate-900/60 border-slate-800 mb-4" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-orange-400" />
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ label, checked, onChange, testId }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm" data-testid={testId}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
      <span className="text-slate-300">{label}</span>
    </label>
  );
}

function Gate({ name, passed, testId }) {
  const labels = {
    jurisdiction_qualifier: 'Jurisdiction',
    kba: 'KBA',
    witnesses: 'Witnesses',
    av_quality: 'A/V quality',
  };
  return (
    <div className="flex items-center gap-2 text-xs" data-testid={testId}>
      {passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
      <span className={passed ? 'text-emerald-300' : 'text-slate-400'}>{labels[name] || name.replace(/_/g, ' ')}</span>
    </div>
  );
}
