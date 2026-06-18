import { useCallback, useMemo, createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useFeatureMap } from '../hooks/queries';

const SubscriptionContext = createContext({
  plan: 'free',
  planName: 'Starter',
  features: {},
  loading: true,
  canAccess: () => true,
  refresh: () => {},
});

const PLAN_NAMES = { free: 'Starter', pro: 'Professional', enterprise: 'Enterprise' };

export function SubscriptionProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useFeatureMap(token, isAuthenticated);

  const plan = data?.user_plan || 'free';
  const features = useMemo(() => data?.features || {}, [data]);
  const planName = PLAN_NAMES[plan] || 'Starter';
  // Only "loading" while an authenticated fetch is in flight.
  const loading = isAuthenticated ? isLoading : false;

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['feature-map'] }),
    [queryClient],
  );

  const canAccess = useCallback((feature) => {
    if (!feature) return true;
    const f = features[feature];
    return f ? f.allowed : true;
  }, [features]);

  return (
    <SubscriptionContext.Provider value={{ plan, planName, features, loading, canAccess, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
