import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

// Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import AdminDashboard from '../pages/admin/Dashboard';
import UserDashboard from '../pages/user/Dashboard';
import ManagementDashboard from '../pages/management/ManagementDashboard';
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import UsersPage from '../pages/admin/UsersPage';
import UserRolePage from '../pages/admin/UserRolePage';
import DepartmentsPage from '../pages/admin/DepartmentsPage';
import DesignationsPage from '../pages/admin/DesignationsPage';
import AssociationsPage from '../pages/admin/AssociationsPage';
import RolesPage from '../pages/admin/RolesPage';
import PillersPage from '../pages/admin/PillersPage';
import EmployeeLeavesPage from '../pages/employee/leaves/LeavesPage';

// Layouts & Route Guards
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';

// Layout wrapper for authenticated routes
const DashboardLayout = ({ children }) => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 p-6 bg-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
};

// Unauthorized page
const Unauthorized = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-500 to-red-600">
    <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
      <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
      <a
        href="/login"
        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Go to Login
      </a>
    </div>
  </div>
);

// Not found page
const NotFound = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-500 to-gray-600">
    <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
      <p className="text-gray-600 mb-6">Page not found.</p>
      <a
        href="/login"
        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Go to Home
      </a>
    </div>
  </div>
);

// Route wrapper to redirect authenticated users from auth pages
const AuthRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Dashboard redirect based on user role
const DashboardRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user.role === 'management') {
    return <Navigate to="/management/dashboard" replace />;
  }

  return <Navigate to="/employee/dashboard" replace />;
};

const AppRoutes = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Home redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Auth Routes */}
          <Route
            path="/login"
            element={
              <AuthRoute>
                <Login />
              </AuthRoute>
            }
          />
          <Route
            path="/register"
            element={
              <AuthRoute>
                <Register />
              </AuthRoute>
            }
          />

          {/* Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <AdminDashboard />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Super Admin Routes */}
          <Route
            path="/super-admin/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <AdminDashboard />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/users"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <UsersPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/user-roles"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin']}>
                  <DashboardLayout>
                    <UserRolePage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/departments"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <DepartmentsPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/roles"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <RolesPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/designations"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <DesignationsPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/associations"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <AssociationsPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin/pillers"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin', 'management']}>
                  <DashboardLayout>
                    <PillersPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* User Dashboard */}
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['employee', 'management', 'admin']}>
                  <DashboardLayout>
                    <UserDashboard />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Management Dashboard */}
          <Route
            path="/management/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['management', 'admin']}>
                  <DashboardLayout>
                    <ManagementDashboard />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Employee Dashboard */}
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['employee', 'management', 'admin']}>
                  <DashboardLayout>
                    <EmployeeDashboard />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Employee Leaves */}
          <Route
            path="/employee/leaves"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['employee', 'management', 'admin']}>
                  <DashboardLayout>
                    <EmployeeLeavesPage />
                  </DashboardLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Default dashboard redirect */}
          <Route
            path="/dashboard"
            element={<DashboardRedirect />}
          />

          {/* Error Routes */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default AppRoutes;
