import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password,
      });
      const data = response.data;

      // 2FA required - return temp token for second step
      if (data.requires_2fa) {
        return { success: false, requires_2fa: true, temp_token: data.temp_token };
      }

      const { access_token } = data;
      localStorage.setItem('token', access_token);
      setToken(access_token);

      // Fetch the user object so callers can route based on role
      // (admins → /admin, everyone else → /dashboard).
      let userObj = null;
      try {
        const me = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        userObj = me.data;
      } catch (_e) {
        // non-fatal — useEffect will retry via fetchUser()
      }
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
      const response = await axios.post(`${API}/auth/login/2fa`, {
        temp_token: tempToken,
        code,
      });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      let userObj = null;
      try {
        const me = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        userObj = me.data;
      } catch (_e) { /* non-fatal */ }
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
      const response = await axios.post(`${API}/auth/signup`, {
        full_name: fullName,
        email,
        password,
        role,
      });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const loginWithToken = (accessToken) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
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