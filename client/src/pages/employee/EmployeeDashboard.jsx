import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyLeaveBalance } from '../../api/leaveApi';
import { getEmployeeKPIValues, getKPIValueMonthlyData, getKPIs } from '../../api/kpiApi';

const getCurrentFiscalYearStart = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};

const formatFiscalYear = (startYear) => `${startYear}-${String(startYear + 1).slice(-2)}`;

const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};


function EmployeeDashboard() {
  const { user } = useAuth();
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYearStart());
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    assigned: 0,
    valuesAssigned: 0,
    measurementPoints: 0,
    avgEntriesPerKpiValue: 0,
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
        const leaveRes = await getMyLeaveBalance(selectedFiscalYear);
        setLeaveBalance(leaveRes.data?.data || null);

        // Fetch assigned KPIs/KAIs - Use the employee-specific endpoint
        const [kpiEmpRes, kpisRes] = await Promise.all([
          getEmployeeKPIValues(empIdentifier),
          getKPIs().catch(() => ({ data: { data: [] } }))
        ]);

        const allKpis = Array.isArray(kpisRes.data?.data) ? kpisRes.data.data : [];
        const kpiById = new Map(allKpis.map((kpi) => [String(kpi.id), kpi]));
        const allAssignedKpis = Array.isArray(kpiEmpRes.data?.data) ? kpiEmpRes.data.data : [];
        const assignedKpis = allAssignedKpis.filter((kpiValue) => {
          const valueStartYear = parseFiscalYear(kpiValue?.fin_year);
          const parentKpi = kpiById.get(String(kpiValue?.kpi_id));
          const parentStartYear = parseFiscalYear(parentKpi?.fin_year);
          const startYear = valueStartYear ?? parentStartYear;
          // Strict FY filter to avoid showing previous-year assignments in newer FY.
          return startYear === selectedFiscalYear;
        });

        // Assigned to you (distinct KPI IDs assigned to this employee)
        const assignedKpiIds = [...new Set(assignedKpis.map(k => String(k.kpi_id)))];

        // Total KPIs/KAIs for this logged-in user
        const totalKpis = assignedKpiIds.length;

        // Total Values Assigned (number of KPI values assigned to this employee)
        const valuesAssigned = assignedKpis.length;

        // Measurement points (number of unique KPI value IDs assigned)
        const measurementPoints = valuesAssigned; // or could be unique value IDs

        // Data entry progress: for each KPI value, count FY months with any entry,
        // then average that count across all assigned KPI values.
        let avgEntriesPerKpiValue = 0;
        if (assignedKpis.length > 0) {
          const yearsToLoad = [selectedFiscalYear, selectedFiscalYear + 1];
          const promises = assignedKpis.map(async (kv) => {
            const [firstYearData, secondYearData] = await Promise.all(
              yearsToLoad.map((year) =>
                getKPIValueMonthlyData(kv.id, year).then((r) => r.data?.data || []).catch(() => [])
              )
            );
            return [...firstYearData, ...secondYearData];
          });
          const results = await Promise.allSettled(promises);
          let totalEnteredMonthsAcrossKpis = 0;
          for (const res of results) {
            if (res.status === 'fulfilled') {
              const months = res.value;
              const fiscalMonths = months.filter((m) => {
                const rowFiscalYear = parseFiscalYear(m?.fin_year);
                const monthNum = Number(m?.month);
                const yearNum = Number(m?.year);

                // If API provides row-level fin_year, enforce direct FY match.
                if (rowFiscalYear != null) {
                  return rowFiscalYear === selectedFiscalYear;
                }

                if (!Number.isFinite(monthNum) || !Number.isFinite(yearNum)) return false;
                // FY is April(startYear) to March(startYear+1)
                if (yearNum === selectedFiscalYear && monthNum >= 4 && monthNum <= 12) return true;
                if (yearNum === selectedFiscalYear + 1 && monthNum >= 1 && monthNum <= 3) return true;
                return false;
              });

              // Count distinct months where there is any data (target or actual).
              const enteredMonthKeys = new Set(
                fiscalMonths
                  .filter((m) => m?.target_value != null || m?.actual_value != null)
                  .map((m) => `${Number(m.year)}-${Number(m.month)}`)
              );
              totalEnteredMonthsAcrossKpis += enteredMonthKeys.size;
            }
          }
          avgEntriesPerKpiValue = totalEnteredMonthsAcrossKpis / assignedKpis.length;
        }

        // Monthly records (mocked as 0 for now, replace with real API if available)
        const monthlyRecords = 0;

        setKpiStats({
          total: totalKpis,
          assigned: assignedKpiIds.length,
          valuesAssigned,
          measurementPoints,
          avgEntriesPerKpiValue,
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
  }, [selectedFiscalYear, user?.empid, user?.id]);

  const fiscalYearOptions = Array.from({ length: 6 }, (_, index) => {
    const current = getCurrentFiscalYearStart();
    return current - index;
  });


  return (
    <>
      <div className="space-y-6 text-[color:var(--text-primary)]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-[color:var(--text-primary)]">Employee Dashboard</h1>
              <p className="text-[color:var(--text-secondary)]">Welcome, {user?.firstName} {user?.lastName}</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--accent)]">Showing statistics for FY {formatFiscalYear(selectedFiscalYear)}</p>
            </div>
            <div className="min-w-[180px]">
              <label htmlFor="dashboard-fiscal-year" className="mb-1 block text-sm font-semibold text-[color:var(--text-secondary)]">
                Financial Year
              </label>
              <select
                id="dashboard-fiscal-year"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent)]"
              >
                {fiscalYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {formatFiscalYear(year)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPI/KAIs Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--accent)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="text-4xl">📊</div>
            <div>
              <div className="mb-1 text-sm font-semibold text-[color:var(--text-secondary)]">My KPIs/KAIs</div>
              <div className="text-3xl font-bold text-[color:var(--text-primary)]">{loading ? 0 : kpiStats.total}</div>
            </div>
          </div>
          {/* Removed 'Assigned to you' box */}
          <div className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--accent)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="text-4xl">📋</div>
            <div>
              <div className="mb-1 text-sm font-semibold text-[color:var(--text-secondary)]">Total Values Assigned</div>
              <div className="text-3xl font-bold text-[color:var(--text-primary)]">{loading ? 0 : kpiStats.valuesAssigned}</div>
            </div>
          </div>
          {/* Removed 'Measurement points' box */}
          <div className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--warning)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="text-4xl">📈</div>
            <div>
              <div className="mb-1 text-sm font-semibold text-[color:var(--text-secondary)]">Avg Entries / KPI Value</div>
              <div className="text-3xl font-bold text-[color:var(--text-primary)]">
                {loading ? '0.0 / 12' : `${kpiStats.avgEntriesPerKpiValue.toFixed(1)} / 12`}
              </div>
            </div>
          </div>
          {/* Removed 'Monthly records' box */}
        </div>

        

        {error && (
          <div className="rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">
            {error}
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a href="/employee/kpikai" className="block rounded-lg bg-[color:var(--accent)] p-4 text-center text-white transition hover:bg-[color:var(--accent-hover)]">
              <div className="font-semibold">View My KPIs/KAIs</div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default EmployeeDashboard;
