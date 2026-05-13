import React, { useState, useEffect, useMemo } from 'react';
import Notification from '../../components/common/Notification';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { getAllUnitMasters } from '../../api/unitMasterApi';

function EmpKpiKaiPage() {
    const [units, setUnits] = useState([]);
    const unitSymbolById = useMemo(() => {
      const map = {};
      units.forEach(u => { map[u.id] = u.symbol; });
      return map;
    }, [units]);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [kpis, setKPIs] = useState([]); // All KPIs for hierarchy display
  const [assignedKPIValues, setAssignedKPIValues] = useState([]); // KPI values assigned to employee
  const [selectedKPI, setSelectedKPI] = useState(null);
  
  // Helper function to get current fiscal year (April to March)
  const getCurrentFiscalYear = () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    // If current month is Jan-Mar (0-2), fiscal year started last year
    return currentMonth < 3 ? currentYear - 1 : currentYear;
  };
  
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear());
  const [monthlyData, setMonthlyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [formulaDetailsModal, setFormulaDetailsModal] = useState({ show: false, data: null });
  const [recentlyUpdatedKPIs, setRecentlyUpdatedKPIs] = useState([]);

  const employeeAssignedKPIValues = useMemo(() => {
    const currentEmpId = String(user?.empid ?? user?.id ?? '');
    if (!currentEmpId) return assignedKPIValues;

    return assignedKPIValues.filter((kv) => {
      const ownerCandidates = [kv?.empid, kv?.emp_id, kv?.employee_id, kv?.user_id, kv?.assigned_to, kv?.owner_empid];
      const owner = ownerCandidates.find((value) => value !== null && value !== undefined && value !== '');
      if (owner === undefined) return true;
      return String(owner) === currentEmpId;
    });
  }, [assignedKPIValues, user]);

  // Financial year months (April to March)
  const months = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];
  
  // Map financial year month index to calendar month (1-12)
  const getCalendarMonth = (fyMonthIndex) => {
    // fyMonthIndex 0 = April (month 4), 1 = May (month 5), etc.
    const calendarMonth = (fyMonthIndex + 4) % 12;
    return calendarMonth === 0 ? 12 : calendarMonth;
  };

  const updateFinancialYear = async (year) => {
    setSelectedYear(year);
    
    // When year changes, reload all KPI values' monthly data for the new year and surrounding years
    const yearsToLoad = [year - 1, year, year + 1];
    
    for (const kpiValue of employeeAssignedKPIValues) {
      for (const fyear of yearsToLoad) {
        await loadMonthlyData(kpiValue.id, fyear);
      }
    }
  };

  

  const getSelectedFinancialYear = () => `${selectedYear}-${String(selectedYear + 1).slice(-2)}`;

  const normalizeKpiId = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
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

  const shouldIncludeForSelectedYear = (kpiFiscalYear, currentSelectedYear) => {
    const parsedYear = parseFiscalYear(kpiFiscalYear);
    if (parsedYear === null) return true;
    return parsedYear === currentSelectedYear;
  };

  const kpiById = useMemo(
    () => new Map(kpis.map((kpi) => [normalizeKpiId(kpi.id), kpi])),
    [kpis]
  );

  // Build breadcrumb trail for a KPI (from root to current)
  const buildBreadcrumb = (kpi) => {
    const breadcrumb = [];
    let currentKPI = kpi;
    
    while (currentKPI) {
      breadcrumb.unshift(currentKPI);
      if (currentKPI.parent_kpi_id) {
        currentKPI = kpiById.get(normalizeKpiId(currentKPI.parent_kpi_id));
      } else {
        currentKPI = null;
      }
    }
    return breadcrumb;
  };

  // Option 3: Actual manual, target computed using formula
  function MonthlyDataFormOption3({ month, monthIndex, kpiValueId, initialActual, initialTarget, unitSymbol, targetFormula, onViewFormula, onSubmit }) {
    const [actualValue, setActualValue] = useState(initialActual);
    const [isEditing, setIsEditing] = useState(false);
    const isEmptyValue = (value) => value === '' || value === null || value === undefined;

    // Helper function to format numeric values for display
    const formatDisplayValue = (value) => {
      if (value === null || value === undefined || value === '') return '-';
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      
      const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));
      
      return numValue.toLocaleString('en-IN', {
        minimumFractionDigits: isPercentage ? 0 : 2,
        maximumFractionDigits: isPercentage ? 0 : 2
      });
    };

    useEffect(() => {
      setActualValue(initialActual);
    }, [initialActual]);

    const handleSave = () => {
      // For Option 3, we only submit the actual value; target will be computed by backend
      onSubmit(kpiValueId, monthIndex, null, actualValue);
      setIsEditing(false);
    };

    return (
      <div className="rounded-lg border p-2 option3 transition-all bg-white border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-semibold text-slate-900">{month}</h5>
          {initialTarget !== null && initialTarget !== undefined && initialTarget !== '' && targetFormula && onViewFormula && (
            <button className="text-sm" onClick={onViewFormula} title="View formula details">👁️</button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Value</label>
              <input type="text" value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="Enter actual value" className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="text-xs text-slate-600">
              <p>📊 Target will be automatically computed using formula</p>
              <p>Formula: <code>{targetFormula}</code></p>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg" onClick={handleSave}>Save</button>
              <button className="flex-1 px-3 py-2 bg-slate-300 text-slate-700 rounded-lg" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-xs font-bold">Target</p>
            <p className="text-base font-semibold">{formatDisplayValue(initialTarget)}{unitSymbol && <span className="ml-2">{unitSymbol}</span>} <span className="text-xs text-slate-500">🔧 Computed</span></p>
            <p className="text-xs font-bold">Actual</p>
            <p className="text-base font-semibold">{formatDisplayValue(actualValue)}{unitSymbol && <span className="ml-2">{unitSymbol}</span>}</p>
            <button className="w-full py-2 mt-2 bg-yellow-400 text-white rounded-lg" onClick={() => setIsEditing(true)}>{!isEmptyValue(actualValue) ? 'Edit' : 'Add Data'}</button>
          </div>
        )}
      </div>
    );
  }

  // Option 2: Actual computed, target manual entry
  function MonthlyDataFormOption2({ month, monthIndex, kpiValueId, initialActual, initialTarget, unitSymbol, formula, onViewFormula, defaultTargetValue, onSubmit }) {
    const [targetValue, setTargetValue] = useState(initialTarget);
    const [isEditing, setIsEditing] = useState(false);
    const isEmptyValue = (value) => value === '' || value === null || value === undefined;

    // Helper function to format numeric values for display
    const formatDisplayValue = (value) => {
      if (value === null || value === undefined || value === '') return '-';
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      
      const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));
      
      return numValue.toLocaleString('en-IN', {
        minimumFractionDigits: isPercentage ? 0 : 2,
        maximumFractionDigits: isPercentage ? 0 : 2
      });
    };

    useEffect(() => {
      setTargetValue(isEmptyValue(initialTarget) ? defaultTargetValue : initialTarget);
    }, [initialTarget, defaultTargetValue]);

    const handleSave = () => {
      const resolvedTargetValue = isEmptyValue(targetValue) ? (isEmptyValue(defaultTargetValue) ? null : defaultTargetValue) : targetValue;
      onSubmit(kpiValueId, monthIndex, resolvedTargetValue, null);
      setIsEditing(false);
    };

    return (
      <div className="rounded-lg border p-2 option2 transition-all bg-white border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-semibold text-slate-900">{month}</h5>
          {initialActual !== null && initialActual !== undefined && initialActual !== '' && formula && onViewFormula && (
            <button className="text-sm" onClick={onViewFormula} title="View formula details">👁️</button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Value</label>
              <input type="text" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={defaultTargetValue ? `Default: ${defaultTargetValue}` : 'Enter target value'} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="text-xs text-slate-600">
              <p>📊 Actual value will be automatically computed using formula</p>
              <p>Formula: <code>{formula}</code></p>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg" onClick={handleSave}>Save</button>
              <button className="flex-1 px-3 py-2 bg-slate-300 text-slate-700 rounded-lg" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-xs font-bold">Actual</p>
            <p className="text-base font-semibold">{formatDisplayValue(initialActual)}{unitSymbol && <span className="ml-2">{unitSymbol}</span>} <span className="text-xs text-slate-500">🔧 Computed</span></p>
            <p className="text-xs font-bold">Target</p>
            <p className="text-base font-semibold">{formatDisplayValue(targetValue)}{unitSymbol && <span className="ml-2">{unitSymbol}</span>}</p>
            <button className="w-full py-2 mt-2 bg-yellow-400 text-white rounded-lg" onClick={() => setIsEditing(true)}>{!isEmptyValue(targetValue) ? 'Edit' : 'Add Data'}</button>
          </div>
        )}
      </div>
    );
  }

  // Get category name/type from KPI data (prefer backend category_name)
  const getCategoryName = (kpiOrCategory) => {
    if (kpiOrCategory && typeof kpiOrCategory === 'object') {
      const backendCategoryName = kpiOrCategory.category_name || kpiOrCategory.category;
      if (backendCategoryName) {
        return String(backendCategoryName);
      }
    }

    const categoryId = typeof kpiOrCategory === 'object' ? kpiOrCategory?.category_id : kpiOrCategory;
    const categoryNames = {
      1: 'Pillar',
      2: 'Department KPI',
      3: 'Divisional KPI',
      4: 'Employee KAI',
      5: 'Team KPI',
      6: 'KMI'
    };
    return categoryNames[categoryId] || 'KPI';
  };

  const assignedKPIIdsForYear = useMemo(() => {
    return new Set(
      employeeAssignedKPIValues
        .filter((kv) => {
          const kpi = kpiById.get(normalizeKpiId(kv.kpi_id));
          return shouldIncludeForSelectedYear(kpi?.fin_year, selectedYear);
        })
        .map((kv) => normalizeKpiId(kv.kpi_id))
    );
  }, [employeeAssignedKPIValues, kpiById, selectedYear]);

  const assignedKPIValuesForYear = useMemo(
    () => employeeAssignedKPIValues.filter((kv) => assignedKPIIdsForYear.has(normalizeKpiId(kv.kpi_id))),
    [employeeAssignedKPIValues, assignedKPIIdsForYear]
  );

  const visibleKPIsForYear = useMemo(() => {
    const base = kpis.filter(
      (kpi) =>
        shouldIncludeForSelectedYear(kpi.fin_year, selectedYear) &&
        assignedKPIIdsForYear.has(normalizeKpiId(kpi.id))
    );

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((kpi) => {
      const titleMatch = kpi.title?.toLowerCase().includes(q);
      const categoryMatch = getCategoryName(kpi).toLowerCase().includes(q);
      return titleMatch || categoryMatch;
    });
  }, [kpis, assignedKPIIdsForYear, kpiById, selectedYear, searchQuery]);

  // Fetch all units on mount
  useEffect(() => {
    getAllUnitMasters().then(res => {
      setUnits(res.data.data || []);
    }).catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
      return;
    }

    if (user) {
      const empId = user.empid ?? user.id;
      if (empId) {
        loadEmployeeData(empId);
      }
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadEmployeeData = async (empId) => {
    try {
      setLoading(true);
      // Don't clear monthlyData immediately - preserve cached data
      
      // Load KPI values assigned to this employee
      const kpiValuesResponse = await api.get(`/employees/${empId}/kpi-values`);
      const kpiValues = kpiValuesResponse.data.data || [];
      setAssignedKPIValues(kpiValues);
      
      if (kpiValues.length === 0) {
        showNotification('No KPIs have been assigned to you yet. Please contact your administrator.', 'error');
        setLoading(false);
        return;
      }
      
      // Load all KPIs to build hierarchy for the selected financial year
      const kpisResponse = await api.get('/kpis');
      const allKPIs = kpisResponse.data.data || [];
      setKPIs(allKPIs);
      
      // Pre-load monthly data for all KPI values for the selected financial year
      // Use selectedYear state to ensure we load the correct year's data
      const yearsToLoad = [selectedYear - 1, selectedYear, selectedYear + 1];
      
      for (const kpiValue of kpiValues) {
        for (const fyear of yearsToLoad) {
          await loadMonthlyData(kpiValue.id, fyear);
        }
      }
      
      // Don't automatically select a KPI - let the user choose from the hierarchy view
      setSelectedKPI(null);
    } catch (error) {
      console.error('Failed to load employee data:', error);
      showNotification(error.response?.data?.error || 'Failed to load employee data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectKPI = async (kpi, kpiValues = null) => {
    // Toggle: collapse if same KPI is already expanded
    if (selectedKPI?.id === kpi.id) {
      setSelectedKPI(null);
      return;
    }
    setSelectedKPI(kpi);
    
    // Filter kpi_values for this specific KPI
    const kpiValuesForSelected = kpiValues || assignedKPIValuesForYear.filter(
      (kv) => normalizeKpiId(kv.kpi_id) === normalizeKpiId(kpi.id)
    );
    
    try {
      // Load monthly data for each KPI value for the selected year and surrounding years
      if (kpiValuesForSelected.length > 0) {
        const yearsToLoad = [selectedYear - 1, selectedYear, selectedYear + 1];
        for (const value of kpiValuesForSelected) {
          for (const year of yearsToLoad) {
            await loadMonthlyData(value.id, year);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load monthly data:', error);
      showNotification('Failed to load monthly data', 'error');
    }
  };

  const loadMonthlyData = async (kpiValueId, fyYear) => {
    const normalizeMonthlyRows = (rows) => {
      const normalizeValueType = (valueType) => {
        const normalized = (valueType || '').toString().trim().toLowerCase();
        if (!normalized) return '';
        if (normalized === 'actual' || normalized === 'achieved') return 'actual';
        if (normalized === 'target') return 'target';
        if (normalized.includes('actual') || normalized.includes('achieved')) return 'actual';
        if (normalized.includes('target')) return 'target';
        return normalized;
      };

      const parseNumeric = (value) => {
        if (value == null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const byMonthYear = new Map();

      (rows || []).forEach((row) => {
        const month = Number(row.month);
        const year = Number(row.year);

        if (!Number.isFinite(month) || !Number.isFinite(year)) return;

        const key = `${month}-${year}`;
        const current = byMonthYear.get(key) || {
          month,
          year,
          target_value: null,
          actual_value: null
        };

        if (row.target_value !== undefined && row.target_value !== null && row.target_value !== '') {
          current.target_value = parseNumeric(row.target_value);
        }

        if (row.actual_value !== undefined && row.actual_value !== null && row.actual_value !== '') {
          current.actual_value = parseNumeric(row.actual_value);
        }

        const valueType = normalizeValueType(row.value_type);
        if (valueType === 'target') {
          current.target_value = parseNumeric(row.value);
        } else if (valueType === 'actual') {
          current.actual_value = parseNumeric(row.value);
        }

        byMonthYear.set(key, current);
      });

      return Array.from(byMonthYear.values());
    };

    try {
      // For financial year, we need to load data from two calendar years
      // FY 2024 = April 2024 to March 2025
      const response1 = await api.get(`/kpi-data-values/${kpiValueId}/monthly?year=${fyYear}`);
      const response2 = await api.get(`/kpi-data-values/${kpiValueId}/monthly?year=${fyYear + 1}`);
      
      const data1 = response1.data.data || [];
      const data2 = response2.data.data || [];
      
      // Combine data from both years
      const combinedData = normalizeMonthlyRows([...data1, ...data2]);

      setMonthlyData(prev => {
        const existing = prev[kpiValueId] || [];
        // Merge new data with existing data to preserve all years
        const merged = [...existing];
        combinedData.forEach(newItem => {
          // Remove old item if it exists (same month/year) and add the new one
          const index = merged.findIndex(item => item.month === newItem.month && item.year === newItem.year);
          if (index >= 0) {
            merged[index] = newItem;
          } else {
            merged.push(newItem);
          }
        });
        
        return {
          ...prev,
          [kpiValueId]: merged
        };
      });

      return combinedData;
    } catch (error) {
      console.error('Failed to load monthly data:', error);
    }
  };

  const handleDataSubmit = async (kpiValueId, fyMonthIndex, targetValue, actualValue) => {
    try {
      const calendarMonth = getCalendarMonth(fyMonthIndex);
      // Determine the calendar year for this financial year month
      // For months Jan-Mar (fyMonthIndex 9-11), use next calendar year
      const calendarYear = fyMonthIndex >= 9 ? selectedYear + 1 : selectedYear;
      
      const isEmptyValue = (value) => value === '' || value === null || value === undefined;
      const payload = {
        kpiValueId,
        kpiId: selectedKPI?.id,
        empId: user?.empid,
        month: calendarMonth,
        year: calendarYear,
        targetValue: isEmptyValue(targetValue) ? null : targetValue,
        actualValue: isEmptyValue(actualValue) ? null : actualValue
      };
      
      const response = await api.post('/employees/kpi-data', payload);
      showNotification('Data saved successfully! Computing dependent KPIs...', 'success');

      // Store state before reload to compare
      const previousData = { ...monthlyData };

      // Reload monthly data for ALL assigned KPI values for the selected fiscal year to refresh computed values
      // Also load the previous and next fiscal year to ensure all data is available
      const yearsToReload = [selectedYear - 1, selectedYear, selectedYear + 1];
      const reloadResults = [];
      
      for (const year of yearsToReload) {
        const results = await Promise.all(
          assignedKPIValuesForYear.map(value => loadMonthlyData(value.id, year))
        );
        reloadResults.push(...results);
      }

      // Identify computed KPIs that were updated for the same month using returned reload data
      const updatedComputed = [];
      for (let i = 0; i < assignedKPIValuesForYear.length; i++) {
        const kpiValue = assignedKPIValuesForYear[i];
        if (String(kpiValue.kpi_type).toLowerCase() === 'computed') {
          const currentData = monthlyData[kpiValue.id] || [];
          const oldData = previousData[kpiValue.id] || [];

          const newMonthData = currentData.find(d => d.month === calendarMonth && d.year === calendarYear);
          const oldMonthData = oldData.find(d => d.month === calendarMonth && d.year === calendarYear);

          if (newMonthData && newMonthData.actual_value !== oldMonthData?.actual_value) {
            updatedComputed.push({
              name: kpiValue.data,
              value: newMonthData.actual_value,
              unit: unitSymbolById[kpiValue.uom] || ''
            });
          }
        }
      }

      if (updatedComputed.length > 0) {
        setRecentlyUpdatedKPIs(updatedComputed);
        setTimeout(() => setRecentlyUpdatedKPIs([]), 10000);
      }

      const message = updatedComputed.length > 0
        ? `✓ Data saved and ${updatedComputed.length} dependent KPI${updatedComputed.length > 1 ? 's have' : ' has'} been computed!`
        : '✓ Data saved successfully!';
      showNotification(message, 'success');
    } catch (error) {
      console.error('Failed to save data:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save data';
      showNotification(errorMsg, 'error');
    }
  };

  // Extract KPI Value IDs from formula (v123, v456, etc.)
  const extractSourceKpiIds = (formula) => {
    if (!formula) return [];
    const matches = formula.match(/v(\d+)(?::(?:actual|target))?/gi) || [];
    const ids = matches.map(m => {
      const idMatch = /v(\d+)/i.exec(m);
      return idMatch ? parseInt(idMatch[1]) : null;
    }).filter(id => id !== null);
    return [...new Set(ids)];
  };

  // Fetch dependent KPI values for formula display
  const fetchFormulaDetails = async (kpiValueId, formula, month, monthIndex) => {
    try {
      const sourceIds = extractSourceKpiIds(formula);
      if (sourceIds.length === 0) {
        setFormulaDetailsModal({
          show: true,
          data: { month, formula, dependencies: [], computedFormula: formula }
        });
        return;
      }

      const dependencies = [];
      const calendarMonth = getCalendarMonth(monthIndex);
      const calendarYear = monthIndex >= 9 ? selectedYear + 1 : selectedYear;

      for (const sourceId of sourceIds) {
        // Find the KPI value in already loaded data
        let sourceKpiValue = assignedKPIValues.find(kv => String(kv.id) === String(sourceId));
        
        // If not found in assigned values, fetch it from API
        if (!sourceKpiValue) {
          try {
            const kpiValueResponse = await api.get(`/kpi-values/${sourceId}`);
            sourceKpiValue = kpiValueResponse.data.data;
          } catch (error) {
            console.error(`Failed to fetch KPI Value ID ${sourceId}:`, error);
            dependencies.push({ id: sourceId, name: `v${sourceId}`, value: null, unit: '', hasValue: false });
            continue;
          }
        }

        // Get monthly data from already loaded state (if available)
        let monthData = getMonthData(sourceId, monthIndex);
        
        // If no data in state, try to fetch from API
        if (!monthData.actual_value && !monthData.target_value) {
          try {
            const monthlyResponse = await api.get(`/kpi-data-values/${sourceId}/monthly?year=${calendarYear}`);
            const monthlyDataArray = monthlyResponse.data.data || [];
            monthData = monthlyDataArray.find(d => Number(d.month) === Number(calendarMonth)) || {};

            if (monthData.value_type && monthData.value !== undefined) {
              const monthlyRows = monthlyDataArray.filter(
                (d) => Number(d.month) === Number(calendarMonth) && Number(d.year) === Number(calendarYear)
              );
              const targetRow = monthlyRows.find(
                (d) => (d.value_type || '').toString().toLowerCase() === 'target'
              );
              const actualRow = monthlyRows.find((d) => {
                const vt = (d.value_type || '').toString().toLowerCase();
                return vt === 'achieved' || vt === 'actual';
              });

              monthData = {
                ...monthData,
                target_value: targetRow?.value ?? null,
                actual_value: actualRow?.value ?? null
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch monthly data for KPI Value ID ${sourceId}:`, error);
            monthData = {};
          }
        }

        const actualValue = monthData.actual_value;

        dependencies.push({
          id: sourceId,
          name: sourceKpiValue.data || `v${sourceId}`,
          value: actualValue,
          unit: unitSymbolById[sourceKpiValue.uom] || '',
          hasValue: actualValue !== null && actualValue !== undefined && actualValue !== ''
        });
      }

      let computedFormula = formula;
      dependencies.forEach(dep => {
        const vPattern = new RegExp(`v${dep.id}(?::actual)?`, 'gi');
        const displayValue = dep.hasValue ? String(dep.value) : '?';
        computedFormula = computedFormula.replace(vPattern, displayValue);
      });

      setFormulaDetailsModal({ show: true, data: { month, formula, dependencies, computedFormula } });
    } catch (error) {
      console.error('Failed to fetch formula details:', error);
      showNotification('Failed to load formula details', 'error');
    }
  };

  // Build formula with values for display inside KPI card
  const buildFormulaWithValues = (formula, kpiValue, fyMonthIndex) => {
    if (!formula) return null;
    const sourceIds = extractSourceKpiIds(formula);
    if (sourceIds.length === 0) return null;

    const currentMonth = months[fyMonthIndex];
    const dependencies = [];
    let readableFormula = formula;

    sourceIds.forEach(sourceId => {
      const sourceKpiValue = assignedKPIValues.find(kv => String(kv.id) === String(sourceId));
      if (!sourceKpiValue) {
        dependencies.push({ id: sourceId, name: `v${sourceId}`, actual: null, unit: '', hasValue: false });
        return;
      }

      const monthData = getMonthData(sourceKpiValue.id, fyMonthIndex);
      const actualValue = monthData.actual_value;
      const targetValue = monthData.target_value;
      const kpiName = sourceKpiValue.data || `v${sourceId}`;

      const vPattern = new RegExp(`v${sourceId}(?::actual)?`, 'gi');
      const displayValue = actualValue !== null && actualValue !== undefined && actualValue !== '' ? String(actualValue) : '?';
      readableFormula = readableFormula.replace(vPattern, displayValue);

      dependencies.push({ id: sourceId, name: kpiName, actual: actualValue, target: targetValue, unit: unitSymbolById[sourceKpiValue.uom] || '', hasValue: actualValue !== null && actualValue !== undefined && actualValue !== '' });
    });

    const dependencyList = dependencies.map(dep => {
      const actualStr = formatValue(dep.actual, dep.unit);
      const unitStr = dep.unit ? ` ${dep.unit}` : '';
      const status = dep.hasValue ? '' : ' (No data)';
      return `  v${dep.id} - ${dep.name}: ${actualStr}${unitStr}${status}`;
    }).join('\n');

    return {
      formula,
      dependencies,
      formulaDisplay: dependencies.length > 0 ? `${currentMonth}\n\nComputed Formula:\n${readableFormula}\n\nDependent KPIs:\n${dependencyList}` : formula
    };
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const getMonthData = (kpiValueId, fyMonthIndex) => {
    const data = monthlyData[kpiValueId] || monthlyData[String(kpiValueId)] || monthlyData[Number(kpiValueId)] || [];
    const calendarMonth = getCalendarMonth(fyMonthIndex);
    const calendarYear = fyMonthIndex >= 9 ? selectedYear + 1 : selectedYear;
    
    // Find data matching both month and year for accuracy
      const result = data.find(d => Number(d.month) === Number(calendarMonth) && Number(d.year) === Number(calendarYear)) || 
        data.find(d => Number(d.month) === Number(calendarMonth)) || // Fallback to just month if year doesn't match
           {};
    
    return result;
  };

  // Helper function to format numeric values with commas and decimals
  const formatValue = (value, unitSymbol = '') => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    
    // Check if unit is percentage
    const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));
    
    if (isPercentage) {
      // Format percentages with no decimal places
      return numValue.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
    
    // Format with commas and 2 decimal places for other units
    return numValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  

  // Build flat KPI list nodes (no parent/child hierarchy)
  const fullHierarchy = useMemo(() => {
    return [...visibleKPIsForYear]
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map((kpi) => ({ kpi, children: [] }));
  }, [visibleKPIsForYear]);

  // Filter flat KPI list based on searchQuery
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return fullHierarchy;
    const q = searchQuery.toLowerCase();
    return fullHierarchy.filter((node) => {
      const titleMatch = (node.kpi.title || '').toLowerCase().includes(q);
      const categoryMatch = getCategoryName(node.kpi).toLowerCase().includes(q);
      return titleMatch || categoryMatch;
    });
  }, [fullHierarchy, searchQuery]);

  // Helper function to build KPI hierarchy
  const buildKPIHierarchy = (parentKPI) => {
    const hierarchy = [
      {
        kpi: parentKPI,
        children: []
      }
    ];

    // Find all child KPIs
    const findChildren = (parentId) => {
      const normalizedParentId = normalizeKpiId(parentId);
      return visibleKPIsForYear.filter(kpi => normalizeKpiId(kpi.parent_kpi_id) === normalizedParentId);
    };

    // Recursively build the tree
    const addChildren = (node) => {
      const children = findChildren(node.kpi.id);
      node.children = children.map(child => ({
        kpi: child,
        children: []
      }));
      node.children.forEach(child => addChildren(child));
    };

    addChildren(hierarchy[0]);
    return hierarchy[0];
  };

  // Helper function to render a flat KPI row (expandable inline)
  const renderKPINode = (node) => {
    const kpiValues = assignedKPIValuesForYear.filter(
      (kv) => normalizeKpiId(kv.kpi_id) === normalizeKpiId(node.kpi.id)
    );
    const isExpanded = normalizeKpiId(selectedKPI?.id) === normalizeKpiId(node.kpi.id);

    return (
      <div key={node.kpi.id} className={`bg-white rounded-lg border-2 transition-all duration-200 ${isExpanded ? 'border-blue-400 shadow-md' : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
        {/* Clickable header row */}
        <div
          className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
          onClick={() => selectKPI(node.kpi, kpiValues)}
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">{node.kpi.title}</h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {kpiValues.length > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                    📊 {kpiValues.length} Value{kpiValues.length !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">
                    📁 {getCategoryName(node.kpi)}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">
                  📁 {getCategoryName(node.kpi)}
                </span>
              )}
            </div>
          </div>
          <button
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isExpanded ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            type="button"
            onClick={(e) => { e.stopPropagation(); selectKPI(node.kpi, kpiValues); }}
            title={isExpanded ? 'Minimize' : 'Expand to enter data'}
          >
            {isExpanded ? '▲ Minimize' : '▼ Enter Data'}
          </button>
        </div>

        {/* Inline expanded data entry */}
        {isExpanded && (
          <div className="border-t border-slate-200">
            {renderKPIWithValues(node)}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render selected KPI with all values and data
  const renderKPIWithValues = (node) => {
    const kpiValues = assignedKPIValuesForYear.filter(
      (kv) => normalizeKpiId(kv.kpi_id) === normalizeKpiId(node.kpi.id)
    );
    
    return (
      <div key={node.kpi.id} className="space-y-2">
        {/* Recently auto-computed KPIs notice */}
        {recentlyUpdatedKPIs.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mx-3 mt-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">✓ Recently Auto-Computed</p>
            <div className="flex flex-wrap gap-3">
              {recentlyUpdatedKPIs.map((kpi, idx) => (
                <span key={idx} className="text-xs text-emerald-800 font-medium">{kpi.name}: <strong>{formatValue(kpi.value, kpi.unit)}{kpi.unit && ` ${kpi.unit}`}</strong></span>
              ))}
            </div>
          </div>
        )}
        {/* KPI Values Cards */}
        {kpiValues.length > 0 ? (
          <div className="space-y-2">
            {kpiValues.map((kpiValue) => (
              <div key={kpiValue.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {/* Value Header */}
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 px-4 py-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">{kpiValue.data}</h3>
                  
                  </div>
                  {/* Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      String(kpiValue.kpi_type).toLowerCase() === 'computed' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {String(kpiValue.kpi_type).toLowerCase() === 'computed' ? '🧮 Computed' : '📝 Manual'}
                    </span>
                    {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                      <span className="unit-badge inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200" title="Unit of Measurement">
                        📏{unitSymbolById[kpiValue.uom]}
                      </span>
                    )}
                    {kpiValue.target_required && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">
                        🎯 Target Required
                      </span>
                    )}
                    {String(kpiValue.kpi_type).toLowerCase() === 'computed' && kpiValue.formula && (
                      <code className="inline-block px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700 max-w-xs truncate" title={kpiValue.formula}>
                        {kpiValue.formula}
                      </code>
                    )}
                  </div>
                </div>

                {/* Monthly Data Section */}
                <div className="p-3">
                  
                  {String(kpiValue.kpi_type).toLowerCase() === 'manual' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        return (
                          <MonthlyDataForm
                            key={index}
                            month={month}
                            monthIndex={index}
                            kpiValueId={kpiValue.id}
                            targetRequired={kpiValue.target_required}
                            initialTarget={monthData.target_value ?? ''}
                            initialActual={monthData.actual_value ?? ''}
                            unitSymbol={unitSymbolById[kpiValue.uom]}
                            defaultTargetValue={kpiValue.default_target_value}
                            onSubmit={handleDataSubmit}
                          />
                        );
                      })}
                    </div>
                  ) : String(kpiValue.kpi_type).toLowerCase() === 'computed' && (kpiValue.computation_type === 'target_computed' || (kpiValue.target_formula && kpiValue.target_formula.trim() !== '')) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        return (
                          <MonthlyDataFormOption3
                            key={index}
                            month={month}
                            monthIndex={index}
                            kpiValueId={kpiValue.id}
                            initialActual={monthData.actual_value ?? ''}
                            initialTarget={monthData.target_value ?? ''}
                            unitSymbol={unitSymbolById[kpiValue.uom]}
                            targetFormula={kpiValue.target_formula}
                            onViewFormula={() => fetchFormulaDetails(kpiValue.id, kpiValue.target_formula, month, index)}
                            onSubmit={handleDataSubmit}
                          />
                        );
                      })}
                    </div>
                  ) : String(kpiValue.kpi_type).toLowerCase() === 'computed' && kpiValue.computation_type === 'actual_computed' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        return (
                          <MonthlyDataFormOption2
                            key={index}
                            month={month}
                            monthIndex={index}
                            kpiValueId={kpiValue.id}
                            initialActual={monthData.actual_value ?? ''}
                            initialTarget={monthData.target_value ?? ''}
                            unitSymbol={unitSymbolById[kpiValue.uom]}
                            formula={kpiValue.formula}
                            onViewFormula={() => fetchFormulaDetails(kpiValue.id, kpiValue.formula, month, index)}
                            defaultTargetValue={kpiValue.default_target_value}
                            onSubmit={handleDataSubmit}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        const hasComputedValue = monthData.actual_value !== null && monthData.actual_value !== undefined && monthData.actual_value !== '';
                        const formulaInfo = buildFormulaWithValues(kpiValue.formula, kpiValue, index);
                        const missingDependencies = formulaInfo && formulaInfo.dependencies && formulaInfo.dependencies.some(d => !d.hasValue);

                        const containerClass = hasComputedValue
                          ? 'bg-emerald-50 border-emerald-200'
                          : missingDependencies
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200';

                        return (
                          <div
                            key={index}
                            className={`rounded-lg border p-2 transition-all ${containerClass}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="font-semibold text-slate-900">{month}</h5>
                              {hasComputedValue && kpiValue.formula && (
                                <button className="text-sm" onClick={() => fetchFormulaDetails(kpiValue.id, kpiValue.formula, month, index)} title="View formula details">👁️</button>
                              )}
                            </div>
                            <div className="data-display space-y-2 text-sm">
                              {kpiValue.target_required && (
                                <p className="data-row">
                                  <strong>Target:</strong> {formatValue(monthData.target_value ?? kpiValue.default_target_value)}
                                  {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                                    <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                                      {unitSymbolById[kpiValue.uom]}
                                    </span>
                                  )}
                                </p>
                              )}

                              <p className="data-row">
                                <strong>Calculated:</strong>
                                {hasComputedValue ? (
                                  <>
                                    <span className={`computed-value text-lg font-bold text-emerald-700`}>{formatValue(monthData.actual_value)}</span>
                                    {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                                      <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                                        {unitSymbolById[kpiValue.uom]}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="computed-value-missing text-slate-600">Not Available</span>
                                  </>
                                )}
                              </p>

                              {hasComputedValue ? (
                                <p className="computed-note text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 italic">🔧 Auto-calculated</p>
                              ) : missingDependencies ? (
                                <p className="computed-note text-xs text-amber-700 mt-2 pt-2 border-t border-amber-200 italic">⚠️ Waiting for dependent KPI values</p>
                              ) : (
                                <p className="computed-note text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 italic">🔧 Auto-calculated</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Values Assigned</h3>
            <p className="text-slate-600">No data operator has been assigned to this KPI yet.</p>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="space-y-4">
            {/* Filters Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold text-blue-900 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                My KPIs/KAIs
              </h2>
              
              

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Financial Year Dropdown */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="financial-year" className="text-sm font-semibold text-slate-700">
                    Financial Year
                  </label>
                  <select
                    id="financial-year"
                    value={selectedYear}
                    onChange={(e) => updateFinancialYear(parseInt(e.target.value))}
                    className="px-4 py-3 border-2 border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors bg-white hover:border-slate-300"
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = selectedYear - 2 + i;
                      return <option key={year} value={year}>{year}-{String(year + 1).slice(-2)}</option>;
                    })}
                  </select>
                </div>

                {/* Search Input */}
                <div className="flex flex-col gap-2 col-span-1 md:col-span-2 lg:col-span-2">
                  <label htmlFor="search-kpi" className="text-sm font-semibold text-slate-700">
                    Search KPI
                  </label>
                  <div className="relative">
                    <input
                      id="search-kpi"
                      type="text"
                      placeholder="Search by title or category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                        onClick={() => setSearchQuery('')}
                        type="button"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* KPI List Section */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
                <div className="inline-flex items-center gap-3 text-slate-600 animate-pulse">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-lg font-medium">Loading KPIs...</span>
                </div>
              </div>
            ) : visibleKPIsForYear.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
                <div className="text-5xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No KPIs Found</h3>
                <p className="text-slate-600">No KPIs/KAIs assigned to you for FY {getSelectedFinancialYear()}.</p>
                <p className="text-sm text-slate-500 mt-2">Please contact your administrator to assign KPIs.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHierarchy.map(node => renderKPINode(node))}
              </div>
            )}
          </div>
        </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (

        <button
          className="fixed bottom-8 right-8 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Back to top"
        >
          ↑
        </button>
      )}
      {/* Formula Details Modal */}
      {formulaDetailsModal.show && formulaDetailsModal.data && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setFormulaDetailsModal({ show: false, data: null })}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 rounded-t-lg bg-blue-600">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-semibold">Formula Details - {formulaDetailsModal.data.month}</h3>
                <button
                  className="text-white text-2xl leading-none px-3 py-1 rounded hover:bg-white/10"
                  onClick={() => setFormulaDetailsModal({ show: false, data: null })}
                  aria-label="Close formula modal"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-white">
              <div>
                <h4 className="text-sm font-semibold mb-1 text-slate-700">Formula:</h4>
                <pre className="bg-white border border-slate-200 p-3 rounded text-sm overflow-auto"><code className="whitespace-pre-wrap">{formulaDetailsModal.data.formula}</code></pre>
              </div>

              {formulaDetailsModal.data.dependencies && formulaDetailsModal.data.dependencies.length > 0 && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-1 text-slate-700">Computed With Values:</h4>
                    <pre className="bg-green-50 border border-green-200 p-3 rounded text-sm overflow-auto"><code className="whitespace-pre-wrap">{formulaDetailsModal.data.computedFormula}</code></pre>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-slate-700">Dependent KPI Values ({formulaDetailsModal.data.month}):</h4>
                    <div className="overflow-x-auto rounded-md shadow-sm">
                      <table className="w-full text-sm border-separate" style={{ borderSpacing: '0 8px' }}>
                        <thead>
                          <tr className="bg-blue-600">
                            <th className="py-3 px-3 align-middle text-white text-xs font-semibold">KPI Value Name</th>
                            <th className="py-3 px-3 align-middle text-white text-xs font-semibold">Variable ID</th>
                            <th className="py-3 px-3 align-middle text-white text-xs font-semibold">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formulaDetailsModal.data.dependencies.map((dep, idx) => (
                            <tr key={idx} className={`${dep.hasValue ? 'bg-white' : 'bg-slate-50'} rounded-md`}>
                              <td className="py-3 align-top bg-blue-50 px-3 rounded-l-md font-semibold text-slate-900">{dep.name}</td>
                              <td className="py-3 align-top text-slate-600 px-3"><code className="text-xs bg-slate-100 px-2 py-1 rounded">v{dep.id}</code></td>
                              <td className="py-3 align-top px-3">
                                {dep.hasValue ? (
                                  <>
                                    <span className="font-semibold text-slate-900">{formatValue(dep.value, dep.unit)}</span>
                                    {dep.unit && <span className="ml-2 text-xs text-slate-500">{dep.unit}</span>}
                                  </>
                                ) : (
                                  <span className="text-red-500 italic">No data</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Monthly Data Form Component
function MonthlyDataForm({ month, monthIndex, kpiValueId, targetRequired, initialTarget, initialActual, unitSymbol, defaultTargetValue, onSubmit }) {
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [actualValue, setActualValue] = useState(initialActual);
  const [isEditing, setIsEditing] = useState(false);
  const isEmptyValue = (value) => value === '' || value === null || value === undefined;

  // Helper function to format numeric values for display
  const formatDisplayValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    
    const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));
    
    // Format with commas and decimals based on unit type
    return numValue.toLocaleString('en-IN', {
      minimumFractionDigits: isPercentage ? 0 : 2,
      maximumFractionDigits: isPercentage ? 0 : 2
    });
  };

  // Helper function to get target value (prioritize entered value, then default value)
  const getTargetDisplay = () => {
    if (!isEmptyValue(targetValue)) {
      return formatDisplayValue(targetValue);
    }
    if (!isEmptyValue(defaultTargetValue)) {
      return <span className="text-slate-500 italic">{formatDisplayValue(defaultTargetValue)} <span className="text-xs">(Default)</span></span>;
    }
    return '-';
  };

  useEffect(() => {
    setTargetValue(initialTarget);
    setActualValue(initialActual);
  }, [initialTarget, initialActual]);

  const handleSave = () => {
    const resolvedTargetValue = targetRequired
      ? (isEmptyValue(targetValue) ? (isEmptyValue(defaultTargetValue) ? null : defaultTargetValue) : targetValue)
      : null;
    onSubmit(kpiValueId, monthIndex, resolvedTargetValue, actualValue);
    setIsEditing(false);
  };

  return (
    <div className={`rounded-lg border p-2 transition-all ${
      isEditing
        ? 'bg-blue-50 border-blue-300'
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      <h5 className="font-semibold text-slate-900 mb-2 text-center text-xs">{month}</h5>
      
      {isEditing ? (
        <div className="space-y-3">
          {targetRequired && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target</label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Enter target"
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
          <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Actual</label>
            <input
              type="text"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              placeholder="Enter actual value"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button 
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
              onClick={handleSave}
            >
              ✓ Save
            </button>
            <button 
              className="flex-1 px-3 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              onClick={() => setIsEditing(false)}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {targetRequired && (
            <div className="pb-2 border-b border-slate-200">
              <p className="text-black text-xs font-bold mb-1">Target</p>
              <p className="text-slate-900 font-semibold text-base">
                {getTargetDisplay()}
                {unitSymbol && (
                  <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                    {unitSymbol}
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="pb-3">
            <p className="text-black text-xs font-bold mb-1">Actual</p>
            <p className="text-slate-900 font-semibold text-base">
              {formatDisplayValue(actualValue)}
              {unitSymbol && (
                <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                  {unitSymbol}
                </span>
              )}
            </p>
          </div>
          <button 
            className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
              !isEmptyValue(targetValue) || !isEmptyValue(actualValue)
                ? 'bg-yellow-400 hover:bg-yellow-500 text-white'
                : 'bg-yellow-400 hover:bg-yellow-500 text-white'
            }`}
            onClick={() => setIsEditing(true)}
          >
            {!isEmptyValue(targetValue) || !isEmptyValue(actualValue) ? '✏️ Edit' : '➕ Add Data'}
          </button>
        </div>
      )}
    </div>
  );
}

export default EmpKpiKaiPage;
