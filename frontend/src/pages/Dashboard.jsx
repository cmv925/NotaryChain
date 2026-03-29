import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { Shield, FileText, Clock, TrendingUp, LogOut, Upload, ExternalLink, Copy, Video, Play, ChevronDown, ChevronUp, Settings, CreditCard, Lock, Code, BookOpen, Building2, Save, CalendarClock, Layers, Users, Wand2, FileSearch, Fingerprint, Sparkles, Bell, GitCompareArrows, Palette, UserCheck, Sun, Moon, Brain, Scale, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import { NotificationBell } from '../components/NotificationBell';
import { ExpiryWidget, ExpiryBadge, SetExpiryButton } from '../components/ExpiryTracker';
import BlockchainAuditTrail from '../components/BlockchainAuditTrail';
import { OnboardingTour } from '../components/OnboardingTour';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ total_seals: 0, recent_seals: 0 });
  const [documents, setDocuments] = useState([]);
  const [notaryRequests, setNotaryRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRequest, setExpandedRequest] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh dashboard when real-time events arrive
  useEffect(() => {
    const unsub1 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub2 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); };
  }, [subscribe]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, docsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/documents/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/documents/seals?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/notary/requests/my`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: [] })), // Gracefully handle if no requests
      ]);

      setStats(statsRes.data);
      setDocuments(docsRes.data);
      setNotaryRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out',
    });
    navigate('/');
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: 'Copied!',
      description: 'Hash copied to clipboard',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
                <span className="text-lg sm:text-xl font-bold text-white">
                  Notary<span className="text-blue-500">Chain</span>
                </span>
              </div>
              <span className="text-gray-400 hidden sm:inline">|</span>
              <span className="text-gray-400 hidden sm:inline">{t('dashboard.title')}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-white font-semibold text-sm">{user?.full_name}</div>
                <div className="text-gray-400 text-xs">{user?.email}</div>
              </div>
              <NotificationBell token={token} />
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button
                onClick={() => navigate('/subscription')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-purple-500 hidden sm:flex"
                data-testid="subscription-button"
              >
                <CreditCard className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">Plan</span>
              </Button>
              <Button
                onClick={() => navigate('/settings/security')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 hidden sm:flex"
                data-testid="security-settings-button"
              >
                <Settings className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">Security</span>
              </Button>
              <Button
                onClick={() => navigate('/compliance')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-green-500 hidden sm:flex"
                data-testid="compliance-button"
              >
                <Lock className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">Privacy</span>
              </Button>
              <Button
                onClick={() => navigate('/developers')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-purple-500 hidden sm:flex"
                data-testid="developer-button"
              >
                <Code className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">API</span>
              </Button>
              <Button
                onClick={() => navigate('/organizations')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-teal-500 hidden sm:flex"
                data-testid="org-button"
              >
                <Building2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">Org</span>
              </Button>
              <Button
                onClick={() => navigate('/my-drafts')}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-amber-500 hidden sm:flex"
                data-testid="drafts-button"
              >
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden lg:inline">Drafts</span>
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-red-500"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Seals</p>
                  <p className="text-4xl font-bold text-white">{stats.total_seals}</p>
                </div>
                <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Last 30 Days</p>
                  <p className="text-4xl font-bold text-white">{stats.recent_seals}</p>
                </div>
                <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Member Since</p>
                  <p className="text-xl font-bold text-white">
                    {new Date(stats.user_since).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Clock className="w-7 h-7 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Button
              onClick={() => navigate('/demo')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-6 text-lg justify-start"
            >
              <Upload className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Quick Seal</div>
                <div className="text-sm text-blue-200">Instant blockchain timestamp</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/request-notarization')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-6 text-lg justify-start"
            >
              <FileText className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Request Notarization</div>
                <div className="text-sm text-green-200">Full notary service</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/ceremony')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-6 text-lg justify-start"
              data-testid="ceremony-mode-button"
            >
              <Shield className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Ceremony Mode</div>
                <div className="text-sm text-blue-200">Multi-agent verification</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/templates')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-6 text-lg justify-start"
              data-testid="templates-button"
            >
              <BookOpen className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Templates</div>
                <div className="text-sm text-purple-200">Pre-built legal docs</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/notary/onboarding')}
              variant="outline"
              className="border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 px-6 py-6 text-lg justify-start"
            >
              <Shield className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Become a Notary</div>
                <div className="text-sm text-purple-300">Join our network</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/bulk-notarization')}
              variant="outline"
              className="border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 px-6 py-6 text-lg justify-start"
              data-testid="bulk-notarization-button"
            >
              <Layers className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Bulk Notarization</div>
                <div className="text-sm text-cyan-300">Multiple docs at once</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/marketplace')}
              variant="outline"
              className="border-2 border-amber-500 text-amber-400 hover:bg-amber-500/10 px-6 py-6 text-lg justify-start"
              data-testid="marketplace-button"
            >
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Find Notaries</div>
                <div className="text-sm text-amber-300">Browse marketplace</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/my-bookings')}
              variant="outline"
              className="border-2 border-teal-500 text-teal-400 hover:bg-teal-500/10 px-6 py-6 text-lg justify-start"
              data-testid="my-bookings-button"
            >
              <CalendarClock className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">My Bookings</div>
                <div className="text-sm text-teal-300">View appointments</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/ai-generator')}
              variant="outline"
              className="border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 px-6 py-6 text-lg justify-start"
              data-testid="ai-generator-button"
            >
              <Wand2 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">AI Doc Generator</div>
                <div className="text-sm text-purple-300">Create docs with AI</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/ai-summarizer')}
              variant="outline"
              className="border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 px-6 py-6 text-lg justify-start"
              data-testid="ai-summarizer-button"
            >
              <FileSearch className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">AI Summarizer</div>
                <div className="text-sm text-emerald-300">Summarize any document</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/video-witness')}
              variant="outline"
              className="border-2 border-rose-500 text-rose-400 hover:bg-rose-500/10 px-6 py-6 text-lg justify-start"
              data-testid="video-witness-button"
            >
              <Video className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Video Witness</div>
                <div className="text-sm text-rose-300">Record verification video</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/document-remediation')}
              variant="outline"
              className="border-2 border-amber-500 text-amber-400 hover:bg-amber-500/10 px-6 py-6 text-lg justify-start"
              data-testid="doc-remediation-button"
            >
              <Sparkles className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Doc Remediation</div>
                <div className="text-sm text-amber-300">Fix missing legal clauses</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/biometric-passport')}
              variant="outline"
              className="border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 px-6 py-6 text-lg justify-start"
              data-testid="biometric-passport-button"
            >
              <Fingerprint className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Biometric Passport</div>
                <div className="text-sm text-cyan-300">Multi-modal identity</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/reminders')}
              variant="outline"
              className="border-2 border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 px-6 py-6 text-lg justify-start"
              data-testid="reminders-button"
            >
              <Bell className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Reminders</div>
                <div className="text-sm text-yellow-300">Alerts & calendar</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/approvals')}
              variant="outline"
              className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/10 px-6 py-6 text-lg justify-start"
              data-testid="approvals-button"
            >
              <UserCheck className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Approvals</div>
                <div className="text-sm text-blue-300">Multi-step workflows</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/doc-compare')}
              variant="outline"
              className="border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 px-6 py-6 text-lg justify-start"
              data-testid="doc-compare-button"
            >
              <GitCompareArrows className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Doc Compare</div>
                <div className="text-sm text-orange-300">AI diff analysis</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/branding')}
              variant="outline"
              className="border-2 border-pink-500 text-pink-400 hover:bg-pink-500/10 px-6 py-6 text-lg justify-start"
              data-testid="branding-button"
            >
              <Palette className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Branding</div>
                <div className="text-sm text-pink-300">Custom appearance</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/anan')}
              className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700 text-white px-6 py-6 text-lg justify-start"
              data-testid="anan-button"
            >
              <Brain className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">ANAN Network</div>
                <div className="text-sm text-cyan-200">AI Agent Swarm</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/escrow')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-6 text-lg justify-start"
              data-testid="escrow-button"
            >
              <Scale className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Escrow Intelligence</div>
                <div className="text-sm text-emerald-200">AI-powered escrow</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/fraud-intelligence')}
              variant="outline"
              className="border-2 border-red-500 text-red-400 hover:bg-red-500/10 px-6 py-6 text-lg justify-start"
              data-testid="fraud-intel-button"
            >
              <ShieldAlert className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Fraud Intelligence</div>
                <div className="text-sm text-red-300">Threat patterns & RON</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Document Expiry Tracker */}
        <ExpiryWidget token={token} />

        {/* Notary Requests Section */}
        {notaryRequests.length > 0 && (
          <Card className="bg-[#1a2332] border-gray-800 mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-500" />
                My Notarization Requests
              </h2>
              <div className="space-y-4">
                {notaryRequests.slice(0, 5).map((request) => (
                  <div key={request.id}>
                    <div
                      className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800 hover:border-blue-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            request.status === 'pending' ? 'bg-yellow-500/20' :
                            request.status === 'in_session' ? 'bg-green-500/20' :
                            request.status === 'completed' ? 'bg-blue-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            {request.status === 'in_session' ? (
                              <Video className="w-5 h-5 text-green-500" />
                            ) : (
                              <FileText className={`w-5 h-5 ${
                                request.status === 'pending' ? 'text-yellow-500' :
                                request.status === 'completed' ? 'text-blue-500' :
                                'text-gray-500'
                              }`} />
                            )}
                          </div>
                          <div>
                            <h4 className="text-white font-semibold">{request.document_name}</h4>
                            <p className="text-gray-400 text-sm">
                              {request.document_type} • {new Date(request.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <ExpiryBadge request={request} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0 ml-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            request.status === 'in_session' ? 'bg-green-500/20 text-green-400' :
                            request.status === 'assigned' ? 'bg-blue-500/20 text-blue-400' :
                            request.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {request.status?.replace('_', ' ')}
                          </span>
                          
                          {/* View Audit Trail Button */}
                          {request.hcs_topic_id && (
                            <Button
                              onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                              size="sm"
                              variant="outline"
                              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                              data-testid={`audit-trail-btn-${request.id}`}
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              Audit Trail
                              {expandedRequest === request.id ? (
                                <ChevronUp className="w-4 h-4 ml-1" />
                              ) : (
                                <ChevronDown className="w-4 h-4 ml-1" />
                              )}
                            </Button>
                          )}
                          
                          {(request.status === 'pending' || request.status === 'assigned' || request.status === 'in_session') && (
                            <Button
                              onClick={() => navigate(`/session/${request.id}`)}
                              size="sm"
                              className={request.status === 'in_session' 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'bg-blue-600 hover:bg-blue-700'
                              }
                            >
                              {request.status === 'in_session' ? (
                                <>
                                  <Play className="w-4 h-4 mr-1" />
                                  Join Session
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4 mr-1" />
                                  Start Session
                                </>
                              )}
                            </Button>
                          )}
                          <SetExpiryButton
                            requestId={request.id}
                            currentExpiry={request.expires_at}
                            token={token}
                            onUpdate={fetchDashboardData}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Audit Trail */}
                    {expandedRequest === request.id && request.hcs_topic_id && (
                      <div className="mt-2 ml-4">
                        <BlockchainAuditTrail 
                          topicId={request.hcs_topic_id}
                          token={token}
                          requestId={request.id}
                          title={`Audit Trail: ${request.document_name}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Documents */}
        <Card className="bg-[#1a2332] border-gray-800">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Document Seals</h2>

            {documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-4">No documents sealed yet</p>
                <Button
                  onClick={() => navigate('/demo')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Seal Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-[#0a0f1a] rounded-lg p-5 border border-gray-800 hover:border-blue-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold mb-1">{doc.file_name}</h3>
                          <p className="text-gray-400 text-sm mb-3">
                            {doc.file_size} • {new Date(doc.timestamp).toLocaleString()}
                          </p>
                          
                          <div className="space-y-2">
                            <div>
                              <label className="text-gray-500 text-xs block mb-1">SHA-256 Hash</label>
                              <div className="flex items-center gap-2">
                                <code className="text-blue-400 text-xs bg-[#1a2332] px-2 py-1 rounded flex-1 overflow-hidden overflow-ellipsis">
                                  {doc.sha256_hash}
                                </code>
                                <button
                                  onClick={() => copyHash(doc.sha256_hash)}
                                  className="text-gray-400 hover:text-white p-1"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-gray-500 text-xs block mb-1">Transaction ID</label>
                              <div className="flex items-center gap-2">
                                <code className="text-green-400 text-xs bg-[#1a2332] px-2 py-1 rounded">
                                  {doc.transaction_id}
                                </code>
                                <a
                                  href={`https://hashscan.io/mainnet/transaction/${doc.transaction_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-white p-1"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <OnboardingTour />
    </div>
  );
};

export default Dashboard;
