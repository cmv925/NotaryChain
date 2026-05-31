/**
 * AnchorOnChainModal — anchors a finalized agreement on Hedera HCS.
 *
 * Flow: confirm → POST /api/contract-templates/anchor
 *   • 403 identity_verification_required → opens <EnhancedKBAFlow/>, then auto-retries
 *   • success → shows the on-chain certificate (hash, tx id, HashScan explorer link)
 *
 * Reused by the Smart Contract Templates library and the Template Library anchor step.
 */
import React, { useState } from 'react';
import axios from 'axios';
import {
  X, ShieldCheck, Loader2, ExternalLink, Copy, Anchor, FileLock2, CheckCircle2,
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import EnhancedKBAFlow from './EnhancedKBAFlow';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnchorOnChainModal({ open, onClose, templateId, title, content, onAnchored }) {
  const { token, refreshUser } = useAuth();
  const [anchoring, setAnchoring] = useState(false);
  const [result, setResult] = useState(null);
  const [showKBA, setShowKBA] = useState(false);

  if (!open) return null;

  const doAnchor = async () => {
    setAnchoring(true);
    try {
      const res = await axios.post(`${API}/contract-templates/anchor`, {
        template_id: templateId,
        title,
        content,
      });
      setResult(res.data);
      onAnchored?.(res.data);
      toast({ title: 'Anchored on Hedera', description: 'Your agreement now has an immutable proof.' });
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.detail === 'identity_verification_required') {
        toast({ title: 'Identity verification required', description: 'Complete a quick ID check to anchor on-chain.' });
        setShowKBA(true);
      } else {
        toast({ title: 'Anchoring failed', description: e.response?.data?.detail || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setAnchoring(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    toast({ title: 'Copied' });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4" data-testid="anchor-modal">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-coral-500" />
            <h3 className="font-bold text-navy-900">Anchor on Blockchain</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-navy-900" data-testid="anchor-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-coral-500/15 flex items-center justify-center flex-shrink-0">
                <FileLock2 className="w-5 h-5 text-coral-500" />
              </div>
              <div>
                <p className="font-semibold text-navy-900 text-sm">{title}</p>
                <p className="text-sm text-slate-600 mt-1">
                  We'll compute a SHA-256 fingerprint of this agreement and record it immutably on the
                  Hedera Consensus Service — creating a tamper-proof, timestamped certificate anyone can verify.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <span className="font-semibold text-navy-800">What gets anchored:</span> only the cryptographic
              hash of your document — never the document text itself. Your content stays private.
            </div>

            <Button
              onClick={doAnchor}
              disabled={anchoring}
              className="w-full bg-navy-900 hover:bg-navy-800 text-white"
              data-testid="anchor-confirm-btn"
            >
              {anchoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {anchoring ? 'Anchoring…' : 'Anchor on Hedera'}
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-4" data-testid="anchor-certificate">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="font-bold text-navy-900 text-lg">Agreement Anchored</h4>
              <p className="text-sm text-slate-600">{result.title}</p>
              {!result.hcs_submitted && (
                <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Proof recorded · HCS submission completes on the live network
                </span>
              )}
            </div>

            {[
              ['Document hash (SHA-256)', result.content_hash],
              ['Transaction ID', result.transaction_id],
              ['HCS topic', result.topic_id],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">{label}</span>
                <button
                  onClick={() => copy(val)}
                  className="font-mono text-navy-800 truncate max-w-[55%] flex items-center gap-1 hover:text-coral-600"
                  title={val}
                >
                  <span className="truncate">{val}</span>
                  <Copy className="w-3 h-3 flex-shrink-0" />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              {result.explorer_url && (
                <a href={result.explorer_url} target="_blank" rel="noopener noreferrer" className="flex-1" data-testid="anchor-explorer-link">
                  <Button variant="outline" className="w-full border-slate-300">
                    <ExternalLink className="w-4 h-4 mr-2" /> View on HashScan
                  </Button>
                </a>
              )}
              <Button onClick={onClose} className="flex-1 bg-navy-900 hover:bg-navy-800 text-white" data-testid="anchor-done-btn">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>

      <EnhancedKBAFlow
        token={token}
        open={showKBA}
        onClose={() => setShowKBA(false)}
        onComplete={async (envelope) => {
          setShowKBA(false);
          if (envelope?.decision === 'passed') {
            await refreshUser?.();
            doAnchor();
          }
        }}
      />
    </div>
  );
}
