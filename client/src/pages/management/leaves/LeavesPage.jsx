import React from 'react';
import ManagementCalendar from './ManagementCalendar';

const LeavesPage = () => {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-800">Management Calendar</h1>
					<p className="text-sm text-gray-600">Track organization leaves and manage your own leave schedule</p>
				</div>
			</div>
			<ManagementCalendar title="Management Calendar" />
		</div>
	);
};

export default LeavesPage;
