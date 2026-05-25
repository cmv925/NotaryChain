import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-xl mx-auto px-6">
          <Card className="bg-gradient-to-br from-white to-cream-100 border border-slate-200">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-navy-900 mb-2">
                Payment Cancelled
              </h1>
              <p className="text-slate-500 mb-8">
                Your payment was cancelled. No charges were made to your account.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-coral-500 hover:bg-coral-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full border-slate-200 text-slate-500"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>

              <p className="text-slate-500 text-sm mt-6">
                Need help? Contact our support team.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentCancel;
