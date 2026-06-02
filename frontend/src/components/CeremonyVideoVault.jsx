/**
 * CeremonyVideoVault — chunked multipart upload of a RON recording to S3, with a
 * live progress bar, then polls until the SHA-256 is anchored on Hedera. Lists the
 * user's anchored recordings with a shareable public verify link + secure playback.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Video, UploadCloud, Loader2, ShieldCheck, Clock, Copy, ExternalLink,
  Link2, PlayCircle, Anchor, Inbox, X, FileVideo, Lock,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { toast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB — safely under the proxy limit
const HASH_MAX_BYTES = 600 * 1024 * 1024; // skip client hashing above ~600MB

const fmtBytes = (b) => {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(1)} ${u[i]}`;
};
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || '—'; } };

const STATUS_BADGE = {
  anchored: ['Anchored', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  anchoring: ['Anchoring…', 'text-navy-700 bg-slate-100 border-slate-200'],
  assembling: ['Assembling…', 'text-navy-700 bg-slate-100 border-slate-200'],
  anchor_failed: ['Recorded', 'text-amber-700 bg-amber-50 border-amber-200'],
  uploading: ['Uploading…', 'text-navy-700 bg-slate-100 border-slate-200'],
  failed: ['Failed', 'text-rose-700 bg-rose-50 border-rose-200'],
  aborted: ['Aborted', 'text-slate-600 bg-slate-100 border-slate-200'],
};

async function computeSha256(file) {
  if (file.size > HASH_MAX_BYTES || !window.crypto?.subtle) return null;
  const buf = await file.arrayBuffer();
  const digest = await window.crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readDuration(file) {
  return new Promise((resolve) => {
    try {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () => { resolve(Number.isFinite(el.duration) ? el.duration : null); URL.revokeObjectURL(el.src); };
      el.onerror = () => resolve(null);
      el.src = URL.createObjectURL(file);
    } catch { resolve(null); }
  });
}

export default function CeremonyVideoVault() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [refId, setRefId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [selected, setSelected] = useState(null);
  const fileInputRef = useRef(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ceremony-videos/mine`);
      setVideos(res.data.videos || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const pollUntilAnchored = useCallback(async (videoId, attempts = 0) => {
    if (attempts > 40) { fetchVideos(); return; }
    try {
      const res = await axios.get(`${API}/ceremony-videos/${videoId}`);
      const st = res.data.status;
      if (['anchored', 'failed', 'anchor_failed'].includes(st)) {
        fetchVideos();
        if (st === 'anchored') toast({ title: 'Recording anchored', description: 'Hash sealed on Hedera.' });
        return;
      }
      setTimeout(() => pollUntilAnchored(videoId, attempts + 1), 2500);
    } catch { fetchVideos(); }
  }, [fetchVideos]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setProgress(0); setPhase('Preparing…');
    try {
      setPhase('Hashing…');
      const [clientHash, duration] = await Promise.all([computeSha256(file), readDuration(file)]);

      setPhase('Initializing…');
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const initRes = await axios.post(`${API}/ceremony-videos/init`, {
        file_name: file.name,
        content_type: file.type || 'video/mp4',
        total_size: file.size,
        total_parts: totalParts,
        duration_sec: duration,
        client_sha256: clientHash,
        notary_request_id: refId.trim() || null,
      });
      const videoId = initRes.data.video_id;

      setPhase('Uploading…');
      let part = 1;
      for (let start = 0; start < file.size; start += CHUNK_SIZE) {
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const fd = new FormData();
        fd.append('file', chunk, file.name);
        await axios.post(`${API}/ceremony-videos/${videoId}/part?part_number=${part}`, fd);
        setProgress(Math.round((part / totalParts) * 100));
        part += 1;
      }

      setPhase('Finalizing…');
      await axios.post(`${API}/ceremony-videos/${videoId}/complete`, {});
      toast({ title: 'Upload complete', description: 'Anchoring the recording on-chain…' });
      setFile(null); setRefId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      pollUntilAnchored(videoId);
      fetchVideos();
    } catch (e) {
      toast({ title: 'Upload failed', description: e.response?.data?.detail || 'Please try again', variant: 'destructive' });
    } finally {
      setUploading(false); setProgress(0); setPhase('');
    }
  };

  const copy = (text, label = 'Copied') => { navigator.clipboard?.writeText(text); toast({ title: label }); };
  const verifyUrl = (hash) => `${window.location.origin}/verify/recording/${hash}`;

  const openPlayback = async (videoId) => {
    try {
      const res = await axios.get(`${API}/ceremony-videos/${videoId}/playback`);
      window.open(res.data.url, '_blank', 'noopener');
    } catch { toast({ title: 'Playback unavailable', variant: 'destructive' }); }
  };

  return (
    <div data-testid="ceremony-video-vault">
      {/* Upload card */}
      <Card className="bg-white border-slate-200 mb-8">
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2 mb-1">
            <UploadCloud className="w-5 h-5 text-coral-500" /> Upload a Ceremony Recording
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            The video is stored securely on AWS S3; only its SHA-256 fingerprint is sealed on Hedera — tamper-evident, privacy-preserving.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Recording file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-navy-900 file:text-white file:text-sm hover:file:bg-navy-800 file:cursor-pointer"
                data-testid="vault-file-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Ceremony / notarization ID (optional)</label>
              <Input
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                placeholder="Link to a notarization request"
                disabled={uploading}
                data-testid="vault-ref-input"
              />
            </div>
          </div>

          {file && !uploading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <FileVideo className="w-4 h-4 text-coral-500" /> {file.name} · {fmtBytes(file.size)}
            </div>
          )}

          {uploading && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {phase}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-5 bg-coral-500 hover:bg-coral-600 text-white"
            data-testid="vault-upload-btn"
          >
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : <><UploadCloud className="w-4 h-4 mr-2" /> Upload & Anchor</>}
          </Button>
        </CardContent>
      </Card>

      {/* Recordings list */}
      <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
        <Video className="w-4 h-4 text-coral-500" /> My Recordings
      </h3>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-coral-500" /></div>
      ) : videos.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-10 text-center">
            <Inbox className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-navy-900 font-semibold text-sm">No recordings yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload a ceremony recording to anchor its integrity proof.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="vault-recordings-list">
          {videos.map((v) => {
            const [label, cls] = STATUS_BADGE[v.status] || ['—', 'text-slate-600 bg-slate-100 border-slate-200'];
            return (
              <Card key={v.id} onClick={() => setSelected(v)}
                className="bg-white border-slate-200 hover:border-coral-300 hover:shadow-md transition-all cursor-pointer"
                data-testid={`vault-row-${v.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-coral-500/12 flex items-center justify-center flex-shrink-0">
                    <FileVideo className="w-5 h-5 text-coral-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy-900 text-sm truncate">{v.file_name}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(v.anchored_at || v.created_at)}</span>
                      {v.byte_size ? <span>· {fmtBytes(v.byte_size)}</span> : null}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4" data-testid="vault-detail-modal">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 max-h-[88vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-900">{selected.file_name}</h3>
                <p className="text-xs text-slate-500">{selected.status === 'anchored' ? 'Sealed on Hedera' : `Status: ${selected.status}`} · {fmtDate(selected.anchored_at || selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-navy-900"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['Document hash (SHA-256)', selected.sha256],
                ['Transaction ID', selected.transaction_id],
                ['HCS topic', selected.topic_id],
                ['Duration', selected.duration_sec ? `${Math.round(selected.duration_sec)}s` : '—'],
              ].map(([k, val]) => (
                <div key={k} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">{k}</p>
                  <button onClick={() => val && copy(val)} className="font-mono text-xs text-navy-800 truncate w-full text-left flex items-center gap-1 hover:text-coral-600" title={val || ''}>
                    <span className="truncate">{val || '—'}</span>{val && <Copy className="w-3 h-3 flex-shrink-0" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${selected.hcs_submitted ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                <Anchor className="w-3 h-3" /> {selected.hcs_submitted ? 'On-chain (HCS)' : 'Sealed record'}
              </span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${selected.lock_applied ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                <Lock className="w-3 h-3" /> {selected.lock_applied ? 'WORM lock' : 'No WORM lock'}
              </span>
            </div>

            {selected.sha256 && (
              <div className="rounded-lg border border-coral-200 bg-coral-50/60 p-3">
                <p className="text-xs font-semibold text-navy-800 flex items-center gap-1 mb-1.5"><Link2 className="w-3.5 h-3.5 text-coral-500" /> Shareable public verify link</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={verifyUrl(selected.sha256)} className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-600" data-testid="vault-verify-link" />
                  <Button size="sm" onClick={() => copy(verifyUrl(selected.sha256), 'Verify link copied')} className="bg-coral-500 hover:bg-coral-600 text-white"><Copy className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openPlayback(selected.id)} variant="outline" className="flex-1 border-slate-300" data-testid="vault-play-btn">
                <PlayCircle className="w-4 h-4 mr-2" /> Secure Playback
              </Button>
              {selected.explorer_url && (
                <a href={selected.explorer_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full border-slate-300"><ExternalLink className="w-4 h-4 mr-2" /> HashScan</Button>
                </a>
              )}
              {selected.sha256 && (
                <Button onClick={() => navigate(`/verify/recording/${selected.sha256}`)} className="flex-1 bg-navy-900 hover:bg-navy-800 text-white" data-testid="vault-open-verify">
                  <ShieldCheck className="w-4 h-4 mr-2" /> Verify page
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
