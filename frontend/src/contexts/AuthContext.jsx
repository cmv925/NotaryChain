import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// The auth credential now lives in an httpOnly, Secure cookie set by the backend.
// Always send it on requests (harmless same-origin; required if ever cross-origin).
axios.defaults.withCredentials = true;

// Non-sensitive sentinel exposed as `token` for backward compatibility. Components
// gate on `!!token` ("am I logged in") and some still send `Authorization: Bearer
// ${token}` — the backend reads the httpOnly cookie FIRST, so this value is never a
// real credential and the legacy header is a harmless no-op.
const COOKIE_SENTINEL = 'cookie';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Restore the session from the httpOnly cookie on every load.
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only session restore
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      setToken(COOKIE_SENTINEL);
      return response.data;
    } catch (error) {
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const data = response.data;

      // 2FA required - return temp token for second step
      if (data.requires_2fa) {
        return { success: false, requires_2fa: true, temp_token: data.temp_token };
      }

      // Backend has set the httpOnly cookie; load the user so callers can route by role.
      const userObj = await fetchUser();
      return { success: true, user: userObj };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const verify2FA = async (tempToken, code) => {
    try {
      await axios.post(`${API}/auth/login/2fa`, { temp_token: tempToken, code });
      const userObj = await fetchUser();
      return { success: true, user: userObj };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Verification failed',
      };
    }
  };

  const signup = async (fullName, email, password, role = 'user') => {
    try {
      await axios.post(`${API}/auth/signup`, {
        full_name: fullName,
        email,
        password,
        role,
      });
      await fetchUser();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed',
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (_e) {
      /* best-effort — clear local state regardless */
    }
    // Remove any legacy token left by older (pre-cookie) sessions.
    try { localStorage.removeItem('token'); } catch (_e) { /* ignore */ }
    setToken(null);
    setUser(null);
  };

  // Used by SSO callbacks (Auth0/Okta/enterprise). The backend callback sets the
  // cookie; if a Bearer token is provided (e.g. passed via redirect URL), exchange
  // it for a cookie session to be safe, then load the user.
  const loginWithToken = async (accessToken) => {
    try {
      if (accessToken) {
        await axios.post(`${API}/auth/session`, {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch (_e) {
      /* cookie may already be set by the SSO callback */
    }
    return fetchUser();
  };

  const value = {
    user,
    loading,
    token,
    login,
    loginWithToken,
    verify2FA,
    signup,
    logout,
    isAuthenticated: !!user,
    refreshUser: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
