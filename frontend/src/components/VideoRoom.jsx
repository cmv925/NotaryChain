import React, { useCallback, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, PhoneOff, 
  Users, MessageSquare, Settings, Maximize2, Minimize2,
  Camera, ScreenShare
} from 'lucide-react';
import { Button } from './ui/button';

const VideoRoom = ({ 
  roomUrl, 
  token, 
  userName,
  onLeave,
  onError 
}) => {
  const [callFrame, setCallFrame] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const containerRef = React.useRef(null);

  // Initialize and join call
  const joinCall = useCallback(async () => {
    if (!roomUrl || !containerRef.current) return;

    try {
      // Create Daily iframe
      const daily = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      });

      setCallFrame(daily);

      // Event handlers
      daily.on('joined-meeting', () => {
        setIsJoined(true);
        updateParticipants(daily);
      });

      daily.on('left-meeting', () => {
        setIsJoined(false);
        if (onLeave) onLeave();
      });

      daily.on('participant-joined', () => updateParticipants(daily));
      daily.on('participant-left', () => updateParticipants(daily));
      daily.on('participant-updated', () => updateParticipants(daily));

      daily.on('camera-error', (e) => {
        setError(`Camera error: ${e.errorMsg}`);
        if (onError) onError(e);
      });

      daily.on('error', (e) => {
        setError(`Call error: ${e.errorMsg}`);
        if (onError) onError(e);
      });

      // Join the call
      await daily.join({
        url: roomUrl,
        token: token,
        userName: userName,
      });

    } catch (err) {
      setError(`Failed to join: ${err.message}`);
      if (onError) onError(err);
    }
  }, [roomUrl, token, userName, onLeave, onError]);

  // Update participants list
  const updateParticipants = (daily) => {
    const allParticipants = daily.participants();
    const participantList = Object.values(allParticipants).map(p => ({
      id: p.session_id,
      name: p.user_name || 'Guest',
      isLocal: p.local,
      hasVideo: p.video,
      hasAudio: p.audio,
      isOwner: p.owner,
    }));
    setParticipants(participantList);
  };

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (callFrame) {
      callFrame.setLocalVideo(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  }, [callFrame, isCameraOn]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (callFrame) {
      callFrame.setLocalAudio(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  }, [callFrame, isMicOn]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (callFrame) {
      if (isScreenSharing) {
        await callFrame.stopScreenShare();
      } else {
        await callFrame.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    }
  }, [callFrame, isScreenSharing]);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (callFrame) {
      await callFrame.leave();
      callFrame.destroy();
      setCallFrame(null);
      setIsJoined(false);
      if (onLeave) onLeave();
    }
  }, [callFrame, onLeave]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current?.parentElement;
    if (container) {
      if (!isFullscreen) {
        container.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  // Auto-join on mount
  React.useEffect(() => {
    if (roomUrl && !callFrame) {
      joinCall();
    }

    return () => {
      if (callFrame) {
        callFrame.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [roomUrl]);

  return (
    <div className="flex flex-col h-full bg-cream-100 rounded-xl overflow-hidden">
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Video Container */}
      <div className="flex-1 relative min-h-[400px]">
        <div 
          ref={containerRef} 
          className="absolute inset-0"
          data-testid="video-container"
        />
        
        {/* Pre-join screen */}
        {!isJoined && !callFrame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-100">
            <div className="w-24 h-24 rounded-full bg-coral-500/20 flex items-center justify-center mb-6 animate-pulse">
              <Video className="w-12 h-12 text-coral-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Preparing Video Session
            </h3>
            <p className="text-slate-500 mb-6">
              Setting up your secure notarization session...
            </p>
            <Button
              onClick={joinCall}
              className="bg-coral-500 hover:bg-coral-600"
            >
              <Camera className="w-4 h-4 mr-2" />
              Join Session
            </Button>
          </div>
        )}

        {/* Participants Overlay */}
        {isJoined && participants.length > 0 && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center gap-2 text-white text-sm">
              <Users className="w-4 h-4" />
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="mt-2 space-y-1">
              {participants.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs text-slate-500">
                  <div className={`w-2 h-2 rounded-full ${p.hasVideo ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>{p.name} {p.isLocal && '(You)'} {p.isOwner && '👑'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          {/* Camera Toggle */}
          <Button
            onClick={toggleCamera}
            variant="outline"
            size="lg"
            className={`rounded-full w-14 h-14 p-0 ${
              isCameraOn 
                ? 'bg-gray-700 hover:bg-gray-600 border-slate-200' 
                : 'bg-red-600 hover:bg-red-700 border-red-600'
            }`}
            data-testid="toggle-camera-btn"
          >
            {isCameraOn ? (
              <Video className="w-5 h-5 text-white" />
            ) : (
              <VideoOff className="w-5 h-5 text-white" />
            )}
          </Button>

          {/* Mic Toggle */}
          <Button
            onClick={toggleMic}
            variant="outline"
            size="lg"
            className={`rounded-full w-14 h-14 p-0 ${
              isMicOn 
                ? 'bg-gray-700 hover:bg-gray-600 border-slate-200' 
                : 'bg-red-600 hover:bg-red-700 border-red-600'
            }`}
            data-testid="toggle-mic-btn"
          >
            {isMicOn ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white" />
            )}
          </Button>

          {/* Screen Share */}
          <Button
            onClick={toggleScreenShare}
            variant="outline"
            size="lg"
            className={`rounded-full w-14 h-14 p-0 ${
              isScreenSharing 
                ? 'bg-coral-500 hover:bg-coral-600 border-coral-500' 
                : 'bg-gray-700 hover:bg-gray-600 border-slate-200'
            }`}
            data-testid="toggle-screen-btn"
          >
            {isScreenSharing ? (
              <ScreenShare className="w-5 h-5 text-white" />
            ) : (
              <Monitor className="w-5 h-5 text-white" />
            )}
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="lg"
            className="rounded-full w-14 h-14 p-0 bg-gray-700 hover:bg-gray-600 border-slate-200"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-white" />
            ) : (
              <Maximize2 className="w-5 h-5 text-white" />
            )}
          </Button>

          {/* Leave Call */}
          <Button
            onClick={leaveCall}
            variant="outline"
            size="lg"
            className="rounded-full w-14 h-14 p-0 bg-red-600 hover:bg-red-700 border-red-600 ml-4"
            data-testid="leave-call-btn"
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoRoom;
