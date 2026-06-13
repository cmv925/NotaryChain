import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Library, Plus, MapPin } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ClauseLibrary = ({ headers, onInsert }) => {
  const [clauses, setClauses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [states, setStates] = useState([]);
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (state) params.state = state;
      if (category) params.category = category;
      const res = await axios.get(`${API}/ai-generator/clauses`, { headers, params });
      setClauses(res.data.clauses || []);
      setCategories(res.data.categories || []);
      setStates(res.data.states || []);
    } catch {}
    setLoading(false);
  }, [headers, state, category]);

  useEffect(() => { load(); }, [load]);

  const filtered = clauses.filter((c) =>
    !q || c.title.toLowerCase().includes(q.toLowerCase()) || c.body.toLowerCase().includes(q.toLowerCase()));

  return (
    <div data-testid="studio-clause-library">
      <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
        <Library className="w-3.5 h-3.5 text-coral-500" /> Insert pre-vetted clauses — pick a state for jurisdiction-specific language.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={state} onChange={(e) => setState(e.target.value)} className="bg-cream-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-navy-900" data-testid="clause-state-select">
          <option value="">All states (generic)</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-cream-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-navy-900" data-testid="clause-category-select">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clauses…" className="bg-cream-100 border-slate-200 text-xs h-8 flex-1 min-w-[140px]" data-testid="clause-search" />
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" data-testid="clause-list">
          {filtered.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border border-slate-200 bg-white" data-testid={`clause-${c.id}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-navy-900 text-sm font-semibold">{c.title}</span>
                  {c.state_specific && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />{state}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" className="border-coral-300 text-coral-600 h-7 text-xs flex-shrink-0" onClick={() => onInsert(c)} data-testid={`clause-insert-${c.id}`}>
                  <Plus className="w-3 h-3 mr-1" /> Insert
                </Button>
              </div>
              <span className="text-[10px] text-slate-400">{c.category_label}</span>
              <p className="text-slate-500 text-xs mt-1 line-clamp-3">{c.body}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-slate-400 text-xs text-center py-4">No clauses match.</p>}
        </div>
      )}
    </div>
  );
};
