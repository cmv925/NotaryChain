import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UpgradeGate } from './UpgradeGate';

export function GatedRoute({ feature, title, description, children }) {
  const { canAccess, loading } = useSubscription();

  if (loading) return children;
  if (canAccess(feature)) return children;

  return (
    <div className="min-h-screen bg-cream-100">
      <UpgradeGate feature={feature} title={title} description={description}>
        {children}
      </UpgradeGate>
    </div>
  );
}
