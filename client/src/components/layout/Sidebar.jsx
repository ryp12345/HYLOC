import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [expandedMenu, setExpandedMenu] = useState(null);

  // Determine dashboard path based on user role
  const getDashboardPath = () => {
    const roleValue = (user?.role?.name || user?.role || '').toString().toLowerCase();
    if (roleValue === 'admin') {
      return '/admin/dashboard';
    } else if (roleValue === 'management') {
      return '/management/dashboard';
    } else if (roleValue === 'manager') {
      return '/manager/dashboard';
    } else {
      return '/employee/dashboard';
    }
  };

  const adminLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'Roles', path: '/admin/roles', icon: '🔐' },
    { name: 'Department', path: '/admin/departments', icon: '🏢' },
    { name: 'Designation', path: '/admin/designations', icon: '🏷️' },
    { name: 'Association', path: '/admin/associations', icon: '🤝' },
    { name: 'Users', path: '/admin/users', icon: '👥' },
    { name: "KMI's", path: '/admin/kmis', icon: '📚' },
    { name: 'Unit Master', path: '/admin/unit-master', icon: '📏' },
    { name: 'Pillars', path: '/admin/pillers', icon: '🏛️' },
    { name: 'User-Roles', path: '/admin/user-roles', icon: '🧩' },
    { name: 'Leave Entitlement', path: '/admin/leaves/leave-entitlement', icon: '🗓️' },
    { name: 'Tickets', path: '/tickets', icon: '🎫' },
  ];

  const managementLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'KMI', path: '/management/mgtkmi', icon: '📚' },
    { name: 'Pillar', path: '/management/mgtpiller', icon: '🏛️' },
    { name: 'Calendar', path: '/management/leaves', icon: '📅' },
    // { name: 'Leave List', path: '/management/leave-approval', icon: '🗂️' },
    {
      name: 'Leave List',
      icon: '🗂️',
      submenu: [
        { name: 'My Leave', path: '/management/my-leave' },
        { name: 'Leave Approval', path: '/management/leave-approval' },
      ],
    },
    { name: 'Tickets', path: '/tickets', icon: '🎫' },
  ];

 

  const managerLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'Calendar', path: '/manager/leaves', icon: '📅' },
    // { name: 'Leave Approval', path: '/manager/leave-approval', icon: '✅' },
    {
      name: 'Leave List',
      icon: '🗂️',
      submenu: [
        { name: 'My Leave', path: '/manager/my-leave' },
        { name: 'Leave Approval', path: '/manager/leave-approval' },
      ],
    },
    { name: 'Tickets', path: '/tickets', icon: '🎫' },
  ];
  const employeeLinks = [
    { name: 'Dashboard', path: getDashboardPath(), icon: '📊' },
    { name: 'My KPIs/KAIs', path: '/employee/kpikai', icon: '📈' },
    { name: 'Calendar', path: '/employee/leaves', icon: '📅' },
    { name: 'Tickets', path: '/tickets', icon: '🎫' },
  ];

  const roleValue = (
    user?.role?.name || user?.role || ''
  ).toString().toLowerCase();

  const isAdmin = roleValue === 'admin' ||
    (user?.email || '').toLowerCase() === 'admin@hyloc.co.in' ||
    (user?.empid || '').toString() === '10000';

  const isManagement = roleValue === 'management';
  const isManager = roleValue === 'manager';

  const links = isAdmin ? adminLinks : isManagement ? managementLinks : isManager ? managerLinks : employeeLinks;

  // Check if we need to expand the sidebar when a submenu is open on minimized sidebar
  const shouldExpandForSubmenu = !isOpen && expandedMenu;
  const sidebarWidth = isOpen ? 'w-64' : shouldExpandForSubmenu ? 'w-64' : 'w-20';

  return (
    <aside
      className={`${
        sidebarWidth
      } text-white transition-all duration-300 min-h-screen shadow-lg`}
      style={{ backgroundColor: '#001f3f' }}
    >
      {/* Toggle Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => {
            if (!isOpen && expandedMenu) {
              setExpandedMenu(null);
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className="text-gray-400 hover:text-white focus:outline-none"
        >
          {isOpen || (!isOpen && expandedMenu) ? '◄' : '►'}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-2 px-4">
        {links.map((link) => (
          <div key={link.submenu ? link.name : link.path}>
            {link.submenu ? (
              // Parent menu item with submenu
              <div>
                <button
                  onClick={() => setExpandedMenu(expandedMenu === link.name ? null : link.name)}
                  title={!isOpen && !expandedMenu ? link.name : ''}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 ${
                    expandedMenu === link.name
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  {(isOpen || (!isOpen && expandedMenu)) && (
                    <>
                      <span className="font-medium flex-1 text-left text-sm whitespace-nowrap truncate">{link.name}</span>
                      <span className="text-sm">{expandedMenu === link.name ? '▼' : '▶'}</span>
                    </>
                  )}
                </button>

                {/* Submenu Items */}
                {expandedMenu === link.name && (
                  <div className="space-y-1 mt-1">
                    {link.submenu.map((subitem) => (
                      <Link
                        key={subitem.path}
                        to={subitem.path}
                        title={!isOpen && expandedMenu ? subitem.name : ''}
                        className={`flex items-center space-x-3 px-8 py-2 rounded-lg transition duration-200 text-sm ${
                          location.pathname === subitem.path
                            ? 'bg-blue-500 text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-lg">{subitem.icon}</span>
                        <span className="font-medium">{subitem.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Regular menu item
              <Link
                to={link.path}
                title={!isOpen ? link.name : ''}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 ${
                  location.pathname === link.path
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-xl">{link.icon}</span>
                {isOpen && <span className="font-medium">{link.name}</span>}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
