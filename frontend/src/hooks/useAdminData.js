/**
 * useAdminData — owns ALL data fetching, derived state, and mutations for the
 * Command Authority Suite (AdminDashboard). Extracted so the page component
 * can focus on layout + routing decisions.
 *
 * Returns three buckets:
 *   • data:    all server-side state (stats, users, notaries, opsData, ...)
 *   • flags:   all loading / saving / exporting flags
 *   • actions: imperatively callable fetchers + mutations
 *
 * Lazy-loaders (e.g. fetchAuditLogs, fetchAnalyticsData) are exposed on
 * `actions` and are called by the page as the user navigates between tabs.
 *
 * Real-time: subscribes to `notary_queue_update`, `request_assigned`, and
 * `request_completed` WebSocket events and triggers a baseline refresh.
 */
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { toast } from './use-toast';
import { emitTelemetry } from './useDashboardTelemetry';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function useAdminData({ onForbidden } = {}) {
  const { token } = useAuth();
  const { subscribe } = useWS();

  // ─── Baseline data ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [notaries, setNotaries] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [revenueData, setRevenueData] = useState(null);

  // ─── Lazy-loaded tab data ─────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [ceremonyAnalytics, setCeremonyAnalytics] = useState(null);
  const [opsData, setOpsData] = useState(null);
  const [alertSettings, setAlertSettings] = useState(null);
  const [alertForm, setAlertForm] = useState(null);
  const [securityData, setSecurityData] = useState(null);
  const [storageAnalytics, setStorageAnalytics] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [incidents, setIncidents] = useState(null);

  // ─── Mutation / per-row state ────────────────────────────────
  const [selectedUser, setSelectedUser] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  // ─── Loading / saving / exporting flags ──────────────────────
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingCeremonyAnalytics, setLoadingCeremonyAnalytics] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [loadingStorageAnalytics, setLoadingStorageAnalytics] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingIncidents, setExportingIncidents] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);

  // Stable headers reference per token change.
  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  // ─── Fetchers ─────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, notariesRes, pendingRes, revenueRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, authHeaders),
        axios.get(`${API}/admin/users?page_size=10`, authHeaders),
        axios.get(`${API}/admin/notaries?page_size=10`, authHeaders),
        axios.get(`${API}/admin/notaries/pending`, authHeaders),
        axios.get(`${API}/admin/analytics/revenue?days=30`, authHeaders),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setNotaries(notariesRes.data.notaries);
      setPendingApplications(pendingRes.data.applications);
      setRevenueData(revenueRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast({ title: 'Access Denied', description: 'Admin access required', variant: 'destructive' });
        onForbidden?.();
      } else {
        toast({ title: 'Error', description: 'Failed to load admin data', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${API}/audit/logs?page_size=50`, authHeaders);
      setAuditLogs(res.data.logs);
    } catch {
      toast({ title: 'Error', description: 'Failed to load audit logs', variant: 'destructive' });
    }
  };

  const fetchAnalyticsData = async (period = 30) => {
    setLoadingAnalytics(true);
    try {
      const res = await axios.get(`${API}/admin/analytics/comprehensive?days=${period}`, authHeaders);
      setAnalyticsData(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load analytics data', variant: 'destructive' });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchOpsMetrics = async () => {
    setLoadingOps(true);
    try {
      const res = await axios.get(`${API}/admin/ops/metrics`, authHeaders);
      setOpsData(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load ops metrics', variant: 'destructive' });
    } finally {
      setLoadingOps(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/ops/alert-settings`, authHeaders);
      setAlertSettings(res.data);
      setAlertForm(JSON.parse(JSON.stringify(res.data)));
    } catch {
      toast({ title: 'Error', description: 'Failed to load alert settings', variant: 'destructive' });
    }
  };

  const saveAlertSettings = async () => {
    setSavingAlerts(true);
    try {
      await axios.put(`${API}/admin/ops/alert-settings`, alertForm, authHeaders);
      toast({ title: 'Saved', description: 'Alert settings updated' });
      setAlertSettings(JSON.parse(JSON.stringify(alertForm)));
      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to save',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSavingAlerts(false);
    }
  };

  const fetchSecurityCompliance = async () => {
    setLoadingSecurity(true);
    try {
      const res = await axios.get(`${API}/admin/security/compliance`, authHeaders);
      setSecurityData(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load security data', variant: 'destructive' });
    } finally {
      setLoadingSecurity(false);
    }
  };

  const fetchStorageAnalytics = async () => {
    setLoadingStorageAnalytics(true);
    try {
      const res = await axios.get(`${API}/admin/ops/storage-analytics`, authHeaders);
      setStorageAnalytics(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load storage analytics', variant: 'destructive' });
    } finally {
      setLoadingStorageAnalytics(false);
    }
  };

  const fetchCeremonyAnalytics = async () => {
    setLoadingCeremonyAnalytics(true);
    try {
      const res = await axios.get(`${API}/ceremony/analytics/stats`, authHeaders);
      setCeremonyAnalytics(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load ceremony analytics', variant: 'destructive' });
    } finally {
      setLoadingCeremonyAnalytics(false);
    }
  };

  const fetchServiceHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await axios.get(`${API}/admin/ops/service-health`, authHeaders);
      setServiceHealth(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load service health', variant: 'destructive' });
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const res = await axios.get(`${API}/admin/incidents?days=7`, authHeaders);
      setIncidents(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load incidents', variant: 'destructive' });
    } finally {
      setLoadingIncidents(false);
    }
  };

  const exportSecurityPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await axios.get(`${API}/admin/security/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `NotaryChain_Security_Compliance_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Security report downloaded' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export PDF', variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportIncidentPdf = async () => {
    setExportingIncidents(true);
    try {
      const res = await axios.get(`${API}/admin/incidents/export-pdf?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `NotaryChain_Incident_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Incident report downloaded' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    } finally {
      setExportingIncidents(false);
    }
  };

  // ─── Mutations ────────────────────────────────────────────────
  const handleApproveNotary = async (notaryId) => {
    setProcessingAction(notaryId);
    try {
      await axios.post(`${API}/admin/notaries/${notaryId}/approve`, {}, authHeaders);
      toast({ title: 'Success', description: 'Notary application approved' });
      emitTelemetry({ surface: 'command_authority', action: 'approve_notary', target_id: notaryId, outcome: 'success' });
      fetchDashboardData();
    } catch {
      emitTelemetry({ surface: 'command_authority', action: 'approve_notary', target_id: notaryId, outcome: 'error' });
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
      emitTelemetry({ surface: 'command_authority', action: 'reject_notary', target_id: notaryId, outcome: 'success' });
      fetchDashboardData();
    } catch {
      emitTelemetry({ surface: 'command_authority', action: 'reject_notary', target_id: notaryId, outcome: 'error' });
      toast({ title: 'Error', description: 'Failed to reject application', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUserStatusChange = async (userId, newStatus) => {
    setProcessingAction(userId);
    try {
      await axios.patch(`${API}/admin/users/${userId}/status?status=${newStatus}`, {}, authHeaders);
      toast({
        title: 'Success',
        description: `User ${newStatus === 'active' ? 'enabled' : 'disabled'}`,
      });
      emitTelemetry({
        surface: 'command_authority',
        action: newStatus === 'active' ? 'enable_user' : 'disable_user',
        target_id: userId,
        outcome: 'success',
      });
      fetchDashboardData();
      setSelectedUser(null);
    } catch {
      emitTelemetry({
        surface: 'command_authority',
        action: newStatus === 'active' ? 'enable_user' : 'disable_user',
        target_id: userId,
        outcome: 'error',
      });
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const res = await axios.get(`${API}/admin/users/${userId}`, authHeaders);
      setSelectedUser(res.data);
      return res.data;
    } catch {
      toast({ title: 'Error', description: 'Failed to load user details', variant: 'destructive' });
      return null;
    }
  };

  // ─── Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only baseline
  }, []);

  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [subscribe]);

  return {
    data: {
      stats, users, notaries, pendingApplications, revenueData,
      auditLogs, analyticsData, ceremonyAnalytics, opsData, alertSettings,
      alertForm, securityData, storageAnalytics, serviceHealth, incidents,
      selectedUser, processingAction,
    },
    flags: {
      loading,
      loadingAnalytics, loadingCeremonyAnalytics, loadingOps, loadingSecurity,
      loadingStorageAnalytics, loadingHealth, loadingIncidents,
      exportingPdf, exportingIncidents, savingAlerts,
    },
    actions: {
      fetchDashboardData, fetchAuditLogs, fetchAnalyticsData,
      fetchOpsMetrics, fetchAlertSettings, saveAlertSettings,
      fetchSecurityCompliance, fetchStorageAnalytics, fetchCeremonyAnalytics,
      fetchServiceHealth, fetchIncidents,
      exportSecurityPdf, exportIncidentPdf,
      handleApproveNotary, handleRejectNotary, handleUserStatusChange,
      viewUserDetails,
      setAlertForm, setSelectedUser,
    },
  };
}
