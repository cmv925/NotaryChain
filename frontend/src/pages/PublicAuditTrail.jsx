import React, { useState, useEffect } from 'react';
import {
  Shield, Link, Activity, Users, FileText, Globe, TrendingUp,
  CheckCircle, BarChart3, Lock, Zap, ArrowRight, ExternalLink,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
      className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center group hover:border-slate-700 transition-all">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${accent || 'text-slate-500'}`} />
      <div className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function SealRow({ seal }) {
  return (
    <div data-testid="seal-row" className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${seal.result === 'APPROVED' ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div>
          <span className="text-sm text-white">{seal.document_type}</span>
          <span className="text-[10px] text-slate-600 ml-2">{seal.ceremony_id}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {seal.hash && (
          <span className="text-[10px] font-mono text-sky-400/70">{seal.hash}</span>
        )}
        <span className="text-[10px] text-slate-500 uppercase bg-slate-800 px-2 py-0.5 rounded">{seal.network}</span>
        <span className="text-[11px] text-slate-500">{new Date(seal.date).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function VolumeChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-sky-500/30 hover:bg-sky-500/50 rounded-t transition-all min-h-[2px]"
            style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
            title={`${d.date}: ${d.count}`}
          />
          {i % 2 === 0 && <span className="text-[8px] text-slate-600">{d.date.slice(5)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function PublicAuditTrail() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/platform/audit-trail`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
    </div>
  );

  const stats = data?.platform_stats || {};

  return (
    <div className="min-h-screen bg-[#0a0f1a]" data-testid="public-audit-trail">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">NotaryChain Audit Trail</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Real-time, publicly verifiable platform statistics. Every notarization is sealed on Hedera Mainnet.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400">Live &middot; Updated {new Date(data?.last_updated).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="Notarizations" value={stats.total_notarizations} icon={FileText} accent="text-sky-400" />
          <StatCard label="Blockchain Seals" value={stats.blockchain_seals} icon={Link} accent="text-emerald-400" />
          <StatCard label="Approval Rate" value={`${stats.approval_rate}%`} icon={CheckCircle} accent="text-emerald-400" />
          <StatCard label="Registered Users" value={stats.registered_users} icon={Users} accent="text-violet-400" />
          <StatCard label="Platform Uptime" value={stats.platform_uptime} icon={Zap} accent="text-amber-400" />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Sealed" value={stats.sealed_ceremonies} icon={Lock} />
          <StatCard label="Escrow Agreements" value={stats.escrow_agreements} icon={Activity} />
          <StatCard label="AI Analyses" value={stats.ai_analyses_count} icon={TrendingUp} />
          <StatCard label="Documents" value={stats.documents_processed} icon={FileText} />
        </div>

        {/* Volume Chart */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Daily Volume (14 days)</h3>
            <BarChart3 className="w-4 h-4 text-slate-600" />
          </div>
          <VolumeChart data={data?.daily_volume} />
        </div>

        {/* Recent Seals */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Blockchain Seals</h3>
            <Globe className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            {data?.recent_seals?.map((seal, i) => <SealRow key={i} seal={seal} />)}
            {(!data?.recent_seals || data.recent_seals.length === 0) && (
              <p className="text-sm text-slate-600 text-center py-4">No seals yet</p>
            )}
          </div>
        </div>

        {/* Verify CTA */}
        <div className="text-center">
          <a href="/verify-certificate" data-testid="verify-link"
            className="inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors">
            <Shield className="w-4 h-4" />
            Verify a Certificate
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-[10px] text-slate-700">
          Powered by NotaryChain &middot; All data anonymized &middot; Hedera Mainnet Verified
        </div>
      </div>
    </div>
  );
}
