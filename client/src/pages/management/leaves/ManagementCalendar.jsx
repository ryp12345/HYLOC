import React, { useEffect, useMemo, useState } from 'react';
import { getAllLeaves } from '../../../api/leaveApi';
import { getMyTickets, getAllTickets } from '../../../api/ticketApi';

const ManagementCalendar = () => {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'list'
	const [leaves, setLeaves] = useState([]);
	const [allOrgLeaves, setAllOrgLeaves] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [selectedLeaveDate, setSelectedLeaveDate] = useState(null);
	const [selectedDateLeaves, setSelectedDateLeaves] = useState([]);

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
					(role === 'Manager' || (role === 'Employee' && duration > 2))
				);
			});

			setLeaves(pendingLeaves);
			// Store all leaves for Leave List display (all statuses, all users)
			const currentYearLeaves = allLeaves.filter((leave) => {
				const fromDate = parseDateOnly(leave.from_date);
				return fromDate && fromDate.getFullYear() === year;
			});
			setAllOrgLeaves(currentYearLeaves);
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
			const res = await getAllTickets();
			setTickets(res.data.data || []);
		} catch (err) {
			// Optionally set error
		}
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

	const openLeaveModal = (date) => {
		const dayLeaves = getTeamLeavesForDate(date);
		setSelectedLeaveDate(date);
		setSelectedDateLeaves(dayLeaves);
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

	const formatAlternate = (leave) => {
		const primary = leave.alternate_person || '';
		const additional = leave.additional_alternate || '';
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

	const monthLeaves = useMemo(() => {
		return leaves.filter(overlapsMonth);
	}, [leaves, currentDate]);

	return (
		<div className="w-full space-y-6">
			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			)}

			<div className="bg-white rounded-lg shadow-lg p-6">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold text-gray-800">Management Pending Leaves</h2>
						<p className="text-sm text-gray-600">Pending leaves from Employees (&gt;2 days) and Managers</p>
					</div>

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
							onClick={() => setViewMode('list')}
							className={`px-4 py-2 rounded transition-colors ${
								viewMode === 'list'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
							}`}
						>
							List
						</button>
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
							<div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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
												<thead className="bg-gray-100 text-gray-700">
													<tr>
														<th className="text-left px-4 py-2 border">Title</th>
														<th className="text-left px-4 py-2 border">Description</th>
														<th className="text-left px-4 py-2 border">Category</th>
														<th className="text-left px-4 py-2 border">Priority</th>
														<th className="text-left px-4 py-2 border">Due Date</th>
													</tr>
												</thead>
												<tbody>
													{selectedTickets.map((t) => (
														<tr key={t.id} className="border-t">
															<td className="px-4 py-2 border">{t.title || '-'}</td>
															<td className="px-4 py-2 border">{t.description || '-'}</td>
															<td className="px-4 py-2 border">{t.category || t.ticket_category || '-'}</td>
															<td className="px-4 py-2 border">{t.priority || '-'}</td>
															<td className="px-4 py-2 border">{t.due_date ? formatDateDisplay(t.due_date) : '-'}</td>
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
										return (
											<div
												key={index}
												className={`min-h-[110px] p-2 border rounded ${
													date ? 'bg-white' : 'bg-gray-50'
												} ${isToday(date) ? 'border-emerald-500' : 'border-gray-200'}`}
											>
												{date && (
													<div className="text-sm font-semibold text-gray-700 mb-1">
														{date.getDate()}
													</div>
												)}
												{teamLeaves.length > 0 && (
													<div className="mt-2 space-y-1">
														<button
															className="w-full px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
															onClick={() => openLeaveModal(date)}
														>
															{`Leave List(${teamLeaves.length})`}
														</button>
													</div>
												)}
												{(() => {
													const dayTickets = getTicketsForDate(date);
													return dayTickets.length > 0 ? (
														<button
															className="mt-2 w-full px-2 py-1.5 rounded bg-green-600 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all hover:bg-green-700"
															title={`View ${dayTickets.length} ticket(s)`}
															onClick={() => openTicketModal(date)}
														>
															<div className="font-semibold text-center">{dayTickets.length > 1 ? `Tickets(${dayTickets.length})` : `Ticket(${dayTickets.length})`}</div>
														</button>
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
										return (
											<div key={index} className="border rounded p-3">
												<div className="text-sm font-semibold text-gray-700 mb-2">
													{formatDate(date)}
												</div>
												{teamLeaves.length === 0 ? (
													<div className="text-xs text-gray-500">No leaves</div>
												) : (
													<div className="space-y-1">
														{teamLeaves.length > 0 && (
															<div className="space-y-1">
																<button
																	className="w-full px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
																	onClick={() => openLeaveModal(date)}
																>
																	{`Leave List(${teamLeaves.length})`}
																</button>
															</div>
														)}
														{(() => {
															const dayTickets = getTicketsForDate(date);
															return dayTickets.length > 0 ? (
																<button
																	className="mt-2 w-full px-2 py-1.5 rounded bg-green-600 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all hover:bg-green-700"
																	title={`View ${dayTickets.length} ticket(s)`}
																	onClick={() => openTicketModal(date)}
																>
																	<div className="font-semibold text-center">{dayTickets.length > 1 ? `Tickets(${dayTickets.length})` : `Ticket(${dayTickets.length})`}</div>
																</button>
															) : null;
														})()}
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{viewMode === 'list' && (
							<div>
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
													<span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
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

		{/* Filter Section for All Org Leaves */}
		<div className="bg-white rounded-lg shadow-lg p-6">
			
			<table className="w-full mb-4 border rounded-lg overflow-hidden">
				<thead>
					<tr>
						<th colSpan="4" className="bg-blue-600 text-white text-lg font-semibold py-2 px-4 text-left">Leave Search Filters</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td className="py-2 px-2" colSpan="4">
							<div className="flex flex-row items-end gap-4 w-full">
								<div className="flex-1 min-w-[160px] max-w-[220px]">
									<label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
									<input 
										type="date" 
										className="border rounded px-3 py-2 w-full" 
										value={filter.from} 
										onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setCurrentPage(1); }}
									/>
								</div>
								<div className="flex-1 min-w-[160px] max-w-[220px]">
									<label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
									<input 
										type="date" 
										className="border rounded px-3 py-2 w-full" 
										value={filter.to} 
										onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setCurrentPage(1); }}
									/>
								</div>
								<div className="flex-grow"></div>
								<div className="flex-grow-0 min-w-[120px] max-w-[160px] flex flex-col items-start">
									<label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
									<select
										className="border rounded px-3 py-2 w-full max-w-[120px] text-left"
										value={filter.year}
										onChange={e => { setFilter(f => ({ ...f, year: Number(e.target.value) })); setCurrentPage(1); }}
									>
										{[currentYear - 1, currentYear, currentYear + 1].map(y => (
											<option key={y} value={y}>{y}</option>
										))}
									</select>
								</div>
							</div>
						</td>
					</tr>
					<tr>
						<td className="py-2 px-2" colSpan="4">
							<div className="flex flex-row items-end gap-4 w-full">
								<div className="flex-1 min-w-[200px] max-w-[280px]">
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
								<div className="flex-[4] min-w-[320px]">
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
								<div className="ml-auto flex flex-row items-end gap-4">
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
					<div className="overflow-x-auto">
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
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{loading ? (
									<tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading...</td></tr>
								) : paginatedOrgLeaves.length === 0 ? (
									<tr><td colSpan="8" className="p-8 text-center text-gray-500">No leaves found matching the filters</td></tr>
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
												<span className={`px-3 py-1 rounded-full text-xs font-semibold ${
													leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
													leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
													'bg-red-100 text-red-800'
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
										{selectedDateLeaves.map((leave) => (
											<tr key={leave.id} className="border-t">
												<td className="px-4 py-2 border">{leave.user_name}</td>
												<td className="px-4 py-2 border">{leave.user_role || '—'}</td>
												<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.from_date))}</td>
												<td className="px-4 py-2 border">{formatFullDate(parseDateOnly(leave.to_date))}</td>
												<td className="px-4 py-2 border">{leave.leave_reason || '—'}</td>
												<td className="px-4 py-2 border">{formatAlternate(leave)}</td>
												<td className="px-4 py-2 border">
													<span className={`px-2 py-1 rounded text-xs font-semibold ${getLeaveBadgeColor(leave.status)}`}>
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
);
};

export default ManagementCalendar;
