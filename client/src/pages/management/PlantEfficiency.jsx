import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  BarChart,
  Bar,
} from 'recharts';
import api from '../../api/axios';

const FISCAL_MONTH_SEQUENCE = [
  { month: 4, label: 'Apr' },
  { month: 5, label: 'May' },
  { month: 6, label: 'Jun' },
  { month: 7, label: 'Jul' },
  { month: 8, label: 'Aug' },
  { month: 9, label: 'Sep' },
  { month: 10, label: 'Oct' },
  { month: 11, label: 'Nov' },
  { month: 12, label: 'Dec' },
  { month: 1, label: 'Jan' },
  { month: 2, label: 'Feb' },
  { month: 3, label: 'Mar' },
];

const normalizeValueType = (valueType) => {
  if (!valueType) return '';
  return String(valueType).trim().toLowerCase();
};

const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : parseInt(value, 10);
  }
  return null;
};

const formatFiscalYear = (value) => {
  const parsedYear = parseFiscalYear(value);
  if (!parsedYear) return value || '-';
  return `${parsedYear}-${(parsedYear + 1).toString().slice(-2)}`;
};

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};

const getChartType = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('overall equipment') || t.includes('oee') || t.includes('ope')) return 'SPEEDOMETER';

  if (
    t.includes('management loss') ||
    t.includes('ppm') ||
    t.includes('working within the budget') ||
    t.includes('revenue per employee') ||
    t.includes('on time delivery') ||
    t.includes('hira score') ||
    t.includes('ai score')
  ) {
    return 'BAR_LINE';
  }

  if (
    t.includes('5s progress') ||
    t.includes('automation progress') ||
    t.includes('paperless office') ||
    t.includes('resolution of nc') ||
    t.includes('tree plantation')
  ) {
    return 'PIE_CURRENT';
  }

  if (t.includes('cost saving') || t.includes('cost of quality')) return 'BAR';
  if (t.includes('safety legal') || t.includes('environmental legal')) return 'LINE';

  return 'LINE';
};

const SpeedometerGauge = ({ value, showLabel = false, showValue = true }) => {
  const efficiency = Number(value) || 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  // Calculate angle: -180 to 0 degrees (left to right semicircle)
  // 0-60 red, 61-80 yellow, >80 green
  const angle = -180 + (Math.min(Math.max(efficiency, 0), 100) / 100) * 180;

  let color = '#ef4444'; // red
  let status = 'Critical';
  if (efficiency > 80) {
    color = '#22c55e'; // green
    status = 'Excellent';
  } else if (efficiency > 60) {
    color = '#eab308'; // yellow
    status = 'Good';
  }

  return (
    <div className={`flex flex-col items-center justify-center h-full min-h-0 relative z-10`}>
      <svg
        viewBox="0 0 300 220"
        className="w-full h-auto flex-1 min-h-0"
        style={{
          width: "600px",
          height: "400px",
          maxWidth: "100%",
        }}
      >
        {/* Background Arc */}
        <path
          d="M 12 180 A 138 138 0 0 1 288 180"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Red Zone */}
        <path
          d="M 12 180 A 138 138 0 0 1 106 49"
          fill="none"
          stroke="#ef4444"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Yellow Zone */}
        <path
          d="M 106 49 A 138 138 0 0 1 194 49"
          fill="none"
          stroke="#eab308"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Green Zone */}
        <path
          d="M 194 49 A 138 138 0 0 1 288 180"
          fill="none"
          stroke="#22c55e"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Tick Marks */}
        <line x1="18" y1="180" x2="32" y2="180" stroke="#374151" strokeWidth="3" />
        <line x1="66" y1="84" x2="78" y2="92" stroke="#374151" strokeWidth="3" />
        <line x1="150" y1="42" x2="150" y2="58" stroke="#374151" strokeWidth="3" />
        <line x1="234" y1="84" x2="222" y2="92" stroke="#374151" strokeWidth="3" />
        <line x1="282" y1="180" x2="268" y2="180" stroke="#374151" strokeWidth="3" />

        {/* Needle */}
        <g
          transform={`rotate(${angle}, 150, 180)`}
          style={{
            transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <line
            x1="150"
            y1="180"
            x2="272"
            y2="180"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
          />

          <polygon
            points="272,180 255,171 255,189"
            fill={color}
          />
        </g>

        {/* Center Hub */}
        <circle
          cx="150"
          cy="180"
          r="14"
          fill={color}
        />

        <circle
          cx="150"
          cy="180"
          r="5"
          fill="#fff"
        />

        {/* Labels */}
        <text x="8" y="204" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="start">0</text>
        <text x="62" y="80" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="middle">25</text>
        <text x="150" y="28" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="middle">50</text>
        <text x="238" y="80" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="middle">75</text>
        <text x="292" y="204" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="end">100</text>
      </svg>
      {showValue && (
        <div className="text-center mt-0.5">
          <div className="font-extrabold text-gray-800 text-base sm:text-lg">{efficiency.toFixed(1)}%</div>
          <div className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block ${status === 'Excellent' ? 'bg-green-100 text-green-700' : status === 'Good' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {status}
          </div>
          {showLabel && <div className="text-sm text-gray-500 mt-1">Overall Equipment Efficiency</div>}
        </div>
      )}
    </div>
  );
};

const isPlantKpi = (kpi) => {
  const titleText = (kpi?.title || '').toLowerCase();
  const categoryText = (kpi?.category_name || kpi?.category || '').toLowerCase();

  return (
    titleText.includes('plant') ||
    titleText.includes('efficiency') ||
    titleText.includes('ope') ||
    categoryText.includes('plant') ||
    categoryText.includes('efficiency')
  );
};

const PlantEfficiency = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState([]);
  const [plantCategoryId, setPlantCategoryId] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [searchText, setSearchText] = useState('');
  const [kpiChartData, setKpiChartData] = useState({});
  const [chartLoading, setChartLoading] = useState(false);
  const [sortMode, setSortMode] = useState('manual');
  const [chartOrder, setChartOrder] = useState([]);
  const [viewMode, setViewMode] = useState('latest');
  const [selectedMonthLabel, setSelectedMonthLabel] = useState(null);

  useEffect(() => {
    const loadKpis = async () => {
      try {
        setLoading(true);
        setError('');

        const [kpisResponse, categoriesResponse] = await Promise.all([
          api.get('/kpis'),
          api.get('/categories'),
        ]);

        const fetchedKpis = kpisResponse?.data?.data || [];
        const categories = categoriesResponse?.data?.data || [];
        const plantCategory = categories.find((category) => {
          const categoryName = (category?.category_name || '').toLowerCase();
          return categoryName === 'plant kpi' || categoryName.includes('plant kpi');
        });

        setPlantCategoryId(plantCategory?.id ?? null);
        setKpis(fetchedKpis);
      } catch (loadError) {
        console.error('Failed to load plant KPI list:', loadError);
        setError('Failed to load the plant KPI list.');
      } finally {
        setLoading(false);
      }
    };

    loadKpis();
  }, []);

  const plantKpis = useMemo(() => {
    if (plantCategoryId != null) {
      return kpis.filter((kpi) => String(kpi?.category_id) === String(plantCategoryId));
    }

    return kpis.filter(isPlantKpi);
  }, [kpis, plantCategoryId]);

  const availableFiscalYears = useMemo(() => {
    const years = new Set(
      plantKpis
        .map((kpi) => parseFiscalYear(kpi?.fin_year))
        .filter((year) => Number.isFinite(year))
    );

    return Array.from(years).sort((a, b) => a - b);
  }, [plantKpis]);

  useEffect(() => {
    if (availableFiscalYears.length === 0) return;

    if (!availableFiscalYears.includes(selectedFiscalYear)) {
      setSelectedFiscalYear(availableFiscalYears[0]);
    }
  }, [availableFiscalYears, selectedFiscalYear]);

  const selectedFiscalYearKpis = useMemo(() => {
    if (availableFiscalYears.length === 0) return plantKpis;

    return plantKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === selectedFiscalYear);
  }, [availableFiscalYears.length, plantKpis, selectedFiscalYear]);

  const filteredKpis = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return selectedFiscalYearKpis.filter((kpi) => {
      if (!query) return true;

      const searchableValues = [
        kpi?.title,
        kpi?.description,
        kpi?.fin_year,
        kpi?.category_name,
        kpi?.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableValues.includes(query);
    });
  }, [searchText, selectedFiscalYearKpis]);

  useEffect(() => {
    setChartOrder((prevOrder) => {
      const availableIds = selectedFiscalYearKpis.map((kpi) => kpi.id);
      const existingIds = prevOrder.filter((id) => availableIds.includes(id));
      const addedIds = availableIds.filter((id) => !existingIds.includes(id));
      return [...existingIds, ...addedIds];
    });
  }, [selectedFiscalYearKpis]);

  const orderedKpis = useMemo(() => {
    if (sortMode === 'titleAsc') {
      return [...filteredKpis].sort((a, b) => (a?.title || '').localeCompare(b?.title || ''));
    }

    if (sortMode === 'titleDesc') {
      return [...filteredKpis].sort((a, b) => (b?.title || '').localeCompare(a?.title || ''));
    }

    if (sortMode === 'category') {
      return [...filteredKpis].sort((a, b) => {
        const aCategory = (a?.category_name || a?.category || '').toLowerCase();
        const bCategory = (b?.category_name || b?.category || '').toLowerCase();
        return aCategory.localeCompare(bCategory);
      });
    }

    const kpiMap = new Map(filteredKpis.map((kpi) => [kpi.id, kpi]));
    return chartOrder.map((id) => kpiMap.get(id)).filter(Boolean);
  }, [filteredKpis, chartOrder, sortMode]);

  const kpisWithData = useMemo(() => {
    return orderedKpis.filter((kpi) => {
      const chart = kpiChartData[kpi.id];
      return Array.isArray(chart?.data) && chart.data.some((row) => row.actual != null || row.target != null);
    });
  }, [orderedKpis, kpiChartData]);

  const overallEquipmentKpi = useMemo(() => {
    const getNormalized = (kpi) => `${kpi?.title || ''} ${(kpi?.category_name || kpi?.category || '')}`.toLowerCase();
    const source = kpisWithData.length ? kpisWithData : orderedKpis;
    return (
      source.find((kpi) => /(equipment|oee|overall)/i.test(getNormalized(kpi))) || source[0] || null
    );
  }, [orderedKpis, kpisWithData]);

  const overallChart = overallEquipmentKpi ? kpiChartData[overallEquipmentKpi.id] : null;
  const availableMonthLabels = useMemo(
    () => (overallChart?.data || []).filter((row) => row.actual != null || row.target != null).map((row) => row.label),
    [overallChart]
  );
  const latestMonthLabel = availableMonthLabels[availableMonthLabels.length - 1] || null;
  const selectedMonthIndex = availableMonthLabels.indexOf(selectedMonthLabel);
  const hasPrevMonth = selectedMonthIndex > 0;
  const hasNextMonth = selectedMonthIndex < availableMonthLabels.length - 1 && selectedMonthIndex !== -1;

  const goToMonth = (step) => {
    if (!availableMonthLabels.length) return;
    let currentIndex = availableMonthLabels.indexOf(selectedMonthLabel);
    if (currentIndex === -1) {
      currentIndex = availableMonthLabels.indexOf(latestMonthLabel);
      if (currentIndex === -1) currentIndex = 0;
    }
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= availableMonthLabels.length) return;
    setSelectedMonthLabel(availableMonthLabels[nextIndex]);
  };

  useEffect(() => {
    if (!latestMonthLabel) return;
    setSelectedMonthLabel((current) => (availableMonthLabels.includes(current) ? current : latestMonthLabel));
  }, [availableMonthLabels, latestMonthLabel]);

  const selectedMonthData = useMemo(() => {
    if (!overallChart?.data?.length || !selectedMonthLabel) return null;
    return overallChart.data.find((row) => row.label === selectedMonthLabel) || null;
  }, [overallChart, selectedMonthLabel]);

  const speedometerValue = useMemo(() => {
    const rawValue = Number(selectedMonthData?.actual ?? selectedMonthData?.target ?? 0);
    if (!Number.isFinite(rawValue)) return 0;
    return Math.min(100, Math.max(0, rawValue));
  }, [selectedMonthData]);

  const moveKpiOrder = (kpiId, direction) => {
    setChartOrder((prevOrder) => {
      const currentIndex = prevOrder.indexOf(kpiId);
      if (currentIndex < 0) return prevOrder;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= prevOrder.length) return prevOrder;
      const nextOrder = [...prevOrder];
      [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
      return nextOrder;
    });
  };

  const resetChartOrder = () => {
    setChartOrder(selectedFiscalYearKpis.map((kpi) => kpi.id));
  };

  useEffect(() => {
    if (filteredKpis.length === 0) {
      setKpiChartData({});
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const loadKpiCharts = async () => {
      try {
        setChartLoading(true);

        const kpiValueResults = await Promise.allSettled(
          filteredKpis.map((kpi) => api.get(`/kpi-values/kpi/${kpi.id}`, { signal }))
        );

        const kpiValueIdsByKpiId = {};
        const kpiValueIds = [];

        kpiValueResults.forEach((result, idx) => {
          if (result.status !== 'fulfilled') return;
          const kpi = filteredKpis[idx];
          const kpiValues = Array.isArray(result.value?.data?.data)
            ? result.value.data.data
            : Array.isArray(result.value?.data)
              ? result.value.data
              : [];

          const validIds = [...new Set(
            kpiValues
              .filter((value) => value?.id)
              .map((value) => value.id)
          )];

          if (validIds.length === 0) return;

          kpiValueIdsByKpiId[kpi.id] = validIds;
          kpiValueIds.push(...validIds);
        });

        const uniqueKpiValueIds = [...new Set(kpiValueIds)];

        if (uniqueKpiValueIds.length === 0) {
          setKpiChartData({});
          return;
        }

        // Group kpi value ids by the fin_year of their parent KPI (fall back to selectedFiscalYear)
        const kpiValueIdsByYear = {};
        filteredKpis.forEach((kpi) => {
          const year = parseFiscalYear(kpi?.fin_year) || selectedFiscalYear;
          const ids = kpiValueIdsByKpiId[kpi.id] || [];
          if (!ids.length) return;
          if (!kpiValueIdsByYear[year]) kpiValueIdsByYear[year] = [];
          kpiValueIdsByYear[year].push(...ids);
        });

        // Fetch monthly rows for each year group and merge
        const monthlyRows = [];
        for (const [yearKey, ids] of Object.entries(kpiValueIdsByYear)) {
          const uniq = [...new Set(ids)];
          if (uniq.length === 0) continue;
          try {
            // request rows for this year's KPI value ids
            // API expects numeric year (starting fiscal year)
            // use Number(yearKey) just in case
            // eslint-disable-next-line no-await-in-loop
            const resp = await api.post('/kpi-data-values/multiple', { kpiValueIds: uniq, year: Number(yearKey) }, { signal });
            const rows = Array.isArray(resp?.data?.data) ? resp.data.data : Array.isArray(resp?.data) ? resp.data : [];
            monthlyRows.push(...rows);
          } catch (err) {
            // ignore partial failures for a year, continue with other years
            console.error('Failed to load monthly rows for year', yearKey, err);
          }
        }

        const rowsByKpiValueId = monthlyRows.reduce((acc, row) => {
          if (!row?.kpi_value_id) return acc;
          if (!acc[row.kpi_value_id]) acc[row.kpi_value_id] = [];
          acc[row.kpi_value_id].push(row);
          return acc;
        }, {});

        const chartData = {};

        filteredKpis.forEach((kpi) => {
          const kpiValueIdsForKpi = kpiValueIdsByKpiId[kpi.id] || [];
          if (kpiValueIdsForKpi.length === 0) return;

          const monthMap = new Map(
            FISCAL_MONTH_SEQUENCE.map(({ month, label }) => [month, { label, actual: null, target: null }])
          );

          kpiValueIdsForKpi.forEach((kpiValueId) => {
            (rowsByKpiValueId[kpiValueId] || []).forEach((row) => {
              const month = Number(row?.month);
              const value = Number(row?.value);
              if (!Number.isFinite(month) || !monthMap.has(month)) return;

              const entry = monthMap.get(month);
              const normalizedType = normalizeValueType(row?.value_type);
              if (normalizedType === 'target') {
                entry.target = Number.isFinite(value) ? value : null;
              } else {
                entry.actual = Number.isFinite(value) ? value : null;
              }
            });
          });

          chartData[kpi.id] = {
            title: kpi.title || 'Untitled KPI',
            category: kpi?.category_name || kpi?.category || 'Uncategorized',
            data: Array.from(monthMap.values()),
          };
        });

        setKpiChartData(chartData);
      } catch (loadError) {
        if (loadError.name !== 'AbortError' && loadError.name !== 'CanceledError') {
          console.error('Failed to load KPI chart data:', loadError);
        }
      } finally {
        setChartLoading(false);
      }
    };

    loadKpiCharts();
    return () => controller.abort();
  }, [filteredKpis, selectedFiscalYear]);

  const renderKpiChartCard = (kpi, index) => {
    const chart = kpiChartData[kpi.id];
    const hasData = chart?.data?.some((row) => row.actual != null || row.target != null);
    const isFirst = index === 0;
    const isLast = index === orderedKpis.length - 1;
    const chartType = getChartType(kpi.title);

    return (
      <div key={kpi.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-blue-200 bg-blue-50 px-5 py-4">
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 flex flex-col items-center text-center sm:justify-center">
              <h3 className="w-full max-w-md text-lg font-semibold text-blue-900 text-center">
                {kpi.title || 'Untitled KPI'}
              </h3>
              {/* <p className="mt-2 text-sm text-gray-500">{kpi?.category_name || kpi?.category || 'Uncategorized'}</p> */}
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end sm:ml-auto">
              {/* <div className="text-sm text-gray-500">{kpi?.fin_year ? formatFiscalYear(kpi.fin_year) : 'No fiscal year'}</div> */}
              {sortMode === 'manual' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveKpiOrder(kpi.id, -1)}
                    disabled={isFirst}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKpiOrder(kpi.id, 1)}
                    disabled={isLast}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          {chartLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-500">Loading chart…</div>
          ) : !hasData ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-500">No monthly data available for this KPI.</div>
          ) : chartType === 'SPEEDOMETER' ? (
            <div className="h-64 flex flex-col justify-between">
              {(() => {
                const rows = chart.data || [];
                const latestRow = [...rows].reverse().find((r) => r.actual != null || r.target != null) || null;
                const currentLabel = selectedMonthLabel || latestRow?.label || 'N/A';
                const selectedRow = rows.find((r) => r.label === selectedMonthLabel) || latestRow;
                const val = Number(selectedRow?.actual ?? selectedRow?.target ?? 0);
                const severity = val < 65 ? 'Critical' : val < 85 ? 'Warning' : 'Good';
                const badgeClass = val < 65 ? 'bg-red-100 text-red-700' : val < 85 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

                return (
                  <>
                    <div className="text-center mt-2 text-sm text-gray-600">{currentLabel}</div>

                    <div className="relative flex items-center justify-center flex-1 min-h-[150px]">
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        disabled={!hasPrevMonth}
                        className={`absolute left-0 -ml-4 flex h-9 w-9 items-center justify-center rounded-full border bg-white text-lg text-gray-600 shadow-sm transition ${!hasPrevMonth ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        ‹
                      </button>

                      <div className="w-full h-40 flex items-center justify-center overflow-hidden rounded-xl bg-transparent">
                        <SpeedometerGauge value={val} showLabel={false} showValue={false} />
                      </div>

                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        disabled={!hasNextMonth}
                        className={`absolute right-0 -mr-4 flex h-9 w-9 items-center justify-center rounded-full border bg-white text-lg text-gray-600 shadow-sm transition ${!hasNextMonth ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        ›
                      </button>
                    </div>

                    <div className="text-center mt-3">
                      <div className="text-3xl font-extrabold text-gray-900">{val.toFixed(1)}%</div>
                      <div className={`inline-block mt-2 rounded-full px-3 py-1 text-sm font-medium ${badgeClass.includes('red') ? 'bg-red-100 text-red-700' : badgeClass.includes('green') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                        {severity}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : chartType === 'BAR_LINE' ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart.data} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <Tooltip formatter={(value) => (value == null ? '-' : value.toString())} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="actual" name="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line type="monotone" dataKey="target" name="Target" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : chartType === 'PIE_CURRENT' ? (
            <div className="h-64 flex flex-col items-center justify-center relative">
              {(() => {
                const rows = chart.data || [];
                const latestRow = [...rows].reverse().find((r) => r.actual != null || r.target != null) || null;
                const actual = Number(selectedMonthData?.actual ?? latestRow?.actual ?? 0);
                const target = Number(selectedMonthData?.target ?? latestRow?.target ?? 100);
                const label = selectedMonthLabel || latestRow?.label || 'N/A';

                const pieData = [
                  { name: 'Actual', value: actual, color: '#2563eb' },
                  { name: 'Target/Remaining', value: Math.max(0, target - actual), color: '#e5e7eb' },
                ];

                return (
                  <>
                    <div className="absolute top-0 right-0 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Month: {label}
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius="50%"
                          outerRadius="80%"
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                      <span className="text-xl font-bold text-gray-800">{actual}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : chartType === 'BAR' ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <Tooltip formatter={(value) => (value == null ? '-' : value.toString())} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="actual" name="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="target" name="Target" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.data} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#4b5563' }} />
                  <Tooltip formatter={(value) => (value == null ? '-' : value.toString())} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="target" name="Target" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Monthly OEE line-chart removed — the monthly view uses the Speedometer instead.

  const renderSpeedometerCard = () => (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center rounded-md bg-blue-100 px-3 py-1 text-xl font-semibold text-blue-900">
            Overall Equipment Efficiency
          </h2>
          <p className="mt-2 text-sm text-gray-500">Latest month performance with OEE ranges.</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <span className="text-sm text-gray-500">Month</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!hasPrevMonth}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${hasPrevMonth ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              Prev
            </button>
            <span className="min-w-[4rem] text-center text-sm font-semibold text-gray-700">
              {selectedMonthLabel || 'N/A'}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              disabled={!hasNextMonth}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${hasNextMonth ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 h-64 flex items-center justify-center">
        <div className="w-full h-full max-w-2xl">
          <SpeedometerGauge value={speedometerValue} />
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-gray-500">
        {selectedMonthLabel ? `Showing latest month graph for ${selectedMonthLabel}.` : 'No monthly values available yet.'}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between w-full">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search graphs by title, category, or year..."
            className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-800 outline-none transition bg-white shadow-sm"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1 bg-white rounded shadow px-2 py-1 border border-gray-200 h-9 min-h-0 self-start sm:self-auto">
          <button
            type="button"
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
          <span className="text-xs text-gray-400 mr-1 hidden sm:inline">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
          {availableFiscalYears.length > 0 && (
            <span className="text-xs text-gray-400 mr-1">
              ({availableFiscalYears.indexOf(selectedFiscalYear) + 1} / {availableFiscalYears.length})
            </span>
          )}
          <button
            type="button"
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700">Graph order</label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="manual">Manual order</option>
            <option value="titleAsc">Title A → Z</option>
            <option value="titleDesc">Title Z → A</option>
            <option value="category">Category</option>
          </select>
          {sortMode === 'manual' && (
            <button
              type="button"
              onClick={resetChartOrder}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset order
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {orderedKpis.length === 0
            ? 'No graphs match your search.'
            : `${kpisWithData.length} graphs shown`}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {/* <div className="text-sm font-medium text-gray-700">View mode</div> */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode('latest')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${viewMode === 'latest' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Latest month
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${viewMode === 'monthly' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Monthly trend
          </button>
        </div>
      </div>

      {/* Overall Equipment Efficiency graph removed per request */}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">Loading plant KPI list...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : orderedKpis.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">No plant KPI graphs match your search or selected fiscal year.</p>
        </div>
      ) : kpisWithData.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">No monthly data available for the selected KPIs.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {kpisWithData.map((kpi, index) => renderKpiChartCard(kpi, index))}
        </div>
      )}
    </div>
  );
};

export default PlantEfficiency;