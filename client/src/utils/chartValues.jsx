import React from 'react';
import { ReferenceLine, ReferenceDot } from 'recharts';

// Chart value display rule: an explicit 0 is shown as "0"; a missing/null value is shown as NO_DATA_TEXT.
export const NO_DATA_TEXT = 'No data available';
export const isMissingValue = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value));

export const formatChartValue = (value, suffix = '', decimals = 1) => {
  if (isMissingValue(value)) return NO_DATA_TEXT;
  const factor = 10 ** decimals;
  const rounded = Math.round(Number(value) * factor) / factor;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals)}${suffix}`;
};

// LabelList formatter: missing points get no label on the series itself (see renderNoDataMarkers)
export const labelFormatter = (suffix = '') => (value) => (isMissingValue(value) ? '' : formatChartValue(value, suffix, 0));

export const maxOfValues = (values, floor) => Math.max(floor, ...(values || []).filter((v) => !isMissingValue(v)).map(Number));

// Recharts skips null points entirely, so mark each missing category with a vertical "No data available" label.
// `rows` are chart data rows; `keys` are the series that must all be missing for the marker to show.
// `xKey` is the field the XAxis uses as its category (dataKey).
export const renderNoDataMarkers = (rows, keys, fontSize = 10, xKey = 'name') =>
  rows
    .filter((row) => keys.every((key) => isMissingValue(row[key])))
    .map((row) => (
      <ReferenceLine
        key={`no-data-${row[xKey]}`}
        x={row[xKey]}
        stroke="transparent"
        label={{ value: NO_DATA_TEXT, angle: -90, position: 'insideBottom', offset: 6, fill: 'var(--text-muted)', fontSize, fontWeight: 600, textAnchor: 'start' }}
      />
    ));

// Recharts drops zero-height bars, so their LabelList never renders. Draw the "0" label at the baseline instead,
// so explicit zero values are visible without hovering. `style` should match the series' LabelList style.
export const renderZeroBarLabels = (rows, key, suffix = '', style = {}, xKey = 'name') =>
  rows
    .filter((row) => !isMissingValue(row[key]) && Number(row[key]) === 0)
    .map((row) => (
      <ReferenceDot
        key={`zero-${key}-${row[xKey]}`}
        x={row[xKey]}
        y={0}
        r={0}
        fill="transparent"
        stroke="none"
        label={{ value: `0${suffix}`, position: 'top', offset: 5, ...style }}
      />
    ));

// Shared styled tooltip for all Recharts visualizations
export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const formatTooltipValue = (value) => formatChartValue(value);
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)]/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label != null && <div className="mb-1 font-bold text-[color:var(--text-primary)]">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color || p.stroke || p.fill }}></span>
          <span className="font-semibold text-[color:var(--text-secondary)]">{p.name}:</span>
          <span className="font-bold text-[color:var(--text-primary)]">{p.payload?.display ?? formatTooltipValue(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
