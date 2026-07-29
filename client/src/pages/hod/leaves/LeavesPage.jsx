import React from 'react';
import HODCalendar from './HODCalendar';

const LeavesPage = () => {
	return (
		<div className="w-full space-y-6 bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-[color:var(--text-primary)]">HOD Leaves</h1>
					<p className="text-sm text-[color:var(--text-secondary)]">Apply and manage your own leaves</p>
				</div>
			</div>

			<HODCalendar />
		</div>
	);
};

export default LeavesPage;
