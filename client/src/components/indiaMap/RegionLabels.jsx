import React, { memo } from 'react';
import { REGIONS, REGION_BY_ID, UNLABELLED_STATES } from './indiaRegions';

// Every child carries data-x / data-y in base map pixels. WorldIndiaMap moves them on each zoom frame
// (transform = zoom.apply([x, y])), so labels track the map but never scale with it.
const haloText = {
  stroke: 'var(--surface)',
  strokeWidth: 3,
  paintOrder: 'stroke',
  strokeLinejoin: 'round',
};

const RegionLabels = ({ view, anchors, selectedRegion, hoveredRegion, onIndiaClick, onRegionClick, onRegionEnter, onRegionLeave }) => {
  // Each view renders under its own keyed wrapper. Anchors get their `transform` set outside React, so a
  // reused element would keep a stale offset (e.g. the India marker's position shifting every region pin).
  if (view === 'world') {
    const [x, y] = anchors.india;
    return (
      <g key="world">
        <g
          data-map-anchor=""
          data-x={x}
          data-y={y}
          style={{ cursor: 'pointer' }}
          onClick={(event) => {
            event.stopPropagation();
            onIndiaClick();
          }}
          onPointerEnter={() => onRegionEnter('india')}
          onPointerLeave={onRegionLeave}
        >
          <circle className="india-map-pulse" r={14} fill="var(--accent)" />
          <circle r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          <text x={12} y={-4} fontSize={14} fontWeight={800} fill="var(--text-primary)" style={haloText}>
            India
          </text>
          <text x={12} y={12} fontSize={11} fontWeight={600} fill="var(--text-muted)" style={haloText}>
            Click to explore
          </text>
        </g>
      </g>
    );
  }

  if (view === 'region') {
    const region = REGION_BY_ID[selectedRegion];
    if (!region) return null;
    return (
      <g key={`region-${selectedRegion}`} pointerEvents="none">
        {region.states
          .filter((code) => !UNLABELLED_STATES.has(code) && anchors.states[code])
          .map((code) => {
            const { x, y, name } = anchors.states[code];
            return (
              <g key={code} data-map-anchor="" data-x={x} data-y={y}>
                <text textAnchor="middle" y={4} fontSize={11} fontWeight={700} fill="var(--text-primary)" style={haloText}>
                  {name}
                </text>
              </g>
            );
          })}
      </g>
    );
  }

  // India view: one pin + label per region
  return (
    <g key="india">
      {REGIONS.map((region) => {
        const [x, y] = anchors.regions[region.id];
        const active = hoveredRegion === region.id;
        return (
          <g
            key={region.id}
            data-map-anchor=""
            data-x={x}
            data-y={y}
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              onRegionClick(region.id);
            }}
            onPointerEnter={() => onRegionEnter(region.id)}
            onPointerLeave={onRegionLeave}
          >
            <circle r={active ? 8 : 6} fill={region.color} stroke="var(--surface)" strokeWidth={2} style={{ transition: 'r 150ms ease' }} />
            <text x={11} y={5} fontSize={13} fontWeight={800} fill="var(--text-primary)" style={haloText}>
              {region.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export default memo(RegionLabels);
