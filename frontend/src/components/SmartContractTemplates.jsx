/**
 * SmartContractTemplates — browse curated legal-agreement templates, fill them in,
 * optionally tailor clauses with AI, then anchor the finalized agreement on Hedera.
 *
 * Works standalone (page) or embedded (tab inside the AI Document Generator).
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Sparkles, Loader2, ArrowLeft, Anchor, FileText, Scale, Home, Lock,
  Scroll, Building, Landmark, Handshake, FileCheck, Wand2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { toast } from '../hooks/use-toast';
import AnchorOnChainModal from './AnchorOnChainModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICONS = {
  scale: Scale, home: Home, 'file-check': FileCheck, scroll: Scroll,
  lock: Lock, building: Building, landmark: Landmark, handshake: Handshake,
};

export default function SmartContractTemplates({ embedded = false }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(null); // template detail
  const [values, setValues] = useState({});
  const [aiTailor, setAiTailor] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [rendering, setRendering] = useState(false);
  const [draft, setDraft] = useState(null); // { title, content }
  const [showAnchor, setShowAnchor] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/contract-templates`);
      setTemplates(res.data.templates || []);
      setCategories(res.data.categories || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openTemplate = async (id) => {
    try {
      const res = await axios.get(`${API}/contract-templates/detail/${id}`);
      setSelected(res.data);
      setValues({});
      setDraft(null);
      setAiTailor(false);
      setInstructions('');
    } catch (e) {
      toast({ title: 'Error', description: 'Could not open template', variant: 'destructive' });
    }
  };

  const generate = async () => {
    setRendering(true);
    try {
      const res = await axios.post(`${API}/contract-templates/render/${selected.id}`, {
        values,
        ai_tailor: aiTailor,
        instructions,
      });
      setDraft({ title: res.data.title, content: res.data.content, aiTailored: res.data.ai_tailored });
      if (res.data.missing_fields?.length) {
        toast({ title: 'Some fields are blank', description: `Left blank: ${res.data.missing_fields.join(', ')}` });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to generate', variant: 'destructive' });
    } finally {
      setRendering(false);
    }
  };

  const filtered = templates.filter((t) => {
    const catOk = activeCat === 'all' || t.category === activeCat;
    const q = search.trim().toLowerCase();
    const qOk = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return catOk && qOk;
  });

  // ---- Editor view (template selected) ----
  if (selected) {
    return (
      <div className="space-y-5" data-testid="contract-editor">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy-900" data-testid="contract-back-btn">
          <ArrowLeft className="w-4 h-4" /> Back to templates
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fill form */}
          <Card className="bg-white border-slate-200">
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-navy-900">{selected.name}</h3>
                <p className="text-sm text-slate-600">{selected.description}</p>
              </div>

              {selected.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-navy-800 flex items-center gap-1">
                    {f.label}{f.required && <span className="text-coral-500">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-coral-400 focus:outline-none"
                      rows={2}
                      placeholder={f.placeholder}
                      value={values[f.key] || ''}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      data-testid={`field-${f.key}`}
                    />
                  ) : (
                    <Input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      placeholder={f.placeholder}
                      value={values[f.key] || ''}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      className="mt-1"
                      data-testid={`field-${f.key}`}
                    />
                  )}
                </div>
              ))}

              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={aiTailor} onChange={(e) => setAiTailor(e.target.checked)} data-testid="ai-tailor-toggle" />
                  <span className="text-sm font-semibold text-navy-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-coral-500" /> Tailor clauses with AI
                  </span>
                </label>
                {aiTailor && (
                  <textarea
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Optional: e.g. add a non-compete clause, make it California-specific…"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    data-testid="ai-instructions"
                  />
                )}
              </div>

              <Button onClick={generate} disabled={rendering} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="generate-draft-btn">
                {rendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {rendering ? 'Generating…' : draft ? 'Regenerate' : 'Generate Agreement'}
              </Button>
            </CardContent>
          </Card>

          {/* Preview / draft */}
          <Card className="bg-white border-slate-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-navy-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-coral-500" /> Preview
                </h3>
                {draft?.aiTailored && (
                  <span className="text-[11px] text-coral-600 bg-coral-50 border border-coral-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI-tailored
                  </span>
                )}
              </div>

              {!draft ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  Fill in the fields and generate to preview your agreement
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full h-72 rounded-md border border-slate-300 px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-coral-400"
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    data-testid="draft-content"
                  />
                  <Button onClick={() => setShowAnchor(true)} className="w-full bg-navy-900 hover:bg-navy-800 text-white" data-testid="open-anchor-btn">
                    <Anchor className="w-4 h-4 mr-2" /> Anchor on Blockchain
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <AnchorOnChainModal
          open={showAnchor}
          onClose={() => setShowAnchor(false)}
          templateId={selected.id}
          title={draft?.title || selected.name}
          content={draft?.content || ''}
        />
      </div>
    );
  }

  // ---- Library / browse view ----
  return (
    <div className={embedded ? 'space-y-5' : 'space-y-5'} data-testid="smart-contract-library">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search agreements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="template-search"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CatChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="All" />
          {categories.map((c) => (
            <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.label} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => {
          const Icon = ICONS[t.icon] || FileText;
          return (
            <Card
              key={t.id}
              onClick={() => openTemplate(t.id)}
              className="bg-white border-slate-200 hover:border-coral-300 hover:shadow-md transition-all cursor-pointer group"
              data-testid={`contract-template-${t.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-coral-500/12 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-coral-500" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t.category_label}</span>
                </div>
                <h3 className="font-bold text-navy-900 text-sm group-hover:text-coral-600 transition-colors">{t.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                <p className="text-[11px] text-slate-400 mt-3">{t.field_count} fields · anchored on Hedera</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-10">No templates match your search.</p>
      )}
    </div>
  );
}

const CatChip = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
      active ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}
    data-testid={`cat-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
  >
    {label}
  </button>
);
