import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, UserCheck } from 'lucide-react';

export const SignersPanel = ({ signers, onChange }) => {
  const [role, setRole] = useState('');

  const update = (i, field, value) => {
    const next = signers.map((s, idx) => (idx === i ? { ...s, [field]: value } : s));
    onChange(next);
  };

  return (
    <div data-testid="studio-signers-panel">
      <p className="text-xs text-slate-500 mb-3">
        Map each signature block to a named signer who must execute the document.
      </p>
      <div className="space-y-3 mb-4">
        {signers.length === 0 && (
          <p className="text-slate-400 text-xs text-center py-3">No signers yet — add the parties below.</p>
        )}
        {signers.map((s, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white" data-testid={`studio-signer-${i}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-navy-900 text-xs font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-coral-500" /> {s.role || `Signer ${i + 1}`}
              </span>
              <button onClick={() => onChange(signers.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-coral-500" data-testid={`studio-signer-remove-${i}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Input value={s.name || ''} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Full name" className="bg-cream-100 border-slate-200 text-xs h-8" data-testid={`studio-signer-name-${i}`} />
              <Input value={s.email || ''} onChange={(e) => update(i, 'email', e.target.value)} placeholder="Email (for signing invite)" className="bg-cream-100 border-slate-200 text-xs h-8" data-testid={`studio-signer-email-${i}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-3 flex gap-2">
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Landlord)" className="bg-cream-100 border-slate-200 text-xs h-8 flex-1" data-testid="studio-new-signer-role" />
        <Button
          size="sm"
          variant="outline"
          className="border-navy-300 text-navy-600 h-8"
          disabled={!role.trim()}
          onClick={() => { onChange([...signers, { role: role.trim(), name: '', email: '' }]); setRole(''); }}
          data-testid="studio-add-signer-btn"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
};
