import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  ShieldCheck, AlertTriangle, FileSearch, GitBranch, FileText,
  Activity, RefreshCw, Download, CheckCircle2, XCircle, Clock,
  Sparkles, Scale, Network, Zap, ArrowRight, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/pcv`;

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
  { id: 'regulatory', label: 'Regulatory', icon: Scale },
  { id: 'remediation', label: 'Remediation', icon: Sparkles },
  { id: 'graph', label: 'Portfolio Graph', icon: Network },
  { id: 'evidence', label: 'Evidence Packets', icon: FileText },
];

export default function PCVDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/dashboard`, { headers });
      setDashboard(res.data);
    } catch (e) {
      toast.error('Failed to load PCV dashboard');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { fetchDashboard(); }, []);

  return (
    <div className="min-h-screen bg-cream-100" data-testid="pcv-dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-coral-600 uppercase mb-2">Enterprise Feature</p>
              <h1 className="font-serif text-3xl sm:text-4xl text-navy-900 mb-2">Predictive Compliance Vault</h1>
              <p className="text-slate-600 max-w-2xl">
                Continuous integrity scanning, regulatory-change intelligence, AI-driven remediation, and
                court-ready evidence packets — all anchored to Hedera mainnet.
              </p>
            </div>
            <Button variant="outline" onClick={fetchDashboard} disabled={loading} data-testid="pcv-refresh-btn">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                data-testid={`pcv-tab-${t.id}`}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                  active ? 'border-coral-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && <OverviewTab dashboard={dashboard} loading={loading} onRefresh={fetchDashboard} headers={headers} />}
        {activeTab === 'integrity' && <IntegrityTab headers={headers} onChanged={fetchDashboard} />}
        {activeTab === 'regulatory' && <RegulatoryTab headers={headers} onChanged={fetchDashboard} />}
        {activeTab === 'remediation' && <RemediationTab headers={headers} onChanged={fetchDashboard} />}
        {activeTab === 'graph' && <GraphTab headers={headers} onChanged={fetchDashboard} dashboard={dashboard} />}
        {activeTab === 'evidence' && <EvidenceTab headers={headers} onChanged={fetchDashboard} />}
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
function OverviewTab({ dashboard, loading, onRefresh, headers }) {
  if (loading || !dashboard) {
    return <div className="text-slate-500 py-12 text-center">Loading dashboard…</div>;
  }
  const { portfolio, integrity, compliance, remediation, evidence } = dashboard;
  const scoreColor = portfolio.integrity_score >= 80 ? 'text-emerald-600' : portfolio.integrity_score >= 60 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-6" data-testid="pcv-overview">
      {/* Hero KPI cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Documents in Portfolio" value={portfolio.document_count} icon={FileSearch} accent="navy" />
        <KPI label="Portfolio Integrity Score" value={`${portfolio.integrity_score}/100`} icon={ShieldCheck} accent={portfolio.integrity_score >= 80 ? 'emerald' : 'coral'} highlight={scoreColor} />
        <KPI label="Open Integrity Issues" value={integrity.open_issues} sub={`${integrity.critical_issues} critical`} icon={AlertTriangle} accent={integrity.critical_issues > 0 ? 'coral' : 'slate'} />
        <KPI label="Pending Remediations" value={remediation.pending} sub={`${remediation.completed} completed`} icon={Sparkles} accent="navy" />
      </div>

      {/* Compliance breakdown */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-4">Compliance Score Breakdown</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <ScoreBlock label="Passing" value={compliance.passing} color="emerald" />
            <ScoreBlock label="Warning" value={compliance.warning} color="amber" />
            <ScoreBlock label="Failing" value={compliance.failing} color="rose" />
          </div>
        </CardContent>
      </Card>

      {/* Graph + Evidence cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg text-navy-900">Portfolio Integrity Graph</h3>
              <Network className="w-5 h-5 text-coral-500" />
            </div>
            {portfolio.graph_root ? (
              <>
                <p className="text-xs text-slate-500 mb-2">Merkle root (latest build)</p>
                <code className="text-[10px] text-coral-700 break-all block mb-3 bg-cream-200/50 p-2 rounded">{portfolio.graph_root}</code>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{portfolio.graph_node_count} nodes anchored</span>
                  <span className="text-slate-500 text-xs">{portfolio.graph_built_at?.slice(0, 19)}</span>
                </div>
                {portfolio.graph_anchor_tx ? (
                  <Badge className="mt-3 bg-emerald-100 text-emerald-800 border-emerald-200">Anchored to Hedera</Badge>
                ) : (
                  <Badge className="mt-3 bg-amber-100 text-amber-800 border-amber-200">Pending Hedera anchor</Badge>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No graph built yet. Visit Portfolio Graph tab.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg text-navy-900">Evidence Packets</h3>
              <FileText className="w-5 h-5 text-coral-500" />
            </div>
            <p className="text-3xl font-serif text-navy-900 mb-2">{evidence.packets_generated}</p>
            <p className="text-sm text-slate-500 mb-3">Court-ready packets generated</p>
            <p className="text-xs text-slate-500">Every packet is anchored to Hedera mainnet and publicly verifiable.</p>
          </CardContent>
        </Card>
      </div>

      {/* Why PCV matters */}
      <Card className="bg-navy-900 text-white border-0">
        <CardContent className="p-6 sm:p-8">
          <p className="text-xs font-bold tracking-[0.2em] text-coral-300 uppercase mb-3">Why PCV matters</p>
          <h3 className="font-serif text-xl sm:text-2xl mb-4">Continuous, portfolio-wide compliance.</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-200">
            <FeatureBullet text="Every notarized document re-hashed daily and cross-checked against its Hedera anchor." />
            <FeatureBullet text="Regulatory changes auto-rescored across the whole portfolio." />
            <FeatureBullet text="AI drafts remediation plans for non-compliant documents — your team just approves." />
            <FeatureBullet text="Single-click evidence packet for litigation, with cryptographic proof." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, accent = 'navy', highlight }) {
  const ring = { navy: 'ring-navy-900/10', coral: 'ring-coral-500/30', emerald: 'ring-emerald-500/30', slate: 'ring-slate-300' }[accent];
  return (
    <Card className={`border-slate-200 ring-1 ${ring}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-bold tracking-wider uppercase text-slate-500">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        </div>
        <p className={`text-3xl font-serif ${highlight || 'text-navy-900'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreBlock({ label, value, color }) {
  const map = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
  };
  return (
    <div className={`border rounded-md p-4 ${map[color]}`}>
      <p className="text-xs font-bold tracking-wider uppercase mb-1">{label}</p>
      <p className="text-2xl font-serif">{value}</p>
    </div>
  );
}

function FeatureBullet({ text }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 text-coral-300 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

// ─── INTEGRITY TAB ──────────────────────────────────────────────────────────
function IntegrityTab({ headers, onChanged }) {
  const [issues, setIssues] = useState([]);
  const [scans, setScans] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [iss, sc] = await Promise.all([
        axios.get(`${API}/integrity/issues`, { headers }),
        axios.get(`${API}/integrity/scans?limit=10`, { headers }),
      ]);
      setIssues(iss.data.issues || []);
      setScans(sc.data.scans || []);
    } catch (e) {
      toast.error('Failed to load integrity data');
    }
  }, [headers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/integrity/scan`, {}, { headers });
      toast.success(`Scan complete — ${res.data.scan.documents_scanned} docs scanned, ${res.data.scan.issues_found} issues`);
      await load();
      onChanged();
    } catch (e) {
      toast.error('Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async (issueId) => {
    try {
      await axios.post(`${API}/integrity/issues/${issueId}/acknowledge`, { note: 'Reviewed' }, { headers });
      toast.success('Issue acknowledged');
      await load();
    } catch (e) {
      toast.error('Acknowledge failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="pcv-integrity">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Background Integrity Daemon</h2>
          <p className="text-sm text-slate-600 mt-1">Re-hashes every document and cross-checks against its Hedera anchor.</p>
        </div>
        <Button onClick={runScan} disabled={busy} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="pcv-run-scan-btn">
          <Zap className="w-4 h-4 mr-2" />
          {busy ? 'Scanning…' : 'Run Scan Now'}
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-3">Recent Scans</h3>
          {scans.length === 0 ? (
            <p className="text-sm text-slate-500">No scans yet. Click "Run Scan Now" to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 font-medium">Started</th>
                    <th className="py-2 font-medium">Docs Scanned</th>
                    <th className="py-2 font-medium">Issues Found</th>
                    <th className="py-2 font-medium">Duration</th>
                    <th className="py-2 font-medium">Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2.5 text-slate-700">{s.started_at?.slice(0, 19)}</td>
                      <td className="py-2.5 text-slate-700">{s.documents_scanned}</td>
                      <td className="py-2.5">
                        <span className={s.issues_found > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600'}>
                          {s.issues_found}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">{s.duration_seconds?.toFixed(2)}s</td>
                      <td className="py-2.5 text-slate-500">{s.triggered_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-3">Open Issues</h3>
          {issues.length === 0 ? (
            <p className="text-sm text-emerald-600">✓ No open integrity issues — portfolio is intact.</p>
          ) : (
            <div className="space-y-2">
              {issues.map((iss) => (
                <div key={iss.id} className="border border-slate-200 rounded-md p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={iss.severity === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                        {iss.severity}
                      </Badge>
                      <span className="text-xs text-slate-500">{iss.kind}</span>
                    </div>
                    <p className="text-sm text-navy-900 font-medium">Ceremony {iss.notarization_id?.slice(0, 12)}…</p>
                    <div className="text-xs text-slate-500 mt-1 font-mono break-all">
                      Recorded: {iss.recorded_hash?.slice(0, 24)}… → Current: {iss.current_hash?.slice(0, 24)}…
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => acknowledge(iss.id)}>Acknowledge</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── REGULATORY TAB ─────────────────────────────────────────────────────────
function RegulatoryTab({ headers, onChanged }) {
  const [rules, setRules] = useState([]);
  const [changes, setChanges] = useState([]);
  const [scores, setScores] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, c, s] = await Promise.all([
        axios.get(`${API}/regulatory/rules`, { headers }),
        axios.get(`${API}/regulatory/changes`, { headers }),
        axios.get(`${API}/compliance/scores?limit=20`, { headers }),
      ]);
      setRules(r.data.rules || []);
      setChanges(c.data.changes || []);
      setScores(s.data.scores || []);
    } catch (e) {
      toast.error('Failed to load regulatory data');
    }
  }, [headers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { load(); }, []);

  const seedRules = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/regulatory/seed`, {}, { headers });
      toast.success('Baseline rules seeded');
      await load();
    } catch (e) {
      toast.error('Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const rescore = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/regulatory/rescore`, {}, { headers });
      toast.success(`Re-scored ${res.data.scored} docs — ${res.data.flagged} flagged`);
      await load();
      onChanged();
    } catch (e) {
      toast.error('Re-score failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="pcv-regulatory">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Regulatory Oracle Network</h2>
          <p className="text-sm text-slate-600 mt-1">Monitors state RON statutes, court precedents, and e-signature laws. Re-scores portfolio when rules change.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={seedRules} disabled={busy} data-testid="pcv-seed-rules-btn">Seed Rules</Button>
          <Button onClick={rescore} disabled={busy} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="pcv-rescore-btn">
            <RefreshCw className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
            Re-score Portfolio
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-3">Active Regulatory Rules ({rules.length})</h3>
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="border border-slate-200 rounded-md p-3 flex items-start gap-3">
                <Badge className="bg-navy-900 text-cream-100 border-0 flex-shrink-0">{r.jurisdiction}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">{r.title}</p>
                  <p className="text-xs text-coral-700 font-mono">{r.citation}</p>
                  <p className="text-xs text-slate-600 mt-1">{r.summary}</p>
                </div>
                <Badge className={`flex-shrink-0 ${r.severity === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-200' : r.severity === 'high' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {r.severity}
                </Badge>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-slate-500">No rules loaded. Click "Seed Rules" to load the FL/TX/NY/CA/VA baseline.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-navy-900 mb-3">Recent Compliance Scores</h3>
            {scores.length === 0 ? (
              <p className="text-sm text-slate-500">No scores yet. Click "Re-score Portfolio".</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scores.map((s) => (
                  <div key={s.notarization_id} className="flex items-center justify-between text-sm border-b border-slate-100 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 flex-shrink-0">{s.state_code}</Badge>
                      <span className="text-slate-700 truncate">{s.notarization_id?.slice(0, 14)}…</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-medium ${s.status === 'passing' ? 'text-emerald-600' : s.status === 'warning' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {s.score}
                      </span>
                      <Badge className={s.status === 'passing' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : s.status === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-navy-900 mb-3">Regulatory Change Feed</h3>
            {changes.length === 0 ? (
              <p className="text-sm text-slate-500">No regulatory changes logged.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {changes.map((c) => (
                  <div key={c.id} className="border-b border-slate-100 py-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-coral-100 text-coral-800 border-coral-200">{c.change_kind}</Badge>
                      <span className="text-xs text-slate-500">{c.detected_at?.slice(0, 10)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{c.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── REMEDIATION TAB ────────────────────────────────────────────────────────
function RemediationTab({ headers, onChanged }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const url = filter === 'all' ? `${API}/remediation/tasks` : `${API}/remediation/tasks?status=${filter}`;
      const res = await axios.get(url, { headers });
      setTasks(res.data.tasks || []);
    } catch (e) {
      toast.error('Failed to load remediation tasks');
    }
  }, [headers, filter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { load(); }, [filter]);

  const draft = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/remediation/draft-all`, {}, { headers });
      toast.success(`${res.data.tasks_created} new remediation tasks drafted`);
      await load();
      onChanged();
    } catch (e) {
      toast.error('Draft failed');
    } finally {
      setBusy(false);
    }
  };

  const action = async (taskId, kind) => {
    try {
      await axios.post(`${API}/remediation/tasks/${taskId}/${kind}`, { note: '' }, { headers });
      toast.success(`Task ${kind}d`);
      setSelected(null);
      await load();
      onChanged();
    } catch (e) {
      toast.error(`${kind} failed`);
    }
  };

  return (
    <div className="space-y-6" data-testid="pcv-remediation">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Smart Remediation Agent</h2>
          <p className="text-sm text-slate-600 mt-1">AI drafts step-by-step fixes for non-compliant documents. Your team approves.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            data-testid="pcv-task-filter"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button onClick={draft} disabled={busy} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="pcv-draft-btn">
            <Sparkles className="w-4 h-4 mr-2" />
            Draft for Low Scores
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks found.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="border border-slate-200 rounded-md hover:border-coral-300 transition-colors">
                  <button
                    onClick={() => setSelected(selected?.id === t.id ? null : t)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className="bg-navy-900 text-cream-100 border-0">{t.state_code}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">{t.document_type} · score {t.current_score}/100</p>
                        <p className="text-xs text-slate-500 truncate">{t.ai_summary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={t.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : t.status === 'approved' ? 'bg-blue-100 text-blue-800 border-blue-200' : t.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}>
                        {t.status}
                      </Badge>
                      <ArrowRight className={`w-4 h-4 text-slate-400 transition-transform ${selected?.id === t.id ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {selected?.id === t.id && (
                    <div className="border-t border-slate-200 p-4 bg-cream-200/30">
                      <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2">Plan steps ({t.plan_steps.length})</p>
                      <ol className="space-y-3 mb-4">
                        {t.plan_steps.map((step, i) => (
                          <li key={i} className="text-sm">
                            <div className="flex items-start gap-2">
                              <span className="font-serif text-lg text-coral-600 flex-shrink-0 w-6">{i + 1}.</span>
                              <div>
                                <p className="font-medium text-navy-900">{step.title} <span className="text-xs text-coral-700 font-mono">{step.rule_id}</span></p>
                                <p className="text-slate-700 mt-1">{step.action}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {t.status === 'pending' && (
                        <div className="flex gap-2 pt-3 border-t border-slate-200">
                          <Button size="sm" onClick={() => action(t.id, 'approve')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                          </Button>
                          <Button size="sm" onClick={() => action(t.id, 'reject')} variant="outline">
                            <XCircle className="w-4 h-4 mr-1.5" /> Reject
                          </Button>
                          <Button size="sm" onClick={() => action(t.id, 'complete')} variant="outline">
                            Mark complete
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PORTFOLIO GRAPH TAB ────────────────────────────────────────────────────
function GraphTab({ headers, onChanged, dashboard }) {
  const [graph, setGraph] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/portfolio/graph`, { headers });
      setGraph(res.data);
    } catch (e) {
      toast.error('Failed to load graph');
    }
  }, [headers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { load(); }, []);

  const rebuild = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/portfolio/graph/rebuild`, {}, { headers });
      toast.success('Graph rebuilt');
      await load();
      onChanged();
    } catch (e) {
      toast.error('Rebuild failed');
    } finally {
      setBusy(false);
    }
  };

  const anchorHedera = async () => {
    if (!graph?.anchor?.id) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/portfolio/graph/${graph.anchor.id}/anchor-hedera`, {}, { headers });
      toast.success(`Anchored: ${res.data.transaction_id?.slice(0, 20)}…`);
      await load();
      onChanged();
    } catch (e) {
      toast.error('Anchor failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="pcv-graph">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Portfolio Integrity Graph</h2>
          <p className="text-sm text-slate-600 mt-1">Merkle DAG over every notarized document. Proves the entire portfolio has remained unchanged as a set.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={rebuild} disabled={busy} variant="outline" data-testid="pcv-rebuild-graph-btn">
            <GitBranch className="w-4 h-4 mr-2" />
            Rebuild Graph
          </Button>
          {graph?.anchor?.id && !graph?.anchor?.hedera_transaction_id && (
            <Button onClick={anchorHedera} disabled={busy} className="bg-coral-500 hover:bg-coral-600 text-white">
              <Network className="w-4 h-4 mr-2" />
              Anchor to Hedera
            </Button>
          )}
        </div>
      </div>

      {graph?.anchor ? (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Merkle Root</p>
                <code className="text-[10px] text-coral-700 break-all block bg-cream-200/50 p-2 rounded">{graph.anchor.root}</code>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-1">Hedera Anchor</p>
                {graph.anchor.hedera_transaction_id ? (
                  <code className="text-[10px] text-emerald-700 break-all block bg-emerald-50 p-2 rounded">{graph.anchor.hedera_transaction_id}</code>
                ) : (
                  <p className="text-sm text-amber-700">Not yet anchored</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-slate-200">
              <div><p className="text-2xl font-serif text-navy-900">{graph.node_count}</p><p className="text-xs text-slate-500">Nodes</p></div>
              <div><p className="text-2xl font-serif text-navy-900">{graph.anchor.built_at?.slice(0, 10)}</p><p className="text-xs text-slate-500">Built</p></div>
              <div><p className="text-2xl font-serif text-navy-900">{graph.anchor.hedera_topic_id || '—'}</p><p className="text-xs text-slate-500">Topic</p></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-6 text-center">
            <Network className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No graph built yet. Click "Rebuild Graph".</p>
          </CardContent>
        </Card>
      )}

      {graph?.nodes && graph.nodes.length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg text-navy-900 mb-3">Chain Nodes ({graph.nodes.length})</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {graph.nodes.slice(0, 100).map((n, i) => (
                <div key={n.id} className="flex items-center gap-2 text-xs font-mono py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 w-8">{i + 1}.</span>
                  <span className="text-slate-700">{n.ceremony_id?.slice(0, 14)}…</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="text-coral-700">{n.node_hash?.slice(0, 24)}…</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── EVIDENCE PACKETS TAB ───────────────────────────────────────────────────
function EvidenceTab({ headers, onChanged }) {
  const [packets, setPackets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('Portfolio Evidence Packet');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/evidence-packet`, { headers });
      setPackets(res.data.packets || []);
    } catch (e) {
      toast.error('Failed to load packets');
    }
  }, [headers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/evidence-packet/generate`, { title }, { headers });
      toast.success(`Packet generated: ${res.data.packet.ceremony_count} ceremonies`);
      await load();
      onChanged();
    } catch (e) {
      toast.error('Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const download = (packetId) => {
    const url = `${API}/evidence-packet/${packetId}/download`;
    window.open(`${url}?token=${headers.Authorization?.split(' ')[1]}`, '_blank');
    // Fallback: open with auth via fetch
    fetch(url, { headers })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `evidence-packet-${packetId}.json`;
        a.click();
      });
  };

  const verify = async (packetId) => {
    try {
      const res = await axios.get(`${API}/evidence-packet/${packetId}/verify`);
      if (res.data.ok) {
        toast.success(`✓ Verified — hash matches. ${res.data.ceremony_count} ceremonies.`);
      } else {
        toast.error('✗ Hash mismatch — packet tampered!');
      }
    } catch (e) {
      toast.error('Verify failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="pcv-evidence">
      <div>
        <h2 className="font-serif text-2xl text-navy-900">Court-Ready Evidence Packets</h2>
        <p className="text-sm text-slate-600 mt-1">A single, cryptographically-anchored bundle of your entire notarized portfolio — admissible in any court.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-3">Generate New Packet</h3>
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Packet title (e.g., 'Q1 2026 SEC Audit')"
              data-testid="pcv-packet-title-input"
            />
            <Button onClick={generate} disabled={busy} className="bg-coral-500 hover:bg-coral-600 text-white whitespace-nowrap" data-testid="pcv-generate-packet-btn">
              <FileText className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Generates a packet containing every completed notarization, the portfolio integrity graph, compliance scores, scan history, and Hedera anchor proofs.</p>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg text-navy-900 mb-3">Generated Packets ({packets.length})</h3>
          {packets.length === 0 ? (
            <p className="text-sm text-slate-500">No packets generated yet.</p>
          ) : (
            <div className="space-y-2">
              {packets.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-md p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900">{p.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{p.ceremony_count} ceremonies</span>
                      <span>·</span>
                      <span>{p.generated_at?.slice(0, 19)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-500">Hash:</span>
                      <code className="text-coral-700">{p.packet_hash?.slice(0, 32)}…</code>
                    </div>
                    {p.hedera_transaction_id && (
                      <div className="mt-1 flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-500">Hedera:</span>
                        <code className="text-emerald-700">{p.hedera_transaction_id}</code>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => download(p.id)} data-testid={`pcv-download-${p.id}`}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => verify(p.id)} data-testid={`pcv-verify-${p.id}`}>
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verify
                    </Button>
                    <Link to={`/pcv/verify/${p.id}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="w-full">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Public link
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
