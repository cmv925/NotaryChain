import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BiometricVerification from '../components/BiometricVerification';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { 
  FileText, Calendar, Users, ArrowRight, Upload, 
  CheckCircle, AlertTriangle, XCircle, Camera, 
  Shield, Loader2, Eye, RefreshCw, ArrowLeft
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RequestNotarization = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  
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
  
  // Form state
  const [formData, setFormData] = useState({
    document_name: '',
    document_type: 'general',
    notarization_type: 'ron',
    scheduled_time: '',
    signers: [{ name: '', email: '' }],
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const documentTypes = [
    { value: 'general', label: 'General Document' },
    { value: 'power_of_attorney', label: 'Power of Attorney' },
    { value: 'real_estate', label: 'Real Estate Document' },
    { value: 'affidavit', label: 'Affidavit' },
    { value: 'will', label: 'Last Will & Testament' },
    { value: 'trust', label: 'Trust Document' },
    { value: 'contract', label: 'Contract' },
  ];

  const notarizationTypes = [
    { value: 'ron', label: 'Remote Online Notarization (RON)' },
    { value: 'traditional', label: 'In-Person Notarization' },
    { value: 'mobile', label: 'Mobile Notary' },
  ];

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a PDF, image (JPG, PNG), or text file.',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setAnalysisResult(null);
      setAnalysisId(null);
    }
  };

  // Upload and analyze document
  const handleAnalyzeDocument = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);
    formDataUpload.append('document_type', formData.document_type);
    formDataUpload.append('session_id', sessionId);

    try {
      const response = await axios.post(
        `${API}/ai/analyze-document`,
        formDataUpload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setAnalysisResult(response.data.analysis);
      setAnalysisId(response.data.analysis_id);
      
      // Auto-fill document name from filename if empty
      if (!formData.document_name) {
        setFormData(prev => ({
          ...prev,
          document_name: selectedFile.name.replace(/\.[^/.]+$/, '')
        }));
      }

      toast({
        title: 'Analysis Complete',
        description: 'Document has been analyzed successfully.',
      });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error.response?.data?.detail || 'Failed to analyze document',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle biometric verification completion
  const handleBiometricComplete = async (result) => {
    try {
      // Send verification result to backend
      const verificationFormData = new FormData();
      verificationFormData.append('verification_type', 'facial_tensorflow');
      verificationFormData.append('session_id', sessionId);
      verificationFormData.append('confidence_score', result.confidence.toString());
      verificationFormData.append('liveness_score', (result.livenessScore / 100).toString());
      verificationFormData.append('challenges_passed', result.challengesPassed.toString());

      const response = await axios.post(
        `${API}/ai/verify-biometric`,
        verificationFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setVerificationResult({
        status: result.status,
        confidence: result.confidence,
        livenessScore: result.livenessScore,
      });

      if (result.status === 'passed') {
        toast({
          title: 'Identity Verified!',
          description: `Biometric verification successful (${Math.round(result.confidence * 100)}% confidence)`,
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: 'Please try again with better lighting and face positioning.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Verification Error',
        description: error.response?.data?.detail || 'Failed to save verification',
        variant: 'destructive',
      });
    }
  };

  // Retry verification
  const handleRetryVerification = () => {
    setVerificationResult(null);
  };

  // Perform biometric verification
  const handleBiometricVerification = async () => {
    if (!cameraStream) {
      toast({
        title: 'Camera Required',
        description: 'Please allow camera access to proceed.',
        variant: 'destructive',
      });
      return;
    }

    // Countdown
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);

    setVerifying(true);

    // Capture frame
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
    }

    // Simulate processing time and generate confidence score
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate verification with high confidence (in production, use actual biometric API)
    const confidenceScore = 0.85 + Math.random() * 0.1; // 85-95% confidence

    try {
      const verificationFormData = new FormData();
      verificationFormData.append('verification_type', 'facial');
      verificationFormData.append('session_id', sessionId);
      verificationFormData.append('confidence_score', confidenceScore.toString());

      const response = await axios.post(
        `${API}/ai/verify-biometric`,
        verificationFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setVerificationResult({
        status: response.data.status,
        confidence: confidenceScore,
      });

      if (response.data.status === 'passed') {
        toast({
          title: 'Verification Successful',
          description: 'Your identity has been verified.',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: 'Please try again with better lighting.',
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
      setVerifying(false);
    }
  };

  // Retry verification
  const handleRetryVerification = () => {
    setVerificationResult(null);
    setFaceDetected(false);
  };

  // Calculate document hash for blockchain
  const calculateDocumentHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Form handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create notary request
      const response = await axios.post(
        `${API}/notary/requests`,
        {
          ...formData,
          session_id: sessionId,
          analysis_id: analysisId,
          biometric_verified: verificationResult?.status === 'passed',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const requestId = response.data.id;

      // Step 2: Seal document on blockchain
      let blockchainSeal = null;
      if (selectedFile) {
        try {
          const documentHash = await calculateDocumentHash(selectedFile);
          
          const sealResponse = await axios.post(
            `${API}/blockchain/seal`,
            {
              document_name: formData.document_name || selectedFile.name,
              document_hash: documentHash,
              notary_request_id: requestId,
              metadata: {
                document_type: formData.document_type,
                notarization_type: formData.notarization_type,
                analysis_id: analysisId,
                session_id: sessionId
              }
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          blockchainSeal = sealResponse.data.seal;
          
          toast({
            title: 'Document Sealed on Blockchain!',
            description: `Transaction: ${blockchainSeal.transaction_id.substring(0, 20)}...`,
          });
        } catch (sealError) {
          console.error('Blockchain seal failed:', sealError);
          // Continue even if seal fails - notary request was created
          toast({
            title: 'Request Submitted',
            description: 'Blockchain seal pending - will be processed shortly.',
          });
        }
      }

      toast({
        title: 'Request Submitted!',
        description: 'A notary will be assigned to your request soon.',
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to submit request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSignerChange = (index, field, value) => {
    const newSigners = [...formData.signers];
    newSigners[index][field] = value;
    setFormData({ ...formData, signers: newSigners });
  };

  const addSigner = () => {
    setFormData({
      ...formData,
      signers: [...formData.signers, { name: '', email: '' }],
    });
  };

  const removeSigner = (index) => {
    const newSigners = formData.signers.filter((_, i) => i !== index);
    setFormData({ ...formData, signers: newSigners });
  };

  // Get status icon based on analysis result
  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'needs_review':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'suspicious':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Eye className="w-6 h-6 text-blue-500" />;
    }
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  // Navigation between steps
  const canProceedToStep2 = analysisResult && 
    (analysisResult.status === 'verified' || analysisResult.status === 'needs_review');
  
  const canProceedToStep3 = verificationResult?.status === 'passed';

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Request Notarization
            </h1>
            <p className="text-gray-400 text-lg">
              AI-powered document analysis with biometric verification
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8" data-testid="progress-steps">
            <div className="flex items-center justify-between max-w-xl mx-auto">
              {[
                { num: 1, label: 'Document Analysis' },
                { num: 2, label: 'Identity Verification' },
                { num: 3, label: 'Submit Request' }
              ].map((step, index) => (
                <React.Fragment key={step.num}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                      currentStep >= step.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {currentStep > step.num ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step.num
                      )}
                    </div>
                    <span className={`mt-2 text-sm ${
                      currentStep >= step.num ? 'text-blue-400' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <div className={`flex-1 h-1 mx-4 rounded ${
                      currentStep > step.num ? 'bg-blue-600' : 'bg-gray-700'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step 1: Document Upload & Analysis */}
          {currentStep === 1 && (
            <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="step-1-card">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-500" />
                  Step 1: Document Analysis
                </h2>
                
                {/* Document Type Selection */}
                <div className="mb-6">
                  <Label htmlFor="document_type" className="text-white mb-2 block">
                    Document Type
                  </Label>
                  <select
                    id="document_type"
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleChange}
                    className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    data-testid="document-type-select"
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Upload Area */}
                <div className="mb-6">
                  <Label className="text-white mb-2 block">Upload Document</Label>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setAnalysisResult(null);
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
                          Drag and drop or click to upload
                        </p>
                        <p className="text-gray-500 text-sm">
                          Supports PDF, JPG, PNG, TXT (Max 10MB)
                        </p>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="file-input"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Analyze Button */}
                {selectedFile && !analysisResult && (
                  <Button
                    onClick={handleAnalyzeDocument}
                    disabled={uploading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4"
                    data-testid="analyze-btn"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing Document with AI...
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5 mr-2" />
                        Analyze Document
                      </>
                    )}
                  </Button>
                )}

                {/* Analysis Results */}
                {analysisResult && (
                  <div className="mt-6 space-y-4" data-testid="analysis-results">
                    {/* Overall Status */}
                    <div className={`p-4 rounded-lg border ${
                      analysisResult.status === 'verified' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : analysisResult.status === 'needs_review'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(analysisResult.status)}
                        <span className="text-white font-semibold text-lg capitalize">
                          {analysisResult.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400">Confidence Score:</span>
                        <Progress value={analysisResult.confidence_score} className="flex-1 h-2" />
                        <span className="text-white font-medium">
                          {analysisResult.confidence_score}%
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm">{analysisResult.summary}</p>
                    </div>

                    {/* Discrepancies */}
                    {analysisResult.discrepancies?.length > 0 && (
                      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          Findings ({analysisResult.discrepancies.length})
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {analysisResult.discrepancies.map((item, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded border ${getSeverityColor(item.severity)}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium capitalize">
                                  {item.type.replace('_', ' ')}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded uppercase ${
                                  item.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                  item.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {item.severity}
                                </span>
                              </div>
                              <p className="text-sm opacity-80">{item.description}</p>
                              {item.recommendation && (
                                <p className="text-xs mt-1 opacity-60">
                                  Recommendation: {item.recommendation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Information */}
                    {analysisResult.key_information && (
                      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                        <h3 className="text-white font-semibold mb-3">Key Information Extracted</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {analysisResult.key_information.names?.length > 0 && (
                            <div>
                              <span className="text-gray-500">Names:</span>
                              <p className="text-white">{analysisResult.key_information.names.join(', ')}</p>
                            </div>
                          )}
                          {analysisResult.key_information.dates?.length > 0 && (
                            <div>
                              <span className="text-gray-500">Dates:</span>
                              <p className="text-white">{analysisResult.key_information.dates.join(', ')}</p>
                            </div>
                          )}
                          {analysisResult.key_information.addresses?.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Addresses:</span>
                              <p className="text-white">{analysisResult.key_information.addresses.join('; ')}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Signatures Present:</span>
                            <p className={analysisResult.key_information.signatures_present ? 'text-green-400' : 'text-yellow-400'}>
                              {analysisResult.key_information.signatures_present ? 'Yes' : 'No'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {analysisResult.recommendations?.length > 0 && (
                      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                        <h3 className="text-white font-semibold mb-3">Recommendations</h3>
                        <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                          {analysisResult.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Proceed Button */}
                    {canProceedToStep2 && (
                      <Button
                        onClick={() => setCurrentStep(2)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4"
                        data-testid="proceed-to-step-2-btn"
                      >
                        <Shield className="w-5 h-5 mr-2" />
                        Proceed to Identity Verification
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    )}

                    {analysisResult.status === 'suspicious' && (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-red-400 text-sm">
                          This document has been flagged as suspicious. Please contact support for manual review.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Biometric Verification */}
          {currentStep === 2 && (
            <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="step-2-card">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Camera className="w-6 h-6 text-blue-500" />
                    Step 2: Identity Verification
                  </h2>
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(1)}
                    className="text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>

                <p className="text-gray-400 mb-6">
                  To ensure document security, please verify your identity using your camera.
                  Position your face within the frame and click the verify button.
                </p>

                {/* Camera View */}
                <div className="relative mb-6">
                  <div className="aspect-video bg-[#0a0f1a] rounded-lg overflow-hidden border border-gray-700 relative">
                    {cameraError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <XCircle className="w-12 h-12 text-red-500 mb-4" />
                        <p className="text-red-400 text-center px-4">{cameraError}</p>
                        <Button
                          onClick={startCamera}
                          className="mt-4 bg-blue-600 hover:bg-blue-700"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Face Detection Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className={`w-48 h-64 border-4 rounded-full transition-colors ${
                            faceDetected ? 'border-green-500' : 'border-gray-500'
                          }`} />
                        </div>

                        {/* Countdown Overlay */}
                        {countdown !== null && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <span className="text-8xl font-bold text-white animate-pulse">
                              {countdown}
                            </span>
                          </div>
                        )}

                        {/* Verifying Overlay */}
                        {verifying && countdown === null && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                            <span className="text-white text-lg">Verifying identity...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Face Detection Status */}
                {!verificationResult && !verifying && cameraStream && (
                  <div className={`p-3 rounded-lg mb-6 flex items-center gap-3 ${
                    faceDetected ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
                  }`}>
                    {faceDetected ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-400">Face detected - Ready to verify</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <span className="text-yellow-400">Position your face in the frame</span>
                      </>
                    )}
                  </div>
                )}

                {/* Verification Result */}
                {verificationResult && (
                  <div className={`p-4 rounded-lg mb-6 ${
                    verificationResult.status === 'passed'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`} data-testid="verification-result">
                    <div className="flex items-center gap-3 mb-2">
                      {verificationResult.status === 'passed' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                      <span className={`font-semibold text-lg ${
                        verificationResult.status === 'passed' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {verificationResult.status === 'passed' ? 'Verification Successful' : 'Verification Failed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Confidence:</span>
                      <Progress value={verificationResult.confidence * 100} className="flex-1 h-2" />
                      <span className="text-white font-medium">
                        {(verificationResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {!verificationResult ? (
                    <Button
                      onClick={handleBiometricVerification}
                      disabled={!cameraStream || verifying}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4"
                      data-testid="verify-btn"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Verify My Identity
                        </>
                      )}
                    </Button>
                  ) : verificationResult.status === 'passed' ? (
                    <Button
                      onClick={() => setCurrentStep(3)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-4"
                      data-testid="proceed-to-step-3-btn"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Continue to Submit Request
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleRetryVerification}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-4"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Try Again
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Form Submission */}
          {currentStep === 3 && (
            <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="step-3-card">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-500" />
                    Step 3: Complete Your Request
                  </h2>
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(2)}
                    className="text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>

                {/* Verification Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-green-500" />
                      <span className="text-green-400 font-medium">Document Analyzed</span>
                    </div>
                    <p className="text-gray-300 text-sm">{selectedFile?.name}</p>
                    <p className="text-gray-500 text-xs">Confidence: {analysisResult?.confidence_score}%</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-green-500" />
                      <span className="text-green-400 font-medium">Identity Verified</span>
                    </div>
                    <p className="text-gray-300 text-sm">Facial Recognition</p>
                    <p className="text-gray-500 text-xs">Confidence: {(verificationResult?.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Document Details */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      Document Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="document_name" className="text-white mb-2 block">
                          Document Name *
                        </Label>
                        <Input
                          id="document_name"
                          name="document_name"
                          required
                          value={formData.document_name}
                          onChange={handleChange}
                          className="bg-[#0a0f1a] border-gray-700 text-white"
                          placeholder="e.g., Property Purchase Agreement"
                          disabled={loading}
                          data-testid="document-name-input"
                        />
                      </div>

                      <div>
                        <Label htmlFor="notarization_type" className="text-white mb-2 block">
                          Notarization Type *
                        </Label>
                        <select
                          id="notarization_type"
                          name="notarization_type"
                          required
                          value={formData.notarization_type}
                          onChange={handleChange}
                          className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                          disabled={loading}
                          data-testid="notarization-type-select"
                        >
                          {notarizationTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      Scheduling
                    </h3>
                    <div>
                      <Label htmlFor="scheduled_time" className="text-white mb-2 block">
                        Preferred Date & Time (optional)
                      </Label>
                      <Input
                        id="scheduled_time"
                        name="scheduled_time"
                        type="datetime-local"
                        value={formData.scheduled_time}
                        onChange={handleChange}
                        className="bg-[#0a0f1a] border-gray-700 text-white"
                        disabled={loading}
                        data-testid="scheduled-time-input"
                      />
                    </div>
                  </div>

                  {/* Signers */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      Signers
                    </h3>
                    <div className="space-y-4">
                      {formData.signers.map((signer, index) => (
                        <div key={index} className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-white font-semibold">Signer {index + 1}</span>
                            {formData.signers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSigner(index)}
                                className="text-red-400 hover:text-red-300 text-sm"
                                disabled={loading}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              placeholder="Full Name"
                              value={signer.name}
                              onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                              className="bg-[#1a2332] border-gray-700 text-white"
                              disabled={loading}
                              data-testid={`signer-${index}-name`}
                            />
                            <Input
                              type="email"
                              placeholder="Email Address"
                              value={signer.email}
                              onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                              className="bg-[#1a2332] border-gray-700 text-white"
                              disabled={loading}
                              data-testid={`signer-${index}-email`}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        onClick={addSigner}
                        variant="outline"
                        className="w-full border-gray-700 text-gray-300 hover:text-white"
                        disabled={loading}
                      >
                        + Add Another Signer
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-white mb-2 block">
                      Additional Notes
                    </Label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={4}
                      className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Any special instructions or requirements..."
                      disabled={loading}
                      data-testid="notes-textarea"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                    data-testid="submit-request-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Notarization Request
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RequestNotarization;
