import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import {
  Shield, FileText, Clock, CheckCircle, Video, RefreshCw,
  DollarSign, Star, Award, BarChart3, Search,
  History, Bell, Settings, Briefcase, CalendarClock,
  TrendingUp, Scale, Play
} from 'lucide-react';
import { Button } from '../components/ui/button';
import NotaryAvailabilitySettings from '../components/NotaryAvailabilitySettings';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { NotificationBell } from '../components/NotificationBell';
import UserDropdown from '../components/UserDropdown';
import { OnboardingTour } from '../components/OnboardingTour';
import RequestCard from '../components/notary/RequestCard';
import RequestDetailModal from '../components/notary/RequestDetailModal';
import { toast } from '../hooks/use-toast';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotaryDashboard = () => {
  const { user, logout, token } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, []);

  // Real-time: auto-refresh when new requests arrive or are assigned/completed
  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [subscribe]);

  const fetchDashboardData = async () => {
    try {
      // Try notary endpoints first; gracefully fall back to client-side data for non-notary users
      const [statsRes, pendingRes, assignedRes, myReqsRes] = await Promise.all([
        axios.get(`${API}/notary/stats`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => ({ data: { is_notary: false } })),
        axios.get(`${API}/notary/requests/pending`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => ({ data: [] })),
        axios.get(`${API}/notary/requests/assigned`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => ({ data: [] })),
        axios.get(`${API}/notary/requests/my`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => ({ data: [] })),
      ]);

      const isNotary = !!statsRes.data?.is_notary;
      setStats(statsRes.data);

      if (isNotary) {
        // Notary view: pending queue + assigned-to-me
        setPendingRequests(pendingRes.data);
        const assigned = assignedRes.data;
        setAssignedRequests(assigned.filter(r => r.status !== 'completed'));
        setCompletedRequests(assigned.filter(r => r.status === 'completed'));
      } else {
        // Regular user view: their own client-side notarization requests
        const myReqs = myReqsRes.data || [];
        setPendingRequests(myReqs.filter(r => ['pending', 'submitted', 'reviewing'].includes(r.status)));
        setAssignedRequests(myReqs.filter(r => ['assigned', 'in_progress'].includes(r.status)));
        setCompletedRequests(myReqs.filter(r => r.status === 'completed'));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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
    setCopilotData(null);
    setJournalPrefill(null);
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
      assigned: 'bg-coral-500/20 text-coral-500 border-coral-300/30',
      in_progress: 'bg-navy-600/20 text-navy-500 border-navy-300/30',
      reviewing: 'bg-coral-500/20 text-coral-600 border-coral-200',
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
      if (hoursUntil < 0) return { label: 'Overdue', class: 'bg-red-500 text-navy-900' };
      if (hoursUntil < 2) return { label: 'Urgent', class: 'bg-coral-500 text-navy-900' };
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
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-coral-600 animate-spin mx-auto mb-4" />
          <div className="text-navy-900 text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-white to-cream-200 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-coral-600" />
                <span className="text-lg sm:text-xl font-bold text-navy-900">
                  Notary<span className="text-coral-600">Chain</span>
                </span>
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <div className="hidden sm:flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-coral-600" />
                <span className="text-coral-600 font-semibold inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-navy-700" />
                  {t('notary.workstation')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell token={token} />
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-navy-900"
                data-testid="refresh-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-500 hover:text-navy-900 hidden sm:flex"
              >
                {t('notary.user_view')}
              </Button>
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6" data-testid="notary-stats-grid">
          <Card className="bg-gradient-to-br from-green-600/20 to-green-600/5 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('notary.todays_earnings')}</p>
                  <p className="text-2xl font-bold text-navy-900">${todayEarnings}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-coral-500/20 to-coral-600/5 border-coral-300/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('notary.total_completed')}</p>
                  <p className="text-2xl font-bold text-navy-900">{stats?.total_completed || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-coral-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('notary.in_progress')}</p>
                  <p className="text-2xl font-bold text-navy-900">{assignedRequests.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-navy-700/20 to-navy-700/5 border-navy-300/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('notary.available_label')}</p>
                  <p className="text-2xl font-bold text-navy-900">{pendingRequests.length}</p>
                </div>
                <FileText className="w-8 h-8 text-navy-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-coral-500/20 to-coral-500/5 border-coral-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-xs">{t('notary.lifetime_earnings')}</p>
                  <p className="text-2xl font-bold text-navy-900">${estimatedEarnings}</p>
                </div>
                <Award className="w-8 h-8 text-coral-600" />
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
                <p className="text-green-400 font-semibold">{t('notary.active_session')}</p>
                <p className="text-slate-500 text-sm">
                  {assignedRequests.filter(r => r.status === 'in_progress').length} {t('notary.sessions_running')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                const activeSession = assignedRequests.find(r => r.status === 'in_progress');
                if (activeSession) navigate(`/session/${activeSession.id}`);
              }}
              className="bg-green-600 hover:bg-green-700 text-navy-900"
            >
              <Play className="w-4 h-4 mr-2" />
              {t('notary.rejoin')}
            </Button>
          </div>
        )}

        {/* Main Content */}
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Assurance Portal' }]} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Request Lists */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-1 bg-white p-1 rounded-lg" data-testid="notary-tabs-nav">
                {[
                  { id: 'pending', label: t('notary.tab_available'), count: pendingRequests.length, color: 'purple' },
                  { id: 'assigned', label: t('notary.tab_my_requests'), count: assignedRequests.length, color: 'blue' },
                  { id: 'history', label: t('notary.tab_history'), count: completedRequests.length, color: 'green' },
                  { id: 'schedule', label: t('notary.tab_schedule'), count: null, color: 'amber' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.id
                        ? `bg-${tab.color}-500/20 text-${tab.color}-400`
                        : 'text-slate-500 hover:text-navy-900 hover:bg-slate-200/50'
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('notary.search_requests')}
                    className="pl-9 w-48 bg-white border-slate-200 text-navy-900"
                  />
                </div>
              </div>
            </div>

            {/* Request Cards */}
            <div className="space-y-3">
              {activeTab === 'pending' && (
                filteredRequests(pendingRequests).length === 0 ? (
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-12 text-center">
                      <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-500 text-lg mb-2">{t('notary.no_available')}</p>
                      <p className="text-slate-500 text-sm">{t('notary.new_requests_appear')}</p>
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
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-12 text-center">
                      <Briefcase className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-500 text-lg mb-2">No active requests</p>
                      <p className="text-slate-500 text-sm">Accept requests from the Available tab</p>
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
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-12 text-center">
                      <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-500 text-lg mb-2">No completed notarizations</p>
                      <p className="text-slate-500 text-sm">Your completed work will appear here</p>
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
                  <Card className="bg-white border-slate-200 mb-4">
                    <CardContent className="p-4">
                      <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
                        <CalendarClock className="w-5 h-5 text-coral-600" />
                        Booking Availability
                      </h2>
                      <p className="text-slate-500 text-sm mb-4">Set your weekly schedule and manage blocked dates. Clients can book sessions from the Marketplace.</p>
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
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-coral-600" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">This Week</span>
                    <span className="text-navy-900">{Math.min(completedRequests.length, 7)} / 10</span>
                  </div>
                  <Progress value={Math.min(completedRequests.length, 7) * 10} className="h-2" />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-slate-500 text-sm">Rating</span>
                  </div>
                  <span className="text-navy-900 font-semibold">4.9</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-slate-500 text-sm">Response Time</span>
                  </div>
                  <span className="text-green-400 font-semibold">&lt; 5 min</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-navy-900 text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
                  onClick={() => navigate('/transactions')}
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Transaction Orchestrator
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
                  onClick={() => navigate('/notary/journal')}
                  data-testid="notary-journal-link"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Notary Journal
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
                  onClick={() => navigate('/notary/seal')}
                  data-testid="digital-seal-link"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Digital Seal
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
                  onClick={() => setActiveTab('pending')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Browse Requests
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
                  onClick={() => navigate('/notary/onboarding')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-gradient-to-br from-coral-500/10 to-navy-700/10 border-coral-300/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-coral-500" />
                  </div>
                  <div>
                    <p className="text-navy-900 text-sm font-medium">Pro Tip</p>
                    <p className="text-slate-500 text-xs mt-1">
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
          copilotData={copilotData}
          loadingCopilot={loadingCopilot}
          onRunCopilot={() => fetchCopilotAnalysis(selectedRequest.id)}
          journalPrefill={journalPrefill}
          loadingJournal={loadingJournal}
          onPrefillJournal={() => fetchJournalPrefill(selectedRequest.id)}
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
      <OnboardingTour portal="assurance" />
    </div>
  );
};

export default NotaryDashboard;
