// India Overview region model.
// Grouping follows the five Zonal Councils, with the North-Eastern states added to East.
// Every state/UT code in public/geo/india-states.topo.json must appear in exactly one region
// (see assertRegionCoverage). `pin` is [longitude, latitude]; null = use the region's centroid.

export const REGIONS = [
  {
    id: 'north',
    label: 'North',
    color: 'var(--region-north)',
    pin: [75.5, 29.5],
    states: ['JK', 'LA', 'HP', 'PB', 'CH', 'HR', 'DL', 'RJ'],
  },
  {
    id: 'central',
    label: 'Central',
    color: 'var(--region-central)',
    pin: [80.0, 23.8],
    states: ['UP', 'UK', 'MP', 'CG'],
  },
  {
    id: 'east',
    label: 'East',
    color: 'var(--region-east)',
    // The centroid is pulled towards the North-East; keep the pin on the mainland
    pin: [86.5, 23.5],
    states: ['BR', 'JH', 'OD', 'WB', 'SK', 'AS', 'AR', 'ML', 'NL', 'MN', 'MZ', 'TR', 'AN'],
  },
  {
    id: 'west',
    label: 'West',
    color: 'var(--region-west)',
    pin: [74.0, 20.5],
    states: ['GJ', 'MH', 'GA', 'DH'],
  },
  {
    id: 'south',
    label: 'South',
    color: 'var(--region-south)',
    pin: [78.0, 13.5],
    states: ['AP', 'TG', 'KA', 'KL', 'TN', 'PY', 'LD'],
  },
];

// Union territories (used for the "x states, y UTs" summary)
export const UNION_TERRITORIES = new Set(['JK', 'LA', 'CH', 'DL', 'DH', 'AN', 'PY', 'LD']);

// State name positions [lon, lat] where the centroid lands badly (odd shapes or crowded neighbours)
export const STATE_LABEL_AT = {
  WB: [88.2, 22.9],
  JH: [85.2, 23.8],
  AS: [92.2, 26.3],
};

// Too small to carry a name on the map at region zoom; still shown in tooltips and the side panel
export const UNLABELLED_STATES = new Set(['CH', 'DL', 'PY', 'DH', 'LD', 'GA', 'SK', 'TR']);

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((region) => [region.id, region]));

export const REGION_BY_STATE = Object.fromEntries(
  REGIONS.flatMap((region) => region.states.map((code) => [code, region]))
);

// Returns a list of problems: codes in the map but in no region, in a region but not in the map, or in two regions.
export const assertRegionCoverage = (mapCodes) => {
  const problems = [];
  const seen = new Map();
  REGIONS.forEach((region) => {
    region.states.forEach((code) => {
      if (seen.has(code)) problems.push(`${code} is in both ${seen.get(code)} and ${region.id}`);
      seen.set(code, region.id);
    });
  });
  const mapSet = new Set(mapCodes);
  mapCodes.forEach((code) => {
    if (!seen.has(code)) problems.push(`${code} is not assigned to a region`);
  });
  seen.forEach((_, code) => {
    if (!mapSet.has(code)) problems.push(`${code} is assigned but missing from the map file`);
  });
  return problems;
};
