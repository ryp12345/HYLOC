import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  LabelList,
} from 'recharts';
import api from '../../api/axios';
import { NO_DATA_TEXT, isMissingValue, formatChartValue, maxOfValues, renderNoDataMarkers, renderZeroBarLabels, ChartTooltip } from '../../utils/chartValues';

// Charts per one-screen section (2 x 2 grid)
const CHARTS_PER_SECTION = 4;

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

const SpeedometerGauge = ({ value, showLabel = false, showValue = true, isExpanded = false }) => {
  const efficiency = Number(value) || 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  const angle = -180 + (Math.min(Math.max(efficiency, 0), 100) / 100) * 180;

  let color = '#ef4444';
  if (efficiency > 75) {
    color = '#22c55e';
  } else if (efficiency > 50) {
    color = '#eab308';
  }

  return (
    <div className={`flex flex-col items-center justify-center h-full min-h-0 relative z-10`} style={{ overflow: 'hidden' }}>
      <svg
        viewBox="0 0 300 220"
        className="w-full h-auto flex-1 min-h-0"
        style={{
          width: "600px",
          height: "400px",
          maxWidth: "100%",
          maxHeight: "100%",
          transform: isExpanded ? 'scale(1.35)' : 'scale(1)',
          transformOrigin: 'center center',
        }}
      >
        {/* Background Arc */}
        <path
          d="M 12 180 A 138 138 0 0 1 288 180"
          fill="none"
          stroke="var(--border)"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Red Zone */}
        <path
          d="M 12 180 A 138 138 0 0 1 150 42"
          fill="none"
          stroke="#ef4444"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Yellow Zone */}
        <path
          d="M 150 42 A 138 138 0 0 1 247 82"
          fill="none"
          stroke="#eab308"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Green Zone */}
        <path
          d="M 247 82 A 138 138 0 0 1 288 180"
          fill="none"
          stroke="#22c55e"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {/* Tick Marks */}
        <line x1="18" y1="180" x2="32" y2="180" stroke="var(--text-muted)" strokeWidth="3" />
        <line x1="150" y1="42" x2="150" y2="58" stroke="var(--text-muted)" strokeWidth="3" />
        <line x1="247" y1="82" x2="235" y2="90" stroke="var(--text-muted)" strokeWidth="3" />
        <line x1="282" y1="180" x2="268" y2="180" stroke="var(--text-muted)" strokeWidth="3" />

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
          fill="var(--surface)"
        />

        {/* Labels */}
        <text x="8" y="204" fontSize="14" fontWeight="800" fill="var(--text-muted)" textAnchor="start">0</text>
        <text x="150" y="28" fontSize="14" fontWeight="800" fill="var(--text-muted)" textAnchor="middle">50</text>
        <text x="247" y="76" fontSize="14" fontWeight="800" fill="var(--text-muted)" textAnchor="middle">75</text>
        <text x="292" y="204" fontSize="14" fontWeight="800" fill="var(--text-muted)" textAnchor="end">100</text>
      </svg>
      {showValue && (
        <div className="mt-0.5 text-center">
          <div className="text-base font-extrabold text-[color:var(--text-primary)] sm:text-lg">{formatChartValue(efficiency, '%')}</div>
          {showLabel && <div className="mt-1 text-sm text-[color:var(--text-secondary)]">Overall Equipment Efficiency</div>}
        </div>
      )}
    </div>
  );
};

/* ══════════════ TREND CHARTS (labels follow the ManagementDashboard rules) ══════════════ */

const ACTUAL_COLOR = '#2563eb';
const TARGET_COLOR = '#10b981';

// Value label on bars / points: 1 decimal; missing points get no label (they get a "No data available" marker)
const valueLabel = (value) => (isMissingValue(value) ? '' : formatChartValue(value));

const renderTrendChart = (chartType, data) => {
  const tick = { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 700 };
  const labelStyle = (fill) => ({ fontSize: 10, fill, fontWeight: 800 });
  // Room on top for the legend and the value labels above the tallest bar
  const margin = { top: 22, right: 12, left: -8, bottom: 0 };
  const yMax = Math.ceil(maxOfValues(data.flatMap((row) => [row.actual, row.target]), 1) * 1.18);

  const common = [
    <CartesianGrid key="grid" strokeDasharray="4 4" stroke="var(--border)" vertical={false} />,
    // interval={0}: show every month label instead of letting Recharts skip some
    <XAxis key="x" dataKey="label" interval={0} tick={tick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />,
    <YAxis key="y" domain={[0, yMax]} tick={tick} axisLine={false} tickLine={false} width={44} />,
    <Tooltip key="tip" content={<ChartTooltip />} filterNull={false} cursor={{ fill: 'color-mix(in srgb, var(--app-bg) 84%, transparent)' }} />,
    <Legend key="legend" verticalAlign="top" align="right" iconType="circle" height={18} wrapperStyle={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11, top: 0 }} />,
    ...renderNoDataMarkers(data, ['actual', 'target'], 9, 'label'),
  ];

  if (chartType === 'BAR_LINE') {
    return (
      <ComposedChart data={data} margin={margin}>
        {common}
        <Bar dataKey="actual" name="Actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey="actual" position="top" formatter={valueLabel} style={labelStyle('var(--text-primary)')} />
        </Bar>
        {renderZeroBarLabels(data, 'actual', '', labelStyle('var(--text-primary)'), 'label')}
        <Line type="monotone" dataKey="target" name="Target" stroke={TARGET_COLOR} strokeWidth={2} dot={{ r: 3, fill: TARGET_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    );
  }

  if (chartType === 'BAR') {
    return (
      <BarChart data={data} margin={margin}>
        {common}
        <Bar dataKey="actual" name="Actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey="actual" position="top" formatter={valueLabel} style={labelStyle(ACTUAL_COLOR)} />
        </Bar>
        <Bar dataKey="target" name="Target" fill={TARGET_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey="target" position="top" formatter={valueLabel} style={labelStyle(TARGET_COLOR)} />
        </Bar>
        {renderZeroBarLabels(data, 'actual', '', labelStyle(ACTUAL_COLOR), 'label')}
      </BarChart>
    );
  }

  // LINE (default)
  return (
    <LineChart data={data} margin={margin}>
      {common}
      <Line type="monotone" dataKey="actual" name="Actual" stroke={ACTUAL_COLOR} strokeWidth={2} dot={{ r: 3, fill: ACTUAL_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }}>
        <LabelList dataKey="actual" position="top" offset={8} formatter={valueLabel} style={labelStyle(ACTUAL_COLOR)} />
      </Line>
      <Line type="monotone" dataKey="target" name="Target" stroke={TARGET_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5, fill: TARGET_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} />
    </LineChart>
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
    // Show the achieved value only; a month without an actual shows 0, never the target
    const rawValue = Number(selectedMonthData?.actual ?? 0);
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

        // Fetch monthly rows for each fiscal year group and merge.
        // The endpoint filters by calendar year, so a fiscal year (Apr-Mar) needs both
        // calendar years, keeping only April-December of the first and January-March of the second.
        const monthlyRows = [];
        for (const [yearKey, ids] of Object.entries(kpiValueIdsByYear)) {
          const uniq = [...new Set(ids)];
          if (uniq.length === 0) continue;
          const fiscalYear = Number(yearKey);
          try {
            // eslint-disable-next-line no-await-in-loop
            const responses = await Promise.all([fiscalYear, fiscalYear + 1].map((calendarYear) =>
              api.post('/kpi-data-values/multiple', { kpiValueIds: uniq, year: calendarYear }, { signal })
            ));
            responses.forEach((resp) => {
              const rows = Array.isArray(resp?.data?.data) ? resp.data.data : Array.isArray(resp?.data) ? resp.data : [];
              rows.forEach((row) => {
                const month = Number(row?.month);
                const year = Number(row?.year);
                const inFiscalYear = (year === fiscalYear && month >= 4) || (year === fiscalYear + 1 && month <= 3);
                if (inFiscalYear) monthlyRows.push(row);
              });
            });
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

  /* ──── One-screen chart sections (same approach as ManagementDashboard) ──── */
  const pageRef = useRef(null);
  const sectionsRef = useRef(null);
  const sectionRefs = useRef([]);
  const [pageHeight, setPageHeight] = useState(null);
  const [activeSection, setActiveSection] = useState(0);

  const chartSections = useMemo(() => {
    const sections = [];
    for (let i = 0; i < kpisWithData.length; i += CHARTS_PER_SECTION) {
      sections.push(kpisWithData.slice(i, i + CHARTS_PER_SECTION));
    }
    return sections;
  }, [kpisWithData]);

  // Size the page to the viewport space below the app header so each section is exactly one screen
  useLayoutEffect(() => {
    const updatePageHeight = () => {
      const container = pageRef.current;
      if (!container) return;
      const top = container.getBoundingClientRect().top + window.scrollY;
      const parentPaddingBottom = parseFloat(getComputedStyle(container.parentElement).paddingBottom) || 0;
      setPageHeight(Math.max(480, window.innerHeight - top - parentPaddingBottom));
    };
    updatePageHeight();
    // Header logos can load after first paint and shift the container down
    const frame = requestAnimationFrame(updatePageHeight);
    window.addEventListener('resize', updatePageHeight);
    window.addEventListener('load', updatePageHeight);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePageHeight);
      window.removeEventListener('load', updatePageHeight);
    };
  }, []);

  // Track which section is on screen (drives the nav dots and page counter)
  useEffect(() => {
    const container = sectionsRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(Number(entry.target.dataset.section));
        });
      },
      { root: container, threshold: 0.6 }
    );
    sectionRefs.current.slice(0, chartSections.length).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [chartSections.length, loading]);

  // A new search, sort or fiscal year starts again from the first section
  useEffect(() => {
    sectionsRef.current?.scrollTo({ top: 0 });
    setActiveSection(0);
  }, [searchText, sortMode, selectedFiscalYear]);

  const scrollToSection = (index) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderKpiChartCard = (kpi, index) => {
    const chart = kpiChartData[kpi.id];
    const hasData = chart?.data?.some((row) => row.actual != null || row.target != null);
    const isFirst = index === 0;
    const isLast = index === kpisWithData.length - 1;
    const chartType = getChartType(kpi.title);

    return (
      // Fixed height on phones; on md+ the card fills its quarter of the one-screen section
      <div key={kpi.id} className="flex h-[300px] min-h-0 flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm md:h-full">
        <div className="relative shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-1.5">
          <h3 className="truncate px-14 text-center text-sm font-bold text-[color:var(--text-primary)]" title={kpi.title || 'Untitled KPI'}>
            {kpi.title || 'Untitled KPI'}
          </h3>
          {sortMode === 'manual' && (
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                type="button"
                onClick={() => moveKpiOrder(kpi.id, -1)}
                disabled={isFirst}
                title="Move up"
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveKpiOrder(kpi.id, 1)}
                disabled={isLast}
                title="Move down"
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↓
              </button>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 px-3 py-2">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-secondary)]">Loading chart…</div>
          ) : !hasData ? (
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-secondary)]">No monthly data available for this KPI.</div>
          ) : chartType === 'SPEEDOMETER' ? (
            <div className="flex h-full flex-col">
              {(() => {
                const rows = chart.data || [];
                const latestRow = [...rows].reverse().find((r) => r.actual != null || r.target != null) || null;
                const currentLabel = selectedMonthLabel || latestRow?.label || 'N/A';
                const selectedRow = rows.find((r) => r.label === selectedMonthLabel) || latestRow;
                // Achieved value only; a month without an actual shows "No data available", never the target
                const hasActual = !isMissingValue(selectedRow?.actual);
                const val = hasActual ? Number(selectedRow.actual) : 0;

                return (
                  <>
                    <div className="shrink-0 text-center text-xs font-semibold text-[color:var(--text-secondary)]">{currentLabel}</div>

                    <div className="relative flex min-h-[120px] flex-1 items-center justify-center md:min-h-0">
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        disabled={!hasPrevMonth}
                        className={`absolute left-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-lg text-[color:var(--text-secondary)] shadow-sm transition ${!hasPrevMonth ? 'cursor-not-allowed opacity-40' : 'hover:bg-[color:var(--surface-hover)]'}`}
                      >
                        ‹
                      </button>

                      <div className="flex h-full w-full items-center justify-center overflow-hidden px-9">
                        <SpeedometerGauge value={val} showLabel={false} showValue={false} />
                      </div>

                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        disabled={!hasNextMonth}
                        className={`absolute right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-lg text-[color:var(--text-secondary)] shadow-sm transition ${!hasNextMonth ? 'cursor-not-allowed opacity-40' : 'hover:bg-[color:var(--surface-hover)]'}`}
                      >
                        ›
                      </button>
                    </div>

                    <div className="shrink-0 text-center">
                      {hasActual ? (
                        <div className="text-2xl font-extrabold text-[color:var(--text-primary)]">{formatChartValue(val, '%')}</div>
                      ) : (
                        <div className="text-sm font-bold text-[color:var(--text-muted)]">{NO_DATA_TEXT}</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : chartType === 'PIE_CURRENT' ? (
            <div className="relative flex h-full flex-col items-center justify-center">
              {(() => {
                const rows = chart.data || [];
                const latestRow = [...rows].reverse().find((r) => r.actual != null || r.target != null) || null;
                const selectedRow = rows.find((r) => r.label === selectedMonthLabel) || latestRow;
                const hasActual = !isMissingValue(selectedRow?.actual);
                const hasTarget = !isMissingValue(selectedRow?.target);
                const actual = hasActual ? Number(selectedRow.actual) : 0;
                const target = hasTarget ? Number(selectedRow.target) : 100;
                const label = selectedRow?.label || 'N/A';
                const remaining = Math.max(0, target - actual);

                // No actual -> an empty ring, so the chart area is still visible
                const pieData = hasActual
                  ? [
                      { name: 'Actual', value: actual, color: ACTUAL_COLOR, display: formatChartValue(actual) },
                      { name: 'Target/Remaining', value: remaining, color: 'var(--border)', display: hasTarget ? formatChartValue(remaining) : NO_DATA_TEXT },
                    ]
                  : [{ name: 'Target/Remaining', value: 100, color: 'var(--border)', display: NO_DATA_TEXT }];

                return (
                  <>
                    <div className="absolute right-0 top-0 rounded bg-[color:var(--surface-hover)] px-2 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
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
                        <Tooltip content={<ChartTooltip />} />
                        <Legend verticalAlign="bottom" height={24} wrapperStyle={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                      {hasActual ? (
                        <span className="text-center text-xl font-bold text-[color:var(--text-primary)]">
                          {formatChartValue(actual)}
                          {hasTarget && <span className="block text-[11px] font-semibold text-[color:var(--text-muted)]">Target {formatChartValue(target)}</span>}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[color:var(--text-muted)]">{NO_DATA_TEXT}</span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                {renderTrendChart(chartType, chart.data)}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Monthly OEE line-chart removed — the monthly view uses the Speedometer instead.

  const renderSpeedometerCard = () => (
    <div className="border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center rounded-md bg-[color:var(--accent-soft)] px-3 py-1 text-xl font-semibold text-[color:var(--accent)]">
            Overall Equipment Efficiency
          </h2>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Latest month performance with OEE ranges.</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <span className="text-sm text-[color:var(--text-secondary)]">Month</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!hasPrevMonth}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${hasPrevMonth ? 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]' : 'cursor-not-allowed border-[color:var(--border)] bg-[color:var(--surface-hover)] text-[color:var(--text-muted)]'}`}
            >
              Prev
            </button>
            <span className="min-w-[4rem] text-center text-sm font-semibold text-[color:var(--text-primary)]">
              {selectedMonthLabel || 'N/A'}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              disabled={!hasNextMonth}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${hasNextMonth ? 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]' : 'cursor-not-allowed border-[color:var(--border)] bg-[color:var(--surface-hover)] text-[color:var(--text-muted)]'}`}
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
      <div className="mt-4 text-center text-sm text-[color:var(--text-secondary)]">
        {selectedMonthLabel ? `Showing latest month graph for ${selectedMonthLabel}.` : 'No monthly values available yet.'}
      </div>
    </div>
  );

  const toolbarButtonClass = (active) =>
    `rounded-md border px-2.5 py-1 text-xs font-semibold transition ${active ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent)]'}`;

  const renderMessage = (content, tone = 'default') => (
    <div
      className={`flex flex-1 items-center justify-center rounded-lg border p-6 text-center text-sm shadow-sm ${
        tone === 'error'
          ? 'border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
          : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)]'
      }`}
    >
      {content}
    </div>
  );

  return (
    <div
      ref={pageRef}
      className="flex flex-col gap-2"
      style={{ height: pageHeight ? `${pageHeight}px` : 'calc(100vh - 5rem)', minHeight: 0 }}
    >
      {/* ── Toolbar (one compact row) ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search graphs by title, category, or year..."
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1.5 pl-9 pr-3 text-sm text-[color:var(--text-primary)] shadow-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-2 h-4 w-4 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="plant-graph-order" className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Graph order</label>
          <select
            id="plant-graph-order"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs text-[color:var(--text-primary)] transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
          >
            <option value="manual">Manual order</option>
            <option value="titleAsc">Title A → Z</option>
            <option value="titleDesc">Title Z → A</option>
            <option value="category">Category</option>
          </select>
          {sortMode === 'manual' && (
            <button type="button" onClick={resetChartOrder} className={toolbarButtonClass(false)}>
              Reset order
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setViewMode('latest')} className={toolbarButtonClass(viewMode === 'latest')}>
            Latest month
          </button>
          <button type="button" onClick={() => setViewMode('monthly')} className={toolbarButtonClass(viewMode === 'monthly')}>
            Monthly trend
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {orderedKpis.length === 0
              ? 'No graphs match your search.'
              : `${kpisWithData.length} graphs${chartSections.length > 1 ? ` · Page ${activeSection + 1} / ${chartSections.length}` : ''}`}
          </span>

          <div className="flex h-8 items-center gap-1 rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 shadow">
            <button
              type="button"
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex > 0) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
              className="rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)] transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ‹
            </button>
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">FY</span>
            <span className="mr-1 text-sm font-bold text-[color:var(--text-primary)]">
              {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
            </span>
            <span className="mr-1 hidden text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] lg:inline">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
            {availableFiscalYears.length > 0 && (
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
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
              className="rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Next Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Overall Equipment Efficiency graph removed per request */}

      {loading ? (
        renderMessage('Loading plant KPI list...')
      ) : error ? (
        renderMessage(error, 'error')
      ) : orderedKpis.length === 0 ? (
        renderMessage('No plant KPI graphs match your search or selected fiscal year.')
      ) : kpisWithData.length === 0 ? (
        renderMessage('No monthly data available for the selected KPIs.')
      ) : (
        <div className="relative min-h-0 flex-1">
          {/* One section = one screen with 4 charts (2 x 2); scrolling snaps to the next section */}
          <div
            ref={sectionsRef}
            className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth"
          >
            {chartSections.map((sectionKpis, sectionIndex) => (
              <section
                key={sectionIndex}
                ref={(el) => { sectionRefs.current[sectionIndex] = el; }}
                data-section={sectionIndex}
                className="grid grid-cols-1 gap-2 pb-2 md:h-full md:snap-start md:snap-always md:grid-cols-2 md:grid-rows-2 md:pb-0.5 md:pr-6"
              >
                {sectionKpis.map((kpi, i) => renderKpiChartCard(kpi, sectionIndex * CHARTS_PER_SECTION + i))}
              </section>
            ))}
          </div>

          {/* Section navigation dots */}
          {chartSections.length > 1 && (
            <nav className="absolute right-1 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 md:flex" aria-label="Chart sections">
              {chartSections.map((sectionKpis, sectionIndex) => {
                const from = sectionIndex * CHARTS_PER_SECTION + 1;
                const to = from + sectionKpis.length - 1;
                const label = `Charts ${from}–${to} of ${kpisWithData.length}`;
                return (
                  <button
                    key={sectionIndex}
                    type="button"
                    onClick={() => scrollToSection(sectionIndex)}
                    title={label}
                    aria-label={`Go to ${label}`}
                    aria-current={activeSection === sectionIndex ? 'true' : undefined}
                    className={`block rounded-full border border-[color:var(--accent)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] ${
                      activeSection === sectionIndex ? 'h-5 w-2.5 bg-[color:var(--accent)]' : 'h-2.5 w-2.5 bg-[color:var(--surface)] hover:bg-[color:var(--accent-soft)]'
                    }`}
                  />
                );
              })}
            </nav>
          )}
        </div>
      )}
    </div>
  );
};

export default PlantEfficiency;