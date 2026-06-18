/**
 * Shared React Query data hooks.
 *
 * Centralizes the app's read-heavy, cacheable GET endpoints so multiple
 * components/pages reuse one cached result instead of refetching on every mount.
 */
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
