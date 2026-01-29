import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  // Determine dashboard path based on user role
  const getDashboardPath = () => {
    const roleValue = (user?.role?.name || user?.role || '').toString().toLowerCase();
    if (roleValue === 'admin') {
      return '/admin/dashboard';
    } else if (roleValue === 'management') {
      return '/management/dashboard';
    } else {
      return '/employee/dashboard';
    }
  };

  const adminLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'Roles', path: '/super-admin/roles', icon: '🔐' },
    { name: 'Department', path: '/super-admin/departments', icon: '🏢' },
    { name: 'Designation', path: '/super-admin/designations', icon: '🏷️' },
    { name: 'Association', path: '/super-admin/associations', icon: '🤝' },
    { name: 'Users', path: '/super-admin/users', icon: '👥' },
    { name: 'KMIS', path: '/super-admin/kmis', icon: '📚' },
    { name: 'PILLERS', path: '/super-admin/pillers', icon: '🏛️' },
    { name: 'USER-ROLES', path: '/super-admin/user-roles', icon: '🧩' }
  ];

  const managementLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'Team', path: '/management/team', icon: '👥' },
    { name: 'Leaves', path: '/management/leaves', icon: '📅' },
    { name: 'Reports', path: '/management/reports', icon: '📊' }
  ];

  const employeeLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'MyKMI', path: '/employee/mykmi', icon: '📚' },
    { name: 'Leaves', path: '/employee/leaves', icon: '📅' }
  ];

  const roleValue = (
    user?.role?.name || user?.role || ''
  ).toString().toLowerCase();

  const isAdmin = roleValue === 'admin' ||
    (user?.email || '').toLowerCase() === 'admin@hyloc.co.in' ||
    (user?.empid || '').toString() === '10000';

  const isManagement = roleValue === 'management';

  const links = isAdmin ? adminLinks : isManagement ? managementLinks : employeeLinks;

  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-20'
      } text-white transition-all duration-300 min-h-screen shadow-lg`}
      style={{ backgroundColor: '#001f3f' }}
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
                ? 'text-white border-l-4'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
            style={
              location.pathname === link.path
                ? { backgroundColor: '#3498db', borderLeftColor: '#2980b9' }
                : {}
            }
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
