import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../pages/auth/ChangePassword';
import RoleSwitchModal from '../common/RoleSwitchModal';
import ViewAllNotification from '../common/ViewAllNotification';
import NotificationDetail from '../common/NotificationDetail';
import { getNotifications, markNotificationAsRead } from '../../api/notificationApi';
import axios from '../../api/axios';
import { API_URL } from '../../api/axios';
import { useTheme } from '../../context/ThemeContext';

const getPhotoUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/api/uploads/') || path.startsWith('/uploads/')) {
    try {
      const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
      return `${appOrigin}${path}`;
    } catch {
      return path;
    }
  }
  try {
    const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
    return `${appOrigin}/api/uploads/users/${String(path).replace(/^\/+/, '')}`;
  } catch {
    return path;
  }
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [isRoleSwitchOpen, setIsRoleSwitchOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');

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

  useEffect(() => {
    let cancelled = false;

    const loadProfilePhoto = async () => {
      if (!user) {
        setProfilePhoto('');
        return;
      }

      const initialPhoto = getPhotoUrl(user.staff_photo_url || user.staff_photo);
      if (initialPhoto) {
        setProfilePhoto(initialPhoto);
      }

      try {
        const response = await axios.get('/users/me');
        const data = response.data?.data;
        if (!cancelled && data) {
          setProfilePhoto(getPhotoUrl(data.staff_photo_url || data.staff_photo));
          if (Array.isArray(data.roles)) setRoles([...new Set(data.roles)]);
        }
      } catch {
        if (!cancelled) {
          setProfilePhoto(initialPhoto);
        }
      }
    };

    loadProfilePhoto();

    return () => {
      cancelled = true;
    };
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
    <nav className="border-b border-[color:var(--border)] bg-[color:var(--header-bg)] text-[color:var(--text-primary)] shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center py-0 sm:py-0">
          {/* Logo - Left aligned */}
          <div className="flex-1 flex items-center justify-start">
            <div className={`transition-all duration-300 flex items-center justify-center ${theme === 'dark' ? 'bg-white px-2 py-1 rounded-lg' : ''}`}>
              <img
                src="/hyloc-logo.png"
                alt="Hyloc logo"
                className="h-9 sm:h-10 w-auto max-w-[96px] sm:max-w-[108px] object-contain"
              />
            </div>
          </div>

          {/* Logo - Centered */}
          <div className="flex-1 flex items-center justify-center">
            <div className={`transition-all duration-300 flex items-center justify-center ${theme === 'dark' ? 'bg-white px-2 py-1.5 rounded-lg' : ''}`}>
              <img
                src="/hyloc_name.jpg"
                alt="Hyloc Hydrotechnic Pvt Ltd"
                className={`w-auto max-w-[350px] sm:max-w-[450px] object-contain ${theme === 'dark' ? 'h-9 sm:h-11 rounded-sm' : 'h-12 sm:h-14 mix-blend-multiply'}`}
              />
            </div>
          </div>


          {/* User Info & Menu - Right aligned */}
          <div className="relative flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm font-semibold text-[color:var(--text-primary)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[color:var(--header-bg)]"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A8.5 8.5 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
                  </svg>
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                className="relative rounded-full p-2 hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                aria-label="Notifications"
                onClick={() => setShowNotifications((prev) => !prev)}
              >
                <svg className="h-6 w-6 text-[color:var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 15V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v4a2.032 2.032 0 01-.595 1.405L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 inline-flex items-center justify-center rounded-full bg-[color:var(--danger)] px-2 py-1 text-xs font-bold leading-none text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[color:var(--border)] p-4 font-semibold text-[color:var(--text-primary)]">
                    <span>Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        className="text-sm font-medium text-[color:var(--accent)] hover:underline"
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
                      return <div className="p-4 text-[color:var(--text-muted)]">No notifications</div>;
                    }
                    return <>
                      {currentMonthNotifications.length === 0 && (
                        <div className="p-4 text-[color:var(--text-muted)]">No notifications for this month</div>
                      )}
                      {currentMonthNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`cursor-pointer border-b last:border-b-0 px-4 py-3 hover:bg-[color:var(--surface-hover)] ${n.is_read ? 'text-[color:var(--text-muted)]' : 'font-semibold text-[color:var(--text-primary)]'}`}
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

                              // First visible line should be the stored first line (backend now prepends 'You have a notification')
                              const firstLine = lines[0] || '';

                              // Derive a friendly Type label from notification.type and message content when needed
                              const deriveTypeLabel = (notif) => {
                                const t = String(notif.type || '').toLowerCase();
                                const msg = String(notif.message || '');
                                if (/^ticket_overdue(:|$)/i.test(t) || t === 'ticket_overdue') return 'Ticket overdue';
                                if (t === 'ticket_status') {
                                  if (/rejected/i.test(msg) || /^Type:\s*Ticket rejected/i.test(msg)) return 'Ticket rejected';
                                  return 'Ticket status changed';
                                }
                                if (t === 'ticket') {
                                  if (/you were assigned/i.test(msg)) return 'Ticket assigned';
                                  return 'Ticket created';
                                }
                                if (t === 'ticket_edit') return 'Ticket updated';
                                if (t === 'leave') return 'Leave';
                                return 'Ticket';
                              };

                              const typeLabel = deriveTypeLabel(n);

                              const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'));
                              const descLine = lines.find(l => l.toLowerCase().startsWith('description:'));
                              const titleText = titleLine ? titleLine.split(':').slice(1).join(':').trim() : (lines[1] || '');
                              const descText = descLine ? descLine.split(':').slice(1).join(':').trim() : (lines.filter(l => l !== titleLine && l !== firstLine)[1] || lines.slice(2).join(' '));

                              return (
                                <>
                                  {firstLine ? <div className="text-sm text-[color:var(--text-primary)]">{firstLine}</div> : null}
                                  <div className="mt-1 text-sm font-medium text-[color:var(--text-secondary)]">{`Type: ${typeLabel}`}</div>
                                  {titleText ? <div className="mt-1 max-w-[18rem] truncate font-medium text-[color:var(--text-primary)]">{`Title: ${titleText}`}</div> : null}
                                  {descText ? <div className="mt-1 max-w-[18rem] truncate text-sm text-[color:var(--text-secondary)]">{`Description: ${descText}`}</div> : null}
                                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">{new Date(n.created_at).toLocaleString()}</div>
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
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 transition hover:bg-[color:var(--surface-hover)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-hover)] text-sm font-semibold text-[color:var(--text-secondary)]">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          onError={() => setProfilePhoto('')}
                        />
                      ) : (
                        (user.firstName?.[0] || 'U').toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-medium text-[color:var(--text-primary)]">
                      {user.firstName} {user.lastName}
                    </span>
                    <svg
                      className={`h-4 w-4 text-[color:var(--text-muted)] transition ${isProfileOpen ? 'rotate-180' : ''}`}
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
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
                      <div className="border-b border-[color:var(--border)] px-4 py-3">
                        <div className="text-sm font-medium text-[color:var(--text-primary)]">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${user.role === 'admin'
                          ? 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
                          : 'bg-[color:var(--success-soft)] text-[color:var(--success)]'
                          }`}>
                          {user.role?.toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </button>
                      <button
                        onClick={() => { setIsChangePwdOpen(true); setIsProfileOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Change Password
                      </button>

                      {roles.length > 1 && (
                        <button
                          onClick={() => { setIsRoleSwitchOpen(true); setIsProfileOpen(false); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Switch Role
                        </button>
                      )}

                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
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
            <div className="text-sm text-[color:var(--text-secondary)]">
              {user.firstName} {user.lastName}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${user.role === 'admin'
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
              }`}>
              {user.role?.toUpperCase()}
            </div>
            <button
              onClick={() => { navigate('/profile'); setIsMenuOpen(false); }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] transition duration-200 hover:bg-[color:var(--surface)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
            <button
              onClick={() => { setIsChangePwdOpen(true); setIsMenuOpen(false); }}
              className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:opacity-90"
            >
              Change Password
            </button>

            {roles.length > 1 && (
              <button
                onClick={() => { setIsRoleSwitchOpen(true); setIsMenuOpen(false); }}
                className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:opacity-90"
              >
                Switch Role
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full rounded-lg bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:opacity-90"
            >
              Logout
            </button>
          </div>
        )}

        {/* Change Password Modal */}
        <ChangePasswordModal isOpen={isChangePwdOpen} onClose={() => setIsChangePwdOpen(false)} />
        <RoleSwitchModal isOpen={isRoleSwitchOpen} onClose={() => setIsRoleSwitchOpen(false)} roles={roles} />
        <NotificationDetail show={showNotificationDetail} notification={selectedNotification} onClose={() => { setShowNotificationDetail(false); setSelectedNotification(null); }} />
      </div>
    </nav>
  );
};

export default Navbar;
