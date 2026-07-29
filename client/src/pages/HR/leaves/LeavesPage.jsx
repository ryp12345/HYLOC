import React from 'react';
import HRCalendar from './HRCalendar';

const LeavesPage = () => {
  return (
    <div className="w-full space-y-6 bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">HR Calendar</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">Review leave calendar and related schedule information</p>
        </div>
      </div>

      <HRCalendar />
    </div>
  );
};

export default LeavesPage;