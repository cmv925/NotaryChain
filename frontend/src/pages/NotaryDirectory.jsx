import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, Search, MapPin, Award, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const PAGE_SIZE = 24;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function NotaryDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, notaries: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (q) params.append('q', q);
    if (state) params.append('state', state);
    try {
      const r = await fetch(`${API}/api/verify/notaries?${params.toString()}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setData({ total: 0, notaries: [], error: e.message });
    }
    setLoading(false);
  }, [q, state, page]);

  useEffect(() => { load(); }, [load]);

  const submit = (e) => {
    e?.preventDefault();
    setPage(1);
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (state) next.set('state', state);
    setSearchParams(next);
  };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="notary-directory-page">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-emerald-950/30 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <span className="text-emerald-400 text-[11px] uppercase tracking-[0.25em] font-bold">Notary Directory</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Find a verified NotaryChain notary.</h1>
          <p className="text-slate-400 text-base max-w-2xl">
            Every notary listed here is bonded, licensed, and seals every notarization to the Hedera blockchain.
            Public, free, and continuously audited.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <form onSubmit={submit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <Input
              placeholder="Search by name or license number..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-slate-900/60 border-slate-800 pl-9"
              data-testid="directory-search-input"
            />
          </div>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="bg-slate-900/60 border border-slate-800 rounded-md px-3 h-10 text-sm text-white"
            data-testid="directory-state-filter"
          >
            <option value="">All states</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" data-testid="directory-search-btn">
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
        </form>

        <div className="flex items-center justify-between mt-5 text-xs text-slate-500">
          <span data-testid="directory-total">
            {loading ? 'Searching…' : `${data.total || 0} notar${(data.total || 0) === 1 ? 'y' : 'ies'} found`}
          </span>
          {totalPages > 1 && (
            <span>Page {page} of {totalPages}</span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        {loading && (
          <div className="text-center py-16" data-testid="directory-loading">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading directory…</p>
          </div>
        )}

        {!loading && (data.notaries || []).length === 0 && (
          <Card className="bg-slate-900/40 border-slate-800" data-testid="directory-empty">
            <CardContent className="p-12 text-center">
              <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold mb-1">No notaries match your search</h3>
              <p className="text-xs text-slate-500">Try a broader filter or clear the state selection.</p>
            </CardContent>
          </Card>
        )}

        {!loading && (data.notaries || []).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="directory-results">
            {data.notaries.map(n => (
              <Link
                key={n.notary_id}
                to={`/notary/${n.notary_id}`}
                className="block group"
                data-testid={`notary-card-${n.notary_id}`}
              >
                <Card className="bg-slate-900/60 border-slate-800 hover:border-emerald-500/40 transition-colors h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate group-hover:text-emerald-300 transition-colors">{n.name || '—'}</h3>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{n.notary_id}</p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${n.bond_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>
                        {n.bond_active ? 'Bonded' : 'No bond'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {n.license_state && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400/70" />
                          <span>{n.license_state}</span>
                          {n.license_number && <span className="text-slate-600">· {n.license_number}</span>}
                        </div>
                      )}
                      {n.bond_amount_usd && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Award className="w-3.5 h-3.5 text-amber-400/70" />
                          <span>Bond: ${(n.bond_amount_usd || 0).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-slate-500">Seals</span>
                        <span className="ml-1.5 font-bold text-white">{(n.total_seals || 0).toLocaleString()}</span>
                      </div>
                      <span className="text-emerald-400 group-hover:text-emerald-300 inline-flex items-center gap-1">
                        View profile <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8" data-testid="directory-pagination">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="bg-slate-900/60 border-slate-800 text-white hover:bg-slate-800"
              data-testid="pagination-prev"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="text-xs text-slate-500 px-3">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="bg-slate-900/60 border-slate-800 text-white hover:bg-slate-800"
              data-testid="pagination-next"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <Shield className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="font-bold mb-1">Are you a notary?</h4>
            <p className="text-slate-500 text-xs leading-relaxed mb-2">Get listed in this directory automatically. Onboard in under 5 minutes.</p>
            <Link to="/notary/onboarding" className="text-emerald-400 text-xs hover:underline">Onboard now →</Link>
          </div>
          <div>
            <Award className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="font-bold mb-1">Verify a document</h4>
            <p className="text-slate-500 text-xs leading-relaxed mb-2">Drop a PDF or paste a hash. See if it’s notarized on Hedera.</p>
            <Link to="/verify" className="text-amber-400 text-xs hover:underline">Open Verify →</Link>
          </div>
          <div>
            <ExternalLink className="w-5 h-5 text-sky-400 mb-2" />
            <h4 className="font-bold mb-1">Need notarization?</h4>
            <p className="text-slate-500 text-xs leading-relaxed mb-2">AI-powered, blockchain-sealed, court-admissible.</p>
            <Link to="/" className="text-sky-400 text-xs hover:underline">Start with NotaryChain →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
