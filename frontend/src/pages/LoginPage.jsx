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
import { ShieldCheck, ArrowLeft, KeyRound, Globe, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, verify2FA } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [auth0Loading, setAuth0Loading] = useState(false);
  const [oktaLoading, setOktaLoading] = useState(false);

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

  const handleAuth0Login = async () => {
    setAuth0Loading(true);
    try {
      const response = await axios.get(`${API}/api/sso/auth0/login`, {
        headers: { origin: window.location.origin },
      });
      if (response.data.auth_url) {
        window.location.href = response.data.auth_url;
      }
    } catch (err) {
      toast({ title: 'Auth0 Unavailable', description: err.response?.data?.detail || 'SSO is not configured', variant: 'destructive' });
      setAuth0Loading(false);
    }
  };

  const handleOktaLogin = async () => {
    setOktaLoading(true);
    try {
      const response = await axios.get(`${API}/api/sso/okta/login`, {
        headers: { origin: window.location.origin },
      });
      if (response.data.auth_url) {
        window.location.href = response.data.auth_url;
      }
    } catch (err) {
      toast({ title: 'Okta Unavailable', description: err.response?.data?.detail || 'SSO is not configured', variant: 'destructive' });
      setOktaLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      
      <div className="pt-24 sm:pt-32 pb-16 sm:pb-24 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white border border-slate-200 shadow-md" data-testid="login-card">
          <CardContent className="p-6 sm:p-8">
            {!show2FA ? (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-navy-900 mb-2">{t('auth.welcome_back')}</h1>
                  <p className="text-slate-600">{t('auth.sign_in')} to NotaryChain</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
                  <div>
                    <Label htmlFor="email" className="text-navy-900 mb-2 block">{t('auth.email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="bg-white border-slate-300 text-navy-900 focus:border-coral-500"
                      placeholder="you@example.com"
                      disabled={loading}
                      data-testid="login-email-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-navy-900 mb-2 block">{t('auth.password')}</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="bg-white border-slate-300 text-navy-900 focus:border-coral-500"
                      placeholder="••••••••"
                      disabled={loading}
                      data-testid="login-password-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-slate-600 text-sm">Remember me</span>
                    </label>
                    <a href="#" className="text-coral-600 hover:text-coral-700 text-sm">
                      {t('auth.forgot')}
                    </a>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-coral-500 hover:bg-coral-600 text-white py-6 text-lg"
                    data-testid="login-submit-button"
                  >
                    {loading ? `${t('common.loading')}` : t('auth.sign_in')}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-slate-600">
                    {t('auth.no_account')}{' '}
                    <button onClick={() => navigate('/signup')} className="text-coral-600 hover:text-coral-700 font-semibold" data-testid="go-to-signup">
                      {t('auth.sign_up')}
                    </button>
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  <button
                    onClick={handleAuth0Login}
                    disabled={auth0Loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 text-coral-600 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-sm font-medium disabled:opacity-50"
                    data-testid="auth0-login-button"
                  >
                    <Globe className="w-4 h-4" />
                    {auth0Loading ? 'Redirecting...' : 'Sign in with Auth0'}
                  </button>
                  <button
                    onClick={handleOktaLogin}
                    disabled={oktaLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-200 bg-cream-50 text-navy-900 hover:bg-cream-200 hover:border-slate-300 transition-all text-sm font-medium disabled:opacity-50"
                    data-testid="okta-login-button"
                  >
                    <Shield className="w-4 h-4" />
                    {oktaLoading ? 'Redirecting...' : 'Sign in with Okta'}
                  </button>
                  <button
                    onClick={() => navigate('/sso/login')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all text-sm font-medium"
                    data-testid="sso-login-link"
                  >
                    <KeyRound className="w-4 h-4" />
                    Sign in with Enterprise SSO
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-coral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-coral-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-navy-900 mb-2">Two-Factor Authentication</h1>
                  <p className="text-slate-600 text-sm">Enter the 6-digit code from your authenticator app</p>
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
                        className="w-12 h-14 text-center text-xl font-bold bg-white border border-slate-300 rounded-lg text-navy-900 focus:border-coral-500 focus:ring-1 focus:ring-coral-500 outline-none transition-all"
                        disabled={loading}
                        data-testid={`2fa-code-input-${index}`}
                      />
                    ))}
                  </div>

                  <p className="text-center text-slate-500 text-xs">You can also enter a backup code</p>

                  <Button
                    type="submit"
                    disabled={loading || totpCode.join('').length < 6}
                    className="w-full bg-coral-500 hover:bg-coral-600 text-white py-6 text-lg"
                    data-testid="2fa-submit-button"
                  >
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShow2FA(false); setTotpCode(['', '', '', '', '', '']); setTempToken(''); }}
                    className="w-full text-slate-600 hover:text-navy-900"
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
