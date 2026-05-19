import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { PDFPreview } from '../components/PDFPreview';
import { StepProgressBar, DocumentAnalysisStep, BiometricStep, SubmissionStep } from '../components/notarization';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RequestNotarization = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const templateData = location.state;

  // Step management: 1=upload & analyze, 2=biometric verification, 3=form submission
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);

  // Biometric verification state
  const [verificationResult, setVerificationResult] = useState(null);

  // Form state — pre-fill from template if navigated from TemplateLibrary
  const [formData, setFormData] = useState(() => {
    const base = {
      document_name: '',
      document_type: 'general',
      notarization_type: 'ron',
      state_code: 'FL',
      scheduled_time: '',
      signers: [{ name: '', email: '' }],
      notes: '',
    };
    if (templateData?.fromTemplate) {
      base.document_name = templateData.templateName || '';
      base.document_type = templateData.documentType || 'general';
      // Pre-fill signers slots based on template
      const needed = templateData.signersNeeded || 1;
      base.signers = Array.from({ length: needed }, () => ({ name: '', email: '' }));
    }
    return base;
  });
  const [loading, setLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // --- File Handlers ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid File Type', description: 'Please upload a PDF, image (JPG, PNG), or text file.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Please upload a file smaller than 10MB.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setAnalysisResult(null);
    setAnalysisId(null);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setShowPdfPreview(false);
  };

  // --- AI Analysis ---
  const handleAnalyzeDocument = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('document_type', formData.document_type);
    fd.append('session_id', sessionId);

    try {
      const response = await axios.post(`${API}/ai/analyze-document`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setAnalysisResult(response.data.analysis);
      setAnalysisId(response.data.analysis_id);
      if (!formData.document_name) {
        setFormData(prev => ({ ...prev, document_name: selectedFile.name.replace(/\.[^/.]+$/, '') }));
      }
      toast({ title: 'Analysis Complete', description: 'Document has been analyzed successfully.' });
    } catch (error) {
      toast({ title: 'Analysis Failed', description: error.response?.data?.detail || 'Failed to analyze document', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // --- Biometric Verification ---
  const handleBiometricComplete = async (result) => {
    try {
      const vfd = new FormData();
      vfd.append('verification_type', 'facial_tensorflow');
      vfd.append('session_id', sessionId);
      vfd.append('confidence_score', result.confidence.toString());
      vfd.append('liveness_score', (result.livenessScore / 100).toString());
      vfd.append('challenges_passed', result.challengesPassed.toString());

      await axios.post(`${API}/ai/verify-biometric`, vfd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      setVerificationResult({ status: result.status, confidence: result.confidence, livenessScore: result.livenessScore });

      if (result.status === 'passed') {
        toast({ title: 'Identity Verified!', description: `Biometric verification successful (${Math.round(result.confidence * 100)}% confidence)` });
      } else {
        toast({ title: 'Verification Failed', description: 'Please try again with better lighting and face positioning.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Verification Error', description: error.response?.data?.detail || 'Failed to save verification', variant: 'destructive' });
    }
  };

  // --- Form Handlers ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignerChange = (index, field, value) => {
    const newSigners = [...formData.signers];
    newSigners[index][field] = value;
    setFormData({ ...formData, signers: newSigners });
  };

  const addSigner = () => {
    setFormData({ ...formData, signers: [...formData.signers, { name: '', email: '' }] });
  };

  const removeSigner = (index) => {
    setFormData({ ...formData, signers: formData.signers.filter((_, i) => i !== index) });
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/notary/requests`,
        { ...formData, session_id: sessionId, analysis_id: analysisId, biometric_verified: verificationResult?.status === 'passed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const requestId = response.data.id;

      // Seal document on blockchain
      if (selectedFile) {
        try {
          const buffer = await selectedFile.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const documentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

          const sealResponse = await axios.post(
            `${API}/blockchain/seal`,
            {
              document_name: formData.document_name || selectedFile.name,
              document_hash: documentHash,
              notary_request_id: requestId,
              metadata: { document_type: formData.document_type, notarization_type: formData.notarization_type, analysis_id: analysisId, session_id: sessionId },
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const seal = sealResponse.data.seal;
          toast({ title: 'Document Sealed on Blockchain!', description: `Transaction: ${seal.transaction_id.substring(0, 20)}...` });
        } catch (sealError) {
          console.error('Blockchain seal failed:', sealError);
          toast({ title: 'Request Submitted', description: 'Blockchain seal pending - will be processed shortly.' });
        }
      }

      toast({ title: 'Request Submitted!', description: 'A notary will be assigned to your request soon.' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to submit request', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // --- Derived state ---
  const canProceedToStep2 = analysisResult && (analysisResult.status === 'verified' || analysisResult.status === 'needs_review');

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-32 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Request Notarization' }]} />
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-navy-900 mb-2 sm:mb-4">
              Request Notarization
            </h1>
            <p className="text-gray-400 text-sm sm:text-lg">
              AI-powered document analysis with biometric verification
            </p>
          </div>

          <StepProgressBar currentStep={currentStep} />

          {currentStep === 1 && (
            <DocumentAnalysisStep
              formData={formData}
              selectedFile={selectedFile}
              uploading={uploading}
              analysisResult={analysisResult}
              canProceedToStep2={canProceedToStep2}
              templateData={templateData}
              onFileSelect={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              onDocTypeChange={handleChange}
              onAnalyze={handleAnalyzeDocument}
              onShowPdfPreview={() => setShowPdfPreview(true)}
              onProceedToStep2={() => setCurrentStep(2)}
              onBrowseTemplates={() => navigate('/templates')}
            />
          )}

          {currentStep === 2 && (
            <BiometricStep
              verificationResult={verificationResult}
              onBiometricComplete={handleBiometricComplete}
              onRetry={() => setVerificationResult(null)}
              onBack={() => setCurrentStep(1)}
              onProceedToStep3={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 3 && (
            <SubmissionStep
              formData={formData}
              selectedFile={selectedFile}
              analysisResult={analysisResult}
              verificationResult={verificationResult}
              loading={loading}
              onBack={() => setCurrentStep(2)}
              onSubmit={handleSubmit}
              onChange={handleChange}
              onSignerChange={handleSignerChange}
              onAddSigner={addSigner}
              onRemoveSigner={removeSigner}
            />
          )}
        </div>
      </div>
      <Footer />
      {showPdfPreview && selectedFile && selectedFile.type === 'application/pdf' && (
        <PDFPreview
          fileUrl={URL.createObjectURL(selectedFile)}
          fileName={selectedFile.name}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
};

export default RequestNotarization;
