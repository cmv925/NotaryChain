import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Upload, FileText, Shield, CheckCircle2, Download, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';

const QuickSealDemo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [processing, setProcessing] = useState(false);
  const [hash, setHash] = useState('');
  const [txId, setTxId] = useState('');
  const [timestamp, setTimestamp] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      setFileSize((file.size / 1024).toFixed(2) + ' KB');
      setStep(2);
      setTimeout(() => { processDocument(); }, 1000);
    }
  };

  const processDocument = () => {
    setProcessing(true);
    setStep(2);
    setTimeout(() => {
      const mockHash = '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setHash(mockHash);
      setStep(3);
      setTimeout(() => {
        const mockTxId = '0.0.' + Math.floor(Math.random() * 1000000) + '@' + Date.now();
        setTxId(mockTxId);
        setTimestamp(new Date().toISOString());
        setStep(4);
        setProcessing(false);
        toast({ title: 'Success!', description: 'Document sealed on blockchain' });
      }, 2000);
    }, 1000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Hash copied to clipboard' });
  };

  const reset = () => {
    setStep(1); setFileName(''); setFileSize(''); setHash(''); setTxId(''); setTimestamp(''); setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Quick Seal' }]} />
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-coral-50 rounded-full border border-coral-200 mb-4">
              <Shield className="w-4 h-4 text-coral-600" />
              <span className="text-coral-700 font-semibold text-sm">Live Demo</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-900 mb-4">
              Try Quick Seal™ for Free
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Upload any document and get an instant blockchain timestamp. No account required.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-12">
            <div className="flex items-center justify-center gap-4">
              {[1, 2, 3, 4].map((num) => (
                <React.Fragment key={num}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                        step >= num
                          ? 'bg-coral-500 text-white shadow-md shadow-coral-500/30'
                          : 'bg-cream-300 text-slate-500'
                      }`}
                    >
                      {step > num ? <CheckCircle2 className="w-6 h-6" /> : num}
                    </div>
                    <span className="text-xs text-slate-500 mt-2 font-semibold">
                      {num === 1 && 'Upload'}
                      {num === 2 && 'Hash'}
                      {num === 3 && 'Seal'}
                      {num === 4 && 'Complete'}
                    </span>
                  </div>
                  {num < 4 && (
                    <div
                      className={`h-0.5 w-16 transition-all ${
                        step > num ? 'bg-coral-500' : 'bg-cream-300'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Main Card */}
          <Card className="bg-white border border-slate-200">
            <CardContent className="p-8">
              {/* Step 1: Upload */}
              {step === 1 && (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-coral-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-coral-200">
                    <Upload className="w-12 h-12 text-coral-500" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-navy-900 mb-4">Upload Your Document</h2>
                  <p className="text-slate-500 mb-8">
                    Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB)
                  </p>
                  <label className="cursor-pointer" data-testid="qs-upload-label">
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                      data-testid="qs-file-input"
                    />
                    <div className="inline-flex items-center gap-2 bg-coral-500 hover:bg-coral-600 text-white px-8 py-4 rounded-lg font-semibold transition-all shadow-lg shadow-coral-500/30">
                      <Upload className="w-5 h-5" />
                      Choose File
                    </div>
                  </label>
                  <p className="text-slate-500 text-sm mt-6">
                    Or drag and drop your file here
                  </p>
                </div>
              )}

              {/* Step 2-3: Processing */}
              {(step === 2 || step === 3) && processing && (
                <div className="py-12">
                  <div className="flex items-start gap-6 mb-8">
                    <FileText className="w-12 h-12 text-coral-500 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-navy-900 mb-2">{fileName}</h3>
                      <p className="text-slate-500 text-sm">{fileSize}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div
                      className={`bg-cream-100 rounded-lg p-4 border transition-all ${
                        step >= 2 ? 'border-coral-300' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-navy-900 font-semibold">Generating SHA-256 Hash...</span>
                        {step > 2 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-coral-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`bg-cream-100 rounded-lg p-4 border transition-all ${
                        step >= 3 ? 'border-coral-300' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-navy-900 font-semibold">Recording on Hedera Blockchain...</span>
                        {step > 3 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-coral-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Complete */}
              {step === 4 && !processing && (
                <div className="py-8">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-navy-900 mb-2">Document Sealed Successfully!</h2>
                    <p className="text-slate-500">Your document is now secured on the blockchain</p>
                  </div>

                  {/* Document Info */}
                  <div className="bg-cream-100 rounded-lg p-6 mb-6 border border-slate-200">
                    <div className="flex items-center gap-4 mb-4">
                      <FileText className="w-10 h-10 text-coral-500" />
                      <div>
                        <h3 className="text-navy-900 font-semibold">{fileName}</h3>
                        <p className="text-slate-500 text-sm">{fileSize}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">SHA-256 Hash</label>
                        <div className="flex items-center gap-2 bg-white rounded p-3 border border-slate-200">
                          <code className="text-navy-900 text-xs flex-1 overflow-hidden overflow-ellipsis font-mono">
                            {hash}
                          </code>
                          <button
                            onClick={() => copyToClipboard(hash)}
                            className="text-slate-500 hover:text-coral-600 transition-colors"
                            data-testid="qs-copy-hash"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Transaction ID</label>
                        <div className="flex items-center gap-2 bg-white rounded p-3 border border-slate-200">
                          <code className="text-emerald-700 text-sm flex-1 font-mono">{txId}</code>
                          <a
                            href={`https://hashscan.io/mainnet/transaction/${txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-coral-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Timestamp</label>
                        <div className="bg-white rounded p-3 border border-slate-200">
                          <code className="text-navy-700 text-sm font-mono">
                            {new Date(timestamp).toLocaleString()}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      className="flex-1 bg-coral-500 hover:bg-coral-600 text-white py-6"
                      onClick={() => window.print()}
                      data-testid="qs-download-btn"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Certificate
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-navy-900 text-navy-900 hover:bg-navy-900 hover:text-white py-6"
                      onClick={reset}
                      data-testid="qs-reset-btn"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Seal Another Document
                    </Button>
                  </div>

                  {/* Pricing CTA */}
                  <div className="mt-8 p-6 bg-navy-900 rounded-lg text-center">
                    <p className="text-cream-100 mb-3">
                      <span className="font-semibold text-white">Only $5 per seal</span>
                      <span className="text-slate-300"> • Unlimited verifications • Forever accessible</span>
                    </p>
                    <Button
                      className="bg-coral-500 hover:bg-coral-600 text-white"
                      onClick={() => navigate('/pricing')}
                      data-testid="qs-pricing-cta"
                    >
                      Get Started with Full Access
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card className="bg-white border border-slate-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg bg-coral-50 border border-coral-200 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-coral-600" />
                </div>
                <h3 className="text-navy-900 font-semibold mb-2">Permanent Proof</h3>
                <p className="text-slate-500 text-sm">
                  Immutable record on Hedera blockchain that lasts forever
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-navy-900 font-semibold mb-2">Instant Processing</h3>
                <p className="text-slate-500 text-sm">
                  Get your timestamp in under 10 seconds
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg bg-navy-50 border border-navy-200 flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-6 h-6 text-navy-700" />
                </div>
                <h3 className="text-navy-900 font-semibold mb-2">Public Verification</h3>
                <p className="text-slate-500 text-sm">
                  Anyone can verify authenticity on the blockchain
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default QuickSealDemo;
