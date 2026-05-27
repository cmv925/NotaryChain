import React from 'react';
import {
  XCircle, CheckCircle, RefreshCw, Video, Award, Copy,
  User, Brain, Sparkles, Link2, ScanFace, ExternalLink,
  ClipboardList, ShieldAlert, BookOpen, Gauge,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * Full-screen modal showing every detail about a single notary request:
 * signers, verification status, AI co-pilot, journal prefill, blockchain
 * record, and the action footer.
 *
 * Lifted out of NotaryDashboard.jsx for maintainability.
 */
export default function RequestDetailModal({
  request,
  aiAnalysis,
  loadingAi,
  copilotData,
  loadingCopilot,
  onRunCopilot,
  journalPrefill,
  loadingJournal,
  onPrefillJournal,
  onClose,
  onAccept,
  onStartSession,
  onComplete,
  onReject,
  onViewCertificate,
  processingAction,
  getStatusBadge,
  copyToClipboard,
}) {
  const isCompleted = request.status === 'completed';
  const isPending = request.status === 'pending';
  const isAssigned = request.status === 'assigned' || request.status === 'in_progress';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-navy-900">{request.document_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusBadge(request.status)}>
                {request.status?.replace('_', ' ')}
              </Badge>
              <span className="text-slate-500 text-sm capitalize">
                {request.document_type?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-500 hover:text-navy-900"
          >
            <XCircle className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Document Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cream-100 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Type</p>
              <p className="text-navy-900 text-sm capitalize">{request.notarization_type}</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Signers</p>
              <p className="text-navy-900 text-sm">{request.signers?.length || 1}</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Scheduled</p>
              <p className="text-navy-900 text-sm">
                {request.scheduled_time
                  ? new Date(request.scheduled_time).toLocaleDateString()
                  : 'Flexible'}
              </p>
            </div>
            <div className="bg-cream-100 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Created</p>
              <p className="text-navy-900 text-sm">
                {new Date(request.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Request ID */}
          <div className="bg-cream-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs mb-1">Request ID</p>
                <code className="text-coral-600 text-sm">{request.id}</code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(request.id)}
                className="text-slate-500 hover:text-navy-900"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Signers */}
          {request.signers?.length > 0 && (
            <div>
              <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-coral-500" />
                Signers ({request.signers.length})
              </h3>
              <div className="space-y-2">
                {request.signers.map((signer, idx) => (
                  <div
                    key={idx}
                    className="bg-cream-100 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-coral-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-coral-500" />
                    </div>
                    <div>
                      <p className="text-navy-900 text-sm">{signer.name || 'N/A'}</p>
                      <p className="text-slate-500 text-xs">{signer.email || 'No email'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Status */}
          <div>
            <h3 className="text-navy-900 font-semibold mb-3">Verification Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`rounded-lg p-4 border ${
                  request.biometric_verified
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-cream-100 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ScanFace
                    className={`w-5 h-5 ${
                      request.biometric_verified ? 'text-green-400' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={request.biometric_verified ? 'text-green-400' : 'text-slate-500'}
                  >
                    {request.biometric_verified ? 'ID Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
              <div
                className={`rounded-lg p-4 border ${
                  request.hcs_topic_id
                    ? 'bg-coral-500/10 border-coral-500/30'
                    : 'bg-cream-100 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Link2
                    className={`w-5 h-5 ${
                      request.hcs_topic_id ? 'text-coral-600' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={request.hcs_topic_id ? 'text-coral-600' : 'text-slate-500'}
                  >
                    {request.hcs_topic_id ? 'Blockchain Ready' : 'Not On-chain'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Co-pilot */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-navy-900 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-coral-600" />
                AI Co-pilot
              </h3>
              <Button
                onClick={onRunCopilot}
                disabled={loadingCopilot}
                size="sm"
                className="bg-amber-600/80 hover:bg-amber-600 text-navy-900 text-xs"
                data-testid="run-copilot-btn"
              >
                {loadingCopilot ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Brain className="w-3 h-3 mr-1" />
                )}
                {copilotData ? 'Re-analyze' : 'Analyze Request'}
              </Button>
            </div>

            {loadingCopilot && (
              <div className="bg-cream-100 rounded-lg p-6 text-center">
                <RefreshCw className="w-6 h-6 text-coral-600 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-sm">AI Co-pilot is analyzing...</p>
              </div>
            )}

            {copilotData && !loadingCopilot && (
              <div className="space-y-3">
                {/* Summary + Risk */}
                <div className="bg-cream-100 rounded-lg p-4">
                  <p className="text-slate-500 text-sm mb-3">{copilotData.summary}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-500 text-xs">Readiness:</span>
                      <span className="text-navy-900 text-xs font-bold">
                        {copilotData.readiness_score ?? '-'}/100
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        copilotData.risk_level === 'low'
                          ? 'bg-green-500/15 text-green-400'
                          : copilotData.risk_level === 'medium'
                          ? 'bg-coral-500/15 text-coral-600'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {copilotData.risk_level?.toUpperCase()} RISK
                    </span>
                  </div>
                </div>

                {/* Key Highlights */}
                {copilotData.key_highlights?.length > 0 && (
                  <div className="bg-cream-100 rounded-lg p-3">
                    <h4 className="text-navy-900 text-xs font-semibold mb-2">Key Highlights</h4>
                    <div className="space-y-1.5">
                      {copilotData.key_highlights.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-500">{h.label}</span>
                          <span
                            className={`font-medium ${
                              h.status === 'ok'
                                ? 'text-green-400'
                                : h.status === 'warning'
                                ? 'text-coral-600'
                                : 'text-red-400'
                            }`}
                          >
                            {h.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inconsistency Flags */}
                {copilotData.inconsistency_flags?.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    <h4 className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> Flags (
                      {copilotData.inconsistency_flags.length})
                    </h4>
                    <div className="space-y-2">
                      {copilotData.inconsistency_flags.map((f, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                f.severity === 'high'
                                  ? 'bg-red-500/20 text-red-400'
                                  : f.severity === 'medium'
                                  ? 'bg-coral-500/20 text-coral-600'
                                  : 'bg-coral-500/20 text-coral-500'
                              }`}
                            >
                              {f.severity?.toUpperCase()}
                            </span>
                            <span className="text-slate-500">{f.description}</span>
                          </div>
                          {f.recommendation && (
                            <p className="text-slate-500 ml-6">{f.recommendation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist */}
                {copilotData.checklist?.length > 0 && (
                  <div className="bg-cream-100 rounded-lg p-3">
                    <h4 className="text-navy-900 text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-coral-500" /> Pre-Notarization
                      Checklist
                    </h4>
                    <div className="space-y-1">
                      {copilotData.checklist.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {c.completed ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-slate-500">{c.item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {copilotData.recommendations?.length > 0 && (
                  <div className="bg-cream-100 rounded-lg p-3">
                    <h4 className="text-navy-900 text-xs font-semibold mb-2">Recommendations</h4>
                    {copilotData.recommendations.map((r, i) => (
                      <p key={i} className="text-slate-500 text-xs mb-1 flex gap-1.5">
                        <span className="text-coral-600">&#8226;</span> {r}
                      </p>
                    ))}
                  </div>
                )}

                {/* Journal Prefill */}
                <div className="bg-coral-500/5 border border-coral-300/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-coral-500 text-xs font-semibold flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> E-Journal Prefill
                    </h4>
                    <Button
                      onClick={onPrefillJournal}
                      disabled={loadingJournal}
                      size="sm"
                      variant="ghost"
                      className="text-coral-500 hover:text-coral-400 text-[10px] h-6 px-2"
                      data-testid="prefill-journal-btn"
                    >
                      {loadingJournal ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        'Generate'
                      )}
                    </Button>
                  </div>
                  {loadingJournal && <p className="text-slate-500 text-xs">Generating...</p>}
                  {journalPrefill && !loadingJournal && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(journalPrefill)
                        .filter(([k]) => k !== '_id')
                        .map(([key, val]) => (
                          <div key={key}>
                            <span className="text-slate-500 capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-navy-900 ml-1">
                              {String(val) || '-'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  {!journalPrefill && !loadingJournal && (
                    <p className="text-slate-500 text-[11px]">
                      Click Generate to auto-fill journal entry fields from request data.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!copilotData && !loadingCopilot && (
              <div className="bg-cream-100 rounded-lg p-4 text-center">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">
                  Click "Analyze Request" to get AI-powered insights
                </p>
              </div>
            )}
          </div>

          {/* AI Document Analysis (legacy) */}
          <div>
            <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-navy-600" />
              AI Document Analysis
            </h3>
            {loadingAi ? (
              <div className="bg-cream-100 rounded-lg p-6 text-center">
                <RefreshCw className="w-6 h-6 text-navy-600 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Loading analysis...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="bg-cream-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">Document Type Detected</span>
                  <span className="text-navy-900">{aiAnalysis.document_type || 'Unknown'}</span>
                </div>
                {aiAnalysis.signatures_detected !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-sm">Signatures Detected</span>
                    <span className="text-navy-900">{aiAnalysis.signatures_detected}</span>
                  </div>
                )}
                {aiAnalysis.key_entities?.length > 0 && (
                  <div>
                    <span className="text-slate-500 text-sm">Key Entities</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiAnalysis.key_entities.slice(0, 5).map((entity, idx) => (
                        <Badge key={idx} className="bg-navy-600/20 text-navy-500 text-xs">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-cream-100 rounded-lg p-4 text-center">
                <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No analysis available</p>
              </div>
            )}
          </div>

          {/* Blockchain Info */}
          {request.hcs_topic_id && (
            <div className="bg-cream-100 rounded-lg p-4">
              <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-coral-600" />
                Blockchain Record
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">HCS Topic</span>
                  <code className="text-coral-600 text-sm">{request.hcs_topic_id}</code>
                </div>
                {request.hcs_explorer_url && (
                  <a
                    href={request.hcs_explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-coral-500 text-sm flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on HashScan
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div className="bg-cream-100 rounded-lg p-4">
              <h3 className="text-navy-900 font-semibold mb-2">Notes</h3>
              <p className="text-slate-500 text-sm">{request.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {isPending && (
              <Button
                onClick={onAccept}
                disabled={processingAction === request.id}
                className="flex-1 bg-coral-500 hover:bg-coral-600 text-white"
              >
                {processingAction === request.id ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Accept Request
              </Button>
            )}

            {isAssigned && (
              <>
                <Button
                  onClick={onStartSession}
                  disabled={processingAction === request.id}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-navy-900"
                >
                  <Video className="w-4 h-4 mr-2" />
                  {request.status === 'assigned' ? 'Start Session' : 'Join Session'}
                </Button>
                {request.status === 'in_progress' && (
                  <Button
                    onClick={onComplete}
                    disabled={processingAction === request.id}
                    className="bg-coral-500 hover:bg-coral-600 text-black"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete
                  </Button>
                )}
                <Button
                  onClick={onReject}
                  disabled={processingAction === request.id}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}

            {isCompleted && (
              <Button
                onClick={onViewCertificate}
                className="flex-1 bg-coral-500 hover:bg-coral-600 text-black"
              >
                <Award className="w-4 h-4 mr-2" />
                View Certificate
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
