import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

// Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import AdminDashboard from '../pages/admin/Dashboard';
import HRDashboard from '../pages/HR/Dashboard';
import HRLeavesPage from '../pages/HR/leaves/LeavesPage';
import ManagementDashboard from '../pages/management/ManagementDashboard';
import KPIDetailPage from '../pages/management/KPIDetailPage';
import PlantEfficiency from '../pages/management/PlantEfficiency';
import MgtPiller from '../pages/management/MgtPiller';
import PillarDetailPage from '../pages/management/PillarDetailPage';
import MgtKmiPage from '../pages/management/MgtKmiPage';
import MgtKmiDetail from '../pages/management/MgtKmiDetail';
import DepartmentDetailPage from '../pages/management/DepartmentDetailPage';
import ManagementMyLeavePage from '../pages/management/leaves/MyLeavePage';
import ManagerMyLeavePage from '../pages/manager/leaves/MyLeavePage';
import ManagementLeavesPage from '../pages/management/leaves/LeavesPage';
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import EmpKpiKaiPage from '../pages/employee/EmpKpiKaiPage';
import ManagerDashboard from '../pages/manager/ManagerDashboard';
// import MyLeavePage from '../pages/manager/leaves/MyLeavePage';



import UsersPage from '../pages/admin/UsersPage';
import LeaveEntitlementPage from '../pages/admin/leaves/LeaveEntitlementPage';
import MonthlyAttendancePage from '../pages/admin/leaves/MonthlyAttendancePage';
import UserRolePage from '../pages/admin/UserRolePage';
import DepartmentsPage from '../pages/admin/DepartmentsPage';
import DesignationsPage from '../pages/admin/DesignationsPage';
import AssociationsPage from '../pages/admin/AssociationsPage';
import RolesPage from '../pages/admin/RolesPage';
import PillersPage from '../pages/admin/PillersPage';
import KmisPage from '../pages/admin/KmisPage';
import KmiDetail from '../pages/admin/KmiDetail';
import UnitMaster from '../pages/admin/UnitMaster';
import EmployeeLeavesPage from '../pages/employee/leaves/LeavesPage';
import ManagerLeavesPage from '../pages/manager/leaves/LeavesPage';
import ManagerLeaveApprovalPage from '../pages/manager/leaves/LeaveApprovalPage';
import ManagementLeaveApprovalPage from '../pages/management/leaves/LeaveApprovalPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ProfilePage from '../pages/auth/ProfilePage';
import RaiseTicket from '../pages/dev-tickets/RaiseTicket';
import TicketsPage from '../pages/tickets/TicketsPage';

// Layouts & Route Guards
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';

// Layout wrapper for authenticated routes
const DashboardLayout = ({ children }) => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
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

  // Check role (case-insensitive) and redirect accordingly
  const userRole = user.role?.toLowerCase();

  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (userRole === 'hr') {
    return <Navigate to="/hr/dashboard" replace />;
  }

  if (userRole === 'management') {
    return <Navigate to="/management/dashboard" replace />;
  }

  if (userRole === 'manager') {
    return <Navigate to="/manager/dashboard" replace />;
  }

  // Employee or any other role defaults to employee dashboard
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
          <Route
            path="/forgot-password"
            element={
              <AuthRoute>
                <ForgotPasswordPage />
              </AuthRoute>
            }
          />

          {/* Profile Route - Accessible to all authenticated users */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

         
          {/* Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AdminDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HRDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/user-roles"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserRolePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DepartmentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RolesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/designations"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DesignationsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/associations"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AssociationsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/pillers"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PillersPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/kmis"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <KmisPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/unit-master"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UnitMaster />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/kmis/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <KmiDetail />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

            <Route
              path="/admin/leaves/leave-entitlement"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LeaveEntitlementPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leaves/monthly-attendance"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MonthlyAttendancePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
          <Route
            path="/management/kmis/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MgtKmiDetail />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HRLeavesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Management Dashboard */}
          <Route
            path="/management/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagementDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* KPI Detail Page */}
          <Route
            path="/management/kpi/:kpiId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <KPIDetailPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Plant Efficiency Page */}
          <Route
            path="/management/plant-efficiency"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PlantEfficiency />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/management/users"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

            {/* Management Piller Page */}
          <Route
            path="/management/mgtpiller"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MgtPiller />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

            {/* Management KMI Page */}
            <Route
              path="/management/mgtkmi"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MgtKmiPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Management Pillar Detail Page */}
            <Route
              path="/management/pillar/:pillerId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PillarDetailPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Management Department Detail Page */}
            <Route
              path="/management/department/:departmentId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DepartmentDetailPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

          {/* Manager Dashboard */}
          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagerDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

           {/* Management My Leave */}
          <Route
            path="/management/my-leave"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagementMyLeavePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Management Leave Approval */}
          <Route
            path="/management/leave-approval"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagementLeaveApprovalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Management Leaves */}
          <Route
            path="/management/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagementLeavesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Employee Dashboard */}
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Employee KPI/KAI Page */}
          <Route
            path="/employee/kpikai"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmpKpiKaiPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Management KPI/KAI Page */}
          <Route
            path="/management/kpikai"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmpKpiKaiPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Employee Leaves */}
          <Route
            path="/employee/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeLeavesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Manager Leaves */}
          <Route
            path="/manager/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagerLeavesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

           {/* Management My Leave */}
          <Route
            path="/manager/my-leave"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagerMyLeavePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Manager Leave Approval */}
          <Route
            path="/manager/leave-approval"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagerLeaveApprovalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Raise Ticket Page */}
          <Route
            path="/raise-ticket"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RaiseTicket />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Tickets Page */}
          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TicketsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Removed /tickets route as TicketList is merged into RaiseTicket.jsx */}

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
