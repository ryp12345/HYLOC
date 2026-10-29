import React, { memo } from 'react';

// World countries other than India (India is drawn from the state file by RegionLayer)
const CountryLayer = ({ sphere, countries, faded }) => (
  <g aria-hidden="true">
    <path d={sphere} fill="var(--map-ocean)" stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    <g style={{ opacity: faded ? 0.35 : 1, transition: 'opacity 300ms ease' }}>
      {countries.map((country) => (
        <path
          key={country.id}
          d={country.d}
          fill="var(--map-land)"
          stroke="var(--map-land-stroke)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  </g>
);

export default memo(CountryLayer);
