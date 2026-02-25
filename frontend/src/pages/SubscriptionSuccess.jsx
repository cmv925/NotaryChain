import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader2, XCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState('polling'); // polling | success | failed
  const [planId, setPlanId] = useState('');
  const attemptsRef = useRef(0);
  const maxAttempts = 8;

  useEffect(() => {
    if (sessionId && token) {
      pollStatus();
    } else {
      setStatus('failed');
    }
  }, [sessionId, token]);

  const pollStatus = async () => {
    if (attemptsRef.current >= maxAttempts) {
      setStatus('failed');
      return;
    }

    try {
      const res = await axios.get(`${API}/subscriptions/checkout/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.payment_status === 'paid' || res.data.status === 'complete') {
        setStatus('success');
        setPlanId(res.data.plan_id);
        return;
      }

      if (res.data.status === 'expired') {
        setStatus('failed');
        return;
      }

      // Keep polling
      attemptsRef.current += 1;
      setTimeout(pollStatus, 2000);
    } catch {
      attemptsRef.current += 1;
      setTimeout(pollStatus, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1825] flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-[#1a2332] border-gray-800" data-testid="subscription-success-card">
        <CardContent className="p-8 text-center">
          {status === 'polling' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Processing Payment</h2>
              <p className="text-gray-400 text-sm">Please wait while we confirm your subscription...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Subscription Activated!</h2>
              <p className="text-gray-400 text-sm mb-6">
                Your <span className="text-white font-semibold capitalize">{planId}</span> plan is now active. Enjoy your new features!
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/subscription')} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="go-to-subscription">
                  View Subscription <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-gray-400" data-testid="go-to-dashboard">
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Payment Issue</h2>
              <p className="text-gray-400 text-sm mb-6">
                We couldn't confirm your payment. If you were charged, your subscription will activate automatically.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/pricing')} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Try Again
                </Button>
                <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-gray-400">
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;
