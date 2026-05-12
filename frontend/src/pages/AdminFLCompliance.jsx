import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Shield, ChevronLeft, Loader2, Gavel, BookOpen, Users, Video, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminFLCompliance() {
  const { token, isAuthenticated, user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [ceremonies, setCeremonies] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        fetch(`${API}/api/fl/admin/compliance/overview`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/api/fl/admin/compliance/ceremonies?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setOverview(o);
      setCeremonies(c.ceremonies || []);
    } catch (e) { toast.error('Load failed'); }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (isAuthenticated && user?.role === 'admin') load(); }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Shell><Card className="bg-slate-900/60 border-slate-800 max-w-md mx-auto" data-testid="admin-required"><CardContent className="p-8 text-center"><Shield className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p>Admin only</p></CardContent></Card></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto" data-testid="admin-fl-compliance-page">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 text-[10px] uppercase tracking-[0.25em] font-bold">Florida · Admin Compliance</span>
            </div>
            <h1 className="text-3xl font-bold">FL compliance dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Real-time view of FL Stat. 117 obligations across all ceremonies.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={load} variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800" data-testid="refresh-overview-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
            <Link to="/admin/subpoena"><Button className="bg-orange-600 hover:bg-orange-500" data-testid="goto-subpoena-btn"><Gavel className="w-4 h-4 mr-1" />Subpoenas {overview?.subpoenas?.open ? <span className="ml-1 bg-white/20 px-1 rounded">{overview.subpoenas.open}</span> : null}</Button></Link>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <KPI label="Journal entries" value={overview?.journal?.total ?? '—'} sub={`+${overview?.journal?.last_30d ?? 0} in 30d`} icon={BookOpen} testId="kpi-journal" />
          <KPI label="FL ceremonies" value={overview?.jurisdiction_qualifications ?? '—'} sub="with jurisdiction confirmed" icon={Shield} testId="kpi-ceremonies" />
          <KPI label="KBA pass rate" value={overview ? `${overview.kba.pass_rate}%` : '—'} sub={`${overview?.kba?.passed ?? 0}/${overview?.kba?.total_attempts ?? 0}`} icon={CheckCircle} testId="kpi-kba" />
          <KPI label="A/V pass rate" value={overview ? `${overview.av_quality.pass_rate}%` : '—'} sub={`${overview?.av_quality?.passed ?? 0}/${overview?.av_quality?.total ?? 0}`} icon={Video} testId="kpi-av" />
          <KPI label="FL notaries" value={overview?.fl_notaries ?? '—'} sub="onboarded" icon={Users} testId="kpi-notaries" />
          <KPI label="Object Lock applied" value={overview ? `${overview.retention.object_lock_applied}/${overview.retention.tags}` : '—'} sub="10-year retention" icon={Lock} testId="kpi-retention" />
          <KPI label="Open subpoenas" value={overview?.subpoenas?.open ?? '—'} sub={`${overview?.subpoenas?.total ?? 0} lifetime`} icon={Gavel} testId="kpi-subpoenas" />
          <KPI label="Generated" value={overview?.generated_at ? overview.generated_at.slice(11, 19) + 'Z' : '—'} sub="snapshot" icon={Shield} testId="kpi-generated" />
        </div>

        {/* FL ceremonies table */}
        <Card className="bg-slate-900/60 border-slate-800" data-testid="fl-ceremonies-table">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">FL Ceremonies</h2>
              <span className="text-xs text-slate-400">{ceremonies.length} shown</span>
            </div>
            {ceremonies.length === 0 && !loading && <div className="p-12 text-center text-slate-500 text-sm" data-testid="no-ceremonies">No FL ceremonies yet.</div>}
            {ceremonies.map(c => (
              <div key={c.ceremony_id} className="px-5 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 grid grid-cols-12 gap-2 text-xs items-center" data-testid={`ceremony-row-${c.ceremony_id}`}>
                <span className="col-span-3 font-mono text-slate-300 truncate">{c.ceremony_id}</span>
                <span className="col-span-3 text-slate-400 truncate">{c.user_email}</span>
                <span className="col-span-2 text-slate-500"><span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 text-[10px] uppercase tracking-wider font-bold">{(c.fl_nexus_basis || '').replace(/_/g, ' ')}</span></span>
                <span className="col-span-3 flex items-center gap-1.5">
                  <GateChip label="J" passed={c.gates.jurisdiction} title="Jurisdiction" />
                  <GateChip label="K" passed={c.gates.kba} title="KBA" />
                  <GateChip label="AV" passed={c.gates.av_quality} title="A/V" />
                  <GateChip label="L" passed={c.gates.journal_logged} title="Journal logged" />
                  {c.gates.witnesses > 0 && <span className="text-[10px] text-orange-300 ml-1">W:{c.gates.witnesses}</span>}
                </span>
                <span className="col-span-1 text-right text-slate-500 font-mono">{(c.created_at || '').slice(5, 10)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function KPI({ label, value, sub, icon: Icon, testId }) {
  return (
    <Card className="bg-slate-900/60 border-slate-800" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-orange-400" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function GateChip({ label, passed, title }) {
  return (
    <span title={title} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{label}</span>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-gradient-to-b from-orange-950/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Admin</Link>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}
