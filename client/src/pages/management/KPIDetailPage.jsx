import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart as ReLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
} from 'recharts';
import { getKPIById, getChildKPIs, getKPIValuesByKPI, getMonthlyDataByKPIValue } from '../../api/kpiApi';
import { getUserById } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/* ══════════════ DATA UTILITIES ══════════════ */

const normalizeValueType = (valueType) => {
  const normalized = (valueType || '').toString().trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'actual' || normalized === 'achieved' || normalized === 'qa') return 'actual';
  if (normalized === 'target') return 'target';
  if (normalized.includes('actual') || normalized.includes('achieved')) return 'actual';
  if (normalized.includes('target')) return 'target';
  if (normalized.includes('qa') && !normalized.includes('target')) return 'actual';
  return normalized ? 'actual' : normalized;
};

const parseNumeric = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMonthValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 1 && value <= 12) return value;
    return null;
  }
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

const extractRowMonth = (row) => {
  if (!row) return null;
  const candidates = [
    row.month, row.month_no, row.month_number, row.monthName, row.month_name,
    row.month_label, row.period_month, row.period, row.date, row.entry_date,
    row.created_at, row.updated_at,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeMonthValue(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const extractRowYear = (row) => {
  if (!row) return null;
  const directCandidates = [row.year, row.calendar_year, row.period_year, row.fy_year, row.fiscal_year];
  for (const candidate of directCandidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 1900 && numeric <= 3000) return numeric;
  }
  const dateCandidates = [row.date, row.entry_date, row.created_at, row.updated_at];
  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    const parsedDate = new Date(candidate);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getFullYear();
  }
  return null;
};

const filterRowsForFiscalWindow = (rows, fetchedYear, fiscalYear) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => {
    const month = extractRowMonth(row);
    if (!month) return true;
    const rowYear = extractRowYear(row) ?? fetchedYear;
    if (rowYear === fiscalYear) return month >= 4;
    if (rowYear === fiscalYear + 1) return month <= 3;
    return false;
  });
};

const extractRowType = (row) => {
  return normalizeValueType(row?.value_type ?? row?.valueType ?? row?.metric_type ?? row?.type);
};

const extractActualTarget = (row) => {
  const type = extractRowType(row);
  const actual = parseNumeric(
    row?.actual_value ?? row?.actual ?? row?.actuals ?? row?.achieved ?? row?.achieved_value ??
    row?.qa ?? row?.qa_value ?? (type === 'actual' ? row?.value : null)
  );
  const target = parseNumeric(
    row?.target_value ?? row?.target ?? row?.targets ?? row?.targets_value ?? row?.goal ?? row?.goal_value ??
    row?.plan ?? row?.planned_value ?? (type === 'target' ? row?.value : null)
  );
  return { actual, target, type };
};

const rowHasTarget = (row) => {
  const { target, type } = extractActualTarget(row);
  return target !== null || type === 'target';
};

const sortByExtractedMonth = (a, b) => {
  const ma = extractRowMonth(a) ?? Number.MAX_SAFE_INTEGER;
  const mb = extractRowMonth(b) ?? Number.MAX_SAFE_INTEGER;
  return ma - mb;
};

const getRowRecencyScore = (row) => {
  const updatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = row?.created_at ? new Date(row.created_at).getTime() : Number.NaN;
  if (Number.isFinite(createdAt)) return createdAt;
  const idValue = Number(row?.id);
  return Number.isFinite(idValue) ? idValue : Number.NEGATIVE_INFINITY;
};

const buildFiscalSeries = (rows, fiscalYear) => {
  const fiscalSequence = FISCAL_MONTHS.map((month) => ({
    month,
    year: month >= 4 ? fiscalYear : fiscalYear + 1,
    label: MONTH_LABELS[month - 1],
  }));
  const actualBySlot = {};
  const targetBySlot = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const month = extractRowMonth(row);
    if (!month) return;
    const rawYear = extractRowYear(row);
    const year = Number.isFinite(rawYear) ? rawYear : (month >= 4 ? fiscalYear : fiscalYear + 1);
    const inFiscalWindow = (year === fiscalYear && month >= 4) || (year === fiscalYear + 1 && month <= 3);
    if (!inFiscalWindow) return;
    const slotKey = `${year}-${month}`;
    const recency = getRowRecencyScore(row);
    const { actual, target } = extractActualTarget(row);
    if (actual !== null) {
      const previous = actualBySlot[slotKey];
      if (!previous || recency >= previous.recency) actualBySlot[slotKey] = { value: actual, recency };
    }
    if (target !== null) {
      const previous = targetBySlot[slotKey];
      if (!previous || recency >= previous.recency) targetBySlot[slotKey] = { value: target, recency };
    }
  });
  const actualValues = fiscalSequence.map(({ month, year }) => {
    const slot = actualBySlot[`${year}-${month}`];
    return slot ? slot.value : null;
  });
  const targetValues = fiscalSequence.map(({ month, year }) => {
    const slot = targetBySlot[`${year}-${month}`];
    return slot ? slot.value : null;
  });
  return {
    actualValues,
    targetValues,
    labels: fiscalSequence.map(({ label }) => label),
  };
};

const getLatestSeriesValue = (seriesValues) => {
  for (let index = seriesValues.length - 1; index >= 0; index -= 1) {
    const value = seriesValues[index];
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const normalizeMetricName = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const hasAllMetricTokens = (label, tokens) => tokens.every((token) => label.includes(token));

const isInverseMetric = (metricName) => {
  const inversePatterns = [
    'NO OPERATOR', 'NO ', 'NOT ', 'UN', 'LOSS', 'LOSSES', 'DEFECT', 'FAILURE',
    'ERROR', 'DOWNTIME', 'DELAY', 'REJECT', 'SCRAP', 'WASTE', 'BREAKDOWN',
    'ABSENT', 'TURNOVER', 'ACCIDENT', 'INCIDENT', 'VIOLATION'
  ];
  const upperName = metricName.toUpperCase();
  return inversePatterns.some(pattern => upperName.includes(pattern));
};

const calculateAchievementRate = (actual, target, metricName) => {
  if (!target || target === 0) return 0;
  if (isInverseMetric(metricName)) {
    if (actual === 0) return 100;
    return Math.min((target / actual) * 100, 100);
  }
  return (actual / target) * 100;
};

/* ══════════════ MANAGEMENT LOSS SERIES DEFINITION ══════════════ */

const MANAGEMENT_LOSS_SERIES = [
  { key: 'managementLoss', title: 'TPM TRACKER - MANAGEMENT LOSS TIME', tokens: ['MANAGEMENT', 'LOSS', 'TIME'], color: '#c7711a' },
  { key: 'teaBreak', title: 'TPM TRACKER - TEA BREAK TIME', tokens: ['TEA', 'BREAK', 'TIME'], color: '#f2c94c' },
  { key: 'lunchBreak', title: 'TPM TRACKER - LUNCH BREAK TIME', tokens: ['LUNCH', 'BREAK', 'TIME'], color: '#fb923c' },
  { key: 'noLoad', title: 'TPM TRACKER - NO LOAD', tokens: ['NO', 'LOAD'], color: '#94a3b8' },
  { key: 'noOperatorAssigned', title: 'TPM TRACKER - NO OPERATOR ASSIGNED', tokens: ['NO', 'OPERATOR', 'ASSIGNED'], color: '#7c3aed' },
  { key: 'meetingTime', title: 'TPM TRACKER - MEETING TIME', tokens: ['MEETING', 'TIME'], color: '#22c55e' },
];

/* ══════════════ CHART COLORS ══════════════ */

const REMAINING_FILL = '#e5e7eb';
const CHART_COLORS = {
  ope: '#1d4ed8',
  oee: '#16a34a',
  ae: '#1d4ed8',
  pe: '#f59e0b',
  qe: '#16a34a',
  target: '#fb923c',
};

/* ══════════════ YEAR UTILITIES ══════════════ */

const getCurrentFiscalYear = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  return currentMonth >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const generateAvailableFiscalYears = () => {
  const currentFY = getCurrentFiscalYear();
  const years = [];
  for (let y = currentFY - 5; y <= currentFY + 2; y += 1) {
    years.push(y);
  }
  return years;
};

const AVAILABLE_FISCAL_YEARS = generateAvailableFiscalYears();

/* ══════════════ MAIN COMPONENT ══════════════ */

const KPIDetailPage = () => {
  const { kpiId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [parentKPI, setParentKPI] = useState(null);
  const [parentKPIValues, setParentKPIValues] = useState([]);
  const [parentMonthlyData, setParentMonthlyData] = useState({});
  const [hierarchyData, setHierarchyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(
    location.state?.fiscalYear || getCurrentFiscalYear()
  );
  const [userCache, setUserCache] = useState({});
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  // Alias so the rest of the code still works with fiscalYear
  const fiscalYear = selectedFiscalYear;

  /* ══════════════ MODAL STATE ══════════════ */
  const [expandedChart, setExpandedChart] = useState(null);

  const ensureUserCached = async (userId) => {
    if (!userId) return null;
    const id = Number(userId);
    if (!Number.isFinite(id)) return null;
    if (userCache[id]) return userCache[id];
    try {
      const res = await getUserById(id);
      const resData = res?.data ?? null;
      const u = resData?.data ?? resData?.user ?? resData ?? null;
      const name = u?.name || u?.fullname || u?.username || u?.emp_name || u?.empid || u?.emp_name_english || null;
      const resolved = name || String(id);
      setUserCache(prev => ({ ...prev, [id]: resolved }));
      return resolved;
    } catch (err) {
      setUserCache(prev => ({ ...prev, [id]: String(id) }));
      return String(id);
    }
  };

  /* ──── Data Loading ──── */

  useEffect(() => { loadKPIHierarchy(); }, [kpiId, selectedFiscalYear]);

  const loadKPIHierarchy = async () => {
    try {
      setLoading(true);
      const kpiRes = await getKPIById(kpiId);
      const parentKPIData = kpiRes.data.data;
      setParentKPI(parentKPIData);

      const hierarchy = await loadKPITreeRecursive(kpiId, 1);
      await loadParentKpiValues(kpiId, fiscalYear);
      setHierarchyData(hierarchy);
    } catch (error) {
      console.error('Error loading KPI hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadParentKpiValues = async (parentId, fyYear) => {
    try {
      const valuesRes = await getKPIValuesByKPI(parentId);
      const parentValues = valuesRes.data.data || [];
      setParentKPIValues(parentValues);
      const monthlyDataByValue = {};
      for (const value of parentValues) {
        try {
          const allMonthlyData = [];
          try {
            const dataRes1 = await getMonthlyDataByKPIValue(value.id, fyYear);
            if (dataRes1.data.data && Array.isArray(dataRes1.data.data)) {
              allMonthlyData.push(...filterRowsForFiscalWindow(dataRes1.data.data, fyYear, fyYear));
            }
          } catch (err) {}
          try {
            const dataRes2 = await getMonthlyDataByKPIValue(value.id, fyYear + 1);
            if (dataRes2.data.data && Array.isArray(dataRes2.data.data)) {
              allMonthlyData.push(...filterRowsForFiscalWindow(dataRes2.data.data, fyYear + 1, fyYear));
            }
          } catch (err) {}
          monthlyDataByValue[value.id] = allMonthlyData;
        } catch (error) {
          monthlyDataByValue[value.id] = [];
        }
      }
      setParentMonthlyData(monthlyDataByValue);
    } catch (error) {
      setParentKPIValues([]);
      setParentMonthlyData({});
    }
  };

  const loadKPITreeRecursive = async (kpiId, level) => {
    try {
      const childRes = await getChildKPIs(kpiId);
      const children = childRes.data.data;
      if (children.length === 0) return [];
      const hierarchyItems = [];
      for (const child of children) {
        const valuesRes = await getKPIValuesByKPI(child.id);
        const values = valuesRes.data.data;
        const monthlyDataByValue = {};
        for (const value of values) {
          try {
            const allMonthlyData = [];
            try {
              const dataRes1 = await getMonthlyDataByKPIValue(value.id, fiscalYear);
              if (dataRes1.data?.data && Array.isArray(dataRes1.data.data)) {
                allMonthlyData.push(...filterRowsForFiscalWindow(dataRes1.data.data, fiscalYear, fiscalYear));
              }
            } catch (err) {}
            try {
              const dataRes2 = await getMonthlyDataByKPIValue(value.id, fiscalYear + 1);
              if (dataRes2.data?.data && Array.isArray(dataRes2.data.data)) {
                allMonthlyData.push(...filterRowsForFiscalWindow(dataRes2.data.data, fiscalYear + 1, fiscalYear));
              }
            } catch (err) {}
            monthlyDataByValue[value.id] = allMonthlyData;
          } catch (error) {
            monthlyDataByValue[value.id] = [];
          }
        }
        const grandChildren = await loadKPITreeRecursive(child.id, level + 1);
        hierarchyItems.push({ kpi: child, level, values, monthlyData: monthlyDataByValue, children: grandChildren });
      }
      return hierarchyItems;
    } catch (error) {
      return [];
    }
  };

  /* ──── Flatten all metrics from hierarchy ──── */
  const metricCandidates = useMemo(() => {
    const candidates = [];

    parentKPIValues.forEach((value) => {
      const rows = parentMonthlyData[value.id] || [];
      candidates.push({
        id: `parent-${value.id}`,
        title: value?.data || '',
        rows,
      });
    });

    const walkNodes = (nodes) => {
      (nodes || []).forEach((node) => {
        const nodeTitle = node?.kpi?.title || '';
        (node?.values || []).forEach((value) => {
          const rows = node?.monthlyData?.[value.id] || [];
          candidates.push({
            id: `node-${node?.kpi?.id || 'x'}-${value.id}`,
            title: value?.data || nodeTitle,
            rows,
          });
        });
        walkNodes(node?.children || []);
      });
    };
    walkNodes(hierarchyData || []);

    // Deduplicate
    const deduped = [];
    const seen = new Set();
    candidates.forEach((item) => {
      const key = `${normalizeMetricName(item.title)}::${item.rows.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });
    return deduped;
  }, [parentKPIValues, parentMonthlyData, hierarchyData]);

  /* ──── Build metric lookup helper ──── */

  const findMetric = useMemo(() => {
    return (tokenSets) => {
      for (const candidate of metricCandidates) {
        const normalized = normalizeMetricName(candidate?.title);
        if (!normalized) continue;
        const matched = tokenSets.some((tokens) => hasAllMetricTokens(normalized, tokens));
        if (matched) {
          const series = buildFiscalSeries(candidate.rows || [], fiscalYear);
          return {
            value: candidate,
            title: candidate.title,
            actualValues: series.actualValues,
            targetValues: series.targetValues,
            labels: series.labels,
            latestActual: getLatestSeriesValue(series.actualValues),
            latestTarget: getLatestSeriesValue(series.targetValues),
          };
        }
      }
      return null;
    };
  }, [metricCandidates, fiscalYear]);

  /* ──── Dashboard layout computation ──── */

  const plantEfficiencyLayout = useMemo(() => {
    if (!metricCandidates.length) return null;

    const ope = findMetric([['OVERALL', 'PLANT', 'EFFICIENCY'], ['OPE']]);
    const oee = findMetric([['OVERALL', 'EQUIPMENT', 'EFFECTIVENESS'], ['OEE']]);
    const ae = findMetric([['AVAILABILITY', 'EFFICIENCY'], ['AE']]);
    const pe = findMetric([['PERFORMANCE', 'EFFICIENCY'], ['PE']]);
    const qe = findMetric([['QUALITY', 'EFFICIENCY'], ['QE']]);

    const managementLossSeries = MANAGEMENT_LOSS_SERIES.map((item) => ({
      ...item,
      metric: findMetric([item.tokens]),
    }));

    const monthLabels = ope?.labels || oee?.labels || ae?.labels || pe?.labels || qe?.labels || FISCAL_MONTHS.map((m) => MONTH_LABELS[m - 1]);

    const stackedRows = monthLabels.map((monthLabel, idx) => {
      const row = { month: monthLabel, target: null };
      managementLossSeries.forEach((seriesItem) => {
        row[seriesItem.key] = seriesItem.metric?.actualValues?.[idx] ?? null;
      });
      row.target = managementLossSeries[0]?.metric?.targetValues?.[idx] ?? null;
      return row;
    });

    const latestMonthIdx = (() => {
      const probeSeries = ope?.actualValues || oee?.actualValues || ae?.actualValues || pe?.actualValues || qe?.actualValues || [];
      for (let i = probeSeries.length - 1; i >= 0; i--) {
        if (probeSeries[i] !== null && probeSeries[i] !== undefined) return i;
      }
      return monthLabels.length - 1;
    })();

    const usedKeys = new Set();
    [ope, oee, ae, pe, qe].forEach(m => { if (m?.value?.id) usedKeys.add(m.value.id); });
    managementLossSeries.forEach(s => { if (s.metric?.value?.id) usedKeys.add(s.metric.value.id); });

    const otherMetrics = metricCandidates.filter(c => !usedKeys.has(c.id)).map(c => {
      const series = buildFiscalSeries(c.rows || [], fiscalYear);
      return {
        id: c.id,
        title: c.title,
        actualValues: series.actualValues,
        targetValues: series.targetValues,
        labels: series.labels,
        latestActual: getLatestSeriesValue(series.actualValues),
        latestTarget: getLatestSeriesValue(series.targetValues),
      };
    }).filter(m => m.latestActual !== null || m.latestTarget !== null);

    return {
      ope,
      oee,
      ae,
      pe,
      qe,
      monthLabels,
      latestMonthIdx,
      monthLabel: monthLabels[Math.max(0, latestMonthIdx)] || '-',
      stackedRows,
      managementLossSeries,
      otherMetrics,
      hasAnyData: !!(ope || oee || ae || pe || qe || managementLossSeries.some(s => s.metric) || otherMetrics.length > 0),
    };
  }, [metricCandidates, fiscalYear, findMetric]);

  /* ══════════════ CHART KEY TRACKING & MODAL HELPERS ══════════════ */

  const layout = plantEfficiencyLayout;

  const chartKeys = useMemo(() => {
    if (!layout) return [];
    const keys = [];
    if (layout.ope) keys.push('ope');
    if (layout.oee) keys.push('oee');
    if (layout.ae) keys.push('ae');
    if (layout.pe) keys.push('pe');
    if (layout.qe) keys.push('qe');
    if (layout.managementLossSeries?.some(s => s.metric)) keys.push('managementLoss');
    (layout.otherMetrics || []).forEach((m) => {
      keys.push(`other-${m.id}`);
    });
    return keys;
  }, [layout]);

  const getChartTitle = useCallback((key) => {
    if (key === 'ope') return 'OVERALL PLANT EFFICIENCY (OPE)';
    if (key === 'oee') return 'OVERALL EQUIPMENT EFFECTIVENESS (OEE)';
    if (key === 'ae') return 'AVAILABILITY EFFICIENCY (AE)';
    if (key === 'pe') return 'PERFORMANCE EFFICIENCY (PE)';
    if (key === 'qe') return 'QUALITY EFFICIENCY (QE)';
    if (key === 'managementLoss') return 'MANAGEMENT LOSS (HRS.)';
    const metric = layout?.otherMetrics?.find(m => `other-${m.id}` === key);
    return metric?.title || key;
  }, [layout]);

  const getMetricForKey = useCallback((key) => {
    if (!layout) return null;
    if (key === 'ope') return layout.ope;
    if (key === 'oee') return layout.oee;
    if (key === 'ae') return layout.ae;
    if (key === 'pe') return layout.pe;
    if (key === 'qe') return layout.qe;
    if (key === 'managementLoss') return { stackedRows: layout.stackedRows, managementLossSeries: layout.managementLossSeries, monthLabels: layout.monthLabels };
    if (key.startsWith('other-')) return layout.otherMetrics?.find(m => `other-${m.id}` === key);
    return null;
  }, [layout]);

  const openExpandedChart = useCallback((chartKey) => {
    setExpandedChart(chartKey);
  }, []);

  const closeExpandedChart = useCallback(() => {
    setExpandedChart(null);
  }, []);

  const navigateChart = useCallback((direction) => {
    setExpandedChart((prevKey) => {
      if (!prevKey || !chartKeys.length) return prevKey;
      const currentIndex = chartKeys.indexOf(prevKey);
      if (currentIndex === -1) return prevKey;
      if (direction === 'next') {
        return chartKeys[(currentIndex + 1) % chartKeys.length];
      }
      return chartKeys[(currentIndex - 1 + chartKeys.length) % chartKeys.length];
    });
  }, [chartKeys]);

  /* ──── Keyboard listener for modal navigation ──── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!expandedChart) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateChart('prev'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateChart('next'); }
      else if (e.key === 'Escape') closeExpandedChart();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedChart, navigateChart, closeExpandedChart]);

  /* ──── Sync selected month to latest data ──── */

  useEffect(() => {
    if (plantEfficiencyLayout?.latestMonthIdx != null) {
      setSelectedMonthIdx(plantEfficiencyLayout.latestMonthIdx);
    }
  }, [plantEfficiencyLayout?.latestMonthIdx]);

  /* ══════════════ CHART COMPONENTS ══════════════ */

  /** Big donut card with trend line — for OPE / OEE */
  const EfficiencyDonutCard = ({ metric, title, accentColor, targetColor, monthIdx, onExpand }) => {
    const rawActual = Number.isFinite(metric?.actualValues?.[monthIdx]) ? metric.actualValues[monthIdx] : null;
    const rawTarget = Number.isFinite(metric?.targetValues?.[monthIdx]) ? metric.targetValues[monthIdx] : 0;
    const selectedMonthLabel = metric?.labels?.[monthIdx] || '-';

    if (!metric || rawActual == null) {
      return (
        <div
          className="flex h-full flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onExpand?.()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onExpand?.(); }}
        >
          <div className="bg-[color:var(--surface-hover)] py-2 text-center text-base font-bold tracking-wide text-[color:var(--text-primary)]">{title}</div>
          <div className="border-b border-[color:var(--border)] px-3 py-1.5 text-center text-xs font-semibold text-[color:var(--text-secondary)]">
            {selectedMonthLabel}
          </div>
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-[color:var(--text-secondary)]">No data available</div>
        </div>
      );
    }

    const pct = rawTarget > 0 ? (rawActual / rawTarget) * 100 : Math.min(rawActual, 100);
    const clampedPct = Math.min(Math.max(pct, 0), 100);

    const donutData = [
      { name: 'Achieved', value: clampedPct, fill: accentColor },
      { name: 'Remaining', value: Math.max(100 - clampedPct, 0), fill: REMAINING_FILL },
    ];

    const trendData = metric.labels.map((label, idx) => ({
      month: label,
      actual: metric.actualValues[idx],
      target: metric.targetValues[idx],
    }));

    return (
      <div
        className="flex h-full flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] cursor-pointer transition-shadow hover:shadow-md"
        onClick={(e) => {
          if (e.target.closest('button')) return;
          onExpand?.();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.target.closest('button')) onExpand?.(); }}
      >
        <div className="bg-[color:var(--surface-hover)] py-2 text-center text-base font-bold tracking-wide text-[color:var(--text-primary)]">{title}</div>
        <div className="border-b border-[color:var(--border)] px-3 py-1.5 text-center text-xs font-semibold text-[color:var(--text-secondary)]">
          {selectedMonthLabel}
        </div>
        {/* Increased chart heights for better readability as months increase */}
        <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-2 items-center flex-1 min-h-0">
          {/* Donut */}
          <div className="h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={donutData} innerRadius={50} outerRadius={78} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[color:var(--text-primary)]">{clampedPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Trend line */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={32} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: '11px', padding: '6px' }}
                  formatter={(val) => val != null ? val.toFixed(1) : '-'}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={accentColor} strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="target" name="Target" stroke={targetColor} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
              </ReLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actual / Target / Achievement row */}
        <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--border)] px-3 pb-2 pt-1 text-center text-[10px]">
          <div>
            <span className="block text-[color:var(--text-muted)]">Actual</span>
            <span className="font-bold" style={{ color: accentColor }}>{rawActual.toFixed(1)}</span>
          </div>
          <div>
            <span className="block text-[color:var(--text-muted)]">Target</span>
            <span className="font-bold" style={{ color: targetColor }}>{rawTarget.toFixed(1)}</span>
          </div>
          <div>
            <span className="block text-[color:var(--text-muted)]">Achievement</span>
            <span className={`font-bold ${clampedPct >= 100 ? 'text-[color:var(--success)]' : clampedPct >= 90 ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]'}`}>
              {clampedPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  /** Small donut card for AE / PE / QE */
  const EfficiencyPieBox = ({ metric, title, color, monthIdx, onExpand }) => {
    const rawActual = Number.isFinite(metric?.actualValues?.[monthIdx]) ? metric.actualValues[monthIdx] : null;
    const rawTarget = Number.isFinite(metric?.targetValues?.[monthIdx]) ? metric.targetValues[monthIdx] : 0;

    if (rawActual == null) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center bg-[color:var(--surface)] p-2 cursor-pointer transition-colors hover:bg-[color:var(--surface-hover)]"
          onClick={() => onExpand?.()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onExpand?.(); }}
        >
          <div className="mb-0.5 text-center text-xs font-bold uppercase text-[color:var(--text-secondary)]">{title}</div>
          <div className="text-xs text-[color:var(--text-muted)]">No data</div>
        </div>
      );
    }

    const pct = rawTarget > 0 ? (rawActual / rawTarget) * 100 : Math.min(rawActual, 100);
    const clampedPct = Math.min(Math.max(pct, 0), 100);

    const donutData = [
      { name: 'Achieved', value: clampedPct, fill: color },
      { name: 'Remaining', value: Math.max(100 - clampedPct, 0), fill: REMAINING_FILL },
    ];

    return (
      <div
        className="flex h-full flex-col items-center bg-[color:var(--surface)] p-2 cursor-pointer transition-colors hover:bg-[color:var(--surface-hover)]"
        onClick={() => onExpand?.()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onExpand?.(); }}
      >
        <div className="mb-0.5 text-center text-xs font-bold uppercase text-[color:var(--text-secondary)]">{title}</div>
        <div className="flex-1 w-full relative min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie data={donutData} innerRadius={30} outerRadius={48} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                {donutData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </RePieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-[color:var(--text-primary)]">{clampedPct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="mt-0.5 text-center text-[9px] text-[color:var(--text-muted)]">
          <span style={{ color }}>A: {rawActual.toFixed(1)}</span>
          {rawTarget > 0 && <span className="ml-1 text-orange-500">T: {rawTarget.toFixed(1)}</span>}
        </div>
      </div>
    );
  };

  /** Generic metric card for "other" metrics */
  const MetricCard = ({ metric, onExpand }) => {
    const rawActual = metric.latestActual;
    const rawTarget = metric.latestTarget;
    const hasTarget = rawTarget != null && rawTarget > 0;
    const pct = hasTarget ? (rawActual / rawTarget) * 100 : (rawActual != null ? Math.min(rawActual, 100) : 0);
    const clampedPct = Math.min(Math.max(pct, 0), 100);

    const isInverse = isInverseMetric(metric.title);
    const cardColor = clampedPct >= 100 ? '#16a34a' : clampedPct >= 90 ? '#f59e0b' : clampedPct >= 80 ? '#f97316' : '#ef4444';

    const donutData = [
      { name: 'Achieved', value: clampedPct, fill: cardColor },
      { name: 'Remaining', value: Math.max(100 - clampedPct, 0), fill: REMAINING_FILL },
    ];

    const trendData = metric.labels.map((label, idx) => ({
      month: label,
      actual: metric.actualValues[idx],
      target: metric.targetValues[idx],
    }));

    return (
      <div
        className="cursor-pointer overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] transition-shadow hover:shadow-lg"
        onClick={() => onExpand?.()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onExpand?.(); }}
      >
        <div className="truncate bg-[color:var(--surface-hover)] px-2 py-1.5 text-center text-xs font-bold tracking-wide text-[color:var(--text-primary)]" title={metric.title}>
          {metric.title}
        </div>
        <div className="p-2">
          <div className="grid grid-cols-2 gap-2 items-center">
            {/* Small donut */}
            <div className="h-[100px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={donutData} innerRadius={28} outerRadius={44} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-[color:var(--text-primary)]">{clampedPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* Mini trend */}
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={trendData} margin={{ top: 4, right: 4, left: -10, bottom: 4 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 7, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 7, fill: 'var(--text-muted)' }} width={24} axisLine={false} tickLine={false} />
                  <Line type="monotone" dataKey="actual" stroke={cardColor} strokeWidth={2} dot={false} connectNulls />
                  {hasTarget && <Line type="monotone" dataKey="target" stroke="#fb923c" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-[color:var(--border)] pt-1.5 text-center text-[9px]">
            <div><span className="block text-[color:var(--text-muted)]">Actual</span><span className="font-bold text-[color:var(--text-secondary)]">{rawActual != null ? rawActual.toFixed(1) : '-'}</span></div>
            <div><span className="block text-[color:var(--text-muted)]">Target</span><span className="font-bold text-[color:var(--accent)]">{rawTarget != null ? rawTarget.toFixed(1) : '-'}</span></div>
            <div><span className="block text-[color:var(--text-muted)]">Achv</span><span className={`font-bold ${clampedPct >= 100 ? 'text-[color:var(--success)]' : clampedPct >= 90 ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]'}`}>{clampedPct.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════ EXPANDED MODAL CHART RENDERERS ══════════════ */

  const renderExpandedMetricChart = (chartKey, metric) => {
    if (!metric) return <div className="py-8 text-center text-[color:var(--text-secondary)]">No data available</div>;

    const rawActual = Number.isFinite(metric.actualValues?.[selectedMonthIdx]) ? metric.actualValues[selectedMonthIdx] : null;
    const rawTarget = Number.isFinite(metric.targetValues?.[selectedMonthIdx]) ? metric.targetValues[selectedMonthIdx] : 0;
    const selectedMonthLabel = metric.labels?.[selectedMonthIdx] || '-';

    const isMainMetric = ['ope', 'oee', 'ae', 'pe', 'qe'].includes(chartKey);
    let accentColor = CHART_COLORS[chartKey] || '#3b82f6';

    if (!isMainMetric) {
      const la = metric.latestActual;
      const lt = metric.latestTarget;
      const hasTarget = lt != null && lt > 0;
      const p = hasTarget ? (la / lt) * 100 : (la != null ? Math.min(la, 100) : 0);
      const cp = Math.min(Math.max(p, 0), 100);
      accentColor = cp >= 100 ? '#16a34a' : cp >= 90 ? '#f59e0b' : cp >= 80 ? '#f97316' : '#ef4444';
    }

    const pct = rawTarget > 0 && rawActual != null ? (rawActual / rawTarget) * 100 : (rawActual != null ? Math.min(rawActual, 100) : 0);
    const clampedPct = rawActual != null ? Math.min(Math.max(pct, 0), 100) : 0;

    const donutData = rawActual != null ? [
      { name: 'Achieved', value: clampedPct, fill: accentColor },
      { name: 'Remaining', value: Math.max(100 - clampedPct, 0), fill: REMAINING_FILL },
    ] : [];

    const trendData = (metric.labels || []).map((label, idx) => ({
      month: label,
      actual: metric.actualValues[idx],
      target: metric.targetValues[idx],
    }));

    return (
      <div className="w-full">
        {/* Month navigation in expanded view */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            type="button"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow"
            onClick={(e) => {
              e.stopPropagation();
              const total = metric.labels?.length || 12;
              setSelectedMonthIdx(selectedMonthIdx === 0 ? total - 1 : selectedMonthIdx - 1);
            }}
            disabled={!metric.labels?.length}
            title="Previous Month"
          >
            ‹
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[80px] text-center">
            {selectedMonthLabel} {fiscalYear}
          </span>
          <button
            type="button"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow"
            onClick={(e) => {
              e.stopPropagation();
              const total = metric.labels?.length || 12;
              setSelectedMonthIdx(selectedMonthIdx === total - 1 ? 0 : selectedMonthIdx + 1);
            }}
            disabled={!metric.labels?.length}
            title="Next Month"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Large Donut */}
          <div className="h-[320px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={donutData} innerRadius={80} outerRadius={130} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-extrabold text-gray-800">{rawActual != null ? clampedPct.toFixed(1) : '-'}%</span>
              {rawActual != null && (
                <span className="text-sm text-gray-500 mt-1">
                  {rawActual.toFixed(1)} / {rawTarget.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {/* Large Trend Line */}
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={trendData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={40} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: '12px', padding: '8px' }}
                  formatter={(val) => val != null ? val.toFixed(1) : '-'}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={accentColor} strokeWidth={3} dot={{ r: 4, fill: accentColor }} activeDot={{ r: 6 }} connectNulls />
                <Line type="monotone" dataKey="target" name="Target" stroke={CHART_COLORS.target} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: CHART_COLORS.target }} connectNulls />
              </ReLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Summary */}
        {rawActual != null && (
          <div className="mt-6 grid grid-cols-3 gap-6 text-center border-t border-gray-200 pt-6">
            <div>
              <span className="text-gray-500 block text-sm mb-1">Actual</span>
              <span className="font-bold text-2xl" style={{ color: accentColor }}>{rawActual.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-sm mb-1">Target</span>
              <span className="font-bold text-2xl" style={{ color: CHART_COLORS.target }}>{rawTarget.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-sm mb-1">Achievement</span>
              <span className={`font-bold text-2xl ${clampedPct >= 100 ? 'text-green-600' : clampedPct >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                {clampedPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderExpandedManagementLoss = (data) => {
    if (!data) return <div className="text-center text-gray-500 py-8">No data available</div>;
    return (
      <div className="w-full">
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.stackedRows} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: '12px', padding: '10px' }}
                formatter={(val, name) => val != null ? [val.toFixed(2), name] : ['-', name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {data.managementLossSeries.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="management-loss"
                  name={series.title}
                  fill={series.color}
                />
              ))}
              <Line
                type="monotone"
                dataKey="target"
                name="MANAGEMENT LOSS TIME - TARGET"
                stroke="#374151"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  /* ══════════════ LOADING STATE ══════════════ */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <div className="text-lg text-[color:var(--text-secondary)]">Loading KPI Dashboard...</div>
        </div>
      </div>
    );
  }

  const hasLayout = layout?.hasAnyData;
  const hasSpecificLayout = !!(layout?.ope || layout?.oee || layout?.ae || layout?.pe || layout?.qe || layout?.managementLossSeries?.some(s => s.metric));
  const totalMonths = layout?.monthLabels?.length || 12;

  /* ══════════════ MAIN RENDER ══════════════ */
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] p-4 sm:p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* ── Header ── */}
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--accent)] transition hover:text-[color:var(--accent-hover)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>

          {/* ═══ Compact Fiscal Year Selector ═══ */}
          <div className="flex h-9 min-h-0 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 shadow">
            <button
              onClick={() => {
                const currentIndex = AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear);
                if (currentIndex > 0) {
                  setSelectedFiscalYear(AVAILABLE_FISCAL_YEARS[currentIndex - 1]);
                  setSelectedMonthIdx(0);
                }
              }}
              disabled={AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear) <= 0}
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
            {AVAILABLE_FISCAL_YEARS.length > 0 && (
              <span className="mr-1 text-xs text-[color:var(--text-muted)]">
                ({AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear) + 1} / {AVAILABLE_FISCAL_YEARS.length})
              </span>
            )}
            <button
              onClick={() => {
                const currentIndex = AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear);
                if (currentIndex >= 0 && currentIndex < AVAILABLE_FISCAL_YEARS.length - 1) {
                  setSelectedFiscalYear(AVAILABLE_FISCAL_YEARS[currentIndex + 1]);
                  setSelectedMonthIdx(0);
                }
              }}
              disabled={AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear) >= AVAILABLE_FISCAL_YEARS.length - 1}
              className="rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Next Fiscal Year"
              style={{ lineHeight: '1' }}
            >
              ›
            </button>
          </div>
          {/* ═══ Fiscal Year Selector end ═══ */}
        </div>

        {/* ── KPI Title Banner ── */}
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-sm">
          <div className="mb-3 rounded-md bg-[color:var(--accent)] py-2.5 text-center text-lg font-bold tracking-wide text-white">
            {parentKPI?.title || 'KPI DASHBOARD'}
          </div>
          {hasLayout ? (
            <>
              {/* ════════ 3-COLUMN DASHBOARD LAYOUT ════════ */}
              {hasSpecificLayout && (
                <div className="grid grid-cols-1 xl:grid-cols-[2fr_0.45fr_1.2fr] gap-3 items-stretch">

                  {/* ── LEFT COLUMN: OPE + OEE stacked vertically ── */}
                  <div className="flex flex-col gap-3">
                    <div className="flex-1 min-h-0">
                      <EfficiencyDonutCard
                        metric={layout.ope}
                        title="OVERALL PLANT EFFICIENCY (OPE)"
                        accentColor={CHART_COLORS.ope}
                        targetColor={CHART_COLORS.target}
                        monthIdx={selectedMonthIdx}
                        onExpand={() => openExpandedChart('ope')}
                      />
                    </div>
                    <div className="flex-1 min-h-0">
                      <EfficiencyDonutCard
                        metric={layout.oee}
                        title="OVERALL EQUIPMENT EFFECTIVENESS (OEE)"
                        accentColor={CHART_COLORS.oee}
                        targetColor={CHART_COLORS.target}
                        monthIdx={selectedMonthIdx}
                        onExpand={() => openExpandedChart('oee')}
                      />
                    </div>
                  </div>

                  {/* ── MIDDLE COLUMN: MONTH + AE / PE / QE ── */}
                  <div className="flex flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
                    {/* MONTH Header */}
                    <div className="bg-[color:var(--surface-hover)] py-2 text-center text-base font-bold tracking-wide text-[color:var(--text-primary)]">
                      MONTH
                    </div>

                    {/* Month Navigation: ‹ MonthName › */}
                    <div className="flex items-center justify-center gap-1 border-b border-[color:var(--border)] px-1 py-2 sm:gap-2">
                      <button
                        type="button"
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-hover)] text-base text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7 sm:text-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedMonthIdx(selectedMonthIdx === 0 ? totalMonths - 1 : selectedMonthIdx - 1);
                        }}
                        disabled={totalMonths <= 1}
                        title="Previous Month"
                      >
                        ‹
                      </button>

                      <span className="min-w-[50px] select-none text-center text-sm font-bold text-[color:var(--text-primary)] sm:text-base">
                        {layout?.monthLabels?.[selectedMonthIdx] || '-'}
                      </span>

                      <button
                        type="button"
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-hover)] text-base text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7 sm:text-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedMonthIdx(selectedMonthIdx === totalMonths - 1 ? 0 : selectedMonthIdx + 1);
                        }}
                        disabled={totalMonths <= 1}
                        title="Next Month"
                      >
                        ›
                      </button>
                    </div>

                    {/* AE / PE / QE Pie Boxes */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="min-h-0 flex-1 border-b border-[color:var(--border)]">
                        <EfficiencyPieBox metric={layout.ae} title="AE" color={CHART_COLORS.ae} monthIdx={selectedMonthIdx} onExpand={() => openExpandedChart('ae')} />
                      </div>
                      <div className="min-h-0 flex-1 border-b border-[color:var(--border)]">
                        <EfficiencyPieBox metric={layout.pe} title="PE" color={CHART_COLORS.pe} monthIdx={selectedMonthIdx} onExpand={() => openExpandedChart('pe')} />
                      </div>
                      <div className="flex-1 min-h-0">
                        <EfficiencyPieBox metric={layout.qe} title="QE" color={CHART_COLORS.qe} monthIdx={selectedMonthIdx} onExpand={() => openExpandedChart('qe')} />
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT COLUMN: Management Loss stacked bar ── */}
                  <div
                    className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] transition-shadow hover:shadow-md"
                    onClick={(e) => {
                      if (e.target.closest('button')) return;
                      openExpandedChart('managementLoss');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.target.closest('button')) openExpandedChart('managementLoss'); }}
                  >
                    <div className="bg-[color:var(--surface-hover)] py-2 text-center text-sm font-bold tracking-wide text-[color:var(--text-primary)]">
                      MANAGEMENT LOSS (HRS.)
                    </div>
                    <div className="flex-1 p-2 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={layout.stackedRows} margin={{ top: 8, right: 5, left: -10, bottom: 25 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={30} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ fontSize: '10px', padding: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-primary)' }}
                            formatter={(val, name) => val != null ? [val.toFixed(2), name] : ['-', name]}
                          />
                          <Legend wrapperStyle={{ fontSize: '8px', color: 'var(--text-secondary)' }} />
                          {layout.managementLossSeries.map((series) => (
                            <Bar
                              key={series.key}
                              dataKey={series.key}
                              stackId="management-loss"
                              name={series.title}
                              fill={series.color}
                            />
                          ))}
                          <Line
                            type="monotone"
                            dataKey="target"
                            name="MANAGEMENT LOSS TIME - TARGET"
                            stroke="#374151"
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── No specific metrics found — show ALL metrics as cards ── */
            metricCandidates.length > 0 ? (
              <div>
                <div className="mb-3 rounded-md bg-[color:var(--accent)] py-2 text-center text-sm font-bold tracking-wide text-white">
                  ALL KPI METRICS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {metricCandidates.map((c) => {
                    const series = buildFiscalSeries(c.rows || [], fiscalYear);
                    const m = {
                      id: c.id,
                      title: c.title,
                      actualValues: series.actualValues,
                      targetValues: series.targetValues,
                      labels: series.labels,
                      latestActual: getLatestSeriesValue(series.actualValues),
                      latestTarget: getLatestSeriesValue(series.targetValues),
                    };
                    return <MetricCard key={m.id} metric={m} onExpand={() => openExpandedChart(`other-${m.id}`)} />;
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-[color:var(--text-secondary)]">
                <svg className="mx-auto mb-3 h-12 w-12 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mb-1 font-semibold text-[color:var(--text-primary)]">No Data Available</p>
                <p className="text-sm">No KPI data found for FY {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}.</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* ══════════════ EXPANDED CHART MODAL ══════════════ */}
      {expandedChart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeExpandedChart}
        >
          <div
            className="flex h-[85vh] w-[95%] max-w-7xl flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-hover)] px-6 py-4">
              <h2 className="order-3 min-w-full flex-1 truncate px-2 text-center text-xl font-bold text-[color:var(--text-primary)] sm:order-none sm:min-w-0">
                {getChartTitle(expandedChart)}
              </h2>

              <button
                className="mr-2 p-1 text-2xl text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)] focus:outline-none"
                onClick={closeExpandedChart}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {expandedChart === 'managementLoss' ? (
                renderExpandedManagementLoss(getMetricForKey('managementLoss'))
              ) : (
                renderExpandedMetricChart(expandedChart, getMetricForKey(expandedChart))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIDetailPage;