import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Wand2, FileText, Loader2, Send, RefreshCw,
  ChevronRight, Clock, Sparkles, PenTool,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AIDocumentGenerator = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [docTypes, setDocTypes] = useState([]);
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [genId, setGenId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('create'); // 'create' | 'result' | 'history'

  const fetchTypes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai-generator/types`, { headers });
      setDocTypes(res.data.types || []);
    } catch {}
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai-generator/my-documents`, { headers });
      setHistory(res.data.documents || []);
    } catch {}
  }, [token]);

  useEffect(() => { fetchTypes(); fetchHistory(); }, [fetchTypes, fetchHistory]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast({ title: 'Error', description: 'Describe what document you need', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/ai-generator/generate`, {
        description,
        document_type: selectedType || undefined,
      }, { headers });
      setResult(res.data.document);
      setGenId(res.data.generation_id);
      setView('result');
      fetchHistory();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Generation failed', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleRefine = async () => {
    if (!feedback.trim() || !genId) return;
    setRefining(true);
    try {
      const res = await axios.post(`${API}/ai-generator/refine`, {
        generation_id: genId,
        feedback,
      }, { headers });
      setResult(res.data.document);
      setFeedback('');
      toast({ title: 'Refined', description: 'Document updated based on your feedback' });
    } catch (e) {
      toast({ title: 'Error', description: 'Refinement failed', variant: 'destructive' });
    }
    setRefining(false);
  };

  const loadDocument = async (id) => {
    try {
      const res = await axios.get(`${API}/ai-generator/documents/${id}`, { headers });
      setResult(res.data.result);
      setGenId(res.data.id);
      setView('result');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'AI Document Generator' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Wand2 className="w-7 h-7 text-purple-400" />
                AI Document Generator
              </h1>
              <p className="text-slate-500 text-sm mt-1">Create legal documents by describing what you need</p>
            </div>
            <div className="flex gap-2">
              {view !== 'create' && (
                <Button onClick={() => { setView('create'); setResult(null); }} variant="outline" className="border-purple-500/50 text-purple-400" data-testid="new-document-btn">
                  <Sparkles className="w-4 h-4 mr-1" /> New Document
                </Button>
              )}
            </div>
          </div>

          {view === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-white border-slate-200" data-testid="generator-form">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-navy-900 mb-4">Describe Your Document</h2>
                    <div className="mb-4">
                      <label className="text-sm text-slate-500 block mb-1">Document Type (optional)</label>
                      <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm"
                        data-testid="doc-type-select"
                      >
                        <option value="">Auto-detect from description</option>
                        {docTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="text-sm text-slate-500 block mb-1">Describe what you need *</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="e.g., I need a bill of sale for a 2020 Toyota Camry. The seller is John Smith from Austin, TX and the buyer is Jane Doe from Dallas, TX. The sale price is $15,000..."
                        rows={5}
                        className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm focus:border-purple-500 outline-none resize-none"
                        data-testid="doc-description-input"
                      />
                    </div>
                    <Button onClick={handleGenerate} disabled={generating || !description.trim()} className="w-full bg-purple-600 hover:bg-purple-700" data-testid="generate-btn">
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Generate Document
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* History sidebar */}
              <div>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" /> Recent Documents
                    </h3>
                    {history.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-4">No documents yet</p>
                    ) : (
                      <div className="space-y-2" data-testid="doc-history">
                        {history.slice(0, 8).map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => loadDocument(doc.id)}
                            className="w-full text-left p-2 bg-cream-100 rounded border border-slate-200 hover:border-purple-500/30 transition-colors"
                            data-testid={`history-doc-${doc.id}`}
                          >
                            <p className="text-navy-900 text-xs font-medium truncate">{doc.result?.title || doc.description?.slice(0, 40)}</p>
                            <p className="text-slate-500 text-[10px]">{new Date(doc.created_at).toLocaleDateString()}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {view === 'result' && result && (
            <div data-testid="generated-document">
              <Card className="bg-white border-slate-200 mb-4">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-navy-900 mb-2" data-testid="doc-title">{result.title}</h2>
                  {result.disclaimer && (
                    <p className="text-coral-600/80 text-xs bg-coral-500/10 p-2 rounded mb-4 border border-amber-500/20">{result.disclaimer}</p>
                  )}

                  {/* Document Content */}
                  <div className="space-y-4">
                    {(result.sections || []).map((section, i) => (
                      <div key={i} className="bg-cream-100 rounded-lg p-4 border border-slate-200">
                        <h3 className="text-navy-900 font-semibold text-sm mb-2">{section.heading}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Fields */}
                  {result.fields && Object.keys(result.fields).length > 0 && (
                    <div className="mt-4 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
                      <h3 className="text-blue-400 font-semibold text-sm mb-2 flex items-center gap-2">
                        <PenTool className="w-4 h-4" /> Fields to Fill
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(result.fields).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>
                            <span className="text-navy-900 ml-1">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signature Blocks */}
                  {result.signature_blocks?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h3 className="text-slate-500 text-sm font-semibold">Signature Blocks</h3>
                      {result.signature_blocks.map((sig, i) => (
                        <div key={i} className="p-3 bg-cream-100 rounded border border-slate-200">
                          <div className="border-b border-slate-200 pb-2 mb-1">
                            <span className="text-slate-500 text-xs">{sig.role}</span>
                          </div>
                          <p className="text-slate-500 text-xs">Name: {sig.name} {sig.date_line && '| Date: ___________'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Refine */}
              <Card className="bg-white border-slate-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-purple-400" /> Refine Document
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      placeholder="e.g., Add a clause about late payment penalties..."
                      className="bg-cream-100 border-slate-200 text-navy-900 flex-1"
                      data-testid="refine-input"
                    />
                    <Button onClick={handleRefine} disabled={refining || !feedback.trim()} className="bg-purple-600 hover:bg-purple-700" data-testid="refine-btn">
                      {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AIDocumentGenerator;
