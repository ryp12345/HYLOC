import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const otpInputsRef = useRef([]);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/auth/request-password-reset', { email });
      setResetToken(res.data?.data?.resetToken || '');
      setStep(2);
      setSuccess(
        res.data?.message ||
          `We've sent a password reset email to ${email}. It contains a 6-digit verification code (OTP) and a secure reset link. The code is valid for 15 minutes. If you don't see the email, check your spam/junk folder or contact support at support@hyloc.com.`
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to send OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/auth/verify-otp', { email, otp, resetToken });
      setStep(3);
      setSuccess(res.data?.message || 'OTP verified. Please enter a new password below to complete the reset.');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Invalid or expired OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return;
    const digits = otp.split('');
    while (digits.length < 6) digits.push('');
    digits[index] = value.slice(-1);
    const newOtp = digits.join('').slice(0, 6);
    setOtp(newOtp);
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if ((otp[index] || '') === '') {
        if (index > 0) {
          otpInputsRef.current[index - 1]?.focus();
        }
      } else {
        const digits = otp.split('');
        digits[index] = '';
        setOtp(digits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
    const digits = paste.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    const newDigits = Array.from({ length: 6 }, (_, i) => digits[i] || otp[i] || '');
    setOtp(newDigits.join(''));
    const nextIndex = newDigits.findIndex(d => d === '');
    const focusIndex = nextIndex === -1 ? Math.min(digits.length - 1, 5) : nextIndex;
    otpInputsRef.current[focusIndex]?.focus();
    e.preventDefault();
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }
    try {
      const res = await axios.post('/auth/reset-password', { email, otp, newPassword, resetToken });
      setSuccess(
        res.data?.message ||
          'Your password has been reset successfully. You will be redirected to the login page shortly. If you did not perform this request, please contact support immediately.'
      );
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to reset password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#001f3f' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <img src="/hyloc_name.jpg" alt="Hyloc Hydrotechnic Pvt Ltd" className="h-auto w-full max-w-[325px] max-h-28 object-contain" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Forgot Password</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm text-center">{success}</p>
          </div>
        )}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r  text-white font-bold py-3 rounded-lg" style={{ backgroundColor: '#001f3f' }}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Enter OTP</label>
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    ref={el => otpInputsRef.current[idx] = el}
                    value={(otp || '')[idx] || ''}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    onPaste={idx === 0 ? handleOtpPaste : undefined}
                    disabled={loading}
                    className="w-12 h-12 text-center text-lg px-2 py-2 border-2 border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                    aria-label={`OTP digit ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r text-white font-bold py-3 rounded-lg" style={{ backgroundColor: '#001f3f' }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button"  className="w-full mt-2 text-blue-600  underline" onClick={handleRequestOtp} disabled={loading}>
              Resend OTP
            </button>
          </form>
        )}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-gray-800"
                  tabIndex={0}
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.96 9.96 0 012.175-5.625M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-gray-800"
                  tabIndex={0}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.96 9.96 0 012.175-5.625M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r text-white font-bold py-3 rounded-lg" style={{ backgroundColor: '#001f3f' }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
