import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Globe2, Sparkles, ShieldCheck, ScrollText, RefreshCw, Plus, Download,
  AlertTriangle, ArrowLeft, ExternalLink, Anchor, Copy, BookOpen, MapPin, Languages, Cpu, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/acn`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token') || ''}`,
});

const RISK_TONE = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const TABS = [
  { id: 'new', label: 'New Packet', icon: Plus },
  { id: 'packets', label: 'My Packets', icon: ScrollText },
  { id: 'updates', label: 'Rule Updates', icon: RefreshCw },
  { id: 'jurisdictions', label: 'Jurisdictions', icon: BookOpen },
];

const SAMPLE_DOC = `This Master Services Agreement is entered into between Acme Corp, a Delaware corporation, and Globex GmbH, a company organised under the laws of Germany.

The Agreement is governed by the laws of the State of Texas. Closing shall occur in New York, and any electronic execution by EU-resident counter-parties shall comply with the eIDAS Regulation (Qualified Electronic Signature).

Notarial acknowledgment shall be valid in California upon equivalent in-person execution.`;

export default function ACNDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('new');
  const [packets, setPackets] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);

  // New-packet form state
  const [docText, setDocText] = useState(SAMPLE_DOC);
  const [sourceJur, setSourceJur] = useState('US-TX');
  const [signerName, setSignerName] = useState('John Smith');
  const [county, setCounty] = useState('Harris');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sealing, setSealing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, u, j] = await Promise.all([
        axios.get(`${API}/packets`, { headers: authHeaders() }),
        axios.get(`${API}/rule-updates`, { headers: authHeaders() }),
        axios.get(`${API}/jurisdictions`, { headers: authHeaders() }),
      ]);
      setPackets(p.data.packets || []);
      setUpdates(u.data.updates || []);
      setJurisdictions(j.data.jurisdictions || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load ACN data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* mount-only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const sealed = packets.filter(p => p.status === 'sealed').length;
    const partial = packets.filter(p => p.status === 'partially_sealed').length;
    const need = packets.filter(p => p.needs_reseal).length;
    const totalJ = packets.reduce((acc, p) => acc + (p.detected_jurisdictions?.length || 0), 0);
    return { total: packets.length, sealed, partial, need, totalJ };
  }, [packets]);

  const analyze = async () => {
    if (!docText.trim()) { toast.warning('Paste a document first.'); return; }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await axios.post(`${API}/analyze`,
        { doc_text: docText, source_jurisdiction: sourceJur },
        { headers: authHeaders() });
      setAnalysis(res.data);
      toast.success(`Detected ${res.data.detected_jurisdictions.length} jurisdiction(s) — ${res.data.detection_method}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Analyze failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const seal = async () => {
    if (!analysis) return;
    setSealing(true);
    try {
      const res = await axios.post(`${API}/packets/${analysis.id}/seal`,
        { signer_name: signerName, county },
        { headers: authHeaders() });
      toast.success(`Sealed ${res.data.sealed_jurisdictions.length} jurisdiction(s)`);
      setAnalysis(null);
      setDocText('');
      await refresh();
      setTab('packets');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Seal failed');
    } finally {
      setSealing(false);
    }
  };

  const openPacket = async (id) => {
    setActive({ loading: true, id });
    try {
      const res = await axios.get(`${API}/packets/${id}`, { headers: authHeaders() });
      setActive(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load packet');
      setActive(null);
    }
  };

  const reseal = async (id) => {
    if (!window.confirm('Re-seal this packet with the latest jurisdiction rules?')) return;
    try {
      const res = await axios.post(`${API}/packets/${id}/reseal`, {}, { headers: authHeaders() });
      toast.success(`Resealed ${res.data.resealed_jurisdictions.length} jurisdiction(s)`);
      await refresh();
      await openPacket(id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reseal failed');
    }
  };

  const downloadCert = async (packetId, jur) => {
    try {
      const res = await axios.get(`${API}/packets/${packetId}/proofs/${jur}/certificate`,
        { headers: authHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `ACN_${packetId.slice(0, 8)}_${jur}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Download failed');
    }
  };

  const mintNft = async (id) => {
    try {
      const res = await axios.post(`${API}/packets/${id}/mint-nft`, {}, { headers: authHeaders() });
      const n = res.data.nft || {};
      toast.success(res.data.already_minted
        ? `NFT already minted · ${n.token_id} #${n.serial_number}`
        : `Passport NFT minted · ${n.token_id} #${n.serial_number}`);
      await openPacket(id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'NFT mint failed');
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white -ml-2"
              onClick={() => navigate('/dashboard')} data-testid="acn-back-btn">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-cyan-300 mb-1 flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5" /> Autonomous Cross-Border Notarization Network
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl">One notarization. Any jurisdiction.</h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                AI detects every relevant jurisdiction, the rule engine translates local RON
                requirements, and Hedera HCS seals a tamper-proof certificate per jurisdiction.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Packets" value={stats.total} tone="cyan" />
              <StatCard label="Sealed" value={stats.sealed} tone="emerald" />
              <StatCard label="Jurisdictions" value={stats.totalJ} tone="amber" />
              <StatCard label="Need re-seal" value={stats.need} tone="red" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap gap-1 border-b border-slate-700">
            {TABS.map(t => {
              const Icon = t.icon;
              const active_ = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 ${
                    active_ ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid={`acn-tab-${t.id}`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'new' && (
          <NewPacketView {...{ docText, setDocText, sourceJur, setSourceJur, signerName, setSignerName, county, setCounty, analysis, analyze, seal, analyzing, sealing, jurisdictions }} />
        )}

        {tab === 'packets' && (
          <PacketsView packets={packets} onOpen={openPacket} onReseal={reseal} onMintNft={mintNft} loading={loading} active={active} onClose={() => setActive(null)} downloadCert={downloadCert} navigate={navigate} />
        )}

        {tab === 'updates' && <UpdatesView updates={updates} jurisdictions={jurisdictions} onRefresh={refresh} />}

        {tab === 'jurisdictions' && <JurisdictionsView jurisdictions={jurisdictions} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/40 bg-red-500/10 text-red-200',
  };
  return (
    <div className={`border rounded-lg px-3 py-2 min-w-[90px] ${tones[tone]}`}>
      <p className="text-[9px] uppercase tracking-wider opacity-80 font-bold">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function NewPacketView({ docText, setDocText, sourceJur, setSourceJur, signerName, setSignerName, county, setCounty, analysis, analyze, seal, analyzing, sealing, jurisdictions }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-coral-600" /> Step 1 · Paste document & analyze
          </h3>
          <textarea
            value={docText} onChange={e => setDocText(e.target.value)}
            rows={9}
            placeholder="Paste the document text, governing-law clause, or summary…"
            className="w-full p-3 border border-slate-200 rounded-md text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-coral-500"
            data-testid="acn-doc-text"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Source jurisdiction</label>
              <select value={sourceJur} onChange={e => setSourceJur(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" data-testid="acn-source-jur">
                {jurisdictions.map(j => <option key={j.code} value={j.code}>{j.code} — {j.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={analyze} disabled={analyzing} className="bg-navy-900 hover:bg-navy-800 w-full" data-testid="acn-analyze-btn">
                {analyzing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Cpu className="w-4 h-4 mr-2" />}
                {analyzing ? 'Analyzing…' : 'Detect Jurisdictions'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-coral-600" /> Step 2 · Seal cross-border proofs
          </h3>

          {!analysis ? (
            <div className="bg-cream-100 border border-dashed border-slate-300 rounded-md p-6 text-center text-sm text-slate-500">
              <Globe2 className="w-7 h-7 mx-auto mb-2 opacity-50" />
              Run jurisdiction detection first. Detected jurisdictions and risk scores will appear here.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">{analysis.detection_method}</span>
                <span className="text-slate-500 font-mono truncate">hash {analysis.source_text_hash?.slice(0, 12)}…</span>
              </div>
              <div className="space-y-1.5 mb-4 max-h-44 overflow-y-auto" data-testid="acn-analysis-list">
                {analysis.detected_jurisdictions.map(code => {
                  const r = analysis.risk_scores?.[code] || {};
                  return (
                    <div key={code} className={`border rounded-md p-2.5 ${RISK_TONE[r.level] || 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> {code}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          risk {r.score}/100 · {r.level}
                        </span>
                      </div>
                      {r.reasons?.length > 0 && (
                        <ul className="mt-1 ml-4 text-[11px] list-disc opacity-80 space-y-0.5">
                          {r.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Signer name</label>
                  <Input value={signerName} onChange={e => setSignerName(e.target.value)} data-testid="acn-signer" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">County / city</label>
                  <Input value={county} onChange={e => setCounty(e.target.value)} data-testid="acn-county" />
                </div>
              </div>
              <Button onClick={seal} disabled={sealing} className="bg-coral-500 hover:bg-coral-600 w-full" data-testid="acn-seal-btn">
                {sealing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Anchor className="w-4 h-4 mr-2" />}
                {sealing ? 'Sealing across jurisdictions…' : `Seal ${analysis.detected_jurisdictions.length} jurisdiction(s) on Hedera`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PacketsView({ packets, onOpen, onReseal, onMintNft, loading, active, onClose, downloadCert, navigate }) {
  if (active) {
    return <PacketDetail packet={active} onClose={onClose} onReseal={onReseal} onMintNft={onMintNft} downloadCert={downloadCert} navigate={navigate} />;
  }
  if (loading) return <div className="text-center py-12 text-slate-500"><RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />Loading packets…</div>;
  if (packets.length === 0) {
    return <Card className="border-slate-200"><CardContent className="p-12 text-center text-slate-500">
      <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-40" />
      No packets yet. Create one from the <b>New Packet</b> tab.
    </CardContent></Card>;
  }
  return (
    <div className="grid gap-3" data-testid="acn-packets-list">
      {packets.map(p => (
        <Card key={p.id} className="border-slate-200 hover:border-coral-300 transition-colors cursor-pointer" onClick={() => onOpen(p.id)}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`w-2 h-12 rounded-full ${
              p.status === 'sealed' ? 'bg-emerald-500' :
              p.status === 'partially_sealed' ? 'bg-amber-500' : 'bg-slate-300'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-navy-900 font-mono truncate">{p.id.slice(0, 16)}…</p>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  p.status === 'sealed' ? 'bg-emerald-100 text-emerald-700' :
                  p.status === 'partially_sealed' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{p.status}</span>
                {p.needs_reseal && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Needs reseal
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {p.detected_jurisdictions?.length || 0} jurisdiction(s) · source {p.source_jurisdiction} · created {p.created_at?.slice(0, 10)}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(p.detected_jurisdictions || []).map(c => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono">{c}</span>
                ))}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PacketDetail({ packet, onClose, onReseal, onMintNft, downloadCert, navigate }) {
  if (packet.loading) return <div className="text-center py-12 text-slate-500"><RefreshCw className="w-6 h-6 mx-auto animate-spin" /></div>;
  const verifyUrl = `${window.location.origin}/acn/verify/${packet.id}`;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onClose} data-testid="acn-packet-close">
        <ArrowLeft className="w-4 h-4 mr-1" /> All packets
      </Button>
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-serif text-2xl text-navy-900">Packet {packet.id?.slice(0, 12)}…</h2>
              <p className="text-xs text-slate-500 font-mono mt-1">source hash: {packet.source_text_hash}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {!packet.nft && (packet.status === 'sealed' || packet.status === 'partially_sealed') && (
                <Button onClick={() => onMintNft(packet.id)} variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50" data-testid="acn-mint-nft-btn">
                  <Sparkles className="w-4 h-4 mr-1" /> Mint Passport NFT
                </Button>
              )}
              {packet.needs_reseal && (
                <Button onClick={() => onReseal(packet.id)} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="acn-reseal-btn">
                  <RefreshCw className="w-4 h-4 mr-1" /> Re-seal
                </Button>
              )}
              <Button onClick={() => navigate(`/acn/verify/${packet.id}`)} className="bg-coral-500 hover:bg-coral-600" data-testid="acn-passport-btn">
                <ExternalLink className="w-4 h-4 mr-1" /> Open Passport
              </Button>
            </div>
          </div>

          {/* NFT card */}
          {packet.nft && (
            <div className="bg-gradient-to-r from-cyan-50 to-indigo-50 border border-cyan-200 rounded-lg p-3 mb-4 flex items-center gap-3" data-testid="acn-nft-card">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-navy-900 flex items-center gap-2">
                  Passport NFT
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold border border-cyan-300 text-cyan-700 bg-white/60">
                    {packet.nft.mode}
                  </span>
                </p>
                <p className="text-[11px] font-mono text-slate-600 truncate">{packet.nft.token_id} · serial #{packet.nft.serial_number}</p>
                <p className="text-[10px] font-mono text-slate-400 truncate">{packet.nft.metadata_uri}</p>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(`${packet.nft.token_id}/${packet.nft.serial_number}`); toast.success('Copied'); }} className="text-slate-500 hover:text-navy-900">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="bg-cream-100 rounded-md p-3 mb-4 flex items-center gap-2 text-xs">
            <Languages className="w-4 h-4 text-coral-600 flex-shrink-0" />
            <span className="text-slate-500">Public verifier URL:</span>
            <code className="font-mono text-navy-900 truncate flex-1">{verifyUrl}</code>
            <button onClick={() => { navigator.clipboard?.writeText(verifyUrl); toast.success('Copied'); }} className="text-slate-500 hover:text-navy-900">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <h3 className="text-sm font-bold text-navy-900 mb-2">Proofs ({(packet.proofs || []).length})</h3>
          <div className="space-y-2" data-testid="acn-proofs-list">
            {(packet.proofs || []).map(proof => (
              <div key={proof.id} className="border border-slate-200 rounded-md p-3 flex items-start gap-3 hover:bg-slate-50">
                <div className={`w-1 h-12 rounded-full ${proof.hcs?.submitted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900 text-sm">{proof.jurisdiction_name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{proof.jurisdiction_code}</span>
                    {proof.hcs?.submitted ? (
                      <span className="text-[9px] text-emerald-700 flex items-center gap-1 font-bold uppercase tracking-wider"><Anchor className="w-2.5 h-2.5" /> HCS sealed</span>
                    ) : (
                      <span className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">HCS pending</span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">cert sha256: {proof.certificate_sha256}</p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">rule version: {proof.rule_version_hash?.slice(0, 24)}…</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadCert(packet.id, proof.jurisdiction_code)} data-testid={`acn-download-${proof.jurisdiction_code}`}>
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
              </div>
            ))}
            {(packet.proofs || []).length === 0 && (
              <p className="text-center py-6 text-slate-500 text-sm">No proofs yet — analyze + seal first.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UpdatesView({ updates, jurisdictions, onRefresh }) {
  const [code, setCode] = useState('US-TX');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const post = async () => {
    if (!summary.trim()) { toast.warning('Describe the rule change first.'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/rule-updates`,
        { jurisdiction_code: code, change_summary: summary },
        { headers: authHeaders() });
      toast.success(`Recorded — ${res.data.affected_packet_ids?.length || 0} packet(s) flagged for re-seal`);
      setSummary('');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to record rule update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-coral-600" /> Record a rule change (admin)
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Jurisdiction</label>
              <select value={code} onChange={e => setCode(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" data-testid="acn-update-jur">
                {jurisdictions.map(j => <option key={j.code} value={j.code}>{j.code} — {j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Change summary</label>
              <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
                placeholder="e.g. Texas updated RON jurat language; effective March 1, 2026"
                className="w-full p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
                data-testid="acn-update-summary" />
            </div>
            <Button onClick={post} disabled={submitting} className="bg-navy-900 hover:bg-navy-800" data-testid="acn-update-submit">
              {submitting ? 'Recording…' : 'Record + flag affected packets'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-coral-600" /> Recent rule changes
          </h3>
          {updates.length === 0 ? (
            <p className="text-center py-6 text-slate-500 text-sm">No rule changes recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {updates.map(u => (
                <div key={u.id} className="border border-slate-200 rounded-md p-3" data-testid="acn-update-row">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">{u.jurisdiction_code}</span>
                    <span className="text-xs text-slate-500">eff. {u.effective_date}</span>
                    <span className="text-[10px] text-coral-700 ml-auto font-bold">{u.affected_packet_ids?.length || 0} affected</span>
                  </div>
                  <p className="text-sm text-navy-900">{u.change_summary}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">rule v: {u.new_rule_version_hash?.slice(0, 24)}…</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JurisdictionsView({ jurisdictions }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="acn-jurisdictions-grid">
      {jurisdictions.map(j => (
        <Card key={j.code} className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe2 className="w-4 h-4 text-coral-600" />
              <h4 className="font-bold text-navy-900">{j.name}</h4>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 ml-auto">{j.code}</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>Witnesses: <b>{j.ron_rules.witnesses_required}</b></li>
              <li>Recording: <b>{j.ron_rules.recording_required ? 'required' : 'optional'}</b></li>
              <li>Effective: {j.effective_date}</li>
              <li className="font-mono text-[10px] text-slate-400 truncate">v: {j.rule_version_hash?.slice(0, 24)}…</li>
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
