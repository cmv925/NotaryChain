import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Video, Upload, Loader2, CheckCircle, AlertCircle,
  Play, Square, RotateCcw, Shield, Clock, FileText, Eye, ArrowLeft,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VideoWitness = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [instructions, setInstructions] = useState([]);
  const [selectedType, setSelectedType] = useState('standard');
  const [requestId, setRequestId] = useState('');
  const [requests, setRequests] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [view, setView] = useState('select'); // 'select' | 'record' | 'history'

  // Recording state
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [stream, setStream] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [instrRes, reqRes, recRes] = await Promise.all([
        axios.get(`${API}/video-witness/instructions`, { headers }),
        axios.get(`${API}/notary/requests/my`, { headers }),
        axios.get(`${API}/video-witness/my`, { headers }),
      ]);
      setInstructions(instrRes.data.instructions || []);
      setRequests((reqRes.data || []).filter(r => r.status !== 'cancelled'));
      setRecordings(recRes.data.recordings || []);
    } catch {}
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      setHasCamera(true);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      toast({ title: 'Camera Error', description: 'Unable to access camera. Please grant permission.', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setHasCamera(false);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setRecording(true);
    setRecordedBlob(null);
    setRecordedUrl(null);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const retakeRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  };

  const uploadRecording = async () => {
    if (!recordedBlob || !requestId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', recordedBlob, `witness_${Date.now()}.webm`);
      formData.append('request_id', requestId);
      formData.append('instruction_type', selectedType);
      await axios.post(`${API}/video-witness/upload`, formData, { headers });
      setUploadSuccess(true);
      stopCamera();
      fetchData();
      toast({ title: 'Uploaded', description: 'Witness video submitted for review' });
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  useEffect(() => { return () => { stopCamera(); }; }, []);

  const currentInstr = instructions.find(i => i.id === selectedType);

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Video Witness' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Video className="w-7 h-7 text-rose-400" />
                Video Witness Recording
              </h1>
              <p className="text-slate-500 text-sm mt-1">Record identity verification video for your notarization</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setView(view === 'history' ? 'select' : 'history'); }} variant="outline" className="border-slate-200 text-slate-500" data-testid="toggle-history">
                {view === 'history' ? <Video className="w-4 h-4 mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
                {view === 'history' ? 'Record' : 'History'}
              </Button>
            </div>
          </div>

          {uploadSuccess ? (
            <Card className="bg-white border-green-500/30" data-testid="upload-success">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-navy-900 mb-2">Video Submitted!</h2>
                <p className="text-slate-500 mb-6">Your witness recording has been uploaded. The notary will review it.</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => { setUploadSuccess(false); setView('select'); setRecordedBlob(null); setRecordedUrl(null); }} className="bg-blue-600 hover:bg-blue-700">Record Another</Button>
                  <Button onClick={() => navigate('/dashboard')} variant="outline" className="border-slate-200 text-slate-500">Dashboard</Button>
                </div>
              </CardContent>
            </Card>
          ) : view === 'history' ? (
            <div className="space-y-3" data-testid="recording-history">
              {recordings.length === 0 ? (
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-8 text-center">
                    <Video className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">No recordings yet.</p>
                  </CardContent>
                </Card>
              ) : recordings.map(rec => (
                <Card key={rec.id} className="bg-white border-slate-200" data-testid={`recording-${rec.id}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Video className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-navy-900 text-sm font-medium">{rec.instruction_type} verification</p>
                      <p className="text-slate-500 text-xs">{new Date(rec.created_at).toLocaleString()} &middot; {(rec.file_size / 1024 / 1024).toFixed(1)}MB</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      rec.status === 'approved' ? 'bg-green-500/15 text-green-400' :
                      rec.status === 'rejected' ? 'bg-red-500/15 text-red-400' :
                      rec.status === 'under_review' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-coral-500/15 text-coral-600'
                    }`}>{rec.status}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : view === 'select' ? (
            <div className="space-y-4">
              {/* Select Request */}
              <Card className="bg-white border-slate-200" data-testid="select-request">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-navy-900 mb-3">1. Select Notarization Request</h2>
                  <select
                    value={requestId}
                    onChange={e => setRequestId(e.target.value)}
                    className="w-full bg-cream-100 border border-slate-200 rounded-md px-3 py-2 text-navy-900 text-sm"
                    data-testid="request-select"
                  >
                    <option value="">Choose a request...</option>
                    {requests.map(r => (
                      <option key={r.id} value={r.id}>{r.document_name} ({r.status})</option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {/* Select Verification Type */}
              <Card className="bg-white border-slate-200" data-testid="select-type">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-navy-900 mb-3">2. Verification Type</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {instructions.map(instr => (
                      <button
                        key={instr.id}
                        onClick={() => setSelectedType(instr.id)}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          selectedType === instr.id ? 'bg-rose-600/15 border-rose-500/50' : 'bg-cream-100 border-slate-200 hover:border-slate-200'
                        }`}
                        data-testid={`type-${instr.id}`}
                      >
                        <h3 className="text-navy-900 font-medium text-sm">{instr.title}</h3>
                        <p className="text-slate-500 text-xs mt-1">{instr.steps.length} steps &middot; ~{instr.duration_seconds}s</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => { if (!requestId) { toast({ title: 'Select a request first', variant: 'destructive' }); return; } setView('record'); startCamera(); }}
                disabled={!requestId}
                className="w-full bg-rose-600 hover:bg-rose-700 py-6 text-lg"
                data-testid="start-recording-btn"
              >
                <Video className="w-5 h-5 mr-2" /> Start Recording
              </Button>
            </div>
          ) : (
            /* Recording View */
            <div className="space-y-4">
              {/* Instructions */}
              {currentInstr && (
                <Card className="bg-white border-slate-200" data-testid="recording-instructions">
                  <CardContent className="p-4">
                    <h3 className="text-navy-900 font-semibold text-sm mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-rose-400" /> Instructions
                    </h3>
                    <ol className="space-y-1">
                      {currentInstr.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                          <span className="text-rose-400 font-bold text-xs mt-0.5">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {/* Video Preview */}
              <Card className="bg-white border-slate-200" data-testid="video-preview">
                <CardContent className="p-4">
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-3">
                    {recordedUrl ? (
                      <video src={recordedUrl} controls className="w-full h-full object-cover" data-testid="recorded-video" />
                    ) : (
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" data-testid="camera-preview" />
                    )}
                    {recording && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 px-2.5 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-navy-900 text-xs font-medium">Recording</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-center">
                    {!recording && !recordedBlob && hasCamera && (
                      <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700" data-testid="rec-start-btn">
                        <Play className="w-4 h-4 mr-1" /> Start
                      </Button>
                    )}
                    {recording && (
                      <Button onClick={stopRecording} className="bg-gray-600 hover:bg-gray-700" data-testid="rec-stop-btn">
                        <Square className="w-4 h-4 mr-1" /> Stop
                      </Button>
                    )}
                    {recordedBlob && (
                      <>
                        <Button onClick={retakeRecording} variant="outline" className="border-slate-200 text-slate-500" data-testid="rec-retake-btn">
                          <RotateCcw className="w-4 h-4 mr-1" /> Retake
                        </Button>
                        <Button onClick={uploadRecording} disabled={uploading} className="bg-green-600 hover:bg-green-700" data-testid="rec-upload-btn">
                          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                          Submit
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => { stopCamera(); setView('select'); setRecordedBlob(null); setRecordedUrl(null); }} variant="ghost" className="text-slate-500">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VideoWitness;
