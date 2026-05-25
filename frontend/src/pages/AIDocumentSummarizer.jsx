import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  FileSearch, Upload, Loader2, Clock, FileText,
  BookOpen, Users, Calendar, Scale, Tag, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DETAIL_LEVELS = [
  { id: 'brief', label: 'Brief', desc: '2-3 sentences' },
  { id: 'standard', label: 'Standard', desc: '1-2 paragraphs' },
  { id: 'detailed', label: 'Detailed', desc: 'Section by section' },
];

const AIDocumentSummarizer = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('standard');
  const [summarizing, setSummarizing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai-summarizer/history`, { headers });
      setHistory(res.data.summaries || []);
    } catch {}
  }, [headers]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSummarize = async () => {
    if (!file) {
      toast({ title: 'Error', description: 'Upload a document first', variant: 'destructive' });
      return;
    }
    setSummarizing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('detail_level', detailLevel);
      const res = await axios.post(`${API}/ai-summarizer/summarize`, formData, { headers });
      setResult(res.data);
      fetchHistory();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Summarization failed', variant: 'destructive' });
    }
    setSummarizing(false);
  };

  const loadSummary = async (id) => {
    try {
      const res = await axios.get(`${API}/ai-summarizer/history/${id}`, { headers });
      setResult(res.data);
    } catch {}
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const complexityColors = { simple: 'text-green-400 bg-green-500/15', moderate: 'text-coral-600 bg-coral-500/15', complex: 'text-red-400 bg-red-500/15' };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'AI Summarizer' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <FileSearch className="w-7 h-7 text-teal-400" />
                AI Document Summarizer
              </h1>
              <p className="text-slate-500 text-sm mt-1">Upload any document for instant AI summary and key terms</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Panel */}
            <div>
              <Card className="bg-white border-slate-200 mb-4" data-testid="upload-panel">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-navy-900 mb-3">Upload Document</h3>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500/50 transition-colors"
                    data-testid="upload-dropzone"
                  >
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">{file ? file.name : 'Click to upload'}</p>
                    <p className="text-slate-600 text-xs mt-1">PDF, Images, DOC, TXT</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx"
                      className="hidden"
                      onChange={e => setFile(e.target.files[0])}
                      data-testid="file-input"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-slate-500 block mb-1.5">Detail Level</label>
                    <div className="flex gap-2">
                      {DETAIL_LEVELS.map(level => (
                        <button
                          key={level.id}
                          onClick={() => setDetailLevel(level.id)}
                          className={`flex-1 p-2 rounded-lg text-xs border transition-colors ${
                            detailLevel === level.id
                              ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                              : 'bg-cream-100 border-slate-200 text-slate-500 hover:border-slate-200'
                          }`}
                          data-testid={`detail-${level.id}`}
                        >
                          <div className="font-medium">{level.label}</div>
                          <div className="text-[10px] text-slate-500">{level.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleSummarize} disabled={summarizing || !file} className="w-full mt-4 bg-teal-600 hover:bg-teal-700" data-testid="summarize-btn">
                    {summarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
                    Summarize
                  </Button>
                </CardContent>
              </Card>

              {/* History */}
              <Card className="bg-white border-slate-200">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">History</h3>
                  {history.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-3">No summaries yet</p>
                  ) : (
                    <div className="space-y-1.5" data-testid="summary-history">
                      {history.slice(0, 10).map(s => (
                        <button
                          key={s.id}
                          onClick={() => loadSummary(s.id)}
                          className="w-full text-left p-2 bg-cream-100 rounded border border-slate-200 hover:border-teal-500/30 transition-colors"
                        >
                          <p className="text-navy-900 text-xs truncate">{s.file_name}</p>
                          <p className="text-slate-500 text-[10px]">{s.result?.document_type_detected} &middot; {new Date(s.created_at).toLocaleDateString()}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2">
              {summarizing && (
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-12 text-center">
                    <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500">Analyzing your document...</p>
                  </CardContent>
                </Card>
              )}

              {result && !summarizing && (
                <div className="space-y-4" data-testid="summary-results">
                  {/* Summary */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-navy-900 font-semibold flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-teal-400" />
                          Summary
                          {result.file_name && <span className="text-slate-500 text-xs font-normal">— {result.file_name}</span>}
                        </h3>
                        <div className="flex gap-1.5">
                          {result.result?.document_type_detected && (
                            <span className="px-2 py-0.5 bg-coral-500/15 text-coral-500 text-[10px] rounded-full">{result.result.document_type_detected}</span>
                          )}
                          {result.result?.complexity_level && (
                            <span className={`px-2 py-0.5 text-[10px] rounded-full ${complexityColors[result.result.complexity_level] || ''}`}>
                              {result.result.complexity_level}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm leading-relaxed">{result.result?.summary}</p>
                    </CardContent>
                  </Card>

                  {/* Key Terms */}
                  {result.result?.key_terms?.length > 0 && (
                    <Card className="bg-white border-slate-200">
                      <CardContent className="p-4">
                        <button onClick={() => toggleSection('terms')} className="w-full flex items-center justify-between">
                          <h3 className="text-navy-900 font-semibold text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-navy-500" /> Key Terms ({result.result.key_terms.length})</h3>
                          {expandedSections.terms ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {expandedSections.terms !== false && (
                          <div className="mt-3 space-y-2">
                            {result.result.key_terms.map((t, i) => (
                              <div key={i} className="flex gap-2 text-sm"><span className="text-teal-400 font-medium flex-shrink-0">{t.term}:</span><span className="text-slate-500">{t.definition}</span></div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Parties */}
                  {result.result?.parties?.length > 0 && (
                    <Card className="bg-white border-slate-200">
                      <CardContent className="p-4">
                        <h3 className="text-navy-900 font-semibold text-sm flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-coral-500" /> Parties</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.result.parties.map((p, i) => (
                            <span key={i} className="px-2.5 py-1 bg-coral-500/10 text-coral-500 text-xs rounded border border-coral-300/20">
                              {p.name} <span className="text-coral-400/60">({p.role})</span>
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dates + Obligations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.result?.important_dates?.length > 0 && (
                      <Card className="bg-white border-slate-200">
                        <CardContent className="p-4">
                          <h3 className="text-navy-900 font-semibold text-sm flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-coral-600" /> Dates</h3>
                          {result.result.important_dates.map((d, i) => (
                            <div key={i} className="text-xs mb-1"><span className="text-coral-600">{d.date}</span> <span className="text-slate-500">— {d.context}</span></div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {result.result?.key_obligations?.length > 0 && (
                      <Card className="bg-white border-slate-200">
                        <CardContent className="p-4">
                          <h3 className="text-navy-900 font-semibold text-sm flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-green-400" /> Obligations</h3>
                          {result.result.key_obligations.map((o, i) => (
                            <p key={i} className="text-slate-500 text-xs mb-1 flex gap-1">
                              <span className="text-green-400">&#8226;</span> {o}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {!result && !summarizing && (
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-12 text-center">
                    <FileSearch className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">Upload a document to get an AI-generated summary with key terms and analysis</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AIDocumentSummarizer;
