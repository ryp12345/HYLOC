import { useCallback, useEffect, useMemo, useState } from 'react';
import { getKPIDataAudit, getKPIs } from '../../api/kpiApi';

// Fiscal year runs April to March; fy is the calendar year it starts in
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getCurrentFiscalYear = () => {
  const today = new Date();
  return today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
};

const getMonthColumns = (fy) =>
  FISCAL_MONTHS.map((month) => {
    const year = month >= 4 ? fy : fy + 1;
    return { key: `m_${year}_${month}`, month, year, label: `${MONTH_NAMES[month - 1]}-${String(year).slice(-2)}` };
  });

//Categories are Plant/Department/Pillar/Employee KPI, KAI and KMI / Global Objectives
const toKpiGroup = (categoryName) => {
  const name = (categoryName || '').toUpperCase();
  if (name.includes('KMI')) return 'KMI';
  if (name.includes('KAI')) return 'KAI';
  if (name.includes('PLANT')) return 'KPI (Plant KPI)';
  if (name.includes('PILLAR') || name.includes('PILLER')) return 'KPI (Pillar KPI)';
  if (name.includes('DEPARTMENT')) return 'KPI (Department KPI)';
  return categoryName ? `KPI (${categoryName})` : 'KPI';
};

const BLANK = '(Blank)';

const TEXT_COLUMNS = [
  { key: 'description', label: 'KPI Description', filter: 'text' },
  { key: 'group', label: 'KPI Group', filter: 'select' },
  { key: 'dataType', label: 'Data', filter: 'select' },
  { key: 'user', label: 'User', filter: 'select' },
  { key: 'department', label: 'Department', filter: 'select' },
  { key: 'pillar', label: 'Pillar', filter: 'select' },
  { key: 'uom', label: 'UOM', filter: 'select' },
];

const MONTH_FILTERS = [
  { value: '', label: 'All' },
  { value: 'has', label: 'Has value' },
  { value: 'missing', label: 'Missing' },
  { value: 'zero', label: 'Zero' },
  { value: 'nonzero', label: 'Non-zero' },
];

const VIEW_OPTIONS = [
  { value: 'actual', label: 'Actual' },
  { value: 'target', label: 'Target' },
  { value: 'both', label: 'Actual + Target' },
];

const formatValue = (value) =>
  value === null || value === undefined
    ? ''
    : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const toRow = (item, monthColumns) => {
  const byPeriod = {};
  (item.monthly_values || []).forEach((entry) => {
    byPeriod[`m_${entry.year}_${entry.month}`] = {
      ...byPeriod[`m_${entry.year}_${entry.month}`],
      [entry.value_type]: entry.value,
    };
  });

  const months = {};
  monthColumns.forEach(({ key }) => {
    months[key] = { actual: byPeriod[key]?.actual ?? null, target: byPeriod[key]?.target ?? null };
  });

  return {
    id: item.id,
    description: item.description || '',
    kpiTitle: item.kpi_title || '',
    // Start year of the fiscal year the KPI is defined for ("2025-26" -> 2025)
    finYearStart: Number.parseInt(String(item.fin_year || '').match(/\d{4}/)?.[0], 10),
    category: item.category_name || '',
    group: toKpiGroup(item.category_name),
    dataType: (item.kpi_type || '').toLowerCase() === 'computed' ? 'Computed' : 'Manual',
    formula: item.formula || '',
    user: item.user_name || (item.data_operator ? String(item.data_operator) : ''),
    empId: item.data_operator,
    department: item.department || '',
    pillar: item.piller_short_name || item.piller_name || '',
    pillarName: item.piller_name || '',
    uom: item.unit_symbol || item.unit_name || '',
    months,
  };
};

const matchesMonthFilter = (value, filter) => {
  switch (filter) {
    case 'has': return value !== null;
    case 'missing': return value === null;
    case 'zero': return value !== null && Number(value) === 0;
    case 'nonzero': return value !== null && Number(value) !== 0;
    default: return true;
  }
};

const compareValues = (a, b) => {
  // Blank values always sort last, whatever the direction
  const aBlank = a === null || a === undefined || a === '';
  const bBlank = b === null || b === undefined || b === '';
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const inputClass =
  'w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs font-normal normal-case text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--focus-ring)]';

const KpiDataAudit = () => {
  const currentFiscalYear = getCurrentFiscalYear();
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear);
  const [view, setView] = useState('actual');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ key: null, direction: 'asc' });

  const monthColumns = useMemo(() => getMonthColumns(fiscalYear), [fiscalYear]);

  // Same fiscal years as the dashboard: the ones KPIs are defined for (fin_year such as "2026-27")
  const [fiscalYearOptions, setFiscalYearOptions] = useState([currentFiscalYear]);

  useEffect(() => {
    const loadFiscalYears = async () => {
      try {
        const response = await getKPIs();
        const kpis = Array.isArray(response?.data?.data) ? response.data.data : [];
        const years = [...new Set(
          kpis
            .map((kpi) => Number.parseInt(String(kpi.fin_year || '').match(/\d{4}/)?.[0], 10))
            .filter((year) => Number.isInteger(year))
        )].sort((a, b) => a - b);
        if (!years.length) return;
        setFiscalYearOptions(years);
        // Like the dashboard, move to the closest defined fiscal year when the current one has no KPIs
        setFiscalYear((selected) =>
          years.includes(selected)
            ? selected
            : years.reduce((closest, year) => (Math.abs(year - selected) < Math.abs(closest - selected) ? year : closest))
        );
      } catch (loadError) {
        console.error('Failed to load fiscal years:', loadError);
      }
    };
    loadFiscalYears();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getKPIDataAudit(fiscalYear);
      setItems(response?.data?.data || []);
    } catch (loadError) {
      console.error('Failed to load KPI data audit:', loadError);
      setItems([]);
      setError(loadError?.response?.data?.message || 'Failed to load KPI data.');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Month keys depend on the fiscal year, so month filters and month sorting are reset with it
  useEffect(() => {
    setFilters((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith('m_'))));
    setSort((prev) => (prev.key?.startsWith('m_') ? { key: null, direction: 'asc' } : prev));
  }, [fiscalYear]);

  const allRows = useMemo(() => items.map((item) => toRow(item, monthColumns)), [items, monthColumns]);

  const rows = useMemo(
    // Only KPIs defined for the selected fiscal year, as on the employee KPI page
    // (KPIs without a fiscal year are kept)
    () => allRows.filter((row) => Number.isNaN(row.finYearStart) || row.finYearStart === fiscalYear),
    [allRows, fiscalYear]
  );

  // Month filters and month sorting use the target when viewing targets, otherwise the actual
  const primaryType = view === 'target' ? 'target' : 'actual';

  const selectOptions = useMemo(() => {
    const options = {};
    TEXT_COLUMNS.filter((column) => column.filter === 'select').forEach(({ key }) => {
      const values = new Set(rows.map((row) => row[key] || BLANK));
      options[key] = [...values].sort((a, b) => (a === BLANK ? 1 : b === BLANK ? -1 : compareValues(a, b)));
    });
    return options;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, value]) => value);

    const filtered = rows.filter((row) =>
      activeFilters.every(([key, value]) => {
        if (key.startsWith('m_')) return matchesMonthFilter(row.months[key]?.[primaryType] ?? null, value);
        const column = TEXT_COLUMNS.find((c) => c.key === key);
        if (column?.filter === 'text') return row[key].toLowerCase().includes(value.trim().toLowerCase());
        return (row[key] || BLANK) === value;
      })
    );

    if (!sort.key) return filtered;
    const getSortValue = (row) =>
      sort.key.startsWith('m_') ? row.months[sort.key]?.[primaryType] ?? null : row[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const aBlank = aValue === null || aValue === '';
      const bBlank = bValue === null || bValue === '';
      if (aBlank || bBlank) return compareValues(aValue, bValue);
      return sign * compareValues(aValue, bValue);
    });
  }, [rows, filters, sort, primaryType]);

  const summary = useMemo(() => {
    const withData = visibleRows.filter((row) =>
      monthColumns.some(({ key }) => row.months[key].actual !== null || row.months[key].target !== null)
    ).length;
    return { total: visibleRows.length, withData, withoutData: visibleRows.length - withData };
  }, [visibleRows, monthColumns]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleSort = (key) =>
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });

  const sortIndicator = (key) => (sort.key !== key ? '↕' : sort.direction === 'asc' ? '▲' : '▼');

  const exportCsv = () => {
    const monthHeaders = monthColumns.flatMap(({ label }) =>
      view === 'both' ? [`${label} Actual`, `${label} Target`] : [label]
    );
    const header = [...TEXT_COLUMNS.map((c) => c.label), 'Formula', ...monthHeaders];
    const lines = visibleRows.map((row) => [
      ...TEXT_COLUMNS.map((c) => row[c.key]),
      row.formula,
      ...monthColumns.flatMap(({ key }) =>
        view === 'both' ? [row.months[key].actual, row.months[key].target] : [row.months[key][view]]
      ),
    ]);
    const csv = [header, ...lines].map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kpi-data-audit-FY${fiscalYear}-${String(fiscalYear + 1).slice(-2)}-${view}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderMonthCell = (row, key) => {
    const { actual, target } = row.months[key];
    if (view === 'both') {
      return (
        <div className="leading-tight">
          <div title="Actual" className={actual === null ? 'text-[color:var(--text-muted)]' : ''}>
            {actual === null ? '—' : formatValue(actual)}
          </div>
          <div title="Target" className="text-[11px] text-[color:var(--text-muted)]">
            {target === null ? '—' : formatValue(target)}
          </div>
        </div>
      );
    }
    const value = row.months[key][view];
    if (value === null) return <span className="text-[color:var(--text-muted)]">—</span>;
    return <span title={String(value)}>{formatValue(value)}</span>;
  };

  const headerCell = 'bg-[color:var(--accent)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white';
  const filterCell = 'bg-[color:var(--surface-elevated)] px-2 py-1.5 border-b border-[color:var(--border)]';
  // # and KPI Description stay in view while the month columns scroll sideways
  const frozenNo = 'sticky left-0 w-12 min-w-[48px]';
  const frozenDescription = 'sticky left-12 w-[300px] min-w-[300px] max-w-[300px] border-r border-[color:var(--border)]';

  return (
    <div className="flex h-[calc(100vh-80px)] min-h-[480px] flex-col p-4 text-[color:var(--text-primary)]">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">KPI Data Audit</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">
            Monthly values entered or computed for every KPI, to check them against the dashboard graphs.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[color:var(--text-secondary)]">
            Fiscal Year
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            >
              {fiscalYearOptions.map((year) => (
                <option key={year} value={year}>
                  Apr {String(year).slice(-2)} – Mar {String(year + 1).slice(-2)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-[color:var(--text-secondary)]">
            Show
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="mt-1 block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => { setFilters({}); setSort({ key: null, direction: 'asc' }); }}
            disabled={!activeFilterCount && !sort.key}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear filters &amp; sort{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || !visibleRows.length}
            className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="mb-3 flex shrink-0 flex-wrap gap-4 text-sm text-[color:var(--text-secondary)]">
          <span>
            Showing <strong className="text-[color:var(--text-primary)]">{summary.total}</strong> of {rows.length} KPIs
          </span>
          <span>With data this year: <strong className="text-[color:var(--success)]">{summary.withData}</strong></span>
          <span>No data this year: <strong className="text-[color:var(--danger)]">{summary.withoutData}</strong></span>
          {view === 'both' && <span>Each month shows Actual above Target.</span>}
        </div>
      )}

      {error && (
        <div className="mb-3 shrink-0 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 shadow-md">
            <tr>
              <th className={`${headerCell} ${frozenNo} z-30`}>#</th>
              {TEXT_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`${headerCell} whitespace-nowrap ${column.key === 'description' ? `${frozenDescription} z-30` : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex items-center gap-1 uppercase hover:opacity-80"
                    title="Sort"
                  >
                    {column.label}
                    <span className="text-[10px]">{sortIndicator(column.key)}</span>
                  </button>
                </th>
              ))}
              {monthColumns.map(({ key, label }) => (
                <th key={key} className={`${headerCell} whitespace-nowrap text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="ml-auto flex items-center gap-1 uppercase hover:opacity-80"
                    title={`Sort by ${primaryType}`}
                  >
                    {label}
                    <span className="text-[10px]">{sortIndicator(key)}</span>
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              <th className={`${filterCell} ${frozenNo} z-30`} />
              {TEXT_COLUMNS.map((column) => (
                <th key={column.key} className={`${filterCell} ${column.key === 'description' ? `${frozenDescription} z-30` : ''}`}>
                  {column.filter === 'text' ? (
                    <input
                      type="text"
                      value={filters[column.key] || ''}
                      onChange={(e) => setFilter(column.key, e.target.value)}
                      placeholder="Search..."
                      className={inputClass}
                    />
                  ) : (
                    <select
                      value={filters[column.key] || ''}
                      onChange={(e) => setFilter(column.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">All</option>
                      {(selectOptions[column.key] || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  )}
                </th>
              ))}
              {monthColumns.map(({ key }) => (
                <th key={key} className={`${filterCell} min-w-[88px]`}>
                  <select
                    value={filters[key] || ''}
                    onChange={(e) => setFilter(key, e.target.value)}
                    className={inputClass}
                    title={`Filter on ${primaryType} value`}
                  >
                    {MONTH_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={1 + TEXT_COLUMNS.length + monthColumns.length} className="px-4 py-12 text-center text-[color:var(--text-muted)]">
                  Loading KPI data...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={1 + TEXT_COLUMNS.length + monthColumns.length} className="px-4 py-12 text-center text-[color:var(--text-muted)]">
                  No KPIs match the current filters.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} className="hover:bg-[color:var(--surface-hover)]">
                  <td className={`${frozenNo} z-10 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-muted)]`}>{index + 1}</td>
                  <td className={`${frozenDescription} z-10 border-b bg-[color:var(--surface)] px-3 py-2 font-medium`} title={row.kpiTitle !== row.description ? `KPI: ${row.kpiTitle}` : undefined}>
                    {row.description}
                  </td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2" title={row.category}>{row.group}</td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2 whitespace-nowrap">
                    {row.dataType === 'Computed' ? (
                      <span
                        title={row.formula ? `Formula: ${row.formula}` : 'No formula set'}
                        className="cursor-help rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent)]"
                      >
                        Computed
                      </span>
                    ) : (
                      <span className="rounded bg-[color:var(--success-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--success)]">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2 whitespace-nowrap" title={row.empId ? `Emp ID: ${row.empId}` : undefined}>
                    {row.user || <span className="text-[color:var(--text-muted)]">—</span>}
                  </td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2 whitespace-nowrap">
                    {row.department || <span className="text-[color:var(--text-muted)]">—</span>}
                  </td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2 whitespace-nowrap" title={row.pillarName || undefined}>
                    {row.pillar || <span className="text-[color:var(--text-muted)]">—</span>}
                  </td>
                  <td className="border-b border-[color:var(--border)] px-3 py-2 whitespace-nowrap">
                    {row.uom || <span className="text-[color:var(--text-muted)]">—</span>}
                  </td>
                  {monthColumns.map(({ key }) => (
                    <td key={key} className="border-b border-[color:var(--border)] px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {renderMonthCell(row, key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KpiDataAudit;
