import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../../api/axios';

function KmiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [kmi, setKmi] = useState(location.state?.kmi || null);
  const [kpiValues, setKpiValues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pillers, setPillers] = useState([]);
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingValue, setEditingValue] = useState(null);
  const [formData, setFormData] = useState({
    data: '',
    data_operator: '',
    target_required: true,
    uom: '',
    kpi_type: 'manual',
    piller_id: null,
    formula: '',
    source_kpi_value_ids: null,
    default_target_value: ''
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [allKpiValues, setAllKpiValues] = useState([]);
  const [allKpis, setAllKpis] = useState([]);
  const [formulaVars, setFormulaVars] = useState([]); // e.g., ['v1','v2','v3'] in order
  const [varSelections, setVarSelections] = useState({}); // { v1: 123, v2: 456 }
  const [varSearchQueries, setVarSearchQueries] = useState({}); // { v1: 'availability', v2: '' }

  useEffect(() => {
    loadKmiDetails();
    loadCategories();
    loadPillers();
    loadUsers();
    loadUnits();
  }, [id]);

  const loadKmiDetails = async () => {
    try {
      setLoading(true);
      
      // Load KMI if not passed via state
      if (!kmi) {
        const kmiResponse = await axios.get(`/kpis/${id}`);
        setKmi(kmiResponse.data.data);
      }
      
      // Load KPI values
      const valuesResponse = await axios.get(`/kpi-values?kpi_id=${id}`);
      setKpiValues(valuesResponse.data.data || []);
      
      setError('');
    } catch (err) {
      const errorMsg = 'Failed to load KMI details';
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await axios.get('/categories');
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadPillers = async () => {
    try {
      const response = await axios.get('/pillers');
      setPillers(response.data.data || []);
    } catch (err) {
      console.error('Failed to load pillers', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const loadUnits = async () => {
    try {
      const response = await axios.get('/unit-master');
      setUnits(response.data.data || []);
    } catch (err) {
      console.error('Failed to load units', err);
    }
  };

  React.useEffect(() => {
    const loadAllKpiValues = async () => {
      try {
        const response = await axios.get('/kpi-values');
        setAllKpiValues(response.data?.data || []);
      } catch (err) {
        console.error('Failed to load all KPI values', err);
        setAllKpiValues([]);
      }
    };
    const loadAllKpis = async () => {
      try {
        const response = await axios.get('/kpis');
        setAllKpis(response.data?.data || []);
      } catch (err) {
        console.error('Failed to load KPIs', err);
        setAllKpis([]);
      }
    };
    loadAllKpiValues();
    loadAllKpis();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  const getCategoryName = (categoryId) => {
    return categories.find((c) => c.id === categoryId)?.category_name || 'Unknown';
  };

  const getPillerName = (pillerId) => {
    return pillers.find((p) => p.id === pillerId)?.piller_name || 'N/A';
  };

  const getUnitName = (unitId) => {
    if (unitId == null) return 'N/A';
    return units.find((u) => String(u.id) === String(unitId))?.unit_name || String(unitId);
  };

  const getOperatorName = (operatorId) => {
    if (!operatorId) return 'N/A';
    const user = users.find((u) => String(u.empid ?? u.id) === String(operatorId));
    if (!user) return String(operatorId);
    const emp = user.empid ? ` (${user.empid})` : '';
    return `${user.firstname || ''} ${user.lastname || ''}`.trim() + emp;
  };

  const handleAddNew = () => {
    setEditingValue(null);
    setFormData({
      data: '',
      data_operator: '',
      target_required: true,
      uom: '',
      kpi_type: 'manual',
      piller_id: null,
      formula: '',
      source_kpi_value_ids: null,
      default_target_value: ''
    });
    setFormulaVars([]);
    setVarSelections({});
    setVarSearchQueries({});
    setShowModal(true);
  };

  const handleEdit = (value) => {
    setEditingValue(value);
    
    // Parse formula to extract variables and set up selections
    const formula = value.formula || '';
    const sourceIds = Array.isArray(value.source_kpi_value_ids)
      ? value.source_kpi_value_ids
      : (typeof value.source_kpi_value_ids === 'string'
          ? value.source_kpi_value_ids.split(',').map((x) => Number(x)).filter((n) => !Number.isNaN(n))
          : []);
    
    // Extract variables from formula
    const tokens = [];
    const seen = new Set();
    const regex = /v(\d+)/g;
    let match;
    while ((match = regex.exec(formula)) !== null) {
      const token = `v${match[1]}`;
      if (!seen.has(token)) {
        seen.add(token);
        tokens.push(token);
      }
    }
    setFormulaVars(tokens);
    
    // Build variable selections map from the actual IDs in the formula
    const selections = {};
    tokens.forEach((tok) => {
      const idNum = parseInt(tok.substring(1));
      if (sourceIds.includes(idNum)) {
        selections[tok] = idNum;
      }
    });
    setVarSelections(selections);
    setVarSearchQueries({});
    
    setFormData({
      data: value.data || '',
      data_operator: value.data_operator != null ? String(value.data_operator) : (value['data operator'] || ''),
      target_required: value.target_required !== undefined ? value.target_required : true,
      uom: value.uom != null ? String(value.uom) : '',
      kpi_type: value.kpi_type || 'manual',
      piller_id: value.piller_id || null,
      formula: formula,
      source_kpi_value_ids: sourceIds,
      default_target_value: value.default_target_value || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (valueId) => {
    if (!window.confirm('Are you sure you want to delete this KPI value?')) {
      return;
    }

    try {
      await axios.delete(`/kpi-values/${valueId}`);
      showNotification('KPI value deleted successfully!', 'success');
      loadKmiDetails();
    } catch (err) {
      const errorMsg = 'Failed to delete KPI value: ' + (err.response?.data?.error || err.message);
      showNotification(errorMsg, 'error');
    }
  };

  // Helper: get KPI title and fin year by kpi_id
  const getKpiMeta = (kpiId) => {
    const k = allKpis.find(k => String(k.id) === String(kpiId));
    return { title: k?.title || `KPI #${kpiId}`, fin_year: k?.fin_year || '' };
  };

  // Options filtered by current KMI financial year
  const allowedValuesForYear = React.useMemo(() => {
    const year = kmi.fin_year;
    if (!year) return allKpiValues;
    return allKpiValues.filter(kv => {
      const meta = getKpiMeta(kv.kpi_id);
      return meta.fin_year === year;
    });
  }, [allKpiValues, allKpis, kmi.fin_year]);

  // Replace placeholders v1/v2/... with actual v<ID> selections
  const resolveFormulaWithSelections = (formula) => {
    let resolved = formula || '';
    formulaVars.forEach((tok) => {
      const sel = varSelections[tok];
      if (sel) {
        const safeTok = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(safeTok, 'g');
        resolved = resolved.replace(re, `v${sel}`);
      }
    });
    return resolved;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // If computed, ensure variable selections are complete and build resolved formula + deps
      if (formData.kpi_type === 'computed') {
        if (!formData.formula || formData.formula.trim() === '') {
          showNotification('Formula is required for computed KPI', 'error');
          return;
        }
        // Require selections for each variable present
        for (const tok of formulaVars) {
          if (!varSelections[tok]) {
            showNotification(`Select a KPI value for ${tok}`, 'error');
            return;
          }
        }
      }

      const payload = {
        data: formData.data,
        kpi_id: parseInt(id),
        data_operator: formData.data_operator || null,
        target_required: formData.target_required,
        uom: formData.uom ? parseInt(formData.uom) : null,
        kpi_type: formData.kpi_type,
        piller_id: formData.piller_id ? parseInt(formData.piller_id) : null,
        formula: formData.kpi_type === 'computed'
          ? resolveFormulaWithSelections(formData.formula)
          : null,
        source_kpi_value_ids: formData.kpi_type === 'computed'
          ? formulaVars.map(tok => Number(varSelections[tok])).filter(n => !Number.isNaN(n))
          : null,
        default_target_value: formData.default_target_value || null
      };

      if (editingValue) {
        await axios.put(`/kpi-values/${editingValue.id}`, payload);
        showNotification('KPI value updated successfully!', 'success');
      } else {
        await axios.post('/kpi-values', payload);
        showNotification('KPI value created successfully!', 'success');
      }

      setShowModal(false);
      loadKmiDetails();
    } catch (err) {
      const errorMsg = 'Failed to save KPI value: ' + (err.response?.data?.error || err.message);
      showNotification(errorMsg, 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });

    // If formula changed, parse variables like v1, v2, v3
    if (name === 'formula') {
      const tokens = [];
      const seen = new Set();
      const regex = /v(\d+)/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        const token = `v${match[1]}`;
        if (!seen.has(token)) {
          seen.add(token);
          tokens.push(token);
        }
      }
      setFormulaVars(tokens);
      // Drop selections for variables no longer present
      setVarSelections((prev) => {
        const next = {};
        tokens.forEach(t => { if (prev[t] != null) next[t] = prev[t]; });
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="text-center py-10 text-blue-500 text-base">Loading KMI details...</div>
      </div>
    );
  }

  if (error || !kmi) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">{error || 'KMI not found'}</div>
        <button className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => navigate('/admin/kmis')}>
          ← Back to KMIs
        </button>
      </div>
    );
  }
  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {notification.show && (
        <div className={`fixed top-5 right-5 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50`}>
          <span className="text-lg font-bold">{notification.type === 'success' ? '✓' : '✕'}</span>
          <span>{notification.message}</span>
          <button className="ml-4 text-white hover:text-gray-200 font-bold text-xl" onClick={() => setNotification({ show: false, message: '', type: '' })}>×</button>
        </div>
      )}
      <div className="mb-6 flex justify-between items-center">
        <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium" onClick={() => navigate('/admin/kmis')}>
          ← Back to KMIs
        </button>
        <h2 className="text-2xl font-bold text-gray-800">KMI Details</h2>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[#1B55C4]">{kmi.title}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-600 mb-1">Financial Year:</span>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium w-fit">{kmi.fin_year || 'N/A'}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">KPI Values</h3>
          <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium" onClick={handleAddNew}>
            + Add Value
          </button>
        </div>
        {kpiValues.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-base">No KPI values found. Add your first value!</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data Operator</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit of Measurement</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Piller</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Target Required</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {kpiValues.map((value) => (
                    <tr key={value.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {value.kpi_type || 'manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{value.data}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getOperatorName(value.data_operator ?? value['data operator'])}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getUnitName(value.uom)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getPillerName(value.piller_id)}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${value.target_required ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {value.target_required ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEdit(value)}
                            className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(value.id)}
                            className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">{editingValue ? 'Edit KPI Value' : 'Add New KPI Value'}</h3>
              <button className="text-gray-600 hover:bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-2xl" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data/Name *</label>
                <input
                  type="text"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Revenue, Customer Count"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">KPI Type *</label>
                <select
                  name="kpi_type"
                  value={formData.kpi_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="manual">Manual</option>
                  <option value="computed">Computed</option>
                  <option value="aggregated">Aggregated</option>
                </select>
              </div>
              {formData.kpi_type === 'computed' && (
                <>
                  <div className="mb-5 p-4 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Available KPI Values (for formula reference)</h4>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left">Use in Formula</th>
                            <th className="px-2 py-1 text-left">KPI Value Name</th>
                            <th className="px-2 py-1 text-left">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kpiValues
                            .filter(kv => kv.id !== editingValue?.id)
                            .map((kv) => (
                              <tr key={kv.id} className="border-b border-blue-100">
                                <td className="px-2 py-1">
                                  <code className="bg-gray-100 px-1 rounded">v{kv.id}</code>
                                </td>
                                <td className="px-2 py-1">{kv.data}</td>
                                <td className="px-2 py-1">
                                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                    {kv.kpi_type || 'manual'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Formula *</label>
                    <input
                      type="text"
                      name="formula"
                      value={formData.formula}
                      onChange={handleChange}
                      placeholder="e.g., v1*v2+v3 or AVERAGE(v1,v2,v3)"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                      required
                    />
                    
                    {formulaVars.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                        <strong className="text-sm text-gray-700 block mb-2">Assign values for variables:</strong>
                        <div className="space-y-3">
                          {formulaVars.map((tok) => {
                            const searchQuery = varSearchQueries[tok] || '';
                            const filteredOptions = allowedValuesForYear.filter((kv) => {
                              if (!searchQuery) return true;
                              const meta = getKpiMeta(kv.kpi_id);
                              const label = `v${kv.id} ${kv.data} ${meta.title}`.toLowerCase();
                              return label.includes(searchQuery.toLowerCase());
                            });
                            const selectedKv = allowedValuesForYear.find(kv => kv.id === varSelections[tok]);
                            const selectedLabel = selectedKv 
                              ? `v${selectedKv.id} - ${selectedKv.data} (${getKpiMeta(selectedKv.kpi_id).title})`
                              : '';
                            
                            return (
                              <div key={tok} className="bg-white p-2 rounded border border-gray-300">
                                <label className="text-sm font-semibold text-gray-700 mb-1 block">
                                  {tok} {selectedLabel && <span className="font-normal text-gray-600">→ {selectedLabel}</span>}
                                </label>
                                <input
                                  type="text"
                                  list={`datalist-${tok}`}
                                  placeholder={`Type to search or select ${tok}...`}
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setVarSearchQueries((prev) => ({ ...prev, [tok]: e.target.value }));
                                    // Check if typed value matches an option exactly
                                    const match = allowedValuesForYear.find(kv => {
                                      const meta = getKpiMeta(kv.kpi_id);
                                      const label = `v${kv.id} - ${kv.data} (${meta.title})`;
                                      return label === e.target.value;
                                    });
                                    if (match) {
                                      setVarSelections((prev) => ({ ...prev, [tok]: match.id }));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const selectedKv = allowedValuesForYear.find(kv => kv.id === varSelections[tok]);
                                    if (selectedKv) {
                                      const meta = getKpiMeta(selectedKv.kpi_id);
                                      setVarSearchQueries((prev) => ({ 
                                        ...prev, 
                                        [tok]: `v${selectedKv.id} - ${selectedKv.data} (${meta.title})` 
                                      }));
                                    }
                                  }}
                                  onFocus={(e) => {
                                    setVarSearchQueries((prev) => ({ ...prev, [tok]: '' }));
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                />
                                <datalist id={`datalist-${tok}`}>
                                  {filteredOptions.map((kv) => {
                                    const meta = getKpiMeta(kv.kpi_id);
                                    return (
                                      <option 
                                        key={kv.id} 
                                        value={`v${kv.id} - ${kv.data} (${meta.title})`}
                                      />
                                    );
                                  })}
                                </datalist>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          Resolved preview: <code className="bg-gray-100 px-1 rounded">{resolveFormulaWithSelections(formData.formula)}</code>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      <p className="font-semibold mb-1">Formula Syntax:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li><code>v1, v2, v3</code> - Reference other KPI values</li>
                        <li><code>v1 + v2 - v3</code> - Basic arithmetic (+, -, *, /, %)</li>
                        <li><code>CUMSUM(v1)</code> - Cumulative sum from April to current month</li>
                        <li><code>AVERAGE(v1, v2)</code> - Calculate average</li>
                      </ul>
                      <p className="mt-1"><strong>Example:</strong> <code>v2*100/v1</code> (Percentage)</p>
                    </div>
                  </div>
                </>
              )}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Unit of Measurement</label>
                <select
                  name="uom"
                  value={formData.uom}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Unit</option>
                  {units.length === 0 ? (
                    <option disabled>No units available</option>
                  ) : (
                    units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Data Operator</label>
                <select
                  name="data_operator"
                  value={formData.data_operator}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Operator</option>
                  {users.length === 0 ? (
                    <option disabled>No users available</option>
                  ) : (
                    users.map((user) => {
                      const value = user.empid ?? user.id;
                      const label = `${user.firstname || ''} ${user.lastname || ''}`.trim();
                      const suffix = user.empid ? ` (${user.empid})` : '';
                      return (
                        <option key={user.id} value={value}>
                          {label || 'User'}{suffix}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Piller</label>
                <select
                  name="piller_id"
                  value={formData.piller_id || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Piller</option>
                  {pillers.map((piller) => (
                    <option key={piller.id} value={piller.id}>
                      {piller.piller_name}{piller.short_name ? ` (${piller.short_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Default Target Value</label>
                <input
                  type="text"
                  name="default_target_value"
                  value={formData.default_target_value}
                  onChange={handleChange}
                  placeholder="e.g., 100, 50%"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="mb-5 flex items-center gap-2">
                <input
                  type="checkbox"
                  name="target_required"
                  checked={formData.target_required}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  id="target_required"
                />
                <label htmlFor="target_required" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Target Required
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium">
                  {editingValue ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default KmiDetail;
