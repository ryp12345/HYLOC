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
    <div>
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
              <p className="text-3xl font-bold mt-2 text-gray-800">{counts.users}</p>
            </div>
            <div className="bg-blue-100 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Departments</h3>
              <p className="text-3xl font-bold mt-2 text-gray-800">{counts.departments}</p>
            </div>
            <div className="bg-green-100 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Designations</h3>
              <p className="text-3xl font-bold mt-2 text-gray-800">{counts.designations}</p>
            </div>
            <div className="bg-yellow-100 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Pillers</h3>
              <p className="text-3xl font-bold mt-2 text-gray-800">{counts.pillers}</p>
            </div>
            <div className="bg-purple-100 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            to="/admin/users"
            role="button"
            aria-label="Manage Users"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-indigo-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">User Page</p>
              <p className="text-sm text-gray-600">View and manage users</p>
            </div>
          </Link>

          <Link
            to="/admin/kmis"
            role="button"
            aria-label="Open KMI Page"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-green-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M18 17V7M13 17V11M8 17v-4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">KMI Page</p>
              <p className="text-sm text-gray-600">View and manage KMIs</p>
            </div>
          </Link>

          <Link
            to="/admin/departments"
            role="button"
            aria-label="Open Departments"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-blue-400 to-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a1 1 0 011-1h3v12H4a1 1 0 01-1-1V7zM21 7a1 1 0 00-1-1h-3v12h3a1 1 0 001-1V7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Department Page</p>
              <p className="text-sm text-gray-600">View and manage departments</p>
            </div>
          </Link>

          <Link
            to="/admin/pillers"
            role="button"
            aria-label="Manage Pillers"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-pink-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-pink-400 to-pink-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.567 3-3.5S13.657 1 12 1 9 2.567 9 4.5 10.343 8 12 8zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Pillers</p>
              <p className="text-sm text-gray-600">View and manage pillers</p>
            </div>
          </Link>

          <Link
            to="/admin/user-roles"
            role="button"
            aria-label="Manage User Roles"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-yellow-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm2 14H6a2 2 0 01-2-2v-2a6 6 0 0112 0v2a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">User Roles</p>
              <p className="text-sm text-gray-600">View and manage roles</p>
            </div>
          </Link>

          <Link
            to="/admin/leaves/leave-entitlement"
            role="button"
            aria-label="Leave Entitlements"
            className="flex items-center p-4 transition-all duration-200 border border-gray-200 rounded-lg hover:shadow-md hover:border-green-300"
          >
            <div className="p-2 mr-4 rounded-lg bg-gradient-to-r from-green-400 to-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Leave Entitlements</p>
              <p className="text-sm text-gray-600">Assign and manage leave entitlements</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
