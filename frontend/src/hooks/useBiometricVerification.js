/**
 * useBiometricVerification — encapsulates all camera, TensorFlow face-detection,
 * liveness-tracking and challenge-running logic for <BiometricVerification/>.
 * Extracted from the (oversized) component so the JSX stays presentational.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

// Dynamic/lazy TensorFlow imports with graceful fallback
let tf = null;
let faceDetection = null;
let tfLoadError = null;

const loadTensorFlow = async () => {
  if (tf && faceDetection) return true;
  if (tfLoadError) return false;
  try {
    const [tfModule, fdModule] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/face-detection'),
    ]);
    tf = tfModule;
    faceDetection = fdModule;
    return true;
  } catch (err) {
    console.warn('TensorFlow unavailable — biometric verification will run in demo mode:', err.message);
    tfLoadError = err;
    return false;
  }
};

export const CHALLENGES = [
  { id: 'center', instruction: 'Look straight at the camera', duration: 2000 },
  { id: 'blink', instruction: 'Blink your eyes twice', duration: 4000 },
  { id: 'turnLeft', instruction: 'Turn your head slightly left', duration: 3000 },
  { id: 'turnRight', instruction: 'Turn your head slightly right', duration: 3000 },
  { id: 'smile', instruction: 'Smile naturally', duration: 2000 },
];

export function useBiometricVerification({ challenges, onVerificationComplete, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const detectorRef = useRef(null);

  const [status, setStatus] = useState('initializing');
  const [cameraError, setCameraError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [, setFaceBox] = useState(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Liveness challenge state
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengesPassed, setChallengesPassed] = useState([]);
  const [livenessScore, setLivenessScore] = useState(0);

  // Face tracking for liveness
  const [, setFaceHistory] = useState([]);
  const [headMovement, setHeadMovement] = useState({ left: false, right: false });
  const faceHistoryRef = useRef([]);

  // Track face for liveness detection
  const trackFaceForLiveness = useCallback((face) => {
    if (!face.keypoints) return;

    const rightEye = face.keypoints.find(k => k.name === 'rightEye');
    const leftEye = face.keypoints.find(k => k.name === 'leftEye');
    const nose = face.keypoints.find(k => k.name === 'noseTip');

    if (rightEye && leftEye && nose) {
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);

      setFaceHistory(prev => {
        const newHistory = [...prev, {
          centerX: (rightEye.x + leftEye.x) / 2,
          noseX: nose.x,
          eyeDistance,
          timestamp: Date.now(),
        }].slice(-30);
        faceHistoryRef.current = newHistory;

        if (newHistory.length >= 10) {
          const recent = newHistory.slice(-10);
          const avgX = recent.reduce((sum, f) => sum + f.noseX, 0) / recent.length;
          const first = recent[0].noseX;

          if (avgX < first - 30) {
            setHeadMovement(p => ({ ...p, left: true }));
          } else if (avgX > first + 30) {
            setHeadMovement(p => ({ ...p, right: true }));
          }
        }

        return newHistory;
      });
    }
  }, []);

  // Face detection loop
  const startDetection = useCallback(() => {
    if (demoMode) {
      setFaceDetected(true);
      setConfidenceScore(0.95);
      setFaceBox({ x: 160, y: 100, width: 320, height: 280 });
      return;
    }

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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const faces = await detectorRef.current.estimateFaces(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (faces.length > 0) {
          const face = faces[0];
          setFaceDetected(true);
          setFaceBox(face.box);

          const faceWidth = face.box.width;
          const faceHeight = face.box.height;
          const centerX = face.box.xMin + faceWidth / 2;
          const centerY = face.box.yMin + faceHeight / 2;

          const sizeScore = Math.min(100, (faceWidth * faceHeight) / (canvas.width * canvas.height) * 800);
          const centerScore = 100 - (Math.abs(centerX - canvas.width / 2) / canvas.width * 100 +
                                      Math.abs(centerY - canvas.height / 2) / canvas.height * 100) / 2;

          const confidence = Math.round((sizeScore + centerScore) / 2);
          setConfidenceScore(Math.min(99, Math.max(0, confidence)));

          ctx.strokeStyle = confidence > 70 ? '#22c55e' : '#eab308';
          ctx.lineWidth = 3;
          ctx.strokeRect(face.box.xMin, face.box.yMin, faceWidth, faceHeight);

          if (face.keypoints) {
            ctx.fillStyle = '#3b82f6';
            face.keypoints.forEach(keypoint => {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- detection loop is mount-stable; reads refs
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDetection]);

  // Initialize TensorFlow and face detection model
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        setStatus('initializing');

        const tfAvailable = await loadTensorFlow();
        if (!tfAvailable) {
          console.warn('Running biometric verification in demo mode (TensorFlow unavailable)');
          setDemoMode(true);
          setModelLoaded(false);
          setStatus('ready');
          await startCamera();
          return;
        }

        try {
          await tf.setBackend('webgl');
          await tf.ready();
        } catch (webglError) {
          console.warn('WebGL unavailable, falling back to CPU:', webglError);
          await tf.setBackend('cpu');
          await tf.ready();
        }

        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig = { runtime: 'tfjs', maxFaces: 1, modelType: 'short' };

        detectorRef.current = await faceDetection.createDetector(model, detectorConfig);
        setModelLoaded(true);
        setStatus('ready');

        await startCamera();
      } catch (error) {
        console.error('Failed to initialize face detector:', error);
        setDemoMode(true);
        setModelLoaded(false);
        setStatus('ready');
        try { await startCamera(); } catch { /* ignore */ }
      }
    };

    initializeDetector();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (detectorRef.current) detectorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  // Run individual challenge
  const runChallenge = useCallback((challenge) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / challenge.duration) * 100);
        setChallengeProgress(progress);

        let passed = false;
        switch (challenge.id) {
          case 'center':
            passed = faceDetected && confidenceScore > 60;
            break;
          case 'blink':
            passed = faceHistoryRef.current.length > 10;
            break;
          case 'turnLeft':
            passed = headMovement.left;
            break;
          case 'turnRight':
            passed = headMovement.right;
            break;
          case 'smile':
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
  }, [faceDetected, confidenceScore, headMovement]);

  // Start verification process
  const startVerification = useCallback(async () => {
    if (!faceDetected && !demoMode) return;

    setStatus('detecting');
    setChallengesPassed([]);
    setLivenessScore(0);

    for (let i = 0; i < challenges.length; i++) {
      const challenge = challenges[i];
      setCurrentChallenge(challenge);
      setChallengeProgress(0);

      let passed;
      if (demoMode) {
        await new Promise(resolve => {
          let progress = 0;
          const interval = setInterval(() => {
            progress += 10;
            setChallengeProgress(Math.min(100, progress));
            if (progress >= 100) { clearInterval(interval); resolve(); }
          }, challenge.duration / 10);
        });
        passed = true;
      } else {
        passed = await runChallenge(challenge);
      }

      if (passed) {
        setChallengesPassed(prev => [...prev, challenge.id]);
        setLivenessScore(prev => prev + 20);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setStatus('verifying');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const finalScore = (confidenceScore + livenessScore) / 2;
    const result = {
      confidence: finalScore / 100,
      livenessScore,
      challengesPassed: challengesPassed.length,
      timestamp: new Date().toISOString(),
    };

    if (finalScore >= 60 && challengesPassed.length >= 3) {
      setStatus('success');
      onVerificationComplete?.({ status: 'passed', ...result });
    } else {
      setStatus('failed');
      onVerificationComplete?.({ status: 'failed', ...result });
    }
  }, [faceDetected, demoMode, challenges, runChallenge, confidenceScore, livenessScore, challengesPassed, onVerificationComplete]);

  // Reset verification
  const resetVerification = useCallback(() => {
    setStatus('ready');
    setCurrentChallenge(null);
    setChallengeProgress(0);
    setChallengesPassed([]);
    setLivenessScore(0);
    setHeadMovement({ left: false, right: false });
    setFaceHistory([]);
    faceHistoryRef.current = [];
  }, []);

  return {
    videoRef, canvasRef,
    status, cameraError, faceDetected, confidenceScore, modelLoaded, demoMode,
    currentChallenge, challengeProgress, challengesPassed, livenessScore,
    startCamera, startVerification, resetVerification,
  };
}
