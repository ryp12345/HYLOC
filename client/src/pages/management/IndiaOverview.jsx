import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WorldIndiaMap from '../../components/indiaMap/WorldIndiaMap';
import RegionPanel from '../../components/indiaMap/RegionPanel';
import useGeoData from '../../components/indiaMap/useGeoData';
import { REGION_BY_ID } from '../../components/indiaMap/indiaRegions';

// URL is the source of truth for the view: ?view=india | ?region=<id> | (nothing) = world
const readView = (searchParams) => {
  const region = searchParams.get('region');
  if (region && REGION_BY_ID[region]) return { view: 'region', selectedRegion: region };
  if (searchParams.get('view') === 'india') return { view: 'india', selectedRegion: null };
  return { view: 'world', selectedRegion: null };
};

const isTypingTarget = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function IndiaOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { view, selectedRegion } = readView(searchParams);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const { data, loading, error } = useGeoData();
  const mapRef = useRef(null);

  // Fill the viewport below the app header (same approach as the Management dashboard)
  const pageRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  useLayoutEffect(() => {
    const update = () => {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const parentPaddingBottom = parseFloat(getComputedStyle(el.parentElement).paddingBottom) || 0;
      setPageHeight(Math.max(480, window.innerHeight - top - parentPaddingBottom));
    };
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('load', update);
    };
  }, []);

  const goWorld = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);
  const goIndia = useCallback(() => setSearchParams({ view: 'india' }, { replace: true }), [setSearchParams]);
  const goRegion = useCallback((regionId) => setSearchParams({ region: regionId }, { replace: true }), [setSearchParams]);
  // Also resets free zoom/pan when the URL is already at world view
  const resetView = useCallback(() => {
    goWorld();
    mapRef.current?.reset();
  }, [goWorld]);
  const goUp = useCallback(() => {
    if (view === 'region') goIndia();
    else if (view === 'india') goWorld();
  }, [view, goIndia, goWorld]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === 'Escape') {
        goUp();
      } else if (event.key === '+' || event.key === '=') {
        mapRef.current?.zoomBy(1.6);
      } else if (event.key === '-' || event.key === '_') {
        mapRef.current?.zoomBy(1 / 1.6);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goUp]);

  const stateNames = useMemo(
    () => Object.fromEntries((data?.states || []).map((state) => [state.id, state.properties.name])),
    [data]
  );

  const region = REGION_BY_ID[selectedRegion];
  const announcement =
    view === 'world'
      ? 'World view. India is highlighted.'
      : view === 'india'
        ? 'India view. Five regions: North, South, East, West and Central.'
        : `${region.label} region, ${region.states.length} states and union territories.`;

  const crumbClass =
    'rounded px-1 font-semibold text-white/80 underline-offset-2 transition-colors hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-white/70';

  return (
    <div
      ref={pageRef}
      className="dashboard-dark-bg flex flex-col gap-2 p-0.5 transition-colors duration-300 sm:p-1"
      style={{ height: pageHeight ? `${pageHeight}px` : 'calc(100vh - 5rem)', minHeight: 0 }}
    >
      {/* Header */}
      <div className="dashboard-panel-header shrink-0 px-4 py-2 sm:px-5">
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">India Overview</h1>
            <nav aria-label="Map level" className="flex items-center gap-1 text-xs">
              {view === 'world' ? (
                <span className="font-bold text-white" aria-current="page">World</span>
              ) : (
                <button type="button" className={crumbClass} onClick={goWorld}>World</button>
              )}
              {view !== 'world' && (
                <>
                  <span className="text-white/60" aria-hidden="true">›</span>
                  {view === 'india' ? (
                    <span className="font-bold text-white" aria-current="page">India</span>
                  ) : (
                    <button type="button" className={crumbClass} onClick={goIndia}>India</button>
                  )}
                </>
              )}
              {view === 'region' && (
                <>
                  <span className="text-white/60" aria-hidden="true">›</span>
                  <span className="font-bold text-white" aria-current="page">{region.label}</span>
                </>
              )}
            </nav>
          </div>
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg border border-white/40 bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <div className="dashboard-card h-[60%] min-h-[280px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-muted)]">Loading map…</div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[color:var(--danger)]">
              <span>The map could not be loaded.</span>
              <span className="text-xs text-[color:var(--text-muted)]">{error.message}</span>
            </div>
          ) : (
            <WorldIndiaMap
              ref={mapRef}
              data={data}
              view={view}
              selectedRegion={selectedRegion}
              hoveredRegion={hoveredRegion}
              onHoverRegion={setHoveredRegion}
              onSelectIndia={goIndia}
              onSelectRegion={goRegion}
              onBack={goIndia}
              onReset={resetView}
            />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:w-80 lg:flex-none">
          <RegionPanel
            view={view}
            selectedRegion={selectedRegion}
            hoveredRegion={hoveredRegion}
            stateNames={stateNames}
            onSelectRegion={goRegion}
            onHoverRegion={setHoveredRegion}
            onSelectIndia={goIndia}
            onBack={goIndia}
          />
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

export default IndiaOverview;
