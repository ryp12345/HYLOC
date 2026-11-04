import { useCallback, useMemo, useState } from 'react';

/*
 * Shared sorting + filtering for the app's tables.
 *
 * columns: array in the same order as the table's header cells, e.g.
 *   { key: 'name', label: 'Name' }                              text (default)
 *   { key: 'qty', label: 'Qty', type: 'number' }                numeric sort, min/max filter
 *   { key: 'from', label: 'From', type: 'date' }                date sort, from/to filter
 *   { key: 'from_date', type: 'date', rangeEnd: 'to_date' }      date range: filter matches overlapping periods
 *   accessor returning an array                                 several values in one cell (any one can match)
 *   { key: 'status', label: 'Status', filter: 'select' }        dropdown of distinct values
 *   { key: 'sno', label: 'S.No', sortable: false, filter: false }
 *   { key: 'x', accessor: (row) => row.a?.b }                   custom value getter
 *   { key: 'y', hidden: !isAdmin }                              column not rendered
 *
 * By default rows are sorted A–Z on the first sortable text column
 * (or options.defaultSort = { key, dir }).
 */

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const getCellValue = (col, row) => (col.accessor ? col.accessor(row) : row?.[col.key]);

// End of a date range column, e.g. { key: 'from_date', type: 'date', rangeEnd: 'to_date' }
const getRangeEnd = (col, row) => {
  if (!col.rangeEnd) return undefined;
  return typeof col.rangeEnd === 'function' ? col.rangeEnd(row) : row?.[col.rangeEnd];
};

const pad = (n) => String(n).padStart(2, '0');
const localIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toText = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : localIsoDate(v);
  return String(v).trim();
};

export const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const toTime = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  const s = String(v);
  // Plain "YYYY-MM-DD" is read as a local date so it matches the date pickers.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

// A cell can hold several values (e.g. one user with several roles): work with each of them.
const asList = (v) => (Array.isArray(v) ? v : [v]);
const nonEmpty = (v) => v !== null && v !== undefined && v !== '';

const sortValue = (col, row) => {
  const raw = getCellValue(col, row);
  if (col.type === 'number' || col.type === 'date') {
    const nums = asList(raw).map(col.type === 'number' ? toNumber : toTime).filter((x) => x !== null);
    return nums.length ? Math.min(...nums) : null; // several dates: sort by the earliest
  }
  const text = toText(raw);
  return text === '' ? null : text;
};

// Empty values always go last, whatever the direction.
const compareCol = (col, a, b, dir) => {
  const va = sortValue(col, a);
  const vb = sortValue(col, b);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const res = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
  return dir === 'desc' ? -res : res;
};

export const filterKind = (col) => {
  if (col.filter === false || col.filter === 'none') return null;
  if (typeof col.filter === 'string') return col.filter;
  if (col.type === 'number') return 'number';
  if (col.type === 'date') return 'date';
  return 'text';
};

const isEmptyFilter = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'object') return Object.values(v).every((x) => x === '' || x === null || x === undefined);
  return false;
};

const DAY_END = 86399999; // include the whole "to" day

const matchesFilter = (col, row, value) => {
  const kind = filterKind(col);
  const raw = getCellValue(col, row);
  if (kind === 'select') {
    const wanted = String(value).toLowerCase();
    return asList(raw).some((x) => toText(x).toLowerCase() === wanted);
  }
  if (kind === 'number') {
    const min = nonEmpty(value.min) ? Number(value.min) : null;
    const max = nonEmpty(value.max) ? Number(value.max) : null;
    return asList(raw).map(toNumber).some((n) => n !== null && (min === null || n >= min) && (max === null || n <= max));
  }
  if (kind === 'date') {
    const from = toTime(value.from);
    const to = toTime(value.to);
    const toEnd = to === null ? null : to + DAY_END;
    if (col.rangeEnd) {
      // A date range matches when it overlaps the chosen period.
      const start = toTime(raw);
      const end = toTime(getRangeEnd(col, row)) ?? start;
      if (start === null) return false;
      return (toEnd === null || start <= toEnd) && (from === null || end >= from);
    }
    return asList(raw).map(toTime).some((t) => t !== null && (from === null || t >= from) && (toEnd === null || t <= toEnd));
  }
  return toText(raw).toLowerCase().includes(String(value).trim().toLowerCase());
};

// Text used by the quick search: dates are also matched the way tables show them (e.g. "Jan 5, 2026", "05/01/2026").
const searchText = (col, row) => {
  const raw = getCellValue(col, row);
  if (col.type !== 'date') return toText(raw).toLowerCase();
  const parts = [];
  [...asList(raw), getRangeEnd(col, row)].forEach((v) => {
    const t = toTime(v);
    if (t === null) return;
    const d = new Date(t);
    parts.push(
      localIsoDate(d),
      d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      d.toLocaleDateString('en-GB'),
    );
  });
  return parts.join(' | ').toLowerCase();
};

export default function useTableControls(data, columns, options = {}) {
  const rows = Array.isArray(data) ? data : [];

  const defaultSort = useMemo(() => {
    if (options.defaultSort) return { dir: 'asc', ...options.defaultSort };
    const first = columns.find((c) => c.sortable !== false && !c.hidden && (!c.type || c.type === 'text'))
      || columns.find((c) => c.sortable !== false && !c.hidden);
    return first ? { key: first.key, dir: 'asc' } : { key: null, dir: 'asc' };
  }, [options.defaultSort?.key, options.defaultSort?.dir, columns.map((c) => c.key).join('|')]);

  // Sort can be controlled by the page (options.sort + options.onSortChange), e.g. to keep it in the URL.
  const controlled = options.sort !== undefined;
  const [innerSort, setInnerSort] = useState(null); // null = default sort
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);
  const visibleColumns = useMemo(() => columns.filter((c) => !c.hidden), [columns]);

  const requested = controlled ? options.sort : innerSort;
  // Ignore unknown or non-sortable keys (e.g. an old bookmarked URL) and fall back to the default.
  const sortState = requested && colByKey[requested.key] && colByKey[requested.key].sortable !== false
    ? { key: requested.key, dir: requested.dir === 'desc' ? 'desc' : 'asc' }
    : null;
  const sort = sortState || defaultSort;

  const applySort = (next) => {
    if (controlled) options.onSortChange?.(next);
    else setInnerSort(next);
  };

  const toggleSort = (key) => {
    const cur = sortState || defaultSort;
    if (cur.key !== key) applySort({ key, dir: 'asc' });
    else if (cur.dir === 'asc') applySort({ key, dir: 'desc' });
    // Third click returns to the default A–Z order (or flips back to A–Z on the default column).
    else applySort(key === defaultSort.key ? { key, dir: 'asc' } : null);
  };

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (isEmptyFilter(value)) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
  }, []);

  const resetAll = () => {
    setFilters({});
    setSearch('');
    applySort(null);
  };

  const optionsFor = useCallback((key) => {
    const col = colByKey[key];
    if (!col) return [];
    if (Array.isArray(col.options)) return col.options;
    const set = new Set();
    rows.forEach((r) => {
      asList(getCellValue(col, r)).forEach((v) => {
        const t = toText(v);
        if (t) set.add(t);
      });
    });
    // Keep the selected value listed even if the data no longer contains it, so the dropdown never hides an active filter.
    const current = filters[key];
    if (typeof current === 'string' && current && !set.has(current)) set.add(current);
    return [...set].sort(collator.compare);
  }, [rows, colByKey, filters]);

  const processed = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([k]) => colByKey[k] && !colByKey[k].hidden);
    const q = search.trim().toLowerCase();
    const searchCols = visibleColumns.filter((c) => c.search !== false && (c.sortable !== false || c.filter !== false));

    let out = rows.filter((row) => {
      for (const [k, v] of activeFilters) {
        if (!matchesFilter(colByKey[k], row, v)) return false;
      }
      if (q) return searchCols.some((c) => searchText(c, row).includes(q));
      return true;
    });

    const sortCol = colByKey[sort.key];
    const tieCol = colByKey[defaultSort.key];
    if (sortCol) {
      out = [...out].sort((a, b) => {
        const res = compareCol(sortCol, a, b, sort.dir);
        if (res !== 0 || !tieCol || tieCol === sortCol) return res;
        return compareCol(tieCol, a, b, 'asc');
      });
    }
    return out;
  }, [rows, filters, search, sort.key, sort.dir, colByKey, visibleColumns, defaultSort.key]);

  const activeFilterCount = Object.keys(filters).length + (search.trim() ? 1 : 0);

  return {
    rows: processed,
    totalCount: rows.length,
    columns,
    visibleColumns,
    getColumn: (key) => colByKey[key],
    sort,
    isDefaultSort: !sortState || (sortState.key === defaultSort.key && sortState.dir === defaultSort.dir),
    toggleSort,
    setSort: (key, dir = 'asc') => applySort(key ? { key, dir } : null),
    filters,
    setFilter,
    clearFilters,
    resetAll,
    search,
    setSearch,
    showFilters,
    setShowFilters,
    optionsFor,
    activeFilterCount,
    // Changes whenever the visible result set changes: use it to reset pagination.
    signature: `${JSON.stringify(filters)}|${search}|${sort.key}|${sort.dir}`,
  };
}
