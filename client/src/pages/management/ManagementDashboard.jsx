import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getKPIs } from '../../api/kpiApi';
import { getPillers } from '../../api/pillerApi';
import { getUsers } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import api from '../../api/axios';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FISCAL_YEAR_START = 2025;
const FISCAL_MONTH_SEQUENCE = Array.from({ length: 12 }, (_, i) => {
  const month = ((3 + i) % 12) + 1; // April (4) through March (3)
  const year = month >= 4 ? FISCAL_YEAR_START : FISCAL_YEAR_START + 1;
  return { month, year };
});

// SVG Line Chart Component for Industry 4.0 KPI
const Industry40LineChart = ({ title, labels, actuals, targets }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals, ...targets, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * plotWidth;
  const getY = (val) => svgHeight - padding - ((val - minVal) / range) * plotHeight;

  const formatVal = (v) => {
    if (!Number.isFinite(v)) return String(v);
    if (range < 10) return v.toFixed(1);
    if (Math.abs(v) >= 1000) return Math.round(v).toString();
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  };

  // Generate line paths
  const actualPath = actuals
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');
  const targetPath = targets
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {/* Grid lines + Y ticks */}
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padding}
                  y1={y}
                  x2={svgWidth - padding}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
              </g>
            );
          });
        })()}

        {/* Y-axis line */}
        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        {/* X-axis line */}
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        {/* Target line (background) */}
        <path d={targetPath} stroke="#ffb74d" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />

        {/* Actual line (foreground) */}
        <path d={actualPath} stroke="#41aafe" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Target dots + labels */}
        {targets.map((val, idx) => (
          <g key={`target-dot-${idx}`}>
            <circle cx={getX(idx)} cy={getY(val)} r="5" fill="#ffb74d" stroke="white" strokeWidth="2" />
            <text x={getX(idx)} y={getY(val) - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#c97706">{formatVal(Number(val))}</text>
          </g>
        ))}

        {/* Actual dots + labels */}
        {actuals.map((val, idx) => (
          <g key={`actual-dot-${idx}`}>
            <circle cx={getX(idx)} cy={getY(val)} r="5" fill="#41aafe" stroke="white" strokeWidth="2" />
            <text x={getX(idx)} y={getY(val) - 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0ea5e9">{formatVal(Number(val))}</text>
          </g>
        ))}

        {/* X-axis labels */}
        {labels.map((label, idx) => (
          <text
            key={`x-label-${idx}`}
            x={getX(idx)}
            y={svgHeight - padding + 30}
            textAnchor="middle"
            fontSize="12"
            fontWeight="500"
            fill="#4b5563"
          >
            {label}
          </text>
        ))}

        {/* Y-axis labels (formatted) */}
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString();
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">
                {label}
              </text>
            );
          });
        })()}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-8 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-[30px] h-[3px] bg-[#41aafe] rounded"></span>
          <span className="text-sm text-gray-600">Actual Value</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[30px] h-[3px] bg-[#ffb74d] rounded"></span>
          <span className="text-sm text-gray-600">Target Value</span>
        </div>
      </div>
    </div>
  );
};

// Speedometer Gauge Component for Plant Efficiency
const SpeedometerGauge = ({ efficiency, month, year }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate angle: -180 to 0 degrees (left to right semicircle)
  // 0-60 red, 61-80 yellow, >80 green
  const angle = -180 + (Math.min(Math.max(efficiency, 0), 100) / 100) * 180;
  const radians = (angle * Math.PI) / 180;
  const x = 150 + radius * Math.cos(radians);
  const y = 150 + radius * Math.sin(radians);

  let color = '#ef4444'; // red
  let status = 'Critical';
  if (efficiency > 80) {
    color = '#22c55e'; // green
    status = 'Excellent';
  } else if (efficiency > 60) {
    color = '#eab308'; // yellow
    status = 'Good';
  }

  return (
    <div className="flex flex-col items-center p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-4">{month} {year}</h3>
      <svg viewBox="0 0 300 200" className="w-full max-w-[300px] h-auto">
        {/* Background arc */}
        <path
          d="M 70 150 A 80 80 0 0 1 230 150"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="20"
          strokeLinecap="round"
        />
        
        {/* Red zone (0-60) */}
        <path
          d="M 70 150 A 80 80 0 0 1 126 82"
          fill="none"
          stroke="#ef4444"
          strokeWidth="20"
          strokeLinecap="round"
        />
        
        {/* Yellow zone (61-80) */}
        <path
          d="M 126 82 A 80 80 0 0 1 174 82"
          fill="none"
          stroke="#eab308"
          strokeWidth="20"
          strokeLinecap="round"
        />
        
        {/* Green zone (81-100) */}
        <path
          d="M 174 82 A 80 80 0 0 1 230 150"
          fill="none"
          stroke="#22c55e"
          strokeWidth="20"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line x1="150" y1="150" x2={x} y2={y} stroke={color} strokeWidth="4" strokeLinecap="round" />
        
        {/* Arrow tip on needle */}
        <polygon
          points={`${x},${y} ${x - 6},${y + 8} ${x + 6},${y + 8}`}
          fill={color}
        />
        
        {/* Center dot */}
        <circle cx="150" cy="150" r="8" fill={color} />

        {/* Labels */}
        <text x="75" y="175" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">0</text>
        <text x="150" y="50" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">50</text>
        <text x="225" y="175" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">100</text>
      </svg>
      
      <div className="mt-4 text-center">
        <div className="text-3xl font-bold text-gray-800">{efficiency.toFixed(1)}%</div>
        <div className={`text-sm font-semibold mt-1 px-3 py-1 rounded-full inline-block ${
          status === 'Excellent' ? 'bg-green-100 text-green-700' :
          status === 'Good' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {status}
        </div>
      </div>
    </div>
  );
};

// Bar Chart Component for Green Factory
const GreenFactoryBarChart = ({ title, subtitle, labels, values }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 100);
  const minVal = 0;
  const range = maxVal - minVal;

  const barWidth = plotWidth / (values.length * 1.5);
  const getX = (idx) => padding + (idx * plotWidth) / values.length + (plotWidth / values.length / 2 - barWidth / 2);
  const getY = (val) => svgHeight - padding - ((val - minVal) / range) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / range) * plotHeight;

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        {values.map((val, idx) => (
          <g key={`bar-${idx}`}>
            <rect x={getX(idx)} y={getY(val)} width={barWidth} height={getBarHeight(val)} fill="#10b981" stroke="white" strokeWidth="1" rx="4" />
            <text x={getX(idx) + barWidth / 2} y={getY(val) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#10b981">{val.toFixed(1)}%</text>
          </g>
        ))}

        {labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx * plotWidth) / labels.length + (plotWidth / labels.length / 2)} y={svgHeight - padding + 30} textAnchor="middle" fontSize="11" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString()) + '%';
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
      </svg>
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#10b981] rounded"></span><span className="text-sm text-gray-600">Green Factory %</span></div>
      </div>
    </div>
  );
};

// Bar Chart component for Zero Accidents (shows actual vs target per month)
const ZeroAccidentsBarChart = ({ title, subtitle, labels, actuals, targets }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals, ...targets, 1);
  const minVal = 0;
  const range = maxVal - minVal;
  const groupWidth = plotWidth / labels.length;
  const barWidth = Math.min(24, groupWidth * 0.35);
  const getX = (idx, which) => {
    const base = padding + idx * groupWidth + groupWidth / 2;
    // which: 0 = actual (left), 1 = target (right)
    return base + (which === 0 ? -barWidth / 1.5 : barWidth / 1.5);
  };
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {(() => {
          // Use integer ticks (0,1,2,3...) when values are small (<=10), otherwise fallback to 5 evenly spaced ticks
          let tickValues;
          if (maxVal <= 10) {
            const maxTick = Math.max(3, Math.ceil(maxVal));
            tickValues = Array.from({ length: maxTick + 1 }, (_, i) => i);
          } else {
            const ticks = 5;
            tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          }
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        {labels.map((label, idx) => (
          <g key={`group-${idx}`}>
            <rect x={getX(idx, 0)} y={getY(actuals[idx] || 0)} width={barWidth} height={getBarHeight(actuals[idx] || 0)} fill="#41aafe" rx="4" />
            <rect x={getX(idx, 1)} y={getY(targets[idx] || 0)} width={barWidth} height={getBarHeight(targets[idx] || 0)} fill="#ffb74d" rx="4" />

            <text x={getX(idx, 0) + barWidth / 2} y={getY(actuals[idx] || 0) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0ea5e9">{(actuals[idx] || 0).toFixed(1)}</text>
            <text x={getX(idx, 1) + barWidth / 2} y={getY(targets[idx] || 0) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#c97706">{(targets[idx] || 0).toFixed(1)}</text>
          </g>
        ))}

        {labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + idx * groupWidth + groupWidth / 2} y={svgHeight - padding + 30} textAnchor="middle" fontSize="11" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {(() => {
          let tickValues;
          if (maxVal <= 10) {
            const maxTick = Math.max(3, Math.ceil(maxVal));
            tickValues = Array.from({ length: maxTick + 1 }, (_, i) => i);
          } else {
            const ticks = 5;
            tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          }
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = Number.isFinite(tick) ? Math.round(tick).toString() : String(tick);
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
      </svg>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#41aafe] rounded"></span><span className="text-sm text-gray-600">Actual</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#ffb74d] rounded"></span><span className="text-sm text-gray-600">Target</span></div>
      </div>
    </div>
  );
};

// On Time Delivery grouped bar chart (Target vs Achieved)
const OnTimeDeliveryBarChart = ({ title, subtitle, labels, actuals, targets }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals, ...targets, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const groupWidth = plotWidth / labels.length;
  const barWidth = Math.min(20, groupWidth * 0.28);
  const getX = (idx, which) => {
    const base = padding + idx * groupWidth + groupWidth / 2;
    return base + (which === 'target' ? -barWidth - 4 : barWidth + 4 - barWidth);
  };
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        {labels.map((label, idx) => (
          <g key={`group-${idx}`}>
            <rect x={getX(idx, 'target')} y={getY(targets[idx] || 0)} width={barWidth} height={getBarHeight(targets[idx] || 0)} fill="#fbbf24" rx="4" />
            <rect x={getX(idx, 'actual')} y={getY(actuals[idx] || 0)} width={barWidth} height={getBarHeight(actuals[idx] || 0)} fill="#22c55e" rx="4" />

            <text x={getX(idx, 'target') + barWidth / 2} y={getY(targets[idx] || 0) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#92400e">{Math.round(targets[idx] || 0)}</text>
            <text x={getX(idx, 'actual') + barWidth / 2} y={getY(actuals[idx] || 0) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#166534">{Math.round(actuals[idx] || 0)}</text>
          </g>
        ))}

        {labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + idx * groupWidth + groupWidth / 2} y={svgHeight - padding + 30} textAnchor="middle" fontSize="11" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString();
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
      </svg>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#fbbf24] rounded"></span><span className="text-sm text-gray-600">Target</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#22c55e] rounded"></span><span className="text-sm text-gray-600">Achieved</span></div>
      </div>
    </div>
  );
};

// Theme (Bar chart) component
const Box4ThemeBarChart = ({ title, subtitle, labels, values }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const barWidth = plotWidth / (values.length * 1.5);
  const getX = (idx) => padding + (idx * plotWidth) / values.length + (plotWidth / values.length / 2 - barWidth / 2);
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        {values.map((val, idx) => (
          <g key={`bar-${idx}`}>
            <rect x={getX(idx)} y={getY(val)} width={barWidth} height={getBarHeight(val)} fill="#3b82f6" stroke="white" strokeWidth="1" rx="4" />
            <text x={getX(idx) + barWidth / 2} y={getY(val) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e40af">{Math.round(val)}</text>
          </g>
        ))}

        {labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx * plotWidth) / labels.length + (plotWidth / labels.length / 2)} y={svgHeight - padding + 30} textAnchor="middle" fontSize="11" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString());
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
      </svg>
    </div>
  );
};

// Employees left line chart
const Box4EmployeesLineChart = ({ title, subtitle, labels, values }) => {
  const svgWidth = 900;
  const svgHeight = 350;
  const padding = 60;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * plotWidth;
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;

  const path = values.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');

  return (
    <div className="w-full h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px]">
        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </g>
            );
          });
        })()}

        <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />
        <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#1f2937" strokeWidth="2" />

        <path d={path} stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {values.map((val, idx) => (
          <g key={`dot-${idx}`}>
            <circle cx={getX(idx)} cy={getY(val)} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
            <text x={getX(idx)} y={getY(val) - 12} textAnchor="middle" fontSize="10" fontWeight="600" fill="#991b1b">{Math.round(val)}</text>
          </g>
        ))}

        {labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx / (labels.length - 1 || 1)) * plotWidth} y={svgHeight - padding + 30} textAnchor="middle" fontSize="11" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {(() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString());
            return (
              <text key={`y-label-${i}`} x={padding - 18} y={y + 5} textAnchor="end" fontSize="12" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
      </svg>
    </div>
  );
};

function ManagementDashboard() {
  const { user } = useAuth();
  const [kpiStats, setKpiStats] = useState({
    total: 0
  });
  const [pillerStats, setPillerStats] = useState({
    total: 0,
    pillers: []
  });
  const [employeeStats, setEmployeeStats] = useState({
    total: 0
  });
  const [departmentStats, setDepartmentStats] = useState({
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [industry40Chart, setIndustry40Chart] = useState(null);
  const [industry40Loading, setIndustry40Loading] = useState(false);
  const [zeroQualityChart, setZeroQualityChart] = useState(null);
  const [zeroQualityLoading, setZeroQualityLoading] = useState(false);
  const [monthlySalesData, setMonthlySalesData] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [selectedSalesIndex, setSelectedSalesIndex] = useState(0);
  const [monthlyProfitData, setMonthlyProfitData] = useState([]);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [selectedProfitIndex, setSelectedProfitIndex] = useState(0);
  const [monthlyEfficiency, setMonthlyEfficiency] = useState([]);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);
  const [selectedFiscalIndex, setSelectedFiscalIndex] = useState(0);
  const [greenFactoryChart, setGreenFactoryChart] = useState(null);
  const [greenFactoryLoading, setGreenFactoryLoading] = useState(false);
  const [zeroAccidentsChart, setZeroAccidentsChart] = useState(null);
  const [zeroAccidentsLoading, setZeroAccidentsLoading] = useState(false);
  const [onTimeDeliveryChart, setOnTimeDeliveryChart] = useState(null);
  const [onTimeDeliveryLoading, setOnTimeDeliveryLoading] = useState(false);
  const [themeChart, setThemeChart] = useState(null);
  const [themeChartLoading, setThemeChartLoading] = useState(false);
  const [employeesChart, setEmployeesChart] = useState(null);
  const [employeesChartLoading, setEmployeesChartLoading] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null);
  const [expandedChartData, setExpandedChartData] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const [kpisResponse, pillersResponse, usersResponse, departmentsResponse] = await Promise.all([
        getKPIs(),
        getPillers(),
        getUsers(),
        getDepartments()
      ]);

      // console.log('KPIs Response:', kpisResponse);
      // console.log('Pillers Response:', pillersResponse);

      if (kpisResponse?.data) {
        const kpisData = kpisResponse.data;
        // Check if data is wrapped in another object (e.g., { data: [...] })
        const kpis = Array.isArray(kpisData) ? kpisData : (Array.isArray(kpisData?.data) ? kpisData.data : []);
        //console.log('KPIs array:', kpis);
        setKpiStats({
          total: kpis.length
        });
      }

      if (pillersResponse?.data) {
        const pillersData = pillersResponse.data;
        // Check if data is wrapped in another object (e.g., { data: [...] })
        const pillers = Array.isArray(pillersData) ? pillersData : (Array.isArray(pillersData?.data) ? pillersData.data : []);
        //console.log('Pillers array:', pillers);
        setPillerStats({
          total: pillers.length,
          pillers: pillers
        });
      }

      if (usersResponse?.data) {
        const usersData = usersResponse.data;
        const users = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.data) ? usersData.data : []);
        setEmployeeStats({
          total: users.length
        });
      }

      if (departmentsResponse?.data) {
        const departmentsData = departmentsResponse.data;
        const departments = Array.isArray(departmentsData) ? departmentsData : (Array.isArray(departmentsData?.data) ? departmentsData.data : []);
        setDepartmentStats({
          total: departments.length
        });
      }

      // Load chart data
      loadIndustry40Chart();
      loadZeroQualityChart();
      loadSalesChart();
      loadProfitabilityData();
      loadPlantEfficiency();
      loadGreenFactoryChart();
      loadZeroAccidentsChart();
      loadOnTimeDeliveryChart();
      loadThemeChart();
      loadEmployeesChart();
      loadOnTimeDeliveryChart();
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGreenFactoryChart = async () => {
    try {
      setGreenFactoryLoading(true);
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];
      const greenKpis = kpis.filter(k => (k.title || '').toLowerCase().includes('green'));
      if (!greenKpis || greenKpis.length === 0) {
        setGreenFactoryChart(null);
        return;
      }

      let selectedValue = null;
      for (const kpi of greenKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const vals = valuesRes.data?.data || [];
        if (vals && vals.length > 0) { selectedValue = vals[0]; break; }
      }

      if (!selectedValue) { setGreenFactoryChart(null); return; }

      const valuesByMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-values/${selectedValue.id}/monthly-data/${year}`);
          const rows = resp.data?.data || [];
          const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);
          valuesByMonth.push(monthRow ? Number(monthRow.actual_value || 0) : 0);
        } catch (err) {
          valuesByMonth.push(0);
        }
      }

      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setGreenFactoryChart({ title: `Environment (${displayYear})`, subtitle: 'Green Factory', labels, values: valuesByMonth });
    } catch (err) {
      console.error('Failed to load Green Factory chart', err);
      setGreenFactoryChart(null);
    } finally {
      setGreenFactoryLoading(false);
    }
  };

  const loadZeroAccidentsChart = async () => {
    try {
      setZeroAccidentsLoading(true);
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];
      const accidentKpis = kpis.filter(k => (k.title || '').toLowerCase().includes('accident'));
      if (!accidentKpis || accidentKpis.length === 0) { setZeroAccidentsChart(null); return; }

      let selectedValue = null;
      for (const kpi of accidentKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const vals = valuesRes.data?.data || [];
        if (vals && vals.length > 0) { selectedValue = vals[0]; break; }
      }

      if (!selectedValue) { setZeroAccidentsChart(null); return; }

      const byMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-values/${selectedValue.id}/monthly-data/${year}`);
          const rows = resp.data?.data || [];
          const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);
          if (monthRow) byMonth.push({ actual: Number(monthRow.actual_value || 0), target: Number(monthRow.target_value || 0) });
          else byMonth.push({ actual: 0, target: 0 });
        } catch (err) {
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]);
      const actuals = byMonth.map(d => d.actual);
      const targets = byMonth.map(d => d.target);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setZeroAccidentsChart({ title: `Safety (${displayYear})`, subtitle: 'Zero Accidents', labels, actuals, targets });
    } catch (err) {
      console.error('Failed to load Zero Accidents chart', err);
      setZeroAccidentsChart(null);
    } finally {
      setZeroAccidentsLoading(false);
    }
  };

  const loadOnTimeDeliveryChart = async () => {
    try {
      setOnTimeDeliveryLoading(true);
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];

      const normalize = (v) => (v || '').toLowerCase();
      const score = (t) => {
        const s = normalize(t);
        let sc = 0;
        if (s.includes('on time')) sc += 3;
        if (s.includes('ontime')) sc += 2;
        if (s.includes('delivery')) sc += 2;
        return sc;
      };

      const deliveryKpis = kpis
        .filter(k => {
          const t = normalize(k.title);
          return t.includes('delivery') || t.includes('on time') || t.includes('ontime');
        })
        .sort((a, b) => score(b.title) - score(a.title));

      if (!deliveryKpis.length) { setOnTimeDeliveryChart(null); return; }

      let selectedValue = null;
      for (const kpi of deliveryKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const vals = valuesRes.data?.data || [];
        if (vals && vals.length > 0) { selectedValue = vals[0]; break; }
      }

      if (!selectedValue) { setOnTimeDeliveryChart(null); return; }

      const byMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-values/${selectedValue.id}/monthly-data/${year}`);
          const rows = resp.data?.data || [];
          const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);
          if (monthRow) byMonth.push({ actual: Number(monthRow.actual_value || 0), target: Number(monthRow.target_value || 0) });
          else byMonth.push({ actual: 0, target: 0 });
        } catch (err) {
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]);
      const actuals = byMonth.map(d => d.actual);
      const targets = byMonth.map(d => d.target);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;

      setOnTimeDeliveryChart({ title: `On Time Delivery (${displayYear})`, subtitle: 'Target vs Achieved', labels, actuals, targets });
    } catch (err) {
      console.error('Failed to load On Time Delivery chart', err);
      setOnTimeDeliveryChart(null);
    } finally {
      setOnTimeDeliveryLoading(false);
    }
  };

  const loadThemeChart = async () => {
    try {
      setThemeChartLoading(true);
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];

      const normalize = (v) => (v || '').toLowerCase();
      const score = (t) => {
        const s = normalize(t);
        let sc = 0;
        if (s.includes('theme')) sc += 3;
        if (s.includes('unlock')) sc += 2;
        if (s.includes('power') || s.includes('you')) sc += 1;
        return sc;
      };

      const themeKpis = kpis
        .filter(k => {
          const t = normalize(k.title);
          return t.includes('theme') || (t.includes('unlock') && t.includes('power')) || (t.includes('2025') && t.includes('2026'));
        })
        .sort((a, b) => score(b.title) - score(a.title));

      if (!themeKpis.length) { setThemeChart(null); return; }

      let selectedValue = null;
      for (const kpi of themeKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const vals = valuesRes.data?.data || [];
        if (vals && vals.length > 0) { selectedValue = vals[0]; break; }
      }

      if (!selectedValue) { setThemeChart(null); return; }

      const rowsByYear = {};
      const fiscalYears = Array.from(new Set(FISCAL_MONTH_SEQUENCE.map(e => e.year)));
      for (const year of fiscalYears) {
        try {
          const resp = await api.get(`/kpi-values/${selectedValue.id}/monthly-data/${year}`);
          rowsByYear[year] = resp.data?.data || [];
        } catch (err) { rowsByYear[year] = []; }
      }

      const themeByMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        const rows = rowsByYear[year] || [];
        const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);
        if (monthRow) themeByMonth.push(Number(monthRow.actual_value || 0));
        else themeByMonth.push(0);
      }

      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setThemeChart({ title: `Theme Of The Year ${displayYear}`, subtitle: 'Unlock The Power of You', labels, values: themeByMonth });
    } catch (err) {
      console.error('Failed to load Theme chart', err);
      setThemeChart(null);
    } finally { setThemeChartLoading(false); }
  };

  const loadEmployeesChart = async () => {
    try {
      setEmployeesChartLoading(true);
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];

      const normalize = (v) => (v || '').toLowerCase();
      const score = (t) => {
        const s = normalize(t);
        let sc = 0;
        if (s.includes('employee') || s.includes('employees')) sc += 3;
        if (s.includes('left') || s.includes('attrition')) sc += 2;
        return sc;
      };

      const employeeKpis = kpis
        .filter(k => {
          const t = normalize(k.title);
          return (t.includes('employee') || t.includes('employees')) && (t.includes('left') || t.includes('attrition'));
        })
        .sort((a, b) => score(b.title) - score(a.title));

      if (!employeeKpis.length) { setEmployeesChart(null); return; }

      let selectedValue = null;
      for (const kpi of employeeKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const vals = valuesRes.data?.data || [];
        if (vals && vals.length > 0) { selectedValue = vals[0]; break; }
      }

      if (!selectedValue) { setEmployeesChart(null); return; }

      const rowsByYear = {};
      const fiscalYears = Array.from(new Set(FISCAL_MONTH_SEQUENCE.map(e => e.year)));
      for (const year of fiscalYears) {
        try {
          const resp = await api.get(`/kpi-values/${selectedValue.id}/monthly-data/${year}`);
          rowsByYear[year] = resp.data?.data || [];
        } catch (err) { rowsByYear[year] = []; }
      }

      const employeesByMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        const rows = rowsByYear[year] || [];
        const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);
        if (monthRow) employeesByMonth.push(Number(monthRow.actual_value || 0));
        else employeesByMonth.push(0);
      }

      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]);
      setEmployeesChart({ title: 'No. of Employees Who Left', subtitle: 'Monthly Attrition', labels, values: employeesByMonth });
    } catch (err) {
      console.error('Failed to load Employees chart', err);
      setEmployeesChart(null);
    } finally { setEmployeesChartLoading(false); }
  };

  const loadPlantEfficiency = async () => {
    try {
      setEfficiencyLoading(true);
      const kpiValuesRes = await api.get('/kpi-values');
      const kpiValues = (kpiValuesRes.data?.data || []).slice(0, 10);

      const efficiencyByIndex = {};

      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        const monthAchievements = [];

        for (const kv of kpiValues) {
          try {
            const resp = await api.get(`/kpi-values/${kv.id}/monthly-data/${year}`);
            const rows = resp.data?.data || [];
            const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);

            if (monthRow) {
              const target = Number(monthRow.target_value || 0);
              const actual = Number(monthRow.actual_value || 0);

              if (target > 0) {
                const achievement = Math.min(100, (actual / target) * 100);
                monthAchievements.push(achievement);
              }
            }
          } catch (err) {
            // Skip errors for individual KPI values
          }
        }

        if (monthAchievements.length > 0) {
          const avg = monthAchievements.reduce((a, b) => a + b, 0) / monthAchievements.length;
          efficiencyByIndex[idx] = Math.round(avg * 10) / 10;
        } else {
          efficiencyByIndex[idx] = 0;
        }
      }

      const monthly = FISCAL_MONTH_SEQUENCE.map((entry, idx) => ({
        month: entry.month,
        year: entry.year,
        efficiency: efficiencyByIndex[idx] || 0,
      }));

      setMonthlyEfficiency(monthly);
      setSelectedFiscalIndex(0);
    } catch (err) {
      console.error('Failed to load plant efficiency', err);
    } finally {
      setEfficiencyLoading(false);
    }
  };

  const openExpandedChart = (chartType, data) => {
    setExpandedChart(chartType);
    setExpandedChartData(data);
  };

  const closeExpandedChart = () => {
    setExpandedChart(null);
    setExpandedChartData(null);
  };

  const loadIndustry40Chart = async () => {
    try {
      setIndustry40Loading(true);
      const currentYear = new Date().getFullYear();
      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];
      const industryKpis = kpis.filter(k => (k.title || '').toLowerCase().includes('industry'));
      
      if (!industryKpis || industryKpis.length === 0) {
        console.warn('Industry 4.0 KPI not found');
        setIndustry40Chart(null);
        return;
      }

      let industry40Value = null;
      
      for (const kpi of industryKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const kpiValues = valuesRes.data?.data || [];
        
        if (kpiValues && kpiValues.length > 0) {
          industry40Value = kpiValues[0];
          break;
        }
      }
      
      if (!industry40Value) {
        console.warn('No KPI values found for any Industry KPI');
        setIndustry40Chart(null);
        return;
      }

      const buildSeries = (rows) => {
        const byMonth = rows.reduce((acc, row) => {
          const key = Number(row.month);
          acc[key] = row;
          return acc;
        }, {});

        const labels = MONTH_LABELS.slice();
        const actuals = labels.map((_, idx) => Number(byMonth[idx + 1]?.actual_value || 0));
        const targets = labels.map((_, idx) => Number(byMonth[idx + 1]?.target_value || 0));
        return { labels, actuals, targets };
      };

      let rows = [];
      for (const year of [currentYear, currentYear - 1]) {
        try {
          const resp = await api.get(`/kpi-values/${industry40Value.id}/monthly-data/${year}`);
          rows = resp.data?.data || [];
          if (rows.length > 0) break;
        } catch (err) {
          console.warn(`Failed to fetch Industry40 data for year ${year}`);
        }
      }

      if (!rows.length) {
        console.warn('No monthly data for Industry 4.0 in any year');
        setIndustry40Chart(null);
        return;
      }

      const { labels, actuals, targets } = buildSeries(rows);
      const displayYear = rows[0]?.year || currentYear;

      setIndustry40Chart({
        title: `Industry 4.0 Performance Trend (${displayYear})`,
        labels,
        actuals,
        targets,
      });
    } catch (err) {
      console.error('Failed to load Industry 4.0 chart', err);
      setIndustry40Chart(null);
    } finally {
      setIndustry40Loading(false);
    }
  };

  const loadZeroQualityChart = async () => {
    try {
      setZeroQualityLoading(true);
      const currentYear = new Date().getFullYear();

      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];
      const qualityKpis = kpis.filter(k => 
        (k.title || '').toLowerCase().includes('quality') || 
        (k.title || '').toLowerCase().includes('complaint')
      );
      if (!qualityKpis || qualityKpis.length === 0) {
        console.warn('No Quality/Complaint KPIs found. Available KPI titles:', kpis.map(k => k.title).slice(0,50));
      }
      
      if (!qualityKpis || qualityKpis.length === 0) {
        console.warn('Zero Quality Complaints KPI not found');
        setZeroQualityChart(null);
        return;
      }

      let zeroQualityValue = null;
      
      for (const kpi of qualityKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const kpiValues = valuesRes.data?.data || [];
        if (!kpiValues || kpiValues.length === 0) {
          console.debug(`KPI id ${kpi.id} (${kpi.title}) has no kpi-values`);
          continue;
        }
        zeroQualityValue = kpiValues[0];
        break;
      }
      
      if (!zeroQualityValue) {
        console.warn('No KPI values found for any Quality KPI');
        setZeroQualityChart(null);
        return;
      }

      const buildSeries = (rows) => {
        const byMonth = rows.reduce((acc, row) => {
          const key = Number(row.month);
          acc[key] = row;
          return acc;
        }, {});

        const labels = MONTH_LABELS.slice();
        const actuals = labels.map((_, idx) => Number(byMonth[idx + 1]?.actual_value || 0));
        const targets = labels.map((_, idx) => Number(byMonth[idx + 1]?.target_value || 0));
        return { labels, actuals, targets };
      };

      let rows = [];
      for (const year of [currentYear, currentYear - 1]) {
        try {
          const resp = await api.get(`/kpi-values/${zeroQualityValue.id}/monthly-data/${year}`);
          rows = resp.data?.data || [];
          if (rows.length > 0) break;
        } catch (err) {
          console.warn(`Failed to fetch Quality data for year ${year}`);
        }
      }

      if (!rows.length) {
        console.warn('No monthly data for Zero Quality Complaints in any year. Last fetched rows:', rows);
        setZeroQualityChart(null);
        return;
      }

      const { labels, actuals, targets } = buildSeries(rows);
      const displayYear = rows[0]?.year || currentYear;

      setZeroQualityChart({
        title: `Zero Quality Complaints (${displayYear})`,
        labels,
        actuals,
        targets,
      });
    } catch (err) {
      console.error('Failed to load Zero Quality Complaints chart', err);
      setZeroQualityChart(null);
    } finally {
      setZeroQualityLoading(false);
    }
  };

  const loadSalesChart = async () => {
    try {
      setSalesLoading(true);

      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];

      const salesKpis = kpis.filter(k => 
        (k.title || '').toLowerCase().includes('sales') || 
        (k.title || '').toLowerCase().includes('revenue')
      );
      
      if (!salesKpis || salesKpis.length === 0) {
        console.warn('Sales/Revenue KPI not found');
        setMonthlySalesData([]);
        return;
      }

      let salesValue = null;
      
      for (const kpi of salesKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const kpiValues = valuesRes.data?.data || [];
        
        if (kpiValues && kpiValues.length > 0) {
          salesValue = kpiValues[0];
          break;
        }
      }
      
      if (!salesValue) {
        console.warn('No KPI values found for any Sales KPI');
        setMonthlySalesData([]);
        return;
      }

      const salesByMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-values/${salesValue.id}/monthly-data/${year}`);
          const rows = resp.data?.data || [];
          const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);

          if (monthRow) {
            const target = Number(monthRow.target_value || 0);
            const actual = Number(monthRow.actual_value || 0);
            salesByMonth.push({ month, year, actual, target });
          } else {
            salesByMonth.push({ month, year, actual: 0, target: 0 });
          }
        } catch (err) {
          salesByMonth.push({ month, year, actual: 0, target: 0 });
        }
      }

      setMonthlySalesData(salesByMonth);
      setSelectedSalesIndex(0);
    } catch (err) {
      console.error('Failed to load Sales data', err);
      setMonthlySalesData([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadProfitabilityData = async () => {
    try {
      setProfitabilityLoading(true);

      const kpisRes = await api.get('/kpis');
      const kpis = kpisRes.data?.data || [];

      const profitKpis = kpis.filter(k => 
        (k.title || '').toLowerCase().includes('profit') || 
        (k.title || '').toLowerCase().includes('pl')
      );
      
      if (!profitKpis || profitKpis.length === 0) {
        console.warn('Profitability KPI not found');
        setMonthlyProfitData([]);
        return;
      }

      let profitValue = null;
      
      for (const kpi of profitKpis) {
        const valuesRes = await api.get(`/kpi-values/kpi/${kpi.id}`);
        const kpiValues = valuesRes.data?.data || [];
        
        if (kpiValues && kpiValues.length > 0) {
          profitValue = kpiValues[0];
          break;
        }
      }
      
      if (!profitValue) {
        console.warn('No KPI values found for any Profit KPI');
        setMonthlyProfitData([]);
        return;
      }

      const profitByMonth = [];
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-values/${profitValue.id}/monthly-data/${year}`);
          const rows = resp.data?.data || [];
          const monthRow = rows.find(r => Number(r.month) === month && Number(r.year) === year);

          if (monthRow) {
            const profit = Number(monthRow.actual_value || 0);
            const target = Number(monthRow.target_value || 100);
            profitByMonth.push({ month, year, profit, target });
          } else {
            profitByMonth.push({ month, year, profit: 0, target: 100 });
          }
        } catch (err) {
          profitByMonth.push({ month, year, profit: 0, target: 100 });
        }
      }

      setMonthlyProfitData(profitByMonth);
      setSelectedProfitIndex(0);
    } catch (err) {
      console.error('Failed to load Profitability data', err);
      setMonthlyProfitData([]);
    } finally {
      setProfitabilityLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Management Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-500 text-sm font-semibold">Total KPIs</div>
            <div className="text-3xl">🎯</div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : kpiStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-500 text-sm font-semibold">Total Pillars</div>
            <div className="text-3xl">🏛️</div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : pillerStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-500 text-sm font-semibold">Total Employees</div>
            <div className="text-3xl">👥</div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : employeeStats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-500 text-sm font-semibold">Total Departments</div>
            <div className="text-3xl">🏢</div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{loading ? 0 : departmentStats.total}</div>
        </div>
      </div>

      {/* Performance Dashboard Section */}
      <div className="mt-8">
        <h2 className="text-2xl text-center justify-center font-bold text-gray-800 mb-6">📊 Performance Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-6">
          {/* Plant Efficiency Speedometer */}
          <div className="min-h-[400px] xl:col-span-2">
          <div
            className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full"
            role="button"
            tabIndex={0}
            onClick={() => openExpandedChart('plantEfficiency', { monthlyEfficiency, selectedFiscalIndex })}
            onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('plantEfficiency', { monthlyEfficiency, selectedFiscalIndex })}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Plant Efficiency</h3>
            {efficiencyLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : (
              <div className="flex items-center justify-center gap-4 relative">
                <button 
                  className="bg-gray-100 border border-gray-300 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!monthlyEfficiency.length) return;
                    setSelectedFiscalIndex(selectedFiscalIndex === 0 ? monthlyEfficiency.length - 1 : selectedFiscalIndex - 1);
                  }}
                  disabled={!monthlyEfficiency.length}
                >
                  ‹
                </button>
                
                <SpeedometerGauge 
                  efficiency={monthlyEfficiency[selectedFiscalIndex]?.efficiency || 0}
                  month={MONTH_LABELS[(monthlyEfficiency[selectedFiscalIndex]?.month || 1) - 1]}
                  year={monthlyEfficiency[selectedFiscalIndex]?.year || ''}
                />

                <button 
                  className="bg-gray-100 border border-gray-300 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!monthlyEfficiency.length) return;
                    setSelectedFiscalIndex(selectedFiscalIndex === monthlyEfficiency.length - 1 ? monthlyEfficiency.length - 1 : selectedFiscalIndex + 1);
                  }}
                  disabled={!monthlyEfficiency.length || selectedFiscalIndex >= monthlyEfficiency.length - 1}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Industry 4.0 Chart */}
        <div className="min-h-[400px] xl:col-span-2">
          <div
            className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full"
            role="button"
            tabIndex={0}
            onClick={() => openExpandedChart('industry40', industry40Chart || { title: 'Industry 4.0 Performance', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
            onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('industry40', industry40Chart || { title: 'Industry 4.0 Performance', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
          >
            {industry40Loading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : industry40Chart ? (
              <Industry40LineChart
                title={industry40Chart.title}
                labels={industry40Chart.labels}
                actuals={industry40Chart.actuals}
                targets={industry40Chart.targets}
              />
            ) : (
              <Industry40LineChart
                title="Industry 4.0 Performance"
                labels={MONTH_LABELS}
                actuals={Array(12).fill(0)}
                targets={Array(12).fill(0)}
              />
            )}
          </div>
        </div>

        {/* Zero Quality Complaints Chart */}
        <div className="min-h-[400px] xl:col-span-2">
          <div
            className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full"
            role="button"
            tabIndex={0}
            onClick={() => openExpandedChart('zeroQuality', zeroQualityChart || { title: 'Zero Quality Complaints', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
            onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('zeroQuality', zeroQualityChart || { title: 'Zero Quality Complaints', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
          >
            {zeroQualityLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : zeroQualityChart ? (
              <Industry40LineChart
                title={zeroQualityChart.title}
                labels={zeroQualityChart.labels}
                actuals={zeroQualityChart.actuals}
                targets={zeroQualityChart.targets}
              />
            ) : (
              <Industry40LineChart
                title="Zero Quality Complaints"
                labels={MONTH_LABELS}
                actuals={Array(12).fill(0)}
                targets={Array(12).fill(0)}
              />
            )}
          </div>
        </div>

        {/* Revenue and Profitability Split Chart */}
        <div className="min-h-[400px] xl:col-span-4">
          <div
            className="bg-white rounded-lg shadow border-2 border-blue-500 flex flex-col md:flex-row h-full overflow-hidden"
            role="button"
            tabIndex={0}
            onClick={() => openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
            onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
          >
            {/* Revenue Section */}
            <div className="flex-1 p-4 md:p-6 flex flex-col md:border-r border-gray-200 min-w-0">
              <h4 className="text-xs md:text-sm font-bold text-gray-500 mb-3 md:mb-4 text-center tracking-wide">REVENUE</h4>
              {salesLoading ? (
                <div className="flex items-center justify-center p-4 md:p-8 text-gray-500 text-sm">Loading...</div>
              ) : (
                <div className="flex items-center justify-center gap-2 md:gap-4 flex-1 overflow-hidden">
                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlySalesData.length) return;
                      setSelectedSalesIndex(selectedSalesIndex === 0 ? monthlySalesData.length - 1 : selectedSalesIndex - 1);
                    }}
                    disabled={!monthlySalesData.length}
                  >
                    ‹
                  </button>
                  
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <h5 className="text-xs md:text-sm font-semibold text-gray-800 mb-1 md:mb-2">
                      {MONTH_LABELS[(monthlySalesData[selectedSalesIndex]?.month || 1) - 1]} {monthlySalesData[selectedSalesIndex]?.year || ''}
                    </h5>
                    <svg viewBox="0 0 200 200" className="w-full max-w-[140px] md:max-w-[180px] h-auto">
                      {(() => {
                        const salesData = monthlySalesData[selectedSalesIndex] || { actual: 0, target: 100 };
                        const radius = 70;
                        const cx = 100;
                        const cy = 100;
                        const actual = salesData.actual;
                        const target = salesData.target;
                        const achieved = Math.min(actual, target);
                        const remaining = Math.max(0, target - actual);
                        const total = target || 100;
                        
                        const achievedAngle = (achieved / total) * 360;
                        const achievedRadians = (achievedAngle * Math.PI) / 180;
                        
                        const x1 = cx + radius * Math.cos(-Math.PI / 2);
                        const y1 = cy + radius * Math.sin(-Math.PI / 2);
                        const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                        const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                        
                        const largeArc = achievedAngle > 180 ? 1 : 0;
                        
                        return (
                          <>
                            {achieved > 0 && (
                              <path
                                d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                fill="#3b82f6"
                                stroke="white"
                                strokeWidth="2"
                              />
                            )}
                            
                            {remaining > 0 && (
                              <path
                                d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`}
                                fill="#e5e7eb"
                                stroke="white"
                                strokeWidth="2"
                              />
                            )}
                            
                            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="#3b82f6">
                              {actual.toFixed(0)}
                            </text>
                            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#6b7280">
                              of {target.toFixed(0)} target
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                    
                    <div className="flex flex-col gap-1 md:gap-2 mt-2 md:mt-3">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#3b82f6] rounded flex-shrink-0"></span>
                        <span className="whitespace-nowrap">Sales: {(monthlySalesData[selectedSalesIndex]?.actual || 0).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#e5e7eb] rounded flex-shrink-0"></span>
                        <span className="whitespace-nowrap">Target: {(monthlySalesData[selectedSalesIndex]?.target || 0).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlySalesData.length) return;
                      setSelectedSalesIndex(selectedSalesIndex === monthlySalesData.length - 1 ? monthlySalesData.length - 1 : selectedSalesIndex + 1);
                    }}
                    disabled={!monthlySalesData.length || selectedSalesIndex >= monthlySalesData.length - 1}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            
            {/* Profitability Section */}
            <div className="flex-1 p-4 md:p-6 flex flex-col border-t md:border-t-0 min-w-0">
              <h4 className="text-xs md:text-sm font-bold text-gray-500 mb-3 md:mb-4 text-center tracking-wide">PROFITABILITY (YTD)</h4>
              {profitabilityLoading ? (
                <div className="flex items-center justify-center p-4 md:p-8 text-gray-500 text-sm">Loading...</div>
              ) : (
                <div className="flex items-center justify-center gap-2 md:gap-4 flex-1 overflow-hidden">
                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlyProfitData.length) return;
                      setSelectedProfitIndex(selectedProfitIndex === 0 ? monthlyProfitData.length - 1 : selectedProfitIndex - 1);
                    }}
                    disabled={!monthlyProfitData.length}
                  >
                    ‹
                  </button>
                  
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <h5 className="text-xs md:text-sm font-semibold text-gray-800 mb-1 md:mb-2">
                      {MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}
                    </h5>
                    <svg viewBox="0 0 200 200" className="w-full max-w-[140px] md:max-w-[180px] h-auto">
                      {(() => {
                        const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                        const radius = 70;
                        const cx = 100;
                        const cy = 100;
                        const profit = profitData.profit;
                        const target = profitData.target;
                        const achieved = Math.min(profit, target);
                        const remaining = Math.max(0, target - profit);
                        const total = achieved + remaining;
                        
                        const achievedAngle = (achieved / total) * 360;
                        const achievedRadians = (achievedAngle * Math.PI) / 180;
                        
                        const x1 = cx + radius * Math.cos(-Math.PI / 2);
                        const y1 = cy + radius * Math.sin(-Math.PI / 2);
                        const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                        const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                        
                        const largeArc = achievedAngle > 180 ? 1 : 0;
                        
                        return (
                          <>
                            {achieved > 0 && (
                              <path
                                d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                fill="#22c55e"
                                stroke="white"
                                strokeWidth="2"
                              />
                            )}
                            
                            {remaining > 0 && (
                              <path
                                d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`}
                                fill="#e5e7eb"
                                stroke="white"
                                strokeWidth="2"
                              />
                            )}
                            
                            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="#22c55e">
                              {profit.toFixed(1)}%
                            </text>
                            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#6b7280">
                              of {target}% target
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                    
                    <div className="flex flex-col gap-1 md:gap-2 mt-2 md:mt-3">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#22c55e] rounded flex-shrink-0"></span>
                        <span className="whitespace-nowrap">Achieved: {(monthlyProfitData[selectedProfitIndex]?.profit || 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#e5e7eb] rounded flex-shrink-0"></span>
                        <span className="whitespace-nowrap">Remaining: {Math.max(0, (monthlyProfitData[selectedProfitIndex]?.target || 100) - (monthlyProfitData[selectedProfitIndex]?.profit || 0)).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlyProfitData.length) return;
                      setSelectedProfitIndex(selectedProfitIndex === monthlyProfitData.length - 1 ? monthlyProfitData.length - 1 : selectedProfitIndex + 1);
                    }}
                    disabled={!monthlyProfitData.length || selectedProfitIndex >= monthlyProfitData.length - 1}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Combined charts: Zero Accidents, Green Factory, On Time Delivery, Theme, Employees (side-by-side) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full" role="button" tabIndex={0}
             onClick={() => openExpandedChart('zeroAccidents', zeroAccidentsChart || { title: 'Safety', subtitle: 'Zero Accidents', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
             onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('zeroAccidents', zeroAccidentsChart || { title: 'Safety', subtitle: 'Zero Accidents', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🦺 Zero Accidents</h3>
          {zeroAccidentsLoading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
          ) : zeroAccidentsChart ? (
            <ZeroAccidentsBarChart title={zeroAccidentsChart.title} subtitle={zeroAccidentsChart.subtitle} labels={zeroAccidentsChart.labels} actuals={zeroAccidentsChart.actuals} targets={zeroAccidentsChart.targets} />
          ) : (
            <ZeroAccidentsBarChart title="Safety" subtitle="Zero Accidents" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} actuals={Array(12).fill(0)} targets={Array(12).fill(0)} />
          )}
        </div>

        <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full" role="button" tabIndex={0}
             onClick={() => openExpandedChart('greenFactory', greenFactoryChart || { title: 'Environment', subtitle: 'Green Factory', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), values: Array(12).fill(0) })}
             onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('greenFactory', greenFactoryChart || { title: 'Environment', subtitle: 'Green Factory', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), values: Array(12).fill(0) })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🌿 Green Factory</h3>
          {greenFactoryLoading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
          ) : greenFactoryChart ? (
            <GreenFactoryBarChart title={greenFactoryChart.title} subtitle={greenFactoryChart.subtitle} labels={greenFactoryChart.labels} values={greenFactoryChart.values} />
          ) : (
            <GreenFactoryBarChart title="Environment" subtitle="Green Factory" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} />
          )}
        </div>

        <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-6 h-full" role="button" tabIndex={0}
             onClick={() => openExpandedChart('onTimeDelivery', onTimeDeliveryChart || { title: 'On Time Delivery', subtitle: 'Target vs Achieved', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
             onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('onTimeDelivery', onTimeDeliveryChart || { title: 'On Time Delivery', subtitle: 'Target vs Achieved', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🚚 On Time Delivery</h3>
          {onTimeDeliveryLoading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
          ) : onTimeDeliveryChart ? (
            <OnTimeDeliveryBarChart title={onTimeDeliveryChart.title} subtitle={onTimeDeliveryChart.subtitle} labels={onTimeDeliveryChart.labels} actuals={onTimeDeliveryChart.actuals} targets={onTimeDeliveryChart.targets} />
          ) : (
            <OnTimeDeliveryBarChart title="On Time Delivery" subtitle="Target vs Achieved" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} actuals={Array(12).fill(0)} targets={Array(12).fill(0)} />
          )}
        </div>

        <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 md:p-6 h-full md:col-span-2" role="button" tabIndex={0}
             onClick={() => openExpandedChart('themeEmployees', { themeChart, employeesChart })}
             onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('themeEmployees', { themeChart, employeesChart })}>
          <div className="flex flex-col md:flex-row h-full">
            <div className="flex-1 p-4 md:border-r border-gray-200 min-w-0">
              <h4 className="text-xs md:text-sm font-bold text-gray-500 mb-3 md:mb-4 text-center tracking-wide">THEME OF THE YEAR</h4>
              {themeChartLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
              ) : (
                <div className="h-full">
                  {themeChart ? (
                    <Box4ThemeBarChart title={themeChart.title} subtitle={themeChart.subtitle} labels={themeChart.labels} values={themeChart.values} />
                  ) : (
                    <Box4ThemeBarChart title="Theme Of The Year" subtitle="Unlock The Power of You" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} />
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-4 min-w-0">
              <h4 className="text-xs md:text-sm font-bold text-gray-500 mb-3 md:mb-4 text-center tracking-wide">EMPLOYEES LEFT</h4>
              {employeesChartLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
              ) : (
                <div className="h-full">
                  {employeesChart ? (
                    <Box4EmployeesLineChart title={employeesChart.title} subtitle={employeesChart.subtitle} labels={employeesChart.labels} values={employeesChart.values} />
                  ) : (
                    <Box4EmployeesLineChart title="No. of Employees Who Left" subtitle="Monthly Attrition" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {expandedChart && expandedChartData && (
        <div className="expanded-chart-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeExpandedChart}>
          <div className="expanded-chart-modal-content bg-white rounded-lg shadow-lg w-[90%] max-w-6xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {expandedChart === 'plantEfficiency'
                  ? 'Plant Efficiency (Apr - Mar)'
                  : expandedChart === 'industry40'
                  ? expandedChartData.title || 'Industry 4.0'
                  : expandedChart === 'zeroQuality'
                  ? expandedChartData.title || 'Zero Quality Complaints'
                  : expandedChart === 'zeroAccidents'
                  ? expandedChartData.title || 'Zero Accidents'
                  : expandedChart === 'greenFactory'
                  ? expandedChartData.title || 'Green Factory'
                  : expandedChart === 'salesProfit'
                  ? 'Revenue & Profitability'
                  : 'Chart'}
              </h2>
              <button className="text-xl p-1 mr-2" onClick={closeExpandedChart}>✕</button>
            </div>
            <div className="p-6">
              {expandedChart === 'plantEfficiency' && (
                <div className="flex items-center justify-center gap-6">
                  <button onClick={(e) => { e.stopPropagation(); if (!monthlyEfficiency.length) return; setSelectedFiscalIndex(selectedFiscalIndex === 0 ? monthlyEfficiency.length - 1 : selectedFiscalIndex - 1); }} className="px-3 py-2">‹</button>
                  <SpeedometerGauge
                    efficiency={monthlyEfficiency[selectedFiscalIndex]?.efficiency || 0}
                    month={MONTH_LABELS[(monthlyEfficiency[selectedFiscalIndex]?.month || 1) - 1]}
                    year={monthlyEfficiency[selectedFiscalIndex]?.year || ''}
                  />
                  <button onClick={(e) => { e.stopPropagation(); if (!monthlyEfficiency.length) return; setSelectedFiscalIndex(selectedFiscalIndex === monthlyEfficiency.length - 1 ? monthlyEfficiency.length - 1 : selectedFiscalIndex + 1); }} className="px-3 py-2">›</button>
                </div>
              )}

              {expandedChart === 'industry40' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                />
              )}

              {expandedChart === 'zeroQuality' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                />
              )}

              {expandedChart === 'zeroAccidents' && (
                <ZeroAccidentsBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                />
              )}

              {expandedChart === 'onTimeDelivery' && (
                <OnTimeDeliveryBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                />
              )}

              {expandedChart === 'themeChart' && (
                <Box4ThemeBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                />
              )}

              {expandedChart === 'employeesChart' && (
                <Box4EmployeesLineChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                />
              )}

              {expandedChart === 'greenFactory' && (
                <GreenFactoryBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                />
              )}

              {expandedChart === 'themeEmployees' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Theme Of The Year</h4>
                    <Box4ThemeBarChart
                      title={expandedChartData?.themeChart?.title || 'Theme Of The Year'}
                      subtitle={expandedChartData?.themeChart?.subtitle || 'Unlock The Power of You'}
                      labels={expandedChartData?.themeChart?.labels || FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])}
                      values={expandedChartData?.themeChart?.values || Array(12).fill(0)}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Employees Left</h4>
                    <Box4EmployeesLineChart
                      title={expandedChartData?.employeesChart?.title || 'No. of Employees Who Left'}
                      subtitle={expandedChartData?.employeesChart?.subtitle || 'Monthly Attrition'}
                      labels={expandedChartData?.employeesChart?.labels || FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])}
                      values={expandedChartData?.employeesChart?.values || Array(12).fill(0)}
                    />
                  </div>
                </div>
              )}

              {expandedChart === 'salesProfit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Revenue</h4>
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === 0 ? monthlySalesData.length - 1 : selectedSalesIndex - 1); }}>‹</button>
                      <div>
                        <h5>{MONTH_LABELS[(monthlySalesData[selectedSalesIndex]?.month || 1) - 1]} {monthlySalesData[selectedSalesIndex]?.year || ''}</h5>
                        <svg viewBox="0 0 200 200" className="w-full max-w-[300px] h-auto">
                          {(() => {
                            const salesData = monthlySalesData[selectedSalesIndex] || { actual: 0, target: 100 };
                            const radius = 90;
                            const cx = 100;
                            const cy = 100;
                            const actual = salesData.actual;
                            const target = salesData.target;
                            const achieved = Math.min(actual, target);
                            const remaining = Math.max(0, target - actual);
                            const total = target || 100;
                            const achievedAngle = (achieved / total) * 360;
                            const achievedRadians = (achievedAngle * Math.PI) / 180;
                            const x1 = cx + radius * Math.cos(-Math.PI / 2);
                            const y1 = cy + radius * Math.sin(-Math.PI / 2);
                            const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                            const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                            const largeArc = achievedAngle > 180 ? 1 : 0;
                            return (
                              <>
                                {achieved > 0 && <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill="#3b82f6" stroke="white" strokeWidth="2" />}
                                {remaining > 0 && <path d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`} fill="#e5e7eb" stroke="white" strokeWidth="2" />}
                                <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="700" fill="#3b82f6">{actual.toFixed(0)}</text>
                                <text x={cx} y={cy + 18} textAnchor="middle" fontSize="14" fill="#6b7280">of {target.toFixed(0)} target</text>
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === monthlySalesData.length - 1 ? monthlySalesData.length - 1 : selectedSalesIndex + 1); }}>›</button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Profitability</h4>
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); if (!monthlyProfitData.length) return; setSelectedProfitIndex(selectedProfitIndex === 0 ? monthlyProfitData.length - 1 : selectedProfitIndex - 1); }}>‹</button>
                      <div>
                        <h5>{MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}</h5>
                        <svg viewBox="0 0 200 200" className="w-full max-w-[300px] h-auto">
                          {(() => {
                            const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                            const radius = 90;
                            const cx = 100;
                            const cy = 100;
                            const profit = profitData.profit;
                            const target = profitData.target;
                            const achieved = Math.min(profit, target);
                            const remaining = Math.max(0, target - profit);
                            const total = achieved + remaining;
                            const achievedAngle = (achieved / total) * 360;
                            const achievedRadians = (achievedAngle * Math.PI) / 180;
                            const x1 = cx + radius * Math.cos(-Math.PI / 2);
                            const y1 = cy + radius * Math.sin(-Math.PI / 2);
                            const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                            const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                            const largeArc = achievedAngle > 180 ? 1 : 0;
                            return (
                              <>
                                {achieved > 0 && <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill="#22c55e" stroke="white" strokeWidth="2" />}
                                {remaining > 0 && <path d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`} fill="#e5e7eb" stroke="white" strokeWidth="2" />}
                                <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="700" fill="#22c55e">{profit.toFixed(1)}%</text>
                                <text x={cx} y={cy + 18} textAnchor="middle" fontSize="14" fill="#6b7280">of {target}% target</text>
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); if (!monthlyProfitData.length) return; setSelectedProfitIndex(selectedProfitIndex === monthlyProfitData.length - 1 ? monthlyProfitData.length - 1 : selectedProfitIndex + 1); }}>›</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default ManagementDashboard;
