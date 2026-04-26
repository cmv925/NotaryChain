import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network, ArrowRight, CheckCircle, Code, Shield, Zap, Users, ExternalLink, Copy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TrustLayerLanding() {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/trustlayer/partners/public`)
      .then(r => r.ok ? r.json() : { partners: [] })
      .then(d => setPartners(d.partners || []))
      .catch(() => setPartners([]));
  }, []);

  const copy = (txt) => navigator.clipboard.writeText(txt).then(() => toast.success('Copied'));

  const sdkSnippet = `<script src="${API}/api/trustlayer/sdk.js" data-user-id="USER_ID"></script>`;
  const verifySnippet = `curl -X POST "${API}/api/trustlayer/verify" \\
  -H "X-TrustLayer-Key: $YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"subject_user_id":"USER_ID"}'`;

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="trustlayer-landing">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-violet-950/30 via-slate-950 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-6 h-6 text-violet-400" />
            <span className="text-violet-400 text-[11px] uppercase tracking-[0.25em] font-bold">TrustLayer · Phase 1</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 leading-tight">
            One identity.<br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400">
              A federated network of trust.
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mb-8">
            TrustLayer is the universal verification network on top of NotaryChain. Any third-party
            verifier — KYC providers, employers, license boards, banks — can issue cryptographic
            attestations about a user. Anyone can query the federated trust graph in real-time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/admin/trustlayer" data-testid="cta-become-partner">
              <Button className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-6 h-11">
                Become a partner <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" className="bg-slate-900/60 border-slate-700 text-white hover:bg-slate-800 text-sm px-6 h-11">
                How it works
              </Button>
            </a>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Partner network" value={partners.length} sub="active verifiers" />
            <Stat label="Attestations issued" value={partners.reduce((s,p) => s + (p.stats?.attestations_issued || 0), 0)} sub="lifetime" />
            <Stat label="Verifications served" value={partners.reduce((s,p) => s + (p.stats?.verifications_served || 0), 0)} sub="API calls" />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">How TrustLayer works</h2>
          <p className="text-slate-400 max-w-2xl mb-10 text-sm">Three roles, one federated graph.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Role
              icon={Users}
              color="violet"
              title="1. Trust Partners"
              description="KYC providers, license boards, employers, banks. Register with NotaryChain, get a TrustLayer API key, issue cryptographic attestations about a user_id."
            />
            <Role
              icon={Shield}
              color="sky"
              title="2. Subjects (NotaryChain users)"
              description="Every NotaryChain user automatically has a federated trust graph. Living Identity scores, partner attestations, and notarization history all roll up into one verifiable score."
            />
            <Role
              icon={Zap}
              color="emerald"
              title="3. Verifiers"
              description="Drop our SDK snippet on any signup, login, or checkout flow. One API call returns a 0-100 trust score plus the full evidence chain. Auditable forever."
            />
          </div>
        </div>
      </div>

      {/* Code snippets */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">Drop-in integration</h2>
          <p className="text-slate-400 max-w-2xl mb-10 text-sm">Two lines of code. No SDK install. Works on any platform.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-950 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-violet-400" />
                    <h3 className="font-bold text-sm">Embed a trust badge</h3>
                  </div>
                  <button onClick={() => copy(sdkSnippet)} className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1" data-testid="copy-sdk-snippet">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <pre className="bg-slate-900/60 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre">
{sdkSnippet}
                </pre>
              </CardContent>
            </Card>
            <Card className="bg-slate-950 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm">Verify via API</h3>
                  </div>
                  <button onClick={() => copy(verifySnippet)} className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1" data-testid="copy-verify-snippet">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <pre className="bg-slate-900/60 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre">
{verifySnippet}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Partner registry */}
      <div className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-1">Partner registry</h2>
              <p className="text-slate-400 text-sm">Public list of active TrustLayer partners.</p>
            </div>
            <Link to="/admin/trustlayer" className="text-violet-400 text-sm hover:underline inline-flex items-center gap-1" data-testid="manage-partners-link">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {partners.length === 0 ? (
            <Card className="bg-slate-900/40 border-dashed border-slate-700">
              <CardContent className="p-10 text-center">
                <Network className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold mb-1">No partners yet</h3>
                <p className="text-xs text-slate-500 mb-4">Be the first verifier on the NotaryChain trust network.</p>
                <Link to="/admin/trustlayer">
                  <Button className="bg-violet-600 hover:bg-violet-500" data-testid="onboard-partner-btn">Onboard a partner</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="partners-grid">
              {partners.map(p => (
                <Card key={p.partner_id} className="bg-slate-900/60 border-slate-800 hover:border-violet-500/40 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-white">{p.name}</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mb-3">{p.domain}</p>
                    {p.description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.description}</p>}
                    <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-800">
                      <span><span className="text-slate-500">Issued</span> <b className="text-white">{p.stats?.attestations_issued || 0}</b></span>
                      <span><span className="text-slate-500">Verified</span> <b className="text-white">{p.stats?.verifications_served || 0}</b></span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <Network className="w-5 h-5 text-violet-400 mb-2" />
          <h4 className="font-bold mb-1">Are you a verifier?</h4>
          <p className="text-slate-500 text-xs leading-relaxed mb-2">Get an API key and start issuing attestations in minutes.</p>
          <Link to="/admin/trustlayer" className="text-violet-400 text-xs hover:underline">Become a partner →</Link>
        </div>
        <div>
          <Shield className="w-5 h-5 text-sky-400 mb-2" />
          <h4 className="font-bold mb-1">Are you a NotaryChain user?</h4>
          <p className="text-slate-500 text-xs leading-relaxed mb-2">Your trust graph is already live — share it anywhere.</p>
          <Link to="/identity" className="text-sky-400 text-xs hover:underline">View your identity →</Link>
        </div>
        <div>
          <ExternalLink className="w-5 h-5 text-emerald-400 mb-2" />
          <h4 className="font-bold mb-1">Need notarization?</h4>
          <p className="text-slate-500 text-xs leading-relaxed mb-2">AI-powered, blockchain-sealed, court-admissible.</p>
          <Link to="/" className="text-emerald-400 text-xs hover:underline">Start with NotaryChain →</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-800 px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function Role({ icon: Icon, color, title, description }) {
  const map = {
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  return (
    <Card className="bg-slate-900/40 border-slate-800">
      <CardContent className="p-6">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${map[color]} mb-4`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold mb-2 text-base">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
