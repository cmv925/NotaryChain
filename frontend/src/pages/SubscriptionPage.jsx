import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { NotificationBell } from '../components/NotificationBell';
import {
  Shield, Crown, Zap, Building2, CreditCard,
  BarChart3, AlertTriangle, CheckCircle, XCircle, BadgePercent
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const planIcons = { free: Zap, pro: Crown, enterprise: Building2 };
const planColors = {
  free: 'text-gray-400',
  pro: 'text-blue-400',
  enterprise: 'text-purple-400',
};

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [subData, setSubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchSubscription(); fetchDiscount(); }, []);

  const fetchSubscription = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/current`, { headers });
      setSubData(res.data);
    } catch { toast({ title: 'Error', description: 'Failed to load subscription', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const fetchDiscount = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/discount`, { headers });
      setDiscountInfo(res.data);
    } catch {}
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.')) return;
    setCancelling(true);
    try {
      await axios.post(`${API}/subscriptions/cancel`, {}, { headers });
      toast({ title: 'Subscription Cancelled', description: 'Your subscription will remain active until the end of the billing period.' });
      fetchSubscription();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to cancel', variant: 'destructive' });
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-white text-xl">Loading subscription...</div>
      </div>
    );
  }

  const plan = subData?.plan || { id: 'free', name: 'Starter', price: 0 };
  const sub = subData?.subscription || {};
  const usage = subData?.usage || {};
  const Icon = planIcons[plan.id] || Zap;
  const color = planColors[plan.id] || 'text-gray-400';

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <CreditCard className="w-5 h-5 text-blue-500" /> Subscription
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Subscription' }]} />
        {/* Current Plan Card */}
        <Card className="bg-[#1a2332] border-gray-800" data-testid="current-plan-card">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl bg-${plan.id === 'enterprise' ? 'purple' : plan.id === 'pro' ? 'blue' : 'gray'}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-7 h-7 ${color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{plan.name} Plan</h2>
                  <p className="text-gray-400 text-sm">
                    {plan.price === 0 ? 'Free forever' : `$${plan.price}/${plan.interval}`}
                  </p>
                  <div className={`inline-flex items-center gap-1.5 mt-1 text-xs ${
                    sub.status === 'active' ? 'text-green-400' :
                    sub.status === 'cancelling' ? 'text-yellow-400' : 'text-gray-400'
                  }`}>
                    {sub.status === 'active' ? <CheckCircle className="w-3 h-3" /> :
                     sub.status === 'cancelling' ? <AlertTriangle className="w-3 h-3" /> :
                     <XCircle className="w-3 h-3" />}
                    {sub.status === 'cancelling' ? 'Cancels at period end' : sub.status || 'Active'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {plan.id !== 'enterprise' && (
                  <Button onClick={() => navigate('/pricing')} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="upgrade-btn">
                    Upgrade
                  </Button>
                )}
                {plan.id !== 'free' && sub.status === 'active' && (
                  <Button variant="outline" onClick={handleCancel} disabled={cancelling} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="cancel-btn">
                    {cancelling ? 'Cancelling...' : 'Cancel'}
                  </Button>
                )}
              </div>
            </div>

            {sub.current_period_end && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-gray-500 text-xs">
                  {sub.status === 'cancelling' ? 'Access until' : 'Next billing date'}:{' '}
                  <span className="text-gray-300">
                    {new Date(sub.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discount Savings Card */}
        {discountInfo && discountInfo.discount_pct > 0 && (
          <Card className="bg-[#1a2332] border-emerald-500/30 border" data-testid="discount-card">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <BadgePercent className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Per-Document Discount</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0a0f1a] rounded-lg border border-gray-800 p-4 text-center">
                  <p className="text-emerald-400 text-3xl font-bold">{discountInfo.discount_pct}%</p>
                  <p className="text-gray-500 text-xs mt-1">Discount Rate</p>
                </div>
                <div className="bg-[#0a0f1a] rounded-lg border border-gray-800 p-4 text-center">
                  <p className="text-white text-3xl font-bold">${discountInfo.total_saved_this_cycle}</p>
                  <p className="text-gray-500 text-xs mt-1">Saved This Cycle</p>
                </div>
                <div className="bg-[#0a0f1a] rounded-lg border border-gray-800 p-4 text-center">
                  <p className="text-white text-3xl font-bold">{discountInfo.docs_discounted_this_cycle}</p>
                  <p className="text-gray-500 text-xs mt-1">Docs Discounted</p>
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">Your <span className="text-emerald-400">{discountInfo.plan_name}</span> plan gives you {discountInfo.discount_pct}% off every document notarization.</p>
            </CardContent>
          </Card>
        )}

        {/* Usage Card */}
        <Card className="bg-[#1a2332] border-gray-800" data-testid="usage-card">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Usage This Month</h3>
            </div>

            <div className="space-y-5">
              {[
                { key: 'notarizations', label: 'Notarizations', icon: Shield },
                { key: 'ai_analyses', label: 'AI Analyses', icon: Zap },
                { key: 'transactions', label: 'Transactions', icon: Building2 },
              ].map(({ key, label, icon: UsageIcon }) => {
                const item = usage[key] || { used: 0, limit: 3 };
                const pct = item.limit > 1000 ? 5 : Math.min(100, (item.used / item.limit) * 100);
                const isOver = item.used >= item.limit && item.limit < 1000;

                return (
                  <div key={key} data-testid={`usage-${key}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <UsageIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-300">{label}</span>
                      </div>
                      <span className={`text-sm font-medium ${isOver ? 'text-red-400' : 'text-gray-400'}`}>
                        {item.used} / {item.limit > 1000 ? 'Unlimited' : item.limit}
                      </span>
                    </div>
                    <Progress value={pct} className={`h-2 ${isOver ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />
                    {isOver && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Limit reached.{' '}
                        <button onClick={() => navigate('/pricing')} className="underline text-blue-400">Upgrade</button>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Plan Features */}
        <Card className="bg-[#1a2332] border-gray-800" data-testid="plan-features-card">
          <CardContent className="p-6 sm:p-8">
            <h3 className="text-lg font-bold text-white mb-4">Your Plan Includes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(plan.features || []).map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionPage;
