import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Camera, CheckCircle, XCircle, AlertTriangle, Loader2, Lock, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PublicChallenge() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('intro'); // 'intro' | 'capturing' | 'submitting' | 'result' | 'invalid'
  const [result, setResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [challengerName, setChallengerName] = useState('');

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/living-identity/public-challenge/${token}/info`);
      if (!res.ok) {
        setPhase('invalid');
        setLoading(false);
        return;
      }
      const d = await res.json();
      setInfo(d);
      if (!d.valid) setPhase('invalid');
      setLoading(false);
    } catch {
      setPhase('invalid');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadInfo(); }, [loadInfo]);

  const startCapture = async () => {
    setPhase('capturing');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      setStream(s);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      toast.error('Camera access denied');
      setPhase('intro');
    }
  };

  const snap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl.split(',')[1]);
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  const submit = async () => {
    setPhase('submitting');
    try {
      const res = await fetch(`${API}/api/living-identity/public-challenge/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biometric_image: captured,
          challenger_name: challengerName || 'anonymous',
          reason: 'public-qr-verification',
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d?.detail || 'Challenge failed');
        setPhase('intro');
        return;
      }
      setResult(d);
      setPhase('result');
    } catch (e) {
      toast.error(e.message);
      setPhase('intro');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-coral-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900 px-4 py-6 flex items-center justify-center" data-testid="public-challenge-page">
      <Card className="bg-white/80 border-slate-200 max-w-md w-full" data-testid="public-challenge-card">
        <CardContent className="p-6">
          {/* HEADER */}
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-coral-600" />
            <span className="text-coral-600 text-[10px] uppercase tracking-[0.2em] font-bold">Living Identity Re-Attestation</span>
          </div>

          {phase === 'invalid' && (
            <div className="text-center py-8" data-testid="invalid-token-state">
              <XCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
              <h2 className="text-xl font-bold mb-2">Token Invalid or Expired</h2>
              <p className="text-sm text-slate-600">This authorization token is no longer valid. Ask the subject to issue a fresh challenge link.</p>
            </div>
          )}

          {phase === 'intro' && info && (
            <div data-testid="intro-state">
              <h1 className="text-2xl font-bold mb-1">Verify Identity</h1>
              <p className="text-sm text-slate-600 mb-5">
                You are about to verify the identity of <span className="text-navy-900 font-semibold">{info.subject_name || 'a subject'}</span> ({info.subject_email_masked}). NotaryChain will compare the captured biometric against their on-chain Genesis Anchor and return a confidence score.
              </p>

              <div className="bg-cream-200/40 border border-slate-300/40 rounded p-3 mb-5 text-xs space-y-1">
                <div className="flex items-center justify-between"><span className="text-slate-500">Uses remaining</span><span className="text-navy-900">{info.uses_remaining}</span></div>
                {info.expires_at && (
                  <div className="flex items-center justify-between"><span className="text-slate-500">Expires</span><span className="text-navy-900">{new Date(info.expires_at).toLocaleDateString()}</span></div>
                )}
              </div>

              <input type="text" placeholder="Your name (optional)" value={challengerName} onChange={e => setChallengerName(e.target.value)}
                className="w-full bg-cream-200 border border-slate-300 rounded px-3 py-2 text-sm mb-4" data-testid="challenger-name-input" />

              <Button onClick={startCapture} className="w-full bg-sky-600 hover:bg-sky-500 h-11" data-testid="start-challenge-btn">
                <Camera className="w-4 h-4 mr-2" /> Capture Biometric & Verify
              </Button>
              <p className="text-[10px] text-slate-500 text-center mt-3">Sealed on Hedera mainnet. No NotaryChain account required.</p>
            </div>
          )}

          {phase === 'capturing' && (
            <div data-testid="capturing-state">
              <p className="text-sm text-slate-600 mb-3">Center the subject's face in the frame.</p>
              <div className="relative aspect-[4/3] bg-black rounded overflow-hidden mb-3">
                {!captured ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <img src={`data:image/jpeg;base64,${captured}`} alt="capture" className="w-full h-full object-cover" />
                )}
                <canvas ref={canvasRef} width={640} height={480} className="hidden" />
              </div>
              <div className="flex gap-2">
                {!captured ? (
                  <Button onClick={snap} className="flex-1 bg-sky-600 hover:bg-sky-500" data-testid="snap-btn">
                    <Camera className="w-4 h-4 mr-2" /> Capture
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => { setCaptured(null); startCapture(); }} variant="outline" className="flex-1" data-testid="retake-btn">Retake</Button>
                    <Button onClick={submit} className="flex-1 bg-coral-500 hover:bg-coral-500" data-testid="submit-btn">
                      <Shield className="w-4 h-4 mr-2" /> Verify Now
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {phase === 'submitting' && (
            <div className="text-center py-12" data-testid="submitting-state">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-coral-600 mb-3" />
              <p className="text-sm text-navy-800">Comparing against on-chain Genesis Anchor…</p>
              <p className="text-[10px] text-slate-500 mt-1">GPT-5.2 Vision analysis · Hedera HCS sealing</p>
              <p className="text-[10px] text-slate-600 mt-3">This may take 30-60 seconds for the AI comparison and on-chain seal to complete.</p>
            </div>
          )}

          {phase === 'result' && result && (
            <div className="text-center py-2" data-testid="result-state">
              {result.result === 'passed' ? (
                <>
                  <CheckCircle className="w-16 h-16 mx-auto text-coral-600 mb-3" />
                  <h2 className="text-2xl font-bold text-coral-600 mb-1">Identity Verified</h2>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-16 h-16 mx-auto text-coral-600 mb-3" />
                  <h2 className="text-2xl font-bold text-coral-600 mb-1">Verification Failed</h2>
                </>
              )}
              <p className="text-sm text-slate-600 mb-4">Subject: {result.subject_email_masked}</p>

              <div className="grid grid-cols-2 gap-2 mb-4 text-left">
                <div className="bg-cream-200/40 border border-slate-300/40 rounded p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Match Confidence</p>
                  <p className="text-2xl font-bold text-navy-900">{(result.match_confidence * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-cream-200/40 border border-slate-300/40 rounded p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Trust Score</p>
                  <p className="text-2xl font-bold text-navy-900">{result.trust_score}<span className="text-sm text-slate-500"> / 100</span></p>
                </div>
              </div>

              {result.hedera_seal?.sealed && (
                <a href={result.hedera_seal.explorer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-coral-600 hover:text-coral-700" data-testid="hedera-seal-link">
                  <Lock className="w-3 h-3" /> Sealed on Hedera #{result.hedera_seal.sequence_number}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
