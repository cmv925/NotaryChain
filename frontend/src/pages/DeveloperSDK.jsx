/**
 * DeveloperSDK — Public developer portal at /developers/sdk
 * Documentation, copy-paste integration snippets, live demo.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Copy, Check, Code, Zap, Webhook, KeyRound, PlayCircle, BookOpen, ChevronRight, Github } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SDK_URL = `${process.env.REACT_APP_BACKEND_URL}/api/sdk/v1/notarychain.js`;

function CodeBlock({ code, lang = 'html', id }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast({ title: 'Copied to clipboard' });
  };
  return (
    <div className="relative group rounded-lg border border-slate-200 bg-navy-900 overflow-hidden" data-testid={`code-block-${id}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-navy-800/60 border-b border-slate-700">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">{lang}</span>
        <button onClick={onCopy} className="text-slate-300 hover:text-cream-100 text-[11px] flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5" data-testid={`copy-${id}-btn`}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-[12.5px] text-cream-100 font-mono p-4 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

export default function DeveloperSDK() {
  const navigate = useNavigate();
  const [demoKey, setDemoKey] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    // Pre-fetch demo key
    axios.get(`${API}/sdk/demo-key`).then(r => setDemoKey(r.data.publishable_key)).catch(() => {});
  }, []);

  const loadSDK = () => new Promise((resolve, reject) => {
    if (window.NotaryChain && window.NotaryChain.__loaded__) return resolve();
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const runDemo = async () => {
    if (!demoKey) return;
    setDemoLoading(true);
    try {
      await loadSDK();
      window.NotaryChain.init({ publishableKey: demoKey });
      window.NotaryChain.on('ready', () => console.log('[Demo] ready'));
      window.NotaryChain.on('sealed', (d) => {
        toast({ title: 'Ceremony sealed!', description: `Hash: ${d.seal_hash?.slice(0, 16)}…` });
      });
      window.NotaryChain.on('error', (e) => {
        toast({ title: 'Error', description: e.error || 'Unknown', variant: 'destructive' });
      });
      window.NotaryChain.startCeremony({
        documentName: 'Demo Power of Attorney',
        documentType: 'power_of_attorney',
        signerEmail: 'demo@example.com',
        signerName: 'Demo Signer',
        metadata: { source: 'docs_live_demo' },
      });
    } catch (e) {
      toast({ title: 'Demo failed', description: 'Could not load SDK', variant: 'destructive' });
    } finally {
      setDemoLoading(false);
    }
  };

  const snippetHTML = `<!-- NotaryChain SDK · drop anywhere on your site -->
<script src="${SDK_URL}"></script>
<script>
  NotaryChain.init({ publishableKey: 'pk_live_YOUR_KEY' });

  document.getElementById('notarize-btn').addEventListener('click', () => {
    NotaryChain.startCeremony({
      documentName: 'Power of Attorney',
      documentType: 'power_of_attorney',
      signerEmail: 'jane@example.com',
      signerName: 'Jane Doe',
      metadata: { order_id: '12345' }
    });
  });

  NotaryChain.on('sealed', (data) => {
    console.log('Sealed:', data.seal_hash, data.hcs_tx);
  });
</script>

<button id="notarize-btn">Notarize this document</button>`;

  const snippetReact = `import { useEffect } from 'react';

export function NotarizeButton({ document }) {
  useEffect(() => {
    if (!document.querySelector('script[data-nc-sdk]')) {
      const s = document.createElement('script');
      s.src = '${SDK_URL}';
      s.setAttribute('data-nc-sdk', '1');
      document.head.appendChild(s);
      s.onload = () => window.NotaryChain.init({
        publishableKey: process.env.REACT_APP_NC_KEY
      });
    }
  }, []);

  const start = () => {
    window.NotaryChain.startCeremony({
      documentName: document.name,
      documentType: 'contract',
      signerEmail: document.signer.email,
      metadata: { doc_id: document.id }
    });
    window.NotaryChain.on('sealed', (d) => onComplete(d));
  };

  return <button onClick={start}>Notarize</button>;
}`;

  const snippetWebhook = `// Express.js example — verify NotaryChain webhook signature
import crypto from 'crypto';

app.post('/webhooks/notarychain', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-notarychain-signature'];
  const secret = process.env.NC_WEBHOOK_SECRET;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(JSON.parse(req.body), Object.keys(JSON.parse(req.body)).sort()))
    .digest('hex');

  if (signature !== expected) return res.status(401).send('Invalid signature');

  const event = JSON.parse(req.body);
  switch (event.type) {
    case 'ceremony.sealed':
      console.log('Sealed:', event.data.seal_hash, event.data.hcs_tx);
      // Update your DB: mark document as notarized
      break;
    case 'ceremony.completed':
      console.log('Completed:', event.data.session_token);
      break;
  }
  res.json({ received: true });
});`;

  const events = [
    { name: 'ready', when: 'Iframe loaded and session created', payload: '{ sessionToken, mode }' },
    { name: 'signed', when: 'Signer applied their signature', payload: '{ token }' },
    { name: 'completed', when: 'Ceremony pipeline finished', payload: '{ seal_hash }' },
    { name: 'sealed', when: 'Hedera HCS anchor confirmed', payload: '{ seal_hash, hcs_tx }' },
    { name: 'error', when: 'Any unrecoverable error', payload: '{ error }' },
    { name: 'close', when: 'Modal closed (manual or auto)', payload: '{}' },
  ];

  return (
    <div className="min-h-screen bg-cream-100" data-testid="developer-sdk-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm text-slate-600 hover:text-navy-900">Pricing</Link>
            <Button onClick={() => navigate('/developers/sdk-keys')} variant="outline" className="border-slate-300 text-navy-900 hover:bg-cream-200/50" data-testid="manage-keys-btn">
              <KeyRound className="w-4 h-4 mr-2" /> Manage Keys
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-cream-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-coral-50 border border-coral-200 text-coral-700 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5" /> Embeddable Notarize SDK v1.0
            </div>
            <h1 className="font-serif text-5xl md:text-6xl text-navy-900 tracking-tight mb-6 leading-[1.05]">
              Add legally-binding<br />notarization in <span className="text-coral-600 italic">3 lines</span> of code.
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl leading-relaxed">
              Drop a single <code className="bg-navy-900 text-cream-100 px-2 py-0.5 rounded text-[14px] font-mono">&lt;script&gt;</code> tag on your site to launch a fully-compliant Remote Online Notarization ceremony — KBA, live A/V witness, biometric signature, and on-chain Hedera seal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={runDemo} disabled={!demoKey || demoLoading} className="bg-coral-500 hover:bg-coral-600 text-white text-base px-6 py-6" data-testid="run-demo-btn">
                <PlayCircle className="w-5 h-5 mr-2" />
                {demoLoading ? 'Loading…' : 'Try live demo'}
              </Button>
              <Button onClick={() => navigate('/developers/sdk-keys')} variant="outline" className="border-navy-900 text-navy-900 hover:bg-cream-200/40 text-base px-6 py-6" data-testid="get-keys-btn">
                Get your API keys <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> No backend changes needed</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Florida RON compliant</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Signed webhooks (HMAC-SHA256)</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Hedera-anchored proof</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-serif text-4xl text-navy-900 mb-2">Quickstart</h2>
        <p className="text-slate-600 mb-8">From zero to your first sealed document in under five minutes.</p>

        <ol className="space-y-10">
          <li>
            <h3 className="flex items-center gap-3 text-xl font-semibold text-navy-900 mb-3">
              <span className="w-7 h-7 rounded-full bg-coral-500 text-white text-sm flex items-center justify-center">1</span>
              Get a publishable key
            </h3>
            <p className="text-slate-600 mb-4 ml-10">Head to <Link to="/developers/sdk-keys" className="text-coral-600 hover:underline">Manage Keys</Link> and create a new key (test or live). Lock it to your domains with the allowed-origins list.</p>
          </li>
          <li>
            <h3 className="flex items-center gap-3 text-xl font-semibold text-navy-900 mb-3">
              <span className="w-7 h-7 rounded-full bg-coral-500 text-white text-sm flex items-center justify-center">2</span>
              Drop the SDK on your page
            </h3>
            <div className="ml-10">
              <CodeBlock id="html-snippet" lang="html" code={snippetHTML} />
            </div>
          </li>
          <li>
            <h3 className="flex items-center gap-3 text-xl font-semibold text-navy-900 mb-3">
              <span className="w-7 h-7 rounded-full bg-coral-500 text-white text-sm flex items-center justify-center">3</span>
              Or use it from React
            </h3>
            <div className="ml-10">
              <CodeBlock id="react-snippet" lang="jsx" code={snippetReact} />
            </div>
          </li>
          <li>
            <h3 className="flex items-center gap-3 text-xl font-semibold text-navy-900 mb-3">
              <span className="w-7 h-7 rounded-full bg-coral-500 text-white text-sm flex items-center justify-center">4</span>
              Verify completions server-side via webhooks
            </h3>
            <div className="ml-10">
              <CodeBlock id="webhook-snippet" lang="javascript" code={snippetWebhook} />
            </div>
          </li>
        </ol>
      </section>

      {/* Event reference */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="font-serif text-4xl text-navy-900 mb-2">Event reference</h2>
          <p className="text-slate-600 mb-8">All client-side events the SDK emits via <code className="bg-cream-100 text-navy-900 px-1.5 py-0.5 rounded text-[13px] font-mono">NotaryChain.on(event, callback)</code>.</p>

          <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-cream-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-navy-900 w-32">Event</th>
                  <th className="text-left px-5 py-3 font-semibold text-navy-900">Fires when</th>
                  <th className="text-left px-5 py-3 font-semibold text-navy-900 w-72">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {events.map(e => (
                  <tr key={e.name} className="hover:bg-cream-50/50">
                    <td className="px-5 py-3 font-mono text-coral-700 text-[13px]">{e.name}</td>
                    <td className="px-5 py-3 text-slate-700">{e.when}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-navy-900">{e.payload}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-serif text-4xl text-navy-900 mb-2">Why teams use the SDK</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: Code, title: 'Three-line install', desc: 'Single script tag + init call. No iframes to manage, no CORS headaches.' },
            { icon: Webhook, title: 'HMAC-signed webhooks', desc: 'Server-to-server confirmation with SHA-256 signatures and replay protection.' },
            { icon: Shield, title: 'Built-in compliance', desc: 'KBA, A/V capture, Hedera anchor, and FL §117.245 journal logging — all included.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-xl p-6 hover:border-coral-300 transition-all">
              <div className="w-10 h-10 rounded-lg bg-coral-50 border border-coral-200 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-coral-600" />
              </div>
              <h3 className="font-serif text-xl text-navy-900 mb-1.5">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-navy-900 text-cream-100">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-3xl mb-2">Ready to ship notarization?</h2>
            <p className="text-slate-300 text-sm">SDK access is included with every Professional ($99/mo) and Enterprise ($199/mo) plan.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/developers/sdk-keys')} className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="cta-get-keys">
              Get keys now <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button onClick={() => navigate('/pricing')} variant="outline" className="border-cream-100 text-cream-100 hover:bg-white/10" data-testid="cta-pricing">
              View pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
