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
  ShieldCheck, Key, Fingerprint, Network, ArrowLeft
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { NotificationBell } from '../components/NotificationBell';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [opsData, setOpsData] = useState(null);
  const [loadingOps, setLoadingOps] = useState(false);
  const [alertSettings, setAlertSettings] = useState(null);
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
  }, []);

  // Real-time: auto-refresh admin dashboard on platform events
  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
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
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
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
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
              </Button>
              <span className="text-gray-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
                <span className="text-lg sm:text-xl font-bold text-white">
                  Notary<span className="text-blue-500">Chain</span>
                </span>
              </div>
              <span className="text-gray-400 hidden sm:inline">|</span>
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
                className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20 hidden sm:flex"
                data-testid="ron-compliance-btn"
              >
                <Shield className="w-4 h-4 sm:mr-1" />
                <span className="hidden lg:inline">RON Compliance</span>
              </Button>
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <NotificationBell token={token} />
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white"
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
            <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Total Users</p>
                    <p className="text-2xl font-bold text-white">{stats.total_users}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Active Notaries</p>
                    <p className="text-2xl font-bold text-white">{stats.total_notaries}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Notarizations</p>
                    <p className="text-2xl font-bold text-white">{stats.total_notarizations}</p>
                  </div>
                  <FileText className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-orange-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Revenue (USD)</p>
                    <p className="text-2xl font-bold text-white">${stats.total_revenue_usd}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Pending Apps</p>
                    <p className="text-2xl font-bold text-white">{stats.pending_notary_applications}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
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
                  if (tab.id === 'operations' && !opsData) fetchOpsMetrics();
                  if (tab.id === 'operations' && !alertSettings) fetchAlertSettings();
                  if (tab.id === 'operations' && !storageAnalytics) fetchStorageAnalytics();
                  if (tab.id === 'operations' && !serviceHealth) fetchServiceHealth();
                  if (tab.id === 'operations' && !incidents) fetchIncidents();
                  if (tab.id === 'security' && !securityData) fetchSecurityCompliance();
                }}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-500 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Applications */}
            <Card className="bg-[#1a2332] border-gray-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Pending Notary Applications ({pendingApplications.length})
                </h3>
                {pendingApplications.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No pending applications</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApplications.slice(0, 5).map((app) => (
                      <div key={app.id} className="bg-[#0a0f1a] rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{app.user_full_name || 'Unknown'}</p>
                          <p className="text-gray-500 text-sm">{app.user_email}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            Commission: {app.commission_number || 'N/A'} | State: {app.state || 'N/A'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveNotary(app.id)}
                            disabled={processingAction === app.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectNotary(app.id)}
                            disabled={processingAction === app.id}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-[#1a2332] border-gray-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Platform Statistics
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Active Users (30d)</span>
                    <span className="text-white font-bold">{stats?.active_users_30d || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Completed Notarizations</span>
                    <span className="text-green-400 font-bold">{stats?.completed_notarizations || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Documents Sealed</span>
                    <span className="text-purple-400 font-bold">{stats?.documents_sealed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Crypto Payments</span>
                    <span className="text-orange-400 font-bold">{stats?.crypto_payments_count || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Chart */}
            {revenueData && (
              <Card className="bg-[#1a2332] border-gray-800 lg:col-span-2">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Revenue (Last 30 Days)
                  </h3>
                  <div className="h-48 flex items-end gap-1">
                    {revenueData.stripe_daily.slice(-30).map((day, idx) => {
                      const crypto = revenueData.crypto_daily.find(c => c.date === day.date);
                      const total = day.amount + (crypto?.amount || 0);
                      const maxRevenue = Math.max(...revenueData.stripe_daily.map(d => d.amount)) || 100;
                      const height = (total / maxRevenue) * 100;
                      
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group">
                          <div
                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-500 hover:to-blue-300"
                            style={{ height: `${Math.max(height, 4)}%` }}
                            title={`${day.date}: $${total.toFixed(2)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Server className="w-6 h-6 text-cyan-500" />
                Production Operations
              </h2>
              <Button
                onClick={fetchOpsMetrics}
                disabled={loadingOps}
                variant="outline"
                className="border-gray-700"
                data-testid="ops-refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOps ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingOps && !opsData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin" />
              </div>
            ) : opsData ? (
              <>
                {/* System Status Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ops-system-status">
                  {Object.entries(opsData.system).map(([service, status]) => (
                    <div key={service} className={`rounded-lg p-3 border flex items-center gap-3 ${
                      status === 'live' || status === 'healthy' || status === 's3'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-gray-500/10 border-gray-700'
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        status === 'live' || status === 'healthy' || status === 's3'
                          ? 'bg-emerald-400 animate-pulse' : status === 'degraded' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                      }`} />
                      <div>
                        <p className="text-white text-sm font-medium capitalize">{service}</p>
                        <p className="text-gray-400 text-xs capitalize">{status}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hedera Blockchain Section */}
                <Card className="bg-[#1a2332] border-gray-800">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-cyan-400" />
                      Hedera Hashgraph
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        opsData.hedera.network === 'mainnet' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {opsData.hedera.network}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-[#0a0f1a] rounded-lg p-4" data-testid="ops-hbar-balance">
                        <p className="text-gray-400 text-xs mb-1">HBAR Balance</p>
                        <p className="text-2xl font-bold text-cyan-400">
                          {opsData.hedera.balance_hbar != null ? opsData.hedera.balance_hbar.toFixed(2) : '--'}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">{opsData.hedera.account_id}</p>
                      </div>
                      <div className="bg-[#0a0f1a] rounded-lg p-4" data-testid="ops-total-seals">
                        <p className="text-gray-400 text-xs mb-1">Total Seals</p>
                        <p className="text-2xl font-bold text-white">{opsData.hedera.total_seals}</p>
                        <p className="text-gray-500 text-xs mt-1">{opsData.hedera.hcs_submitted} on-chain</p>
                      </div>
                      <div className="bg-[#0a0f1a] rounded-lg p-4">
                        <p className="text-gray-400 text-xs mb-1">Seals (30d)</p>
                        <p className="text-2xl font-bold text-white">{opsData.hedera.seals_30d}</p>
                        <p className="text-gray-500 text-xs mt-1">{opsData.hedera.seals_7d} last 7d</p>
                      </div>
                      <div className="bg-[#0a0f1a] rounded-lg p-4">
                        <p className="text-gray-400 text-xs mb-1">Est. Cost (30d)</p>
                        <p className="text-2xl font-bold text-emerald-400">${opsData.hedera.estimated_cost_30d}</p>
                        <p className="text-gray-500 text-xs mt-1">{opsData.hedera.total_topics} topics</p>
                      </div>
                    </div>

                    {/* Seal Trend Chart */}
                    {opsData.hedera.seal_trend.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-3">Seal Activity (30 days)</p>
                        <div className="h-24 flex items-end gap-1">
                          {opsData.hedera.seal_trend.map((day, idx) => {
                            const max = Math.max(...opsData.hedera.seal_trend.map(d => d.count)) || 1;
                            const pct = (day.count / max) * 100;
                            return (
                              <div key={idx} className="flex-1 group relative">
                                <div
                                  className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all hover:from-cyan-500 hover:to-cyan-300"
                                  style={{ height: `${Math.max(pct, 8)}%` }}
                                  title={`${day.date}: ${day.count} seals`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* S3 Storage + Payments side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* S3 Storage */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-orange-400" />
                        Cloud Storage (S3)
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {opsData.storage.bucket}
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-[#0a0f1a] rounded-lg p-4" data-testid="ops-s3-files">
                          <p className="text-gray-400 text-xs mb-1">Total Files</p>
                          <p className="text-2xl font-bold text-orange-400">{opsData.storage.total_files}</p>
                        </div>
                        <div className="bg-[#0a0f1a] rounded-lg p-4" data-testid="ops-s3-size">
                          <p className="text-gray-400 text-xs mb-1">Total Size</p>
                          <p className="text-2xl font-bold text-white">{opsData.storage.total_size_mb || 0} MB</p>
                        </div>
                      </div>

                      {/* Category breakdown */}
                      <p className="text-gray-400 text-sm mb-3">Storage by Category</p>
                      {Object.keys(opsData.storage.categories).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(opsData.storage.categories).map(([cat, info]) => {
                            const maxFiles = Math.max(...Object.values(opsData.storage.categories).map(c => c.count)) || 1;
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className="text-gray-300 text-sm w-24 truncate">{cat}</span>
                                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(info.count / maxFiles) * 100}%` }} />
                                </div>
                                <span className="text-gray-400 text-xs w-20 text-right">{info.count} files</span>
                                <span className="text-gray-500 text-xs w-16 text-right">{info.size_mb} MB</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">No files stored yet</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stripe Payments */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        Stripe Payments
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          live
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-[#0a0f1a] rounded-lg p-4" data-testid="ops-stripe-revenue">
                          <p className="text-gray-400 text-xs mb-1">Total Revenue</p>
                          <p className="text-2xl font-bold text-green-400">${opsData.payments.total_revenue_usd}</p>
                        </div>
                        <div className="bg-[#0a0f1a] rounded-lg p-4">
                          <p className="text-gray-400 text-xs mb-1">Revenue (30d)</p>
                          <p className="text-2xl font-bold text-white">${opsData.payments.revenue_30d_usd}</p>
                        </div>
                        <div className="bg-[#0a0f1a] rounded-lg p-4">
                          <p className="text-gray-400 text-xs mb-1">Total Payments</p>
                          <p className="text-2xl font-bold text-white">{opsData.payments.total_payments}</p>
                          <p className="text-gray-500 text-xs mt-1">{opsData.payments.payments_30d} last 30d</p>
                        </div>
                        <div className="bg-[#0a0f1a] rounded-lg p-4">
                          <p className="text-gray-400 text-xs mb-1">Active Subs</p>
                          <p className="text-2xl font-bold text-white">{opsData.payments.active_subscriptions}</p>
                        </div>
                      </div>

                      {/* Revenue trend */}
                      {opsData.payments.revenue_trend.length > 0 ? (
                        <div>
                          <p className="text-gray-400 text-sm mb-3">Revenue Trend (30d)</p>
                          <div className="h-24 flex items-end gap-1">
                            {opsData.payments.revenue_trend.map((day, idx) => {
                              const max = Math.max(...opsData.payments.revenue_trend.map(d => d.amount_usd)) || 1;
                              const pct = (day.amount_usd / max) * 100;
                              return (
                                <div key={idx} className="flex-1">
                                  <div
                                    className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                    title={`${day.date}: $${day.amount_usd}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">No payment data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Balance Alert */}
                {opsData.hedera.balance_hbar != null && opsData.hedera.balance_hbar < 10 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3" data-testid="ops-hbar-alert">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-red-300 font-medium">Low HBAR Balance Warning</p>
                      <p className="text-red-400/70 text-sm">
                        Balance is {opsData.hedera.balance_hbar.toFixed(2)} HBAR. 
                        Fund account {opsData.hedera.account_id} to avoid service interruption.
                      </p>
                    </div>
                  </div>
                )}

                {/* HBAR Alert History */}
                {opsData.hbar_alerts && opsData.hbar_alerts.length > 0 && (
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        Balance Alert History
                      </h3>
                      <div className="space-y-2" data-testid="ops-alert-history">
                        {opsData.hbar_alerts.map((alert, idx) => (
                          <div key={idx} className={`flex items-center justify-between rounded-lg p-3 border ${
                            alert.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' :
                            alert.level === 'critical' ? 'bg-orange-500/5 border-orange-500/20' :
                            'bg-yellow-500/5 border-yellow-500/20'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                alert.level === 'emergency' ? 'bg-red-500/20 text-red-400' :
                                alert.level === 'critical' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>{alert.level.toUpperCase()}</span>
                              <span className="text-gray-300 text-sm">{alert.balance_hbar.toFixed(2)} HBAR</span>
                              <span className="text-gray-500 text-xs">threshold: {alert.threshold_hbar}</span>
                            </div>
                            <span className="text-gray-500 text-xs">{new Date(alert.alerted_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Service Health Monitor */}
                <Card className="bg-[#1a2332] border-gray-800" data-testid="service-health-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                        Service Health
                      </h3>
                      <Button size="sm" variant="outline" className="border-gray-700" onClick={fetchServiceHealth} disabled={loadingHealth} data-testid="health-refresh-btn">
                        <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {serviceHealth ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {serviceHealth.services.map((svc, i) => {
                            const isHealthy = svc.status === 'healthy';
                            const isDegraded = svc.status === 'degraded';
                            return (
                              <div key={i} className={`rounded-xl p-4 border transition-all ${isHealthy ? 'bg-emerald-500/5 border-emerald-500/20' : isDegraded ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-800/30 border-gray-700'}`} data-testid={`health-${svc.service.toLowerCase().replace(' ', '-')}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-sm font-medium">{svc.service}</span>
                                  <div className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`} />
                                </div>
                                <p className={`text-xs ${isHealthy ? 'text-emerald-400' : isDegraded ? 'text-red-400' : 'text-gray-500'}`}>
                                  {svc.status === 'healthy' ? 'Operational' : svc.status === 'degraded' ? 'Degraded' : 'Not Configured'}
                                </p>
                                <p className="text-gray-600 text-xs mt-1 truncate">{svc.detail}</p>
                              </div>
                            );
                          })}
                        </div>

                        {serviceHealth.recent_alerts?.length > 0 && (
                          <div className="bg-[#0a0f1a] rounded-xl p-4 border border-gray-800">
                            <h4 className="text-sm font-semibold text-white mb-2">Recent Alerts (24h)</h4>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {serviceHealth.recent_alerts.map((alert, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <div className={`w-1.5 h-1.5 rounded-full ${alert.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                  <span className="text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                  <span className={alert.status === 'recovered' ? 'text-emerald-400' : 'text-red-400'}>{alert.service}</span>
                                  <span className="text-gray-600">{alert.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-gray-600 text-xs">Last checked: {new Date(serviceHealth.checked_at).toLocaleString()}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-gray-500 text-sm">Click refresh to check service health</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Incident Timeline */}
                <Card className="bg-[#1a2332] border-gray-800" data-testid="incidents-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        Incidents (7 Days)
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="border-gray-700" onClick={fetchIncidents} disabled={loadingIncidents}>
                          <RefreshCw className={`w-4 h-4 ${loadingIncidents ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={exportIncidentPdf} disabled={exportingIncidents} data-testid="export-incident-pdf-btn">
                          <FileText className="w-4 h-4 mr-1" /> {exportingIncidents ? 'Exporting...' : 'Export PDF'}
                        </Button>
                      </div>
                    </div>

                    {incidents ? (
                      <div className="space-y-4">
                        {/* Summary badges */}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">{incidents.summary?.total_incidents || 0} incidents</span>
                          {incidents.summary?.resolved > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                              {incidents.summary.resolved} resolved
                            </span>
                          )}
                          {incidents.summary?.ongoing > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 animate-pulse">
                              {incidents.summary.ongoing} ongoing
                            </span>
                          )}
                        </div>

                        {incidents.incidents?.length > 0 ? (
                          <div className="space-y-2">
                            {incidents.incidents.map((inc, i) => (
                              <div key={i} className={`rounded-xl p-4 border ${inc.status === 'resolved' ? 'bg-[#0a0f1a] border-gray-800' : 'bg-red-500/5 border-red-500/20'}`} data-testid={`incident-${i}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                                    <span className="text-white text-sm font-medium">{inc.service}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${inc.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                      {inc.status}
                                    </span>
                                  </div>
                                  <span className="text-gray-500 text-xs">
                                    {inc.duration_minutes != null ? `${inc.duration_minutes} min` : 'ongoing'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>Started: {new Date(inc.started_at).toLocaleString()}</span>
                                  {inc.ended_at && <span>Ended: {new Date(inc.ended_at).toLocaleString()}</span>}
                                </div>
                                {inc.events?.length > 0 && (
                                  <div className="mt-2 pl-3 border-l-2 border-gray-800 space-y-1">
                                    {inc.events.slice(0, 3).map((evt, j) => (
                                      <div key={j} className="flex items-center gap-2 text-xs">
                                        <div className={`w-1.5 h-1.5 rounded-full ${evt.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-gray-600">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                        <span className={evt.status === 'recovered' ? 'text-emerald-400' : 'text-red-400'}>{evt.status}</span>
                                        <span className="text-gray-600 truncate">{evt.detail?.slice(0, 60)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-[#0a0f1a] rounded-xl border border-gray-800">
                            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <p className="text-emerald-400 text-sm font-medium">All Clear</p>
                            <p className="text-gray-500 text-xs mt-1">No incidents in the last 7 days</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-gray-500 text-sm">Click refresh to load incident history</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* S3 Storage Analytics */}
                <Card className="bg-[#1a2332] border-gray-800" data-testid="storage-analytics-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-cyan-400" />
                        Storage Analytics
                      </h3>
                      <Button size="sm" variant="outline" className="border-gray-700" onClick={fetchStorageAnalytics} disabled={loadingStorageAnalytics} data-testid="storage-refresh-btn">
                        <RefreshCw className={`w-4 h-4 ${loadingStorageAnalytics ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {storageAnalytics ? (
                      <div className="space-y-5">
                        {/* Summary row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Total Files', value: storageAnalytics.total_vault_docs, color: 'blue' },
                            { label: 'Storage Used', value: `${storageAnalytics.total_vault_size_mb} MB`, color: 'cyan' },
                            { label: 'Downloads', value: storageAnalytics.total_downloads, color: 'purple' },
                            { label: 'Uploads (30d)', value: storageAnalytics.cost_projection?.uploads_30d || 0, color: 'emerald' },
                          ].map((s, i) => (
                            <div key={i} className="bg-[#0a0f1a] rounded-xl p-4 border border-gray-800">
                              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                              <p className={`text-xl font-bold text-${s.color}-400`}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Cost Projection */}
                        {storageAnalytics.cost_projection && (
                          <div className="bg-[#0a0f1a] rounded-xl p-4 border border-gray-800">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-emerald-400" />
                              Cost Projection (AWS S3 Standard)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs">Current Usage</p>
                                <p className="text-white font-medium">{storageAnalytics.cost_projection.current_gb} GB</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Monthly Cost</p>
                                <p className="text-emerald-400 font-medium">${storageAnalytics.cost_projection.monthly_cost_usd}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Growth Rate (30d)</p>
                                <p className={`font-medium ${storageAnalytics.cost_projection.growth_rate_pct >= 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                  {storageAnalytics.cost_projection.growth_rate_pct > 0 ? '+' : ''}{storageAnalytics.cost_projection.growth_rate_pct}%
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">12-Month Projected</p>
                                <p className="text-white font-medium">${storageAnalytics.cost_projection.projected_12m_cost_usd}</p>
                              </div>
                            </div>
                            <p className="text-gray-600 text-xs mt-2">Based on $0.023/GB/month S3 Standard pricing</p>
                          </div>
                        )}

                        {/* Upload Activity Trend */}
                        {storageAnalytics.activity_trend?.length > 0 && (
                          <div className="bg-[#0a0f1a] rounded-xl p-4 border border-gray-800">
                            <h4 className="text-sm font-semibold text-white mb-3">Upload Activity (Last 30 Days)</h4>
                            <div className="flex items-end gap-1 h-20">
                              {storageAnalytics.activity_trend.map((d, i) => {
                                const maxUploads = Math.max(...storageAnalytics.activity_trend.map(t => t.uploads), 1);
                                const height = Math.max((d.uploads / maxUploads) * 100, 4);
                                return (
                                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                                    <div className="absolute -top-6 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                      {d.date}: {d.uploads} files ({d.size_mb} MB)
                                    </div>
                                    <div
                                      className="w-full bg-cyan-500/60 rounded-t hover:bg-cyan-400/80 transition-colors cursor-pointer"
                                      style={{ height: `${height}%`, minHeight: '3px' }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Per-User Storage */}
                        {storageAnalytics.per_user?.length > 0 && (
                          <div className="bg-[#0a0f1a] rounded-xl p-4 border border-gray-800">
                            <h4 className="text-sm font-semibold text-white mb-3">Storage by User (Top 10)</h4>
                            <div className="space-y-2">
                              {storageAnalytics.per_user.slice(0, 10).map((u, i) => {
                                const maxMB = Math.max(...storageAnalytics.per_user.map(x => x.total_size_mb), 1);
                                const pct = (u.total_size_mb / maxMB) * 100;
                                return (
                                  <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-400 w-48 truncate">{u.email}</span>
                                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                                    </div>
                                    <span className="text-gray-400 w-24 text-right">{u.total_size_mb} MB ({u.file_count})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-gray-500 text-sm">Click refresh to load storage analytics</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Alert Settings Panel */}
                <Card className="bg-[#1a2332] border-gray-800" data-testid="alert-settings-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        Alert Configuration
                      </h3>
                      {!editingAlerts ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => { if (!alertForm && alertSettings) setAlertForm(JSON.parse(JSON.stringify(alertSettings))); setEditingAlerts(true); }}
                          data-testid="edit-alert-settings-btn"
                        >
                          <Settings className="w-4 h-4 mr-1" /> Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-gray-600 text-gray-400" onClick={() => { setEditingAlerts(false); setAlertForm(JSON.parse(JSON.stringify(alertSettings))); }}>Cancel</Button>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={saveAlertSettings} disabled={savingAlerts} data-testid="save-alert-settings-btn">
                            <Save className="w-4 h-4 mr-1" /> {savingAlerts ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {alertForm ? (
                      <div className="space-y-5">
                        {/* Timing */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-gray-400 text-xs block mb-1.5">Check Interval (minutes)</label>
                            <input
                              type="number"
                              min={5} max={1440}
                              value={alertForm.check_interval_minutes}
                              onChange={(e) => setAlertForm(f => ({...f, check_interval_minutes: parseInt(e.target.value) || 30}))}
                              disabled={!editingAlerts}
                              className="w-full px-3 py-2 rounded-lg bg-[#0a0f1a] border border-gray-700 text-white disabled:opacity-50"
                              data-testid="alert-check-interval"
                            />
                            <p className="text-gray-600 text-xs mt-1">How often to check balance (5–1440 min)</p>
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1.5">Cooldown Period (hours)</label>
                            <input
                              type="number"
                              min={1} max={168}
                              value={alertForm.cooldown_hours}
                              onChange={(e) => setAlertForm(f => ({...f, cooldown_hours: parseInt(e.target.value) || 24}))}
                              disabled={!editingAlerts}
                              className="w-full px-3 py-2 rounded-lg bg-[#0a0f1a] border border-gray-700 text-white disabled:opacity-50"
                              data-testid="alert-cooldown"
                            />
                            <p className="text-gray-600 text-xs mt-1">Don't repeat same alert within this period (1–168h)</p>
                          </div>
                        </div>

                        {/* Notification Channels */}
                        <div>
                          <label className="text-gray-400 text-xs block mb-2">Notification Channels</label>
                          <div className="flex gap-4">
                            <button
                              onClick={() => editingAlerts && setAlertForm(f => ({...f, email_alerts_enabled: !f.email_alerts_enabled}))}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.email_alerts_enabled ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-gray-800/50 border-gray-700 text-gray-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                              data-testid="toggle-email-alerts"
                            >
                              {alertForm.email_alerts_enabled ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                              Email Alerts
                            </button>
                            <button
                              onClick={() => editingAlerts && setAlertForm(f => ({...f, in_app_alerts_enabled: !f.in_app_alerts_enabled}))}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.in_app_alerts_enabled ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-gray-800/50 border-gray-700 text-gray-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                              data-testid="toggle-inapp-alerts"
                            >
                              {alertForm.in_app_alerts_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                              In-App Alerts
                            </button>
                          </div>
                        </div>

                        {/* Thresholds */}
                        <div>
                          <label className="text-gray-400 text-xs block mb-2">Alert Thresholds</label>
                          <div className="space-y-2">
                            {alertForm.thresholds.map((t, idx) => (
                              <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${t.enabled ? (t.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' : t.level === 'critical' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-yellow-500/5 border-yellow-500/20') : 'bg-gray-800/30 border-gray-700'}`}>
                                <button
                                  onClick={() => {
                                    if (!editingAlerts) return;
                                    const updated = [...alertForm.thresholds];
                                    updated[idx] = {...updated[idx], enabled: !updated[idx].enabled};
                                    setAlertForm(f => ({...f, thresholds: updated}));
                                  }}
                                  className={!editingAlerts ? 'cursor-default' : 'cursor-pointer'}
                                  data-testid={`toggle-threshold-${t.level}`}
                                >
                                  {t.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-600" />}
                                </button>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase w-24 text-center ${t.level === 'emergency' ? 'bg-red-500/20 text-red-400' : t.level === 'critical' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                  {t.level}
                                </span>
                                <span className="text-gray-400 text-sm">&lt;</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={t.hbar}
                                  onChange={(e) => {
                                    const updated = [...alertForm.thresholds];
                                    updated[idx] = {...updated[idx], hbar: parseFloat(e.target.value) || 0};
                                    setAlertForm(f => ({...f, thresholds: updated}));
                                  }}
                                  disabled={!editingAlerts}
                                  className="w-20 px-2 py-1 rounded bg-[#0a0f1a] border border-gray-700 text-white text-sm disabled:opacity-50"
                                />
                                <span className="text-gray-400 text-sm">HBAR</span>
                                <span className="text-gray-500 text-xs ml-auto hidden sm:inline">{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-12 text-center">
                  <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Click refresh to load operations data</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Security Compliance
              </h2>
              <div className="flex items-center gap-2">
              <Button
                onClick={fetchSecurityCompliance}
                disabled={loadingSecurity}
                variant="outline"
                className="border-gray-700"
                data-testid="security-refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSecurity ? 'animate-spin' : ''}`} />
              </Button>
              {securityData && (
                <Button
                  onClick={exportSecurityPdf}
                  disabled={exportingPdf}
                  className="bg-blue-600 hover:bg-blue-500"
                  data-testid="security-export-pdf-btn"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {exportingPdf ? 'Exporting...' : 'Export PDF'}
                </Button>
              )}
              </div>
            </div>

            {loadingSecurity && !securityData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
              </div>
            ) : securityData ? (
              <>
                {/* Score Banner */}
                <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-[#1a2332] p-6" data-testid="security-score-banner">
                  <div className="flex items-center gap-8">
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={securityData.score_pct >= 90 ? '#10b981' : securityData.score_pct >= 70 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${securityData.score_pct * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">{securityData.score_pct}%</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">
                        {securityData.score_pct >= 90 ? 'Excellent' : securityData.score_pct >= 70 ? 'Good' : 'Needs Attention'}
                      </h3>
                      <p className="text-gray-400">
                        {securityData.active_features} of {securityData.total_features} security features active
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        Last checked: {new Date(securityData.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {Object.entries(securityData.categories).map(([key, cat]) => {
                    const activeCount = cat.items.filter(i => i.status === 'active').length;
                    const allActive = activeCount === cat.items.length;
                    const catIcons = {
                      authentication: Lock,
                      sso: Key,
                      data_protection: Shield,
                      network_security: Network,
                      access_control: Fingerprint,
                      monitoring: Activity,
                    };
                    const CatIcon = catIcons[key] || Shield;
                    return (
                      <Card key={key} className="bg-[#1a2332] border-gray-800" data-testid={`security-cat-${key}`}>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                              <CatIcon className="w-4 h-4 text-blue-400" />
                              {cat.label}
                            </h4>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {activeCount}/{cat.items.length}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {cat.items.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.status === 'active' ? 'bg-emerald-400' : item.status === 'not_configured' || item.status === 'missing' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                                <div className="min-w-0">
                                  <p className="text-gray-200 text-sm font-medium">{item.name}</p>
                                  <p className="text-gray-500 text-xs mt-0.5">{item.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-12 text-center">
                  <ShieldCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Click refresh to load security compliance data</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <PieChart className="w-6 h-6 text-blue-500" />
                Platform Analytics
              </h2>
              <div className="flex items-center gap-3">
                <select
                  value={analyticsPeriod}
                  onChange={(e) => {
                    setAnalyticsPeriod(Number(e.target.value));
                    fetchAnalyticsData(Number(e.target.value));
                  }}
                  className="px-3 py-2 rounded-lg bg-[#0a0f1a] border border-gray-700 text-white"
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                  <option value={180}>Last 6 Months</option>
                  <option value={365}>Last Year</option>
                </select>
                <Button
                  onClick={() => fetchAnalyticsData()}
                  disabled={loadingAnalytics}
                  variant="outline"
                  className="border-gray-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {loadingAnalytics && !analyticsData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
            ) : analyticsData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="analytics-summary-cards">
                  <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30" data-testid="analytics-total-revenue">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">${analyticsData.summary.total_revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30" data-testid="analytics-new-users">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">New Users</p>
                      <p className="text-2xl font-bold text-white">{analyticsData.summary.new_users}</p>
                      <p className="text-xs text-gray-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30" data-testid="analytics-notarizations">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">Notarizations</p>
                      <p className="text-2xl font-bold text-white">{analyticsData.summary.total_notarizations}</p>
                      <p className="text-xs text-green-400 mt-1">{analyticsData.summary.completed_notarizations} completed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-orange-500/30" data-testid="analytics-transactions">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">Transactions</p>
                      <p className="text-2xl font-bold text-white">{analyticsData.summary.total_transactions}</p>
                      <p className="text-xs text-gray-500 mt-1">Orchestrator</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Trends Chart */}
                <Card className="bg-[#1a2332] border-gray-800">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Revenue Trends
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analyticsData.revenue_trends}>
                        <defs>
                          <linearGradient id="stripeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#635BFF" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#635BFF" stopOpacity={0.1}/>
                          </linearGradient>
                          <linearGradient id="cryptoGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F7931A" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#F7931A" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value) => [`$${value}`, '']}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="stripe" name="Stripe" stroke="#635BFF" fill="url(#stripeGradient)" />
                        <Area type="monotone" dataKey="crypto" name="Crypto" stroke="#F7931A" fill="url(#cryptoGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Growth Chart */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        User Growth
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={analyticsData.user_growth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Line type="monotone" dataKey="total_users" name="Total Users" stroke="#3B82F6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="new_users" name="New Users" stroke="#10B981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Payment Distribution Pie Chart */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-orange-500" />
                        Payment Distribution
                      </h3>
                      {analyticsData.payment_distribution.some(p => p.value > 0) ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <RechartsPie>
                            <Pie
                              data={analyticsData.payment_distribution.filter(p => p.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }) => `${name}: $${value}`}
                              labelLine={{ stroke: '#666' }}
                            >
                              {analyticsData.payment_distribution.filter(p => p.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                              formatter={(value) => [`$${value}`, 'Revenue']}
                            />
                          </RechartsPie>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-gray-500">
                          No payment data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notarization Volume Chart */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-500" />
                        Notarization Volume
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analyticsData.notarization_volume}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Legend />
                          <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Top Notaries */}
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-500" />
                        Top Performing Notaries
                      </h3>
                      {analyticsData.top_notaries.length > 0 ? (
                        <div className="space-y-3">
                          {analyticsData.top_notaries.slice(0, 5).map((notary, idx) => (
                            <div key={notary.notary_id} className="flex items-center justify-between p-3 bg-[#0a0f1a] rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-yellow-500 text-black' :
                                  idx === 1 ? 'bg-gray-400 text-black' :
                                  idx === 2 ? 'bg-orange-600 text-white' :
                                  'bg-gray-700 text-white'
                                }`}>
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-white font-medium">{notary.name || 'Unknown'}</p>
                                  <p className="text-gray-500 text-xs">{notary.email}</p>
                                </div>
                              </div>
                              <span className="text-green-400 font-bold">{notary.completed_notarizations}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">No notary activity data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Document & Transaction Types */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Document Types</h3>
                      {analyticsData.document_types.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.document_types.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-gray-400">{doc.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full"
                                    style={{ width: `${(doc.count / analyticsData.document_types[0].count) * 100}%` }}
                                  />
                                </div>
                                <span className="text-white font-medium w-8 text-right">{doc.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">No document data</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Transaction Types</h3>
                      {analyticsData.transaction_types.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.transaction_types.map((tx, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-gray-400">{tx.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${(tx.count / analyticsData.transaction_types[0].count) * 100}%` }}
                                  />
                                </div>
                                <span className="text-white font-medium w-8 text-right">{tx.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">No transaction data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card className="bg-[#1a2332] border-gray-800">
                <CardContent className="p-12 text-center">
                  <PieChart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Click refresh to load analytics data</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <Card className="bg-[#1a2332] border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">All Users</h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[#0a0f1a] border-gray-700 text-white w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 text-sm py-3 px-4">User</th>
                      <th className="text-left text-gray-400 text-sm py-3 px-4">Role</th>
                      <th className="text-left text-gray-400 text-sm py-3 px-4">Status</th>
                      <th className="text-left text-gray-400 text-sm py-3 px-4">Notary</th>
                      <th className="text-left text-gray-400 text-sm py-3 px-4">Joined</th>
                      <th className="text-right text-gray-400 text-sm py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => 
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((user) => (
                      <tr key={user.id} className="border-b border-gray-800/50 hover:bg-[#0a0f1a]">
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{user.full_name || 'N/A'}</p>
                          <p className="text-gray-500 text-sm">{user.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                            user.role === 'notary' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {user.role || 'user'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {user.status || 'active'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {user.is_notary ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-600" />
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewUserDetails(user.id)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'notaries' && (
          <Card className="bg-[#1a2332] border-gray-800">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-6">Notary Profiles</h3>
              <div className="space-y-4">
                {notaries.map((notary) => (
                  <div key={notary.id} className="bg-[#0a0f1a] rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <UserCheck className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{notary.user_full_name || 'Unknown'}</p>
                        <p className="text-gray-500 text-sm">{notary.user_email}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            Commission: {notary.commission_number || 'N/A'}
                          </span>
                          <span className="text-xs text-gray-400">|</span>
                          <span className="text-xs text-gray-400">
                            State: {notary.state || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      notary.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      notary.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {notary.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'audit' && (
          <Card className="bg-[#1a2332] border-gray-800">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-6">Audit Logs</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-[#0a0f1a] rounded-lg p-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      log.severity === 'critical' ? 'bg-red-500' :
                      log.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{log.action}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500 text-xs">{log.resource_type}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-500 text-xs">{log.user_email || 'System'}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2332] rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">User Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => { setShowUserModal(false); setSelectedUser(null); }}
                  className="text-gray-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div>
                <h3 className="text-white font-semibold mb-3">Profile</h3>
                <div className="bg-[#0a0f1a] rounded-lg p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs">Email</p>
                    <p className="text-white">{selectedUser.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Full Name</p>
                    <p className="text-white">{selectedUser.user?.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Role</p>
                    <p className="text-white capitalize">{selectedUser.user?.role || 'user'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Status</p>
                    <p className={selectedUser.user?.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                      {selectedUser.user?.status || 'active'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notary Profile */}
              {selectedUser.notary_profile && (
                <div>
                  <h3 className="text-white font-semibold mb-3">Notary Profile</h3>
                  <div className="bg-[#0a0f1a] rounded-lg p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Commission #</p>
                      <p className="text-white">{selectedUser.notary_profile.commission_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">State</p>
                      <p className="text-white">{selectedUser.notary_profile.state || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
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
              <div className="flex gap-3 pt-4 border-t border-gray-800">
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
