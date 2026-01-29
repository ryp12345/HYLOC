import React from 'react';
import EmployeeCalendar from '../../employee/leaves/EmployeeCalendar';

const LeavesPage = () => {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-800">Manager Leaves</h1>
					<p className="text-sm text-gray-600">Calendar view</p>
				</div>
			</div>

			<EmployeeCalendar />
		</div>
	);
};

export default LeavesPage;
