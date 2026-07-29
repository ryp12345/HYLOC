import React, { useState } from 'react';
import { authAPI } from '../../api/auth.api';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password strength calculator
  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength += 1; // Length check
    if (pass.match(/[a-z]+/)) strength += 1; // Lowercase
    if (pass.match(/[A-Z]+/)) strength += 1; // Uppercase
    if (pass.match(/[0-9]+/)) strength += 1; // Numbers
    if (pass.match(/[$@#&!]+/)) strength += 1; // Special chars
    return strength; 
  };

  const strength = getPasswordStrength(newPassword);
  
  const getStrengthColor = (s) => {
    if (s < 2) return 'bg-red-500';
    if (s < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = (s) => {
    if (s < 2) return 'Weak';
    if (s < 4) return 'Medium';
    return 'Strong';
  };

  if (!isOpen) return null;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose && onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setTimeout(() => handleClose(), 1200);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to change password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30" onClick={handleClose}></div>

        <div className="bg-[color:var(--surface)] rounded-lg shadow-xl max-w-md w-full z-10 p-6 border border-[color:var(--border)]">
          <h3 className="text-lg font-semibold mb-4 text-[color:var(--text-primary)]">Change Password</h3>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">Current Password</label>
              <div className="relative mt-1">
                <input 
                  type={showCurrent ? 'text' : 'password'} 
                  value={currentPassword} 
                  autoFocus
                  disabled={loading}
                  onChange={e => {
                    setCurrentPassword(e.target.value);
                    setError('');
                  }} 
                  className="block w-full px-3 py-2 pr-10 border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)]" 
                />
                <button type="button" onClick={()=>setShowCurrent(s=>!s)} aria-label="Toggle current password visibility" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                  {showCurrent ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-3.5-10-8 1-3.5 5-8 10-8 1.657 0 3.24.33 4.63.93" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">New Password</label>
              <div className="relative mt-1">
                <input 
                  type={showNew ? 'text' : 'password'} 
                  value={newPassword} 
                  disabled={loading}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setError('');
                  }} 
                  className="block w-full px-3 py-2 pr-10 border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)]" 
                />
                <button type="button" onClick={()=>setShowNew(s=>!s)} aria-label="Toggle new password visibility" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                  {showNew ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-3.5-10-8 1-3.5 5-8 10-8 1.657 0 3.24.33 4.63.93" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[color:var(--text-muted)]">Strength: <span className="font-medium text-[color:var(--text-primary)]">{getStrengthLabel(strength)}</span></span>
                  </div>
                  <div className="w-full bg-[color:var(--border)] rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${getStrengthColor(strength)}`} style={{ width: `${(strength / 5) * 100}%` }}></div>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] mt-1">
                     Use uppercase, numbers & symbols
                  </div>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">Confirm New Password</label>
              <div className="relative mt-1">
                <input 
                  type={showConfirm ? 'text' : 'password'} 
                  value={confirmPassword} 
                  disabled={loading}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }} 
                  className="block w-full px-3 py-2 pr-10 border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)]" 
                />
                <button type="button" onClick={()=>setShowConfirm(s=>!s)} aria-label="Toggle confirm password visibility" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                  {showConfirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-3.5-10-8 1-3.5 5-8 10-8 1.657 0 3.24.33 4.63.93" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {confirmPassword && newPassword !== confirmPassword && (
                <div className="text-sm text-[color:var(--danger)] mt-2">Passwords do not match</div>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <div className="text-sm text-[color:var(--success)] mt-2">Passwords match</div>
              )}
            </div>

            {error && <div className="text-sm text-[color:var(--danger)] mb-3">{error}</div>}
            {success && <div className="text-sm text-[color:var(--success)] mb-3">{success}</div>}

            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg border border-[color:var(--border)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)] transition-colors">{loading ? 'Updating...' : 'Update'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
