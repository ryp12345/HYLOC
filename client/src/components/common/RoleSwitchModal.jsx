import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import Notification from './Notification';

const RoleSwitchModal = ({ isOpen, onClose, roles: rolesProp }) => {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [currentRole, setCurrentRole] = useState('');
  const [pendingRole, setPendingRole] = useState('');
  const [switching, setSwitching] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    if (!isOpen) return;
    const initialRole = user?.role || '';
    setCurrentRole(initialRole);
    setPendingRole(initialRole);
    setNotification({ show: false, message: '', type: '' });

    let cancelled = false;
    const loadRoles = async () => {
      if (Array.isArray(rolesProp) && rolesProp.length) {
        if (!cancelled) setRoles([...new Set(rolesProp)]);
        return;
      }
      try {
        const res = await axios.get('/users/me');
        const data = res.data?.data;
        const fetched = Array.isArray(data?.roles) ? [...new Set(data.roles)] : [];
        if (!cancelled) setRoles(fetched);
      } catch {
        if (!cancelled) setRoles([]);
      }
    };
    loadRoles();
    return () => { cancelled = true; };
  }, [isOpen, rolesProp, user]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose && onClose();
  };

  const handleSwitch = async (e) => {
    e.preventDefault();
    if (!switchRole) return;
    const target = pendingRole;
    if (!target || target === currentRole) return;

    try {
      setSwitching(true);
      await switchRole(target);
      setNotification({ show: true, message: `Switched to ${target} view`, type: 'success' });
      setTimeout(() => {
        handleClose();
        navigate('/dashboard');
      }, 800);
    } catch (err) {
      setNotification({
        show: true,
        message: err?.response?.data?.message || err.message || 'Failed to switch role',
        type: 'error'
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black/50 backdrop-blur-sm" onClick={handleClose} />
        <div className="inline-block w-full max-w-lg overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:align-middle">
          <div className="bg-[color:var(--accent)] px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-white">Switch Role</h3>
              <button className="text-white hover:opacity-80" onClick={handleClose}>
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="bg-[color:var(--surface)] px-6 py-5 text-[color:var(--text-primary)]">
            <Notification
              show={notification.show}
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification({ show: false, message: '', type: '' })}
            />
            {roles.length > 1 ? (
              <form onSubmit={handleSwitch} className="space-y-4">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  You have access to multiple roles. Select a role to view the application as that role.
                </p>
                <div className="text-sm">
                  <span className="text-[color:var(--text-muted)]">Current role: </span>
                  <span className="font-semibold capitalize">{currentRole || 'N/A'}</span>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-[color:var(--text-secondary)]">Select Role</label>
                  <select
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 capitalize text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-4 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-medium text-[color:var(--text-primary)] shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={switching || pendingRole === currentRole}
                    className="inline-flex justify-center rounded-lg bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:opacity-50"
                  >
                    {switching ? 'Switching...' : 'Switch'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-[color:var(--text-secondary)]">
                You only have a single role assigned, so role switching is not available.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSwitchModal;
