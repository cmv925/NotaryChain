/**
 * UserGuide — in-app comprehensive guide rendered at /docs.
 *
 * Layout: sticky left sidebar TOC + scrollable right content with anchor IDs
 * for deep-links (e.g. /docs#sharing-a-compliance-snapshot). All section IDs
 * match the slugs used in /app/USER_GUIDE.md so the markdown file and the
 * in-app guide stay in sync.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';

const SECTIONS = [
  { id: 'quick-start', title: '1. Quick Start' },
  { id: 'account-roles', title: '2. Account & Roles' },
  { id: 'for-clients', title: '3. For Clients' },
  { id: 'for-notaries', title: '4. For Notaries' },
  { id: 'multi-state-compliance', title: '5. Multi-State Compliance' },
  { id: 'state-pickability-index', title: '6. State Pickability Index' },
  { id: 'sharing-a-compliance-snapshot', title: '7. Sharing a Compliance Snapshot' },
  { id: 'asset-vault', title: '8. Asset Vault (SALV)' },
  { id: 'trustlayer-for-partners', title: '9. TrustLayer for Partners' },
  { id: 'verifying-a-sealed-document', title: '10. Verifying a Sealed Document' },
  { id: 'for-developers-sdk', title: '11. For Developers — SDK' },
  { id: 'for-admins', title: '12. For Admins' },
  { id: 'troubleshooting', title: '13. Troubleshooting' },
  { id: 'glossary', title: '14. Glossary' },
];

// ─── Shared text styles ───────────────────────────────────────────────────────
const h2 = 'font-serif text-3xl text-navy-900 tracking-tight mb-3 mt-2';
const h3 = 'font-serif text-xl text-navy-900 mt-6 mb-2';
const p = 'text-slate-700 text-sm leading-relaxed mb-3';
const ul = 'text-slate-700 text-sm leading-relaxed list-disc pl-5 mb-4 space-y-1.5';
const ol = 'text-slate-700 text-sm leading-relaxed list-decimal pl-5 mb-4 space-y-1.5';
const code = 'font-mono text-[12px] bg-cream-200 px-1.5 py-0.5 rounded text-navy-900';
const pre = 'font-mono text-[12px] bg-navy-900 text-cream-100 p-4 rounded-md overflow-x-auto mb-4 leading-relaxed';

function Section({ id, children }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12" data-testid={`docs-section-${id}`}>
      {children}
    </section>
  );
}

function Callout({ tone = 'navy', children }) {
  const tones = {
    navy: 'bg-navy-900 text-cream-100 border-navy-900',
    coral: 'bg-coral-50 text-navy-900 border-coral-300',
    emerald: 'bg-emerald-50 text-navy-900 border-emerald-300',
    amber: 'bg-amber-50 text-navy-900 border-amber-300',
  };
  return (
    <div className={`border-l-4 rounded-r-md p-4 my-4 text-sm leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto mb-4 border border-slate-200 rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-cream-200 text-navy-900">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left font-semibold px-3 py-2 border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-cream-100">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border-b border-slate-100 align-top text-slate-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UserGuide() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Honour deep-link on first load (#section-id)
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, []);

  const tocLinks = useMemo(() => SECTIONS.map(s => (
    <a
      key={s.id}
      href={`#${s.id}`}
      onClick={() => setActiveId(s.id)}
      className={`block px-3 py-1.5 text-[12px] rounded transition-colors ${
        activeId === s.id
          ? 'bg-navy-900 text-cream-100 font-medium'
          : 'text-slate-600 hover:text-navy-900 hover:bg-cream-200/60'
      }`}
      data-testid={`docs-toc-${s.id}`}
    >
      {s.title}
    </a>
  )), [activeId]);

  return (
    <div className="min-h-screen bg-cream-100" data-testid="docs-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="docs-home-link">
            <Shield className="w-6 h-6 text-coral-600" />
            <span className="font-bold text-navy-900 text-lg">Notary<span className="text-coral-600">Chain</span></span>
            <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" /> User Guide
            </span>
          </Link>
          <Link to="/dashboard" className="text-[12px] text-slate-600 hover:text-navy-900 flex items-center gap-1.5" data-testid="docs-back-dashboard">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
        {/* Sticky TOC sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start" data-testid="docs-toc">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3 px-3">On this page</p>
          <nav className="space-y-0.5">{tocLinks}</nav>
          <div className="mt-6 border-t border-slate-200 pt-4 px-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-2">Need help?</p>
            <a href="mailto:support@notarychain.app" className="text-[12px] text-coral-600 hover:underline block mb-1">support@notarychain.app</a>
            <Link to="/compliance/states" className="text-[12px] text-coral-600 hover:underline flex items-center gap-1">
              State compliance matrix <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          {/* Hero */}
          <div className="mb-10">
            <h1 className="font-serif text-5xl text-navy-900 tracking-tight mb-3">User Guide</h1>
            <p className="text-slate-600 text-base leading-relaxed max-w-2xl">
              A practical, step-by-step walkthrough of everything you can do on NotaryChain — from your first
              notarization to compliance reporting, shareable snapshots, and partner attestations.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 max-w-2xl">
              {[
                ['Clients', 'Get a document notarized'],
                ['Notaries', 'Run a compliant ceremony'],
                ['Admins', 'Monitor platform health'],
              ].map(([who, what]) => (
                <div key={who} className="border border-slate-200 rounded-md p-3 bg-white">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-coral-600 font-bold">{who}</p>
                  <p className="text-[12px] text-slate-700 mt-1">{what}</p>
                </div>
              ))}
            </div>
          </div>

          {/* §1 Quick Start */}
          <Section id="quick-start">
            <h2 className={h2}>1. Quick Start</h2>
            <h3 className={h3}>1.1 Sign up</h3>
            <ol className={ol}>
              <li>Open the homepage and click <strong>Sign Up</strong> (top right).</li>
              <li>Enter your full name, email, and a password (minimum 8 characters).</li>
              <li>Confirm your email if asked. You'll land on your <strong>Dashboard</strong>.</li>
            </ol>
            <h3 className={h3}>1.2 Sign in</h3>
            <ul className={ul}>
              <li>Email + password, <strong>or</strong></li>
              <li>One of the SSO options if your firm has enabled them (Auth0, Okta, Enterprise SSO).</li>
            </ul>
            <h3 className={h3}>1.3 Your home base</h3>
            <p className={p}>After login you land on the <strong>Dashboard</strong> which contains:</p>
            <ul className={ul}>
              <li><strong>Top stats strip</strong> — Total Seals, Last 30 Days, Member Since</li>
              <li><strong>Core Actions</strong> — Quick Seal, Request Notarization, Bulk Notarization</li>
              <li><strong>AI Intelligence</strong> — generators, summarizers, doc-compare, remediation</li>
              <li><strong>Security & Identity</strong> — Trust Hub, Asset Vault, Video Witness, Biometrics</li>
              <li><strong>Network & Tools</strong> — Bookings, Find Notaries, Templates</li>
              <li><strong>State Pickability Index</strong> — your live compliance readiness widget</li>
              <li><strong>Document Expiry Tracker</strong> — heads-up on renewals</li>
              <li><strong>My Notarization Requests</strong> — recent in-flight ceremonies</li>
              <li><strong>Recent Document Seals</strong> — sealed Hedera ledger entries</li>
            </ul>
          </Section>

          {/* §2 Account & Roles */}
          <Section id="account-roles">
            <h2 className={h2}>2. Account & Roles</h2>
            <p className={p}>NotaryChain has three roles. Your role is set during signup or by an admin.</p>
            <Table
              headers={['Role', 'Sees / can do']}
              rows={[
                [<strong key="c">Client</strong>, 'Request notarizations, view their docs, manage Asset Vault, share snapshots'],
                [<strong key="n">Notary</strong>, 'Everything Clients can, plus accept ceremony requests, run RON sessions, journal entries'],
                [<strong key="a">Admin</strong>, 'Everything plus analytics, compliance dashboards, partner CRUD, SDK key management'],
              ]}
            />
            <p className={p}>
              To become a notary: click <strong>Become a Notary</strong> on the Dashboard → submit your commission certificate,
              government ID, e-signature, and (optionally) background check + RON certificate. An admin will review.
            </p>
          </Section>

          {/* §3 For Clients */}
          <Section id="for-clients">
            <h2 className={h2}>3. For Clients — Getting a Document Notarized</h2>
            <h3 className={h3}>3.1 Quick Seal (no notary, just blockchain timestamp)</h3>
            <p className={p}>Use this when you only need cryptographic proof a document existed at a moment in time — <strong>not</strong> a notarization.</p>
            <ol className={ol}>
              <li>Dashboard → <strong>Quick Seal</strong>.</li>
              <li>Upload your PDF/image.</li>
              <li>Click <strong>Seal Now</strong>. We compute a SHA-256, anchor it to <strong>Hedera mainnet</strong>, and you get a transaction ID + HashScan link.</li>
              <li>Done in ~5 seconds.</li>
            </ol>
            <h3 className={h3}>3.2 Full Remote Online Notarization (RON)</h3>
            <p className={p}>Use this when you actually need a commissioned notary to witness signing.</p>
            <ol className={ol}>
              <li>Dashboard → <strong>Request Notarization</strong>.</li>
              <li>Fill the request form:
                <ul className={ul}>
                  <li><strong>Document name</strong> (e.g. <em>Real Estate Purchase Agreement</em>)</li>
                  <li><strong>Document type</strong> (<code className={code}>real_estate</code>, <code className={code}>affidavit</code>, <code className={code}>power_of_attorney</code>, <code className={code}>will</code>, …)</li>
                  <li><strong>State</strong> — <em>important.</em> Choose the state your ceremony is governed by (FL / TX / NY / CA / VA). Each state has different pre-seal gate requirements; see §5.</li>
                  <li><strong>Upload your document.</strong></li>
                </ul>
              </li>
              <li>Click <strong>Submit Request</strong>. The request enters the <em>pending</em> queue.</li>
              <li>A commissioned notary in your state picks it up. You'll be notified.</li>
              <li>When the notary starts the session, you'll receive a "Join Ceremony" notification.</li>
              <li><strong>Join the video session</strong> — you'll go through:
                <ul className={ul}>
                  <li><strong>Identity proofing</strong> — KBA quiz + government ID capture</li>
                  <li><strong>Audio/video recording</strong> — at least 30 seconds of clean signal</li>
                  <li><strong>Document signing</strong> — e-signature on the doc</li>
                  <li>(CA only, real-property/POA): <strong>biometric thumbprint capture</strong></li>
                  <li>(NY only): <strong>GPS location capture</strong></li>
                </ul>
              </li>
              <li>The notary completes the ceremony. Behind the scenes the multi-state evaluator checks every required gate. If a gate fails, sealing is <strong>blocked</strong> and the ceremony returns to the queue with a clear reason.</li>
              <li>On success, you see the sealed document + Hedera transaction ID in your Dashboard.</li>
            </ol>

            <h3 className={h3}>3.3 Tracking the status</h3>
            <p className={p}><strong>My Notarization Requests</strong> on the Dashboard shows each request with a colored pill:</p>
            <Table
              headers={['Pill', 'Meaning']}
              rows={[
                [<span key="p" className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">Pending</span>, 'Waiting for a notary to pick it up'],
                [<span key="a" className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-bold uppercase">Assigned</span>, 'A notary has claimed it — ceremony scheduled'],
                [<span key="i" className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">In session</span>, 'Video ceremony is live right now'],
                [<span key="c" className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase">Completed</span>, 'Sealed on Hedera, you\'re done'],
                [<span key="b" className="px-2 py-0.5 bg-coral-100 text-coral-700 rounded text-[10px] font-bold uppercase">{'<state>_blocked'}</span>, 'Pre-seal gate failed; see the reason in the audit trail'],
              ]}
            />
            <p className={p}>Click <strong>Audit</strong> on any in-flight request to see every event written to its Hedera HCS topic.</p>

            <h3 className={h3}>3.4 Bulk Notarization</h3>
            <p className={p}>Have a stack of documents to notarize together? Dashboard → <strong>Bulk Notarization</strong> lets you upload many files in one request that a notary handles as a single session.</p>
          </Section>

          {/* §4 For Notaries */}
          <Section id="for-notaries">
            <h2 className={h2}>4. For Notaries — Running a Ceremony</h2>
            <h3 className={h3}>4.1 Get commissioned on the platform</h3>
            <ol className={ol}>
              <li>Dashboard → <strong>Become a Notary</strong> → fill the application.</li>
              <li>Upload your <strong>commission certificate</strong>, <strong>government ID</strong>, <strong>e-signature</strong>, <strong>background check</strong> (optional), <strong>RON certificate</strong> (required for online ceremonies).</li>
              <li>Wait for admin approval. Once approved, your role flips to <strong>Notary</strong> and you'll see the notary action panel.</li>
            </ol>
            <h3 className={h3}>4.2 Pick up a request</h3>
            <ol className={ol}>
              <li>Dashboard → <strong>Approvals</strong> (or the notary queue).</li>
              <li>Review pending requests filtered by your commission state.</li>
              <li>Click <strong>Accept</strong> to assign it to yourself. Status flips to <em>assigned</em>.</li>
            </ol>
            <h3 className={h3}>4.3 Run the session</h3>
            <ol className={ol}>
              <li>Click <strong>Start</strong> to launch the video room. The principal joins from their side.</li>
              <li>Follow the on-screen checklist (varies by state — see §5):
                <ul className={ul}>
                  <li>Verify ID via the AI document analyzer</li>
                  <li>Administer KBA quiz</li>
                  <li>Capture A/V quality report</li>
                  <li>(CA only) capture biometric thumbprint for real-property / POA</li>
                  <li>(NY only) capture GPS location</li>
                  <li>Record the signing</li>
                </ul>
              </li>
              <li>Add your <strong>journal entry</strong> (NotaryChain auto-creates a draft from the ceremony metadata; you confirm + edit).</li>
              <li>Tag the <strong>retention period</strong> (pre-filled: 5 yr for TX/CA/VA, 10 yr for NY, 10 yr for FL).</li>
              <li>Click <strong>Complete & Seal</strong>. The multi-state evaluator runs:
                <ul className={ul}>
                  <li><strong>All gates pass</strong> → ceremony seals on Hedera, returns transaction ID</li>
                  <li><strong>One or more gates fail</strong> → HTTP 412 with <code className={code}>blocked_reasons</code>; status flips to <code className={code}>{'<state>_blocked'}</code>. Fix what's missing and click Complete again.</li>
                </ul>
              </li>
            </ol>
            <h3 className={h3}>4.4 Reading a blocked-ceremony response</h3>
            <p className={p}>If sealing was blocked, the audit panel shows something like:</p>
            <pre className={pre}>{`TX preseal_gate_failed
- audio_video: av_not_reported_yet
- kba: no_passing_kba_in_last_hour
- journal: no_journal_entry`}</pre>
            <p className={p}>Each line tells you which gate failed and why. Once you remediate, <strong>Complete</strong> again.</p>
          </Section>

          {/* §5 Multi-State Compliance */}
          <Section id="multi-state-compliance">
            <h2 className={h2}>5. Understanding Multi-State Compliance</h2>
            <p className={p}>
              NotaryChain's <code className={code}>multistate_evaluator</code> runs a pre-seal gate check for{' '}
              <strong>TX / NY / CA / VA</strong> before a ceremony can be sealed.{' '}
              <strong>FL</strong> has its own dedicated readiness route at <code className={code}>/api/fl/ron/readiness/{'{id}'}</code>.
            </p>
            <h3 className={h3}>5.1 Shared gate primitives</h3>
            <Table
              headers={['Gate', 'Description', 'Required for']}
              rows={[
                [<code key="g" className={code}>audio_video</code>, '≥ 30 s of clean A/V signal', 'TX, NY, CA, VA'],
                [<code key="g" className={code}>kba</code>, 'Passing KBA quiz within last hour', 'TX, NY, CA, VA'],
                [<code key="g" className={code}>id_check</code>, 'Government ID approved by AI doc analyzer', 'TX, NY, CA, VA'],
                [<code key="g" className={code}>retention</code>, 'Retention tag ≥ state-required years', 'TX 5y · NY 10y · CA 5y · VA 5y'],
                [<code key="g" className={code}>journal</code>, 'Notary journal entry recorded', 'TX, NY, CA, VA'],
                [<code key="g" className={code}>tamper_evident</code>, 'PKI seal needs both kba + id_check', 'TX, VA'],
                [<code key="g" className={code}>identity_proofing</code>, 'Multi-factor = KBA and ID-check', 'NY'],
                [<code key="g" className={code}>thumbprint</code>, 'Biometric thumbprint capture', 'CA (real-property, POA, mortgage, lien-release)'],
                [<code key="g" className={code}>principal_location</code>, 'Principal GPS captured at signing', 'NY'],
                [<code key="g" className={code}>document_type_allowed</code>, 'Hard-block prohibited doc types', 'NY (wills, codicils, testamentary trusts, life-estate deeds)'],
              ]}
            />
            <h3 className={h3}>5.2 State-by-state quick reference</h3>
            <ul className={ul}>
              <li><strong>Florida (FL)</strong> — dedicated FL pipeline (witness flow for online wills, 10 yr S3 Object Lock retention, FL Stat. 117.245 journal, RONSP filing lifecycle).</li>
              <li><strong>Texas (TX)</strong> — A/V + KBA + ID + 5 yr retention + journal + tamper-evident.</li>
              <li><strong>New York (NY)</strong> — A/V + multi-factor (KBA + ID) + 10 yr retention + journal + principal GPS. <strong>Wills/codicils/testamentary trusts/life-estate deeds are RON-prohibited.</strong></li>
              <li><strong>California (CA)</strong> — A/V + KBA + ID + 5 yr retention + journal. <strong>Biometric thumbprint required</strong> for deeds, real-property, POAs, mortgages, lien-releases.</li>
              <li><strong>Virginia (VA)</strong> — A/V + KBA + ID + 5 yr retention + journal + tamper-evident.</li>
            </ul>
            <Callout tone="navy">
              Full statute citations, side-by-side comparison, and registration cards live at{' '}
              <Link to="/compliance/states" className="underline text-coral-300 hover:text-coral-200">/compliance/states</Link>.
            </Callout>
          </Section>

          {/* §6 State Pickability Index */}
          <Section id="state-pickability-index">
            <h2 className={h2}>6. The State Pickability Index</h2>
            <p className={p}>The <strong>State Pickability Index</strong> widget on your Dashboard turns abstract compliance data into actionable nudges.</p>
            <h3 className={h3}>6.1 What it shows</h3>
            <ul className={ul}>
              <li><strong>Overall score</strong> (top-right) — % of your open ceremonies that are seal-ready right now.</li>
              <li><strong>By Jurisdiction</strong> (left column) — colored bar per state with <code className={code}>{'{ready}/{open}'}</code>:
                <ul className={ul}>
                  <li>🟢 80 %+ — green, healthy</li>
                  <li>🟡 50–79 % — amber, attention</li>
                  <li>🔴 &lt; 50 % — coral, needs work</li>
                </ul>
              </li>
              <li><strong>Actionable Nudges</strong> (right column) — up to 8 distinct ceremonies, each with a one-click CTA to the ceremony page to fix the failing gate.</li>
            </ul>
            <h3 className={h3}>6.2 How nudges are prioritized</h3>
            <ol className={ol}>
              <li>States with <strong>the most open ceremonies</strong> surface first (highest impact).</li>
              <li>Inside the priority list, <strong>one nudge per ceremony</strong> before showing a second nudge for any ceremony (variety, not 6 nudges for the same doc).</li>
              <li>Each nudge has a short title + 1-line description + a CTA label (<em>Start KBA</em>, <em>Capture thumbprint</em>, <em>Set retention</em>, etc.).</li>
            </ol>
            <h3 className={h3}>6.3 Acting on a nudge</h3>
            <p className={p}>Click any nudge row → you're deep-linked to <code className={code}>{'/session/{ceremony_id}'}</code>. The ceremony page shows exactly which gate is failing, with a button to fix it (start KBA quiz, capture thumbprint, write journal entry, etc.).</p>
            <h3 className={h3}>6.4 When the widget is empty</h3>
            <Callout tone="emerald">
              <em>"No open ceremonies. When you request a notarization, this widget will surface state-specific readiness nudges here."</em>
              <br />Request your first ceremony and it lights up.
            </Callout>
          </Section>

          {/* §7 Snapshot */}
          <Section id="sharing-a-compliance-snapshot">
            <h2 className={h2}>7. Sharing a Compliance Snapshot</h2>
            <p className={p}>A <strong>Compliance Snapshot</strong> is a public, read-only, <strong>scrubbed</strong> version of your State Pickability Index that you can send to counterparties — mortgage brokers, title agents, escrow counsel, your CFO — without giving them an account.</p>
            <h3 className={h3}>7.1 Generate the link</h3>
            <ol className={ol}>
              <li>Dashboard → State Pickability Index widget → click <strong>Share snapshot</strong> (top-right of the widget).</li>
              <li>A green banner appears with the full public URL.</li>
              <li>The URL is <strong>auto-copied to your clipboard</strong> + you see a "Snapshot created" toast.</li>
            </ol>
            <h3 className={h3}>7.2 What's in the snapshot</h3>
            <ul className={ul}>
              <li>Hero score (e.g. <em>"47% seal-ready · 28 of 60 active ceremonies pass their state-specific pre-seal gates"</em>)</li>
              <li>Per-jurisdiction cards with the same color-coding + sample ceremonies + missing-gate hints</li>
              <li>Top Blockers — the most pressing nudges, scrubbed of document names</li>
              <li>Optional note you supply when creating the snapshot</li>
              <li>Footer: <code className={code}>Generated &lt;timestamp&gt; · expires in N days · X views</code></li>
            </ul>
            <h3 className={h3}>7.3 What's NOT in the snapshot</h3>
            <Callout tone="coral">
              <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
                <li>❌ No ceremony IDs</li>
                <li>❌ No user IDs</li>
                <li>❌ No document names</li>
                <li>❌ No file contents</li>
                <li>✅ Owner email is masked to <code className="font-mono text-[12px] bg-white px-1.5 py-0.5 rounded">j***@yourfirm.com</code></li>
              </ul>
            </Callout>
            <h3 className={h3}>7.4 Lifespan</h3>
            <p className={p}>Snapshots default to <strong>7 days TTL</strong> (configurable 1–30 days via API). After expiry, anyone who hits the URL sees a "Snapshot has expired" error.</p>
            <h3 className={h3}>7.5 Re-sharing</h3>
            <p className={p}>Each click of "Share snapshot" creates a <strong>new</strong> token — old links keep working until they expire. There's no way to "edit" a snapshot — generate a fresh one to share the latest state.</p>
          </Section>

          {/* §8 SALV */}
          <Section id="asset-vault">
            <h2 className={h2}>8. The Asset Vault (SALV)</h2>
            <p className={p}>The <strong>Smart Asset Life-cycle Vault</strong> is for documents you want to manage long-term — deeds, wills, IP licenses, beneficiary documents, etc.</p>
            <h3 className={h3}>8.1 Upload an asset</h3>
            <ol className={ol}>
              <li>Dashboard → <strong>Asset Vault</strong>.</li>
              <li>Click <strong>+ New Asset</strong> → name it, choose a type (deed, will, IP, etc.), upload the file.</li>
              <li>The file is <strong>AES-GCM-256 encrypted</strong> with a per-asset key (HKDF-SHA256 derived) before it lands in storage (S3 or local FS). Only the owner can decrypt.</li>
            </ol>
            <h3 className={h3}>8.2 Add a beneficiary</h3>
            <ol className={ol}>
              <li>Open the asset → <strong>Beneficiaries</strong> tab → <strong>+ Add</strong>.</li>
              <li>Enter beneficiary email + share percentage.</li>
              <li>They receive a magic-link invite. When they accept, you'll get a notification.</li>
            </ol>
            <h3 className={h3}>8.3 Partial release</h3>
            <p className={p}>Owners can release a percentage of an asset to a beneficiary without giving up full control:</p>
            <ol className={ol}>
              <li>Open the asset → click the <strong>Release</strong> slider next to a beneficiary.</li>
              <li>Pick a percent (e.g. 50 %) → optional note → confirm.</li>
              <li>The release is anchored to <strong>Hedera HCS</strong> with a receipt. The beneficiary can now decrypt.</li>
              <li>Release history is immutable and auditable in the <strong>Beneficiaries</strong> tab.</li>
            </ol>
            <h3 className={h3}>8.4 Beneficiary viral loop</h3>
            <p className={p}>When a beneficiary accepts a handoff, they're prompted to sign up for their own NotaryChain account. The owner receives an in-app notification + email when this conversion happens. Acquisition source is tracked.</p>
          </Section>

          {/* §9 TrustLayer */}
          <Section id="trustlayer-for-partners">
            <h2 className={h2}>9. TrustLayer for Partners</h2>
            <p className={p}>TrustLayer is the federated trust graph that lets external firms (lenders, brokerages, escrow agents, government agencies) issue <strong>Ed25519-signed</strong>, Hedera-anchored attestations about a NotaryChain document.</p>
            <h3 className={h3}>9.1 Register as a partner</h3>
            <ol className={ol}>
              <li>An admin creates your partner profile in <code className={code}>/admin/trust-layer</code>.</li>
              <li>You receive a <strong>publishable key</strong> + your Ed25519 public key is published at <code className={code}>/api/trustlayer/partners/{'{id}'}/public-key</code>.</li>
              <li>Your <strong>private key</strong> is stored in NotaryChain's vault (never exposed via any public route).</li>
            </ol>
            <h3 className={h3}>9.2 Issue an attestation</h3>
            <p className={p}>Use the v2 SDK (<code className={code}>/sdk-v2.js</code>) or POST to <code className={code}>/api/trustlayer/attestations</code> with:</p>
            <ul className={ul}>
              <li><code className={code}>subject_id</code> — the NotaryChain seal hash you're attesting about</li>
              <li><code className={code}>claim</code> — short JSON of what you're asserting (e.g. <code className={code}>{'{"lender_funded": true}'}</code>)</li>
              <li><code className={code}>partner_id</code></li>
            </ul>
            <p className={p}>The platform signs the attestation with your Ed25519 keypair (canonical-JSON serialization), anchors the digest to <strong>Hedera HCS</strong>, and returns the verifiable receipt.</p>
            <h3 className={h3}>9.3 Embed the auto-verify badge</h3>
            <pre className={pre}>{`<script src="/api/trustlayer/badge-v2.js"></script>
<trust-badge attestation-id="ATT-12345"></trust-badge>`}</pre>
            <p className={p}>The badge verifies the Ed25519 signature in-browser using WebCrypto + pulls the Hedera Mirror Node payload, then emits a <code className={code}>verified</code> or <code className={code}>failed</code> CustomEvent. Verification is shadow-DOM isolated so it can't be tampered with by host-page CSS/JS.</p>
          </Section>

          {/* §10 Verify */}
          <Section id="verifying-a-sealed-document">
            <h2 className={h2}>10. Verifying a Sealed Document</h2>
            <p className={p}>Anyone — no account required — can verify a NotaryChain seal at <Link to="/verify" className="text-coral-600 hover:underline"><code className={code}>/verify</code></Link>.</p>
            <h3 className={h3}>10.1 Three ways to verify</h3>
            <ol className={ol}>
              <li><strong>Upload the document</strong> — we hash it client-side and look up the hash in <code className={code}>blockchain_seals</code>.</li>
              <li><strong>Paste the SHA-256 hash</strong> — same flow.</li>
              <li><strong>Look up a certificate ID</strong> — for documents with a printable cover sheet.</li>
            </ol>
            <h3 className={h3}>10.2 What you see on a match</h3>
            <ul className={ul}>
              <li>✅ <strong>VERIFIED</strong> badge</li>
              <li>Document name, hash, seal timestamp</li>
              <li>Notary profile (name, license, bond, SAN bond ID)</li>
              <li>Hedera transaction ID with HashScan link</li>
              <li>Ceremony details (state, document type)</li>
              <li>Notary stats (sealed count, fraud flags, KBA pass rate)</li>
            </ul>
            <p className={p}>If revoked, you'll see a <strong>REVOKED</strong> badge with the reason.</p>
          </Section>

          {/* §11 SDK */}
          <Section id="for-developers-sdk">
            <h2 className={h2}>11. For Developers — SDK</h2>
            <p className={p}>Embed NotaryChain ceremonies into your own app with the Embeddable Notarize SDK.</p>
            <h3 className={h3}>11.1 Get a publishable key</h3>
            <ol className={ol}>
              <li>Login → <strong>Developers → SDK Keys</strong> (admin or Pro+ tier).</li>
              <li>Click <strong>+ New Key</strong> → name it + add your <code className={code}>allowed_origins</code> (e.g. <code className={code}>https://yourapp.com</code>).</li>
              <li>Copy the publishable key (<code className={code}>pk_live_…</code>).</li>
            </ol>
            <h3 className={h3}>11.2 Load the SDK</h3>
            <pre className={pre}>{`<script src="/api/sdk/v1/notarychain.js"></script>
<script>
  NotaryChain.init({ publishable_key: 'pk_live_…' });

  const session = await NotaryChain.createSession({
    document_url: 'https://yourapp.com/files/doc.pdf',
    state_code: 'FL',
    document_type: 'real_estate',
  });
  NotaryChain.openCeremony(session.embed_url);
</script>`}</pre>
            <h3 className={h3}>11.3 Listen for events</h3>
            <pre className={pre}>{`window.addEventListener('message', (ev) => {
  if (ev.origin !== 'https://your-notarychain-host') return;
  // Verify ev.data.event_secret against your server-side stored secret
  if (ev.data.type === 'ceremony.sealed') {
    console.log('Sealed!', ev.data.payload);
  }
});`}</pre>
            <h3 className={h3}>11.4 Webhooks</h3>
            <p className={p}>Configure a webhook URL + HMAC secret in <code className={code}>/developers/sdk</code>. Every ceremony event POSTs a signed payload (HMAC-SHA256 in <code className={code}>X-NotaryChain-Signature</code>) with <strong>retry-with-backoff</strong> at 1 s, 2 s, 4 s.</p>
            <h3 className={h3}>11.5 Rate limits</h3>
            <ul className={ul}>
              <li>Demo keys: <strong>10 requests / hour / IP</strong> (in-memory)</li>
              <li>Pro keys: subject to your subscription tier</li>
              <li>Each session token can only be used once per ceremony</li>
            </ul>
          </Section>

          {/* §12 Admins */}
          <Section id="for-admins">
            <h2 className={h2}>12. For Admins</h2>
            <h3 className={h3}>12.1 Admin Dashboard</h3>
            <p className={p}><Link to="/admin/dashboard" className="text-coral-600 hover:underline"><code className={code}>/admin/dashboard</code></Link> — user CRUD, partner CRUD, system health, recent activity feed.</p>
            <h3 className={h3}>12.2 Ceremony Analytics (<Link to="/admin/analytics" className="text-coral-600 hover:underline"><code className={code}>/admin/analytics</code></Link>)</h3>
            <ul className={ul}>
              <li><strong>KPI strip</strong> — Ceremonies (all-time), Completion rate, Avg time-to-seal, Revenue (30d)</li>
              <li><strong>🚨 Evaluator-errors alert</strong> — coral banner above the KPIs if any ceremonies hit the fail-closed <code className={code}>{'<state>_evaluator_error'}</code> status in the last 24 h. Shows count + total since launch + action hint.</li>
              <li><strong>Daily ceremonies</strong> area chart (created vs. sealed) with 7d / 30d / 90d / 180d window selector</li>
              <li><strong>Funnel</strong> — Pending → Assigned → In session → Completed → Sealed → FL_blocked</li>
              <li><strong>Top compliance-gate failures</strong> heatmap</li>
              <li><strong>State breakdown</strong> table (per-jurisdiction totals + completion %)</li>
              <li><strong>Top notaries</strong> leaderboard</li>
            </ul>
            <h3 className={h3}>12.3 FL Compliance (<code className={code}>/admin/fl-compliance</code>)</h3>
            <p className={p}>KPI grid, ceremony gate matrix, subpoena response workflow (intake → scope → CSV bundle → respond), RONSP filing lifecycle tracker.</p>
            <h3 className={h3}>12.4 Backfilling state_code</h3>
            <p className={p}>For ceremonies that pre-date the multi-state pipeline:</p>
            <pre className={pre}>{`POST /api/admin/compliance/backfill-state-codes?default_state=FL&dry_run=true`}</pre>
            <p className={p}>Dry-run first to see how many ceremonies would be updated; the live run copies <code className={code}>state_code</code> from the notary's commission state first, then falls back to the <code className={code}>default_state</code> parameter.</p>
            <h3 className={h3}>12.5 Partner / TrustLayer admin</h3>
            <p className={p}><code className={code}>/admin/trust-layer</code> — CRUD partners, view public Ed25519 keys, revoke attestations, browse the federated trust graph.</p>
            <h3 className={h3}>12.6 RBAC / SSO</h3>
            <p className={p}><code className={code}>/admin/rbac</code> — role assignments. SSO via Auth0, Okta, or Enterprise SSO is configured in <code className={code}>/admin/integrations</code>.</p>
          </Section>

          {/* §13 Troubleshooting */}
          <Section id="troubleshooting">
            <h2 className={h2}>13. Troubleshooting</h2>
            {[
              ['"My ceremony is stuck on tx_blocked"',
                'The TX evaluator found one or more gates unmet.',
                <span>Open the ceremony → check the <code className={code}>blocked_reasons</code> list → complete the missing gate (KBA, A/V capture, journal, retention tag, ID approval). Then <strong>Complete & Seal</strong> again.</span>],
              ['"Snapshot link returns 410 Gone"',
                'The snapshot expired (default 7-day TTL).',
                <span>Generate a fresh snapshot from the State Pickability widget.</span>],
              ['"I see 503 preseal_evaluator_unavailable when completing"',
                'The multi-state evaluator itself errored (DB outage, code regression). NotaryChain fails closed.',
                <span>Retry in a few moments. If it persists, an admin can check <Link to="/admin/analytics" className="text-coral-600 hover:underline">/admin/analytics</Link> for the evaluator-error alert and triage from backend logs.</span>],
              ['"Quick Seal returns a TX ID but I don\'t see it in Recent Document Seals"',
                'Real-time refresh may have missed the WebSocket update.',
                <span>Refresh the page. If still missing, check the audit trail at <code className={code}>/audit-trail</code> with your transaction ID.</span>],
              ['"My SDK iframe shows Origin not allowed"',
                'The allowed_origins on your publishable key doesn\'t include the host the iframe is loaded on.',
                <span>Developers → SDK Keys → edit the key → add the host (must match scheme + host + port exactly).</span>],
              ['"I lost access to my Asset Vault encrypted file"',
                'AES-GCM-256 keys are owner-only. If you lost your account, the per-asset key is gone.',
                <span>There is no platform-side recovery — this is by design. <strong>Always set at least one beneficiary</strong> with a release plan on every vault asset so the encrypted material remains accessible to your successors.</span>],
              ['"The Pickability widget shows the same TX ceremony over and over"',
                'You\'re looking at an older build — the current build diversifies nudges to one per ceremony first.',
                <span>Hard-refresh (<code className={code}>Cmd-Shift-R</code> / <code className={code}>Ctrl-Shift-F5</code>). If still happening, file a bug.</span>],
            ].map(([q, cause, fix], i) => (
              <div key={i} className="border-l-4 border-slate-200 pl-4 py-1 mb-4">
                <p className="font-semibold text-navy-900 text-sm mb-1">{q}</p>
                <p className="text-[12px] text-slate-600"><strong>Cause:</strong> {cause}</p>
                <p className="text-[12px] text-slate-600 mt-0.5"><strong>Fix:</strong> {fix}</p>
              </div>
            ))}
          </Section>

          {/* §14 Glossary */}
          <Section id="glossary">
            <h2 className={h2}>14. Glossary</h2>
            <Table
              headers={['Term', 'Definition']}
              rows={[
                [<strong key="t">RON</strong>, 'Remote Online Notarization — notarization via live A/V ceremony'],
                [<strong key="t">KBA</strong>, 'Knowledge-Based Authentication — quiz used to verify principal identity'],
                [<strong key="t">HCS / HTS</strong>, 'Hedera Consensus Service / Hedera Token Service — the mainnet ledger we use'],
                [<strong key="t">SALV</strong>, 'Smart Asset Life-cycle Vault — encrypted document storage with release controls'],
                [<strong key="t">TrustLayer</strong>, 'Federated trust graph with Ed25519 partner attestations'],
                [<strong key="t">Pre-seal gate</strong>, 'State-specific compliance check that must pass before a ceremony can be sealed'],
                [<strong key="t">Pickability score</strong>, '% of your open ceremonies that are seal-ready under their state\'s gates'],
                [<strong key="t">Compliance Snapshot</strong>, 'Public, scrubbed, read-only export of your Pickability data'],
                [<strong key="t">Seal hash</strong>, 'SHA-256 of the canonical document, anchored to Hedera'],
                [<strong key="t">Attestation</strong>, 'Ed25519-signed JSON claim about a NotaryChain seal, issued by a partner'],
                [<strong key="t">Handoff</strong>, 'A partial-release event from an Asset Vault owner to a beneficiary'],
                [<strong key="t">Evaluator-error</strong>, 'Status indicating the multi-state evaluator itself failed (fail-closed safeguard)'],
              ]}
            />
          </Section>

          {/* Footer CTA */}
          <div className="mt-16 mb-8 border-t border-slate-200 pt-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-coral-600 font-bold mb-2">Need help?</p>
            <p className="text-slate-700 text-sm mb-4">
              Email <a href="mailto:support@notarychain.app" className="text-coral-600 hover:underline">support@notarychain.app</a> or browse the{' '}
              <Link to="/compliance/states" className="text-coral-600 hover:underline">state compliance matrix</Link>{' '}
              for legal abstracts. Developers — head to <Link to="/developers/sdk" className="text-coral-600 hover:underline">/developers/sdk</Link> for the API playground.
            </p>
            <p className="text-slate-500 text-[11px] italic">NotaryChain — Notarization, done right. Online, in minutes.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
