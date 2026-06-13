import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Loader2, Store } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PublishTemplateModal = ({ open, onOpenChange, genId, defaultTitle, headers, onPublished }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [price, setPrice] = useState('0');
  const [royalty, setRoyalty] = useState('10');
  const [categories, setCategories] = useState(['Other']);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle || '');
      axios.get(`${API}/template-marketplace/categories`).then((r) => setCategories(r.data.categories || ['Other'])).catch(() => {});
    }
  }, [open, defaultTitle]);

  const submit = async () => {
    if (!title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/template-marketplace/publish`, {
        generation_id: genId,
        title: title.trim(),
        description: description.trim(),
        category,
        price_usd: parseFloat(price) || 0,
        royalty_pct: parseInt(royalty, 10) || 0,
      }, { headers });
      toast({ title: 'Published', description: 'Your template is live in the marketplace.' });
      onOpenChange(false);
      onPublished?.(res.data);
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Publish failed', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white" data-testid="publish-template-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy-900">
            <Store className="w-5 h-5 text-coral-500" /> Publish to Template Marketplace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-cream-100 border-slate-200" data-testid="publish-title" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-sm text-navy-900 outline-none" data-testid="publish-description" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-cream-100 border border-slate-200 rounded-md px-2 py-2 text-sm text-navy-900" data-testid="publish-category">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Price (USD)</label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-cream-100 border-slate-200" data-testid="publish-price" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Royalty %</label>
              <Input type="number" min="0" max="50" value={royalty} onChange={(e) => setRoyalty(e.target.value)} className="bg-cream-100 border-slate-200" data-testid="publish-royalty" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">You earn the royalty % on every sale. Sale receipts are anchored on Hedera.</p>
          <Button onClick={submit} disabled={submitting} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="publish-submit">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Store className="w-4 h-4 mr-2" />}
            Publish Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
