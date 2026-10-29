import React from 'react';
import { REGIONS, REGION_BY_ID, UNION_TERRITORIES } from './indiaRegions';

const countLabel = (codes) => {
  const uts = codes.filter((code) => UNION_TERRITORIES.has(code)).length;
  const states = codes.length - uts;
  const parts = [];
  if (states) parts.push(`${states} state${states === 1 ? '' : 's'}`);
  if (uts) parts.push(`${uts} UT${uts === 1 ? '' : 's'}`);
  return parts.join(' · ');
};

// Side panel: the five regions as buttons (the keyboard / screen-reader route through the map) + details.
const RegionPanel = ({ view, selectedRegion, hoveredRegion, stateNames, onSelectRegion, onHoverRegion, onSelectIndia, onBack }) => {
  const selected = REGION_BY_ID[selectedRegion];
  const totalCodes = REGIONS.flatMap((region) => region.states);

  return (
    <aside className="flex min-h-0 flex-col gap-2" aria-label="India regions">
      <div className="dashboard-card flex flex-col p-3">
        <h2 className="mb-2 text-sm font-extrabold text-[color:var(--text-primary)]">Regions</h2>
        <ul className="space-y-1.5">
          {REGIONS.map((region) => {
            const isSelected = view === 'region' && selectedRegion === region.id;
            const isHovered = hoveredRegion === region.id;
            return (
              <li key={region.id}>
                <button
                  type="button"
                  onClick={() => onSelectRegion(region.id)}
                  onMouseEnter={() => onHoverRegion(region.id)}
                  onMouseLeave={() => onHoverRegion(null)}
                  onFocus={() => onHoverRegion(region.id)}
                  onBlur={() => onHoverRegion(null)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] ${
                    isSelected
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                      : isHovered
                        ? 'border-[color:var(--border)] bg-[color:var(--surface-hover)]'
                        : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: region.color }} aria-hidden="true" />
                  <span className="flex-1 text-sm font-bold text-[color:var(--text-primary)]">{region.label}</span>
                  <span className="text-xs font-semibold text-[color:var(--text-muted)]">{region.states.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="dashboard-card min-h-0 flex-1 overflow-y-auto p-3">
        {view === 'region' && selected ? (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: selected.color }} aria-hidden="true" />
              <h3 className="text-base font-extrabold text-[color:var(--text-primary)]">{selected.label} region</h3>
            </div>
            <p className="mb-3 text-xs font-semibold text-[color:var(--text-muted)]">{countLabel(selected.states)}</p>
            <ul className="space-y-1">
              {[...selected.states]
                .sort((a, b) => (stateNames[a] || a).localeCompare(stateNames[b] || b))
                .map((code) => (
                  <li key={code} className="flex items-center justify-between gap-2 rounded-md bg-[color:var(--surface-hover)] px-2.5 py-1.5 text-xs">
                    <span className="font-semibold text-[color:var(--text-primary)]">{stateNames[code] || code}</span>
                    {UNION_TERRITORIES.has(code) && (
                      <span className="rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-muted)]">UT</span>
                    )}
                  </li>
                ))}
            </ul>
            <button
              type="button"
              onClick={onBack}
              className="mt-3 w-full rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-bold text-[color:var(--accent)] transition-colors hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            >
              ‹ Back to India
            </button>
          </>
        ) : (
          <>
            <h3 className="text-base font-extrabold text-[color:var(--text-primary)]">India</h3>
            <p className="mb-3 text-xs font-semibold text-[color:var(--text-muted)]">
              {countLabel(totalCodes)} in {REGIONS.length} regions
            </p>
            {view === 'world' ? (
              <button
                type="button"
                onClick={onSelectIndia}
                className="w-full rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
              >
                Explore India
              </button>
            ) : (
              <p className="text-xs text-[color:var(--text-secondary)]">Select a region on the map or in the list to zoom in.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default RegionPanel;
