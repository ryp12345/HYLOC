import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const adminLinks = [
   { name: 'Dashboard', path: '/super-admin/dashboard', icon: '📊' },
    { name: 'Roles', path: '/super-admin/roles', icon: '🧩' },
    { name: 'Department', path: '/super-admin/departments', icon: '🏢' },
    { name: 'Designation', path: '/super-admin/designations', icon: '🏷️' },
    { name: 'Users', path: '/super-admin/users', icon: '👥' },
    { name: 'KMIS', path: '/super-admin/kmis', icon: '📚' },
    { name: 'PILLERS', path: '/super-admin/pillers', icon: '🧱' },
    { name: 'USER-ROLES', path: '/super-admin/user-roles', icon: '🔐' }
  ];

  const userLinks = [
    { name: 'Dashboard', path: '/user/dashboard', icon: '📊' },
    { name: 'Profile', path: '/user/profile', icon: '👤' },
    { name: 'Settings', path: '/user/settings', icon: '⚙️' }
  ];

  const roleValue = (
    user?.role?.name || user?.role || ''
  ).toString().toLowerCase();

  const isAdmin =
    ['super_admin', 'management'].includes(roleValue) ||
    (user?.email || '').toLowerCase() === 'admin@hyloc.co.in' ||
    (user?.empid || '').toString() === '10000';

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-20'
      } bg-gradient-to-b from-gray-800 to-gray-900 text-white transition-all duration-300 min-h-screen shadow-lg`}
    >
      {/* Toggle Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-400 hover:text-white focus:outline-none"
        >
          {isOpen ? '◄' : '►'}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-2 px-4">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 ${
              location.pathname === link.path
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="text-xl">{link.icon}</span>
            {isOpen && <span className="font-medium">{link.name}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
