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
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose} />
        <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="px-6 py-4 bg-indigo-600">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-white">Switch Role</h3>
              <button className="text-white hover:text-gray-200" onClick={handleClose}>
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-6 py-5 bg-white">
            <Notification
              show={notification.show}
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification({ show: false, message: '', type: '' })}
            />
            {roles.length > 1 ? (
              <form onSubmit={handleSwitch} className="space-y-4">
                <p className="text-sm text-gray-600">
                  You have access to multiple roles. Select a role to view the application as that role.
                </p>
                <div className="text-sm">
                  <span className="text-gray-500">Current role: </span>
                  <span className="font-semibold capitalize">{currentRole || 'N/A'}</span>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Select Role</label>
                  <select
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 capitalize"
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
                    className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={switching || pendingRole === currentRole}
                    className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {switching ? 'Switching...' : 'Switch'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-600">
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
