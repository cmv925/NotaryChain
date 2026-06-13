import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  Store, Search, Loader2, FileText, ShoppingCart, ExternalLink,
  TrendingUp, Tag, CheckCircle2, Wand2,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TemplateMarketplace = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [tab, setTab] = useState('browse'); // 'browse' | 'listings' | 'purchases'
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [buying, setBuying] = useState(false);

  const fetchBrowse = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (q) params.q = q;
      const res = await axios.get(`${API}/template-marketplace`, { params });
      setTemplates(res.data.templates || []);
    } catch {}
    setLoading(false);
  }, [category, q]);

  useEffect(() => {
    axios.get(`${API}/template-marketplace/categories`).then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => { if (tab === 'browse') fetchBrowse(); }, [tab, fetchBrowse]);

  useEffect(() => {
    if (tab === 'listings') {
      axios.get(`${API}/template-marketplace/my/listings`, { headers }).then((r) => {
        setListings(r.data.listings || []); setEarnings(r.data.total_earnings || 0);
      }).catch(() => {});
    }
    if (tab === 'purchases') {
      axios.get(`${API}/template-marketplace/my/purchases`, { headers }).then((r) => setPurchases(r.data.purchases || [])).catch(() => {});
    }
  }, [tab, headers]);

  const openDetail = async (id) => {
    try {
      const res = await axios.get(`${API}/template-marketplace/${id}`, { headers });
      setSelected(res.data);
    } catch {
      toast({ title: 'Error', description: 'Could not load template', variant: 'destructive' });
    }
  };

  const purchase = async () => {
    if (!selected) return;
    setBuying(true);
    try {
      const res = await axios.post(`${API}/template-marketplace/${selected.id}/purchase`, {}, { headers });
      toast({ title: 'Purchased!', description: 'View it any time under My Purchases.' });
      setSelected(null);
      setTab('purchases'); // marketplace is ungated; the buyer can read their copy here
      return res;
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Purchase failed', variant: 'destructive' });
    } finally {
      setBuying(false);
    }
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${tab === id ? 'border-coral-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'}`} data-testid={`market-tab-${id}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Template Marketplace' }]} />
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Store className="w-7 h-7 text-coral-500" /> Template Marketplace
              </h1>
              <p className="text-slate-500 text-sm mt-1">Buy and sell NotaryChain-ready document templates. Creators earn royalties on every sale.</p>
            </div>
            <Button onClick={() => navigate('/ai-generator')} variant="outline" className="border-navy-300/50 text-navy-600" data-testid="market-create-btn">
              <Wand2 className="w-4 h-4 mr-1.5" /> Create & Publish
            </Button>
          </div>

          <div className="flex gap-2 mb-6 border-b border-slate-200" data-testid="market-tabs">
            <TabBtn id="browse" label="Browse" />
            <TabBtn id="listings" label="My Listings" />
            <TabBtn id="purchases" label="My Purchases" />
          </div>

          {tab === 'browse' && (
            <>
              <div className="flex flex-wrap gap-2 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchBrowse()} placeholder="Search templates…" className="bg-white border-slate-200 pl-9" data-testid="market-search" />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-slate-200 rounded-md px-3 text-sm text-navy-900" data-testid="market-category">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : templates.length === 0 ? (
                <Card className="bg-white border-slate-200"><CardContent className="py-12 text-center text-slate-400 text-sm">No templates published yet. Be the first — create one in the Studio and publish it!</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="market-grid">
                  {templates.map((t) => (
                    <Card key={t.id} className="bg-white border-slate-200 hover:border-coral-300 transition-colors cursor-pointer" onClick={() => openDetail(t.id)} data-testid={`market-template-${t.id}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-700 flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{t.category}</span>
                          <span className="text-coral-600 font-bold text-sm">{t.price_usd > 0 ? `$${t.price_usd}` : 'Free'}</span>
                        </div>
                        <h3 className="text-navy-900 font-semibold text-sm mb-1">{t.title}</h3>
                        <p className="text-slate-500 text-xs line-clamp-2 mb-3">{t.description || t.preview}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{t.section_count} sections</span>
                          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{t.sales_count} sold</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'listings' && (
            <>
              <Card className="bg-white border-slate-200 mb-4"><CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm text-slate-500">Total royalty earnings</span>
                <span className="text-2xl font-bold text-emerald-600" data-testid="market-earnings">${earnings.toFixed(2)}</span>
              </CardContent></Card>
              {listings.length === 0 ? (
                <Card className="bg-white border-slate-200"><CardContent className="py-10 text-center text-slate-400 text-sm">You haven't published any templates yet.</CardContent></Card>
              ) : (
                <div className="space-y-2" data-testid="market-my-listings">
                  {listings.map((t) => (
                    <Card key={t.id} className="bg-white border-slate-200"><CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-navy-900 font-semibold text-sm">{t.title}</p>
                        <p className="text-slate-400 text-xs">{t.category} · {t.royalty_pct}% royalty · {t.sales_count} sold {t.status !== 'published' && '· (unpublished)'}</p>
                      </div>
                      <span className="text-coral-600 font-bold text-sm">{t.price_usd > 0 ? `$${t.price_usd}` : 'Free'}</span>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'purchases' && (
            purchases.length === 0 ? (
              <Card className="bg-white border-slate-200"><CardContent className="py-10 text-center text-slate-400 text-sm">No purchases yet. Browse the marketplace to find templates.</CardContent></Card>
            ) : (
              <div className="space-y-2" data-testid="market-my-purchases">
                {purchases.map((s) => (
                  <Card key={s.id} className="bg-white border-slate-200"><CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-navy-900 font-semibold text-sm">{s.template_title}</p>
                      <p className="text-slate-400 text-xs">Purchased {new Date(s.purchased_at).toLocaleDateString()} · receipt anchored</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-navy-300 text-navy-600 h-8 text-xs" onClick={() => openDetail(s.template_id)} data-testid={`market-open-purchase-${s.id}`}>
                      View Document
                    </Button>
                  </CardContent></Card>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-white max-w-lg" data-testid="market-detail-modal">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900">{selected.title}</DialogTitle>
              </DialogHeader>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-700">{selected.category}</span>
                  <span className="text-coral-600 font-bold">{selected.price_usd > 0 ? `$${selected.price_usd}` : 'Free'}</span>
                  <span className="text-slate-400 text-xs">by {selected.creator_name}</span>
                </div>
                <p className="text-slate-500 text-sm mb-3">{selected.description || selected.preview}</p>
                {selected.document ? (
                  <div className="bg-cream-100 rounded-lg p-3 border border-slate-200 max-h-48 overflow-y-auto mb-3">
                    <p className="text-navy-900 font-semibold text-sm mb-1">{selected.document.title}</p>
                    {(selected.document.sections || []).map((s, i) => (
                      <div key={i} className="mb-2"><p className="text-navy-700 text-xs font-medium">{s.heading}</p><p className="text-slate-500 text-[11px] line-clamp-2">{s.content}</p></div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic mb-3">{selected.preview}…</p>
                )}
                {selected.owned ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm"><CheckCircle2 className="w-4 h-4" /> This is your listing.</div>
                ) : selected.purchased ? (
                  <Button onClick={() => navigate('/ai-generator')} className="w-full bg-navy-700 hover:bg-navy-800" data-testid="market-open-owned">Open in Studio</Button>
                ) : (
                  <Button onClick={purchase} disabled={buying} className="w-full bg-coral-500 hover:bg-coral-600 text-white" data-testid="market-buy-btn">
                    {buying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                    {selected.price_usd > 0 ? `Buy for $${selected.price_usd}` : 'Get Free Template'}
                  </Button>
                )}
                <p className="text-[10px] text-slate-400 text-center mt-2">Payment is simulated in this preview · sale receipt anchored on Hedera</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default TemplateMarketplace;
