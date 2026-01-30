import React from 'react';
import ManagerCalendar from './ManagerCalendar';

const LeavesPage = () => {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-800">Manager Leaves</h1>
					<p className="text-sm text-gray-600">Apply and manage your own leaves</p>
				</div>
			</div>

			<ManagerCalendar />
		</div>
	);
};

export default LeavesPage;
