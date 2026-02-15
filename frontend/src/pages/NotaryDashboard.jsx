import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  FileText,
  Clock,
  CheckCircle,
  Video,
  User,
  Calendar,
  TrendingUp,
  LogOut,
  XCircle,
  Eye,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotaryDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, pendingRes, assignedRes] = await Promise.all([
        axios.get(`${API}/notary/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/notary/requests/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/notary/requests/assigned`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats(statsRes.data);
      setPendingRequests(pendingRes.data);
      setAssignedRequests(assignedRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      if (error.response?.status === 403) {
        toast({
          title: 'Not Authorized',
          description: 'You need to be a certified notary to access this page',
          variant: 'destructive',
        });
        navigate('/notary/onboarding');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRequest = async (requestId) => {
    setProcessingAction(requestId);
    try {
      await axios.post(
        `${API}/notary/requests/${requestId}/assign`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Success',
        description: 'Request assigned to you',
      });

      fetchDashboardData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to assign request',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleStartSession = async (requestId) => {
    setProcessingAction(requestId);
    try {
      // First create a video room
      const roomResponse = await axios.post(
        `${API}/video/rooms`,
        { request_id: requestId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Session Created',
        description: 'Redirecting to video session...',
      });

      // Navigate to video session
      navigate(`/session/${requestId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to start session',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCompleteNotarization = async (requestId) => {
    setProcessingAction(requestId);
    try {
      await axios.post(
        `${API}/notary/requests/${requestId}/complete`,
        { notes: 'Notarization completed successfully' },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Notarization Complete',
        description: 'The document has been notarized successfully',
      });

      setShowModal(false);
      setSelectedRequest(null);
      fetchDashboardData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to complete notarization',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      reviewing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || styles.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <div className="text-white text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">
                  Notary<span className="text-blue-500">Chain</span>
                </span>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-gray-400">Notary Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:text-white"
              >
                User Dashboard
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-red-500"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Completed</p>
                  <p className="text-4xl font-bold text-white">{stats?.total_completed || 0}</p>
                </div>
                <CheckCircle className="w-12 h-12 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Pending</p>
                  <p className="text-4xl font-bold text-white">{stats?.pending_count || 0}</p>
                </div>
                <Clock className="w-12 h-12 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Available</p>
                  <p className="text-4xl font-bold text-white">{pendingRequests.length}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-4 border-b border-gray-800">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Available Requests ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'assigned'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My Requests ({assignedRequests.length})
            </button>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {activeTab === 'pending' &&
            (pendingRequests.length === 0 ? (
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No pending requests available</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id} className="bg-[#1a2332] border-gray-800 hover:border-blue-500/50 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="w-8 h-8 text-blue-500" />
                          <div>
                            <h3 className="text-xl font-semibold text-white">{request.document_name}</h3>
                            <p className="text-gray-400 text-sm">{request.document_type}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Type</p>
                            <p className="text-white text-sm capitalize">{request.notarization_type}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Signers</p>
                            <p className="text-white text-sm">{request.signers?.length || 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Scheduled</p>
                            <p className="text-white text-sm">
                              {request.scheduled_time ? new Date(request.scheduled_time).toLocaleDateString() : 'Flexible'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Created</p>
                            <p className="text-white text-sm">{new Date(request.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {request.notes && (
                          <p className="text-gray-400 text-sm italic">Note: {request.notes}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleAssignRequest(request.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white ml-4"
                      >
                        Accept Request
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ))}

          {activeTab === 'assigned' &&
            (assignedRequests.length === 0 ? (
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No assigned requests</p>
                </CardContent>
              </Card>
            ) : (
              assignedRequests.map((request) => (
                <Card key={request.id} className="bg-[#1a2332] border-gray-800 hover:border-green-500/50 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="w-8 h-8 text-green-500" />
                          <div>
                            <h3 className="text-xl font-semibold text-white">{request.document_name}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">{request.document_type}</span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  request.status === 'assigned'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : request.status === 'in_progress'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}
                              >
                                {request.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Type</p>
                            <p className="text-white text-sm capitalize">{request.notarization_type}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Signers</p>
                            <p className="text-white text-sm">{request.signers?.length || 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Scheduled</p>
                            <p className="text-white text-sm">
                              {request.scheduled_time
                                ? new Date(request.scheduled_time).toLocaleString()
                                : 'Flexible'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleStartSession(request.id)}
                        className="bg-green-600 hover:bg-green-700 text-white ml-4"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        {request.status === 'assigned' ? 'Start Session' : 'Continue'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ))}
        </div>
      </div>
    </div>
  );
};

export default NotaryDashboard;