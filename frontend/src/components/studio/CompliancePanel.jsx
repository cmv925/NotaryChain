import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

const SEV = {
  high: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
  low: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: AlertTriangle },
};

export const CompliancePanel = ({ compliance, onRun }) => {
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    await onRun();
    setRunning(false);
  };

  const score = compliance?.score ?? null;
  const scoreColor = score == null ? 'text-slate-400' : score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div data-testid="studio-compliance-panel">
      <p className="text-xs text-slate-500 mb-3">
        Run a <strong>Predictive Compliance Vault</strong> scan to catch risks and missing clauses before sealing.
      </p>
      <Button onClick={run} disabled={running} className="w-full bg-navy-700 hover:bg-navy-800 mb-4" data-testid="studio-run-compliance-btn">
        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
        Run Compliance Scan
      </Button>

      {compliance && (
        <div data-testid="studio-compliance-result">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 mb-3">
            <div>
              <p className="text-xs text-slate-500">Readiness Score</p>
              <p className={`text-3xl font-bold ${scoreColor}`} data-testid="studio-compliance-score">{score}<span className="text-base text-slate-400">/100</span></p>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <p className="text-red-600 font-semibold">{compliance.counts?.high || 0} high</p>
              <p className="text-amber-600">{compliance.counts?.medium || 0} medium</p>
              <p>{compliance.counts?.low || 0} low</p>
            </div>
          </div>

          {(compliance.issues || []).length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" /> No issues found — ready to seal.
            </div>
          ) : (
            <div className="space-y-2">
              {compliance.issues.map((issue, i) => {
                const conf = SEV[issue.severity] || SEV.low;
                const Icon = conf.icon;
                return (
                  <div key={i} className={`p-2.5 rounded-lg border ${conf.bg}`} data-testid={`studio-issue-${i}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 ${conf.color}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-navy-900">{issue.message}</p>
                        {issue.category && <span className={`text-[10px] ${conf.color}`}>{issue.category}</span>}
                        {issue.suggestion && <p className="text-slate-500 text-[11px] mt-1">→ {issue.suggestion}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(compliance.missing_clauses || []).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-navy-700 mb-1">Suggested missing clauses</p>
              <ul className="list-disc list-inside text-xs text-slate-500 space-y-0.5">
                {compliance.missing_clauses.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
