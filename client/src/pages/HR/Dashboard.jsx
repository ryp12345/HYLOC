import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const HRDashboard = () => {
  const { user } = useAuth();

  const stats = [
    { label: 'People Overview', value: 'HR', icon: '👥', tone: 'border-blue-500' },
    { label: 'Leave Calendar', value: 'Open', icon: '📅', tone: 'border-emerald-500' },
    { label: 'Tickets', value: 'Active', icon: '🎫', tone: 'border-amber-500' },
  ];

  const quickActions = [
    { title: 'Open Calendar', description: 'Review leave schedules and availability.', to: '/hr/leaves', icon: '📅' },
    { title: 'Go to Tickets', description: 'Track and manage support requests.', to: '/tickets', icon: '🎫' },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">HR Dashboard</h1>
        <p className="text-gray-600">Welcome, {user?.firstName} {user?.lastName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className={`bg-white rounded-lg shadow-lg border-l-4 ${stat.tone} p-6`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-500 text-sm font-semibold">{stat.label}</div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
            <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="text-3xl">{action.icon}</div>
              <div>
                <div className="font-semibold text-gray-900">{action.title}</div>
                <div className="text-sm text-gray-600">{action.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;