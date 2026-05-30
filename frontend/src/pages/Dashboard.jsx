import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { Shield, ShieldCheck, FileText, Clock, TrendingUp, LogOut, Upload, ExternalLink, Copy, Video, Play, ChevronDown, ChevronUp, Settings, CreditCard, Lock, Code, BookOpen, Building2, Save, CalendarClock, Layers, Users, Wand2, FileSearch, Fingerprint, Sparkles, Bell, GitCompareArrows, Palette, UserCheck, Sun, Moon, Brain, Scale, ShieldAlert, ChevronRight, FileCheck, Search, Hammer, RotateCcw, Timer, Globe, Coins, Activity, Vault, Network, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { toast } from '../hooks/use-toast';
import { NotificationBell } from '../components/NotificationBell';
import { ExpiryWidget, ExpiryBadge, SetExpiryButton } from '../components/ExpiryTracker';
import BlockchainAuditTrail from '../components/BlockchainAuditTrail';
import StatePickabilityWidget from '../components/StatePickabilityWidget';
import DashboardHero from '../components/DashboardHero';
import NextActionCard from '../components/NextActionCard';
import { OnboardingTour } from '../components/OnboardingTour';
import EnhancedKBAFlow from '../components/EnhancedKBAFlow';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ─── Bento Action Button ───
function BentoAction({ icon: Icon, label, desc, onClick, accent, ...props }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 w-full p-2.5 text-sm rounded-md transition-all duration-200 text-left border border-transparent ${
        accent
          ? 'bg-coral-50/60 hover:bg-coral-50 hover:border-coral-200'
          : 'hover:bg-slate-50 hover:border-slate-200'
      }`}
      {...props}
    >
      <div className={`flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md transition-colors ${
        accent
          ? 'bg-coral-100 text-coral-600'
          : 'bg-white border border-slate-200 text-slate-600 group-hover:text-navy-900 group-hover:border-slate-300'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className={`font-medium text-sm block truncate ${accent ? 'text-coral-900' : 'text-navy-800'}`}>{label}</span>
        {desc && <span className="text-slate-500 text-[10px] block truncate mt-0.5">{desc}</span>}
      </div>
      <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${accent ? 'text-coral-400' : 'text-slate-400'}`} />
    </button>
  );
}

const Dashboard = () => {
  const { user, logout, token, refreshUser } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useTranslation();

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isNotary = role === 'notary';
  const isUser = !isAdmin && !isNotary;
  const identityVerified = !!user?.identity_verified;
  const [showKBA, setShowKBA] = useState(false);
  const [stats, setStats] = useState({ total_seals: 0, recent_seals: 0 });
  const [documents, setDocuments] = useState([]);
  const [notaryRequests, setNotaryRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRequest, setExpandedRequest] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, []);

  useEffect(() => {
    const unsub1 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub2 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [subscribe]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, docsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/documents/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/documents/seals?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/notary/requests/my`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setDocuments(docsRes.data);
      setNotaryRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been successfully logged out' });
    navigate('/');
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    toast({ title: 'Copied!', description: 'Hash copied to clipboard' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-navy-900 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/95 border-b border-slate-200 px-6 py-4" data-testid="dashboard-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <Shield className="w-7 h-7 text-coral-600" />
            <span className="text-lg font-bold text-navy-900 tracking-tight">
              Notary<span className="text-coral-600">Chain</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell token={token} />
            <Button onClick={toggleTheme} variant="ghost" size="icon" className="text-slate-600 hover:text-navy-900" data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-cream-200/50 transition-all" data-testid="user-menu-trigger">
                  <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-cream-100 text-xs font-bold">
                    {user?.full_name?.[0] || 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-navy-900 text-sm font-medium leading-none">{user?.full_name}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5 flex items-center gap-1.5">
                      {user?.email}
                      {isAdmin && <span className="bg-coral-100 text-coral-600 border border-coral-200 px-1 py-px rounded text-[8px] font-bold">ADMIN</span>}
                      {isNotary && <span className="bg-cream-200 text-coral-600 border border-slate-300 px-1 py-px rounded text-[8px] font-bold">NOTARY</span>}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 text-navy-800">
                <DropdownMenuItem onClick={() => navigate('/subscription')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-plan">
                  <CreditCard className="w-4 h-4 mr-2" /> Plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings/security')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-security">
                  <Settings className="w-4 h-4 mr-2" /> Security
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/compliance')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-privacy">
                  <Lock className="w-4 h-4 mr-2" /> Privacy
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/developers')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-api">
                    <Code className="w-4 h-4 mr-2" /> API
                  </DropdownMenuItem>
                )}
                {(isAdmin || isNotary) && (
                  <DropdownMenuItem onClick={() => navigate('/organizations')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-org">
                    <Building2 className="w-4 h-4 mr-2" /> Organizations
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/my-drafts')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-drafts">
                  <Save className="w-4 h-4 mr-2" /> My Drafts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/docs')} className="hover:bg-cream-200/50 cursor-pointer" data-testid="menu-user-guide">
                  <HelpCircle className="w-4 h-4 mr-2" /> User Guide
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-cream-200" />
                <DropdownMenuItem onClick={handleLogout} className="hover:bg-red-50 text-red-600 cursor-pointer" data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" /> {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 space-y-8 pb-12">
        {/* "What's next?" — single decisive next-step nudge for this user */}
        <div className="pt-6">
          <NextActionCard token={token} />
        </div>

        {/* Identity verification gate — clients must verify before requesting notarization */}
        {isUser && !identityVerified && (
          <Card className="border-coral-200 bg-coral-50/40 shadow-sm" data-testid="identity-verify-banner">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-coral-500/15 flex items-center justify-center flex-shrink-0">
                  <Fingerprint className="w-5 h-5 text-coral-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900">Verify your identity</h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Complete a quick ID check (document + selfie + quiz) to unlock notarization requests.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowKBA(true)}
                className="bg-coral-500 hover:bg-coral-600 text-white whitespace-nowrap"
                data-testid="dashboard-verify-identity-btn"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> Verify now
              </Button>
            </CardContent>
          </Card>
        )}

        {isUser && identityVerified && (
          <div className="flex items-center gap-2 text-sm text-emerald-700" data-testid="identity-verified-badge">
            <ShieldCheck className="w-4 h-4" /> Identity verified
          </div>
        )}

        {/* Personalized Hero (role-aware welcome + KPIs + suggestion) */}
        <DashboardHero token={token} user={user} role={role} />

        {/* Command Center — single cohesive card with 3 columns: Core / AI / Vault-or-Security */}
        <Card className="border-slate-200 shadow-sm overflow-hidden" data-testid="command-center">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Core Actions */}
            <div className="p-6 bg-white" data-testid="core-actions">
              <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600 mb-4">Core Actions</h3>
              <div className="space-y-1">
                <BentoAction icon={Upload} label="Quick Seal" desc="Instant blockchain timestamp" onClick={() => navigate('/demo')} accent data-testid="quick-seal-btn" />
                <BentoAction icon={FileText} label="Request Notarization" desc="Full notary service" onClick={() => navigate('/request-notarization')} data-testid="request-notary-btn" />
                <BentoAction icon={Layers} label="Bulk Notarization" desc="Process multiple documents" onClick={() => navigate('/bulk-notarization')} data-testid="bulk-notarize-btn" />
                {isUser && (
                  <BentoAction icon={Search} label="Find Notaries" desc="Browse the marketplace" onClick={() => navigate('/marketplace')} data-testid="find-notaries-btn-core" />
                )}
              </div>
            </div>

            {/* AI Tools */}
            <div className="p-6 bg-white" data-testid="ai-section">
              <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600 mb-4">
                {isUser ? 'AI Document Tools' : 'AI Intelligence'}
              </h3>
              <div className="space-y-1">
                {!isUser && (
                  <BentoAction icon={Brain} label="AI Intelligence Hub" desc="Risk, Match, Voice" onClick={() => navigate('/ai-intelligence')} data-testid="ai-hub-btn" />
                )}
                <BentoAction icon={Wand2} label="AI Doc Generator" onClick={() => navigate('/ai-generator')} data-testid="ai-gen-btn" />
                <BentoAction icon={FileSearch} label="AI Summarizer" onClick={() => navigate('/ai-summarizer')} data-testid="ai-summarizer-btn" />
                <BentoAction icon={GitCompareArrows} label="Doc Compare" onClick={() => navigate('/doc-compare')} data-testid="doc-compare-btn" />
                {!isUser && (
                  <BentoAction icon={Hammer} label="Doc Remediation" onClick={() => navigate('/document-remediation')} data-testid="doc-remediation-btn" />
                )}
              </div>
            </div>

            {/* Right column */}
            {isUser ? (
              <div className="p-6 bg-white" data-testid="my-vault-section">
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600 mb-4">My Vault & Records</h3>
                <div className="space-y-1">
                  <BentoAction icon={Vault} label="Asset Vault" desc="Wills, deeds, beneficiaries" onClick={() => navigate('/asset-vault')} data-testid="asset-vault-btn" />
                  <BentoAction icon={FileText} label="My Documents" desc="Unified document hub" onClick={() => navigate('/my-documents')} data-testid="my-documents-btn" />
                  <BentoAction icon={Save} label="My Drafts" onClick={() => navigate('/my-drafts')} data-testid="my-drafts-btn" />
                  <BentoAction icon={Bell} label="Reminders" onClick={() => navigate('/reminders')} data-testid="reminders-btn" />
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white" data-testid="security-section">
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600 mb-4">Security & Identity</h3>
                <div className="space-y-1">
                  <BentoAction icon={Network} label="Trust Hub" desc="Identity + TrustLayer + Vault" onClick={() => navigate('/trust-hub')} data-testid="trust-hub-btn" />
                  <BentoAction icon={Activity} label="Living Identity" desc="Continuous biometric trust" onClick={() => navigate('/identity')} data-testid="living-identity-btn" />
                  <BentoAction icon={Vault} label="Asset Vault" desc="Deeds, wills, IP, beneficiaries" onClick={() => navigate('/asset-vault')} data-testid="asset-vault-btn" />
                  <BentoAction icon={Video} label="Video Witness" onClick={() => navigate('/video-witness')} data-testid="video-witness-btn" />
                  <BentoAction icon={Fingerprint} label="Biometric Passport" onClick={() => navigate('/biometric-passport')} data-testid="biometric-btn" />
                  <BentoAction icon={Scale} label="Escrow Intelligence" onClick={() => navigate('/escrow')} data-testid="escrow-btn" />
                  <BentoAction icon={Coins} label="Tokenized Escrow" desc="HTS on Hedera" onClick={() => navigate('/tokenized-escrow')} data-testid="tokenized-escrow-btn" />
                  <BentoAction icon={ShieldCheck} label="Compliance Vault" desc="Continuous integrity & evidence" onClick={() => navigate('/pcv')} data-testid="pcv-btn" />
                  <BentoAction icon={ShieldAlert} label="Fraud Intelligence" onClick={() => navigate('/fraud-intelligence')} data-testid="fraud-intel-btn" />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Network & Tools — notary/admin only */}
        {!isUser && (
          <Card className="border-slate-200 shadow-sm" data-testid="network-section">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
              <CardTitle className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">Network & Tools</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1">
                <BentoAction icon={BookOpen} label="Templates" onClick={() => navigate('/templates')} data-testid="templates-btn" />
                <BentoAction icon={CalendarClock} label="My Bookings" onClick={() => navigate('/my-bookings')} data-testid="bookings-btn" />
                <BentoAction icon={Search} label="Find Notaries" onClick={() => navigate('/marketplace')} data-testid="find-notaries-btn" />
                <BentoAction icon={FileCheck} label="Approvals" onClick={() => navigate('/approvals')} data-testid="approvals-btn" />
                <BentoAction icon={Bell} label="Reminders" onClick={() => navigate('/reminders')} data-testid="reminders-btn" />
                <BentoAction icon={Brain} label="ANAN Network" onClick={() => navigate('/anan')} data-testid="anan-btn" />
                <BentoAction icon={Palette} label="Branding" onClick={() => navigate('/branding')} data-testid="branding-btn" />
                <BentoAction icon={Sparkles} label="Ceremony Mode" onClick={() => navigate('/ceremony')} data-testid="ceremony-btn" />
                <BentoAction icon={Users} label="Multi-Signature" desc="2+ signers" onClick={() => navigate('/multi-signature')} data-testid="multi-sig-btn" />
                <BentoAction icon={Timer} label="Cert Expiration" desc="Renewal & tracking" onClick={() => navigate('/certificate-expiration')} data-testid="cert-expiry-btn" />
                <BentoAction icon={Globe} label="Public Audit Trail" onClick={() => window.open('/audit-trail', '_blank')} data-testid="audit-trail-btn" />
                <BentoAction icon={FileText} label="My Documents" desc="Unified document hub" onClick={() => navigate('/my-documents')} data-testid="my-documents-btn" />
                {isNotary && (
                  <BentoAction icon={UserCheck} label="My Notary Profile" onClick={() => navigate('/notary-professional')} data-testid="notary-profile-btn" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lightweight CTA for regular users: verify a doc + audit trail */}
        {isUser && (
          <Card className="border-slate-200 shadow-sm" data-testid="user-cta-section">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BentoAction icon={ShieldCheck} label="Verify a Document" desc="Public verification" onClick={() => navigate('/verify')} data-testid="verify-btn" />
                <BentoAction icon={Globe} label="Public Audit Trail" desc="Hedera transparency" onClick={() => window.open('/audit-trail', '_blank')} data-testid="audit-trail-btn-user" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* State Pickability Index — notary/admin only */}
        {!isUser && (
          <div data-testid="pickability-section">
            <StatePickabilityWidget token={token} />
          </div>
        )}

        {/* Document Expiry Tracker */}
        <ExpiryWidget token={token} />

        {/* Notary Requests */}
        {notaryRequests.length > 0 && (
          <Card className="border-slate-200 shadow-sm overflow-hidden" data-testid="notary-requests">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6 flex flex-row items-center gap-2 space-y-0">
              <FileText className="w-4 h-4 text-coral-600" />
              <CardTitle className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">My Notarization Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {notaryRequests.slice(0, 5).map((request, idx) => (
                  <div key={request.id || `req-${idx}`}>
                    <div className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          request.status === 'pending' ? 'bg-amber-50' :
                          request.status === 'in_session' ? 'bg-emerald-50' :
                          request.status === 'completed' ? 'bg-slate-100' : 'bg-cream-200'
                        }`}>
                          {request.status === 'in_session' ? (
                            <Video className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <FileText className={`w-4 h-4 ${
                              request.status === 'pending' ? 'text-amber-600' :
                              request.status === 'completed' ? 'text-slate-600' : 'text-coral-600'
                            }`} />
                          )}
                        </div>
                        <div>
                          <h4 className="text-navy-900 font-medium text-sm">{request.document_name}</h4>
                          <p className="text-slate-500 text-[10px]">{request.document_type} | {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                        <ExpiryBadge request={request} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          request.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          request.status === 'in_session' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          request.status === 'assigned' ? 'bg-coral-50 text-coral-700 border border-coral-200' :
                          request.status === 'completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {request.status?.replace('_', ' ')}
                        </span>
                        {request.hcs_topic_id && (
                          <Button onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                            size="sm" variant="outline" className="border-slate-300 text-slate-600 hover:text-navy-900 hover:border-navy-900 h-7 text-[10px]"
                            data-testid={`audit-trail-btn-${request.id}`}>
                            <Shield className="w-3 h-3 mr-1" /> Audit
                            {expandedRequest === request.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                          </Button>
                        )}
                        {(request.status === 'pending' || request.status === 'assigned' || request.status === 'in_session') && (
                          <Button onClick={() => navigate(`/session/${request.id}`)} size="sm"
                            className={`h-7 text-[10px] ${request.status === 'in_session' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-coral-500 hover:bg-coral-600 text-white'}`}>
                            {request.status === 'in_session' ? <><Play className="w-3 h-3 mr-1" /> Join</> : <><Video className="w-3 h-3 mr-1" /> Start</>}
                          </Button>
                        )}
                        <SetExpiryButton requestId={request.id} currentExpiry={request.expires_at} token={token} onUpdate={fetchDashboardData} />
                      </div>
                    </div>
                  </div>
                  {expandedRequest === request.id && request.hcs_topic_id && (
                    <div className="px-6 pb-4 ml-4">
                      <BlockchainAuditTrail topicId={request.hcs_topic_id} token={token} requestId={request.id} title={`Audit Trail: ${request.document_name}`} />
                    </div>
                  )}
                </div>
              ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Document Seals */}
        <Card className="border-slate-200 shadow-sm overflow-hidden" data-testid="recent-seals-section">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
            <CardTitle className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-600">Recent Document Seals</CardTitle>
          </CardHeader>

          {documents.length === 0 ? (
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-6 bg-white gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-cream-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-navy-900">No documents sealed yet</h4>
                    <p className="text-xs text-slate-500">Secure your first document on the blockchain.</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/demo')} size="sm" className="bg-coral-500 hover:bg-coral-600 text-white" data-testid="seal-first-doc-btn">
                  Seal Document
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {documents.map((doc, idx) => (
                  <div key={doc.id || doc.sha256_hash || doc.transaction_id || `doc-${idx}`} className="px-6 py-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 bg-cream-200 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200">
                        <FileText className="w-5 h-5 text-coral-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-navy-900 font-medium text-sm mb-0.5">{doc.file_name}</h3>
                        <p className="text-slate-500 text-[10px] mb-3">{doc.file_size} | {new Date(doc.timestamp).toLocaleString()}</p>
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-slate-600 text-[10px] block mb-0.5">SHA-256</label>
                            <div className="flex items-center gap-2">
                              <code className="text-navy-900 text-[10px] font-mono bg-cream-50 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">{doc.sha256_hash}</code>
                              <button onClick={() => copyHash(doc.sha256_hash)} className="text-slate-600 hover:text-navy-900 p-1 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <div>
                            <label className="text-slate-600 text-[10px] block mb-0.5">Transaction ID</label>
                            <div className="flex items-center gap-2">
                              <code className="text-navy-900 text-[10px] font-mono bg-cream-50 px-2 py-1 rounded">{doc.transaction_id}</code>
                              <a href={`https://hashscan.io/mainnet/transaction/${doc.transaction_id}`} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-navy-900 p-1 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="bg-coral-500/10 text-coral-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-coral-200">
                      {doc.status}
                    </span>
                  </div>
                </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      <OnboardingTour portal="client_sovereign" />
      <EnhancedKBAFlow
        open={showKBA}
        token={token}
        onClose={() => setShowKBA(false)}
        onComplete={async (envelope) => {
          if (envelope?.decision === 'passed') {
            await refreshUser?.();
            toast({ title: 'Identity verified', description: 'You can now request notarization.' });
          }
        }}
      />
    </div>
  );
};

export default Dashboard;
