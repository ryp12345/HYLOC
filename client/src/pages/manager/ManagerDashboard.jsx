import React from 'react';
import { useAuth } from '../../context/AuthContext';

function ManagerDashboard() {
	const { user } = useAuth();

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-800 mb-2">
					Manager Dashboard
				</h1>
				<p className="text-gray-600">
					Welcome, {user?.firstName} {user?.lastName}
				</p>
			</div>

			{/* Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
					<div className="text-gray-500 text-sm font-semibold mb-2">Total Employees</div>
					<div className="text-3xl font-bold text-gray-800">--</div>
				</div>
				<div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
					<div className="text-gray-500 text-sm font-semibold mb-2">Present Today</div>
					<div className="text-3xl font-bold text-gray-800">--</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="bg-white rounded-lg shadow p-6">
				<h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<button className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition">
						<div className="font-semibold text-gray-800">View Reports</div>
						<p className="text-sm text-gray-500">Check attendance & performance</p>
					</button>
				</div>
			</div>
		</div>
	);
}

export default ManagerDashboard;
