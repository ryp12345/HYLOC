import { filterKind } from './useTableControls';

const inputCls =
  'w-full min-w-[6rem] rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs font-normal normal-case tracking-normal text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--focus-ring)]';

function SortIcon({ dir }) {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 3l4 5H6l4-5z" opacity={dir === 'asc' ? 1 : dir ? 0.25 : 0.45} />
      <path d="M10 17l-4-5h8l-4 5z" opacity={dir === 'desc' ? 1 : dir ? 0.25 : 0.45} />
    </svg>
  );
}

/** Drop-in replacement for a <th>: keeps the given className and adds click-to-sort. */
export function SortableHeader({ table, column, className = '', children, ...rest }) {
  const col = table.getColumn(column);
  const content = children ?? col?.label;
  if (!col || col.sortable === false) {
    return <th className={className} {...rest}>{content}</th>;
  }
  const active = table.sort.key === column;
  const dir = active ? table.sort.dir : null;
  const next = !active ? 'ascending' : dir === 'asc' ? 'descending' : 'default order';
  return (
    <th className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} {...rest}>
      <button
        type="button"
        onClick={() => table.toggleSort(column)}
        title={`Sort by ${col.label || column} (${next})`}
        className="inline-flex items-center gap-1 rounded [text-transform:inherit] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
      >
        <span>{content}</span>
        <SortIcon dir={dir} />
      </button>
    </th>
  );
}

function FilterInput({ table, col }) {
  const kind = filterKind(col);
  const value = table.filters[col.key];
  const label = col.label || col.key;
  if (!kind) return null;

  if (kind === 'select') {
    return (
      <select aria-label={`Filter ${label}`} className={inputCls} value={value ?? ''} onChange={(e) => table.setFilter(col.key, e.target.value)}>
        <option value="">All</option>
        {table.optionsFor(col.key).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (kind === 'number' || kind === 'date') {
    // A range filter: two inputs, each with a visible label so it's clear they are start and end
    const bounds = kind === 'number'
      ? [['min', 'Min'], ['max', 'Max']]
      : [['from', 'From'], ['to', 'To']];
    const v = value || {};
    const type = kind === 'number' ? 'number' : 'date';
    return (
      <div className="flex flex-col gap-1">
        {bounds.map(([k, text]) => (
          <label key={k} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] font-medium normal-case tracking-normal text-[color:var(--text-secondary)]">{text}</span>
            <input type={type} aria-label={`${label} ${text}`} className={inputCls}
              min={k === 'to' && v.from ? v.from : undefined} max={k === 'from' && v.to ? v.to : undefined}
              value={v[k] ?? ''} onChange={(e) => table.setFilter(col.key, { ...v, [k]: e.target.value })} />
          </label>
        ))}
      </div>
    );
  }

  return (
    <input type="text" aria-label={`Filter ${label}`} placeholder="Filter..." className={inputCls}
      value={value ?? ''} onChange={(e) => table.setFilter(col.key, e.target.value)} />
  );
}

/** Extra header row with one filter per column. Shown when the toolbar's "Filters" toggle is on. */
export function TableFilterRow({ table, cellClassName = 'px-2 py-2' }) {
  if (!table.showFilters) return null;
  return (
    // Solid background: in dark mode --surface-hover is see-through, so a coloured header would show through
    <tr className="table-filter-row text-[color:var(--text-primary)]">
      {table.visibleColumns.map((col) => (
        <th key={col.key} className={`${cellClassName} align-top font-normal`}>
          <FilterInput table={table} col={col} />
        </th>
      ))}
    </tr>
  );
}

/** Quick search, filter toggle, clear button and row count, placed above a table. */
export function TableToolbar({ table, searchable = true, placeholder = 'Search this table...', className = '' }) {
  const sortCol = table.getColumn(table.sort.key);
  const dirLabel = (() => {
    if (!sortCol) return '';
    if (sortCol.type === 'number') return table.sort.dir === 'asc' ? 'low → high' : 'high → low';
    if (sortCol.type === 'date') return table.sort.dir === 'asc' ? 'oldest first' : 'newest first';
    return table.sort.dir === 'asc' ? 'A → Z' : 'Z → A';
  })();
  const filterCount = Object.keys(table.filters).length;
  const filtered = table.rows.length !== table.totalCount;

  return (
    <div className={`flex flex-wrap items-center gap-2 py-2 text-xs text-[color:var(--text-secondary)] ${className}`}>
      {searchable && (
        <div className="relative w-full sm:w-60">
          <input
            type="text"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            placeholder={placeholder}
            aria-label="Search this table"
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1.5 pl-8 pr-3 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
          />
          <svg className="absolute left-2.5 top-2 h-4 w-4 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
      <button
        type="button"
        onClick={() => table.setShowFilters((s) => !s)}
        aria-pressed={table.showFilters}
        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          table.showFilters
            ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
            : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
        </svg>
        Filters
        {filterCount > 0 && (
          <span className="rounded-full bg-[color:var(--accent)] px-1.5 text-[10px] font-semibold text-white">{filterCount}</span>
        )}
      </button>
      {(table.activeFilterCount > 0 || !table.isDefaultSort) && (
        <button
          type="button"
          onClick={table.resetAll}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
        >
          Reset
        </button>
      )}
      <span className="ml-auto whitespace-nowrap">
        {filtered ? `${table.rows.length} of ${table.totalCount}` : table.totalCount} {table.totalCount === 1 ? 'row' : 'rows'}
        {sortCol && <> · sorted by <span className="font-medium text-[color:var(--text-primary)]">{sortCol.label || sortCol.key}</span> ({dirLabel})</>}
      </span>
    </div>
  );
}
