import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

function EmpKpiKaiPage() {
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
    return base.filter((kpi) => kpi.title?.toLowerCase().includes(q));
  }, [kpis, assignedKPIIdsForYear, kpiById, selectedYear, searchQuery]);

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
      
      console.log('Save response:', response.data);
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
      <div key={node.kpi.id} className="kpi-node" style={{ marginLeft: depth * 16 }}>
        <div className="kpi-node-header">
          <button
            className={`accordion-toggle ${hasChildren ? '' : 'empty'}`}
            onClick={() => hasChildren && toggleExpand(node.kpi.id)}
            aria-label={hasChildren ? 'Toggle children' : 'No children'}
            type="button"
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </button>
          <div className="kpi-node-body">
            <div className="kpi-node-title">{node.kpi.title}</div>
            <div className="kpi-node-meta">
              {kpiValues.length > 0 && <span className="badge">📊 {kpiValues.length} Value(s)</span>}
            </div>
          </div>
          <div className="kpi-node-actions">
            <button className="btn-ghost" type="button" onClick={() => selectKPI(node.kpi, kpiValues)}>👁️ View</button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="kpi-children">
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
      <div key={node.kpi.id} className="kpi-hierarchy-section">
        <div className="kpi-section-header">
          <h3 className="kpi-section-title">{node.kpi.title}</h3>
        </div>

        {kpiValues.length > 0 ? (
          <div className="kpi-values-cards-container">
            {kpiValues.map((kpiValue) => (
              <div key={kpiValue.id} className="kpi-value-card">
                <div className="kpi-value-header">
                  <div className="kpi-value-info">
                    <h3 className="kpi-value-title">{kpiValue.data}</h3>
                    <div className="kpi-value-meta">
                      <span className="type-badge" title="KPI Type">{String(kpiValue.kpi_type).toLowerCase() === 'computed' ? '🧮 Computed' : '📝 Manual'}</span>
                      {kpiValue.unit_symbol && (
                        <span className="unit-badge" title="Unit of Measurement">📏 {kpiValue.unit_symbol}</span>
                      )}
                      {kpiValue.target_required && (
                        <span className="target-badge" title="Target Required">🎯 Target Required</span>
                      )}
                    </div>
                  </div>
                </div>

                {String(kpiValue.kpi_type).toLowerCase() === 'computed' && kpiValue.formula && (
                  <div className="formula-section">
                    <p className="formula-label">Formula:</p>
                    <code className="formula-display">{kpiValue.formula}</code>
                  </div>
                )}

                <div className="monthly-data-section">
                  <h4 className="monthly-section-title">Monthly Data - FY {selectedYear}-{String(selectedYear + 1).slice(-2)}</h4>
                  {String(kpiValue.kpi_type).toLowerCase() === 'manual' ? (
                    <div className="monthly-data-grid">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        return (
                          <MonthlyDataForm
                            key={index}
                            month={month}
                            monthIndex={index}
                            kpiValueId={kpiValue.id}
                            targetRequired={kpiValue.target_required}
                            initialTarget={monthData.target_value || ''}
                            initialActual={monthData.actual_value || ''}
                            unitSymbol={kpiValue.unit_symbol}
                            defaultTargetValue={kpiValue.default_target_value}
                            onSubmit={handleDataSubmit}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="monthly-data-grid">
                      {months.map((month, index) => {
                        const monthData = getMonthData(kpiValue.id, index);
                        const hasComputedValue = monthData.actual_value !== null && monthData.actual_value !== undefined && monthData.actual_value !== '';
                        return (
                          <div
                            key={index}
                            className={`month-card computed ${hasComputedValue ? 'has-value' : 'missing-value'}`}
                          >
                            <h4>{month}</h4>
                            <div className="data-display">
                              {kpiValue.target_required && (
                                <p className="data-row">
                                  <strong>Target:</strong> {formatValue(monthData.target_value)}
                                  {kpiValue.unit_symbol && <span className="unit-label"> {kpiValue.unit_symbol}</span>}
                                </p>
                              )}
                              <p className="data-row">
                                <strong>Calculated:</strong> 
                                <span className="computed-value">{formatValue(monthData.actual_value)}</span>
                                {kpiValue.unit_symbol && <span className="unit-label"> {kpiValue.unit_symbol}</span>}
                              </p>
                              <p className="computed-note">🔧 Auto-calculated</p>
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
          <div className="no-values-message">
            <p>No values assigned to this KPI.</p>
          </div>
        )}

        {/* Render child KPIs */}
        {node.children && node.children.length > 0 && (
          <div className="kpi-children-container">
            {node.children.map(child => renderKPIWithValues(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="employee-dashboard-content">
      <div className="page-header">
        <div className="heading-section">
          <h2>My KPIs/KAIs</h2>
        </div>
      </div>

      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span className="notification-icon">{notification.type === 'success' ? '✓' : '✕'}</span>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification({ show: false, message: '', type: '' })}>×</button>
        </div>
      )}
      
      {!selectedKPI ? (
        <div className="kpi-page">
          <div className="bg-white p-5 rounded-lg shadow">
            <div className="flex gap-6 flex-wrap items-end mb-6">
              <div className="flex flex-col gap-2 flex-1 min-w-[250px]">
                <label htmlFor="financial-year" className="text-sm font-semibold text-gray-700">Financial Year:</label>
                <select
                  id="financial-year"
                  value={selectedYear}
                  onChange={(e) => updateFinancialYear(parseInt(e.target.value))}
                  className="px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = selectedYear - 2 + i;
                    return <option key={year} value={year}>{year}-{String(year + 1).slice(-2)}</option>;
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-[250px] relative">
                <label htmlFor="search-kpi" className="text-sm font-semibold text-gray-700">Search KPI:</label>
                <input
                  id="search-kpi"
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    className="absolute right-3 bottom-2.5 text-gray-500 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xl"
                    onClick={() => setSearchQuery('')}
                    type="button"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading KPIs...</div>
            ) : visibleKPIsForYear.length === 0 ? (
              <div className="no-data">No KPIs/KAIs assigned to you for FY {getSelectedFinancialYear()}.</div>
            ) : (
              <div className="tree-container">
                {getRootKPIs().map(rootKPI => 
                  renderKPINode(buildKPIHierarchy(rootKPI))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="kpi-details">
              <div className="page-header">
                <div className="heading-section">
                  <button 
                    className="back-btn"
                    onClick={() => setSelectedKPI(null)}
                    title="Back to KPI list"
                  >
                    ← Back
                  </button>
                  <div className="breadcrumb-container">
                    <nav className="breadcrumb" aria-label="KPI hierarchy">
                      {buildBreadcrumb(selectedKPI).map((kpi, index, array) => (
                        <span key={kpi.id} className="breadcrumb-item">
                          <span className="breadcrumb-type-badge">{getCategoryName(kpi.category_id)}</span>
                          <span className="breadcrumb-text">{kpi.title}</span>
                          {index < array.length - 1 && <span className="breadcrumb-separator">›</span>}
                        </span>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg shadow mb-6">
                <div className="flex gap-6 flex-wrap items-end">
                  <div className="flex flex-col gap-2 flex-1 min-w-[250px]">
                    <label htmlFor="financial-year-detail" className="text-sm font-semibold text-gray-700">Financial Year:</label>
                    <select
                      id="financial-year-detail"
                      value={selectedYear}
                      onChange={(e) => updateFinancialYear(parseInt(e.target.value))}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {[...Array(5)].map((_, i) => {
                        const year = selectedYear - 2 + i;
                        return <option key={year} value={year}>{year}-{String(year + 1).slice(-2)}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="tree-container">
                {renderKPIWithValues(buildKPIHierarchy(selectedKPI))}
              </div>
            </div>
          )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          className="scroll-to-top"
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
    if (targetValue) {
      return formatDisplayValue(targetValue);
    }
    if (defaultTargetValue) {
      return <span className="default-value-badge">{formatDisplayValue(defaultTargetValue)} <span className="badge-text">(Default)</span></span>;
    }
    return '-';
  };

  useEffect(() => {
    setTargetValue(initialTarget);
    setActualValue(initialActual);
  }, [initialTarget, initialActual]);

  const handleSave = () => {
    onSubmit(kpiValueId, monthIndex, targetValue, actualValue);
    setIsEditing(false);
  };

  return (
    <div className="month-card">
      <h4>{month}</h4>
      {isEditing ? (
        <div className="form-inputs">
          {targetRequired && (
            <div className="form-group">
              <label>Target:</label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Enter target"
              />
            </div>
          )}
          <div className="form-group">
            <label>Actual:</label>
            <input
              type="text"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              placeholder="Enter actual value"
            />
          </div>
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>Save</button>
            <button className="btn-cancel" onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="data-display">
          {targetRequired && (
            <p className="data-row">
              <strong>Target:</strong> {getTargetDisplay()}
              {unitSymbol && <span className="unit-label"> {unitSymbol}</span>}
            </p>
          )}
          <p className="data-row">
            <strong>Actual:</strong> {formatDisplayValue(actualValue)}
            {unitSymbol && <span className="unit-label"> {unitSymbol}</span>}
          </p>
          <button className="btn-edit" onClick={() => setIsEditing(true)}>
            {targetValue || actualValue ? 'Edit' : 'Add Data'}
          </button>
        </div>
      )}
    </div>
  );
}

export default EmpKpiKaiPage;
