import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import VideoRoom from '../components/VideoRoom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  Video, FileText, Shield, CheckCircle, Clock, 
  Users, AlertTriangle, Loader2, ExternalLink,
  Camera, ArrowLeft, Link2
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotaryVideoSession = () => {
  const { requestId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notaryRequest, setNotaryRequest] = useState(null);
  const [videoSession, setVideoSession] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('preparing'); // preparing, joining, active, ended
  const [error, setError] = useState(null);

  // Check if joining an existing session
  const sessionIdFromUrl = searchParams.get('session');

  // Fetch notary request details
  useEffect(() => {
    const fetchRequestDetails = async () => {
      try {
        const response = await axios.get(
          `${API}/notary/requests/${requestId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotaryRequest(response.data);

        // If request already has a video session, get its details
        if (response.data.video_session_id || sessionIdFromUrl) {
          const sessionId = sessionIdFromUrl || response.data.video_session_id;
          const sessionResponse = await axios.get(
            `${API}/video/rooms/${sessionId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setVideoSession(sessionResponse.data);
          setSessionStatus('joining');
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load request details');
      } finally {
        setLoading(false);
      }
    };

    if (requestId && token) {
      fetchRequestDetails();
    }
  }, [requestId, token, sessionIdFromUrl]);

  // Create new video session
  const createVideoSession = async () => {
    setSessionStatus('preparing');
    try {
      const response = await axios.post(
        `${API}/video/rooms`,
        {
          notary_request_id: requestId,
          expires_minutes: 60
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setVideoSession({
        id: response.data.video_session_id,
        room_url: response.data.room_url,
        room_name: response.data.room_name,
        token: response.data.token,
        expires_at: response.data.expires_at
      });
      setSessionStatus('joining');

      toast({
        title: 'Video Room Created',
        description: 'Your secure notarization session is ready.',
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create video session');
      toast({
        title: 'Error',
        description: 'Failed to create video session',
        variant: 'destructive',
      });
    }
  };

  // Join existing video session
  const joinVideoSession = async () => {
    if (!videoSession?.id) return;

    try {
      const response = await axios.post(
        `${API}/video/rooms/${videoSession.id}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setVideoSession(prev => ({
        ...prev,
        token: response.data.token
      }));
      setSessionStatus('active');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to join session');
    }
  };

  // Handle leaving the call
  const handleLeaveCall = async () => {
    setSessionStatus('ended');
    toast({
      title: 'Session Ended',
      description: 'You have left the notarization session.',
    });
  };

  // Copy invite link
  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/session/${requestId}?session=${videoSession?.id}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Link Copied',
      description: 'Share this link with other participants.',
    });
  };

  // End session completely
  const endSession = async () => {
    if (!videoSession?.id) return;

    try {
      await axios.post(
        `${API}/video/rooms/${videoSession.id}/end`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast({
        title: 'Session Completed',
        description: 'The notarization session has been completed.',
      });

      navigate('/dashboard');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to end session',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !videoSession) {
    return (
      <div className="min-h-screen bg-[#0f1825]">
        <Navbar />
        <div className="pt-32 pb-24 px-6">
          <div className="max-w-xl mx-auto text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />

      <div className="pt-24 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Video className="w-6 h-6 text-blue-500" />
                  Notarization Session
                </h1>
                <p className="text-gray-400 text-sm">
                  {notaryRequest?.document_name || 'Document'} - {notaryRequest?.document_type}
                </p>
              </div>
            </div>

            {videoSession && sessionStatus === 'active' && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={copyInviteLink}
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Copy Invite Link
                </Button>
                <Button
                  onClick={endSession}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  End Session
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Video Area */}
            <div className="lg:col-span-3">
              <Card className="bg-[#1a2332] border-gray-800 overflow-hidden">
                <CardContent className="p-0">
                  {/* Pre-session Screen */}
                  {sessionStatus === 'preparing' && !videoSession && (
                    <div className="aspect-video flex flex-col items-center justify-center bg-[#0a0f1a] p-8">
                      <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center mb-6">
                        <Camera className="w-12 h-12 text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Ready to Start?
                      </h2>
                      <p className="text-gray-400 text-center mb-6 max-w-md">
                        Start a secure video session for your remote online notarization. 
                        Make sure your camera and microphone are ready.
                      </p>
                      <Button
                        onClick={createVideoSession}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="start-session-btn"
                      >
                        <Video className="w-5 h-5 mr-2" />
                        Start Video Session
                      </Button>
                    </div>
                  )}

                  {/* Joining Screen */}
                  {sessionStatus === 'joining' && videoSession && (
                    <div className="aspect-video flex flex-col items-center justify-center bg-[#0a0f1a] p-8">
                      <div className="w-24 h-24 rounded-full bg-green-600/20 flex items-center justify-center mb-6">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Session Ready
                      </h2>
                      <p className="text-gray-400 text-center mb-2">
                        Room: <span className="text-white font-mono">{videoSession.room_name}</span>
                      </p>
                      <p className="text-gray-500 text-sm mb-6">
                        Click below to join the video call
                      </p>
                      <Button
                        onClick={joinVideoSession}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="join-session-btn"
                      >
                        <Video className="w-5 h-5 mr-2" />
                        Join Video Call
                      </Button>
                    </div>
                  )}

                  {/* Active Video Session */}
                  {sessionStatus === 'active' && videoSession && (
                    <div className="aspect-video">
                      <VideoRoom
                        roomUrl={videoSession.room_url}
                        token={videoSession.token}
                        userName={user?.full_name || 'Participant'}
                        onLeave={handleLeaveCall}
                        onError={(err) => console.error('Video error:', err)}
                      />
                    </div>
                  )}

                  {/* Session Ended */}
                  {sessionStatus === 'ended' && (
                    <div className="aspect-video flex flex-col items-center justify-center bg-[#0a0f1a] p-8">
                      <div className="w-24 h-24 rounded-full bg-gray-600/20 flex items-center justify-center mb-6">
                        <CheckCircle className="w-12 h-12 text-gray-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Session Ended
                      </h2>
                      <p className="text-gray-400 text-center mb-6">
                        The video session has ended. Thank you for using NotaryChain.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setSessionStatus('joining')}
                          variant="outline"
                          className="border-gray-700 text-gray-300"
                        >
                          Rejoin Session
                        </Button>
                        <Button
                          onClick={() => navigate('/dashboard')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Session Info */}
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Document Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Document:</span>
                      <p className="text-white">{notaryRequest?.document_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <p className="text-white capitalize">{notaryRequest?.document_type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className={`capitalize ${
                        notaryRequest?.status === 'in_session' ? 'text-green-400' :
                        notaryRequest?.status === 'pending' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {notaryRequest?.status?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Signers
                  </h3>
                  <div className="space-y-2">
                    {notaryRequest?.signers?.map((signer, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-white text-xs">
                            {signer.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-white">{signer.name}</p>
                          <p className="text-gray-500 text-xs">{signer.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Security Info */}
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-500" />
                    Security
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>End-to-end encrypted</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Cloud recording enabled</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Identity verified</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Timer */}
              {videoSession && (
                <Card className="bg-[#1a2332] border-gray-800">
                  <CardContent className="p-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      Session
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Expires:</span>
                        <p className="text-white">
                          {new Date(videoSession.expires_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {videoSession.room_url && (
                        <a
                          href={videoSession.room_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in new tab
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotaryVideoSession;
