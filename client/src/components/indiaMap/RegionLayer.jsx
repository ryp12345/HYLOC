import React, { memo } from 'react';
import { REGION_BY_ID } from './indiaRegions';

// Fill + opacity for one state. In region view the other regions turn neutral (a faint tint on hover).
const stateFill = ({ view, region, selectedRegion, hoveredRegion }) => {
  if (view === 'world') return { fill: 'var(--accent)', opacity: hoveredRegion === 'india' ? 0.55 : 0.35 };
  const color = REGION_BY_ID[region]?.color || 'var(--text-muted)';
  if (view === 'region' && region !== selectedRegion) {
    return hoveredRegion === region ? { fill: color, opacity: 0.35 } : { fill: 'var(--map-land)', opacity: 1 };
  }
  return { fill: color, opacity: hoveredRegion === region ? 0.85 : 0.6 };
};

// India: states filled by region colour (or a single accent fill in world view), plus region outlines.
const RegionLayer = ({ view, states, regions, india, selectedRegion, hoveredRegion, onStateEnter, onStateLeave, onStateClick }) => (
  <g>
    {states.map((state) => {
      const { fill, opacity } = stateFill({ view, region: state.region, selectedRegion, hoveredRegion });
      return (
        <path
          key={state.id}
          d={state.d}
          fill={fill}
          fillOpacity={opacity}
          stroke={view === 'world' ? 'none' : 'var(--surface)'}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'pointer', transition: 'fill-opacity 200ms ease, fill 300ms ease' }}
          onPointerEnter={() => onStateEnter(state)}
          onPointerLeave={onStateLeave}
          onClick={(event) => {
            event.stopPropagation();
            onStateClick(state);
          }}
        />
      );
    })}

    {/* Region outlines on top of the state borders */}
    {view !== 'world' &&
      regions.map((region) => {
        const active = region.id === hoveredRegion || region.id === selectedRegion;
        return (
          <path
            key={region.id}
            d={region.d}
            fill="none"
            stroke={active ? REGION_BY_ID[region.id].color : 'var(--surface)'}
            strokeWidth={active ? 2.5 : 1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        );
      })}

    <path
      d={india.d}
      fill="none"
      stroke={view === 'world' ? 'var(--accent)' : 'var(--text-muted)'}
      strokeOpacity={view === 'world' ? 1 : 0.5}
      strokeWidth={view === 'world' ? 1.25 : 0.75}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  </g>
);

export default memo(RegionLayer);
