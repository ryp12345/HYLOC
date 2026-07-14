import axios from 'axios';

// Detect if running on localhost or production
const getAPIUrl = () => {
  const hostname = window.location.hostname;
  
  // In production, use relative URL (nginx proxy handles routing)
  if (hostname === 'hyloc.git.edu' || window.location.protocol === 'https:') {
    return '/api';
  }
  
  // In development, use direct backend connection
  const port = 3001;
  const url = `http://${hostname}:${port}/api`;
  console.log('API URL:', url);
  return url;
};

export const API_URL = getAPIUrl();

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to request headers
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh on 401 or 403
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const authEndpoints = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh-token',
      '/auth/request-password-reset',
      '/auth/verify-otp',
      '/auth/reset-password'
    ];
    const isAuthEndpoint = authEndpoints.some((endpoint) => url.includes(endpoint));
    const pathname = window.location?.pathname || '';
    const isAuthScreen =
      pathname.startsWith('/login') ||
      pathname.startsWith('/forgot-password') ||
      pathname.startsWith('/reset-password');

    // CRITICAL: Never attempt refresh or redirect for auth endpoints
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // If already on an auth screen, do not attempt refresh/redirect
    if (isAuthScreen) {
      return Promise.reject(error);
    }

    // Only refresh on 401 (expired/invalid token). A 403 means insufficient
    // permissions for the current role and must NOT trigger a token refresh,
    // otherwise switching roles would be silently reverted to the primary role.
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          if (!isAuthScreen) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        const selectedRole = localStorage.getItem('selectedRole') || undefined;
        const response = await axiosInstance.post('/auth/refresh-token', {
          refreshToken,
          ...(selectedRole ? { selectedRole } : {})
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Clear storage and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (!isAuthScreen) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
