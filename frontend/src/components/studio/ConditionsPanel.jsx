import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Zap, Plus, Trash2 } from 'lucide-react';

const TYPE_COLORS = {
  payment: 'bg-emerald-100 text-emerald-700',
  delivery: 'bg-blue-100 text-blue-700',
  date: 'bg-amber-100 text-amber-700',
  renewal: 'bg-purple-100 text-purple-700',
  condition: 'bg-slate-100 text-slate-700',
};

export const ConditionsPanel = ({ conditions, onSuggest, onToggle, onAdd, onRemove }) => {
  const [suggesting, setSuggesting] = useState(false);
  const [label, setLabel] = useState('');
  const [term, setTerm] = useState('');

  const suggest = async () => {
    setSuggesting(true);
    await onSuggest();
    setSuggesting(false);
  };

  return (
    <div data-testid="studio-conditions-panel">
      <p className="text-xs text-slate-500 mb-3">
        Mark key terms as automated <strong>Trust Anchor triggers</strong> for the Self-Executing Trust Network.
      </p>
      <Button onClick={suggest} disabled={suggesting} className="w-full bg-navy-700 hover:bg-navy-800 mb-4" data-testid="studio-suggest-conditions-btn">
        {suggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
        Suggest Trigger Conditions with AI
      </Button>

      <div className="space-y-2 mb-4">
        {conditions.length === 0 && (
          <p className="text-slate-400 text-xs text-center py-3">No conditions yet — let AI suggest some or add your own.</p>
        )}
        {conditions.map((c) => (
          <div key={c.id} className={`p-3 rounded-lg border ${c.enabled ? 'border-coral-300 bg-coral-50' : 'border-slate-200 bg-white'}`} data-testid={`studio-condition-${c.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-navy-900 text-sm font-semibold truncate">{c.label}</span>
                  {c.type && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_COLORS[c.type] || TYPE_COLORS.condition}`}>{c.type}</span>}
                </div>
                {c.trigger && <p className="text-slate-500 text-xs">{c.trigger}</p>}
                {c.term && <p className="text-slate-400 text-[11px] italic mt-1 line-clamp-2">“{c.term}”</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <label className="inline-flex items-center cursor-pointer" data-testid={`studio-condition-toggle-${c.id}`}>
                  <input type="checkbox" checked={!!c.enabled} onChange={() => onToggle(c.id)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 peer-checked:bg-coral-500 rounded-full peer relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
                <button onClick={() => onRemove(c.id)} className="text-slate-300 hover:text-coral-500" data-testid={`studio-condition-remove-${c.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <p className="text-xs font-semibold text-navy-700">Add custom condition</p>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Final payment)" className="bg-cream-100 border-slate-200 text-xs h-8" data-testid="studio-custom-condition-label" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Trigger term / description" className="bg-cream-100 border-slate-200 text-xs h-8" data-testid="studio-custom-condition-term" />
        <Button
          size="sm"
          variant="outline"
          className="w-full border-navy-300 text-navy-600 h-8"
          disabled={!label.trim()}
          onClick={() => { onAdd({ label: label.trim(), term: term.trim(), type: 'condition' }); setLabel(''); setTerm(''); }}
          data-testid="studio-add-condition-btn"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Condition
        </Button>
      </div>
    </div>
  );
};
