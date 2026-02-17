import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login, register } = useAuth();
  const [formData, setFormData] = useState({
    empid: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    confirmPassword: ''
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
    console.log('🔵 [CLEAR-ERROR] clearError called');
    console.log('🔵 [CLEAR-ERROR] Current error before clearError:', error);
    setError('');
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  // Show error with persistent display
  const showError = (message) => {
    console.log('🟢 [SHOW-ERROR] showError called with:', message);
    setError(message);
  };

  // Monitor when error state actually updates after setError is called
  useEffect(() => {
    console.log('🟡 [ERROR-EFFECT] Error effect running, error value:', error);
    if (error) {
      console.log('🟡 [ERROR-EFFECT] Error state UPDATED to:', error);
    }
  }, [error]);





  const handleSubmit = async (e) => {
    e.preventDefault();
    // Don't clear error here - let the user see it until they start typing

    try {
      if (isLogin) {
        // Scenario 1: Check if fields are empty
        if (!formData.empid || !formData.password) {
          showError('Employee ID and password are required');
          return;
        }

        // Scenario 2: Validate Employee ID format (should be numeric/integer)
        const empidRegex = /^\d+$/;
        if (!empidRegex.test(formData.empid.trim())) {
          showError('Employee ID must be a valid number with no special characters');
          return;
        }

        // Scenario 3: Validate password length
        if (formData.password.length < 1) {
          showError('Password cannot be empty');
          return;
        }
      } else {
        // Register validation
        if (!formData.email || !formData.firstName || !formData.lastName || !formData.password || !formData.confirmPassword) {
          showError('All fields are required');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          showError('Passwords do not match');
          return;
        }
        if (formData.password.length < 6) {
          showError('Password must be at least 6 characters');
          return;
        }
      }

      setLoading(true);
      
      try {
        if (isLogin) {
          await login(formData.empid, formData.password);
        } else {
          await register(formData.email, formData.password, formData.firstName, formData.lastName);
        }
        setLoading(false);
        navigate('/dashboard');
      } catch (err) {
        console.log('🔴 [CATCH-BLOCK] Error caught in handleSubmit');
        
        // Backend validation error or authentication failure
        let errorMessage = 'Invalid credentials or connection error';
        
        // Try to extract the actual error message from backend response
        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.response?.status === 401) {
          errorMessage = 'Invalid Employee ID or Password';
        }
        
        console.log('🔴 [CATCH-BLOCK] About to call showError with:', errorMessage);
        // DIRECTLY set error state here without using showError function
        setError(errorMessage);
        console.log('🔴 [CATCH-BLOCK] setError called directly with:', errorMessage);
        setLoading(false);
      }
    } catch (err) {
      showError('An unexpected error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#001f3f' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/hyloc-logo.png"
              alt="Hyloc logo"
              className="h-24 w-32"
            />
          </div>
          <h1 className="text-4xl font-bold text-black mb-2">
            Hyloc Hydrotechnic Pvt Ltd
          </h1>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          {isLogin ? 'Login' : 'Register'}
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-lg shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-3xl flex-shrink-0 mt-1">⚠️</span>
                <div className="flex-1 pt-1">
                  <p className="text-red-900 font-bold text-base">Login Failed</p>
                  <p className="text-red-800 text-sm mt-2 leading-relaxed">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="ml-2 text-red-600 hover:text-red-900 hover:bg-red-100 transition-colors flex-shrink-0 text-xl p-1 rounded-md"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-purple-200 transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  disabled={loading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-purple-200 transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </>
          )}

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
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-purple-200 transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => !loading && setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-xl cursor-pointer hover:opacity-70 transition disabled:cursor-not-allowed"
                disabled={loading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => !loading && setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3 text-xl cursor-pointer hover:opacity-70 transition disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r  hover:to-blue-800 text-white font-bold py-3 rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: '#001f3f' }}
          >
            {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
          </button>

          {isLogin && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        {/* <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 text-sm">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormData({
                  email: '',
                  password: '',
                  firstName: '',
                  lastName: '',
                  confirmPassword: ''
                });
                setError('');
              }}
              disabled={loading}
              className="text-purple-600 font-semibold hover:text-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div> */}
        
      </div>
    </div>
  );
}

export default Login;
