/**
 * Presentational primitives + config for the ANAN (Autonomous Cross-Border
 * Notarization) dashboard. Pure and state-independent — extracted from
 * ANANDashboard.jsx to shrink that file (oversized-component refactor).
 */
import React from 'react';
import { ScanFace, Eye, Lock } from 'lucide-react';

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
