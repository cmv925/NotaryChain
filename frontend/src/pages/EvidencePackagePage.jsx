import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Package, Shield, CheckCircle, XCircle,
  Users, FileText, Fingerprint, MessageSquare,
  Loader2, ExternalLink, Copy, ChevronDown, ChevronUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function EvidencePackagePage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const fetchPackage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/evidence-package/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPkg(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [transactionId, token]);

  const generatePackage = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/evidence-package/generate/${transactionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPkg(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  };

  const copyHash = (hash) => navigator.clipboard.writeText(hash);

  const Section = ({ title, icon: Icon, color, badge, id, children }) => (
    <Card className="bg-[#0d1b2a] border-gray-800">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle(id)}>
        <CardTitle className="text-sm text-navy-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${color}`} />
            {title}
          </span>
          <div className="flex items-center gap-2">
            {badge}
            {expanded[id] ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </CardTitle>
      </CardHeader>
      {expanded[id] && <CardContent>{children}</CardContent>}
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#030712] text-navy-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-coral-600" />
              Evidence Package
            </h1>
            <p className="text-gray-400 text-sm">Forensic-grade transaction evidence bundle</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button onClick={fetchPackage} disabled={loading} variant="outline" className="border-gray-700 text-gray-300" data-testid="fetch-package-btn">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
            Load Latest Package
          </Button>
          <Button onClick={generatePackage} disabled={generating} className="bg-coral-500 hover:bg-emerald-700" data-testid="generate-package-btn">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
            Generate New Package
          </Button>
        </div>

        {(loading || generating) && !pkg && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-coral-600" />
            <p className="text-sm">{generating ? 'Compiling evidence...' : 'Loading...'}</p>
          </div>
        )}

        {pkg && (
          <div className="space-y-4">
            {/* Overview */}
            <Card className="bg-gradient-to-r from-[#0d1b2a] to-[#0d2b1a] border-coral-200" data-testid="package-overview">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-coral-600 text-xs font-semibold mb-1">EVIDENCE PACKAGE v{pkg.version}</p>
                    <h2 className="text-navy-900 text-lg font-bold">{pkg.transaction?.name}</h2>
                    <p className="text-gray-400 text-xs">{pkg.transaction?.type?.replace(/_/g, ' ')}</p>
                  </div>
                  <Badge className={pkg.transaction?.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}>
                    {pkg.transaction?.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#0a1520] rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px]">Package ID</p>
                    <p className="text-navy-900 text-xs font-mono">{pkg.id?.substring(0, 12)}...</p>
                  </div>
                  <div className="bg-[#0a1520] rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px]">Generated</p>
                    <p className="text-navy-900 text-xs">{pkg.generated_at ? new Date(pkg.generated_at).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="bg-[#0a1520] rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px]">Progress</p>
                    <p className="text-navy-900 text-xs">{pkg.transaction?.progress}%</p>
                  </div>
                  <div className="bg-[#0a1520] rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px]">Integrity</p>
                    <p className="text-coral-600 text-xs font-mono">{pkg.integrity_hash?.substring(0, 12)}...</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Blockchain Proof */}
            <Section title="Blockchain Proof" icon={Shield} color="text-coral-600" id="blockchain"
              badge={pkg.blockchain_proof?.settlement_hash ? <Badge className="bg-green-500/15 text-green-400 text-[10px]">Sealed</Badge> : null}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Network</span><span className="text-navy-900">{pkg.blockchain_proof?.network}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Topic ID</span><span className="text-navy-900 font-mono">{pkg.blockchain_proof?.topic_id || '-'}</span></div>
                {pkg.blockchain_proof?.settlement_hash && (
                  <div>
                    <span className="text-gray-500 block mb-1">Settlement Hash</span>
                    <div className="flex items-center gap-2">
                      <code className="text-coral-600 bg-[#1a2332] px-2 py-1 rounded text-[10px] break-all flex-1">{pkg.blockchain_proof.settlement_hash}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyHash(pkg.blockchain_proof.settlement_hash)}>
                        <Copy className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                )}
                {pkg.blockchain_proof?.explorer_url && (
                  <a href={pkg.blockchain_proof.explorer_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                    View on Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </Section>

            {/* Participants */}
            <Section title={`Participants (${pkg.participants?.length || 0})`} icon={Users} color="text-blue-400" id="participants">
              <div className="space-y-2">
                {pkg.participants?.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#1a2332] rounded-lg p-2">
                    <div>
                      <span className="text-navy-900 text-xs">{p.name}</span>
                      <span className="text-gray-500 text-[10px] ml-2">{p.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{p.role}</Badge>
                      <Badge className={p.status === 'joined' ? 'bg-green-500/15 text-green-400 text-[10px]' : 'bg-gray-500/15 text-gray-400 text-[10px]'}>
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Tasks */}
            <Section title={`Tasks (${pkg.tasks?.length || 0})`} icon={FileText} color="text-coral-600" id="tasks">
              <div className="space-y-1">
                {pkg.tasks?.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {t.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-gray-600" />}
                      <span className={`text-xs ${t.status === 'completed' ? 'text-gray-300' : 'text-gray-500'}`}>{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.requires_signature && <Badge className="text-[8px] bg-violet-500/15 text-coral-600">SIG</Badge>}
                      {t.requires_notarization && <Badge className="text-[8px] bg-cyan-500/15 text-coral-600">NOT</Badge>}
                      {t.requires_document && <Badge className="text-[8px] bg-coral-500/15 text-coral-600">DOC</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Biometric Evidence */}
            <Section title="Biometric Evidence" icon={Fingerprint} color="text-purple-400" id="biometric"
              badge={<Badge className="bg-purple-500/15 text-purple-400 text-[10px]">{pkg.biometric_evidence?.individual_verifications || 0} verifications</Badge>}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Passports</span><span className="text-navy-900">{pkg.biometric_evidence?.passports?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Modalities</span><span className="text-navy-900">{pkg.biometric_evidence?.modalities_used?.join(', ') || 'None'}</span></div>
                {pkg.biometric_evidence?.passports?.map((bp, i) => (
                  <div key={i} className="bg-[#1a2332] rounded-lg p-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Passport #{bp.id?.substring(0, 8)}</span>
                      <Badge className={bp.status === 'verified' ? 'bg-green-500/15 text-green-400 text-[10px]' : 'bg-coral-500/15 text-coral-600 text-[10px]'}>{bp.status}</Badge>
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">Score: {(bp.composite_score * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Communication */}
            <Section title="Communication Record" icon={MessageSquare} color="text-teal-400" id="communication">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Total Messages</span><span className="text-navy-900">{pkg.communication?.total_messages || 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">AI Conductor Sessions</span><span className="text-navy-900">{pkg.communication?.conductor_guidance_sessions || 0}</span></div>
              </div>
            </Section>

            {/* Component Hashes */}
            {pkg.component_hashes && (
              <Section title="Component Hashes" icon={Shield} color="text-gray-400" id="hashes">
                <div className="space-y-2">
                  {Object.entries(pkg.component_hashes).map(([key, hash]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs capitalize">{key}</span>
                      <code className="text-coral-600 text-[10px] font-mono">{hash?.substring(0, 20)}...</code>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {!pkg && !loading && !generating && (
          <Card className="bg-[#0d1b2a] border-gray-800">
            <CardContent className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-30" />
              <p className="text-gray-500 text-sm">No evidence package generated yet</p>
              <p className="text-gray-600 text-xs mt-1">Click "Generate New Package" to compile all transaction evidence</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
