import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { toast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, verify2FA } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (show2FA && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [show2FA]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      toast({ title: 'Login Successful', description: 'Welcome back to NotaryChain!' });
      setTimeout(() => navigate('/dashboard'), 500);
    } else if (result.requires_2fa) {
      setTempToken(result.temp_token);
      setShow2FA(true);
      toast({ title: 'Verification Required', description: 'Enter the code from your authenticator app' });
    } else {
      toast({ title: 'Login Failed', description: result.error || 'Please check your credentials', variant: 'destructive' });
    }

    setLoading(false);
  };

  const handle2FASubmit = async (e) => {
    e?.preventDefault();
    const code = totpCode.join('');
    if (code.length < 6) return;

    setLoading(true);
    const result = await verify2FA(tempToken, code);

    if (result.success) {
      toast({ title: 'Login Successful', description: 'Two-factor authentication verified!' });
      setTimeout(() => navigate('/dashboard'), 500);
    } else {
      toast({ title: 'Verification Failed', description: result.error || 'Invalid code', variant: 'destructive' });
      setTotpCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    }
    setLoading(false);
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...totpCode];
    newCode[index] = value.slice(-1);
    setTotpCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every(d => d !== '')) {
      setTimeout(() => handle2FASubmit(), 100);
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...totpCode];
      pasted.split('').forEach((char, i) => { newCode[i] = char; });
      setTotpCode(newCode);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
      if (pasted.length === 6) setTimeout(() => handle2FASubmit(), 100);
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      
      <div className="pt-24 sm:pt-32 pb-16 sm:pb-24 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="login-card">
          <CardContent className="p-6 sm:p-8">
            {!show2FA ? (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                  <p className="text-gray-400">Sign in to your NotaryChain account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
                  <div>
                    <Label htmlFor="email" className="text-white mb-2 block">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                      placeholder="you@example.com"
                      disabled={loading}
                      data-testid="login-email-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-white mb-2 block">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                      placeholder="••••••••"
                      disabled={loading}
                      data-testid="login-password-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-gray-400 text-sm">Remember me</span>
                    </label>
                    <a href="#" className="text-blue-500 hover:text-blue-400 text-sm">
                      Forgot password?
                    </a>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                    data-testid="login-submit-button"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-400">
                    Don't have an account?{' '}
                    <button onClick={() => navigate('/signup')} className="text-blue-500 hover:text-blue-400 font-semibold" data-testid="go-to-signup">
                      Sign up
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-blue-400" />
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-2">Two-Factor Authentication</h1>
                  <p className="text-gray-400 text-sm">Enter the 6-digit code from your authenticator app</p>
                </div>

                <form onSubmit={handle2FASubmit} className="space-y-6" data-testid="2fa-form">
                  <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                    {totpCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => inputRefs.current[index] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        className="w-12 h-14 text-center text-xl font-bold bg-[#0a0f1a] border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        disabled={loading}
                        data-testid={`2fa-code-input-${index}`}
                      />
                    ))}
                  </div>

                  <p className="text-center text-gray-500 text-xs">You can also enter a backup code</p>

                  <Button
                    type="submit"
                    disabled={loading || totpCode.join('').length < 6}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                    data-testid="2fa-submit-button"
                  >
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShow2FA(false); setTotpCode(['', '', '', '', '', '']); setTempToken(''); }}
                    className="w-full text-gray-400 hover:text-white"
                    data-testid="2fa-back-button"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to login
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default LoginPage;
