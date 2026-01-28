import React from 'react';
import { useAuth } from '../../context/AuthContext';

const UserDashboard = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Welcome, {user?.firstName}!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          { title: 'Profile Views', value: '342', color: 'bg-blue-500' },
          { title: 'Tasks Completed', value: '28', color: 'bg-green-500' },
          { title: 'Messages', value: '15', color: 'bg-purple-500' }
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.color} text-white p-6 rounded-lg shadow-lg`}>
            <h3 className="text-gray-100 text-sm font-medium">{stat.title}</h3>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Information</h2>
        <div className="space-y-4">
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium text-gray-700">Name:</span>
            <span className="text-gray-600">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium text-gray-700">Email:</span>
            <span className="text-gray-600">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Role:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              user?.role === 'admin' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
