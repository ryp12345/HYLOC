import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPillerById } from '../../api/pillerApi';
import { getKPIValuesByPillar, getMonthlyDataByKPIValue } from '../../api/kpiApi';
import { getAllUnitMasters } from '../../api/unitMasterApi';
import { getUserById } from '../../api/userApi';

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
  operator,
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
      <div className="text-center mb-3">
        <h2 className="mb-1 text-lg font-semibold text-[color:var(--text-primary)]">{title}</h2>
        {operator && <div className="text-xs text-[color:var(--text-secondary)]">Data by: {operator}</div>}
      </div>
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
                  stroke="rgba(148, 163, 184, 0.24)"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(226, 232, 240, 0.75)"
                >
                  {formatY(tick)}
                </text>
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="rgba(148, 163, 184, 0.45)" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="rgba(148, 163, 184, 0.45)" strokeWidth="2" />

        <path d={targetPath} stroke="rgba(251, 191, 36, 0.8)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <path d={actualPath} stroke="rgba(56, 189, 248, 0.95)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Target dots + labels */}
        {targets.map((val, idx) => {
          const x = getX(idx);
          const y = getY(val);
          return (
            <g key={`target-${idx}`}>
              <circle cx={x} cy={y} r="4" fill="rgba(251, 191, 36, 0.95)" stroke="rgba(15, 23, 42, 0.9)" strokeWidth="1" opacity="0.85" />
              {showPointLabels && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="rgba(226, 232, 240, 0.75)">
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
              <circle cx={x} cy={y} r="4" fill="rgba(56, 189, 248, 0.95)" stroke="rgba(15, 23, 42, 0.9)" strokeWidth="1" />
              {showPointLabels && (
                <text x={x} y={y + 15} textAnchor="middle" fontSize="10" fill="rgba(226, 232, 240, 0.75)">
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
            <text key={`x-label-${idx}`} x={x} y={svgHeight - padding + 20} textAnchor="middle" fontSize="10" fill="rgba(226, 232, 240, 0.8)">
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[rgba(56,189,248,0.95)]"></div>
          <span className="text-xs text-[color:var(--text-secondary)]">Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[rgba(251,191,36,0.95)] opacity-90"></div>
          <span className="text-xs text-[color:var(--text-secondary)]">Target</span>
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

  const [userCache, setUserCache] = useState({});

  const ensureUserCached = async (userId) => {
    if (!userId) return null;
    const id = Number(userId);
    if (!Number.isFinite(id)) return null;
    if (userCache[id]) return userCache[id];
    try {
      const res = await getUserById(id);
      const u = res?.data?.data || null;
      const name = u?.name || u?.fullname || u?.username || u?.emp_name || u?.empid || null;
      setUserCache(prev => ({ ...prev, [id]: name || String(id) }));
      return name || String(id);
    } catch (err) {
      setUserCache(prev => ({ ...prev, [id]: String(id) }));
      return String(id);
    }
  };

  const getOperatorDisplay = (rows) => {
    if (!rows || rows.length === 0) return null;
    for (const row of rows) {
      if (!row) continue;
      const candidate = row.operator ?? row.data_operator ?? row.entered_by ?? row.operator_name ?? (row.user && (row.user.name || row.user.fullname)) ?? row.created_by ?? row.entered_by_name;
      if (!candidate && (row.user && (row.user.id || row.user.empid))) {
        const id = row.user.id || row.user.empid;
        if (userCache[id]) return userCache[id];
        ensureUserCached(id);
        return String(id);
      }
      if (candidate != null) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) {
          if (userCache[numeric]) return userCache[numeric];
          ensureUserCached(numeric);
          return String(numeric);
        }
        return String(candidate);
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--app-bg)]">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 px-4 py-2 font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-hover)]"
          >
            ← Back
          </button>
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">
            {pillar?.piller_name || 'Pillar Details'}
          </h1>
          {pillar?.short_name && (
            <p className="text-lg text-[color:var(--text-secondary)]">({pillar.short_name})</p>
          )}
        </div>

        {/* Summary Analysis - Moved to top */}
        {analysis.length > 0 && (
          <div className="mb-8 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h3 className="mb-4 text-2xl font-bold text-[color:var(--text-primary)]">Pillar Analysis Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Total KPIs</div>
                <div className="text-3xl font-bold text-[color:var(--accent)]">{analysis.length}</div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">On Track</div>
                <div className="text-3xl font-bold text-[color:var(--success)]">
                  {analysis.filter(a => a.achievementPercent >= 100).length}
                </div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Below Target</div>
                <div className="text-3xl font-bold text-[color:var(--danger)]">
                  {analysis.filter(a => a.achievementPercent < 100).length}
                </div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Avg Achievement</div>
                <div className="text-3xl font-bold text-[color:var(--accent)]">
                  {(analysis.reduce((sum, a) => sum + a.achievementPercent, 0) / analysis.length).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Values Charts */}
        <div className="space-y-8">
          {analysis.length === 0 ? (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center shadow-sm">
              <p className="text-lg text-[color:var(--text-secondary)]">No KPI values associated with this pillar</p>
            </div>
          ) : (
            analysis.map((item, idx) => (
              <div key={item.kpiVal.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                {/* KPI Title and Analysis */}
                <div className="mb-6">
                  <h2 className="mb-2 text-2xl font-bold text-[color:var(--text-primary)]">{item.kpiVal.data}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                      <div className="text-sm text-[color:var(--text-secondary)]">Average Actual</div>
                      <div className="text-2xl font-bold text-[color:var(--accent)]">{formatMetricValue(item.avgActual, item.currencyUnit)}</div>
                    </div>
                    <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                      <div className="text-sm text-[color:var(--text-secondary)]">Average Target</div>
                      <div className="text-2xl font-bold text-[color:var(--warning)]">{formatMetricValue(item.avgTarget, item.currencyUnit)}</div>
                    </div>
                    <div className={`rounded border border-[color:var(--border)] p-4 ${item.achievementPercent >= 100 ? 'bg-[color:var(--success-soft)]' : 'bg-[color:var(--danger-soft)]'}`}>
                      <div className="text-sm text-[color:var(--text-secondary)]">Achievement %</div>
                      <div className={`text-2xl font-bold ${item.achievementPercent >= 100 ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}`}>
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
                      operator={getOperatorDisplay(kpiDataMap[item.kpiVal.id])}
                  />
                </div>

                {/* Details */}
                <div className="mt-6 border-t border-[color:var(--border)] pt-6">
                  <detail className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    {item.kpiVal.uom && (
                      <div>
                        <span className="text-[color:var(--text-secondary)]">Unit of Measurement:</span>
                        <span className="ml-2 font-semibold text-[color:var(--text-primary)]">{getUnitDisplayName(item.kpiVal.uom)}</span>
                      </div>
                    )}
                    {item.kpiVal.kpi_type && (
                      <div>
                        <span className="text-[color:var(--text-secondary)]">KPI Type:</span>
                        <span className="ml-2 font-semibold text-[color:var(--text-primary)]">{item.kpiVal.kpi_type}</span>
                      </div>
                    )}
                    {item.kpiVal.computation_type && (
                      <div>
                        <span className="text-[color:var(--text-secondary)]">Computation Type:</span>
                        <span className="ml-2 font-semibold text-[color:var(--text-primary)]">{item.kpiVal.computation_type}</span>
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
          <div className="mt-8 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h3 className="mb-4 text-2xl font-bold text-[color:var(--text-primary)]">Pillar Analysis Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Total KPIs</div>
                <div className="text-3xl font-bold text-[color:var(--accent)]">{analysis.length}</div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">On Track</div>
                <div className="text-3xl font-bold text-[color:var(--success)]">
                  {analysis.filter(a => a.achievementPercent >= 100).length}
                </div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Below Target</div>
                <div className="text-3xl font-bold text-[color:var(--danger)]">
                  {analysis.filter(a => a.achievementPercent < 100).length}
                </div>
              </div>
              <div className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                <div className="mb-2 text-sm text-[color:var(--text-secondary)]">Avg Achievement</div>
                <div className="text-3xl font-bold text-[color:var(--accent)]">
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
          className="fixed bottom-8 right-8 rounded-full bg-[color:var(--accent)] p-3 text-white shadow-lg transition-all duration-200 hover:bg-[color:var(--accent-hover)] z-50"
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
