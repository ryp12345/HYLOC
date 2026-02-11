import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Helper function to get current financial year
const getInitialYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const endYear = fyStartYear + 1;
  return `${fyStartYear}-${endYear.toString().slice(-2)}`;
};

function KmisPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // State declarations MUST come before any conditional returns
  const [kpis, setKpis] = useState([]);
  const [kpiTree, setKpiTree] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(getInitialYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingKmi, setEditingKmi] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    fin_year: '',
    category_id: '',
    parent_kpi_id: null,
    department_id: '',
    emp_id: ''
  });
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [replicateFromYear, setReplicateFromYear] = useState('');
  const [previousYearKpis, setPreviousYearKpis] = useState([]);
  const [previousYearTree, setPreviousYearTree] = useState([]);
  const [selectedKpisToReplicate, setSelectedKpisToReplicate] = useState(new Set());
  const [replicateLoading, setReplicateLoading] = useState(false);
  const [replicateExpandedNodes, setReplicateExpandedNodes] = useState(new Set());
  
  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/unauthorized', { replace: true });
    }
  }, [user, authLoading, navigate]);
  
  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return null;
  }

  // Generate financial years on component mount
  useEffect(() => {
    const { years } = generateFinancialYears();
    setFinancialYears(years);
  }, []);

  // Fetch categories, departments, and employees
  useEffect(() => {
    const loadCategoriesAndDepartments = async () => {
      try {
        const [categoriesRes, departmentsRes, usersRes] = await Promise.all([
          axios.get('/categories'),
          axios.get('/departments'),
          axios.get('/users')
        ]);
        setCategories(categoriesRes.data.data || []);
        const depts = departmentsRes.data.data || [];
        console.log('Departments loaded:', depts);
        setDepartments(depts);
        const emps = usersRes.data.data || [];
        console.log('Employees loaded:', emps);
        setEmployees(emps);
      } catch (err) {
        console.error('Failed to load categories, departments or employees', err);
        setError('Failed to load data');
      }
    };

    loadCategoriesAndDepartments();
  }, []);

  // Ensure form picks a sensible default category when categories load
  useEffect(() => {
    if (categories.length === 0) return;
    const defaultId = getDefaultCategoryId(categories);
    setFormData((prev) => ({
      ...prev,
      category_id: prev.category_id || defaultId,
    }));
  }, [categories]);

  const buildTree = (list, year) => {
    const filtered = year ? list.filter((kpi) => kpi.fin_year === year) : list;
    const map = new Map();
    filtered.forEach((kpi) => {
      map.set(kpi.id, { ...kpi, children: [] });
    });

    map.forEach((node) => {
      if (node.parent_kpi_id && map.has(node.parent_kpi_id)) {
        map.get(node.parent_kpi_id).children.push(node);
      }
    });

    // Get the category ID for "KMI / GLOBAL OBJECTIVES" (compare as strings)
    const globalObjectivesCategoryId = categories.find((c) => c.category_name === 'KMI / GLOBAL OBJECTIVES')?.id;

    // Show only root KMIs with "KMI / GLOBAL OBJECTIVES" category (safe string compare)
    const roots = Array.from(map.values())
      .filter((node) => !node.parent_kpi_id && (!globalObjectivesCategoryId || String(node.category_id) === String(globalObjectivesCategoryId)))
      .sort((a, b) => a.title.localeCompare(b.title));

    const sortChildren = (node) => {
      node.children.sort((a, b) => a.title.localeCompare(b.title));
      node.children.forEach(sortChildren);
    };
    roots.forEach(sortChildren);
    return roots;
  };

  const loadKpis = async (year = selectedYear) => {
    try {
      setLoading(true);
      const response = await axios.get('/kpis');
      const data = response.data.data || [];
      const tree = buildTree(data, year);
      setKpis(data);
      setKpiTree(tree);
      setExpandedNodes(new Set());
      setError('');
    } catch (err) {
      const errorMsg = 'Failed to load KMIs';
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch KPIs when selected year changes — wait until categories are loaded
  useEffect(() => {
    if (categories.length === 0) return; // category filter needs category IDs
    loadKpis(selectedYear);
  }, [selectedYear, categories]);

  const categoryOrder = useMemo(() => [6, 1, 2, 3, 4, 5], []);

  const generateFinancialYears = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Determine current financial year (April - March)
    // If current month is April (3) or later, FY starts this year
    // Otherwise, FY started last year
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const currentFinYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;

    const years = [];
    // Previous 2 years
    for (let i = 2; i >= 1; i--) {
      const start = fyStartYear - i;
      const end = start + 1;
      years.push(`${start}-${end.toString().slice(-2)}`);
    }
    // Current year
    years.push(currentFinYear);
    // Next 1 year
    const nextStart = fyStartYear + 1;
    const nextEnd = nextStart + 1;
    years.push(`${nextStart}-${nextEnd.toString().slice(-2)}`);

    return { years, currentFinYear };
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  const getDefaultCategoryId = (cats) => (
    String(cats.find((c) => c.category_name === 'KMI / GLOBAL OBJECTIVES')?.id ?? cats[0]?.id ?? '')
  );

  const getNextCategoryId = (parentCategoryId) => {
    if (!parentCategoryId) return getDefaultCategoryId(categories);
    const idx = categoryOrder.indexOf(Number(parentCategoryId));
    if (idx === -1) return getDefaultCategoryId(categories);
    const nextIdx = Math.min(idx + 1, categoryOrder.length - 1);
    return String(categoryOrder[nextIdx]);
  };

  const handleAddNew = () => {
    setEditingKmi(null);
    setFormData({ 
      title: '',
      fin_year: selectedYear,
      category_id: getDefaultCategoryId(categories), // This will be "KMI / GLOBAL OBJECTIVES" category
      parent_kpi_id: null,
      department_id: '',
      emp_id: ''
    });
    setShowModal(true);
  };

  const handleOpenReplicateModal = async () => {
    const previousYears = financialYears.filter(year => {
      // Extract start year from format "YYYY-YY"
      const yearNum = parseInt(year.split('-')[0]);
      const selectedYearNum = parseInt(selectedYear.split('-')[0]);
      return yearNum < selectedYearNum;
    });
    if (previousYears.length === 0) {
      showNotification('No previous financial years available to replicate from', 'error');
      return;
    }
    
    // Check if current year already has KMIs
    const existingKmis = kpis.filter(k => k.fin_year === selectedYear);
    if (existingKmis.length > 0) {
      const confirmReplicate = window.confirm(
        `⚠️ Warning: ${existingKmis.length} KMI(s) already exist for ${selectedYear}.\n\n` +
        `Replicating will ADD new KMIs without removing existing ones.\n\n` +
        `For best results, delete all existing ${selectedYear} KMIs first, then replicate.\n\n` +
        `Do you want to continue anyway?`
      );
      if (!confirmReplicate) {
        return;
      }
    }
    
    // Get the most recent previous year
    setReplicateFromYear(previousYears[previousYears.length - 1]);
    await loadPreviousYearKpis(previousYears[previousYears.length - 1]);
    setShowReplicateModal(true);
    setSelectedKpisToReplicate(new Set());
    setReplicateExpandedNodes(new Set());
  };

  const loadPreviousYearKpis = async (year) => {
    try {
      setReplicateLoading(true);
      const response = await axios.get('/kpis');
      const data = response.data.data || [];
      const filtered = data.filter(kpi => kpi.fin_year === year);
      const tree = buildTree(filtered, year);
      setPreviousYearKpis(filtered);
      setPreviousYearTree(tree);
    } catch (err) {
      showNotification('Failed to load previous year KMIs', 'error');
      console.error(err);
    } finally {
      setReplicateLoading(false);
    }
  };

  const handleEdit = async (kmi) => {
    setEditingKmi(kmi);

    // Try to load existing department mapping for this KPI
    let deptId = '';
    try {
      const resp = await axios.get(`/kpi-departments?kpi_id=${kmi.id}`);
      const mappings = resp.data?.data || [];
      if (mappings.length > 0) {
        deptId = mappings[0].department_id != null ? String(mappings[0].department_id) : '';
      }
    } catch (err) {
      console.debug('No KPI-Department mapping found or failed to fetch', err?.response?.data || err);
    }

    // Try to load existing employee mapping for this KPI (if any)
    let empId = '';
    try {
      const resp2 = await axios.get(`/kpi-employees?kpi_id=${kmi.id}`);
      const mappings2 = resp2.data?.data || [];
      if (mappings2.length > 0) {
        empId = mappings2[0].emp_id != null ? String(mappings2[0].emp_id) : '';
      }
    } catch (err) {
      console.debug('No KPI-Employee mapping found or failed to fetch', err?.response?.data || err);
    }

    setFormData({
      title: kmi.title || '',
      fin_year: kmi.fin_year || selectedYear,
      category_id: kmi.category_id != null ? String(kmi.category_id) : getDefaultCategoryId(categories),
      parent_kpi_id: kmi.parent_kpi_id || null,
      department_id: deptId,
      emp_id: empId
    });
    setShowModal(true);
  };

  const handleAddChild = (parent) => {
    setEditingKmi(null);
    setFormData({
      title: '',
      fin_year: parent.fin_year || selectedYear,
      category_id: getNextCategoryId(parent.category_id),
      parent_kpi_id: parent.id,
      department_id: '',
      emp_id: ''
    });
    setShowModal(true);
    setExpandedNodes((prev) => new Set(prev).add(parent.id));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this KMI?')) {
      return;
    }

    try {
      await axios.delete(`/kpis/${id}`);
      showNotification('KMI deleted successfully!', 'success');
      loadKpis(selectedYear);
    } catch (err) {
      const errorMsg = 'Failed to delete KMI: ' + (err.response?.data?.error || err.message);
      showNotification(errorMsg, 'error');
    }
  };

  const handleView = (kmi) => {
    navigate(`/admin/kmis/${kmi.id}`, { state: { kmi } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let kpiId;
      
      if (editingKmi) {
        await axios.put(`/kpis/${editingKmi.id}`, {
          title: formData.title,
          fin_year: formData.fin_year,
          category_id: Number(formData.category_id),
          parent_kpi_id: formData.parent_kpi_id ? Number(formData.parent_kpi_id) : null
        });
        kpiId = editingKmi.id;
        showNotification('KPI updated successfully!', 'success');
      } else {
        const response = await axios.post('/kpis', {
          title: formData.title,
          fin_year: formData.fin_year,
          category_id: Number(formData.category_id),
          parent_kpi_id: formData.parent_kpi_id ? Number(formData.parent_kpi_id) : null
        });
        kpiId = response.data.data.id;
        showNotification('KMI created successfully!', 'success');
      }

      // Save KPI-Department mapping if Department KPI category is selected (category_id = 2)
      if (String(formData.category_id) === '2') {
        if (formData.department_id) {
          try {
            await axios.post('/kpi-departments', {
              kpi_id: kpiId,
              department_id: Number(formData.department_id)
            });
          } catch (err) {
            console.error('Failed to save KPI-Department mapping:', err?.response?.data || err);
            const serverMsg = err?.response?.data?.message || err?.message || 'Unknown error';
            showNotification(`KPI saved but failed to map department: ${serverMsg}`, 'error');
          }
        } else {
          showNotification('Please select a department for Department KPI', 'error');
          return;
        }
      }

      // Save KPI-Employee mapping if Employee KPI category is selected (category_id = 4)
      if (String(formData.category_id) === '4') {
        if (formData.emp_id) {
          try {
            await axios.post('/kpi-employees', {
              kpi_id: kpiId,
              emp_id: Number(formData.emp_id)
            });
          } catch (err) {
            console.error('Failed to save KPI-Employee mapping:', err?.response?.data || err);
            const serverMsg = err?.response?.data?.message || err?.message || 'Unknown error';
            showNotification(`KPI saved but failed to map employee: ${serverMsg}`, 'error');
          }
        } else {
          showNotification('Please select an employee for Employee KPI', 'error');
          return;
        }
      }

      setShowModal(false);
      loadKpis(selectedYear);
    } catch (err) {
      const errorMsg = 'Failed to save KMI: ' + (err.response?.data?.error || err.message);
      showNotification(errorMsg, 'error');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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


  // (Removed unused helper `isNodeMatching` and `getCategoryName`)

  // Filter tree based on search query
  const getFilteredTree = () => {
    if (!searchQuery.trim()) {
      return kpiTree;
    }

    const filterNode = (node) => {
      const matchesQuery = node.title.toLowerCase().includes(searchQuery.toLowerCase());
      const children = node.children || [];
      const filteredChildren = children
        .map(child => filterNode(child))
        .filter(child => child !== null);

      if (matchesQuery || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };

    return kpiTree
      .map(node => filterNode(node))
      .filter(node => node !== null);
  };

  // Auto-expand nodes when search is active
  const getCategoryNameById = (id) => categories.find((c) => String(c.id) === String(id))?.category_name || 'Category';

  // Auto-expand nodes when search is active (also react to tree changes)
  useEffect(() => {
    if (searchQuery.trim()) {
      const nodesToExpand = new Set();
      const collectNodeIds = (node) => {
        nodesToExpand.add(node.id);
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => collectNodeIds(child));
        }
      };
      getFilteredTree().forEach(node => collectNodeIds(node));
      setExpandedNodes(nodesToExpand);
    }
  }, [searchQuery, kpiTree]);

  const renderNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children || []).length > 0;
    return (
      <div key={node.id} className="mb-2" style={{ marginLeft: depth * 16 }}>
        <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <button
              className={`w-6 h-6 flex items-center justify-center rounded text-sm ${
                hasChildren ? 'text-blue-500 hover:bg-blue-50 cursor-pointer' : 'text-gray-300 cursor-default'
              }`}
              onClick={() => hasChildren && toggleExpand(node.id)}
              aria-label={hasChildren ? 'Toggle children' : 'No children'}
              type="button"
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm">{node.title}</div>
              <div className="flex gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {getCategoryNameById(node.category_id)}
                </span>
                {node.fin_year && (
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    FY {node.fin_year}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 hover:bg-gray-100 rounded text-sm" type="button" onClick={() => handleView(node)} title="View">👁️</button>
              <button className="p-1.5 hover:bg-gray-100 rounded text-sm" type="button" onClick={() => handleAddChild(node)} title="Add Child">➕</button>
              <button className="p-1.5 hover:bg-gray-100 rounded text-sm" type="button" onClick={() => handleEdit(node)} title="Edit">✏️</button>
              <button className="p-1.5 hover:bg-red-100 rounded text-sm text-red-600" type="button" onClick={() => handleDelete(node.id)} title="Delete">🗑️</button>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const toggleReplicateNodeExpand = (id) => {
    setReplicateExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleReplicateNodeSelection = (id, allDescendants = []) => {
    setSelectedKpisToReplicate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Deselect all descendants
        allDescendants.forEach(descId => next.delete(descId));
      } else {
        next.add(id);
        // Also select all descendants
        allDescendants.forEach(descId => next.add(descId));
      }
      return next;
    });
  };

  const getNodeAndDescendants = (node) => {
    const ids = [node.id];
    const collectIds = (n) => {
      if (n.children && n.children.length > 0) {
        n.children.forEach(child => {
          ids.push(child.id);
          collectIds(child);
        });
      }
    };
    collectIds(node);
    return ids;
  };

  const renderReplicateNode = (node, depth = 0) => {
    const isExpanded = replicateExpandedNodes.has(node.id);
    const hasChildren = (node.children || []).length > 0;
    const isSelected = selectedKpisToReplicate.has(node.id);
    const allDescendants = getNodeAndDescendants(node).slice(1);

    return (
      <div key={node.id} className="mb-2" style={{ marginLeft: depth * 16 }}>
        <div className="bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleReplicateNodeSelection(node.id, allDescendants)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            />
            <button
              className={`w-6 h-6 flex items-center justify-center rounded text-sm flex-shrink-0 ${
                hasChildren ? 'text-blue-500 hover:bg-blue-50 cursor-pointer' : 'text-gray-300 cursor-default'
              }`}
              onClick={() => hasChildren && toggleReplicateNodeExpand(node.id)}
              type="button"
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 text-sm">{node.title}</div>
              <div className="flex gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {getCategoryNameById(node.category_id)}
                </span>
              </div>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-2 ml-6">
            {node.children.map((child) => renderReplicateNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleReplicateKmis = async () => {
    if (selectedKpisToReplicate.size === 0) {
      showNotification('Please select at least one KMI to replicate', 'error');
      return;
    }

    try {
      setReplicateLoading(true);

      const idMapping = {};
      const kpiValueMapping = {};
      const newKpiIds = [];

      // Ensure all parent KPIs are included
      const ensureParentsIncluded = (kpiId, kpiList, included = new Set()) => {
        if (included.has(kpiId)) return;
        const kpi = kpiList.find(k => k.id === kpiId);
        if (!kpi) return;
        included.add(kpiId);
        if (kpi.parent_kpi_id) ensureParentsIncluded(kpi.parent_kpi_id, kpiList, included);
      };

      const completeKpiSet = new Set(selectedKpisToReplicate);
      selectedKpisToReplicate.forEach(kpiId => ensureParentsIncluded(kpiId, previousYearKpis, completeKpiSet));

      // Depth calculation
      const calculateDepth = (kpiId, kpiList, memo = {}) => {
        if (memo[kpiId] !== undefined) return memo[kpiId];
        const kpi = kpiList.find(k => k.id === kpiId);
        if (!kpi || !kpi.parent_kpi_id) {
          memo[kpiId] = 0;
          return 0;
        }
        const depth = 1 + calculateDepth(kpi.parent_kpi_id, kpiList, memo);
        memo[kpiId] = depth;
        return depth;
      };

      const depthMemo = {};
      const sortedKpis = previousYearKpis
        .filter(kpi => completeKpiSet.has(kpi.id))
        .map(kpi => ({ ...kpi, depth: calculateDepth(kpi.id, previousYearKpis, depthMemo) }))
        .sort((a, b) => a.depth - b.depth);

      // Pre-fetch KPI values from previous year
      let allPreviousYearKpiValues = [];
      try {
        const allValuesRes = await axios.get('/kpi-values');
        const allValues = allValuesRes.data.data || [];
        const previousYearKpiIds = new Set(previousYearKpis.map(k => k.id));
        allPreviousYearKpiValues = allValues.filter(v => previousYearKpiIds.has(v.kpi_id));
      } catch (err) {
        console.error('Failed to fetch previous year KPI values:', err);
      }

      for (const kpi of sortedKpis) {
        let newParentId = null;
        if (kpi.parent_kpi_id) {
          newParentId = idMapping[kpi.parent_kpi_id];
          if (!newParentId) {
            console.error('Parent mapping missing for', kpi.parent_kpi_id, 'while creating', kpi.id);
            throw new Error('Parent KMI mapping missing');
          }
        }

        const resp = await axios.post('/kpis', {
          title: kpi.title,
          fin_year: selectedYear,
          category_id: kpi.category_id,
          parent_kpi_id: newParentId
        });

        const newKpiId = resp.data.data.id;
        idMapping[kpi.id] = newKpiId;
        newKpiIds.push(newKpiId);

        // Replicate KPI values for this KPI (create without source refs first)
        try {
          const oldValues = allPreviousYearKpiValues.filter(v => v.kpi_id === kpi.id);
          for (const val of oldValues) {
            const payload = {
              data: val.data,
              kpi_id: newKpiId,
              data_operator: val.data_operator || null,
              target_required: val.target_required !== undefined ? val.target_required : true,
              uom: val.uom || null,
              kpi_type: val.kpi_type || 'manual',
              piller_id: val.piller_id || null,
              default_target_value: val.default_target_value || null,
              computation_type: val.computation_type || null,
              formula: val.formula || null,
              source_kpi_value_ids: null,
              target_formula: val.target_formula || null,
              target_source_kpi_value_ids: null
            };

            const newValRes = await axios.post('/kpi-values', payload);
            const newValId = newValRes.data.data.id;
            kpiValueMapping[val.id] = newValId;
          }
        } catch (err) {
          console.error('Failed to replicate KPI values for', kpi.id, err);
        }

        // Replicate department mapping if exists (avoid duplicates)
        if (String(kpi.category_id) === '2') {
          try {
            const deptRes = await axios.get(`/kpi-departments?kpi_id=${kpi.id}`);
            const deptMappings = deptRes.data.data || [];
            for (const mapping of deptMappings) {
              try {
                const checkRes = await axios.get(`/kpi-departments?kpi_id=${newKpiId}&department_id=${mapping.department_id}`);
                const existing = checkRes.data?.data || [];
                if (existing.length > 0) {
                  continue; // already mapped for this new KPI
                }
              } catch (checkErr) {
                console.warn('Failed to check existing kpi-department mapping (proceeding to create):', checkErr);
              }

              try {
                await axios.post('/kpi-departments', { kpi_id: newKpiId, department_id: mapping.department_id });
              } catch (postErr) {
                console.error('Failed to create kpi-department mapping:', postErr);
              }
            }
          } catch (err) {
            console.error('Failed to replicate department mapping:', err);
          }
        }

        // Replicate employee mapping if exists (avoid duplicates)
        if (String(kpi.category_id) === '4') {
          try {
            const empRes = await axios.get(`/kpi-employees?kpi_id=${kpi.id}`);
            const empMappings = empRes.data.data || [];
            for (const mapping of empMappings) {
              try {
                const checkRes = await axios.get(`/kpi-employees?kpi_id=${newKpiId}&emp_id=${mapping.emp_id}`);
                const existing = checkRes.data?.data || [];
                if (existing.length > 0) {
                  continue; // already mapped for this new KPI
                }
              } catch (checkErr) {
                console.warn('Failed to check existing kpi-employee mapping (proceeding to create):', checkErr);
              }

              try {
                await axios.post('/kpi-employees', { kpi_id: newKpiId, emp_id: mapping.emp_id });
              } catch (postErr) {
                console.error('Failed to create kpi-employee mapping:', postErr);
              }
            }
          } catch (err) {
            console.error('Failed to replicate employee mapping:', err);
          }
        }
      }

      // Second pass: update source references in new KPI values
      try {
        const allNewValsRes = await axios.get('/kpi-values');
        const allNewVals = allNewValsRes.data.data || [];

        for (const newKpiId of newKpiIds) {
          const valuesForKpi = allNewVals.filter(v => v.kpi_id === newKpiId);
          for (const kv of valuesForKpi) {
            let needsUpdate = false;
            let updatedSource = kv.source_kpi_value_ids;
            let updatedTargetSource = kv.target_source_kpi_value_ids;

            if (Array.isArray(kv.source_kpi_value_ids)) {
              updatedSource = kv.source_kpi_value_ids.map(old => kpiValueMapping[old] || old);
              if (JSON.stringify(updatedSource) !== JSON.stringify(kv.source_kpi_value_ids)) needsUpdate = true;
            }
            if (Array.isArray(kv.target_source_kpi_value_ids)) {
              updatedTargetSource = kv.target_source_kpi_value_ids.map(old => kpiValueMapping[old] || old);
              if (JSON.stringify(updatedTargetSource) !== JSON.stringify(kv.target_source_kpi_value_ids)) needsUpdate = true;
            }

            if (needsUpdate) {
              await axios.put(`/kpi-values/${kv.id}`, {
                source_kpi_value_ids: updatedSource,
                target_source_kpi_value_ids: updatedTargetSource
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to update formula references:', err);
      }

      // Reload KPIs
      const respAll = await axios.get('/kpis');
      const allKpis = respAll.data.data || [];
      const yearFilteredKpis = allKpis.filter(k => k.fin_year === selectedYear);
      const tree = buildTree(allKpis, selectedYear);
      setKpis(allKpis);
      setKpiTree(tree);
      setError('');

      setShowReplicateModal(false);
      setSearchQuery('');

      const newExpandedSet = new Set();
      newKpiIds.forEach(newId => {
        const hasChildren = yearFilteredKpis.some(k => k.parent_kpi_id === newId);
        if (hasChildren) newExpandedSet.add(newId);
      });
      setExpandedNodes(newExpandedSet);

      showNotification(`✅ Successfully replicated ${selectedKpisToReplicate.size} KMI(s) with KPI values for FY ${selectedYear}!`, 'success');
    } catch (err) {
      const errorMsg = 'Failed to replicate KMIs: ' + (err.response?.data?.error || err.message);
      showNotification(errorMsg, 'error');
      console.error(err);
    } finally {
      setReplicateLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {notification.show && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 min-w-[300px] animate-slide-in ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          <span className="text-xl font-bold">{notification.type === 'success' ? '✓' : '✕'}</span>
          <span className="flex-1 text-sm">{notification.message}</span>
          <button className="text-white text-xl opacity-80 hover:opacity-100 px-1" onClick={() => setNotification({ show: false, message: '', type: '' })}>×</button>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-3xl font-bold text-gray-800">Key Management Indicators (KMIs)</h2>
          <div className="flex gap-3 flex-wrap">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-md font-semibold flex items-center gap-2 transition-colors" onClick={handleAddNew}>
              <span>+</span> Add KMI
            </button>
            <button className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2.5 rounded-md font-semibold flex items-center gap-2 transition-colors" onClick={handleOpenReplicateModal}>
              <span>📋</span> Replicate from Previous Year
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg shadow mb-6">
        <div className="flex gap-6 flex-wrap items-end">
          <div className="flex flex-col gap-2 flex-1 min-w-[250px]">
            <label htmlFor="financial-year" className="text-sm font-semibold text-gray-700">Financial Year:</label>
            <select
              id="financial-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {financialYears.length === 0 ? (
                <option value="">No financial years available</option>
              ) : (
                financialYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-[250px] relative">
            <label htmlFor="search-kmi" className="text-sm font-semibold text-gray-700">Search KMI:</label>
            <input
              id="search-kmi"
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
      </div>

      {error && <div className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-500 text-base">Loading KMIs...</div>
      ) : (
        <div className="bg-white p-5 rounded-lg shadow">
          {kpiTree.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-base">No KPIs found for the selected year</div>
          ) : getFilteredTree().length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-base">No KPIs match your search: <strong>"{searchQuery}"</strong></div>
          ) : (
            getFilteredTree().map((node) => renderNode(node))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">{editingKmi ? 'Edit KMI' : 'Add New KMI'}</h3>
              <button className="text-gray-600 hover:bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-2xl" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Financial Year *</label>
                <select
                  name="fin_year"
                  value={formData.fin_year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Financial Year</option>
                  {financialYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <select
                  name="category_id"
                    value={formData.category_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>{cat.category_name}</option>
                    ))}
                </select>
              </div>
                {(String(formData.category_id) === '2') && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Department * <span className="text-red-500">(Required for Department KPI)</span></label>
                  <select
                    name="department_id"
                    value={formData.department_id || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={String(dept.id)}>{dept.name || dept.department_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(String(formData.category_id) === '4') && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Employee * <span className="text-red-500">(Required for Employee KPI)</span></label>
                  <select
                    name="emp_id"
                    value={formData.emp_id || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>{emp.firstname} {emp.lastname} ({emp.empid})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Parent KPI</label>
                <input
                  type="text"
                  value={formData.parent_kpi_id ? (kpis.find((k) => k.id === Number(formData.parent_kpi_id))?.title || `ID ${formData.parent_kpi_id}`) : 'None (Top-level KMI)'}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">KMI Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter KMI title"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium">
                  {editingKmi ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={() => setShowReplicateModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Replicate KMIs from Previous Year</h3>
              <button className="text-gray-600 hover:bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-2xl" onClick={() => setShowReplicateModal(false)}>×</button>
            </div>
            <div className="p-6">
              {replicateLoading ? (
                <div className="text-center py-10 text-blue-500 text-base">Loading KMIs from {replicateFromYear}...</div>
              ) : (
                <>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
                    <p className="text-sm text-gray-700 mb-2">Select KMIs from <strong>{replicateFromYear}</strong> to replicate into <strong>{selectedYear}</strong></p>
                    <p className="text-sm text-blue-700">✓ Selecting a parent KMI will automatically select all its child KMIs</p>
                    <p className="text-sm text-blue-700">✓ Only KMI structure will be copied (no data points)</p>
                    <p className="text-sm text-blue-700">✓ Department and Employee mappings will be replicated as well</p>
                  </div>
                  
                  {previousYearTree.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-base">No KMIs available in {replicateFromYear}</div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                      {previousYearTree.map((node) => renderReplicateNode(node))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-between items-center p-6 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700">
                {selectedKpisToReplicate.size > 0 && (
                  <span>{selectedKpisToReplicate.size} KMI(s) selected</span>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" 
                  onClick={() => setShowReplicateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleReplicateKmis}
                  disabled={selectedKpisToReplicate.size === 0 || replicateLoading}
                >
                  Replicate Selected KMIs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KmisPage;
