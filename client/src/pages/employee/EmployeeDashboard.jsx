import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyLeaveBalance } from '../../api/leaveApi';
import { getKPIValues, getKPIValuesByKPI, getEmployeeKPIValues, getKPIValueMonthlyData } from '../../api/kpiApi';


function EmployeeDashboard() {
  const { user } = useAuth();
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    assigned: 0,
    valuesAssigned: 0,
    measurementPoints: 0,
    dataEntries: 0,
    monthlyRecords: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  useEffect(() => {
    const fetchStats = async () => {
      // server expects employee identifier (empid) that matches "data operator"
      const empIdentifier = user?.empid || user?.id;
      if (!empIdentifier) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch leave balance
        const year = new Date().getFullYear();
        const leaveRes = await getMyLeaveBalance(year);
        setLeaveBalance(leaveRes.data?.data || null);

        // Fetch all KPI values (for measurement points, data entries, etc.)
        const kpiValuesRes = await getKPIValues();
        const allKpiValues = Array.isArray(kpiValuesRes.data?.data) ? kpiValuesRes.data.data : [];

        // Fetch assigned KPIs/KAIs
        const kpiEmpRes = await getEmployeeKPIValues(empIdentifier);
        const assignedKpis = Array.isArray(kpiEmpRes.data?.data) ? kpiEmpRes.data.data : [];

        // Assigned to you (distinct KPI IDs assigned to this employee)
        const assignedKpiIds = [...new Set(assignedKpis.map(k => String(k.kpi_id)))];

        // Total KPIs/KAIs for this logged-in user
        const totalKpis = assignedKpiIds.length;

        // Total Values Assigned (number of KPI values assigned to this employee)
        const valuesAssigned = allKpiValues.filter(v => assignedKpiIds.includes(v.kpi_id)).length;

        // Measurement points (number of unique KPI value IDs assigned)
        const measurementPoints = valuesAssigned; // or could be unique value IDs

        // Data Entries: count of months with actual/target entries for assigned KPI values for current year
        let dataEntries = 0;
        if (assignedKpis.length > 0) {
          const year = new Date().getFullYear();
          const promises = assignedKpis.map(kv =>
            getKPIValueMonthlyData(kv.id, year).then(r => r.data?.data || []).catch(() => [])
          );
          const results = await Promise.allSettled(promises);
          for (const res of results) {
            if (res.status === 'fulfilled') {
              const months = res.value;
              // months is array of { month, year, target_value, actual_value }
              dataEntries += months.reduce((acc, m) => acc + ((m.target_value != null) + (m.actual_value != null)), 0);
            }
          }
        }

        // Monthly records (mocked as 0 for now, replace with real API if available)
        const monthlyRecords = 0;

        setKpiStats({
          total: totalKpis,
          assigned: assignedKpiIds.length,
          valuesAssigned,
          measurementPoints,
          dataEntries,
          monthlyRecords
        });
      } catch (err) {
        console.error('Failed to fetch dashboard statistics', err);
        const msg = err?.response?.data?.message || err?.message || 'Failed to load statistics';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.id]);


  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Employee Dashboard</h1>
          <p className="text-gray-600">Welcome, {user?.firstName} {user?.lastName}</p>
        </div>

        {/* KPI/KAIs Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500 flex items-center gap-4">
            <div className="text-4xl">📊</div>
            <div>
              <div className="text-gray-500 text-sm font-semibold mb-1">My KPIs/KAIs</div>
              <div className="text-3xl font-bold text-gray-800">{loading ? 0 : kpiStats.total}</div>
            </div>
          </div>
          {/* Removed 'Assigned to you' box */}
          <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-purple-500 flex items-center gap-4">
            <div className="text-4xl">📋</div>
            <div>
              <div className="text-gray-500 text-sm font-semibold mb-1">Total Values Assigned</div>
              <div className="text-3xl font-bold text-gray-800">{loading ? 0 : kpiStats.valuesAssigned}</div>
            </div>
          </div>
          {/* Removed 'Measurement points' box */}
          <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-orange-500 flex items-center gap-4">
            <div className="text-4xl">📈</div>
            <div>
              <div className="text-gray-500 text-sm font-semibold mb-1">Data Entries</div>
              <div className="text-3xl font-bold text-gray-800">{loading ? 0 : kpiStats.dataEntries}</div>
            </div>
          </div>
          {/* Removed 'Monthly records' box */}
        </div>

        

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a href="/employee/kpikai" className="p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition block text-center">
              <div className="font-semibold">View My KPIs/KAIs</div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default EmployeeDashboard;
