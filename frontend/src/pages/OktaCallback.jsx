import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const OktaCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(searchParams.get('error_description') || 'Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!code || !state) {
        setError('Missing authentication parameters');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        const response = await axios.post(`${API}/api/sso/okta/callback`, {
          code,
          state,
          redirect_uri: `${window.location.origin}/auth/okta/callback`,
        });

        const { access_token } = response.data;
        if (access_token) {
          loginWithToken(access_token);
          navigate('/dashboard');
        } else {
          setError('No access token received');
          setTimeout(() => navigate('/login'), 3000);
        }
      } catch (err) {
        const msg = err.response?.data?.detail || 'Authentication failed';
        setError(msg);
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="text-center" data-testid="okta-callback-page">
        {error ? (
          <div>
            <p className="text-red-400 text-lg mb-2">Authentication Error</p>
            <p className="text-slate-500 text-sm">{error}</p>
            <p className="text-slate-500 text-xs mt-4">Redirecting to login...</p>
          </div>
        ) : (
          <div>
            <RefreshCw className="w-10 h-10 text-coral-500 animate-spin mx-auto mb-4" />
            <p className="text-navy-900 text-lg">Completing sign in...</p>
            <p className="text-slate-500 text-sm mt-2">Verifying your identity with Okta</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OktaCallback;
