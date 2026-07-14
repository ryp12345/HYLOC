import React from 'react';
import HRCalendar from './HRCalendar';

const LeavesPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HR Calendar</h1>
          <p className="text-sm text-gray-600">Review leave calendar and related schedule information</p>
        </div>
      </div>

      <HRCalendar />
    </div>
  );
};

export default LeavesPage;