import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../../api/axios';

export default function MgtKmiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [kmi, setKmi] = useState(location.state?.kmi || null);
  const [kpiValues, setKpiValues] = useState([]);
  const [pillers, setPillers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        if (!kmi) {
          const kmiResponse = await axios.get(`/kpis/${id}`);
          setKmi(kmiResponse.data.data);
        }
        const valuesResponse = await axios.get(`/kpi-values?kpi_id=${id}`);
        setKpiValues(valuesResponse.data.data || []);
        const pillersRes = await axios.get('/pillers');
        setPillers(pillersRes.data.data || []);
        const unitsRes = await axios.get('/unit-master');
        setUnits(unitsRes.data.data || []);
        setError('');
      } catch (err) {
        setError('Failed to load KMI details');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
    // eslint-disable-next-line
  }, [id]);

  const getPillerName = (pillerId) => pillers.find((p) => p.id === pillerId)?.piller_name || 'N/A';
  const getUnitName = (unitId) => {
    if (unitId == null) return 'N/A';
    return units.find((u) => String(u.id) === String(unitId))?.unit_name || String(unitId);
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="text-center py-10 text-blue-500 text-base">Loading KMI details...</div>
      </div>
    );
  }

  if (error || !kmi) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">{error || 'KMI not found'}</div>
        <button className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-gray-800">KMI Details</h2>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[#1B55C4]">{kmi.title}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-600 mb-1">Financial Year:</span>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium w-fit">{kmi.fin_year || 'N/A'}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">KPI Values</h3>
        </div>
        {kpiValues.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-base">No KPI values found.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit of Measurement</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Piller</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Target Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {kpiValues.map((value) => (
                    <tr key={value.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {value.kpi_type || 'manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{value.data}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getUnitName(value.uom)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getPillerName(value.piller_id)}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${value.target_required ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {value.target_required ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
