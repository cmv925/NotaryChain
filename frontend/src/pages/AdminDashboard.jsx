import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import {
  Shield, Users, FileText, TrendingUp, DollarSign,
  CheckCircle, XCircle, Clock, RefreshCw, Search,
  BarChart3, Activity, Wallet, LogOut, ChevronDown,
  Eye, UserCheck, UserX, Settings, AlertTriangle, PieChart, Plus,
  Server, HardDrive, Zap, Database, Globe, AlertCircle,
  Lock, Bell, BellOff, Mail, MailX, Save, ToggleLeft, ToggleRight,
  ShieldCheck, Key, Fingerprint, Network
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { NotificationBell } from '../components/NotificationBell';
import { toast } from '../hooks/use-toast';
import { Breadcrumbs } from '../components/Breadcrumbs';
import axios from 'axios';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { OverviewTab } from '../components/admin/tabs/OverviewTab';
import { OperationsTab } from '../components/admin/tabs/OperationsTab';
import { SecurityTab } from '../components/admin/tabs/SecurityTab';
import { AnalyticsTab } from '../components/admin/tabs/AnalyticsTab';
import { UsersTab } from '../components/admin/tabs/UsersTab';
import { NotariesTab } from '../components/admin/tabs/NotariesTab';
import { AuditTab } from '../components/admin/tabs/AuditTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [notaries, setNotaries] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [revenueData, setRevenueData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [notaryStatusFilter, setNotaryStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [opsData, setOpsData] = useState(null);
  const [loadingOps, setLoadingOps] = useState(false);
  const [alertSettings, setAlertSettings] = useState(null);
  const [ceremonyAnalytics, setCeremonyAnalytics] = useState(null);
  const [loadingCeremonyAnalytics, setLoadingCeremonyAnalytics] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertForm, setAlertForm] = useState(null);
  const [securityData, setSecurityData] = useState(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [storageAnalytics, setStorageAnalytics] = useState(null);
  const [loadingStorageAnalytics, setLoadingStorageAnalytics] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [incidents, setIncidents] = useState(null);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [exportingIncidents, setExportingIncidents] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, []);

  // Real-time: auto-refresh admin dashboard on platform events
  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [subscribe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, notariesRes, pendingRes, revenueRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, authHeaders),
        axios.get(`${API}/admin/users?page_size=10`, authHeaders),
        axios.get(`${API}/admin/notaries?page_size=10`, authHeaders),
        axios.get(`${API}/admin/notaries/pending`, authHeaders),
        axios.get(`${API}/admin/analytics/revenue?days=30`, authHeaders)
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setNotaries(notariesRes.data.notaries);
      setPendingApplications(pendingRes.data.applications);
      setRevenueData(revenueRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'Admin access required',
          variant: 'destructive',
        });
        navigate('/dashboard');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load admin data',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await axios.get(`${API}/audit/logs?page_size=50`, authHeaders);
      setAuditLogs(response.data.logs);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load audit logs', variant: 'destructive' });
    }
  };

  const fetchAnalyticsData = async (period = analyticsPeriod) => {
    setLoadingAnalytics(true);
    try {
      const response = await axios.get(`${API}/admin/analytics/comprehensive?days=${period}`, authHeaders);
      setAnalyticsData(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load analytics data', variant: 'destructive' });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchOpsMetrics = async () => {
    setLoadingOps(true);
    try {
      const response = await axios.get(`${API}/admin/ops/metrics`, authHeaders);
      setOpsData(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load ops metrics', variant: 'destructive' });
    } finally {
      setLoadingOps(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/ops/alert-settings`, authHeaders);
      setAlertSettings(response.data);
      setAlertForm(JSON.parse(JSON.stringify(response.data)));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load alert settings', variant: 'destructive' });
    }
  };

  const saveAlertSettings = async () => {
    setSavingAlerts(true);
    try {
      await axios.put(`${API}/admin/ops/alert-settings`, alertForm, authHeaders);
      toast({ title: 'Saved', description: 'Alert settings updated' });
      setAlertSettings(JSON.parse(JSON.stringify(alertForm)));
      setEditingAlerts(false);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingAlerts(false);
    }
  };

  const fetchSecurityCompliance = async () => {
    setLoadingSecurity(true);
    try {
      const response = await axios.get(`${API}/admin/security/compliance`, authHeaders);
      setSecurityData(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load security data', variant: 'destructive' });
    } finally {
      setLoadingSecurity(false);
    }
  };

  const fetchStorageAnalytics = async () => {
    setLoadingStorageAnalytics(true);
    try {
      const response = await axios.get(`${API}/admin/ops/storage-analytics`, authHeaders);
      setStorageAnalytics(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load storage analytics', variant: 'destructive' });
    } finally {
      setLoadingStorageAnalytics(false);
    }
  };

  const fetchCeremonyAnalytics = async () => {
    setLoadingCeremonyAnalytics(true);
    try {
      const response = await axios.get(`${API}/ceremony/analytics/stats`, authHeaders);
      setCeremonyAnalytics(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load ceremony analytics', variant: 'destructive' });
    } finally {
      setLoadingCeremonyAnalytics(false);
    }
  };

  const exportSecurityPdf = async () => {
    setExportingPdf(true);
    try {
      const response = await axios.get(`${API}/admin/security/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `NotaryChain_Security_Compliance_${new Date().toISOString().slice(0,10)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Security report downloaded' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export PDF', variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchServiceHealth = async () => {
    setLoadingHealth(true);
    try {
      const response = await axios.get(`${API}/admin/ops/service-health`, authHeaders);
      setServiceHealth(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load service health', variant: 'destructive' });
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const response = await axios.get(`${API}/admin/incidents?days=7`, authHeaders);
      setIncidents(response.data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load incidents', variant: 'destructive' });
    } finally {
      setLoadingIncidents(false);
    }
  };

  const exportIncidentPdf = async () => {
    setExportingIncidents(true);
    try {
      const response = await axios.get(`${API}/admin/incidents/export-pdf?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `NotaryChain_Incident_Report_${new Date().toISOString().slice(0,10)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Incident report downloaded' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    } finally {
      setExportingIncidents(false);
    }
  };

  const handleApproveNotary = async (notaryId) => {
    setProcessingAction(notaryId);
    try {
      await axios.post(`${API}/admin/notaries/${notaryId}/approve`, {}, authHeaders);
      toast({ title: 'Success', description: 'Notary application approved' });
      fetchDashboardData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve application', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectNotary = async (notaryId) => {
    setProcessingAction(notaryId);
    try {
      await axios.post(`${API}/admin/notaries/${notaryId}/reject`, {}, authHeaders);
      toast({ title: 'Success', description: 'Notary application rejected' });
      fetchDashboardData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject application', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUserStatusChange = async (userId, newStatus) => {
    setProcessingAction(userId);
    try {
      await axios.patch(`${API}/admin/users/${userId}/status?status=${newStatus}`, {}, authHeaders);
      toast({ title: 'Success', description: `User ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      fetchDashboardData();
      setShowUserModal(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const response = await axios.get(`${API}/admin/users/${userId}`, authHeaders);
      setSelectedUser(response.data);
      setShowUserModal(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load user details', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-coral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-coral-500" />
                <span className="text-lg sm:text-xl font-bold text-navy-900">
                  Notary<span className="text-coral-500">Chain</span>
                </span>
              </div>
              <span className="text-slate-500 hidden sm:inline">|</span>
              <span className="text-red-400 font-semibold hidden sm:inline">Admin Dashboard</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                onClick={() => navigate('/admin/blueprints/create')}
                variant="outline"
                size="sm"
                className="border-green-600/50 text-green-400 hover:bg-green-600/20 hidden sm:flex"
              >
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden lg:inline">Blueprint</span>
              </Button>
              <Button
                onClick={() => navigate('/admin/ron-compliance')}
                variant="outline"
                size="sm"
                className="border-coral-500/50 text-coral-500 hover:bg-coral-500/20 hidden sm:flex"
                data-testid="ron-compliance-btn"
              >
                <Shield className="w-4 h-4 sm:mr-1" />
                <span className="hidden lg:inline">RON Compliance</span>
              </Button>
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-navy-900"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <NotificationBell token={token} />
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-500 hover:text-navy-900"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-coral-500/20 to-coral-600/10 border-coral-300/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">Total Users</p>
                    <p className="text-2xl font-bold text-navy-900">{stats.total_users}</p>
                  </div>
                  <Users className="w-8 h-8 text-coral-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">Active Notaries</p>
                    <p className="text-2xl font-bold text-navy-900">{stats.total_notaries}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-navy-700/20 to-navy-700/10 border-navy-300/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">Notarizations</p>
                    <p className="text-2xl font-bold text-navy-900">{stats.total_notarizations}</p>
                  </div>
                  <FileText className="w-8 h-8 text-navy-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-coral-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">Revenue (USD)</p>
                    <p className="text-2xl font-bold text-navy-900">${stats.total_revenue_usd}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-coral-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">Pending Apps</p>
                    <p className="text-2xl font-bold text-navy-900">{stats.pending_notary_applications}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Admin Dashboard' }]} />

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'operations', label: 'Operations', icon: Server },
              { id: 'security', label: 'Security', icon: ShieldCheck },
              { id: 'analytics', label: 'Analytics', icon: PieChart },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'notaries', label: 'Notaries', icon: UserCheck },
              { id: 'audit', label: 'Audit Logs', icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'audit') fetchAuditLogs();
                  if (tab.id === 'analytics' && !analyticsData) fetchAnalyticsData();
                  if (tab.id === 'analytics' && !ceremonyAnalytics) fetchCeremonyAnalytics();
                  if (tab.id === 'operations' && !opsData) fetchOpsMetrics();
                  if (tab.id === 'operations' && !alertSettings) fetchAlertSettings();
                  if (tab.id === 'operations' && !storageAnalytics) fetchStorageAnalytics();
                  if (tab.id === 'operations' && !serviceHealth) fetchServiceHealth();
                  if (tab.id === 'operations' && !incidents) fetchIncidents();
                  if (tab.id === 'security' && !securityData) fetchSecurityCompliance();
                }}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-coral-500 border-b-2 border-coral-300'
                    : 'text-slate-500 hover:text-navy-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab handleApproveNotary={handleApproveNotary} handleRejectNotary={handleRejectNotary} pendingApplications={pendingApplications} processingAction={processingAction} revenueData={revenueData} stats={stats} />}

        {activeTab === 'operations' && <OperationsTab alertForm={alertForm} alertSettings={alertSettings} editingAlerts={editingAlerts} exportIncidentPdf={exportIncidentPdf} exportingIncidents={exportingIncidents} fetchIncidents={fetchIncidents} fetchOpsMetrics={fetchOpsMetrics} fetchServiceHealth={fetchServiceHealth} fetchStorageAnalytics={fetchStorageAnalytics} incidents={incidents} loadingHealth={loadingHealth} loadingIncidents={loadingIncidents} loadingOps={loadingOps} loadingStorageAnalytics={loadingStorageAnalytics} opsData={opsData} saveAlertSettings={saveAlertSettings} savingAlerts={savingAlerts} serviceHealth={serviceHealth} setAlertForm={setAlertForm} setEditingAlerts={setEditingAlerts} storageAnalytics={storageAnalytics} />}

        {activeTab === 'security' && <SecurityTab exportSecurityPdf={exportSecurityPdf} exportingPdf={exportingPdf} fetchSecurityCompliance={fetchSecurityCompliance} loadingSecurity={loadingSecurity} securityData={securityData} />}

        {activeTab === 'analytics' && <AnalyticsTab analyticsData={analyticsData} analyticsPeriod={analyticsPeriod} ceremonyAnalytics={ceremonyAnalytics} fetchAnalyticsData={fetchAnalyticsData} fetchCeremonyAnalytics={fetchCeremonyAnalytics} loadingAnalytics={loadingAnalytics} loadingCeremonyAnalytics={loadingCeremonyAnalytics} setAnalyticsPeriod={setAnalyticsPeriod} stats={stats} users={users} />}

        {activeTab === 'users' && <UsersTab notaries={notaries} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setUserRoleFilter={setUserRoleFilter} userRoleFilter={userRoleFilter} users={users} viewUserDetails={viewUserDetails} />}

        {activeTab === 'notaries' && <NotariesTab notaries={notaries} notaryStatusFilter={notaryStatusFilter} setNotaryStatusFilter={setNotaryStatusFilter} viewUserDetails={viewUserDetails} />}

        {activeTab === 'audit' && <AuditTab auditLogs={auditLogs} />}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-navy-900">User Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => { setShowUserModal(false); setSelectedUser(null); }}
                  className="text-slate-500 hover:text-navy-900"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div>
                <h3 className="text-navy-900 font-semibold mb-3">Profile</h3>
                <div className="bg-cream-100 rounded-lg p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 text-xs">Email</p>
                    <p className="text-navy-900">{selectedUser.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Full Name</p>
                    <p className="text-navy-900">{selectedUser.user?.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Role</p>
                    <p className="text-navy-900 capitalize">{selectedUser.user?.role || 'user'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Status</p>
                    <p className={selectedUser.user?.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                      {selectedUser.user?.status || 'active'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notary Profile */}
              {selectedUser.notary_profile && (
                <div>
                  <h3 className="text-navy-900 font-semibold mb-3">Notary Profile</h3>
                  <div className="bg-cream-100 rounded-lg p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs">Commission #</p>
                      <p className="text-navy-900">{selectedUser.notary_profile.commission_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">State</p>
                      <p className="text-navy-900">{selectedUser.notary_profile.state || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Status</p>
                      <span className={`px-2 py-1 rounded text-xs ${
                        selectedUser.notary_profile.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {selectedUser.notary_profile.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                {selectedUser.user?.status === 'active' ? (
                  <Button
                    onClick={() => handleUserStatusChange(selectedUser.user.id, 'disabled')}
                    disabled={processingAction === selectedUser.user?.id}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Disable User
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUserStatusChange(selectedUser.user.id, 'active')}
                    disabled={processingAction === selectedUser.user?.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Enable User
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
