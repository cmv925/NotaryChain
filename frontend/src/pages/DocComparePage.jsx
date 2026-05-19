import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, GitCompareArrows, ArrowRight, Loader2,
  Plus, Minus, RefreshCw, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const typeIcons = { addition: Plus, deletion: Minus, modification: RefreshCw };
const typeColors = {
  addition: 'bg-green-500/10 text-green-400 border-green-500/20',
  deletion: 'bg-red-500/10 text-red-400 border-red-500/20',
  modification: 'bg-coral-500/10 text-coral-600 border-amber-500/20',
};
const impactColors = { high: 'bg-red-500/15 text-red-400', medium: 'bg-coral-500/15 text-coral-600', low: 'bg-blue-500/15 text-blue-400' };

export default function DocComparePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [labelA, setLabelA] = useState('Original');
  const [labelB, setLabelB] = useState('Revised');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState({});

  const compare = useCallback(async () => {
    if (!textA.trim() || !textB.trim()) return;
    setComparing(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/doc-compare/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text_a: textA, text_b: textB, label_a: labelA, label_b: labelB }),
      });
      const data = await res.json();
      setResult(data.result);
    } catch { /* ignore */ }
    setComparing(false);
  }, [textA, textB, labelA, labelB, token]);

  const toggle = (k) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitCompareArrows className="w-6 h-6 text-coral-600" />
              Document Comparison
            </h1>
            <p className="text-slate-500 text-sm">AI-powered side-by-side diff analysis</p>
          </div>
        </div>

        {/* Input: two text areas side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card className="bg-cream-100 border-slate-200">
            <CardHeader className="pb-2">
              <input value={labelA} onChange={(e) => setLabelA(e.target.value)} className="bg-transparent text-navy-900 text-sm font-semibold border-b border-slate-200 pb-1" data-testid="label-a" />
            </CardHeader>
            <CardContent>
              <textarea value={textA} onChange={(e) => setTextA(e.target.value)} rows={10} placeholder="Paste original document text..." className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-500 resize-none" data-testid="text-a" />
            </CardContent>
          </Card>
          <Card className="bg-cream-100 border-slate-200">
            <CardHeader className="pb-2">
              <input value={labelB} onChange={(e) => setLabelB(e.target.value)} className="bg-transparent text-navy-900 text-sm font-semibold border-b border-slate-200 pb-1" data-testid="label-b" />
            </CardHeader>
            <CardContent>
              <textarea value={textB} onChange={(e) => setTextB(e.target.value)} rows={10} placeholder="Paste revised document text..." className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-500 resize-none" data-testid="text-b" />
            </CardContent>
          </Card>
        </div>

        <Button onClick={compare} disabled={comparing || !textA.trim() || !textB.trim()} className="w-full bg-coral-500 hover:bg-orange-700 mb-6" data-testid="compare-btn">
          {comparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitCompareArrows className="w-4 h-4 mr-2" />}
          {comparing ? 'Comparing...' : 'Compare Documents'}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4" data-testid="compare-results">
            {/* Summary */}
            <Card className="bg-cream-100 border-slate-200">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-navy-900 font-semibold text-sm">{result.summary}</p>
                    <p className="text-slate-500 text-xs mt-1">{result.change_count} changes detected</p>
                  </div>
                  <Badge className={
                    result.significance === 'major' ? 'bg-red-500/15 text-red-400' :
                    result.significance === 'moderate' ? 'bg-coral-500/15 text-coral-600' :
                    'bg-green-500/15 text-green-400'
                  }>{result.significance}</Badge>
                </div>
                {result.recommendation && <p className="text-slate-500 text-xs">{result.recommendation}</p>}
              </CardContent>
            </Card>

            {/* Changes */}
            {result.changes?.length > 0 && (
              <div className="space-y-2">
                {result.changes.map((c, i) => {
                  const Icon = typeIcons[c.type] || RefreshCw;
                  return (
                    <Card key={i} className={`border ${typeColors[c.type] || 'border-slate-200'}`} data-testid={`change-${i}`}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="text-navy-900 text-sm font-medium">{c.section}</span>
                            <Badge className={`text-[9px] ${impactColors[c.impact] || ''}`}>{c.impact}</Badge>
                          </div>
                          <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-500">{c.type}</Badge>
                        </div>
                        <p className="text-slate-500 text-xs mb-2">{c.explanation}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {c.original && (
                            <div className="bg-red-500/5 rounded p-2 border border-red-500/10">
                              <p className="text-[10px] text-red-400 mb-1">{labelA}:</p>
                              <p className="text-xs text-slate-500 line-through">{c.original}</p>
                            </div>
                          )}
                          {c.modified && (
                            <div className="bg-green-500/5 rounded p-2 border border-green-500/10">
                              <p className="text-[10px] text-green-400 mb-1">{labelB}:</p>
                              <p className="text-xs text-slate-500">{c.modified}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Legal Implications */}
            {result.legal_implications?.length > 0 && (
              <Card className="bg-cream-100 border-slate-200">
                <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('legal')}>
                  <CardTitle className="text-sm text-navy-900 flex items-center justify-between">
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-coral-600" /> Legal Implications</span>
                    {expanded.legal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CardTitle>
                </CardHeader>
                {expanded.legal && (
                  <CardContent className="space-y-1">
                    {result.legal_implications.map((l, i) => (
                      <p key={i} className="text-slate-500 text-xs flex gap-1.5"><span className="text-coral-600">&#8226;</span> {l}</p>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
