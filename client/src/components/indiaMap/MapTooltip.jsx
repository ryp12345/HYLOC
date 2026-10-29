import React, { forwardRef } from 'react';

// Positioned by the parent through the forwarded ref (style.transform) so pointer moves don't re-render.
const MapTooltip = forwardRef(({ content }, ref) => (
  <div
    ref={ref}
    role="presentation"
    className="pointer-events-none absolute left-0 top-0 z-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)]/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
    style={{ visibility: content ? 'visible' : 'hidden' }}
  >
    {content && (
      <>
        <div className="flex items-center gap-2 font-bold text-[color:var(--text-primary)]">
          {content.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: content.color }} />}
          {content.title}
        </div>
        {content.lines?.map((line) => (
          <div key={line} className="mt-0.5 text-[color:var(--text-secondary)]">
            {line}
          </div>
        ))}
      </>
    )}
  </div>
));

MapTooltip.displayName = 'MapTooltip';

export default MapTooltip;
