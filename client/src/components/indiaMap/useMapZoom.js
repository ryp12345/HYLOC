import { useCallback, useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition'; // adds selection.transition()

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Computes the transform that fits `bounds` ([[x0, y0], [x1, y1]] in base map pixels) into the viewport.
export const transformForBounds = (bounds, width, height, { padding = 0.08, maxScale = Infinity } = {}) => {
  const [[x0, y0], [x1, y1]] = bounds;
  const dx = Math.max(x1 - x0, 1);
  const dy = Math.max(y1 - y0, 1);
  const k = Math.min(maxScale, (1 - 2 * padding) / Math.max(dx / width, dy / height));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k);
};

// d3-zoom wiring. The current transform lives in a ref (not React state) so panning never re-renders;
// `onZoom(transform)` is called on every frame to update the DOM directly.
const useMapZoom = ({ svgRef, width, height, maxScale, onZoom }) => {
  const behaviourRef = useRef(null);
  const transformRef = useRef(zoomIdentity);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !width || !height) return undefined;
    const svg = select(svgEl);
    const behaviour = zoom()
      .scaleExtent([1, Math.max(maxScale, 1)])
      .extent([[0, 0], [width, height]])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        onZoomRef.current?.(event.transform);
      });
    svg.call(behaviour).on('dblclick.zoom', null);
    behaviourRef.current = behaviour;
    // Re-apply the last transform so a re-initialised behaviour starts where the map is
    svg.call(behaviour.transform, transformRef.current);
    return () => {
      svg.interrupt();
      svg.on('.zoom', null);
      behaviourRef.current = null;
    };
  }, [svgRef, width, height, maxScale]);

  const applyTransform = useCallback(
    (transform, duration = 750) => {
      const svgEl = svgRef.current;
      const behaviour = behaviourRef.current;
      if (!svgEl || !behaviour) return;
      const svg = select(svgEl);
      const ms = prefersReducedMotion() ? 0 : duration;
      if (ms > 0) {
        svg.transition().duration(ms).call(behaviour.transform, transform);
      } else {
        svg.interrupt().call(behaviour.transform, transform);
      }
    },
    [svgRef]
  );

  const zoomToBounds = useCallback(
    (bounds, { duration = 750, padding } = {}) => {
      if (!width || !height || !bounds) return;
      applyTransform(transformForBounds(bounds, width, height, { padding, maxScale }), duration);
    },
    [applyTransform, width, height, maxScale]
  );

  const reset = useCallback((duration = 750) => applyTransform(zoomIdentity, duration), [applyTransform]);

  const zoomBy = useCallback(
    (factor) => {
      const svgEl = svgRef.current;
      const behaviour = behaviourRef.current;
      if (!svgEl || !behaviour) return;
      const svg = select(svgEl);
      if (prefersReducedMotion()) svg.call(behaviour.scaleBy, factor);
      else svg.transition().duration(250).call(behaviour.scaleBy, factor);
    },
    [svgRef]
  );

  return { zoomToBounds, reset, zoomBy, transformRef };
};

export default useMapZoom;
