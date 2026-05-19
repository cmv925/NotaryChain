import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Sparkles, ShieldAlert, AlertTriangle, CheckCircle,
  FileText, RefreshCw, ChevronDown, ChevronUp, Loader2, PlusCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const severityColor = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  important: 'bg-coral-500/15 text-coral-600 border-gold-500/30',
  recommended: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-coral-500/15 text-coral-600',
  low: 'bg-blue-500/15 text-blue-400',
};

export default function DocumentRemediation() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [docText, setDocText] = useState('');
  const [docType, setDocType] = useState('general');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [remediationId, setRemediationId] = useState(null);
  const [selectedClauses, setSelectedClauses] = useState([]);
  const [applying, setApplying] = useState(false);
  const [remediatedText, setRemediatedText] = useState(null);
  const [expanded, setExpanded] = useState({});

  const analyze = useCallback(async () => {
    if (!docText.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setRemediatedText(null);
    setSelectedClauses([]);
    try {
      const res = await fetch(`${API}/api/remediation/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ document_text: docText, document_type: docType }),
      });
      const data = await res.json();
      setResult(data.analysis);
      setRemediationId(data.remediation_id);
    } catch {
      /* ignore */
    } finally {
      setAnalyzing(false);
    }
  }, [docText, docType, token]);

  const toggleClause = (i) =>
    setSelectedClauses((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const applyClauses = useCallback(async () => {
    if (!remediationId || selectedClauses.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch(`${API}/api/remediation/apply-clauses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remediation_id: remediationId, clause_indices: selectedClauses }),
      });
      const data = await res.json();
      setRemediatedText(data.remediated_text);
    } catch {
      /* ignore */
    } finally {
      setApplying(false);
    }
  }, [remediationId, selectedClauses, token]);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-coral-600" />
              AI Document Remediation
            </h1>
            <p className="text-slate-500 text-sm">Analyze documents & auto-insert missing legal clauses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <Card className="bg-cream-100 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-navy-900">Document Text</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-navy-900"
                  data-testid="doc-type-select"
                >
                  {['general','real_estate','contract','will','lease','nda','affidavit','deed'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
                <textarea
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  rows={14}
                  placeholder="Paste your document text here for AI analysis..."
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-500 resize-none"
                  data-testid="doc-text-input"
                />
                <Button
                  onClick={analyze}
                  disabled={analyzing || !docText.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-navy-900"
                  data-testid="analyze-btn"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {analyzing ? 'Analyzing...' : 'Analyze & Find Missing Clauses'}
                </Button>
              </CardContent>
            </Card>

            {/* Remediated Output */}
            {remediatedText && (
              <Card className="bg-cream-100 border-green-500/30" data-testid="remediated-output">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Remediated Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-xs text-slate-500 bg-white rounded-md p-4 max-h-80 overflow-y-auto">
                    {remediatedText}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {analyzing && (
              <div className="flex flex-col items-center py-16 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-coral-600" />
                <p className="text-sm">AI is analyzing your document...</p>
              </div>
            )}

            {result && !analyzing && (
              <>
                {/* Overview */}
                <Card className="bg-cream-100 border-slate-200">
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          result.overall_risk_score > 60 ? 'bg-red-500/20 text-red-400' :
                          result.overall_risk_score > 30 ? 'bg-coral-500/20 text-coral-600' :
                          'bg-green-500/20 text-green-400'
                        }`} data-testid="risk-score">
                          {result.overall_risk_score}
                        </div>
                        <div>
                          <p className="text-navy-900 font-semibold text-sm">Risk Score</p>
                          <p className="text-slate-500 text-xs">{result.document_type_detected}</p>
                        </div>
                      </div>
                      <Badge className={result.overall_risk_score > 60 ? 'bg-red-500/15 text-red-400' : result.overall_risk_score > 30 ? 'bg-coral-500/15 text-coral-600' : 'bg-green-500/15 text-green-400'}>
                        {result.overall_risk_score > 60 ? 'High Risk' : result.overall_risk_score > 30 ? 'Medium Risk' : 'Low Risk'}
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-xs">{result.overall_assessment}</p>
                  </CardContent>
                </Card>

                {/* Missing Clauses */}
                {result.missing_clauses?.length > 0 && (
                  <Card className="bg-cream-100 border-slate-200" data-testid="missing-clauses-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-navy-900 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-400" />
                          Missing Clauses ({result.missing_clauses.length})
                        </CardTitle>
                        <Button
                          size="sm"
                          onClick={applyClauses}
                          disabled={applying || selectedClauses.length === 0}
                          className="bg-green-600 hover:bg-green-700 text-navy-900 text-xs h-7"
                          data-testid="apply-clauses-btn"
                        >
                          {applying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlusCircle className="w-3 h-3 mr-1" />}
                          Insert {selectedClauses.length} Selected
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.missing_clauses.map((c, i) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 cursor-pointer transition-all ${
                            selectedClauses.includes(i)
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-slate-200/50 hover:border-slate-200'
                          }`}
                          onClick={() => toggleClause(i)}
                          data-testid={`clause-${i}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedClauses.includes(i)}
                                readOnly
                                className="accent-green-500"
                              />
                              <span className="text-navy-900 text-xs font-medium">{c.clause_name}</span>
                            </div>
                            <Badge className={`text-[10px] ${severityColor[c.severity] || ''}`}>
                              {c.severity}
                            </Badge>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-1 ml-6">{c.reason}</p>
                          <button onClick={(e) => { e.stopPropagation(); toggle(`clause_${i}`); }} className="text-blue-400 text-[10px] ml-6 mt-1 hover:underline">
                            {expanded[`clause_${i}`] ? 'Hide suggested text' : 'Show suggested text'}
                          </button>
                          {expanded[`clause_${i}`] && (
                            <pre className="text-[10px] text-slate-500 bg-white rounded p-2 mt-1 ml-6 whitespace-pre-wrap">
                              {c.suggested_text}
                            </pre>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Weak Language */}
                {result.weak_language?.length > 0 && (
                  <Card className="bg-cream-100 border-slate-200">
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('weak')}>
                      <CardTitle className="text-sm text-navy-900 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-coral-600" />
                          Weak Language ({result.weak_language.length})
                        </span>
                        {expanded.weak ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CardTitle>
                    </CardHeader>
                    {expanded.weak && (
                      <CardContent className="space-y-2">
                        {result.weak_language.map((w, i) => (
                          <div key={i} className="border border-slate-200/50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-red-400 text-xs line-through">{w.original_text?.substring(0, 60)}</span>
                              <Badge className={`text-[10px] ${severityColor[w.severity] || ''}`}>{w.severity}</Badge>
                            </div>
                            <p className="text-slate-500 text-[11px]">{w.issue}</p>
                            <p className="text-green-400 text-xs mt-1">{w.suggested_replacement}</p>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Risk Areas */}
                {result.risk_areas?.length > 0 && (
                  <Card className="bg-cream-100 border-slate-200">
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('risk')}>
                      <CardTitle className="text-sm text-navy-900 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          Risk Areas ({result.risk_areas.length})
                        </span>
                        {expanded.risk ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CardTitle>
                    </CardHeader>
                    {expanded.risk && (
                      <CardContent className="space-y-2">
                        {result.risk_areas.map((r, i) => (
                          <div key={i} className="border border-slate-200/50 rounded-lg p-3">
                            <div className="flex justify-between mb-1">
                              <span className="text-navy-900 text-xs">{r.area}</span>
                              <Badge className={`text-[10px] ${severityColor[r.risk_level] || ''}`}>{r.risk_level}</Badge>
                            </div>
                            <p className="text-slate-500 text-[11px]">{r.recommendation}</p>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
