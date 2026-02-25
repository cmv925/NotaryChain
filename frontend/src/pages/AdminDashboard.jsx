import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, Users, FileText, TrendingUp, DollarSign,
  CheckCircle, XCircle, Clock, RefreshCw, Search,
  BarChart3, Activity, Wallet, LogOut, ChevronDown,
  Eye, UserCheck, UserX, Settings, AlertTriangle, PieChart, Plus
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

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">${analyticsData.summary.total_revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">New Users</p>
                      <p className="text-2xl font-bold text-white">{analyticsData.summary.new_users}</p>
                      <p className="text-xs text-gray-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-xs">Notarizations</p>
                      <p className="text-2xl font-bold text-white">{analyticsData.summary.total_notarizations}</p>
                      <p className="text-xs text-green-400 mt-1">{analyticsData.summary.completed_notarizations} completed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-orange-500/30">
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
