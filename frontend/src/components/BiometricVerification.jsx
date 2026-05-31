import React from 'react';
import {
  Camera, CheckCircle, XCircle, AlertTriangle,
  Loader2, RefreshCw, Eye, Smile, MoveHorizontal, ShieldAlert,
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useBiometricVerification } from '../hooks/useBiometricVerification';

// Challenges with their display icons (logic lives in the hook).
const CHALLENGES = [
  { id: 'center', instruction: 'Look straight at the camera', icon: Eye, duration: 2000 },
  { id: 'blink', instruction: 'Blink your eyes twice', icon: Eye, duration: 4000 },
  { id: 'turnLeft', instruction: 'Turn your head slightly left', icon: MoveHorizontal, duration: 3000 },
  { id: 'turnRight', instruction: 'Turn your head slightly right', icon: MoveHorizontal, duration: 3000 },
  { id: 'smile', instruction: 'Smile naturally', icon: Smile, duration: 2000 },
];

const BiometricVerification = ({ onVerificationComplete, onError }) => {
  const {
    videoRef, canvasRef,
    status, cameraError, faceDetected, confidenceScore, modelLoaded, demoMode,
    currentChallenge, challengeProgress, challengesPassed, livenessScore,
    startCamera, startVerification, resetVerification,
  } = useBiometricVerification({ challenges: CHALLENGES, onVerificationComplete, onError });

  return (
    <div className="space-y-4">
      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2" data-testid="biometric-demo-banner">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Demo Mode</p>
            <p className="text-amber-400/70 text-xs">Face detection ML model unavailable. Verification runs in simulation mode.</p>
          </div>
        </div>
      )}

      {/* Status Header */}
      <div className={`p-3 rounded-lg flex items-center gap-3 ${
        status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
        status === 'failed' ? 'bg-red-500/10 border border-red-500/30' :
        faceDetected ? 'bg-coral-500/10 border border-coral-300/30' :
        'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        {status === 'initializing' && (
          <>
            <Loader2 className="w-5 h-5 text-coral-500 animate-spin" />
            <span className="text-coral-500">Loading face detection model...</span>
          </>
        )}
        {status === 'ready' && !faceDetected && (
          <>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-400">Position your face in the frame</span>
          </>
        )}
        {status === 'ready' && faceDetected && (
          <>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-400">Face detected - Ready to verify</span>
          </>
        )}
        {(status === 'detecting' || status === 'challenge') && (
          <>
            <Eye className="w-5 h-5 text-coral-500 animate-pulse" />
            <span className="text-coral-500">
              {currentChallenge?.instruction || 'Performing liveness check...'}
            </span>
          </>
        )}
        {status === 'verifying' && (
          <>
            <Loader2 className="w-5 h-5 text-coral-500 animate-spin" />
            <span className="text-coral-500">Analyzing biometric data...</span>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-400">Identity verified successfully!</span>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-400">Verification failed - Please try again</span>
          </>
        )}
      </div>

      {/* Camera View */}
      <div className="relative aspect-video bg-cream-100 rounded-lg overflow-hidden border border-slate-200">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <XCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-400 text-center mb-4">{cameraError}</p>
            <Button onClick={startCamera} className="bg-coral-500 hover:bg-coral-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Camera
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Face Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-48 h-64 border-4 rounded-full transition-colors duration-300 ${
                faceDetected && confidenceScore > 70 ? 'border-green-500' :
                faceDetected ? 'border-yellow-500' :
                'border-slate-300 border-dashed'
              }`} />
            </div>

            {/* Challenge Progress */}
            {currentChallenge && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(currentChallenge.icon, { className: 'w-5 h-5 text-coral-500' })}
                    <span className="text-white text-sm">{currentChallenge.instruction}</span>
                  </div>
                  <Progress value={challengeProgress} className="h-2" />
                </div>
              </div>
            )}

            {/* Confidence Score */}
            {faceDetected && status !== 'success' && status !== 'failed' && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-slate-500 mb-1">Detection Confidence</div>
                <div className="flex items-center gap-2">
                  <Progress value={confidenceScore} className="w-20 h-2" />
                  <span className={`text-sm font-bold ${
                    confidenceScore > 70 ? 'text-green-400' :
                    confidenceScore > 50 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {confidenceScore}%
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Challenge Status */}
      {(status === 'detecting' || status === 'verifying' || status === 'success' || status === 'failed') && (
        <div className="grid grid-cols-5 gap-2">
          {CHALLENGES.map((challenge) => (
            <div
              key={challenge.id}
              className={`p-2 rounded text-center text-xs ${
                challengesPassed.includes(challenge.id)
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : currentChallenge?.id === challenge.id
                  ? 'bg-coral-500/20 text-coral-500 border border-coral-300/30'
                  : 'bg-navy-800 text-slate-500 border border-slate-200'
              }`}
            >
              {React.createElement(challenge.icon, { className: 'w-4 h-4 mx-auto mb-1' })}
              <span className="block truncate">{challenge.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Liveness Score */}
      {livenessScore > 0 && (
        <div className="bg-cream-100 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-sm">Liveness Score</span>
            <span className={`font-bold ${
              livenessScore >= 60 ? 'text-green-400' :
              livenessScore >= 40 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {livenessScore}%
            </span>
          </div>
          <Progress value={livenessScore} className="h-2" />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {status === 'ready' && (
          <Button
            onClick={startVerification}
            disabled={!faceDetected || confidenceScore < 50 || !modelLoaded}
            className="flex-1 bg-coral-500 hover:bg-coral-600 py-4"
            data-testid="start-verification-btn"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Biometric Verification
          </Button>
        )}
        {(status === 'success' || status === 'failed') && (
          <Button
            onClick={resetVerification}
            variant="outline"
            className="flex-1 border-slate-200 text-slate-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
};

export default BiometricVerification;
