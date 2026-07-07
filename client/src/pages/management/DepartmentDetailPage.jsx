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
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [activeTab, setActiveTab] = useState('department');

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
        const allKpis = kpisRes?.data?.data || [];

        const kpiById = new Map(allKpis.map((kpi) => [Number(kpi.id), kpi]));
        const linkedKpis = mappings
          .map((mapping) => kpiById.get(Number(mapping.kpi_id)))
          .filter(Boolean)
          .sort((a, b) => (a?.title || '').localeCompare(b?.title || ''));

        setDepartment(departmentData);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Department Detailed Analysis</h1>
          <p className="text-gray-600 text-sm mt-1">
            {department?.department_name || department?.departmentName || `Department ${departmentId}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded shadow px-2 py-1 border border-gray-200 h-9 min-h-0">
            <button
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex > 0) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
              className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ‹
            </button>
            <span className="text-xs text-gray-500 font-medium mr-1">FY</span>
            <span className="text-sm font-bold text-gray-800 mr-1">
              {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
            </span>
            <span className="text-xs text-gray-400 mr-1">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
            {availableFiscalYears.length > 0 && (
              <span className="text-xs text-gray-400 mr-1">
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
              className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate('/management/dashboard')}
            className="px-4 py-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow border p-8 text-center text-gray-500">Loading department analysis...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow border p-4">
              <div className="text-sm text-gray-500">KPIs in Selected Year</div>
              <div className="text-3xl font-bold text-gray-800 mt-1">{analysis.totalMapped}</div>
            </div>
            <div className="bg-white rounded-lg shadow border p-4">
              <div className="text-sm text-gray-500">Current FY KPIs</div>
              <div className="text-3xl font-bold text-gray-800 mt-1">{analysis.currentYearMapped}</div>
            </div>
            <div className="bg-white rounded-lg shadow border p-4">
              <div className="text-sm text-gray-500">Current FY Coverage</div>
              <div className="text-3xl font-bold text-green-700 mt-1">{analysis.coveragePercent}%</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="border-b bg-gray-50 px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('department')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === 'department'
                    ? 'bg-white text-blue-700 border border-b-0 border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  Department KPIS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('employee')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === 'employee'
                    ? 'bg-white text-blue-700 border border-b-0 border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  EMPLOYEE KPIS
                </button>
              </div>
            </div>
            {activeTab === 'department' ? (
              filteredKpis.length === 0 ? (
                <div className="p-6 text-gray-500">No KPIs are linked to this department.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">KPI Title</th>
                        <th className="text-left px-4 py-2 font-semibold">Fiscal Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKpis.map((kpi) => (
                        <tr key={kpi.id} className="border-t">
                          <td className="px-4 py-2 text-gray-800">{kpi.title || '-'}</td>
                          <td className="px-4 py-2 text-gray-700">{kpi.fin_year || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="p-6 text-gray-500">
                Employee KPI view is ready for wiring to employee mappings for this department.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DepartmentDetailPage;
