import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, FileText, Clock, CheckCircle, Video, RefreshCw,
  DollarSign, Star, Award, BarChart3, Search,
  History, Bell, Settings, Briefcase, CalendarClock,
  TrendingUp, Scale, Play,
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
import useNotaryData from '../hooks/useNotaryData';
import { useTranslation } from 'react-i18next';

// ─── Local helpers (UI-only, no data) ─────────────────────────────
const STATUS_BADGE = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  assigned: 'bg-coral-500/20 text-coral-500 border-coral-300/30',
  in_progress: 'bg-navy-600/20 text-navy-500 border-navy-300/30',
  reviewing: 'bg-coral-500/20 text-coral-600 border-coral-200',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};
const getStatusBadge = (status) => STATUS_BADGE[status] || STATUS_BADGE.pending;

const getPriorityBadge = (request) => {
  if (!request.scheduled_time) return null;
  const hoursUntil = (new Date(request.scheduled_time) - new Date()) / (1000 * 60 * 60);
  if (hoursUntil < 0) return { label: 'Overdue', class: 'bg-red-500 text-navy-900' };
  if (hoursUntil < 2) return { label: 'Urgent', class: 'bg-coral-500 text-navy-900' };
  if (hoursUntil < 24) return { label: 'Today', class: 'bg-yellow-500 text-black' };
  return null;
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  toast({ title: 'Copied', description: 'Copied to clipboard' });
};

/**
 * Assurance Portal (notary) — pure page composition.
 * All data fetching, mutations, and WebSocket subscriptions live in
 * `useNotaryData`. This component only owns local UI state (active tab,
 * search / filter inputs) and wires the hook into focused sub-components.
 */
const NotaryDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, flags, actions } = useNotaryData();

  // ─── Local UI state ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredRequests = (requests) =>
    requests.filter((r) => {
      const matchesSearch =
        r.document_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

  if (flags.loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-coral-600 animate-spin mx-auto mb-4" />
          <div className="text-navy-900 text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const activeSessions = data.assignedRequests.filter((r) => r.status === 'in_progress');

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
                onClick={actions.fetchDashboardData}
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
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6"
          data-testid="notary-stats-grid"
        >
          <StatCard
            tone="green"
            icon={DollarSign}
            label={t('notary.todays_earnings')}
            value={`$${data.todayEarnings}`}
          />
          <StatCard
            tone="coral"
            icon={CheckCircle}
            label={t('notary.total_completed')}
            value={data.stats?.total_completed || 0}
          />
          <StatCard
            tone="yellow"
            icon={Clock}
            label={t('notary.in_progress')}
            value={data.assignedRequests.length}
          />
          <StatCard
            tone="navy"
            icon={FileText}
            label={t('notary.available_label')}
            value={data.pendingRequests.length}
          />
          <StatCard
            tone="coral-soft"
            icon={Award}
            label={t('notary.lifetime_earnings')}
            value={`$${data.estimatedEarnings}`}
          />
        </div>

        {/* Active Sessions Alert */}
        {activeSessions.length > 0 && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-green-400 animate-pulse" />
              </div>
              <div>
                <p className="text-green-400 font-semibold">{t('notary.active_session')}</p>
                <p className="text-slate-500 text-sm">
                  {activeSessions.length} {t('notary.sessions_running')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/session/${activeSessions[0].id}`)}
              className="bg-green-600 hover:bg-green-700 text-navy-900"
            >
              <Play className="w-4 h-4 mr-2" />
              {t('notary.rejoin')}
            </Button>
          </div>
        )}

        <Breadcrumbs
          items={[
            { label: 'Home', path: '/' },
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Assurance Portal' },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel — Request Lists */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-1 bg-white p-1 rounded-lg" data-testid="notary-tabs-nav">
                {[
                  { id: 'pending',  label: t('notary.tab_available'),  count: data.pendingRequests.length,  color: 'purple' },
                  { id: 'assigned', label: t('notary.tab_my_requests'), count: data.assignedRequests.length, color: 'blue' },
                  { id: 'history',  label: t('notary.tab_history'),    count: data.completedRequests.length, color: 'green' },
                  { id: 'schedule', label: t('notary.tab_schedule'),   count: null,                          color: 'amber' },
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
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeTab === tab.id ? `bg-${tab.color}-500/30` : 'bg-gray-700'
                        }`}
                      >
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
                <RequestList
                  requests={filteredRequests(data.pendingRequests)}
                  emptyIcon={FileText}
                  emptyTitle={t('notary.no_available')}
                  emptySubtitle={t('notary.new_requests_appear')}
                >
                  {(request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="pending"
                      onViewDetails={() => actions.openRequest(request)}
                      onAccept={() => actions.handleAssignRequest(request.id)}
                      processingAction={data.processingAction}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  )}
                </RequestList>
              )}

              {activeTab === 'assigned' && (
                <RequestList
                  requests={filteredRequests(data.assignedRequests)}
                  emptyIcon={Briefcase}
                  emptyTitle="No active requests"
                  emptySubtitle="Accept requests from the Available tab"
                >
                  {(request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="assigned"
                      onViewDetails={() => actions.openRequest(request)}
                      onStartSession={() => actions.handleStartSession(request.id)}
                      onComplete={() => actions.handleCompleteNotarization(request.id)}
                      processingAction={data.processingAction}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  )}
                </RequestList>
              )}

              {activeTab === 'history' && (
                <RequestList
                  requests={filteredRequests(data.completedRequests)}
                  emptyIcon={History}
                  emptyTitle="No completed notarizations"
                  emptySubtitle="Your completed work will appear here"
                >
                  {(request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="completed"
                      onViewDetails={() => actions.openRequest(request)}
                      onViewCertificate={() => navigate(`/certificate/${request.id}`)}
                      getPriorityBadge={getPriorityBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  )}
                </RequestList>
              )}

              {activeTab === 'schedule' && (
                <div data-testid="schedule-tab-content">
                  <Card className="bg-white border-slate-200 mb-4">
                    <CardContent className="p-4">
                      <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
                        <CalendarClock className="w-5 h-5 text-coral-600" />
                        Booking Availability
                      </h2>
                      <p className="text-slate-500 text-sm mb-4">
                        Set your weekly schedule and manage blocked dates. Clients can book sessions from the Marketplace.
                      </p>
                      <NotaryAvailabilitySettings token={token} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Quick Info */}
          <NotaryQuickPanel
            completedCount={data.completedRequests.length}
            onBrowseRequests={() => setActiveTab('pending')}
            navigate={navigate}
          />
        </div>
      </div>

      {/* Request Details Modal */}
      {data.selectedRequest && (
        <RequestDetailModal
          request={data.selectedRequest}
          aiAnalysis={data.aiAnalysis}
          loadingAi={flags.loadingAi}
          copilotData={data.copilotData}
          loadingCopilot={flags.loadingCopilot}
          onRunCopilot={() => actions.fetchCopilotAnalysis(data.selectedRequest.id)}
          journalPrefill={data.journalPrefill}
          loadingJournal={flags.loadingJournal}
          onPrefillJournal={() => actions.fetchJournalPrefill(data.selectedRequest.id)}
          onClose={actions.closeRequest}
          onAccept={() => actions.handleAssignRequest(data.selectedRequest.id)}
          onStartSession={() => actions.handleStartSession(data.selectedRequest.id)}
          onComplete={() => actions.handleCompleteNotarization(data.selectedRequest.id)}
          onReject={() => actions.handleRejectRequest(data.selectedRequest.id)}
          onViewCertificate={() => navigate(`/certificate/${data.selectedRequest.id}`)}
          processingAction={data.processingAction}
          getStatusBadge={getStatusBadge}
          copyToClipboard={copyToClipboard}
        />
      )}
      <OnboardingTour portal="assurance" />
    </div>
  );
};

// ─── Local sub-components ─────────────────────────────────────────

function StatCard({ tone, icon: Icon, label, value }) {
  const palettes = {
    green: 'from-green-600/20 to-green-600/5 border-green-500/30',
    coral: 'from-coral-500/20 to-coral-600/5 border-coral-300/30',
    yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30',
    navy: 'from-navy-700/20 to-navy-700/5 border-navy-300/30',
    'coral-soft': 'from-coral-500/20 to-coral-500/5 border-coral-500/30',
  };
  const iconColors = {
    green: 'text-green-400',
    coral: 'text-coral-500',
    yellow: 'text-yellow-400',
    navy: 'text-navy-500',
    'coral-soft': 'text-coral-600',
  };
  return (
    <Card className={`bg-gradient-to-br ${palettes[tone]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs">{label}</p>
            <p className="text-2xl font-bold text-navy-900">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${iconColors[tone]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function RequestList({ requests, emptyIcon: EmptyIcon, emptyTitle, emptySubtitle, children }) {
  if (requests.length === 0) {
    return (
      <Card className="bg-white border-slate-200">
        <CardContent className="p-12 text-center">
          <EmptyIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 text-lg mb-2">{emptyTitle}</p>
          <p className="text-slate-500 text-sm">{emptySubtitle}</p>
        </CardContent>
      </Card>
    );
  }
  return <>{requests.map((r) => children(r))}</>;
}

function NotaryQuickPanel({ completedCount, onBrowseRequests, navigate }) {
  return (
    <div className="space-y-6">
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
              <span className="text-navy-900">{Math.min(completedCount, 7)} / 10</span>
            </div>
            <Progress value={Math.min(completedCount, 7) * 10} className="h-2" />
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

      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-navy-900 text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <QuickActionBtn icon={Briefcase} label="Transaction Orchestrator" onClick={() => navigate('/transactions')} />
          <QuickActionBtn icon={FileText} label="Notary Journal" testid="notary-journal-link" onClick={() => navigate('/notary/journal')} />
          <QuickActionBtn icon={Shield} label="Digital Seal" testid="digital-seal-link" onClick={() => navigate('/notary/seal')} />
          <QuickActionBtn icon={FileText} label="Browse Requests" onClick={onBrowseRequests} />
          <QuickActionBtn icon={Settings} label="Update Profile" onClick={() => navigate('/notary/onboarding')} />
        </CardContent>
      </Card>

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
  );
}

function QuickActionBtn({ icon: Icon, label, testid, onClick }) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start border-slate-200 text-slate-500 hover:text-navy-900"
      onClick={onClick}
      data-testid={testid}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}

export default NotaryDashboard;
