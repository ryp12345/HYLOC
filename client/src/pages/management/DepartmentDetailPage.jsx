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

  const analysis = useMemo(() => {
    const currentYearKpis = mappedKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === currentFiscalYear);
    const coveragePercent = mappedKpis.length > 0
      ? Math.round((currentYearKpis.length / mappedKpis.length) * 100)
      : 0;

    return {
      totalMapped: mappedKpis.length,
      currentYearMapped: currentYearKpis.length,
      coveragePercent,
    };
  }, [mappedKpis, currentFiscalYear]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Department Detailed Analysis</h1>
          <p className="text-gray-600 text-sm mt-1">
            {department?.department_name || department?.departmentName || `Department ${departmentId}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/management/dashboard')}
          className="px-4 py-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold"
        >
          Back to Dashboard
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow border p-8 text-center text-gray-500">Loading department analysis...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow border p-4">
              <div className="text-sm text-gray-500">Mapped KPIs</div>
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
            <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">Linked KPI List</div>
            {mappedKpis.length === 0 ? (
              <div className="p-6 text-gray-500">No KPIs are linked to this department.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">KPI Title</th>
                      <th className="text-left px-4 py-2 font-semibold">Fiscal Year</th>
                      <th className="text-left px-4 py-2 font-semibold">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedKpis.map((kpi) => (
                      <tr key={kpi.id} className="border-t">
                        <td className="px-4 py-2 text-gray-800">{kpi.title || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{kpi.fin_year || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{kpi.category || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DepartmentDetailPage;
