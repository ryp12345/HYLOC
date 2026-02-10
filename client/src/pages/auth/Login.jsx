import React, { useState } from 'react';
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
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        if (!formData.empid || !formData.password) {
          throw new Error('Employee ID and password are required');
        }
        await login(formData.empid, formData.password);
      } else {
        if (!formData.email || !formData.firstName || !formData.lastName || !formData.password || !formData.confirmPassword) {
          throw new Error('All fields are required');
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await register(formData.email, formData.password, formData.firstName, formData.lastName);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm text-center">{error}</p>
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
