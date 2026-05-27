import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getKPIById, getChildKPIs, getKPIValuesByKPI, getMonthlyDataByKPIValue } from '../../api/kpiApi';
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
  const [hierarchyData, setHierarchyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(location.state?.fiscalYear || getCurrentFiscalYear());
  const [expandedNodes, setExpandedNodes] = useState(new Set([parseInt(kpiId)]));
  const [managementInsights, setManagementInsights] = useState(null);
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

      // Load full hierarchy
      const hierarchy = await loadKPITreeRecursive(kpiId, 1);
      console.log('📊 Hierarchy loaded:', hierarchy.length, 'child KPIs found');

      await loadParentKpiValues(kpiId, fiscalYear);
      
      // Auto-expand first level of child KPIs
      if (hierarchy.length > 0) {
        const newExpandedNodes = new Set([parseInt(kpiId)]);
        hierarchy.forEach(node => {
          newExpandedNodes.add(node.kpi.id);
          console.log(`🔓 Auto-expanding child KPI: ${node.kpi.title} (ID: ${node.kpi.id})`);
        });
        setExpandedNodes(newExpandedNodes);
      }
      
      setHierarchyData(hierarchy);

      // Generate comprehensive management insights
      const insights = generateManagementInsights(hierarchy);
      setManagementInsights(insights);

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

  // Recursive function to load entire KPI tree
  const loadKPITreeRecursive = async (kpiId, level) => {
    try {
      // Load children
      console.log(`🔍 Loading children for KPI ID ${kpiId} at level ${level}`);
      const childRes = await getChildKPIs(kpiId);
      const children = childRes.data.data;
      console.log(`✅ Found ${children.length} child KPIs:`, children.map(c => ({ id: c.id, title: c.title })));

      if (children.length === 0) {
        console.log(`⚠️ No child KPIs found for KPI ID ${kpiId}`);
        return [];
      }

      // Load data for each child
      const hierarchyItems = [];
      for (const child of children) {
        console.log(`  📄 Processing child KPI: ${child.title} (ID: ${child.id})`);
        
        // Load KPI values
        const valuesRes = await getKPIValuesByKPI(child.id);
        const values = valuesRes.data.data;
        console.log(`    📊 Found ${values.length} KPI values:`, values.map(v => v.data));

        // Load monthly data for each KPI value
        // Fiscal year spans two calendar years: Apr-Dec of fiscalYear, Jan-Mar of fiscalYear+1
        const monthlyDataByValue = {};

        for (const value of values) {
          try {
            const allMonthlyData = [];
            
            // Get data for first calendar year (April-December)
            try {
              const dataRes1 = await getMonthlyDataByKPIValue(value.id, fiscalYear);
              console.log(`    📅 Fetched data for ${value.data} (ID: ${value.id}) year ${fiscalYear}:`, dataRes1.data?.data?.length || 0, 'records');
              if (dataRes1.data?.data && Array.isArray(dataRes1.data.data)) {
                const filteredYearOne = filterRowsForFiscalWindow(dataRes1.data.data, fiscalYear, fiscalYear);
                console.log(`    🧹 Fiscal-filtered year ${fiscalYear} rows for ${value.data}:`, filteredYearOne.length);
                allMonthlyData.push(...filteredYearOne);
              }
            } catch (err) {
              console.warn(`    ⚠️ No data for ${value.data} year ${fiscalYear}:`, err.message);
            }
            
            // Get data for second calendar year (January-March)
            try {
              const dataRes2 = await getMonthlyDataByKPIValue(value.id, fiscalYear + 1);
              console.log(`    📅 Fetched data for ${value.data} (ID: ${value.id}) year ${fiscalYear + 1}:`, dataRes2.data?.data?.length || 0, 'records');
              if (dataRes2.data?.data && Array.isArray(dataRes2.data.data)) {
                const filteredYearTwo = filterRowsForFiscalWindow(dataRes2.data.data, fiscalYear + 1, fiscalYear);
                console.log(`    🧹 Fiscal-filtered year ${fiscalYear + 1} rows for ${value.data}:`, filteredYearTwo.length);
                allMonthlyData.push(...filteredYearTwo);
              }
            } catch (err) {
              console.warn(`    ⚠️ No data for ${value.data} year ${fiscalYear + 1}:`, err.message);
            }
            
            console.log(`    ✅ Total data collected for ${value.data}:`, allMonthlyData.length, 'records', allMonthlyData);
            monthlyDataByValue[value.id] = allMonthlyData;
          } catch (error) {
            console.error(`Error loading data for KPI value ${value.id}:`, error);
            monthlyDataByValue[value.id] = [];
          }
        }

        // Recursively load children
        const grandChildren = await loadKPITreeRecursive(child.id, level + 1);

        hierarchyItems.push({
          kpi: child,
          level,
          values,
          monthlyData: monthlyDataByValue,
          children: grandChildren,
        });
      }

      return hierarchyItems;
    } catch (error) {
      console.error(`Error loading KPI tree for ${kpiId}:`, error);
      return [];
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

  // Generate comprehensive management insights
  const generateManagementInsights = (hierarchy) => {
    const insights = {
      overallPerformance: 0,
      criticalAreas: [],
      excelling: [],
      needsAttention: [],
      recommendations: [],
      trends: {},
      risks: [],
      achievements: [],
      byLevel: {}, // Performance breakdown by hierarchy level
      byCategory: {}, // Performance breakdown by KPI category
      summary: {
        totalKPIs: 0,
        kpisWithData: 0,
        kpisAboveTarget: 0,
        kpisBelowTarget: 0,
        deepestLevel: 0
      }
    };

    let totalKPIs = 0;
    let performanceSum = 0;
    const levelPerformance = {}; // Track performance by level
    const categoryPerformance = {}; // Track performance by category

    const analyzeKPINode = (node) => {
      const { kpi, values, monthlyData, children, level } = node;
      
      // Only count KPIs that have values (actual metrics), not parent grouping nodes
      if (values && values.length > 0) {
        insights.summary.totalKPIs++;
      }
      insights.summary.deepestLevel = Math.max(insights.summary.deepestLevel, level);
      
      // Initialize level tracking
      if (!levelPerformance[level]) {
        levelPerformance[level] = {
          count: 0,
          performanceSum: 0,
          kpis: []
        };
      }
      
      const achievementRates = [];
      const kpiInsights = [];
      let hasAnyData = false;

      // Analyze each value separately
      for (const value of values) {
        const data = monthlyData[value.id] || [];
        
        const actuals = data
          .filter(d => extractRowType(d) === 'actual')
          .sort(sortByExtractedMonth);
        const targets = data
          .filter(d => extractRowType(d) === 'target')
          .sort(sortByExtractedMonth);

        if (actuals.length > 0 && targets.length > 0) {
          hasAnyData = true;
          
          // Calculate achievement rate for this specific metric
          const latestActual = extractActualTarget(actuals[actuals.length - 1]).actual ?? parseNumeric(actuals[actuals.length - 1].value) ?? 0;
          const latestTarget = extractActualTarget(targets[targets.length - 1]).target ?? parseNumeric(targets[targets.length - 1].value) ?? 0;
          
          if (latestTarget > 0 || latestActual > 0) {
            const achievementRate = calculateAchievementRate(latestActual, latestTarget, value.data);
            achievementRates.push(achievementRate);

            // Trend analysis
            if (actuals.length >= 3) {
              const last3 = actuals.slice(-3).map(a => parseNumeric(a.value) || 0);
              const trend = calculateTrend(last3);
              
              const isInverse = isInverseMetric(value.data);
              
              // For inverse metrics, declining trend (going up) is bad
              // For normal metrics, declining trend (going down) is bad
              const isTrendBad = isInverse ? 
                (trend.direction === 'improving') : 
                (trend.direction === 'declining');
              
              if (isTrendBad && achievementRate < 90) {
                insights.risks.push({
                  kpi: kpi.title,
                  metric: value.data,
                  level: level,
                  issue: `${isInverse ? 'Increasing' : 'Declining'} trend with ${achievementRate.toFixed(1)}% achievement`,
                  severity: achievementRate < 80 ? 'HIGH' : 'MEDIUM'
                });
              }

              const isTrendGood = isInverse ? 
                (trend.direction === 'declining') : 
                (trend.direction === 'improving');
              
              if (isTrendGood && achievementRate >= 90) {
                insights.achievements.push({
                  kpi: kpi.title,
                  metric: value.data,
                  level: level,
                  details: `${isInverse ? 'Decreasing' : 'Improving'} trend with ${achievementRate.toFixed(1)}% achievement`
                });
              }
            }

            // Month-over-month analysis
            if (actuals.length >= 2) {
              const prevVal = parseNumeric(actuals[actuals.length - 2].value) || 0;
              if (prevVal !== 0) {
                const mom = ((actuals[actuals.length - 1].value - prevVal) / prevVal * 100);
                
                if (Math.abs(mom) > 20) {
                  kpiInsights.push({
                    metric: value.data,
                    change: mom,
                    type: mom > 0 ? 'surge' : 'drop'
                  });
                }
              }
            }
          }
        }
      }

      // Calculate average KPI performance from individual achievement rates
      if (achievementRates.length > 0) {
        insights.summary.kpisWithData++;
        const kpiPerformance = achievementRates.reduce((sum, rate) => sum + rate, 0) / achievementRates.length;
        totalKPIs++;
        performanceSum += kpiPerformance;
        
        // Track by level
        levelPerformance[level].count++;
        levelPerformance[level].performanceSum += kpiPerformance;
        levelPerformance[level].kpis.push({
          title: kpi.title,
          performance: kpiPerformance
        });

        // Track by category
        const categoryName = kpi.category_name || 'Uncategorized';
        if (!categoryPerformance[categoryName]) {
          categoryPerformance[categoryName] = {
            count: 0,
            performanceSum: 0,
            kpis: [],
            categoryId: kpi.category_id
          };
        }
        categoryPerformance[categoryName].count++;
        categoryPerformance[categoryName].performanceSum += kpiPerformance;
        categoryPerformance[categoryName].kpis.push({
          id: kpi.id,
          title: kpi.title,
          performance: kpiPerformance,
          level: level
        });

        // Count above/below target
        if (kpiPerformance >= 100) {
          insights.summary.kpisAboveTarget++;
        } else {
          insights.summary.kpisBelowTarget++;
        }

        // Categorize KPI
        if (kpiPerformance >= 110) {
          insights.excelling.push({
            kpi: kpi.title,
            performance: kpiPerformance.toFixed(1),
            level: level,
            levelName: getLevelName(level)
          });
        } else if (kpiPerformance < 85) {
          insights.needsAttention.push({
            kpi: kpi.title,
            performance: kpiPerformance.toFixed(1),
            gap: (100 - kpiPerformance).toFixed(1),
            level: level,
            levelName: getLevelName(level)
          });
        }

        // Store insights
        if (kpiInsights.length > 0) {
          insights.trends[kpi.title] = kpiInsights;
        }
      }

      // Recursively analyze children
      if (children && children.length > 0) {
        children.forEach(analyzeKPINode);
      }
    };
    
    // Helper to get level name
    const getLevelName = (level) => {
      const levelNames = {
        1: 'Department Level',
        2: 'Sub-Department Level',
        3: 'Team/Unit Level',
        4: 'Individual/Activity Level'
      };
      return levelNames[level] || `Level ${level}`;
    };

    // Analyze all nodes
    hierarchy.forEach(analyzeKPINode);

    // Calculate overall performance
    insights.overallPerformance = totalKPIs > 0 ? (performanceSum / totalKPIs) : 0;
    
    // Calculate performance by level
    Object.keys(levelPerformance).forEach(level => {
      const levelData = levelPerformance[level];
      if (levelData.count > 0) {
        insights.byLevel[level] = {
          levelName: getLevelName(parseInt(level)),
          avgPerformance: (levelData.performanceSum / levelData.count).toFixed(1),
          kpiCount: levelData.count,
          topKPIs: levelData.kpis
            .sort((a, b) => b.performance - a.performance)
            .slice(0, 3),
          bottomKPIs: levelData.kpis
            .sort((a, b) => a.performance - b.performance)
            .slice(0, 3)
        };
      }
    });

    // Calculate performance by category
    Object.keys(categoryPerformance).forEach(categoryName => {
      const catData = categoryPerformance[categoryName];
      if (catData.count > 0) {
        const avgPerf = (catData.performanceSum / catData.count);
        const topKPIs = [...catData.kpis]
          .filter((kpi) => kpi.performance >= 100)
          .sort((a, b) => b.performance - a.performance)
          .slice(0, 5);

        const getKPIKey = (kpi) => `${kpi.id ?? 'no-id'}::${kpi.title ?? ''}::${kpi.level ?? ''}`;
        const topKPIIds = new Set(topKPIs.map((kpi) => getKPIKey(kpi)));
        const bottomKPIs = [...catData.kpis]
          .filter((kpi) => kpi.performance < 90 && !topKPIIds.has(getKPIKey(kpi)))
          .sort((a, b) => a.performance - b.performance)
          .slice(0, 5);

        insights.byCategory[categoryName] = {
          categoryName: categoryName,
          avgPerformance: avgPerf.toFixed(1),
          kpiCount: catData.count,
          topKPIs,
          bottomKPIs,
          excelling: catData.kpis.filter(k => k.performance >= 110).length,
          needsAttention: catData.kpis.filter(k => k.performance < 85).length,
          performanceStatus: avgPerf >= 100 ? 'Exceeding' : avgPerf >= 90 ? 'On Track' : avgPerf >= 80 ? 'Needs Attention' : 'Critical'
        };
      }
    });

    // Generate recommendations
    generateRecommendations(insights);

    return insights;
  };

  const calculateTrend = (values) => {
    if (values.length < 2) return { direction: 'stable', slope: 0 };
    
    let increases = 0;
    let decreases = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increases++;
      else if (values[i] < values[i - 1]) decreases++;
    }
    
    if (increases > decreases) return { direction: 'improving', slope: 1 };
    if (decreases > increases) return { direction: 'declining', slope: -1 };
    return { direction: 'stable', slope: 0 };
  };

  const generateRecommendations = (insights) => {
    // Critical issues
    const highRisks = insights.risks.filter(r => r.severity === 'HIGH');
    if (highRisks.length > 0) {
      insights.recommendations.push({
        priority: 'CRITICAL',
        action: 'Immediate Action Required',
        details: `${highRisks.length} critical KPI(s) showing declining performance below 80% target. Immediate root cause analysis and corrective action needed.`,
        kpis: highRisks.map(r => r.kpi).join(', ')
      });
    }

    // Areas needing attention
    if (insights.needsAttention.length > 0) {
      const avgGap = insights.needsAttention.reduce((sum, item) => sum + parseFloat(item.gap), 0) / insights.needsAttention.length;
      insights.recommendations.push({
        priority: 'HIGH',
        action: 'Performance Improvement Plan',
        details: `${insights.needsAttention.length} KPI(s) below target with average gap of ${avgGap.toFixed(1)}%. Review processes and allocate resources to bridge the performance gap.`,
        kpis: insights.needsAttention.map(n => n.kpi).join(', ')
      });
    }

    // Best practices
    if (insights.excelling.length > 0) {
      insights.recommendations.push({
        priority: 'MEDIUM',
        action: 'Replicate Success',
        details: `${insights.excelling.length} KPI(s) exceeding targets. Document best practices and implement across other areas.`,
        kpis: insights.excelling.map(e => e.kpi).join(', ')
      });
    }

    // Overall performance
    if (insights.overallPerformance < 90) {
      insights.recommendations.push({
        priority: 'HIGH',
        action: 'Strategic Review',
        details: `Overall performance at ${insights.overallPerformance.toFixed(1)}%. Conduct comprehensive review of goals, resources, and execution strategies.`
      });
    } else if (insights.overallPerformance >= 100) {
      insights.recommendations.push({
        priority: 'LOW',
        action: 'Continuous Improvement',
        details: `Strong overall performance at ${insights.overallPerformance.toFixed(1)}%. Focus on continuous improvement and stretch goals.`
      });
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
    
    // Determine if this is an inverse metric for display purposes
    const isInverse = isInverseMetric(title);

    return (
      <div className="bg-white p-4 rounded-lg shadow">
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

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full border border-gray-300 bg-white" style={{ minHeight, display: 'block' }}>
          {/* Grid lines with values */}
          {[...Array(5)].map((_, i) => {
            const value = minVal + (i / 4) * (maxVal - minVal);
            const y = svgHeight - padding - (i / 4) * (svgHeight - 2 * padding);
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padding}
                  y1={y}
                  x2={svgWidth - padding}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
              </g>
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

          {/* Actual line */}
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

          {/* Target data points with labels */}
          {targetValues.map((val, idx) => {
            if (val === null) return null;
            const x = getX(idx);
            const y = getY(val);
            return (
              <g key={`target-${idx}`}>
                <circle cx={x} cy={y} r="3" fill="#ffb74d" stroke="white" strokeWidth="1" />
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#c97706"
                  fontWeight="bold"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Actual data points with labels */}
          {actualValues.map((val, idx) => {
            if (val === null) return null;
            const x = getX(idx);
            const y = getY(val);
            return (
              <g key={`actual-${idx}`}>
                <circle cx={x} cy={y} r="5" fill="#41aafe" stroke="white" strokeWidth="2" />
                <text
                  x={x}
                  y={y + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#0369a1"
                  fontWeight="bold"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {labels.map((label, idx) => (
            <text key={`x-${idx}`} x={getX(idx)} y={svgHeight - padding + 25} textAnchor="middle" fontSize="11" fill="#4b5563">
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

          {/* Axis titles */}
          <text x={svgWidth / 2} y={svgHeight - 5} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            Month
          </text>
          <text x={15} y={svgHeight / 2} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500" transform={`rotate(-90 15 ${svgHeight / 2})`}>
            Value
          </text>
        </svg>

        {/* Legend */}
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

        {/* Quick stats */}
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
      <div className="bg-white p-4 rounded-lg shadow">
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

        {/* Executive Summary Dashboard */}
        {managementInsights && (
          <div className="mb-8 space-y-6">
            {/* Overall Performance Card */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-4">Executive Summary - {parentKPI?.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="text-sm font-medium opacity-90">Overall Performance</div>
                  <div className="text-3xl font-bold mt-2">
                    {managementInsights.overallPerformance.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    {managementInsights.overallPerformance >= 100 ? 'Exceeding Target' :
                     managementInsights.overallPerformance >= 90 ? 'On Track' :
                     managementInsights.overallPerformance >= 80 ? 'Needs Attention' :
                     'Critical'}
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="text-sm font-medium opacity-90">Total KPIs</div>
                  <div className="text-3xl font-bold mt-2">
                    {managementInsights.summary.kpisWithData}
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    of {managementInsights.summary.totalKPIs} have data
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="text-sm font-medium opacity-90">Excelling KPIs</div>
                  <div className="text-3xl font-bold mt-2 text-green-300">
                    {managementInsights.excelling.length}
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    Above 110% target
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="text-sm font-medium opacity-90">Needs Attention</div>
                  <div className="text-3xl font-bold mt-2 text-yellow-300">
                    {managementInsights.needsAttention.length}
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    Below 85% target
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="text-sm font-medium opacity-90">Risk Indicators</div>
                  <div className="text-3xl font-bold mt-2 text-red-300">
                    {managementInsights.risks.length}
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    {managementInsights.risks.filter(r => r.severity === 'HIGH').length} high priority
                  </div>
                </div>
              </div>
            </div>

            {/* Hierarchy Level Breakdown */}
            {Object.keys(managementInsights.byLevel).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📊</span> Performance by Hierarchy Level
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Analysis across {managementInsights.summary.deepestLevel} hierarchy levels - from Department to Individual/Activity level
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.keys(managementInsights.byLevel)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((level) => {
                      const levelData = managementInsights.byLevel[level];
                      const perfValue = parseFloat(levelData.avgPerformance);
                      return (
                        <div 
                          key={level}
                          className={`p-4 rounded-lg border-l-4 ${
                            perfValue >= 100 ? 'bg-green-50 border-green-500' :
                            perfValue >= 90 ? 'bg-yellow-50 border-yellow-500' :
                            perfValue >= 80 ? 'bg-orange-50 border-orange-500' :
                            'bg-red-50 border-red-500'
                          }`}
                        >
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
                            {levelData.levelName}
                          </div>
                          <div className="text-2xl font-bold text-gray-800 mb-1">
                            {levelData.avgPerformance}%
                          </div>
                          <div className="text-xs text-gray-600 mb-3">
                            {levelData.kpiCount} KPI{levelData.kpiCount > 1 ? 's' : ''}
                          </div>
                          {levelData.topKPIs.length > 0 && (
                            <div className="text-xs">
                              <div className="font-semibold text-gray-700 mb-1">Top Performer:</div>
                              <div className="text-gray-600 truncate" title={levelData.topKPIs[0].title}>
                                {levelData.topKPIs[0].title}
                              </div>
                              <div className="text-green-600 font-semibold">
                                {levelData.topKPIs[0].performance.toFixed(1)}%
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Category-wise Performance Breakdown */}
            {Object.keys(managementInsights.byCategory).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🏷️</span> Performance by Category
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Analysis across different KPI categories - Plant KPI, Department KPI, Employee KPI, and KAI
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(managementInsights.byCategory)
                    .map((categoryName) => {
                      const catData = managementInsights.byCategory[categoryName];
                      const perfValue = parseFloat(catData.avgPerformance);
                      return (
                        <div 
                          key={categoryName}
                          className={`p-5 rounded-lg border-2 ${
                            perfValue >= 100 ? 'bg-green-50 border-green-300' :
                            perfValue >= 90 ? 'bg-blue-50 border-blue-300' :
                            perfValue >= 80 ? 'bg-orange-50 border-orange-300' :
                            'bg-red-50 border-red-300'
                          }`}
                        >
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-lg font-bold text-gray-800">
                                {categoryName}
                              </h4>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                                perfValue >= 100 ? 'bg-green-600' :
                                perfValue >= 90 ? 'bg-blue-600' :
                                perfValue >= 80 ? 'bg-orange-600' :
                                'bg-red-600'
                              }`}>
                                {catData.performanceStatus}
                              </span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800">
                              {catData.avgPerformance}%
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Average Performance
                            </div>
                          </div>

                          {/* Category Stats */}
                          <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-white rounded border border-gray-200">
                            <div className="text-center">
                              <div className="text-xl font-bold text-gray-800">{catData.kpiCount}</div>
                              <div className="text-xs text-gray-600">Total KPIs</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold text-green-600">{catData.excelling}</div>
                              <div className="text-xs text-gray-600">Excelling</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold text-orange-600">{catData.needsAttention}</div>
                              <div className="text-xs text-gray-600">Needs Help</div>
                            </div>
                          </div>

                          {/* Top and Bottom Performers */}
                          <div className="space-y-3">
                            {catData.topKPIs.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">Top Performers</h5>
                                <div className="space-y-1">
                                  {catData.topKPIs.slice(0, 2).map((kpi, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 bg-white rounded border border-green-200">
                                      <span className="font-medium text-gray-700 truncate" title={kpi.title}>
                                        {kpi.title}
                                      </span>
                                      <span className="text-green-700 font-bold ml-2">
                                        {kpi.performance.toFixed(1)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {catData.bottomKPIs.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">Needs Attention</h5>
                                <div className="space-y-1">
                                  {catData.bottomKPIs.slice(0, 2).map((kpi, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 bg-white rounded border border-orange-200">
                                      <span className="font-medium text-gray-700 truncate" title={kpi.title}>
                                        {kpi.title}
                                      </span>
                                      <span className="text-orange-700 font-bold ml-2">
                                        {kpi.performance.toFixed(1)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Action Items - Recommendations */}
            {managementInsights.recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎯</span> Management Action Items
                </h3>
                <div className="space-y-3">
                  {managementInsights.recommendations.map((rec, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg border-l-4 ${
                        rec.priority === 'CRITICAL' ? 'bg-red-50 border-red-500' :
                        rec.priority === 'HIGH' ? 'bg-orange-50 border-orange-500' :
                        rec.priority === 'MEDIUM' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          rec.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
                          rec.priority === 'HIGH' ? 'bg-orange-600 text-white' :
                          rec.priority === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {rec.priority}
                        </span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-1">{rec.action}</h4>
                          <p className="text-sm text-gray-700 mb-2">{rec.details}</p>
                          {rec.kpis && (
                            <div className="text-xs text-gray-600">
                              <span className="font-semibold">Affected KPIs:</span> {rec.kpis}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Excelling KPIs */}
              {managementInsights.excelling.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">✨</span> Top Performers
                  </h3>
                  <div className="space-y-2">
                    {managementInsights.excelling.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-700">{item.kpi}</span>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                          {item.performance}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Areas Needing Attention */}
              {managementInsights.needsAttention.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">⚠️</span> Requires Attention
                  </h3>
                  <div className="space-y-2">
                    {managementInsights.needsAttention.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="text-sm font-medium text-gray-700 block">{item.kpi}</span>
                          <span className="text-xs text-red-600">Gap: {item.gap}%</span>
                        </div>
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                          {item.performance}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

{/* Risk Indicators - Grouped by Level */}
            {managementInsights.risks.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">🚨</span> Risk Indicators by Level
                </h3>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(level => {
                    const levelRisks = managementInsights.risks.filter(r => r.level === level);
                    if (levelRisks.length === 0) return null;
                    
                    const highRisks = levelRisks.filter(r => r.severity === 'HIGH');
                    return (
                      <div key={level} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-800">
                            {level === 1 ? '📍 Department Level' :
                             level === 2 ? '📍 Sub-Department Level' :
                             level === 3 ? '📍 Team/Unit Level' :
                             level === 4 ? '📍 Individual/Activity Level' :
                             `📍 Level ${level}`}
                          </h4>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                            {highRisks.length} HIGH / {levelRisks.length} Total
                          </span>
                        </div>
                        <div className="space-y-2">
                          {levelRisks.slice(0, 3).map((risk, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className={`${risk.severity === 'HIGH' ? 'text-red-600' : 'text-orange-600'} font-bold mt-0.5`}>
                                ⚠️
                              </span>
                              <div>
                                <div className="font-medium text-gray-800">{risk.kpi}</div>
                                <div className="text-gray-600">{risk.metric}</div>
                                <div className={`text-xs mt-1 ${risk.severity === 'HIGH' ? 'text-red-700' : 'text-orange-700'}`}>
                                  {risk.issue}
                                </div>
                              </div>
                            </div>
                          ))}
                          {levelRisks.length > 3 && (
                            <div className="text-xs text-gray-500 mt-2">
                              +{levelRisks.length - 3} more risks in this level
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

              {/* Achievements */}
              {managementInsights.achievements.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">🏆</span> Key Achievements
                  </h3>
                  <div className="space-y-2">
                    {managementInsights.achievements.slice(0, 5).map((achievement, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-2 border-b border-gray-100">
                        <span className="text-green-500 font-bold">✓</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700">{achievement.kpi}</div>
                          <div className="text-xs text-gray-600 mt-1">{achievement.metric}</div>
                          <div className="text-xs text-green-700 mt-1">{achievement.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hierarchical KPI Analysis */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Detailed Hierarchical Analysis</h2>
          <p className="text-gray-600 mb-2">
            Expand/collapse KPIs to view the complete hierarchy. Color-coded performance indicators show achievement levels.
          </p>
          <div className="flex gap-4 text-sm mb-4">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-green-500 rounded"></span>
              <span>≥100% (Target Met)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-yellow-500 rounded"></span>
              <span>90-99% (Near Target)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-orange-500 rounded"></span>
              <span>80-89% (Needs Attention)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-red-500 rounded"></span>
              <span>&lt;80% (Critical)</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {hierarchyData.length > 0 && parentKPIValues.length > 0 && (
          <div className="bg-white rounded-lg shadow p-8 mb-6">
            <div className="mb-6 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Direct KPI Metrics</h3>
              <p className="text-gray-600 text-sm">
                Direct metrics for <strong>{parentKPI?.title}</strong>
              </p>
            </div>
            <div className={`grid gap-4 ${
              parentKPIValues.length === 1 ? 'grid-cols-1' :
              parentKPIValues.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
              'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {parentKPIValues.map((value) => {
                const chartData = parentMonthlyData[value.id];
                const isSingleChart = parentKPIValues.length === 1;
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
          </div>
        )}

        {hierarchyData.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8">
            {parentKPIValues.length > 0 ? (
              <div>
                <div className="mb-6 text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Direct KPI Metrics</h3>
                  <p className="text-gray-600 text-sm">
                    This KPI has no child KPIs. Showing direct metrics for <strong>{parentKPI?.title}</strong>
                  </p>
                </div>
                <div className={`grid gap-4 ${
                  parentKPIValues.length === 1 ? 'grid-cols-1' :
                  parentKPIValues.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
                  'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                }`}>
                  {parentKPIValues.map((value) => {
                    const chartData = parentMonthlyData[value.id];
                    const isSingleChart = parentKPIValues.length === 1;
                    const hasTargetForValue = chartData && chartData.some((d) => rowHasTarget(d));
                    const chart = hasTargetForValue ? (
                      <LineChart
                        data={chartData}
                        title={value.data}
                        size={isSingleChart ? 'compact' : 'default'}
                      />
                    ) : (
                      <SimpleBarChart
                        data={chartData}
                        title={value.data}
                        size={isSingleChart ? 'compact' : 'default'}
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
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Child KPIs or Data Found</h3>
                <p className="text-gray-600 mb-4">
                  The KPI "<strong>{parentKPI?.title}</strong>" has no child KPIs defined.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                  <p className="text-sm text-gray-700 mb-2"><strong>Possible reasons:</strong></p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>The sub-KPIs (e.g., Availability, Performance, Quality) may not be linked with <code className="text-xs bg-gray-200 px-1 rounded">parent_kpi_id</code></li>
                    <li>The child KPIs might be in a different fiscal year</li>
                    <li>This KPI might be configured as a leaf-level metric</li>
                  </ul>
                  <p className="text-sm text-gray-700 mt-3">
                    <strong>Check browser console</strong> for detailed debugging information.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {hierarchyData.map((node) => renderKPINode(node))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-2">📌 Note for Management:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>This analysis covers FY {fiscalYear}-{(fiscalYear + 1).toString().slice(-2)} (April {fiscalYear} to March {fiscalYear + 1})</li>
            <li>To view a different fiscal year, return to the dashboard and select the desired year</li>
            <li>Performance is calculated based on latest available month data (Actual vs Target)</li>
            <li>Trends are analyzed using last 3 months of data to identify improvement or decline patterns</li>
            <li>Critical KPIs (&lt;80% achievement) require immediate management intervention</li>
            <li>Use the expand/collapse controls to drill down into specific KPI hierarchies</li>
          </ul>
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

            {/* Modal content: chart + data table */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                {(() => {
                  const hasTarget = (modalChart.data || []).some((d) => rowHasTarget(d));
                  return hasTarget ? (
                    <LineChart data={modalChart.data} title={modalChart.title} size="modal" />
                  ) : (
                    <SimpleBarChart data={modalChart.data} title={modalChart.title} size="modal" />
                  );
                })()}
              </div>

              <div className="overflow-auto max-h-[60vh] p-2 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Data</h4>
                  <div className="text-xs text-gray-500">Rows: {(modalChart.data || []).length}</div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-600">
                      <th className="pr-4">Month</th>
                      <th className="pr-4">Value Type</th>
                      <th className="pr-4">Data Operator</th>
                      <th className="pr-4">Actual</th>
                      <th className="pr-4">Target</th>
                      <th className="pr-4">Raw Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const normalizeOperator = (row) => {
                        if (!row) return null;
                        const candidate = row.operator ?? row.data_operator ?? row.entered_by ?? row.operator_name ?? (row.user && (row.user.name || row.user.fullname)) ?? row.created_by ?? row.entered_by_name ?? null;
                        if (candidate == null) return null;
                        const numeric = Number(candidate);
                        if (Number.isFinite(numeric)) {
                          if (userCache[numeric]) return userCache[numeric];
                          ensureUserCached(numeric);
                          return String(numeric);
                        }
                        return String(candidate);
                      };

                      const rows = (modalChart.data || []).map(row => {
                        // normalize month
                        let monthNum = null;
                        if (row.month != null) {
                          if (typeof row.month === 'number') monthNum = row.month;
                          else {
                            const txt = String(row.month).trim();
                            const n = Number(txt);
                            if (Number.isFinite(n) && n >= 1 && n <= 12) monthNum = n;
                            else {
                              const key = txt.slice(0,3).toLowerCase();
                              const idx = MONTH_LABELS.map(l => l.toLowerCase()).indexOf(key);
                              if (idx >= 0) monthNum = idx + 1;
                              else {
                                const pd = new Date(txt);
                                if (!Number.isNaN(pd.getTime())) monthNum = pd.getMonth() + 1;
                              }
                            }
                          }
                        }

                        return {
                          monthNum,
                          monthLabel: monthNum ? MONTH_LABELS[monthNum - 1] : String(row.month ?? ''),
                          value_type: row.value_type ?? '',
                          operator: normalizeOperator(row),
                          actual: row.actual_value ?? row.actual ?? null,
                          target: row.target_value ?? row.target ?? null,
                          raw: row.value ?? null
                        };
                      });

                      // sort by fiscal sequence order
                      const orderMap = {};
                      getFiscalMonthSequence(fiscalYear).forEach((m, i) => { orderMap[m.month] = i; });
                      rows.sort((a, b) => {
                        const ia = a.monthNum && orderMap[a.monthNum] != null ? orderMap[a.monthNum] : Infinity;
                        const ib = b.monthNum && orderMap[b.monthNum] != null ? orderMap[b.monthNum] : Infinity;
                        return ia - ib;
                      });

                      return rows.map((r, idx) => {
                        const parsedActual = r.actual != null ? parseNumeric(r.actual) : null;
                        const parsedTarget = r.target != null ? parseNumeric(r.target) : null;
                        return (
                        <tr key={idx} className="border-t">
                          <td className="py-2 pr-4">{r.monthLabel}</td>
                          <td className="py-2 pr-4">{r.value_type}</td>
                          <td className="py-2 pr-4">{r.operator ?? '-'}</td>
                          <td className="py-2 pr-4">{parsedActual != null ? parsedActual.toFixed(2) : '-'}</td>
                          <td className="py-2 pr-4">{parsedTarget != null ? parsedTarget.toFixed(2) : '-'}</td>
                          <td className="py-2 pr-4 text-gray-600">{r.raw != null ? String(r.raw) : '-'}</td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
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
