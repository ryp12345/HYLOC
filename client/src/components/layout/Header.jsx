import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../pages/auth/ChangePassword';
import ViewAllNotification from '../common/ViewAllNotification';
import NotificationDetail from '../common/NotificationDetail';
import { getNotifications, markNotificationAsRead } from '../../api/notificationApi';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);

  // Ref for notification and profile dropdowns
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
    // Close profile dropdown when clicking outside
    useEffect(() => {
      if (!isProfileOpen) return;
      function handleClickOutside(event) {
        if (profileRef.current && !profileRef.current.contains(event.target)) {
          setIsProfileOpen(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isProfileOpen]);
  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
    // Optionally, poll every 60s
    // const interval = setInterval(fetchNotifications, 60000);
    // return () => clearInterval(interval);
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data || []);
    } catch (err) {
      setNotifications([]);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white text-gray-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-20">
          {/* Empty flex space on left */}
          <div className="flex-1"></div>

          {/* Logo - Centered */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <img
              src="/hyloc-logo.png"
              alt="Hyloc logo"
              className="h-10 w-12 sm:h-11 sm:w-14"
            />
            <h1 className="text-2xl sm:text-3xl font-bold">Hyloc Hydrotechnic Pvt Ltd</h1>
          </div>

          {/* User Info & Menu - Right aligned */}
          <div className="flex-1 flex justify-end items-center space-x-4 relative">
            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                className="relative p-2 rounded-full hover:bg-gray-100"
                aria-label="Notifications"
                onClick={() => setShowNotifications((prev) => !prev)}
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 15V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v4a2.032 2.032 0 01-.595 1.405L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b font-semibold text-gray-700 flex items-center justify-between">
                    <span>Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        className="text-blue-600 hover:underline text-sm font-medium"
                        onClick={() => setShowAllNotifications(true)}
                      >
                        View All
                      </button>
                    )}
                  </div>
                  {(() => {
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();
                    const currentMonthNotifications = notifications.filter(n => {
                      const d = new Date(n.created_at);
                      return d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
                    });
                    const olderNotifications = notifications.filter(n => {
                      const d = new Date(n.created_at);
                      return d.getUTCMonth() !== now.getUTCMonth() || d.getUTCFullYear() !== now.getUTCFullYear();
                    });
                    if (notifications.length === 0) {
                      return <div className="p-4 text-gray-500">No notifications</div>;
                    }
                    return <>
                      {currentMonthNotifications.length === 0 && (
                        <div className="p-4 text-gray-500">No notifications for this month</div>
                      )}
                      {currentMonthNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-blue-50 ${n.is_read ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}
                          onClick={async () => {
                            if (!n.is_read) {
                              await markNotificationAsRead(n.id);
                              await fetchNotifications();
                            }
                            setSelectedNotification(n);
                            setShowNotificationDetail(true);
                          }}
                        >
                          <div>
                            {(() => {
                              const normalized = (n.message || '').replace(/\s+Title:/i, '\nTitle:').replace(/\s+Description:/i, '\nDescription:');
                              const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
                              const initialLineRaw = lines.find(l => /you were assigned/i.test(l)) || lines[0] || '';
                              const initialSentence = (() => {
                                if (!initialLineRaw) return '';
                                const idx = initialLineRaw.indexOf('.');
                                if (idx !== -1) return initialLineRaw.slice(0, idx + 1).trim();
                                return initialLineRaw;
                              })();
                              const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'));
                              const descLine = lines.find(l => l.toLowerCase().startsWith('description:'));
                              const titleText = titleLine ? titleLine.split(':').slice(1).join(':').trim() : (lines[1] || '');
                              const descText = descLine ? descLine.split(':').slice(1).join(':').trim() : (lines.filter(l => l !== titleLine && l !== initialLineRaw)[1] || lines.slice(2).join(' '));
                              return (
                                <>
                                  {initialSentence ? <div className="text-sm text-gray-800">{initialSentence}</div> : null}
                                  {titleText ? <div className="font-medium mt-1 truncate max-w-[18rem]">{`Title: ${titleText}`}</div> : null}
                                  {descText ? <div className="text-sm text-gray-600 truncate max-w-[18rem] mt-1">{`Description: ${descText}`}</div> : null}
                                  <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                      {/* View All button moved to header */}
                      <ViewAllNotification show={showAllNotifications} onClose={() => setShowAllNotifications(false)} title="All Notifications" />
                    </>;
                  })()}
                </div>
              )}
            </div>
            {user && (
              <>
                <div className="hidden md:block relative" ref={profileRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold">
                      {(user.firstName?.[0] || 'U').toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition ${isProfileOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {user.role?.toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => { setIsChangePwdOpen(true); setIsProfileOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Change Password
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  </svg>
                </button>

                {/* Desktop dropdown only */}
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && user && (
          <div className="md:hidden pb-4 space-y-2">
            <div className="text-sm text-gray-600">
              {user.firstName} {user.lastName}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
              user.role === 'admin' 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {user.role?.toUpperCase()}
            </div>
            <button
              onClick={() => { setIsChangePwdOpen(true); setIsMenuOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-semibold"
            >
              Change Password
            </button>

            <button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        )}

        {/* Change Password Modal */}
        <ChangePasswordModal isOpen={isChangePwdOpen} onClose={() => setIsChangePwdOpen(false)} />
        <NotificationDetail show={showNotificationDetail} notification={selectedNotification} onClose={() => { setShowNotificationDetail(false); setSelectedNotification(null); }} />
      </div>
    </nav>
  );
};

export default Navbar;
