import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authAPI } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';

// Mandatory screen after logging in with a temporary password.
// There is no skip or cancel: the server refuses every other request until
// the password is changed. "Log out" is offered so a shared PC can be left safely.
const inputClass =
  'w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)] transition duration-200 bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

const PasswordField = ({ label, value, onChange, show, onToggle, disabled, autoFocus, autoComplete }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute right-4 top-3 cursor-pointer p-1 text-gray-500 transition hover:opacity-70 disabled:cursor-not-allowed"
        aria-label={show ? `Hide ${label}` : `Show ${label}`}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  </div>
);

const ForcePasswordChangePage = () => {
  const { user, loading: authLoading, isAuthenticated, mustChangePassword, completePasswordChange, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all three fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from the temporary password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setSaving(true);
      const response = await authAPI.changePassword(currentPassword, newPassword, confirmPassword);
      completePasswordChange(response.data.data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to change password. Please try again.');
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggle = (key) => setShow((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[color:var(--surface)] rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <img
            src="/hyloc-logo_transparent.png"
            alt="Hyloc logo"
            className="mx-auto mb-4 h-10 w-auto object-contain"
          />
          <h1 className="text-xl font-bold text-gray-900">Set your own password</h1>
          <p className="mt-2 text-sm text-gray-600">
            {user?.firstName ? `Welcome, ${user.firstName}. ` : ''}
            You signed in with a temporary password. Choose a new password to continue.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Temporary password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
            show={show.current}
            onToggle={() => toggle('current')}
            disabled={saving}
            autoFocus
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
            show={show.next}
            onToggle={() => toggle('next')}
            disabled={saving}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
            show={show.confirm}
            onToggle={() => toggle('confirm')}
            disabled={saving}
            autoComplete="new-password"
          />

          <p className="text-xs text-gray-500">
            At least 8 characters. Avoid common passwords such as &ldquo;Password@123&rdquo;.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-[color:var(--accent)] py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Change password and continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={saving}
            className="text-sm text-gray-500 underline hover:text-gray-800"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChangePage;
