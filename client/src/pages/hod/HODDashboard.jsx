import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUsersByDepartment } from '../../api/userApi';
import { getDepartmentLeaves } from '../../api/leaveApi';
import api from '../../api/axios';

function HODDashboard() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [teamStats, setTeamStats] = useState({
		totalEmployees: 0,
		presentToday: 0,
		onLeaveToday: 0
	});
	const [kpiStats, setKpiStats] = useState({
		teamKPIsAssigned: 0,
		kpisPendingUpdate: 0,
		averageAchievement: 0
	});

	useEffect(() => {
		fetchDashboardData();
	}, [user]);

	const fetchDashboardData = async () => {
		try {
			setLoading(true);
			await Promise.all([
				fetchTeamStatistics(),
				fetchKPIStatistics()
			]);
		} catch (error) {
			console.error('Error fetching dashboard data:', error);
		} finally {
			setLoading(false);
		}
	};

	const fetchTeamStatistics = async () => {
		try {
			const hodDepartmentId = user?.departmentId || user?.department_id;
			
			if (!hodDepartmentId) {
				console.warn('HOD has no department assigned');
				return;
			}

			// Get users in hod's department
			const usersResponse = await getUsersByDepartment(hodDepartmentId);
			const departmentEmployees = (usersResponse.data?.data || []).filter(
			u => u.id !== user.id
			);

			// Get today's leaves for the department
			const today = new Date().toISOString().split('T')[0];
			const leavesResponse = await getDepartmentLeaves({ year: new Date().getFullYear() });
			const allLeaves = leavesResponse.data?.data || [];
			
			// Count employees on leave today
			const onLeaveToday = allLeaves.filter(leave => {
				if (leave.status !== 'Approved') return false;
				const fromDate = new Date(leave.from_date).toISOString().split('T')[0];
				const toDate = new Date(leave.to_date).toISOString().split('T')[0];
				return today >= fromDate && today <= toDate;
			}).length;

			const totalEmployees = departmentEmployees.length;
			const presentToday = totalEmployees - onLeaveToday;

			setTeamStats({
				totalEmployees,
				presentToday: Math.max(0, presentToday),
				onLeaveToday
			});
		} catch (error) {
			console.error('Error fetching team statistics:', error);
		}
	};

	const fetchKPIStatistics = async () => {
		try {
			const hodDepartmentId = user?.departmentId || user?.department_id;
			
			if (!hodDepartmentId) {
				return;
			}

			// Get users in hod's department
			const usersResponse = await getUsersByDepartment(hodDepartmentId);
			const departmentEmployees = (usersResponse.data?.data || []).filter(
			u => u.id !== user.id
			);

			// Get KPI values for department employees
			const kpiValuesResponse = await api.get('/kpi-values');
			const allKpiValues = kpiValuesResponse.data?.data || [];

			// Filter KPI values for department employees
			const departmentKpiValues = allKpiValues.filter(kv => 
				departmentEmployees.some(emp => emp.id === kv.employee_id)
			);

			const teamKPIsAssigned = departmentKpiValues.length;

			// Get current year and month
			const currentYear = new Date().getFullYear();
			const currentMonth = new Date().getMonth() + 1;

			// Check for pending updates and calculate average achievement
			let pendingCount = 0;
			let totalAchievement = 0;
			let achievementCount = 0;

			for (const kv of departmentKpiValues) {
				try {
					const monthlyDataResponse = await api.get(`/kpi-values/${kv.id}/monthly-data/${currentYear}`);
					const monthlyData = monthlyDataResponse.data?.data || [];
					
					const currentMonthData = monthlyData.find(m => 
						Number(m.month) === currentMonth && Number(m.year) === currentYear
					);

					if (!currentMonthData || !currentMonthData.actual_value) {
						pendingCount++;
					} else {
						const target = Number(currentMonthData.target_value || 0);
						const actual = Number(currentMonthData.actual_value || 0);
						
						if (target > 0) {
							const achievement = Math.min(100, (actual / target) * 100);
							totalAchievement += achievement;
							achievementCount++;
						}
					}
				} catch (err) {
					// If unable to fetch data, consider it pending
					pendingCount++;
				}
			}

			const averageAchievement = achievementCount > 0 
				? Math.round(totalAchievement / achievementCount) 
				: 0;

			setKpiStats({
				teamKPIsAssigned,
				kpisPendingUpdate: pendingCount,
				averageAchievement
			});
		} catch (error) {
			console.error('Error fetching KPI statistics:', error);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-800 mb-2">
					HOD Dashboard
				</h1>
				<p className="text-gray-600">
					Welcome, {user?.firstName} {user?.lastName}
				</p>
			</div>

			{/* Team Overview Section */}
			<div>
				<h2 className="text-xl font-semibold text-gray-800 mb-4">👥 Team Overview</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
						<div className="flex items-center justify-between mb-3">
							<div className="text-gray-500 text-sm font-semibold">Total Employees</div>
							<div className="text-3xl">👨‍💼</div>
						</div>
						<div className="text-3xl font-bold text-gray-800">
							{loading ? '...' : teamStats.totalEmployees}
						</div>
						<p className="text-xs text-gray-500 mt-2">In your department</p>
					</div>
					
					<div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
						<div className="flex items-center justify-between mb-3">
							<div className="text-gray-500 text-sm font-semibold">Present Today</div>
							<div className="text-3xl">✅</div>
						</div>
						<div className="text-3xl font-bold text-gray-800">
							{loading ? '...' : teamStats.presentToday}
						</div>
						<p className="text-xs text-gray-500 mt-2">Active employees</p>
					</div>

					<div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
						<div className="flex items-center justify-between mb-3">
							<div className="text-gray-500 text-sm font-semibold">On Leave Today</div>
							<div className="text-3xl">🏖️</div>
						</div>
						<div className="text-3xl font-bold text-gray-800">
							{loading ? '...' : teamStats.onLeaveToday}
						</div>
						<p className="text-xs text-gray-500 mt-2">Team members on leave</p>
					</div>
				</div>
			</div>

		</div>
	);
}

export default HODDashboard;
