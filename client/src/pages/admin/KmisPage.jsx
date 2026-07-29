import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Notification from '../../components/common/Notification';

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
  const location = useLocation();
  const fromKmisState = location.state?.fromKmisState;
  const { user, loading: authLoading } = useAuth();
  const normalizedRole = (user?.role?.name || user?.role || '').toString().trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  
  // State declarations MUST come before any conditional returns
  const [kpis, setKpis] = useState([]);
  const [kpiTree, setKpiTree] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(() => {
    return fromKmisState?.selectedYear || getInitialYear();
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingKmi, setEditingKmi] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    fin_year: '',
    // allow selecting multiple categories in the Add/Edit form
    category_ids: [],
    parent_kpi_id: null,
    department_id: '',
    emp_id: ''
  });
  const [expandedNodes, setExpandedNodes] = useState(() => {
    return fromKmisState?.expandedNodes ? new Set(fromKmisState.expandedNodes) : new Set();
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [searchQuery, setSearchQuery] = useState(() => {
    return fromKmisState?.searchQuery || '';
  });
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [replicateFromYear, setReplicateFromYear] = useState('');
  const [previousYearKpis, setPreviousYearKpis] = useState([]);
  const [previousYearTree, setPreviousYearTree] = useState([]);
  const [selectedKpisToReplicate, setSelectedKpisToReplicate] = useState(new Set());
  const [replicateLoading, setReplicateLoading] = useState(false);
  const [replicateExpandedNodes, setReplicateExpandedNodes] = useState(new Set());

  const isInitialLoad = useRef(true);
  const lastYearRef = useRef(fromKmisState?.selectedYear || getInitialYear());
  
  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/unauthorized', { replace: true });
    }
  }, [user, authLoading, isAdmin, navigate]);
  
  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
          <p className="text-[color:var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect if not admin
  if (!user || !isAdmin) {
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
        const depts = (departmentsRes.data.data || []).sort((a, b) => (a.name || a.department_name || '').localeCompare(b.name || b.department_name || ''));
        setDepartments(depts);
        const emps = (usersRes.data.data || []).sort((a, b) => `${a.firstname||''} ${a.lastname||''}`.localeCompare(`${b.firstname||''} ${b.lastname||''}`));
        setEmployees(emps);
      } catch (err) {
        console.error('Failed to load categories, departments, or employees', err);
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
      // initialize category_ids to include the default if none selected
      category_ids: (prev.category_ids && prev.category_ids.length > 0) ? prev.category_ids : [defaultId],
    }));
  }, [categories]);

  const buildTree = (list, year) => {
    const filtered = year ? list.filter((kpi) => kpi.fin_year === year) : list;
    const map = new Map();
    filtered.forEach((kpi) => {
      // ensure category_ids exists for UI display (may include department/employee inferred categories)
      const baseCat = kpi.category_id != null ? String(kpi.category_id) : '';
      const catIds = Array.isArray(kpi.category_ids) && kpi.category_ids.length > 0 ? kpi.category_ids : (baseCat ? [baseCat] : []);
      map.set(kpi.id, { ...kpi, category_ids: catIds, children: [] });
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
      let kpiValues = [];
      try {
        const valuesRes = await axios.get('/kpi-values');
        kpiValues = valuesRes.data.data || [];
      } catch (err) {
        console.debug('Failed to fetch KPI values for hierarchy metadata', err);
      }
      // fetch department and employee mappings to infer additional categories
      let deptMappings = [];
      let empMappings = [];
      try {
        const [deptRes, empRes] = await Promise.all([
          axios.get('/kpi-departments'),
          axios.get('/kpi-employees')
        ]);
        deptMappings = deptRes.data.data || [];
        empMappings = empRes.data.data || [];
      } catch (err) {
        // non-fatal - mappings may not exist or could fail; continue
        console.debug('Failed to fetch kpi-department/employee mappings', err);
      }
      const deptSet = new Set(deptMappings.map(m => m.kpi_id));
      const empSet = new Set(empMappings.map(m => m.kpi_id));
      const valueByKpiId = new Map();
      kpiValues.forEach((value) => {
        if (!valueByKpiId.has(value.kpi_id)) {
          valueByKpiId.set(value.kpi_id, value);
        }
      });

      // Attach inferred category_ids to each kpi for UI rendering
      const enriched = data.map(k => {
        const kpiValue = valueByKpiId.get(k.id) || {};
        const ids = [];
        if (k.category_id != null) ids.push(String(k.category_id));
        if (deptSet.has(k.id) && !ids.includes('2')) ids.push('2');
        if (empSet.has(k.id) && !ids.includes('4')) ids.push('4');
        return {
          ...k,
          category_ids: ids,
          kpi_type: kpiValue.kpi_type || k.kpi_type || 'manual',
          data_operator: kpiValue.data_operator ?? k.data_operator ?? null
        };
      });
      const tree = buildTree(enriched, year);
      setKpis(data);
      setKpiTree(tree);
      
      // Only reset expanded nodes if the year actually changed,
      // AND we are not on the initial load restoring state.
      if (lastYearRef.current !== year) {
        setExpandedNodes(new Set());
        lastYearRef.current = year;
      }
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
      
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

  // Helper function to get employees for a specific department
  const getEmployeesForDepartment = (deptId) => {
    if (!deptId) return employees;
    const deptIdNum = Number(deptId);
    return employees.filter(emp => emp.department_id === deptIdNum);
  };

  // Helper function to get KPI title by ID
  const getKPITitleById = (id) => {
    if (!id) return 'None (Top-level KMI)';
    const kpi = kpis.find((k) => k.id === Number(id));
    return kpi?.title || `ID ${id}`;
  };

  const getOperatorName = (operatorId) => {
    if (!operatorId) return 'N/A';
    const user = employees.find((emp) => String(emp.empid ?? emp.id) === String(operatorId));
    if (!user) return String(operatorId);
    return `${user.firstname || ''} ${user.lastname || ''}`.trim() || String(operatorId);
  };

  // State to store parent KPI title when editing
  const [parentKPITitle, setParentKPITitle] = useState('None (Top-level KMI)');

  // Effect to fetch parent KPI title when form is opened with a parent
  useEffect(() => {
    const fetchParentKPITitle = async () => {
      if (!formData.parent_kpi_id) {
        setParentKPITitle('None (Top-level KMI)');
        return;
      }

      // First, try to find in kpis array
      const foundKpi = kpis.find((k) => k.id === Number(formData.parent_kpi_id));
      if (foundKpi) {
        setParentKPITitle(foundKpi.title);
        return;
      }

      // If not found, fetch directly
      try {
        const response = await axios.get(`/kpis/${formData.parent_kpi_id}`);
        const kpi = response.data.data || null;
        setParentKPITitle(kpi?.title || `ID ${formData.parent_kpi_id}`);
      } catch (err) {
        console.debug('Failed to fetch parent KPI:', err);
        setParentKPITitle(`ID ${formData.parent_kpi_id}`);
      }
    };

    fetchParentKPITitle();
  }, [formData.parent_kpi_id, kpis]);

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
      // default to global objectives category in the array
      category_ids: [getDefaultCategoryId(categories)], // This will be "KMI / GLOBAL OBJECTIVES" category
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
      let kpiValues = [];
      try {
        const valuesRes = await axios.get('/kpi-values');
        kpiValues = valuesRes.data.data || [];
      } catch (err) {
        console.debug('Failed to fetch KPI values for previous year hierarchy metadata', err);
      }
      // fetch mappings for previous year KPIs as well so we can show multiple categories
      let deptMappings = [];
      let empMappings = [];
      try {
        const [deptRes, empRes] = await Promise.all([
          axios.get('/kpi-departments'),
          axios.get('/kpi-employees')
        ]);
        deptMappings = deptRes.data.data || [];
        empMappings = empRes.data.data || [];
      } catch (err) {
        console.debug('Failed to fetch previous year kpi mappings', err);
      }
      const deptSet = new Set(deptMappings.map(m => m.kpi_id));
      const empSet = new Set(empMappings.map(m => m.kpi_id));
      const valueByKpiId = new Map();
      kpiValues.forEach((value) => {
        if (!valueByKpiId.has(value.kpi_id)) {
          valueByKpiId.set(value.kpi_id, value);
        }
      });
      const enriched = filtered.map(k => {
        const kpiValue = valueByKpiId.get(k.id) || {};
        const ids = [];
        if (k.category_id != null) ids.push(String(k.category_id));
        if (deptSet.has(k.id) && !ids.includes('2')) ids.push('2');
        if (empSet.has(k.id) && !ids.includes('4')) ids.push('4');
        return {
          ...k,
          category_ids: ids,
          kpi_type: kpiValue.kpi_type || k.kpi_type || 'manual',
          data_operator: kpiValue.data_operator ?? k.data_operator ?? null
        };
      });
      const tree = buildTree(enriched, year);
      setPreviousYearKpis(enriched);
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
    let hasDepartmentMapping = false;
    try {
      const resp = await axios.get(`/kpi-departments?kpi_id=${kmi.id}`);
      const mappings = resp.data?.data || [];
      if (mappings.length > 0) {
        deptId = mappings[0].department_id != null ? String(mappings[0].department_id) : '';
        hasDepartmentMapping = true;
      }
    } catch (err) {
      console.debug('No KPI-Department mapping found or failed to fetch', err?.response?.data || err);
    }

    // Try to load existing employee mapping for this KPI (if any)
    let empId = '';
    let hasEmployeeMapping = false;
    try {
      const resp2 = await axios.get(`/kpi-employees?kpi_id=${kmi.id}`);
      const mappings2 = resp2.data?.data || [];
      if (mappings2.length > 0) {
        empId = mappings2[0].emp_id != null ? String(mappings2[0].emp_id) : '';
        hasEmployeeMapping = true;
      }
    } catch (err) {
      console.debug('No KPI-Employee mapping found or failed to fetch', err?.response?.data || err);
    }

    // Build category_ids based on primary category and existing mappings
    const categoryIds = [];
    if (kmi.category_id != null) {
      categoryIds.push(String(kmi.category_id));
    }
    if (hasDepartmentMapping && !categoryIds.includes('2')) {
      categoryIds.push('2');
    }
    if (hasEmployeeMapping && !categoryIds.includes('4')) {
      categoryIds.push('4');
    }

    setFormData({
      title: kmi.title || '',
      fin_year: kmi.fin_year || selectedYear,
      category_ids: categoryIds.length > 0 ? categoryIds : [getDefaultCategoryId(categories)],
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
      category_ids: [getNextCategoryId(parent.category_id)],
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
    navigate(`/admin/kmis/${kmi.id}`, {
      state: {
        kmi,
        fromKmisState: {
          selectedYear,
          expandedNodes: Array.from(expandedNodes),
          searchQuery
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let kpiId;

      // Support multiple selected categories in the form; pick the first as primary for backend compatibility
      const selectedCategoryIds = formData.category_ids || [];
      const primaryCategoryId = selectedCategoryIds[0] || getDefaultCategoryId(categories);

      if (editingKmi) {
        await axios.put(`/kpis/${editingKmi.id}`, {
          title: formData.title,
          fin_year: formData.fin_year,
          category_id: Number(primaryCategoryId),
          parent_kpi_id: formData.parent_kpi_id ? Number(formData.parent_kpi_id) : null
        });
        kpiId = editingKmi.id;
        showNotification('KPI updated successfully!', 'success');
      } else {
        const response = await axios.post('/kpis', {
          title: formData.title,
          fin_year: formData.fin_year,
          category_id: Number(primaryCategoryId),
          parent_kpi_id: formData.parent_kpi_id ? Number(formData.parent_kpi_id) : null
        });
        kpiId = response.data.data.id;
        showNotification('KMI created successfully!', 'success');
      }

      // Save KPI-Department mapping if Department KPI category is selected (category_id = 2)
      if ((formData.category_ids || []).includes('2') || String(primaryCategoryId) === '2') {
        if (formData.department_id) {
          try {
            // check if mapping already exists to avoid duplicate error
            const checkRes = await axios.get(`/kpi-departments?kpi_id=${kpiId}&department_id=${formData.department_id}`);
            const existing = checkRes.data?.data || [];
            if (existing.length === 0) {
              await axios.post('/kpi-departments', {
                kpi_id: kpiId,
                department_id: Number(formData.department_id)
              });
            } else {
              console.debug('KPI-Department mapping already exists, skipping creation');
            }
          } catch (err) {
            // if server explicitly says mapping exists, ignore; otherwise report
            const serverMsg = err?.response?.data?.message || err?.message || '';
            if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('mapping already exists')) {
              console.debug('KPI-Department mapping exists (server):', serverMsg);
            } else {
              console.error('Failed to save KPI-Department mapping:', err?.response?.data || err);
              const msg = serverMsg || 'Unknown error';
              showNotification(`KPI saved but failed to map department: ${msg}`, 'error');
            }
          }
        } else {
          showNotification('Please select a department for Department KPI', 'error');
          return;
        }
      }

      // Save KPI-Employee mapping if Employee KPI category is selected (category_id = 4)
      if ((formData.category_ids || []).includes('4') || String(primaryCategoryId) === '4') {
        if (formData.emp_id) {
          try {
            // check if mapping already exists to avoid duplicate error
            const checkRes = await axios.get(`/kpi-employees?kpi_id=${kpiId}&emp_id=${formData.emp_id}`);
            const existing = checkRes.data?.data || [];
            if (existing.length === 0) {
              await axios.post('/kpi-employees', {
                kpi_id: kpiId,
                emp_id: Number(formData.emp_id)
              });
            } else {
              console.debug('KPI-Employee mapping already exists, skipping creation');
            }
          } catch (err) {
            const serverMsg = err?.response?.data?.message || err?.message || '';
            if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('mapping already exists')) {
              console.debug('KPI-Employee mapping exists (server):', serverMsg);
            } else {
              console.error('Failed to save KPI-Employee mapping:', err?.response?.data || err);
              const msg = serverMsg || 'Unknown error';
              showNotification(`KPI saved but failed to map employee: ${msg}`, 'error');
            }
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
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear employee selection when department changes (to ensure only department employees are selected)
      if (name === 'department_id') {
        updated.emp_id = '';
      }
      return updated;
    });
  };

  const handleCategoryToggle = (catId) => {
    setFormData((prev) => {
      const prevArr = prev.category_ids || [];
      const next = new Set(prevArr);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return { ...prev, category_ids: Array.from(next) };
    });
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

  const collectAllNodeIds = (nodes) => {
    const ids = new Set();
    const collect = (node) => {
      ids.add(node.id);
      (node.children || []).forEach(collect);
    };
    (nodes || []).forEach(collect);
    return ids;
  };

  const handleExpandAll = () => {
    const visibleTree = getFilteredTree();
    setExpandedNodes(collectAllNodeIds(visibleTree));
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
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
    const kpiType = (node.kpi_type || '').toString().trim().toLowerCase();
    const isComputed = kpiType === 'computed';
    const isManual = !kpiType || kpiType === 'manual';
    const hasType = Boolean(kpiType);
    const operatorId = node.data_operator ?? node['data operator'] ?? null;
    const hasOperator = Boolean(operatorId);
    const isMetadataMissing = !hasType || (isManual && !hasOperator);
    return (
      <div key={node.id} className="mb-2" style={{ marginLeft: depth * 16 }}>
        <div className={`rounded-lg border p-3 transition-shadow hover:shadow-md ${isMetadataMissing ? 'border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]' : 'border-[color:var(--border)] bg-[color:var(--surface)]'}`}>
          <div className="flex items-center gap-2">
            <button
              className={`flex h-6 w-6 items-center justify-center rounded text-sm ${
                hasChildren ? 'cursor-pointer text-[color:var(--accent)] hover:bg-[color:var(--surface-hover)]' : 'cursor-default text-[color:var(--text-muted)]'
              }`}
              onClick={() => hasChildren && toggleExpand(node.id)}
              aria-label={hasChildren ? 'Toggle children' : 'No children'}
              type="button"
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium text-[color:var(--text-primary)]">{node.title}</div>
              <div className="flex gap-2 mt-1">
                {(node.category_ids || [node.category_id]).map((cid) => (
                  <span key={cid} className="inline-block rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent)]">
                    {getCategoryNameById(cid)}
                  </span>
                ))}
                {node.fin_year && (
                  <span className="inline-block rounded bg-[color:var(--surface-hover)] px-2 py-0.5 text-xs text-[color:var(--text-secondary)]">
                    FY {node.fin_year}
                  </span>
                )}
                {hasType ? (
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${isComputed ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' : 'bg-[color:var(--warning-soft,rgba(245,158,11,0.14))] text-[color:var(--warning,#d97706)]'}`}>
                    {isComputed ? 'Computed' : 'Manual'}
                  </span>
                ) : (
                  <span className="inline-block rounded bg-[color:var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--danger)]">
                    Type Missing
                  </span>
                )}
                {isManual && hasOperator ? (
                  <span className="inline-block rounded bg-[color:var(--surface-hover)] px-2 py-0.5 text-xs text-[color:var(--text-secondary)]">
                    Data Operator: {getOperatorName(operatorId)}
                  </span>
                ) : isManual ? (
                  <span className="inline-block rounded bg-[color:var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--danger)]">
                   Data Operator Missing
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-1">
              <button className="rounded p-1.5 text-sm hover:bg-[color:var(--surface-hover)]" type="button" onClick={() => handleView(node)} title="View">👁️</button>
              <button className="rounded p-1.5 text-sm hover:bg-[color:var(--surface-hover)]" type="button" onClick={() => handleAddChild(node)} title="Add Child">➕</button>
              <button className="rounded p-1.5 text-sm hover:bg-[color:var(--surface-hover)]" type="button" onClick={() => handleEdit(node)} title="Edit">✏️</button>
              <button className="rounded p-1.5 text-sm text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]" type="button" onClick={() => handleDelete(node.id)} title="Delete">🗑️</button>
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
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 transition-colors hover:bg-[color:var(--surface-hover)]">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleReplicateNodeSelection(node.id, allDescendants)}
              className="h-4 w-4 flex-shrink-0 rounded border-[color:var(--border)] text-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            />
            <button
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-sm ${
                hasChildren ? 'cursor-pointer text-[color:var(--accent)] hover:bg-[color:var(--surface-hover)]' : 'cursor-default text-[color:var(--text-muted)]'
              }`}
              onClick={() => hasChildren && toggleReplicateNodeExpand(node.id)}
              type="button"
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[color:var(--text-primary)]">{node.title}</div>
              <div className="flex gap-2 mt-1">
                {(node.category_ids || [node.category_id]).map((cid) => (
                  <span key={cid} className="inline-block rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent)]">
                    {getCategoryNameById(cid)}
                  </span>
                ))}
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
    <div className="w-full max-w-7xl mx-auto bg-[color:var(--app-bg)] px-6 py-6 text-[color:var(--text-primary)]">
      <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />

      <div className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-3xl font-bold text-[color:var(--text-primary)]">Key Management Indicators (KMIs)</h2>
          <div className="flex gap-3 flex-wrap">
            <button className="flex items-center gap-2 rounded-md bg-[color:var(--accent)] px-5 py-2.5 font-semibold text-white transition-colors hover:opacity-90" onClick={handleAddNew}>
              <span>+</span> Add KMI
            </button>
            <button className="flex items-center gap-2 rounded-md bg-[color:var(--surface-hover)] px-5 py-2.5 font-semibold text-[color:var(--text-primary)] transition-colors hover:opacity-90" onClick={handleOpenReplicateModal}>
              <span>📋</span> Replicate from Previous Year
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow">
        <div className="flex gap-6 flex-wrap items-end">
          <div className="flex flex-col gap-2 flex-1 min-w-[250px]">
            <label htmlFor="financial-year" className="text-sm font-semibold text-[color:var(--text-secondary)]">Financial Year:</label>
            <select
              id="financial-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
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
            <label htmlFor="search-kmi" className="text-sm font-semibold text-[color:var(--text-secondary)]">Search KMI:</label>
            <input
              id="search-kmi"
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            />
            {searchQuery && (
              <button
                className="absolute bottom-2.5 right-3 flex h-6 w-6 items-center justify-center rounded-full text-xl text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)]"
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

      {error && <div className="mb-4 rounded-md bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-base text-[color:var(--text-secondary)]">Loading KMIs...</div>
      ) : (
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow">
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-1.5 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:opacity-90"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--surface-hover)]"
            >
              Collapse All
            </button>
          </div>
          {kpiTree.length === 0 ? (
            <div className="py-10 text-center text-base text-[color:var(--text-secondary)]">No KPIs found for the selected year</div>
          ) : getFilteredTree().length === 0 ? (
            <div className="py-10 text-center text-base text-[color:var(--text-secondary)]">No KPIs match your search: <strong>"{searchQuery}"</strong></div>
          ) : (
            getFilteredTree().map((node) => renderNode(node))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[color:var(--border)] p-6">
              <h3 className="text-xl font-bold text-[color:var(--text-primary)]">{editingKmi ? 'Edit KMI' : 'Add New KMI'}</h3>
              <button className="flex h-8 w-8 items-center justify-center rounded text-2xl text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">Financial Year *</label>
                <select
                  name="fin_year"
                  value={formData.fin_year}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
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
                <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">Category *</label>
                <div className="grid gap-2">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(formData.category_ids || []).includes(String(cat.id))}
                        onChange={() => handleCategoryToggle(String(cat.id))}
                        className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                      />
                      <span className="text-sm text-[color:var(--text-secondary)]">{cat.category_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(formData.category_ids || []).includes('2') && (
                <div className="mb-5">
                  <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">Department * <span className="text-red-500">(Required for Department KPI)</span></label>
                  <select
                    name="department_id"
                    value={formData.department_id || ''}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={String(dept.id)}>{dept.name || dept.department_name}</option>
                    ))}
                  </select>
                </div> 
              )}

              {(formData.category_ids || []).includes('4') && (
                <div className="mb-5">
                  <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">Employee * <span className="text-red-500">(Required for Employee KPI)</span></label>
                  {(formData.category_ids || []).includes('2') && formData.department_id && (
                    <p className="mb-2 text-xs text-[color:var(--accent)]">Showing employees from selected department only</p>
                  )}
                  <select
                    name="emp_id"
                    value={formData.emp_id || ''}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                  >
                    <option value="">Select Employee</option>
                    {((formData.category_ids || []).includes('2') && formData.department_id
                      ? getEmployeesForDepartment(formData.department_id)
                      : employees
                    ).map((emp) => (
                      <option key={emp.id} value={String(emp.empid)}>{emp.firstname} {emp.lastname} ({emp.empid})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">Parent KPI</label>
                <input
                  type="text"
                  value={parentKPITitle}
                  readOnly
                  className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)]"
                />
              </div>
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-[color:var(--text-secondary)]">KPI Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter KMI title"
                  className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
                  {editingKmi ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm" onClick={() => setShowReplicateModal(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[color:var(--border)] p-6">
              <h3 className="text-xl font-bold text-[color:var(--text-primary)]">Replicate KMIs from Previous Year</h3>
              <button className="flex h-8 w-8 items-center justify-center rounded text-2xl text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]" onClick={() => setShowReplicateModal(false)}>×</button>
            </div>
            <div className="p-6">
              {replicateLoading ? (
                <div className="py-10 text-center text-base text-[color:var(--accent)]">Loading KMIs from {replicateFromYear}...</div>
              ) : (
                <>
                  <div className="mb-6 rounded border-l-4 border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-4">
                    <p className="mb-2 text-sm text-[color:var(--text-secondary)]">Select KMIs from <strong>{replicateFromYear}</strong> to replicate into <strong>{selectedYear}</strong></p>
                    <p className="text-sm text-[color:var(--accent)]">✓ Selecting a parent KMI will automatically select all its child KMIs</p>
                    <p className="text-sm text-[color:var(--accent)]">✓ Only KMI structure will be copied (no data points)</p>
                    <p className="text-sm text-[color:var(--accent)]">✓ Department and Employee mappings will be replicated as well</p>
                  </div>
                  
                  {previousYearTree.length === 0 ? (
                    <div className="py-10 text-center text-base text-[color:var(--text-secondary)]">No KMIs available in {replicateFromYear}</div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-4">
                      {previousYearTree.map((node) => renderReplicateNode(node))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[color:var(--border)] p-6">
              <div className="text-sm font-medium text-[color:var(--text-secondary)]">
                {selectedKpisToReplicate.size > 0 && (
                  <span>{selectedKpisToReplicate.size} KMI(s) selected</span>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  className="rounded-md border border-[color:var(--border)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]" 
                  onClick={() => setShowReplicateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="rounded-md bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
