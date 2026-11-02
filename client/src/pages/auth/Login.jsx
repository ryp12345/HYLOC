import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // error: { title, message, tone } where tone is 'error' (red) or 'warning' (amber)
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    empid: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error message when user starts typing
    if (error) {
      clearError();
    }
  };

  const passwordRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  // Clear error state
  const clearError = () => {
    setError(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  // Show a validation error with persistent display
  const showError = (message) => {
    setError({ title: 'Login Failed', message, tone: 'error' });
  };

  // Turn a failed login response into a heading and message for the user
  const describeLoginError = (err) => {
    const status = err?.response?.status;
    const serverMessage = err?.response?.data?.message;

    if (!err?.response) {
      return {
        title: 'Unable to Connect',
        message: 'We could not reach the server. Please check your internet connection and try again. If the problem continues, contact IT support.',
        tone: 'error'
      };
    }
    if (status === 423) {
      return {
        title: 'Account Temporarily Locked',
        message: serverMessage || 'Your account has been temporarily locked due to multiple unsuccessful login attempts. Please try again later, or use "Forgot Password" to reset your password.',
        tone: 'warning'
      };
    }
    if (status === 403 && err?.response?.data?.errors?.code === 'ACCOUNT_INACTIVE') {
      return {
        title: 'Account Inactive',
        message: serverMessage || 'Your account is currently inactive. Please contact your HR department or system administrator to have it reactivated.',
        tone: 'warning'
      };
    }
    if (status === 429) {
      return {
        title: 'Too Many Attempts',
        message: serverMessage || 'Too many login attempts in a short period. Please wait 1 minute and try again.',
        tone: 'warning'
      };
    }
    if (status === 401) {
      return {
        title: 'Login Failed',
        message: 'The Employee ID or password you entered is incorrect. Please check and try again.',
        tone: 'error'
      };
    }
    if (status >= 500) {
      return {
        title: 'Something Went Wrong',
        message: 'The server could not complete your request. Please try again in a few minutes.',
        tone: 'error'
      };
    }
    return {
      title: 'Login Failed',
      message: serverMessage || 'We could not sign you in. Please try again.',
      tone: 'error'
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Don't clear error here - let the user see it until they start typing

    try {
      if (!formData.empid || !formData.password) {
        showError('Employee ID and password are required');
        return;
      }

      const empidRegex = /^\d+$/;
      if (!empidRegex.test(formData.empid.trim())) {
        showError('Employee ID must be a valid number with no special characters');
        return;
      }

      setLoading(true);

      try {
        await login(formData.empid, formData.password);
        setLoading(false);
        navigate('/dashboard');
      } catch (err) {
        setError(describeLoginError(err));
        setLoading(false);
      }
    } catch (err) {
      showError('An unexpected error occurred');
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[color:var(--surface)] rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-3 mb-4">
            <img
              src="/hyloc-logo_transparent.png"
              alt="Hyloc logo"
              className="header-logo h-9 sm:h-10 w-auto max-w-[96px] sm:max-w-[108px] object-contain"
            />
            <img
              src="/hyloc_name_transparent.png"
              alt="Hyloc Hydrotechnic Pvt Ltd"
              className="h-auto w-full max-w-[325px] max-h-24 object-contain dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className={`mb-6 p-4 border-2 rounded-lg shadow-lg transition-all duration-300 ${
              error.tone === 'warning' ? 'bg-amber-50 border-amber-500' : 'bg-red-50 border-red-500'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-3xl flex-shrink-0 mt-1" aria-hidden="true">
                  {error.tone === 'warning' ? '🔒' : '⚠️'}
                </span>
                <div className="flex-1 pt-1">
                  <p className={`font-bold text-base ${error.tone === 'warning' ? 'text-amber-900' : 'text-red-900'}`}>
                    {error.title}
                  </p>
                  <p className={`text-sm mt-2 leading-relaxed ${error.tone === 'warning' ? 'text-amber-800' : 'text-red-800'}`}>
                    {error.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearError}
                className={`ml-2 transition-colors flex-shrink-0 text-xl p-1 rounded-md ${
                  error.tone === 'warning'
                    ? 'text-amber-600 hover:text-amber-900 hover:bg-amber-100'
                    : 'text-red-600 hover:text-red-900 hover:bg-red-100'
                }`}
                title="Dismiss"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Employee ID
            </label>
            <input
              type="text"
              name="empid"
              value={formData.empid}
              onChange={handleChange}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); } }}
              placeholder="Enter your employee ID"
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)] transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                ref={passwordRef}
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                disabled={loading}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)] transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => !loading && setShowPassword(!showPassword)}
                className="absolute right-4 top-3 cursor-pointer hover:opacity-70 transition disabled:cursor-not-allowed p-1"
                disabled={loading}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r hover:to-blue-800 text-white font-bold py-3 rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-[color:var(--accent)]"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default Login;