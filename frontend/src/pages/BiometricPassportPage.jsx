import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Fingerprint, Shield, CheckCircle, XCircle,
  RefreshCw, Eye, Clock, AlertTriangle, Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const modalityLabels = { facial: 'Facial Recognition', voiceprint: 'Voiceprint', liveness: 'Liveness Detection' };

export default function BiometricPassport() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchPassports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/biometric-passport/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPassports(data.passports || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPassports(); }, [fetchPassports]);

  const generatePassport = async () => {
    if (!sessionId.trim()) return;
    setGenerating(true);
    try {
      const form = new FormData();
      form.append('session_id', sessionId);
      const res = await fetch(`${API}/api/biometric-passport/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        setSessionId('');
        fetchPassports();
      }
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  };

  const verifyPassport = async (passportId) => {
    setVerifying(passportId);
    setVerifyResult(null);
    try {
      const res = await fetch(`${API}/api/biometric-passport/verify/${passportId}`);
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      /* ignore */
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-navy-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Fingerprint className="w-6 h-6 text-coral-600" />
              Biometric Passport
            </h1>
            <p className="text-gray-400 text-sm">Multi-modal biometric identity credentials</p>
          </div>
        </div>

        {/* Generate Section */}
        <Card className="bg-[#0d1b2a] border-gray-800 mb-6">
          <CardContent className="pt-5">
            <h3 className="text-navy-900 text-sm font-semibold mb-3">Generate Passport from Session</h3>
            <p className="text-gray-500 text-xs mb-3">Enter the session ID from your biometric verification to generate a unified Biometric Passport.</p>
            <div className="flex gap-3">
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Enter biometric session ID..."
                className="flex-1 bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-sm text-navy-900"
                data-testid="session-id-input"
              />
              <Button onClick={generatePassport} disabled={generating || !sessionId.trim()} className="bg-cyan-600 hover:bg-cyan-700" data-testid="generate-passport-btn">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Verify Result */}
        {verifyResult && (
          <Card className={`mb-6 border ${verifyResult.integrity_verified ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`} data-testid="verify-result">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3 mb-3">
                {verifyResult.integrity_verified
                  ? <CheckCircle className="w-5 h-5 text-green-400" />
                  : <XCircle className="w-5 h-5 text-red-400" />}
                <div>
                  <p className="text-navy-900 font-semibold text-sm">
                    {verifyResult.integrity_verified ? 'Integrity Verified' : 'Integrity Compromised'}
                  </p>
                  <p className="text-gray-400 text-xs">Hash: {verifyResult.biometric_hash?.substring(0, 24)}...</p>
                </div>
                {verifyResult.expired && (
                  <Badge className="bg-coral-500/15 text-coral-600 ml-auto">Expired</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Score:</span> <span className="text-navy-900">{(verifyResult.composite_score * 100).toFixed(1)}%</span></div>
                <div><span className="text-gray-500">Modalities:</span> <span className="text-navy-900">{verifyResult.modalities_verified?.join(', ')}</span></div>
                <div><span className="text-gray-500">Issued:</span> <span className="text-navy-900">{verifyResult.issued_at ? new Date(verifyResult.issued_at).toLocaleDateString() : '-'}</span></div>
                <div><span className="text-gray-500">Expires:</span> <span className="text-navy-900">{verifyResult.expires_at ? new Date(verifyResult.expires_at).toLocaleDateString() : '-'}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passports List */}
        <h2 className="text-navy-900 font-semibold mb-4">My Passports</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-500 animate-spin" /></div>
        ) : passports.length === 0 ? (
          <Card className="bg-[#0d1b2a] border-gray-800">
            <CardContent className="py-12 text-center text-gray-500">
              <Fingerprint className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No biometric passports yet</p>
              <p className="text-xs mt-1">Complete a biometric verification session to generate your passport</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {passports.map((p) => (
              <Card key={p.id} className="bg-[#0d1b2a] border-gray-800" data-testid={`passport-${p.id}`}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.status === 'verified' ? 'bg-green-500/20 text-green-400' : 'bg-coral-500/20 text-coral-600'
                      }`}>
                        {Math.round(p.composite_score * 100)}%
                      </div>
                      <div>
                        <p className="text-navy-900 text-sm font-medium">Passport #{p.id.substring(0, 8)}</p>
                        <p className="text-gray-500 text-xs">Session: {p.session_id?.substring(0, 16)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={p.status === 'verified' ? 'bg-green-500/15 text-green-400' : 'bg-coral-500/15 text-coral-600'}>
                        {p.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verifyPassport(p.id)}
                        disabled={verifying === p.id}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                        data-testid={`verify-${p.id}`}
                      >
                        {verifying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
                        Verify
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {p.modalities_verified?.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                        {modalityLabels[m] || m}
                      </Badge>
                    ))}
                  </div>

                  {p.modality_details && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {Object.entries(p.modality_details).map(([key, val]) => (
                        <div key={key} className="bg-[#1a2332] rounded p-2 text-center">
                          <p className="text-gray-500 text-[10px]">{modalityLabels[key] || key}</p>
                          <p className={`text-sm font-bold ${val.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>
                            {(val.score * 100).toFixed(0)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between mt-3 text-[10px] text-gray-600">
                    <span>Issued: {p.issued_at ? new Date(p.issued_at).toLocaleDateString() : '-'}</span>
                    <span>Expires: {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
