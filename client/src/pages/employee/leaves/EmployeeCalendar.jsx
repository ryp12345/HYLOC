import React, { useState, useEffect } from 'react';
import { getAllTickets } from '../../../api/ticketApi';
import { useAuth } from '../../../context/AuthContext';
import Notification from '../../../components/common/Notification';
import {
  applyLeave,
  getMyLeaves,
  getMyLeaveBalance,
  updateLeave,
  cancelLeave,
  requestLeaveChange,
  checkLeaveEligibility,
  getDepartmentColleagues
  , getDepartmentLeaves
} from '../../../api/leaveApi';

const EmployeeCalendar = ({ joinDate }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Leave management state
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Calendar department leaves (colleagues on leave)
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [selectedCalendarLeaves, setSelectedCalendarLeaves] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [showCalendarLeaveModal, setShowCalendarLeaveModal] = useState(false);
  const [showMyLeaveModal, setShowMyLeaveModal] = useState(false);
  const [selectedMyLeave, setSelectedMyLeave] = useState(null);

  // Ticket state
  const [tickets, setTickets] = useState([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState([]);

  // Form state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [showDateDetail, setShowDateDetail] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    from_date: '',
    to_date: '',
    leave_duration: 'Full Day',
    day_type: 'full',
    leave_type: 'Earned Leave',
    leave_reason: '',
    duration: 1,
    alternate_person: '',
    additional_alternate: '',
    available_on_phone: true
  });

  // Load data on component mount

  useEffect(() => {
    loadData();
    loadTickets();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const year = currentDate.getFullYear();

      // Load leaves for current year
      const leavesResponse = await getMyLeaves({ year });
      //console.log('My leaves loaded:', leavesResponse.data.data);
      setLeaves(leavesResponse.data.data || []);

      // Load leave balance
      const balanceResponse = await getMyLeaveBalance(year);
      setLeaveBalance(balanceResponse.data.data);

      // Check eligibility
      const eligibilityResponse = await checkLeaveEligibility();
      setEligibility(eligibilityResponse.data.data);

      // Load department colleagues
      const colleaguesResponse = await getDepartmentColleagues();
      // console.log('Colleagues response:', colleaguesResponse);
      // console.log('Colleagues data:', colleaguesResponse.data.data);
      // console.log('Colleagues count:', colleaguesResponse.data.data?.length);
      setColleagues(colleaguesResponse.data.data || []);

      // Load department leaves for calendar display
      try {
        const deptLeavesRes = await getDepartmentLeaves({ year });
        setCalendarLeaves(deptLeavesRes.data.data || []);
      } catch (err) {
        // ignore department leaves errors for now
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
      //console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load tickets for the user
  const loadTickets = async () => {
    try {
      const res = await getAllTickets();
      const all = res.data.data || [];
      // DEBUG: inspect tickets shape
      try {
        console.groupCollapsed('[EmployeeCalendar] fetched tickets sample');
        console.log('total fetched:', all.length);
        console.log('sample tickets (first 10):', all.slice(0, 10).map(t => ({ id: t.id, user_id: t.user_id, created_at: t.created_at, assigned_to: t.assigned_to })));
        console.groupEnd();
      } catch (e) {
        console.debug('Error while logging tickets sample', e);
      }

      const uid = Number(userId);
      const filtered = all.filter((ticket) => {
        const creatorId = Number(ticket.user_id ?? ticket.user?.id ?? ticket.userId ?? ticket.created_by ?? ticket.createdBy ?? NaN);
        const a = ticket.assigned_to;
        let assignedId = NaN;
        if (a != null) {
          if (typeof a === 'object') assignedId = Number(a.id ?? a.user_id ?? a.userId ?? NaN);
          else assignedId = Number(a);
        }

        return (!isNaN(creatorId) && creatorId === uid) || (!isNaN(assignedId) && assignedId === uid);
      });

      setTickets(filtered);
    } catch (err) {
      // Optionally set error
    }
  };
  // Get tickets for a specific date
  const getTicketsForDate = (date) => {
    if (!date) return [];
    const checkDate = toLocalDateOnly(date).toDateString();
    return tickets.filter(ticket => {
      const createdDate = new Date(ticket.created_at).toDateString();
      return createdDate === checkDate;
    });
  };

  // Open ticket modal for a date
  const openTicketModal = (date) => {
    const dayTickets = getTicketsForDate(date);
    setSelectedTickets(dayTickets);
    setShowTicketModal(true);
  };

  const closeTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTickets([]);
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    let updatedForm = {
      ...leaveForm,
      [name]: type === 'checkbox' ? checked : value
    };
    // Auto-calculate duration if from_date or to_date changes
    if (name === 'from_date' || name === 'to_date') {
      const from = new Date(name === 'from_date' ? value : updatedForm.from_date);
      const to = new Date(name === 'to_date' ? value : updatedForm.to_date);
      if (from && to && !isNaN(from) && !isNaN(to)) {
        const diff = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
        updatedForm.duration = diff > 0 ? diff : 1;
        // If dates differ, force day_type to 'full'
        if (updatedForm.from_date !== updatedForm.to_date) {
          updatedForm.day_type = 'full';
        }
      } else {
        updatedForm.duration = 1;
      }
    }
    // Set duration and leave_duration based on day_type
    if (name === 'day_type') {
      if (value === 'full') {
        updatedForm.duration = 1;
        updatedForm.leave_duration = 'Full Day';
      } else if (value === 'morning') {
        updatedForm.duration = 0.5;
        updatedForm.leave_duration = 'Morning Half';
      } else if (value === 'afternoon') {
        updatedForm.duration = 0.5;
        updatedForm.leave_duration = 'Afternoon Half';
      }
    }
    // Also, if from_date and to_date are the same, update leave_duration if day_type is not full
    if ((name === 'from_date' || name === 'to_date') && updatedForm.from_date === updatedForm.to_date) {
      if (updatedForm.day_type === 'morning') {
        updatedForm.leave_duration = 'Morning Half';
        updatedForm.duration = 0.5;
      } else if (updatedForm.day_type === 'afternoon') {
        updatedForm.leave_duration = 'Afternoon Half';
        updatedForm.duration = 0.5;
      } else {
        updatedForm.leave_duration = 'Full Day';
        updatedForm.duration = 1;
      }
    }
    setLeaveForm(updatedForm);
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

    const initialForm = {
      from_date: formattedDate,
      to_date: formattedDate,
      leave_duration: 'Full Day',
      leave_type: 'Earned Leave',
      leave_reason: '',
      duration: 1,
      alternate_person: '',
      additional_alternate: '',
      available_on_phone: true
    };
    // Calculate duration for initial values
    const from = new Date(initialForm.from_date);
    const to = new Date(initialForm.to_date);
    if (from && to && !isNaN(from) && !isNaN(to)) {
      initialForm.duration = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
    }
    setLeaveForm(initialForm);
    setEditingLeave(null);
    setShowLeaveForm(true);
  };

  // Open leave form for editing
  const openEditForm = (leave) => {
    // Format dates for input type="date"
    function parseToDateObj(dateStr) {
      if (!dateStr) return null;
      // If already yyyy-mm-dd, parse directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr);
      // If dd/mm/yyyy, convert
      const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [, dd, mm, yyyy] = match;
        return new Date(`${yyyy}-${mm}-${dd}`);
      }
      // Fallback: try Date parsing
      const d = new Date(dateStr);
      if (!isNaN(d)) return d;
      return null;
    }
    let duration = 1;
    const fromObj = parseToDateObj(leave.from_date);
    const toObj = parseToDateObj(leave.to_date);
    const formattedFrom = fromObj ? formatDateForInput(fromObj) : '';
    const formattedTo = toObj ? formatDateForInput(toObj) : '';
    if (fromObj && toObj) {
      duration = Math.round((toObj - fromObj) / (1000 * 60 * 60 * 24)) + 1;
    }
    setLeaveForm({
      from_date: formattedFrom,
      to_date: formattedTo,
      leave_duration: leave.leave_duration,
      leave_type: leave.leave_type || leave.type || 'Earned Leave',
      leave_reason: leave.leave_reason,
      duration,
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
      // If the leave belongs to the current user, open the quick "My Leave" modal
      if (isLeaveByCurrentUser(leave)) {
        setSelectedMyLeave(leave);
        setShowMyLeaveModal(true);
        return;
      }

      // Otherwise, show the detailed date modal
      setShowDateDetail(true);
    } else {
      // If no leave, directly open the form with this date
      const initialForm = {
        from_date: formatDateForInput(date),
        to_date: formatDateForInput(date),
        leave_duration: 'Full Day',
        leave_type: 'Earned Leave',
        leave_reason: '',
        duration: 1,
        alternate_person: '',
        additional_alternate: '',
        available_on_phone: true
      };
      const from = new Date(initialForm.from_date);
      const to = new Date(initialForm.to_date);
      if (from && to && !isNaN(from) && !isNaN(to)) {
        initialForm.duration = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
      }
      setLeaveForm(initialForm);
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
        showNotification('Leave request sent!', 'success');
      } else {
        // Create new leave
        const response = await applyLeave(leaveForm);
        if (response?.data?.data?.split) {
          const count = response?.data?.data?.records?.length || 2;
          window.alert(`Your leave was split into ${count} separate requests (Earned Leave / Leave without pay).`);
        }
        showNotification('Leave request sent!', 'success');
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

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
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

  // Request unlock for approved/rejected leave so approver can move it back to Pending
  const handleRequestLeaveChange = async (leave) => {
    if (!leave?.id) return;
    if (!window.confirm('Send request to approver to allow leave request change?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestLeaveChange(leave.id);
      showNotification('Leave request change success', 'success');
      handleCloseDateDetail();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request leave change');
      console.error('Error requesting leave change:', err);
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
    const result = leaves.find((leave) => {
      const fromDate = parseDateOnly(leave.from_date);
      const toDate = parseDateOnly(leave.to_date);
      if (!fromDate || !toDate) return false;

      const matches = checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
      if (matches) {
        //console.log('Leave match found:', { date: date.toDateString(), leave, checkTime, fromTime: fromDate.getTime(), toTime: toDate.getTime() });
      }
      return matches;
    });
    return result;
  };

  const handleCloseLeaveForm = () => {
    setShowLeaveForm(false);
    setSelectedDate(new Date());
  };

  const handleCloseDateDetail = () => {
    setShowDateDetail(false);
    setSelectedDate(new Date());
  };

  const closeCalendarLeaveModal = () => {
    setShowCalendarLeaveModal(false);
    setSelectedCalendarDate(null);
    setSelectedCalendarLeaves([]);
  };

  // Map stored identifier (usually EMPID) to a readable colleague label
  const getAlternateDisplay = (identifier) => {
    if (!identifier) return '';

    const idStr = String(identifier).trim();
    const match = (colleagues || []).find((c) => {
      if (!c) return false;
      if (c.empid && String(c.empid).trim() === idStr) return true;
      const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ').trim();
      return fullName && fullName === idStr;
    });

    if (!match) return idStr;

    const fullName = [match.firstname, match.lastname].filter(Boolean).join(' ').trim();
    return fullName || idStr;
  };

  const formatAlternate = (leave) => {
    const primary = getAlternateDisplay(leave.alternate_person || '');
    const additional = getAlternateDisplay(leave.additional_alternate || '');
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

  // Detect leave without pay robustly (handles case/format variations)
  const isLeaveWithoutPay = (leave) => {
    if (!leave) return false;
    const t = String(leave.leave_type || leave.type || '').toLowerCase();
    return t.includes('leave without pay');
  };

  // Detect duty leave robustly (handles case/format variations)
  const isDutyLeave = (leave) => {
    if (!leave) return false;
    const t = String(leave.leave_type || leave.type || '').toLowerCase();
    return t.includes('duty leave');
  };

  // Get team leaves for a specific date (Employee calendar - return empty array for now)
  const getTeamLeavesForDate = (date) => {
    if (!date) return [];
    const checkTime = toLocalDateOnly(date).getTime();
    const matching = (calendarLeaves || []).filter((leave) => {
      const fromDate = parseDateOnly(leave.from_date);
      const toDate = parseDateOnly(leave.to_date);
      if (!fromDate || !toDate) return false;
      return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
    });
    // Only show employees on leave (exclude hods etc.)
    return matching.filter((l) => l.user_role === 'Employee');
  };

  // Check if a leave belongs to the logged-in user (robust fallback)
  const isLeaveByCurrentUser = (leave) => {
    if (!leave || !user) return false;
    if (typeof leave.user_id !== 'undefined' && leave.user_id !== null && user.id) {
      return Number(leave.user_id) === Number(user.id);
    }
    if (leave.empid && user.empid) return String(leave.empid) === String(user.empid);
    if (leave.user_name && user.firstname) return String(leave.user_name).trim() === `${user.firstname} ${user.lastname}`.trim();
    return false;
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
  const entitlementTotal = parseFloat(leaveBalance?.leave_entitled ?? 0) + parseFloat(leaveBalance?.leaves_accumulated ?? 0);
  const availedTotal = parseFloat(leaveBalance?.leaves_availed ?? 0);
  const leaveWithoutPayDays = leaves
    .filter(l => isLeaveWithoutPay(l) && l.status !== 'Rejected' && l.status !== 'Cancelled')
    .reduce((sum, l) => sum + parseFloat(l.credited_days || 0), 0);
  const dutyLeaveDays = leaves
    .filter(l => isDutyLeave(l) && l.status !== 'Rejected' && l.status !== 'Cancelled')
    .reduce((sum, l) => sum + parseFloat(l.credited_days || l.duration || 0), 0);

  return (
    <div className="w-full space-y-6">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ show: false, message: '', type: '' })}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {/* Leave Details Cards */}
      {leaveBalance && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Details - {currentDate.getFullYear()}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
              <p className="text-sm opacity-90 mb-2">Balance</p>
              <p className="text-3xl font-bold">{Math.max(parseFloat(leaveBalance.leave_balance ?? 0), 0)}</p>
            </div>
            <div className="bg-gradient-to-r from-red-700 to-red-800 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Leave without pay</p>
              <p className="text-3xl font-bold">{Number(leaveWithoutPayDays.toFixed(1))}</p>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90 mb-2">Duty leave</p>
              <p className="text-3xl font-bold">{Number(dutyLeaveDays.toFixed(1))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Card */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded transition-colors ${viewMode === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded transition-colors ${viewMode === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded transition-colors ${viewMode === 'list'
                ? 'bg-blue-600 text-white'
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
              >
                &lt;
              </button>
              <h3 className="text-xl font-semibold text-gray-800 min-w-48 text-center">
                {formatMonthYear(currentDate)}
              </h3>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
              >
                &gt;
              </button>
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
              {monthDays.map((date, index) => {
                const leave = getLeaveForDate(date);
                const dayTickets = getTicketsForDate(date);
                const dayCalendarLeaves = getTeamLeavesForDate(date);
                const otherLeaves = (dayCalendarLeaves || []).filter(l => !isLeaveByCurrentUser(l));
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] p-2 rounded border-2 transition-all ${date === null
                      ? 'bg-gray-50 border-gray-200'
                      : isToday(date)
                        ? 'border-blue-600 bg-white'
                        : isSelectedDate(date)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      } ${isPastDate(date) ? 'opacity-60' : 'opacity-100'} ${date && (leave || dayTickets.length > 0) ? 'cursor-pointer' : date ? 'cursor-pointer' : ''}`}
                    onClick={() => date && handleDateClick(date)}
                  >
                    {date && (
                      <>
                        <div className="font-bold text-gray-800 text-sm mb-1">
                          {date.getDate()}
                        </div>
                        {isToday(date) && (
                          <div className="text-blue-600 text-xs font-italic">Today</div>
                        )}
                        {leave && (
                          <div className="mt-1">
                            <button
                              className={`inline-flex items-center gap-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm focus:outline-none ${String(leave.leave_type || '').toLowerCase().includes('leave without pay') ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                              title="Click to view/edit my leave"
                              aria-label="View my leave"
                              onClick={(e) => { e.stopPropagation(); setSelectedMyLeave(leave); setShowMyLeaveModal(true); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedMyLeave(leave); setShowMyLeaveModal(true); } }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                              <span className="text-[10px]">Me</span>
                            </button>
                          </div>
                        )}
                        {otherLeaves.length > 0 && (() => {
                          const leaveWithoutPayCount = (otherLeaves || []).filter(l => isLeaveWithoutPay(l)).length;
                          const earnedLeaveCount = (otherLeaves || []).length - leaveWithoutPayCount;
                          const total = otherLeaves.length;
                          const earnedPct = total > 0 ? Math.round((earnedLeaveCount / total) * 100) : 50;
                          const deptBadgeStyle = (earnedLeaveCount > 0 && leaveWithoutPayCount > 0) ? { background: `linear-gradient(to right, #3b82f6 ${earnedPct}%, #ef4444 ${earnedPct}%)` } : null;
                          const deptBadgeClass = (earnedLeaveCount > 0 && leaveWithoutPayCount === 0) ? 'bg-blue-600 hover:bg-blue-700' : (leaveWithoutPayCount > 0 && earnedLeaveCount === 0) ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700';
                          return (
                            <div className="mt-2">
                              <button
                                className={`inline-flex items-center gap-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm focus:outline-none ${deptBadgeClass}`}
                                style={deptBadgeStyle}
                                title="Dept. leaves"
                                aria-label={`View ${otherLeaves.length} dept leave${otherLeaves.length > 1 ? 's' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedCalendarDate(date); setSelectedCalendarLeaves(otherLeaves); setShowCalendarLeaveModal(true); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedCalendarDate(date); setSelectedCalendarLeaves(otherLeaves); setShowCalendarLeaveModal(true); } }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"></path></svg>
                                {otherLeaves.length >= 1 && (
                                  <span className="bg-white text-purple-700 text-[10px] font-semibold rounded-full px-1 py-0.5">{otherLeaves.length}</span>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                        {dayTickets.length > 0 && (
                          <div className="mt-2">
                            <button
                              className="inline-flex items-center gap-2 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm hover:bg-green-700 focus:outline-none"
                              title={`View ${dayTickets.length} ticket(s)`}
                              aria-label={`View ${dayTickets.length} ticket${dayTickets.length > 1 ? 's' : ''}`}
                              onClick={(e) => { e.stopPropagation(); openTicketModal(date); }}
                            >
                              <span aria-hidden="true" className="h-6 w-6 inline-flex items-center justify-center text-[24px]">🎫</span>
                              {dayTickets.length >= 1 && (
                                <span className="bg-white text-green-700 text-[10px] font-semibold rounded-full px-1 py-0.5">{dayTickets.length}</span>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {/* My Leave Quick Modal */}
              {showMyLeaveModal && selectedMyLeave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative">
                    <button
                      className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold"
                      onClick={() => { setShowMyLeaveModal(false); setSelectedMyLeave(null); }}
                    >
                      &times;
                    </button>
                    <h3 className="text-lg font-semibold mb-4">My Leave</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border rounded-lg">
                        <thead>
                          <tr className="bg-blue-600 text-white">
                            <th className="py-2 px-4 text-left">From</th>
                            <th className="py-2 px-4 text-left">To</th>
                            <th className="py-2 px-4 text-left">Duration</th>
                            <th className="py-2 px-4 text-left">Reason</th>
                            <th className="py-2 px-4 text-left">Leave Type</th>
                            <th className="py-2 px-4 text-left">Status</th>
                            <th className="py-2 px-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{formatFullDate(parseDateOnly(selectedMyLeave.from_date))}</td>
                            <td className="py-2 px-4">{formatFullDate(parseDateOnly(selectedMyLeave.to_date))}</td>
                            <td className="py-2 px-4">{selectedMyLeave.leave_duration || ''} ({selectedMyLeave.duration ?? selectedMyLeave.credited_days} day{(selectedMyLeave.duration ?? selectedMyLeave.credited_days) === 1 ? '' : 's'})</td>
                            <td className="py-2 px-4">{selectedMyLeave.leave_reason || '-'}</td>
                            <td className="py-2 px-4">{selectedMyLeave.leave_type ?? selectedMyLeave.type ?? (isLeaveWithoutPay(selectedMyLeave) ? 'Leave without pay' : '—')}</td>
                            <td className="py-2 px-4">
                              <span className={`px-3 py-1 rounded-full text-white text-sm ${getLeaveBadgeColor(selectedMyLeave.status)}`}>{selectedMyLeave.status}</span>
                            </td>
                            <td className="py-2 px-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => { if (selectedMyLeave.status !== 'Approved' && selectedMyLeave.status !== 'Rejected') { openEditForm(selectedMyLeave); setShowMyLeaveModal(false); } }}
                                  className={`p-2 text-white transition-colors duration-200 ${selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-blue-600 rounded-lg hover:bg-blue-700'}`}
                                  disabled={selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected'}
                                  title="Edit Leave"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => { if (selectedMyLeave.status !== 'Approved' && selectedMyLeave.status !== 'Rejected') { if (window.confirm('Are you sure you want to cancel this leave?')) { handleCancelLeave(selectedMyLeave.id); setShowMyLeaveModal(false); } } }}
                                  className={`p-2 text-white transition-colors duration-200 ${selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-red-500 rounded-lg hover:bg-red-600'}`}
                                  disabled={selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected'}
                                  title="Cancel Leave"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => { if (selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected') { handleRequestLeaveChange(selectedMyLeave); setShowMyLeaveModal(false); } }}
                                  className={`p-2 text-white transition-colors duration-200 ${selectedMyLeave.status === 'Approved' || selectedMyLeave.status === 'Rejected' ? 'bg-indigo-600 rounded-lg hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed rounded-lg'}`}
                                  disabled={selectedMyLeave.status !== 'Approved' && selectedMyLeave.status !== 'Rejected'}
                                  title="Notify approver"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                  </svg>
                                  <span className="sr-only">Notify</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {/* Ticket Modal */}
              {showTicketModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-5xl relative">
                    <button
                      className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold"
                      onClick={closeTicketModal}
                    >
                      &times;
                    </button>
                    <h3 className="text-lg font-semibold mb-4">Ticket(s) for {selectedTickets[0] ? new Date(selectedTickets[0].created_at).toLocaleDateString() : ''}</h3>
                    {selectedTickets.length === 0 ? (
                      <div className="text-center text-gray-500">No tickets found for this date.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-hidden rounded-t-lg">
                        <table className="min-w-full bg-white border">
                          <thead className="bg-blue-600 text-white">
                            <tr>
                              <th className="py-2 px-4 text-center">Title</th>
                              <th className="py-2 px-4 text-center">Description</th>
                              <th className="py-2 px-4 text-center">Category</th>
                              <th className="py-2 px-4 text-center">Priority</th>
                              <th className="py-2 px-4 text-center">Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTickets.map((ticket) => (
                              <tr key={ticket.id} className="border-b hover:bg-green-50">
                                <td className="py-2 px-4 text-center">{ticket.title}</td>
                                <td className="py-2 px-4 text-center">{ticket.description}</td>
                                <td className="py-2 px-4 text-center">{ticket.category}</td>
                                <td className="py-2 px-4 text-center">{ticket.priority}</td>
                                <td className="py-2 px-4 text-center">{ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {showCalendarLeaveModal && selectedCalendarDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
                    <button
                      className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold"
                      onClick={closeCalendarLeaveModal}
                    >
                      &times;
                    </button>
                    <h3 className="text-lg font-semibold mb-4">Leave List for {selectedCalendarDate ? formatFullDate(parseDateOnly(selectedCalendarDate)) : ''}</h3>
                    {selectedCalendarLeaves.length === 0 ? (
                      <div className="text-center text-gray-500">No leaves found for this date.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border rounded-lg">
                          <thead>
                            <tr className="bg-blue-600 text-white">
                              <th className="py-2 px-4 text-left">User</th>
                              <th className="py-2 px-4 text-left">Role</th>
                              <th className="py-2 px-4 text-left">From</th>
                              <th className="py-2 px-4 text-left">To</th>
                              <th className="py-2 px-4 text-left">Duration</th>
                              <th className="py-2 px-4 text-left">Type</th>
                              <th className="py-2 px-4 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedCalendarLeaves.map(l => (
                              <tr key={l.id} className={`border-t ${isLeaveWithoutPay(l) ? 'bg-red-50 border-l-4 border-red-600' : ''}`}>
                                <td className="py-2 px-4">{l.user_name}</td>
                                <td className="py-2 px-4">{l.user_role}</td>
                                <td className="py-2 px-4">{formatFullDate(parseDateOnly(l.from_date))}</td>
                                <td className="py-2 px-4">{formatFullDate(parseDateOnly(l.to_date))}</td>
                                <td className="py-2 px-4">{l.leave_duration || '-'} ({l.duration ?? l.credited_days ?? '-'} day{Number(l.duration ?? l.credited_days) === 1 ? '' : 's'})</td>
                                <td className="py-2 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${isLeaveWithoutPay(l) ? 'bg-red-600' : 'bg-blue-600'}`}>
                                    {l.leave_type || '—'}
                                  </span>
                                </td>
                                <td className="py-2 px-4"><span className={`px-2 py-1 rounded-full text-white text-xs ${getLeaveBadgeColor(l.status)}`}>{l.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              {weekDays.map((date) => {
                const dayCalendarLeaves = getTeamLeavesForDate(date);
                const otherLeaves = (dayCalendarLeaves || []).filter(l => !isLeaveByCurrentUser(l));
                return (
                  <div
                    key={date.toISOString()}
                    className={`min-h-[150px] p-3 rounded border-2 transition-all cursor-pointer ${isToday(date)
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
                    {otherLeaves.length > 0 && (
                      (() => {
                        const leaveWithoutPayCount = (otherLeaves || []).filter(l => isLeaveWithoutPay(l)).length;
                        const earnedLeaveCount = (otherLeaves || []).length - leaveWithoutPayCount;
                        const total = otherLeaves.length;
                        const earnedPct = total > 0 ? Math.round((earnedLeaveCount / total) * 100) : 50;
                        const deptBadgeStyle = (earnedLeaveCount > 0 && leaveWithoutPayCount > 0) ? { background: `linear-gradient(to right, #3b82f6 ${earnedPct}%, #ef4444 ${earnedPct}%)` } : null;
                        const deptBadgeClass = (earnedLeaveCount > 0 && leaveWithoutPayCount === 0) ? 'bg-blue-600 hover:bg-blue-700' : (leaveWithoutPayCount > 0 && earnedLeaveCount === 0) ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700';
                        return (
                          <div className="mt-2">
                            <button
                              className={`inline-flex items-center gap-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm focus:outline-none ${deptBadgeClass}`}
                              style={deptBadgeStyle}
                              title="Dept. leaves"
                              aria-label={`View ${otherLeaves.length} dept leave${otherLeaves.length > 1 ? 's' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedCalendarDate(date); setSelectedCalendarLeaves(otherLeaves); setShowCalendarLeaveModal(true); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedCalendarDate(date); setSelectedCalendarLeaves(otherLeaves); setShowCalendarLeaveModal(true); } }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"></path></svg>
                              {otherLeaves.length >= 1 && (
                                <span className="bg-white text-purple-700 text-[10px] font-semibold rounded-full px-1 py-0.5">{otherLeaves.length}</span>
                              )}
                            </button>
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">My Leaves</h3>
            {leaves.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No leaves applied yet
              </div>
            ) : (
              <div className="overflow-x-auto w-full max-w-3xl">
                <table className="min-w-full bg-white border rounded-lg shadow">
                  <thead>
                    <tr className="bg-blue-100 text-blue-800">
                      <th className="py-2 px-4 text-center">Status</th>
                      <th className="py-2 px-4 text-center">Duration</th>
                      <th className="py-2 px-4 text-center">Reason</th>
                      <th className="py-2 px-4 text-center">Alternate</th>
                      <th className="py-2 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="border-b hover:bg-blue-50">
                        <td className="py-2 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-white text-sm ${getLeaveBadgeColor(leave.status)}`}>{leave.status}</span>
                        </td>
                        <td className="py-2 px-4 text-center">
                          {leave.leave_duration} ({leave.duration || leave.credited_days} day{(leave.duration || leave.credited_days) === 1 ? '' : 's'})
                        </td>
                        <td className="py-2 px-4 text-center">
                          {leave.leave_reason}
                        </td>
                        <td className="py-2 px-4 text-center">
                          {formatAlternate(leave)}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                if (leave.status !== 'Approved' && leave.status !== 'Rejected') openEditForm(leave);
                              }}
                              className={`p-2 text-white transition-colors duration-200 ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-blue-600 rounded-lg hover:bg-blue-700'}`}
                              disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
                              title={(leave.status === 'Approved' || leave.status === 'Rejected') ? 'Cannot edit approved or rejected leave' : 'Edit leave'}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (leave.status !== 'Approved' && leave.status !== 'Rejected') handleCancelLeave(leave.id);
                              }}
                              className={`p-2 rounded ${(leave.status === 'Approved' || leave.status === 'Rejected') ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
                              disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
                              title={(leave.status === 'Approved' || leave.status === 'Rejected') ? 'Cannot cancel approved or rejected leave' : 'Cancel leave'}
                            >
                              {/* Cross SVG */}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

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
                      <span className={`px-3 py-1 rounded-full text-white text-sm ${getLeaveBadgeColor(leave.status)}`}>
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

                    {(leave.alternate_person || leave.approver_name) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Alternate Person:</p>
                          <p className="text-gray-800">{leave.alternate_person ? getAlternateDisplay(leave.alternate_person) : '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700">
                            {leave.status === 'Approved' ? 'Approved by:' : 'Rejected by:'}
                          </p>
                          <p className="text-gray-800">{leave.approver_name || '-'}</p>
                        </div>
                      </div>
                    )}

                    {leave.additional_alternate && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Additional Alternate:</p>
                        <p className="text-gray-800">{getAlternateDisplay(leave.additional_alternate)}</p>
                      </div>
                    )}

                    <div className="pt-4 space-y-2">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            if (leave.status !== 'Approved' && leave.status !== 'Rejected') {
                              openEditForm(leave);
                              handleCloseDateDetail();
                            }
                          }}
                          className={`p-2 text-white transition-colors duration-200 ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-blue-600 rounded-lg hover:bg-blue-700'}`}
                          disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
                          title={(leave.status === 'Approved' || leave.status === 'Rejected') ? 'Cannot edit approved or rejected leave' : 'Edit leave'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (leave.status !== 'Approved' && leave.status !== 'Rejected') {
                              if (window.confirm('Are you sure you want to cancel this leave?')) {
                                handleCancelLeave(leave.id);
                                handleCloseDateDetail();
                              }
                            }
                          }}
                          className={`p-2 text-white transition-colors duration-200 ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-red-500 rounded-lg hover:bg-red-600'}`}
                          disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
                          title={(leave.status === 'Approved' || leave.status === 'Rejected') ? 'Cannot cancel approved or rejected leave' : 'Cancel leave'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            if (leave.status === 'Approved' || leave.status === 'Rejected') {
                              handleRequestLeaveChange(leave);
                            }
                          }}
                          className={`px-4 py-2 rounded min-w-[160px] flex items-center justify-center gap-2 ${(leave.status === 'Approved' || leave.status === 'Rejected')
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            }`}
                          disabled={leave.status !== 'Approved' && leave.status !== 'Rejected'}
                          title={(leave.status === 'Approved' || leave.status === 'Rejected') ? 'Request approver to allow changes' : 'Available only for approved/rejected leave'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <span>Notify</span>
                        </button>
                      </div>
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

                <div className="grid grid-cols-12 gap-4 w-full items-start">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Date *</label>
                    <input
                      type="date"
                      name="from_date"
                      value={leaveForm.from_date}
                      readOnly
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-gray-100 cursor-not-allowed"
                      style={{ fontVariantNumeric: 'tabular-nums', minWidth: '10.5rem', maxWidth: '13rem' }}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Date *</label>
                    <input
                      type="date"
                      name="to_date"
                      value={leaveForm.to_date}
                      onChange={handleFormChange}
                      min={leaveForm.from_date}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      style={{ fontVariantNumeric: 'tabular-nums', minWidth: '10.5rem', maxWidth: '13rem' }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day Type</label>
                    <select
                      name="day_type"
                      value={leaveForm.day_type || 'full'}
                      onChange={handleFormChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      disabled={leaveForm.from_date !== leaveForm.to_date}
                    >
                      <option value="full">Full day</option>
                      <option value="morning">Morning half</option>
                      <option value="afternoon">Afternoon half</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="duration"
                      value={
                        leaveForm.duration === 0.5
                          ? '0.5'
                          : leaveForm.duration < 10
                            ? `0${leaveForm.duration}`
                            : leaveForm.duration
                      }
                      readOnly
                      className="w-20 px-2 py-2 border border-gray-300 rounded-lg bg-gray-100 focus:outline-none text-center"
                      style={{ minWidth: '3.5rem', maxWidth: '4.5rem' }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Note: Half-day leaves are limited to a single day
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="leave_type"
                        value="Earned Leave"
                        checked={leaveForm.leave_type === 'Earned Leave'}
                        onChange={handleFormChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Earned Leave</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="leave_type"
                        value="Duty Leave"
                        checked={leaveForm.leave_type === 'Duty Leave'}
                        onChange={handleFormChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Duty Leave</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leave *</label>
                  <textarea
                    name="leave_reason"
                    value={leaveForm.leave_reason}
                    onChange={handleFormChange}
                    required
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Please provide a reason for your leave..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="available_on_phone"
                      checked={leaveForm.available_on_phone}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Available on phone during leave
                    </label>
                  </div>

                  {leaveBalance && (
                    <div className="bg-blue-50 p-3 rounded-lg">
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
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
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

export default EmployeeCalendar;
