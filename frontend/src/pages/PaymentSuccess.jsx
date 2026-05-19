import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader2, FileText, ArrowRight, ExternalLink } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [status, setStatus] = useState('checking');
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId || !token) return;

    const pollPaymentStatus = async () => {
      try {
        const response = await axios.get(
          `${API}/payments/status/${sessionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setPaymentDetails(response.data);

        if (response.data.payment_status === 'paid') {
          setStatus('success');
          toast({
            title: 'Payment Successful!',
            description: 'Your notarization service has been purchased.',
          });
        } else if (response.data.status === 'expired') {
          setStatus('expired');
        } else if (pollCount < 5) {
          // Continue polling
          setTimeout(() => setPollCount(c => c + 1), 2000);
        } else {
          setStatus('pending');
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        if (pollCount < 5) {
          setTimeout(() => setPollCount(c => c + 1), 2000);
        } else {
          setStatus('error');
        }
      }
    };

    pollPaymentStatus();
  }, [sessionId, token, pollCount]);

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-xl mx-auto px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Pricing', path: '/pricing' }, { label: 'Payment Success' }]} />
          <Card className="bg-gradient-to-br from-white to-cream-100 border border-slate-200">
            <CardContent className="p-8 text-center">
              {status === 'checking' && (
                <>
                  <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
                  <h1 className="text-2xl font-bold text-navy-900 mb-2">
                    Verifying Payment...
                  </h1>
                  <p className="text-slate-500">
                    Please wait while we confirm your payment.
                  </p>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <h1 className="text-3xl font-bold text-navy-900 mb-2">
                    Payment Successful!
                  </h1>
                  <p className="text-slate-500 mb-6">
                    Thank you for your purchase. Your notarization service is now active.
                  </p>

                  {paymentDetails && (
                    <div className="bg-cream-100 rounded-lg p-4 mb-6 text-left">
                      <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Payment Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Service:</span>
                          <span className="text-navy-900">{paymentDetails.package?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount:</span>
                          <span className="text-navy-900">
                            ${paymentDetails.amount} {paymentDetails.currency?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className="text-green-400 font-medium">Paid</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Button
                      onClick={() => navigate('/request-notarization')}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Start Notarization
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      onClick={() => navigate('/dashboard')}
                      variant="outline"
                      className="w-full border-slate-200 text-slate-500"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </>
              )}

              {status === 'pending' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h1 className="text-2xl font-bold text-navy-900 mb-2">
                    Payment Processing
                  </h1>
                  <p className="text-slate-500 mb-6">
                    Your payment is being processed. You'll receive a confirmation email shortly.
                  </p>
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Dashboard
                  </Button>
                </>
              )}

              {(status === 'expired' || status === 'error') && (
                <>
                  <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                    <ExternalLink className="w-10 h-10 text-red-500" />
                  </div>
                  <h1 className="text-2xl font-bold text-navy-900 mb-2">
                    {status === 'expired' ? 'Session Expired' : 'Verification Error'}
                  </h1>
                  <p className="text-slate-500 mb-6">
                    {status === 'expired' 
                      ? 'Your payment session has expired. Please try again.'
                      : 'We couldn\'t verify your payment. Please check your email or contact support.'}
                  </p>
                  <Button
                    onClick={() => navigate('/checkout')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Try Again
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentSuccess;
