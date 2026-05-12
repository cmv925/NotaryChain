import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, FileImage, Trash2, Loader2, ShieldCheck, ShieldAlert, ShieldX,
  ChevronLeft, Upload, MapPin, CheckCircle, AlertTriangle, ExternalLink, Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const RISK_STYLES = {
  low: { c: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: ShieldCheck, label: 'Low risk' },
  medium: { c: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30', icon: ShieldAlert, label: 'Medium risk' },
  high: { c: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30', icon: ShieldX, label: 'High risk' },
};

export default function FieldScanner() {
  const { token, isAuthenticated } = useAuth();
  const [pages, setPages] = useState([]); // [{ b64, preview, name }]
  const [label, setLabel] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [scans, setScans] = useState([]);
  const [geo, setGeo] = useState(null);
  const [runAI, setRunAI] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadScans = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/scanner/scans?limit=10`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setScans(d.scans || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { if (isAuthenticated) loadScans(); }, [isAuthenticated, loadScans]);

  // Stop camera on unmount
  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      toast.error('Could not access camera: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const capturePage = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    addPage(dataUrl);
  };

  const onFiles = (files) => {
    Array.from(files).slice(0, 10).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => addPage(reader.result);
      reader.readAsDataURL(f);
    });
  };

  const addPage = (dataUrl) => {
    if (pages.length >= 20) { toast.error('Max 20 pages per scan'); return; }
    setPages(p => [...p, { b64: dataUrl.split(',')[1], preview: dataUrl }]);
  };

  const removePage = (i) => setPages(p => p.filter((_, idx) => idx !== i));

  const captureGeo = () => {
    if (!navigator.geolocation) { toast.error('Geolocation unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy }); toast.success('Location captured'); },
      (e) => toast.error(e.message),
      { timeout: 5000, enableHighAccuracy: false }
    );
  };

  const submitScan = async () => {
    if (pages.length === 0) { toast.error('Add at least one page'); return; }
    if (!label) { toast.error('Document label required'); return; }
    setSubmitting(true);
    try {
      const body = {
        document_label: label,
        document_type: 'scan',
        pages: pages.map((p, i) => ({ image_base64: p.b64, page_number: i + 1 })),
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
        geo_accuracy_m: geo?.accuracy_m ?? null,
        run_ai: runAI,
      };
      const r = await fetch(`${API}/api/scanner/scans`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Scan failed');
      setResult(data);
      toast.success('Scan completed');
      loadScans();
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  const sealScan = async (scanId) => {
    try {
      const r = await fetch(`${API}/api/scanner/scans/${scanId}/seal`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Seal failed');
      toast.success(data.already_sealed ? 'Already sealed' : 'Sealed on Hedera');
      // Update local result if applicable
      if (result?.scan_id === scanId) setResult(r2 => ({ ...r2, sealed: true, seal: data.seal }));
      loadScans();
    } catch (e) { toast.error(e.message); }
  };

  const reset = () => { setPages([]); setLabel(''); setResult(null); stopCamera(); };

  if (!isAuthenticated) {
    return <Shell><Card className="bg-slate-900/60 border-slate-800 max-w-md mx-auto"><CardContent className="p-8 text-center"><p>Sign in to scan documents.</p><Link to="/login"><Button className="mt-3 bg-emerald-600 hover:bg-emerald-500">Sign in</Button></Link></CardContent></Card></Shell>;
  }

  // Results view
  if (result) {
    const a = result.ai_analysis;
    const aiSkipped = a === null || a === undefined;
    const risk = aiSkipped ? { c: 'text-slate-300', bg: 'bg-slate-800/40 border-slate-700', icon: FileImage, label: 'AI check skipped' } : RISK_STYLES[a?.overall_risk || 'medium'];
    const RiskIcon = risk.icon;
    return (
      <Shell>
        <div className="max-w-3xl mx-auto" data-testid="scanner-result">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold">Scan complete</h1>
          </div>

          <Card className={`mb-4 ${risk.bg}`} data-testid="scan-risk-card">
            <CardContent className="p-5 flex items-center gap-4 flex-wrap">
              <RiskIcon className={`w-10 h-10 ${risk.c}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs uppercase tracking-wider font-bold ${risk.c}`}>
                  {aiSkipped ? 'AI check skipped' : `${risk.label} · ${a?.recommendation || 'manual_review'}`}
                </p>
                <h2 className="text-xl font-bold mt-0.5">{result.document_label}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {result.page_count} pages
                  {!aiSkipped && a && ` · confidence ${((a.overall_confidence || 0) * 100).toFixed(0)}%`}
                </p>
                {!aiSkipped && a?.document_summary && <p className="text-xs text-slate-400 mt-2">{a.document_summary}</p>}
                {!aiSkipped && a && !a.ai_powered && <p className="text-[10px] text-amber-400 mt-2">AI degraded fallback — manual review recommended</p>}
                {aiSkipped && <p className="text-[10px] text-slate-500 mt-2">You opted out of AI forgery analysis for this scan.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Hedera prior seal */}
          {result.prior_seal?.found && (
            <Card className="bg-emerald-500/5 border-emerald-500/30 mb-4" data-testid="prior-seal-card">
              <CardContent className="p-4 text-sm">
                <p className="font-bold text-emerald-300 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Already sealed on Hedera</p>
                <p className="text-xs text-slate-400 mt-1">
                  Topic {result.prior_seal.topic_id} · Seq #{result.prior_seal.sequence_number} · Sealed {result.prior_seal.sealed_at?.slice(0, 16).replace('T', ' ')}
                </p>
                {result.prior_seal.explorer_url && <a href={result.prior_seal.explorer_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline mt-1 inline-flex items-center gap-1">View on explorer <ExternalLink className="w-3 h-3" /></a>}
              </CardContent>
            </Card>
          )}

          {/* Per-page findings */}
          {(a?.pages || []).length > 0 && (
            <Card className="bg-slate-900/60 border-slate-800 mb-4">
              <CardContent className="p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Per-page findings</h3>
                <div className="space-y-2">
                  {a.pages.map((p, i) => {
                    const pr = RISK_STYLES[p.risk || 'medium'];
                    return (
                      <div key={i} className="flex items-start gap-3 text-xs bg-slate-950/40 rounded p-3" data-testid={`page-finding-${i}`}>
                        <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${pr.bg} ${pr.c}`}>Page {p.page_index + 1} · {p.risk}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300">{p.page_summary || '—'}</p>
                          {(p.findings || []).length > 0 && (
                            <ul className="mt-1 text-[11px] text-slate-400 list-disc pl-4">
                              {p.findings.map((f, j) => <li key={j}>{f}</li>)}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hash + actions */}
          <Card className="bg-slate-900/60 border-slate-800 mb-4">
            <CardContent className="p-4 text-xs">
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Document SHA256</p>
              <p className="font-mono break-all text-slate-300">{result.document_hash}</p>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mt-3 mb-1">Scan ID</p>
              <p className="font-mono text-slate-300">{result.scan_id}</p>
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap">
            {!result.sealed && !result.prior_seal?.found && (
              <Button onClick={() => sealScan(result.scan_id)} className="bg-emerald-600 hover:bg-emerald-500" data-testid="seal-scan-btn">
                <ShieldCheck className="w-4 h-4 mr-1" /> Anchor on Hedera
              </Button>
            )}
            {result.sealed && (
              <span className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-300" data-testid="scan-sealed">
                <CheckCircle className="w-4 h-4" /> Sealed · Seq #{result.seal?.sequence_number}
              </span>
            )}
            <Button onClick={reset} variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800" data-testid="new-scan-btn">New scan</Button>
          </div>
        </div>
      </Shell>
    );
  }

  // Capture view
  return (
    <Shell>
      <div className="max-w-3xl mx-auto" data-testid="field-scanner-page">
        <div className="flex items-center gap-2 mb-1">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 text-[10px] uppercase tracking-[0.25em] font-bold">Field Document Scanner</span>
        </div>
        <h1 className="text-3xl font-bold">Scan a document</h1>
        <p className="text-slate-400 text-sm mt-1 mb-6">Capture each page, anchor on Hedera, and get AI tampering analysis.</p>

        <Card className="bg-slate-900/60 border-slate-800 mb-4">
          <CardContent className="p-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Document label *</label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Warranty deed - 123 Oak St" className="bg-slate-950/60 border-slate-800" data-testid="scan-label" />
            </div>

            {/* Camera */}
            {cameraOn ? (
              <div className="space-y-2">
                <video ref={videoRef} className="w-full rounded-lg bg-black" autoPlay playsInline muted data-testid="camera-video" />
                <div className="flex gap-2">
                  <Button onClick={capturePage} className="flex-1 bg-emerald-600 hover:bg-emerald-500" data-testid="capture-page-btn">
                    <Camera className="w-4 h-4 mr-1" /> Capture page ({pages.length})
                  </Button>
                  <Button onClick={stopCamera} variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800" data-testid="stop-camera-btn">Done</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-500" data-testid="open-camera-btn">
                  <Camera className="w-4 h-4 mr-1" /> Open camera
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800" data-testid="upload-page-btn">
                  <Upload className="w-4 h-4 mr-1" /> Upload images
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => onFiles(e.target.files)} className="hidden" data-testid="file-input" />
                <Button onClick={captureGeo} variant="outline" className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800" data-testid="capture-geo-btn">
                  <MapPin className="w-4 h-4 mr-1" /> {geo ? `${geo.lat.toFixed(3)},${geo.lng.toFixed(3)}` : 'Add location'}
                </Button>
                <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer ml-auto">
                  <input type="checkbox" checked={runAI} onChange={e => setRunAI(e.target.checked)} className="w-4 h-4 accent-emerald-500" data-testid="run-ai-toggle" />
                  AI forgery check
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Page list */}
        {pages.length > 0 && (
          <Card className="bg-slate-900/60 border-slate-800 mb-4" data-testid="pages-list">
            <CardContent className="p-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">{pages.length} page{pages.length > 1 ? 's' : ''} ready</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pages.map((p, i) => (
                  <div key={i} className="relative group" data-testid={`page-thumb-${i}`}>
                    <img src={p.preview} alt={`Page ${i + 1}`} className="w-full h-24 object-cover rounded border border-slate-700" />
                    <button onClick={() => removePage(i)} className="absolute top-1 right-1 p-1 bg-red-500/80 rounded hover:bg-red-500" data-testid={`remove-page-${i}`}>
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">#{i + 1}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={submitScan} disabled={submitting || pages.length === 0 || !label} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500" data-testid="submit-scan-btn">
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" /> Run scan + AI check</>}
        </Button>

        {/* Recent scans */}
        {scans.length > 0 && (
          <Card className="bg-slate-900/60 border-slate-800 mt-8" data-testid="recent-scans">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-slate-800">
                <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Recent scans</h3>
              </div>
              {scans.map(s => {
                const risk = RISK_STYLES[s.ai_analysis?.overall_risk || 'medium'];
                return (
                  <button key={s.scan_id} onClick={() => setResult(s)} className="w-full px-5 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 grid grid-cols-12 gap-2 text-xs items-center text-left" data-testid={`scan-row-${s.scan_id}`}>
                    <FileImage className="w-4 h-4 text-emerald-400 col-span-1" />
                    <span className="col-span-4 text-white font-medium truncate">{s.document_label}</span>
                    <span className="col-span-2 text-slate-500 font-mono">{s.page_count}pg</span>
                    <span className={`col-span-2 ${risk.c}`}>{risk.label}</span>
                    <span className="col-span-2 text-slate-500 font-mono">{s.sealed ? '⛓ sealed' : (s.prior_seal?.found ? '⛓ prior' : '—')}</span>
                    <span className="col-span-1 text-right text-slate-500">{(s.created_at || '').slice(5, 10)}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-gradient-to-b from-emerald-950/20 to-transparent">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-8">{children}</div>
    </div>
  );
}
