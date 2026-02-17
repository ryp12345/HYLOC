import React from 'react';

export default function NotificationDetail({ show, notification, onClose }) {
  if (!show || !notification) return null;

  const normalized = (notification.message || '').replace(/\s+Title:/i, '\nTitle:').replace(/\s+Description:/i, '\nDescription:');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 relative">
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Notification</h2>
          <button onClick={onClose} className="text-2xl font-bold text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className={idx === 0 ? 'font-medium' : 'text-sm text-gray-700'}>{line}</div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-4">{new Date(notification.created_at).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
