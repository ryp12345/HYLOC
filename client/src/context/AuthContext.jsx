import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { authAPI } from '../api/auth.api';
import { API_URL } from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshTimeoutRef = useRef(null);
  const refreshInFlightRef = useRef(null);

  const clearRefreshTimeout = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      return null;
    }
  };

  const refreshAccessToken = async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return null;
    }

    refreshInFlightRef.current = axios
      .post(`${API_URL}/auth/refresh-token`, { refreshToken })
      .then((response) => {
        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        scheduleTokenRefresh(accessToken);
        return accessToken;
      })
      .catch((err) => {
        logout();
        throw err;
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    return refreshInFlightRef.current;
  };

  const scheduleTokenRefresh = (accessToken) => {
    clearRefreshTimeout();

    const payload = parseJwt(accessToken);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    const refreshAt = Math.max(expiresAt - 60 * 1000, now + 5000);
    const delay = Math.max(refreshAt - now, 0);

    refreshTimeoutRef.current = setTimeout(() => {
      refreshAccessToken();
    }, delay);
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }

      if (accessToken) {
        const payload = parseJwt(accessToken);
        const isExpired = payload?.exp ? payload.exp * 1000 <= Date.now() : true;
        if (isExpired) {
          try {
            await refreshAccessToken();
          } catch {
            // refreshAccessToken handles logout
          }
        } else {
          scheduleTokenRefresh(accessToken);
        }
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for storage changes (e.g., logout in another tab or token refresh)
    const handleStorageChange = (e) => {
      if (e.key === 'user' && !e.newValue) {
        setUser(null);
      } else if (e.key === 'user' && e.newValue) {
        try {
          setUser(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Error parsing user from storage:', err);
        }
      }

      if (e.key === 'accessToken') {
        if (e.newValue) {
          scheduleTokenRefresh(e.newValue);
        } else {
          clearRefreshTimeout();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearRefreshTimeout();
    };
  }, []);

  const register = async (email, password, firstName, lastName) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.register(email, password, firstName, lastName);
      const { user, accessToken, refreshToken } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      scheduleTokenRefresh(accessToken);

      setUser(user);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (empid, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login(empid, password);
      const { user, accessToken, refreshToken } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      scheduleTokenRefresh(accessToken);

      setUser(user);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearRefreshTimeout();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  };

  const updateUserContext = (updatedUser) => {
    const newUser = { ...user, ...updatedUser };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshAccessToken,
    updateUserContext,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
