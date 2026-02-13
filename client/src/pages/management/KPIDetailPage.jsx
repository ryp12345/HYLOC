import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getKPIById, getChildKPIs, getKPIValuesByKPI, getMonthlyDataByKPIValue } from '../../api/kpiApi';
import { useAuth } from '../../context/AuthContext';

const KPIDetailPage = () => {
  const { kpiId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [parentKPI, setParentKPI] = useState(null);
  const [childKPIs, setChildKPIs] = useState([]);
  const [kpiDataMap, setKpiDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [analytics, setAnalytics] = useState({});

  useEffect(() => {
    loadKPIDetails();
  }, [kpiId, selectedYear]);

  const loadKPIDetails = async () => {
    try {
      setLoading(true);

      // Load parent KPI
      const kpiRes = await getKPIById(kpiId);
      setParentKPI(kpiRes.data.data);

      // Load child KPIs
      const childRes = await getChildKPIs(kpiId);
      setChildKPIs(childRes.data.data);

      // Load data for each child KPI
      const dataMap = {};
      for (const childKPI of childRes.data.data) {
        const valuesRes = await getKPIValuesByKPI(childKPI.id);
        const values = valuesRes.data.data;

        // Load monthly data for each KPI value
        const monthlyData = {};
        for (const value of values) {
          const dataRes = await getMonthlyDataByKPIValue(value.id, selectedYear);
          monthlyData[value.id] = dataRes.data.data;
        }

        dataMap[childKPI.id] = {
          values,
          monthlyData,
        };
      }

      setKpiDataMap(dataMap);
      generateAnalytics(childRes.data.data, dataMap);
    } catch (error) {
      console.error('Error loading KPI details:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalytics = (childKPIs, dataMap) => {
    const analyticsData = {};

    for (const kpi of childKPIs) {
      const kpiData = dataMap[kpi.id];
      if (!kpiData) continue;

      const insights = [];
      let overallTrend = 'STABLE';
      let performanceStatus = 'NEUTRAL';

      // Analyze each KPI value
      for (const value of kpiData.values) {
        const monthlyValues = kpiData.monthlyData[value.id] || [];

        if (monthlyValues.length === 0) {
          insights.push(`No data available for ${value.data}`);
          continue;
        }

        // Separate actual and target values
        const actuals = monthlyValues
          .filter((d) => d.value_type === 'Achieved')
          .sort((a, b) => a.month - b.month);

        const targets = monthlyValues
          .filter((d) => d.value_type === 'Target')
          .sort((a, b) => a.month - b.month);

        if (actuals.length > 0) {
          const latestActual = actuals[actuals.length - 1].value;
          const latestTarget = targets.length > 0 ? targets[targets.length - 1].value : null;

          // Calculate trend
          if (actuals.length > 1) {
            const previousActual = actuals[actuals.length - 2].value;
            const trend = latestActual > previousActual ? 'UP' : latestActual < previousActual ? 'DOWN' : 'STABLE';
            overallTrend = trend;

            const trendPercent = ((latestActual - previousActual) / previousActual * 100).toFixed(2);
            if (trend === 'UP') {
              insights.push(`${value.data}: Positive trend (+${trendPercent}%)`);
              performanceStatus = 'EXCELLENT';
            } else if (trend === 'DOWN') {
              insights.push(`${value.data}: Declining trend (${trendPercent}%)`);
              performanceStatus = 'NEEDS_ATTENTION';
            }
          }

          // Compare with target
          if (latestTarget && latestActual !== null) {
            const variance = ((latestActual - latestTarget) / latestTarget * 100).toFixed(2);
            if (latestActual >= latestTarget) {
              insights.push(`${value.data}: Target achieved (+${variance}% above target)`);
              if (performanceStatus !== 'EXCELLENT') performanceStatus = 'GOOD';
            } else {
              insights.push(`${value.data}: Below target (${variance}% shortfall)`);
              performanceStatus = 'NEEDS_ATTENTION';
            }
          }
        }
      }

      analyticsData[kpi.id] = {
        insights: insights.length > 0 ? insights : ['No specific insights available'],
        trend: overallTrend,
        status: performanceStatus,
      };
    }

    setAnalytics(analyticsData);
  };

  const LineChart = ({ data, title }) => {
    if (!data || data.length === 0) {
      return <div className="text-gray-500">No data available</div>;
    }

    const actuals = data.filter((d) => d.value_type === 'Achieved').map((d) => d.value);
    const targets = data.filter((d) => d.value_type === 'Target').map((d) => d.value);
    const months = [...new Set(data.map((d) => d.month))].sort((a, b) => a - b);

    const maxVal = Math.max(...actuals, ...targets, 1);
    const svgWidth = 600;
    const svgHeight = 300;
    const padding = 50;

    const getX = (idx) => padding + (idx / (months.length - 1 || 1)) * (svgWidth - 2 * padding);
    const getY = (val) => svgHeight - padding - (val / maxVal) * (svgHeight - 2 * padding);

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
          {/* Grid lines */}
          {[...Array(5)].map((_, i) => {
            const y = padding + (i * (svgHeight - 2 * padding)) / 4;
            return (
              <line
                key={`grid-${i}`}
                x1={padding}
                y1={y}
                x2={svgWidth - padding}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            );
          })}

          {/* Axes */}
          <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
          <line
            x1={padding}
            y1={svgHeight - padding}
            x2={svgWidth - padding}
            y2={svgHeight - padding}
            stroke="#1f2937"
            strokeWidth="2"
          />

          {/* Target line */}
          {targets.length > 0 && (
            <polyline
              points={targets.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
              fill="none"
              stroke="#ffb74d"
              strokeWidth="2"
            />
          )}

          {/* Actual line */}
          {actuals.length > 0 && (
            <polyline
              points={actuals.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
              fill="none"
              stroke="#41aafe"
              strokeWidth="3"
            />
          )}

          {/* X-axis labels */}
          {months.map((month, idx) => (
            <text key={`x-${month}`} x={getX(idx)} y={svgHeight - padding + 25} textAnchor="middle" fontSize="12" fill="#4b5563">
              {monthLabels[month - 1]}
            </text>
          ))}
        </svg>

        {/* Legend */}
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 bg-[#41aafe] rounded"></span>
            <span className="text-sm text-gray-600">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 bg-[#ffb74d] rounded"></span>
            <span className="text-sm text-gray-600">Target</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading KPI details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 font-semibold mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-900">{parentKPI?.title}</h1>
          <p className="text-gray-600 mt-2">Detailed KPI Analysis for {selectedYear}</p>

          {/* Year Selector */}
          <div className="mt-4">
            <label className="text-gray-700 font-semibold mr-3">Select Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Main Content */}
        {childKPIs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No child KPIs found for this KPI.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {childKPIs.map((childKPI) => {
              const kpiData = kpiDataMap[childKPI.id];
              const kpiAnalytics = analytics[childKPI.id];

              if (!kpiData) return null;

              return (
                <div key={childKPI.id} className="bg-white rounded-lg shadow p-6">
                  {/* Child KPI Header */}
                  <div className="mb-6 pb-4 border-b-2 border-gray-200">
                    <div className="flex justify-between items-start">
                      <h2 className="text-2xl font-bold text-gray-800">{childKPI.title}</h2>
                      {kpiAnalytics && (
                        <div
                          className={`px-4 py-2 rounded-full font-semibold text-white ${
                            kpiAnalytics.status === 'EXCELLENT'
                              ? 'bg-green-500'
                              : kpiAnalytics.status === 'GOOD'
                              ? 'bg-blue-500'
                              : kpiAnalytics.status === 'NEEDS_ATTENTION'
                              ? 'bg-red-500'
                              : 'bg-gray-500'
                          }`}
                        >
                          {kpiAnalytics.status.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Charts and Data */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {kpiData.values.map((value) => (
                      <LineChart key={value.id} data={kpiData.monthlyData[value.id]} title={value.data} />
                    ))}
                  </div>

                  {/* Analytics & Insights */}
                  {kpiAnalytics && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="text-xl">📊</span> Key Insights & Analytics
                      </h3>
                      <ul className="space-y-2">
                        {kpiAnalytics.insights.map((insight, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-blue-500 font-bold mt-1">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 pt-4 border-t-2 border-blue-200">
                        <p className="text-sm font-semibold text-gray-800">
                          Overall Trend: <span className="text-blue-600">{kpiAnalytics.trend}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPIDetailPage;
