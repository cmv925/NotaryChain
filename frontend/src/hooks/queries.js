/**
 * Shared React Query data hooks.
 *
 * Centralizes the app's read-heavy, cacheable GET endpoints so multiple
 * components/pages reuse one cached result instead of refetching on every mount.
 */
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Public subscription plans — rarely change; cache for 5 minutes. */
export function usePlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await axios.get(`${API}/subscriptions/plans`);
      return res.data.plans || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Public Florida launch stats — used on landing pages; cache for 2 minutes. */
export function usePublicFLStats() {
  return useQuery({
    queryKey: ['fl-public-stats'],
    queryFn: async () => {
      const res = await axios.get(`${API}/fl/launch/public-stats`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Feature gate map for the current user — drives every GatedRoute. */
export function useFeatureMap(token, isAuthenticated) {
  return useQuery({
    queryKey: ['feature-map'],
    queryFn: async () => {
      const res = await axios.get(`${API}/subscriptions/feature-map`, authHeaders(token));
      return res.data;
    },
    enabled: !!isAuthenticated && !!token,
    staleTime: 2 * 60 * 1000,
  });
}

/** Client dashboard seal stats. */
export function useDashboardStats(token) {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await axios.get(`${API}/documents/stats`, authHeaders(token))).data,
    enabled: !!token,
  });
}

/** Recent sealed documents for the dashboard. */
export function useRecentSeals(token, limit = 10) {
  return useQuery({
    queryKey: ['recent-seals', limit],
    queryFn: async () => (await axios.get(`${API}/documents/seals?limit=${limit}`, authHeaders(token))).data,
    enabled: !!token,
  });
}

/** The caller's notarization requests. */
export function useMyNotaryRequests(token) {
  return useQuery({
    queryKey: ['my-notary-requests'],
    queryFn: async () => {
      try {
        return (await axios.get(`${API}/notary/requests/my`, authHeaders(token))).data || [];
      } catch {
        return [];
      }
    },
    enabled: !!token,
  });
}
