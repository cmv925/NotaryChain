/**
 * Marketplace — public notary discovery + dynamic-pricing quote calculator.
 * Route: /marketplace
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Star, MapPin, Award, ChevronRight, Loader2, Sparkles, X, ShieldCheck, Calculator } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATES = ['FL', 'TX', 'NY', 'CA', 'VA'];
const DOC_TYPES = [
  { v: 'acknowledgment', l: 'Acknowledgment' },
  { v: 'affidavit', l: 'Affidavit' },
  { v: 'real_estate', l: 'Real estate / deed' },
  { v: 'mortgage', l: 'Mortgage' },
  { v: 'power_of_attorney', l: 'Power of Attorney' },
  { v: 'will', l: 'Will / trust' },
  { v: 'lien_release', l: 'Lien release' },
];
const URGENCIES = [
  { v: 'standard', l: 'Standard' },
  { v: 'same_day', l: 'Same day (+30%)' },
  { v: 'after_hours', l: 'After hours (+25%)' },
  { v: 'weekend', l: 'Weekend (+20%)' },
  { v: 'rush', l: 'Rush (+40%)' },
];

const fmt$ = (n) => `$${(n || 0).toFixed(2)}`;

const Stars = ({ rating, count }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-1" data-testid="rating-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= full ? 'fill-amber-400 text-amber-400' : (i === full + 1 && half ? 'fill-amber-200 text-amber-400' : 'fill-slate-200 text-slate-300')}`}
        />
      ))}
      <span className="text-[12px] text-slate-700 font-semibold ml-1">{rating?.toFixed(1) || '—'}</span>
      <span className="text-[11px] text-slate-500">({count} {count === 1 ? 'review' : 'reviews'})</span>
    </span>
  );
};

export default function Marketplace() {
  const [notaries, setNotaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    state: '', search: '', sort_by: 'rating', min_rating: 0, ron_certified: false,
  });

  // Quote modal state
  const [quoteOpen, setQuoteOpen] = useState(null); // { notary }
  const [quote, setQuote] = useState(null);
  const [quoteParams, setQuoteParams] = useState({ state_code: 'FL', document_type: 'acknowledgment', urgency: 'standard' });
  const [quoteLoading, setQuoteLoading] = useState(false);

  const fetchNotaries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.state) params.set('state', filters.state);
      if (filters.search) params.set('search', filters.search);
      if (filters.sort_by) params.set('sort_by', filters.sort_by);
      if (filters.min_rating > 0) params.set('min_rating', filters.min_rating);
      if (filters.ron_certified) params.set('ron_certified', 'true');
      params.set('limit', '50');
      const res = await axios.get(`${API}/marketplace/notaries?${params}`);
      setNotaries(res.data.notaries || []);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchNotaries(); }, [fetchNotaries]);

  const fetchQuote = useCallback(async () => {
    if (!quoteOpen) return;
    setQuoteLoading(true);
    try {
      const res = await axios.post(`${API}/marketplace/quote`, {
        notary_id: quoteOpen.notary_id,
        ...quoteParams,
      });
      setQuote(res.data);
    } catch (e) {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [quoteOpen, quoteParams]);

  useEffect(() => { if (quoteOpen) fetchQuote(); }, [quoteOpen, quoteParams, fetchQuote]);

  return (
    <div className="min-h-screen bg-cream-100" data-testid="marketplace-page">
      {/* Hero */}
      <section className="bg-ink-900 text-cream-100 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-[11px] tracking-[0.2em] uppercase text-coral-400 font-bold mb-2">Notary Marketplace</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Find a verified notary.</h1>
          <p className="text-ink-200 text-[15px] mt-3 max-w-2xl">
            Browse RON-certified notaries by state, specialty, and rating. Every ceremony is sealed on Hedera and gated through
            our multi-state pre-seal evaluator. Transparent pricing — see exactly what you'll pay before you commit.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Filter strip */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-3" data-testid="marketplace-filters">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by name, license, or specialty…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 h-10 text-sm border-slate-300"
              data-testid="marketplace-search"
            />
          </div>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white"
            data-testid="marketplace-state-filter"
          >
            <option value="">All states</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
            className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white"
            data-testid="marketplace-sort"
          >
            <option value="rating">Highest rated</option>
            <option value="experience">Most experienced</option>
            <option value="rate">Lowest price</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 ml-2" data-testid="marketplace-ron-toggle">
            <input
              type="checkbox"
              checked={filters.ron_certified}
              onChange={(e) => setFilters({ ...filters, ron_certified: e.target.checked })}
              className="rounded border-slate-300"
            />
            RON-certified only
          </label>
          <span className="ml-auto text-[12px] text-slate-500" data-testid="marketplace-count">
            {loading ? '…' : `${notaries.length} ${notaries.length === 1 ? 'notary' : 'notaries'}`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-coral-500 animate-spin" /></div>
        ) : notaries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center" data-testid="marketplace-empty">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-ink-900 text-base font-semibold mb-1">No notaries match your filters</p>
            <p className="text-slate-600 text-sm">Try widening your state or sort criteria.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="marketplace-grid">
            {notaries.map((n) => {
              const initials = (n.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div
                  key={n.notary_id}
                  className="bg-white border border-slate-200 rounded-lg p-5 hover:border-coral-300 hover:shadow-sm transition-all flex flex-col"
                  data-testid={`marketplace-card-${n.notary_id}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink-900 font-semibold text-[15px] truncate">{n.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[12px] text-slate-600">
                          <MapPin className="w-3 h-3" /> {n.license_state}
                        </span>
                        {n.ron_certified && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-coral-50 text-coral-700 px-1.5 py-0.5 rounded font-bold">
                            <ShieldCheck className="w-3 h-3" /> RON
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Stars rating={n.avg_rating} count={n.review_count} />

                  {n.bio && <p className="text-slate-600 text-[13px] mt-3 line-clamp-2">{n.bio}</p>}

                  {n.specializations?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {n.specializations.slice(0, 3).map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-cream-200 text-slate-700 text-[11px] rounded font-medium">{s}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">From</p>
                      <p className="text-ink-900 font-serif text-2xl">{fmt$(n.hourly_rate)}<span className="text-[12px] text-slate-500 font-sans ml-1">/ ceremony</span></p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setQuoteOpen(n); setQuote(null); setQuoteParams({ state_code: n.license_state || 'FL', document_type: 'acknowledgment', urgency: 'standard' }); }}
                      className="bg-coral-500 hover:bg-coral-600 text-white h-9 text-[12px]"
                      data-testid={`marketplace-quote-btn-${n.notary_id}`}
                    >
                      <Calculator className="w-3.5 h-3.5 mr-1.5" /> Get quote
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Quote modal */}
      {quoteOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setQuoteOpen(null)} data-testid="quote-modal">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-coral-600 font-bold mb-1">Live Quote</p>
                <h3 className="font-serif text-2xl text-ink-900">{quoteOpen.name}</h3>
                <p className="text-slate-600 text-[13px]">{quoteOpen.license_state} · {quoteOpen.license_number}</p>
              </div>
              <button onClick={() => setQuoteOpen(null)} className="text-slate-500 hover:text-ink-900" data-testid="quote-close-btn">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-200" data-testid="quote-controls">
              <label className="text-[11px]">
                <p className="uppercase tracking-wider text-slate-500 font-bold mb-1">State</p>
                <select value={quoteParams.state_code} onChange={(e) => setQuoteParams({ ...quoteParams, state_code: e.target.value })} className="w-full h-9 px-2 border border-slate-300 rounded text-sm bg-white" data-testid="quote-state">
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-[11px]">
                <p className="uppercase tracking-wider text-slate-500 font-bold mb-1">Document</p>
                <select value={quoteParams.document_type} onChange={(e) => setQuoteParams({ ...quoteParams, document_type: e.target.value })} className="w-full h-9 px-2 border border-slate-300 rounded text-sm bg-white" data-testid="quote-doc">
                  {DOC_TYPES.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </label>
              <label className="text-[11px]">
                <p className="uppercase tracking-wider text-slate-500 font-bold mb-1">Urgency</p>
                <select value={quoteParams.urgency} onChange={(e) => setQuoteParams({ ...quoteParams, urgency: e.target.value })} className="w-full h-9 px-2 border border-slate-300 rounded text-sm bg-white" data-testid="quote-urgency">
                  {URGENCIES.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                </select>
              </label>
            </div>

            <div className="px-6 py-5 space-y-1 bg-cream-100">
              {quoteLoading || !quote ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-coral-500 animate-spin" /></div>
              ) : (
                <>
                  {quote.breakdown.map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-sm" data-testid={`quote-line-${i}`}>
                      <span className="text-slate-700">{b.label}</span>
                      <span className={`font-mono font-semibold ${b.value > 0 ? 'text-ink-900' : 'text-slate-400'}`}>
                        {b.value > 0 ? `+${fmt$(b.value)}` : '—'}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between" data-testid="quote-total">
                    <span className="text-ink-900 font-bold uppercase tracking-wider text-[12px]">Total</span>
                    <span className="font-serif text-3xl text-coral-600 font-light">{fmt$(quote.total_usd)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-right mt-1">Valid for {quote.valid_for_minutes} min · issued {new Date(quote.issued_at).toLocaleTimeString()}</p>
                </>
              )}
            </div>

            <div className="px-6 py-4 flex items-center gap-3 border-t border-slate-200">
              <Link
                to={`/request-notarization?notary_id=${quoteOpen.notary_id}&state=${quoteParams.state_code}&doc_type=${quoteParams.document_type}`}
                className="flex-1"
                data-testid="quote-book-btn"
              >
                <Button className="w-full bg-coral-500 hover:bg-coral-600 text-white h-10">
                  Book this notary <ChevronRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setQuoteOpen(null)} className="border-slate-300 text-ink-900 h-10">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
