import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import { getDesignations } from '../../api/designationApi';
import { getPillers } from '../../api/pillerApi';

const AdminDashboard = () => {
  const [counts, setCounts] = useState({
    users: 0,
    departments: 0,
    designations: 0,
    pillers: 0
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [usersRes, departmentsRes, designationsRes, pillersRes] = await Promise.all([
          getUsers(),
          getDepartments(),
          getDesignations(),
          getPillers()
        ]);
        
        setCounts({
          users: usersRes.data?.data?.length || 0,
          departments: departmentsRes.data?.data?.length || 0,
          designations: designationsRes.data?.data?.length || 0,
          pillers: pillersRes.data?.data?.length || 0
        });
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();
  }, []);

  return (
    <div className="space-y-8 text-[color:var(--text-primary)]">
      <h1 className="mb-8 text-4xl font-bold text-[color:var(--text-primary)]">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--accent)] bg-[color:var(--surface)] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--text-muted)]">Total Users</h3>
              <p className="mt-2 text-3xl font-bold text-[color:var(--text-primary)]">{counts.users}</p>
            </div>
            <div className="rounded-full bg-[color:var(--accent-soft)] p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--success)] bg-[color:var(--surface)] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--text-muted)]">Departments</h3>
              <p className="mt-2 text-3xl font-bold text-[color:var(--text-primary)]">{counts.departments}</p>
            </div>
            <div className="rounded-full bg-[color:var(--success-soft)] p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[color:var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--warning, #f59e0b)] bg-[color:var(--surface)] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--text-muted)]">Designations</h3>
              <p className="mt-2 text-3xl font-bold text-[color:var(--text-primary)]">{counts.designations}</p>
            </div>
            <div className="rounded-full bg-[color:var(--warning-soft,rgba(245,158,11,0.12))] p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[color:var(--warning,#f59e0b)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--accent)] bg-[color:var(--surface)] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--text-muted)]">Pillers</h3>
              <p className="mt-2 text-3xl font-bold text-[color:var(--text-primary)]">{counts.pillers}</p>
            </div>
            <div className="rounded-full bg-[color:var(--accent-soft)] p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-[color:var(--text-primary)]">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            to="/admin/users"
            role="button"
            aria-label="Manage Users"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-[color:var(--accent)] hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--success)] p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">User Page</p>
              <p className="text-sm text-[color:var(--text-secondary)]">View and manage users</p>
            </div>
          </Link>

          <Link
            to="/admin/kmis"
            role="button"
            aria-label="Open KMI Page"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-[color:var(--success)] hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-[color:var(--success)] to-emerald-500 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M18 17V7M13 17V11M8 17v-4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">KMI Page</p>
              <p className="text-sm text-[color:var(--text-secondary)]">View and manage KMIs</p>
            </div>
          </Link>

          <Link
            to="/admin/departments"
            role="button"
            aria-label="Open Departments"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-[color:var(--accent)] hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-blue-600 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a1 1 0 011-1h3v12H4a1 1 0 01-1-1V7zM21 7a1 1 0 00-1-1h-3v12h3a1 1 0 001-1V7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">Department Page</p>
              <p className="text-sm text-[color:var(--text-secondary)]">View and manage departments</p>
            </div>
          </Link>

          <Link
            to="/admin/pillers"
            role="button"
            aria-label="Manage Pillers"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-pink-300 hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.567 3-3.5S13.657 1 12 1 9 2.567 9 4.5 10.343 8 12 8zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">Pillers</p>
              <p className="text-sm text-[color:var(--text-secondary)]">View and manage pillers</p>
            </div>
          </Link>

          <Link
            to="/admin/user-roles"
            role="button"
            aria-label="Manage User Roles"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-[color:var(--warning,#f59e0b)] hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-[color:var(--warning,#f59e0b)] to-yellow-600 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm2 14H6a2 2 0 01-2-2v-2a6 6 0 0112 0v2a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">User Roles</p>
              <p className="text-sm text-[color:var(--text-secondary)]">View and manage roles</p>
            </div>
          </Link>

          <Link
            to="/admin/unit-master"
            role="button"
            aria-label="Unit Master"
            className="flex items-center rounded-lg border border-[color:var(--border)] p-4 transition-all duration-200 hover:border-[color:var(--accent)] hover:shadow-md"
          >
            <div className="mr-4 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-indigo-600 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">Unit Master</p>
              <p className="text-sm text-[color:var(--text-secondary)]">Create and manage measurement units</p>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
