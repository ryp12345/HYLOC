import React from 'react';

export default function Notification({ show, message, type = 'success', onClose }) {
  if (!show) return null;
  return (
    <div className="fixed top-6 right-4 md:right-6 z-50 w-auto max-w-sm">
      <div className={`w-full px-4 py-3 rounded-lg border flex items-center justify-between shadow-lg ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
        <div className="flex items-center gap-3">
          <span className="notification-icon text-lg">{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️'}</span>
          <span className="notification-message font-medium ml-1">{message}</span>
        </div>
        <button className="notification-close text-lg font-bold ml-3" onClick={onClose} aria-label="Close notification">×</button>
      </div>
    </div>
  );
}
