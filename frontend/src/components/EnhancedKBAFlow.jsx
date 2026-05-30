/**
 * EnhancedKBAFlow — 4-step identity verification modal.
 *
 *   Step 1: Personal details (name, DOB, state) → POST /api/kba/enhanced/start
 *   Step 2: Document upload (DL / passport)     → POST /api/kba/enhanced/:id/document
 *   Step 3: Selfie capture (via getUserMedia)   → POST /api/kba/enhanced/:id/selfie
 *   Step 4: 3-question quiz                      → POST /api/kba/enhanced/answer-quiz
 *
 * Returns the audit envelope to the parent via onComplete(envelope).
 *
 * Plug-in points for production-grade verification:
 *   • Tesseract.js client-side OCR preview — see TESSERACT_PLUGIN below
 *   • face-api.js client-side face-match preview — see FACEAPI_PLUGIN below
 *   Both are CLIENT-SIDE previews only; the backend remains the source of truth.
 */
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { X, Upload, Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/kba/enhanced`;

const STEPS = ['Details', 'Document', 'Selfie', 'Quiz', 'Result'];

export default function EnhancedKBAFlow({ token, requestId, open, onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);

  // Step 1 form
  const [form, setForm] = useState({ full_name: '', dob: '', state: 'FL' });

  // Step 2 (document)
  const [docPreview, setDocPreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);

  // Step 3 (selfie)
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [selfieBlob, setSelfieBlob] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [faceResult, setFaceResult] = useState(null);

  // Step 4 (quiz)
  const [answers, setAnswers] = useState([]);

  const reset = () => {
    setStep(0); setSessionId(null); setError(null); setForm({ full_name: '', dob: '', state: 'FL' });
    setDocPreview(null); setOcrResult(null); setSelfieBlob(null); setSelfiePreview(null);
    setFaceResult(null); setAnswers([]); setResult(null); setQuestions([]);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const headers = { Authorization: `Bearer ${token}` };

  // Step 1 → start session
  const startSession = async () => {
    setLoading(true); setError(null);
    try {
      const r = await axios.post(`${API}/start`, { ...form, request_id: requestId }, { headers });
      setSessionId(r.data.session_id);
      setStep(1);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start verification');
    } finally { setLoading(false); }
  };

  // Step 2 → upload document
  const handleDocChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocPreview(URL.createObjectURL(file));
    setLoading(true); setError(null);
    try {
      // TESSERACT_PLUGIN: To run client-side OCR preview before uploading:
      //   import Tesseract from 'tesseract.js';
      //   const { data: { text } } = await Tesseract.recognize(file, 'eng');
      //   // Display extracted text in UI; backend still does authoritative OCR.
      const fd = new FormData(); fd.append('file', file);
      const r = await axios.post(`${API}/${sessionId}/document`, fd, { headers });
      setOcrResult(r.data.ocr);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.detail || 'Document upload failed');
    } finally { setLoading(false); }
  };

  // Step 3 → start camera
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      setError('Camera access denied. Please grant permission.');
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      setSelfieBlob(blob);
      setSelfiePreview(URL.createObjectURL(blob));
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }, 'image/jpeg', 0.85);
  };

  const submitSelfie = async () => {
    if (!selfieBlob) return;
    setLoading(true); setError(null);
    try {
      // FACEAPI_PLUGIN: To run client-side face-match preview before uploading:
      //   import * as faceapi from 'face-api.js';
      //   await faceapi.loadFaceLandmarkModel('/models'); /* host weights at /models */
      //   const docImg = await faceapi.bufferToImage(docFileBlob);
      //   const selfieImg = await faceapi.bufferToImage(selfieBlob);
      //   const docDesc = await faceapi.computeFaceDescriptor(docImg);
      //   const selfieDesc = await faceapi.computeFaceDescriptor(selfieImg);
      //   const distance = faceapi.euclideanDistance(docDesc, selfieDesc);
      //   // Display similarity to user; backend still does authoritative match.
      const fd = new FormData(); fd.append('file', selfieBlob, 'selfie.jpg');
      const r = await axios.post(`${API}/${sessionId}/selfie`, fd, { headers });
      setFaceResult(r.data.face_match);
      setQuestions(r.data.questions || []);
      setAnswers(new Array((r.data.questions || []).length).fill(''));
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.detail || 'Selfie upload failed');
    } finally { setLoading(false); }
  };

  // Step 4 → submit quiz
  const submitQuiz = async () => {
    setLoading(true); setError(null);
    try {
      const r = await axios.post(`${API}/answer-quiz`, { session_id: sessionId, answers }, { headers });
      setResult(r.data);
      setStep(4);
      onComplete?.(r.data.audit_envelope);
    } catch (e) {
      setError(e.response?.data?.detail || 'Quiz submission failed');
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-navy-900/70 backdrop-blur-sm flex items-center justify-center p-4" data-testid="enhanced-kba-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-coral-600" />
            <h2 className="text-navy-900 font-semibold">Identity Verification</h2>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400">{STEPS[step]}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-navy-900" data-testid="kba-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-coral-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700" data-testid="kba-error">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Details */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Enter your details exactly as they appear on your government ID.</p>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Full legal name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="kba-fullname" />
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} data-testid="kba-dob" />
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} data-testid="kba-state">
                {['FL', 'TX', 'NY', 'CA', 'VA', 'GA', 'IL', 'NC', 'OH', 'PA'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button onClick={startSession} disabled={!form.full_name || !form.dob || loading} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="kba-start-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Begin verification <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: Document */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Upload a clear photo of your driver's license or passport.</p>
              <label className="block border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-coral-300 hover:bg-coral-50/30 cursor-pointer transition-colors" data-testid="kba-doc-dropzone">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="text-sm text-slate-600 font-medium">Click to upload</span>
                <p className="text-[11px] text-slate-400 mt-1">JPG, PNG, or PDF · Max 8 MB</p>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocChange} data-testid="kba-doc-input" />
              </label>
              {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing document…</div>}
            </div>
          )}

          {/* Step 3: Selfie */}
          {step === 2 && (
            <div className="space-y-3">
              {ocrResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Document received</div>
                    <div className="opacity-80">Type: {ocrResult.document_type} · Confidence: {ocrResult.confidence}%</div>
                  </div>
                </div>
              )}
              <p className="text-sm text-slate-600">Now take a quick selfie so we can match it to your ID.</p>
              {!selfiePreview ? (
                <div className="space-y-2">
                  <div className="bg-slate-100 rounded-lg overflow-hidden aspect-[4/3]">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                  {!streamRef.current ? (
                    <Button onClick={startCamera} className="w-full bg-navy-900 text-white hover:bg-navy-800" data-testid="kba-camera-start"><Camera className="w-4 h-4 mr-2" /> Enable camera</Button>
                  ) : (
                    <Button onClick={captureSelfie} className="w-full bg-coral-500 text-white hover:bg-coral-600" data-testid="kba-capture-btn"><Camera className="w-4 h-4 mr-2" /> Capture selfie</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <img src={selfiePreview} alt="Selfie preview" className="w-full rounded-lg" />
                  <div className="flex gap-2">
                    <Button onClick={() => { setSelfieBlob(null); setSelfiePreview(null); startCamera(); }} variant="outline" className="flex-1" data-testid="kba-retake-btn"><RefreshCw className="w-4 h-4 mr-2" /> Retake</Button>
                    <Button onClick={submitSelfie} disabled={loading} className="flex-1 bg-coral-500 text-white hover:bg-coral-600" data-testid="kba-submit-selfie-btn">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Quiz */}
          {step === 3 && (
            <div className="space-y-4">
              {faceResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="font-semibold">Face matched · {faceResult.similarity}% similarity</div>
                </div>
              )}
              <p className="text-sm text-slate-600">Answer 3 quick questions to complete verification.</p>
              {questions.map((q, i) => (
                <div key={i} className="space-y-2" data-testid={`kba-question-${i}`}>
                  <p className="text-sm font-medium text-navy-900">{i + 1}. {q.q}</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {q.choices.map((c, j) => (
                      <label key={j} className={`flex items-center gap-2 p-2 border rounded-lg text-sm cursor-pointer transition-colors ${answers[i] === c ? 'border-coral-400 bg-coral-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" name={`q-${i}`} value={c} checked={answers[i] === c} onChange={() => { const a = [...answers]; a[i] = c; setAnswers(a); }} className="text-coral-500" />
                        <span>{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button onClick={submitQuiz} disabled={loading || answers.some(a => !a)} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="kba-submit-quiz-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit & complete <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 5: Result */}
          {step === 4 && result && (
            <div className="text-center py-6 space-y-3" data-testid="kba-result">
              {result.decision === 'passed' ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900">Verification complete</h3>
                  <p className="text-sm text-slate-600">Score: <span className="font-bold text-emerald-700">{result.weighted_score}/100</span></p>
                </>
              ) : result.decision === 'manual_review' ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900">Manual review needed</h3>
                  <p className="text-sm text-slate-600">Score: {result.weighted_score}/100 · Our team will follow up shortly.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900">Verification failed</h3>
                  <p className="text-sm text-slate-600">Score: {result.weighted_score}/100. Please try again with clearer photos.</p>
                </>
              )}
              <Button onClick={onClose} className="bg-navy-900 text-white hover:bg-navy-800 mt-2" data-testid="kba-done-btn">Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
