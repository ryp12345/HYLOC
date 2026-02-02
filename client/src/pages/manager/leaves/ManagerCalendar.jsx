import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { 
  applyLeave, 
  getMyLeaves, 
  getMyLeaveBalance, 
  updateLeave, 
  cancelLeave,
  checkLeaveEligibility,
  getDepartmentColleagues,
  getDepartmentLeaves
} from '../../../api/leaveApi';

const ManagerCalendar = ({ joinDate }) => {
  const { user } = useAuth();
  const userRole = (user?.role?.name || user?.role || '').toString().toLowerCase();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'list'
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Leave management state
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [showCalendarLeaveModal, setShowCalendarLeaveModal] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [selectedCalendarLeaves, setSelectedCalendarLeaves] = useState([]);
  
  // Form state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [showDateDetail, setShowDateDetail] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    from_date: '',
    to_date: '',
    leave_duration: 'Full Day',
    leave_reason: '',
    alternate_person: '',
    additional_alternate: '',
    available_on_phone: true
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const year = currentDate.getFullYear();
      
      // Load leaves for current year
      const leavesResponse = await getMyLeaves({ year });
      setLeaves(leavesResponse.data.data || []);
      
      // Load leave balance
      const balanceResponse = await getMyLeaveBalance(year);
      setLeaveBalance(balanceResponse.data.data);
      
      // Check eligibility
      const eligibilityResponse = await checkLeaveEligibility();
      setEligibility(eligibilityResponse.data.data);
      
      // Load department colleagues
      const colleaguesResponse = await getDepartmentColleagues();
      console.log('Colleagues response:', colleaguesResponse);
      console.log('Colleagues data:', colleaguesResponse.data.data);
      console.log('Colleagues count:', colleaguesResponse.data.data?.length);
      setColleagues(colleaguesResponse.data.data || []);

      const departmentLeavesResponse = await getDepartmentLeaves({ year });
      const departmentLeaves = departmentLeavesResponse.data.data || [];
      setCalendarLeaves(departmentLeaves);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLeaveForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Open leave form for new application
  const openLeaveForm = (date = null) => {
    const formattedDate = date 
      ? formatDateForInput(date)
      : formatDateForInput(selectedDate);
    
    setLeaveForm({
      from_date: formattedDate,
      to_date: formattedDate,
      leave_duration: 'Full Day',
      leave_reason: '',
      alternate_person: '',
      additional_alternate: '',
      available_on_phone: true
    });
    setEditingLeave(null);
    setShowLeaveForm(true);
  };

  // Open leave form for editing
  const openEditForm = (leave) => {
    setLeaveForm({
      from_date: leave.from_date,
      to_date: leave.to_date,
      leave_duration: leave.leave_duration,
      leave_reason: leave.leave_reason,
      alternate_person: leave.alternate_person || '',
      additional_alternate: leave.additional_alternate || '',
      available_on_phone: leave.available_on_phone !== false
    });
    setEditingLeave(leave);
    setShowLeaveForm(true);
  };

  // Handle date click to show details
  const handleDateClick = (date) => {
    setSelectedDate(date);
    const leave = getLeaveForDate(date);
    
    if (leave) {
      // If leave exists, show detail modal
      setShowDateDetail(true);
    } else {
      // If no leave, directly open the form with this date
      setLeaveForm({
        from_date: formatDateForInput(date),
        to_date: formatDateForInput(date),
        leave_duration: 'Full Day',
        leave_reason: '',
        alternate_person: '',
        additional_alternate: '',
        available_on_phone: true
      });
      setEditingLeave(null);
      setShowLeaveForm(true);
    }
  };

  // Submit leave application
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (editingLeave) {
        // Update existing leave
        await updateLeave(editingLeave.id, leaveForm);
      } else {
        // Create new leave
        const response = await applyLeave(leaveForm);
        if (response?.data?.data?.split) {
          const count = response?.data?.data?.records?.length || 2;
          window.alert(`Your leave was split into ${count} separate requests (Paid/Unpaid).`);
        }
      }
      
      handleCloseLeaveForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit leave');
      console.error('Error submitting leave:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cancel leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await cancelLeave(leaveId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel leave');
      console.error('Error cancelling leave:', err);
    } finally {
      setLoading(false);
    }
  };

  // Date helpers (avoid UTC shifting)
  const parseDateOnly = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) {
      const d = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
      d.setHours(0, 0, 0, 0);
      return d;
    }

    const dateString = String(dateValue);

    if (dateString.includes('T')) {
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return null;
      const d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      d.setHours(0, 0, 0, 0);
      return d;
    }

    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const toLocalDateOnly = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Check if a date has leave
  const getLeaveForDate = (date) => {
    if (!date) return null;

    const checkTime = toLocalDateOnly(date).getTime();
    return leaves.find((leave) => {
      const fromDate = parseDateOnly(leave.from_date);
      const toDate = parseDateOnly(leave.to_date);
      if (!fromDate || !toDate) return false;

      return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
    });
  };

  const getCalendarLeavesForDate = (date) => {
    if (!date) return [];
    const checkTime = toLocalDateOnly(date).getTime();
    const matchingLeaves = calendarLeaves.filter((leave) => {
      const fromDate = parseDateOnly(leave.from_date);
      const toDate = parseDateOnly(leave.to_date);
      if (!fromDate || !toDate) return false;

      return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
    });

    if (userRole === 'manager') {
      return matchingLeaves.filter((leave) => leave.user_role === 'Employee');
    }

    return [];
  };

  const openCalendarLeaveModal = (date) => {
    const dayLeaves = getCalendarLeavesForDate(date);
    setSelectedCalendarDate(date);
    setSelectedCalendarLeaves(dayLeaves);
    setShowCalendarLeaveModal(true);
  };

  const closeCalendarLeaveModal = () => {
    setShowCalendarLeaveModal(false);
    setSelectedCalendarDate(null);
    setSelectedCalendarLeaves([]);
  };

  const handleCloseLeaveForm = () => {
    setShowLeaveForm(false);
    setSelectedDate(new Date());
  };

  const handleCloseDateDetail = () => {
    setShowDateDetail(false);
    setSelectedDate(new Date());
  };

  const formatAlternate = (leave) => {
    const primary = leave.alternate_person || '';
    const additional = leave.additional_alternate || '';
    if (primary && additional) return `${primary}, ${additional}`;
    return primary || additional || '—';
  };

  // Get leave badge color
  const getLeaveBadgeColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-500';
      case 'Pending':
        return 'bg-yellow-500';
      case 'Rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

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
    <div className="w-full space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Leave Balance Cards */}
      {leaveBalance && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Balance - {currentDate.getFullYear()}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Entitled</p>
              <p className="text-3xl font-bold">{leaveBalance.leave_entitled}</p>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Accumulated</p>
              <p className="text-3xl font-bold">{leaveBalance.leaves_accumulated}</p>
            </div>
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Availed</p>
              <p className="text-3xl font-bold">{leaveBalance.leaves_availed}</p>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Available</p>
              <p className="text-3xl font-bold">{leaveBalance.leave_balance}</p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Card */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manager Leave Calendar</h2>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'month'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'week'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              List
            </button>
          </div>
        </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div>
          {/* Month Header with Navigation */}
          <div className="mb-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
            >
              &lt;
            </button>
            <h3 className="text-xl font-semibold text-gray-800 min-w-48 text-center">
              {formatMonthYear(currentDate)}
            </h3>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
            >
              &gt;
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="bg-purple-100 text-purple-800 font-semibold text-center py-2 rounded"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date, index) => {
              const leave = getLeaveForDate(date);
              const dayCalendarLeaves = getCalendarLeavesForDate(date);
              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-2 rounded border-2 transition-all ${
                    date === null
                      ? 'bg-gray-50 border-gray-200'
                      : isToday(date)
                      ? 'border-purple-600 bg-white'
                      : isSelectedDate(date)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } ${isPastDate(date) ? 'opacity-60' : 'opacity-100'} ${date && leave ? 'cursor-pointer' : date ? 'cursor-pointer' : ''}`}
                  onClick={() => date && handleDateClick(date)}
                >
                  {date && (
                    <>
                      <div className="font-bold text-gray-800 text-sm mb-1">
                        {date.getDate()}
                      </div>
                      {isToday(date) && (
                        <div className="text-purple-600 text-xs font-italic">Today</div>
                      )}
                      {leave && (
                        <button 
                          className="mt-1 w-full px-2 py-1.5 rounded bg-blue-600 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all hover:bg-blue-700"
                          title="Click to view/edit leave"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDateClick(date);
                          }}
                        >
                          <div className="font-semibold text-center">My Leave</div>
                        </button>
                      )}
                      {dayCalendarLeaves.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <button
                            className="w-full px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCalendarLeaveModal(date);
                            }}
                          >
                            Team Leave
                          </button>
                          <div className="text-[10px] text-gray-500 text-center">
                            {dayCalendarLeaves.length} leave(s)
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
                className="bg-purple-100 text-purple-800 font-semibold text-center py-2 rounded"
              >
                <div>{dayNames[date.getDay()]}</div>
                <div className="text-sm">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((date) => {
              const dayCalendarLeaves = getCalendarLeavesForDate(date);
              return (
              <div
                key={date.toISOString()}
                className={`min-h-[150px] p-3 rounded border-2 transition-all cursor-pointer ${
                  isToday(date)
                    ? 'border-purple-600 bg-white'
                    : isSelectedDate(date)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                } ${isPastDate(date) ? 'opacity-60' : 'opacity-100'}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="font-bold text-gray-800 text-sm mb-2">
                  {date.getDate()}
                </div>
                {isToday(date) && (
                  <div className="text-purple-600 text-xs font-italic">Today</div>
                )}
                {dayCalendarLeaves.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <button
                      className="w-full px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blu0 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCalendarLeaveModal(date);
                      }}
                    >
                      Team Leave
                    </button>
                    <div className="text-[10px] text-gray-500 text-center">
                      {dayCalendarLeaves.length} leave(s)
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">My Leaves</h3>
          
          {leaves.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No leaves applied yet
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded text-white text-sm ${getLeaveBadgeColor(leave.status)}`}>
                          {leave.status}
                        </span>
                        <span className="text-sm text-gray-600">
                          {leave.leave_duration}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">
                          {leave.credited_days} day(s)
                        </span>
                      </div>
                      
                      <div className="text-gray-800 mb-1">
                        <strong>Duration:</strong> {leave.leave_duration}
                      </div>
                      
                      <div className="text-gray-700 mb-2">
                        <strong>Reason:</strong> {leave.leave_reason}
                      </div>
                      
                      {leave.alternate_person && (
                        <div className="text-sm text-gray-600">
                          <strong>Alternate:</strong> {leave.alternate_person}
                        </div>
                      )}
                      
                      {leave.approver_name && (
                        <div className="text-sm text-gray-600">
                          <strong>Approved/Rejected by:</strong> {leave.approver_name}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditForm(leave)}
                        className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCancelLeave(leave.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {showCalendarLeaveModal && selectedCalendarDate && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Leave Details - {formatFullDate(selectedCalendarDate)}
              </h3>
              <button
                onClick={closeCalendarLeaveModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {selectedCalendarLeaves.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No leaves for this date</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="text-left px-4 py-2 border">User Name</th>
                      <th className="text-left px-4 py-2 border">Role</th>
                      <th className="text-left px-4 py-2 border">From Date</th>
                      <th className="text-left px-4 py-2 border">To Date</th>
                      <th className="text-left px-4 py-2 border">Leave Reason</th>
                      <th className="text-left px-4 py-2 border">Alternate</th>
                      <th className="text-left px-4 py-2 border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCalendarLeaves.map((leave) => (
                      <tr key={leave.id} className="border-t">
                        <td className="px-4 py-2 border">{leave.user_name}</td>
                        <td className="px-4 py-2 border">{leave.user_role || '—'}</td>
                        <td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.from_date))}</td>
                        <td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.to_date))}</td>
                        <td className="px-4 py-2 border">{leave.leave_reason || '—'}</td>
                        <td className="px-4 py-2 border">{formatAlternate(leave)}</td>
                        <td className="px-4 py-2 border">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${getLeaveBadgeColor(leave.status)}`}>
                            {leave.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Date Detail Modal */}
    {showDateDetail && selectedDate && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {formatFullDate(selectedDate)}
              </h3>
              <button
                onClick={handleCloseDateDetail}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {(() => {
              const leave = getLeaveForDate(selectedDate);
              return leave ? (
                <div className="space-y-4">
                  <div className="border-b pb-3">
                    <span className={`px-3 py-1 rounded text-white text-sm ${getLeaveBadgeColor(leave.status)}`}>
                      {leave.status}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">{leave.leave_duration}</span>
                    <span className="ml-2 text-sm font-semibold text-gray-700">{leave.credited_days} day(s)</span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700">Duration:</p>
                    <p className="text-gray-800">{leave.leave_duration}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700">Reason:</p>
                    <p className="text-gray-800">{leave.leave_reason}</p>
                  </div>

                  {leave.alternate_person && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Alternate Person:</p>
                      <p className="text-gray-800">{leave.alternate_person}</p>
                    </div>
                  )}

                  {leave.additional_alternate && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Additional Alternate:</p>
                      <p className="text-gray-800">{leave.additional_alternate}</p>
                    </div>
                  )}

                  {leave.approver_name && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {leave.status === 'Approved' ? 'Approved by:' : 'Rejected by:'}
                      </p>
                      <p className="text-gray-800">{leave.approver_name}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => {
                        openEditForm(leave);
                        handleCloseDateDetail();
                      }}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to cancel this leave?')) {
                          handleCancelLeave(leave.id);
                          handleCloseDateDetail();
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Cancel Leave
                    </button>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Leave Application Form Modal */}
    {showLeaveForm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editingLeave ? 'Edit Leave Application' : 'Apply for Leave'}
              </h3>
              <button
                onClick={handleCloseLeaveForm}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    name="from_date"
                    value={leaveForm.from_date}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    name="to_date"
                    value={leaveForm.to_date}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Duration *
                  </label>
                  <select
                    name="leave_duration"
                    value={leaveForm.leave_duration}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Full Day">Full Day</option>
                    <option value="Morning Half">Morning Half</option>
                    <option value="Afternoon Half">Afternoon Half</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Note: Half-day leaves are limited to a single day
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Leave *
                </label>
                <textarea
                  name="leave_reason"
                  value={leaveForm.leave_reason}
                  onChange={handleFormChange}
                  required
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Please provide a reason for your leave..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alternate Person (Optional)
                  </label>
                  <select
                    name="alternate_person"
                    value={leaveForm.alternate_person}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select alternate person</option>
                    {colleagues && colleagues.length > 0 ? (
                      colleagues.map((colleague) => (
                        <option key={colleague.id} value={`${colleague.firstname} ${colleague.lastname}`}>
                          {colleague.firstname} {colleague.lastname} {colleague.empid ? `(EMP: ${colleague.empid})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No colleagues found in your department</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Person from your department who will cover your responsibilities
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Alternate (Optional)
                  </label>
                  <select
                    name="additional_alternate"
                    value={leaveForm.additional_alternate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select additional alternate</option>
                    {colleagues && colleagues.length > 0 ? (
                      colleagues.map((colleague) => (
                        <option key={colleague.id} value={`${colleague.firstname} ${colleague.lastname}`}>
                          {colleague.firstname} {colleague.lastname} {colleague.empid ? `(EMP: ${colleague.empid})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No colleagues found in your department</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Backup person if needed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="available_on_phone"
                    checked={leaveForm.available_on_phone}
                    onChange={handleFormChange}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Available on phone during leave
                  </label>
                </div>

                {leaveBalance && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Available Balance:</strong> {leaveBalance.leave_balance} day(s)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseLeaveForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {loading ? 'Submitting...' : editingLeave ? 'Update Leave' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default ManagerCalendar;
