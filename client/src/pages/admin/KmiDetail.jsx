import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../../api/axios';
import Notification from '../../components/common/Notification';

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
    computation_type: 'both',
    target_formula: '',
    target_source_kpi_value_ids: null,
    default_target_value: ''
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [allKpiValues, setAllKpiValues] = useState([]);
  const [allKpis, setAllKpis] = useState([]);
  const [formulaVars, setFormulaVars] = useState([]); // e.g., ['v1','v2','v3'] in order
  const [varSelections, setVarSelections] = useState({}); // { v1: 123, v2: 456 }
  const [varSearchQueries, setVarSearchQueries] = useState({}); // { v1: 'availability', v2: '' }
  const [targetFormulaVars, setTargetFormulaVars] = useState([]);
  const [targetVarSelections, setTargetVarSelections] = useState({});
  const [targetVarSearchQueries, setTargetVarSearchQueries] = useState({});
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  const [showComputationTypeHelp, setShowComputationTypeHelp] = useState(false);

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
      const data = (response.data.data || []).sort((a, b) => (a.piller_name || '').localeCompare(b.piller_name || ''));
      setPillers(data);
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
      const data = (response.data.data || []).sort((a, b) => (a.unit_name || '').localeCompare(b.unit_name || ''));
      setUnits(data);
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
      data: kmi?.title || '',
      data_operator: '',
      target_required: true,
      uom: '',
      kpi_type: 'manual',
      piller_id: null,
      formula: '',
      source_kpi_value_ids: null,
      computation_type: 'both',
      target_formula: '',
      target_source_kpi_value_ids: null,
      default_target_value: ''
    });
    setFormulaVars([]);
    setVarSelections({});
    setVarSearchQueries({});
    setTargetFormulaVars([]);
    setTargetVarSelections({});
    setTargetVarSearchQueries({});
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal || editingValue || formData.data) return;
    if (!kmi?.title) return;
    setFormData((prev) => ({ ...prev, data: kmi.title }));
  }, [showModal, editingValue, kmi, formData.data]);

  const handleEdit = (value) => {
    setEditingValue(value);

    // Parse formula to extract variables and set up selections
    const formula = value.formula || '';
    const sourceIds = Array.isArray(value.source_kpi_value_ids)
      ? value.source_kpi_value_ids
      : (typeof value.source_kpi_value_ids === 'string'
        ? value.source_kpi_value_ids.split(',').map((x) => Number(x)).filter((n) => !Number.isNaN(n))
        : []);
    // Parse target formula and ids if present
    const targetFormula = value.target_formula || '';
    const targetSourceIds = Array.isArray(value.target_source_kpi_value_ids)
      ? value.target_source_kpi_value_ids
      : (typeof value.target_source_kpi_value_ids === 'string'
        ? value.target_source_kpi_value_ids.split(',').map((x) => Number(x)).filter((n) => !Number.isNaN(n))
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
    // Extract variables from target formula (if any)
    const tTokens = [];
    const tSeen = new Set();
    const tRegex = /v(\d+)/g;
    let tMatch;
    while ((tMatch = tRegex.exec(targetFormula)) !== null) {
      const token = `v${tMatch[1]}`;
      if (!tSeen.has(token)) {
        tSeen.add(token);
        tTokens.push(token);
      }
    }
    setTargetFormulaVars(tTokens);
    const tSelections = {};
    tTokens.forEach((tok) => {
      const idNum = parseInt(tok.substring(1));
      if (targetSourceIds.includes(idNum)) tSelections[tok] = idNum;
    });
    setTargetVarSelections(tSelections);

    // Determine computation type from presence of formulas
    const hasActualFormula = !!(formula && formula.trim());
    const hasTargetFormula = !!(targetFormula && targetFormula.trim());
    let computationType = 'both';
    if (hasActualFormula && hasTargetFormula) computationType = 'both';
    else if (hasActualFormula && !hasTargetFormula) computationType = 'actual_computed';
    else if (!hasActualFormula && hasTargetFormula) computationType = 'target_computed';

    setFormData({
      data: value.data || '',
      data_operator: value.kpi_type === 'computed'
        ? ''
        : (value.data_operator != null ? String(value.data_operator) : (value['data operator'] || '')),
      target_required: value.target_required !== undefined ? value.target_required : true,
      uom: value.uom != null ? String(value.uom) : '',
      kpi_type: value.kpi_type || 'manual',
      piller_id: value.piller_id || null,
      formula: formula,
      source_kpi_value_ids: sourceIds,
      computation_type: computationType,
      target_formula: targetFormula,
      target_source_kpi_value_ids: targetSourceIds,
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
        const re = new RegExp(`\\b${safeTok}\\b`, 'g');
        resolved = resolved.replace(re, `v${sel}`);
      }
    });
    return resolved;
  };

  const resolveTargetFormulaWithSelections = (formula) => {
    let resolved = formula || '';
    targetFormulaVars.forEach((tok) => {
      const sel = targetVarSelections[tok];
      if (sel) {
        const safeTok = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${safeTok}\\b`, 'g');
        resolved = resolved.replace(re, `v${sel}`);
      }
    });
    return resolved;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // If computed, ensure variable selections are complete depending on computation type
      if (formData.kpi_type === 'computed') {
        const ct = formData.computation_type || 'both';
        if (ct === 'target_computed') {
          if (!formData.target_formula || formData.target_formula.trim() === '') {
            showNotification('Target formula is required when actual is manual and target is computed', 'error');
            return;
          }
          for (const tok of targetFormulaVars) {
            if (!targetVarSelections[tok]) {
              showNotification(`Select a KPI value for target formula ${tok}`, 'error');
              return;
            }
          }
        } else {
          if (!formData.formula || formData.formula.trim() === '') {
            showNotification('Formula is required for computed KPI', 'error');
            return;
          }
          for (const tok of formulaVars) {
            if (!varSelections[tok]) {
              showNotification(`Select a KPI value for ${tok}`, 'error');
              return;
            }
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
        computation_type: formData.kpi_type === 'computed' ? formData.computation_type : null,
        // actual (formula) is only sent when computation_type is not target_computed
        formula: (formData.kpi_type === 'computed' && formData.computation_type !== 'target_computed')
          ? resolveFormulaWithSelections(formData.formula)
          : null,
        source_kpi_value_ids: (formData.kpi_type === 'computed' && formData.computation_type !== 'target_computed')
          ? formulaVars.map(tok => Number(varSelections[tok])).filter(n => !Number.isNaN(n))
          : null,
        // target formula is only sent when computation_type is target_computed (actual manual)
        target_formula: (formData.kpi_type === 'computed' && formData.computation_type === 'target_computed')
          ? resolveTargetFormulaWithSelections(formData.target_formula)
          : null,
        target_source_kpi_value_ids: (formData.kpi_type === 'computed' && formData.computation_type === 'target_computed')
          ? targetFormulaVars.map(tok => Number(targetVarSelections[tok])).filter(n => !Number.isNaN(n))
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
    const nextFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    };

    if (name === 'kpi_type' && value === 'computed') {
      nextFormData.data_operator = '';
    }

    setFormData(nextFormData);

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
    // If target formula changed, parse variables like v1, v2, v3 for target
    if (name === 'target_formula') {
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
      setTargetFormulaVars(tokens);
      // Drop selections for target variables no longer present
      setTargetVarSelections((prev) => {
        const next = {};
        tokens.forEach(t => { if (prev[t] != null) next[t] = prev[t]; });
        return next;
      });
    }

    // If computation type changed, update active vars accordingly
    if (name === 'computation_type') {
      const newType = value;
      if (newType === 'target_computed') {
        // clear actual formula vars
        setFormulaVars([]);
        setVarSelections({});
        setVarSearchQueries({});
        // parse existing target formula in formData (if present)
        const tVal = formData.target_formula || '';
        const tokens = [];
        const seen = new Set();
        const regex = /v(\d+)/g;
        let match;
        while ((match = regex.exec(tVal)) !== null) {
          const token = `v${match[1]}`;
          if (!seen.has(token)) {
            seen.add(token);
            tokens.push(token);
          }
        }
        setTargetFormulaVars(tokens);
      } else {
        // both or actual_computed: ensure actual formula tokens are parsed
        setTargetFormulaVars([]);
        setTargetVarSelections({});
        setTargetVarSearchQueries({});
        setFormData((prev) => ({
          ...prev,
          target_formula: '',
          target_source_kpi_value_ids: null
        }));
        const aVal = formData.formula || '';
        const tokens = [];
        const seen = new Set();
        const regex = /v(\d+)/g;
        let match;
        while ((match = regex.exec(aVal)) !== null) {
          const token = `v${match[1]}`;
          if (!seen.has(token)) {
            seen.add(token);
            tokens.push(token);
          }
        }
        setFormulaVars(tokens);
      }
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
        <button
          className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => {
            if (location.state?.fromKmisState) {
              navigate('/admin/kmis', { state: { fromKmisState: location.state.fromKmisState } });
            } else {
              navigate('/admin/kmis');
            }
          }}
        >
          ← Back to KMIs
        </button>
      </div>
    );
  }
  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
      <div className="mb-6 flex justify-between items-center">
        <button
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
          onClick={() => {
            if (location.state?.fromKmisState) {
              navigate('/admin/kmis', { state: { fromKmisState: location.state.fromKmisState } });
            } else {
              navigate('/admin/kmis');
            }
          }}
        >
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
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${value.target_required ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data/Name*</label>
                <input
                  type="text"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  placeholder="Enter data Value"
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
                </select>
              </div>
              {formData.kpi_type === 'computed' && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                    <span>Computation Type</span>
                    <button
                      type="button"
                      onClick={() => setShowComputationTypeHelp(true)}
                      className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Help
                    </button>
                  </label>
                  <select
                    name="computation_type"
                    value={formData.computation_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="actual_computed">Actual computed using formula; target uses default</option>
                    <option value="target_computed">Actual manual; target computed using formula</option>
                    <option value="both">Both actual and target computed using formula</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-2">Option 1: System calculates both values | Option 2: System calculates actual, uses default for target | Option 3: User enters actual, system calculates target</p>
                </div>
              )}
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
                                  <code className="bg-gray-100 px-1 rounded text-red-600">v{kv.id}</code>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Formula (for Actual) {formData.computation_type !== 'target_computed' && '*'}</span>
                      <button
                        type="button"
                        onClick={() => setShowFormulaHelp(true)}
                        className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Help
                      </button>
                    </label>
                    <input
                      type="text"
                      name="formula"
                      value={formData.formula}
                      onChange={handleChange}
                      placeholder={formData.computation_type === 'target_computed' ? 'Not required - actual values entered manually' : 'e.g., v1*v2+v3 or AVERAGE(v1,v2,v3)'}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                      required={formData.computation_type !== 'target_computed'}
                      disabled={formData.computation_type === 'target_computed'}
                    />

                    {formData.computation_type === 'target_computed' && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Target Formula *</label>
                        <input
                          type="text"
                          name="target_formula"
                          value={formData.target_formula}
                          onChange={handleChange}
                          placeholder="e.g., v1*v2+v3 or AVERAGE(v1,v2,v3)"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                          required={formData.computation_type === 'target_computed'}
                        />

                        {targetFormulaVars.length > 0 && (
                          <div className="mt-3 p-3 bg-white rounded-md border border-gray-200">
                            <strong className="text-sm text-gray-700 block mb-2">Assign values for target variables:</strong>
                            <div className="space-y-3">
                              {targetFormulaVars.map((tok) => {
                                const searchQuery = targetVarSearchQueries[tok] || '';
                                const filteredOptions = allowedValuesForYear.filter((kv) => {
                                  if (!searchQuery) return true;
                                  const meta = getKpiMeta(kv.kpi_id);
                                  const label = `v${kv.id} ${kv.data} ${meta.title}`.toLowerCase();
                                  return label.includes(searchQuery.toLowerCase());
                                });
                                const selectedKv = allowedValuesForYear.find(kv => kv.id === targetVarSelections[tok]);
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
                                      list={`target-datalist-${tok}`}
                                      placeholder={`Type to search or select ${tok}...`}
                                      value={searchQuery}
                                      onChange={(e) => {
                                        setTargetVarSearchQueries((prev) => ({ ...prev, [tok]: e.target.value }));
                                        const match = allowedValuesForYear.find(kv => {
                                          const meta = getKpiMeta(kv.kpi_id);
                                          const label = `v${kv.id} - ${kv.data} (${meta.title})`;
                                          return label === e.target.value;
                                        });
                                        if (match) {
                                          setTargetVarSelections((prev) => ({ ...prev, [tok]: match.id }));
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const selectedKv = allowedValuesForYear.find(kv => kv.id === targetVarSelections[tok]);
                                        if (selectedKv) {
                                          const meta = getKpiMeta(selectedKv.kpi_id);
                                          setTargetVarSearchQueries((prev) => ({
                                            ...prev,
                                            [tok]: `v${selectedKv.id} - ${selectedKv.data} (${meta.title})`
                                          }));
                                        }
                                      }}
                                      onFocus={(e) => {
                                        setTargetVarSearchQueries((prev) => ({ ...prev, [tok]: '' }));
                                      }}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <datalist id={`target-datalist-${tok}`}>
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
                              Resolved preview: <code className="bg-gray-100 px-1 rounded">{resolveTargetFormulaWithSelections(formData.target_formula)}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.computation_type !== 'target_computed' && formulaVars.length > 0 && (
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

                    {formData.computation_type !== 'target_computed' && (
                      <div className="mb-5 p-4 bg-blue-50 rounded-md border border-blue-200" >
                        <p className="font-semibold mb-1">Formula Syntax:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><code className="text-red-600">v1, v2, v3</code> - Reference other KPI values</li>
                          <li><code className="text-red-600">v1 + v2 - v3</code> - Basic arithmetic (+, -, *, /, %)</li>
                          <li><code className="text-red-600">CUMSUM(v1)</code> - Cumulative sum from April to current month</li>
                          <li><code className="text-red-600">AVERAGE(v1, v2)</code> - Calculate average</li>
                        </ul>
                        <p className="mt-1"><strong>Example:</strong> <code className="text-red-600">v2*100/v1</code> (Percentage)</p>
                      </div>
                    )}
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
                  disabled={formData.kpi_type === 'computed'}
                  className={`w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${formData.kpi_type === 'computed' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                    }`}
                >
                  <option value="">Select Operator</option>
                  {users.length === 0 ? (
                    <option disabled>No users available</option>
                  ) : (
                    Array.from(new Map([...users].map(user => [user.empid ?? user.id, user])).values())
                      .sort((a, b) => {
                        const nameA = `${a.firstname || ''} ${a.lastname || ''}`.trim().toLowerCase();
                        const nameB = `${b.firstname || ''} ${b.lastname || ''}`.trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((user) => {
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
                  <option value="">Select Pillar</option>
                  {pillers.map((piller) => (
                    <option key={piller.id} value={piller.id}>
                      {piller.piller_name}{piller.short_name ? ` (${piller.short_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {formData.kpi_type !== 'computed' && (
                <>
                  <div className="mb-5 flex items-center">
                    <div className="flex items-center gap-2">
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
                    <span className={`ml-auto text-sm font-semibold ${formData.target_required ? 'text-green-600' : 'text-blue-600'}`}>
                      {formData.target_required ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {formData.target_required && (
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
                  )}
                </>
              )}

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
      {showFormulaHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={() => setShowFormulaHelp(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">📚 Formula Writing Guide</h3>
              <button className="text-gray-600 hover:bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-2xl" onClick={() => setShowFormulaHelp(false)}>×</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Syntax */}
              <section className="border-l-4 border-blue-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">1️⃣ Basic Syntax & Operators</h4>
                <div className="bg-blue-50 p-4 rounded-md space-y-2">
                  <p className="text-sm text-gray-700"><strong>Arithmetic Operators:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li><code className="bg-gray-100 px-2 py-1 rounded">+</code> Addition</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">-</code> Subtraction</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">*</code> Multiplication</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">/</code> Division</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">%</code> Modulo (Remainder)</li>
                  </ul>
                  <p className="text-sm text-gray-700 mt-3"><strong>Order of Operations:</strong> Follows standard mathematical rules (PEMDAS)</p>
                </div>
              </section>

              {/* Variable Reference */}
              <section className="border-l-4 border-green-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">2️⃣ Referencing KPI Values</h4>
                <div className="bg-green-50 p-4 rounded-md space-y-3">
                  <p className="text-sm text-gray-700"><strong>Variable Notation:</strong> Each KPI value is referenced as <code className="bg-gray-100 px-2 py-1 rounded">v{'{id}'}</code></p>
                  <div className="bg-white border border-green-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">Example:</p>
                    <p className="text-gray-600">If you have KPI values named:</p>
                    <ul className="list-disc list-inside text-gray-600 mt-1 mb-2">
                      <li>Sales (ID: 1) → reference as <code className="bg-gray-100 px-1">v1</code></li>
                      <li>Items Sold (ID: 2) → reference as <code className="bg-gray-100 px-1">v2</code></li>
                      <li>Target Sales (ID: 3) → reference as <code className="bg-gray-100 px-1">v3</code></li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Percentage Examples */}
              <section className="border-l-4 border-purple-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">3️⃣ Percentage & Ratio Formulas</h4>
                <div className="bg-purple-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Ratio Between Two KPI Values:</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">v1*100/v2</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Calculates the ratio of v1 (actual) to v2 (actual) as a percentage. Both v1 and v2 use their actual values.</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> If v1 (Sales Completed) = 75 actual and v2 (Sales Target) = 100 actual, result = 75%</p>
                  </div>
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Actual vs Target of Same KPI:</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">v1:actual*100/v1:target</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Compares the actual value against the target value of the same KPI value (v1).</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> If v1 has actual = 75 and target = 100, result = 75% achievement</p>
                  </div>
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Percentage Change/Growth:</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">(v2-v1)*100/v1</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Calculates percentage change from v1 (previous/earlier value) to v2 (current/later value)</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> If v1 = 100 (last month) and v2 = 120 (this month), result = 20% growth</p>
                  </div>
                </div>
              </section>

              {/* Actual vs Target */}
              <section className="border-l-4 border-orange-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">4️⃣ Actual vs Target Problems</h4>
                <div className="bg-orange-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Performance Against Target (Same KPI):</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">v1:actual/v1:target*100</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Shows actual performance as percentage of target for the same KPI value</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> Revenue (v1) with actual = $80,000 and target = $100,000 | Result = 80%</p>
                  </div>
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Variance (Difference from Target):</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">v1:actual-v1:target</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Shows absolute difference between actual and target of the same KPI</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> Actual = 95 | Target = 100 | Result = -5 (shortfall)</p>
                  </div>
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Variance Percentage:</p>
                    <p className="text-gray-600 mb-2"><strong>Formula:</strong> <code className="bg-gray-100 px-2 py-1 rounded">(v1:actual-v1:target)*100/v1:target</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Shows percentage variance from target</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> Actual = 110 | Target = 100 | Result = 10% (exceeded by 10%)</p>
                  </div>
                </div>
              </section>

              {/* Cumulative Sum */}
              <section className="border-l-4 border-red-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">5️⃣ Cumulative Sum Function</h4>
                <div className="bg-red-50 p-4 rounded-md space-y-3">
                  <p className="text-sm text-gray-700"><strong>Syntax:</strong> <code className="bg-gray-100 px-2 py-1 rounded">CUMSUM(v{'{id}'})</code></p>
                  <div className="bg-white border border-red-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 What it does:</p>
                    <p className="text-gray-600">Calculates cumulative sum from April (start of financial year) to the current month</p>
                    <p className="text-gray-600 mt-2"><strong>Example:</strong> If you have monthly sales data:</p>
                    <ul className="list-disc list-inside text-gray-600 mt-1 text-xs">
                      <li>April: 1000 → CUMSUM = 1000</li>
                      <li>May: 1200 → CUMSUM = 2200</li>
                      <li>June: 1500 → CUMSUM = 3700</li>
                      <li>July: 2000 → CUMSUM = 5700</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-red-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Common Use Cases:</p>
                    <ul className="list-disc list-inside text-gray-600 text-sm">
                      <li>Year-to-date totals</li>
                      <li>Running totals for revenue, production, etc.</li>
                      <li><strong>Example Formula:</strong> <code className="bg-gray-100 px-1">CUMSUM(v1)</code> for cumulative monthly sales</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Advanced Functions */}
              <section className="border-l-4 border-indigo-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">6️⃣ Advanced Functions</h4>
                <div className="bg-indigo-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-indigo-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 AVERAGE Function:</p>
                    <p className="text-gray-600 mb-2"><strong>Syntax:</strong> <code className="bg-gray-100 px-2 py-1 rounded">AVERAGE(v1, v2, v3)</code></p>
                    <p className="text-gray-600"><strong>What it does:</strong> Calculates the average of multiple KPI values</p>
                  </div>
                  <div className="bg-white border border-indigo-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Combining Multiple Operations:</p>
                    <p className="text-gray-600 mb-2"><strong>Example:</strong> <code className="bg-gray-100 px-2 py-1 rounded">(v1+v2)/v3*100</code></p>
                    <p className="text-gray-600">Complex formulas combining addition, division, and multiplication</p>
                  </div>
                </div>
              </section>

              {/* Quick Reference */}
              <section className="border-l-4 border-yellow-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">📋 Quick Reference - Common Scenarios</h4>
                <div className="bg-yellow-50 p-4 rounded-md space-y-2 text-sm">
                  <table className="w-full border border-yellow-200">
                    <thead>
                      <tr className="bg-yellow-100 border-b border-yellow-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-800">Scenario</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-800">Formula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-200">
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Ratio of Two KPI Values</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">v1*100/v2</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Performance vs Target</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">v1:actual/v1:target*100</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Month-on-Month Growth</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">(v2-v1)*100/v1</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Average Achievement</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">AVERAGE(v1,v2,v3)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Year-to-Date Total</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">CUMSUM(v1)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600">Variance from Target %</td>
                        <td className="px-3 py-2 font-mono bg-gray-50">(v1:actual-v1:target)*100/v1:target</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Tips */}
              <section className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">⚙️ Computation Type</h4>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="bg-white border border-blue-200 p-3 rounded">
                    <p className="font-semibold text-gray-700 mb-2">📌 What is Computation Type?</p>
                    <p className="text-gray-600">Computation Type determines how the Actual and Target values are calculated for a computed KPI value.</p>
                  </div>
                  <div className="bg-white border border-blue-200 p-3 rounded">
                    <p className="font-semibold text-gray-700 mb-2">📌 Available Options:</p>
                    <ul className="space-y-2 text-gray-600">
                      <li>
                        <strong className="text-gray-700">Both:</strong> Single formula calculates both actual and target values using the same computation logic
                      </li>
                      <li>
                        <strong className="text-gray-700">Actual Only:</strong> Formula computes only the actual value; target value is set manually or inherited
                      </li>
                      <li>
                        <strong className="text-gray-700">Target Only:</strong> Formula computes only the target value; actual value is set manually or inherited
                      </li>
                      <li>
                        <strong className="text-gray-700">Separate:</strong> Use two different formulas - one for actual values and one for target values
                      </li>
                    </ul>
                  </div>
                  <div className="bg-white border border-blue-200 p-3 rounded">
                    <p className="font-semibold text-gray-700 mb-2">📌 When to Use Each:</p>
                    <ul className="space-y-2 text-gray-600">
                      <li>
                        <strong className="text-gray-700">Both:</strong> When actual and target use the same calculation. Example: <code className="bg-gray-100 px-1">v1*100/v2</code> applies to both
                      </li>
                      <li>
                        <strong className="text-gray-700">Actual Only:</strong> When you calculate actual from component values but target is a fixed number
                      </li>
                      <li>
                        <strong className="text-gray-700">Target Only:</strong> When target is calculated but actual is manually entered
                      </li>
                      <li>
                        <strong className="text-gray-700">Separate:</strong> Complex scenarios where actual and target need completely different formulas. Example: <strong>Actual:</strong> <code className="bg-gray-100 px-1">v1-v2</code> (variance) <strong>Target:</strong> <code className="bg-gray-100 px-1">0</code> (zero variance target)
                      </li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                    <p className="font-semibold text-gray-700 mb-2">💡 Example Scenario:</p>
                    <p className="text-gray-600 mb-2">You want to track <strong>Achievement Percentage</strong>:</p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1 mb-2">
                      <li>v1 = Actual Sales, v2 = Target Sales</li>
                      <li>Both use formula: <code className="bg-gray-100 px-1">v1*100/v2</code></li>
                      <li><strong>Computation Type = Both</strong></li>
                      <li>Result: Actual Achievement % and a Target Achievement % are both calculated</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <p className="font-semibold text-gray-700 mb-2">💡 Example Scenario with Separate:</p>
                    <p className="text-gray-600 mb-2">You want to track <strong>Variance (Actual - Target)</strong>:</p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1 mb-2">
                      <li>Actual Formula: <code className="bg-gray-100 px-1">v1:actual - v2:actual</code> (difference between two values)</li>
                      <li>Target Formula: <code className="bg-gray-100 px-1">v1:target - v2:target</code> (expected difference)</li>
                      <li><strong>Computation Type = Separate</strong></li>
                      <li>Result: Variance computed separately for actual and target scenarios</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <section className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">💡 Tips for Success</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Use parentheses to control the order of operations: <code className="bg-gray-100 px-1">(v1+v2)*100/v3</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Always reference correct KPI value IDs from the table above</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>For percentages, standard formula is: (part/whole)*100</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Test your formula with sample values to ensure it produces expected results</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Use consistent variable references - stick to the same KPI value IDs</span>
                  </li>
                </ul>
              </section>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                type="button"
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
                onClick={() => setShowFormulaHelp(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showComputationTypeHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={() => setShowComputationTypeHelp(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">⚙️ Computation Type Guide</h3>
              <button className="text-gray-600 hover:bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-2xl" onClick={() => setShowComputationTypeHelp(false)}>×</button>
            </div>
            <div className="p-6 space-y-6">
              {/* What is Computation Type */}
              <section className="border-l-4 border-blue-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">🎯 What is Computation Type?</h4>
                <div className="bg-blue-50 p-4 rounded-md space-y-3">
                  <p className="text-sm text-gray-700">Computation Type determines how the <strong>Actual</strong> and <strong>Target</strong> values are calculated for a computed KPI value.</p>
                  <p className="text-sm text-gray-700">Each KPI value can have both an <strong>actual value</strong> (what was achieved) and a <strong>target value</strong> (what was planned). Computation Type controls how these are determined.</p>
                </div>
              </section>

              {/* Option 1: Both */}
              <section className="border-l-4 border-green-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">1️⃣ Both Actual and Target Computed Using Formula</h4>
                <div className="bg-green-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-green-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">When to Use:</p>
                    <p className="text-gray-600">Use this when the same formula applies to both actual and target values, and you want the system to automatically calculate both.</p>
                  </div>
                  <div className="bg-white border border-green-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">How It Works:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1 text-xs">
                      <li>You provide ONE formula</li>
                      <li>System calculates <strong>Actual Value</strong> using this formula</li>
                      <li>System calculates <strong>Target Value</strong> using the same formula</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-green-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Example:</p>
                    <p className="text-gray-600 mb-2"><strong>Achievement Percentage</strong></p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                      <li><strong>Formula:</strong> <code className="bg-gray-100 px-1">v1*100/v2</code> (Actual Sales / Target Sales * 100)</li>
                      <li><strong>v1 (Actual Sales):</strong> 80,000 | <strong>v2 (Sales Target):</strong> 100,000 → Result: 80%</li>
                      <li><strong>v1 (Target for Sales):</strong> 90,000 | <strong>v2 (Target for Sales Target):</strong> 100,000 → Result: 90%</li>
                      <li>Final KPI: Actual = 80%, Target = 90%</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Option 2: Actual Computed */}
              <section className="border-l-4 border-purple-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">2️⃣ Actual Computed Using Formula; Target Uses Default</h4>
                <div className="bg-purple-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">When to Use:</p>
                    <p className="text-gray-600">Use this when you want to calculate actual values from a formula, but the target is a fixed number (default) that doesn't change.</p>
                  </div>
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">How It Works:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1 text-xs">
                      <li>You provide ONE formula for calculating actual values</li>
                      <li>System calculates <strong>Actual Value</strong> using this formula</li>
                      <li><strong>Target Value</strong> is set from the "Default Target Value" field (a fixed number)</li>
                      <li>Target remains constant regardless of actual data</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-purple-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Example:</p>
                    <p className="text-gray-600 mb-2"><strong>Customer Retention Rate</strong></p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                      <li><strong>Formula:</strong> <code className="bg-gray-100 px-1">v1*100/v2</code> (Retained Customers / Total Customers)</li>
                      <li><strong>Default Target Value:</strong> 95 (fixed target of 95%)</li>
                      <li><strong>Month 1:</strong> (950 / 1000) * 100 = 95% actual, 95% target</li>
                      <li><strong>Month 2:</strong> (920 / 1000) * 100 = 92% actual, 95% target (target unchanged)</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Option 3: Target Computed */}
              <section className="border-l-4 border-orange-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">3️⃣ Actual Manual; Target Computed Using Formula</h4>
                <div className="bg-orange-50 p-4 rounded-md space-y-3">
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">When to Use:</p>
                    <p className="text-gray-600">Use this when actual values are entered manually, and the target is calculated using a formula.</p>
                  </div>
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">How It Works:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1 text-xs">
                      <li><strong>Actual Value:</strong> User enters manually (based on data entry form)</li>
                      <li>You provide ONE formula for calculating target values</li>
                      <li>System calculates <strong>Target Value</strong> using the formula</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-orange-200 p-3 rounded text-sm">
                    <p className="font-semibold text-gray-700 mb-2">📌 Example:</p>
                    <p className="text-gray-600 mb-2"><strong>Quality Score with Variance</strong></p>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                      <li><strong>Target Formula:</strong> <code className="bg-gray-100 px-1">v1-v2</code> (Planned Quality - Industry Standard)</li>
                      <li><strong>Actual Value:</strong> User enters "92" (actual quality score → entered manually)</li>
                      <li><strong>v1 (Planning data) = 100, v2 (Industry Standard) = 5</strong></li>
                      <li>System calculates Target = 100 - 5 = 95</li>
                      <li>Final KPI: Actual = 92, Target = 95</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Comparison Table */}
              <section className="border-l-4 border-indigo-500 pl-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">📊 Quick Comparison</h4>
                <div className="bg-indigo-50 p-4 rounded-md overflow-x-auto text-xs">
                  <table className="w-full border border-indigo-200">
                    <thead>
                      <tr className="bg-indigo-100 border-b border-indigo-200">
                        <th className="px-3 py-2 text-left font-semibold">Option</th>
                        <th className="px-3 py-2 text-left font-semibold">Actual Value</th>
                        <th className="px-3 py-2 text-left font-semibold">Target Value</th>
                        <th className="px-3 py-2 text-left font-semibold">Formulas Needed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-200">
                      <tr className="bg-white">
                        <td className="px-3 py-2">Both</td>
                        <td className="px-3 py-2">Computed from formula</td>
                        <td className="px-3 py-2">Computed from same formula</td>
                        <td className="px-3 py-2">1 formula</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="px-3 py-2">Actual Computed</td>
                        <td className="px-3 py-2">Computed from formula</td>
                        <td className="px-3 py-2">Fixed default value</td>
                        <td className="px-3 py-2">1 formula + default</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="px-3 py-2">Target Computed</td>
                        <td className="px-3 py-2">Manual entry by user</td>
                        <td className="px-3 py-2">Computed from formula</td>
                        <td className="px-3 py-2">1 formula</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Tips */}
              <section className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-3">💡 Tips for Choosing</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span><strong>Both:</strong> Most common choice when you want symmetric actual and target calculations</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span><strong>Actual Computed:</strong> Use when target is a policy/directive that doesn't change with data</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span><strong>Target Computed:</strong> Use when actual is from external sources but target is calculated</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Always ensure your formula references valid KPI values available in your KMI</span>
                  </li>
                </ul>
              </section>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                type="button"
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
                onClick={() => setShowComputationTypeHelp(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KmiDetail;
