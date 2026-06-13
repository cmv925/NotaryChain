import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Sparkles, FileText } from 'lucide-react';

export const DocumentEditor = ({ result, onChangeTitle, onChangeSection, onAiEdit }) => {
  const [editing, setEditing] = useState({}); // index -> instruction text
  const [busy, setBusy] = useState(null); // index being AI-edited

  const runAiEdit = async (i) => {
    const instruction = (editing[i] || '').trim();
    if (!instruction) return;
    setBusy(i);
    await onAiEdit(i, instruction);
    setEditing((p) => ({ ...p, [i]: '' }));
    setBusy(null);
  };

  return (
    <div data-testid="studio-document-editor">
      <div className="mb-4">
        <label className="text-xs text-slate-500 block mb-1">Document Title</label>
        <Input
          value={result.title || ''}
          onChange={(e) => onChangeTitle(e.target.value)}
          className="bg-cream-100 border-slate-200 text-navy-900 font-semibold"
          data-testid="studio-title-input"
        />
      </div>
      {result.disclaimer && (
        <p className="text-coral-600/80 text-xs bg-coral-500/10 p-2 rounded mb-4 border border-amber-500/20">
          {result.disclaimer}
        </p>
      )}
      <div className="space-y-4">
        {(result.sections || []).map((section, i) => (
          <div key={section.heading || i} className="bg-white rounded-lg p-4 border border-slate-200" data-testid={`studio-section-${i}`}>
            <h3 className="text-navy-900 font-semibold text-sm mb-2 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-navy-400" />
              {section.heading}
            </h3>
            <textarea
              value={section.content || ''}
              onChange={(e) => onChangeSection(i, e.target.value)}
              rows={Math.min(10, Math.max(3, (section.content || '').split('\n').length + 1))}
              className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm leading-relaxed outline-none focus:border-navy-300 resize-y"
              data-testid={`studio-section-text-${i}`}
            />
            <div className="flex gap-2 mt-2">
              <Input
                value={editing[i] || ''}
                onChange={(e) => setEditing((p) => ({ ...p, [i]: e.target.value }))}
                placeholder="Ask AI to edit this section…"
                className="bg-cream-100 border-slate-200 text-navy-900 text-xs h-8 flex-1"
                data-testid={`studio-aiedit-input-${i}`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAiEdit(i)}
                disabled={busy === i || !(editing[i] || '').trim()}
                className="border-coral-300 text-coral-600 h-8"
                data-testid={`studio-aiedit-btn-${i}`}
              >
                {busy === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
