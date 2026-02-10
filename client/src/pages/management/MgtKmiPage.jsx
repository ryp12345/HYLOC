
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKPIs } from '../../api/kpiApi';
import axios from '../../api/axios';

const getInitialYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const endYear = fyStartYear + 1;
  return `${fyStartYear}-${endYear.toString().slice(-2)}`;
};
export default function MgtKmiPage() {
  const [kpis, setKpis] = useState([]);
  const [categories, setCategories] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(getInitialYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const { years } = generateFinancialYears();
    setFinancialYears(years);
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await axios.get('/categories');
        setCategories(res.data.data || []);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadKpis = async () => {
      setLoading(true);
      try {
        const res = await getKPIs();
        setKpis(res.data.data || []);
        setError('');
      } catch {
        setKpis([]);
        setError('Failed to load KMIs');
      } finally {
        setLoading(false);
      }
    };
    loadKpis();
  }, [selectedYear]);

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
    const globalObjectivesCategoryId = categories.find((c) => c.category_name === 'KMI / GLOBAL OBJECTIVES')?.id;
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

  const kmiTree = useMemo(() => buildTree(kpis, selectedYear), [kpis, categories, selectedYear]);

  const getCategoryNameById = (id) => categories.find((c) => String(c.id) === String(id))?.category_name || 'Category';

  const isNodeMatching = (node) => {
    if (node.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return true;
    }
    if (node.children && node.children.length > 0) {
      return node.children.some(child => isNodeMatching(child));
    }
    return false;
  };

  const getFilteredTree = () => {
    if (!searchQuery.trim()) {
      return kmiTree;
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
    return kmiTree
      .map(node => filterNode(node))
      .filter(node => node !== null);
  };

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
  }, [searchQuery, kmiTree]);

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

  const renderNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children || []).length > 0;
    return (
      <div key={node.id} className="mb-2" style={{ marginLeft: depth * 16 }}>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
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
            <button
              className="p-1.5 hover:bg-gray-100 rounded text-sm"
              type="button"
              title="View"
              onClick={() => navigate(`/management/kmis/${node.id}`, { state: { kmi: node } })}
            >
              👁️
            </button>
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

  function generateFinancialYears() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const currentFinYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;
    const years = [];
    for (let i = 2; i >= 1; i--) {
      const start = fyStartYear - i;
      const end = start + 1;
      years.push(`${start}-${end.toString().slice(-2)}`);
    }
    years.push(currentFinYear);
    const nextStart = fyStartYear + 1;
    const nextEnd = nextStart + 1;
    years.push(`${nextStart}-${nextEnd.toString().slice(-2)}`);
    return { years, currentFinYear };
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-3xl font-bold text-gray-800">Key Management Indicators (KMIs)</h2>
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
          {kmiTree.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-base">No KPIs found for the selected year</div>
          ) : getFilteredTree().length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-base">No KPIs match your search: <strong>"{searchQuery}"</strong></div>
          ) : (
            getFilteredTree().map((node) => renderNode(node))
          )}
        </div>
      )}
    </div>
  );
}
