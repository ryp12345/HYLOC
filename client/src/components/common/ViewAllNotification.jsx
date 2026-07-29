import React, { useEffect, useState } from 'react';
import { getNotifications, markNotificationAsRead, deleteNotification } from '../../api/notificationApi';

export default function ViewAllNotification({ show, onClose, title }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (show) {
      fetchAllNotifications();
    }
    // eslint-disable-next-line
  }, [show]);

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      setNotifications(res.data || []);
    } catch (err) {
      setNotifications([]);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (id) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this notification?')) {
      try {
        await deleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setSelectedIds((prev) => prev.filter(x => x !== id));
      } catch (err) {
        // ignore - could show toast
      }
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected notification(s)?`)) return;
    try {
      setLoading(true);
      await Promise.all(selectedIds.map(id => deleteNotification(id).catch(() => null)));
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{title || 'All Notifications'}</h2>
          <button onClick={onClose} className="text-2xl font-bold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]" aria-label="Close">×</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <div className="py-8 text-center text-[color:var(--text-muted)]">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-[color:var(--text-muted)]">No notifications found.</div>
          ) : (
            (() => {
              const now = new Date();
              const currentMonth = now.getUTCMonth();
              const currentYear = now.getUTCFullYear();
              const currentMonthNotifications = notifications.filter(n => {
                const d = new Date(n.created_at);
                return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
              });
              const previousMonthNotifications = notifications.filter(n => {
                const d = new Date(n.created_at);
                return d.getUTCMonth() !== currentMonth || d.getUTCFullYear() !== currentYear;
              });
              // Show a single empty state if both are empty
              if (currentMonthNotifications.length === 0 && previousMonthNotifications.length === 0) {
                return <div className="py-8 text-center text-[color:var(--text-muted)]">No notifications found.</div>;
              }
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === notifications.length}
                        onChange={toggleSelectAll}
                        className="mr-2"
                        aria-label="Select all notifications"
                      />
                      <span>Select All</span>
                    </label>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.length === 0}
                      className={`rounded px-3 py-1 text-sm ${selectedIds.length ? 'bg-[color:var(--danger)] text-white' : 'cursor-not-allowed bg-[color:var(--surface-hover)] text-[color:var(--text-muted)]'}`}
                    >
                      Delete selected
                    </button>
                  </div>
                  <div>
                    <h3 className="mb-2 text-md font-bold text-[color:var(--text-primary)]">Current Month Notifications</h3>
                    {currentMonthNotifications.length === 0 ? (
                      <div className="py-4 text-center text-[color:var(--text-muted)]">No current month notifications found.</div>
                    ) : (
                      <div className="divide-y">
                        {currentMonthNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`cursor-pointer px-2 py-4 hover:bg-[color:var(--surface-hover)] md:flex md:flex-row md:items-center md:justify-between ${n.is_read ? 'text-[color:var(--text-muted)]' : 'font-semibold text-[color:var(--text-primary)]'}`}
                            onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                          >
                            <div className="flex items-start md:items-center md:justify-between w-full">
                              <div className="flex items-start md:items-center">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(n.id)}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => { e.stopPropagation(); toggleSelect(n.id); }}
                                  className="mr-3 mt-1"
                                  aria-label="Select notification"
                                />
                                <div>
                                  {(() => {
                                    const normalized = (n.message || '').replace(/\s+Title:/i, '\nTitle:').replace(/\s+Description:/i, '\nDescription:');
                                    return normalized.split('\n').map((line, idx) => (
                                      <div key={idx} className={idx === 0 ? '' : 'text-sm text-[color:var(--text-secondary)]'}>{line}</div>
                                    ));
                                  })()}
                                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">{new Date(n.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                              <button
                                className="ml-4 mt-2 rounded-lg bg-[color:var(--danger)] px-2 py-1 text-xs text-white transition-colors duration-200 hover:opacity-90 md:mt-0"
                                onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-8">
                    <h3 className="mb-2 text-md font-bold text-[color:var(--text-primary)]">Previous Months' Notifications</h3>
                    {previousMonthNotifications.length === 0 ? (
                      <div className="py-4 text-center text-[color:var(--text-muted)]">No previous months' notifications found.</div>
                    ) : (
                      <div className="divide-y">
                        {previousMonthNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`cursor-pointer px-2 py-4 hover:bg-[color:var(--surface-hover)] md:flex md:flex-row md:items-center md:justify-between ${n.is_read ? 'text-[color:var(--text-muted)]' : 'font-semibold text-[color:var(--text-primary)]'}`}
                            onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                          >
                            <div className="flex items-start md:items-center md:justify-between w-full">
                              <div className="flex items-start md:items-center">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(n.id)}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => { e.stopPropagation(); toggleSelect(n.id); }}
                                  className="mr-3 mt-1"
                                  aria-label="Select notification"
                                />
                                <div>
                                  {(n.message || '').split('\n').map((line, idx) => (
                                    <div key={idx} className={idx === 0 ? '' : 'text-sm text-[color:var(--text-secondary)]'}>{line}</div>
                                  ))}
                                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">{new Date(n.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                              <button
                                className="ml-4 mt-2 rounded bg-[color:var(--danger-soft)] px-2 py-1 text-xs text-[color:var(--danger)] hover:opacity-90 md:mt-0"
                                onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
