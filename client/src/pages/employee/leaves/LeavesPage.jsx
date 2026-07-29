import React from 'react';
import EmployeeCalendar from './EmployeeCalendar';

const LeavesPage = () => {
	return (
		<div className="space-y-6 text-[color:var(--text-primary)]">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Leaves</h1>
					<p className="text-sm text-[color:var(--text-secondary)]">Calendar view</p>
				</div>
			</div>

			<EmployeeCalendar />
		</div>
	);
};

export default LeavesPage;
