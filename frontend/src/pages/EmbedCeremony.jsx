/**
 * EmbedCeremony — iframe-friendly chrome-less ceremony view.
 * Mounted at /embed/ceremony/:token
 *
 * Designed to be loaded inside an iframe spawned by the NotaryChain SDK.
 * Bridges progress events to the parent window via postMessage.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Shield, FileText, Loader2, CheckCircle2, AlertCircle, Camera, KeyRound, Pen, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const postToParent = (type, payload = {}) => {
  try {
    window.parent.postMessage({ source: 'notarychain-embed', type, payload }, '*');
  } catch (e) {
    // ignore
  }
};

const STEPS = [
  { id: 'identity', label: 'Identity Verification', icon: KeyRound, desc: 'Knowledge-Based Authentication' },
  { id: 'review', label: 'Review Document', icon: FileText, desc: 'Confirm the document to sign' },
  { id: 'capture', label: 'Live Witness Capture', icon: Camera, desc: 'Video + microphone verification' },
  { id: 'sign', label: 'Apply Signature', icon: Pen, desc: 'Digital signature with timestamp' },
  { id: 'seal', label: 'Blockchain Seal', icon: Lock, desc: 'Anchored on Hedera HCS' },
];

export default function EmbedCeremony() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [sealing, setSealing] = useState(false);
  const [done, setDone] = useState(null); // { seal_hash, hcs_tx }

  useEffect(() => {
    axios.get(`${API}/sdk/sessions/${token}`)
      .then(r => {
        setSession(r.data);
        postToParent('ready', { token });
      })
      .catch(e => {
        const detail = e.response?.data?.detail || 'Session not found or expired';
        setError(detail);
        postToParent('error', { error: detail });
      });
  }, [token]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      if (step + 1 === STEPS.length - 1) sealNow();
    }
  };

  const sealNow = async () => {
    setSealing(true);
    try {
      // Simulated ceremony progress event (in production, this triggers actual ceremony pipeline)
      await axios.post(`${API}/sdk/sessions/${token}/event`, {
        type: 'ceremony.started',
        payload: { ceremony_id: `cer_${token.slice(0, 12)}` },
      });
      postToParent('signed', { token });

      // Simulate seal (in production, calls /api/ceremony/seal-fl etc.)
      const fakeHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64);
      const fakeTx = `0.0.${Math.floor(Math.random() * 9000000) + 1000000}@${Date.now()}.${Math.floor(Math.random() * 1e9)}`;

      await new Promise(r => setTimeout(r, 1600));
      await axios.post(`${API}/sdk/sessions/${token}/event`, {
        type: 'ceremony.completed',
        payload: { token, seal_hash: fakeHash },
      });

      await axios.post(`${API}/sdk/sessions/${token}/event`, {
        type: 'ceremony.sealed',
        payload: { seal_hash: fakeHash, hcs_tx: fakeTx },
      });

      setDone({ seal_hash: fakeHash, hcs_tx: fakeTx });
      postToParent('completed', { seal_hash: fakeHash });
      postToParent('sealed', { seal_hash: fakeHash, hcs_tx: fakeTx });
    } catch (e) {
      setError(e.response?.data?.detail || 'Ceremony failed');
      postToParent('error', { error: 'ceremony_failed' });
    } finally {
      setSealing(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center" data-testid="embed-error">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-navy-900 mb-2">Unable to start ceremony</h2>
          <p className="text-slate-600 text-sm">{error}</p>
          <Button onClick={() => postToParent('close', {})} className="mt-6 bg-navy-900 hover:bg-navy-800 text-cream-100" data-testid="embed-close-btn">
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-10 text-center" data-testid="embed-success">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="font-serif text-3xl text-navy-900 mb-2">Sealed on-chain</h2>
          <p className="text-slate-600 text-sm mb-6">Your document has been notarized and anchored to Hedera.</p>
          <div className="text-left bg-cream-50 border border-slate-200 rounded-lg p-4 mb-6 space-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Seal hash</div>
              <code className="text-[11px] font-mono text-navy-900 break-all">{done.seal_hash}</code>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Hedera transaction</div>
              <code className="text-[11px] font-mono text-navy-900 break-all">{done.hcs_tx}</code>
            </div>
          </div>
          <Button onClick={() => postToParent('close', {})} className="bg-coral-500 hover:bg-coral-600 text-white w-full" data-testid="embed-done-btn">
            Done
          </Button>
          <p className="text-[10px] text-slate-500 mt-5">Powered by NotaryChain · This window will close automatically.</p>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col" data-testid="embed-ceremony">
      <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-coral-600" />
          <span className="text-sm font-semibold text-navy-900">NotaryChain Ceremony</span>
          {session.mode === 'test' && (
            <span className="ml-2 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">TEST MODE</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          Step {step + 1} of {STEPS.length}
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-[280px,1fr]">
        {/* Stepper */}
        <aside className="bg-cream-50 border-r border-slate-200 p-6 hidden md:block">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-4">Ceremony Progress</h3>
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const SIcon = s.icon;
              const isDone = i < step;
              const isActive = i === step;
              return (
                <li key={s.id} className={`flex items-start gap-3 ${isActive ? '' : 'opacity-60'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    isDone ? 'bg-emerald-500 border-emerald-600 text-white' :
                    isActive ? 'bg-coral-500 border-coral-600 text-white' :
                    'bg-white border-slate-300 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <SIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="pt-0.5">
                    <div className={`text-sm font-medium ${isActive ? 'text-navy-900' : 'text-slate-700'}`}>{s.label}</div>
                    <div className="text-[11px] text-slate-500">{s.desc}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Main */}
        <main className="p-8 md:p-12 flex flex-col">
          <div className="max-w-xl">
            <div className="w-12 h-12 rounded-lg bg-coral-50 border border-coral-200 flex items-center justify-center mb-5">
              <Icon className="w-6 h-6 text-coral-600" />
            </div>
            <h1 className="font-serif text-4xl text-navy-900 mb-2 tracking-tight">{current.label}</h1>
            <p className="text-slate-600 text-base mb-2">{current.desc}</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-8">For: <span className="text-navy-900">{session.document_name}</span></p>

            {step === STEPS.length - 1 && sealing && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-coral-500 animate-spin" />
                <div>
                  <div className="text-sm font-medium text-navy-900">Anchoring to Hedera mainnet…</div>
                  <div className="text-[11px] text-slate-500">This typically takes 3–5 seconds</div>
                </div>
              </div>
            )}

            {step < STEPS.length - 1 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                <p className="text-sm text-slate-700 leading-relaxed mb-4">
                  {step === 0 && 'You will be asked a series of identity verification questions sourced from public records.'}
                  {step === 1 && 'Please review the document carefully. By proceeding, you confirm you have read and understood it.'}
                  {step === 2 && 'Allow camera and microphone access so a live record of this signing can be captured.'}
                  {step === 3 && 'Draw or type your signature. It will be cryptographically bound to the document.'}
                </p>
                <div className="text-[10px] text-slate-500 italic">
                  This embedded demo simulates the full ceremony for SDK integration testing. In production, each step invokes the live KBA, A/V, signature, and Hedera pipelines.
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {step < STEPS.length - 1 ? (
                <Button onClick={next} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="embed-next-btn">
                  {step === 0 ? 'Start Identity Quiz' : step === 1 ? 'I confirm the document' : step === 2 ? 'Grant access & continue' : 'Sign now'}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => postToParent('close', {})} className="border-slate-300 text-slate-700 hover:bg-cream-200/40" data-testid="embed-cancel-btn">
                Cancel
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
