import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Loader2, Shield, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * KBA Quiz Modal — Florida-mandated 5-question identity proofing.
 *
 * Usage:
 *   <KBAQuizModal
 *     open={true}
 *     ceremonyId={ceremonyId}
 *     token={authToken}
 *     onPass={(result) => ...}
 *     onFail={(result) => ...}
 *     onClose={() => ...}
 *   />
 */
export default function KBAQuizModal({ open, ceremonyId, token, onPass, onFail, onClose }) {
  const [phase, setPhase] = useState('intro'); // intro | starting | quiz | submitting | result
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  // Load eligibility status on open
  useEffect(() => {
    if (!open || !token) return;
    fetch(`${API}/api/kba/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [open, token]);

  // Timer
  useEffect(() => {
    if (phase !== 'quiz') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submitAnswers(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [phase]);

  if (!open) return null;

  const start = async () => {
    setPhase('starting');
    try {
      const r = await fetch(`${API}/api/kba/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ceremony_id: ceremonyId || null }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.detail || 'Could not start KBA');
        setPhase('intro');
        return;
      }
      setSession(body);
      setTimeLeft(body.time_limit_seconds || 120);
      setCurrent(0);
      setAnswers({});
      setPhase('quiz');
    } catch (e) {
      toast.error(e.message);
      setPhase('intro');
    }
  };

  const submitAnswers = async (auto = false) => {
    if (!session) return;
    if (phase === 'submitting') return;
    setPhase('submitting');
    try {
      const payload = {
        session_id: session.session_id,
        answers: session.questions.map(q => ({
          question_id: q.question_id,
          selected_id: answers[q.question_id] || null,
        })),
      };
      const r = await fetch(`${API}/api/kba/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.detail || 'Submission failed');
        setPhase('quiz');
        return;
      }
      setResult(body);
      setPhase('result');
      if (body.passed) onPass?.(body); else onFail?.(body);
    } catch (e) {
      toast.error(e.message);
      setPhase('quiz');
    }
  };

  const selectAnswer = (qid, oid) => setAnswers(a => ({ ...a, [qid]: oid }));
  const allAnswered = session && session.questions.every(q => !!answers[q.question_id]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const lowTime = timeLeft <= 30;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="kba-modal">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="font-bold text-base">Identity Verification (KBA)</h2>
            {status?.is_mock && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300" data-testid="kba-mock-badge">
                Mock Mode
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close" data-testid="kba-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* INTRO */}
          {phase === 'intro' && (
            <div data-testid="kba-intro">
              <p className="text-sm text-slate-400 mb-4">
                Florida requires a quick 5-question identity verification quiz before notarization. Questions are based on your personal history.
              </p>
              <ul className="space-y-2 text-xs text-slate-300 mb-5">
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> 5 multiple-choice questions</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> 4-of-5 correct to pass</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> 2-minute time limit</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> Max 2 attempts per 24 hours (FL Stat. 117.295)</li>
              </ul>
              {status && (
                <Card className={`mb-5 ${status.can_attempt ? 'bg-slate-800/40 border-slate-700' : 'bg-red-500/10 border-red-500/30'}`}>
                  <CardContent className="p-3 text-xs">
                    <p className="text-slate-300">
                      Attempts used today: <b>{status.attempts_in_24h} / {status.max_attempts_in_24h}</b>
                    </p>
                    {!status.can_attempt && (
                      <p className="text-red-300 mt-1">You've used both attempts in the last 24 hours. Please try again later.</p>
                    )}
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">Cancel</Button>
                <Button
                  onClick={start}
                  disabled={status && !status.can_attempt}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  data-testid="kba-start-btn"
                >
                  Start verification
                </Button>
              </div>
            </div>
          )}

          {/* STARTING */}
          {phase === 'starting' && (
            <div className="py-10 text-center" data-testid="kba-starting">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Preparing your questions…</p>
            </div>
          )}

          {/* QUIZ */}
          {phase === 'quiz' && session && (
            <div data-testid="kba-quiz">
              {/* Timer + progress */}
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="text-slate-400">Question <b className="text-white">{current + 1}</b> of {session.questions.length}</div>
                <div className={`flex items-center gap-1.5 font-bold ${lowTime ? 'text-red-400' : 'text-amber-400'}`} data-testid="kba-timer">
                  <Clock className="w-3.5 h-3.5" />
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-5">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((current + 1) / session.questions.length) * 100}%` }} />
              </div>

              {/* Current question */}
              <Question
                q={session.questions[current]}
                value={answers[session.questions[current].question_id]}
                onSelect={(oid) => selectAnswer(session.questions[current].question_id, oid)}
              />

              {/* Nav */}
              <div className="flex justify-between mt-6 pt-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setCurrent(c => c - 1)}
                  className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800"
                  data-testid="kba-prev-btn"
                >
                  Previous
                </Button>
                {current < session.questions.length - 1 ? (
                  <Button
                    onClick={() => setCurrent(c => c + 1)}
                    disabled={!answers[session.questions[current].question_id]}
                    className="bg-emerald-600 hover:bg-emerald-500"
                    data-testid="kba-next-btn"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={() => submitAnswers(false)}
                    disabled={!allAnswered}
                    className="bg-emerald-600 hover:bg-emerald-500"
                    data-testid="kba-submit-btn"
                  >
                    Submit answers
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* SUBMITTING */}
          {phase === 'submitting' && (
            <div className="py-10 text-center" data-testid="kba-submitting">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Validating your answers…</p>
            </div>
          )}

          {/* RESULT */}
          {phase === 'result' && result && (
            <div className="text-center py-6" data-testid="kba-result">
              {result.passed ? (
                <>
                  <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold text-emerald-300">Identity verified ✓</h2>
                  <p className="text-sm text-slate-400 mt-1">{result.correct_count} of {result.questions_count} correct</p>
                  <p className="text-[11px] text-slate-500 mt-1">Completed in {result.elapsed_seconds}s</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold text-amber-300">
                    {result.expired ? 'Time expired' : 'Verification failed'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">{result.correct_count} of {result.questions_count} correct · required {result.min_correct}</p>
                  <p className="text-[11px] text-slate-500 mt-3">You have {Math.max(0, (status?.max_attempts_in_24h || 2) - (status?.attempts_in_24h || 0) - 1)} attempt(s) remaining today.</p>
                </>
              )}
              <Button onClick={onClose} className="mt-6 bg-emerald-600 hover:bg-emerald-500" data-testid="kba-close-btn">Close</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Question({ q, value, onSelect }) {
  return (
    <div data-testid={`kba-question-${q.question_id}`}>
      <h3 className="font-bold text-white mb-3 text-sm leading-snug">{q.prompt}</h3>
      <div className="space-y-2">
        {q.options.map(o => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
              value === o.id
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100'
                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-200'
            }`}
            data-testid={`kba-option-${q.question_id}-${o.id}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                value === o.id ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'
              }`}>
                {value === o.id && <CheckCircle className="w-3 h-3 text-slate-900" />}
              </div>
              <span className="text-sm">{o.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
