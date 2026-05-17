import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronLeft, AlertTriangle, CheckCircle, Loader2, Sun } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import KBAQuizModal from '../components/KBAQuizModal';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function KBATest() {
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/kba/status`, { headers: { Authorization: `Bearer ${token}` } });
      setStatus(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { if (isAuthenticated) load(); else setLoading(false); }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Shell>
        <Card className="bg-white border-slate-200 max-w-md mx-auto" data-testid="kba-test-login-required">
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold mb-1">Sign in to test KBA</h2>
            <Link to="/login"><Button className="bg-coral-500 hover:bg-coral-500 mt-3">Sign in</Button></Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto" data-testid="kba-test-page">
        <div className="flex items-center gap-2 mb-1">
          <Sun className="w-5 h-5 text-coral-600" />
          <span className="text-coral-600 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · KBA Test Harness</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Identity Verification (KBA)</h1>
        <p className="text-slate-600 text-sm mb-6">
          Test the Florida-required Knowledge-Based Authentication quiz. In production, this fires automatically during the FL ceremony pipeline.
        </p>

        {loading && <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto" />}

        {status && (
          <Card className="bg-white border-slate-200 mb-4">
            <CardContent className="p-5">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Current status</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Stat label="Provider" value={status.provider} accent={status.is_mock ? 'amber' : 'emerald'} testId="kba-provider" />
                <Stat label="Mock mode" value={status.is_mock ? 'Yes' : 'No'} accent={status.is_mock ? 'amber' : 'emerald'} />
                <Stat label="Attempts (24h)" value={`${status.attempts_in_24h} / ${status.max_attempts_in_24h}`} />
                <Stat label="Can attempt" value={status.can_attempt ? 'Yes' : 'No'} accent={status.can_attempt ? 'emerald' : 'red'} />
              </div>
              {status.is_mock && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded bg-coral-500/10 border border-gold-500/30 text-xs">
                  <AlertTriangle className="w-4 h-4 text-coral-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-coral-700 font-bold">Mock provider active</p>
                    <p className="text-slate-600 mt-1">
                      Questions are synthetic. To activate LexisNexis InstantID Q&A, add the API key to backend env vars
                      (<code className="font-mono text-coral-700">LEXISNEXIS_API_KEY</code>).
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {lastResult && (
          <Card className={`mb-4 ${lastResult.passed ? 'bg-coral-500/5 border-coral-200' : 'bg-coral-500/5 border-gold-500/30'}`} data-testid="kba-last-result">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                {lastResult.passed
                  ? <CheckCircle className="w-5 h-5 text-coral-600" />
                  : <AlertTriangle className="w-5 h-5 text-coral-600" />}
                <h3 className={`font-bold ${lastResult.passed ? 'text-coral-700' : 'text-coral-700'}`}>
                  Last attempt: {lastResult.status.toUpperCase()}
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                {lastResult.correct_count} / {lastResult.questions_count} correct · {lastResult.elapsed_seconds}s
              </p>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={() => setOpen(true)}
          disabled={!status?.can_attempt}
          className="bg-coral-500 hover:bg-coral-500"
          data-testid="kba-launch-btn"
        >
          <Shield className="w-4 h-4 mr-2" /> Launch KBA quiz
        </Button>
      </div>

      <KBAQuizModal
        open={open}
        token={token}
        onPass={(r) => { setLastResult(r); load(); }}
        onFail={(r) => { setLastResult(r); load(); }}
        onClose={() => setOpen(false)}
      />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="border-b border-slate-200 bg-cream-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-xs text-slate-600 hover:text-navy-900 inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent, testId }) {
  const colors = {
    emerald: 'text-coral-600',
    amber: 'text-coral-600',
    red: 'text-red-400',
  }[accent] || 'text-navy-900';
  return (
    <div data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${colors}`}>{value}</p>
    </div>
  );
}
