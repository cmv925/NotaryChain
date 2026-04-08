import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Lock, Crown, Building2, ArrowRight } from 'lucide-react';

const PLAN_META = {
  pro: { name: 'Professional', price: 49, icon: Crown, color: 'blue', accent: 'from-blue-600 to-blue-400' },
  enterprise: { name: 'Enterprise', price: 199, icon: Building2, color: 'violet', accent: 'from-violet-600 to-violet-400' },
};

export function UpgradeGate({ feature, children, title, description }) {
  const { canAccess, loading, plan, features } = useSubscription();
  const navigate = useNavigate();

  if (loading) return children;
  if (canAccess(feature)) return children;

  const featureInfo = features[feature] || {};
  const requiredPlan = featureInfo.required_plan || 'pro';
  const meta = PLAN_META[requiredPlan] || PLAN_META.pro;
  const PlanIcon = meta.icon;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6" data-testid={`upgrade-gate-${feature}`}>
      <Card className="max-w-md w-full bg-[#162032] border-slate-700/50 text-white overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${meta.accent}`} />
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-violet-400" />
          </div>

          <h2 className="text-xl font-bold mb-2" data-testid="upgrade-gate-title">
            {title || 'Premium Feature'}
          </h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {description || `This feature requires the ${meta.name} plan. Upgrade to unlock advanced capabilities.`}
          </p>

          <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-800">
            <div className="flex items-center justify-center gap-3">
              <PlanIcon className="w-5 h-5 text-violet-400" />
              <span className="text-white font-semibold">{meta.name}</span>
              <span className="text-slate-500">|</span>
              <span className="text-white font-bold text-lg">${meta.price}</span>
              <span className="text-slate-500 text-sm">/mo</span>
            </div>
          </div>

          <Button
            onClick={() => navigate('/pricing')}
            className={`w-full bg-gradient-to-r ${meta.accent} hover:opacity-90 text-white font-medium`}
            data-testid="upgrade-gate-btn"
          >
            Upgrade Now <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <p className="text-slate-600 text-xs mt-4">
            Currently on: <span className="text-slate-400 capitalize">{plan}</span> plan
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
