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
  const { login, register, error: authError } = useAuth();
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
    setError('');
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  // Show error with persistent display
  const showError = (message) => {
    setError(message);
  };

  // Mirror auth context errors into local UI state
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

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
        // Backend validation error or authentication failure
        let errorMessage = 'Invalid credentials or connection error';

        // Try to extract the actual error message from backend response
        if (err?.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err?.response?.status === 401) {
          errorMessage = 'Invalid Employee ID or Password';
        } else if (err?.message) {
          errorMessage = err.message;
        }

        // DIRECTLY set error state here without using showError function
        setError(errorMessage);
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
              src="/hyloc_name.jpg"
              alt="Hyloc Hydrotechnic Pvt Ltd"
              className="h-auto w-full max-w-[325px] max-h-28 object-contain"
            />
          </div>
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
                  className="absolute right-4 top-3 cursor-pointer hover:opacity-70 transition disabled:cursor-not-allowed p-1"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
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