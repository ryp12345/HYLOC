import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

// Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import AdminDashboard from '../pages/admin/Dashboard';
import HRDashboard from '../pages/HR/Dashboard';
import HRLeavesPage from '../pages/HR/leaves/LeavesPage';
import HRMonthlyAttendancePage from '../pages/HR/leaves/MonthlyAttendancePage';
import HRLeaveEntitlementPage from '../pages/HR/leaves/LeaveEntitlementPage';
import ManagementDashboard from '../pages/management/ManagementDashboard';
import KPIDetailPage from '../pages/management/KPIDetailPage';
import PlantEfficiency from '../pages/management/PlantEfficiency';
import MgtPiller from '../pages/management/MgtPiller';
import PillarDetailPage from '../pages/management/PillarDetailPage';
import MgtKmiPage from '../pages/management/MgtKmiPage';
import MgtKmiDetail from '../pages/management/MgtKmiDetail';
import DepartmentDetailPage from '../pages/management/DepartmentDetailPage';
import ManagementMyLeavePage from '../pages/management/leaves/MyLeavePage';
import HODMyLeavePage from '../pages/hod/leaves/MyLeavePage';
import ManagementLeavesPage from '../pages/management/leaves/LeavesPage';
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import EmpKpiKaiPage from '../pages/employee/EmpKpiKaiPage';
import HODDashboard from '../pages/hod/HODDashboard';
// import MyLeavePage from '../pages/hod/leaves/MyLeavePage';



import UsersPage from '../pages/admin/UsersPage';
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
import HODLeavesPage from '../pages/hod/leaves/LeavesPage';
import HODLeaveApprovalPage from '../pages/hod/leaves/LeaveApprovalPage';
import ManagementLeaveApprovalPage from '../pages/management/leaves/LeaveApprovalPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ProfilePage from '../pages/auth/ProfilePage';
import RaiseTicket from '../pages/dev-tickets/RaiseTicket';
import TicketsPage from '../pages/tickets/TicketsPage';
import TicketsAnalysisReport from '../pages/tickets/TicketsAnalysisReport';

// Layouts & Route Guards
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Theme manager for role-based defaults
const RoleThemeManager = () => {
  const { user, isAuthenticated } = useAuth();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    if (isAuthenticated && user?.role?.toLowerCase() === 'management') {
      setTheme('dark');
    }
  }, [user?.role, isAuthenticated, setTheme]);

  return null;
};

// Layout wrapper for authenticated routes
const DashboardLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)] transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 bg-[color:var(--app-bg)] p-2 transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
};

// Unauthorized page
const Unauthorized = () => (
  <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)] p-4">
    <div className="max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center shadow-lg">
      <h1 className="mb-4 text-3xl font-bold text-[color:var(--danger)]">Access Denied</h1>
      <p className="mb-6 text-[color:var(--text-secondary)]">You don't have permission to access this page.</p>
      <a
        href="/login"
        className="inline-block rounded-lg bg-[color:var(--accent)] px-6 py-2 text-white transition hover:opacity-90"
      >
        Go to Login
      </a>
    </div>
  </div>
);

// Not found page
const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)] p-4">
    <div className="max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center shadow-lg">
      <h1 className="mb-4 text-4xl font-bold text-[color:var(--text-primary)]">404</h1>
      <p className="mb-6 text-[color:var(--text-secondary)]">Page not found.</p>
      <a
        href="/login"
        className="inline-block rounded-lg bg-[color:var(--accent)] px-6 py-2 text-white transition hover:opacity-90"
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
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
          <p className="text-[color:var(--text-secondary)]">Loading...</p>
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
        <div className="text-center text-[color:var(--text-secondary)]">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
            <p>Loading...</p>
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

  if (userRole === 'hod') {
    return <Navigate to="/hod/dashboard" replace />;
  }

  // Employee or any other role defaults to employee dashboard
  return <Navigate to="/employee/dashboard" replace />;
};

const AppRoutes = () => {
  return (
    <Router>
      <AuthProvider>
        <RoleThemeManager />
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

          {/* Admin KMI / Global Objectives (full Management Dashboard functionality) */}
          <Route
            path="/admin/global-objectives"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ManagementDashboard />
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

          <Route
            path="/hr/leaves/monthly-attendance"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HRMonthlyAttendancePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/hr/leaves/leave-entitlement"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HRLeaveEntitlementPage />
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

          {/* HOD Dashboard */}
          <Route
            path="/hod/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HODDashboard />
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

          {/* HOD Leaves */}
          <Route
            path="/hod/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HODLeavesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Management My Leave */}
          <Route
            path="/hod/my-leave"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HODMyLeavePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* HOD Leave Approval */}
          <Route
            path="/hod/leave-approval"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HODLeaveApprovalPage />
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

          {/* Ticket Analysis Reports */}
          <Route
            path="/tickets/reports"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TicketsAnalysisReport />
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