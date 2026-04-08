import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionContext = createContext({
  plan: 'free',
  planName: 'Starter',
  features: {},
  loading: true,
  canAccess: () => true,
  refresh: () => {},
});

export function SubscriptionProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState('free');
  const [planName, setPlanName] = useState('Starter');
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API}/subscriptions/feature-map`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlan(res.data.user_plan || 'free');
      setFeatures(res.data.features || {});
      const names = { free: 'Starter', pro: 'Professional', enterprise: 'Enterprise' };
      setPlanName(names[res.data.user_plan] || 'Starter');
    } catch {
      // Default to free
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setLoading(false);
  }, [isAuthenticated, refresh]);

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
