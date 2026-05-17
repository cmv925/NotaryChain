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
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-xl mx-auto px-6">
          <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-navy-900 mb-2">
                Payment Cancelled
              </h1>
              <p className="text-gray-400 mb-8">
                Your payment was cancelled. No charges were made to your account.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full border-gray-700 text-gray-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>

              <p className="text-gray-500 text-sm mt-6">
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
