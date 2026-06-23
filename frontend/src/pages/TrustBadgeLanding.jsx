import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { graph, faqSchema, breadcrumbSchema } from '../lib/seo';
import { Shield, Check, ArrowRight, Code, Lock, Eye, TrendingUp, Award, Loader2, Globe, Zap, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STYLE_PALETTES = {
  default: { bg: '#0f172a', accent: '#0ea5e9', text: '#f8fafc' },
  dark: { bg: '#020617', accent: '#22c55e', text: '#f1f5f9' },
  light: { bg: '#f8fafc', accent: '#0284c7', text: '#0f172a' },
  minimal: { bg: '#ffffff', accent: '#1e293b', text: '#0f172a' },
};

export default function TrustBadgeLanding() {
  const navigate = useNavigate();
  const [previewBusiness, setPreviewBusiness] = useState('Your Business');
  const [previewStyle, setPreviewStyle] = useState('default');
  const [previewVerified, setPreviewVerified] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  const checkout = async (plan_id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate(`/login?next=/trust-badge`);
      return;
    }
    setCheckoutLoading(plan_id);
    try {
      const res = await fetch(`${API}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id, origin_url: window.location.origin }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d?.detail || 'Could not start checkout');
        setCheckoutLoading(null);
        return;
      }
      window.location.href = d.checkout_url;
    } catch (e) {
      toast.error(e.message);
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900" data-testid="trust-badge-landing-page">
      <Seo
        path="/trust-badge"
        title="Trust Badge — Show Verified Trust on Your Website"
        description="Add a verifiable NotaryChain trust badge to your website. Live blockchain-backed verification, 60-second setup, and a conversion lift comparable to McAfee SECURE and Norton seals."
        keywords="website trust badge, trust seal, verified badge, blockchain trust badge, conversion trust signal"
        jsonLd={graph(
          faqSchema([
            { q: 'What is a NotaryChain trust badge?', a: 'A verifiable on-page badge that proves your business and documents are cryptographically verified on the Hedera blockchain. Visitors can click it to confirm authenticity in real time.' },
            { q: 'How long does it take to set up?', a: 'About 60 seconds — customize the badge, add your domain, and paste a single embed snippet onto your site.' },
            { q: 'Will the badge slow down my website?', a: 'No. The badge is a lightweight, asynchronously loaded widget that does not impact Core Web Vitals.' },
          ]),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Trust Badge' }]),
        )}
      />
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.15),_transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-coral-600" />
            <span className="text-coral-600 text-[11px] uppercase tracking-[0.3em] font-bold">Trust Badge — From $29/mo</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold leading-tight mb-5 max-w-4xl">
            The trust seal that <span className="italic text-coral-600">never lies.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
            One line of JavaScript. A blockchain-verified trust badge appears on your site, links to a public verification page sealed on Hedera mainnet, and lifts your conversion rate the same week you install it.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Button onClick={() => checkout('trust_badge')} disabled={checkoutLoading === 'trust_badge'} size="lg" className="bg-coral-500 hover:bg-coral-600 text-slate-950 font-bold h-12 px-6" data-testid="hero-pro-checkout-btn">
              {checkoutLoading === 'trust_badge' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
              Get Trust Badge — $29/mo
            </Button>
            <a href="#how-it-works" className="text-navy-800 hover:text-navy-900 text-sm flex items-center gap-1">See how it works <ArrowRight className="w-4 h-4" /></a>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-coral-600" /> No setup fees</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-coral-600" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-coral-600" /> Setup in 60 seconds</span>
          </div>
        </div>
      </section>

      {/* PROOF NUMBERS */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-6">Trust seals work — the data</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            {[
              { v: '+18%', l: 'Avg conversion lift', sub: 'Trustpilot/Norton studies' },
              { v: '$1.5B', l: 'McAfee SECURE annual rev', sub: 'a $29 trust seal' },
              { v: '74%', l: 'consumers check trust signals', sub: 'before purchase' },
              { v: '60s', l: 'NotaryChain setup time', sub: 'JS or HTML snippet' },
            ].map(s => (
              <div key={s.l}>
                <p className="text-3xl sm:text-4xl font-bold text-coral-500">{s.v}</p>
                <p className="text-sm text-slate-200 mt-1">{s.l}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE BADGE PREVIEW */}
      <section className="border-b border-slate-200" id="how-it-works">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Customize your badge in real-time</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Pick a style. Type your business name. Copy the snippet. Done.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500">Business Name</label>
                  <Input value={previewBusiness} onChange={(e) => setPreviewBusiness(e.target.value)}
                    className="bg-cream-200 border-slate-300 mt-1" data-testid="preview-business-input" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500">Style</label>
                  <div className="grid grid-cols-4 gap-2 mt-1.5">
                    {Object.entries(STYLE_PALETTES).map(([k, p]) => (
                      <button key={k} onClick={() => setPreviewStyle(k)}
                        className={`rounded p-2 text-xs font-medium border transition-all ${previewStyle === k ? 'border-coral-300' : 'border-slate-300 hover:border-slate-500'}`}
                        style={{ background: p.bg, color: p.text }}
                        data-testid={`preview-style-${k}`}>{k}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setPreviewVerified(!previewVerified)}
                    className={`text-xs px-3 py-1.5 rounded border ${previewVerified ? 'bg-coral-500/20 text-coral-600 border-emerald-500/40' : 'bg-coral-500/20 text-coral-600 border-amber-500/40'}`}
                    data-testid="preview-toggle-verified">
                    {previewVerified ? '✓ Verified state' : '⚠ Pending state'}
                  </button>
                  <span className="text-[10px] text-slate-500">Toggle to compare states</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3 text-center">Live Preview</p>
                <div className="flex justify-center mb-5">
                  <BadgePreview business={previewBusiness} style={previewStyle} verified={previewVerified} />
                </div>
                <div className="bg-cream-100 border border-slate-200 rounded p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">One-line install</p>
                  <pre className="text-[10px] font-mono text-coral-700 overflow-x-auto whitespace-pre-wrap break-all" data-testid="preview-snippet">
{`<script src="${API}/api/verify/widget.js" data-badge-id="YOUR_BADGE_ID"${previewStyle !== 'default' ? ` data-style="${previewStyle}"` : ''}></script>`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">From signup to trust badge in 60 seconds</h2>
          <p className="text-center text-slate-600 mb-10">No code review. No DNS specialist. Drop one line on your site.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { n: '1', icon: Award, t: 'Subscribe', d: 'Pick Trust Badge ($29/mo) and check out via Stripe.' },
              { n: '2', icon: Globe, t: 'Add your domain', d: 'Tell NotaryChain which website the badge belongs on.' },
              { n: '3', icon: Code, t: 'Paste the snippet', d: 'One <script> tag, or one <img> tag. Done.' },
              { n: '4', icon: Lock, t: 'Verify domain', d: 'Add a DNS TXT record to flip from "Pending" to "Verified".' },
            ].map(s => (
              <Card key={s.n} className="bg-white border-slate-200">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-coral-500/20 text-coral-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{s.n}</span>
                    <s.icon className="w-4 h-4 text-coral-600" />
                  </div>
                  <p className="font-bold text-navy-900 mb-1">{s.t}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">Who uses NotaryChain Trust Badges?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Shield, t: 'Notary Firms', d: 'Show prospective clients your seals are immutable, blockchain-verified, and court-admissible.', accent: '#0ea5e9' },
              { icon: TrendingUp, t: 'Title & Escrow Companies', d: 'Lift conversion on landing pages where buyers second-guess online closings.', accent: '#22c55e' },
              { icon: Zap, t: 'High-Value B2B SaaS', d: 'Anyone selling contracts, agreements, or fiduciary services online.', accent: '#f59e0b' },
              { icon: Eye, t: 'Marketplaces', d: 'Vetted vendors get a verified badge. Trust the platform, trust the seller.', accent: '#a855f7' },
              { icon: Lock, t: 'Legal & Compliance Tools', d: 'Anything that signs, witnesses, or notarizes — provable on-chain.', accent: '#ec4899' },
              { icon: Award, t: 'Real Estate Brokerages', d: 'Pair with NotaryChain RON ceremonies for end-to-end trust.', accent: '#14b8a6' },
            ].map(u => (
              <Card key={u.t} className="bg-white border-slate-200 hover:border-slate-300 transition-colors">
                <CardContent className="p-5">
                  <u.icon className="w-5 h-5 mb-2" style={{ color: u.accent }} />
                  <p className="font-bold text-navy-900 mb-1">{u.t}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{u.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-b border-slate-200 bg-white" id="pricing">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">Simple pricing</h2>
          <p className="text-center text-slate-600 mb-10">Cancel anytime. Trust Badge from $29 · Professional from $99 · Enterprise from $199.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* TRUST BADGE — featured */}
            <Card className="bg-white border-gold-500/30 relative" data-testid="pricing-card-trust-badge">
              <div className="absolute -top-3 left-6 bg-coral-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded">POPULAR</div>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Trust Badge</h3>
                <div className="mt-2 mb-1">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="text-slate-500 text-sm"> /mo</span>
                </div>
                <p className="text-xs text-slate-500 mb-5">Standalone embeddable trust seal for your website</p>
                <ul className="space-y-2 text-sm mb-5">
                  {[
                    '1 verified Trust Badge',
                    'JavaScript widget + HTML snippet',
                    'Domain ownership verification (DNS or .well-known)',
                    'Live impression analytics',
                    '4 badge styles (default / dark / light / minimal)',
                    'Public verifier landing for visitors',
                    'Hedera-sealed verification trail',
                    'Email support',
                  ].map(f => <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-coral-600 flex-shrink-0 mt-0.5" /><span className="text-navy-800">{f}</span></li>)}
                </ul>
                <Button onClick={() => checkout('trust_badge')} disabled={checkoutLoading === 'trust_badge'} className="w-full bg-coral-500 hover:bg-coral-600 text-slate-950 font-bold h-11" data-testid="pricing-trust-badge-btn">
                  {checkoutLoading === 'trust_badge' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
                  Get Trust Badge — $29/mo
                </Button>
              </CardContent>
            </Card>

            {/* PRO */}
            <Card className="bg-white border-slate-200" data-testid="pricing-card-pro">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Professional</h3>
                <div className="mt-2 mb-1">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-slate-500 text-sm"> /mo</span>
                </div>
                <p className="text-xs text-slate-500 mb-5">Trust Badge + the full NotaryChain platform</p>
                <ul className="space-y-2 text-sm mb-5">
                  {[
                    'Unlimited Trust Badges',
                    'Unlimited notarizations',
                    'AI Document Summarizer & Generator',
                    'AI Doc Compare & Remediation',
                    'Biometric Passport',
                    'Video notarization (RON)',
                    'Blockchain sealing on Hedera',
                    'Priority support',
                  ].map(f => <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-coral-500 flex-shrink-0 mt-0.5" /><span className="text-navy-800">{f}</span></li>)}
                </ul>
                <Button onClick={() => checkout('pro')} disabled={checkoutLoading === 'pro'} variant="outline" className="w-full border-slate-300 hover:bg-cream-200 h-11" data-testid="pricing-pro-btn">
                  {checkoutLoading === 'pro' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Upgrade to Professional
                </Button>
              </CardContent>
            </Card>

            {/* ENTERPRISE */}
            <Card className="bg-white border-slate-200" data-testid="pricing-card-enterprise">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Enterprise</h3>
                <div className="mt-2 mb-1">
                  <span className="text-4xl font-bold">$199</span>
                  <span className="text-slate-500 text-sm"> /mo</span>
                </div>
                <p className="text-xs text-slate-500 mb-5">White-label, no-NotaryChain branding + everything Enterprise</p>
                <ul className="space-y-2 text-sm mb-5">
                  {[
                    'Everything in Professional',
                    'White-label trust badges (your brand)',
                    'Custom verifier domain (verify.yourbrand.com)',
                    'Unlimited Living Identity challenges',
                    'Partner API ($0.50/call)',
                    'Dedicated account manager',
                    'Priority SLA + 24/7 phone',
                    'SOC2 / ISO compliance reports',
                  ].map(f => <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-coral-600 flex-shrink-0 mt-0.5" /><span className="text-navy-800">{f}</span></li>)}
                </ul>
                <Button onClick={() => checkout('enterprise')} disabled={checkoutLoading === 'enterprise'} variant="outline" className="w-full border-slate-300 hover:bg-cream-200 h-11" data-testid="pricing-enterprise-btn">
                  {checkoutLoading === 'enterprise' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Subscribe to Enterprise
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">Need 100+ badges or custom legal terms? <a href="mailto:hello@notarychain.app" className="text-coral-500 hover:underline">Contact us</a></p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">Frequently asked</h2>
          <div className="space-y-3">
            {[
              { q: 'How long does setup take?', a: 'About 60 seconds. Subscribe → enter your domain → copy the one-line script tag → paste into your site\'s footer. The badge appears instantly. Domain verification (optional but recommended) takes 5 more minutes via DNS TXT.' },
              { q: 'What happens if I cancel?', a: 'Your badges stop rendering immediately. Visitors who click the badge URL will see "Subscription expired" instead of a verification result. Resubscribe anytime to bring them back.' },
              { q: 'Will it work with my website?', a: 'Yes — anywhere you can paste a <script> tag (Wix, WordPress, Webflow, Shopify, Squarespace, custom HTML, React/Next.js apps, plain static sites). We even render as a plain <img> if you prefer.' },
              { q: 'Is the badge visible on mobile?', a: 'Yes. The widget is fully responsive and capped at 200px wide.' },
              { q: 'How is this different from a SiteSeal or McAfee SECURE?', a: 'Those badges verify the site has a paid certificate. NotaryChain verifies a real-world trust event — actual notarized documents, identity attestations, and on-chain seals. Visitors clicking through see Hedera transaction proofs, not marketing copy.' },
              { q: 'Does this affect my Core Web Vitals?', a: 'No. The widget loads asynchronously and is under 1 KB. The SVG renders without webfonts or external requests.' },
            ].map((f, i) => (
              <Card key={i} className="bg-white border-slate-200">
                <CardContent className="p-5">
                  <p className="font-bold text-navy-900 mb-2">{f.q}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-navy-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <Award className="w-12 h-12 mx-auto text-coral-600 mb-4" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Ready to lift your conversion rate?</h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">Drop a NotaryChain Trust Badge on your site this afternoon. Cancel any time.</p>
          <Button onClick={() => checkout('trust_badge')} disabled={checkoutLoading === 'trust_badge'} size="lg" className="bg-coral-500 hover:bg-coral-600 text-slate-950 font-bold h-12 px-8" data-testid="final-cta-btn">
            {checkoutLoading === 'trust_badge' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Get Your Trust Badge — $29/mo
          </Button>
          <p className="text-xs text-slate-500 mt-4">
            <a href="/verify" className="hover:text-navy-800 inline-flex items-center gap-1">Try the free public verifier first <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>
      </section>
    </div>
  );
}

/* ══════════ Live preview SVG (renders without backend) ══════════ */
function BadgePreview({ business, style, verified }) {
  const p = STYLE_PALETTES[style] || STYLE_PALETTES.default;
  const status = verified ? 'VERIFIED' : 'PENDING VERIFICATION';
  const statusColor = verified ? p.accent : '#f59e0b';
  const muted = style === 'light' || style === 'minimal' ? '#475569' : '#94a3b8';
  const display = (business || 'Your Business').slice(0, 25) + (business?.length > 25 ? '…' : '');
  return (
    <svg width="220" height="74" viewBox="0 0 200 68" role="img" data-testid="badge-svg-preview">
      <rect width="200" height="68" rx="8" fill={p.bg} stroke={p.accent} strokeOpacity="0.3" />
      <g transform="translate(12, 14)">
        <path d="M20 0 L36 8 V20 C36 30 28 38 20 40 C12 38 4 30 4 20 V8 Z" fill="none" stroke={p.accent} strokeWidth="2" />
        <path d="M14 20 L18 24 L26 14" fill="none" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="56" y="22" fontFamily="-apple-system,Segoe UI,sans-serif" fontSize="9" fontWeight="700" letterSpacing="1.2" fill={statusColor}>{status}</text>
      <text x="56" y="40" fontFamily="-apple-system,Segoe UI,sans-serif" fontSize="13" fontWeight="700" fill={p.text}>NotaryChain</text>
      <text x="56" y="56" fontFamily="-apple-system,Segoe UI,sans-serif" fontSize="9" fill={muted}>{display}</text>
    </svg>
  );
}
