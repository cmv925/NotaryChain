/**
 * Presentational primitives + config for the ANAN (Autonomous Cross-Border
 * Notarization) dashboard. Pure and state-independent — extracted from
 * ANANDashboard.jsx to shrink that file (oversized-component refactor).
 */
import React from 'react';
import { ScanFace, Eye, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

export const AGENT_CONFIG = {
  verifier: { label: 'Verifier', subtitle: 'Identity & Biometrics', icon: ScanFace, weight: 0.40, color: 'cyan' },
  witness: { label: 'Witness', subtitle: 'Audit & Evidence', icon: Eye, weight: 0.30, color: 'violet' },
  sealer: { label: 'Sealer', subtitle: 'Compliance & Blockchain', icon: Lock, weight: 0.30, color: 'amber' },
};

export const STATUS_MAP = {
  pending: { label: 'Pending', cls: 'bg-slate-700/40 text-navy-800 border-slate-600' },
  in_progress: { label: 'Scoring', cls: 'bg-coral-500/20 text-coral-500 border-coral-300/40 animate-pulse' },
  sealed: { label: 'Sealed', cls: 'bg-coral-500/20 text-coral-600 border-emerald-500/40' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
  escalated: { label: 'Escalated', cls: 'bg-coral-500/20 text-coral-600 border-amber-500/40' },
};

export function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border rounded ${s.cls}`} data-testid={`anan-status-${status}`}>
      {s.label}
    </span>
  );
}

export function ScoreRing({ score, size = 64, color = 'cyan' }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * (score || 0)) / 100;
  const colorMap = { cyan: '#06b6d4', violet: '#8b5cf6', amber: '#f59e0b', emerald: '#10b981', red: '#ef4444' };
  const stroke = colorMap[color] || colorMap.cyan;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-navy-900 font-bold text-sm font-mono">{score ?? '--'}</span>
      </div>
    </div>
  );
}


export function AgentScoreCard({ agentKey, config, agent, streaming }) {
  const Icon = config.icon;
  const isRunning = agent.status === 'running' || (streaming && agent.status === 'idle');
  const hasScore = agent.score != null;
  const scoreColor = hasScore ? (agent.score >= 70 ? 'emerald' : agent.score >= 40 ? 'amber' : 'red') : config.color;

  return (
    <Card className={`bg-cream-100 transition-all duration-500 ${isRunning ? 'border-coral-300/40 ring-1 ring-coral-500/20' : hasScore && agent.score >= 60 ? 'border-coral-200' : hasScore ? 'border-red-500/30' : 'border-slate-200'}`}
      data-testid={`anan-agent-${agentKey}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/10 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 text-${config.color}-400`} />
            </div>
            <div>
              <h3 className="text-navy-900 font-semibold text-sm">{config.label} Agent</h3>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">{config.subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            {hasScore ? (
              <ScoreRing score={agent.score} size={52} color={scoreColor} />
            ) : isRunning ? (
              <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full border-2 border-slate-200 flex items-center justify-center">
                <span className="text-slate-600 text-xs">--</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-[10px]">
          <span className="text-slate-500">Weight:</span>
          <span className={`text-${config.color}-400 font-bold`}>{(config.weight * 100).toFixed(0)}%</span>
          {agent.ai_powered && <span className="bg-violet-500/20 text-coral-600 border border-violet-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">GPT-5.2</span>}
        </div>

        {agent.reasoning && (
          <p className="text-slate-600 text-[10px] leading-relaxed mb-2">{agent.reasoning}</p>
        )}

        {agent.risk_level && (
          <div className="flex items-center gap-2 text-[10px] mb-2">
            <span className="text-slate-500">Risk:</span>
            <span className={`font-bold uppercase ${agent.risk_level === 'low' ? 'text-coral-600' : agent.risk_level === 'medium' ? 'text-coral-600' : 'text-red-400'}`}>{agent.risk_level}</span>
          </div>
        )}

        {agent.checks && Object.keys(agent.checks).length > 0 && (
          <div className="space-y-1 mt-2">
            {Object.entries(agent.checks).slice(0, 4).map(([key, val]) => {
              const s = typeof val === 'object' ? val.status : 'PASS';
              return (
                <div key={key} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                  <span className={s === 'PASS' ? 'text-coral-600' : s === 'WARN' ? 'text-coral-600' : 'text-red-400'}>{s}</span>
                </div>
              );
            })}
          </div>
        )}

        {isRunning && !hasScore && (
          <div className="mt-3 flex items-center gap-2 text-coral-500 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing in isolation...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="bg-cream-100 border-slate-200">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">{label}</p>
          <p className="text-navy-900 font-bold text-sm">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-navy-900 ${mono ? 'font-mono text-[10px]' : ''}`}>{String(value || 'N/A')}</span>
    </div>
  );
}
