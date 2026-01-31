import React, { useEffect, useMemo, useState } from 'react';
import { getAllLeaves } from '../../../api/leaveApi';

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

	useEffect(() => {
		loadData();
	}, [currentDate]);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const year = currentDate.getFullYear();
			const response = await getAllLeaves({});
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
			
			// Store all leaves for Team Leave display (all statuses, all users)
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
															Team Leave
														</button>
														<div className="text-[10px] text-gray-500 text-center">
															{teamLeaves.length} leave(s)
														</div>
													</div>
												)}
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
																	Team Leave
																</button>
																<div className="text-[10px] text-gray-500 text-center">
																	{teamLeaves.length} leave(s)
																</div>
															</div>
														)}
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
