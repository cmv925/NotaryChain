import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { RefreshCw } from 'lucide-react';
import { OnboardingTour } from '../components/OnboardingTour';
import useViewMode from '../hooks/useViewMode';
import { toast } from '../hooks/use-toast';
import { Breadcrumbs } from '../components/Breadcrumbs';
import axios from 'axios';
import { OverviewTab } from '../components/admin/tabs/OverviewTab';
import { OperationsTab } from '../components/admin/tabs/OperationsTab';
import { SecurityTab } from '../components/admin/tabs/SecurityTab';
import { AnalyticsTab } from '../components/admin/tabs/AnalyticsTab';
import { UsersTab } from '../components/admin/tabs/UsersTab';
import { NotariesTab } from '../components/admin/tabs/NotariesTab';
import { AuditTab } from '../components/admin/tabs/AuditTab';
import AdminHeader from '../components/admin/AdminHeader';
import AdminStatsGrid from '../components/admin/AdminStatsGrid';
import AdminTabsNav from '../components/admin/AdminTabsNav';
import UserDetailsModal from '../components/admin/UserDetailsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  const [viewMode] = useViewMode();
  const isNotaryMode = viewMode === 'notary';
  
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
      <AdminHeader
        isNotaryMode={isNotaryMode}
        onRefresh={fetchDashboardData}
        token={token}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AdminStatsGrid stats={stats} />

        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Command Authority Suite' }]} />

        <AdminTabsNav
          activeTab={activeTab}
          onSelect={(tabId) => {
            setActiveTab(tabId);
            if (tabId === 'audit') fetchAuditLogs();
            if (tabId === 'analytics' && !analyticsData) fetchAnalyticsData();
            if (tabId === 'analytics' && !ceremonyAnalytics) fetchCeremonyAnalytics();
            if (tabId === 'operations' && !opsData) fetchOpsMetrics();
            if (tabId === 'operations' && !alertSettings) fetchAlertSettings();
            if (tabId === 'operations' && !storageAnalytics) fetchStorageAnalytics();
            if (tabId === 'operations' && !serviceHealth) fetchServiceHealth();
            if (tabId === 'operations' && !incidents) fetchIncidents();
            if (tabId === 'security' && !securityData) fetchSecurityCompliance();
          }}
        />

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
        <UserDetailsModal
          user={selectedUser}
          processingAction={processingAction}
          onClose={() => { setShowUserModal(false); setSelectedUser(null); }}
          onStatusChange={handleUserStatusChange}
        />
      )}
      <OnboardingTour portal="command_authority" />
    </div>
  );
};

export default AdminDashboard;
