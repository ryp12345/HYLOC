import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getKPIs } from '../../api/kpiApi';
import { getPillers } from '../../api/pillerApi';
import { getUsers } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';

function ManagementDashboard() {
  const { user } = useAuth();
  const [kpiStats, setKpiStats] = useState({
    total: 0
  });
  const [pillerStats, setPillerStats] = useState({
    total: 0,
    pillers: []
  });
  const [employeeStats, setEmployeeStats] = useState({
    total: 0
  });
  const [departmentStats, setDepartmentStats] = useState({
    total: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const [kpisResponse, pillersResponse, usersResponse, departmentsResponse] = await Promise.all([
        getKPIs(),
        getPillers(),
        getUsers(),
        getDepartments()
      ]);

      console.log('KPIs Response:', kpisResponse);
      console.log('Pillers Response:', pillersResponse);

      if (kpisResponse?.data) {
        const kpisData = kpisResponse.data;
        // Check if data is wrapped in another object (e.g., { data: [...] })
        const kpis = Array.isArray(kpisData) ? kpisData : (Array.isArray(kpisData?.data) ? kpisData.data : []);
        console.log('KPIs array:', kpis);
        setKpiStats({
          total: kpis.length
        });
      }

      if (pillersResponse?.data) {
        const pillersData = pillersResponse.data;
        // Check if data is wrapped in another object (e.g., { data: [...] })
        const pillers = Array.isArray(pillersData) ? pillersData : (Array.isArray(pillersData?.data) ? pillersData.data : []);
        console.log('Pillers array:', pillers);
        setPillerStats({
          total: pillers.length,
          pillers: pillers
        });
      }

      if (usersResponse?.data) {
        const usersData = usersResponse.data;
        const users = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.data) ? usersData.data : []);
        setEmployeeStats({
          total: users.length
        });
      }

      if (departmentsResponse?.data) {
        const departmentsData = departmentsResponse.data;
        const departments = Array.isArray(departmentsData) ? departmentsData : (Array.isArray(departmentsData?.data) ? departmentsData.data : []);
        setDepartmentStats({
          total: departments.length
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Management Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="text-gray-500 text-sm font-semibold mb-2">Total KPIs</div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : kpiStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="text-gray-500 text-sm font-semibold mb-2">Total Pillers</div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : pillerStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="text-gray-500 text-sm font-semibold mb-2">Total Employees</div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : employeeStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="text-gray-500 text-sm font-semibold mb-2">Total Departments</div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : departmentStats.total}</div>
        </div>
      </div>
    </div>
  );
}

export default ManagementDashboard;
