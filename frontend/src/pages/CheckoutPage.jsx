import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  Check, CreditCard, Wallet, FileText, Shield, 
  Loader2, ArrowRight, Sparkles
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CheckoutPage = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState({});
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);

  // Fetch packages on mount
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await axios.get(`${API}/payments/packages`);
        setPackages(response.data.packages);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load pricing packages',
          variant: 'destructive',
        });
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to proceed with payment',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    if (!selectedPackage) {
      toast({
        title: 'Select a Package',
        description: 'Please select a notarization package',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/payments/checkout`,
        {
          package_id: selectedPackage,
          origin_url: window.location.origin,
          payment_method: paymentMethod
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast({
        title: 'Checkout Error',
        description: error.response?.data?.detail || 'Failed to create checkout',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const packageOrder = ['general', 'affidavit', 'power_of_attorney', 'contract', 'will', 'trust', 'real_estate'];

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Pricing', path: '/pricing' }, { label: 'Checkout' }]} />
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-coral-500/10 border border-coral-300/30 text-coral-500 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Transparent Pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
              Notarization Services
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Choose the service that fits your needs. All notarizations include 
              AI document analysis, biometric verification, and blockchain sealing.
            </p>
          </div>

          {/* Payment Method Toggle */}
          <div className="flex justify-center gap-4 mb-8">
            <Button
              variant={paymentMethod === 'card' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('card')}
              className={paymentMethod === 'card' 
                ? 'bg-coral-500 hover:bg-coral-600' 
                : 'border-slate-200 text-slate-500'}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pay with Card
            </Button>
            <Button
              variant={paymentMethod === 'both' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('both')}
              className={paymentMethod === 'both' 
                ? 'bg-coral-500 hover:bg-coral-600' 
                : 'border-slate-200 text-slate-500'}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Card or Crypto
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/checkout/crypto?package=${selectedPackage}`)}
              className="border-orange-500/50 text-coral-600 hover:bg-coral-500/10"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Pay with Crypto Only
            </Button>
          </div>

          {/* Packages Grid */}
          {loadingPackages ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {packageOrder.map((pkgId) => {
                const pkg = packages[pkgId];
                if (!pkg) return null;
                const isSelected = selectedPackage === pkgId;
                const isPopular = pkgId === 'power_of_attorney' || pkgId === 'real_estate';

                return (
                  <Card 
                    key={pkgId}
                    className={`relative cursor-pointer transition-all duration-300 ${
                      isSelected 
                        ? 'bg-coral-500/10 border-coral-300 scale-[1.02]' 
                        : 'bg-gradient-to-br from-white to-cream-100 border-slate-200 hover:border-slate-200'
                    }`}
                    onClick={() => setSelectedPackage(pkgId)}
                    data-testid={`package-${pkgId}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="italic text-coral-600 text-navy-900 text-xs font-semibold px-3 py-1 rounded-full">
                          Popular
                        </span>
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-lg bg-coral-500/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-coral-500" />
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-coral-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-navy-900" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-navy-900 mb-2">{pkg.name}</h3>
                      <p className="text-slate-500 text-sm mb-4">{pkg.description}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-navy-900">${pkg.price}</span>
                        <span className="text-slate-500">USD</span>
                      </div>
                      <ul className="mt-4 space-y-2">
                        <li className="flex items-center gap-2 text-slate-500 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          AI Document Analysis
                        </li>
                        <li className="flex items-center gap-2 text-slate-500 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          Biometric Verification
                        </li>
                        <li className="flex items-center gap-2 text-slate-500 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          Blockchain Seal
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Checkout Button */}
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleCheckout}
              disabled={loading || !selectedPackage}
              className="w-full italic text-coral-600 hover:from-blue-700 hover:to-purple-700 text-navy-900 py-6 text-lg"
              data-testid="checkout-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Redirecting to Payment...
                </>
              ) : (
                <>
                  Proceed to Checkout
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <p className="text-center text-slate-500 text-sm mt-4">
              Secure payment powered by Stripe
            </p>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-500" />
              </div>
              <h4 className="text-navy-900 font-semibold mb-2">Legally Binding</h4>
              <p className="text-slate-500 text-sm">
                All notarizations are legally valid and recognized across states
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-coral-500/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-coral-500" />
              </div>
              <h4 className="text-navy-900 font-semibold mb-2">Instant Processing</h4>
              <p className="text-slate-500 text-sm">
                Connect with a notary within minutes, not days
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-navy-700/20 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-navy-600" />
              </div>
              <h4 className="text-navy-900 font-semibold mb-2">Flexible Payments</h4>
              <p className="text-slate-500 text-sm">
                Pay with credit card or cryptocurrency
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CheckoutPage;
