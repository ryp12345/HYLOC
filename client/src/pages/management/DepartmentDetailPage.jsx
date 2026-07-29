import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';

const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : parseInt(value, 10);
  }
  return null;
};

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};

function DepartmentDetailPage() {
  const { departmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [mappedKpis, setMappedKpis] = useState([]);
  const [allKpis, setAllKpis] = useState([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [activeTab, setActiveTab] = useState('department');

  const [employees, setEmployees] = useState([]);
  const [employeeKpiMappings, setEmployeeKpiMappings] = useState({});
  const [employeeKpisLoading, setEmployeeKpisLoading] = useState(false);
  const [employeeKpisLoaded, setEmployeeKpisLoaded] = useState(false);

  useEffect(() => {
    setEmployeeKpisLoaded(false);
    setEmployees([]);
    setEmployeeKpiMappings({});
  }, [departmentId]);

  useEffect(() => {
    const loadDepartmentAnalysis = async () => {
      try {
        setLoading(true);
        setError('');

        const [departmentRes, mappingsRes, kpisRes] = await Promise.all([
          api.get(`/departments/${departmentId}`),
          api.get(`/kpi-departments/department/${departmentId}`),
          api.get('/kpis'),
        ]);

        const departmentData = departmentRes?.data?.data || departmentRes?.data || null;
        const mappings = mappingsRes?.data?.data || [];
        const fetchedKpis = kpisRes?.data?.data || [];

        const kpiById = new Map(fetchedKpis.map((kpi) => [Number(kpi.id), kpi]));
        const linkedKpis = mappings
          .map((mapping) => kpiById.get(Number(mapping.kpi_id)))
          .filter(Boolean)
          .sort((a, b) => (a?.title || '').localeCompare(b?.title || ''));

        setDepartment(departmentData);
        setAllKpis(fetchedKpis);
        setMappedKpis(linkedKpis);
      } catch (loadError) {
        console.error('Failed to load department analysis:', loadError);
        setError('Failed to load department detailed analysis.');
      } finally {
        setLoading(false);
      }
    };

    if (departmentId) {
      loadDepartmentAnalysis();
    }
  }, [departmentId]);

  useEffect(() => {
    if (activeTab !== 'employee' || employeeKpisLoaded || !department) return;

    const loadDepartmentEmployees = async () => {
      setEmployeeKpisLoading(true);
      try {
        const usersRes = await api.get(`/users/department/${departmentId}`);
        const users = usersRes?.data?.data || [];
        const employeeCategoryKpis = new Map(
          allKpis
            .filter((kpi) => String(kpi?.category_id) === '4')
            .map((kpi) => [Number(kpi.id), kpi])
        );

        const mappingsMap = {};
        await Promise.all(
          users.map(async (user) => {
            try {
              const lookupKeys = [user.id, user.empid].filter((value) => value !== undefined && value !== null && value !== '');
              let mappings = [];

              for (const lookupKey of lookupKeys) {
                const kpiMappingsRes = await api.get(`/kpi-employees/employee/${lookupKey}`);
                mappings = kpiMappingsRes?.data?.data || [];
                if (mappings.length > 0) break;
              }

              mappingsMap[user.id] = mappings
                .map((mapping) => ({
                  ...mapping,
                  kpi: employeeCategoryKpis.get(Number(mapping.kpi_id)) || null,
                }))
                .filter((mapping) => Boolean(mapping.kpi));
            } catch (e) {
              mappingsMap[user.id] = [];
            }
          })
        );

        setEmployees(users);
        setEmployeeKpiMappings(mappingsMap);
        setEmployeeKpisLoaded(true);
      } catch (e) {
        console.error('Failed to load department employees:', e);
      } finally {
        setEmployeeKpisLoading(false);
      }
    };

    loadDepartmentEmployees();
  }, [activeTab, employeeKpisLoaded, department, departmentId, allKpis]);

  const currentFiscalYear = getCurrentFiscalYear();

  const availableFiscalYears = useMemo(() => {
    const years = new Set(
      mappedKpis
        .map((kpi) => parseFiscalYear(kpi?.fin_year))
        .filter((year) => Number.isFinite(year))
    );

    if (Number.isFinite(currentFiscalYear)) {
      years.add(currentFiscalYear);
    }

    return Array.from(years).sort((a, b) => a - b);
  }, [mappedKpis, currentFiscalYear]);

  useEffect(() => {
    if (availableFiscalYears.length === 0) {
      return;
    }

    if (!availableFiscalYears.includes(selectedFiscalYear)) {
      setSelectedFiscalYear(availableFiscalYears[0]);
    }
  }, [availableFiscalYears, selectedFiscalYear]);

  const filteredKpis = useMemo(() => {
    return mappedKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === selectedFiscalYear);
  }, [mappedKpis, selectedFiscalYear]);

  const analysis = useMemo(() => {
    const currentYearKpis = mappedKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === currentFiscalYear);
    const selectedYearKpis = mappedKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === selectedFiscalYear);
    const coveragePercent = mappedKpis.length > 0
      ? Math.round((selectedYearKpis.length / mappedKpis.length) * 100)
      : 0;

    return {
      totalMapped: selectedYearKpis.length,
      currentYearMapped: currentYearKpis.length,
      coveragePercent,
    };
  }, [mappedKpis, currentFiscalYear, selectedFiscalYear]);

  const employeeKpiRows = useMemo(() => {
    const rows = [];
    employees.forEach((emp) => {
      const name = [emp.firstname, emp.middlename, emp.lastname].filter(Boolean).join(' ') || '-';
      const mappings = employeeKpiMappings[emp.id] || [];
      mappings.forEach((mapping) => {
        const kpi = mapping.kpi;
        if (kpi && parseFiscalYear(kpi.fin_year) === selectedFiscalYear) {
          rows.push({
            empId: emp.id,
            kpiId: kpi.id,
            name,
            kpiTitle: kpi.title || '-',
            financialYear: kpi.fin_year || '-',
          });
        }
      });
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, employeeKpiMappings, selectedFiscalYear]);

  return (
    <div className="space-y-6">
      <div className="dashboard-panel-header px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Department Detailed Analysis</h1>
          <p className="mt-1 text-sm text-white/90">
            {department?.department_name || department?.departmentName || `Department ${departmentId}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex h-9 min-h-0 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 shadow">
            <button
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex > 0) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
              className="rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ‹
            </button>
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">FY</span>
            <span className="mr-1 text-sm font-bold text-[color:var(--text-primary)]">
              {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
            </span>
            <span className="mr-1 text-xs text-[color:var(--text-muted)]">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
            {availableFiscalYears.length > 0 && (
              <span className="mr-1 text-xs text-[color:var(--text-muted)]">
                ({availableFiscalYears.indexOf(selectedFiscalYear) + 1} / {availableFiscalYears.length})
              </span>
            )}
            <button
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex >= 0 && currentIndex < availableFiscalYears.length - 1) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex + 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) >= availableFiscalYears.length - 1}
              className="rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Next Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate('/management/dashboard')}
            className="rounded-md bg-[color:var(--accent-soft)] px-4 py-2 font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--surface-hover)]"
          >
            Back to Dashboard
          </button>
        </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-[color:var(--text-secondary)] shadow-sm">Loading department analysis...</div>
      ) : error ? (
        <div className="rounded-lg border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-4 text-[color:var(--danger)]">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="text-sm text-[color:var(--text-secondary)]">KPIs in Selected Year</div>
              <div className="mt-1 text-3xl font-bold text-[color:var(--text-primary)]">{analysis.totalMapped}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="text-sm text-[color:var(--text-secondary)]">Current FY KPIs</div>
              <div className="mt-1 text-3xl font-bold text-[color:var(--text-primary)]">{analysis.currentYearMapped}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="text-sm text-[color:var(--text-secondary)]">Current FY Coverage</div>
              <div className="mt-1 text-3xl font-bold text-[color:var(--success)]">{analysis.coveragePercent}%</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-hover)] px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('department')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === 'department'
                    ? 'bg-[color:var(--surface)] text-[color:var(--accent)] border border-b-0 border-[color:var(--border)]'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                    }`}
                >
                  Department KPIS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('employee')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === 'employee'
                    ? 'bg-[color:var(--surface)] text-[color:var(--accent)] border border-b-0 border-[color:var(--border)]'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                    }`}
                >
                  EMPLOYEE KPIS
                </button>
              </div>
            </div>
            {activeTab === 'department' ? (
              filteredKpis.length === 0 ? (
                <div className="p-6 text-[color:var(--text-secondary)]">No KPIs are linked to this department.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[color:var(--accent)]">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-white">KPI Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-white">Fiscal Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKpis.map((kpi) => (
                        <tr key={kpi.id} className="border-t">
                          <td className="px-4 py-2 text-[color:var(--text-primary)]">{kpi.title || '-'}</td>
                          <td className="px-4 py-2 text-[color:var(--text-secondary)]">{kpi.fin_year || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <>
                {employeeKpisLoading ? (
                  <div className="p-6 text-[color:var(--text-secondary)]">Loading employee KPIs...</div>
                ) : employeeKpiRows.length === 0 ? (
                  <div className="p-6 text-[color:var(--text-secondary)]">No employee KPIs found for this department.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[color:var(--accent)]">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-white">Data Operator</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-white">KPI Title</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-white">Fiscal Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeKpiRows.map((row) => (
                          <tr key={`${row.empId}-${row.kpiId}`} className="border-t">
                            <td className="px-4 py-2 text-[color:var(--text-primary)]">{row.name}</td>
                            <td className="px-4 py-2 text-[color:var(--text-primary)]">{row.kpiTitle}</td>
                            <td className="px-4 py-2 text-[color:var(--text-secondary)]">{row.financialYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DepartmentDetailPage;
