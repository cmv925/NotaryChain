import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Brain, Loader2, AlertTriangle, CheckCircle, Shield, FileText,
  ClipboardList, Zap, ChevronRight,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const riskColors = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400' };
const statusColors = { ok: 'bg-green-500/15 text-green-400 border-green-500/30', warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30', alert: 'bg-red-500/15 text-red-400 border-red-500/30' };

const AICopilotPanel = ({ requestId, token, onJournalPrefill }) => {
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [prefillingJournal, setPrefillingJournal] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(`${API}/ai-copilot/analyze`, { request_id: requestId }, { headers });
      setAnalysis(res.data);
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Analysis failed', variant: 'destructive' });
    }
    setAnalyzing(false);
  };

  const prefillJournal = async () => {
    setPrefillingJournal(true);
    try {
      const res = await axios.post(`${API}/ai-copilot/prefill-journal`, { request_id: requestId }, { headers });
      onJournalPrefill?.(res.data);
      toast({ title: 'Journal Pre-filled', description: 'Review the pre-filled fields and save' });
    } catch (e) {
      toast({ title: 'Error', description: 'Pre-fill failed', variant: 'destructive' });
    }
    setPrefillingJournal(false);
  };

  return (
    <Card className="bg-gradient-to-br from-white to-cream-200 border-navy-300/30" data-testid="ai-copilot-panel">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-navy-500" />
            AI Co-pilot
          </h3>
          <div className="flex gap-2">
            <Button onClick={prefillJournal} size="sm" variant="outline" className="border-coral-300/50 text-coral-500 text-xs" disabled={prefillingJournal} data-testid="copilot-prefill-btn">
              {prefillingJournal ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ClipboardList className="w-3 h-3 mr-1" />}
              Pre-fill Journal
            </Button>
            <Button onClick={runAnalysis} size="sm" className="bg-navy-700 hover:bg-navy-800 text-xs" disabled={analyzing} data-testid="copilot-analyze-btn">
              {analyzing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
              Analyze
            </Button>
          </div>
        </div>

        {analyzing && (
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 text-navy-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Analyzing request...</p>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="space-y-3" data-testid="copilot-results">
            {/* Summary + Score */}
            <div className="flex items-start gap-3 p-3 bg-cream-100 rounded-lg border border-slate-200">
              <div className="text-center flex-shrink-0">
                <div className={`text-2xl font-bold ${analysis.readiness_score >= 70 ? 'text-green-400' : analysis.readiness_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {analysis.readiness_score}
                </div>
                <div className="text-[10px] text-slate-500">Readiness</div>
              </div>
              <div className="flex-1">
                <p className="text-slate-500 text-sm">{analysis.summary}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskColors[analysis.risk_level] || 'text-slate-500'} bg-opacity-15`}>
                  Risk: {analysis.risk_level?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Key Highlights */}
            {analysis.key_highlights?.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Key Data</h4>
                <div className="space-y-1">
                  {analysis.key_highlights.map((h, i) => (
                    <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${statusColors[h.status] || 'bg-navy-800 text-slate-500 border-slate-200'}`}>
                      <span>{h.label}</span>
                      <span className="font-medium">{h.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inconsistency Flags */}
            {analysis.inconsistency_flags?.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Flags</h4>
                <div className="space-y-1.5">
                  {analysis.inconsistency_flags.map((f, i) => (
                    <div key={i} className="p-2 bg-red-500/5 rounded border border-red-500/20">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`w-3 h-3 ${f.severity === 'high' ? 'text-red-400' : f.severity === 'medium' ? 'text-amber-400' : 'text-coral-500'}`} />
                        <span className="text-xs text-slate-500">{f.description}</span>
                      </div>
                      {f.recommendation && <p className="text-[10px] text-slate-500 mt-0.5 ml-4">{f.recommendation}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            {analysis.checklist?.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Checklist</h4>
                <div className="space-y-1">
                  {analysis.checklist.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {c.completed ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-200" />}
                      <span className={c.completed ? 'text-slate-500' : 'text-slate-500'}>{c.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Recommendations</h4>
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                    <ChevronRight className="w-3 h-3 mt-0.5 text-navy-500 flex-shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!analysis && !analyzing && (
          <p className="text-slate-500 text-xs text-center py-3">Click "Analyze" to get AI insights on this request</p>
        )}
      </CardContent>
    </Card>
  );
};

export default AICopilotPanel;
