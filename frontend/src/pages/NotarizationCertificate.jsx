import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Shield, FileText, User, UserCheck, CheckCircle2, 
  XCircle, Video, ScanFace, Brain, Link2, Download,
  Printer, ArrowLeft, ExternalLink, Copy, Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function NotarizationCertificate() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const certificateRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCertificate();
  }, [requestId]);

  const fetchCertificate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/packages/request/${requestId}/certificate`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificate(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load certificate');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyHash = async () => {
    if (certificate?.blockchain_proof?.package_hash) {
      await navigator.clipboard.writeText(certificate.blockchain_proof.package_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4aa] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="bg-[#1a1a2e] border-red-500/30 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-navy-900 mb-2">Certificate Not Available</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => navigate(-1)} variant="outline" className="border-[#333]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const verificationUrl = `${window.location.origin}/verify?hash=${certificate?.blockchain_proof?.package_hash}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-navy-900 p-4 md:p-8 print:bg-white print:text-black">
      {/* Header - Hidden in print */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <Button 
            onClick={() => navigate(-1)} 
            variant="ghost" 
            className="text-gray-400 hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} variant="outline" className="border-[#333]">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Certificate */}
      <div 
        ref={certificateRef}
        className="max-w-4xl mx-auto bg-gradient-to-br from-[#1a1a2e] to-[#0d1b2a] rounded-2xl border border-[#333] overflow-hidden print:bg-white print:border-gray-300 print:shadow-lg"
      >
        {/* Certificate Header */}
        <div className="bg-gradient-to-r from-[#00d4aa]/20 to-[#00d4aa]/5 border-b border-[#333] p-8 text-center print:bg-gray-100">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-[#00d4aa]/20 flex items-center justify-center print:bg-green-100">
              <Shield className="h-10 w-10 text-[#00d4aa] print:text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-navy-900 mb-2 print:text-black">
            Digital Notarization Certificate
          </h1>
          <p className="text-[#00d4aa] font-semibold print:text-green-600">
            Blockchain-Verified & Immutable
          </p>
          <p className="text-gray-400 text-sm mt-2 print:text-gray-600">
            Certificate ID: {certificate?.certificate_id?.slice(0, 16)}...
          </p>
        </div>

        {/* Certificate Body */}
        <div className="p-8 space-y-8">
          {/* Document Information */}
          <div>
            <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2 print:text-black">
              <FileText className="h-5 w-5 text-[#00d4aa] print:text-green-600" />
              Document Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
              <div>
                <p className="text-gray-400 text-sm print:text-gray-500">Document Name</p>
                <p className="text-navy-900 font-medium print:text-black">{certificate?.document?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm print:text-gray-500">Document Type</p>
                <p className="text-navy-900 font-medium print:text-black">{certificate?.document?.type || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm print:text-gray-500">Notarization Type</p>
                <p className="text-navy-900 font-medium print:text-black">{certificate?.document?.notarization_type || 'Standard'}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2 print:text-black">
                <User className="h-5 w-5 text-blue-500" />
                Requester
              </h2>
              <div className="bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
                <p className="text-navy-900 font-medium print:text-black">{certificate?.requester?.name || 'N/A'}</p>
                <p className="text-gray-400 text-sm print:text-gray-600">{certificate?.requester?.email}</p>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2 print:text-black">
                <UserCheck className="h-5 w-5 text-green-500" />
                Notary Public
              </h2>
              <div className="bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
                <p className="text-navy-900 font-medium print:text-black">{certificate?.notary?.name || 'N/A'}</p>
                <p className="text-gray-400 text-sm print:text-gray-600">{certificate?.notary?.email}</p>
                {certificate?.notary?.commission_number && (
                  <p className="text-gray-400 text-xs mt-1 print:text-gray-600">
                    Commission: {certificate.notary.commission_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Verification Summary */}
          <div>
            <h2 className="text-lg font-bold text-navy-900 mb-4 print:text-black">Verification Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* AI Analysis */}
              <div className="bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    certificate?.verifications?.document_analysis?.performed 
                      ? 'bg-purple-500/20' 
                      : 'bg-gray-500/20'
                  }`}>
                    <Brain className={`h-5 w-5 ${
                      certificate?.verifications?.document_analysis?.performed 
                        ? 'text-purple-500' 
                        : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-navy-900 font-medium print:text-black">AI Analysis</p>
                    <p className="text-gray-400 text-xs print:text-gray-600">Document Verification</p>
                  </div>
                </div>
                <Badge className={`${
                  certificate?.verifications?.document_analysis?.performed 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {certificate?.verifications?.document_analysis?.performed 
                    ? `${certificate?.verifications?.document_analysis?.count} Analyses` 
                    : 'Not Performed'}
                </Badge>
              </div>

              {/* Biometric */}
              <div className="bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    certificate?.verifications?.biometric?.completed 
                      ? 'bg-green-500/20' 
                      : 'bg-gray-500/20'
                  }`}>
                    <ScanFace className={`h-5 w-5 ${
                      certificate?.verifications?.biometric?.completed 
                        ? 'text-green-500' 
                        : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-navy-900 font-medium print:text-black">Biometric</p>
                    <p className="text-gray-400 text-xs print:text-gray-600">Identity Verification</p>
                  </div>
                </div>
                <Badge className={`${
                  certificate?.verifications?.biometric?.completed 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {certificate?.verifications?.biometric?.completed 
                    ? 'Verified' 
                    : 'Not Performed'}
                </Badge>
              </div>

              {/* Video Session */}
              <div className="bg-[#0d1b2a] rounded-lg p-4 print:bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    certificate?.verifications?.video_session?.completed 
                      ? 'bg-blue-500/20' 
                      : 'bg-gray-500/20'
                  }`}>
                    <Video className={`h-5 w-5 ${
                      certificate?.verifications?.video_session?.completed 
                        ? 'text-blue-500' 
                        : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-navy-900 font-medium print:text-black">Video Session</p>
                    <p className="text-gray-400 text-xs print:text-gray-600">Remote Notarization</p>
                  </div>
                </div>
                <Badge className={`${
                  certificate?.verifications?.video_session?.completed 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {certificate?.verifications?.video_session?.completed 
                    ? `${certificate?.verifications?.video_session?.count || 1} Session(s)` 
                    : 'Not Performed'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Blockchain Proof */}
          <div>
            <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2 print:text-black">
              <Link2 className="h-5 w-5 text-[#00d4aa] print:text-green-600" />
              Blockchain Proof
            </h2>
            <div className="bg-[#0d1b2a] rounded-lg p-6 print:bg-gray-50">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm print:text-gray-500">Network</p>
                    <p className="text-navy-900 font-medium print:text-black">{certificate?.blockchain_proof?.network}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm print:text-gray-500">Package Hash (SHA-256)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[#00d4aa] text-sm font-mono break-all print:text-green-600">
                        {certificate?.blockchain_proof?.package_hash}
                      </code>
                      <button 
                        onClick={copyHash}
                        className="p-1 hover:bg-[#333] rounded print:hidden"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm print:text-gray-500">HCS Topic ID</p>
                    <p className="text-navy-900 font-mono print:text-black">{certificate?.blockchain_proof?.hcs_topic_id || 'N/A'}</p>
                  </div>
                  {certificate?.blockchain_proof?.explorer_url && (
                    <a 
                      href={certificate.blockchain_proof.explorer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 print:text-blue-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on HashScan Explorer
                    </a>
                  )}
                </div>
                
                {/* QR Code */}
                <div className="flex flex-col items-center">
                  <div className="bg-white p-3 rounded-lg">
                    <QRCodeSVG 
                      value={verificationUrl}
                      size={120}
                      level="H"
                    />
                  </div>
                  <p className="text-gray-400 text-xs mt-2 text-center print:text-gray-600">Scan to verify</p>
                </div>
              </div>
            </div>
          </div>

          {/* Component Hashes */}
          <div>
            <h2 className="text-lg font-bold text-navy-900 mb-4 print:text-black">Component Integrity Hashes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {certificate?.component_hashes && Object.entries(certificate.component_hashes).map(([key, hash]) => (
                hash && (
                  <div key={key} className="bg-[#0d1b2a] rounded-lg p-3 print:bg-gray-50">
                    <p className="text-gray-400 text-xs capitalize print:text-gray-500">{key.replace(/_/g, ' ')}</p>
                    <p className="text-navy-900 text-xs font-mono truncate print:text-black" title={hash}>
                      {hash}
                    </p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Legal Statement */}
          <div className="border-t border-[#333] pt-6 print:border-gray-300">
            <p className="text-gray-400 text-sm leading-relaxed print:text-gray-600">
              {certificate?.legal_statement}
            </p>
          </div>

          {/* Issue Date */}
          <div className="text-center text-gray-400 text-sm print:text-gray-600">
            <p>Issued: {certificate?.issued_at ? new Date(certificate.issued_at).toLocaleString() : 'N/A'}</p>
            <p className="mt-2 font-semibold text-[#00d4aa] print:text-green-600">NotaryChain™ - Secure. Immutable. Trusted.</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:bg-gray-50 { background: #f9fafb !important; }
          .print\\:bg-gray-100 { background: #f3f4f6 !important; }
          .print\\:bg-green-100 { background: #dcfce7 !important; }
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-600 { color: #4b5563 !important; }
          .print\\:text-green-600 { color: #16a34a !important; }
          .print\\:text-blue-600 { color: #2563eb !important; }
          .print\\:border-gray-300 { border-color: #d1d5db !important; }
          .print\\:shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important; }
        }
      `}</style>
    </div>
  );
}
