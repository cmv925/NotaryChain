import React from 'react';
import BiometricVerification from '../BiometricVerification';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import {
  Camera, ArrowLeft, ArrowRight, CheckCircle,
  XCircle, RefreshCw,
} from 'lucide-react';

export const BiometricStep = ({
  verificationResult,
  onBiometricComplete,
  onRetry,
  onBack,
  onProceedToStep3,
}) => (
  <Card className="bg-gradient-to-br from-white to-cream-100 border border-slate-200" data-testid="step-2-card">
    <CardContent className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Camera className="w-6 h-6 text-coral-500" />
          Step 2: AI-Powered Identity Verification
        </h2>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-slate-500 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <p className="text-slate-500 mb-6">
        Our AI-powered biometric system uses TensorFlow.js for real-time face detection
        and liveness verification. Complete the challenges to verify your identity.
      </p>

      {!verificationResult ? (
        <BiometricVerification
          onVerificationComplete={onBiometricComplete}
          onError={(error) => console.error('Biometric error:', error)}
        />
      ) : (
        <>
          {/* Verification Result */}
          <div className={`p-4 rounded-lg mb-6 ${
            verificationResult.status === 'passed'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`} data-testid="verification-result">
            <div className="flex items-center gap-3 mb-3">
              {verificationResult.status === 'passed' ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <span className={`font-bold text-xl ${
                  verificationResult.status === 'passed' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {verificationResult.status === 'passed' ? 'Identity Verified!' : 'Verification Failed'}
                </span>
                <p className="text-slate-500 text-sm">
                  {verificationResult.status === 'passed'
                    ? 'Your identity has been verified using AI biometrics'
                    : 'Please try again with better lighting and face positioning'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-cream-100 rounded p-3">
                <span className="text-slate-500 text-xs">Face Confidence</span>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={verificationResult.confidence * 100} className="flex-1 h-2" />
                  <span className="text-white font-medium text-sm">
                    {Math.round(verificationResult.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="bg-cream-100 rounded p-3">
                <span className="text-slate-500 text-xs">Liveness Score</span>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={verificationResult.livenessScore || 0} className="flex-1 h-2" />
                  <span className="text-white font-medium text-sm">
                    {verificationResult.livenessScore || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {verificationResult.status === 'passed' ? (
              <Button
                onClick={onProceedToStep3}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4"
                data-testid="proceed-to-step-3-btn"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Continue to Submit Request
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={onRetry}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-4"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </>
      )}
    </CardContent>
  </Card>
);
