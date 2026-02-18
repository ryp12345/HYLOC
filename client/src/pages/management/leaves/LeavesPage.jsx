import React from 'react';
import ManagementCalendar from './ManagementCalendar';

const LeavesPage = () => {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-800">Calendar</h1>
				</div>
			</div>
			<ManagementCalendar />
		</div>
	);
};

export default LeavesPage;
