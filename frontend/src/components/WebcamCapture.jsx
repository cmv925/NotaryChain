import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Camera, RotateCcw, Check, X, VideoOff } from 'lucide-react';

export function WebcamCapture({ onCapture, onCancel, label = 'Capture Photo' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setActive(true);
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    setCaptured(dataUrl);
    stopCamera();
    onCapture(base64);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  const handleCancel = () => {
    stopCamera();
    setCaptured(null);
    if (onCancel) onCancel();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-red-500/30 bg-red-500/5 rounded-sm p-3">
        <VideoOff className="w-5 h-5 text-red-400 mb-1" />
        <p className="text-red-400 text-[10px] text-center">{error}</p>
        <Button size="sm" variant="ghost" onClick={() => setError(null)} className="text-red-400 text-[10px] mt-1 h-6 px-2">
          Retry
        </Button>
      </div>
    );
  }

  if (captured) {
    return (
      <div className="relative">
        <img src={captured} alt="Captured" className="w-full h-28 object-cover rounded-sm border border-emerald-500/50" />
        <div className="absolute bottom-1 right-1 flex gap-1">
          <button
            onClick={retake}
            className="bg-slate-900/80 backdrop-blur text-white p-1 rounded-sm hover:bg-slate-800"
            data-testid="webcam-retake"
            title="Retake"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="absolute top-1 right-1">
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-28 object-cover rounded-sm border border-coral-300/50"
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={capture}
            className="bg-coral-500 hover:bg-coral-600 text-white px-3 py-1 rounded-sm text-[10px] font-bold flex items-center gap-1"
            data-testid="webcam-shutter"
          >
            <Camera className="w-3 h-3" /> Capture
          </button>
          <button
            onClick={handleCancel}
            className="bg-slate-800/80 text-slate-500 px-2 py-1 rounded-sm text-[10px] flex items-center gap-1"
            data-testid="webcam-cancel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={startCamera}
      className="flex flex-col items-center justify-center h-28 w-full border-2 border-dashed border-slate-200 bg-cream-100 hover:border-coral-300/50 hover:bg-coral-500/5 rounded-sm cursor-pointer transition-all"
      data-testid="webcam-start"
    >
      <Camera className="w-6 h-6 text-slate-500 mb-1" />
      <span className="text-slate-500 text-[11px]">{label}</span>
    </button>
  );
}
