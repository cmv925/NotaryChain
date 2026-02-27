import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import {
  Shield, FileText, Clock, CheckCircle, Video, User, Calendar,
  TrendingUp, LogOut, XCircle, Eye, Copy, RefreshCw, AlertTriangle,
  DollarSign, Star, Award, BarChart3, Filter, Search, ChevronRight,
  Brain, ScanFace, Link2, ExternalLink, Download, Play, History,
  MessageSquare, Bell, Settings, Briefcase, CalendarClock, Sparkles,
  ClipboardList, ShieldAlert, Gauge, BookOpen
} from 'lucide-react';
import { Button } from '../components/ui/button';
import NotaryAvailabilitySettings from '../components/NotaryAvailabilitySettings';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { NotificationBell } from '../components/NotificationBell';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotaryDashboard = () => {
  const { user, logout, token } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [completedRequests, setCompletedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copilotData, setCopilotData] = useState(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [journalPrefill, setJournalPrefill] = useState(null);
  const [loadingJournal, setLoadingJournal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time: auto-refresh when new requests arrive or are assigned/completed
  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, pendingRes, assignedRes] = await Promise.all([
        axios.get(`${API}/notary/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/notary/requests/pending`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/notary/requests/assigned`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      setStats(statsRes.data);
      setPendingRequests(pendingRes.data);
      
      // Separate assigned into active and completed
      const assigned = assignedRes.data;
      setAssignedRequests(assigned.filter(r => r.status !== 'completed'));
      setCompletedRequests(assigned.filter(r => r.status === 'completed'));
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
      await axios.post(`${API}/notary/requests/${requestId}/assign`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast({ title: 'Success', description: 'Request assigned to you' });
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
      await axios.post(`${API}/video/rooms`, { notary_request_id: requestId }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast({ title: 'Session Created', description: 'Redirecting to video session...' });
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
        { notes: 'Notarization completed successfully', seal_package: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast({
        title: 'Notarization Complete',
        description: 'Document notarized and sealed on blockchain',
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

  const handleRejectRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    
    setProcessingAction(requestId);
    try {
      await axios.post(`${API}/notary/requests/${requestId}/reject`, {
        reason: 'Unable to process this request'
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast({ title: 'Request Rejected', description: 'The request has been released back to the pool' });
      setShowModal(false);
      setSelectedRequest(null);
      fetchDashboardData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const fetchAiAnalysis = async (requestId) => {
    setLoadingAi(true);
    try {
      const response = await axios.get(`${API}/ai/analysis/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAiAnalysis(response.data);
    } catch (error) {
      setAiAnalysis(null);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchCopilotAnalysis = async (requestId) => {
    setLoadingCopilot(true);
    setCopilotData(null);
    try {
      const response = await axios.post(`${API}/ai-copilot/analyze`, { request_id: requestId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCopilotData(response.data);
    } catch (error) {
      toast({ title: 'Copilot Error', description: 'Failed to get AI analysis', variant: 'destructive' });
    } finally {
      setLoadingCopilot(false);
    }
  };

  const fetchJournalPrefill = async (requestId) => {
    setLoadingJournal(true);
    setJournalPrefill(null);
    try {
      const response = await axios.post(`${API}/ai-copilot/prefill-journal`, { request_id: requestId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJournalPrefill(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to prefill journal', variant: 'destructive' });
    } finally {
      setLoadingJournal(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setShowModal(true);
    setAiAnalysis(null);
    fetchAiAnalysis(request.id);
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

  const getPriorityBadge = (request) => {
    const now = new Date();
    const scheduled = request.scheduled_time ? new Date(request.scheduled_time) : null;
    
    if (scheduled) {
      const hoursUntil = (scheduled - now) / (1000 * 60 * 60);
      if (hoursUntil < 0) return { label: 'Overdue', class: 'bg-red-500 text-white' };
      if (hoursUntil < 2) return { label: 'Urgent', class: 'bg-orange-500 text-white' };
      if (hoursUntil < 24) return { label: 'Today', class: 'bg-yellow-500 text-black' };
    }
    return null;
  };

  const filteredRequests = (requests) => {
    return requests.filter(r => {
      const matchesSearch = r.document_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           r.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  };

  // Calculate earnings estimate
  const estimatedEarnings = (stats?.total_completed || 0) * 25; // $25 per notarization
  const todayEarnings = completedRequests.filter(r => {
    const completed = new Date(r.completed_at || r.created_at);
    const today = new Date();
    return completed.toDateString() === today.toDateString();
  }).length * 25;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-[#00d4aa] animate-spin mx-auto mb-4" />
          <div className="text-white text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b border-[#333]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-[#00d4aa]" />
                <span className="text-lg sm:text-xl font-bold text-white">
                  Notary<span className="text-[#00d4aa]">Chain</span>
                </span>
              </div>
              <span className="text-gray-600 hidden sm:inline">|</span>
              <div className="hidden sm:flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#00d4aa]" />
                <span className="text-[#00d4aa] font-semibold">Notary Workstation</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell token={token} />
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                data-testid="refresh-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                size="sm"
                className="border-[#333] text-gray-300 hover:text-white hidden sm:flex"
              >
                User View
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-[#333] text-gray-300 hover:text-white hover:border-red-500"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-600/20 to-green-600/5 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Today's Earnings</p>
                  <p className="text-2xl font-bold text-white">${todayEarnings}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Total Completed</p>
                  <p className="text-2xl font-bold text-white">{stats?.total_completed || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">In Progress</p>
                  <p className="text-2xl font-bold text-white">{assignedRequests.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Available</p>
                  <p className="text-2xl font-bold text-white">{pendingRequests.length}</p>
                </div>
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#00d4aa]/20 to-[#00d4aa]/5 border-[#00d4aa]/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Lifetime Earnings</p>
                  <p className="text-2xl font-bold text-white">${estimatedEarnings}</p>
                </div>
                <Award className="w-8 h-8 text-[#00d4aa]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions Alert */}
        {assignedRequests.filter(r => r.status === 'in_progress').length > 0 && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-green-400 animate-pulse" />
              </div>
              <div>
                <p className="text-green-400 font-semibold">Active Session in Progress</p>
                <p className="text-gray-400 text-sm">
                  {assignedRequests.filter(r => r.status === 'in_progress').length} session(s) running
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                const activeSession = assignedRequests.find(r => r.status === 'in_progress');
                if (activeSession) navigate(`/session/${activeSession.id}`);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Rejoin Session
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Request Lists */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-1 bg-[#1a1a2e] p-1 rounded-lg">
                {[
                  { id: 'pending', label: 'Available', count: pendingRequests.length, color: 'purple' },
                  { id: 'assigned', label: 'My Requests', count: assignedRequests.length, color: 'blue' },
                  { id: 'history', label: 'History', count: completedRequests.length, color: 'green' },
                  { id: 'schedule', label: 'Schedule', count: null, color: 'amber' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.id
                        ? `bg-${tab.color}-500/20 text-${tab.color}-400`
                        : 'text-gray-400 hover:text-white hover:bg-[#333]/50'
                    }`}
                    data-testid={`${tab.id}-tab`}
                  >
                    {tab.label}
                    {tab.count !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? `bg-${tab.color}-500/30` : 'bg-gray-700'
                    }`}>
                      {tab.count}
                    </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search requests..."
                    className="pl-9 w-48 bg-[#1a1a2e] border-[#333] text-white"
                  />
                </div>
              </div>
            </div>

            {/* Request Cards */}
            <div className="space-y-3">
              {activeTab === 'pending' && (
                filteredRequests(pendingRequests).length === 0 ? (
                  <Card className="bg-[#1a1a2e] border-[#333]">
                    <CardContent className="p-12 text-center">
                      <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No available requests</p>
                      <p className="text-gray-500 text-sm">New notarization requests will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredRequests(pendingRequests).map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="pending"
                      onViewDetails={() => handleViewDetails(request)}
                      onAccept={() => handleAssignRequest(request.id)}
                      processingAction={processingAction}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  ))
                )
              )}

              {activeTab === 'assigned' && (
                filteredRequests(assignedRequests).length === 0 ? (
                  <Card className="bg-[#1a1a2e] border-[#333]">
                    <CardContent className="p-12 text-center">
                      <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No active requests</p>
                      <p className="text-gray-500 text-sm">Accept requests from the Available tab</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredRequests(assignedRequests).map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="assigned"
                      onViewDetails={() => handleViewDetails(request)}
                      onStartSession={() => handleStartSession(request.id)}
                      onComplete={() => handleCompleteNotarization(request.id)}
                      processingAction={processingAction}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  ))
                )
              )}

              {activeTab === 'history' && (
                filteredRequests(completedRequests).length === 0 ? (
                  <Card className="bg-[#1a1a2e] border-[#333]">
                    <CardContent className="p-12 text-center">
                      <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No completed notarizations</p>
                      <p className="text-gray-500 text-sm">Your completed work will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredRequests(completedRequests).map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="completed"
                      onViewDetails={() => handleViewDetails(request)}
                      onViewCertificate={() => navigate(`/certificate/${request.id}`)}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  ))
                )
              )}

              {activeTab === 'schedule' && (
                <div data-testid="schedule-tab-content">
                  <Card className="bg-[#1a1a2e] border-[#333] mb-4">
                    <CardContent className="p-4">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <CalendarClock className="w-5 h-5 text-amber-400" />
                        Booking Availability
                      </h2>
                      <p className="text-gray-400 text-sm mb-4">Set your weekly schedule and manage blocked dates. Clients can book sessions from the Marketplace.</p>
                      <NotaryAvailabilitySettings token={token} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Quick Info */}
          <div className="space-y-6">
            {/* Performance Card */}
            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#00d4aa]" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">This Week</span>
                    <span className="text-white">{Math.min(completedRequests.length, 7)} / 10</span>
                  </div>
                  <Progress value={Math.min(completedRequests.length, 7) * 10} className="h-2" />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-[#333]">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-gray-400 text-sm">Rating</span>
                  </div>
                  <span className="text-white font-semibold">4.9</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400 text-sm">Response Time</span>
                  </div>
                  <span className="text-green-400 font-semibold">&lt; 5 min</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start border-[#333] text-gray-300 hover:text-white"
                  onClick={() => navigate('/transactions')}
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Transaction Orchestrator
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-[#333] text-gray-300 hover:text-white"
                  onClick={() => navigate('/notary/journal')}
                  data-testid="notary-journal-link"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Notary Journal
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-[#333] text-gray-300 hover:text-white"
                  onClick={() => navigate('/notary/seal')}
                  data-testid="digital-seal-link"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Digital Seal
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-[#333] text-gray-300 hover:text-white"
                  onClick={() => setActiveTab('pending')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Browse Requests
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-[#333] text-gray-300 hover:text-white"
                  onClick={() => navigate('/notary/onboarding')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Pro Tip</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Complete identity verification before starting video sessions for smoother notarizations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Request Details Modal */}
      {showModal && selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          aiAnalysis={aiAnalysis}
          loadingAi={loadingAi}
          onClose={() => { setShowModal(false); setSelectedRequest(null); }}
          onAccept={() => handleAssignRequest(selectedRequest.id)}
          onStartSession={() => handleStartSession(selectedRequest.id)}
          onComplete={() => handleCompleteNotarization(selectedRequest.id)}
          onReject={() => handleRejectRequest(selectedRequest.id)}
          onViewCertificate={() => navigate(`/certificate/${selectedRequest.id}`)}
          processingAction={processingAction}
          getStatusBadge={getStatusBadge}
          copyToClipboard={copyToClipboard}
        />
      )}
    </div>
  );
};

// Request Card Component
const RequestCard = ({
  request,
  type,
  onViewDetails,
  onAccept,
  onStartSession,
  onComplete,
  onViewCertificate,
  processingAction,
  getPriorityBadge,
  getStatusBadge
}) => {
  const priority = getPriorityBadge(request);
  
  const borderColor = type === 'pending' ? 'hover:border-purple-500/50' :
                      type === 'assigned' ? 'hover:border-blue-500/50' :
                      'hover:border-green-500/50';
  
  const iconColor = type === 'pending' ? 'text-purple-500' :
                    type === 'assigned' ? 'text-blue-500' :
                    'text-green-500';

  return (
    <Card className={`bg-[#1a1a2e] border-[#333] ${borderColor} transition-all`} data-testid={`request-${request.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-lg bg-[#333] flex items-center justify-center flex-shrink-0`}>
            <FileText className={`w-6 h-6 ${iconColor}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold truncate">{request.document_name}</h3>
                  <Badge className={`${getStatusBadge(request.status)} text-xs`}>
                    {request.status?.replace('_', ' ')}
                  </Badge>
                  {priority && (
                    <Badge className={`${priority.class} text-xs`}>{priority.label}</Badge>
                  )}
                  {request.biometric_verified && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs">ID Verified</Badge>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1 capitalize">
                  {request.document_type?.replace('_', ' ')} • {request.notarization_type}
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={onViewDetails}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                
                {type === 'pending' && (
                  <Button
                    onClick={onAccept}
                    disabled={processingAction === request.id}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid={`accept-${request.id}`}
                  >
                    {processingAction === request.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                )}
                
                {type === 'assigned' && (
                  <>
                    <Button
                      onClick={onStartSession}
                      disabled={processingAction === request.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`start-session-${request.id}`}
                    >
                      <Video className="w-4 h-4 mr-1" />
                      {request.status === 'in_progress' ? 'Join' : 'Start'}
                    </Button>
                    {request.status === 'in_progress' && (
                      <Button
                        onClick={onComplete}
                        disabled={processingAction === request.id}
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                        data-testid={`complete-${request.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
                
                {type === 'completed' && onViewCertificate && (
                  <Button
                    onClick={onViewCertificate}
                    size="sm"
                    variant="outline"
                    className="border-[#00d4aa]/50 text-[#00d4aa] hover:bg-[#00d4aa]/20"
                  >
                    <Award className="w-4 h-4 mr-1" />
                    Certificate
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {request.signers?.length || 1} signer(s)
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {request.scheduled_time 
                  ? new Date(request.scheduled_time).toLocaleDateString()
                  : 'Flexible'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(request.created_at).toLocaleDateString()}
              </span>
              {request.hcs_topic_id && (
                <span className="flex items-center gap-1 text-[#00d4aa]">
                  <Link2 className="w-3 h-3" />
                  On-chain
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Request Detail Modal Component
const RequestDetailModal = ({
  request,
  aiAnalysis,
  loadingAi,
  onClose,
  onAccept,
  onStartSession,
  onComplete,
  onReject,
  onViewCertificate,
  processingAction,
  getStatusBadge,
  copyToClipboard
}) => {
  const isCompleted = request.status === 'completed';
  const isPending = request.status === 'pending';
  const isAssigned = request.status === 'assigned' || request.status === 'in_progress';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-xl border border-[#333] max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#333] flex items-center justify-between sticky top-0 bg-[#1a1a2e] z-10">
          <div>
            <h2 className="text-xl font-bold text-white">{request.document_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusBadge(request.status)}>
                {request.status?.replace('_', ' ')}
              </Badge>
              <span className="text-gray-400 text-sm capitalize">
                {request.document_type?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <XCircle className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Document Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0d1b2a] rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Type</p>
              <p className="text-white text-sm capitalize">{request.notarization_type}</p>
            </div>
            <div className="bg-[#0d1b2a] rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Signers</p>
              <p className="text-white text-sm">{request.signers?.length || 1}</p>
            </div>
            <div className="bg-[#0d1b2a] rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Scheduled</p>
              <p className="text-white text-sm">
                {request.scheduled_time
                  ? new Date(request.scheduled_time).toLocaleDateString()
                  : 'Flexible'}
              </p>
            </div>
            <div className="bg-[#0d1b2a] rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Created</p>
              <p className="text-white text-sm">{new Date(request.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Request ID */}
          <div className="bg-[#0d1b2a] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs mb-1">Request ID</p>
                <code className="text-[#00d4aa] text-sm">{request.id}</code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(request.id)}
                className="text-gray-400 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Signers */}
          {request.signers?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Signers ({request.signers.length})
              </h3>
              <div className="space-y-2">
                {request.signers.map((signer, idx) => (
                  <div key={idx} className="bg-[#0d1b2a] rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm">{signer.name || 'N/A'}</p>
                      <p className="text-gray-500 text-xs">{signer.email || 'No email'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Status */}
          <div>
            <h3 className="text-white font-semibold mb-3">Verification Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-4 border ${
                request.biometric_verified 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-[#0d1b2a] border-[#333]'
              }`}>
                <div className="flex items-center gap-2">
                  <ScanFace className={`w-5 h-5 ${request.biometric_verified ? 'text-green-400' : 'text-gray-500'}`} />
                  <span className={request.biometric_verified ? 'text-green-400' : 'text-gray-400'}>
                    {request.biometric_verified ? 'ID Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
              <div className={`rounded-lg p-4 border ${
                request.hcs_topic_id 
                  ? 'bg-[#00d4aa]/10 border-[#00d4aa]/30' 
                  : 'bg-[#0d1b2a] border-[#333]'
              }`}>
                <div className="flex items-center gap-2">
                  <Link2 className={`w-5 h-5 ${request.hcs_topic_id ? 'text-[#00d4aa]' : 'text-gray-500'}`} />
                  <span className={request.hcs_topic_id ? 'text-[#00d4aa]' : 'text-gray-400'}>
                    {request.hcs_topic_id ? 'Blockchain Ready' : 'Not On-chain'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              AI Document Analysis
            </h3>
            {loadingAi ? (
              <div className="bg-[#0d1b2a] rounded-lg p-6 text-center">
                <RefreshCw className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Loading analysis...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="bg-[#0d1b2a] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Document Type Detected</span>
                  <span className="text-white">{aiAnalysis.document_type || 'Unknown'}</span>
                </div>
                {aiAnalysis.signatures_detected !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Signatures Detected</span>
                    <span className="text-white">{aiAnalysis.signatures_detected}</span>
                  </div>
                )}
                {aiAnalysis.key_entities?.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-sm">Key Entities</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiAnalysis.key_entities.slice(0, 5).map((entity, idx) => (
                        <Badge key={idx} className="bg-purple-500/20 text-purple-400 text-xs">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0d1b2a] rounded-lg p-4 text-center">
                <Brain className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No analysis available</p>
              </div>
            )}
          </div>

          {/* Blockchain Info */}
          {request.hcs_topic_id && (
            <div className="bg-[#0d1b2a] rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#00d4aa]" />
                Blockchain Record
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">HCS Topic</span>
                  <code className="text-[#00d4aa] text-sm">{request.hcs_topic_id}</code>
                </div>
                {request.hcs_explorer_url && (
                  <a
                    href={request.hcs_explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-sm flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on HashScan
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div className="bg-[#0d1b2a] rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Notes</h3>
              <p className="text-gray-300 text-sm">{request.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#333]">
            {isPending && (
              <Button
                onClick={onAccept}
                disabled={processingAction === request.id}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {processingAction === request.id ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Accept Request
              </Button>
            )}
            
            {isAssigned && (
              <>
                <Button
                  onClick={onStartSession}
                  disabled={processingAction === request.id}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Video className="w-4 h-4 mr-2" />
                  {request.status === 'assigned' ? 'Start Session' : 'Join Session'}
                </Button>
                {request.status === 'in_progress' && (
                  <Button
                    onClick={onComplete}
                    disabled={processingAction === request.id}
                    className="bg-[#00d4aa] hover:bg-[#00b894] text-black"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete
                  </Button>
                )}
                <Button
                  onClick={onReject}
                  disabled={processingAction === request.id}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {isCompleted && (
              <Button
                onClick={onViewCertificate}
                className="flex-1 bg-[#00d4aa] hover:bg-[#00b894] text-black"
              >
                <Award className="w-4 h-4 mr-2" />
                View Certificate
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotaryDashboard;
