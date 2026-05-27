import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthlyData, setMonthlyData] = useState({});
  const [overallStats, setOverallStats] = useState(null);

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

        const usersRes = await axios.get('/users');
        setUsers(usersRes.data.data || []);
        
        setError('');
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        const status = err.response?.status;
        setError(`Failed to load KMI details: ${errorMsg} (Status: ${status || 'Network Error'})`);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
    // eslint-disable-next-line
  }, [id]);

  // Transform API data from long format to wide format
  const transformMonthlyData = (apiData) => {
    if (!apiData || apiData.length === 0) return [];

    const normalizeValueType = (valueType) => {
      const normalized = (valueType || '').toString().trim().toLowerCase();
      if (!normalized) return '';
      if (normalized === 'actual' || normalized === 'achieved' || normalized === 'qa' || normalized === 'gracy') return 'actual';
      if (normalized === 'target') return 'target';
      if (normalized.includes('actual') || normalized.includes('achieved')) return 'actual';
      if (normalized.includes('target')) return 'target';
      if (normalized.includes('qa') || normalized.includes('gracy')) return 'actual';
      return normalized ? 'actual' : normalized;
    };

    const parseNumeric = (value) => {
      if (value == null || value === '') return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    };
    
    const normalizeMonthValue = (value) => {
      if (value == null) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      const text = String(value).trim();
      const numeric = Number(text);
      if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;
      const monthKey = text.slice(0, 3).toLowerCase();
      const monthIndex = MONTH_LABELS.map(label => label.toLowerCase()).indexOf(monthKey);
      if (monthIndex >= 0) return monthIndex + 1;
      const parsedDate = new Date(text);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getMonth() + 1;
      return null;
    };

    // Group by month and year
    const grouped = {};
    apiData.forEach(item => {
      const month = normalizeMonthValue(item.month);
      const year = parseNumeric(item.year);
      if (!month || !year) return;

      const key = `${year}-${month}`;
      if (!grouped[key]) {
        grouped[key] = { month, year };
      }

      const valueType = normalizeValueType(item.value_type);
      const explicitActual = parseNumeric(item.actual_value ?? item.actual);
      const explicitTarget = parseNumeric(item.target_value ?? item.target);

      if (explicitActual !== null) {
        grouped[key].actual_value = explicitActual;
      }
      if (explicitTarget !== null) {
        grouped[key].target_value = explicitTarget;
      }

      if (valueType === 'target' && grouped[key].target_value == null) {
        grouped[key].target_value = parseNumeric(item.value);
      } else if (valueType === 'actual' && grouped[key].actual_value == null) {
        grouped[key].actual_value = parseNumeric(item.value);
      }
    });
    
    // Convert to array and sort by year and month
    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  };

  // Extract year from financial year format (e.g., "2025-26" -> 2025)
  const getYearParam = (finYear) => {
    if (!finYear) return null;
    // If fin_year is "2025-26", extract first year
    // If it's already a number like 2025, return as is
    if (typeof finYear === 'number') return finYear;
    const match = String(finYear).match(/^(\d{4})/);
    return match ? parseInt(match[1]) : null;
  };

  // Load all monthly data for overview stats
  useEffect(() => {
    const loadOverviewStats = async () => {
      if (!kpiValues.length || !kmi?.fin_year) return;

      try {
        const yearParam = getYearParam(kmi.fin_year);
        const dataPromises = kpiValues.map(async (value) => {
          try {
            const allRows = [];
            if (yearParam != null) {
              const [res1, res2] = await Promise.all([
                axios.get(`/kpi-data-values/${value.id}/monthly`, { params: { year: yearParam } }),
                axios.get(`/kpi-data-values/${value.id}/monthly`, { params: { year: yearParam + 1 } })
              ]);

              if (res1.data?.data && Array.isArray(res1.data.data)) {
                allRows.push(...res1.data.data);
              }
              if (res2.data?.data && Array.isArray(res2.data.data)) {
                allRows.push(...res2.data.data);
              }
            }

            const transformedData = transformMonthlyData(allRows);
            return { valueId: value.id, data: transformedData };
          } catch {
            return { valueId: value.id, data: [] };
          }
        });

        const allData = await Promise.all(dataPromises);
        const dataMap = {};
        allData.forEach(item => {
          dataMap[item.valueId] = item.data;
        });
        setMonthlyData(dataMap);

        // Calculate overall stats
        let totalAchievementSum = 0;
        let totalKpiWithData = 0;

        allData.forEach(({ data }, index) => {
          const value = kpiValues[index];
          const insights = calculateInsights(data, value?.target_required);
          if (insights && (insights.monthsWithData > 0 || (!insights.targetRequired && insights.monthsWithActual > 0))) {
            if (insights.targetRequired && insights.monthsWithData > 0) {
              totalAchievementSum += insights.overallAchievement;
              totalKpiWithData++;
            } else if (!insights.targetRequired && insights.monthsWithActual > 0) {
              // For non-target KPIs, we can't include in achievement average
              totalKpiWithData++;
            }
          }
        });

        if (totalKpiWithData > 0) {
          const kpiWithAchievement = allData.filter(({ data }, index) => {
            const value = kpiValues[index];
            const insights = calculateInsights(data, value?.target_required);
            return insights && insights.targetRequired && insights.monthsWithData > 0;
          }).length;

          setOverallStats({
            avgAchievementAcrossKpis: kpiWithAchievement > 0 ? totalAchievementSum / kpiWithAchievement : 0,
            kpiWithData: totalKpiWithData,
            totalKpis: kpiValues.length,
            kpiWithAchievement
          });
        }
      } catch (err) {
        // Silently handle errors in loading monthly data
      }
    };

    loadOverviewStats();
    // eslint-disable-next-line
  }, [kpiValues, kmi]);

  const getPillerName = (pillerId) => pillers.find((p) => p.id === pillerId)?.piller_name || 'N/A';
  const getUnitName = (unitId) => {
    if (unitId == null) return 'N/A';
    return units.find((u) => String(u.id) === String(unitId))?.unit_name || String(unitId);
  };

  const getOperatorDisplay = (value) => {
    if (!value) return '-';

    const directName = value.operator_name || value.data_operator_name || value.entered_by_name || value.operator;
    if (directName) {
      return String(directName);
    }

    const operatorId = value.data_operator ?? value['data operator'] ?? value.operator_empid ?? null;
    if (operatorId == null || operatorId === '') return '-';

    const matchedUser = users.find((u) => String(u.empid ?? u.id) === String(operatorId));
    if (matchedUser) {
      const fullName = [
        matchedUser.first_name ?? matchedUser.firstname ?? matchedUser.firstName,
        matchedUser.middle_name ?? matchedUser.middlename ?? matchedUser.middleName,
        matchedUser.last_name ?? matchedUser.lastname ?? matchedUser.lastName,
      ].filter((part) => part != null && String(part).trim() !== '').join(' ');

      if (fullName) return fullName;

      const fallbackName = matchedUser.name || matchedUser.fullname || matchedUser.full_name || matchedUser.username;
      if (fallbackName) return String(fallbackName);
    }

    return '-';
  };

  const getMonthName = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || month;
  };

  const calculateInsights = (data, targetRequired = true) => {
    if (!data || data.length === 0) return null;

    // Check if we have any data at all
    const hasTarget = data.some(d => d.target_value !== null && d.target_value !== undefined);
    const hasActual = data.some(d => d.actual_value !== null && d.actual_value !== undefined);
    
    if (!hasActual) return null; // At minimum, we need actual values

    // Calculate with whatever data we have
    const validData = data.filter(d => d.target_value !== null && d.actual_value !== null);
    const dataWithTarget = data.filter(d => d.target_value !== null && d.target_value !== undefined);
    const dataWithActual = data.filter(d => d.actual_value !== null && d.actual_value !== undefined);

    let achievements = [];
    let bestMonth = null;
    let worstMonth = null;
    let avgAchievement = 0;
    let trend = 'stable';
    let overallAchievement = 0;

    // For KPIs without target requirement, analyze based on actual values only
    if (!targetRequired) {
      if (dataWithActual.length > 0) {
        // Sort by actual value to find best/worst
        const sortedByActual = [...dataWithActual].sort((a, b) => parseFloat(b.actual_value) - parseFloat(a.actual_value));
        bestMonth = {
          month: sortedByActual[0].month,
          year: sortedByActual[0].year,
          value: parseFloat(sortedByActual[0].actual_value),
          isActualBased: true
        };
        worstMonth = {
          month: sortedByActual[sortedByActual.length - 1].month,
          year: sortedByActual[sortedByActual.length - 1].year,
          value: parseFloat(sortedByActual[sortedByActual.length - 1].actual_value),
          isActualBased: true
        };

        // Calculate trend based on actual values
        if (dataWithActual.length > 1) {
          const midPoint = Math.floor(dataWithActual.length / 2);
          const firstHalfAvg = dataWithActual.slice(0, midPoint).reduce((sum, d) => sum + parseFloat(d.actual_value), 0) / midPoint;
          const secondHalfAvg = dataWithActual.slice(midPoint).reduce((sum, d) => sum + parseFloat(d.actual_value), 0) / (dataWithActual.length - midPoint);
          const percentChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
          trend = percentChange > 10 ? 'improving' : percentChange < -10 ? 'declining' : 'stable';
        }
      }
    } else {
      // For KPIs with target requirement, calculate achievement
      if (validData.length > 0) {
        achievements = validData.map(d => ({
          month: d.month,
          year: d.year,
          achievement: d.target_value !== 0 ? (d.actual_value / d.target_value) * 100 : 0,
          variance: d.actual_value - d.target_value
        }));

        avgAchievement = achievements.reduce((sum, a) => sum + a.achievement, 0) / achievements.length;

        const sortedByAchievement = [...achievements].sort((a, b) => b.achievement - a.achievement);
        bestMonth = sortedByAchievement[0];
        worstMonth = sortedByAchievement[sortedByAchievement.length - 1];

        // Calculate trend
        if (achievements.length > 1) {
          const midPoint = Math.floor(achievements.length / 2);
          const firstHalfAvg = achievements.slice(0, midPoint).reduce((sum, a) => sum + a.achievement, 0) / midPoint;
          const secondHalfAvg = achievements.slice(midPoint).reduce((sum, a) => sum + a.achievement, 0) / (achievements.length - midPoint);
          trend = secondHalfAvg > firstHalfAvg + 5 ? 'improving' : secondHalfAvg < firstHalfAvg - 5 ? 'declining' : 'stable';
        }
      }
    }

    const totalTarget = dataWithTarget.reduce((sum, d) => sum + parseFloat(d.target_value || 0), 0);
    const totalActual = dataWithActual.reduce((sum, d) => sum + parseFloat(d.actual_value || 0), 0);
    overallAchievement = totalTarget !== 0 ? (totalActual / totalTarget) * 100 : 0;

    return {
      targetRequired,
      overallAchievement,
      avgAchievement,
      bestMonth,
      worstMonth,
      trend,
      totalTarget,
      totalActual,
      monthsWithData: validData.length,
      monthsWithTarget: dataWithTarget.length,
      monthsWithActual: dataWithActual.length,
      hasPartialData: targetRequired && validData.length === 0 && hasTarget && hasActual
    };
  };

  const getPerformanceColor = (achievement) => {
    if (achievement >= 100) return 'bg-green-100 text-green-800';
    if (achievement >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPerformanceStatus = (achievement) => {
    if (achievement >= 100) return '✓ Exceeds Target';
    if (achievement >= 80) return '⚠ Near Target';
    return '✗ Below Target';
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
      <div className="bg-white rounded-lg shadow p-3 mb-3">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-base font-bold text-[#1B55C4]">{kmi.title}</span>
          <span className="text-xs font-semibold text-gray-600">Financial Year:</span>
          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium w-fit">{kmi.fin_year || 'N/A'}</span>
        </div>
      </div>

      {/* Overall Performance Summary */}
      {overallStats && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-3 mb-3 border border-blue-200">
          <h3 className="text-base font-bold text-gray-800 mb-2">📊 Overall Performance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Average Achievement</div>
              {overallStats.kpiWithAchievement > 0 ? (
                <>
                  <div className={`text-xl font-bold ${overallStats.avgAchievementAcrossKpis >= 100 ? 'text-green-600' : overallStats.avgAchievementAcrossKpis >= 80 ? 'text-yellow-600' : 'text-red-600'}`}> 
                    {overallStats.avgAchievementAcrossKpis.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Target-based KPIs only</div>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-gray-400">-</div>
                  <div className="text-xs text-gray-600 mt-0.5">No target-based data</div>
                </>
              )}
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-0.5">KPI Coverage</div>
              <div className="text-xl font-bold text-blue-600">
                {overallStats.kpiWithData}/{overallStats.totalKpis}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">KPIs with data available</div>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Overall Status</div>
              {overallStats.kpiWithAchievement > 0 ? (
                <>
                  <div className={`text-base font-bold ${overallStats.avgAchievementAcrossKpis >= 100 ? 'text-green-600' : overallStats.avgAchievementAcrossKpis >= 80 ? 'text-yellow-600' : 'text-red-600'}`}> 
                    {overallStats.avgAchievementAcrossKpis >= 100 ? '✓ Exceeding Targets' : overallStats.avgAchievementAcrossKpis >= 80 ? '⚠ On Track' : '✗ Needs Attention'}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Performance indicator</div>
                </>
              ) : (
                <>
                  <div className="text-base font-bold text-blue-600">📊 Tracking</div>
                  <div className="text-xs text-gray-600 mt-0.5">Monitoring actuals</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">KPI Values</h3>
        </div>
        {kpiValues.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-base">No KPI values found.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">Data</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">Data Operator</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">Unit of Measurement</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider">Piller</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 uppercase tracking-wider">Target Required</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 uppercase tracking-wider">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kpiValues.map((value) => {
                    const valueInsights = monthlyData[value.id] ? calculateInsights(monthlyData[value.id], value.target_required) : null;
                    return (
                    <React.Fragment key={value.id}>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td className="px-2 py-2 text-gray-800">
                          <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-medium">
                            {value.kpi_type || 'manual'}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-medium text-gray-900">{value.data}</td>
                        <td className="px-2 py-2 text-gray-600">
                          {getOperatorDisplay(value)}
                        </td>
                        <td className="px-2 py-2 text-gray-600">{getUnitName(value.uom)}</td>
                        <td className="px-2 py-2 text-gray-600">{getPillerName(value.piller_id)}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${value.target_required ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {value.target_required ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {valueInsights ? (
                            !value.target_required ? (
                              // For non-target KPIs, show actual trend
                              valueInsights.monthsWithActual > 0 ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">
                                    {valueInsights.totalActual.toFixed(1)}
                                  </span>
                                  <span className={`text-xs ${valueInsights.trend === 'improving' ? 'text-green-600' : valueInsights.trend === 'declining' ? 'text-red-600' : 'text-gray-500'}`}>
                                    {valueInsights.trend === 'improving' ? '↗' : valueInsights.trend === 'declining' ? '↘' : '→'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No data</span>
                              )
                            ) : (
                              // For target-required KPIs, show achievement
                              valueInsights.monthsWithData > 0 ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getPerformanceColor(valueInsights.overallAchievement)}`}>
                                    {valueInsights.overallAchievement.toFixed(0)}%
                                  </span>
                                  <span className={`text-xs ${valueInsights.trend === 'improving' ? 'text-green-600' : valueInsights.trend === 'declining' ? 'text-red-600' : 'text-gray-500'}`}>
                                    {valueInsights.trend === 'improving' ? '↗' : valueInsights.trend === 'declining' ? '↘' : '→'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-xs text-yellow-600 font-medium">Partial</span>
                                  <span className="text-xs text-gray-500">
                                    T:{valueInsights.monthsWithTarget} A:{valueInsights.monthsWithActual}
                                  </span>
                                </div>
                              )
                            )
                          ) : monthlyData[value.id] !== undefined ? (
                            <span className="text-xs text-gray-400">No data</span>
                          ) : (
                            <span className="text-xs text-gray-400">Loading...</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan="7" className="px-0 py-0 bg-gradient-to-r from-gray-50 to-blue-50">
                            <div className="px-8 py-6">
                              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                📊 Analytics for Financial Year {kmi?.fin_year || 'N/A'}
                              </h4>
                              {monthlyData[value.id] === undefined ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="text-sm text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                                    <span className="animate-pulse">⏳ Loading analytics data...</span>
                                  </div>
                                </div>
                              ) : monthlyData[value.id]?.length === 0 ? (
                                <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-lg shadow-sm">
                                  <div className="flex items-start gap-3">
                                    <div className="text-3xl">📋</div>
                                    <div>
                                      <h5 className="text-base font-bold text-amber-800 mb-2">No Monthly Data Available</h5>
                                      <p className="text-sm text-gray-700 mb-3">
                                        No monthly performance data has been entered for this KPI in financial year <strong>{kmi?.fin_year || 'N/A'}</strong>.
                                      </p>
                                      <div className="bg-white rounded p-3 border border-amber-200">
                                        <p className="text-sm text-gray-600 mb-2">
                                          <strong>To see analytics and insights:</strong>
                                        </p>
                                        <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                                          {value.target_required ? (
                                            <>
                                              <li>Enter both <strong>target values</strong> and <strong>actual values</strong> for each month</li>
                                              <li>Analytics will show achievement %, trends, and variance analysis</li>
                                            </>
                                          ) : (
                                            <>
                                              <li>Enter <strong>actual values</strong> for each month</li>
                                              <li>Analytics will show trends and statistical summaries</li>
                                            </>
                                          )}
                                          <li>Data can be entered through the KPI data entry interface</li>
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {(() => {
                                    const insights = calculateInsights(monthlyData[value.id], value.target_required);
                                    return insights ? (
                                      <div className="space-y-4">
                                        {/* Data Coverage Info */}
                                        {insights.hasPartialData && (
                                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                                            <p className="text-sm text-yellow-800">
                                              ℹ️ Partial data available: {insights.monthsWithTarget} months with targets, {insights.monthsWithActual} months with actuals. 
                                              Achievement metrics require both values for the same month.
                                            </p>
                                          </div>
                                        )}
                                        
                                        {/* Summary Cards - Different layouts for target vs non-target KPIs */}
                                        {!value.target_required ? (
                                          // Non-target KPI summary cards
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Total Actual</div>
                                              <div className="text-lg font-bold text-blue-600">
                                                {insights.totalActual.toFixed(2)}
                                              </div>
                                              <div className="text-[10px] text-gray-600 mt-0.5">
                                                {insights.monthsWithActual} months recorded
                                              </div>
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Average Monthly</div>
                                              <div className="text-lg font-bold text-indigo-600">
                                                {insights.monthsWithActual > 0 ? (insights.totalActual / insights.monthsWithActual).toFixed(2) : '0.00'}
                                              </div>
                                              <div className="text-[10px] text-gray-600 mt-0.5">
                                                Per month average
                                              </div>
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Highest Month</div>
                                              {insights.bestMonth ? (
                                                <>
                                                  <div className="text-xs font-bold text-green-600">
                                                    {getMonthName(insights.bestMonth.month)} '{insights.bestMonth.year % 100}
                                                  </div>
                                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                                    Value: {insights.bestMonth.value.toFixed(2)}
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="text-xs font-bold text-gray-400">-</div>
                                              )}
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Trend</div>
                                              <div className={`text-xs font-bold ${insights.trend === 'improving' ? 'text-green-600' : insights.trend === 'declining' ? 'text-red-600' : 'text-gray-600'}`}> 
                                                {insights.trend === 'improving' ? '↗ Increasing' : insights.trend === 'declining' ? '↘ Decreasing' : '→ Stable'}
                                              </div>
                                              <div className="text-[10px] text-gray-600 mt-0.5">
                                                Based on {insights.monthsWithActual} months
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          // Target-based KPI summary cards
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Overall Achievement</div>
                                              {insights.monthsWithData > 0 ? (
                                                <>
                                                  <div className={`text-lg font-bold ${insights.overallAchievement >= 100 ? 'text-green-600' : insights.overallAchievement >= 80 ? 'text-yellow-600' : 'text-red-600'}`}> 
                                                    {insights.overallAchievement.toFixed(1)}%
                                                  </div>
                                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                                    {insights.totalActual.toFixed(1)} / {insights.totalTarget.toFixed(1)}
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="text-lg font-bold text-gray-400">-</div>
                                                  <div className="text-[10px] text-gray-500 mt-0.5">Need paired data</div>
                                                </>
                                              )}
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Avg Monthly Achievement</div>
                                              {insights.monthsWithData > 0 ? (
                                                <>
                                                  <div className="text-lg font-bold text-blue-600">
                                                    {insights.avgAchievement.toFixed(1)}%
                                                  </div>
                                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                                    {insights.monthsWithData} months paired
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="text-lg font-bold text-gray-400">-</div>
                                                  <div className="text-[10px] text-gray-500 mt-0.5">No paired data</div>
                                                </>
                                              )}
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Best Month</div>
                                              {insights.bestMonth ? (
                                                <>
                                                  <div className="text-xs font-bold text-green-600">
                                                    {getMonthName(insights.bestMonth.month)} '{insights.bestMonth.year % 100}
                                                  </div>
                                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                                    {insights.bestMonth.achievement.toFixed(1)}% achievement
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="text-xs font-bold text-gray-400">-</div>
                                                  <div className="text-[10px] text-gray-500 mt-0.5">Need paired data</div>
                                                </>
                                              )}
                                            </div>
                                            <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Trend</div>
                                              {insights.monthsWithData > 0 ? (
                                                <>
                                                  <div className={`text-xs font-bold ${insights.trend === 'improving' ? 'text-green-600' : insights.trend === 'declining' ? 'text-red-600' : 'text-gray-600'}`}> 
                                                    {insights.trend === 'improving' ? '↗ Improving' : insights.trend === 'declining' ? '↘ Declining' : '→ Stable'}
                                                  </div>
                                                  <div className="text-[10px] text-gray-600 mt-0.5">
                                                    Based on {insights.monthsWithData} months
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="text-xs font-bold text-gray-400">-</div>
                                                  <div className="text-[10px] text-gray-500 mt-0.5">Need paired data</div>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Monthly Data Bar Chart */}
                                        <div className="w-full h-64">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyData[value.id]?.map(d => ({
                                              name: `${getMonthName(d.month)} ${d.year}`,
                                              Actual: d.actual_value,
                                              ...(value.target_required ? { Target: d.target_value } : {})
                                            })) || []} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                              <CartesianGrid strokeDasharray="3 3" />
                                              <XAxis dataKey="name" fontSize={10} />
                                              <YAxis fontSize={10} />
                                              <Tooltip />
                                              <Legend />
                                              <Bar dataKey="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                              {value.target_required && (
                                                <Bar dataKey="Target" fill="#f59e42" radius={[4, 4, 0, 0]} />
                                              )}
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-blue-800 font-medium mb-2">📋 Data Entry Status</p>
                                        <p className="text-sm text-gray-700">
                                          No monthly data has been entered yet for this KPI value in financial year {kmi?.fin_year || 'N/A'}. 
                                          {value.target_required 
                                            ? ' Please ensure both target and actual values are entered for each month to enable performance analytics.'
                                            : ' Please enter actual values for each month to enable trend analytics.'
                                          }
                                        </p>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                    </React.Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}