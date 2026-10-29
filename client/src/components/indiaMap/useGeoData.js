import { useEffect, useState } from 'react';
import { feature, merge } from 'topojson-client';
import { REGIONS, REGION_BY_STATE, assertRegionCoverage } from './indiaRegions';

const BASE = import.meta.env.BASE_URL || '/';
const WORLD_URL = `${BASE}geo/world-110m.json`;
const INDIA_URL = `${BASE}geo/india-states.topo.json`;
const INDIA_WORLD_ATLAS_ID = '356';

let cachedPromise = null;

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
};

const loadGeoData = async () => {
  const [worldTopo, indiaTopo] = await Promise.all([fetchJson(WORLD_URL), fetchJson(INDIA_URL)]);

  // India is drawn only from the state file (official boundary); the world file's India shape is dropped.
  const countries = feature(worldTopo, worldTopo.objects.countries).features.filter(
    (country) => String(country.id) !== INDIA_WORLD_ATLAS_ID
  );

  const stateGeometries = indiaTopo.objects.states.geometries;
  const states = feature(indiaTopo, indiaTopo.objects.states).features.map((state) => ({
    ...state,
    id: state.properties.code,
    region: REGION_BY_STATE[state.properties.code]?.id || null,
  }));

  const problems = assertRegionCoverage(states.map((state) => state.id));
  if (problems.length) {
    console.warn('[India Overview] Region config does not match the map file:', problems);
  }

  const india = { type: 'Feature', id: 'IN', properties: { name: 'India' }, geometry: merge(indiaTopo, stateGeometries) };

  const regions = REGIONS.map((region) => {
    const codes = new Set(region.states);
    return {
      type: 'Feature',
      id: region.id,
      properties: { name: region.label },
      geometry: merge(indiaTopo, stateGeometries.filter((g) => codes.has(g.properties.code))),
    };
  });

  return { countries, india, states, regions };
};

const useGeoData = () => {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    if (!cachedPromise) {
      cachedPromise = loadGeoData().catch((err) => {
        cachedPromise = null; // allow a retry on the next mount
        throw err;
      });
    }
    cachedPromise
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

export default useGeoData;
