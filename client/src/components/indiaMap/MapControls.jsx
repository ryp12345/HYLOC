import React from 'react';

const buttonClass =
  'flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-base font-bold text-[color:var(--text-primary)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]';

const MapControls = ({ onZoomIn, onZoomOut, onReset }) => (
  <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5" role="group" aria-label="Map zoom controls">
    <button type="button" className={buttonClass} onClick={onZoomIn} aria-label="Zoom in" title="Zoom in (+)">
      +
    </button>
    <button type="button" className={buttonClass} onClick={onZoomOut} aria-label="Zoom out" title="Zoom out (−)">
      −
    </button>
    <button type="button" className={buttonClass} onClick={onReset} aria-label="Reset to world view" title="Reset view">
      ↺
    </button>
  </div>
);

export default MapControls;
