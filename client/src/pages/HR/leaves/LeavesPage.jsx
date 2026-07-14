import React from 'react';
import ManagerCalendar from '../../manager/leaves/ManagerCalendar';

const LeavesPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HR Calendar</h1>
          <p className="text-sm text-gray-600">Review leave calendar and related schedule information</p>
        </div>
      </div>

      <ManagerCalendar />
    </div>
  );
};

export default LeavesPage;