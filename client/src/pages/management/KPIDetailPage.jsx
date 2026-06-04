import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getKPIs, getKPIById, getChildKPIs, getKPIValuesByKPI, getMonthlyDataByKPIValue } from '../../api/kpiApi';
import { getUserById } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // April to March

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
    row.month,
    row.month_no,
    row.month_number,
    row.monthName,
    row.month_name,
    row.month_label,
    row.period_month,
    row.period,
    row.date,
    row.entry_date,
    row.created_at,
    row.updated_at,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMonthValue(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const extractRowYear = (row) => {
  if (!row) return null;

  const directCandidates = [
    row.year,
    row.calendar_year,
    row.period_year,
    row.fy_year,
    row.fiscal_year,
  ];

  for (const candidate of directCandidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 1900 && numeric <= 3000) {
      return numeric;
    }
  }

  const dateCandidates = [
    row.date,
    row.entry_date,
    row.created_at,
    row.updated_at,
  ];

  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    const parsedDate = new Date(candidate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getFullYear();
    }
  }

  return null;
};

const filterRowsForFiscalWindow = (rows, fetchedYear, fiscalYear) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows.filter((row) => {
    const month = extractRowMonth(row);
    if (!month) return true;

    const rowYear = extractRowYear(row) ?? fetchedYear;

    if (rowYear === fiscalYear) {
      return month >= 4;
    }

    if (rowYear === fiscalYear + 1) {
      return month <= 3;
    }

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
  const ma = extractRowMonth(a);
  const mb = extractRowMonth(b);
  const av = ma ?? Number.MAX_SAFE_INTEGER;
  const bv = mb ?? Number.MAX_SAFE_INTEGER;
  return av - bv;
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
    const year = Number.isFinite(rawYear)
      ? rawYear
      : (month >= 4 ? fiscalYear : fiscalYear + 1);

    const inFiscalWindow = (year === fiscalYear && month >= 4) || (year === fiscalYear + 1 && month <= 3);
    if (!inFiscalWindow) return;

    const slotKey = `${year}-${month}`;
    const recency = getRowRecencyScore(row);
    const { actual, target } = extractActualTarget(row);

    if (actual !== null) {
      const previous = actualBySlot[slotKey];
      if (!previous || recency >= previous.recency) {
        actualBySlot[slotKey] = { value: actual, recency };
      }
    }

    if (target !== null) {
      const previous = targetBySlot[slotKey];
      if (!previous || recency >= previous.recency) {
        targetBySlot[slotKey] = { value: target, recency };
      }
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
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const isCorporateManagementLossTitle = (title) => {
  const normalized = (title || '').toString().trim().toLowerCase();
  return normalized.includes('corporate property management loss');
};

const normalizeTextValue = (value) => (value || '').toString().trim().toLowerCase();

const parseFiscalYearStart = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const fallback = Number(value);
    return Number.isFinite(fallback) ? fallback : null;
  }
  return null;
};

const LOSS_STACK_COLORS = ['#8bc34a', '#f9a825', '#ef6c00', '#6d4c41', '#26a69a', '#5c6bc0', '#ab47bc', '#42a5f5'];

  

const KPIDetailPage = () => {
  const { kpiId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Helper to get current fiscal year
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    // If we're in Jan-Mar, the fiscal year started last year
    return currentMonth >= 4 ? currentYear : currentYear - 1;
  };

  const [parentKPI, setParentKPI] = useState(null);
  const [parentKPIValues, setParentKPIValues] = useState([]);
  const [parentMonthlyData, setParentMonthlyData] = useState({});
  const [oeeChartData, setOeeChartData] = useState(null);
  const [managementLossNode, setManagementLossNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(location.state?.fiscalYear || getCurrentFiscalYear());
  const [expandedNodes, setExpandedNodes] = useState(new Set([parseInt(kpiId)]));
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [modalChart, setModalChart] = useState(null);
  const [userCache, setUserCache] = useState({});

  const ensureUserCached = async (userId) => {
    if (!userId) return null;
    const id = Number(userId);
    if (!Number.isFinite(id)) return null;
    if (userCache[id]) return userCache[id];
    try {
      const res = await getUserById(id);
      const resData = res?.data ?? null;
      // support multiple response shapes: { data: { ... } }, { user: { ... } }, or direct object
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

  useEffect(() => {
    loadKPIHierarchy();
  }, [kpiId, fiscalYear]);

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

  const flattenLossRows = (lossNode) => {
    const output = [];
    const walk = (currentNode) => {
      if (!currentNode) return;

      (Array.isArray(currentNode.values) ? currentNode.values : []).forEach((value) => {
        const rows = currentNode.monthlyData?.[value.id] || [];
        if (!rows.length) return;
        rows.forEach((row) => {
          output.push({
            ...row,
            value_type: row?.value_type || value?.data || currentNode?.kpi?.title || 'Actual',
          });
        });
      });

      (currentNode.children || []).forEach(walk);
    };

    walk(lossNode);
    return output;
  };

  const openChartModal = (chart) => {
    setModalChart(chart);
    // Prefetch operator usernames for modal rows (fire-and-forget)
    try {
      const rows = chart?.data || [];
      const ids = new Set();
      rows.forEach(r => {
        if (!r) return;
        const candidate = r.operator ?? r.data_operator ?? r.entered_by ?? r.operator_name ?? (r.user && (r.user.id || r.user.empid)) ?? r.created_by ?? r.entered_by_name;
        if (candidate != null) {
          const n = Number(candidate);
          if (Number.isFinite(n)) ids.add(n);
        } else if (r.user && (r.user.id || r.user.empid)) {
          const id = Number(r.user.id || r.user.empid);
          if (Number.isFinite(id)) ids.add(id);
        }
      });
      ids.forEach(id => ensureUserCached(id).catch(() => {}));
    } catch (err) {
      // swallow
    }
  };

  const closeChartModal = () => {
    setModalChart(null);
  };

  // Get fiscal month sequence with year info
  const getFiscalMonthSequence = (fiscalYear) => {
    return FISCAL_MONTHS.map(month => ({
      month,
      year: month >= 4 ? fiscalYear : fiscalYear + 1,
      label: MONTH_LABELS[month - 1]
    }));
  };

  // Recursively load KPI hierarchy
  const loadKPIHierarchy = async () => {
    try {
      setLoading(true);

      // Load parent KPI
      const kpiRes = await getKPIById(kpiId);
      const parentKPIData = kpiRes.data.data;
      setParentKPI(parentKPIData);
      console.log('📊 Parent KPI loaded:', parentKPIData.title, 'ID:', parentKPIData.id);

      await loadParentKpiValues(kpiId, fiscalYear);
      await loadComparisonCards(fiscalYear);

      setExpandedNodes(new Set([parseInt(kpiId)]));

    } catch (error) {
      console.error('Error loading KPI hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadParentKpiValues = async (parentId, fyYear) => {
    console.log('📊 Loading parent KPI values...');
    try {
      const valuesRes = await getKPIValuesByKPI(parentId);
      const parentValues = valuesRes.data.data || [];
      console.log('📊 Parent KPI has', parentValues.length, 'values:', parentValues.map(v => v.data));
      setParentKPIValues(parentValues);
      
      // Load monthly data for parent KPI values
      const monthlyDataByValue = {};
      for (const value of parentValues) {
        try {
          const allMonthlyData = [];
          
          // Get data for first calendar year (April-December)
          try {
            const dataRes1 = await getMonthlyDataByKPIValue(value.id, fyYear);
            if (dataRes1.data.data && Array.isArray(dataRes1.data.data)) {
              const filteredYearOne = filterRowsForFiscalWindow(dataRes1.data.data, fyYear, fyYear);
              allMonthlyData.push(...filteredYearOne);
            }
          } catch (err) {
            // No data available for this year
          }
          
          // Get data for second calendar year (January-March)
          try {
            const dataRes2 = await getMonthlyDataByKPIValue(value.id, fyYear + 1);
            if (dataRes2.data.data && Array.isArray(dataRes2.data.data)) {
              const filteredYearTwo = filterRowsForFiscalWindow(dataRes2.data.data, fyYear + 1, fyYear);
              allMonthlyData.push(...filteredYearTwo);
            }
          } catch (err) {
            // No data available for this year
          }
          
          monthlyDataByValue[value.id] = allMonthlyData;
        } catch (error) {
          console.error(`Error loading data for parent KPI value ${value.id}:`, error);
          monthlyDataByValue[value.id] = [];
        }
      }
      setParentMonthlyData(monthlyDataByValue);
    } catch (error) {
      console.error('Error loading parent KPI values:', error);
      setParentKPIValues([]);
      setParentMonthlyData({});
    }
  };

  const loadMonthlyDataForValue = async (valueId, fyYear) => {
    const allMonthlyData = [];

    try {
      const dataRes1 = await getMonthlyDataByKPIValue(valueId, fyYear);
      if (dataRes1.data.data && Array.isArray(dataRes1.data.data)) {
        const filteredYearOne = filterRowsForFiscalWindow(dataRes1.data.data, fyYear, fyYear);
        allMonthlyData.push(...filteredYearOne);
      }
    } catch (error) {
      // ignore missing year data
    }

    try {
      const dataRes2 = await getMonthlyDataByKPIValue(valueId, fyYear + 1);
      if (dataRes2.data.data && Array.isArray(dataRes2.data.data)) {
        const filteredYearTwo = filterRowsForFiscalWindow(dataRes2.data.data, fyYear + 1, fyYear);
        allMonthlyData.push(...filteredYearTwo);
      }
    } catch (error) {
      // ignore missing year data
    }

    return allMonthlyData;
  };

  const buildLossTreeNode = async (kpi, fyYear, level = 1) => {
    const valuesRes = await getKPIValuesByKPI(kpi.id);
    const values = valuesRes.data.data || [];

    const monthlyDataByValue = {};
    for (const value of values) {
      monthlyDataByValue[value.id] = await loadMonthlyDataForValue(value.id, fyYear);
    }

    const childRes = await getChildKPIs(kpi.id);
    const childKpis = childRes.data.data || [];
    const children = [];
    for (const childKpi of childKpis) {
      children.push(await buildLossTreeNode(childKpi, fyYear, level + 1));
    }

    return {
      kpi,
      level,
      values,
      monthlyData: monthlyDataByValue,
      children,
    };
  };

  const loadComparisonCards = async (fyYear) => {
    let allKpis = [];
    try {
      const kpisRes = await getKPIs();
      allKpis = kpisRes.data?.data || [];
    } catch (error) {
      console.error('Error fetching KPI list:', error);
      setOeeChartData(null);
      setManagementLossNode(null);
      return;
    }

    const fiscalScopedKpis = allKpis.filter((kpi) => parseFiscalYearStart(kpi?.fin_year) === fyYear);

    const findKpi = (matchers) => {
      const checks = Array.isArray(matchers) ? matchers : [matchers];
      const byTitle = (kpi) => {
        const title = normalizeTextValue(kpi?.title);
        return checks.some((check) => check(title));
      };

      return fiscalScopedKpis.find(byTitle) || allKpis.find(byTitle) || null;
    };

    // Load OEE independently so its failure doesn't affect the loss chart
    try {
      const oeeKpi = findKpi([
        (title) => title === 'overall equipment effectiveness (oee)',
        (title) => title.includes('overall equipment effectiveness'),
        (title) => title.includes('oee')
      ]);

      if (oeeKpi) {
        const oeeValuesRes = await getKPIValuesByKPI(oeeKpi.id);
        const oeeValues = oeeValuesRes.data.data || [];
        const firstOeeValue = oeeValues[0] || null;
        const oeeMonthlyData = firstOeeValue ? await loadMonthlyDataForValue(firstOeeValue.id, fyYear) : [];
        setOeeChartData({ title: oeeKpi.title, data: oeeMonthlyData });
      } else {
        setOeeChartData(null);
      }
    } catch (error) {
      console.error('Error loading OEE chart data:', error);
      setOeeChartData(null);
    }

    // Load management loss independently so its failure doesn't affect OEE
    try {
      const lossKpi = findKpi([
        (title) => title === 'corporate property management loss',
        (title) => title.includes('corporate property management loss'),
        (title) => title.includes('management loss')
      ]);

      if (lossKpi) {
        const lossTree = await buildLossTreeNode(lossKpi, fyYear);
        setManagementLossNode(lossTree);
      } else {
        console.warn(`[ManagementLoss] No KPI found matching "management loss" titles in FY${fyYear}. Available KPIs:`, allKpis.map(k => k.title));
        setManagementLossNode(null);
      }
    } catch (error) {
      console.error('Error loading management loss chart data:', error);
      setManagementLossNode(null);
    }
  };

  // Helper to detect if a metric is inverse (lower is better)
  const isInverseMetric = (metricName) => {
    const inversePatterns = [
      'NO OPERATOR', 'NO ', 'NOT ', 'UN', 'LOSS', 'LOSSES', 'DEFECT', 'FAILURE', 
      'ERROR', 'DOWNTIME', 'DELAY', 'REJECT', 'SCRAP', 'WASTE', 'BREAKDOWN',
      'ABSENT', 'TURNOVER', 'ACCIDENT', 'INCIDENT', 'VIOLATION'
    ];
    const upperName = metricName.toUpperCase();
    return inversePatterns.some(pattern => upperName.includes(pattern));
  };

  // Calculate achievement rate for a single metric
  const calculateAchievementRate = (actual, target, metricName) => {
    if (!target || target === 0) return 0;
    
    if (isInverseMetric(metricName)) {
      // For inverse metrics (lower is better): achievement = (target / actual) * 100
      // If actual is 0 (perfect), return 100%
      if (actual === 0) return 100;
      const rate = (target / actual) * 100;
      // Cap at 100% for inverse metrics
      return Math.min(rate, 100);
    } else {
      // For normal metrics (higher is better): achievement = (actual / target) * 100
      return (actual / target) * 100;
    }
  };

  const toggleExpand = (kpiId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(kpiId)) {
      newExpanded.delete(kpiId);
    } else {
      newExpanded.add(kpiId);
    }
    setExpandedNodes(newExpanded);
  };

  const LineChart = ({ data, title, size = 'default', operator, valueId, parentKpiId }) => {
    // Debug logging for all metrics
    console.log(`[LineChart] parentKpiId: ${parentKpiId} valueId: ${valueId} Title: ${title}`);
    console.log(`[LineChart] Data received for parent ${parentKpiId} value ${valueId}:`, data);
    console.log(`[LineChart] Data length:`, data?.length);
    
    if (!data || data.length === 0) {
      console.log(`[LineChart] No data available for ${title}`);
      return (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      );
    }

    const actuals = data
      .filter((d) => extractRowType(d) === 'actual')
      .sort(sortByExtractedMonth);
    const targets = data
      .filter((d) => extractRowType(d) === 'target')
      .sort(sortByExtractedMonth);

    console.log(`[LineChart] ${title} - Actuals:`, actuals.length, 'Targets:', targets.length);

    const { actualValues, targetValues, labels } = buildFiscalSeries(data, fiscalYear);

    console.log(`[LineChart] ${title} - Actual values:`, actualValues);
    console.log(`[LineChart] ${title} - Target values:`, targetValues);

    const allValues = [...actualValues.filter(v => v !== null), ...targetValues.filter(v => v !== null)];
    const maxValRaw = allValues.length > 0 ? Math.max(...allValues) : 0;
    const minValRaw = allValues.length > 0 ? Math.min(...allValues) : 0;
    const minVal = Math.min(0, minValRaw);
    const maxVal = maxValRaw === minVal ? minVal + 1 : maxValRaw;

    console.log(`[LineChart] ${title} - Value range: ${minVal} to ${maxVal}`);

    const chartSizes = {
      compact: { svgWidth: 600, svgHeight: 300, padding: 50, minHeight: '320px' },
      default: { svgWidth: 700, svgHeight: 380, padding: 60, minHeight: '400px' },
      modal: { svgWidth: 900, svgHeight: 460, padding: 70, minHeight: '520px' }
    };
    const { svgWidth, svgHeight, padding, minHeight } = chartSizes[size] || chartSizes.default;

    const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * (svgWidth - 2 * padding);
    const getY = (val) => {
      if (val === null) return null;
      return svgHeight - padding - ((val - minVal) / (maxVal - minVal || 1)) * (svgHeight - 2 * padding);
    };

    // Calculate achievement rate and trend using the proper method
    const lastActual = getLatestSeriesValue(actualValues);
    const lastTarget = getLatestSeriesValue(targetValues);
    // Fallback: if month-mapped values are missing, try to find the latest numeric values from raw rows
    const findLatestNumeric = (rows, keys) => {
      if (!rows || rows.length === 0) return null;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        for (const k of keys) {
          const val = parseNumeric(row?.[k]);
          if (val !== null) return val;
        }
      }
      return null;
    };
    const fallbackActual = findLatestNumeric(data, ['actual_value', 'actual', 'value']);
    const fallbackTarget = findLatestNumeric(data, ['target_value', 'target', 'value']);
    const effectiveLastActual = (lastActual === undefined || lastActual === null) ? fallbackActual : lastActual;
    const effectiveLastTarget = (lastTarget === undefined || lastTarget === null) ? fallbackTarget : lastTarget;
    const achievementRate = (effectiveLastTarget > 0 || effectiveLastActual > 0)
      ? calculateAchievementRate(effectiveLastActual, effectiveLastTarget, title).toFixed(1)
      : 'N/A';
    const isInverse = isInverseMetric(title);
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            {operator && <div className="text-xs text-gray-500 mt-1">Data by: {operator}</div>}
          </div>
          {effectiveLastActual !== undefined && effectiveLastTarget !== undefined && achievementRate !== 'N/A' && (
            <div className={`px-3 py-1 rounded text-sm font-semibold ${
              parseFloat(achievementRate) >= 100 ? 'bg-green-100 text-green-800' :
              parseFloat(achievementRate) >= 90 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {achievementRate}%
            </div>
          )}
        </div>
        {isInverse && (
          <div className="mb-2 text-xs text-gray-500 italic">
            ⚠️ Lower is better for this metric
          </div>
        )}

        {/* Side-by-side: Donut (left) + Line chart (right) */}
        <div className="flex gap-4 items-center">
          {/* Donut Chart – Achievement */}
          {achievementRate !== 'N/A' && (
            <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ width: '160px' }}>
              <svg viewBox="0 0 140 140" width="140" height="140">
                <circle cx={70} cy={70} r={50} fill="none" stroke="#41aafe" strokeWidth={18} />
                <circle
                  cx={70} cy={70} r={50}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(parseFloat(achievementRate), 100) / 100 * 314.159).toFixed(2)} 314.159`}
                  transform="rotate(-90 70 70)"
                />
                <text x={70} y={63} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
                  {achievementRate}%
                </text>
                <text x={70} y={80} textAnchor="middle" fontSize="10" fill="#6b7280">
                  Achievement
                </text>
              </svg>
              <div className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded ${
                parseFloat(achievementRate) >= 100 ? 'text-green-700 bg-green-50' :
                parseFloat(achievementRate) >= 90 ? 'text-yellow-700 bg-yellow-50' :
                'text-red-700 bg-red-50'
              }`}>
                {parseFloat(achievementRate) >= 100 ? 'On Target' :
                 parseFloat(achievementRate) >= 90 ? 'Near Target' : 'Below Target'}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full border border-gray-300 bg-white" style={{ minHeight, display: 'block' }}>
              {[...Array(5)].map((_, i) => {
                const value = minVal + (i / 4) * (maxVal - minVal);
                const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
                return (
                  <g key={`grid-${i}`}>
                    <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
                  </g>
                );
              })}

              <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
              <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

              {targetValues.some(v => v !== null) && (
                <polyline
                  points={targetValues.map((val, idx) => {
                    const y = getY(val);
                    return y !== null ? `${getX(idx)},${y}` : '';
                  }).filter(p => p).join(' ')}
                  fill="none"
                  stroke="#ffb74d"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {actualValues.some(v => v !== null) && (
                <polyline
                  points={actualValues.map((val, idx) => {
                    const y = getY(val);
                    return y !== null ? `${getX(idx)},${y}` : '';
                  }).filter(p => p).join(' ')}
                  fill="none"
                  stroke="#41aafe"
                  strokeWidth="3"
                />
              )}

              {targetValues.map((val, idx) => {
                if (val === null) return null;
                const x = getX(idx);
                const y = getY(val);
                return (
                  <g key={`target-${idx}`}>
                    <circle cx={x} cy={y} r="3" fill="#ffb74d" stroke="white" strokeWidth="1" />
                    <text x={x} y={y - 12} textAnchor="middle" fontSize="10" fill="#c97706" fontWeight="bold">
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {actualValues.map((val, idx) => {
                if (val === null) return null;
                const x = getX(idx);
                const y = getY(val);
                return (
                  <g key={`actual-${idx}`}>
                    <circle cx={x} cy={y} r="5" fill="#41aafe" stroke="white" strokeWidth="2" />
                    <text x={x} y={y + 18} textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="bold">
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {labels.map((label, idx) => (
                <text key={`x-${idx}`} x={getX(idx)} y={svgHeight - padding + 25} textAnchor="middle" fontSize="11" fill="#4b5563">
                  {label}
                </text>
              ))}

              {[...Array(5)].map((_, i) => {
                const value = minVal + (i / 4) * (maxVal - minVal);
                const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
                return (
                  <text key={`y-${i}`} x={padding - 10} y={y + 5} textAnchor="end" fontSize="11" fill="#4b5563">
                    {value.toFixed(0)}
                  </text>
                );
              })}

              <text x={svgWidth / 2} y={svgHeight - 5} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
                Month
              </text>
              <text x={15} y={svgHeight / 2} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500" transform={`rotate(-90 15 ${svgHeight / 2})`}>
                Value
              </text>
            </svg>

            <div className="flex gap-6 mt-3 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 bg-[#41aafe] rounded"></span>
                <span className="text-xs text-gray-600">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 bg-[#ffb74d]" style={{ borderTop: '2px dashed #ffb74d' }}></span>
                <span className="text-xs text-gray-600">Target</span>
              </div>
            </div>
          </div>
        </div>

        {effectiveLastActual !== undefined && effectiveLastTarget !== undefined && (
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-gray-500 block">Latest Actual:</span>
              <span className="font-semibold text-blue-600">{(effectiveLastActual ?? 0).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Target:</span>
              <span className="font-semibold text-orange-600">{(effectiveLastTarget ?? 0).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Variance:</span>
              <span className={`font-semibold ${
                isInverse 
                  ? (effectiveLastActual <= effectiveLastTarget ? 'text-green-600' : 'text-red-600')
                  : (effectiveLastActual >= effectiveLastTarget ? 'text-green-600' : 'text-red-600')
              }`}>
                {(effectiveLastActual >= effectiveLastTarget ? '+' : '')}{((effectiveLastActual ?? 0) - (effectiveLastTarget ?? 0)).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Achievement:</span>
              <span className={`font-semibold ${
                parseFloat(achievementRate) >= 100 ? 'text-green-600' :
                parseFloat(achievementRate) >= 90 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {achievementRate}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const OeeChart = ({ data, title, size = 'compact', operator }) => {
    if (!data || data.length === 0) {
      return (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      );
    }

    const actuals = data.filter((d) => extractRowType(d) === 'actual').sort(sortByExtractedMonth);
    const targets = data.filter((d) => extractRowType(d) === 'target').sort(sortByExtractedMonth);
    const { actualValues, targetValues, labels } = buildFiscalSeries(data, fiscalYear);

    const allValues = [...actualValues.filter(v => v !== null), ...targetValues.filter(v => v !== null)];
    const maxValRaw = allValues.length > 0 ? Math.max(...allValues) : 0;
    const minValRaw = allValues.length > 0 ? Math.min(...allValues) : 0;
    const minVal = Math.min(0, minValRaw);
    const maxVal = maxValRaw === minVal ? minVal + 1 : maxValRaw;

    const chartSizes = {
      compact: { svgWidth: 600, svgHeight: 300, padding: 50, minHeight: '320px' },
      default: { svgWidth: 700, svgHeight: 380, padding: 60, minHeight: '400px' },
      modal: { svgWidth: 900, svgHeight: 460, padding: 70, minHeight: '520px' }
    };
    const { svgWidth, svgHeight, padding, minHeight } = chartSizes[size] || chartSizes.default;

    const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * (svgWidth - 2 * padding);
    const getY = (val) => {
      if (val === null) return null;
      return svgHeight - padding - ((val - minVal) / (maxVal - minVal || 1)) * (svgHeight - 2 * padding);
    };

    const lastActual = getLatestSeriesValue(actualValues);
    const lastTarget = getLatestSeriesValue(targetValues);
    const findLatestNumeric = (rows, keys) => {
      if (!rows || rows.length === 0) return null;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        for (const key of keys) {
          const val = parseNumeric(row?.[key]);
          if (val !== null) return val;
        }
      }
      return null;
    };

    const fallbackActual = findLatestNumeric(data, ['actual_value', 'actual', 'value']);
    const fallbackTarget = findLatestNumeric(data, ['target_value', 'target', 'value']);
    const effectiveLastActual = (lastActual === undefined || lastActual === null) ? fallbackActual : lastActual;
    const effectiveLastTarget = (lastTarget === undefined || lastTarget === null) ? fallbackTarget : lastTarget;
    const hasTarget = targetValues.some((value) => value !== null) || effectiveLastTarget !== null;
    const achievementValue = hasTarget
      ? calculateAchievementRate(effectiveLastActual, effectiveLastTarget, title)
      : (effectiveLastActual != null ? Math.min(100, effectiveLastActual) : 0);
    const achievementRate = Number.isFinite(achievementValue) ? achievementValue.toFixed(1) : 'N/A';
    const isInverse = isInverseMetric(title);

    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            {operator && <div className="text-xs text-gray-500 mt-1">Data by: {operator}</div>}
          </div>
          {achievementRate !== 'N/A' && (
            <div className={`px-3 py-1 rounded text-sm font-semibold ${
              parseFloat(achievementRate) >= 100 ? 'bg-green-100 text-green-800' :
              parseFloat(achievementRate) >= 90 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {achievementRate}%
            </div>
          )}
        </div>

        {isInverse && (
          <div className="mb-2 text-xs text-gray-500 italic">
            ⚠️ Lower is better for this metric
          </div>
        )}

        <div className="flex gap-4 items-center">
          {achievementRate !== 'N/A' && (
            <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ width: '160px' }}>
              <svg viewBox="0 0 140 140" width="140" height="140">
                <circle cx={70} cy={70} r={50} fill="none" stroke="#41aafe" strokeWidth={18} />
                <circle
                  cx={70} cy={70} r={50}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(parseFloat(achievementRate), 100) / 100 * 314.159).toFixed(2)} 314.159`}
                  transform="rotate(-90 70 70)"
                />
                <text x={70} y={63} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
                  {achievementRate}%
                </text>
                <text x={70} y={80} textAnchor="middle" fontSize="10" fill="#6b7280">
                  Achievement
                </text>
              </svg>
              <div className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded ${
                parseFloat(achievementRate) >= 100 ? 'text-green-700 bg-green-50' :
                parseFloat(achievementRate) >= 90 ? 'text-yellow-700 bg-yellow-50' :
                'text-red-700 bg-red-50'
              }`}>
                {parseFloat(achievementRate) >= 100 ? 'On Target' :
                 parseFloat(achievementRate) >= 90 ? 'Near Target' : 'Below Target'}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full border border-gray-300 bg-white" style={{ minHeight, display: 'block' }}>
              {[...Array(5)].map((_, i) => {
                const value = minVal + (i / 4) * (maxVal - minVal);
                const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
                return (
                  <g key={`oee-grid-${i}`}>
                    <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
                  </g>
                );
              })}

              <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
              <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

              {targetValues.some(v => v !== null) && (
                <polyline
                  points={targetValues.map((val, idx) => {
                    const y = getY(val);
                    return y !== null ? `${getX(idx)},${y}` : '';
                  }).filter(Boolean).join(' ')}
                  fill="none"
                  stroke="#ffb74d"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {actualValues.some(v => v !== null) && (
                <polyline
                  points={actualValues.map((val, idx) => {
                    const y = getY(val);
                    return y !== null ? `${getX(idx)},${y}` : '';
                  }).filter(Boolean).join(' ')}
                  fill="none"
                  stroke="#41aafe"
                  strokeWidth="3"
                />
              )}

              {targetValues.map((val, idx) => {
                if (val === null) return null;
                const x = getX(idx);
                const y = getY(val);
                return (
                  <g key={`oee-target-${idx}`}>
                    <circle cx={x} cy={y} r="3" fill="#ffb74d" stroke="white" strokeWidth="1" />
                    <text x={x} y={y - 12} textAnchor="middle" fontSize="10" fill="#c97706" fontWeight="bold">
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {actualValues.map((val, idx) => {
                if (val === null) return null;
                const x = getX(idx);
                const y = getY(val);
                return (
                  <g key={`oee-actual-${idx}`}>
                    <circle cx={x} cy={y} r="5" fill="#41aafe" stroke="white" strokeWidth="2" />
                    <text x={x} y={y + 18} textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="bold">
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {labels.map((label, idx) => (
                <text key={`oee-x-${idx}`} x={getX(idx)} y={svgHeight - padding + 25} textAnchor="middle" fontSize="11" fill="#4b5563">
                  {label}
                </text>
              ))}

              {[...Array(5)].map((_, i) => {
                const value = minVal + (i / 4) * (maxVal - minVal);
                const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
                return (
                  <text key={`oee-y-${i}`} x={padding - 10} y={y + 5} textAnchor="end" fontSize="11" fill="#4b5563">
                    {value.toFixed(0)}
                  </text>
                );
              })}

              <text x={svgWidth / 2} y={svgHeight - 5} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
                Month
              </text>
              <text x={15} y={svgHeight / 2} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500" transform={`rotate(-90 15 ${svgHeight / 2})`}>
                Value
              </text>
            </svg>

            <div className="flex gap-6 mt-3 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 bg-[#41aafe] rounded"></span>
                <span className="text-xs text-gray-600">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 bg-[#ffb74d]" style={{ borderTop: '2px dashed #ffb74d' }}></span>
                <span className="text-xs text-gray-600">Target</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StackedLossChart = ({ node, size = 'default' }) => {
    if (!node) return null;

    const genericValueLabels = ['actual', 'achieved', 'target', 'value', 'hours', 'hour', 'hrs', 'hr'];
    const isGenericValueLabel = (value) => genericValueLabels.includes(normalizeTextValue(value));

    const pickSegmentLabel = (currentNode, value) => {
      const valueLabel = (value?.data || value?.title || '').toString().trim();
      const nodeLabel = (currentNode?.kpi?.title || '').toString().trim();
      if (valueLabel && !isGenericValueLabel(valueLabel)) {
        return valueLabel;
      }
      return nodeLabel || valueLabel || 'Segment';
    };

    const getActualRows = (rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      return rows.filter((row) => {
        const { actual, type } = extractActualTarget(row);
        if (actual !== null) return true;
        if (type === 'target') return false;
        return parseNumeric(row?.value) !== null;
      });
    };

    const collectLossSegments = (currentNode, segmentMap = new Map()) => {
      if (!currentNode) return segmentMap;

      (Array.isArray(currentNode.values) ? currentNode.values : []).forEach((value) => {
        if (!value) return;
        const rows = getActualRows(currentNode.monthlyData?.[value.id] || []);
        if (rows.length === 0) return;

        const label = pickSegmentLabel(currentNode, value);
        const existing = segmentMap.get(label) || [];
        segmentMap.set(label, [...existing, ...rows]);
      });

      (currentNode.children || []).forEach((childNode) => {
        collectLossSegments(childNode, segmentMap);
      });

      return segmentMap;
    };

    const resolvedSegments = Array.from(collectLossSegments(node, new Map()).entries()).map(([label, rows]) => ({
      label,
      rows,
    }));
    if (resolvedSegments.length === 0) {
      return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">{node?.kpi?.title || 'Corporate Property Management Loss'}</h3>
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      );
    }

    const labels = FISCAL_MONTHS.map((month) => MONTH_LABELS[month - 1]);

    const series = resolvedSegments.map((segment, index) => {
      const rows = segment.rows || [];
      const { actualValues } = buildFiscalSeries(rows, fiscalYear);
      const sourceValues = actualValues;
      return {
        name: segment.label || `Segment ${index + 1}`,
        values: sourceValues.map((entry) => (entry == null ? 0 : Math.max(0, entry))),
        color: LOSS_STACK_COLORS[index % LOSS_STACK_COLORS.length],
      };
    });

    const rootRows = [];
    (Array.isArray(node.values) ? node.values : []).forEach((value) => {
      const rows = node.monthlyData?.[value.id] || [];
      rootRows.push(...rows);
    });

    let { targetValues } = buildFiscalSeries(rootRows, fiscalYear);
    if (!targetValues.some((entry) => entry != null)) {
      targetValues = Array(labels.length).fill(0);
      resolvedSegments.forEach((segment) => {
        const rows = segment.rows || [];
        const { targetValues: segmentTargets } = buildFiscalSeries(rows, fiscalYear);
        segmentTargets.forEach((entry, index) => {
          if (entry != null) targetValues[index] += Math.max(0, entry);
        });
      });
    }

    const normalizedTargetValues = targetValues.map((entry) => (entry == null ? 0 : Math.max(0, entry)));

    const totals = labels.map((_, monthIndex) => series.reduce((sum, segment) => sum + (segment.values[monthIndex] || 0), 0));
    const yMax = Math.max(1, ...totals, ...normalizedTargetValues);
    const chartSizes = {
      compact: { svgWidth: 600, svgHeight: 300, padding: 50, minHeight: '320px' },
      default: { svgWidth: 920, svgHeight: 420, padding: 56, minHeight: '420px' },
      modal: { svgWidth: 980, svgHeight: 500, padding: 60, minHeight: '500px' }
    };
    const { svgWidth, svgHeight, padding, minHeight } = chartSizes[size] || chartSizes.default;
    const plotWidth = svgWidth - (2 * padding);
    const slotWidth = plotWidth / (labels.length || 1);
    const barWidth = slotWidth * 0.6;
    const getX = (idx) => padding + (idx * slotWidth) + ((slotWidth - barWidth) / 2);
    const getY = (value) => svgHeight - padding - ((value / yMax) * (svgHeight - (2 * padding)));

    return (
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 h-full">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-800">{node?.kpi?.title || 'Corporate Property Management Loss'} (Hrs.)</h3>
        </div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full border border-gray-300 bg-white" style={{ minHeight, display: 'block' }}>
          {[...Array(6)].map((_, i) => {
            const value = (i / 5) * yMax;
            const y = getY(value);
            return (
              <g key={`loss-grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#4b5563">{Math.round(value)}</text>
              </g>
            );
          })}
          <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#111827" strokeWidth="1.5" />
          <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#111827" strokeWidth="1.5" />

          {labels.map((label, monthIndex) => {
            let cumulative = 0;
            return (
              <g key={`loss-month-${label}-${monthIndex}`}>
                {series.map((segment) => {
                  const segmentValue = segment.values[monthIndex] || 0;
                  if (segmentValue <= 0) return null;
                  const yTop = getY(cumulative + segmentValue);
                  const yBottom = getY(cumulative);
                  const segmentHeight = Math.max(0, yBottom - yTop);
                  const showInlineLabel = segmentHeight >= 14;
                  const rect = (
                    <g key={`${segment.name}-${monthIndex}`}>
                      <rect x={getX(monthIndex)} y={yTop} width={barWidth} height={segmentHeight} fill={segment.color} />
                      {showInlineLabel && (
                        <text
                          x={getX(monthIndex) + (barWidth / 2)}
                          y={yTop + Math.min(segmentHeight / 2 + 4, segmentHeight - 2)}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="600"
                          fill="#1f2937"
                          paintOrder="stroke"
                          stroke="rgba(255,255,255,0.85)"
                          strokeWidth="2"
                        >
                          {segment.name}
                        </text>
                      )}
                    </g>
                  );
                  cumulative += segmentValue;
                  return rect;
                })}
                <text x={getX(monthIndex) + (barWidth / 2)} y={svgHeight - padding + 20} textAnchor="middle" fontSize="11" fill="#4b5563">
                  {label}
                </text>
              </g>
            );
          })}

          <polyline
            points={normalizedTargetValues.map((value, index) => `${getX(index) + (barWidth / 2)},${getY(value)}`).join(' ')}
            fill="none"
            stroke="#374151"
            strokeWidth="2"
            strokeDasharray="6,4"
          />

          <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">Month</text>
          <text x={18} y={svgHeight / 2} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500" transform={`rotate(-90 18 ${svgHeight / 2})`}>
            Loss (Hrs.)
          </text>
        </svg>
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Box names</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {series.map((segment, index) => (
              <div
                key={`legend-${segment.name}`}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 max-w-full"
                title={segment.name}
              >
                <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: segment.color }}></span>
                <span className="text-gray-700 font-medium truncate">{index + 1}. {segment.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              <span className="inline-block w-4 h-0.5 bg-gray-700" style={{ borderTop: '2px dashed #374151' }}></span>
              <span className="text-gray-700 font-medium">Target</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Simple bar chart for KPI values that have only actuals (no target)
  const SimpleBarChart = ({ data, title, size = 'default', operator, valueId, parentKpiId }) => {
    console.log(`[SimpleBarChart] parentKpiId: ${parentKpiId} valueId: ${valueId} Title: ${title}`);
    console.log(`[SimpleBarChart] Data length:`, data?.length);
    if (!data || data.length === 0) {
      return (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      );
    }

    const { actualValues: values, labels } = buildFiscalSeries(data, fiscalYear);

    const maxValRaw = values.filter(v => v !== null).length > 0 ? Math.max(...values.filter(v => v !== null)) : 0;
    const minValRaw = values.filter(v => v !== null).length > 0 ? Math.min(...values.filter(v => v !== null)) : 0;
    const minVal = Math.min(0, minValRaw);
    const maxVal = maxValRaw === minVal ? minVal + 1 : maxValRaw;

    const chartSizes = {
      compact: { svgWidth: 600, svgHeight: 260, padding: 40, minHeight: '280px' },
      default: { svgWidth: 700, svgHeight: 320, padding: 50, minHeight: '340px' },
      modal: { svgWidth: 900, svgHeight: 420, padding: 60, minHeight: '460px' }
    };
    const { svgWidth, svgHeight, padding, minHeight } = chartSizes[size] || chartSizes.default;

    const barWidth = (svgWidth - 2 * padding) / (labels.length || 1) * 0.7;

    const getY = (val) => svgHeight - padding - ((val - minVal) / (maxVal - minVal || 1)) * (svgHeight - 2 * padding);

    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            {operator && <div className="text-xs text-gray-500 mt-1">Data by: {operator}</div>}
          </div>
        </div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full border border-gray-300 bg-white" style={{ minHeight, display: 'block' }}>
          {/* Bars */}
          {values.map((val, idx) => {
            const x = padding + idx * ((svgWidth - 2 * padding) / (labels.length || 1)) + ((svgWidth - 2 * padding) / (labels.length || 1) - barWidth) / 2;
            const y = val === null ? svgHeight - padding : getY(val);
            const height = val === null ? 0 : (svgHeight - padding - y);
            return (
              <g key={`bar-${idx}`}>
                <rect x={x} y={y} width={barWidth} height={height} fill="#41aafe" rx="3" />
                {val !== null && (
                  <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="600">
                    {val.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {labels.map((label, idx) => (
            <text key={`x-${idx}`} x={padding + idx * ((svgWidth - 2 * padding) / (labels.length || 1)) + ((svgWidth - 2 * padding) / (labels.length || 1)) / 2} y={svgHeight - padding + 20} textAnchor="middle" fontSize="11" fill="#4b5563">
              {label}
            </text>
          ))}

          {/* Y-axis labels */}
          {[...Array(5)].map((_, i) => {
            const value = minVal + (i / 4) * (maxVal - minVal);
            const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
            return (
              <text key={`y-${i}`} x={padding - 10} y={y + 5} textAnchor="end" fontSize="11" fill="#4b5563">
                {value.toFixed(0)}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderKPINode = (node) => {
    const { kpi, values, monthlyData, children, level } = node;
    const isExpanded = expandedNodes.has(kpi.id);
    const hasChildren = children && children.length > 0;

    // Calculate node performance - average achievement rates across all metrics
    const achievementRates = [];
    let hasData = false;

    values.forEach(value => {
      const data = monthlyData[value.id] || [];
      const { actualValues, targetValues } = buildFiscalSeries(data, fiscalYear);
      const hasTarget = targetValues.some((entry) => entry !== null);
      const latestActual = getLatestSeriesValue(actualValues) ?? 0;
      const latestTarget = getLatestSeriesValue(targetValues) ?? 0;

      if (hasTarget && (latestTarget > 0 || latestActual > 0)) {
        const rate = calculateAchievementRate(latestActual, latestTarget, value.data);
        achievementRates.push(rate);
        hasData = true;
      }
    });

    // Average the achievement rates
    const performance = achievementRates.length > 0 
      ? achievementRates.reduce((sum, rate) => sum + rate, 0) / achievementRates.length
      : 0;
    const performanceColor = performance >= 100 ? 'green' : performance >= 90 ? 'yellow' : performance >= 80 ? 'orange' : 'red';

    return (
      <div key={kpi.id} className="mb-6">
        {/* KPI Header */}
        <div 
          className={`bg-white rounded-lg shadow-md p-5 border-l-4 ${
            level === 1 ? 'border-blue-500' :
            level === 2 ? 'border-purple-500' :
            level === 3 ? 'border-indigo-500' :
            'border-gray-500'
          }`}
          style={{ marginLeft: `${(level - 1) * 24}px` }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 flex-1">
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(kpi.id)}
                  className="text-gray-600 hover:text-gray-800 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <div>
                <h2 className={`font-bold text-gray-800 ${
                  level === 1 ? 'text-xl' :
                  level === 2 ? 'text-lg' :
                  'text-base'
                }`}>
                  {kpi.title}
                </h2>
                <span className="text-xs text-gray-500">Level {level}</span>
              </div>
            </div>

            {hasData && (
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-lg font-semibold text-white ${
                  performanceColor === 'green' ? 'bg-green-500' :
                  performanceColor === 'yellow' ? 'bg-yellow-500' :
                  performanceColor === 'orange' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}>
                  {performance.toFixed(1)}% Achievement
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-600">
                    {achievementRates.length} Metric{achievementRates.length > 1 ? 's' : ''}
                  </div>
                  <div className="text-gray-500 text-xs">
                    Avg. Performance
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Charts Grid */}
          {values.length > 0 && (
            <div className={`grid gap-4 ${
              values.length === 1 ? 'grid-cols-1' :
              values.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
              'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {values.map((value) => {
                const chartData = monthlyData[value.id];
                const isSingleChart = values.length === 1;
                console.log(`🎨 Rendering LineChart for ${value.data}:`, {
                  kpiValueId: value.id,
                  dataLength: chartData?.length || 0,
                  data: chartData
                });
                const hasTargetForValue = chartData && chartData.some((d) => rowHasTarget(d));
                const operatorName = getOperatorDisplay(chartData);
                const chart = hasTargetForValue ? (
                  <LineChart
                    data={chartData}
                    title={value.data}
                    size={isSingleChart ? 'compact' : 'default'}
                    operator={operatorName}
                  />
                ) : (
                  <SimpleBarChart
                    data={chartData}
                    title={value.data}
                    size={isSingleChart ? 'compact' : 'default'}
                    operator={operatorName}
                  />
                );

                if (isSingleChart) {
                  return (
                    <div key={value.id} className="w-full max-w-3xl mx-auto">
                      {chart}
                    </div>
                  );
                }

                return (
                  <button
                    key={value.id}
                    type="button"
                    className="w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:shadow-lg transition"
                    onClick={() => openChartModal({ title: value.data, data: chartData })}
                    aria-label={`Open ${value.data} chart`}
                  >
                    {chart}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className="mt-4">
            {children.map(child => renderKPINode(child))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading comprehensive KPI analysis...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 font-semibold mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{parentKPI?.title}</h1>
              {/* <p className="text-gray-600 mt-2">
                Comprehensive Hierarchical Analysis - FY {fiscalYear}-{(fiscalYear + 1).toString().slice(-2)}
              </p> */}
            </div>

            {/* Compact Fiscal Year Display (Read-only) */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 min-h-0 h-10">
              <span className="text-xs font-medium opacity-90">Fiscal Year</span>
              <span className="text-base font-bold">FY {fiscalYear}-{(fiscalYear + 1).toString().slice(-2)}</span>
              <span className="text-xs opacity-75">Apr {fiscalYear} - Mar {fiscalYear + 1}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="w-full">
            {(() => {
              const opeValue = parentKPIValues[0] || null;
              const chartData = opeValue ? parentMonthlyData[opeValue.id] : [];
              const operatorName = getOperatorDisplay(chartData);
              const hasTargetForValue = chartData && chartData.some((d) => rowHasTarget(d));
              const chartTitle = opeValue?.data || 'OVERALL PLANT EFFICIENCY (OPE)';
              const chart = hasTargetForValue ? (
                <LineChart data={chartData} title={chartTitle} size="compact" operator={operatorName} />
              ) : (
                <SimpleBarChart data={chartData} title={chartTitle} size="compact" operator={operatorName} />
              );

              return (
                <button
                  type="button"
                  className="w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:shadow-lg transition"
                  onClick={() => openChartModal({ chartType: 'default', title: chartTitle, data: chartData })}
                  aria-label={`Open ${chartTitle} chart`}
                >
                  {chart}
                </button>
              );
            })()}
          </div>

          <div className="w-full">
            {oeeChartData ? (
              <button
                type="button"
                className="w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:shadow-lg transition"
                onClick={() => openChartModal({ chartType: 'oee', title: oeeChartData.title, data: oeeChartData.data })}
                aria-label={`Open ${oeeChartData.title} chart`}
              >
                <OeeChart data={oeeChartData.data} title={oeeChartData.title} size="compact" />
              </button>
            ) : (
              <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">OVERALL EQUIPMENT EFFECTIVENESS (OEE)</h3>
                <div className="text-gray-500 text-sm">No data available</div>
              </div>
            )}
          </div>

          <div className="w-full">
            {managementLossNode ? (
              <button
                type="button"
                className="w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:shadow-lg transition"
                onClick={() => openChartModal({
                  chartType: 'loss',
                  title: managementLossNode?.kpi?.title || 'CORPORATE PROPERTY MANAGEMENT LOSS',
                  node: managementLossNode,
                  data: flattenLossRows(managementLossNode),
                })}
                aria-label="Open Corporate Property Management Loss chart"
              >
                <StackedLossChart node={managementLossNode} size="compact" />
              </button>
            ) : (
              <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">CORPORATE PROPERTY MANAGEMENT LOSS</h3>
                <div className="text-gray-500 text-sm">No data available</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {modalChart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={closeChartModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-lg font-semibold">{modalChart.title}</div>
              <div>
                <button
                  type="button"
                  onClick={closeChartModal}
                  className="text-gray-500 hover:text-gray-700 text-sm font-semibold"
                  aria-label="Close chart"
                >
                  Close
                </button>
              </div>
            </div>

            <div>
              {(() => {
                if (modalChart.chartType === 'loss' && modalChart.node) {
                  return <StackedLossChart node={modalChart.node} size="modal" />;
                }

                if (modalChart.chartType === 'oee') {
                  return <OeeChart data={modalChart.data} title={modalChart.title} size="modal" />;
                }

                const hasTarget = (modalChart.data || []).some((d) => rowHasTarget(d));
                return hasTarget
                  ? <LineChart data={modalChart.data} title={modalChart.title} size="modal" />
                  : <SimpleBarChart data={modalChart.data} title={modalChart.title} size="modal" />;
              })()}
            </div>
          </div>
        </div>
      )}
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
};

export default KPIDetailPage;
