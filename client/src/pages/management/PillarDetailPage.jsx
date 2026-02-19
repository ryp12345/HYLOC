import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPillerById } from '../../api/pillerApi';
import { getKPIValuesByPillar, getMonthlyDataByKPIValue } from '../../api/kpiApi';
import { getAllUnitMasters } from '../../api/unitMasterApi';

const FISCAL_MONTHS = [
  { label: 'Apr', month: 4, yearOffset: 0 },
  { label: 'May', month: 5, yearOffset: 0 },
  { label: 'Jun', month: 6, yearOffset: 0 },
  { label: 'Jul', month: 7, yearOffset: 0 },
  { label: 'Aug', month: 8, yearOffset: 0 },
  { label: 'Sep', month: 9, yearOffset: 0 },
  { label: 'Oct', month: 10, yearOffset: 0 },
  { label: 'Nov', month: 11, yearOffset: 0 },
  { label: 'Dec', month: 12, yearOffset: 0 },
  { label: 'Jan', month: 1, yearOffset: 1 },
  { label: 'Feb', month: 2, yearOffset: 1 },
  { label: 'Mar', month: 3, yearOffset: 1 },
];

const formatIndianCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric)}`;
};

const formatIndianNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
};

// Simple Line Chart Component for KPI visualization
const KPILineChart = ({
  title,
  labels,
  actuals,
  targets,
  yAxisFormatter,
  showAxisLabels = true,
  showPointLabels = false,
  xAxisTitle = 'Month',
  yAxisTitle = 'Value',
}) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals.filter(Number.isFinite), ...targets.filter(Number.isFinite), 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * plotWidth;
  const getY = (val) => svgHeight - padding - ((val - minVal) / range) * plotHeight;

  const formatVal = (v) => {
    if (!Number.isFinite(v)) return String(v);
    if (range < 10) return v.toFixed(1);
    if (Math.abs(v) >= 1000) return Math.round(v).toString();
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  };
  const formatY = yAxisFormatter || ((v) => formatVal(v));

  const actualPath = actuals
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');
  const targetPath = targets
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');

  return (
    <div className="w-full h-full flex flex-col">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full flex-1" style={{ maxHeight: '300px' }}>
        {/* Grid lines + Y ticks */}
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padding}
                  y1={y}
                  x2={svgWidth - padding}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#666"
                >
                  {formatY(tick)}
                </text>
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        <path d={targetPath} stroke="#ffb74d" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <path d={actualPath} stroke="#41aafe" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Target dots + labels */}
        {targets.map((val, idx) => {
          const x = getX(idx);
          const y = getY(val);
          return (
            <g key={`target-${idx}`}>
              <circle cx={x} cy={y} r="4" fill="#ffb74d" stroke="white" strokeWidth="1" opacity="0.7" />
              {showPointLabels && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="#666">
                  {formatVal(val)}
                </text>
              )}
            </g>
          );
        })}

        {/* Actual dots + labels */}
        {actuals.map((val, idx) => {
          const x = getX(idx);
          const y = getY(val);
          return (
            <g key={`actual-${idx}`}>
              <circle cx={x} cy={y} r="4" fill="#41aafe" stroke="white" strokeWidth="1" />
              {showPointLabels && (
                <text x={x} y={y + 15} textAnchor="middle" fontSize="10" fill="#666">
                  {formatVal(val)}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {showAxisLabels && labels.map((label, idx) => {
          const x = getX(idx);
          return (
            <text key={`x-label-${idx}`} x={x} y={svgHeight - padding + 20} textAnchor="middle" fontSize="10" fill="#666">
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#41aafe] rounded"></div>
          <span className="text-xs text-gray-700">Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#ffb74d] rounded opacity-70"></div>
          <span className="text-xs text-gray-700">Target</span>
        </div>
      </div>
    </div>
  );
};

export default function PillarDetailPage() {
  const { pillerId } = useParams();
  const navigate = useNavigate();
  const [pillar, setPillar] = useState(null);
  const [kpiValues, setKpiValues] = useState([]);
  const [kpiDataMap, setKpiDataMap] = useState({});
  const [unitMap, setUnitMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Get fiscal year based on current date (Jan-Mar = previous year, Apr-Dec = current year)
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = now.getFullYear();
    return currentMonth >= 4 ? currentYear : currentYear - 1;
  };

  const fiscalYear = getCurrentFiscalYear();

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const loadPillarData = async () => {
      setLoading(true);
      try {
        // Fetch pillar details, KPI values, and unit master data in parallel
        const [pillarRes, kpiRes, unitRes] = await Promise.all([
          getPillerById(pillerId),
          getKPIValuesByPillar(pillerId),
          getAllUnitMasters(),
        ]);

        setPillar(pillarRes.data?.data);

        // Build unit map by id for resolving uom labels
        const units = unitRes.data?.data || [];
        const unitsById = units.reduce((acc, unit) => {
          if (unit?.id != null) {
            acc[Number(unit.id)] = unit;
          }
          return acc;
        }, {});
        setUnitMap(unitsById);

        // KPI values associated with this pillar
        const kpiVals = kpiRes.data?.data || [];
        setKpiValues(kpiVals);

        // Fetch data for each KPI value
        if (kpiVals.length > 0) {
          const dataMap = {};
          for (const kpiVal of kpiVals) {
            try {
              const allMonthlyData = [];
              
              // Get data for first calendar year (April-December)
              try {
                const dataRes1 = await getMonthlyDataByKPIValue(kpiVal.id, fiscalYear);
                if (dataRes1.data?.data && Array.isArray(dataRes1.data.data)) {
                  allMonthlyData.push(...dataRes1.data.data);
                }
              } catch (err) {
                // No data available for this year
              }
              
              // Get data for second calendar year (January-March)
              try {
                const dataRes2 = await getMonthlyDataByKPIValue(kpiVal.id, fiscalYear + 1);
                if (dataRes2.data?.data && Array.isArray(dataRes2.data.data)) {
                  allMonthlyData.push(...dataRes2.data.data);
                }
              } catch (err) {
                // No data available for next year
              }
              
              dataMap[kpiVal.id] = allMonthlyData;
            } catch (error) {
              console.error(`Error fetching data for KPI ${kpiVal.id}:`, error);
              dataMap[kpiVal.id] = [];
            }
          }
          setKpiDataMap(dataMap);
        }
      } catch (error) {
        console.error('Error loading pillar data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPillarData();
  }, [pillerId, fiscalYear]);

  const getChartData = (kpiValueId) => {
    const data = kpiDataMap[kpiValueId] || [];

    const normalizeValueType = (valueType) => {
      const type = String(valueType || '').toLowerCase();
      if (type.includes('target')) return 'target';
      if (type.includes('actual') || type.includes('achiev')) return 'actual';
      return '';
    };

    const toNumberOrZero = (value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const pickLatestRow = (rows) => {
      if (!rows || rows.length === 0) return null;

      return rows.reduce((latest, current) => {
        const latestId = Number(latest?.id || 0);
        const currentId = Number(current?.id || 0);
        return currentId > latestId ? current : latest;
      }, rows[0]);
    };

    const getMonthValue = (month, year, type) => {
      const monthEntries = data.filter((entry) => (
        Number(entry.month) === month && Number(entry.year) === year
      ));

      const typedRows = monthEntries.filter((entry) => normalizeValueType(entry.value_type) === type);
      const typedEntry = pickLatestRow(typedRows);
      if (typedEntry) {
        return toNumberOrZero(typedEntry.value);
      }

      const monthOnlyRows = data.filter((entry) => Number(entry.month) === month);
      const monthOnlyTypedRows = monthOnlyRows.filter((entry) => normalizeValueType(entry.value_type) === type);
      const monthOnlyTypedEntry = pickLatestRow(monthOnlyTypedRows);
      if (monthOnlyTypedEntry) {
        return toNumberOrZero(monthOnlyTypedEntry.value);
      }

      const aggregatedRows = monthEntries.filter((entry) =>
        type === 'target' ? entry.target_value !== undefined : entry.actual_value !== undefined
      );
      const aggregatedEntry = pickLatestRow(aggregatedRows);

      if (aggregatedEntry) {
        return type === 'target'
          ? toNumberOrZero(aggregatedEntry.target_value)
          : toNumberOrZero(aggregatedEntry.actual_value);
      }

      const monthOnlyAggregatedRows = monthOnlyRows.filter((entry) =>
        type === 'target' ? entry.target_value !== undefined : entry.actual_value !== undefined
      );
      const monthOnlyAggregatedEntry = pickLatestRow(monthOnlyAggregatedRows);
      if (monthOnlyAggregatedEntry) {
        return type === 'target'
          ? toNumberOrZero(monthOnlyAggregatedEntry.target_value)
          : toNumberOrZero(monthOnlyAggregatedEntry.actual_value);
      }

      return 0;
    };

    const actuals = FISCAL_MONTHS.map(({ month, yearOffset }) =>
      getMonthValue(month, fiscalYear + yearOffset, 'actual')
    );

    const targets = FISCAL_MONTHS.map(({ month, yearOffset }) =>
      getMonthValue(month, fiscalYear + yearOffset, 'target')
    );

    return {
      actuals,
      targets,
      labels: FISCAL_MONTHS.map(({ label }) => label),
    };
  };

  const getUnitDisplayName = (uom) => {
    if (uom === null || uom === undefined || uom === '') return '-';

    const unitId = Number(uom);
    if (!Number.isNaN(unitId) && unitMap[unitId]?.unit_name) {
      return unitMap[unitId].unit_name;
    }

    return String(uom);
  };

  const isRupeeUnit = (uom) => {
    const unitText = getUnitDisplayName(uom).toLowerCase();
    return unitText.includes('rupee') || unitText.includes('inr') || unitText === 'rs' || unitText === 'rs.';
  };

  const formatMetricValue = (value, isCurrency) => (
    isCurrency ? formatIndianCurrency(value) : formatIndianNumber(value)
  );

  const analysis = kpiValues.map(kpiVal => {
    const chartData = getChartData(kpiVal.id);
    const currencyUnit = isRupeeUnit(kpiVal.uom);
    const avgActual = chartData.actuals.filter(v => v > 0).length > 0
      ? chartData.actuals.reduce((a, b) => a + b, 0) / chartData.actuals.filter(v => v > 0).length
      : 0;
    const avgTarget = chartData.targets.filter(v => v > 0).length > 0
      ? chartData.targets.reduce((a, b) => a + b, 0) / chartData.targets.filter(v => v > 0).length
      : 0;
    const achievementPercent = avgTarget > 0 ? (avgActual / avgTarget) * 100 : 0;

    return {
      kpiVal,
      chartData,
      currencyUnit,
      avgActual,
      avgTarget,
      achievementPercent
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            {pillar?.piller_name || 'Pillar Details'}
          </h1>
          {pillar?.short_name && (
            <p className="text-lg text-gray-600">({pillar.short_name})</p>
          )}
        </div>

        {/* Summary Analysis - Moved to top */}
        {analysis.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Pillar Analysis Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Total KPIs</div>
                <div className="text-3xl font-bold text-blue-600">{analysis.length}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">On Track</div>
                <div className="text-3xl font-bold text-green-600">
                  {analysis.filter(a => a.achievementPercent >= 100).length}
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Below Target</div>
                <div className="text-3xl font-bold text-red-600">
                  {analysis.filter(a => a.achievementPercent < 100).length}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Avg Achievement</div>
                <div className="text-3xl font-bold text-purple-600">
                  {(analysis.reduce((sum, a) => sum + a.achievementPercent, 0) / analysis.length).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Values Charts */}
        <div className="space-y-8">
          {analysis.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">No KPI values associated with this pillar</p>
            </div>
          ) : (
            analysis.map((item, idx) => (
              <div key={item.kpiVal.id} className="bg-white rounded-lg shadow p-6">
                {/* KPI Title and Analysis */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.kpiVal.data}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded p-4">
                      <div className="text-sm text-gray-600">Average Actual</div>
                      <div className="text-2xl font-bold text-blue-600">{formatMetricValue(item.avgActual, item.currencyUnit)}</div>
                    </div>
                    <div className="bg-orange-50 rounded p-4">
                      <div className="text-sm text-gray-600">Average Target</div>
                      <div className="text-2xl font-bold text-orange-600">{formatMetricValue(item.avgTarget, item.currencyUnit)}</div>
                    </div>
                    <div className={`rounded p-4 ${item.achievementPercent >= 100 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-sm text-gray-600">Achievement %</div>
                      <div className={`text-2xl font-bold ${item.achievementPercent >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.achievementPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="overflow-x-auto">
                  <KPILineChart
                    title={item.kpiVal.data}
                    labels={item.chartData.labels}
                    actuals={item.chartData.actuals}
                    targets={item.chartData.targets}
                    yAxisFormatter={(value) => item.currencyUnit ? formatIndianCurrency(value) : formatIndianNumber(value)}
                  />
                </div>

                {/* Details */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <detail className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {item.kpiVal.uom && (
                      <div>
                        <span className="text-gray-600">Unit of Measurement:</span>
                        <span className="ml-2 font-semibold text-gray-900">{getUnitDisplayName(item.kpiVal.uom)}</span>
                      </div>
                    )}
                    {item.kpiVal.kpi_type && (
                      <div>
                        <span className="text-gray-600">KPI Type:</span>
                        <span className="ml-2 font-semibold text-gray-900">{item.kpiVal.kpi_type}</span>
                      </div>
                    )}
                    {item.kpiVal.computation_type && (
                      <div>
                        <span className="text-gray-600">Computation Type:</span>
                        <span className="ml-2 font-semibold text-gray-900">{item.kpiVal.computation_type}</span>
                      </div>
                    )}
                  </detail>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Analysis */}
        {analysis.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Pillar Analysis Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Total KPIs</div>
                <div className="text-3xl font-bold text-blue-600">{analysis.length}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">On Track</div>
                <div className="text-3xl font-bold text-green-600">
                  {analysis.filter(a => a.achievementPercent >= 100).length}
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Below Target</div>
                <div className="text-3xl font-bold text-red-600">
                  {analysis.filter(a => a.achievementPercent < 100).length}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded p-4">
                <div className="text-sm text-gray-600 mb-2">Avg Achievement</div>
                <div className="text-3xl font-bold text-purple-600">
                  {(analysis.reduce((sum, a) => sum + a.achievementPercent, 0) / analysis.length).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 z-50"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
