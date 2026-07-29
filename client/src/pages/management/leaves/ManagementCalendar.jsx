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
import { getMyTickets, getAllTickets } from '../../../api/ticketApi';
import { getUsers } from '../../../api/userApi';
import { useAuth } from '../../../context/AuthContext';

const ManagementCalendar = ({ title = 'Management Calendar' }) => {
	const { user } = useAuth();
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'list'
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [leaves, setLeaves] = useState([]);
	const [allOrgLeaves, setAllOrgLeaves] = useState([]);
	
	// Management's own leave management state
	const [myLeaves, setMyLeaves] = useState([]);
	const [leaveBalance, setLeaveBalance] = useState(null);
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
				const role = leave.user_role;
				const duration = parseFloat(leave.credited_days);
				return (
					leave.status === 'Pending' &&
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
			users.forEach((u) => {
				if (!u || u.id === undefined || u.id === null) return;
				const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.name || u.full_name || u.email || `User #${u.id}`;
				map[String(u.id)] = name;
			});
			setUsersById(map);
		} catch (err) {
			// Optionally set error
		}
	};

	const roleNorm = String(user?.role || '').toLowerCase();
	const isManagementUser = roleNorm === 'management';

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

 	const getClosedDateDisplay = (ticket) => {
 		if (!ticket) return '-';
 		const st = String(ticket.status || '').toLowerCase();
 		if (st === 'rejected') return '-NA-';
 		if (st !== 'closed') return '-';
 		return getDateOnlyDisplayFromTimestamp(ticket.updated_at);
 	};

 	const getAssigneeDisplay = (ticket) => {
 		const ids = Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids : [];
 		if (!ids.length) return '-';
 		return ids.map(id => usersById[String(id)] || `User #${id}`).join(', ');
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
			year: 'numeric',
			month: 'short',
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
 		if (date instanceof Date) {
 			return new Date(date.getFullYear(), date.getMonth(), date.getDate());
 		}
 		const d = new Date(date);
 		if (Number.isNaN(d.getTime())) return null;
 		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
 	};

 	const getLeavesForDate = (date) => {
 		if (!date) return [];
 		const localDate = toLocalDateOnly(date);
 		if (!localDate) return [];
 		const checkTime = localDate.getTime();
 		return leaves.filter((leave) => {
 			const fromDate = parseDateOnly(leave.from_date);
 			const toDate = parseDateOnly(leave.to_date);
 			if (!fromDate || !toDate) return false;

 			return checkTime >= fromDate.getTime() && checkTime <= toDate.getTime();
 		});
 	};

 	const getTeamLeavesForDate = (date) => {
 		if (!date) return [];
 		const localDate = toLocalDateOnly(date);
 		if (!localDate) return [];
 		const checkTime = localDate.getTime();
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
 		const localDate = toLocalDateOnly(date);
 		if (!localDate) return [];
 		const checkDate = localDate.toDateString();
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
			} else {
				// Create new leave
				const response = await applyLeave(leaveForm);
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
 		const localDate = toLocalDateOnly(date);
 		if (!localDate) return null;
 		const checkTime = localDate.getTime();
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

	const monthLeaves = useMemo(() => {
		return leaves.filter(overlapsMonth);
	}, [leaves, currentDate]);

	return (
		<>
		<div className="w-full space-y-6 bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
			{error && (
				<div className="rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">
					{error}
				</div>
			)}
			
			{/* Leave Details Cards */}
			{leaveBalance && (
				<div>
					<h3 className="mb-4 text-lg font-semibold text-[color:var(--text-primary)]">My Leave Details - {currentYear}</h3>
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

		{/* Filter Section for All Org Leaves */}
		<div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
			
			<table className="w-full mb-4 border rounded-lg overflow-hidden">
				<thead>
					<tr>
						<th colSpan="6" className="bg-[color:var(--accent)] px-4 py-2 text-left text-lg font-semibold text-white">Leave Search Filter</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td className="py-2 px-2" colSpan="6">
							<div className="flex flex-row items-end gap-4 w-full flex-wrap">
								<div className="min-w-[150px] max-w-[200px] flex-1">
									<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">From Date</label>
									<input 
										type="date" 
										className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]" 
										value={filter.from} 
										onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setCurrentPage(1); }}
									/>
								</div>
								<div className="min-w-[150px] max-w-[200px] flex-1">
									<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">To Date</label>
									<input 
										type="date" 
										className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]" 
										value={filter.to} 
										onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setCurrentPage(1); }}
									/>
								</div>
								<div className="min-w-[100px] max-w-[120px] flex-1">
									<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Year</label>
									<select
										className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left text-[color:var(--text-primary)]"
										value={filter.year}
										onChange={e => { setFilter(f => ({ ...f, year: Number(e.target.value) })); setCurrentPage(1); }}
									>
										{[currentYear - 1, currentYear, currentYear + 1].map(y => (
											<option key={y} value={y}>{y}</option>
										))}
									</select>
								</div>
								<div className="min-w-[160px] max-w-[200px] flex-1">
									<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Department</label>
									<select 
										className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]" 
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
									<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Username</label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
											<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z" />
											</svg>
										</span>
										<input 
											type="text" 
											className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 pl-10 text-[color:var(--text-primary)]" 
											placeholder="Search by username" 
											value={filter.username} 
											onChange={e => { setFilter(f => ({ ...f, username: e.target.value })); setCurrentPage(1); }}
										/>
									</div>
								</div>
								<div className="flex flex-row items-end gap-2 ml-2">
									<button
										className="rounded bg-[color:var(--accent)] px-6 py-2 font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
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
											className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 font-semibold text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
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
				<div className="mt-6 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
										<div className="overflow-x-auto overflow-hidden rounded-t-lg">
						<table className="min-w-full divide-y divide-[color:var(--border)]">
							<thead className="bg-[color:var(--accent)]">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">S.No</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Department</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date Range</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Duration</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Reason</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
								{loading ? (
									<tr><td colSpan="8" className="p-8 text-center text-[color:var(--text-secondary)]">Loading...</td></tr>
								) : paginatedOrgLeaves.length === 0 ? (
									<tr><td colSpan="8" className="p-8 text-center text-[color:var(--text-secondary)]">No leaves found matching the filters</td></tr>
								) : (
									paginatedOrgLeaves.map((leave, idx) => (
										<tr key={leave.id} className={`${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]/60'} transition-colors duration-150 hover:bg-[color:var(--surface-hover)]`}>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.user_name || '-'}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.user_role || '-'}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.department_name || '-'}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{formatDateDisplay(leave.from_date)} - {formatDateDisplay(leave.to_date)}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.credited_days} day(s)</td>
											<td className="px-6 py-4 text-sm text-[color:var(--text-primary)]">{leave.leave_reason || '-'}</td>
											<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">
												<span className={`px-3 py-1 rounded-full text-xs font-semibold ${
													leave.status === 'Pending' ? 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]' :
													leave.status === 'Approved' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' :
													'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
												}`}>
													{leave.status}
												</span>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-end gap-2 p-4">
							<button
								className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
								disabled={currentPage === 1}
								onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
							>Prev</button>
							<span className="text-sm text-[color:var(--text-secondary)]">Page {currentPage} of {totalPages}</span>
							<button
								className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
							>Next</button>
						</div>
					)}
				</div>
			)}
		</div>

			<div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold text-[color:var(--text-primary)]">{title}</h2>
						{/* <p className="text-sm text-gray-600">Pending leaves from Employees (&gt;2 days) and HODs</p> */}
					</div>

					<div className="flex items-center gap-4">
						<div className="flex gap-2 rounded-lg bg-[color:var(--surface-hover)] p-1">
							<button
								onClick={() => setViewMode('month')}
								className={`px-4 py-2 rounded transition-colors ${
									viewMode === 'month'
										? 'bg-[color:var(--accent)] text-white'
										: 'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
								}`}
							>
								Month
							</button>
							<button
								onClick={() => setViewMode('week')}
								className={`px-4 py-2 rounded transition-colors ${
									viewMode === 'week'
										? 'bg-[color:var(--accent)] text-white'
										: 'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
								}`}
							>
								Week
							</button>
							<button
								onClick={() => setViewMode('list')}
								className={`px-4 py-2 rounded transition-colors ${
									viewMode === 'list'
										? 'bg-[color:var(--accent)] text-white'
										: 'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
								}`}
							>
								List
							</button>
						</div>
					</div>
				</div>

				{loading ? (
					<div className="py-10 text-center text-[color:var(--text-secondary)]">Loading...</div>
				) : (
					<>
						{viewMode === 'month' && (
							<div>
								<div className="mb-6 flex items-center justify-center gap-4">
									<button
										onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
										className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-lg font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
									>
										&lt;
									</button>
									<h3 className="min-w-48 text-center text-xl font-semibold text-[color:var(--text-primary)]">
										{formatMonthYear(currentDate)}
									</h3>
									<button
										onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
										className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-lg font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
									>
										&gt;
									</button>
								</div>

								<div className="grid grid-cols-7 gap-1 mb-2">
									{dayNames.map((day) => (
										<div
											key={day}
											className="rounded bg-[color:var(--accent-soft)] py-2 text-center font-semibold text-[color:var(--accent)]"
										>
											{day}
										</div>
									))}
								</div>
					{/* Ticket Modal */}
					{showTicketModal && (
						<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
							<div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
								<div className="p-6">
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-xl font-bold text-[color:var(--text-primary)]">Tickets</h3>
										<button onClick={closeTicketModal} className="text-2xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">×</button>
									</div>
									{selectedTickets.length === 0 ? (
										<div className="py-8 text-center text-[color:var(--text-secondary)]">No tickets for this date</div>
									) : (
										<div className="overflow-x-auto">
											<table className="min-w-full text-sm border">
												<thead className="bg-blue-600 text-white">
													<tr>
														<th className="text-left px-4 py-2 border">S.No</th>
														<th className="text-left px-4 py-2 border">Title</th>
														<th className="text-left px-4 py-2 border">Description</th>
														<th className="text-left px-4 py-2 border">Priority</th>
														<th className="text-left px-4 py-2 border">Assigned To</th>
														<th className="text-left px-4 py-2 border">Due Date</th>
														{isManagementUser && <th className="text-left px-4 py-2 border">Closed Date</th>}
													</tr>
												</thead>
												<tbody>
													{selectedTickets.map((t, idx) => (
														<tr key={t.id} className="border-t">
															<td className="px-4 py-2 border">{idx + 1}</td>
															<td className="px-4 py-2 border">{t.title || '-'}</td>
															<td className="px-4 py-2 border">{t.description || '-'}</td>
															<td className="px-4 py-2 border">{t.priority || '-'}</td>
															<td className="px-4 py-2 border">{getAssigneeDisplay(t)}</td>
															<td className="px-4 py-2 border">{t.due_date ? formatDateDisplay(t.due_date) : '-'}</td>
															{isManagementUser && <td className="px-4 py-2 border">{getClosedDateDisplay(t)}</td>}
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
												className={`min-h-[110px] cursor-pointer rounded border p-2 ${
													date ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]'
												} ${isToday(date) ? 'border-[color:var(--success)]' : 'border-[color:var(--border)]'}`}
												onClick={() => date && handleDateClick(date)}
											>
												{date && (
													<>
														<div className="mb-1 text-sm font-semibold text-[color:var(--text-primary)]">
															{date.getDate()}
														</div>
														{isToday(date) && (
															<div className="text-xs italic text-[color:var(--accent)]">Today</div>
														)}
														{myLeave && (
															<div className="mt-1">
																<button
																	className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm focus:outline-none hover:bg-[color:var(--accent-hover)]"
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
																													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"/></svg>
																													{otherLeaves.length >= 1 && (
																														<span className="rounded-full bg-[color:var(--surface)] px-1 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">{otherLeaves.length}</span>
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
																className="inline-flex items-center gap-2 rounded-full bg-[color:var(--success)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm focus:outline-none hover:opacity-90"
																title={`View ${dayTickets.length} ticket(s)`}
																aria-label={`View ${dayTickets.length} ticket${dayTickets.length > 1 ? 's' : ''}`}
																onClick={(e) => { e.stopPropagation(); openTicketModal(date); }}
															>
																	<span aria-hidden="true" className="h-6 w-6 inline-flex items-center justify-center text-[24px]">🎫</span>
																{dayTickets.length >= 1 && (
																	<span className="rounded-full bg-[color:var(--surface)] px-1 py-0.5 text-[10px] font-semibold text-[color:var(--success)]">{dayTickets.length}</span>
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
										<h3 className="text-xl font-semibold text-[color:var(--text-primary)]">
										{formatWeekRange(weekDays[0])}
									</h3>
								</div>
								<div className="grid grid-cols-7 gap-2">
									{weekDays.map((date, index) => {
										const teamLeaves = getTeamLeavesForDate(date);
										const otherLeaves = (teamLeaves || []).filter(l => !isLeaveByCurrentUser(l));
										const myLeave = getMyLeaveForDate(date);
										return (
											<div key={index} className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
												<div className="mb-2 text-sm font-semibold text-[color:var(--text-primary)]">
													{formatDate(date)}
												</div>
												<div className="space-y-1">
													{myLeave && (
														<div>
															<button
																className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm focus:outline-none hover:bg-[color:var(--accent-hover)]"
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
																		<span className="rounded-full bg-[color:var(--surface)] px-1 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">{otherLeaves.length}</span>
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
																	className="inline-flex items-center gap-2 rounded-full bg-[color:var(--success)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm focus:outline-none hover:opacity-90"
																	title={`View ${dayTickets.length} ticket(s)`}
																	aria-label={`View ${dayTickets.length} ticket${dayTickets.length > 1 ? 's' : ''}`}
																	onClick={(e) => { e.stopPropagation(); openTicketModal(date); }}
																>
																	<span aria-hidden="true" className="h-6 w-6 inline-flex items-center justify-center text-[24px]">🎫</span>
																	{dayTickets.length >= 1 && (
																		<span className="rounded-full bg-[color:var(--surface)] px-1 py-0.5 text-[10px] font-semibold text-[color:var(--success)]">{dayTickets.length}</span>
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
									<h3 className="mb-4 text-xl font-semibold text-[color:var(--text-primary)]">
										My Leaves
									</h3>
									{myLeaves.length === 0 ? (
										<div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-hover)] py-8 text-center text-[color:var(--text-secondary)]">
											No leaves applied yet
										</div>
									) : (
										<div className="overflow-x-auto mb-8">
											<table className="min-w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow">
												<thead>
													<tr className="bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
														<th className="py-2 px-4 text-center">S.No</th>
														<th className="py-2 px-4 text-center">Status</th>
														<th className="py-2 px-4 text-center">Duration</th>
														<th className="py-2 px-4 text-center">Reason</th>
														<th className="py-2 px-4 text-center">Action</th>
													</tr>
												</thead>
												<tbody>
													{myLeaves.map((leave, idx) => (
														<tr key={leave.id} className="border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]">
															<td className="py-2 px-4 text-center">{idx + 1}</td>
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
																		className="rounded bg-[color:var(--accent)] p-2 text-white transition hover:bg-[color:var(--accent-hover)]"
																		title="Edit leave"
																	>
																		<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
																		</svg>
																	</button>
																	<button
																		onClick={() => handleCancelLeave(leave.id)}
																		className="rounded bg-[color:var(--danger)] p-2 text-white transition hover:bg-[color:var(--danger-hover)]"
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
										<h3 className="text-xl font-semibold text-[color:var(--text-primary)]">
										Pending Leaves in {formatMonthYear(currentDate)}
									</h3>
								</div>
								{monthLeaves.length === 0 ? (
									<div className="text-center text-[color:var(--text-secondary)]">No pending leaves for this month</div>
								) : (
									<div className="space-y-3">
										{monthLeaves.map((leave) => (
											<div key={leave.id} className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
												<div className="flex items-center justify-between mb-2">
													<div className="font-semibold text-[color:var(--text-primary)]">
														{leave.user_name} ({leave.user_role})
													</div>
													<span className="rounded bg-[color:var(--warning-soft)] px-2 py-1 text-xs text-[color:var(--warning)]">
														Pending
													</span>
												</div>
												<div className="text-sm text-[color:var(--text-secondary)]">
													{formatFullDate(parseDateOnly(leave.from_date))} → {formatFullDate(parseDateOnly(leave.to_date))}
												</div>
												<div className="text-sm text-[color:var(--text-secondary)]">
													Duration: {leave.credited_days} day(s)
												</div>
												<div className="text-sm text-[color:var(--text-secondary)]">
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
			<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
				<div className="w-full max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
					<div className="p-6">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-xl font-bold text-[color:var(--text-primary)]">
								My Leave
							</h3>
							<button
								onClick={handleCloseDateDetail}
								className="text-2xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
							>
								×
							</button>
						</div>

						{(() => {
							const leave = getMyLeaveForDate(selectedDate);
							return leave ? (
								
								<div className="overflow-x-auto">
									<table className="min-w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
										<thead>
											<tr className="bg-[color:var(--accent)] text-white">
												<th className="py-2 px-4 text-left">S.No</th>
												<th className="py-2 px-4 text-left">From</th>
												<th className="py-2 px-4 text-left">To</th>
												<th className="py-2 px-4 text-left">Duration</th>
												<th className="py-2 px-4 text-left">Reason</th>
												<th className="py-2 px-4 text-left">Leave Type</th>
												<th className="py-2 px-4 text-center">Action</th>
											</tr>
										</thead>
										<tbody>
											<tr className="border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]">
												<td className="py-2 px-4">1</td>
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
			<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
				<div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
					<div className="p-6">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-xl font-bold text-[color:var(--text-primary)]">
								{editingLeave ? 'Edit Leave Application' : 'Apply for Leave'}
							</h3>
							<button
								onClick={handleCloseLeaveForm}
								className="text-2xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
							>
								×
							</button>
						</div>

						<form onSubmit={handleSubmitLeave} className="space-y-4">
							<div className="grid grid-cols-12 gap-4 w-full items-start">
								<div className="col-span-4">
									<label className="mb-1 block text-sm font-medium text-[color:var(--text-primary)]">From Date *</label>
									<input
										type="date"
										name="from_date"
										value={leaveForm.from_date}
										readOnly
										required
										className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-2 text-base text-[color:var(--text-primary)] cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
										style={{fontVariantNumeric:'tabular-nums', minWidth: '10.5rem', maxWidth: '13rem'}}
									/>
								</div>
								<div className="col-span-4">
									<label className="mb-1 block text-sm font-medium text-[color:var(--text-primary)]">To Date *</label>
									<input
										type="date"
										name="to_date"
										value={leaveForm.to_date}
										onChange={handleFormChange}
										min={leaveForm.from_date}
										required
										className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-base text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
										style={{fontVariantNumeric:'tabular-nums', minWidth: '10.5rem', maxWidth: '13rem'}}
									/>
								</div>
								<div className="col-span-2">
									<label className="mb-1 block text-sm font-medium text-[color:var(--text-primary)]">Day Type</label>
									<select
										name="day_type"
										value={leaveForm.day_type || 'full'}
										onChange={handleFormChange}
										required
										className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-base text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
										disabled={leaveForm.from_date !== leaveForm.to_date}
									>
										<option value="full">Full day</option>
										<option value="morning">Morning half</option>
										<option value="afternoon">Afternoon half</option>
									</select>
								</div>
								<div className="col-span-2">
									<label className="mb-1 block text-sm font-medium text-[color:var(--text-primary)]">Days</label>
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
										className="w-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-2 py-2 text-center text-[color:var(--text-primary)] focus:outline-none"
										style={{minWidth:'3.5rem',maxWidth:'4.5rem'}}
									/>
								</div>
							</div>
						<p className="text-xs text-[color:var(--text-secondary)]">
							Note: Half-day leaves are limited to a single day
						</p>

						<div>
							<label className="mb-2 block text-sm font-medium text-[color:var(--text-primary)]">Leave Type *</label>
							<div className="flex flex-wrap gap-4">
								<label className="inline-flex items-center gap-2">
									<input
										type="radio"
										name="leave_type"
										value="Earned Leave"
										checked={leaveForm.leave_type === 'Earned Leave'}
										onChange={handleFormChange}
										className="h-4 w-4 border-[color:var(--border)] text-[color:var(--accent)] focus:ring-[color:var(--ring)]"
									/>
									<span className="text-sm text-[color:var(--text-primary)]">Earned Leave</span>
								</label>
								<label className="inline-flex items-center gap-2">
									<input
										type="radio"
										name="leave_type"
										value="Duty Leave"
										checked={leaveForm.leave_type === 'Duty Leave'}
										onChange={handleFormChange}
										className="h-4 w-4 border-[color:var(--border)] text-[color:var(--accent)] focus:ring-[color:var(--ring)]"
									/>
									<span className="text-sm text-[color:var(--text-primary)]">Duty Leave</span>
								</label>
							</div>
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-[color:var(--text-primary)]">Reason for Leave *</label>
								<textarea
									name="leave_reason"
									value={leaveForm.leave_reason}
									onChange={handleFormChange}
									required
									rows="3"
									className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
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
										className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--accent)] focus:ring-[color:var(--ring)]"
									/>
									<label className="ml-2 text-sm text-[color:var(--text-primary)]">
										Available on phone during leave
									</label>
								</div>

								{leaveBalance && (
									<div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-3">
										<p className="text-sm text-[color:var(--text-primary)]">
											<strong>Available Balance:</strong> {leaveBalance.leave_balance} day(s)
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end gap-3 pt-4">
								<button
									type="button"
									onClick={handleCloseLeaveForm}
									className="rounded bg-[color:var(--danger)] px-4 py-2 text-white transition hover:bg-[color:var(--danger-hover)]"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={loading}
									className="rounded bg-[color:var(--accent)] px-4 py-2 text-white transition hover:bg-[color:var(--accent-hover)] disabled:bg-[color:var(--surface-hover)]"
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
				<div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
					<div className="p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-xl font-bold text-[color:var(--text-primary)]">
								Leave Details - {formatFullDate(selectedLeaveDate)}
							</h3>
							<button
								onClick={closeLeaveModal}
								className="text-2xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
							>
								×
							</button>
						</div>

						{selectedDateLeaves.length === 0 ? (
							<div className="py-8 text-center text-[color:var(--text-secondary)]">No leaves for this date</div>
						) : (
							<div className="overflow-x-auto">
									<table className="min-w-full text-sm border">
										<thead className="bg-[color:var(--accent)] text-white">
												<tr>
													<th className="text-left px-4 py-2 border">S.No</th>
													<th className="text-left px-4 py-2 border">User Name</th>
													<th className="text-left px-4 py-2 border">Role</th>
													<th className="text-left px-4 py-2 border">From Date</th>
													<th className="text-left px-4 py-2 border">To Date</th>
													<th className="text-left px-4 py-2 border">Leave Reason</th>
													<th className="text-left px-4 py-2 border">Type</th>
													<th className="text-left px-4 py-2 border">Status</th>
												</tr>
											</thead>
											<tbody>
												{selectedDateLeaves.map((leave, idx) => (
													<tr key={leave.id} className={`border-t border-[color:var(--border)] ${isLeaveWithoutPay(leave) ? 'border-l-4 border-[color:var(--danger)] bg-[color:var(--danger-soft)]' : ''}`}>
													<td className="px-4 py-2 border">{idx + 1}</td>
													<td className="px-4 py-2 border">{leave.user_name}</td>
													<td className="px-4 py-2 border">{leave.user_role || '—'}</td>
													<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.from_date))}</td>
													<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.to_date))}</td>
													<td className="px-4 py-2 border">{leave.leave_reason || '—'}</td>
													<td className="px-4 py-2 border">
													<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white ${isLeaveWithoutPay(leave) ? 'bg-[color:var(--danger)]' : 'bg-[color:var(--accent)]'}`}>
														{leave.leave_type || '—'}
													</span>
												</td>
												<td className="px-4 py-2 border">
													<span className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${getLeaveBadgeColor(leave.status)}`}>
														{leave.status}
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
	</div>
	</>
);
};

export default ManagementCalendar;
