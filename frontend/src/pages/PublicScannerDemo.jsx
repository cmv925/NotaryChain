import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Upload, Loader2, ShieldCheck, ShieldAlert, ShieldX, Sparkles,
  Trash2, ArrowRight, CheckCircle2, FileImage, ChevronRight,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const RISK_STYLES = {
  low:    { c: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: ShieldCheck, label: 'Low risk' },
  medium: { c: 'text-amber-700',  bg: 'bg-gold-500/10 border-gold-500/30', icon: ShieldAlert, label: 'Medium risk' },
  high:   { c: 'text-red-700',    bg: 'bg-coral-50 border-coral-200',  icon: ShieldX,   label: 'High risk' },
};

export default function PublicScannerDemo() {
  const [pages, setPages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const onFiles = (files) => {
    Array.from(files).slice(0, 3).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => addPage(reader.result);
      reader.readAsDataURL(f);
    });
  };

  const addPage = (dataUrl) => {
    if (pages.length >= 3) { setError('Demo allows up to 3 pages per scan.'); return; }
    setPages(p => [...p, { b64: dataUrl.split(',')[1], preview: dataUrl }]);
    setError(null);
  };

  const removePage = (i) => setPages(p => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (pages.length === 0) return;
    setSubmitting(true); setError(null);
    try {
      const r = await fetch(`${API}/api/scanner/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: pages.map((p, i) => ({ image_base64: p.b64, page_number: i + 1 })) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Scan failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  };

  const reset = () => { setPages([]); setResult(null); setError(null); };

  return (
    <div className="min-h-screen bg-cream-100 font-sans text-navy-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Seal className="w-8 h-8" />
            <span className="font-serif text-xl font-bold text-navy-900">NotaryChain</span>
          </Link>
          <Link to="/signup" data-testid="demo-nav-signup">
            <button className="bg-coral-500 hover:bg-coral-600 text-white text-sm font-medium px-5 h-10 rounded-md shadow-sm">
              Get unlimited scans
            </button>
          </Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-12 sm:py-20 grid lg:grid-cols-12 gap-12 items-start" data-testid="demo-page">
        {/* LEFT: copy + uploader */}
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full bg-white border border-slate-200">
            <Sparkles className="w-3 h-3 text-coral-500" />
            <span className="text-[11px] font-semibold text-navy-900 tracking-wide">Live AI demo · GPT-5.2 Vision · No signup</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-navy-900 leading-[1.1] mb-5">
            Is this document <span className="italic text-coral-600">real?</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-7 max-w-xl">
            Drop a photo or scan of any document. In ten seconds we'll tell you whether it shows signs of tampering —
            mismatched fonts, photocopy artifacts, splicing seams, ink density anomalies, or AI-generated text patterns.
          </p>

          {!result && (
            <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-coral-500 hover:bg-cream-50 rounded-md p-10 text-center cursor-pointer transition-colors"
                data-testid="demo-drop-zone"
              >
                <FileImage className="w-10 h-10 text-slate-400 mx-auto mb-3" strokeWidth={1.5} />
                <p className="font-serif text-lg text-navy-900 mb-1">Drop up to 3 page images here</p>
                <p className="text-sm text-slate-500">Or click to browse · JPG, PNG, WEBP</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="hidden" data-testid="demo-file-input" />
              </div>

              {pages.length > 0 && (
                <div className="mt-5">
                  <div className="grid grid-cols-3 gap-2 mb-5" data-testid="demo-pages-grid">
                    {pages.map((p, i) => (
                      <div key={i} className="relative group">
                        <img src={p.preview} alt={`Page ${i + 1}`} className="w-full h-28 object-cover rounded border border-slate-200" />
                        <button onClick={() => removePage(i)} className="absolute top-1 right-1 p-1 bg-coral-500/90 rounded hover:bg-coral-600">
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                        <span className="absolute bottom-1 left-1 text-[10px] bg-navy-900/80 text-white px-1.5 py-0.5 rounded font-mono">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full h-12 bg-coral-500 hover:bg-coral-600 text-white font-medium rounded-md shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    data-testid="demo-submit-btn"
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with GPT-5.2…</> : <><Sparkles className="w-4 h-4" /> Run forgery analysis</>}
                  </button>
                </div>
              )}

              {error && <p className="text-coral-700 text-sm mt-3" data-testid="demo-error">{error}</p>}

              <p className="text-xs text-slate-500 mt-5">
                Demo limit: 5 scans per day. Your images are not stored.
                <Link to="/signup" className="text-coral-600 hover:text-coral-700 font-medium ml-1">Sign up for unlimited scans, anchoring, and persistent records →</Link>
              </p>
            </div>
          )}

          {result && (
            <DemoResult result={result} onReset={reset} />
          )}
        </div>

        {/* RIGHT: trust signal column */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="bg-navy-900 text-white rounded-md p-8 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-coral-500/15 blur-3xl" />
            <p className="text-[11px] font-semibold tracking-[0.2em] text-coral-300 uppercase mb-3">How it works</p>
            <h3 className="font-serif text-2xl mb-5">Four signal categories we look for</h3>
            <ul className="space-y-4 mb-7">
              <Sig title="Font & spacing inconsistencies" body="Mismatched typefaces, kerning, or baseline shifts that suggest layered edits." />
              <Sig title="Photocopy & splicing artifacts" body="Visible seams where one document was pasted onto another." />
              <Sig title="Ink density anomalies" body="Patches that don't match the rest of the page's ink behavior." />
              <Sig title="AI-generated content patterns" body="Pixel-level signatures left by diffusion or LLM-generated documents." />
            </ul>
            <div className="pt-5 border-t border-white/10 text-sm text-slate-300">
              <p>Powered by <strong className="text-white">GPT-5.2 Vision</strong>. Real notarial scans on the paid tier also get <strong className="text-white">Hedera mainnet anchoring</strong> for permanent, court-admissible proof.</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md p-6 mt-4">
            <p className="text-xs font-semibold tracking-[0.15em] text-slate-500 uppercase mb-2">Important caveats</p>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex gap-2"><span className="text-slate-400">·</span> Demo verdicts are advisory, not legal opinions.</li>
              <li className="flex gap-2"><span className="text-slate-400">·</span> Real forgery analysis needs originals, not photos.</li>
              <li className="flex gap-2"><span className="text-slate-400">·</span> If you suspect a real forgery, contact authorities.</li>
            </ul>
          </div>
        </aside>
      </section>

      {/* CTA strip */}
      <section className="bg-white border-t border-slate-200" data-testid="demo-cta-strip">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-3">Ready for the full thing?</h2>
          <p className="text-slate-600 mb-7 max-w-2xl mx-auto">Unlimited scans, Hedera-anchored seals, persistent records, mobile camera capture, multi-page batches, journal logging, and 10-year retention.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup">
              <button className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-6 h-12 rounded-md shadow-sm inline-flex items-center gap-2">
                Create your free account <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/trust-badge">
              <button className="bg-white border border-navy-900 text-navy-900 hover:bg-cream-200 font-medium px-6 h-12 rounded-md">
                Get the Trust Badge $29/mo
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function DemoResult({ result, onReset }) {
  const a = result.ai_analysis || {};
  const risk = RISK_STYLES[a.overall_risk || 'medium'];
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-4" data-testid="demo-result">
      <div className={`rounded-md border p-6 ${risk.bg}`}>
        <div className="flex items-start gap-4">
          <RiskIcon className={`w-10 h-10 ${risk.c} flex-shrink-0`} />
          <div className="flex-1">
            <p className={`text-xs font-semibold tracking-[0.15em] uppercase ${risk.c}`}>{risk.label} · {a.recommendation || 'manual review'}</p>
            <h3 className="font-serif text-2xl text-navy-900 mt-1 mb-2">{a.recommendation === 'accept' ? 'Likely authentic.' : a.recommendation === 'reject' ? 'Strong forgery signals.' : 'Worth a human review.'}</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{a.document_summary || 'Analysis complete.'}</p>
            <div className="mt-3 text-xs text-slate-500">
              <span>Confidence: <strong className="text-navy-900">{((a.overall_confidence || 0) * 100).toFixed(0)}%</strong></span>
              <span className="ml-4">Model: <strong className="text-navy-900">{a.model || 'GPT-5.2'}</strong></span>
              <span className="ml-4">Pages: <strong className="text-navy-900">{result.page_count}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {(a.pages || []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="demo-per-page">
          <p className="text-xs font-semibold tracking-[0.15em] text-slate-500 uppercase mb-3">Per-page findings</p>
          <div className="space-y-2">
            {a.pages.map((p, i) => {
              const pr = RISK_STYLES[p.risk || 'medium'];
              return (
                <div key={i} className="text-sm bg-cream-50 rounded p-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${pr.bg} ${pr.c}`}>Page {p.page_index + 1} · {p.risk}</span>
                  <p className="text-slate-700 mt-2">{p.page_summary || '—'}</p>
                  {(p.findings || []).length > 0 && (
                    <ul className="text-xs text-slate-500 mt-2 list-disc pl-4">
                      {p.findings.map((f, j) => <li key={j}>{f}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md p-5 text-xs" data-testid="demo-hash">
        <p className="text-slate-500 uppercase tracking-wider font-bold mb-1">Document SHA256</p>
        <p className="font-mono break-all text-navy-900">{result.document_hash}</p>
        <p className="text-slate-500 mt-3">Demos remaining today: <strong className="text-navy-900">{result.demos_remaining_today}</strong> · not anchored on Hedera</p>
      </div>

      <div className="bg-navy-900 text-white rounded-md p-6 flex items-center gap-4 flex-wrap">
        <CheckCircle2 className="w-6 h-6 text-coral-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg mb-0.5">Want this sealed on Hedera?</p>
          <p className="text-sm text-slate-300">Real scans are anchored on the public ledger, persisted, and court-admissible.</p>
        </div>
        <Link to="/signup">
          <button className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-5 h-10 rounded-md inline-flex items-center gap-2">
            Sign up <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>

      <button onClick={onReset} className="text-sm text-coral-600 hover:text-coral-700 font-medium" data-testid="demo-reset-btn">
        ← Try another scan
      </button>
    </div>
  );
}

function Sig({ title, body }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-coral-400 flex-shrink-0" />
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-slate-300 mt-0.5">{body}</p>
      </div>
    </li>
  );
}

function Seal({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#0A192F" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#D4AF37" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#D4AF37" strokeWidth="0.8" />
      <g stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
          <line key={d} x1="32" y1="5" x2="32" y2="9" transform={`rotate(${d} 32 32)`} />
        ))}
      </g>
      <path d="M32 24 L36 42 L32 45 L28 42 Z" fill="#D4AF37" />
    </svg>
  );
}
