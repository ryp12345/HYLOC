import React, { useState } from 'react';

const EmployeeCalendar = ({ joinDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get month details for month view
  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Get week details for week view
  const getWeekDays = (date) => {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay(); // First day is the Sunday
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      weekDays.push(new Date(curr.setDate(first + i)));
    }

    return weekDays;
  };

  // Format month and year
  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Format week range
  const formatWeekRange = (startDate) => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date && date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Check if date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date && date < today;
  };

  // Check if date is selected
  const isSelectedDate = (date) => {
    return date && selectedDate &&
           date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  // Format full date
  const formatFullDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Day names for headers
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthDays = getMonthDays(currentDate);
  const weekDays = getWeekDays(currentDate);

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'day'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div>
          {/* Month Header */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 text-center">
              {formatMonthYear(currentDate)}
            </h3>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="bg-blue-100 text-blue-800 font-semibold text-center py-2 rounded"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date, index) => (
              <div
                key={index}
                className={`min-h-[80px] p-2 rounded border-2 transition-all cursor-pointer ${
                  date === null
                    ? 'bg-gray-50 border-gray-200'
                    : isToday(date)
                    ? 'border-blue-600 bg-white'
                    : isSelectedDate(date)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                } ${isPastDate(date) ? 'opacity-60' : 'opacity-100'}`}
                onClick={() => date && setSelectedDate(date)}
              >
                {date && (
                  <>
                    <div className="font-bold text-gray-800 text-sm mb-1">
                      {date.getDate()}
                    </div>
                    {isToday(date) && (
                      <div className="text-blue-600 text-xs font-italic">Today</div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div>
          {/* Week Header */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 text-center">
              Week of {formatWeekRange(weekDays[0])}
            </h3>
          </div>

          {/* Day Headers with Dates */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((date) => (
              <div
                key={date.toISOString()}
                className="bg-blue-100 text-blue-800 font-semibold text-center py-2 rounded"
              >
                <div>{dayNames[date.getDay()]}</div>
                <div className="text-sm">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((date) => (
              <div
                key={date.toISOString()}
                className={`min-h-[150px] p-3 rounded border-2 transition-all cursor-pointer ${
                  isToday(date)
                    ? 'border-blue-600 bg-white'
                    : isSelectedDate(date)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                } ${isPastDate(date) ? 'opacity-60' : 'opacity-100'}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="font-bold text-gray-800 text-sm mb-2">
                  {date.getDate()}
                </div>
                {isToday(date) && (
                  <div className="text-blue-600 text-xs font-italic">Today</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="max-w-2xl mx-auto">
          {/* Day Header */}
          <div className="mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 text-center">
              {formatFullDate(selectedDate)}
            </h3>
          </div>

          {/* Day Details Card */}
          <div className="border-2 border-blue-200 rounded-lg bg-blue-50 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date:
                </label>
                <p className="text-gray-800">{formatFullDate(selectedDate)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Day of Week:
                </label>
                <p className="text-gray-800">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date Type:
                </label>
                <p className="text-gray-800">
                  {isToday(selectedDate) ? (
                    <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm">
                      Today
                    </span>
                  ) : isPastDate(selectedDate) ? (
                    <span className="inline-block bg-gray-400 text-white px-3 py-1 rounded text-sm">
                      Past Date
                    </span>
                  ) : (
                    <span className="inline-block bg-green-600 text-white px-3 py-1 rounded text-sm">
                      Future Date
                    </span>
                  )}
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setViewMode('month')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Month View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCalendar;
