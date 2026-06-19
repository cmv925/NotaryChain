/**
 * useNotaryData — owns ALL data fetching, mutations, and per-request state
 * for the Assurance Portal (NotaryDashboard).
 *
 * Returns three buckets:
 *   • data:    server-side state + derived split lists (pending/assigned/completed)
 *   • flags:   loading / processing flags
 *   • actions: imperative fetchers + mutations (assign, complete, reject…)
 *
 * Real-time: subscribes to `notary_queue_update`, `request_assigned`,
 * `request_completed` and re-fetches the baseline.
 *
 * The split between "notary view" (queue + assigned-to-me) and "client view"
 * (their own requests) is preserved via the `is_notary` flag from
 * GET /api/notary/stats — we silently fall back to client-side request lists
 * for non-notary users so the dashboard still works.
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useWS } from '../contexts/WebSocketContext';
import { toast } from './use-toast';
import { emitTelemetry } from './useDashboardTelemetry';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function useNotaryData() {
  const { token } = useAuth();
  const { subscribe } = useWS();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ─── Baseline data (React Query: cached across remounts, WS-invalidated) ──
  const { data: baseline = { stats: null, pendingRequests: [], assignedRequests: [], completedRequests: [] }, isLoading: loading } = useQuery({
    queryKey: ['notary-dashboard'],
    enabled: !!token,
    queryFn: async () => {
      const [statsRes, pendingRes, assignedRes, myReqsRes] = await Promise.all([
        axios.get(`${API}/notary/stats`, authHeaders).catch(() => ({ data: { is_notary: false } })),
        axios.get(`${API}/notary/requests/pending`, authHeaders).catch(() => ({ data: [] })),
        axios.get(`${API}/notary/requests/assigned`, authHeaders).catch(() => ({ data: [] })),
        axios.get(`${API}/notary/requests/my`, authHeaders).catch(() => ({ data: [] })),
      ]);
      const isNotary = !!statsRes.data?.is_notary;
      if (isNotary) {
        const assigned = assignedRes.data;
        return {
          stats: statsRes.data,
          pendingRequests: pendingRes.data,
          assignedRequests: assigned.filter((r) => r.status !== 'completed'),
          completedRequests: assigned.filter((r) => r.status === 'completed'),
        };
      }
      const myReqs = myReqsRes.data || [];
      return {
        stats: statsRes.data,
        pendingRequests: myReqs.filter((r) => ['pending', 'submitted', 'reviewing'].includes(r.status)),
        assignedRequests: myReqs.filter((r) => ['assigned', 'in_progress'].includes(r.status)),
        completedRequests: myReqs.filter((r) => r.status === 'completed'),
      };
    },
  });
  const { stats, pendingRequests, assignedRequests, completedRequests } = baseline;

  // ─── Detail / per-row state ────────────────────────────────────
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [copilotData, setCopilotData] = useState(null);
  const [journalPrefill, setJournalPrefill] = useState(null);

  // ─── Loading flags ─────────────────────────────────────────────
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [loadingJournal, setLoadingJournal] = useState(false);

  // Refresh = invalidate the cached baseline (dedupes concurrent refetches).
  const fetchDashboardData = () => queryClient.invalidateQueries({ queryKey: ['notary-dashboard'] });

  // ─── Mutations ────────────────────────────────────────────────
  const handleAssignRequest = async (requestId) => {
    setProcessingAction(requestId);
    try {
      await axios.post(`${API}/notary/requests/${requestId}/assign`, {}, authHeaders);
      toast({ title: 'Success', description: 'Request assigned to you' });
      emitTelemetry({ surface: 'assurance', action: 'assign_request', target_id: requestId, outcome: 'success' });
      fetchDashboardData();
    } catch (error) {
      emitTelemetry({ surface: 'assurance', action: 'assign_request', target_id: requestId, outcome: 'error' });
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
      await axios.post(`${API}/video/rooms`, { notary_request_id: requestId }, authHeaders);
      toast({ title: 'Session Created', description: 'Redirecting to video session...' });
      emitTelemetry({ surface: 'assurance', action: 'start_session', target_id: requestId, outcome: 'success' });
      navigate(`/session/${requestId}`);
    } catch (error) {
      emitTelemetry({ surface: 'assurance', action: 'start_session', target_id: requestId, outcome: 'error' });
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
        authHeaders,
      );
      toast({
        title: 'Notarization Complete',
        description: 'Document notarized and sealed on blockchain',
      });
      emitTelemetry({ surface: 'assurance', action: 'complete_notarization', target_id: requestId, outcome: 'success' });
      setSelectedRequest(null);
      fetchDashboardData();
      return true;
    } catch (error) {
      emitTelemetry({ surface: 'assurance', action: 'complete_notarization', target_id: requestId, outcome: 'error' });
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to complete notarization',
        variant: 'destructive',
      });
      return false;
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return false;
    setProcessingAction(requestId);
    try {
      await axios.post(
        `${API}/notary/requests/${requestId}/reject`,
        { reason: 'Unable to process this request' },
        authHeaders,
      );
      toast({ title: 'Request Rejected', description: 'The request has been released back to the pool' });
      emitTelemetry({ surface: 'assurance', action: 'reject_request', target_id: requestId, outcome: 'success' });
      setSelectedRequest(null);
      fetchDashboardData();
      return true;
    } catch (error) {
      emitTelemetry({ surface: 'assurance', action: 'reject_request', target_id: requestId, outcome: 'error' });
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to reject request',
        variant: 'destructive',
      });
      return false;
    } finally {
      setProcessingAction(null);
    }
  };

  // ─── AI / Copilot ─────────────────────────────────────────────
  const fetchAiAnalysis = async (requestId) => {
    setLoadingAi(true);
    try {
      const res = await axios.get(`${API}/ai/analysis/${requestId}`, authHeaders);
      setAiAnalysis(res.data);
    } catch {
      setAiAnalysis(null);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchCopilotAnalysis = async (requestId) => {
    setLoadingCopilot(true);
    setCopilotData(null);
    try {
      const res = await axios.post(`${API}/ai-copilot/analyze`, { request_id: requestId }, authHeaders);
      setCopilotData(res.data);
    } catch {
      toast({ title: 'Copilot Error', description: 'Failed to get AI analysis', variant: 'destructive' });
    } finally {
      setLoadingCopilot(false);
    }
  };

  const fetchJournalPrefill = async (requestId) => {
    setLoadingJournal(true);
    setJournalPrefill(null);
    try {
      const res = await axios.post(`${API}/ai-copilot/prefill-journal`, { request_id: requestId }, authHeaders);
      setJournalPrefill(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to prefill journal', variant: 'destructive' });
    } finally {
      setLoadingJournal(false);
    }
  };

  const openRequest = async (request) => {
    setSelectedRequest(request);
    setAiAnalysis(null);
    setCopilotData(null);
    setJournalPrefill(null);
    await fetchAiAnalysis(request.id);
  };

  const closeRequest = () => setSelectedRequest(null);

  // ─── Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    const unsub1 = subscribe('notary_queue_update', () => fetchDashboardData());
    const unsub2 = subscribe('request_assigned', () => fetchDashboardData());
    const unsub3 = subscribe('request_completed', () => fetchDashboardData());
    return () => { unsub1(); unsub2(); unsub3(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  // Derived metrics — kept here so the page stays declarative.
  const estimatedEarnings = (stats?.total_completed || 0) * 25;
  const todayEarnings = completedRequests.filter((r) => {
    const completed = new Date(r.completed_at || r.created_at);
    const today = new Date();
    return completed.toDateString() === today.toDateString();
  }).length * 25;

  return {
    data: {
      stats,
      pendingRequests,
      assignedRequests,
      completedRequests,
      selectedRequest,
      processingAction,
      aiAnalysis,
      copilotData,
      journalPrefill,
      estimatedEarnings,
      todayEarnings,
    },
    flags: {
      loading,
      loadingAi,
      loadingCopilot,
      loadingJournal,
    },
    actions: {
      fetchDashboardData,
      handleAssignRequest,
      handleStartSession,
      handleCompleteNotarization,
      handleRejectRequest,
      fetchCopilotAnalysis,
      fetchJournalPrefill,
      openRequest,
      closeRequest,
    },
  };
}
