import React from 'react';

const AdminDashboard = () => {
  return (
    <div>
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Users', value: '1,234', color: 'bg-blue-500' },
          { title: 'Active Sessions', value: '456', color: 'bg-green-500' },
          { title: 'Pending Reports', value: '78', color: 'bg-yellow-500' },
          { title: 'System Health', value: '98%', color: 'bg-purple-500' }
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.color} text-white p-6 rounded-lg shadow-lg`}>
            <h3 className="text-gray-100 text-sm font-medium">{stat.title}</h3>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Activity</h2>
        <p className="text-gray-600">No recent activity to display.</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
