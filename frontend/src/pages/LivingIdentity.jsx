import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Camera, Activity, AlertTriangle, CheckCircle, Loader2, RefreshCw, Lock, TrendingUp, Clock, Zap, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LivingIdentityDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCapture, setShowCapture] = useState(false);
  const [captureMode, setCaptureMode] = useState('genesis'); // 'genesis' | 'refresh' | 'challenge'
  const token = localStorage.getItem('token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/living-identity/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { navigate('/login'); return; }
      const d = await res.json();
      setData(d);
    } catch (e) {
      toast.error(`Failed to load: ${e.message}`);
    }
    setLoading(false);
  }, [token, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleCaptureComplete = async (image_b64, behavioral) => {
    const endpoint = captureMode === 'genesis' ? '/api/living-identity/anchor' : '/api/living-identity/refresh';
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          biometric_image: image_b64,
          behavioral,
          consent: captureMode === 'genesis' ? { behavioral_signals: true, third_party_challenges: true } : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        const msg = d?.detail?.message || d?.detail || 'Capture failed';
        if (typeof d?.detail === 'object' && d.detail.error === 'upgrade_required') {
          toast.error(`${msg} (Upgrade to ${d.detail.required_plan_name} — $${d.detail.required_plan_price}/mo)`);
        } else {
          toast.error(typeof msg === 'string' ? msg : 'Capture failed');
        }
        return;
      }
      if (captureMode === 'genesis') {
        toast.success('Genesis Anchor sealed on Hedera');
      } else {
        toast.success(`Refresh complete · trust ${d.trust_score} · ${d.trust_tier}`);
        if (d.drift_detected) {
          toast.warning(`Drift detected: ${(d.ai?.drift_signals || []).join(', ') || 'behavioral'}`);
        }
      }
      setShowCapture(false);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6" data-testid="living-identity-dashboard">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sky-400 text-xs uppercase tracking-[0.2em] mb-1">Trademarkable IP</p>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-sky-400" /> Living Identity
            </h1>
            <p className="text-slate-400 text-sm mt-1">Your identity is a living biometric ledger sealed on Hedera — not a snapshot.</p>
          </div>
        </div>

        {!data?.has_identity ? (
          <GenesisCTA onStart={() => { setCaptureMode('genesis'); setShowCapture(true); }} />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <TrustScoreCard identity={data.identity} onRefresh={() => { setCaptureMode('refresh'); setShowCapture(true); }} />
              <AnchorCard identity={data.identity} />
              <DriftCard events={data.drift_events || []} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ScoreHistoryCard history={data.score_history || []} />
              <SnapshotsTimelineCard snapshots={data.snapshots || []} />
            </div>
          </>
        )}

        {showCapture && (
          <CaptureModal
            mode={captureMode}
            onClose={() => setShowCapture(false)}
            onComplete={handleCaptureComplete}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════ Trust Score Ring ══════════ */

function TrustScoreCard({ identity, onRefresh }) {
  const score = identity.trust_score ?? 0;
  const tier = identity.trust_tier || 'unknown';
  const tierColors = {
    verified: '#10b981', watch: '#f59e0b', challenged: '#ef4444', revoked: '#71717a', unknown: '#71717a',
  };
  const ring = tierColors[tier];
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="bg-slate-900/60 border-slate-800 lg:col-span-1" data-testid="trust-score-card">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-sky-400" /> Identity Drift Score</CardTitle></CardHeader>
      <CardContent>
        <div className="relative w-40 h-40 mx-auto">
          <svg viewBox="0 0 160 160" className="-rotate-90 w-full h-full">
            <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="80" cy="80" r="60" fill="none" stroke={ring} strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold" style={{ color: ring }} data-testid="trust-score-value">{score}</span>
            <span className="text-[10px] tracking-[0.2em] uppercase font-bold" style={{ color: ring }}>{tier}</span>
          </div>
        </div>
        <Button onClick={onRefresh} className="w-full mt-4 bg-sky-600 hover:bg-sky-500 text-white" data-testid="refresh-identity-btn">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh Identity
        </Button>
        <p className="text-[10px] text-slate-500 text-center mt-2">Next refresh due: {fmtDate(identity.next_refresh_due)}</p>
      </CardContent>
    </Card>
  );
}

function AnchorCard({ identity }) {
  return (
    <Card className="bg-slate-900/60 border-slate-800" data-testid="anchor-card">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Genesis Anchor</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-xs">
        <KV label="Anchored" value={fmtDate(identity.anchor_created_at)} />
        <KV label="HCS Topic" value={identity.hcs_topic_id || '—'} mono />
        <KV label="Successful challenges" value={`${identity.successful_challenges} / ${identity.challenges_count || 0}`} />
        <div className="pt-2 mt-2 border-t border-slate-800">
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
            <CheckCircle className="w-3 h-3 mr-1" /> Sealed on Hedera Mainnet
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DriftCard({ events }) {
  return (
    <Card className="bg-slate-900/60 border-slate-800" data-testid="drift-card">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Drift Events</CardTitle></CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            <p className="text-xs text-slate-400">All clear — no drift detected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 5).map(e => (
              <div key={e.event_id} className="text-xs bg-slate-800/40 border border-slate-700/40 rounded p-2" data-testid={`drift-event-${e.event_id}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${severityClass(e.severity)}`}>{e.severity}</span>
                  <span className="text-slate-500 text-[10px]">{fmtDate(e.detected_at)}</span>
                </div>
                <p className="text-slate-300 text-[11px]">{(e.signals || []).join(' · ') || 'behavioral signals'}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreHistoryCard({ history }) {
  const data = history.slice(0, 30).reverse();
  const max = 100, min = 0;
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Score History</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <p className="text-xs text-slate-500 text-center py-6">Capture more refreshes to see your trust trend.</p> : (
          <div className="relative h-32 mt-2">
            <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(16,185,129,0.15)" strokeDasharray="2,2" />
              <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(245,158,11,0.15)" strokeDasharray="2,2" />
              <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(239,68,68,0.15)" strokeDasharray="2,2" />
              <polyline
                fill="none" stroke="#0ea5e9" strokeWidth="2"
                points={data.map((p, i) => `${(i / Math.max(data.length - 1, 1)) * 300},${100 - ((p.score - min) / (max - min)) * 100}`).join(' ')}
              />
              {data.map((p, i) => (
                <circle key={i} cx={(i / Math.max(data.length - 1, 1)) * 300} cy={100 - ((p.score - min) / (max - min)) * 100} r="2.5" fill="#0ea5e9" />
              ))}
            </svg>
            <div className="absolute top-0 left-0 text-[9px] text-emerald-400">90 verified</div>
            <div className="absolute top-1/2 left-0 text-[9px] text-amber-400 -translate-y-1/2">70 watch</div>
            <div className="absolute bottom-0 left-0 text-[9px] text-red-400">40 challenged</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotsTimelineCard({ snapshots }) {
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-sky-400" /> Snapshot Timeline</CardTitle></CardHeader>
      <CardContent>
        {snapshots.length === 0 ? <p className="text-xs text-slate-500 text-center py-6">No snapshots yet</p> : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {snapshots.map(s => (
              <div key={s.snapshot_id} className="bg-slate-800/40 border border-slate-700/40 rounded p-2 text-xs" data-testid={`snapshot-${s.snapshot_id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{s.trigger}</span>
                  <span className="text-[10px] text-slate-500">{fmtDate(s.captured_at)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px]">
                  <span className="text-slate-400">Score: <b className="text-white">{s.trust_score_after}</b></span>
                  <span className="text-slate-400">Match: <b className="text-white">{(s.match_to_baseline * 100).toFixed(0)}%</b></span>
                  {s.hedera_seal?.sealed && (<span className="text-amber-400">⛓ #{s.hedera_seal.sequence_number}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GenesisCTA({ onStart }) {
  return (
    <Card className="bg-gradient-to-br from-sky-950/40 to-slate-900/60 border-sky-800/40 text-center py-12 px-6" data-testid="genesis-cta">
      <Shield className="w-16 h-16 mx-auto text-sky-400 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Create Your Genesis Anchor</h2>
      <p className="text-slate-400 max-w-xl mx-auto mb-6">
        The Genesis Anchor is the immutable starting point of your Living Identity — sealed on Hedera mainnet. Once anchored, your identity becomes a continuously-verifiable credential that ages with you and detects compromise the moment it happens.
      </p>
      <Button onClick={onStart} size="lg" className="bg-sky-600 hover:bg-sky-500" data-testid="start-genesis-btn">
        <Camera className="w-4 h-4 mr-2" /> Start Genesis Capture
      </Button>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left text-xs">
        {[
          { icon: Lock, label: 'Sealed on Hedera', desc: 'Permanent on-chain record' },
          { icon: Eye, label: 'AI drift detection', desc: 'GPT-5.2 Vision compares over time' },
          { icon: Zap, label: 'Re-attestable', desc: 'Challenge anytime, anywhere' },
        ].map(f => (
          <div key={f.label} className="bg-slate-900/40 border border-slate-800 rounded p-3">
            <f.icon className="w-4 h-4 text-sky-400 mb-1.5" />
            <p className="font-medium text-slate-200 mb-0.5">{f.label}</p>
            <p className="text-slate-500 text-[11px]">{f.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════ Capture Modal (webcam) ══════════ */

function CaptureModal({ mode, onClose, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [typingStart, setTypingStart] = useState(null);
  const typingDeltas = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        toast.error('Webcam access denied');
        onClose();
      }
    };
    init();
    return () => { cancelled = true; if (stream) stream.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
    const b64 = dataUrl.split(',')[1];
    setCaptured(b64);
  };

  const handleKey = () => {
    const now = Date.now();
    if (typingStart) typingDeltas.current.push(now - typingStart);
    setTypingStart(now);
  };

  const submit = async () => {
    setSubmitting(true);
    const avg = typingDeltas.current.length > 0
      ? Math.round(typingDeltas.current.reduce((a, b) => a + b, 0) / typingDeltas.current.length)
      : null;
    const behavioral = {
      typing_cadence_ms_avg: avg,
      device_os: detectOS(),
      hour_utc: new Date().getUTCHours(),
      geo_region: detectRegion(),
    };
    await onComplete(captured, behavioral);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose} data-testid="capture-modal">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-xl w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">{mode === 'genesis' ? 'Genesis Capture' : 'Identity Refresh'}</h3>
        <p className="text-xs text-slate-400 mb-4">
          {mode === 'genesis'
            ? 'Center your face in the frame and click Capture. This will be your permanent baseline.'
            : 'Capture a fresh selfie to compare against your Genesis Anchor.'}
        </p>
        <div className="relative aspect-[4/3] bg-black rounded overflow-hidden mb-3">
          {!captured ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <img src={`data:image/jpeg;base64,${captured}`} alt="capture" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} width={640} height={480} className="hidden" />
        </div>
        <input type="text" placeholder="Type 'I confirm my identity' to capture behavioral baseline" onKeyDown={handleKey}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 mb-3" data-testid="behavioral-input" />
        <div className="flex gap-2">
          {!captured ? (
            <>
              <Button onClick={onClose} variant="outline" className="flex-1" data-testid="cancel-capture-btn">Cancel</Button>
              <Button onClick={captureSnapshot} className="flex-1 bg-sky-600 hover:bg-sky-500" data-testid="capture-btn">
                <Camera className="w-4 h-4 mr-2" /> Capture
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setCaptured(null)} variant="outline" className="flex-1" data-testid="retake-btn">Retake</Button>
              <Button onClick={submit} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500" data-testid="submit-capture-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {mode === 'genesis' ? 'Seal on Hedera' : 'Submit Refresh'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════ helpers ══════════ */

function KV({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 uppercase text-[9px] tracking-wider">{label}</span>
      <span className={`text-slate-200 ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString() + ' ' + new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

function severityClass(sev) {
  return ({
    critical: 'bg-red-600/20 text-red-300',
    high: 'bg-red-500/15 text-red-400',
    medium: 'bg-amber-500/15 text-amber-400',
    low: 'bg-slate-700/40 text-slate-300',
  })[sev] || 'bg-slate-700/40 text-slate-300';
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Win/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  return 'Unknown';
}

function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const region = tz.split('/')[0] || '';
    return region.toUpperCase().slice(0, 6);
  } catch { return 'UNKNOWN'; }
}
