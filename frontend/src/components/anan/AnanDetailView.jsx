/**
 * AnanDetailView — the ANAN dashboard "detail" screen for a single ceremony
 * (execute panel, agent score cards, consensus oracle, blockchain seal, badge
 * modal, escalation info, SSE event log, ceremony meta). Presentational.
 */
import React from 'react';
import {
  Brain, Blocks, AlertTriangle, Radio, Globe, Loader2, Play, Zap, Vote,
  Shield, FileText, Copy, Code, X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Breadcrumbs } from '../Breadcrumbs';
import DOMPurify from 'dompurify';
import { AGENT_CONFIG, StatusBadge, AgentScoreCard, InfoRow } from './AnanPrimitives';

export default function AnanDetailView({
  current, streaming, actionLoading, sseEvents, badgeData, showBadge,
  handleExecuteStream, handleExecute, fetchBadge, setShowBadge, copyToClipboard,
}) {
  const c = current;
  const consensus = c.consensus || {};
  const canExecute = c.status === 'pending' || c.status === 'escalated';

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      {/* Header */}
      <div className="bg-cream-100 border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-coral-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-navy-900" />
            </div>
            <div>
              <h1 className="text-navy-900 font-bold text-lg tracking-tight">{c.document_name}</h1>
              <p className="text-slate-500 text-[10px] tracking-wider uppercase">{c.protocol} | {c.ceremony_id.slice(0, 8)}</p>
            </div>
          </div>
          <StatusBadge status={c.status} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'ANAN', path: '/anan' }, { label: c.document_name }]} />

        {/* Execute Actions */}
        {canExecute && (
          <Card className="bg-cream-100 border-coral-300/20 mb-6" data-testid="anan-execute-panel">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-navy-900 font-semibold text-sm">Ready to Execute Blind Scoring Protocol</p>
                <p className="text-slate-500 text-[10px]">3 GPT-5.2 agents will analyze concurrently in isolation</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExecuteStream} disabled={streaming || actionLoading === 'execute'}
                  className="italic text-coral-600 hover:from-coral-500 hover:to-violet-700" data-testid="anan-execute-stream-btn">
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {streaming ? 'Scoring...' : 'Execute (Live Stream)'}
                </Button>
                <Button onClick={handleExecute} disabled={streaming || actionLoading === 'execute'} variant="outline"
                  className="border-slate-200 text-slate-600 hover:text-navy-900" data-testid="anan-execute-btn">
                  {actionLoading === 'execute' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Execute (Instant)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(AGENT_CONFIG).map(([key, cfg]) => {
            const agent = c.agents?.[key] || {};
            return <AgentScoreCard key={key} agentKey={key} config={cfg} agent={agent} streaming={streaming} />;
          })}
        </div>

        {/* Consensus Oracle */}
        {consensus.status === 'reached' && (
          <Card className={`mb-6 ${consensus.result === 'APPROVED' ? 'bg-coral-500/5 border-coral-200' : consensus.result === 'REJECTED' ? 'bg-red-500/5 border-red-500/30' : 'bg-coral-500/5 border-gold-500/30'}`} data-testid="anan-consensus-oracle">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Vote className="w-6 h-6 text-coral-600" />
                  <div>
                    <h3 className="text-navy-900 font-bold text-lg tracking-tight">Consensus Oracle</h3>
                    <p className="text-slate-500 text-[10px] tracking-wider uppercase">Weighted 2-of-3 Blind Protocol</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold font-mono ${consensus.result === 'APPROVED' ? 'text-coral-600' : consensus.result === 'REJECTED' ? 'text-red-400' : 'text-coral-600'}`} data-testid="anan-consensus-result">
                  {consensus.result}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Weighted Average</p>
                  <p className="text-navy-900 font-bold font-mono text-lg">{consensus.weighted_average?.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Pass Count</p>
                  <p className="text-navy-900 font-bold font-mono text-lg">{consensus.pass_count}/3</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Score Spread</p>
                  <p className="text-navy-900 font-bold font-mono text-lg">{consensus.score_spread}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase">Consensus Hash</p>
                  <code className="text-coral-600 font-mono text-[10px]">{consensus.consensus_hash?.slice(0, 16)}...</code>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {Object.entries(consensus.scores || {}).map(([agent, score]) => {
                  const colorCls = score >= 70 ? 'bg-coral-500' : score >= 40 ? 'bg-coral-500' : 'bg-red-500';
                  return (
                    <div key={agent} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600 w-16 capitalize">{agent}</span>
                      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                        <div className={`h-full ${colorCls} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-navy-900 font-mono w-8 text-right">{score}</span>
                      <span className="text-slate-600 text-[10px] w-10">x{AGENT_CONFIG[agent]?.weight}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blockchain Seal */}
        {c.blockchain_seal && (
          <Card className="bg-cream-100 border-slate-200 mb-6" data-testid="anan-blockchain-seal">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-navy-900 font-bold text-sm flex items-center gap-2"><Blocks className="w-4 h-4 text-coral-600" /> Blockchain Seal</h3>
                {c.status === 'sealed' && (
                  <Button size="sm" onClick={() => fetchBadge(c.ceremony_id)}
                    className="bg-coral-500 hover:bg-emerald-700 text-[10px] h-7" data-testid="anan-get-badge-btn">
                    <Code className="w-3 h-3 mr-1" /> Get Embed Badge
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoRow label="Network" value={c.blockchain_seal.network} />
                <InfoRow label="Topic" value={c.blockchain_seal.topic_id} mono />
                {c.blockchain_seal.transaction_id && <InfoRow label="TX ID" value={c.blockchain_seal.transaction_id} mono />}
                {c.blockchain_seal.consensus_hash && <InfoRow label="Hash" value={c.blockchain_seal.consensus_hash.slice(0, 20) + '...'} mono />}
                {c.blockchain_seal.explorer_url && (
                  <a href={c.blockchain_seal.explorer_url} target="_blank" rel="noopener noreferrer" className="text-coral-600 hover:text-coral-700 text-[10px] flex items-center gap-1 col-span-2">
                    <Globe className="w-3 h-3" /> View on HashScan
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Badge Embed Modal */}
        {showBadge && badgeData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBadge(false)}>
            <Card className="bg-cream-100 border-coral-200 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="anan-badge-modal">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-navy-900 font-bold text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-coral-600" /> Shareable Verification Badge</h3>
                  <button onClick={() => setShowBadge(false)} className="text-slate-500 hover:text-navy-900"><X className="w-5 h-5" /></button>
                </div>

                <div className="mb-4 p-4 bg-white/5 rounded-lg border border-slate-200 flex justify-center">
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(badgeData.embed_html || '', { USE_PROFILES: { html: true, svg: true } }) }} />
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-600 text-xs font-bold">Static HTML (Works Everywhere)</label>
                    <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 text-[10px] h-6"
                      onClick={() => copyToClipboard(badgeData.embed_html, 'Copied HTML!')}
                      data-testid="badge-copy-html">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="bg-navy-900 border border-slate-200 rounded p-3 text-[10px] text-coral-600 font-mono overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {badgeData.embed_html}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-600 text-xs font-bold">Dynamic JS Widget (Live Status Updates)</label>
                    <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 text-[10px] h-6"
                      onClick={() => copyToClipboard(badgeData.embed_js, 'Copied JS widget!')}
                      data-testid="badge-copy-js">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="bg-navy-900 border border-slate-200 rounded p-3 text-[10px] text-coral-600 font-mono overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {badgeData.embed_js}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Escalation Info */}
        {c.escalation && (
          <Card className="bg-coral-500/5 border-amber-500/20 mb-6" data-testid="anan-escalation-info">
            <CardContent className="p-4">
              <h3 className="text-coral-600 font-bold text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Human Escalation</h3>
              <p className="text-slate-600 text-xs mb-2">{c.escalation.reason}</p>
              {c.escalation.status === 'resolved' ? (
                <p className="text-coral-600 text-xs">Resolved: <span className="font-bold uppercase">{c.escalation.override_decision}</span> by {c.escalation.resolved_by}</p>
              ) : (
                <p className="text-coral-600 text-xs">Awaiting human review...</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SSE Event Log */}
        {sseEvents.length > 0 && (
          <Card className="bg-cream-100 border-slate-200" data-testid="anan-event-log">
            <CardContent className="p-4">
              <h3 className="text-slate-600 font-bold text-sm mb-3 flex items-center gap-2"><Radio className="w-4 h-4" /> Live Event Stream</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[10px]">
                {sseEvents.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 w-20 flex-shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className={`${e.type.includes('error') ? 'text-red-400' : e.type.includes('reveal') ? 'text-coral-600' : e.type.includes('consensus') ? 'text-coral-600' : 'text-slate-600'}`}>
                      [{e.type}] {e.data.message || e.data.agent || e.data.result || ''}
                      {e.data.score != null && ` → score: ${e.data.score}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ceremony Meta */}
        <Card className="bg-cream-100 border-slate-200 mt-6" data-testid="anan-ceremony-meta">
          <CardContent className="p-4">
            <h3 className="text-slate-600 font-bold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Ceremony Details</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Document" value={c.document_name} />
              <InfoRow label="Signer" value={c.signer_name} />
              <InfoRow label="Type" value={c.document_type} />
              <InfoRow label="Jurisdiction" value={c.jurisdiction} />
              <InfoRow label="Initiated By" value={c.initiated_by} />
              <InfoRow label="Created" value={new Date(c.created_at).toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
