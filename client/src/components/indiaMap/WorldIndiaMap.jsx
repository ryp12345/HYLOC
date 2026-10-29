import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import CountryLayer from './CountryLayer';
import RegionLayer from './RegionLayer';
import RegionLabels from './RegionLabels';
import MapControls from './MapControls';
import MapTooltip from './MapTooltip';
import useMapZoom, { transformForBounds } from './useMapZoom';
import { REGIONS, REGION_BY_ID, STATE_LABEL_AT } from './indiaRegions';

// Free zoom may go this far beyond the India view
const MAX_ZOOM_PAST_INDIA = 12;

const useElementSize = (ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) => {
        const next = { width: Math.round(width), height: Math.round(height) };
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
};

const regionStateCount = (regionId) => REGION_BY_ID[regionId]?.states.length || 0;

const WorldIndiaMap = forwardRef(
  ({ data, view, selectedRegion, hoveredRegion, onHoverRegion, onSelectIndia, onSelectRegion, onBack, onReset }, ref) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const contentRef = useRef(null);
    const overlayRef = useRef(null);
    const tooltipRef = useRef(null);
    const { width, height } = useElementSize(containerRef);
    const [hoverTarget, setHoverTarget] = useState(null);

    // Projection centred on India's longitude; every layer shares it so world and India views line up.
    const geo = useMemo(() => {
      if (!data || !width || !height) return null;
      const projection = geoNaturalEarth1().rotate([-80, 0]).fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        { type: 'Sphere' }
      );
      const path = geoPath(projection);
      const india = { d: path(data.india), bounds: path.bounds(data.india) };
      const regions = data.regions.map((region) => ({ id: region.id, d: path(region), bounds: path.bounds(region) }));
      const anchors = { india: path.centroid(data.india), regions: {}, states: {} };
      REGIONS.forEach((region) => {
        anchors.regions[region.id] = region.pin
          ? projection(region.pin)
          : path.centroid(data.regions.find((feature) => feature.id === region.id));
      });
      data.states.forEach((state) => {
        const [x, y] = STATE_LABEL_AT[state.id] ? projection(STATE_LABEL_AT[state.id]) : path.centroid(state);
        anchors.states[state.id] = { x, y, name: state.properties.name };
      });
      return {
        sphere: path({ type: 'Sphere' }),
        countries: data.countries
          .map((country, index) => ({ id: country.id ?? `c${index}`, d: path(country) }))
          .filter((country) => country.d),
        states: data.states.map((state) => ({ id: state.id, region: state.region, name: state.properties.name, d: path(state) })),
        regions,
        india,
        anchors,
        maxScale: transformForBounds(india.bounds, width, height).k * MAX_ZOOM_PAST_INDIA,
      };
    }, [data, width, height]);

    // Applies a zoom transform straight to the DOM: the map group scales, the label overlay only moves.
    const applyTransformToDom = useCallback((transform) => {
      contentRef.current?.setAttribute('transform', transform.toString());
      overlayRef.current?.querySelectorAll('[data-map-anchor]').forEach((el) => {
        const x = transform.applyX(Number(el.dataset.x));
        const y = transform.applyY(Number(el.dataset.y));
        el.setAttribute('transform', `translate(${x},${y})`);
      });
    }, []);

    const { zoomToBounds, reset, zoomBy, transformRef } = useMapZoom({
      svgRef,
      width,
      height,
      maxScale: geo?.maxScale ?? 1,
      onZoom: applyTransformToDom,
    });

    // Newly rendered labels (view changes) need the current transform too
    useLayoutEffect(() => {
      applyTransformToDom(transformRef.current);
    });

    // Fit the view. Animate between views; jump on first load and on resize.
    const lastSizeKeyRef = useRef(null);
    useEffect(() => {
      if (!geo) return;
      const sizeKey = `${width}x${height}`;
      const duration = lastSizeKeyRef.current === sizeKey ? 750 : 0;
      lastSizeKeyRef.current = sizeKey;
      if (view === 'world') {
        reset(duration);
      } else if (view === 'india') {
        zoomToBounds(geo.india.bounds, { duration });
      } else {
        const region = geo.regions.find((r) => r.id === selectedRegion);
        if (region) zoomToBounds(region.bounds, { duration, padding: 0.1 });
      }
    }, [geo, view, selectedRegion, width, height, reset, zoomToBounds]);

    useImperativeHandle(ref, () => ({ zoomBy, reset }), [zoomBy, reset]);

    const clearHover = useCallback(() => {
      setHoverTarget(null);
      onHoverRegion(null);
    }, [onHoverRegion]);

    const handleStateEnter = useCallback(
      (state) => {
        setHoverTarget({ type: 'state', state });
        onHoverRegion(view === 'world' ? 'india' : state.region);
      },
      [view, onHoverRegion]
    );

    const handleStateClick = useCallback(
      (state) => {
        if (view === 'world') onSelectIndia();
        else if (state.region) onSelectRegion(state.region);
      },
      [view, onSelectIndia, onSelectRegion]
    );

    const handleRegionEnter = useCallback(
      (regionId) => {
        setHoverTarget(regionId === 'india' ? { type: 'india' } : { type: 'region', regionId });
        onHoverRegion(regionId);
      },
      [onHoverRegion]
    );

    const handlePointerMove = (event) => {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      if (!tooltip || !container) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const flipX = x > rect.width - 230;
      const flipY = y > rect.height - 90;
      tooltip.style.transform = `translate(${flipX ? x - 14 : x + 14}px, ${flipY ? y - 14 : y + 14}px) translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`;
    };

    const tooltipContent = useMemo(() => {
      if (!hoverTarget) return null;
      if (hoverTarget.type === 'india' || (hoverTarget.type === 'state' && view === 'world')) {
        return { title: 'India', color: 'var(--accent)', lines: [`${data.states.length} states and union territories`, 'Click to explore'] };
      }
      const regionId = hoverTarget.type === 'region' ? hoverTarget.regionId : hoverTarget.state.region;
      const region = REGION_BY_ID[regionId];
      if (!region) return null;
      const lines = [];
      if (hoverTarget.type === 'state') lines.push(hoverTarget.state.name);
      lines.push(`${regionStateCount(regionId)} states and UTs`);
      if (!(view === 'region' && selectedRegion === regionId)) lines.push('Click to zoom in');
      return { title: `${region.label} region`, color: region.color, lines };
    }, [hoverTarget, view, selectedRegion, data]);

    const ariaLabel =
      view === 'world'
        ? 'World map with India highlighted'
        : view === 'india'
          ? 'Map of India divided into North, South, East, West and Central regions'
          : `Map of the ${REGION_BY_ID[selectedRegion]?.label || ''} region of India`;

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-[color:var(--surface)]"
        onPointerMove={handlePointerMove}
        onPointerLeave={clearHover}
      >
        {geo && (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            className="absolute inset-0 block h-full w-full touch-none select-none"
            style={{ cursor: 'grab' }}
            onClick={() => {
              if (view === 'region') onBack();
            }}
          >
            <g ref={contentRef}>
              <CountryLayer sphere={geo.sphere} countries={geo.countries} faded={view !== 'world'} />
              <RegionLayer
                view={view}
                states={geo.states}
                regions={geo.regions}
                india={geo.india}
                selectedRegion={selectedRegion}
                hoveredRegion={hoveredRegion}
                onStateEnter={handleStateEnter}
                onStateLeave={clearHover}
                onStateClick={handleStateClick}
              />
            </g>
            <g ref={overlayRef}>
              <RegionLabels
                view={view}
                anchors={geo.anchors}
                selectedRegion={selectedRegion}
                hoveredRegion={hoveredRegion}
                onIndiaClick={onSelectIndia}
                onRegionClick={onSelectRegion}
                onRegionEnter={handleRegionEnter}
                onRegionLeave={clearHover}
              />
            </g>
          </svg>
        )}

        {view !== 'world' && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/90 px-3 py-2 shadow-sm backdrop-blur">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">Regions</div>
            <ul className="space-y-0.5">
              {REGIONS.map((region) => (
                <li key={region.id} className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-primary)]">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: region.color }} />
                  {region.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Required by the CC BY 4.0 licence of the India boundary data: credit + note that it was modified (simplified) */}
        <div className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-[color:var(--surface)]/80 px-1.5 text-[9px] text-[color:var(--text-muted)]">
          India boundaries:{' '}
          <a href="https://github.com/datameet/maps" target="_blank" rel="noreferrer" className="underline hover:text-[color:var(--accent)]">
            DataMeet
          </a>{' '}
          (CC BY 4.0, simplified) · World: Natural Earth
        </div>

        <MapControls onZoomIn={() => zoomBy(1.6)} onZoomOut={() => zoomBy(1 / 1.6)} onReset={onReset} />
        <MapTooltip ref={tooltipRef} content={tooltipContent} />
      </div>
    );
  }
);

WorldIndiaMap.displayName = 'WorldIndiaMap';

export default WorldIndiaMap;
