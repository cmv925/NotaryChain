import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client.
 *
 * Defaults tuned for this app:
 *  - staleTime 60s: most reference/data reads don't change second-to-second, so
 *    we avoid hammering the backend on every mount/route change.
 *  - 1 retry: don't spam a failing endpoint.
 *  - refetchOnWindowFocus off: prevents a burst of refetches when users tab back.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
