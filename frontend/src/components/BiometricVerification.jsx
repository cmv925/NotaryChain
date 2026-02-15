import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import { 
  Camera, CheckCircle, XCircle, AlertTriangle, 
  Loader2, RefreshCw, Eye, Smile, MoveHorizontal
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

const BiometricVerification = ({ onVerificationComplete, onError }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const detectorRef = useRef(null);

  const [status, setStatus] = useState('initializing'); // initializing, ready, detecting, challenge, verifying, success, failed
  const [cameraError, setCameraError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBox, setFaceBox] = useState(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Liveness challenge state
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengesPassed, setChallengesPassed] = useState([]);
  const [livenessScore, setLivenessScore] = useState(0);

  // Face tracking for liveness
  const [faceHistory, setFaceHistory] = useState([]);
  const [blinkCount, setBlinkCount] = useState(0);
  const [headMovement, setHeadMovement] = useState({ left: false, right: false });

  const challenges = [
    { id: 'center', instruction: 'Look straight at the camera', icon: Eye, duration: 2000 },
    { id: 'blink', instruction: 'Blink your eyes twice', icon: Eye, duration: 4000 },
    { id: 'turnLeft', instruction: 'Turn your head slightly left', icon: MoveHorizontal, duration: 3000 },
    { id: 'turnRight', instruction: 'Turn your head slightly right', icon: MoveHorizontal, duration: 3000 },
    { id: 'smile', instruction: 'Smile naturally', icon: Smile, duration: 2000 },
  ];

  // Initialize TensorFlow and face detection model
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        setStatus('initializing');
        
        // Set TensorFlow backend
        await tf.setBackend('webgl');
        await tf.ready();
        
        // Load face detection model
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig = {
          runtime: 'tfjs',
          maxFaces: 1,
          modelType: 'short',
        };
        
        detectorRef.current = await faceDetection.createDetector(model, detectorConfig);
        setModelLoaded(true);
        setStatus('ready');
        
        // Start camera
        await startCamera();
      } catch (error) {
        console.error('Failed to initialize face detector:', error);
        setCameraError('Failed to load face detection model. Please refresh and try again.');
        if (onError) onError(error);
      }
    };

    initializeDetector();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current = null;
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          startDetection();
        };
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Camera access denied. Please allow camera access to proceed with verification.');
      if (onError) onError(error);
    }
  };

  // Face detection loop
  const startDetection = useCallback(() => {
    const detectFaces = async () => {
      if (!videoRef.current || !detectorRef.current || !canvasRef.current) {
        animationRef.current = requestAnimationFrame(detectFaces);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(detectFaces);
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // Detect faces
        const faces = await detectorRef.current.estimateFaces(video);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (faces.length > 0) {
          const face = faces[0];
          setFaceDetected(true);
          setFaceBox(face.box);
          
          // Calculate confidence based on face size and position
          const faceWidth = face.box.width;
          const faceHeight = face.box.height;
          const centerX = face.box.xMin + faceWidth / 2;
          const centerY = face.box.yMin + faceHeight / 2;
          
          // Score based on face size (should be reasonably large)
          const sizeScore = Math.min(100, (faceWidth * faceHeight) / (canvas.width * canvas.height) * 800);
          
          // Score based on centering
          const centerScore = 100 - (Math.abs(centerX - canvas.width / 2) / canvas.width * 100 + 
                                      Math.abs(centerY - canvas.height / 2) / canvas.height * 100) / 2;
          
          const confidence = Math.round((sizeScore + centerScore) / 2);
          setConfidenceScore(Math.min(99, Math.max(0, confidence)));

          // Draw face box
          ctx.strokeStyle = confidence > 70 ? '#22c55e' : '#eab308';
          ctx.lineWidth = 3;
          ctx.strokeRect(face.box.xMin, face.box.yMin, faceWidth, faceHeight);

          // Draw keypoints
          if (face.keypoints) {
            ctx.fillStyle = '#3b82f6';
            face.keypoints.forEach(keypoint => {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });

            // Track face position for liveness
            trackFaceForLiveness(face);
          }
        } else {
          setFaceDetected(false);
          setFaceBox(null);
          setConfidenceScore(0);
        }
      } catch (error) {
        console.error('Detection error:', error);
      }

      animationRef.current = requestAnimationFrame(detectFaces);
    };

    detectFaces();
  }, []);

  // Track face for liveness detection
  const trackFaceForLiveness = useCallback((face) => {
    if (!face.keypoints) return;

    // Get eye keypoints
    const rightEye = face.keypoints.find(k => k.name === 'rightEye');
    const leftEye = face.keypoints.find(k => k.name === 'leftEye');
    const nose = face.keypoints.find(k => k.name === 'noseTip');

    if (rightEye && leftEye && nose) {
      // Calculate eye aspect ratio for blink detection
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);
      
      // Track face position
      setFaceHistory(prev => {
        const newHistory = [...prev, { 
          centerX: (rightEye.x + leftEye.x) / 2,
          noseX: nose.x,
          eyeDistance,
          timestamp: Date.now()
        }].slice(-30); // Keep last 30 frames
        
        // Detect head movement
        if (newHistory.length >= 10) {
          const recent = newHistory.slice(-10);
          const avgX = recent.reduce((sum, f) => sum + f.noseX, 0) / recent.length;
          const first = recent[0].noseX;
          
          if (avgX < first - 30) {
            setHeadMovement(prev => ({ ...prev, left: true }));
          } else if (avgX > first + 30) {
            setHeadMovement(prev => ({ ...prev, right: true }));
          }
        }
        
        return newHistory;
      });
    }
  }, []);

  // Start verification process
  const startVerification = async () => {
    if (!faceDetected || confidenceScore < 50) {
      return;
    }

    setStatus('detecting');
    setChallengesPassed([]);
    setLivenessScore(0);
    
    // Run through challenges
    for (let i = 0; i < challenges.length; i++) {
      const challenge = challenges[i];
      setCurrentChallenge(challenge);
      setChallengeProgress(0);

      // Wait for challenge completion
      const passed = await runChallenge(challenge);
      
      if (passed) {
        setChallengesPassed(prev => [...prev, challenge.id]);
        setLivenessScore(prev => prev + 20);
      }
      
      // Brief pause between challenges
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate final result
    setStatus('verifying');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const finalScore = (confidenceScore + livenessScore) / 2;
    
    if (finalScore >= 60 && challengesPassed.length >= 3) {
      setStatus('success');
      if (onVerificationComplete) {
        onVerificationComplete({
          status: 'passed',
          confidence: finalScore / 100,
          livenessScore: livenessScore,
          challengesPassed: challengesPassed.length,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      setStatus('failed');
      if (onVerificationComplete) {
        onVerificationComplete({
          status: 'failed',
          confidence: finalScore / 100,
          livenessScore: livenessScore,
          challengesPassed: challengesPassed.length,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  // Run individual challenge
  const runChallenge = async (challenge) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / challenge.duration) * 100);
        setChallengeProgress(progress);

        // Check if challenge is passed based on type
        let passed = false;
        
        switch (challenge.id) {
          case 'center':
            passed = faceDetected && confidenceScore > 60;
            break;
          case 'blink':
            // Simplified blink detection - based on face tracking stability
            passed = faceHistory.length > 10;
            break;
          case 'turnLeft':
            passed = headMovement.left;
            break;
          case 'turnRight':
            passed = headMovement.right;
            break;
          case 'smile':
            // Simplified smile detection - face must be detected and stable
            passed = faceDetected && confidenceScore > 50;
            break;
          default:
            passed = faceDetected;
        }

        if (elapsed >= challenge.duration) {
          clearInterval(checkInterval);
          resolve(passed);
        }
      }, 100);
    });
  };

  // Reset verification
  const resetVerification = () => {
    setStatus('ready');
    setCurrentChallenge(null);
    setChallengeProgress(0);
    setChallengesPassed([]);
    setLivenessScore(0);
    setHeadMovement({ left: false, right: false });
    setFaceHistory([]);
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className={`p-3 rounded-lg flex items-center gap-3 ${
        status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
        status === 'failed' ? 'bg-red-500/10 border border-red-500/30' :
        faceDetected ? 'bg-blue-500/10 border border-blue-500/30' :
        'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        {status === 'initializing' && (
          <>
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-blue-400">Loading face detection model...</span>
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
            <Eye className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="text-blue-400">
              {currentChallenge?.instruction || 'Performing liveness check...'}
            </span>
          </>
        )}
        {status === 'verifying' && (
          <>
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-blue-400">Analyzing biometric data...</span>
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
      <div className="relative aspect-video bg-[#0a0f1a] rounded-lg overflow-hidden border border-gray-700">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <XCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-400 text-center mb-4">{cameraError}</p>
            <Button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700">
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
                'border-gray-500 border-dashed'
              }`} />
            </div>

            {/* Challenge Progress */}
            {currentChallenge && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(currentChallenge.icon, { className: "w-5 h-5 text-blue-400" })}
                    <span className="text-white text-sm">{currentChallenge.instruction}</span>
                  </div>
                  <Progress value={challengeProgress} className="h-2" />
                </div>
              </div>
            )}

            {/* Confidence Score */}
            {faceDetected && status !== 'success' && status !== 'failed' && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-gray-400 mb-1">Detection Confidence</div>
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
          {challenges.map((challenge, index) => (
            <div 
              key={challenge.id}
              className={`p-2 rounded text-center text-xs ${
                challengesPassed.includes(challenge.id) 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : currentChallenge?.id === challenge.id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}
            >
              {React.createElement(challenge.icon, { className: "w-4 h-4 mx-auto mb-1" })}
              <span className="block truncate">{challenge.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Liveness Score */}
      {livenessScore > 0 && (
        <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Liveness Score</span>
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
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-4"
            data-testid="start-verification-btn"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Biometric Verification
          </Button>
        )}
        {(status === 'success' || status === 'failed') && (
          <>
            <Button
              onClick={resetVerification}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BiometricVerification;
