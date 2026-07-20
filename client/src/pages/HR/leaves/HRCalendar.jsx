import React, { useEffect, useMemo, useState } from 'react';
import {
	getAllLeaves,
	applyLeave,
	getMyLeaves,
	getMyLeaveBalance,
	updateLeave,
	cancelLeave,
	checkLeaveEligibility,
	getDepartmentColleagues
} from '../../../api/leaveApi';
import { getEntitlements } from '../../../api/leaveEntitlementApi';
import { getMyTickets, getAllTickets } from '../../../api/ticketApi';
import { getUsers } from '../../../api/userApi';
import { useAuth } from '../../../context/AuthContext';

const HRCalendar = ({ title = 'HR Leave Calendar' }) => {
	const { user } = useAuth();
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'list'
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [leaves, setLeaves] = useState([]);
	const [allOrgLeaves, setAllOrgLeaves] = useState([]);

	// Management's own leave management state
	const [myLeaves, setMyLeaves] = useState([]);
	const [leaveBalance, setLeaveBalance] = useState(null);
	const [selectedStaffBalance, setSelectedStaffBalance] = useState(null);
	const [eligibility, setEligibility] = useState(null);
	const [colleagues, setColleagues] = useState([]);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [selectedLeaveDate, setSelectedLeaveDate] = useState(null);
	const [selectedDateLeaves, setSelectedDateLeaves] = useState([]);

	// Form state for applying/editing own leaves
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
		user_id: '',
		available_on_phone: true
	});

	// Filter state
	const [showFilteredTable, setShowFilteredTable] = useState(false);
	const currentYear = new Date().getFullYear();
	const [filter, setFilter] = useState({
		from: '',
		to: '',
		year: currentYear,
		department: '',
		username: '',
	});
	const [currentPage, setCurrentPage] = useState(1);
	// Pagination: items per page for filtered results
	const itemsPerPage = 10;
	// Ticket state
	const [tickets, setTickets] = useState([]);
	const [usersById, setUsersById] = useState({});
	const [staffUsers, setStaffUsers] = useState([]);
	const [showTicketModal, setShowTicketModal] = useState(false);
	const [selectedTickets, setSelectedTickets] = useState([]);

	useEffect(() => {
		loadData();
		loadTickets();
	}, [currentDate]);

	useEffect(() => {
		loadData();
		loadTickets();
	}, [filter.year]);


	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const year = filter.year || currentYear;
			const response = await getAllLeaves({ year });
			const allLeaves = response.data.data || [];

			const pendingLeaves = allLeaves.filter((leave) => {
				if (leave.status !== 'Pending') return false;
				// HR should see all pending leaves across the organization
				if (isHrUser) return true;
				const role = leave.user_role;
				const duration = parseFloat(leave.credited_days);
				return (
					(role === 'HOD' || (role === 'Employee' && duration > 2))
				);
			});

			setLeaves(pendingLeaves);
			// Store all leaves for Leave List display (all statuses, all users)
			const currentYearLeaves = allLeaves.filter((leave) => {
				const fromDate = parseDateOnly(leave.from_date);
				return fromDate && fromDate.getFullYear() === year;
			});
			setAllOrgLeaves(currentYearLeaves);

			// Load management's own leaves
			try {
				const myLeavesResponse = await getMyLeaves({ year });
				setMyLeaves(myLeavesResponse.data.data || []);
			} catch (err) {
				console.error('Error loading my leaves:', err);
			}

			// Load leave balance
			try {
				const balanceResponse = await getMyLeaveBalance(year);
				setLeaveBalance(balanceResponse.data.data);
				setSelectedStaffBalance(null);
			} catch (err) {
				console.error('Error loading balance:', err);
			}

			// Check eligibility
			try {
				const eligibilityResponse = await checkLeaveEligibility();
				setEligibility(eligibilityResponse.data.data);
			} catch (err) {
				console.error('Error checking eligibility:', err);
			}

			// Load department colleagues
			try {
				const colleaguesResponse = await getDepartmentColleagues();
				setColleagues(colleaguesResponse.data.data || []);
			} catch (err) {
				console.error('Error loading colleagues:', err);
			}
		} catch (err) {
			setError(err.response?.data?.message || 'Failed to load pending leaves');
			console.error('Error loading pending leaves:', err);
		} finally {
			setLoading(false);
		}
	};

	const loadTickets = async () => {
		try {
			// Management view should show all tickets
			const [ticketsRes, usersRes] = await Promise.all([
				getAllTickets(),
				getUsers(),
			]);
			setTickets(ticketsRes.data.data || []);
			const users = usersRes?.data?.data || [];
			const map = {};
			const activeStaffUsers = users.filter((u) => u && u.id !== undefined && u.id !== null && String(u.status || '').toLowerCase() !== 'inactive');
			users.forEach((u) => {
				if (!u || u.id === undefined || u.id === null) return;
				const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.name || u.full_name || u.email || `User #${u.id}`;
				map[String(u.id)] = name;
			});
			setUsersById(map);
			setStaffUsers(activeStaffUsers);
		} catch (err) {
			// Optionally set error
		}
	};

	const roleNorm = String(user?.role || '').toLowerCase();
	const isManagementUser = roleNorm === 'management';
	const isHrUser = roleNorm === 'hr';
	const isPrivilegedUser = isManagementUser || isHrUser;

	const getRejectedByDisplayName = (ticket) => {
		if (!ticket || ticket.rejected_by === null || ticket.rejected_by === undefined || ticket.rejected_by === '') return '-';
		return usersById[String(ticket.rejected_by)] || `User #${ticket.rejected_by}`;
	};

	const getDateOnlyDisplayFromTimestamp = (value) => {
		if (!value) return '-';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '-';
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const getRejectedDateDisplay = (ticket) => {
		if (!ticket) return '-';
		const hasRejectionData = Boolean(ticket.rejected_by || ticket.rejected_by_reason || String(ticket.status || '').toLowerCase() === 'rejected');
		if (!hasRejectionData) return '-';
		// Prefer explicit rejected_date (from server) or updated_at when status is Rejected
		if (ticket.rejected_date) return getDateOnlyDisplayFromTimestamp(ticket.rejected_date);
		if (String(ticket.status || '').toLowerCase() === 'rejected') return getDateOnlyDisplayFromTimestamp(ticket.updated_at);
		const closedDate = getClosedDateDisplay(ticket);
		if (closedDate !== '-') return closedDate;
		return '-';
	};

	const getClosedDateDisplay = (ticket) => {
		if (!ticket) return '-';
		const st = String(ticket.status || '').toLowerCase();
		if (st === 'rejected') return '-NA-';
		if (st !== 'closed') return '-';
		return getDateOnlyDisplayFromTimestamp(ticket.updated_at);
	};

	const getRejectedReasonDisplay = (ticket) => {
		if (!ticket) return '-';
		const reason = ticket.rejected_by_reason !== undefined && ticket.rejected_by_reason !== null
			? String(ticket.rejected_by_reason).trim()
			: '';
		if (reason) return reason;
		if (ticket.rejected_by) return 'None Specified';
		return '-';
	};

	const getMonthDays = (date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();

		const days = [];
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push(null);
		}
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(year, month, day));
		}

		return days;
	};

	const getWeekDays = (date) => {
		const curr = new Date(date);
		const first = curr.getDate() - curr.getDay();
		const weekDays = [];
		for (let i = 0; i < 7; i++) {
			weekDays.push(new Date(curr.setDate(first + i)));
		}
		return weekDays;
	};

	const formatMonthYear = (date) => {
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	};

	const formatWeekRange = (startDate) => {
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 6);
		return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	};

	const formatDate = (date) => {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	const formatFullDate = (date) => {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const isToday = (date) => {
		const today = new Date();
		return date && date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear();
	};

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

	const getLeavesForDate = (date) => {
		if (!date) return [];
		const checkTime = toLocalDateOnly(date).getTime();
		return leaves.filter((leave) => {
			const fromDate = parseDateOnly(leave.from_date);
			const toDate = parseDateOnly(leave.to_date);
			if (!fromDate || !toDate) return false;

			return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
		});
	};

	const getTeamLeavesForDate = (date) => {
		if (!date) return [];
		const checkTime = toLocalDateOnly(date).getTime();
		return allOrgLeaves.filter((leave) => {
			const fromDate = parseDateOnly(leave.from_date);
			const toDate = parseDateOnly(leave.to_date);
			if (!fromDate || !toDate) return false;

			return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
		});
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

	const openLeaveModal = (date) => {
		const dayLeaves = getTeamLeavesForDate(date);
		const otherLeaves = (dayLeaves || []).filter(l => !isLeaveByCurrentUser(l));
		setSelectedLeaveDate(date);
		setSelectedDateLeaves(otherLeaves);
		setShowLeaveModal(true);
	};

	const closeLeaveModal = () => {
		setShowLeaveModal(false);
		setSelectedLeaveDate(null);
		setSelectedDateLeaves([]);
	};

	// Ticket helpers
	const getTicketsForDate = (date) => {
		if (!date) return [];
		const checkDate = toLocalDateOnly(date).toDateString();
		return tickets.filter(ticket => {
			if (!ticket || !ticket.created_at) return false;
			const createdDate = new Date(ticket.created_at).toDateString();
			return createdDate === checkDate;
		});
	};

	const openTicketModal = (date) => {
		const dayTickets = getTicketsForDate(date);
		setSelectedTickets(dayTickets);
		setShowTicketModal(true);
	};

	const closeTicketModal = () => {
		setShowTicketModal(false);
		setSelectedTickets([]);
	};

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
		return [match.firstname, match.lastname].filter(Boolean).join(' ').trim() || idStr;
	};

	const formatAlternate = (leave) => {
		const primary = getAlternateDisplay(leave.alternate_person || '');
		const additional = getAlternateDisplay(leave.additional_alternate || '');
		if (primary && additional) return `${primary}, ${additional}`;
		return primary || additional || '—';
	};

	const overlapsMonth = (leave) => {
		const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
		const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
		const fromDate = parseDateOnly(leave.from_date);
		const toDate = parseDateOnly(leave.to_date);
		if (!fromDate || !toDate) return false;
		return fromDate <= monthEnd && toDate >= monthStart;
	};

	// Management's own leave management functions
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
		if (name === 'user_id') {
			loadSelectedStaffBalance(value);
		}
	};

	const loadSelectedStaffBalance = async (userId) => {
		const resolvedUserId = Number(userId);
		if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
			setSelectedStaffBalance(null);
			return;
		}

		try {
			const year = filter.year || currentYear;
			const response = await getEntitlements(year);
			const balances = response.data || [];
			const match = balances.find((balance) => Number(balance.user_id) === resolvedUserId) || null;
			setSelectedStaffBalance(match);
		} catch (err) {
			console.error('Error loading selected staff balance:', err);
			setSelectedStaffBalance(null);
		}
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
			day_type: 'full',
			leave_type: hasLeaveBalance ? 'Earned Leave' : 'Leave without pay',
			leave_reason: '',
			duration: 1,
			alternate_person: '',
			additional_alternate: '',
			user_id: '',
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
			user_id: leave.user_id ?? '',
			available_on_phone: leave.available_on_phone !== false
		});
		setEditingLeave(leave);
		loadSelectedStaffBalance(leave.user_id);
		setShowLeaveForm(true);
	};

	// Handle date click to show details (for my own leaves)
	const handleDateClick = (date) => {
		setSelectedDate(date);
		const leave = getMyLeaveForDate(date);

		if (leave) {
			// If leave exists, show detail modal
			setShowDateDetail(true);
		} else {
			// If no leave, directly open the form with this date
			const initialForm = {
				from_date: formatDateForInput(date),
				to_date: formatDateForInput(date),
				leave_duration: 'Full Day',
				day_type: 'full',
				leave_type: hasLeaveBalance ? 'Earned Leave' : 'Leave without pay',
				leave_reason: '',
				duration: 1,
				alternate_person: '',
				additional_alternate: '',
				user_id: '',
				available_on_phone: true
			};
			const from = new Date(initialForm.from_date);
			const to = new Date(initialForm.to_date);
			if (from && to && !isNaN(from) && !isNaN(to)) {
				initialForm.duration = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
			}
			setLeaveForm(initialForm);
			setEditingLeave(null);
			setSelectedStaffBalance(null);
			setSelectedStaffBalance(null);
			setShowLeaveForm(true);
		}
	};

	// Submit leave application
	const handleSubmitLeave = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			if (isHrUser && !leaveForm.user_id) {
				throw new Error('Please select a staff member');
			}

			const payload = {
				...leaveForm,
				...(isHrUser && leaveForm.user_id ? { user_id: Number(leaveForm.user_id) } : {})
			};

			if (editingLeave) {
				// Update existing leave
				await updateLeave(editingLeave.id, payload);
			} else {
				// Create new leave
				const response = await applyLeave(payload);
				if (response?.data?.data?.split) {
					const count = response?.data?.data?.records?.length || 2;
					window.alert(`Your leave was split into ${count} separate requests (Earned Leave / Leave without pay).`);
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

	// Check if a date has my leave
	const getMyLeaveForDate = (date) => {
		if (!date) return null;

		const checkTime = toLocalDateOnly(date).getTime();
		return myLeaves.find((leave) => {
			const fromDate = parseDateOnly(leave.from_date);
			const toDate = parseDateOnly(leave.to_date);
			if (!fromDate || !toDate) return false;

			return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
		});
	};

	const handleCloseLeaveForm = () => {
		setShowLeaveForm(false);
		setSelectedDate(new Date());
	};

	const handleCloseDateDetail = () => {
		setShowDateDetail(false);
		setSelectedDate(new Date());
	};

	// State for all departments
	const [allDepartments, setAllDepartments] = useState([]);

	// Fetch all departments on mount
	useEffect(() => {
		const fetchDepartments = async () => {
			try {
				// Import the API dynamically to avoid top-level import issues
				const { getDepartments } = await import('../../../api/departmentApi');
				const response = await getDepartments();
				// Try multiple response structures
				const departments = response.data?.data || response.data || [];
				setAllDepartments(departments);
			} catch (err) {
				console.error('Error fetching departments:', err);
			}
		};
		fetchDepartments();
	}, []);

	// Build department options from allDepartments
	const departmentOptions = useMemo(() => {
		const options = allDepartments
			.map(d => {
				// Try different property names (name, department_name, department_name)
				return d.name || d.department_name || d.departmentName || '';
			})
			.filter(name => name) // Remove empty strings
			.sort();
		return options;
	}, [allDepartments]);

	// Filter all org leaves based on filter criteria
	const filteredOrgLeaves = React.useMemo(() => {
		let leaves = allOrgLeaves;
		if (filter.from) {
			leaves = leaves.filter(l => new Date(l.from_date) >= new Date(filter.from));
		}
		if (filter.to) {
			leaves = leaves.filter(l => new Date(l.to_date) <= new Date(filter.to));
		}
		if (filter.year) {
			leaves = leaves.filter(l => {
				const fromDate = parseDateOnly(l.from_date);
				return fromDate && fromDate.getFullYear() === Number(filter.year);
			});
		}
		if (filter.department && filter.department !== 'all') {
			leaves = leaves.filter(l => l.department_name === filter.department);
		}
		if (filter.username) {
			leaves = leaves.filter(l => (l.user_name || '').toLowerCase().includes(filter.username.toLowerCase()));
		}
		return leaves;
	}, [allOrgLeaves, filter]);

	// Pagination for filtered leaves
	const totalPages = Math.ceil(filteredOrgLeaves.length / itemsPerPage);
	const paginatedOrgLeaves = filteredOrgLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	// Format date helper
	const formatDateDisplay = (dateStr) => {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const monthDays = getMonthDays(currentDate);
	const weekDays = getWeekDays(currentDate);
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const entitlementTotal = parseFloat(leaveBalance?.leave_entitled ?? 0) + parseFloat(leaveBalance?.leaves_accumulated ?? 0);
	const availedTotal = parseFloat(leaveBalance?.leaves_availed ?? 0);
	const leaveWithoutPayDays = myLeaves
		.filter(l => isLeaveWithoutPay(l) && l.status !== 'Rejected' && l.status !== 'Cancelled')
		.reduce((sum, l) => sum + parseFloat(l.credited_days || 0), 0);
	const dutyLeaveDays = myLeaves
		.filter(l => isDutyLeave(l) && l.status !== 'Rejected' && l.status !== 'Cancelled')
		.reduce((sum, l) => sum + parseFloat(l.credited_days || l.duration || 0), 0);
	const effectiveBalance = (isHrUser && leaveForm.user_id) ? selectedStaffBalance : leaveBalance;
	const hasLeaveBalance = effectiveBalance && (parseFloat(effectiveBalance.leave_balance || 0) > 0 || parseFloat(effectiveBalance.leave_entitled || 0) > 0 || parseFloat(effectiveBalance.leaves_accumulated || 0) > 0);

	const monthLeaves = useMemo(() => {
		return leaves.filter(overlapsMonth);
	}, [leaves, currentDate]);

	return (
		<>
			<div className="w-full space-y-6">
				{error && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
						{error}
					</div>
				)}



				{/* Filter Section for All Org Leaves */}
				<div className="bg-white rounded-lg shadow-lg p-6">

					<table className="w-full mb-4 border rounded-lg overflow-hidden">
						<thead>
							<tr>
								<th colSpan="6" className="bg-blue-600 text-white text-lg font-semibold py-2 px-4 text-left">Leave Search Filter</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td className="py-2 px-2" colSpan="6">
									<div className="flex flex-row items-end gap-4 w-full flex-wrap">
										<div className="min-w-[150px] max-w-[200px] flex-1">
											<label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
											<input
												type="date"
												className="border rounded px-3 py-2 w-full"
												value={filter.from}
												onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setCurrentPage(1); }}
											/>
										</div>
										<div className="min-w-[150px] max-w-[200px] flex-1">
											<label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
											<input
												type="date"
												className="border rounded px-3 py-2 w-full"
												value={filter.to}
												onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setCurrentPage(1); }}
											/>
										</div>
										<div className="min-w-[100px] max-w-[120px] flex-1">
											<label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
											<select
												className="border rounded px-3 py-2 w-full text-left"
												value={filter.year}
												onChange={e => { setFilter(f => ({ ...f, year: Number(e.target.value) })); setCurrentPage(1); }}
											>
												{[currentYear - 1, currentYear, currentYear + 1].map(y => (
													<option key={y} value={y}>{y}</option>
												))}
											</select>
										</div>
										<div className="min-w-[160px] max-w-[200px] flex-1">
											<label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
											<select
												className="border rounded px-3 py-2 w-full"
												value={filter.department}
												onChange={e => { setFilter(f => ({ ...f, department: e.target.value })); setCurrentPage(1); }}
											>
												<option value="all">All Departments</option>
												{departmentOptions.map(dept => (
													<option key={dept} value={dept}>{dept}</option>
												))}
											</select>
										</div>
										<div className="min-w-[180px] max-w-[240px] flex-1">
											<label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
													<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z" />
													</svg>
												</span>
												<input
													type="text"
													className="border rounded px-3 py-2 pl-10 w-full"
													placeholder="Search by username"
													value={filter.username}
													onChange={e => { setFilter(f => ({ ...f, username: e.target.value })); setCurrentPage(1); }}
												/>
											</div>
										</div>
										<div className="flex flex-row items-end gap-2 ml-2">
											<button
												className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition"
												onClick={() => {
													if (filter.from || filter.to || filter.department !== 'all' || filter.username) {
														setShowFilteredTable(true);
														setCurrentPage(1);
													} else if (filter.department === 'all') {
														setShowFilteredTable(true);
														setCurrentPage(1);
													} else {
														setShowFilteredTable(false);
														alert('Please fill at least one filter to search.');
													}
												}}
											>
												Search
											</button>
											{showFilteredTable && (
												<button
													className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-300 transition"
													onClick={() => {
														setShowFilteredTable(false);
														setFilter({ from: '', to: '', year: currentYear, department: 'all', username: '' });
														setCurrentPage(1);
													}}
												>
													Reset
												</button>
											)}
										</div>
									</div>
								</td>
							</tr>
						</tbody>
					</table>

					{/* Filtered Table */}
					{showFilteredTable && (
						<div className="mt-6 overflow-hidden bg-white shadow-xl rounded-xl">
							<div className="overflow-x-auto overflow-hidden rounded-t-lg">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-blue-600">
										<tr>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">S.No</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Department</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date Range</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Duration</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Reason</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Action</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{loading ? (
											<tr><td colSpan="9" className="p-8 text-center text-gray-500">Loading...</td></tr>
										) : paginatedOrgLeaves.length === 0 ? (
											<tr><td colSpan="9" className="p-8 text-center text-gray-500">No leaves found matching the filters</td></tr>
										) : (
											paginatedOrgLeaves.map((leave, idx) => (
												<tr key={leave.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.user_name || '-'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.user_role || '-'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.department_name || '-'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDateDisplay(leave.from_date)} - {formatDateDisplay(leave.to_date)}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.credited_days} day(s)</td>
													<td className="px-6 py-4 text-sm text-gray-900">{leave.leave_reason || '-'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
														<span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${getLeaveBadgeColor(leave.status)}`}>
															{leave.status}
														</span>
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
														<div className="flex justify-center gap-2">
															<button
																onClick={() => openEditForm(leave)}
																className="p-2 text-white rounded-lg bg-blue-500 hover:bg-blue-600"
																title="Edit leave"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
																</svg>
															</button>
															<button
																onClick={() => { if (leave.status !== 'Approved' && leave.status !== 'Rejected') { if (window.confirm('Are you sure you want to cancel this leave?')) { handleCancelLeave(leave.id); } } }}
																className={`p-2 text-white rounded-lg ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
																disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
																title="Delete leave"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
																</svg>
															</button>
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="flex justify-end items-center gap-2 p-4">
									<button
										className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
										disabled={currentPage === 1}
										onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
									>Prev</button>
									<span className="text-sm">Page {currentPage} of {totalPages}</span>
									<button
										className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
										disabled={currentPage === totalPages}
										onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
									>Next</button>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="bg-white rounded-lg shadow-lg p-6">
					<div className="flex items-center justify-between mb-6">
						<div>
							<h2 className="text-2xl font-bold text-gray-800">{title}</h2>
							{/* <p className="text-sm text-gray-600">Pending leaves from Employees (&gt;2 days) and HODs</p> */}
						</div>

						<div className="flex items-center gap-4">
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
					</div>

					{loading ? (
						<div className="py-10 text-center text-gray-500">Loading...</div>
					) : (
						<>
							{viewMode === 'month' && (
								<div>
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
									{/* Ticket Modal */}
									{showTicketModal && (
										<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
											<div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
												<div className="p-6">
													<div className="flex items-center justify-between mb-4">
														<h3 className="text-xl font-bold text-gray-800">Tickets</h3>
														<button onClick={closeTicketModal} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
													</div>
													{selectedTickets.length === 0 ? (
														<div className="text-center text-gray-500 py-8">No tickets for this date</div>
													) : (
														<div className="overflow-x-auto">
															<table className="min-w-full text-sm border">
																<thead className="bg-blue-600 text-white">
																	<tr>
																		<th className="text-left px-4 py-2 border">Title</th>
																		<th className="text-left px-4 py-2 border">Description</th>
																		<th className="text-left px-4 py-2 border">Priority</th>
																		<th className="text-left px-4 py-2 border">Due Date</th>
																		{isPrivilegedUser && <th className="text-left px-4 py-2 border">Closed Date</th>}
																	</tr>
																</thead>
																<tbody>
																	{selectedTickets.map((t) => (
																		<tr key={t.id} className="border-t">
																			<td className="px-4 py-2 border">{t.title || '-'}</td>
																			<td className="px-4 py-2 border">{t.description || '-'}</td>
																			<td className="px-4 py-2 border">{t.priority || '-'}</td>
																			<td className="px-4 py-2 border">{t.due_date ? formatDateDisplay(t.due_date) : '-'}</td>
																			{isPrivilegedUser && <td className="px-4 py-2 border">{getClosedDateDisplay(t)}</td>}
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

									<div className="grid grid-cols-7 gap-1">
										{monthDays.map((date, index) => {
											const teamLeaves = getTeamLeavesForDate(date);
											const otherLeaves = (teamLeaves || []).filter(l => !isLeaveByCurrentUser(l));
											const myLeave = getMyLeaveForDate(date);
											return (
												<div
													key={index}
													className={`min-h-[110px] p-2 border rounded cursor-pointer ${date ? 'bg-white' : 'bg-gray-50'
														} ${isToday(date) ? 'border-emerald-500' : 'border-gray-200'}`}
													onClick={() => date && handleDateClick(date)}
												>
													{date && (
														<>
															<div className="text-sm font-semibold text-gray-700 mb-1">
																{date.getDate()}
															</div>
															{isToday(date) && (
																<div className="text-blue-600 text-xs font-italic">Today</div>
															)}
															{myLeave && (
																<div className="mt-1">
																	<button
																		className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm hover:bg-blue-700 focus:outline-none"
																		title="Click to view/edit my leave"
																		aria-label="View my leave"
																		onClick={(e) => { e.stopPropagation(); handleDateClick(date); }}
																		onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDateClick(date); } }}
																	>
																		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
																			<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
																		</svg>
																		<span className="text-[10px]">Me</span>
																	</button>
																</div>
															)}
														</>
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
																	title="Org. leaves"
																	aria-label={`View ${otherLeaves.length} org leave${otherLeaves.length > 1 ? 's' : ''}`}
																	onClick={(e) => { e.stopPropagation(); openLeaveModal(date); }}
																	onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openLeaveModal(date); } }}
																>
																	<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z" /></svg>
																	{otherLeaves.length >= 1 && (
																		<span className="bg-white text-purple-700 text-[10px] font-semibold rounded-full px-1 py-0.5">{otherLeaves.length}</span>
																	)}
																</button>
															</div>
														);
													})()}
													{(() => {
														const dayTickets = getTicketsForDate(date);
														return dayTickets.length > 0 ? (
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
														) : null;
													})()}
												</div>
											);
										})}
									</div>
								</div>
							)}

							{viewMode === 'week' && (
								<div>
									<div className="mb-6 text-center">
										<h3 className="text-xl font-semibold text-gray-800">
											{formatWeekRange(weekDays[0])}
										</h3>
									</div>
									<div className="grid grid-cols-7 gap-2">
										{weekDays.map((date, index) => {
											const teamLeaves = getTeamLeavesForDate(date);
											const otherLeaves = (teamLeaves || []).filter(l => !isLeaveByCurrentUser(l));
											const myLeave = getMyLeaveForDate(date);
											return (
												<div key={index} className="border rounded p-3">
													<div className="text-sm font-semibold text-gray-700 mb-2">
														{formatDate(date)}
													</div>
													<div className="space-y-1">
														{myLeave && (
															<div>
																<button
																	className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm hover:bg-blue-700 focus:outline-none"
																	title="Click to view/edit my leave"
																	aria-label="View my leave"
																	onClick={(e) => { e.stopPropagation(); handleDateClick(date); }}
																	onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDateClick(date); } }}
																>
																	<span className="text-sm">👤</span>
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
																<div>
																	<button
																		className={`inline-flex items-center gap-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm focus:outline-none ${deptBadgeClass}`}
																		style={deptBadgeStyle}
																		title="Org. leaves"
																		aria-label={`View ${otherLeaves.length} org leave${otherLeaves.length > 1 ? 's' : ''}`}
																		onClick={(e) => { e.stopPropagation(); openLeaveModal(date); }}
																		onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openLeaveModal(date); } }}
																	>
																		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"></path></svg>
																		{otherLeaves.length >= 1 && (
																			<span className="bg-white text-purple-700 text-[10px] font-semibold rounded-full px-1 py-0.5">{otherLeaves.length}</span>
																		)}
																	</button>
																</div>
															);
														})()}
														{(() => {
															const dayTickets = getTicketsForDate(date);
															return dayTickets.length > 0 ? (
																<div>
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
															) : null;
														})()}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{viewMode === 'list' && (
								<div>
									<div className="mb-6">
										<h3 className="text-xl font-semibold text-gray-800 mb-4">
											My Leaves
										</h3>
										{myLeaves.length === 0 ? (
											<div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
												No leaves applied yet
											</div>
										) : (
											<div className="overflow-x-auto mb-8">
												<table className="min-w-full bg-white border rounded-lg shadow">
													<thead>
														<tr className="bg-blue-100 text-blue-800">
															<th className="py-2 px-4 text-center">Status</th>
															<th className="py-2 px-4 text-center">Duration</th>
															<th className="py-2 px-4 text-center">Reason</th>
															<th className="py-2 px-4 text-center">Action</th>
														</tr>
													</thead>
													<tbody>
														{myLeaves.map((leave) => (
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
																	<div className="flex justify-center gap-2">
																		<button
																			onClick={() => openEditForm(leave)}
																			className="p-2 rounded bg-blue-500 text-white hover:bg-blue-600"
																			title="Edit leave"
																		>
																			<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
																			</svg>
																		</button>
																		<button
																			onClick={() => handleCancelLeave(leave.id)}
																			className="p-2 rounded bg-red-500 text-white hover:bg-red-600"
																			title="Cancel leave"
																		>
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

									<div className="mb-6 text-center">
										<h3 className="text-xl font-semibold text-gray-800">
											Pending Leaves in {formatMonthYear(currentDate)}
										</h3>
									</div>
									{monthLeaves.length === 0 ? (
										<div className="text-center text-gray-500">No pending leaves for this month</div>
									) : (
										<div className="space-y-3">
											{monthLeaves.map((leave) => (
												<div key={leave.id} className="border rounded p-4 bg-white">
													<div className="flex items-center justify-between mb-2">
														<div className="font-semibold text-gray-800">
															{leave.user_name} ({leave.user_role})
														</div>
														<span className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${getLeaveBadgeColor('Pending')}`}>
															Pending
														</span>
													</div>
													<div className="text-sm text-gray-600">
														{formatFullDate(parseDateOnly(leave.from_date))} → {formatFullDate(parseDateOnly(leave.to_date))}
													</div>
													<div className="text-sm text-gray-600">
														Duration: {leave.credited_days} day(s)
													</div>
													<div className="text-sm text-gray-600">
														Reason: {leave.leave_reason}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>

				{/* Date Detail Modal - For viewing my leave details */}
				{showDateDetail && selectedDate && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full">
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-xl font-bold text-gray-800">
										My Leave
									</h3>
									<button
										onClick={handleCloseDateDetail}
										className="text-gray-500 hover:text-gray-700 text-2xl"
									>
										×
									</button>
								</div>

								{(() => {
									const leave = getMyLeaveForDate(selectedDate);
									return leave ? (

										<div className="overflow-x-auto">
											<table className="min-w-full bg-white border rounded-lg">
												<thead>
													<tr className="bg-blue-600 text-white">
														<th className="py-2 px-4 text-left">From</th>
														<th className="py-2 px-4 text-left">To</th>
														<th className="py-2 px-4 text-left">Duration</th>
														<th className="py-2 px-4 text-left">Reason</th>
														<th className="py-2 px-4 text-left">Leave Type</th>
														<th className="py-2 px-4 text-center">Action</th>
													</tr>
												</thead>
												<tbody>
													<tr className="border-b hover:bg-gray-50">
														<td className="py-2 px-4">{formatFullDate(parseDateOnly(leave.from_date))}</td>
														<td className="py-2 px-4">{formatFullDate(parseDateOnly(leave.to_date))}</td>
														<td className="py-2 px-4">{leave.leave_duration || ''} ({leave.duration ?? leave.credited_days} day{(leave.duration ?? leave.credited_days) === 1 ? '' : 's'})</td>
														<td className="py-2 px-4">{leave.leave_reason || '-'}</td>
														<td className="py-2 px-4">{leave.leave_type ?? leave.type ?? (isLeaveWithoutPay(leave) ? 'Leave without pay' : '—')}</td>
														<td className="py-2 px-4 text-center">
															<div className="flex justify-center gap-2">
																<button
																	onClick={() => { if (leave.status !== 'Approved' && leave.status !== 'Rejected') { openEditForm(leave); handleCloseDateDetail(); } }}
																	className={`p-2 text-white transition-colors duration-200 ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-blue-600 rounded-lg hover:bg-blue-700'}`}
																	disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
																	title="Edit Leave"
																>
																	<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																	</svg>
																</button>
																<button
																	onClick={() => { if (leave.status !== 'Approved' && leave.status !== 'Rejected') { if (window.confirm('Are you sure you want to cancel this leave?')) { handleCancelLeave(leave.id); handleCloseDateDetail(); } } }}
																	className={`p-2 text-white transition-colors duration-200 ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed rounded-lg' : 'bg-red-500 rounded-lg hover:bg-red-600'}`}
																	disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
																	title="Cancel Leave"
																>
																	<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
																	</svg>
																</button>
															</div>
														</td>
													</tr>
												</tbody>
											</table>
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

									{isHrUser && (
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">Staff *</label>
											<select
												name="user_id"
												value={leaveForm.user_id || ''}
												onChange={handleFormChange}
												required
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-white"
											>
												<option value="">Select staff member</option>
												{staffUsers.map((staff) => (
													<option key={staff.id} value={staff.id}>
														{`${staff.firstname || ''} ${staff.lastname || ''}`.trim() || staff.name || staff.full_name || staff.email || `User #${staff.id}`}
													</option>
												))}
											</select>
										</div>
									)}

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
										<div className="flex flex-wrap gap-4 items-end">
											<label className={`inline-flex items-center gap-2 ${!hasLeaveBalance ? 'opacity-50 cursor-not-allowed' : ''}`}>
												<input
													type="radio"
													name="leave_type"
													value="Earned Leave"
													checked={leaveForm.leave_type === 'Earned Leave'}
													onChange={handleFormChange}
													disabled={!hasLeaveBalance}
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
											{!hasLeaveBalance && (
												<label className="inline-flex items-center gap-2">
													<input
														type="radio"
														name="leave_type"
														value="Leave without pay"
														checked={leaveForm.leave_type === 'Leave without pay'}
														onChange={handleFormChange}
														className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
													/>
													<span className="text-sm text-gray-700">Leave without pay</span>
												</label>
											)}
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

										<div className="bg-blue-50 p-3 rounded-lg">
											<p className="text-sm text-gray-700">
												<strong>Available Balance:</strong> {(selectedStaffBalance?.leave_balance ?? leaveBalance?.leave_balance) ?? 'N/A'} day(s)
											</p>
										</div>
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

				{showLeaveModal && selectedLeaveDate && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
						<div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
							<div className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-xl font-bold text-gray-800">
										Leave Details - {formatFullDate(selectedLeaveDate)}
									</h3>
									<button
										onClick={closeLeaveModal}
										className="text-gray-500 hover:text-gray-700 text-2xl"
									>
										×
									</button>
								</div>

								{selectedDateLeaves.length === 0 ? (
									<div className="text-center text-gray-500 py-8">No leaves for this date</div>
								) : (
									<div className="overflow-x-auto">
										<table className="min-w-full text-sm border">
											<thead className="bg-blue-600 text-white">
												<tr>
													<th className="text-left px-4 py-2 border">User Name</th>
													<th className="text-left px-4 py-2 border">Role</th>
													<th className="text-left px-4 py-2 border">From Date</th>
													<th className="text-left px-4 py-2 border">To Date</th>
													<th className="text-left px-4 py-2 border">Leave Reason</th>
													<th className="text-left px-4 py-2 border">Type</th>
													<th className="text-left px-4 py-2 border">Status</th>
													<th className="text-left px-4 py-2 border">Action</th>
												</tr>
											</thead>
											<tbody>
												{selectedDateLeaves.map((leave) => (
													<tr key={leave.id} className={`border-t ${isLeaveWithoutPay(leave) ? 'bg-red-50 border-l-4 border-red-600' : ''}`}>
														<td className="px-4 py-2 border">{leave.user_name}</td>
														<td className="px-4 py-2 border">{leave.user_role || '—'}</td>
														<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.from_date))}</td>
														<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.to_date))}</td>
														<td className="px-4 py-2 border">{leave.leave_reason || '—'}</td>
														<td className="px-4 py-2 border">
															<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${isLeaveWithoutPay(leave) ? 'bg-red-600' : 'bg-blue-600'}`}>
																{leave.leave_type || '—'}
															</span>
														</td>
														<td className="px-4 py-2 border">
															<span className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${getLeaveBadgeColor(leave.status)}`}>
																{leave.status}
															</span>
														</td>
														<td className="px-4 py-2 border">
															<div className="flex justify-center gap-2">
																<button
																	onClick={() => { openEditForm(leave); closeLeaveModal(); }}
																	className="p-2 text-white rounded-lg bg-blue-500 hover:bg-blue-600"
																	title="Edit leave"
																>
																	<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
																	</svg>
																</button>
																<button
																	onClick={() => { if (leave.status !== 'Approved' && leave.status !== 'Rejected') { if (window.confirm('Are you sure you want to cancel this leave?')) { handleCancelLeave(leave.id); } } }}
																	className={`p-2 text-white rounded-lg ${leave.status === 'Approved' || leave.status === 'Rejected' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
																	disabled={leave.status === 'Approved' || leave.status === 'Rejected'}
																	title="Delete leave"
																>
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
						</div>
					</div>
				)}
			</div>
		</>
	);
};

export default HRCalendar;
