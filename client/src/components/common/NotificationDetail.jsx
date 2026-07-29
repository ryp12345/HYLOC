import React from 'react';

export default function NotificationDetail({ show, notification, onClose }) {
  if (!show || !notification) return null;

  const normalized = (notification.message || '').replace(/\s+Title:/i, '\nTitle:').replace(/\s+Description:/i, '\nDescription:');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Notification</h2>
          <button onClick={onClose} className="text-2xl font-bold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]" aria-label="Close">×</button>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className={idx === 0 ? 'font-medium text-[color:var(--text-primary)]' : 'text-sm text-[color:var(--text-secondary)]'}>{line}</div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[color:var(--text-muted)]">{new Date(notification.created_at).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
