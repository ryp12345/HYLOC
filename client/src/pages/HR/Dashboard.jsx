import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUsers } from '../../api/userApi';
import { getAllLeaves } from '../../api/leaveApi';
import { getDepartments } from '../../api/departmentApi';
import { getDesignations } from '../../api/designationApi';

const HRDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staffCount, setStaffCount] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [designationCount, setDesignationCount] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [usersRes, leavesRes, deptsRes, designationsRes] = await Promise.all([
          getUsers(),
          getAllLeaves({ status: 'Pending' }),
          getDepartments(),
          getDesignations(),
        ]);

        const users = usersRes.data?.data || [];
        console.log('Users response:', usersRes.data, 'parsed users:', users);
        const activeStaff = users.filter(u => String(u.status || '').toLowerCase() !== 'inactive').length;
        setStaffCount(activeStaff);

        const pending = leavesRes.data?.data || [];
        console.log('Pending leaves response:', leavesRes.data, 'parsed pending:', pending);
        setPendingLeaves(pending.length);

        const departments = deptsRes.data?.data || deptsRes.data || [];
        console.log('Departments response:', deptsRes.data, 'parsed departments:', departments);
        setDepartmentCount(departments.length);

        const designations = designationsRes.data?.data || designationsRes.data || [];
        console.log('Designations response:', designationsRes.data, 'parsed designations:', designations);
        setDesignationCount(designations.length);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const stats = [
    { label: 'Total Active Staff', value: loading ? '...' : staffCount, icon: '👥', tone: 'border-blue-500' },
    { label: 'Pending Leaves', value: loading ? '...' : pendingLeaves, icon: '📅', tone: 'border-emerald-500' },
    { label: 'Departments', value: loading ? '...' : departmentCount, icon: '🏢', tone: 'border-purple-500' },
    { label: 'Designations', value: loading ? '...' : designationCount, icon: '🪪', tone: 'border-orange-500' },
  ];

  const quickActions = [
    { title: 'Open Calendar', description: 'Review leave schedules and availability.', to: '/hr/leaves', icon: '📅' },
    { title: 'Monthly Attendance', description: 'Manage monthly working days and coverage.', to: '/hr/leaves/monthly-attendance', icon: '🗓️' },
    { title: 'Leave Entitlement', description: 'Configure and view staff leave entitlements.', to: '/hr/leaves/leave-entitlement', icon: '📋' },
    { title: 'Go to Tickets', description: 'Track and manage support requests.', to: '/tickets', icon: '🎫' },
  ];

  return (
    <div className="w-full space-y-6 bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[color:var(--text-primary)] mb-2">HR Dashboard</h1>
        <p className="text-[color:var(--text-secondary)]">Welcome, {user?.firstName} {user?.lastName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className={`bg-[color:var(--surface)] rounded-lg shadow-sm border-l-4 ${stat.tone} p-6`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[color:var(--text-muted)] text-sm font-semibold">{stat.label}</div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
            <div className="text-3xl font-bold text-[color:var(--text-primary)]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[color:var(--surface)] rounded-lg shadow-sm border border-[color:var(--border)] p-6">
        <h2 className="text-xl font-bold text-[color:var(--text-primary)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="flex items-center gap-4 p-4 border border-[color:var(--border)] rounded-lg hover:shadow-md hover:border-[color:var(--accent)] transition-all"
            >
              <div className="text-3xl">{action.icon}</div>
              <div>
                <div className="font-semibold text-[color:var(--text-primary)]">{action.title}</div>
                <div className="text-sm text-[color:var(--text-secondary)]">{action.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;