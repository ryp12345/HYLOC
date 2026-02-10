import React, { useState, useEffect, useMemo } from 'react';
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  const updateFinancialYear = (year) => {
    setSelectedYear(year);
    
    // When year changes, reload all KPI values' monthly data for the new year
    assignedKPIValues.forEach(value => loadMonthlyData(value.id, year));
  };

  const changeYear = (delta) => {
    const newYear = selectedYear + delta;
    updateFinancialYear(newYear);
  };

  const getSelectedFinancialYear = () => `${selectedYear}-${String(selectedYear + 1).slice(-2)}`;

  const kpiById = useMemo(() => new Map(kpis.map((kpi) => [kpi.id, kpi])), [kpis]);

  // Build breadcrumb trail for a KPI (from root to current)
  const buildBreadcrumb = (kpi) => {
    const breadcrumb = [];
    let currentKPI = kpi;
    
    while (currentKPI) {
      breadcrumb.unshift(currentKPI);
      if (currentKPI.parent_kpi_id) {
        currentKPI = kpiById.get(currentKPI.parent_kpi_id);
      } else {
        currentKPI = null;
      }
    }
    
    return breadcrumb;
  };

  // Get category name from category_id
  const getCategoryName = (categoryId) => {
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
    const fy = getSelectedFinancialYear();
    return new Set(
      assignedKPIValues
        .filter((kv) => kpiById.get(kv.kpi_id)?.fin_year === fy)
        .map((kv) => kv.kpi_id)
    );
  }, [assignedKPIValues, kpiById, selectedYear]);

  const assignedKPIValuesForYear = useMemo(
    () => assignedKPIValues.filter((kv) => assignedKPIIdsForYear.has(kv.kpi_id)),
    [assignedKPIValues, assignedKPIIdsForYear]
  );

  const visibleKPIsForYear = useMemo(() => {
    const fy = getSelectedFinancialYear();
    const included = new Set();

    const addWithParents = (id) => {
      let currentId = id;
      while (currentId && !included.has(currentId)) {
        included.add(currentId);
        const parentId = kpiById.get(currentId)?.parent_kpi_id || null;
        currentId = parentId;
      }
    };

    assignedKPIIdsForYear.forEach(addWithParents);

    const base = kpis.filter((kpi) => kpi.fin_year === fy && included.has(kpi.id));

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((kpi) => {
      const titleMatch = kpi.title?.toLowerCase().includes(q);
      const categoryMatch = getCategoryName(kpi.category_id).toLowerCase().includes(q);
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
      setMonthlyData({}); // Clear any existing monthly data
      
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
      
      // Pre-load monthly data for all KPI values for the current financial year
      const currentYear = new Date().getFullYear();
      for (const kpiValue of kpiValues) {
        await loadMonthlyData(kpiValue.id, currentYear);
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
    setSelectedKPI(kpi);
    
    // Filter kpi_values for this specific KPI
    const kpiValuesForSelected = kpiValues || assignedKPIValuesForYear.filter(kv => kv.kpi_id === kpi.id);
    
    try {
      // Load monthly data for each KPI value for the selected year
      if (kpiValuesForSelected.length > 0) {
        for (const value of kpiValuesForSelected) {
          await loadMonthlyData(value.id, selectedYear);
        }
      }
    } catch (error) {
      console.error('Failed to load monthly data:', error);
      showNotification('Failed to load monthly data', 'error');
    }
  };

  const loadMonthlyData = async (kpiValueId, fyYear) => {
    try {
      // For financial year, we need to load data from two calendar years
      // FY 2024 = April 2024 to March 2025
      const response1 = await api.get(`/kpi-values/${kpiValueId}/monthly-data/${fyYear}`);
      const response2 = await api.get(`/kpi-values/${kpiValueId}/monthly-data/${fyYear + 1}`);
      
      const data1 = response1.data.data || [];
      const data2 = response2.data.data || [];
      
      // Combine data from both years
      const combinedData = [...data1, ...data2];
      
      setMonthlyData(prev => ({
        ...prev,
        [kpiValueId]: combinedData
      }));
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
      
      const payload = {
        kpiValueId,
        kpiId: selectedKPI.id,
        empId: user.empid,
        month: calendarMonth,
        year: calendarYear,
        targetValue: targetValue || null, 
        actualValue: actualValue || null
      };
      
      const response = await api.post('/employees/kpi-data', payload);
      
      // console.log('Save response:', response.data);
      showNotification('Data saved successfully!', 'success');
      await loadMonthlyData(kpiValueId, selectedYear);
    } catch (error) {
      console.error('Failed to save data:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save data';
      showNotification(errorMsg, 'error');
    }
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
    const data = monthlyData[kpiValueId] || [];
    const calendarMonth = getCalendarMonth(fyMonthIndex);
    return data.find(d => d.month === calendarMonth) || {};
  };

  // Helper function to format numeric values with commas and decimals
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    
    // Format with commas and 2 decimal places
    return numValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper function to get root KPIs (those with no parent)
  const getRootKPIs = () => {
    return visibleKPIsForYear.filter(kpi => !kpi.parent_kpi_id || kpi.parent_kpi_id === null);
  };

  // Build full hierarchy (nodes shaped as { kpi, children: [] }) from visible KPIs
  const fullHierarchy = useMemo(() => {
    const map = new Map();
    visibleKPIsForYear.forEach(kpi => map.set(kpi.id, { kpi, children: [] }));

    // attach children to parents when parent exists in the visible set
    map.forEach(node => {
      const parentId = node.kpi.parent_kpi_id;
      if (parentId && map.has(parentId)) {
        map.get(parentId).children.push(node);
      }
    });

    // roots are nodes whose parent is not present in the map
    const roots = Array.from(map.values()).filter(node => !node.kpi.parent_kpi_id || !map.has(node.kpi.parent_kpi_id));
    // sort children and roots for stable ordering
    const sortRec = (node) => {
      node.children.sort((a, b) => (a.kpi.title || '').localeCompare(b.kpi.title || ''));
      node.children.forEach(sortRec);
    };
    roots.forEach(sortRec);
    return roots;
  }, [visibleKPIsForYear]);

  // Recursive filter of the hierarchy based on searchQuery (keeps matching nodes and their ancestors)
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return fullHierarchy;
    const q = searchQuery.toLowerCase();

    const filterNode = (node) => {
      const titleMatch = (node.kpi.title || '').toLowerCase().includes(q);
      const categoryMatch = getCategoryName(node.kpi.category_id).toLowerCase().includes(q);
      const children = node.children || [];
      const filteredChildren = children.map(filterNode).filter(c => c !== null);
      if (titleMatch || categoryMatch || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return fullHierarchy.map(n => filterNode(n)).filter(n => n !== null);
  }, [fullHierarchy, searchQuery]);

  // Auto-expand nodes when search is active so matches are visible
  useEffect(() => {
    if (searchQuery.trim()) {
      const nodesToExpand = new Set();
      const collect = (node) => {
        nodesToExpand.add(node.kpi.id);
        (node.children || []).forEach(collect);
      };
      filteredHierarchy.forEach(node => collect(node));
      setExpandedNodes(nodesToExpand);
    }
  }, [searchQuery, filteredHierarchy]);

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
      return visibleKPIsForYear.filter(kpi => kpi.parent_kpi_id === parentId);
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

  // Helper function to render KPI node with expandable children
  const renderKPINode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.kpi.id);
    const hasChildren = (node.children || []).length > 0;
    const kpiValues = assignedKPIValuesForYear.filter(kv => kv.kpi_id === node.kpi.id);
    
    return (
      <div key={node.kpi.id} className="space-y-2" style={{ marginLeft: `${depth * 16}px` }}>
        <div className="bg-white rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Expand/Collapse Button */}
            <button
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                hasChildren 
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-600 cursor-pointer' 
                  : 'text-slate-300'
              }`}
              onClick={() => hasChildren && toggleExpand(node.kpi.id)}
              aria-label={hasChildren ? 'Toggle children' : 'No children'}
              type="button"
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '●'}
            </button>

            {/* KPI Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">{node.kpi.title}</h3>
              {kpiValues.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                    📊 {kpiValues.length} Value{kpiValues.length !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">
                    📁 {getCategoryName(node.kpi.category_id)}
                  </span>
                </div>
              )}
            </div>

            {/* View Button */}
            {kpiValues.length > 0 && (
              <button 
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-black rounded-lg font-medium transition-colors shadow-sm hover:shadow-md border border-blue-600"
                type="button" 
                onClick={() => selectKPI(node.kpi, kpiValues)}
                title="View KPI details"
              >
                👁️ View
              </button>
            )}
          </div>
        </div>

        {/* Child KPIs */}
        {hasChildren && isExpanded && (
          <div className="space-y-2 pl-2 border-l-2 border-slate-200">
            {node.children.map((child) => renderKPINode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render selected KPI with all values and data
  const renderKPIWithValues = (node) => {
    const kpiValues = assignedKPIValuesForYear.filter(kv => kv.kpi_id === node.kpi.id);
    
    return (
      <div key={node.kpi.id} className="space-y-6">
        {/* KPI Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{node.kpi.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold border border-blue-200">
              📁 {getCategoryName(node.kpi.category_id)}
            </span>
            {kpiValues.length > 0 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-semibold border border-green-200">
                ✓ {kpiValues.length} Value{kpiValues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* KPI Values Cards */}
        {kpiValues.length > 0 ? (
          <div className="space-y-6">
            {kpiValues.map((kpiValue) => (
              <div key={kpiValue.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Value Header */}
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{kpiValue.data}</h3>
                      <p className="text-sm text-slate-600 mt-1">KPI Value ID: {kpiValue.id}</p>
                    </div>
                  </div>
                  
                  {/* Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                      String(kpiValue.kpi_type).toLowerCase() === 'computed' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {String(kpiValue.kpi_type).toLowerCase() === 'computed' ? '🧮 Computed' : '📝 Manual'}
                    </span>
                    {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                      <span className="unit-badge inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200" title="Unit of Measurement">
                        📏 {unitSymbolById[kpiValue.uom]}
                      </span>
                    )}
                    {kpiValue.target_required && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">
                        🎯 Target Required
                      </span>
                    )}
                  </div>
                </div>

                {/* Formula Section */}
                {String(kpiValue.kpi_type).toLowerCase() === 'computed' && kpiValue.formula && (
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Formula</p>
                    <code className="inline-block px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 break-all">
                      {kpiValue.formula}
                    </code>
                  </div>
                )}

                {/* Monthly Data Section */}
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="text-2xl">📅</span>
                    Monthly Data - FY {selectedYear}-{String(selectedYear + 1).slice(-2)}
                  </h4>
                  
                  {String(kpiValue.kpi_type).toLowerCase() === 'manual' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        const hasComputedValue = monthData.actual_value !== null && monthData.actual_value !== undefined && monthData.actual_value !== '';
                        return (
                          <div
                            key={index}
                            className={`rounded-lg border-2 p-4 transition-all ${
                              hasComputedValue
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <span className="text-blue-600">📍</span>
                              {month}
                            </h5>
                            <div className="data-display space-y-2 text-sm">
                              {kpiValue.target_required && (
                                <p className="data-row">
                                  <strong>Target:</strong> {formatValue(monthData.target_value ?? kpiValue.default_target_value)}
                                  {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                                    <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                                      📏 {unitSymbolById[kpiValue.uom]}
                                    </span>
                                  )}
                                </p>
                              )}
                              <p className="data-row">
                                <strong>Calculated:</strong> 
                                <span className={`computed-value text-lg font-bold ${hasComputedValue ? 'text-emerald-700' : 'text-slate-500'}`}>{formatValue(monthData.actual_value)}</span>
                                {kpiValue.uom && unitSymbolById[kpiValue.uom] && (
                                  <span className="unit-badge inline-flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 ml-2" title="Unit of Measurement">
                                    📏 {unitSymbolById[kpiValue.uom]}
                                  </span>
                                )}
                              </p>
                              <p className="computed-note text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 italic">🔧 Auto-calculated</p>
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
            <p className="text-slate-600">No values have been assigned to this KPI yet.</p>
          </div>
        )}

        {/* Child KPIs */}
        {node.children && node.children.length > 0 && (
          <div className="space-y-6 mt-8 pl-6 border-l-4 border-blue-200">
            <h3 className="text-lg font-semibold text-slate-900">Child KPIs</h3>
            {node.children.map(child => renderKPIWithValues(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <span className={`text-lg font-bold ${notification.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {notification.type === 'success' ? '✓' : '✕'}
          </span>
          <span className={`font-medium ${notification.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
            {notification.message}
          </span>
          <button 
            className={`ml-2 text-lg font-bold cursor-pointer hover:opacity-70 ${notification.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}
            onClick={() => setNotification({ show: false, message: '', type: '' })}
          >
            ×
          </button>
        </div>
      )}
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!selectedKPI ? (
          <div className="space-y-6">
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
              <div className="space-y-4">
                {filteredHierarchy.map(node => renderKPINode(node))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">

            {/* Back Button, Breadcrumb & Financial Year Selector Combined */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                    onClick={() => setSelectedKPI(null)}
                    title="Back to KPI list"
                  >
                    ← Back
                  </button>
                  {/* Breadcrumb in colored box */}
                  <div className="px-4 py-3 rounded-lg"  style={{ backgroundColor: '#0a2a52' }}>
                    <nav className="flex items-center gap-2 flex-wrap">
                      {buildBreadcrumb(selectedKPI).map((kpi, index, array) => (
                        <div key={kpi.id} className="flex items-center gap-2">
                          <span className="inline-flex items-center text-bold gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold border border-blue-700">
                            <span className="text-white">●</span>
                            <span className="font-bold">{getCategoryName(kpi.category_id)}</span>
                          </span>
                          <span className="text-white font-medium">{kpi.title}</span>
                          {index < array.length - 1 && <span className="text-slate-400 text-xl">›</span>}
                        </div>
                      ))}
                    </nav>
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-[180px]">
                  <label htmlFor="financial-year-detail" className="text-sm font-semibold text-slate-700">
                    Financial Year
                  </label>
                  <select
                    id="financial-year-detail"
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
              </div>
            </div>

            {/* KPI Details */}
            <div className="space-y-6">
              {renderKPIWithValues(buildKPIHierarchy(selectedKPI))}
            </div>
          </div>
        )}
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
    
    // Format with commas and 2 decimal places
    return numValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
    <div className={`rounded-lg border-2 p-4 transition-all ${
      isEditing
        ? 'bg-blue-50 border-blue-300'
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
    }`}>
      <h5 className="font-semibold text-slate-900 mb-4 text-center text-sm">{month}</h5>
      
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
            <label className="block text-xs font-semibold text-slate-00 mb-1">Actual</label>
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
                    📏 {unitSymbol}
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
                  📏 {unitSymbol}
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
