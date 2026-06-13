import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Wand2, FileText, Loader2, Clock, Sparkles,
  Anchor, Zap, UserCheck, ShieldCheck, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';
import SmartContractTemplates from '../components/SmartContractTemplates';
import { DocumentEditor } from '../components/studio/DocumentEditor';
import { ConditionsPanel } from '../components/studio/ConditionsPanel';
import { SignersPanel } from '../components/studio/SignersPanel';
import { CompliancePanel } from '../components/studio/CompliancePanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STUDIO_TABS = [
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'conditions', label: 'Conditions', icon: Zap },
  { id: 'signers', label: 'Signers', icon: UserCheck },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
];

const AIDocumentGenerator = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [docTypes, setDocTypes] = useState([]);
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('create'); // 'create' | 'studio' | 'templates'

  // Studio state
  const [genId, setGenId] = useState(null);
  const [result, setResult] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [signers, setSigners] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [studioTab, setStudioTab] = useState('document');
  const [notarizing, setNotarizing] = useState(false);
  const [anchorResult, setAnchorResult] = useState(null);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai-generator/types`, { headers });
      setDocTypes(res.data.types || []);
    } catch {}
  }, [headers]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai-generator/my-documents`, { headers });
      setHistory(res.data.documents || []);
    } catch {}
  }, [headers]);

  useEffect(() => { fetchTypes(); fetchHistory(); }, [fetchTypes, fetchHistory]);

  const enterStudio = (doc) => {
    setResult(doc.result || doc);
    setGenId(doc.id || doc.generation_id);
    setConditions(doc.conditions || []);
    setSigners(doc.signers || (doc.result?.signature_blocks || doc.signature_blocks || []).map((s) => ({ role: s.role, name: s.name && s.name !== '[BLANK]' ? s.name : '', email: '' })));
    setCompliance(doc.compliance || null);
    setAnchorResult(doc.anchor_id ? { anchor_id: doc.anchor_id, transaction_id: doc.transaction_id, explorer_url: doc.explorer_url, content_hash: doc.content_hash } : null);
    setStudioTab('document');
    setView('studio');
  };

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
      enterStudio({ result: res.data.document, id: res.data.generation_id });
      fetchHistory();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Generation failed', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const loadDocument = async (id) => {
    try {
      const res = await axios.get(`${API}/ai-generator/documents/${id}`, { headers });
      enterStudio(res.data);
    } catch {}
  };

  // ── Studio editors ──
  const changeTitle = (title) => setResult((r) => ({ ...r, title }));
  const changeSection = (i, content) =>
    setResult((r) => ({ ...r, sections: r.sections.map((s, idx) => (idx === i ? { ...s, content } : s)) }));

  const persist = useCallback(async () => {
    if (!genId) return;
    try {
      await axios.put(`${API}/ai-generator/documents/${genId}`, { result, signers, conditions }, { headers });
    } catch {}
  }, [genId, result, signers, conditions, headers]);

  const aiEditSection = async (i, instruction) => {
    try {
      const res = await axios.post(`${API}/ai-generator/edit-section`, {
        generation_id: genId, section_index: i, instruction,
      }, { headers });
      setResult(res.data.document);
      toast({ title: 'Section updated', description: 'AI applied your edit.' });
    } catch (e) {
      toast({ title: 'Error', description: 'AI edit failed', variant: 'destructive' });
    }
  };

  const suggestConditions = async () => {
    try {
      await persist();
      const res = await axios.post(`${API}/ai-generator/suggest-conditions`, { generation_id: genId }, { headers });
      const existing = new Set(conditions.map((c) => c.label.toLowerCase()));
      const merged = [...conditions, ...res.data.conditions.filter((c) => !existing.has((c.label || '').toLowerCase()))];
      setConditions(merged);
      toast({ title: 'Conditions suggested', description: `${res.data.conditions.length} trigger conditions found.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Condition suggestion failed', variant: 'destructive' });
    }
  };

  const toggleCondition = (id) => setConditions((cs) => cs.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  const addCondition = (c) => setConditions((cs) => [...cs, { ...c, id: crypto.randomUUID(), enabled: true }]);
  const removeCondition = (id) => setConditions((cs) => cs.filter((c) => c.id !== id));

  const runCompliance = async () => {
    try {
      await persist();
      const res = await axios.post(`${API}/ai-generator/compliance-check`, { generation_id: genId }, { headers });
      setCompliance(res.data);
    } catch (e) {
      toast({ title: 'Error', description: 'Compliance scan failed', variant: 'destructive' });
    }
  };

  const notarize = async () => {
    if (compliance && !compliance.passed) {
      toast({ title: 'High-severity issues remain', description: 'Resolve high issues in the Compliance tab before sealing.', variant: 'destructive' });
      setStudioTab('compliance');
      return;
    }
    setNotarizing(true);
    try {
      await persist();
      const res = await axios.post(`${API}/ai-generator/notarize`, { generation_id: genId }, { headers });
      setAnchorResult(res.data);
      toast({ title: 'Sealed on Hedera', description: 'Your document is anchored and tamper-evident.' });
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.detail === 'identity_verification_required') {
        toast({ title: 'Identity verification required', description: 'Verify your identity to seal documents on-chain.', variant: 'destructive' });
        navigate('/kba-test');
      } else {
        toast({ title: 'Error', description: e.response?.data?.detail || 'Sealing failed', variant: 'destructive' });
      }
    }
    setNotarizing(false);
  };

  const enabledConditions = conditions.filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Smart Document Studio' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Wand2 className="w-7 h-7 text-coral-500" />
                Smart Document Studio
              </h1>
              <p className="text-slate-500 text-sm mt-1">Draft → Map Conditions → Check Compliance → Notarize — the full document lifecycle.</p>
            </div>
            {view === 'studio' && (
              <Button onClick={() => { setView('create'); setResult(null); setAnchorResult(null); }} variant="outline" className="border-navy-300/50 text-navy-600" data-testid="new-document-btn">
                <Sparkles className="w-4 h-4 mr-1" /> New Document
              </Button>
            )}
          </div>

          {/* Mode tabs */}
          {(view === 'create' || view === 'templates') && (
            <div className="flex gap-2 mb-6 border-b border-slate-200" data-testid="generator-tabs">
              <button onClick={() => setView('create')} className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${view === 'create' ? 'border-coral-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'}`} data-testid="tab-ai-generate">
                <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Generate with AI
              </button>
              <button onClick={() => setView('templates')} className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${view === 'templates' ? 'border-coral-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'}`} data-testid="tab-smart-contracts">
                <Anchor className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Smart Contract Templates
              </button>
            </div>
          )}

          {view === 'templates' && <SmartContractTemplates embedded />}

          {view === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-white border-slate-200" data-testid="generator-form">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-navy-900 mb-4">Describe Your Document</h2>
                    <div className="mb-4">
                      <label className="text-sm text-slate-500 block mb-1">Document Type (optional)</label>
                      <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm" data-testid="doc-type-select">
                        <option value="">Auto-detect from description</option>
                        {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="text-sm text-slate-500 block mb-1">Describe what you need *</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., A lease agreement for a 2-bedroom apartment in Texas, 12 months, $1,500/month, tenant Jane Doe, landlord John Smith..." rows={5} className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm focus:border-navy-300 outline-none resize-none" data-testid="doc-description-input" />
                    </div>
                    <Button onClick={handleGenerate} disabled={generating || !description.trim()} className="w-full bg-navy-700 hover:bg-navy-800" data-testid="generate-btn">
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Generate Document
                    </Button>
                  </CardContent>
                </Card>
              </div>

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
                        {history.slice(0, 8).map((doc) => (
                          <button key={doc.id} onClick={() => loadDocument(doc.id)} className="w-full text-left p-2 bg-cream-100 rounded border border-slate-200 hover:border-navy-300/30 transition-colors" data-testid={`history-doc-${doc.id}`}>
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

          {/* ── Studio workspace ── */}
          {view === 'studio' && result && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="studio-workspace">
              <div className="lg:col-span-2">
                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white p-1 rounded-lg border border-slate-200" data-testid="studio-tabs">
                  {STUDIO_TABS.map((t) => {
                    const Icon = t.icon;
                    const badge = t.id === 'conditions' ? enabledConditions : t.id === 'compliance' && compliance ? compliance.score : null;
                    return (
                      <button key={t.id} onClick={() => setStudioTab(t.id)} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${studioTab === t.id ? 'bg-navy-700 text-white' : 'text-slate-500 hover:text-navy-700'}`} data-testid={`studio-tab-${t.id}`}>
                        <Icon className="w-3.5 h-3.5" /> {t.label}
                        {badge != null && badge !== 0 && <span className={`ml-1 text-[10px] px-1.5 rounded-full ${studioTab === t.id ? 'bg-white/20' : 'bg-coral-100 text-coral-700'}`}>{badge}</span>}
                      </button>
                    );
                  })}
                </div>

                <Card className="bg-cream-50 border-slate-200">
                  <CardContent className="p-5">
                    {studioTab === 'document' && (
                      <DocumentEditor result={result} onChangeTitle={changeTitle} onChangeSection={changeSection} onAiEdit={aiEditSection} />
                    )}
                    {studioTab === 'conditions' && (
                      <ConditionsPanel conditions={conditions} onSuggest={suggestConditions} onToggle={toggleCondition} onAdd={addCondition} onRemove={removeCondition} />
                    )}
                    {studioTab === 'signers' && (
                      <SignersPanel signers={signers} onChange={setSigners} />
                    )}
                    {studioTab === 'compliance' && (
                      <CompliancePanel compliance={compliance} onRun={runCompliance} />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right rail — finalize / notarize */}
              <div className="space-y-4">
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-navy-900 mb-3">Finalize & Seal</h3>
                    <div className="space-y-2 text-xs text-slate-500 mb-4">
                      <div className="flex items-center justify-between">
                        <span>Trigger conditions</span><span className="text-navy-900 font-semibold">{enabledConditions} active</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Signers mapped</span><span className="text-navy-900 font-semibold">{signers.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Compliance</span>
                        <span className={`font-semibold ${compliance ? (compliance.passed ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`}>
                          {compliance ? `${compliance.score}/100` : 'Not run'}
                        </span>
                      </div>
                    </div>

                    {anchorResult ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200" data-testid="studio-anchor-result">
                        <p className="text-emerald-700 text-sm font-semibold flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-4 h-4" /> Sealed on Hedera
                        </p>
                        <p className="text-slate-500 text-[11px] break-all mb-2">Hash: {anchorResult.content_hash?.slice(0, 24)}…</p>
                        {anchorResult.explorer_url && (
                          <a href={anchorResult.explorer_url} target="_blank" rel="noreferrer" className="text-navy-600 text-xs inline-flex items-center gap-1 hover:underline" data-testid="studio-explorer-link">
                            View on HashScan <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <Button onClick={() => navigate('/my-anchors')} variant="outline" className="w-full mt-3 border-navy-300 text-navy-600 h-8 text-xs" data-testid="studio-view-anchors-btn">
                          View My Anchored Agreements
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={notarize} disabled={notarizing} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="studio-notarize-btn">
                        {notarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Anchor className="w-4 h-4 mr-2" />}
                        Notarize & Anchor on Hedera
                      </Button>
                    )}
                    <Button onClick={persist} variant="ghost" className="w-full mt-2 text-slate-500 h-8 text-xs" data-testid="studio-save-btn">
                      Save Draft
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                  <CardContent className="p-4 text-xs text-slate-500">
                    <p className="font-semibold text-navy-700 mb-1">Lifecycle</p>
                    <p>Create → Map Conditions → Check Compliance → <strong>Notarize</strong> → Verify. Active conditions feed the Self-Executing Trust Network.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AIDocumentGenerator;
