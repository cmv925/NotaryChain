import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { 
  Wallet, Copy, CheckCircle, Clock, AlertTriangle,
  RefreshCw, ArrowLeft, ExternalLink, Loader2
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Crypto icons as SVG components
const CryptoIcon = ({ symbol, className }) => {
  const icons = {
    BTC: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-.84-.18-1.59-.39-1.59-1.13 0-.74.55-1.09 1.32-1.09.77 0 1.28.39 1.39.97h1.39c-.11-1.17-1.05-1.95-2.15-2.09V6.5h-1.32v1.3c-1.3.14-2.15.91-2.15 2.07 0 1.36 1.14 1.84 2.23 2.11.95.24 1.53.47 1.53 1.19 0 .79-.61 1.18-1.47 1.18-.86 0-1.51-.43-1.64-1.13H8.55c.14 1.29 1.07 2.08 2.31 2.22v1.35h1.32v-1.34c1.34-.14 2.23-.93 2.23-2.17 0-1.49-1.22-1.93-2.1-2.14z"/>
      </svg>
    ),
    ETH: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 1.75l-6.25 10.5L12 16l6.25-3.75L12 1.75zM5.75 13.5L12 22.25l6.25-8.75L12 17.25l-6.25-3.75z"/>
      </svg>
    ),
    USDC: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 6v2m0 8v2m-4-6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    USDT: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c2.67 0 5.17.67 7 1.83V8.5H5V6.83C6.83 5.67 9.33 5 12 5zm0 14c-4.41 0-8-3.59-8-8 0-.69.09-1.36.26-2h15.48c.17.64.26 1.31.26 2 0 4.41-3.59 8-8 8zm0-6c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z"/>
      </svg>
    )
  };
  return icons[symbol] || <Wallet className={className} />;
};

const CryptoCheckout = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State
  const [step, setStep] = useState(1); // 1: select crypto, 2: payment details, 3: confirmation
  const [supportedCryptos, setSupportedCryptos] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(searchParams.get('package') || 'general');
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [prices, setPrices] = useState({});
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cryptoRes, packagesRes] = await Promise.all([
          axios.get(`${API}/crypto/supported`),
          axios.get(`${API}/crypto/packages`)
        ]);
        
        setSupportedCryptos(cryptoRes.data.supported_cryptos);
        setPackages(packagesRes.data.packages);
        
        // Build prices object
        const pricesObj = {};
        packagesRes.data.packages.forEach(pkg => {
          pricesObj[pkg.id] = pkg.crypto_prices;
        });
        setPrices(pricesObj);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load payment options',
          variant: 'destructive',
        });
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Poll payment status when payment is created
  useEffect(() => {
    if (!payment || paymentStatus?.status === 'confirmed' || paymentStatus?.status === 'expired') {
      return;
    }

    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${API}/crypto/payment/${payment.payment_id}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPaymentStatus(response.data);
        
        if (response.data.status === 'confirmed') {
          clearInterval(interval);
          setPolling(false);
          setStep(3);
          toast({
            title: 'Payment Confirmed!',
            description: 'Your cryptocurrency payment has been confirmed.',
          });
        } else if (response.data.status === 'expired') {
          clearInterval(interval);
          setPolling(false);
          toast({
            title: 'Payment Expired',
            description: 'The payment window has expired.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [payment, paymentStatus?.status, token]);

  // Create payment
  const handleCreatePayment = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to proceed with payment',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    if (!selectedCrypto) {
      toast({
        title: 'Select Cryptocurrency',
        description: 'Please select a cryptocurrency to pay with',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/crypto/payment`,
        {
          package_id: selectedPackage,
          crypto_id: selectedCrypto.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPayment(response.data);
      setPaymentStatus({ status: 'pending', confirmations: 0, confirmations_required: response.data.confirmations_required });
      setStep(2);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  // Simulate confirmation (demo only)
  const handleSimulateConfirm = async () => {
    if (!payment) return;
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/crypto/payment/${payment.payment_id}/simulate-confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const statusRes = await axios.get(
        `${API}/crypto/payment/${payment.payment_id}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPaymentStatus(statusRes.data);
      
      if (statusRes.data.status === 'confirmed') {
        setStep(3);
        toast({
          title: 'Payment Confirmed!',
          description: 'Your payment has been confirmed.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to confirm payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get selected package info
  const selectedPkg = packages.find(p => p.id === selectedPackage);

  if (loadingData) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Wallet className="w-10 h-10 text-orange-500" />
              <h1 className="text-4xl font-bold text-navy-900">
                Pay with Crypto
              </h1>
            </div>
            <p className="text-slate-500 text-lg">
              Fast, secure cryptocurrency payments
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s ? 'bg-coral-500 text-navy-900' : 'bg-gray-700 text-slate-500'
                  }`}>
                    {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-1 ${step > s ? 'bg-coral-500' : 'bg-gray-700'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between max-w-md mx-auto mt-2 text-sm">
              <span className={step >= 1 ? 'text-coral-600' : 'text-slate-500'}>Select</span>
              <span className={step >= 2 ? 'text-coral-600' : 'text-slate-500'}>Pay</span>
              <span className={step >= 3 ? 'text-coral-600' : 'text-slate-500'}>Confirm</span>
            </div>
          </div>

          {/* Step 1: Select Crypto */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Package Selection */}
              <Card className="bg-white border-slate-200">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-navy-900 mb-4">Select Package</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg.id)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          selectedPackage === pkg.id
                            ? 'border-orange-500 bg-coral-500/10'
                            : 'border-slate-200 hover:border-slate-200'
                        }`}
                      >
                        <p className="text-navy-900 font-medium text-sm">{pkg.name}</p>
                        <p className="text-coral-600 font-bold">${pkg.price_usd}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Crypto Selection */}
              <Card className="bg-white border-slate-200">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-navy-900 mb-4">Select Cryptocurrency</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {supportedCryptos.map((crypto) => {
                      const cryptoPrice = prices[selectedPackage]?.[crypto.symbol];
                      return (
                        <button
                          key={crypto.id}
                          onClick={() => setSelectedCrypto(crypto)}
                          className={`p-4 rounded-lg border flex items-center gap-4 transition-all ${
                            selectedCrypto?.id === crypto.id
                              ? 'border-orange-500 bg-coral-500/10'
                              : 'border-slate-200 hover:border-slate-200'
                          }`}
                          data-testid={`crypto-${crypto.symbol}`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            crypto.symbol === 'BTC' ? 'bg-coral-500/20 text-coral-600' :
                            crypto.symbol === 'ETH' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            <CryptoIcon symbol={crypto.symbol} className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="text-navy-900 font-bold">{crypto.symbol}</p>
                            <p className="text-slate-500 text-sm">{crypto.name}</p>
                            {cryptoPrice && (
                              <p className="text-coral-600 text-sm">
                                ≈ {cryptoPrice.amount.toFixed(6)} {crypto.symbol}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Summary & Continue */}
              {selectedPkg && selectedCrypto && (
                <Card className="bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border-coral-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-500 text-sm">You're paying</p>
                        <p className="text-2xl font-bold text-navy-900">${selectedPkg.price_usd}</p>
                        <p className="text-coral-600">
                          ≈ {prices[selectedPackage]?.[selectedCrypto.symbol]?.amount.toFixed(8)} {selectedCrypto.symbol}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-sm">For</p>
                        <p className="text-navy-900 font-medium">{selectedPkg.name}</p>
                      </div>
                    </div>
                    <Button
                      onClick={handleCreatePayment}
                      disabled={loading}
                      className="w-full bg-coral-500 hover:bg-coral-500 text-navy-900 py-4"
                      data-testid="continue-to-payment-btn"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Creating Payment...
                        </>
                      ) : (
                        <>
                          Continue to Payment
                          <Wallet className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Payment Details */}
          {step === 2 && payment && (
            <div className="space-y-6">
              <Button
                variant="ghost"
                onClick={() => { setStep(1); setPayment(null); }}
                className="text-slate-500 hover:text-navy-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <Card className="bg-white border-slate-200">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                      payment.crypto_symbol === 'BTC' ? 'bg-coral-500/20 text-coral-600' :
                      payment.crypto_symbol === 'ETH' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      <CryptoIcon symbol={payment.crypto_symbol} className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-navy-900">
                      Send {payment.crypto_symbol}
                    </h2>
                    <p className="text-slate-500">
                      Send exactly the amount below to complete payment
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="bg-cream-100 rounded-lg p-4 mb-4">
                    <p className="text-slate-500 text-sm mb-1">Amount to Send</p>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold text-navy-900">
                        {payment.crypto_amount} {payment.crypto_symbol}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(payment.crypto_amount.toString(), 'Amount')}
                        className="text-slate-500 hover:text-navy-900"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-slate-500 text-sm">≈ ${payment.usd_amount} USD</p>
                  </div>

                  {/* Wallet Address */}
                  <div className="bg-cream-100 rounded-lg p-4 mb-4">
                    <p className="text-slate-500 text-sm mb-1">{payment.network} Address</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-coral-600 text-sm break-all">
                        {payment.wallet_address}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(payment.wallet_address, 'Address')}
                        className="text-slate-500 hover:text-navy-900 shrink-0"
                      >
                        {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="bg-cream-100 rounded-lg p-6 mb-4 text-center">
                    <div className="w-52 h-52 mx-auto bg-white rounded-lg flex items-center justify-center mb-4 p-3">
                      <QRCodeSVG 
                        value={payment.qr_data || payment.wallet_address}
                        size={180}
                        level="H"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                    <p className="text-slate-500 text-sm">Scan QR code with your {payment.crypto_name} wallet</p>
                  </div>

                  {/* Status */}
                  <div className="bg-cream-100 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-500">Status</span>
                      <span className={`px-2 py-1 rounded text-sm ${
                        paymentStatus?.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                        paymentStatus?.status === 'confirming' ? 'bg-blue-500/20 text-blue-400' :
                        paymentStatus?.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {polling && <RefreshCw className="w-3 h-3 inline mr-1 animate-spin" />}
                        {paymentStatus?.status || 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Confirmations</span>
                      <span className="text-navy-900">
                        {paymentStatus?.confirmations || 0} / {payment.confirmations_required}
                      </span>
                    </div>
                    <Progress 
                      value={(paymentStatus?.confirmations || 0) / payment.confirmations_required * 100} 
                      className="mt-2 h-2" 
                    />
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-2 text-yellow-400 mb-6">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      Payment expires at {new Date(payment.expires_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Demo Confirm Button */}
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-slate-500 text-xs text-center mb-3">
                      Demo Mode: Click below to simulate payment confirmation
                    </p>
                    <Button
                      onClick={handleSimulateConfirm}
                      disabled={loading || paymentStatus?.status === 'confirmed'}
                      className="w-full bg-green-600 hover:bg-green-700 text-navy-900"
                      data-testid="simulate-confirm-btn"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5 mr-2" />
                      )}
                      Simulate Payment Confirmation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 mx-auto mb-6 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-navy-900 mb-2">Payment Confirmed!</h2>
                <p className="text-slate-500 mb-6">
                  Your cryptocurrency payment has been successfully processed.
                </p>
                
                {payment && (
                  <div className="bg-cream-100 rounded-lg p-4 mb-6 text-left">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Amount Paid</p>
                        <p className="text-navy-900 font-medium">
                          {payment.crypto_amount} {payment.crypto_symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">USD Value</p>
                        <p className="text-navy-900 font-medium">${payment.usd_amount}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Payment ID</p>
                        <p className="text-blue-400 font-mono text-xs">{payment.payment_id}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Network</p>
                        <p className="text-navy-900 font-medium">{payment.network}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    onClick={() => navigate('/request-notarization')}
                    variant="outline"
                    className="flex-1 border-slate-200 text-slate-500"
                  >
                    Request Notarization
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CryptoCheckout;
