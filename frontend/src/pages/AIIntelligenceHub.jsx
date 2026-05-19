import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Brain, ShieldAlert, FileSearch, Users, Mic, MicOff,
  AlertTriangle, CheckCircle, XCircle, Loader2, ChevronRight,
  FileText, MapPin, Clock, Star, TrendingUp, Activity,
  Volume2, Eye, Zap, BarChart3, ArrowRight, Upload,
  CircleAlert, Info, Sparkles, Scale, Globe,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { id: 'risk', label: 'Risk Scoring', icon: ShieldAlert, accent: 'text-red-400' },
  { id: 'summary', label: 'Summarizer', icon: FileSearch, accent: 'text-coral-600' },
  { id: 'match', label: 'Notary Match', icon: Users, accent: 'text-coral-600' },
  { id: 'fraud', label: 'Fraud Dashboard', icon: Activity, accent: 'text-coral-600' },
  { id: 'voice', label: 'Voice Auth', icon: Mic, accent: 'text-coral-600' },
];

// ── Risk Level Badge ──
function RiskBadge({ level }) {
  const map = {
    low: 'bg-coral-500/15 text-coral-600 border-coral-200',
    medium: 'bg-coral-500/15 text-coral-600 border-gold-500/30',
    high: 'bg-coral-500/15 text-coral-600 border-coral-200',
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span data-testid={`risk-badge-${level}`} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${map[level] || map.medium}`}>
      {level}
    </span>
  );
}

// ── Score Ring ──
function ScoreRing({ score, size = 120 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score <= 25 ? '#22c55e' : score <= 50 ? '#eab308' : score <= 75 ? '#f97316' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-navy-900" data-testid="risk-score-value">{score}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">risk</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  TAB 1: RISK SCORING
// ═══════════════════════════════════════
function RiskScoringTab({ token }) {
  const [docText, setDocText] = useState('');
  const [docName, setDocName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!docText.trim()) {
      toast({ title: 'Error', description: 'Paste document text to analyze', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai-intelligence/risk-score`, {
        document_text: docText,
        document_name: docName || 'Untitled Document',
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      toast({ title: 'Analysis Complete' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Analysis failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div data-testid="risk-scoring-tab" className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input */}
        <div className="space-y-3">
          <Input data-testid="risk-doc-name" value={docName} onChange={e => setDocName(e.target.value)}
            placeholder="Document name (e.g. Purchase Agreement)" className="bg-white border-slate-300 text-navy-900" />
          <textarea data-testid="risk-doc-text" value={docText} onChange={e => setDocText(e.target.value)}
            placeholder="Paste your document text here for AI risk analysis..."
            className="w-full h-64 bg-white border border-slate-300 rounded-lg p-3 text-sm text-navy-800 resize-none focus:border-sky-500/50 focus:outline-none" />
          <Button data-testid="risk-analyze-btn" onClick={analyze} disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-navy-900">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><ShieldAlert className="w-4 h-4 mr-2" /> Analyze Risk</>}
          </Button>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                <ScoreRing score={result.overall_risk_score || 0} />
                <div>
                  <RiskBadge level={result.risk_level || 'medium'} />
                  <p className="text-slate-600 text-xs mt-2">{result.recommendation}</p>
                  {result.ai_powered && <span className="text-[10px] text-coral-600 flex items-center gap-1 mt-1"><Sparkles className="w-3 h-3" /> GPT-5.2 Powered</span>}
                </div>
              </div>

              {/* Risks */}
              {result.risks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identified Risks</h4>
                  <div className="space-y-2">
                    {result.risks.map((r, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <RiskBadge level={r.severity} />
                          <span className="text-sm text-navy-900 font-medium">{r.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{r.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing clauses */}
              {result.missing_clauses?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Missing Clauses</h4>
                  <div className="space-y-1.5">
                    {result.missing_clauses.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white rounded p-2">
                        <CircleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-navy-900 font-medium">{c.clause}</span>
                          <span className={`ml-2 text-[10px] ${c.importance === 'required' ? 'text-red-400' : 'text-slate-500'}`}>({c.importance})</span>
                          <p className="text-[11px] text-slate-500">{c.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {result.anomalies?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Anomalies</h4>
                  {result.anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${a.concern_level === 'high' ? 'text-red-400' : 'text-coral-600'}`} />
                      {a.finding}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
              <div className="text-center">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Paste a document to see AI risk analysis</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  TAB 2: DOCUMENT SUMMARIZATION
// ═══════════════════════════════════════
function SummarizerTab({ token }) {
  const [docText, setDocText] = useState('');
  const [docName, setDocName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const summarize = async () => {
    if (!docText.trim()) {
      toast({ title: 'Error', description: 'Paste document text to summarize', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai-intelligence/summarize`, {
        document_text: docText,
        document_name: docName || 'Untitled Document',
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      toast({ title: 'Summary Ready' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Summarization failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div data-testid="summarizer-tab" className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Input data-testid="summary-doc-name" value={docName} onChange={e => setDocName(e.target.value)}
            placeholder="Document name" className="bg-white border-slate-300 text-navy-900" />
          <textarea data-testid="summary-doc-text" value={docText} onChange={e => setDocText(e.target.value)}
            placeholder="Paste your legal document text here for AI summarization..."
            className="w-full h-64 bg-white border border-slate-300 rounded-lg p-3 text-sm text-navy-800 resize-none focus:border-sky-500/50 focus:outline-none" />
          <Button data-testid="summary-analyze-btn" onClick={summarize} disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-navy-900">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Summarizing...</> : <><FileSearch className="w-4 h-4 mr-2" /> Summarize Document</>}
          </Button>
        </div>

        <div>
          {result ? (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <div>
                <h3 className="text-lg font-bold text-navy-900">{result.title || docName}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] uppercase tracking-wider bg-sky-500/15 text-coral-600 border border-sky-500/30 px-2 py-0.5 rounded">{result.document_type}</span>
                  {result.reading_time_minutes && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {result.reading_time_minutes} min read</span>}
                  {result.ai_powered && <span className="text-[10px] text-coral-600 flex items-center gap-1"><Sparkles className="w-3 h-3" /> GPT-5.2</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-navy-800 whitespace-pre-line leading-relaxed">{result.summary}</p>
              </div>

              {result.parties_involved?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Parties Involved</h4>
                  {result.parties_involved.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <Users className="w-3.5 h-3.5 text-coral-600" />
                      <span className="text-sm text-navy-900">{p.name}</span>
                      <span className="text-[11px] text-slate-500">- {p.role}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.key_terms?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Terms</h4>
                  <div className="space-y-1.5">
                    {result.key_terms.map((t, i) => (
                      <div key={i} className="bg-white rounded p-2">
                        <span className="text-xs text-coral-600 font-medium">{t.term}</span>
                        <p className="text-[11px] text-slate-600">{t.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.critical_dates?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Critical Dates</h4>
                  {result.critical_dates.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <Clock className="w-3.5 h-3.5 text-coral-600 mt-0.5" />
                      <div>
                        <span className="text-xs text-navy-900 font-medium">{d.date}</span>
                        <p className="text-[11px] text-slate-500">{d.significance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.financial_obligations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Financial Obligations</h4>
                  {result.financial_obligations.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-navy-800">{f.obligation}</span>
                      <span className="text-coral-600 font-medium">{f.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.action_items_for_signer?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Action Items for Signer</h4>
                  <ul className="space-y-1">
                    {result.action_items_for_signer.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
              <div className="text-center">
                <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Paste a document to generate a plain-English summary</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  TAB 3: SMART NOTARY MATCHING
// ═══════════════════════════════════════
function NotaryMatchTab({ token }) {
  const [docType, setDocType] = useState('contract');
  const [jurisdiction, setJurisdiction] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const DOC_TYPES = ['contract', 'real_estate', 'deed', 'will', 'power_of_attorney', 'trust', 'corporate', 'agreement', 'mortgage'];

  const findMatch = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai-intelligence/match-notary`, {
        document_type: docType,
        jurisdiction: jurisdiction || 'All States',
        urgency,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      toast({ title: `Found ${res.data.recommendations?.length || 0} matches` });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Match failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div data-testid="notary-match-tab" className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Document Type</label>
          <select data-testid="match-doc-type" value={docType} onChange={e => setDocType(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-navy-900 focus:border-emerald-500/50 focus:outline-none">
            {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Jurisdiction</label>
          <Input data-testid="match-jurisdiction" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
            placeholder="e.g. California" className="bg-white border-slate-300 text-navy-900" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Urgency</label>
          <div className="flex gap-2">
            {['normal', 'urgent'].map(u => (
              <button key={u} data-testid={`match-urgency-${u}`} onClick={() => setUrgency(u)}
                className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                  urgency === u
                    ? u === 'urgent' ? 'bg-red-500/15 text-red-400 border-red-500/40' : 'bg-coral-500/15 text-coral-600 border-emerald-500/40'
                    : 'bg-white text-slate-500 border-slate-300 hover:border-slate-600'
                }`}>
                {u === 'urgent' ? <><Zap className="w-3 h-3 inline mr-1" />Urgent</> : 'Normal'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button data-testid="match-find-btn" onClick={findMatch} disabled={loading}
        className="w-full bg-coral-500 hover:bg-emerald-700 text-navy-900">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Matching...</> : <><Users className="w-4 h-4 mr-2" /> Find Best Notary</>}
      </Button>

      {result?.recommendations?.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{result.total_notaries} notaries evaluated &middot; Showing top {result.recommendations.length}</p>
          {result.recommendations.map((rec, i) => (
            <div key={i} data-testid={`notary-match-${i}`}
              className={`bg-white border rounded-lg p-4 transition-all ${i === 0 ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-coral-500/20 text-coral-600' : 'bg-cream-200 text-slate-600'}`}>
                    #{i + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-navy-900">{rec.notary.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Star className="w-3 h-3 text-coral-600" />
                      <span className="text-xs text-coral-600">{rec.notary.rating}</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-[11px] text-slate-500">{rec.notary.ceremonies_completed} ceremonies</span>
                      <span className="text-slate-600">|</span>
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] text-slate-500">{rec.notary.response_time_mins}m response</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-coral-600">{rec.match_score}%</div>
                  <span className="text-[10px] text-slate-500">match</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {rec.notary.specializations?.map((s, j) => (
                  <span key={j} className="text-[10px] bg-cream-200 text-slate-600 px-2 py-0.5 rounded">{s.replace(/_/g, ' ')}</span>
                ))}
                {rec.notary.languages?.map((l, j) => (
                  <span key={`l-${j}`} className="text-[10px] bg-sky-500/10 text-coral-600 px-2 py-0.5 rounded flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{l}</span>
                ))}
              </div>

              {rec.match_reasons?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rec.match_reasons.map((r, j) => (
                    <span key={j} className="text-[10px] text-coral-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{r}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  TAB 4: FRAUD DETECTION DASHBOARD
// ═══════════════════════════════════════
function FraudDashboardTab({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/ai-intelligence/fraud-analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to load fraud analytics', variant: 'destructive' });
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  if (!data) return <div className="text-center text-slate-500 py-16">Failed to load analytics</div>;

  const threatColors = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/40',
    elevated: 'bg-coral-500/15 text-coral-600 border-amber-500/40',
    normal: 'bg-coral-500/15 text-coral-600 border-emerald-500/40',
  };

  const sevIconMap = {
    high: <AlertTriangle className="w-4 h-4 text-coral-600" />,
    critical: <XCircle className="w-4 h-4 text-red-400" />,
    medium: <AlertTriangle className="w-4 h-4 text-coral-600" />,
    low: <Info className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div data-testid="fraud-dashboard-tab" className="space-y-5">
      {/* Threat Level Banner */}
      <div className={`flex items-center justify-between p-4 rounded-xl border ${threatColors[data.threat_level] || threatColors.normal}`}>
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Threat Level: {data.threat_level}</h3>
            <p className="text-[11px] opacity-70">{data.total_alerts} active alerts detected</p>
          </div>
        </div>
        <div className="flex gap-3 text-center">
          <div><span className="text-lg font-bold text-red-400">{data.high_alerts}</span><p className="text-[10px] text-slate-500">High</p></div>
          <div><span className="text-lg font-bold text-coral-600">{data.medium_alerts}</span><p className="text-[10px] text-slate-500">Med</p></div>
          <div><span className="text-lg font-bold text-slate-600">{data.low_alerts}</span><p className="text-[10px] text-slate-500">Low</p></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Ceremonies', value: data.stats.total_ceremonies, icon: Scale },
          { label: 'Failed', value: data.stats.failed_ceremonies, icon: XCircle, color: 'text-red-400' },
          { label: 'Escalated', value: data.stats.escalated_ceremonies, icon: AlertTriangle, color: 'text-coral-600' },
          { label: 'Documents', value: data.stats.total_documents, icon: FileText },
          { label: 'Escrows', value: data.stats.total_escrows, icon: Scale },
          { label: 'Duplicates', value: data.stats.duplicate_documents, icon: Eye, color: data.stats.duplicate_documents > 0 ? 'text-red-400' : undefined },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color || 'text-slate-500'}`} />
            <div className={`text-lg font-bold ${s.color || 'text-navy-900'}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert List */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Alerts</h4>
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} data-testid={`fraud-alert-${i}`}
              className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3">
              {sevIconMap[alert.severity] || sevIconMap.low}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-navy-900 font-medium">{alert.title}</span>
                  <RiskBadge level={alert.severity} />
                </div>
                <p className="text-xs text-slate-600">{alert.description}</p>
                <span className="text-[10px] text-slate-600 mt-1 inline-block">{alert.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  TAB 5: VOICE AUTHENTICATION
// ═══════════════════════════════════════
function VoiceAuthTab({ token }) {
  const [partyName, setPartyName] = useState('');
  const [customPhrase, setCustomPhrase] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const phrase = customPhrase || (partyName ? `I, ${partyName}, confirm my identity and consent to this notarization.` : '');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      toast({ title: 'Recording started', description: 'Read the verification phrase aloud' });
    } catch {
      toast({ title: 'Microphone Error', description: 'Please allow microphone access', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const verify = async () => {
    if (!partyName.trim()) {
      toast({ title: 'Error', description: 'Enter the party name', variant: 'destructive' });
      return;
    }
    setLoading(true);
    let audioBase64 = '';
    if (audioBlob) {
      const buffer = await audioBlob.arrayBuffer();
      audioBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
    try {
      const res = await axios.post(`${API}/ai-intelligence/voice-auth`, {
        audio_base64: audioBase64,
        party_name: partyName,
        expected_phrase: phrase,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      toast({ title: res.data.voice_verified ? 'Voice Verified' : 'Verification Failed' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Voice verification failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div data-testid="voice-auth-tab" className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Party Name</label>
            <Input data-testid="voice-party-name" value={partyName} onChange={e => setPartyName(e.target.value)}
              placeholder="e.g. John Smith" className="bg-white border-slate-300 text-navy-900" />
          </div>

          {phrase && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
              <p className="text-[10px] text-coral-600 uppercase tracking-wider mb-1">Verification Phrase</p>
              <p className="text-sm text-navy-900 italic">&ldquo;{phrase}&rdquo;</p>
            </div>
          )}

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Custom Phrase (optional)</label>
            <Input data-testid="voice-custom-phrase" value={customPhrase} onChange={e => setCustomPhrase(e.target.value)}
              placeholder="Leave blank for default phrase" className="bg-white border-slate-300 text-navy-900" />
          </div>

          {/* Record Controls */}
          <div className="flex gap-3">
            <Button data-testid="voice-record-btn"
              onClick={recording ? stopRecording : startRecording}
              className={`flex-1 ${recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-violet-600 hover:bg-violet-700'} text-navy-900`}>
              {recording ? <><MicOff className="w-4 h-4 mr-2" /> Stop Recording</> : <><Mic className="w-4 h-4 mr-2" /> Record Voice</>}
            </Button>
          </div>

          {audioBlob && (
            <div className="flex items-center gap-2 text-xs text-coral-600">
              <Volume2 className="w-3.5 h-3.5" />
              Audio recorded ({(audioBlob.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <Button data-testid="voice-verify-btn" onClick={verify} disabled={loading || !partyName.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-navy-900">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...</> : <><Mic className="w-4 h-4 mr-2" /> Verify Identity</>}
          </Button>
        </div>

        <div>
          {result ? (
            <div className="space-y-4">
              {/* Verification Status */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${result.voice_verified ? 'bg-coral-500/10 border-coral-200' : 'bg-red-500/10 border-red-500/30'}`}>
                {result.voice_verified ? <CheckCircle className="w-8 h-8 text-coral-600" /> : <XCircle className="w-8 h-8 text-red-400" />}
                <div>
                  <h3 data-testid="voice-result-status" className={`text-sm font-bold ${result.voice_verified ? 'text-coral-600' : 'text-red-400'}`}>
                    {result.voice_verified ? 'IDENTITY VERIFIED' : 'VERIFICATION FAILED'}
                  </h3>
                  <p className="text-xs text-slate-600">Confidence: {(result.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Phrase Match</p>
                  <p className={`text-sm font-semibold ${result.phrase_match ? 'text-coral-600' : 'text-red-400'}`}>{result.phrase_match ? 'Matched' : 'No Match'}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Voice Quality</p>
                  <p className="text-sm font-semibold text-navy-900 capitalize">{result.voice_quality}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Synthetic Risk</p>
                  <p className={`text-sm font-semibold ${result.synthetic_speech_risk === 'none' ? 'text-coral-600' : 'text-coral-600'}`}>{result.synthetic_speech_risk}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Confidence</p>
                  <p className="text-sm font-semibold text-coral-600">{(result.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>

              {result.transcribed_text && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Transcribed Text</p>
                  <p className="text-sm text-navy-900 italic">&ldquo;{result.transcribed_text}&rdquo;</p>
                </div>
              )}

              {result.analysis && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Analysis</p>
                  <p className="text-xs text-navy-800">{result.analysis}</p>
                </div>
              )}

              {result.liveness_indicators?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase mb-1.5">Liveness Indicators</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.liveness_indicators.map((ind, i) => (
                      <span key={i} className="text-[10px] bg-coral-500/10 text-coral-600 px-2 py-0.5 rounded">{ind}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.ai_powered && <span className="text-[10px] text-coral-600 flex items-center gap-1"><Sparkles className="w-3 h-3" /> GPT-5.2 Powered</span>}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
              <div className="text-center">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Record your voice or click Verify for demo</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════
export default function AIIntelligenceHub() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('risk');

  const isAdminOrNotary = user?.role === 'admin' || user?.role === 'notary';

  return (
    <div className="min-h-screen bg-cream-100" data-testid="ai-intelligence-hub">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'AI Intelligence Hub' }]} />

        {/* Header */}
        <div className="flex items-center gap-3 mt-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-coral-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900 tracking-tight">AI Intelligence Hub</h1>
            <p className="text-xs text-slate-500">GPT-5.2 powered document analysis, risk scoring, and verification</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => {
            if (tab.id === 'fraud' && !isAdminOrNotary) return null;
            const Icon = tab.icon;
            return (
              <button key={tab.id} data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cream-200 text-navy-900 shadow-lg'
                    : 'text-slate-500 hover:text-navy-800 hover:bg-cream-200/50'
                }`}>
                <Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? tab.accent : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'risk' && <RiskScoringTab token={token} />}
          {activeTab === 'summary' && <SummarizerTab token={token} />}
          {activeTab === 'match' && <NotaryMatchTab token={token} />}
          {activeTab === 'fraud' && isAdminOrNotary && <FraudDashboardTab token={token} />}
          {activeTab === 'voice' && <VoiceAuthTab token={token} />}
        </div>
      </div>
    </div>
  );
}
