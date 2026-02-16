import React, { useEffect, useState } from 'react';
// ...existing code...
import { getNotifications, markNotificationAsRead, deleteNotification } from '../../api/notificationApi';

export default function ViewAllNotification({ show, onClose, title }) {
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

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

  if (!show) return null;
  // Checkbox handlers
  const handleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };
  const handleSelectAll = () => {
    if (selected.length === notifications.length) {
      setSelected([]);
    } else {
      setSelected(notifications.map(n => n.id));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 relative">
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title || 'All Notifications'}</h2>
          <button onClick={onClose} className="text-2xl font-bold text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No notifications found.</div>
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
                return <div className="text-center py-8 text-gray-500">No notifications found.</div>;
              }
              return (
                <>
                  <div className="mb-4 flex items-center">
                    <input type="checkbox" checked={selected.length === notifications.length && notifications.length > 0} onChange={handleSelectAll} />
                    <span className="ml-2">Select All</span>
                    <button
                      className="ml-4 px-3 py-1 bg-red-600 text-white rounded-lg disabled:opacity-50"
                      disabled={selected.length === 0}
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete selected notifications?')) {
                          for (const id of selected) {
                            await deleteNotification(id);
                          }
                          setNotifications((prev) => prev.filter((n) => !selected.includes(n.id)));
                          setSelected([]);
                        }
                      }}
                    >Delete Selected</button>
                  </div>
                  <div>
                    <h3 className="text-md font-bold mb-2">Current Month Notifications</h3>
                    {currentMonthNotifications.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">No current month notifications found.</div>
                    ) : (
                      <div className="divide-y">
                        {currentMonthNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`py-4 px-2 flex flex-col md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-blue-50 ${n.is_read ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}
                            onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selected.includes(n.id)}
                                onChange={e => { e.stopPropagation(); handleSelect(n.id); }}
                                className="mr-2"
                              />
                              <div>
                                {n.message}
                                <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                              </div>
                            </div>
                            <button
                              className="ml-4 mt-2 md:mt-0 px-2 py-1 text-xs p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                              onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                              title="Delete notification"
                              aria-label="Delete notification"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-8">
                    <h3 className="text-md font-bold mb-2">Previous Months' Notifications</h3>
                    {previousMonthNotifications.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">No previous months' notifications found.</div>
                    ) : (
                      <div className="divide-y">
                        {previousMonthNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`py-4 px-2 flex flex-col md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-blue-50 ${n.is_read ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}
                            onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selected.includes(n.id)}
                                onChange={e => { e.stopPropagation(); handleSelect(n.id); }}
                                className="mr-2"
                              />
                              <div>
                                {n.message}
                                <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                              </div>
                            </div>
                            <button
                              className="ml-4 mt-2 md:mt-0 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                              onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                              title="Delete notification"
                              aria-label="Delete notification"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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
