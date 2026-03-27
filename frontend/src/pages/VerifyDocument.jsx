import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { 
  Shield, Search, CheckCircle, XCircle, FileText, 
  ExternalLink, Loader2, Upload, Hash, Clock, Link2, ArrowLeft
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VerifyDocument = () => {
  const navigate = useNavigate();
  const [verificationMethod, setVerificationMethod] = useState('hash'); // 'hash' or 'file'
  const [documentHash, setDocumentHash] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Calculate SHA-256 hash of file
  const calculateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setLoading(true);
      try {
        const hash = await calculateFileHash(file);
        setDocumentHash(hash);
        toast({
          title: 'File Hash Calculated',
          description: `SHA-256: ${hash.substring(0, 16)}...`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to calculate file hash',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerify = async () => {
    if (!documentHash) {
      toast({
        title: 'Error',
        description: 'Please enter a document hash or upload a file',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.get(`${API}/blockchain/verify/${documentHash}`);
      setResult(response.data);

      if (response.data.found) {
        toast({
          title: 'Document Found',
          description: response.data.blockchain_verified 
            ? 'This document has been verified on the blockchain.' 
            : 'Document record found but blockchain verification pending.',
        });
      } else {
        toast({
          title: 'Not Found',
          description: 'No blockchain seal found for this document.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Verification Error',
        description: error.response?.data?.detail || 'Verification failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-4" data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 mb-6">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Verify Document
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Check if a document has been notarized and sealed on the Hedera blockchain.
              Enter the document hash or upload the original file.
            </p>
          </div>

          {/* Verification Card */}
          <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800 mb-8" data-testid="verify-card">
            <CardContent className="p-8">
              {/* Method Toggle */}
              <div className="flex gap-4 mb-8">
                <Button
                  variant={verificationMethod === 'hash' ? 'default' : 'outline'}
                  onClick={() => setVerificationMethod('hash')}
                  className={verificationMethod === 'hash' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'border-gray-700 text-gray-300'}
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Enter Hash
                </Button>
                <Button
                  variant={verificationMethod === 'file' ? 'default' : 'outline'}
                  onClick={() => setVerificationMethod('file')}
                  className={verificationMethod === 'file' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'border-gray-700 text-gray-300'}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
              </div>

              {/* Hash Input */}
              {verificationMethod === 'hash' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-white mb-2 block">Document Hash (SHA-256)</Label>
                    <Input
                      value={documentHash}
                      onChange={(e) => setDocumentHash(e.target.value)}
                      placeholder="Enter 64-character SHA-256 hash..."
                      className="bg-[#0a0f1a] border-gray-700 text-white font-mono text-sm"
                      data-testid="hash-input"
                    />
                  </div>
                </div>
              )}

              {/* File Upload */}
              {verificationMethod === 'file' && (
                <div className="space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      selectedFile ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {selectedFile ? (
                      <div className="space-y-3">
                        <FileText className="w-12 h-12 mx-auto text-blue-500" />
                        <p className="text-white font-medium">{selectedFile.name}</p>
                        <p className="text-gray-400 text-sm">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <p className="text-gray-500 text-xs font-mono break-all">
                          Hash: {documentHash}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setDocumentHash('');
                          }}
                          className="border-gray-600 text-gray-300"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-300 mb-2">
                          Click to upload document
                        </p>
                        <p className="text-gray-500 text-sm">
                          We'll calculate the hash locally (file never leaves your device)
                        </p>
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="file-input"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Verify Button */}
              <Button
                onClick={handleVerify}
                disabled={loading || !documentHash}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-4"
                data-testid="verify-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Verify Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card className={`border ${
              result.found && result.blockchain_verified
                ? 'bg-green-500/5 border-green-500/30'
                : result.found
                ? 'bg-yellow-500/5 border-yellow-500/30'
                : 'bg-red-500/5 border-red-500/30'
            }`} data-testid="verification-result">
              <CardContent className="p-8">
                {/* Status Header */}
                <div className="flex items-center gap-4 mb-6">
                  {result.found && result.blockchain_verified ? (
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  ) : result.found ? (
                    <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Shield className="w-8 h-8 text-yellow-500" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                  )}
                  <div>
                    <h2 className={`text-2xl font-bold ${
                      result.found && result.blockchain_verified ? 'text-green-400' :
                      result.found ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {result.found && result.blockchain_verified
                        ? 'Document Verified'
                        : result.found
                        ? 'Document Found (Pending Verification)'
                        : 'Document Not Found'}
                    </h2>
                    <p className="text-gray-400">
                      {result.found && result.blockchain_verified
                        ? 'This document has been notarized and sealed on the Hedera blockchain.'
                        : result.found
                        ? 'Document record exists but awaiting full blockchain confirmation.'
                        : 'No notarization record found for this document hash.'}
                    </p>
                  </div>
                </div>

                {result.found && (
                  <div className="space-y-4">
                    {/* Document Info */}
                    <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Document Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Document Name:</span>
                          <p className="text-white">{result.document_name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Network:</span>
                          <p className="text-white capitalize">{result.network}</p>
                        </div>
                      </div>
                    </div>

                    {/* Blockchain Info */}
                    <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-blue-500" />
                        Blockchain Record
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-gray-500">Transaction ID:</span>
                          <p className="text-white font-mono text-xs break-all">
                            {result.transaction_id}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Document Hash:</span>
                          <p className="text-white font-mono text-xs break-all">
                            {result.document_hash}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Sealed At:
                          </span>
                          <p className="text-white">
                            {new Date(result.sealed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Explorer Link */}
                    {result.explorer_url && (
                      <a
                        href={result.explorer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 p-4 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5" />
                        View on HashScan Explorer
                      </a>
                    )}
                  </div>
                )}

                {!result.found && (
                  <div className="text-center py-4">
                    <p className="text-gray-400 mb-4">
                      This document has not been notarized through NotaryChain.
                    </p>
                    <Button
                      onClick={() => window.location.href = '/request-notarization'}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Request Notarization
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* How It Works */}
          <div className="mt-12">
            <h3 className="text-xl font-bold text-white mb-6 text-center">How Verification Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1a2332] rounded-lg p-6 border border-gray-800 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
                  <Hash className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-white font-semibold mb-2">1. Document Hash</h4>
                <p className="text-gray-400 text-sm">
                  Every document has a unique SHA-256 fingerprint that identifies it.
                </p>
              </div>
              <div className="bg-[#1a2332] rounded-lg p-6 border border-gray-800 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-white font-semibold mb-2">2. Blockchain Lookup</h4>
                <p className="text-gray-400 text-sm">
                  We search the Hedera blockchain for the matching seal record.
                </p>
              </div>
              <div className="bg-[#1a2332] rounded-lg p-6 border border-gray-800 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-white font-semibold mb-2">3. Tamper-Proof</h4>
                <p className="text-gray-400 text-sm">
                  If verified, the document hasn't been altered since notarization.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default VerifyDocument;
