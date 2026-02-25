import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Check, Zap, Building2, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const planIcons = { free: Zap, pro: Crown, enterprise: Building2 };
const planAccents = {
  free: { border: 'border-gray-700', bg: 'bg-gray-500/10', text: 'text-gray-300', btn: 'bg-gray-700 hover:bg-gray-600' },
  pro: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' },
  enterprise: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
};

const PricingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    fetchPlans();
    if (isAuthenticated && token) fetchCurrentPlan();
  }, [isAuthenticated, token]);

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/plans`);
      setPlans(res.data.plans);
    } catch {}
  };

  const fetchCurrentPlan = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentPlan(res.data.plan?.id || 'free');
    } catch {}
  };

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (planId === 'free' || planId === currentPlan) return;

    setLoading(planId);
    try {
      const res = await axios.post(
        `${API}/subscriptions/checkout`,
        { plan_id: planId, origin_url: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to start checkout', variant: 'destructive' });
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-32 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">Simple, Transparent Pricing</h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {plans.map((plan) => {
              const accent = planAccents[plan.id] || planAccents.free;
              const Icon = planIcons[plan.id] || Zap;
              const isCurrent = plan.id === currentPlan;
              const isPopular = plan.id === 'pro';

              return (
                <Card
                  key={plan.id}
                  className={`relative bg-[#1a2332] ${accent.border} border-2 ${isPopular ? 'ring-2 ring-blue-500/50 md:scale-[1.02]' : ''} transition-all hover:scale-[1.01]`}
                  data-testid={`plan-card-${plan.id}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${accent.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${accent.text}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        <p className="text-gray-500 text-xs">{plan.description}</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">${plan.price === 0 ? '0' : plan.price}</span>
                        <span className="text-gray-500 text-sm">/{plan.interval}</span>
                      </div>
                    </div>

                    <Button
                      className={`w-full mb-6 text-white ${isCurrent ? 'bg-gray-700 cursor-default' : accent.btn}`}
                      disabled={isCurrent || loading === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                      data-testid={`subscribe-btn-${plan.id}`}
                    >
                      {loading === plan.id ? 'Processing...' : isCurrent ? 'Current Plan' : plan.price === 0 ? 'Get Started' : 'Subscribe'}
                    </Button>

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${accent.text}`} />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-gray-500 text-sm">All plans include SSL encryption, email notifications, and basic document management.</p>
            {isAuthenticated && (
              <Button variant="link" onClick={() => navigate('/subscription')} className="text-blue-400 mt-2" data-testid="manage-subscription-link">
                Manage your subscription
              </Button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PricingPage;
