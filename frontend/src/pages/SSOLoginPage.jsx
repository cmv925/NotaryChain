import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import {
  Shield, ArrowLeft, Loader2, Check, X, Globe, Lock,
  Building2, KeyRound, UserCheck, AlertTriangle,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SSOLoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email | discover | authorize | complete
  const [email, setEmail] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [ssoOrgs, setSsoOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const handleDiscover = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDiscovering(true);
    setError('');
    try {
      const res = await axios.post(`${API}/sso/discover`, { email: email.trim() });
      if (res.data.sso_available) {
        setSsoOrgs(res.data.organizations);
        if (res.data.organizations.length === 1) {
          handleSelectOrg(res.data.organizations[0]);
        } else {
          setStep('discover');
        }
      } else {
        setError('No SSO configuration found for this email domain. Please use standard login.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to discover SSO');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelectOrg = async (org) => {
    setSelectedOrg(org);
    try {
      const res = await axios.post(`${API}/sso/initiate`, {
        org_id: org.org_id,
        email: email.trim(),
      });
      setSessionId(res.data.session_id);
      // Fetch session info for mock IdP
      const sessionRes = await axios.get(`${API}/sso/session/${res.data.session_id}`);
      setSessionInfo(sessionRes.data);
      setStep('authorize');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initiate SSO');
    }
  };

  const handleAuthorize = async () => {
    setAuthorizing(true);
    setError('');
    try {
      const res = await axios.post(`${API}/sso/callback`, {
        session_id: sessionId,
        email: email.trim(),
        full_name: fullName || undefined,
      });
      // Store the token
      login(res.data.access_token);
      toast({
        title: 'SSO Login Successful',
        description: `Authenticated via ${selectedOrg.org_name}`,
      });
      setStep('complete');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'SSO authentication failed');
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-32 pb-16 flex items-center justify-center px-4">
        <Card className="bg-[#1a2332] border-gray-800 max-w-md w-full" data-testid="sso-login-card">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-7 h-7 text-purple-400" />
              </div>
              <h1 className="text-xl font-bold text-white" data-testid="sso-page-title">Enterprise SSO Login</h1>
              <p className="text-gray-500 text-sm mt-1">Sign in with your organization's identity provider</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2" data-testid="sso-error">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Step 1: Email Discovery */}
            {step === 'email' && (
              <form onSubmit={handleDiscover} className="space-y-4" data-testid="sso-email-step">
                <div>
                  <Label className="text-gray-200 text-sm">Work Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="bg-[#0a0f1a] border-gray-700 text-white mt-1"
                    data-testid="sso-email-input"
                  />
                  <p className="text-gray-600 text-xs mt-1">We'll check if your organization has SSO enabled</p>
                </div>
                <Button type="submit" disabled={discovering || !email.trim()} className="w-full bg-purple-600 hover:bg-purple-700 text-white" data-testid="sso-discover-btn">
                  {discovering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                  Continue with SSO
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => navigate('/login')} className="text-gray-500 text-sm hover:text-gray-300 transition-colors" data-testid="sso-back-to-login">
                    <ArrowLeft className="w-3 h-3 inline mr-1" /> Back to standard login
                  </button>
                </div>
              </form>
            )}

            {/* Step 1.5: Multiple orgs found */}
            {step === 'discover' && (
              <div className="space-y-3" data-testid="sso-org-select-step">
                <p className="text-gray-300 text-sm">Multiple organizations found for <strong className="text-white">{email}</strong>:</p>
                {ssoOrgs.map((org) => (
                  <button
                    key={org.org_id}
                    onClick={() => handleSelectOrg(org)}
                    className="w-full text-left p-3 rounded-lg bg-[#0a0f1a] border border-gray-800 hover:border-purple-500/50 transition-all flex items-center gap-3"
                    data-testid={`sso-org-${org.org_id}`}
                  >
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">{org.org_name}</p>
                      <p className="text-gray-500 text-xs">{org.provider.toUpperCase()} &bull; {org.org_slug}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => { setStep('email'); setError(''); }} className="text-gray-500 text-sm hover:text-gray-300 mt-2">
                  <ArrowLeft className="w-3 h-3 inline mr-1" /> Use different email
                </button>
              </div>
            )}

            {/* Step 2: Mock IdP Authorization */}
            {step === 'authorize' && sessionInfo && (
              <div className="space-y-4" data-testid="sso-authorize-step">
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-medium text-sm">Identity Provider</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Organization</span>
                      <span className="text-white">{sessionInfo.org_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Protocol</span>
                      <span className="text-purple-400 uppercase text-xs font-mono">{sessionInfo.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Email</span>
                      <span className="text-white">{sessionInfo.email}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>This is a simulated IdP consent screen. In production, you'd be redirected to your organization's identity provider (Okta, Azure AD, etc.).</span>
                </div>

                <div>
                  <Label className="text-gray-200 text-sm">Display Name (optional)</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="bg-[#0a0f1a] border-gray-700 text-white mt-1"
                    data-testid="sso-fullname-input"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => { setStep('email'); setError(''); }} variant="outline" className="flex-1 border-gray-700 text-gray-300" data-testid="sso-deny-btn">
                    <X className="w-4 h-4 mr-1" /> Deny
                  </Button>
                  <Button onClick={handleAuthorize} disabled={authorizing} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" data-testid="sso-authorize-btn">
                    {authorizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
                    Authorize
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {step === 'complete' && (
              <div className="text-center py-4" data-testid="sso-complete-step">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-white font-medium">SSO Authentication Successful</p>
                <p className="text-gray-500 text-sm mt-1">Redirecting to dashboard...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default SSOLoginPage;
