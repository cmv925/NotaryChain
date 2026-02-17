import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, Users, FileText, TrendingUp, DollarSign,
  CheckCircle, XCircle, Clock, RefreshCw, Search,
  BarChart3, Activity, Wallet, LogOut, ChevronDown,
  Eye, UserCheck, UserX, Settings, AlertTriangle, PieChart
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">
                  Notary<span className="text-blue-500">Chain</span>
                </span>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-red-400 font-semibold">Admin Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
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
              { id: 'users', label: 'Users', icon: Users },
              { id: 'notaries', label: 'Notaries', icon: UserCheck },
              { id: 'audit', label: 'Audit Logs', icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'audit') fetchAuditLogs();
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
